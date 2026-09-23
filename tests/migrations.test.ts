import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { connectDb } from "../src/db/connect.js";
import { runMigrations } from "../src/db/migrate.js";

describe("migrations (INFRA-02)", () => {
  it("user_version avança 0→1, backup pré-migration é criado e re-run é no-op", async () => {
    const dir = mkdtempSync(join(tmpdir(), "flexdiet-mig-"));
    const db = connectDb(join(dir, "test.db"));
    try {
      expect(db.pragma("user_version", { simple: true })).toBe(0);

      const dirBackups = join(dir, "backups");
      const primeira = await runMigrations(db, dirBackups);
      expect(primeira.aplicadas).toBe(1);
      expect(primeira.versaoAtual).toBe(1);

      // backup pré-migration gerado em data/backups/
      const backups = readdirSync(dirBackups);
      expect(backups).toHaveLength(1);
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
      expect(segunda.versaoAtual).toBe(1);
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
