import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectDb, type Db } from "../src/db/connect.js";
import { startServer } from "../src/server.js";

/**
 * Cliente MCP real sobre HTTP puro (INFRA-01) — prova o transporte sem
 * depender do Hermes: handshake completo (initialize → notifications/initialized
 * → tools/list → tools/call) com Bearer, eco do header de sessão se o servidor
 * o emitir e idempotência visível POR CLIENTE (reenvio idêntico → duplicado).
 * Autocontido: banco em tmpdir, porta efêmera, token de teste, zero rede externa.
 */

const TOKEN = "teste-token-e2e-cliente-0123456789abcdef";

const AS_8_TOOLS = [
  "registrar_refeicao",
  "consultar_saldo",
  "buscar_alimento",
  "listar_registros",
  "editar_registro",
  "remover_registro",
  "repetir_refeicao",
  "definir_metas",
];

interface RespostaRpc {
  jsonrpc?: string;
  id?: number;
  result?: {
    protocolVersion?: string;
    serverInfo?: { name: string; version?: string };
    tools?: { name: string }[];
    structuredContent?: unknown;
    isError?: boolean;
  };
  error?: { code?: number; message?: string };
}

interface RespostaHttp {
  status: number;
  json: RespostaRpc | undefined;
}

let server: Awaited<ReturnType<typeof startServer>>;
let dbLeitor: Db;
let porta: number;
let idBanana: number;

// Estado de cliente real: ids JSON-RPC incrementais e sessão ecoada se emitida.
let proximoId = 1;
let idSessao: string | null = null;
let versaoNegociada: string | undefined;

const postar = async (
  corpo: unknown,
  opcoes?: { token?: string | null },
): Promise<RespostaHttp> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  // Default: token válido. `{ token: null }` omite o header (teste do 401).
  if (opcoes?.token !== null) {
    headers.Authorization = `Bearer ${opcoes?.token ?? TOKEN}`;
  }
  // Cliente real ecoa o header de sessão nas chamadas seguintes, se emitido.
  if (idSessao !== null) {
    headers["mcp-session-id"] = idSessao;
  }
  const resp = await fetch(`http://127.0.0.1:${porta}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(corpo),
  });
  const sessao = resp.headers.get("mcp-session-id");
  if (sessao !== null) {
    idSessao = sessao;
  }
  const contentType = resp.headers.get("content-type") ?? "";
  let json: RespostaRpc | undefined;
  if (contentType.includes("text/event-stream")) {
    const texto = await resp.text();
    const linhaData = texto
      .split("\n")
      .find((linha) => linha.startsWith("data:"));
    if (linhaData) {
      json = JSON.parse(linhaData.slice(5).trim()) as RespostaRpc;
    }
  } else {
    // Notificações (ex.: notifications/initialized) voltam 202 SEM corpo —
    // comportamento stateless observado do SDK; cliente real tolera.
    const texto = await resp.text();
    json = texto ? (JSON.parse(texto) as RespostaRpc) : undefined;
  }
  return { status: resp.status, json };
};

const chamarTool = async (
  nome: string,
  args: Record<string, unknown>,
): Promise<RespostaHttp> =>
  postar({
    jsonrpc: "2.0",
    id: proximoId++,
    method: "tools/call",
    params: { name: nome, arguments: args },
  });

let idCurtoOriginal = "";
let diaDoRegistro = "";

beforeAll(async () => {
  process.env.MCP_TOKEN = TOKEN;
  const dir = mkdtempSync(join(tmpdir(), "flexdiet-e2e-"));
  const dbPath = join(dir, "test.db");
  server = await startServer({
    port: 0,
    dbPath,
    dirBackups: join(dir, "backups"),
  });
  porta = (server.address() as AddressInfo).port;

  // Segunda conexão (WAL permite) para resolver o id da banana maçã (TACO 178)
  dbLeitor = connectDb(dbPath);
  idBanana = (
    dbLeitor
      .prepare(
        `SELECT id FROM alimento WHERE fonte = 'taco' AND numero_taco = ?`,
      )
      .get("178") as { id: number }
  ).id;
});

afterAll(() => {
  dbLeitor?.close();
  server?.close();
  // Dado para o checkpoint do Hermes (Task 3): comportamento de sessão e a
  // protocolVersion que ESTE servidor negocia — observado, não presumido.
  console.error(
    `[e2e-cliente] sessão observada: ${
      idSessao === null
        ? "nenhum header mcp-session-id emitido (stateless por request confirmado)"
        : `mcp-session-id emitido (${idSessao.length} chars) e ecoado nas chamadas seguintes`
    }; protocolVersion negociada no initialize: ${versaoNegociada ?? "não informada"}`,
  );
});

describe("cliente MCP e2e: handshake → tools/list → tools/call (INFRA-01)", () => {
  it("initialize sem Bearer → 401 (endpoint nunca anônimo, T-01-18)", async () => {
    const { status } = await postar(
      {
        jsonrpc: "2.0",
        id: proximoId++,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "hermes-e2e", version: "0.0.0" },
        },
      },
      { token: null },
    );
    expect(status).toBe(401);
  });

  it("handshake: initialize com Bearer → serverInfo flex-diet + protocolVersion; notifications/initialized aceita", async () => {
    const { status, json } = await postar({
      jsonrpc: "2.0",
      id: proximoId++,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "hermes-e2e", version: "0.0.0" },
      },
    });
    expect(status).toBe(200);
    expect(json?.result?.serverInfo?.name).toBe("flex-diet");
    versaoNegociada = json?.result?.protocolVersion;
    expect(versaoNegociada).toBeDefined();

    // Cliente real confirma o handshake com a notificação (sem id);
    // stateless por request não cria estado — 200/202 bastam.
    const notificado = await postar({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect([200, 202]).toContain(notificado.status);
  });

  it("tools/list pós-handshake lista EXATAMENTE as 8 tools da fase, nome a nome", async () => {
    const { status, json } = await postar({
      jsonrpc: "2.0",
      id: proximoId++,
      method: "tools/list",
    });
    expect(status).toBe(200);
    const nomes = (json?.result?.tools ?? []).map((t) => t.name);
    // nome a nome: as 8 existem…
    for (const esperada of AS_8_TOOLS) {
      expect(nomes).toContain(esperada);
    }
    // …e nada além delas
    expect(nomes).toHaveLength(8);
  });

  it("tools/call definir_metas com os 4 valores (D-10) → metas + saldo 'ok' na mesma resposta", async () => {
    const { status, json } = await chamarTool("definir_metas", {
      kcal: 2000,
      proteina_g: 150,
      carbo_g: 200,
      gordura_g: 70,
    });
    expect(status).toBe(200);
    expect(json?.error).toBeUndefined();
    const conteudo = json?.result?.structuredContent as {
      metas: { kcal: number };
      saldo: { status: string };
    };
    expect(conteudo.metas.kcal).toBe(2000);
    expect(conteudo.saldo.status).toBe("ok");
  });

  it("tools/call registrar_refeicao 120g banana maçã → eco (nome+gramas+fonte) + saldo 'ok'", async () => {
    const { status, json } = await chamarTool("registrar_refeicao", {
      itens: [{ alimento_id: idBanana, gramas: 120 }],
    });
    expect(status).toBe(200);
    expect(json?.error).toBeUndefined();
    const conteudo = json?.result?.structuredContent as {
      registro: {
        id_curto: string;
        data_local: string;
        itens: { nome: string; gramas: number; fonte: string }[];
      };
      saldo: { status: string; consumido: { kcal: number } };
      duplicado: boolean;
    };

    const item = conteudo.registro.itens[0];
    expect(item.nome).toBe("Banana, maçã, crua");
    expect(item.gramas).toBe(120);
    expect(item.fonte).toBe("taco");
    expect(conteudo.registro.id_curto).toMatch(/^[0-9a-f]{4}$/);
    expect(conteudo.duplicado).toBe(false);
    expect(conteudo.saldo.status).toBe("ok");
    // 120g × 86,805 kcal/100g ≈ 104,17 — débito visível pelo cliente
    expect(conteudo.saldo.consumido.kcal).toBeCloseTo(104.166, 0);

    idCurtoOriginal = conteudo.registro.id_curto;
    diaDoRegistro = conteudo.registro.data_local;
  });

  it("reenvio idêntico da tools/call → duplicado: true, mesmo id_curto e NENHUM segundo registro", async () => {
    const reenvio = await chamarTool("registrar_refeicao", {
      itens: [{ alimento_id: idBanana, gramas: 120 }],
    });
    expect(reenvio.status).toBe(200);
    const conteudo = reenvio.json?.result?.structuredContent as {
      registro: { id_curto: string };
      saldo: { consumido: { kcal: number } };
      duplicado: boolean;
    };
    expect(conteudo.duplicado).toBe(true);
    expect(conteudo.registro.id_curto).toBe(idCurtoOriginal);
    // débito não dobrado: consumido continua ≈ 104,17
    expect(conteudo.saldo.consumido.kcal).toBeCloseTo(104.166, 0);

    // e nenhum segundo registro no dia (visível por listar_registros, D-06)
    const listagem = await chamarTool("listar_registros", {
      data: diaDoRegistro,
    });
    const lista = listagem.json?.result?.structuredContent as {
      data_local: string;
      registros: { id_curto: string }[];
    };
    expect(lista.data_local).toBe(diaDoRegistro);
    expect(lista.registros).toHaveLength(1);
    expect(lista.registros[0].id_curto).toBe(idCurtoOriginal);
  });
});
