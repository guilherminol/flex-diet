import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { connectDb, type Db } from "../src/db/connect.js";
import { runMigrations } from "../src/db/migrate.js";
import { runSeed } from "../src/db/seed/seed.js";
import {
  type ErroDominio,
  editarRegistro,
  listarRegistros,
  registrarRefeicao,
  removerRegistro,
  repetirRefeicao,
} from "../src/domain/refeicoes.js";
import { calcularSaldo, type Saldo } from "../src/domain/saldo.js";
import { hojeLocalSp } from "../src/lib/datas.js";

// Datas fixas p/ determinismo (metas com data_inicio 2020-01-01 valem p/ todas).
// Cada teste usa o SEU dia — o dedupe de 10 min (REG-06) pegaria payload
// idêntico no mesmo dia entre testes, que é comportamento desejado em prod.
const DIA_LISTAR = "2026-09-20";
const DIA_EDITAR = "2026-09-22";
const DIA_REMOVER = "2026-09-23";
const DIA_MOVER_DE = "2026-09-24";
const DIA_MOVER_PARA = "2026-09-25";
const DIA_INVALIDO = "2026-09-26";

let db: Db;
let idArroz: number;
let idBanana: number;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "flexdiet-refeicoes-"));
  db = connectDb(join(dir, "test.db"));
  await runMigrations(db, join(dir, "backups"));
  runSeed(db);
  const buscarId = db.prepare(
    `SELECT id FROM alimento WHERE fonte = 'taco' AND numero_taco = ?`,
  );
  idArroz = (buscarId.get("5") as { id: number }).id;
  idBanana = (buscarId.get("178") as { id: number }).id;
  // metas vigentes desde 2020 — saldo 'ok' em qualquer data dos testes
  db.prepare(
    `INSERT INTO meta_diaria (data_inicio, kcal, proteina_g, carbo_g, gordura_g, timestamp_utc)
     VALUES ('2020-01-01', 2000, 150, 200, 70, '2020-01-01T12:00:00.000Z')`,
  ).run();
});

const capturarErro = (acao: () => unknown): ErroDominio => {
  try {
    acao();
  } catch (erro) {
    return erro as ErroDominio;
  }
  throw new Error("esperava ErroDominio, mas nada foi lançado");
};

const consumidoKcal = (saldo: Saldo): number => {
  if (saldo.status !== "ok") {
    throw new Error(`esperava saldo ok, veio ${saldo.status}`);
  }
  return saldo.consumido.kcal;
};

const dataDe = (saldo: Saldo): string => {
  if (saldo.status !== "ok") {
    throw new Error(`esperava saldo ok, veio ${saldo.status}`);
  }
  return saldo.data;
};

describe("listarRegistros (REG-03, D-06)", () => {
  it("lista os registros do dia com id_curto, itens e kcal_total", () => {
    const r1 = registrarRefeicao(db, {
      data: DIA_LISTAR,
      itens: [{ alimento_id: idArroz, gramas: 150 }],
      tipoRefefeicao: "almoço",
    });
    const r2 = registrarRefeicao(db, {
      data: DIA_LISTAR,
      itens: [{ alimento_id: idBanana, gramas: 120 }],
      tipoRefefeicao: "lanche",
    });

    const listagem = listarRegistros(db, DIA_LISTAR);
    expect(listagem.data_local).toBe(DIA_LISTAR);
    expect(listagem.registros).toHaveLength(2);

    const ids = listagem.registros.map((r) => r.id_curto);
    expect(ids).toContain(r1.registro.id_curto);
    expect(ids).toContain(r2.registro.id_curto);
    for (const r of listagem.registros) {
      expect(r.id_curto).toMatch(/^[0-9a-f]{4}$/);
      expect(r.itens.length).toBeGreaterThan(0);
      expect(r.kcal_total).toBeGreaterThan(0);
      expect(r.tipo_refeicao).toBeDefined();
    }
  });
});

describe("editarRegistro (REG-03, T-01-12)", () => {
  it("substitui os itens por completo e o saldo reflete na MESMA resposta", () => {
    const antes = consumidoKcal(calcularSaldoDe(DIA_EDITAR));
    const { registro } = registrarRefeicao(db, {
      data: DIA_EDITAR,
      itens: [{ alimento_id: idArroz, gramas: 150 }],
    });
    const comArroz = consumidoKcal(calcularSaldoDe(DIA_EDITAR));
    expect(comArroz).toBeCloseTo(antes + (150 * 130.1196) / 100, 0);

    const resultado = editarRegistro(db, registro.id_curto, {
      itens: [{ alimento_id: idArroz, gramas: 300 }],
    });

    // eco novo: substituição completa — 300g, um item só
    expect(resultado.registro.id_curto).toBe(registro.id_curto);
    expect(resultado.registro.itens).toHaveLength(1);
    expect(resultado.registro.itens[0]?.gramas).toBe(300);

    // saldo recalculado na mesma resposta: o débito do arroz dobra
    const depois = consumidoKcal(resultado.saldo);
    expect(depois).toBeCloseTo(comArroz + (150 * 130.1196) / 100, 0);
    expect(depois).toBeCloseTo(antes + (300 * 130.1196) / 100, 0);
  });

  it("editar com alimento inexistente NÃO deixa o registro vazio (valida antes de apagar)", () => {
    const { registro } = registrarRefeicao(db, {
      data: DIA_INVALIDO,
      itens: [{ alimento_id: idBanana, gramas: 120 }],
    });
    const erro = capturarErro(() =>
      editarRegistro(db, registro.id_curto, {
        itens: [{ alimento_id: 999999, gramas: 100 }],
      }),
    );
    expect(erro.codigo).toBe("alimento_nao_encontrado");

    // registro intacto: item original continua lá e o débito permanece
    const listagem = listarRegistros(db, DIA_INVALIDO);
    const intacto = listagem.registros.find(
      (r) => r.id_curto === registro.id_curto,
    );
    expect(intacto?.itens).toHaveLength(1);
    expect(intacto?.itens[0]?.nome).toBe("Banana, maçã, crua");
  });
});

describe("removerRegistro (REG-03)", () => {
  it("remove e o saldo volta ao estado anterior NA HORA", () => {
    const antes = consumidoKcal(calcularSaldoDe(DIA_REMOVER));
    const { registro } = registrarRefeicao(db, {
      data: DIA_REMOVER,
      itens: [{ alimento_id: idBanana, gramas: 150 }],
    });
    const comBanana = consumidoKcal(calcularSaldoDe(DIA_REMOVER));
    expect(comBanana).toBeGreaterThan(antes);

    const resultado = removerRegistro(db, registro.id_curto);
    expect(resultado.removido).toBe(true);
    expect(resultado.id_curto).toBe(registro.id_curto);
    expect(resultado.data_local).toBe(DIA_REMOVER);
    expect(consumidoKcal(resultado.saldo)).toBeCloseTo(antes, 0);

    // itens caíram por cascade — nada órfão
    const orfaos = db
      .prepare(
        `SELECT COUNT(*) AS n FROM refeicao_item i
         LEFT JOIN refeicao r ON r.id = i.refeicao_id WHERE r.id IS NULL`,
      )
      .get() as { n: number };
    expect(orfaos.n).toBe(0);
  });
});

describe("id_curto inexistente (T-01-11)", () => {
  it("editar com id inexistente → registro_nao_encontrado com dica de listar", () => {
    const erro = capturarErro(() =>
      editarRegistro(db, "zzzz", {
        itens: [{ alimento_id: idArroz, gramas: 100 }],
      }),
    );
    expect(erro.codigo).toBe("registro_nao_encontrado");
    expect(erro.message).toContain("listar_registros");
  });

  it("remover com id inexistente → registro_nao_encontrado", () => {
    const erro = capturarErro(() => removerRegistro(db, "zzzz"));
    expect(erro.codigo).toBe("registro_nao_encontrado");
  });
});

describe("editar com data move o registro entre dias (REG-05 + REG-03)", () => {
  it("saldo dos DOIS dias sai consistente na mesma resposta", () => {
    const consumoDia2Antes = consumidoKcal(calcularSaldoDe(DIA_MOVER_PARA));
    const { registro } = registrarRefeicao(db, {
      data: DIA_MOVER_DE,
      itens: [{ alimento_id: idBanana, gramas: 120 }],
    });
    const consumoDia1ComBanana = consumidoKcal(calcularSaldoDe(DIA_MOVER_DE));

    const resultado = editarRegistro(db, registro.id_curto, {
      itens: [{ alimento_id: idBanana, gramas: 120 }],
      data: DIA_MOVER_PARA,
    });

    // o registro mudou de dia
    expect(resultado.registro.data_local).toBe(DIA_MOVER_PARA);
    expect(dataDe(resultado.saldo)).toBe(DIA_MOVER_PARA);
    expect(dataDe(resultado.saldo_anterior as Saldo)).toBe(DIA_MOVER_DE);

    // dia novo debita a banana; dia antigo volta ao estado anterior
    expect(consumidoKcal(resultado.saldo)).toBeCloseTo(
      consumoDia2Antes + (120 * 86.805) / 100,
      0,
    );
    expect(consumidoKcal(resultado.saldo_anterior as Saldo)).toBeCloseTo(
      consumoDia1ComBanana - (120 * 86.805) / 100,
      0,
    );

    // listagem reflete a mudança de dia
    expect(
      listarRegistros(db, DIA_MOVER_DE).registros.some(
        (r) => r.id_curto === registro.id_curto,
      ),
    ).toBe(false);
    expect(
      listarRegistros(db, DIA_MOVER_PARA).registros.some(
        (r) => r.id_curto === registro.id_curto,
      ),
    ).toBe(true);
  });
});

function calcularSaldoDe(dataLocal: string): Saldo {
  return calcularSaldo(db, dataLocal);
}

describe("repetirRefeicao (REG-04)", () => {
  it("repete a refeição de dia anterior p/ hoje: mesmos itens/gramas, id_curto NOVO e saldo do dia destino atualizado", () => {
    const ontem = "2026-10-01";
    const { registro: origem } = registrarRefeicao(db, {
      data: ontem,
      itens: [{ alimento_id: idArroz, gramas: 200 }],
      tipoRefefeicao: "almoço",
    });
    const consumoHojeAntes = consumidoKcal(calcularSaldoDe(hojeLocalSp()));

    const resultado = repetirRefeicao(db, {
      dataOrigem: ontem,
      tipoRefefeicao: "almoço",
    });

    // NOVO registro hoje, com os mesmos pares alimento+gramas
    expect(resultado.duplicado).toBe(false);
    expect(resultado.registro.id_curto).not.toBe(origem.id_curto);
    expect(resultado.registro.data_local).toBe(hojeLocalSp());
    expect(resultado.registro.itens).toHaveLength(1);
    expect(resultado.registro.itens[0]?.nome).toBe("Arroz, tipo 2, cozido");
    expect(resultado.registro.itens[0]?.gramas).toBe(200);
    expect(resultado.registro.tipo_refeicao).toBe("almoço");

    // saldo do dia destino vem na mesma resposta e debita a repetição
    expect(resultado.saldo.status).toBe("ok");
    expect(consumidoKcal(resultado.saldo)).toBeCloseTo(
      consumoHojeAntes + (200 * 130.1196) / 100,
      0,
    );

    // a origem permanece intacta no dia de origem
    expect(
      listarRegistros(db, ontem).registros.some(
        (r) => r.id_curto === origem.id_curto,
      ),
    ).toBe(true);
  });

  it("repetição RECOMPUTA macros do catálogo atual (não copia o snapshot antigo)", () => {
    const dia = "2026-10-02";
    const { registro: origem } = registrarRefeicao(db, {
      data: dia,
      itens: [{ alimento_id: idBanana, gramas: 100 }],
      tipoRefefeicao: "lanche",
    });
    const kcalOriginal = (
      db
        .prepare(`SELECT kcal_100g FROM alimento WHERE id = ?`)
        .get(idBanana) as { kcal_100g: number | null }
    ).kcal_100g;
    try {
      // "atualização" do catálogo: banana passa a 100 kcal/100g
      db.prepare(`UPDATE alimento SET kcal_100g = 100 WHERE id = ?`).run(
        idBanana,
      );

      const resultado = repetirRefeicao(db, { dataOrigem: dia });

      // novo registro usa o valor NOVO (100g × 100/100 = 100 kcal, não 86,8)
      expect(resultado.registro.itens[0]?.kcal).toBeCloseTo(100, 0);
      // snapshot da origem permanece o que foi gravado no dia
      expect(origem.itens[0]?.kcal).toBeCloseTo(86.805, 0);
    } finally {
      // restaura o catálogo para os demais testes
      db.prepare(`UPDATE alimento SET kcal_100g = ? WHERE id = ?`).run(
        kcalOriginal,
        idBanana,
      );
    }
  });

  it("origem inexistente → registro_nao_encontrado estruturado", () => {
    const erro = capturarErro(() =>
      repetirRefeicao(db, {
        dataOrigem: "2019-01-01",
        tipoRefefeicao: "jantar",
      }),
    );
    expect(erro.codigo).toBe("registro_nao_encontrado");
    expect(erro.message).toContain("2019-01-01");
  });

  it("dois registros do mesmo tipo na origem sem id_curto → refeicao_ambigua com candidatos", () => {
    const dia = "2026-10-03";
    registrarRefeicao(db, {
      data: dia,
      itens: [{ alimento_id: idArroz, gramas: 100 }],
      tipoRefefeicao: "almoço",
    });
    registrarRefeicao(db, {
      data: dia,
      itens: [{ alimento_id: idBanana, gramas: 100 }],
      tipoRefefeicao: "almoço",
    });

    const erro = capturarErro(() =>
      repetirRefeicao(db, { dataOrigem: dia, tipoRefefeicao: "almoço" }),
    );
    expect(erro.codigo).toBe("refeicao_ambigua");
    const candidatos = erro.extras.candidatos as { id_curto: string }[];
    expect(candidatos).toHaveLength(2);
    expect(erro.message).toContain("id_curto_origem");
  });

  it("repetir com data_destino retroativa cai no dia correto", () => {
    const dia = "2026-10-04";
    const destino = "2026-10-05";
    registrarRefeicao(db, {
      data: dia,
      itens: [{ alimento_id: idBanana, gramas: 130 }],
      tipoRefefeicao: "café",
    });

    const resultado = repetirRefeicao(db, {
      dataOrigem: dia,
      tipoRefefeicao: "café",
      dataDestino: destino,
    });

    expect(resultado.registro.data_local).toBe(destino);
    expect(dataDe(resultado.saldo)).toBe(destino);
  });

  it("id_curto_origem vence o filtro por tipo e resolve a ambiguidade", () => {
    const dia = "2026-10-06";
    const primeira = registrarRefeicao(db, {
      data: dia,
      itens: [{ alimento_id: idArroz, gramas: 100 }],
      tipoRefefeicao: "jantar",
    });
    registrarRefeicao(db, {
      data: dia,
      itens: [{ alimento_id: idBanana, gramas: 90 }],
      tipoRefefeicao: "jantar",
    });

    const resultado = repetirRefeicao(db, {
      dataOrigem: dia,
      idCurtoOrigem: primeira.registro.id_curto,
    });
    expect(resultado.registro.itens[0]?.nome).toBe("Arroz, tipo 2, cozido");
    expect(resultado.registro.itens[0]?.gramas).toBe(100);
  });
});
