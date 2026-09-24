import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { connectDb, type Db } from "../src/db/connect.js";
import { runMigrations } from "../src/db/migrate.js";
import { runSeed } from "../src/db/seed/seed.js";
import { buscarAlimentos, escaparLike } from "../src/domain/alimentos.js";
import { normalizarParaBusca } from "../src/lib/texto.js";
import { inputSchema } from "../src/mcp/tools/catalogo.js";

let db: Db;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "flexdiet-alimentos-"));
  db = connectDb(join(dir, "test.db"));
  await runMigrations(db, join(dir, "backups"));
  runSeed(db);
});

describe("buscar_alimento (ALIM-06)", () => {
  it("busca 'banana' retorna >= 1 candidato e inclui Banana maçã com 86–89 kcal/100g", () => {
    const candidatos = buscarAlimentos(db, "banana");
    expect(candidatos.length).toBeGreaterThanOrEqual(1);
    const maca = candidatos.find((c) => c.nome.toLowerCase().includes("maçã"));
    expect(maca).toBeDefined();
    expect(maca?.kcal_100g).toBeGreaterThan(86);
    expect(maca?.kcal_100g).toBeLessThan(89);
    // macros POR 100g + fonte em todos os candidatos
    for (const c of candidatos) {
      expect(c.fonte).toBe("taco");
      expect(c.kcal_100g).not.toBeNull();
      expect(Array.isArray(c.medidas_caseiras)).toBe(true);
    }
  });

  it("busca acento-insensível: 'óleo de soja' e 'açaí' acham os nomes acentuados", () => {
    const oleo = buscarAlimentos(db, "óleo de soja");
    const oleoSoja = oleo.find((c) => c.nome === "Óleo, de soja");
    expect(oleoSoja).toBeDefined();
    expect(oleoSoja?.medidas_caseiras.length).toBeGreaterThanOrEqual(1);
    expect(buscarAlimentos(db, "oleo de soja")).toEqual(oleo); // com/sem acento = igual

    const acai = buscarAlimentos(db, "açaí");
    expect(acai.some((c) => c.nome.startsWith("Açaí"))).toBe(true);
  });

  it("candidato com match POF traz >= 1 medida com gramas > 0; sem match traz []", () => {
    const tokens = (
      db
        .prepare(
          `SELECT nome FROM alimento a
           WHERE EXISTS (SELECT 1 FROM medida_caseira m WHERE m.alimento_id = a.id)`,
        )
        .all() as { nome: string }[]
    ).map((r) => normalizarParaBusca(r.nome.split(",")[0]));
    expect(tokens.length).toBeGreaterThan(0);

    let viuComMedidas = false;
    for (const token of new Set(tokens)) {
      if (token.length < 2) continue;
      for (const candidato of buscarAlimentos(db, token)) {
        const noBanco = db
          .prepare(
            `SELECT COUNT(*) AS total FROM medida_caseira WHERE alimento_id = ?`,
          )
          .get(candidato.id) as { total: number };
        // a resposta espelha EXATAMENTE o que o join do seed gravou
        expect(candidato.medidas_caseiras.length).toBe(noBanco.total);
        if (noBanco.total > 0) {
          viuComMedidas = true;
          for (const m of candidato.medidas_caseiras) {
            expect(m.gramas).toBeGreaterThan(0);
            expect(m.descricao.length).toBeGreaterThan(0);
          }
        }
      }
    }
    expect(viuComMedidas).toBe(true);

    // 'arroz, tipo' casa só com os arrozes genéricos (base 'arroz' é ambíguo:
    // 6+ TACOs) → NENHUM pode ter medida inventada (D-04 / RESEARCH Pitfall 3)
    for (const candidato of buscarAlimentos(db, "arroz, tipo")) {
      expect(candidato.medidas_caseiras).toEqual([]);
    }
  });

  it("termo com '%' não expande a busca — só match literal, nunca a tabela (T-01-07)", () => {
    expect(escaparLike("banana%")).toBe("banana\\%");
    // '%' vira match literal: nomes que CONTÊM '%' (ex.: "(65% de lipídeos)"),
    // nunca a tabela inteira
    const comPercento = buscarAlimentos(db, "%");
    for (const c of comPercento) {
      expect(c.nome).toContain("%");
    }
    expect(comPercento.length).toBeLessThan(
      (
        db.prepare(`SELECT COUNT(*) AS total FROM alimento`).get() as {
          total: number;
        }
      ).total,
    );
    // sem escape, estes casariam com TODAS as bananas / qualquer palavra
    expect(buscarAlimentos(db, "banana%")).toEqual([]);
    expect(buscarAlimentos(db, "ban_na")).toEqual([]);
    // contraste: sem curinga a busca segue funcionando
    expect(buscarAlimentos(db, "banana").length).toBeGreaterThan(0);
  });

  it("schema rejeita termo com menos de 2 ou mais de 100 caracteres (T-01-08)", () => {
    expect(inputSchema.safeParse({ termo: "a" }).success).toBe(false);
    expect(inputSchema.safeParse({ termo: "" }).success).toBe(false);
    expect(inputSchema.safeParse({ termo: "x".repeat(101) }).success).toBe(
      false,
    );
    expect(inputSchema.safeParse({ termo: "arroz" }).success).toBe(true);
  });

  it("busca sem resultado retorna lista vazia sem erro", () => {
    expect(() => buscarAlimentos(db, "zzzzqqq")).not.toThrow();
    expect(buscarAlimentos(db, "zzzzqqq")).toEqual([]);
  });

  it("usa prepared statement — termo malicioso não corrompe query nem dados (T-01-07)", () => {
    const malicioso = "'; DROP TABLE alimento; --";
    expect(() => buscarAlimentos(db, malicioso)).not.toThrow();
    expect(buscarAlimentos(db, malicioso)).toEqual([]);
    const { total } = db
      .prepare(`SELECT COUNT(*) AS total FROM alimento`)
      .get() as { total: number };
    expect(total).toBeGreaterThan(500);

    // inspeção de código: nenhuma interpolação do termo no SQL
    const fonte = readFileSync("src/domain/alimentos.ts", "utf8");
    expect(fonte).toContain("prepare(");
    expect(fonte).toContain("escaparLike(normalizarParaBusca(termoBruto)");
    expect(fonte).not.toMatch(/\$\{\s*termo/);
  });
});
