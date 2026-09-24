import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { connectDb } from "../src/db/connect.js";
import { runMigrations } from "../src/db/migrate.js";

const DIR_MIGRATIONS = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "db",
  "migrations",
);
const TOTAL_MIGRATIONS = readdirSync(DIR_MIGRATIONS).filter((arquivo) =>
  arquivo.endsWith(".sql"),
).length;

describe("migrations (INFRA-02)", () => {
  it(`user_version avança 0→${TOTAL_MIGRATIONS}, backup pré-migration é criado e re-run é no-op`, async () => {
    const dir = mkdtempSync(join(tmpdir(), "flexdiet-mig-"));
    const db = connectDb(join(dir, "test.db"));
    try {
      expect(db.pragma("user_version", { simple: true })).toBe(0);

      const dirBackups = join(dir, "backups");
      const primeira = await runMigrations(db, dirBackups);
      expect(primeira.aplicadas).toBe(TOTAL_MIGRATIONS);
      expect(primeira.versaoAtual).toBe(TOTAL_MIGRATIONS);

      // um backup pré-migration por migration aplicada
      const backups = readdirSync(dirBackups);
      expect(backups).toHaveLength(TOTAL_MIGRATIONS);
      expect(backups[0]).toMatch(/^pre-migration-1-\d+\.db$/);
      expect(readdirSync(dir, { recursive: true }).length).toBeGreaterThan(0);

      // tabelas do schema inicial existem
      const tabelas = (
        db
          .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
          .all() as { name: string }[]
      ).map((r) => r.name);
      for (const tabela of [
        "alimento",
        "medida_caseira",
        "refeicao",
        "refeicao_item",
        "meta_diaria",
      ]) {
        expect(tabelas).toContain(tabela);
      }

      // rodar de novo = 0 aplicadas (idempotente)
      const segunda = await runMigrations(db, dirBackups);
      expect(segunda.aplicadas).toBe(0);
      expect(segunda.versaoAtual).toBe(TOTAL_MIGRATIONS);
    } finally {
      db.close();
    }
  });

  it("WAL está ativo na conexão (INFRA-02)", () => {
    const dir = mkdtempSync(join(tmpdir(), "flexdiet-wal-"));
    const db = connectDb(join(dir, "test.db"));
    try {
      expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    } finally {
      db.close();
    }
  });
});
