import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { connectDb, type Db } from "../src/db/connect.js";
import { runMigrations } from "../src/db/migrate.js";
import { runSeed } from "../src/db/seed/seed.js";
import { definirMetas, obterMetasVigentes } from "../src/domain/metas.js";
import { registrarRefeicao } from "../src/domain/refeicoes.js";
import { calcularSaldo } from "../src/domain/saldo.js";
import { hojeLocalSp } from "../src/lib/datas.js";
import { definirMetasInputSchema } from "../src/mcp/tools/metas.js";

let db: Db;
let idArroz: number;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "flexdiet-metas-"));
  db = connectDb(join(dir, "test.db"));
  await runMigrations(db, join(dir, "backups"));
  runSeed(db);
  idArroz = (
    db
      .prepare(
        `SELECT id FROM alimento WHERE fonte = 'taco' AND numero_taco = '5'`,
      )
      .get() as { id: number }
  ).id;
});

describe("definir_metas (D-10, META-01)", () => {
  it("schema rejeita chamada com apenas 3 valores", () => {
    const incompleto = {
      kcal: 1800,
      proteina_g: 150,
      carbo_g: 180,
      // gordura_g ausente — D-10: sem atualização parcial
    };
    const resultado = definirMetasInputSchema.safeParse(incompleto);
    expect(resultado.success).toBe(false);
  });

  it("schema exige os 4 campos positivos", () => {
    const ok = definirMetasInputSchema.safeParse({
      kcal: 1800,
      proteina_g: 150,
      carbo_g: 180,
      gordura_g: 60,
    });
    expect(ok.success).toBe(true);

    const negativo = definirMetasInputSchema.safeParse({
      kcal: -1800,
      proteina_g: 150,
      carbo_g: 180,
      gordura_g: 60,
    });
    expect(negativo.success).toBe(false);
  });

  it("sem metas, calcularSaldo retorna meta_nao_definida com instrução (D-09)", () => {
    // data anterior a qualquer meta possível — independente de ordem dos testes
    const saldo = calcularSaldo(db, "2020-01-01");
    expect(saldo.status).toBe("meta_nao_definida");
    if (saldo.status === "meta_nao_definida") {
      expect(saldo.instrucao).toContain("definir_metas");
      expect(saldo.instrucao).toContain("gordura_g");
    }
  });

  it("domínio também recusa metas incompletas", () => {
    expect(() =>
      definirMetas(db, {
        kcal: 1800,
        proteina_g: 150,
        carbo_g: 180,
        gordura_g: Number.NaN,
      }),
    ).toThrow(/4 valores/);
  });

  it("definir 1800/150/180/60 grava vigência por data_inicio e obterMetasVigentes retorna os 4 valores", () => {
    definirMetas(db, {
      kcal: 1800,
      proteina_g: 150,
      carbo_g: 180,
      gordura_g: 60,
    });
    const metas = obterMetasVigentes(db, hojeLocalSp());
    expect(metas).toEqual({
      kcal: 1800,
      proteina_g: 150,
      carbo_g: 180,
      gordura_g: 60,
    });
  });

  it("registrar refeição APÓS definir metas → saldo ok e restante = meta − consumido", () => {
    const { saldo } = registrarRefeicao(db, {
      itens: [{ alimento_id: idArroz, gramas: 150 }],
    });
    expect(saldo.status).toBe("ok");
    if (saldo.status === "ok") {
      // 150g de arroz ≈ 195,18 kcal → restante 1800 − 195,18 ≈ 1604,82
      expect(saldo.metas.kcal).toBe(1800);
      expect(saldo.consumido.kcal).toBeGreaterThan(195.18 - 0.5);
      expect(saldo.consumido.kcal).toBeLessThan(195.18 + 0.5);
      expect(saldo.restante.kcal).toBeGreaterThan(1604.3);
      expect(saldo.restante.kcal).toBeLessThan(1605.3);
    }
  });

  it("nova definir_metas substitui a vigente (última data_inicio vence) e o próximo saldo usa os valores novos", () => {
    definirMetas(db, {
      kcal: 2200,
      proteina_g: 180,
      carbo_g: 240,
      gordura_g: 70,
    });
    const saldo = calcularSaldo(db, hojeLocalSp());
    expect(saldo.status).toBe("ok");
    if (saldo.status === "ok") {
      expect(saldo.metas).toEqual({
        kcal: 2200,
        proteina_g: 180,
        carbo_g: 240,
        gordura_g: 70,
      });
      // restante contra a meta nova: 2200 − 195,18 ≈ 2004,82
      expect(saldo.restante.kcal).toBeGreaterThan(2004.3);
      expect(saldo.restante.kcal).toBeLessThan(2005.3);
    }
  });
});
