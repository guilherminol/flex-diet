import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { connectDb, type Db } from "../src/db/connect.js";
import { runMigrations } from "../src/db/migrate.js";
import { runSeed } from "../src/db/seed/seed.js";
import { registrarRefeicao } from "../src/domain/refeicoes.js";
import { dedupeHash } from "../src/lib/dedupe.js";

let db: Db;
let idArroz: number;
let idBanana: number;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "flexdiet-dedupe-"));
  db = connectDb(join(dir, "test.db"));
  await runMigrations(db, join(dir, "backups"));
  runSeed(db);
  const buscarId = db.prepare(
    `SELECT id FROM alimento WHERE fonte = 'taco' AND numero_taco = ?`,
  );
  idArroz = (buscarId.get("5") as { id: number }).id;
  idBanana = (buscarId.get("178") as { id: number }).id;
});

const contarRefeicoes = (): number =>
  (db.prepare(`SELECT COUNT(*) AS n FROM refeicao`).get() as { n: number }).n;

describe("dedupeHash — payload canônico (D-07, RESEARCH Pitfall 10)", () => {
  it("ordem dos itens não muda o hash", () => {
    const a = dedupeHash("2026-09-23", [
      { alimento_id: 5, gramas: 150 },
      { alimento_id: 178, gramas: 120 },
    ]);
    const b = dedupeHash("2026-09-23", [
      { alimento_id: 178, gramas: 120 },
      { alimento_id: 5, gramas: 150 },
    ]);
    expect(a).toBe(b);
  });

  it("gramas 150 e 150.04 produzem o mesmo hash (arredondamento a 1 casa)", () => {
    const a = dedupeHash("2026-09-23", [{ alimento_id: 5, gramas: 150 }]);
    const b = dedupeHash("2026-09-23", [{ alimento_id: 5, gramas: 150.04 }]);
    expect(a).toBe(b);
  });

  it("hash muda quando data_local muda", () => {
    const a = dedupeHash("2026-09-23", [{ alimento_id: 5, gramas: 150 }]);
    const b = dedupeHash("2026-09-22", [{ alimento_id: 5, gramas: 150 }]);
    expect(a).not.toBe(b);
  });

  it("hash muda quando gramas ou alimento_id mudam", () => {
    const base = dedupeHash("2026-09-23", [{ alimento_id: 5, gramas: 150 }]);
    expect(base).not.toBe(
      dedupeHash("2026-09-23", [{ alimento_id: 5, gramas: 200 }]),
    );
    expect(base).not.toBe(
      dedupeHash("2026-09-23", [{ alimento_id: 178, gramas: 150 }]),
    );
  });
});

describe("registrarRefeicao — dedupe com janela de 10 min (REG-06, D-07/D-08)", () => {
  it("reenvio idêntico dentro de 10 min NÃO insere: devolve o registro original + saldo + duplicado true", () => {
    const antes = contarRefeicoes();
    const itens = [{ alimento_id: idArroz, gramas: 150 }];

    const primeira = registrarRefeicao(db, { itens });
    expect(primeira.duplicado).toBe(false);
    expect(contarRefeicoes()).toBe(antes + 1);

    const segunda = registrarRefeicao(db, { itens });
    expect(segunda.duplicado).toBe(true);
    expect(segunda.registro.id_curto).toBe(primeira.registro.id_curto);
    expect(segunda.registro.itens).toHaveLength(1);
    expect(segunda.registro.itens[0]?.nome).toBe("Arroz, tipo 2, cozido");
    expect(segunda.saldo).toBeDefined();
    expect(contarRefeicoes()).toBe(antes + 1);
  });

  it("reenvio com itens em ordem trocada também deduplica", () => {
    const antes = contarRefeicoes();
    const primeira = registrarRefeicao(db, {
      itens: [
        { alimento_id: idArroz, gramas: 100 },
        { alimento_id: idBanana, gramas: 120 },
      ],
    });
    const segunda = registrarRefeicao(db, {
      itens: [
        { alimento_id: idBanana, gramas: 120 },
        { alimento_id: idArroz, gramas: 100 },
      ],
    });
    expect(segunda.duplicado).toBe(true);
    expect(segunda.registro.id_curto).toBe(primeira.registro.id_curto);
    expect(contarRefeicoes()).toBe(antes + 1);
  });

  it("fora da janela (original retroagido 11 min) insere registro NOVO", () => {
    const antes = contarRefeicoes();
    const itens = [{ alimento_id: idArroz, gramas: 180 }];

    const primeira = registrarRefeicao(db, { itens });
    // simula a passagem do tempo: original vai 11 minutos pra trás
    const onzeMinAtras = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    db.prepare(`UPDATE refeicao SET timestamp_utc = ? WHERE id_curto = ?`).run(
      onzeMinAtras,
      primeira.registro.id_curto,
    );

    const segunda = registrarRefeicao(db, { itens });
    expect(segunda.duplicado).toBe(false);
    expect(segunda.registro.id_curto).not.toBe(primeira.registro.id_curto);
    expect(contarRefeicoes()).toBe(antes + 2);
  });

  it("payload com gramas diferentes não é retry — insere registro novo", () => {
    const antes = contarRefeicoes();
    registrarRefeicao(db, { itens: [{ alimento_id: idBanana, gramas: 120 }] });
    const outra = registrarRefeicao(db, {
      itens: [{ alimento_id: idBanana, gramas: 200 }],
    });
    expect(outra.duplicado).toBe(false);
    expect(contarRefeicoes()).toBe(antes + 2);
  });

  it("registro novo grava o dedupe_hash na linha (consulta temporal, não unique)", () => {
    const itens = [{ alimento_id: idArroz, gramas: 250 }];
    const { registro } = registrarRefeicao(db, { itens, data: "2026-09-21" });
    const linha = db
      .prepare(`SELECT dedupe_hash, data_local FROM refeicao WHERE id_curto = ?`)
      .get(registro.id_curto) as { dedupe_hash: string | null; data_local: string };
    expect(linha.data_local).toBe("2026-09-21");
    expect(linha.dedupe_hash).toBe(dedupeHash("2026-09-21", itens));
  });
});
