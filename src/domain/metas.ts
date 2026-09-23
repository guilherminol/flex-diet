import type { Db } from "../db/connect.js";
import { agoraIsoUtc, hojeLocalSp } from "../lib/datas.js";
import { ErroDominio } from "./refeicoes.js";
import type { Metas } from "./saldo.js";

export interface MetasEntrada {
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
}

/**
 * Metas vigentes para uma data: a linha de meta_diaria com a maior
 * data_inicio <= dataLocal (empate no dia: a última inserida vence).
 * A ÚNICA regra de vigência do sistema — saldo.ts usa esta implementação.
 */
export function obterMetasVigentes(
  db: Db,
  dataLocal: string,
): Metas | undefined {
  return db
    .prepare(
      `SELECT kcal, proteina_g, carbo_g, gordura_g
       FROM meta_diaria
       WHERE data_inicio <= ?
       ORDER BY data_inicio DESC, id DESC
       LIMIT 1`,
    )
    .get(dataLocal) as Metas | undefined;
}

const numeroValido = (valor: number): boolean =>
  typeof valor === "number" && Number.isFinite(valor) && valor > 0;

/**
 * definirMetas — grava as metas com vigência por data_inicio = hoje local SP
 * (prepara a aderência histórica da Phase 3, META-04). Os 4 valores são
 * obrigatórios (D-10): a validação de domínio recusa qualquer um ausente,
 * não positivo ou não finito.
 */
export function definirMetas(db: Db, metas: MetasEntrada): Metas {
  const campos: [string, number][] = [
    ["kcal", metas.kcal],
    ["proteina_g", metas.proteina_g],
    ["carbo_g", metas.carbo_g],
    ["gordura_g", metas.gordura_g],
  ];
  const invalidos = campos
    .filter(([, valor]) => !numeroValido(valor))
    .map(([nome]) => nome);
  if (invalidos.length > 0) {
    throw new ErroDominio(
      "metas_invalidas",
      `informe os 4 valores positivos de metas (inválidos/ausentes: ${invalidos.join(", ")})`,
      { invalidos },
    );
  }

  const dataInicio = hojeLocalSp();
  db.prepare(
    `INSERT INTO meta_diaria (data_inicio, kcal, proteina_g, carbo_g, gordura_g, timestamp_utc)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    dataInicio,
    metas.kcal,
    metas.proteina_g,
    metas.carbo_g,
    metas.gordura_g,
    agoraIsoUtc(),
  );

  return {
    kcal: metas.kcal,
    proteina_g: metas.proteina_g,
    carbo_g: metas.carbo_g,
    gordura_g: metas.gordura_g,
  };
}
