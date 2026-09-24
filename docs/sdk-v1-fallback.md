# Fallback SDK v1 — `@modelcontextprotocol/sdk` 1.30.1

> Contingência do INFRA-01 (critério 5 do ROADMAP): o que fazer SE — e somente se —
> o Hermes negociar, no 1º contato, uma era de protocolo anterior à suportada pelo
> SDK v2 (`@modelcontextprotocol/server` 2.1.0, spec 2026-07-28) que o servidor usa hoje.

**Status atual: NÃO acionado.** O servidor roda em v2; este doc existe para que a
troca, se necessária, seja mecânica e completa (mitiga T-01-20: fallback parcial —
server v2 com doc v1 — é o modo errado de aplicar este plano).

## 1. QUANDO acionar

Acionar **apenas** se o checkpoint do 1º contato com o Hermes (Task 3 do plan 01-05)
observar algum destes sintomas, com o Hermes corretamente configurado (URL + Bearer):

- o `initialize` do Hermes falha por incompatibilidade de `protocolVersion` (o SDK v2
  rejeita eras antigas e a negociação não converge);
- o Hermes conecta mas `tools/list`/`tools/call` falham por diferença de era do protocolo.

**Não acionar preventivamente.** 401 = problema de token (config do Hermes); 403 =
problema de `allowedHosts`/`PUBLIC_HOST` — nenhum dos dois é motivo para trocar de SDK.
A v1 (1.30.1) recebe correções por ≥ 6 meses após a v2 e `McpServer.registerTool`
existe nela — as tools quase não mudam (verificado no RESEARCH da fase, 2026-09-23).

## 2. COMO acionar (troca completa, sem estado intermediário)

1. **Pinar a v1** (versão exata, sem `^`):
   ```sh
   npm uninstall @modelcontextprotocol/server @modelcontextprotocol/express @modelcontextprotocol/node
   npm install @modelcontextprotocol/sdk@1.30.1
   ```
   A v1 é um pacote único — os três pacotes v2 (`/server`, `/express`, `/node`) saem
   junto. Commitar `package.json` + `package-lock.json` na mesma mudança.

2. **Trocar os imports do servidor** (`src/mcp/server.ts` e tools):
   - `McpServer` e `registerTool` passam a vir de `@modelcontextprotocol/sdk/server/mcp.js`;
   - manter o `inputSchema` zod de cada tool **exatamente igual** — a v1 aceita
     zod `^3.25 || ^4.0` (Standard Schema), os schemas atuais em `zod/v4` não mudam.

3. **Trocar o transporte HTTP** (`src/server.ts`): na v1 não existe
   `createMcpHandler`/`createMcpExpressApp`/`requireBearerAuth` — usar
   `StreamableHTTPServerTransport` (`@modelcontextprotocol/sdk/server/streamableHttp.js`)
   montado no Express existente, e **reimplementar o middleware Bearer** com
   `crypto.timingSafeEqual` contra `MCP_TOKEN` (o padrão dos exemplos oficiais v1;
   401 sem token tem que continuar passando em `tests/http.test.ts` e
   `tests/client-e2e.test.ts`).

4. **Checklist de troca completa** (nada de servidor v2 com doc v1 — T-01-20):
   - [ ] `grep -r "@modelcontextprotocol/server\|@modelcontextprotocol/express\|@modelcontextprotocol/node" src/` → zero resultados
   - [ ] `npm ls @modelcontextprotocol/sdk` → `1.30.1` exato, sem duplicados
   - [ ] `npx vitest run` → suíte completa verde (74+ testes, incluindo o cliente e2e)
   - [ ] `npm run check` → limpo (tsc + biome)
   - [ ] Deploy na VPS (merge na `main`) e **revalidar as 3 perguntas do WhatsApp do checkpoint** (registro → eco+saldo; metas → saldo recalcula; reenvio → "já registrado") antes de declarar pronto

## 3. O QUE NÃO MUDA (invariantes)

- **Nomes e shape das 8 tools**: `registrar_refeicao`, `consultar_saldo`,
  `buscar_alimento`, `listar_registros`, `editar_registro`, `remover_registro`,
  `repetir_refeicao`, `definir_metas` — contrato publicado com o Hermes (D-03..D-06).
- **JSON estruturado** nas respostas (`structuredContent`), sem texto pronto (D-05).
- **Dedupe** por hash canônico + janela de 10 min com `duplicado: true` (D-07/D-08, REG-06).
- **Saldo único** derivado em leitura em `src/domain/saldo.ts` (INFRA-03) — nada do
  `src/domain/` muda; a troca é só das bordas MCP (SDK + transporte).
- **Migrations, seed e backup** (`PRAGMA user_version`, `db.backup()`, retenção 7) — intocados.

## 4. Checklist de reversão (v1 → v2) quando o Hermes atualizar

1. Confirmar na release do Hermes que a era negociada passou a ser suportada pela v2
   (repetir o 1º contato: `initialize` convergente + as 3 perguntas do WhatsApp).
2. `npm uninstall @modelcontextprotocol/sdk && npm install @modelcontextprotocol/server @modelcontextprotocol/express @modelcontextprotocol/node`
3. Restaurar os imports v2 (histórico do git: `src/server.ts` + `src/mcp/` pré-fallback).
4. Re-executar o checklist da seção 2 passo 4 (grep v1 zero, suíte verde, deploy, 3 perguntas).
5. Registrar a reversão na seção abaixo (nova linha de resultado).

## Era negociada pelo Hermes

Esta seção registra o resultado do 1º contato real (checkpoint da Task 3 do plan 01-05).
**A linha de resultado abaixo ainda NÃO existe de propósito** — ela é adicionada
EXCLUSIVAMENTE no checkpoint, no formato:

- `Era observada: v2 confirmada em YYYY-MM-DD` — o Hermes negociou a era suportada
  pelo SDK v2; fallback não acionado; ou
- `Era observada: fallback v1 aplicado em YYYY-MM-DD` — seguida da decisão e do passo
  de fallback executado (seção 2) e da revalidação das 3 perguntas do WhatsApp.

Campos que o checkpoint deve registrar aqui: **data**, **era observada** no `initialize`,
**decisão** (v2 mantido ou fallback aplicado) e, se fallback, o commit da troca.
