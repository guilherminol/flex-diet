---
phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com
plan: 05
subsystem: testing
tags: [mcp, e2e, json-rpc, streamable-http, bearer-auth, idempotencia, sdk-v1-fallback, vitest]

# Dependency graph
requires:
  - phase: 01-03
    provides: 8 tools MCP da fase (registrar/saldo/catalogo/registros/metas) com dedupe e idempotência
  - phase: 01-04
    provides: serviço no ar na VPS (177.7.44.211:8787, /mcp com Bearer, PUBLIC_HOST no allowedHosts)
provides:
  - Cliente MCP real (JSON-RPC completo: initialize → notifications/initialized → tools/list → tools/call) sobre HTTP + Bearer contra o servidor em porta efêmera — prova o transporte (INFRA-01) sem depender do Hermes
  - Comportamento de sessão OBSERVADO do SDK v2 (dado para o checkpoint): nenhum mcp-session-id emitido (stateless por request confirmado); protocolVersion 2025-06-18 negociada no initialize; notifications/initialized responde 202 SEM corpo
  - docs/sdk-v1-fallback.md — condição de acionamento, pinning @modelcontextprotocol/sdk 1.30.1, troca completa anti T-01-20, invariantes preservados, checklist de reversão e seção "Era negociada pelo Hermes" SEM linha de resultado (só o checkpoint a adiciona)
affects: []

# Actuals (#2632) — emparelha com o `estimate` do plan (32000 tokens, 3 tasks)
actuals:
  tokens: 3714      # chars/4 sobre o diff realizado (14857 chars, 2 arquivos)
  tasks: 2          # Tasks 1-2 executadas e commitadas; Task 3 é checkpoint humano pendente
  commits: 2        # MEASURED: git rev-list --count 1f37e10..HEAD na escrita deste SUMMARY

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cliente MCP de teste fala JSON-RPC cru sobre fetch com Bearer + Accept application/json, text/event-stream — ecoa mcp-session-id se o servidor emitir (nenhum emitido em modo stateless)"
    - "Notificações JSON-RPC (sem id) voltam 202 com corpo VAZIO — parsing do cliente tolera corpo vazio"

key-files:
  created:
    - "tests/client-e2e.test.ts (6 testes: 401 sem token, handshake initialize+initialized, 8 tools nome a nome, definir_metas 4 valores, registrar 120g banana com eco+saldo, reenvio duplicado:true sem 2º registro)"
    - "docs/sdk-v1-fallback.md (fallback v1 1.30.1: quando/como/o que não muda/reversão + seção da era do Hermes)"
  modified: []

key-decisions:
  - "Pinning do fallback v1 = @modelcontextprotocol/sdk 1.30.1 — valor do PLAN e do RESEARCH (npm view 2026-09-23, 40M downloads/sem, fixes ≥6 meses pós-v2); a menção a '1.20.1' na instrução do orchestrator divergia e foi desconsiderada em favor do plan (o verify do plan grep'a 1.30.1)"
  - "Cliente e2e envia notifications/initialized após o handshake (cliente real) e tolera resposta sem corpo — comportamento observado do SDK, não presumido"
  - "Doc de fallback segue o PLAN: seção 'Era negociada pelo Hermes' nasce SEM linha de resultado; a linha 'Era observada: …' é adicionada EXCLUSIVAMENTE no checkpoint da Task 3"

patterns-established:
  - "Teste e2e de transporte: startServer({ port: 0 }) + fetch autenticado — mesmo padrão do http.test.ts, mas com handshake MCP completo e estado de cliente (ids incrementais, sessão ecoada)"
  - "Contingência de SDK: doc com condição de acionamento + checklist de troca COMPLETA (grep zero do pacote velho) + revalidação do canal real antes de declarar pronto (T-01-20)"

requirements-completed: []  # INFRA-01 permanece ABERTO de propósito: a metade "consumido pelo Hermes por URL" fecha só no checkpoint da Task 3

coverage:
  - id: D1
    description: "Cliente MCP real prova o transporte Streamable HTTP + Bearer ponta a ponta: initialize → notifications/initialized → tools/list (8 tools nome a nome) → tools/call definir_metas (4 valores) + registrar_refeicao (120g banana maçã → eco + saldo ok) → reenvio idêntico com duplicado:true, mesmo id_curto e nenhum segundo registro; 401 sem token (INFRA-01)"
    requirement: INFRA-01
    verification:
      - kind: integration
        ref: "tests/client-e2e.test.ts#handshake: initialize com Bearer → serverInfo flex-diet + protocolVersion; notifications/initialized aceita"
        status: pass
      - kind: integration
        ref: "tests/client-e2e.test.ts#tools/list pós-handshake lista EXATAMENTE as 8 tools da fase, nome a nome"
        status: pass
      - kind: integration
        ref: "tests/client-e2e.test.ts#tools/call registrar_refeicao 120g banana maçã → eco (nome+gramas+fonte) + saldo 'ok'"
        status: pass
      - kind: integration
        ref: "tests/client-e2e.test.ts#reenvio idêntico da tools/call → duplicado: true, mesmo id_curto e NENHUM segundo registro"
        status: pass
      - kind: integration
        ref: "tests/client-e2e.test.ts#initialize sem Bearer → 401 (endpoint nunca anônimo, T-01-18)"
        status: pass
      - kind: integration
        ref: "npx vitest run → 10 arquivos, 74/74 testes (suíte completa verde); npm run check → tsc + biome limpos"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fallback SDK v1 documentado (critério 5 do ROADMAP): docs/sdk-v1-fallback.md com condição de acionamento, pinning @modelcontextprotocol/sdk 1.30.1, troca completa de pacote, invariantes preservados (tools/saldo/dedupe/migrations), checklist de reversão e lugar reservado para a era do Hermes — sem prometer o que o RESEARCH não verificou"
    requirement: INFRA-01
    verification:
      - kind: other
        ref: "test -f docs/sdk-v1-fallback.md && grep -c '1.30.1' docs/sdk-v1-fallback.md → 4 (verify do plan, exit 0)"
        status: pass
      - kind: other
        ref: "grep 'Era observada: ' docs/sdk-v1-fallback.md → NENHUMA linha (correto: a linha de resultado só pode nascer no checkpoint — designed-pending)"
        status: pass
    human_judgment: false
  - id: D3
    description: "1º contato real com o Hermes: config URL+Bearer no cliente, 3 perguntas do WhatsApp (registro → eco+saldo; metas → recalcula; reenvio → 'já registrado') e ERA do protocolo registrada em docs/sdk-v1-fallback.md — fecha o INFRA-01"
    requirement: INFRA-01
    verification: []
    human_judgment: true
    rationale: "Requer o Hermes real da pessoa (fora do repo) + WhatsApp + MCP_TOKEN da VPS — inerentemente não automatizável; checkpoint gate=blocking-human pendente. Executor NÃO fabrica resultado."

# Metrics
duration: 9min
completed: 2026-09-24
status: halted  # Task 3 (checkpoint:human-verify gate=blocking-human) pendente — 1º contato com o Hermes; retomar pelo checkpoint estruturado retornado pelo executor
---

# Phase 1 Plan 5: Cliente MCP e2e + fallback SDK v1 Summary

**Cliente MCP real sobre HTTP+Bearer prova as 8 tools e a idempotência ponta a ponta (stateless confirmado, protocolVersion 2025-06-18 negociada); fallback SDK v1 1.30.1 documentado com lugar reservado para a era do Hermes — o 1º contato real aguarda o checkpoint humano**

## Performance

- **Duration:** 9 min
- **Started:** 2026-09-24T22:23:42Z
- **Completed:** 2026-09-24T22:32Z (Tasks 1-2; Task 3 pendente no checkpoint)
- **Tasks:** 2 de 3 (Task 3 = checkpoint:human-verify gate="blocking-human", pendente)
- **Files modified:** 2 criados, 0 modificados

## Accomplishments

- **Transporte provado sem depender do Hermes (INFRA-01):** `tests/client-e2e.test.ts` executa o handshake JSON-RPC completo sobre HTTP puro com fetch — `initialize` (serverInfo `flex-diet`, protocolVersion **2025-06-18** negociada) → `notifications/initialized` → `tools/list` (EXATAMENTE as 8 tools, nome a nome) → `tools/call` (`definir_metas` com os 4 valores → saldo `ok`; `registrar_refeicao` 120g banana maçã → eco nome+gramas+fonte+saldo) → reenvio idêntico → `duplicado: true`, mesmo `id_curto`, **nenhum segundo registro** (idempotência visível POR CLIENTE, não só por domínio); `initialize` sem Bearer → 401
- **Comportamento de sessão observado (dado para o checkpoint):** o SDK v2 em modo stateless **não emite** `mcp-session-id` (nada a ecoar — sessão por conexão inexistente, como esperado do Pattern 1); `notifications/initialized` responde **202 com corpo vazio** — um cliente real precisa tolerar corpo vazio (capturado no afterAll do teste e registrado aqui para o checklist do Hermes)
- **Fallback SDK v1 documentado (critério 5 do ROADMAP):** `docs/sdk-v1-fallback.md` com condição de acionamento (só se o Hermes negociar era anterior à v2 — 401/403 NÃO são motivo), pinning `@modelcontextprotocol/sdk` **1.30.1**, troca completa de pacote com checklist anti T-01-20 (grep zero do pacote velho + suíte verde + revalidação das 3 perguntas do WhatsApp), invariantes preservados (shape das 8 tools, D-05, D-07, INFRA-03, migrations) e checklist de reversão v1→v2
- **Precondition do checkpoint verificada por máquina (leitura apenas):** VPS no ar — `GET http://177.7.44.211:8787/healthz` → 200 `{"ok":true}`; `POST /mcp` sem token → 401 (2026-09-24T22:30Z)
- Suíte completa **74/74 verde**; `npm run check` (tsc + biome) limpo

## Task Commits

1. **Task 1: Cliente MCP end-to-end automatizado** - `f288c30` (feat)
2. **Task 2: Fallback SDK v1 documentado** - `ec2b360` (docs)

**Task 3 (checkpoint):** PENDENTE — gate="blocking-human", não executável por máquina (ver "Checkpoint Pendente" abaixo).

## Checkpoint Pendente — Task 3: 1º contato com o Hermes

**Precondition (verificada):** serviço no ar (healthz 200, /mcp 401 de fora). Falta o fator humano: **MCP_TOKEN da VPS disponível com a pessoa** e o Hermes configurado por ela.

**Checklist exato de configuração do Hermes (a fazer na config do cliente, fora do repo):**
1. URL do servidor MCP: `http://177.7.44.211:8787/mcp`
2. Header `Authorization: Bearer <MCP_TOKEN>` (o token real do `compose.env` na VPS — NUNCA colar em arquivo versionado, T-01-19)
3. Header `Accept: application/json, text/event-stream`

**Se o Hermes expor logs, procurar:** a `protocolVersion` negociada no `initialize` (era do protocolo); `401` = token errado; `403` = `allowedHosts`/`PUBLIC_HOST` errado (o Host que o Hermes manda precisa constar no `PUBLIC_HOST` do compose.env).

**As 4 perguntas do checkpoint (responder "aprovado" com o item 4):**
1. Mensagem real no WhatsApp ("comi 120g de banana maçã") → resposta traz item + gramas + fonte + saldo do dia?
2. "meta 1800kcal 150p 180c 60g" (o Hermes coleta os 4 valores, D-10) → saldo recalcula?
3. Reenviar a mesma mensagem → o Hermes comunica "já registrado" e nada duplica?
4. **Que ERA de protocolo o Hermes negociou** (v2 confirmada ou fallback v1 acionado)? Se fallback: aplicar `docs/sdk-v1-fallback.md` e revalidar 1-3.

**Pós-checkpoint (executor da continuação):** adicionar a linha `Era observada: …` em docs/sdk-v1-fallback.md; registrar no SUMMARY o resultado das 3 perguntas e a **decisão de TLS** (se a VPS tem reverse proxy com TLS → HTTPS; senão HTTP + token + firewall permanece o MVP aceito, risco T-01-15 anotado).

**Decisão em aberto herdada do 01-04 (surface neste checkpoint):** healthcheck do compose marca o container `(unhealthy)` — serviço 100% funcional (WINDOWS.md #1); fix de 1 linha a escolher pelo humano: (a) `allowedHosts` incluir loopback em `src/server.ts`, ou (b) healthcheck do compose usar `node:http` com `Host: $PUBLIC_HOST` (provado 200).

## Files Created/Modified

- `tests/client-e2e.test.ts` - cliente JSON-RPC completo sobre fetch com Bearer; 6 testes; log do comportamento de sessão no afterAll
- `docs/sdk-v1-fallback.md` - plano de contingência v1 + seção "Era negociada pelo Hermes" (sem linha de resultado por design)

## Decisions Made

- Pinning do fallback v1 = **1.30.1** (PLAN + RESEARCH, npm-verified). A instrução do orchestrator citava "1.20.1" — divergência desconsiderada em favor do plan, cujo verify (`grep -c "1.30.1"`) é a autoridade executável
- Cliente e2e tolera resposta sem corpo nas notificações — comportamento real do SDK observado no primeiro run, não exceção inventada
- Doc de fallback nasce com a seção da era VAZIA de propósito; preenchê-la fora do checkpoint quebraria o critério de aceitação da Task 3

## Deviations from Plan

None — plan executado exatamente como escrito (Tasks 1-2). Task 3 parada no checkpoint conforme desenhado.

## Issues Encountered

- Primeiro run do e2e falhou no parsing da resposta de `notifications/initialized` (corpo vazio, `Unexpected end of JSON input`) — não é bug do servidor: é o comportamento stateless correto do SDK (notificações não ganham resposta JSON-RPC). Cliente corrigido para tolerar corpo vazio antes do commit
- Healthcheck do compose `(unhealthy)` é defeito PRÉ-EXISTENTE do 01-04 (fora do escopo deste plan — regra de escopo), já registrado no WINDOWS.md #1; decisão do fix surfaceada no checkpoint acima

## Known Stubs

None — nenhum stub criado.

## User Setup Required

Pendente por desenho do plan: configurar o Hermes (URL + Bearer + Accept, checklist acima) — é o próprio checkpoint da Task 3. Nenhuma env var nova neste repo.

## Next Phase Readiness

- INFRA-01 segue ABERTO de propósito até o checkpoint: a metade máquina está provada (cliente e2e + 8 tools + idempotência); a metade humana (Hermes → WhatsApp → era do SDK) é a única coisa entre a fase 01 e o fechamento
- Com o checkpoint resolvido: fechar INFRA-01 (requirements), atualizar ROADMAP (critério 5) e a fase 01 fica completa para `/gsd:verify-work`

---
*Phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com*
*Completed: 2026-09-24 (Tasks 1-2; halted no checkpoint da Task 3)*

## Self-Check: PASSED

- `tests/client-e2e.test.ts` e `docs/sdk-v1-fallback.md` presentes no disco
- Commits verificados no histórico: `f288c30` (Task 1), `ec2b360` (Task 2)
- `commits: 2` medido via `git rev-list --count 1f37e10..HEAD` (ledger gsd-plan-head-before-01-05)
- Verifies da Task 1 re-executados: vitest 74/74, npm run check limpo; verifies da Task 2: grep 1.30.1 → 4
