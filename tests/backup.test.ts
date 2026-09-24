import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  aplicarRetencao,
  fazerBackupDiario,
  RETENCAO_PADRAO,
  reterUltimos,
} from "../src/db/backup.js";
import { connectDb } from "../src/db/connect.js";
import { runMigrations } from "../src/db/migrate.js";

const criarBancoProva = (dir: string) => {
  const db = connectDb(join(dir, "test.db"));
  return db;
};

describe("backup diário (D-02, T-01-14)", () => {
  it("fazerBackupDiario cria arquivo legível por better-sqlite3 (user_version presente)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "flexdiet-bk1-"));
    const db = criarBancoProva(dir);
    try {
      await runMigrations(db, join(dir, "backups"));
      db.exec("CREATE TABLE prova_backup (v TEXT)");
      db.prepare("INSERT INTO prova_backup (v) VALUES (?)").run("snapshot");

      const destino = await fazerBackupDiario(db, join(dir, "backups"));

      const copia = new Database(destino, { readonly: true });
      try {
        expect(
          copia.pragma("user_version", { simple: true }) as number,
        ).toBeGreaterThan(0);
      } finally {
        copia.close();
      }
    } finally {
      db.close();
    }
  });

  it("reterUltimos com 9 arquivos mantém 7 e aponta EXATAMENTE os 2 mais antigos (pura)", () => {
    const dir = mkdtempSync(join(tmpdir(), "flexdiet-bk2-"));
    for (let dia = 1; dia <= 9; dia++) {
      const dd = String(dia).padStart(2, "0");
      writeFileSync(join(dir, `diario-2026-09-${dd}-120000.db`), "x");
    }
    // backup pré-migration no MESMO diretório jamais pode ser apontado
    writeFileSync(join(dir, "pre-migration-1-1727000000000.db"), "x");

    const remover = reterUltimos(dir, RETENCAO_PADRAO);

    expect(remover).toEqual([
      "diario-2026-09-01-120000.db",
      "diario-2026-09-02-120000.db",
    ]);
  });

  it("reterUltimos com poucos arquivos não aponta nada e rejeita retenção inválida", () => {
    const dir = mkdtempSync(join(tmpdir(), "flexdiet-bk2b-"));
    writeFileSync(join(dir, "diario-2026-09-20-100000.db"), "x");
    expect(reterUltimos(dir, 7)).toEqual([]);
    expect(() => reterUltimos(dir, -1)).toThrow(/retenção inválida/);
  });

  it("aplicarRetencao remove só os apontados (7 restantes + pré-migration intacto)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "flexdiet-bk3-"));
    for (let dia = 1; dia <= 9; dia++) {
      const dd = String(dia).padStart(2, "0");
      writeFileSync(join(dir, `diario-2026-09-${dd}-120000.db`), "x");
    }
    writeFileSync(join(dir, "pre-migration-1-1727000000000.db"), "x");

    const removidos = aplicarRetencao(dir, RETENCAO_PADRAO);

    expect(removidos).toHaveLength(2);
    const restantes = readdirSync(dir).sort();
    expect(restantes).toHaveLength(8); // 7 diários + pré-migration
    expect(restantes.filter((n) => n.startsWith("diario-"))).toHaveLength(7);
    expect(restantes).toContain("pre-migration-1-1727000000000.db");
    expect(restantes).not.toContain("diario-2026-09-01-120000.db");
  });

  it("restauração barata: o backup abre e consulta dados reais (snapshot consistente, não arquivo vazio)", async () => {
    const dir = mkdtempSync(join(tmpdir(), "flexdiet-bk4-"));
    const db = criarBancoProva(dir);
    try {
      await runMigrations(db, join(dir, "backups"));
      db.exec("CREATE TABLE prova_backup (v TEXT)");
      db.prepare("INSERT INTO prova_backup (v) VALUES (?)").run("snapshot");

      const destino = await fazerBackupDiario(db, join(dir, "backups"));

      // escreita PÓS-backup não pode aparecer na cópia (snapshot pontual)
      db.prepare("INSERT INTO prova_backup (v) VALUES (?)").run("depois");

      const copia = new Database(destino, { readonly: true });
      try {
        const linhas = copia
          .prepare("SELECT v FROM prova_backup ORDER BY rowid")
          .all() as { v: string }[];
        expect(linhas.map((l) => l.v)).toEqual(["snapshot"]);

        // schema real das migrations existe na cópia
        const tabelas = (
          copia
            .prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`)
            .all() as { name: string }[]
        ).map((r) => r.name);
        expect(tabelas).toContain("refeicao");
        expect(tabelas).toContain("meta_diaria");
      } finally {
        copia.close();
      }
    } finally {
      db.close();
    }
  });
});
