import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { dobrarTexto, normalizarParaBusca } from "../../lib/texto.js";
import type { Db } from "../connect.js";

const DIR_SEED = dirname(fileURLToPath(import.meta.url));
const CSV_TACO = join(DIR_SEED, "taco_composicao.csv");
const CSV_POF = join(DIR_SEED, "pof_medidas_caseiras.csv");

/** Colunas usadas do CSV do brolesi/taco (header verbatim no RESEARCH). */
interface TacoRow {
  numero_alimento: string;
  descricao: string;
  energia_kcal: string;
  proteina_g: string;
  carboidrato_g: string;
  lipideos_g: string;
}

/** Colunas usadas do CSV de medidas caseiras POF/IBGE (mesmo dataset). */
interface PofRow {
  codigo_alimento: string;
  descricao_alimento: string;
  descricao_medida: string;
  quantidade_g: string;
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
 * Nome-base de um alimento (qualquer dos dois datasets): remove qualificadores
 * entre parênteses (POF: "ARROZ (POLIDO, PARBOILIZADO)"), pega a parte antes
 * da primeira vírgula (TACO: "Banana, maçã, crua"), dobra e trima.
 * Ex.: "Óleo, de soja" → "oleo" · "OLEO DE SOJA" → "oleo de soja" (base = próprio).
 */
export function nomeBaseDe(nome: string): string {
  const semParenteses = nome.replace(/\s*\([^)]*\)/g, "");
  return dobrarTexto(semParenteses.split(",")[0]).trim();
}

/** Nome completo SEM parênteses, dobrado — chave da passada 2 do join POF→TACO. */
function nomeCompletoDe(nome: string): string {
  return dobrarTexto(
    nome
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/,/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** Adiciona um valor ao Set indexado por chave, criando o Set se preciso. */
function adicionarEm<K, V>(mapa: Map<K, Set<V>>, chave: K, valor: V): void {
  const conjunto = mapa.get(chave) ?? new Set<V>();
  conjunto.add(valor);
  mapa.set(chave, conjunto);
}

/** Resultado do seed — coberturas logadas no boot (medir, não prometer). */
export interface ResultadoSeed {
  alimentos: number;
  alimentosComMedidas: number;
  medidas: number;
}

/**
 * Junta medidas caseiras POF → TACO por correspondência EXATA com guarda de
 * unicidade nos DOIS lados (RESEARCH Pitfall 3: nunca fuzzy, nunca múltiplos
 * candidatos — casamento ambíguo vira erro silencioso de nutriente):
 *
 * Passada 1 — nome-base idêntico: só vale quando EXATAMENTE 1 alimento TACO e
 * EXATAMENTE 1 alimento POF compartilham o nome-base ("arroz" casa com 6 TACOs
 * → fica de fora de propósito).
 *
 * Passada 2 — nome completo normalizado idêntico: desempata bases ambíguas
 * ("OLEO DE SOJA" == "Óleo, de soja") com a MESMA guarda de unicidade.
 *
 * O resto fica SEM medidas — medidas_caseiras: [] é contrato de primeira
 * classe (D-04: o Hermes estima e declara a premissa). Cobertura parcial é
 * resultado VÁLIDO e esperado (~82–92 alimentos).
 */
function juntarMedidasPof(
  db: Db,
  linhasPof: PofRow[],
  inserirMedida: (
    alimentoId: number,
    descricao: string,
    gramas: number,
  ) => void,
): void {
  const tacoRows = db
    .prepare(`SELECT id, nome FROM alimento WHERE fonte = 'taco'`)
    .all() as { id: number; nome: string }[];

  // mapa nome-base/nome-completo → conjunto de alimentos TACO (para detectar ambiguidade)
  const tacoPorBase = new Map<string, Set<number>>();
  const tacoPorNome = new Map<string, Set<number>>();
  for (const t of tacoRows) {
    const base = nomeBaseDe(t.nome);
    if (base) adicionarEm(tacoPorBase, base, t.id);
    const completo = nomeCompletoDe(t.nome);
    if (completo) adicionarEm(tacoPorNome, completo, t.id);
  }

  // POF: mapa chave → conjunto de codigo_alimento (ambiguidade do lado POF também desqualifica)
  const pofPorBase = new Map<string, Set<string>>();
  const pofPorNome = new Map<string, Set<string>>();
  for (const r of linhasPof) {
    const base = nomeBaseDe(r.descricao_alimento);
    const completo = nomeCompletoDe(r.descricao_alimento);
    if (!base || !completo) continue;
    adicionarEm(pofPorBase, base, r.codigo_alimento);
    adicionarEm(pofPorNome, completo, r.codigo_alimento);
  }

  const linhasPorCodigo = new Map<string, PofRow[]>();
  for (const r of linhasPof) {
    const linhas = linhasPorCodigo.get(r.codigo_alimento) ?? [];
    linhas.push(r);
    linhasPorCodigo.set(r.codigo_alimento, linhas);
  }

  const inserirSeUnico = (codigoPof: string, alimentoId: number): void => {
    for (const linha of linhasPorCodigo.get(codigoPof) ?? []) {
      const gramas = Number(linha.quantidade_g);
      if (!Number.isFinite(gramas) || gramas <= 0) continue; // valor vazio/inválido é pulado
      const descricao = linha.descricao_medida?.trim();
      if (!descricao) continue;
      inserirMedida(alimentoId, descricao, gramas);
    }
  };

  // Passada 1: nome-base idêntico e inequívoco dos dois lados
  for (const [base, codigosPof] of pofPorBase) {
    const tacos = tacoPorBase.get(base);
    if (tacos?.size !== 1 || codigosPof.size !== 1) continue;
    inserirSeUnico([...codigosPof][0], [...tacos][0]);
  }

  // Passada 2: nome completo normalizado idêntico (ambos os lados únicos)
  for (const [completo, codigosPof] of pofPorNome) {
    const tacos = tacoPorNome.get(completo);
    if (tacos?.size !== 1 || codigosPof.size !== 1) continue;
    const alimentoId = [...tacos][0];
    // já coberto pela passada 1 → não reinserir
    const jaTem = db
      .prepare(`SELECT 1 FROM medida_caseira WHERE alimento_id = ? LIMIT 1`)
      .get(alimentoId);
    if (jaTem) continue;
    inserirSeUnico([...codigosPof][0], alimentoId);
  }
}

/**
 * Seed TACO + medidas caseiras POF, idempotente:
 * - alimento: upsert por (fonte='taco', numero_taco)
 * - medida_caseira: upsert por UNIQUE (alimento_id, descricao)
 * Lê EXCLUSIVAMENTE `energia_kcal` — nunca `energia_kj` (catálogo inflado 4,18x).
 * Transação ÚNICA síncrona — zero await no closure (better-sqlite3).
 * Sanity in-code: banana maçã (178) precisa ficar entre 85 e 89 kcal/100g (ALIM-01).
 */
export function runSeed(db: Db): ResultadoSeed {
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

  const csvPof = readFileSync(CSV_POF, "utf8");
  const linhasPof = parse(csvPof, {
    columns: true,
    skip_empty_lines: true,
  }) as PofRow[];
  const primeiraPof = linhasPof[0];
  if (
    !primeiraPof ||
    primeiraPof.codigo_alimento === undefined ||
    primeiraPof.descricao_alimento === undefined ||
    primeiraPof.descricao_medida === undefined ||
    primeiraPof.quantidade_g === undefined
  ) {
    throw new Error(
      "seed: pof_medidas_caseiras.csv sem as colunas esperadas (codigo_alimento, descricao_alimento, descricao_medida, quantidade_g)",
    );
  }

  const upsert = db.prepare(`
    INSERT INTO alimento (
      fonte, numero_taco, nome, nome_busca,
      kcal_100g, proteina_g_100g, carbo_g_100g, gordura_g_100g, criado_em
    ) VALUES (
      'taco', @numero_taco, @nome, @nome_busca,
      @kcal, @proteina, @carbo, @gordura, @criado_em
    )
    ON CONFLICT (fonte, numero_taco) DO UPDATE SET
      nome = excluded.nome,
      nome_busca = excluded.nome_busca,
      kcal_100g = excluded.kcal_100g,
      proteina_g_100g = excluded.proteina_g_100g,
      carbo_g_100g = excluded.carbo_g_100g,
      gordura_g_100g = excluded.gordura_g_100g
  `);

  const upsertMedida = db.prepare(`
    INSERT INTO medida_caseira (alimento_id, descricao, gramas)
    VALUES (@alimento_id, @descricao, @gramas)
    ON CONFLICT (alimento_id, descricao) DO UPDATE SET
      gramas = excluded.gramas
  `);

  const contar = db.prepare(
    `SELECT COUNT(*) AS total FROM alimento WHERE fonte = 'taco'`,
  );
  const contarComMedidas = db.prepare(
    `SELECT COUNT(DISTINCT alimento_id) AS total FROM medida_caseira`,
  );
  const contarMedidas = db.prepare(
    `SELECT COUNT(*) AS total FROM medida_caseira`,
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
        nome_busca: normalizarParaBusca(nome),
        kcal: numeroTaco(linha.energia_kcal),
        proteina: numeroTaco(linha.proteina_g),
        carbo: numeroTaco(linha.carboidrato_g),
        gordura: numeroTaco(linha.lipideos_g),
        criado_em: criadoEm,
      });
    }

    juntarMedidasPof(db, linhasPof, (alimentoId, descricao, gramas) => {
      upsertMedida.run({ alimento_id: alimentoId, descricao, gramas });
    });
  });
  semear();

  const { total } = contar.get() as { total: number };
  const { total: comMedidas } = contarComMedidas.get() as { total: number };
  const { total: medidas } = contarMedidas.get() as { total: number };
  console.error(`[seed] taco: ${total} alimentos no catálogo`);
  console.error(
    `[seed] pof: ${comMedidas} alimentos com >= 1 medida caseira (${medidas} linhas de medida) — cobertura parcial é esperada (join só por correspondência inequívoca)`,
  );
  return {
    alimentos: total,
    alimentosComMedidas: comMedidas,
    medidas,
  };
}
