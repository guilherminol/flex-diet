import { timingSafeEqual } from "node:crypto";
import type { Server } from "node:http";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createMcpExpressApp,
  requireBearerAuth,
} from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import type {
  AuthInfo,
  OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import {
  createMcpHandler,
  OAuthError,
  OAuthErrorCode,
} from "@modelcontextprotocol/server";
import type { NextFunction, Request, Response } from "express";
import { agendarBackupDiario } from "./db/backup.js";
import { connectDb, setDb } from "./db/connect.js";
import { runMigrations } from "./db/migrate.js";
import { runSeed } from "./db/seed/seed.js";
import { buildServer } from "./mcp/server.js";

/** Comparação em tempo constante (ASVS V2) — segura p/ tamanhos diferentes. */
const tokensIguais = (a: string, b: string): boolean => {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

/** Verifier de token estático do env — sem OAuth server (padrão bearer-auth do SDK). */
export const verifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const esperado = process.env.MCP_TOKEN ?? "";
    if (esperado === "" || !tokensIguais(token, esperado)) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, "token inválido");
    }
    return {
      token,
      clientId: "hermes",
      scopes: ["mcp"],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  },
};

/** Log em stderr: só método/path/status — NUNCA headers (T-01-03). */
const logRequisicao = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  res.on("finish", () => {
    console.error(`[http] ${req.method} ${req.path} ${res.statusCode}`);
  });
  next();
};

/** Express app com /mcp (Bearer + handler stateless) e /healthz (sem auth). */
export function criarApp() {
  const handler = createMcpHandler(buildServer); // factory POR request
  const nodeHandler = toNodeHandler(handler);
  const auth = requireBearerAuth({ verifier, requiredScopes: ["mcp"] });

  const app = createMcpExpressApp({
    host: "0.0.0.0",
    allowedHosts: process.env.PUBLIC_HOST
      ? [process.env.PUBLIC_HOST]
      : undefined,
  });

  app.use(logRequisicao);
  app.all("/mcp", auth, (req, res) => {
    // req.body como 3º argumento é OBRIGATÓRIO: express.json já consumiu o stream
    void nodeHandler(req, res, req.body);
  });
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

export interface StartServerOptions {
  port?: number;
  dbPath?: string;
  dirBackups?: string;
  /** Pula o seed (usado em testes de boot). */
  skipSeed?: boolean;
}

/**
 * Boot completo do processo: conexão → migrations (backup pré-migration) →
 * seed idempotente → listen. Retorna o server p/ testes (porta 0).
 */
export async function startServer(
  opcoes: StartServerOptions = {},
): Promise<Server> {
  const db = connectDb(opcoes.dbPath);
  setDb(db);
  const { aplicadas, versaoAtual } = await runMigrations(db, opcoes.dirBackups);
  console.error(
    `[boot] migrations: ${aplicadas} aplicadas (user_version=${versaoAtual})`,
  );
  if (!opcoes.skipSeed) {
    runSeed(db);
  }

  // D-02: backup diário com retenção 7 — diretorio ao lado do banco
  // (data/backups por padrão). Erro do backup NÃO derruba o serviço:
  // agendarBackupDiario loga em stderr e segue.
  const caminhoDb = resolve(
    opcoes.dbPath ?? process.env.FLEXDIET_DB_PATH ?? "data/flexdiet.db",
  );
  agendarBackupDiario(
    db,
    opcoes.dirBackups ?? join(dirname(caminhoDb), "backups"),
  );

  const app = criarApp();
  const port = opcoes.port ?? Number(process.env.PORT ?? 8787);
  return app.listen(port, () => {
    console.error(`[flex-diet] ouvindo em 0.0.0.0:${port}`);
  });
}

/* Executa o servidor apenas quando rodado direto (não em import/teste). */
const executadoDireto =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executadoDireto) {
  startServer().catch((erro) => {
    console.error("[flex-diet] falha no boot:", erro);
    process.exit(1);
  });
}
