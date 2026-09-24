#!/usr/bin/env node
// Check versionado do contrato de deploy — replica localmente o que
// .github/workflows/deploy.yml executa na VPS (deploy.yml:37: compose na raiz)
// e as salvaguardas de privacidade do threat model (T-01-13: data/ e
// compose.env fora do git). Node puro, sem dependências.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");

const temCompose =
  existsSync(join(raiz, "docker-compose.yml")) ||
  existsSync(join(raiz, "compose.yaml"));

/** git check-ignore -q <caminho> — exit 0 = ignorado. */
const ignorado = (caminho) => {
  try {
    execFileSync("git", ["check-ignore", "-q", caminho], {
      cwd: raiz,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
};

const falhas = [];
if (!temCompose) {
  falhas.push(
    "docker-compose.yml (ou compose.yaml) ausente na RAIZ do repo — o deploy.yml não acha o compose na VPS e pula o deploy",
  );
}
if (!existsSync(join(raiz, "Dockerfile"))) {
  falhas.push(
    "Dockerfile ausente na raiz — o 'docker compose up -d --build' da VPS falharia",
  );
}
if (!existsSync(join(raiz, "compose.env.example"))) {
  falhas.push(
    "compose.env.example ausente — modelo de MCP_TOKEN/PORT/PUBLIC_HOST não versionado",
  );
}
if (!ignorado("data")) {
  falhas.push(
    ".gitignore não cobre data/ — dados de saúde (flexdiet.db) podem entrar no git (T-01-13)",
  );
}
if (!ignorado("compose.env")) {
  falhas.push(
    ".gitignore não cobre compose.env — segredo de deploy pode entrar no git (T-01-13)",
  );
}

if (falhas.length > 0) {
  console.error("contrato de deploy QUEBRADO:");
  for (const falha of falhas) {
    console.error(`  - ${falha}`);
  }
  process.exit(1);
}
console.error("contrato de deploy ok");
