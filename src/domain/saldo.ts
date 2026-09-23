import type { Db } from "../db/connect.js";
import { obterMetasVigentes } from "./metas.js";

export interface Macros {
  kcal: number;
  proteina_g: number;
  carbo_g: number;
  gordura_g: number;
}

export interface Metas extends Macros {}

export type Saldo =
  | {
      status: "meta_nao_definida";
      instrucao: string;
    }
  | {
      status: "ok";
      data: string;
      metas: Metas;
      consumido: Macros;
      restante: Macros;
    };

const INSTRUCAO_METAS =
  "defina as metas com definir_metas informando kcal, proteina_g, carbo_g e gordura_g";

const QUERY_CONSUMIDO = `
  SELECT COALESCE(SUM(i.kcal), 0) AS kcal,
         COALESCE(SUM(i.proteina_g), 0) AS proteina_g,
         COALESCE(SUM(i.carbo_g), 0) AS carbo_g,
         COALESCE(SUM(i.gordura_g), 0) AS gordura_g
  FROM refeicao_item i
  JOIN refeicao r ON r.id = i.refeicao_id
  WHERE r.data_local = ?
`;

/**
 * calcularSaldo — a ÚNICA implementação do saldo no codebase.
 * Saldo NUNCA é armazenado: derivado em leitura por data_local, comparando o
 * consumo agregado dos itens com as metas vigentes. Sem metas definidas
 * responde `meta_nao_definida` + instrução — nunca números inventados (D-09).
 * `restante` negativo permanece negativo (sem clamp).
 */
export function calcularSaldo(db: Db, dataLocal: string): Saldo {
  const metas = obterMetasVigentes(db, dataLocal);
  if (!metas) {
    return { status: "meta_nao_definida", instrucao: INSTRUCAO_METAS };
  }

  const consumido = db.prepare(QUERY_CONSUMIDO).get(dataLocal) as Macros;

  const restante: Macros = {
    kcal: metas.kcal - consumido.kcal,
    proteina_g: metas.proteina_g - consumido.proteina_g,
    carbo_g: metas.carbo_g - consumido.carbo_g,
    gordura_g: metas.gordura_g - consumido.gordura_g,
  };

  return { status: "ok", data: dataLocal, metas, consumido, restante };
}
