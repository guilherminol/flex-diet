import { mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./connect.js";

/** Retenção padrão do D-02: ~7 dias de backups diários no volume da VPS. */
export const RETENCAO_PADRAO = 7;

const pad2 = (n: number): string => String(n).padStart(2, "0");

/**
 * Nome do snapshot: diario-YYYY-MM-DD-HHmmss.db — ordenável lexicograficamente
 * (a ordem alfabética é a ordem cronológica, base da retenção).
 */
export const nomeBackupDiario = (agora: Date): string =>
  `diario-${agora.getFullYear()}-${pad2(agora.getMonth() + 1)}-${pad2(agora.getDate())}-${pad2(agora.getHours())}${pad2(agora.getMinutes())}${pad2(agora.getSeconds())}.db`;

const PADRAO_DIARIO = /^diario-\d{4}-\d{2}-\d{2}-\d{6}\.db$/;

/**
 * Snapshot consistente do banco via `db.backup()` (promise; correto mesmo em
 * WAL — NUNCA cópia crua do arquivo, RESEARCH Pitfall 6). Cria o diretório se
 * preciso e retorna o caminho do backup gerado.
 */
export async function fazerBackupDiario(
  db: Db,
  dir: string,
  agora: Date = new Date(),
): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const destino = join(dir, nomeBackupDiario(agora));
  await db.backup(destino);
  return destino;
}

/**
 * Função PURA de decisão (D-02): lista os arquivos diario-*.db do diretório
 * ordenados por nome e retorna os que devem ser removidos — tudo além dos
 * `maximo` mais recentes. Só enxerga o padrão diario-*; backups pré-migration
 * (pre-migration-*.db) jamais são apontados.
 */
export function reterUltimos(dir: string, maximo: number): string[] {
  if (!Number.isInteger(maximo) || maximo < 0) {
    throw new Error(`retenção inválida: ${maximo}`);
  }
  const diarios = readdirSync(dir)
    .filter((arquivo) => PADRAO_DIARIO.test(arquivo))
    .sort();
  const excedentes = diarios.length - maximo;
  return excedentes > 0 ? diarios.slice(0, excedentes) : [];
}

/**
 * Executa a remoção apontada por `reterUltimos` (fs.unlinkSync) e retorna os
 * arquivos removidos.
 */
export function aplicarRetencao(dir: string, maximo: number): string[] {
  const remover = reterUltimos(dir, maximo);
  for (const nome of remover) {
    unlinkSync(join(dir, nome));
  }
  return remover;
}

/**
 * Job interno do backup diário (D-02): roda uma vez no boot e re-agenda a cada
 * 24h. Erro NUNCA derruba o serviço — log em stderr e segue. O timer é unref'd
 * quando disponível para não segurar o processo vivo.
 */
export function agendarBackupDiario(
  db: Db,
  dir: string,
  maximo: number = RETENCAO_PADRAO,
): void {
  const rodar = (): void => {
    try {
      fazerBackupDiario(db, dir)
        .then((destino) => {
          const removidos = aplicarRetencao(dir, maximo);
          console.error(
            `[backup] diário ok: ${destino} (retenção ${maximo}${removidos.length > 0 ? `, removeu ${removidos.length}` : ""})`,
          );
        })
        .catch((erro: unknown) => {
          console.error("[backup] diário falhou (serviço segue):", erro);
        });
    } catch (erro) {
      console.error("[backup] diário falhou (serviço segue):", erro);
    }
  };

  rodar();
  const timer = setInterval(rodar, 24 * 60 * 60 * 1000);
  timer.unref?.();
}
