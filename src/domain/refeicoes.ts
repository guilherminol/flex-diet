import { randomBytes } from "node:crypto";
import type { Db } from "../db/connect.js";
import { getDb } from "../db/connect.js";
import { agoraIsoUtc, dataLocalSp, resolverDataLocal } from "../lib/datas.js";
import { dedupeHash, inicioDaJanela } from "../lib/dedupe.js";
import { calcularSaldo, type Saldo } from "./saldo.js";

export interface ItemEntrada {
  alimento_id: number;
  gramas: number;
}

export interface ItemEco {
  nome: string;
  gramas: number;
  fonte: string;
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
}

export interface RegistroEco {
  id_curto: string;
  data_local: string;
  timestamp_utc: string;
  tipo_refeicao?: string;
  itens: ItemEco[];
}

/** Erro de negócio com código estruturado — vira isError:true na tool, nunca exceção crua. */
export class ErroDominio extends Error {
  readonly codigo: string;
  readonly extras: Record<string, unknown>;
  constructor(
    codigo: string,
    mensagem: string,
    extras: Record<string, unknown> = {},
  ) {
    super(mensagem);
    this.name = "ErroDominio";
    this.codigo = codigo;
    this.extras = extras;
  }
}

/** alimento_id inexistente — carrega sugestões do catálogo pra resposta acionável. */
export class AlimentoNaoEncontradoError extends ErroDominio {
  constructor(
    idsInvalidos: number[],
    sugestoes: { id: number; nome: string }[],
  ) {
    super(
      "alimento_nao_encontrado",
      `alimento(s) não encontrado(s) no catálogo: ${idsInvalidos.join(", ")} — use buscar_alimento para resolver nomes em ids`,
      { ids_invalidos: idsInvalidos, sugestoes },
    );
  }
}

interface AlimentoLinha {
  id: number;
  nome: string;
  fonte: string;
  kcal_100g: number | null;
  proteina_g_100g: number | null;
  carbo_g_100g: number | null;
  gordura_g_100g: number | null;
}

/** 4 hex chars (#a3f2) — 65k combinações; colisão é rara e o chamador faz retry. */
export function gerarIdCurto(): string {
  return randomBytes(2).toString("hex");
}

const sugestoesDoCatalogo = (db: Db): { id: number; nome: string }[] =>
  db.prepare(`SELECT id, nome FROM alimento ORDER BY id LIMIT 5`).all() as {
    id: number;
    nome: string;
  }[];

const CARREGAR_REFEICAO = `
  SELECT id, id_curto, data_local, timestamp_utc, tipo_refeicao
  FROM refeicao WHERE id = ?`;
const CARREGAR_ITENS = `
  SELECT a.nome, i.gramas, a.fonte, i.kcal, i.proteina_g, i.carbo_g, i.gordura_g
  FROM refeicao_item i
  JOIN alimento a ON a.id = i.alimento_id
  WHERE i.refeicao_id = ?
  ORDER BY i.id`;

/** Reconstrói o eco de uma refeição gravada (itens vindos do snapshot). */
function carregarRegistroEco(db: Db, refeicaoId: number): RegistroEco {
  const r = db.prepare(CARREGAR_REFEICAO).get(refeicaoId) as {
    id_curto: string;
    data_local: string;
    timestamp_utc: string;
    tipo_refeicao: string | null;
  };
  const itens = db.prepare(CARREGAR_ITENS).all(refeicaoId) as ItemEco[];
  return {
    id_curto: r.id_curto,
    data_local: r.data_local,
    timestamp_utc: r.timestamp_utc,
    ...(r.tipo_refeicao !== null ? { tipo_refeicao: r.tipo_refeicao } : {}),
    itens,
  };
}

/**
 * registrarRefeicao — atômica (D-03): UMA transação síncrona grava a refeição
 * e todos os itens com snapshot de macros calculado do catálogo TACO
 * (macro_100g × gramas/100; NULL → 0 via COALESCE). Cada débito aplica por
 * completo ou não aplica nada — o saldo nunca reflete débito parcial.
 * Retroativo (REG-05): `data` informada grava na data_local informada.
 * Idempotência (REG-06, D-07/D-08): o checar-e-inserir do dedupe acontece na
 * MESMA transação do INSERT (a closure síncrona do better-sqlite3 serializa) —
 * reenvio idêntico dentro da janela de 10 min NÃO insere e responde o registro
 * ORIGINAL + saldo + duplicado: true.
 * Retorna o eco (nome + gramas + fonte + macros, id_curto) e o saldo do dia
 * NA MESMA resposta (D-05, REG-01/REG-02).
 */
export function registrarRefeicao(
  db: Db,
  entrada: { data?: string; itens: ItemEntrada[]; tipoRefefeicao?: string },
): { registro: RegistroEco; saldo: Saldo; duplicado: boolean } {
  const { data, tipoRefefeicao } = entrada;
  const itens = entrada.itens;

  if (!Array.isArray(itens) || itens.length === 0) {
    throw new ErroDominio(
      "itens_obrigatorio",
      "informe ao menos um item com alimento_id e gramas",
    );
  }
  for (const item of itens) {
    if (!Number.isInteger(item.alimento_id) || item.alimento_id <= 0) {
      throw new ErroDominio(
        "alimento_id_invalido",
        `alimento_id deve ser inteiro positivo (recebido ${item.alimento_id})`,
      );
    }
    if (!Number.isFinite(item.gramas) || item.gramas <= 0) {
      throw new ErroDominio(
        "gramas_invalidas",
        `gramas deve ser um número positivo (recebido ${item.gramas} para alimento ${item.alimento_id})`,
      );
    }
  }
  // data inválida falha ANTES de abrir a transação
  if (data !== undefined) resolverDataLocal(data);

  const buscarAlimento = db.prepare(
    `SELECT id, nome, fonte, kcal_100g, proteina_g_100g, carbo_g_100g, gordura_g_100g
     FROM alimento WHERE id = ?`,
  );
  const existeIdCurto = db.prepare(
    `SELECT id FROM refeicao WHERE id_curto = ?`,
  );
  const inserirRefeicao = db.prepare(
    `INSERT INTO refeicao (id_curto, data_local, timestamp_utc, tipo_refeicao, dedupe_hash)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const buscarDedupe = db.prepare(
    `SELECT id FROM refeicao
     WHERE dedupe_hash = ? AND timestamp_utc >= ?
     ORDER BY timestamp_utc DESC
     LIMIT 1`,
  );
  const inserirItem = db.prepare(
    `INSERT INTO refeicao_item (refeicao_id, alimento_id, gramas, kcal, proteina_g, carbo_g, gordura_g)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  // Transação SÍNCRONA — zero await no closure (better-sqlite3 rejeita async)
  const gravar = db.transaction(
    (): {
      duplicado: boolean;
      registro: RegistroEco;
    } => {
      const alimentos: AlimentoLinha[] = itens.map((item) => {
        const alimento = buscarAlimento.get(item.alimento_id) as
          | AlimentoLinha
          | undefined;
        if (!alimento) {
          throw new AlimentoNaoEncontradoError(
            itens.map((i) => i.alimento_id),
            sugestoesDoCatalogo(db),
          );
        }
        return alimento;
      });

      const timestampUtc = agoraIsoUtc();
      const dataLocal =
        data === undefined
          ? dataLocalSp(timestampUtc)
          : resolverDataLocal(data);

      // Dedupe (REG-06, D-07): hash do payload canônico + janela de 10 min.
      // Checar-e-inserir NA MESMA transação — nenhuma escrita entre a consulta
      // e o INSERT (a closure síncrona serializa as chamadas).
      const hash = dedupeHash(dataLocal, itens);
      const existente = buscarDedupe.get(hash, inicioDaJanela()) as
        | { id: number }
        | undefined;
      if (existente) {
        // D-08: retry detectado responde o registro ORIGINAL, sem inserir.
        return {
          duplicado: true,
          registro: carregarRegistroEco(db, existente.id),
        };
      }

      let idCurto = gerarIdCurto();
      let tentativas = 0;
      while (existeIdCurto.get(idCurto) !== undefined) {
        if (++tentativas > 10) {
          throw new ErroDominio(
            "id_curto_esgotado",
            "não foi possível gerar um id_curto único após 10 tentativas",
          );
        }
        idCurto = gerarIdCurto();
      }

      const info = inserirRefeicao.run(
        idCurto,
        dataLocal,
        timestampUtc,
        tipoRefefeicao ?? null,
        hash,
      );
      const refeicaoId = Number(info.lastInsertRowid);

      const ecoItens: ItemEco[] = itens.map((item, i) => {
        const alimento = alimentos[i] as AlimentoLinha;
        const fator = item.gramas / 100;
        const itemEco: ItemEco = {
          nome: alimento.nome,
          gramas: item.gramas,
          fonte: alimento.fonte,
          kcal: (alimento.kcal_100g ?? 0) * fator,
          proteina_g: (alimento.proteina_g_100g ?? 0) * fator,
          carbo_g: (alimento.carbo_g_100g ?? 0) * fator,
          gordura_g: (alimento.gordura_g_100g ?? 0) * fator,
        };
        inserirItem.run(
          refeicaoId,
          alimento.id,
          item.gramas,
          itemEco.kcal,
          itemEco.proteina_g,
          itemEco.carbo_g,
          itemEco.gordura_g,
        );
        return itemEco;
      });

      return {
        duplicado: false,
        registro: {
          id_curto: idCurto,
          data_local: dataLocal,
          timestamp_utc: timestampUtc,
          ...(tipoRefefeicao !== undefined
            ? { tipo_refeicao: tipoRefefeicao }
            : {}),
          itens: ecoItens,
        } satisfies RegistroEco,
      };
    },
  );

  const { duplicado, registro } = gravar();
  return {
    registro,
    saldo: calcularSaldo(db, registro.data_local),
    duplicado,
  };
}

/** Conveniência p/ as tools: registra usando a conexão do processo. */
export function registrarRefeicaoDaTool(entrada: {
  data?: string;
  itens: ItemEntrada[];
  tipoRefefeicao?: string;
}): { registro: RegistroEco; saldo: Saldo; duplicado: boolean } {
  return registrarRefeicao(getDb(), entrada);
}
