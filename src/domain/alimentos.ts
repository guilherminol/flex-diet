import type { Db } from "../db/connect.js";
import { normalizarParaBusca } from "../lib/texto.js";

export interface MedidaCaseira {
  descricao: string;
  gramas: number;
}

export interface AlimentoCandidato {
  id: number;
  nome: string;
  fonte: string;
  kcal_100g: number | null;
  proteina_g_100g: number | null;
  carbo_g_100g: number | null;
  gordura_g_100g: number | null;
  medidas_caseiras: MedidaCaseira[];
}

/**
 * Escapa os curingas de LIKE (`%`, `_` e o próprio `\`) do termo do usuário
 * (T-01-07): o texto entra como PARÂMETRO de prepared statement e é casado
 * literalmente — "%" digitado não expande a busca para a tabela inteira.
 */
export function escaparLike(termo: string): string {
  return termo.replace(/[\\%_]/g, "\\$&");
}

const QUERY_BUSCA = `
  SELECT id, fonte, nome,
         kcal_100g, proteina_g_100g, carbo_g_100g, gordura_g_100g
  FROM alimento
  WHERE nome_busca LIKE '%' || @termo || '%' ESCAPE '\\'
  ORDER BY nome
  LIMIT 5
`;

const QUERY_MEDIDAS = `
  SELECT descricao, gramas
  FROM medida_caseira
  WHERE alimento_id = ?
  ORDER BY descricao
`;

/**
 * buscarAlimentos — busca por nome no catálogo com prepared statement
 * (100% parametrizado, zero concatenação de SQL — T-01-07):
 * - termo normalizado com a MESMA função que o seed usou para gravar
 *   `nome_busca` (minúsculas, sem acentos, vírgulas → espaço) — buscar
 *   "óleo de soja" acha "Óleo, de soja" e "açaí" acha "Açaí, cru";
 * - curingas de LIKE (`%`, `_`, `\`) escapados do termo do usuário;
 * - top-5 por ordem de nome;
 * - macros POR 100g + medidas caseiras em gramas (ordem estável por descricao;
 *   lista vazia quando o alimento não tem match POF inequívoco — D-04).
 * Busca sem resultado devolve [] — não é erro (quem decide é o Hermes).
 */
export function buscarAlimentos(
  db: Db,
  termoBruto: string,
): AlimentoCandidato[] {
  const termo = escaparLike(normalizarParaBusca(termoBruto));
  const candidatos = db.prepare(QUERY_BUSCA).all({ termo }) as Omit<
    AlimentoCandidato,
    "medidas_caseiras"
  >[];

  const stmtMedidas = db.prepare(QUERY_MEDIDAS);
  return candidatos.map((candidato) => ({
    ...candidato,
    medidas_caseiras: stmtMedidas.all(candidato.id) as MedidaCaseira[],
  }));
}
