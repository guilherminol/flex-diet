import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./connect.js";

interface Migration {
  versao: number;
  nome: string;
  sql: string;
}

const DIR_MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

const carregarMigrations = (): Migration[] =>
  readdirSync(DIR_MIGRATIONS)
    .filter((arquivo) => arquivo.endsWith(".sql"))
    .sort()
    .map((arquivo) => {
      const versao = Number.parseInt(arquivo.split("_")[0] ?? "", 10);
      if (!Number.isFinite(versao)) {
        throw new Error(`migration com prefixo de versão inválido: ${arquivo}`);
      }
      return {
        versao,
        nome: arquivo,
        sql: readFileSync(join(DIR_MIGRATIONS, arquivo), "utf8"),
      };
    });

const versaoAtual = (db: Db): number =>
  db.pragma("user_version", { simple: true }) as number;

/**
 * Roda as migrations pendentes controladas por `PRAGMA user_version`.
 * Para cada pendente: backup consistente prévio via `db.backup()` (promise —
 * FORA de transação; `db.transaction` rejeita async), aplica o SQL e avança a
 * versão. Rodar de novo é no-op (idempotente — INFRA-02).
 */
export async function runMigrations(
  db: Db,
  dirBackups = "data/backups",
): Promise<{ aplicadas: number; versaoAtual: number }> {
  const atual = versaoAtual(db);
  const pendentes = carregarMigrations().filter((m) => m.versao > atual);

  for (const m of pendentes) {
    mkdirSync(dirBackups, { recursive: true });
    const destino = resolve(
      dirBackups,
      `pre-migration-${m.versao}-${Date.now()}.db`,
    );
    await db.backup(destino);
    db.exec(m.sql);
    db.pragma(`user_version = ${m.versao}`);
    console.error(
      `[migrate] aplicada ${m.nome} (v${m.versao}); backup em ${destino}`,
    );
  }

  return { aplicadas: pendentes.length, versaoAtual: versaoAtual(db) };
}
