import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

export type Db = Database.Database;

let instancia: Db | undefined;

/** Registra a conexão do processo (chamado uma vez no boot). */
export const setDb = (db: Db): void => {
  instancia = db;
};

/** Conexão do processo — usada pelas tools MCP. */
export const getDb = (): Db => {
  if (!instancia) {
    throw new Error(
      "banco não inicializado — chame connectDb()+setDb() no boot",
    );
  }
  return instancia;
};

/**
 * Abre (ou cria) o banco em `caminho` ?? `FLEXDIET_DB_PATH` ?? `data/flexdiet.db`,
 * criando o diretório pai, com WAL + busy_timeout + foreign_keys.
 */
export function connectDb(caminho?: string): Db {
  const arquivo = resolve(
    caminho ?? process.env.FLEXDIET_DB_PATH ?? "data/flexdiet.db",
  );
  mkdirSync(dirname(arquivo), { recursive: true });
  const db = new Database(arquivo);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  return db;
}
