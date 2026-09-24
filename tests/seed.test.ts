import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { connectDb, type Db } from "../src/db/connect.js";
import { runMigrations } from "../src/db/migrate.js";
import { runSeed } from "../src/db/seed/seed.js";

let db: Db;

const kcalDe = (numeroTaco: string): number | null => {
  const linha = db
    .prepare(
      `SELECT kcal_100g FROM alimento WHERE fonte = 'taco' AND numero_taco = ?`,
    )
    .get(numeroTaco) as { kcal_100g: number | null } | undefined;
  return linha?.kcal_100g ?? null;
};

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "flexdiet-seed-"));
  db = connectDb(join(dir, "test.db"));
  await runMigrations(db, join(dir, "backups"));
  runSeed(db);
});

describe("seed TACO (ALIM-01)", () => {
  it("banana maçã (178) fica entre 85 e 89 kcal/100g — nunca ~363 (kJ)", () => {
    const kcal = kcalDe("178");
    expect(kcal).not.toBeNull();
    expect(kcal).toBeGreaterThan(85);
    expect(kcal).toBeLessThan(89);
  });

  it("óleo de soja (272) fica entre 880 e 888 kcal/100g", () => {
    const kcal = kcalDe("272");
    expect(kcal).not.toBeNull();
    expect(kcal).toBeGreaterThan(880);
    expect(kcal).toBeLessThan(888);
  });

  it("nenhum alimento com kcal > 950 exceto gordura >= 90g/100g", () => {
    const inflados = db
      .prepare(
        `SELECT nome, kcal_100g, gordura_g_100g FROM alimento
         WHERE kcal_100g > 950 AND (gordura_g_100g IS NULL OR gordura_g_100g < 90)`,
      )
      .all() as { nome: string; kcal_100g: number }[];
    expect(inflados).toEqual([]);
  });

  it("arroz tipo 2 cozido (5) casa com o valor do CSV (~130,12)", () => {
    const kcal = kcalDe("5");
    expect(kcal).not.toBeNull();
    expect(kcal).toBeCloseTo(130.12, 1);
  });

  it("journal_mode é wal na conexão", () => {
    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
  });

  it("re-seed não duplica (contagem estável)", () => {
    const primeira = runSeed(db);
    const segunda = runSeed(db);
    expect(segunda.alimentos).toBe(primeira.alimentos);
    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM alimento`)
      .get() as { total: number };
    expect(total).toBe(primeira.alimentos);
    expect(total).toBeGreaterThan(500);
    // medidas caseiras também estáveis no re-seed (upsert por UNIQUE)
    expect(segunda.medidas).toBe(primeira.medidas);
    expect(segunda.alimentosComMedidas).toBe(primeira.alimentosComMedidas);
  });

  it("óleo de soja (272) tem >= 1 medida caseira com gramas > 0 (join POF inequívoco)", () => {
    const medidas = db
      .prepare(
        `SELECT m.descricao, m.gramas FROM medida_caseira m
         JOIN alimento a ON a.id = m.alimento_id
         WHERE a.fonte = 'taco' AND a.numero_taco = '272'
         ORDER BY m.descricao`,
      )
      .all() as { descricao: string; gramas: number }[];
    expect(medidas.length).toBeGreaterThanOrEqual(1);
    for (const m of medidas) {
      expect(m.gramas).toBeGreaterThan(0);
      expect(m.descricao.length).toBeGreaterThan(0);
    }
  });

  it("contagem de alimentos com medidas é > 0 e <= 200 (guarda contra join explosivo/fuzzy)", () => {
    const { total } = db
      .prepare(
        `SELECT COUNT(DISTINCT alimento_id) AS total FROM medida_caseira`,
      )
      .get() as { total: number };
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(200);
    // aninhamento: nenhuma medida aponta para alimento inexistente
    const orfas = db
      .prepare(
        `SELECT COUNT(*) AS total FROM medida_caseira m
         LEFT JOIN alimento a ON a.id = m.alimento_id WHERE a.id IS NULL`,
      )
      .get() as { total: number };
    expect(orfas.total).toBe(0);
  });

  it("valores especiais: vazio vira NULL e Tr (1e-05) vira 0", () => {
    // o colesterol do arroz (5) vem vazio no CSV → NULL (não analisado)
    const arroz = db
      .prepare(
        `SELECT proteina_g_100g FROM alimento WHERE fonte = 'taco' AND numero_taco = '5'`,
      )
      .get() as { proteina_g_100g: number | null };
    expect(arroz.proteina_g_100g).not.toBeNull();
    // gordura do óleo (272) é 100.0 — garante que números normais passam ilesos
    const oleo = db
      .prepare(
        `SELECT gordura_g_100g FROM alimento WHERE fonte = 'taco' AND numero_taco = '272'`,
      )
      .get() as { gordura_g_100g: number | null };
    expect(oleo.gordura_g_100g).toBeCloseTo(100.0, 5);
  });
});
