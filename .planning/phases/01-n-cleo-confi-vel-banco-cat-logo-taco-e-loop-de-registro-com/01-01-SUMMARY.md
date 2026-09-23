---
phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com
plan: 01
subsystem: api
tags: [mcp, typescript, sqlite, better-sqlite3, taco, express, zod, vitest]

# Dependency graph
requires:
  - phase: init
    provides: repositório git com .github/workflows/deploy.yml (contrato de deploy contínuo)
provides:
  - Servidor MCP Streamable HTTP (SDK v2 @modelcontextprotocol/server + express) com Bearer token estático (timingSafeEqual) e /healthz sem auth
  - SQLite em WAL com runner de migrations por PRAGMA user_version + backup db.backup() pré-migration idempotente
  - Catálogo TACO semeado (597 alimentos) com seed idempotente, sanity in-code da banana maçã e teste de sanidade (não-kJ)
  - Loop "registrei → saldo" end-to-end: registrar_refeicao transacional com snapshot de macros, eco + id_curto + saldo na mesma resposta
  - consultar_saldo com meta_nao_definida + instrução (D-09) e definir_metas exigindo os 4 valores (D-10)
  - Datas duplas timestamp_utc + data_local America/Sao_Paulo com registro retroativo (REG-05)
  - Padrões estruturais para as fases 2–5 (domain/ puro, mcp/tools wrappers finos, erro estruturado isError, transação síncrona, prepared statements)
affects: [01-02, 01-03, 01-04, 01-05, phase-02, phase-05]

# Actuals (#2632) — emparelha com o `estimate` do plan (58000 tokens, 2 tasks)
actuals:
  tokens: 97518    # chars/4 sobre o diff realizado (390071 chars; inclui package-lock.json e taco_composicao.csv vendado)
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 1ddc400174ff8498180dcc1535f82211cee2a28b

# Tech tracking
tech-stack:
  added:
    - "@modelcontextprotocol/server ^2.1.0 (SDK MCP v2, spec 2026-07-28)"
    - "@modelcontextprotocol/express ^2.0.1 (createMcpExpressApp, requireBearerAuth)"
    - "@modelcontextprotocol/node ^2.1.0 (toNodeHandler)"
    - "express ^5.2.1"
    - "zod ^4.6.5 (zod/v4, Standard Schema)"
    - "better-sqlite3 ^13.0.3"
    - "dayjs ^1.11.23 (plugins utc+timezone)"
    - "csv-parse ^7.0.2"
    - "typescript ^5.9.3, tsx ^4.23.15, vitest ^5.0.1, @biomejs/biome ^2.5.14"
  patterns:
    - "MCP stateless por request: createMcpHandler(factory) — estado 100% no SQLite"
    - "Transações síncronas better-sqlite3 (zero await no closure) para toda escrita"
    - "Datas duplas: timestamp_utc ISO (fonte da verdade) + data_local SP calculada uma vez na escrita"
    - "Snapshot de macros no refeicao_item no momento do registro (COALESCE NULL→0)"
    - "Saldo derivado em leitura por ÚNICA implementação (domain/saldo.ts); nunca armazenado"
    - "Erros de domínio como resultado estruturado (isError + código + texto acionável), nunca exceção crua"
    - "Runner de migrations: PRAGMA user_version + await db.backup() FORA de transação"
    - "Seed idempotente por upsert (fonte, numero_taco) com sanity in-code"
    - "Log de processo só método/path/status em stderr (nunca headers)"

key-files:
  created:
    - ".gitignore (data/, compose.env, *.db — ANTES do 1º commit)"
    - "package.json / tsconfig.json / vitest.config.ts / biome.json"
    - "src/server.ts (entrypoint: /mcp Bearer + /healthz + startServer p/ testes)"
    - "src/mcp/server.ts (factory buildServer) + src/mcp/tools/{registrar,saldo,metas}.ts"
    - "src/domain/{refeicoes,saldo,metas}.ts"
    - "src/db/{connect,migrate}.ts + src/db/migrations/001_init.sql"
    - "src/db/seed/seed.ts + src/db/seed/taco_composicao.csv (vendado de brolesi/taco v1.7.0)"
    - "src/lib/datas.ts"
    - "tests/{datas,migrations,seed,http,metas}.test.ts"
  modified:
    - "src/domain/saldo.ts (obterMetasVigentes extraída p/ metas.ts — Task 2)"
    - "src/mcp/server.ts (registra definir_metas — Task 2)"

key-decisions:
  - "SDK MCP v2 confirmado no momento do install: npm view = 2.1.0 + README oficial do typescript-sdk lista os 3 pacotes v2 (gate de legitimidade T-01-SC); sem fallback v1"
  - "obterMetasVigentes extraída para domain/metas.ts; saldo.ts consome — uma única regra de vigência no codebase (exigência do Task 2)"
  - "Conexão SQLite exposta às tools via holder de processo (setDb/getDb em db/connect.ts) — a factory stateless do MCP não carrega argumentos"
  - "Registro retroativo da banana no teste http usa data '2026-09-20' para provar REG-05 e isolar o débito do arroz (~195,18 kcal) no dia corrente"

patterns-established:
  - "Tool MCP: wrapper fino com zod/v4 inputSchema + resposta { content JSON, structuredContent } (D-05)"
  - "Erro de domínio: classe ErroDominio com código estruturado → isError:true com corpo { erro, mensagem, ...extras }"
  - "Boot idempotente: startServer roda runMigrations → runSeed → listen; startServer({ port: 0 }) para testes"
  - "Testes com db em tmpdir via connectDb(path) explícito; suíte 31/31 em <5s"

requirements-completed: [INFRA-01, INFRA-02, INFRA-03, INFRA-04, ALIM-01, REG-01, REG-02, REG-05, META-01]

coverage:
  - id: D1
    description: "Servidor MCP em Streamable HTTP: 401 sem/com token inválido; initialize responde serverInfo flex-diet; tools/list lista as tools (INFRA-01)"
    requirement: INFRA-01
    verification:
      - kind: integration
        ref: "tests/http.test.ts#POST /mcp sem Authorization responde 401"
        status: pass
      - kind: integration
        ref: "tests/http.test.ts#initialize responde serverInfo flex-diet"
        status: pass
      - kind: integration
        ref: "tests/http.test.ts#tools/list lista registrar_refeicao e consultar_saldo"
        status: pass
    human_judgment: false
  - id: D2
    description: "registrar_refeicao end-to-end pela rota /mcp debita macros do TACO e retorna eco (nome+gramas+fonte) + id_curto + saldo na MESMA resposta; 150g arroz tipo 2 ≈ 195,18 kcal (REG-01/REG-02)"
    requirement: REG-01
    verification:
      - kind: integration
        ref: "tests/http.test.ts#registrar 120g de banana maçã (retroativo) retorna eco + id_curto + saldo na mesma resposta"
        status: pass
      - kind: integration
        ref: "tests/http.test.ts#registrar 150g de arroz hoje e consultar_saldo → consumido.kcal ≈ 195,18 (±0,5)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SQLite em WAL; migrations versionadas avançam user_version com backup pré-migration em data/backups/; re-run é no-op (INFRA-02)"
    requirement: INFRA-02
    verification:
      - kind: unit
        ref: "tests/migrations.test.ts#user_version avança 0→1, backup pré-migration é criado e re-run é no-op"
        status: pass
      - kind: unit
        ref: "tests/migrations.test.ts#WAL está ativo na conexão (INFRA-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Datas duplas: 02:50 UTC cai no dia anterior SP, 03:10 no mesmo dia; retroativo grava na data_local informada (INFRA-03, REG-05)"
    requirement: INFRA-03
    verification:
      - kind: unit
        ref: "tests/datas.test.ts#02:50 UTC ainda é o dia anterior em America/Sao_Paulo"
        status: pass
      - kind: unit
        ref: "tests/datas.test.ts#data informada é usada como está (retroativo)"
        status: pass
      - kind: integration
        ref: "tests/http.test.ts#registrar 120g de banana maçã (retroativo) retorna eco + id_curto + saldo na mesma resposta"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dados de saúde fora do git: data/, compose.env e *.db ignorados desde o 1º commit (INFRA-04, T-01-05)"
    requirement: INFRA-04
    verification:
      - kind: other
        ref: "git check-ignore -v data/flexdiet.db && git check-ignore -v compose.env"
        status: pass
    human_judgment: false
  - id: D6
    description: "Seed TACO lê só energia_kcal com saneamento vazio→NULL / Tr→0; banana maçã 85–89 kcal, óleo 880–888, nada >950 exceto gordura ≥90 (ALIM-01)"
    requirement: ALIM-01
    verification:
      - kind: unit
        ref: "tests/seed.test.ts#banana maçã (178) fica entre 85 e 89 kcal/100g — nunca ~363 (kJ)"
        status: pass
      - kind: unit
        ref: "tests/seed.test.ts#óleo de soja (272) fica entre 880 e 888 kcal/100g"
        status: pass
      - kind: unit
        ref: "tests/seed.test.ts#nenhum alimento com kcal > 950 exceto gordura >= 90g/100g"
        status: pass
      - kind: unit
        ref: "tests/seed.test.ts#re-seed não duplica (contagem estável)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Saldo sem metas responde meta_nao_definida + instrução (D-09); definir_metas exige os 4 valores (D-10), grava vigência por data_inicio e o saldo recalcula na mesma resposta (META-01)"
    requirement: META-01
    verification:
      - kind: unit
        ref: "tests/metas.test.ts#schema rejeita chamada com apenas 3 valores"
        status: pass
      - kind: unit
        ref: "tests/metas.test.ts#sem metas, calcularSaldo retorna meta_nao_definida com instrução (D-09)"
        status: pass
      - kind: unit
        ref: "tests/metas.test.ts#registrar refeição APÓS definir metas → saldo ok e restante = meta − consumido"
        status: pass
      - kind: unit
        ref: "tests/metas.test.ts#nova definir_metas substitui a vigente (última data_inicio vence) e o próximo saldo usa os valores novos"
        status: pass
    human_judgment: false

# Metrics
duration: 42 min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 1: Walking Skeleton "registrei → saldo" Summary

**Servidor MCP HTTP (SDK v2) com 3 tools sobre SQLite WAL + catálogo TACO (597 alimentos) — registrar_refeicao devolve eco + id_curto + saldo na mesma resposta; suíte vitest 31/31 verde**

## Performance

- **Duration:** 42 min
- **Started:** 2026-09-23T22:03:48Z
- **Completed:** 2026-09-23T22:46:01Z
- **Tasks:** 2
- **Files modified:** 27 (25 criados, 2 modificados)

## Accomplishments

- Loop "registrei → saldo" provado de ponta a ponta sobre HTTP MCP autenticado: POST /mcp sem token → 401; com token → initialize (`serverInfo: flex-diet`), tools/list e tools/call com débito real do catálogo TACO (150g de arroz tipo 2 ≈ 195,18 kcal verificado em teste)
- Infra de dados verificável: better-sqlite3 em WAL (assert em teste), runner de migrations por `PRAGMA user_version` com `db.backup()` pré-migration fora de transação e no-op idempotente, seed TACO idempotente (597 alimentos, upsert por fonte+numero_taco, só `energia_kcal`, vazio→NULL, Tr→0) com sanity in-code da banana maçã (86,8 kcal — não kJ)
- Contratos de confiança nascidos e testados: eco item+gramas+fonte+macros, id_curto 4 hex com retry, datas duplas `timestamp_utc`+`data_local` (fronteira 02:50/03:10 UTC testada), `meta_nao_definida` com instrução (sem números inventados), `definir_metas` com os 4 valores obrigatórios rejeitando 3
- Gate de legitimidade de pacotes executado antes do install (T-01-SC): `npm view @modelcontextprotocol/server` = 2.1.0 + README oficial do typescript-sdk confirmando os 3 nomes v2
- Smoke manual executado e documentado: initialize + tools/list + healthz 200 + definir_metas (3 valores → rejeitado; 4 valores → metas gravadas e saldo `ok` na mesma resposta)

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Tracer "registrei → saldo" de ponta a ponta (HTTP MCP + SQLite WAL + seed TACO + datas duplas)** - `51acc96` (feat)
2. **Task 2: definir_metas com os 4 valores obrigatórios (D-10) fechando o ciclo do saldo (META-01)** - `e375f31` (feat)

**Plan metadata:** (commitado junto com este SUMMARY)

## Files Created/Modified

- `.gitignore` - data/, compose.env, *.db*, node_modules/, dist/ — criado ANTES do 1º commit de código
- `package.json` (deps exatas do RESEARCH) / `package-lock.json` / `tsconfig.json` / `vitest.config.ts` / `biome.json`
- `src/server.ts` - entrypoint: verifier timingSafeEqual, createMcpExpressApp host 0.0.0.0, /mcp com requireBearerAuth + req.body como 3º arg, /healthz, startServer exportado
- `src/mcp/server.ts` - factory buildServer (stateless por request) registrando as 3 tools
- `src/mcp/tools/registrar.ts` / `saldo.ts` / `metas.ts` - wrappers finos com zod/v4 e structuredContent
- `src/domain/refeicoes.ts` - registrarRefeicao transacional síncrona com snapshot de macros, gerarIdCurto com retry, ErroDominio/AlimentoNaoEncontradoError
- `src/domain/saldo.ts` - calcularSaldo (única agregação SUM por data_local; restante negativo sem clamp)
- `src/domain/metas.ts` - definirMetas (4 valores validados) + obterMetasVigentes (única regra de vigência)
- `src/db/connect.ts` - WAL + busy_timeout + foreign_keys, FLEXDIET_DB_PATH, holder setDb/getDb
- `src/db/migrate.ts` - runner user_version com backup pré-migration
- `src/db/migrations/001_init.sql` - alimento, medida_caseira, refeicao, refeicao_item, meta_diaria + índices
- `src/db/seed/seed.ts` + `src/db/seed/taco_composicao.csv` - seed idempotente com sanity in-code
- `src/lib/datas.ts` - agoraIsoUtc, dataLocalSp, hojeLocalSp, resolverDataLocal
- `tests/datas.test.ts` (7), `tests/migrations.test.ts` (2), `tests/seed.test.ts` (7), `tests/http.test.ts` (8), `tests/metas.test.ts` (7) - 31 testes

## Decisions Made

- SDK MCP v2 confirmado no install (gate de legitimidade): `npm view` = 2.1.0 e README oficial lista `@modelcontextprotocol/server|express|node` — segue v2, sem fallback v1
- `obterMetasVigentes` extraída para `domain/metas.ts` conforme o Task 2; `saldo.ts` importa dela — uma única regra de vigência
- Conexão SQLite exposta às tools via holder de processo (`setDb`/`getDb`) — a assinatura da `McpServerFactory` é fixa e o estado vive no processo/banco, nunca no request
- No teste http, o registro da banana usa `data: "2026-09-20"` (retroativo) — prova REG-05 e deixa o dia corrente só com o arroz para o assert de ~195,18 kcal

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Middleware de log sem `next()` pendurava toda requisição**
- **Found during:** Task 1 (tests/http.test.ts — todos os testes em timeout)
- **Issue:** `logRequisicao` registrava o listener `finish` mas nunca chamava `next()` — toda rota (incl. /healthz) ficava presa no middleware
- **Fix:** assinatura `(req, res, next)` com `next()` ao final
- **Files modified:** src/server.ts
- **Verification:** suíte completa verde + smoke initialize/tools/list/healthz 200
- **Committed in:** 51acc96

**2. [Rule 1 - Bug] Helper de teste http só enviava Authorization quando `opcoes.token` era passado**
- **Found during:** Task 1 (5 testes recebiam 401 em chamadas que deveriam autenticar)
- **Issue:** chamadas "autenticadas" iam sem header; só os testes de 401 passavam
- **Fix:** default `Bearer ${opcoes?.token ?? TOKEN}` com `{ token: null }` explícito para omitir o header
- **Files modified:** tests/http.test.ts
- **Verification:** 8/8 testes http verdes
- **Committed in:** 51acc96

**3. [Rule 1 - Bug] beforeAll dos testes de seed/metas não executavam runSeed**
- **Found during:** Tasks 1 e 2 (assertions sobre tabela `alimento` vazia; `kcalDe('178')` = null)
- **Issue:** migrations rodavam mas o catálogo não era semeado antes das assertions
- **Fix:** `runSeed(db)` no beforeAll de tests/seed.test.ts e tests/metas.test.ts
- **Files modified:** tests/seed.test.ts, tests/metas.test.ts
- **Verification:** 7/7 seed e 7/7 metas verdes
- **Committed in:** 51acc96 / e375f31

**4. [Rule 1 - Bug] Asserção de kcal da banana esquecia a divisão por 100**
- **Found during:** Task 1 (esperava 10416,6 em vez de 104,17)
- **Issue:** `toBeCloseTo(120 * 86.805, 0)` sem `/100`
- **Fix:** `toBeCloseTo((120 * 86.805) / 100, 0)`
- **Files modified:** tests/http.test.ts
- **Verification:** teste verde (104,166 kcal para 120g)
- **Committed in:** 51acc96

**5. [Rule 3 - Blocking] Imports de plugin dayjs e `dirname` quebravam o type-check**
- **Found during:** Task 1 (primeiro `tsc --noEmit`)
- **Issue:** `dayjs/plugin/utc` sem extensão não resolve sob NodeNext; `dirname` usado sem import em migrate.ts
- **Fix:** `dayjs/plugin/utc.js` e `dayjs/plugin/timezone.js`; import de `dirname` adicionado
- **Files modified:** src/lib/datas.ts, src/db/migrate.ts
- **Verification:** `tsc --noEmit` limpo
- **Committed in:** 51acc96

---

**Total deviations:** 5 auto-fixed (4 bugs Rule 1, 1 blocking Rule 3 — todos dentro do escopo das tasks, sem mudança de arquitetura)
**Impact on plan:** Nenhum escopo adicional — todas as correções foram necessárias para o tracer funcionar de verdade; bugs encontrados pela própria suíte antes de cada commit.

## Issues Encountered

- Investigaçăo do timeout em massa dos testes http exigiu ladder de isolamento (http.createServer puro → createMcpExpressApp → criarApp) para localizar o middleware sem `next()`; sem impacto no produto final (root cause no código da task, corrigido no mesmo commit)

## Smoke Manual (RESEARCH §Code Example 1)

Servidor local via `startServer({ port: 0 })` com token de teste:
- `initialize` → 200, `{"name":"flex-diet","version":"0.1.0"}`
- `tools/list` → 200, `registrar_refeicao, consultar_saldo` (Task 2: + `definir_metas`)
- `GET /healthz` → 200 `{"ok":true}`
- `tools/call definir_metas` com 3 valores → rejeitado; com os 4 → `metas` gravadas + `saldo.status: ok` na mesma resposta

## User Setup Required

None - nenhuma configuração de serviço externo exigida por este plan (MCP_TOKEN/PORT/PUBLIC_HOST são env de runtime/deploy, tratadas no plan 01-04; para rodar local: `MCP_TOKEN=<token> npm start`)

## Next Phase Readiness

- Base pronta para o plan 01-02 (buscar_alimento/listar_registros etc. entram no mesmo factory e padrão de tools)
- 8 de 9 requisitos marcados completos; INFRA-01 permanece aberto por design (gate de ID compartilhado — a integração real com o Hermes é do plan 01-05)
- Nenhum stub: todas as respostas das tools vêm do banco real; suíte 31/31 e `npm run check` limpos

---
*Phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com*
*Completed: 2026-09-23*

## Self-Check: PASSED

- 21/21 arquivos-chave criados e presentes no disco
- Commits de task verificados no histórico: `51acc96` (Task 1), `e375f31` (Task 2)
- Suíte vitest 31/31 verde e `npm run check` limpo re-executados ao final do plan
- `git check-ignore` cobre `data/flexdiet.db` e `compose.env`
- `commits: 2` medido via `git rev-list --count 1ddc400..HEAD` (ledger do plan)
