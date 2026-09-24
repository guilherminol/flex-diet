---
phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com
verified: 2026-09-24T03:00:08Z
status: gaps_found
score: 15/20 must-haves verified
behavior_unverified: 1
overrides_applied: 0
unverified-prohibition: human review recommended — 2 judgment-tier prohibitions recorded with non-authoritative LLM-judge verdicts (both grep-supported PASS; see Prohibitions section)
covered_files:
  - .github/workflows/deploy.yml
  - .gitignore
  - .planning/phases/01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com/01-01-PLAN.md
  - .planning/phases/01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com/01-01-SUMMARY.md
  - .planning/phases/01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com/01-02-PLAN.md
  - .planning/phases/01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com/01-02-SUMMARY.md
  - .planning/phases/01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com/01-03-PLAN.md
  - .planning/phases/01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com/01-03-SUMMARY.md
  - .planning/phases/01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com/01-04-PLAN.md
  - .planning/phases/01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com/01-04-SUMMARY.md
  - .planning/phases/01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com/01-05-PLAN.md
  - Dockerfile
  - compose.env.example
  - docker-compose.yml
  - package.json
  - scripts/check-deploy-contract.mjs
  - src/db/backup.ts
  - src/db/connect.ts
  - src/db/migrate.ts
  - src/db/migrations/001_init.sql
  - src/db/migrations/002_alimento_nome_busca.sql
  - src/db/seed/seed.ts
  - src/domain/alimentos.ts
  - src/domain/metas.ts
  - src/domain/refeicoes.ts
  - src/domain/saldo.ts
  - src/lib/datas.ts
  - src/lib/dedupe.ts
  - src/lib/texto.ts
  - src/mcp/server.ts
  - src/mcp/tools/catalogo.ts
  - src/mcp/tools/metas.ts
  - src/mcp/tools/registrar.ts
  - src/mcp/tools/registros.ts
  - src/mcp/tools/saldo.ts
  - src/server.ts
  - tests/alimentos.test.ts
  - tests/backup.test.ts
  - tests/datas.test.ts
  - tests/dedupe.test.ts
  - tests/http.test.ts
  - tests/metas.test.ts
  - tests/migrations.test.ts
  - tests/refeicoes.test.ts
  - tests/seed.test.ts
covered_digest: "v1:sha256:ebdef1eb9063dc8db39b442134570a77b26ad318a7252d6fc6421258e6736720"
gaps:
  - truth: "Deploy automático funcionando — merge na `main` publica a versão nova na VPS via GitHub Actions (SC5) / 1º deploy real observado: run do Actions verde com o step de deploy EXECUTADO + GET /healthz respondendo na VPS (INFRA-05, 01-04 Task 3)"
    status: failed
    reason: "BLOQUEADO NO GATE HUMANO REGISTRADO (não é falha silenciosa de execução). O repo github.com/guilherminol/flex-diet não existe ainda e secrets VPS_*/setup da VPS são ação do usuário — exatamente o checkpoint blocking-human do 01-04 Task 3, documentado em 01-USER-SETUP.md. O contrato de deploy em si está completo e provado localmente: docker-compose.yml/Dockerfile no contrato do deploy.yml (lido e verificado), check-deploy-contract.mjs exit 0 re-executado nesta verificação, suíte 68/68 verde. Falta apenas o fato externo observável."
    artifacts:
      - path: "docker-compose.yml"
        issue: "nenhum — contrato íntegro; o gap é o deploy real não observado"
      - path: "Dockerfile"
        issue: "nenhum — build local provado pelo executor (docker compose build verde, smoke do container com seed/healthz/401); não re-executado nesta verificação (pesado; o critério real de INFRA-05 é o deploy na VPS)"
    missing:
      - "Criar o repo PRIVADO guilherminol/flex-diet no GitHub e fazer push da main local"
      - "Configurar secrets VPS_HOST/VPS_USER/VPS_PORT/VPS_PATH/VPS_SSH_KEY no GitHub Actions"
      - "Na VPS: clonar o repo em VPS_PATH, confirmar docker compose, criar compose.env (MCP_TOKEN/PORT/PUBLIC_HOST), firewall restritivo"
      - "Run do Actions verde com o step de deploy EXECUTADO (nunca o notice de pulado) + GET /healthz respondendo de fora"
  - truth: "Era do SDK (v2 vs v1) que o Hermes negocia verificada no primeiro contato, com fallback v1 documentado; servidor consumido pelo Hermes por URL (SC5, INFRA-01 fechamento — plan 01-05)"
    status: failed
    reason: "Plan 01-05 foi INTENCIONALMENTE PULADO, bloqueado pelo 01-04 halted (cadeia de dependência registrada: 01-05 depends_on 01-04). Seus artefatos não existem no codebase — isso é fact, não narrativa. Trabalho enfileirado atrás do gate humano do Gap 1; não exige re-execução agora, mas a fase não atinge o SC5 enquanto não rodar."
    artifacts:
      - path: "tests/client-e2e.test.ts"
        issue: "MISSING — cliente MCP e2e (initialize → tools/list 8 tools → tools/call → duplicado:true → 401) não escrito"
      - path: "docs/sdk-v1-fallback.md"
        issue: "MISSING — fallback SDK v1 (pinning 1.30.1) e seção 'Era negociada pelo Hermes' não documentados"
    missing:
      - "tests/client-e2e.test.ts (Task 1 do plan 01-05)"
      - "docs/sdk-v1-fallback.md com condição de acionamento, pinning @modelcontextprotocol/sdk 1.30.1 e seção da era (Task 2)"
      - "1º contato real com o Hermes + registro da era do protocolo (Task 3, checkpoint humano)"
deferred: []
behavior_unverified_items:
  - truth: "Duas chamadas concorrentes de registro aplicam cada débito atomicamente: cada chamada debita por completo ou não debita nada — o saldo nunca reflete débito parcial (01-01)"
    test: "Disparar 2+ POST /mcp simultâneos (Promise.all) com registrar_refeicao (mesmo e distintos payloads) e consultar o saldo/contagem de linhas"
    expected: "Cada débito aplica-se por inteiro ou nada; saldo nunca mostra valor parcial; dedupe responde duplicado:true para payloads idênticos sem segundo INSERT"
    why_human: "A transação síncrona (db.transaction + closure better-sqlite3, linhas 252-320 de src/domain/refeicoes.ts) está presente e conectada, e a single-thread do Node torna interleaving estruturalmente improvável — mas nenhum teste da suíte dispara chamadas concorrentes; presença de símbolo não prova o invariante sob concorrência"
---

# Phase 1: Núcleo confiável — banco, catálogo TACO e loop de registro com saldo — Verification Report

**Phase Goal:** O loop de valor central funciona de ponta a ponta via ferramentas MCP — registrar o que comeu debita os macros e devolve o saldo restante do dia, com correção trivial, números em que se pode confiar desde o primeiro dia e deploy automático na VPS a cada merge
**Verified:** 2026-09-24T03:00:08Z
**Status:** gaps_found (2 gaps — ambos bloqueados no gate humano registrado; 0 falhas de execução silenciosas)
**Re-verification:** No — initial verification

## MVP Mode — User Story Validation

O goal do ROADMAP está em **prosa** e FALHOU no validador (`user-story.validate` → `valid: false`). O plan 01-01 registra a reformatação 1:1 aceita, que PASSA (`valid: true`, slots: role "usuário do Flex Diet no WhatsApp" / capability "mandar o que comi e receber de volta o saldo restante..." / outcome "acompanhe minha dieta com números confiáveis e atrito mínimo"). A verificação prosseguiu sobre a história reformatada. **Discrepancia registrada:** se quiser o goal formal no ROADMAP, rodar `/gsd mvp-phase 1`.

### User Flow Coverage

| # | Step da user story | Expected | Evidence in codebase | Status |
|---|---|---|---|---|
| 1 | Mandar o que comi (via tool MCP `registrar_refeicao`) | Tool registra itens com gramas e debita macros do catálogo TACO | `src/mcp/tools/registrar.ts` → `registrarRefeicaoDaTool` → `src/domain/refeicoes.ts` (transação, snapshot); tests/http.test.ts "registrar 120g de banana maçã (retroativo)..." verde | ✓ VERIFIED (lado servidor) |
| 2 | Receber de volta o saldo restante (kcal, proteína, carbo, gordura) | Eco (nome+gramas+fonte) + id_curto + saldo na MESMA resposta | tests/http.test.ts (eco+id_curto+saldo; 150g arroz ≈ 195,18 kcal ±0,5) verde; `calcularSaldo` única implementação (src/domain/saldo.ts, SUM por data_local) | ✓ VERIFIED |
| 3 | Números confiáveis (outcome) | Correção trivial, retroativo correto, reenvio não duplica, sanity do catálogo | 68/68 testes verdes: dedupe (9), refeicoes (13), datas (7), seed sanity (10), metas (7) | ✓ VERIFIED |
| 4 | Deploy automático na VPS a cada merge (extensão do goal em prosa) | Merge na main → Actions → serviço novo na VPS | Contrato local completo e provado (check-deploy-contract exit 0; deploy.yml lê docker-compose.yml da raiz e roda `git pull --ff-only && docker compose up -d --build`); **deploy real não observado — repo GitHub inexistente, gate humano** | ✗ GAP (Gap 1) |

## Goal Achievement

### Observable Truths

Consolidado: 5 Success Criteria do ROADMAP + truths de plan que adicionam detalhe (dedupe canônico, concorrência, prepared statements, erros estruturados, backup diário, backstops de deploy).

| # | Truth | Status | Evidence |
|---|---|---|---|
| R1 | SC1 — Registrar refeição TACO debita kcal/macros; resposta traz item + gramas + fonte + saldo do dia (4 macros) | ✓ VERIFIED | tests/http.test.ts (8/8 verdes na suíte re-executada): "registrar 120g de banana maçã (retroativo) retorna eco + id_curto + saldo na mesma resposta"; "registrar 150g de arroz hoje e consultar_saldo → consumido.kcal ≈ 195,18 (±0,5)" |
| R2 | SC2 — editar/apagar reflete no saldo na hora | ✓ VERIFIED | tests/refeicoes.test.ts: "substitui os itens por completo e o saldo reflete na MESMA resposta"; "remove e o saldo volta ao estado anterior NA HORA" |
| R3 | SC2 — "repetir almoço de ontem" reloga (macros recomputados, id_curto novo, ambiguidade → refeicao_ambigua) | ✓ VERIFIED | tests/refeicoes.test.ts: 6 testes de repetir verdes ("repetição RECOMPUTA macros do catálogo atual", "dois registros do mesmo tipo... → refeicao_ambigua") |
| R4 | SC2 — registro retroativo cai no dia correto America/Sao_Paulo | ✓ VERIFIED | tests/datas.test.ts: "02:50 UTC ainda é o dia anterior em America/Sao_Paulo", "03:10 UTC já é o mesmo dia", "data informada é usada como está (retroativo)"; banana retroativa no teste http |
| R5 | SC2 — reenvio da mesma mensagem não duplica | ✓ VERIFIED | tests/dedupe.test.ts (9/9): "reenvio idêntico dentro de 10 min NÃO insere: devolve o registro original + saldo + duplicado true"; checar-e-inserir na MESMA transação (src/domain/refeicoes.ts:252-320, dedupeHash consultado dentro do closure db.transaction) |
| R6 | SC3 — buscar_alimento retorna 100g + medidas caseiras em gramas | ✓ VERIFIED | tests/alimentos.test.ts: "busca 'banana'... inclui Banana maçã com 86–89 kcal/100g"; "candidato com match POF traz >= 1 medida com gramas > 0; sem match traz []"; join POF→TACO (92 alimentos, guarda de unicidade em src/db/seed/seed.ts) |
| R7 | SC3 — seed TACO passa no sanity (banana ≈ 89, não kJ) | ✓ VERIFIED | tests/seed.test.ts: "banana maçã (178) fica entre 85 e 89 kcal/100g — nunca ~363 (kJ)"; óleo 880–888; teto >950; sanity in-code em src/db/seed/seed.ts:184-193 lê EXCLUSIVAMENTE energia_kcal |
| R8 | SC4 — ajustar metas muda o saldo imediatamente | ✓ VERIFIED | tests/metas.test.ts (7/7): "registrar refeição APÓS definir metas → saldo ok e restante = meta − consumido"; "nova definir_metas substitui a vigente"; schema rejeita 3 valores (D-10); sem metas → meta_nao_definida + instrução (D-09) |
| R9 | SC5 — servidor MCP Streamable HTTP protegido por token | ✓ VERIFIED | tests/http.test.ts: "POST /mcp sem Authorization responde 401", "com token errado responde 401", "initialize responde serverInfo flex-diet", "tools/list lista as 8 tools"; timingSafeEqual + requireBearerAuth em src/server.ts:26-47,75 |
| R10 | SC5 — SQLite WAL + migrations versionadas + backup pré-migration | ✓ VERIFIED | tests/migrations.test.ts: "user_version avança 0→2, backup pré-migration é criado e re-run é no-op"; "WAL está ativo na conexão"; pragmas em src/db/connect.ts:34-36 |
| R11 | SC5 — datas duplas timestamp_utc + data_local | ✓ VERIFIED | tests/datas.test.ts (7/7); snapshot gravado na escrita (refeicao: timestamp_utc + data_local) |
| R12 | SC5 — deploy automático: merge na main publica na VPS via Actions | ✗ FAILED (bloqueado no gate humano registrado) | Contrato completo e provado localmente (docker-compose.yml/Dockerfile no contrato exato do deploy.yml — lidos; check-deploy-contract.mjs exit 0 re-executado); deploy real NÃO observado: repo github.com/guilherminol/flex-diet inexistente + secrets/VPS user-side → Gap 1 |
| R13 | SC5 — era do SDK v2/v1 verificada no 1º contato + fallback v1 documentado (01-05) | ✗ FAILED (bloqueado atrás do Gap 1) | tests/client-e2e.test.ts e docs/sdk-v1-fallback.md AUSENTES do codebase (plan 01-05 pulado por depends_on 01-04 halted) → Gap 2 |
| R14 | Dedupe canônico: ordem trocada e 150 vs 150.0 deduplicam igual | ✓ VERIFIED | tests/dedupe.test.ts: "ordem dos itens não muda o hash", "gramas 150 e 150.04 produzem o mesmo hash"; canonicalização em src/lib/dedupe.ts:16-27 |
| R15 | Duas chamadas concorrentes debitam atomicamente (sem débito parcial) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Transação presente + conectada (db.transaction engloba dedupe+INSERT+itens, src/domain/refeicoes.ts:252-320), mas NENHUM teste dispara chamadas concorrentes → behavior_unverified_items |
| R16 | Wildcard %/_ neutralizado + 100% prepared statement | ✓ VERIFIED | tests/alimentos.test.ts: "termo com '%' não expande a busca", "usa prepared statement — termo malicioso não corrompe query"; escape + ESCAPE '\' em src/domain/alimentos.ts |
| R17 | Erros de negócio viram isError + código estruturado, nunca exceção crua | ✓ VERIFIED | tests/http.test.ts "alimento inexistente vira erro estruturado (isError)"; tests/refeicoes.test.ts "editar/remover com id inexistente → registro_nao_encontrado", "refeicao_ambigua com candidatos" |
| R18 | Backup diário db.backup() com retenção 7 (D-02), agendado no boot | ✓ VERIFIED | tests/backup.test.ts (5/5): cópia legível, retenção 9→7 exata, remoção cirúrgica, restauração consulta dados reais; agendamento no boot em src/server.ts:111-120 (erro não-fatal) |
| R19 | BACKSTOP — deploy vazio não deixa o serviço fora do ar | ? ABSTAIN (verification: backstop) | Não há evidência possível antes do 1º deploy; roteado ao checkpoint humano (item 5 do 01-04 Task 3) |
| R20 | BACKSTOP — VPS nunca regride de versão (git pull --ff-only) | ? ABSTAIN (verification: backstop) | Idem; `--ff-only` presente em .github/workflows/deploy.yml:41; observação fica para o pós-2º-merge (item 6 do checkpoint) |

**Score:** 15/20 truths verified (1 present, behavior-unverified; 2 failed-blocked-on-human-gate; 2 backstop-abstained)

**Execução da suíte nesta verificação:** `npx vitest run` → **exit 0, 9 arquivos, 68/68 testes passed em 2.94s** (executado pelo verifier, não herdado do SUMMARY). `npm run check` (tsc --noEmit + biome) → exit 0, 27 arquivos.

### Deferred Items

Nenhum. As fases 2–5 do milestone não cobrem deploy VPS nem integração Hermes (INFRA-05 e fechamento de INFRA-01 são escopo exclusivo da Phase 1 segundo REQUIREMENTS.md Traceability) — os gaps permanecem reais, dentro desta fase, atrás do gate humano.

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/server.ts` | Entrypoint /mcp Bearer + /healthz + startServer; boot migrations→seed→backup | ✓ VERIFIED | 139 linhas; verifier timingSafeEqual; createMcpHandler(buildServer); req.body como 3º arg; agendarBackupDiario no boot |
| `src/mcp/server.ts` | Factory buildServer com as 8 tools | ✓ VERIFIED | 8 registrarTool* chamados; wired em criarApp |
| `src/domain/saldo.ts` | calcularSaldo — única implementação, meta_nao_definida | ✓ VERIFIED | SUM sobre refeicao_item JOIN refeicao por data_local; ramo meta_nao_definida com instrução |
| `src/domain/refeicoes.ts` | registrar transacional + dedupe + listar/editar/remover/repetir | ✓ VERIFIED | 555 linhas; 5 funções exportadas; todas devolvem calcularSaldo |
| `src/domain/metas.ts` | definirMetas (4 valores) + obterMetasVigentes | ✓ VERIFIED | Vigência única por data_inicio, consumida por saldo.ts |
| `src/domain/alimentos.ts` | buscarAlimentos com escape de curingas | ✓ VERIFIED | Wired de catalogo.ts |
| `src/lib/dedupe.ts` | dedupeHash sha256 canônico + janela | ✓ VERIFIED | Ordenação + arredondamento a 1 casa; cutoff ISO-UTC |
| `src/db/migrations/001_init.sql` | 5 tabelas + UNIQUE + CHECK | ✓ VERIFIED | alimento/medida_caseira/refeicao/refeicao_item/meta_diaria; UNIQUE(fonte,numero_taco); CHECK(gramas>0) |
| `src/db/migrations/002_alimento_nome_busca.sql` | coluna nome_busca | ✓ VERIFIED | 5 linhas; preenchida pelo seed |
| `src/db/seed/seed.ts` | Seed TACO + POF idempotente com sanity | ✓ VERIFIED | energia_kcal exclusivo; sanity banana 85–89 in-code; join 2 passadas com guarda; log de cobertura |
| `src/db/seed/taco_composicao.csv` | Dataset vendado | ✓ VERIFIED | 598 linhas |
| `src/db/seed/pof_medidas_caseiras.csv` | Dataset POF vendado | ✓ VERIFIED | 11.802 linhas |
| `src/db/connect.ts` / `migrate.ts` / `backup.ts` | WAL/migrations/backup | ✓ VERIFIED | pragmas WAL+busy_timeout+foreign_keys; backup pré-migration; retenção 7 |
| `src/mcp/tools/{registrar,saldo,metas,catalogo,registros}.ts` | 8 tools com zod + structuredContent + annotations | ✓ VERIFIED | destructiveHint em remover_registro; readOnlyHint em listar/consultar/buscar |
| `tests/*.test.ts` (9 arquivos) | Suíte da fase | ✓ VERIFIED | 68/68 verdes (re-executado) |
| `Dockerfile` | node:22-slim, npm ci --omit=dev, tsx local | ✓ VERIFIED | Lido; tsx em dependencies (package.json); build local provado pelo executor |
| `docker-compose.yml` | Contrato do deploy.yml | ✓ VERIFIED | build, ports, env_file, volume ./data:/app/data, healthcheck /healthz |
| `compose.env.example` | Modelo MCP_TOKEN/PORT/PUBLIC_HOST | ✓ VERIFIED | Existe; compose.env real gitignored (check-ignore exit 0) |
| `scripts/check-deploy-contract.mjs` | Check versionado do contrato | ✓ VERIFIED | Re-executado: "contrato de deploy ok", exit 0 |
| `.github/workflows/deploy.yml` | Deploy SSH + compose | ✓ VERIFIED | concurrency group deploy-vps; git pull --ff-only + docker compose up -d --build; notice de pulado sem secrets |
| `tests/client-e2e.test.ts` | Cliente MCP e2e (01-05) | ✗ MISSING | Plan 01-05 pulado (bloqueado pelo 01-04 halted) — Gap 2 |
| `docs/sdk-v1-fallback.md` | Fallback v1 documentado (01-05) | ✗ MISSING | Idem — Gap 2 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| src/server.ts | src/mcp/server.ts | createMcpHandler(buildServer) atrás de requireBearerAuth em /mcp | ✓ WIRED | src/server.ts:63-78 |
| src/mcp/tools/registrar.ts | src/domain/refeicoes.ts | registrarRefeicaoDaTool → structuredContent com eco+id_curto+saldo | ✓ WIRED | registrar.ts:44-48 |
| src/domain/saldo.ts | 001_init.sql | SUM sobre refeicao_item JOIN refeicao por data_local + meta_diaria | ✓ WIRED | saldo.ts:29-37 |
| src/mcp/tools/catalogo.ts | src/domain/alimentos.ts | buscarAlimentos → structuredContent | ✓ WIRED | catalogo.ts:30-39 |
| src/domain/refeicoes.ts | src/lib/dedupe.ts | dedupeHash + inicioDaJanela DENTRO da transação do INSERT | ✓ WIRED | refeicoes.ts:10,252-320 |
| src/mcp/tools/registros.ts | src/domain/saldo.ts | todas as 4 tools de correção devolvem calcularSaldo | ✓ WIRED | registros.ts (listar/editar/remover/repetir) |
| docker-compose.yml | .github/workflows/deploy.yml | workflow procura compose na raiz de VPS_PATH e roda compose up -d --build | ✓ WIRED | deploy.yml:37-42 casa com docker-compose.yml na raiz |
| src/server.ts | src/db/backup.ts | boot agenda agendarBackupDiario | ✓ WIRED | src/server.ts:117-120 |
| tests/client-e2e.test.ts | src/server.ts | startServer porta efêmera (01-05) | ✗ NOT_WIRED | arquivo ausente — Gap 2 |
| docs/sdk-v1-fallback.md | package.json | pinning @modelcontextprotocol/sdk (01-05) | ✗ NOT_WIRED | arquivo ausente — Gap 2 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| consultar_saldo / registrar (saldo) | consumido/restante | SUM SQL sobre refeicao_item (dados reais do seed TACO) | Sim (195,18 kcal verificado em teste) | ✓ FLOWING |
| buscar_alimento | candidatos + medidas | tabelas alimento + medida_caseira (seed TACO+POF) | Sim (597 alimentos; 92 com medidas) | ✓ FLOWING |
| editar/remover/repetir (saldo) | saldo recalculado | mesma calcularSaldo sobre dados reais | Sim | ✓ FLOWING |
| Nenhum valor renderizado vem de literal estático ou mock | — | — | — | ✓ sem HOLLOW/STATIC/DISCONNECTED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Suíte completa da fase | `npx vitest run` | exit 0; Test Files 9 passed; Tests 68 passed (68) em 2.94s | ✓ PASS |
| Type-check + lint | `npm run check` | exit 0; tsc limpo; biome 27 files, no fixes | ✓ PASS |
| Contrato de deploy | `node scripts/check-deploy-contract.mjs` | exit 0; "contrato de deploy ok" | ✓ PASS |
| Gitignore de dados de saúde | `git check-ignore -v data/flexdiet.db compose.env` | exit 0 (.gitignore:5 data/, :8 compose.env) | ✓ PASS |
| Privacidade: egress de rede no processo | `grep -rn "fetch(\|http.request\|axios\|WebSocket..." src/` | Nenhuma chamada de saída em src/ (único fetch é o healthcheck do compose ao próprio /healthz — explicitamente permitido) | ✓ PASS |
| docker compose build (re-execução) | — | ? SKIP | Pesado para spot-check; claim do executor (build verde + smoke do container) registrado no 01-04-SUMMARY; o critério real de INFRA-05 é o deploy na VPS (gate humano) |

### Probe Execution

Nenhum `scripts/*/tests/probe-*.sh` convencional nem probe declarado nos PLANs. Os equivalentes da fase (suíte vitest e check-deploy-contract.mjs) foram executados pelo verifier — ver Behavioral Spot-Checks.

### Prohibitions (judgment-tier — veredito NÃO-AUTORITATIVO, human review recommended)

| Prohibition | Veredito LLM-judge | Evidence | Flag |
| --- | --- | --- | --- |
| Nenhum dado pessoal sai da VPS: processo sem chamada de rede de saída (única exceção: healthcheck ao próprio /healthz) | PASS (não-autoritativo) | grep de fetch/http.request/axios/WebSocket/telemetry em src/ → zero ocorrências; único fetch do sistema é o healthcheck do compose apontando ao próprio /healthz (permitido pelo texto) | unverified-prohibition — human review recommended |
| Servidor nunca aplica default/sugestão/ajuste automático de metas | PASS (não-autoritativo) | calcularSaldo sem metas → meta_nao_definida + instrução estática (saldo.ts:48-50); definir_metas exige exatamente os 4 valores; nenhum valor default de meta em src/ | unverified-prohibition — human review recommended |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| REG-01 | 01-01 | Registro por mensagem loga com macros debitados | ✓ SATISFIED (lado servidor) | tests/http.test.ts (registro + débito real do TACO) |
| REG-02 | 01-01 | Todo registro responde saldo + itens + gramas + fonte | ✓ SATISFIED | eco+id_curto+saldo na mesma resposta (teste http) |
| REG-03 | 01-03 | Editar/remover registro por mensagem | ✓ SATISFIED | tests/refeicoes.test.ts (7 testes de correção) |
| REG-04 | 01-03 | Repetir refeição de dia anterior | ✓ SATISFIED | tests/refeicoes.test.ts (6 testes de repetir) |
| REG-05 | 01-01 | Registro retroativo cai no dia correto | ✓ SATISFIED | tests/datas.test.ts + banana retroativa no http |
| REG-06 | 01-03 | Reenvio não duplica (idempotência) | ✓ SATISFIED | tests/dedupe.test.ts (9 testes) |
| ALIM-01 | 01-01 | Catálogo TACO com sanity de import | ✓ SATISFIED | tests/seed.test.ts (banana 85–89, óleo, teto, não-kJ) |
| ALIM-06 | 01-02 | Busca com medidas caseiras em gramas | ✓ SATISFIED | tests/alimentos.test.ts + join POF no seed (92 alimentos) |
| META-01 | 01-01 | Metas ajustáveis; saldo recalcula | ✓ SATISFIED | tests/metas.test.ts (7 testes) |
| INFRA-02 | 01-01 | SQLite WAL + migrations + backup pré-migration | ✓ SATISFIED | tests/migrations.test.ts + WAL assert |
| INFRA-03 | 01-01 | Datas duplas + saldo por única implementação | ✓ SATISFIED | tests/datas.test.ts + calcularSaldo única |
| INFRA-04 | 01-01 | Dados 100% locais (sem nuvem de terceiros) | ✓ SATISFIED | gitignore exit 0; zero egress em src/; volume local no compose |
| INFRA-01 | 01-01, 01-05 | MCP Streamable HTTP com token, consumido pelo Hermes; era do SDK verificada | ? PARTIAL — lado servidor SATISFIED (401/initialize/8 tools provados); Hermes + era do SDK PENDENTES (Gap 2, plan 01-05) |
| INFRA-05 | 01-04 | Merge na main → deploy automático na VPS | ✗ BLOCKED — contrato local completo e provado; 1º deploy real aguarda gate humano (Gap 1) |

**Orphaned requirements:** nenhum — os 14 IDs do phase header aparecem em `requirements:` de algum PLAN e todos estão mapeados à Phase 1 em REQUIREMENTS.md; nenhum requisito da Phase 1 ficou sem plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (nenhum) | — | Sem TBD/FIXME/XXX/HACK/PLACEHOLDER em src/, scripts/, Dockerfile, compose | — | — |
| src/db/seed/seed.ts | 37,39 | `return null` | ℹ️ Info (não é stub) | Sanitização TACO documentada "vazio → NULL (não analisado)" — fluxo de domínio do ALIM-01, não valor morto |

Observação ℹ️ (sem violação): deploy.yml usa `cancel-in-progress: true` — a propriedade obrigatória "nunca dois deploys paralelos na mesma VPS" segurada pelo grupo `deploy-vps` vale; mas a palavra "serializados" do must-have é imprecisa (o 2º run CANCELA o 1º, não enfileira). Comportamento seguro; registrar como decisão consciente ou trocar para `cancel-in-progress: false` se quiser enfileiramento literal.

### Human Verification Required

### 1. Checkpoint do 1º deploy real na VPS (desbloqueia Gap 1 — 01-04 Task 3, itens 1-6)
**Test:** Criar repo PRIVADO guilherminol/flex-diet → push da main → secrets VPS_HOST/VPS_USER/VPS_PORT/VPS_PATH/VPS_SSH_KEY no GitHub → na VPS: clone em VPS_PATH, `docker compose version`, compose.env com MCP_TOKEN/PORT/PUBLIC_HOST, firewall → re-executar o workflow.
**Expected:** Run do Actions VERDE com o step de deploy EXECUTADO (nunca o notice "deploy pulado"); `docker compose ps` mostra flex-diet healthy; GET http://<vps>:<porta>/healthz → {"ok":true} de fora.
**Why human:** Exige conta GitHub, credenciais VPS e acesso de rede externa — fatos fora da máquina e do alcance programático.
**Backstops no mesmo checkpoint:** (5) re-executar workflow sem mudança de código mantém o serviço respondendo (R19); (6) após 2º merge, `git pull --ff-only` ok no log e VPS roda a versão nova (R20).

### 2. Concorrência de registro nunca deixa débito parcial (R15 — behavior_unverified)
**Test:** Com o servidor local no ar, disparar 2+ POST /mcp simultâneos (Promise.all/curl paralelo) com registrar_refeicao — mesmos e distintos payloads — e consultar o saldo em seguida.
**Expected:** Cada débito aplica por inteiro ou nada; saldo nunca parcial; payload idêntico → duplicado:true e exatamente 1 registro.
**Why human/behavioral:** A transação está presente e conectada, mas nenhum teste automatizado dispara chamadas concorrentes; presença de símbolo não prova o invariante sob concorrência.

### 3. Fechamento INFRA-01 no Hermes (desbloqueia Gap 2 — 01-05 Task 3)
**Test:** Configurar o Hermes (URL http(s)://<vps>:<porta>/mcp + Bearer MCP_TOKEN); mandar "comi 120g de banana maçã" no WhatsApp; reenviar a mesma mensagem; perguntar a era do protocolo negociada.
**Expected:** Resposta com item + gramas + fonte + saldo; reenvio → "já registrado" (duplicado:true) sem duplicar; era registrada em docs/sdk-v1-fallback.md (linha "Era observada:").
**Why human:** Configuração e canal WhatsApp são do usuário; a era do SDK só se observa no 1º contato real.

### 4. Revisão das 2 proibições judgment-tier (soft-gate autônomo)
**Test:** Confirmar por inspeção/auditoria que o processo de produção não faz egress de rede e que nenhum default de meta existe.
**Expected:** Confirmação humana dos vereditos não-autoritativos registrados acima.
**Why human:** Veredito de LLM não é autoridade final para proibição declarada.

### Gaps Summary

O núcleo de valor da fase — o loop "registrei → saldo" com correção trivial, idempotência, catálogo confiável e metas — está **real e provado no codebase**: 68/68 testes re-executados pelo verifier, type-check/lint limpos, nenhum stub, nenhum debt marker, dados de saúde fora do git, privacidade sem egress. SC1–SC4 estão integralmente verificados com evidência comportamental.

SC5 fica a duas ações cujo bloqueio é **externo e registrado, não silencioso**:

1. **Gap 1 (INFRA-05):** o contrato de deploy está íntegro e versionado (compose/Dockerfile no formato exato que o deploy.yml consome; check-deploy-contract exit 0), mas o "1º deploy real" nunca pôde ocorrer — o repo GitHub não existe e o setup de VPS/secrets é user-side. É exatamente o checkpoint blocking-human do plan 01-04 (SUMMARY com status: halted, self-check PASSED), documentado em 01-USER-SETUP.md.
2. **Gap 2 (fechamento de INFRA-01):** o plan 01-05 foi pulado por dependência do 01-04; seus dois artefatos (tests/client-e2e.test.ts, docs/sdk-v1-fallback.md) não existem e a era do SDK v2/v1 segue desconhecida — trabalho enfileirado atrás do Gap 1.

Nenhum gap é endereçado por fase posterior (deferred: vazio). Classificação honesta: **gaps_found** — não por defeito de execução, mas porque a meta da fase inclui fatos externos ("deploy automático na VPS a cada merge", "consumido pelo Hermes") que ainda não são verdadeiros em nenhuma observação. Após o humano completar o setup (repo/secrets/VPS) e os checkpoints 1 e 3 acima, a fase re-verificada pode atingir passed com o mesmo codebase — nenhum trabalho de código está pendente além do plan 01-05.

---

_Verified: 2026-09-24T03:00:08Z_
_Verifier: Claude (gsd-verifier)_
