import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDb, type Db } from "../src/db/connect.js";
import { hojeLocalSp } from "../src/lib/datas.js";
import { startServer } from "../src/server.js";

const TOKEN = "teste-token-tracer-0123456789abcdef";

interface RespostaRpc {
  jsonrpc?: string;
  id?: number;
  result?: {
    serverInfo?: { name: string; version?: string };
    tools?: { name: string }[];
    structuredContent?: unknown;
    isError?: boolean;
    content?: { type: string; text?: string }[];
  };
  error?: { code?: number; message?: string };
}

let server: Awaited<ReturnType<typeof startServer>>;
let dbLeitor: Db;
let porta: number;
let dbPath: string;
let idBanana: number;
let idArroz: number;

const rpc = async (
  corpo: unknown,
  opcoes?: { token?: string | null },
): Promise<{ status: number; json: RespostaRpc | undefined }> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  // Default: token válido. `{ token: null }` omite o header (teste do 401).
  if (opcoes?.token !== null) {
    headers.Authorization = `Bearer ${opcoes?.token ?? TOKEN}`;
  }
  const resp = await fetch(`http://127.0.0.1:${porta}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(corpo),
  });
  const contentType = resp.headers.get("content-type") ?? "";
  let json: RespostaRpc | undefined;
  if (contentType.includes("text/event-stream")) {
    const texto = await resp.text();
    const linhaData = texto
      .split("\n")
      .find((linha) => linha.startsWith("data:"));
    if (linhaData) json = JSON.parse(linhaData.slice(5).trim()) as RespostaRpc;
  } else {
    json = (await resp.json()) as RespostaRpc;
  }
  return { status: resp.status, json };
};

const chamarTool = async (nome: string, args: Record<string, unknown>) => {
  const { status, json } = await rpc({
    jsonrpc: "2.0",
    id: 99,
    method: "tools/call",
    params: { name: nome, arguments: args },
  });
  return { status, json };
};

beforeAll(async () => {
  process.env.MCP_TOKEN = TOKEN;
  const dir = mkdtempSync(join(tmpdir(), "flexdiet-http-"));
  dbPath = join(dir, "test.db");
  server = await startServer({
    port: 0,
    dbPath,
    dirBackups: join(dir, "backups"),
  });
  const endereco = server.address() as AddressInfo;
  porta = endereco.port;

  // Resolve ids do catálogo por numero_taco (segunda conexão — WAL permite)
  dbLeitor = connectDb(dbPath);
  const buscarId = dbLeitor.prepare(
    `SELECT id FROM alimento WHERE fonte = 'taco' AND numero_taco = ?`,
  );
  idBanana = (buscarId.get("178") as { id: number }).id;
  idArroz = (buscarId.get("5") as { id: number }).id;
});

afterAll(() => {
  dbLeitor?.close();
  server?.close();
});

describe('loop "registrei → saldo" de ponta a ponta (INFRA-01, REG-01/02)', () => {
  it("POST /mcp sem Authorization responde 401", async () => {
    const { status } = await rpc(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { token: null },
    );
    expect(status).toBe(401);
  });

  it("POST /mcp com token errado responde 401", async () => {
    const { status } = await rpc(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      { token: "token-errado" },
    );
    expect(status).toBe(401);
  });

  it("initialize responde serverInfo flex-diet", async () => {
    const { status, json } = await rpc({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "vitest", version: "0.0.0" },
      },
    });
    expect(status).toBe(200);
    expect(json?.result?.serverInfo?.name).toBe("flex-diet");
  });

  it("tools/list lista registrar_refeicao e consultar_saldo", async () => {
    const { status, json } = await rpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
    });
    expect(status).toBe(200);
    const nomes = (json?.result?.tools ?? []).map((t) => t.name);
    expect(nomes).toContain("registrar_refeicao");
    expect(nomes).toContain("consultar_saldo");
  });

  it("registrar 120g de banana maçã (retroativo) retorna eco + id_curto + saldo na mesma resposta", async () => {
    const { status, json } = await chamarTool("registrar_refeicao", {
      data: "2026-09-20", // retroativo (REG-05) — não mistura com o dia do arroz
      itens: [{ alimento_id: idBanana, gramas: 120 }],
    });
    expect(status).toBe(200);
    expect(json?.error).toBeUndefined();

    const conteudo = json?.result?.structuredContent as {
      registro: {
        id_curto: string;
        data_local: string;
        itens: {
          nome: string;
          gramas: number;
          fonte: string;
          kcal: number;
        }[];
      };
      saldo: { status: string };
    };

    // eco: nome + gramas + fonte taco
    const item = conteudo.registro.itens[0];
    expect(item.nome).toBe("Banana, maçã, crua");
    expect(item.gramas).toBe(120);
    expect(item.fonte).toBe("taco");
    expect(item.kcal).toBeCloseTo((120 * 86.805) / 100, 0);

    // id_curto (4 hex) e data retroativa gravada
    expect(conteudo.registro.id_curto).toMatch(/^[0-9a-f]{4}$/);
    expect(conteudo.registro.data_local).toBe("2026-09-20");

    // saldo vem NA MESMA resposta (sem metas → meta_nao_definida, D-09)
    expect(conteudo.saldo).toBeDefined();
    expect(conteudo.saldo.status).toBe("meta_nao_definida");
  });

  it("registrar 150g de arroz hoje e consultar_saldo → consumido.kcal ≈ 195,18 (±0,5)", async () => {
    const registro = await chamarTool("registrar_refeicao", {
      itens: [{ alimento_id: idArroz, gramas: 150 }],
    });
    expect(registro.status).toBe(200);
    expect(registro.json?.error).toBeUndefined();

    // define metas a partir de hoje para o saldo virar 'ok'
    dbLeitor
      .prepare(
        `INSERT INTO meta_diaria (data_inicio, kcal, proteina_g, carbo_g, gordura_g, timestamp_utc)
         VALUES (?, 2000, 150, 200, 70, '2026-09-20T12:00:00.000Z')`,
      )
      .run(hojeLocalSp());

    const consulta = await chamarTool("consultar_saldo", {});
    expect(consulta.status).toBe(200);

    const saldo = consulta.json?.result?.structuredContent as {
      status: string;
      data: string;
      consumido: {
        kcal: number;
        proteina_g: number;
        carbo_g: number;
        gordura_g: number;
      };
    };

    expect(saldo.status).toBe("ok");
    // 150g do arroz tipo 2 (130,1196 kcal/100g no CSV) ≈ 195,18 kcal
    expect(saldo.consumido.kcal).toBeGreaterThan(195.18 - 0.5);
    expect(saldo.consumido.kcal).toBeLessThan(195.18 + 0.5);
  });

  it("alimento inexistente vira erro estruturado (isError), nunca exceção crua", async () => {
    const { status, json } = await chamarTool("registrar_refeicao", {
      itens: [{ alimento_id: 999999, gramas: 100 }],
    });
    expect(status).toBe(200);
    expect(json?.result?.isError).toBe(true);
    const corpo = JSON.parse(json?.result?.content?.[0]?.text ?? "{}") as {
      erro: string;
      mensagem: string;
    };
    expect(corpo.erro).toBe("alimento_nao_encontrado");
    expect(corpo.mensagem).toContain("999999");
  });

  it("GET /healthz responde 200 { ok: true } sem auth", async () => {
    const resp = await fetch(`http://127.0.0.1:${porta}/healthz`);
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ ok: true });
  });
});
