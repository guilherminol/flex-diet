import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import type { Db } from "../connect.js";

const DIR_SEED = dirname(fileURLToPath(import.meta.url));
const CSV_TACO = join(DIR_SEED, "taco_composicao.csv");

/** Colunas usadas do CSV do brolesi/taco (header verbatim no RESEARCH). */
interface TacoRow {
  numero_alimento: string;
  descricao: string;
  energia_kcal: string;
  proteina_g: string;
  carboidrato_g: string;
  lipideos_g: string;
}

/**
 * Sanitiza um valor do CSV:
 * - vazio ("") → NULL (não analisado — DIFERENTE de zero, dicionário do dataset)
 * - `1e-05` → 0 (Tr — traço, quantidade abaixo do limite de quantificação)
 * - número → number
 */
export function numeroTaco(valor: string | undefined): number | null {
  if (valor === undefined) return null;
  const v = valor.trim();
  if (v === "") return null;
  if (v === "1e-05" || v === "1e-5" || v === "Tr") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Seed TACO idempotente (upsert por (fonte='taco', numero_taco)).
 * Lê EXCLUSIVAMENTE `energia_kcal` — nunca `energia_kj` (catálogo inflado 4,18x).
 * Transação ÚNICA síncrona — zero await no closure (better-sqlite3).
 * Sanity in-code: banana maçã (178) precisa ficar entre 85 e 89 kcal/100g (ALIM-01).
 */
export function runSeed(db: Db): { alimentos: number } {
  const csv = readFileSync(CSV_TACO, "utf8");
  const linhas = parse(csv, {
    columns: true,
    skip_empty_lines: true,
  }) as TacoRow[];

  // Sanity in-code: se este valor vier ~363, alguém leu energia_kj por engano.
  const banana = linhas.find((l) => l.numero_alimento === "178");
  if (!banana)
    throw new Error(
      "seed sanity: banana maçã (numero_alimento 178) ausente no CSV",
    );
  const kcalBanana = numeroTaco(banana.energia_kcal);
  if (kcalBanana === null || !(kcalBanana > 85 && kcalBanana < 89)) {
    throw new Error(
      `seed sanity: banana maçã fora de 85–89 kcal/100g (veio ${kcalBanana}) — energia_kj lida por engano?`,
    );
  }

  const upsert = db.prepare(`
    INSERT INTO alimento (
      fonte, numero_taco, nome,
      kcal_100g, proteina_g_100g, carbo_g_100g, gordura_g_100g, criado_em
    ) VALUES (
      'taco', @numero_taco, @nome,
      @kcal, @proteina, @carbo, @gordura, @criado_em
    )
    ON CONFLICT (fonte, numero_taco) DO UPDATE SET
      nome = excluded.nome,
      kcal_100g = excluded.kcal_100g,
      proteina_g_100g = excluded.proteina_g_100g,
      carbo_g_100g = excluded.carbo_g_100g,
      gordura_g_100g = excluded.gordura_g_100g
  `);

  const contar = db.prepare(
    `SELECT COUNT(*) AS total FROM alimento WHERE fonte = 'taco'`,
  );

  const criadoEm = new Date().toISOString();
  const semear = db.transaction(() => {
    for (const linha of linhas) {
      const numero = linha.numero_alimento?.trim();
      const nome = linha.descricao?.trim();
      if (!numero || !nome) continue;
      upsert.run({
        numero_taco: numero,
        nome,
        kcal: numeroTaco(linha.energia_kcal),
        proteina: numeroTaco(linha.proteina_g),
        carbo: numeroTaco(linha.carboidrato_g),
        gordura: numeroTaco(linha.lipideos_g),
        criado_em: criadoEm,
      });
    }
  });
  semear();

  const { total } = contar.get() as { total: number };
  console.error(`[seed] taco: ${total} alimentos no catálogo`);
  return { alimentos: total };
}
