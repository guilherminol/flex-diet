import { randomBytes } from "node:crypto";
import type { Db } from "../db/connect.js";
import { getDb } from "../db/connect.js";
import { agoraIsoUtc, dataLocalSp, resolverDataLocal } from "../lib/datas.js";
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

/**
 * registrarRefeicao — atômica (D-03): UMA transação síncrona grava a refeição
 * e todos os itens com snapshot de macros calculado do catálogo TACO
 * (macro_100g × gramas/100; NULL → 0 via COALESCE). Cada débito aplica por
 * completo ou não aplica nada — o saldo nunca reflete débito parcial.
 * Retroativo (REG-05): `data` informada grava na data_local informada.
 * Retorna o eco (nome + gramas + fonte + macros, id_curto) e o saldo do dia
 * NA MESMA resposta (D-05, REG-01/REG-02).
 */
export function registrarRefeicao(
  db: Db,
  entrada: { data?: string; itens: ItemEntrada[]; tipoRefefeicao?: string },
): { registro: RegistroEco; saldo: Saldo } {
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
    `INSERT INTO refeicao (id_curto, data_local, timestamp_utc, tipo_refeicao)
     VALUES (?, ?, ?, ?)`,
  );
  const inserirItem = db.prepare(
    `INSERT INTO refeicao_item (refeicao_id, alimento_id, gramas, kcal, proteina_g, carbo_g, gordura_g)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  // Transação SÍNCRONA — zero await no closure (better-sqlite3 rejeita async)
  const gravar = db.transaction(() => {
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
      data === undefined ? dataLocalSp(timestampUtc) : resolverDataLocal(data);

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
  });

  const { registro } = gravar();
  return { registro, saldo: calcularSaldo(db, registro.data_local) };
}

/** Conveniência p/ as tools: registra usando a conexão do processo. */
export function registrarRefeicaoDaTool(entrada: {
  data?: string;
  itens: ItemEntrada[];
  tipoRefefeicao?: string;
}): { registro: RegistroEco; saldo: Saldo } {
  return registrarRefeicao(getDb(), entrada);
}
