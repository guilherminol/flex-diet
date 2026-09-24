import { createHash } from "node:crypto";

export interface ItemDedupe {
  alimento_id: number;
  gramas: number;
}

/**
 * dedupeHash — sha256 do payload canônico (REG-06, D-07).
 * O payload canônico é EXATAMENTE { data_local, itens: [{alimento_id, gramas}] }
 * — sem tipo_refeicao nem timestamp. Canonicalização ANTES do hash
 * (RESEARCH Pitfall 10): itens ordenados por alimento_id ascendente e gramas
 * arredondadas a 1 casa — reenvio com ordem trocada ou 150 vs 150.0
 * deduplica igual; data/gramas/alimento diferentes produzem hash distinto.
 */
export function dedupeHash(dataLocal: string, itens: ItemDedupe[]): string {
  const canonico = JSON.stringify({
    data_local: dataLocal,
    itens: itens
      .map((item) => ({
        alimento_id: item.alimento_id,
        gramas: Number(item.gramas.toFixed(1)),
      }))
      .sort((a, b) => a.alimento_id - b.alimento_id),
  });
  return createHash("sha256").update(canonico).digest("hex");
}

/** Janela de idempotência (D-07): 10 minutos. */
export const JANELA_DEDUPE_MS = 10 * 60 * 1000;

/**
 * Início da janela de dedupe em ISO-8601 UTC — mesmo formato e comprimento de
 * `timestamp_utc`, então a comparação de string no SQL é cronologicamente
 * correta. (O literal `datetime('now', '-10 minutes')` do SQLite produz
 * "YYYY-MM-DD HH:MM:SS", que comparado lexicograficamente com o formato ISO
 * com 'T' sempre sai menor no mesmo dia — a janela vazaria.)
 */
export const inicioDaJanela = (agoraMs: number = Date.now()): string =>
  new Date(agoraMs - JANELA_DEDUPE_MS).toISOString();
