# Phase 1: Núcleo confiável — banco, catálogo TACO e loop de registro com saldo - Research

**Researched:** 2026-09-23
**Domain:** Servidor MCP TypeScript (Streamable HTTP na VPS) + SQLite WAL + seed do catálogo TACO + loop de registro com saldo
**Confidence:** HIGH (stack e APIs verificadas em fontes primárias nesta sessão: README/fonte do SDK oficial, docs do better-sqlite3, dataset TACO clonado e inspecionado, npm registry; pontos de integração com Hermes ficam como checkpoint)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Stack**
- **D-01:** Núcleo escrito em **TypeScript/Node** — SDK oficial MCP maduro, um único ecossistema pra servidor + dashboard futuro (Phase 5), Docker pequeno — **Reversibility:** one-way
- **D-02:** **Backup diário simples** do arquivo .db (retenção curta, ~7 dias) no volume da VPS, além do backup automático pré-migration já exigido pelo INFRA-02

**Contrato das tools MCP**
- **D-03:** `registrar_refeicao` é **atômica**: uma única chamada recebe o array completo de itens da refeição, e **cada item vem com quantidade obrigatória em gramas** — **Reversibility:** costly
- **D-04:** **Hermes resolve medidas caseiras em gramas** usando as equivalências TACO que a tool de busca retorna (ALIM-06); quando a mensagem não traz quantidade, o Hermes estima e declara a premissa. O servidor recebe **gramas sempre** — mínimo e determinístico, sem conhecer unidades — **Reversibility:** costly
- **D-05:** Tools devolvem **JSON estruturado** (itens + gramas + fonte + saldo); o Hermes escreve a mensagem do WhatsApp em cima disso. Nada de texto pronto pra repassar — **Reversibility:** costly
- **D-06:** **Correção por id curto** exibido no eco de cada registro (ex.: "#a3f2"); tools de editar/remover recebem esse id; uma tool de listar registros do dia cobre o caso "usuário não citou o id" — **Reversibility:** costly
- Nomes das tools em português e semânticos (`registrar_refeicao`, `consultar_saldo`, ...), já decidido no PROJECT.md — servidor 100% determinístico, zero parsing de linguagem natural

**Idempotência (REG-06)**
- **D-07:** Dedupe por **hash do payload (itens + gramas + data local) com janela de 10 minutos** — sem depender de id de mensagem do Hermes. Payload idêntico dentro da janela não duplica
- **D-08:** Retry detectado responde com o **registro original + saldo atual + flag de duplicado**

**Metas do dia**
- **D-09:** Sistema **nasce sem metas**: registro funciona desde a 1ª mensagem, mas o saldo responde "meta não definida" com instrução de como definir — nenhum default escondido
- **D-10:** `definir_metas` **exige os 4 valores explícitos** (kcal, proteína, carbo, gordura) — sem atualização parcial. "meta 1800kcal" sozinho não é chamada válida; o Hermes coleta os 4 valores antes de chamar a tool

### Claude's Discretion
- Framework HTTP, acesso a dados/migrações, estrutura de pastas, versão do Node, formato exato do hash de dedupe, mecanismo do backup diário (cron no compose vs job interno), porta do serviço
- Conjunto exato e nomes das demais tools da fase (consultar_saldo, buscar_alimento, listar_registros, repetir_refeicao, etc.) — desde que respeitem D-03..D-06 e nomes em português

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

**Fora desta fase (do `<domain>`):** Open Food Facts, cache automático e estimativa LLM salvável (Phase 2); fases de cutting/bulk, treinos e presets (Phase 3); peso/medidas/fotos (Phase 4); suplementação, relatório semanal e dashboard (Phase 5).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Servidor MCP via Streamable HTTP na VPS, consumido pelo Hermes por URL, endpoints com token; verificar era do SDK (v2 vs v1) | Stack v2 verificada (`@modelcontextprotocol/server` 2.1.0 + adapters); padrão oficial de token estático (`requireBearerAuth` + verifier próprio, exemplo oficial `examples/bearer-auth`); fallback v1 documentado (§State of the Art); checkpoint Hermes (§Open Questions) |
| INFRA-02 | SQLite WAL; migrations versionadas no boot com backup automático antes de cada migration | `db.pragma('journal_mode = WAL')` + `PRAGMA user_version` runner (~30 linhas) + `db.backup()` await antes de cada migration (§Architecture Patterns, §Code Examples) |
| INFRA-03 | Datas gravadas como `timestamp_utc` + `data_local` (America/Sao_Paulo); saldo derivado em leitura por uma única implementação | dayjs utc+timezone plugins verificados; schema + `domain/saldo.ts` como única fonte (§Patterns 3–4) |
| INFRA-04 | Dados 100% na VPS | Volume/bind mount `./data` no compose; nada sai da VPS; dados gitignored |
| INFRA-05 | Merge na `main` → deploy automático | Workflow já existe e foi lido esta sessão; a fase só entrega `Dockerfile` + `docker-compose.yml` no contrato esperado (§Patterns 6); pré-requisitos de VPS como checkpoint |
| ALIM-01 | Catálogo por 100g semeado da TACO com teste de sanidade (banana ≈ 89 kcal/100g; ~372 = kJ) | Dataset `brolesi/taco` clonado e inspecionado: colunas `energia_kcal`/`energia_kj` separadas; valores reais de banana/óleo/arroz medidos nesta sessão para o teste (§Pitfall 1, §Code Examples) |
| ALIM-06 | Busca retorna equivalências de medidas caseiras em gramas | Medidas vêm do arquivo POF/IBGE do mesmo repo; ponte POF↔TACO só existe por nome-base inequívoco (82 alimentos — análise verificada do próprio dataset) (§Pitfall 3) |
| REG-01/02 | Registro por mensagem debita macros e responde com saldo | Tool atômica D-03 + retorno estruturado D-05 com eco (itens+gramas+fonte) e saldo na mesma resposta; snapshot de macros no item (§Patterns 2, 5) |
| REG-03 | Editar/remover registro | Id curto `#xxxx` (D-06) + `editar_registro`/`remover_registro` + `listar_registros` (§Patterns 5) |
| REG-04 | Repetir refeição de dia anterior | `repetir_refeicao(data_origem, ...)` recria itens recomputados do catálogo (§Patterns 5) |
| REG-05 | Retroativo cai no dia correto America/Sao_Paulo | Parâmetro `data` opcional; `data_local` calculado com tz America/Sao_Paulo (§Patterns 3) |
| REG-06 | Reenvio não duplica | Hash sha256 canônico (itens+gramas+data_local, D-07) + janela 10 min + resposta com flag `duplicado` (D-08) (§Patterns 2) |
| META-01 | Metas ajustáveis por mensagem | `definir_metas` com 4 valores obrigatórios (D-10); saldo responde "meta não definida" (D-09); tabela `metas` com `data_inicio` (prepara META-04 da Phase 3 sem custo) |
</phase_requirements>

## Summary

A fundação técnica desta fase está inteiramente verificada e madura: o SDK oficial MCP **v2** (`@modelcontextprotocol/server` 2.1.0, spec 2026-07-28) existe no npm dentro do scope oficial `@modelcontextprotocol`, com adaptadores `@modelcontextprotocol/express` e `@modelcontextprotocol/node` publicados pelo mesmo repositório. O repositório oficial traz um **exemplo pronto de exatamente o que o INFRA-01 pede** (`examples/bearer-auth/server.ts`): `createMcpHandler` stateless por request + `requireBearerAuth` com verifier de token estático — sem OAuth server. O loop "registrei → saldo" é casca fina sobre um núcleo de domínio puro sobre better-sqlite3, e o deploy contínuo já tem o workflow commitado — a fase só precisa entregar o `docker-compose.yml` + `Dockerfile` que ele espera.

As duas incógnitas apontadas no STATE.md foram resolvidas em grande parte: (1) o **dataset TACO `brolesi/taco`** (v1.7.0, MIT, DOI Zenodo) tem colunas `energia_kcal` e `energia_kj` **separadas e explícitas**, UTF-8, decimal com ponto — o teste de sanidade pode cravar valores reais medidos nesta sessão (banana maçã 86,8 kcal / kJ 363,2; óleo de soja 884 kcal). Ressalva importante: as **medidas caseiras** do repo vêm da POF/IBGE e **não têm ponte por ID com a TACO** — o próprio dataset mediu que só 13% dos alimentos batem por nome-base e apenas 82 são inequívocos; o seed de ALIM-06 deve aceitar cobertura parcial (~82+ alimentos) e a busca retorna `medidas: []` no resto, o que é compatível com D-04 (o Hermes estima e declara a premissa). (2) A **era do SDK**: a v2 é a linha estável; a v1 (`@modelcontextprotocol/sdk` 1.30.1) recebe fixes por ≥6 meses pós-v2 — o fallback p/ v1 é pinar o pacote, o desenho de tools não muda.

Riscos reais desta fase são operacionais, não de escala: o `createMcpExpressApp` por padrão faz DNS-rebinding protection e **responde 403 a Host não-localhost** — na VPS é obrigatório `host: '0.0.0.0'` + `allowedHosts`; better-sqlite3 **não tem prebuild musl** → usar `node:22-slim` (não alpine); copiar só o `.db` em WAL não é backup → usar `db.backup()`; e o deploy do GitHub Actions **pula silenciosamente** se os secrets `VPS_*` não estiverem configurados — primeiro deploy exige prep da VPS.

**Primary recommendation:** Um processo Node 22 (`node:22-slim`) com Express 5 + SDK v2 em modo **stateless por request** (`createMcpHandler(factory)`), `/mcp` protegido por `requireBearerAuth` com token estático do env, better-sqlite3 em WAL com runner de migrations por `PRAGMA user_version` + `db.backup()` pré-migration e job interno de backup diário (7 retenções), seed idempotente do TACO+POF vendidos como CSV no repo com teste de sanidade de valores reais — tudo empacotado no compose que o `deploy.yml` já sabe publicar.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Interpretação da mensagem ("almocei arroz...") | Hermes (fora do repo) | — | Decisão de projeto: servidor 100% determinístico; LLM do Hermes resolve texto → itens+gramas |
| HTTP + protocolo MCP (Streamable HTTP, token) | API/Backend (SDK v2 + Express) | — | `createMcpExpressApp` + `requireBearerAuth` são o contrato do INFRA-01 |
| Validação de entrada das tools | API/Backend (zod no inputSchema) | — | zod v4 via Standard Schema é o caminho oficial do SDK v2; valida antes de tocar o banco |
| Cálculo de macros e saldo do dia | API/Backend (`domain/saldo.ts` única) | — | Saldo NUNCA armazenado, derivado em leitura por UMA implementação (decisão de roadmap) |
| Persistência (SQLite WAL, migrations, backup) | Database/Storage (better-sqlite3) | — | Arquivo único na VPS; WAL p/ concorrência futura do dashboard |
| Resolução medidas caseiras → gramas | Hermes | Servidor (fornece equivalências via `buscar_alimento`) | D-04: servidor só expõe a tabela de equivalências; conversão é do Hermes |
| Deploy contínuo | CI/CD (GitHub Actions, já existe) | VPS (Docker Compose) | `deploy.yml` lido esta sessão: `git pull --ff-only` + `docker compose up -d --build` |
| Backup diário | Database/Storage (job interno no processo) | — | Discretion do CONTEXT; job interno usa `db.backup()` — sem container/crontab extra |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node (runtime) | 22 LTS (local v22.16.0) | Runtime único | `better-sqlite3` 13 exige `>=22` [VERIFIED: npm view engines] |
| typescript | ^5.9.3 | Linguagem do núcleo | Decidido (D-01); rodar em dev/prod com tsx (sem build step) |
| @modelcontextprotocol/server | ^2.1.0 | SDK MCP v2: `McpServer`, `registerTool`, `createMcpHandler`, `OAuthError` | Linha estável da spec 2026-07-28 [VERIFIED: README oficial + npm view] |
| @modelcontextprotocol/express | ^2.0.1 | `createMcpExpressApp`, `requireBearerAuth`, host/origin validation | Adaptador oficial; peer `express ^4.18 || ^5` [VERIFIED: npm view peerDependencies + fonte src/express.ts] |
| @modelcontextprotocol/node | ^2.1.0 | `toNodeHandler` (adapta handler web → `(req,res)` do Express) | Import usado no exemplo oficial bearer-auth [VERIFIED: src/index.ts do pacote + exemplo] |
| express | ^5.2.1 | HTTP do processo (mcp + /healthz + futuros endpoints do dashboard) | Peer documentado do adapter; maior documentação entre os suportados |
| zod | ^4.6.5 | inputSchema das tools (Standard Schema) | `import * as z from 'zod/v4'` é o padrão do SDK v2 [VERIFIED: README/exemplo oficial] |
| better-sqlite3 | ^13.0.3 | SQLite síncrono, WAL, backup API | engines `node >=22` [VERIFIED: npm view]; API sync = código direto p/ 1 usuário |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | ^4.23.15 | Rodar TS direto (dev e no container) | `tsx watch` em dev; `tsx src/server.ts` como CMD |
| csv-parse | ^7.0.2 | Parse dos CSVs TACO/POF no seed | `import { parse } from 'csv-parse/sync'` com `{columns: true}` [VERIFIED: csv.js.org] |
| dayjs | ^1.11.23 | `timestamp_utc` → `data_local` (America/Sao_Paulo) | Plugins `utc` + `timezone` [VERIFIED: day.js.org] |
| vitest | ^5.0.1 | Testes (saldo, dedupe, migrations, sanidade do seed) | Stack definida no PROJECT.md; integra com tsx/tsconfig |
| @biomejs/biome | ^2.5.14 | Lint + format num binário só | Simplicidade (constraint do PROJECT.md) |
| @types/express, @types/better-sqlite3 | ^5.0.6 / ^9.6.0 | Tipos | DefinitivelyTyped |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SDK v2 | SDK v1 `@modelcontextprotocol/sdk` 1.30.1 | Fallback SE o Hermes negociar só era anterior; v1 tem fixes por ≥6 meses pós-v2; `McpServer.registerTool` existe na v1 — tools quase não mudam [CITED: README oficial v2 seção v1/legacy] |
| `node:22-slim` | `node:22-alpine` | Alpine não tem prebuild musl p/ better-sqlite3 → compila fonte (python3+make+g++, minutos); slim usa prebuilt glibc [CITED: npmjs + issues #1382/#387] |
| Job interno de backup | Cron no compose / crontab da VPS | Job interno = zero infra extra, usa a MESMA conexão; cron externo precisaria de container próprio ou acesso ao host. Discretion do CONTEXT — recomenda-se job interno |
| Runner próprio (`user_version`) | Knex/Umzug/Drizzle | Volume não justifica; runner de ~30 linhas é auditável (PROJECT.md "What NOT to Use") |

**Installation:**
```bash
npm init -y
npm install @modelcontextprotocol/server @modelcontextprotocol/express @modelcontextprotocol/node express zod better-sqlite3 dayjs csv-parse
npm install -D typescript tsx vitest @biomejs/biome @types/node @types/express @types/better-sqlite3
```

**Version verification:** todas as versões acima confirmadas via `npm view` em 2026-09-23 nesta sessão.

## Package Legitimacy Audit

> Rodado via `gsd-tools query package-legitimacy check --ecosystem npm` + `npm view` (2026-09-23).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| @modelcontextprotocol/server | npm | 2.1.0 pub. 2026-09-23 | 4.3M/wk | github.com/modelcontextprotocol/typescript-sdk | [SUS: too-new] | Approved — scope npm oficial do org MCP + repo oficial; SUS é artefato de release recente. Nome confirmado no README oficial |
| @modelcontextprotocol/express | npm | 2.0.1 pub. 2026-09-23 | 240k/wk | idem | [SUS: too-new] | Approved — idem |
| @modelcontextprotocol/node | npm | 2.1.0 pub. 2026-09-23 | 1.4M/wk | idem | [SUS: too-new] | Approved — idem |
| @modelcontextprotocol/sdk (v1, fallback) | npm | 1.30.1 | 40M/wk | idem | [SUS: too-new] | Approved — só pinnar se fallback v1 |
| zod | npm | 4.6.5 pub. 2026-09-13 | 212M/wk | github.com/colinhacks/zod | [SUS: too-new] | Approved — downloads/repo canônicos; SUS = release recente |
| better-sqlite3 | npm | 13.0.3 pub. 2026-08-05 | 7.4M/wk | github.com/WiseLibs/better-sqlite3 | [OK] | Approved |
| express | npm | 5.2.1 pub. 2025-12-01 | 101M/wk | github.com/expressjs/express | [OK] | Approved |
| csv-parse | npm | 7.0.2 pub. 2026-08-02 | 13.5M/wk | github.com/adaltas/node-csv | [OK] | Approved |
| dayjs | npm | 1.11.23 pub. 2026-08-17 | 51M/wk | github.com/iamkun/dayjs | [OK] | Approved |
| tsx | npm | 4.23.15 pub. 2026-09-20 | 63M/wk | github.com/privatenumber/tsx | [SUS: too-new] | Approved — repo/downloads canônicos |
| vitest | npm | 5.0.1 pub. 2026-09-15 | 73M/wk | github.com/vitest-dev/vitest | [SUS: too-new] | Approved — idem |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** todos os [SUS: too-new] acima — nenhum tem sinais reais de risco (sem postinstall, todos com repo oficial e downloads de milhões); o planner pode tratar o install como checkpoint único "verificar nomes dos pacotes MCP no registry no momento do install" em vez de um checkpoint por pacote. **Obrigatório por protocolo:** antes de instalar `@modelcontextprotocol/server`, confirmar que o README oficial (github.com/modelcontextprotocol/typescript-sdk) ainda lista esse nome — se o nome mudou, parar e re-verificar.

*Nota do runtime-identity:* gsd-tools verificado como `@opengsd/gsd-core` 1.13.0 nesta sessão.

## Architecture Patterns

### System Architecture Diagram

```
WhatsApp ──► Hermes (LLM, fora do repo) ── interpretando mensagem ──┐
                                                                    ▼
                                        POST https://<vps>:<porta>/mcp
                                        Headers: Authorization: Bearer <token>
                                                 Accept: application/json, text/event-stream
                                                                    │
┌─────────────────────────── VPS (Docker) ──────────────────────────▼──┐
│  container flex-diet (node:22-slim, processo único)                  │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Express (createMcpExpressApp host 0.0.0.0 + allowedHosts)      │  │
│  │  ├─ /mcp   ── requireBearerAuth ──► createMcpHandler(factory)  │  │
│  │  │            (401 sem token)       factory cria McpServer     │  │
│  │  │                                    POR REQUEST (stateless)  │  │
│  │  └─ /healthz (sem auth; healthcheck do compose)                │  │
│  └───────────────┬────────────────────────────────────────────────┘  │
│                  ▼ funções diretas (sem MCP/HTTP aqui)               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ DOMAIN (puro): refeicoes.ts · saldo.ts · alimentos.ts ·        │  │
│  │ metas.ts · dedupe.ts (sha256 + janela 10min)                   │  │
│  └───────────────┬────────────────────────────────────────────────┘  │
│                  ▼                                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ DB (better-sqlite3, WAL, busy_timeout)                         │  │
│  │  boot: migrations (user_version + backup pré-migration)        │  │
│  │        → seed TACO/POF idempotente (CSV vendidos no repo)      │  │
│  │  job interno: backup diário (db.backup → data/backups, keep 7) │  │
│  └───────────────┬────────────────────────────────────────────────┘  │
└──────────────────┼───────────────────────────────────────────────────┘
                   ▼
      ./data/flexdiet.db (+ -wal/-shm) e data/backups/  (volume/bind mount,
      gitignored — INFRA-04: nada sai da VPS)
```

Fluxo principal: WhatsApp → Hermes (resolve itens+gramas, chama `buscar_alimento` p/ resolver nomes→ids e ver equivalências) → `registrar_refeicao` → valida zod → dedupe (hash+janela) → transação (insere refeição+itens com macros snapshot) → `saldo.ts` deriva consumo vs metas → resposta JSON estruturada (eco: itens+gramas+fonte+id_curto, saldo, flag `duplicado` se retry) → Hermes escreve a mensagem.

### Recommended Project Structure
```
flex-diet/
├── src/
│   ├── server.ts              # entrypoint: express app + /mcp + /healthz + boot(db) + job backup
│   ├── mcp/
│   │   ├── server.ts          # buildServer factory (McpServer + registerTool de todas as tools)
│   │   └── tools/             # registrar.ts · saldo.ts · catalogo.ts · registros.ts · metas.ts
│   ├── domain/                # puro — sem MCP/HTTP/Express; testável com vitest
│   │   ├── refeicoes.ts       # registrar (atômica+dedupe), editar, remover, repetir, listar
│   │   ├── saldo.ts           # ÚNICA implementação do saldo (derivado em leitura)
│   │   ├── alimentos.ts       # busca (LIKE normalizado) + medidas caseiras
│   │   └── metas.ts           # definir 4 valores; vigência por data_inicio
│   ├── db/
│   │   ├── connect.ts         # better-sqlite3 + WAL + busy_timeout + foreign_keys
│   │   ├── migrate.ts         # runner user_version + db.backup() pré-migration
│   │   ├── migrations/001_init.sql
│   │   └── seed/
│   │       ├── seed.ts        # idempotente por (fonte, id externo); roda no boot após migrations
│   │       ├── taco_composicao.csv        # vendido no repo (vendor do brolesi/taco)
│   │       └── pof_medidas_caseiras.csv   # idem
│   └── lib/
│       ├── datas.ts           # dayjs utc+timezone: dataLocalSaoPaulo(), agoraIsoUtc()
│       └── dedupe.ts          # canonicaliza payload → sha256; consulta janela 10min
├── data/                      # GITIGNORED: flexdiet.db*, backups/
├── tests/                     # vitest (ver §Validation Architecture)
├── Dockerfile                 # node:22-slim (NÃO alpine)
├── docker-compose.yml         # contrato do deploy.yml (raiz do repo)
├── compose.env.example        # MCP_TOKEN=..., PORT=... (real fica só na VPS)
└── package.json
```

### Pattern 1: Servidor MCP stateless por request (SDK v2)
**What:** `createMcpHandler(factory)` cria um `McpServer` novo por chamada HTTP; todo estado vive no SQLite.
**When to use:** sempre neste projeto — o spec 2026-07-28 é stateless; elimina sessões/affinity atrás do deploy.
**Example:** ver §Code Examples — snippet 1 (adaptado do exemplo oficial `examples/bearer-auth/server.ts`, com `host: '0.0.0.0'` + `allowedHosts` obrigatórios na VPS).

### Pattern 2: Idempotência por hash canônico + janela (REG-06, D-07/D-08)
**What:** `dedupe_hash = sha256(payload canônico)` onde payload canônico = `{data_local, itens: [{alimento_id, gramas(1 casa)}...] ordenado por alimento_id}` (D-07: EXATAMENTE itens + gramas + data local — não incluir tipo de refeição nem timestamp). No `registrar_refeicao`: buscar `refeicao WHERE dedupe_hash = ? AND timestamp_utc >= now - 10min` → hit: retornar registro original + saldo + `duplicado: true` (D-08). Consulta, não unique index (a janela é temporal).
**Gotcha:** arredondar gramas (ex.: 1 casa) ANTES do hash, senão 150 vs 150.0 ou 150,00 quebram o dedupe; ordenar os itens, senão reenvio com ordem diferente vira "novo".

### Pattern 3: `data_local` na escrita, saldo derivado na leitura (INFRA-03)
**What:** todo insert grava `timestamp_utc` (ISO-8601 UTC, fonte da verdade) e `data_local` (`YYYY-MM-DD`, America/Sao_Paulo, calculado uma vez na escrita via dayjs tz). Toda leitura/agregação usa `data_local`. `data` é parâmetro opcional das tools (default: hoje local) — retroativo cai no dia certo (REG-05).
**Why:** Brazil/Sao_Paulo é offset fixo −03 (sem DST desde 2019) — mas a conversão fica numa função única `lib/datas.ts`, testada na fronteira 23h50→00h10.

### Pattern 4: Runner de migrations por `PRAGMA user_version` + backup pré-migration (INFRA-02)
**What:** arquivos `NNN_*.sql` versionados; no boot, ler `user_version`, para cada migration pendente: `await db.backup(...)` (snapshot consistente, funciona com WAL), `db.exec(sql)`, `db.pragma('user_version = N')`. Tudo dentro do boot do container (downtime irrelevante p/ 1 usuário).
**Gotcha:** `db.backup()` retorna PROMISE e `db.transaction()` rejeita funções async — o backup roda ANTES da transação da migration, não dentro [VERIFIED: docs/api.md — "Transaction functions do not work with async functions"].

### Pattern 5: Tools de workflow com eco de alta fidelidade (D-03..D-06)
**Conjunto proposto (8 tools, nomes PT, respeita D-03..D-06):**

| Tool | Input (zod) | Output (estruturado) |
|------|-------------|----------------------|
| `registrar_refeicao` | `data?` (YYYY-MM-DD), `itens[] {alimento_id, gramas>0}` obrigatório, `tipo_refeicao?` | eco dos itens (nome+gramas+fonte+macros), `id_curto`, `saldo`, `duplicado?` |
| `consultar_saldo` | `data?` | `saldo` ou `status: "meta_nao_definida"` + instrução (D-09) |
| `buscar_alimento` | `termo` | top-5 candidatos: id, nome, kcal/prot/carbo/gord **por 100g**, `medidas_caseiras[]` (vazio quando não houver match inequívoco) |
| `listar_registros` | `data?` | registros do dia com `id_curto`, itens, macros (cobre "não citei o id", D-06) |
| `editar_registro` | `id_curto`, `itens[]` (substituição completa, atômica), `data?` | eco novo + saldo recalculado |
| `remover_registro` | `id_curto` | confirmação + saldo recalculado |
| `repetir_refeicao` | `data_origem`, `id_curto_origem?` ou `tipo_refeicao?`, `data_destino?` | novo registro (itens recomputados do catálogo) + saldo |
| `definir_metas` | `kcal, proteina_g, carbo_g, gordura_g` — **os 4 required** (D-10) | metas + saldo do dia recalculado |

Erros de negócio voltam como `isError: true` + texto acionável + código estruturado (`alimento_nao_encontrado` com sugestões, `registro_nao_encontrado`, `meta_nao_definida`) — nunca exceção crua; annotations (`readOnlyHint` em consultas, `destructiveHint` em remover).

### Pattern 6: Deploy — entregar o contrato que o workflow já consome (INFRA-05)
`.github/workflows/deploy.yml` (lido esta sessão) em merge na `main`: conecta via SSH (`secrets VPS_HOST/VPS_USER/VPS_PORT/VPS_PATH/VPS_SSH_KEY`, linhas 18–22), **pula silenciosamente se secrets faltam** (linhas 24–27), e na VPS roda (linhas 36–42, verbatim):
> `if [ ! -f docker-compose.yml ] && [ ! -f compose.yaml ]; then` … `git pull --ff-only` … `docker compose up -d --build`

Ou seja: a fase entrega `docker-compose.yml` + `Dockerfile` na RAIZ do repo; a VPS precisa do repo clonado em `VPS_PATH` com `data/` gitignored (bind mount sobrevive ao `git pull`). Seed e migrations rodando no boot do container tornam o `--build` seguro (idempotentes).

### Anti-Patterns to Avoid
- **Estado/sessão MCP em memória:** o factory por request descarta qualquer estado no servidor; persistência é só o SQLite.
- **Calcular saldo no Hermes ou em SQL espalhado:** `domain/saldo.ts` é a única implementação (decisão de roadmap; saldo nunca armazenado).
- **Parser NLP no servidor:** servidor recebe gramas + `alimento_id`, nada de texto livre além da busca.
- **Dedupe pelo texto da mensagem ou id do Hermes:** D-07 fixou hash do payload normalizado — não depender de ids de fora.
- **Copiar o `.db` em WAL como backup:** usar `db.backup()`/`VACUUM INTO` (snapshot consistente) — backup pré-migration e diário.
- **Kcal de coluna kJ:** seed só lê `energia_kcal`; teste de sanidade trava os valores.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth do endpoint MCP | Middleware próprio de header | `requireBearerAuth({verifier})` do adapter oficial | Padrão do SDK, 401/challenge correto, authInfo chega na tool [VERIFIED: exemplo oficial] |
| Servidor HTTP endurecido | express() cru + middlewares manuais | `createMcpExpressApp` | Já embute express.json + host/origin validation (DNS rebinding) [VERIFIED: fonte] |
| Conversão handler web→Node | Adapter manual req/res | `toNodeHandler` de `@modelcontextprotocol/node` | É o caminho documentado; requer passar `req.body` (express.json já consumiu o stream) |
| Backup do SQLite | cp do arquivo / fs.copyFileSync | `db.backup(dest)` (promise) ou `VACUUM INTO` | Online backup API = snapshot consistente mesmo em WAL; cópia crua pode perder o `-wal` |
| Fuso/`data_local` | Aritmética manual de offset | dayjs + plugins utc/timezone (`dayjs.tz`) | Correto e testável; Brazil/Sao_Paulo via tzdata |
| Parse do CSV TACO | split(';\|,') caseiro | `csv-parse/sync` com `columns: true` | Aspas/vírgulas em nomes ("Banana, maçã, crua") são armadilha clássica |
| Versionamento de schema | ALTER na mão / "schema-atual" | `PRAGMA user_version` + arquivos SQL | ~30 linhas, auditável; habilita o backup pré-migration do INFRA-02 |
| Hash de dedupe | Hash caseiro | `node:crypto` sha256 de payload canônico | Determinístico, padronizado |
| Id curto | Nanoid/uuid truncado | `crypto.randomBytes(2).toString('hex')` + retry em colisão no dia | Zero deps; 4 hex chars = 65k combinações/dia, colisão rara e detectável |

**Key insight:** tudo que é "chato de errar" (auth, fuso, backup, CSV, versionamento) já tem primitiva verificada — o código próprio desta fase é só regra de negócio (registro, saldo, dedupe), que é exatamente o que merece testes.

## Common Pitfalls

### Pitfall 1: Ler `energia_kj` como kcal (ALIM-01)
**What goes wrong:** catálogo inteiro nasce inflado ~4,18x. O dataset traz AS DUAS colunas lado a lado.
**How to avoid:** seed lê exclusivamente `energia_kcal`; teste de sanidade com valores reais verificados nesta sessão no CSV:

| Alimento (linha do CSV) | energia_kcal | energia_kj |
|---|---|---|
| 178 "Banana, maçã, crua" | 86.805 | 363.19 |
| 179 "Banana, nanica, crua" | 91.529 | 382.96 |
| 182 "Banana, prata, crua" | 98.250 | 411.08 |
| 175 "Banana, da terra, crua" | 128.024 | 535.65 |
| 5 "Arroz, tipo 2, cozido" | 130.120 | 544.42 |
| 272 "Óleo, de soja" | 884.0 (lipideos_g 100.0) | 3698.66 |

O "banana ≈ 89" dos requisitos corresponde a banana maçã (86,8); o "~372 = kJ" bate com banana maçã/nanica em kJ (363/383). **Teste recomendado:** banana maçã 85–89 kcal/100g; óleo de soja 880–888; nenhum alimento com kcal > 950 exceto óleos; e assert de que `journal_mode` retorna `'wal'` após o connect.
**Warning signs:** primeira refeição "estoura" o dia; kcal > 900 em fruta.

### Pitfall 2: Valores especiais do TACO — `1e-05` (Tr) e vazio (não analisado)
**What goes wrong:** vazio ≠ zero: é "não analisado" [VERIFIED: docs/dicionario-dados.md — "Um valor ausente (NaN) significa 'não analisado', e é diferente de `Tr`"]; `1e-05` é o codificação de `Tr` (traço) [VERIFIED: dicionário, linha 13: "`1e-05` | `Tr` | Traço: quantidade abaixo do limite de quantificação"].
**How to avoid:** no seed: vazio → NULL; `1e-05` → 0 (traço, irrelevante p/ macros) documentado. No débito, `COALESCE(col, 0)` — alimento sem proteína analisada não deve travar o registro; a fonte continua sendo TACO.
**Warning signs:** NaN no saldo; registros rejeitados por macro ausente.

### Pitfall 3: Ponte POF↔TACO não existe — ALIM-06 tem cobertura parcial
**What goes wrong:** assumir que dá pra ligar as medidas caseiras aos alimentos TACO por ID. Verbatim do dataset [VERIFIED: docs/dicionario-dados.md:198–205]: "`codigo_alimento` (IBGE) e `numero_alimento` (TACO) são numerações independentes, e **este repositório não faz a ponte entre elas**. Medimos o quanto uma correspondência automática cobriria: apenas 147 dos 1.119 alimentos da POF (13%) têm nome-base idêntico a algum alimento da TACO, e desses só 82 são inequívocos".
**How to avoid:** seed junta medidas p/ TACO **somente quando o nome-base é inequívoco** (~82 alimentos, ex.: óleo, banana, leite); `buscar_alimento` retorna `medidas_caseiras: []` no resto — D-04 já define que o Hermes estima e declara a premissa. NÃO inventar fuzzy-match amplo (o próprio dataset documenta por que isso vira erro silencioso de nutriente).
**Warning signs:** medidas caseiras suspeitas ("arroz" genérico casando com 6 TACOs).

### Pitfall 4: 403 do próprio servidor na VPS (DNS rebinding protection)
**What goes wrong:** `createMcpExpressApp` faz bind default em `127.0.0.1` com host/origin validation localhost; requisições do Hermes com `Host: <ip-ou-dominio-da-vps>` recebem **403 antes do handler** [VERIFIED: docs serving/express + fonte src/express.ts: "host 0.0.0.0 // No automatic DNS rebinding protection", `allowedHosts` p/ restringir].
**How to avoid:** em prod: `createMcpExpressApp({ host: '0.0.0.0', allowedHosts: [<domínio/ip da VPS>] })` (dentro do container é obrigatório 0.0.0.0 de qualquer forma). `allowedHosts` é port-agnostic e requests sem Origin passam (cliente não-navegador não é afetado).
**Warning signs:** Hermes conecta e recebe 403; curl de fora com Host errado 403.

### Pitfall 5: better-sqlite3 no alpine (musl) — build de 3–5 min e toolchain no container
**What goes wrong:** não há prebuilt musl; npm compila fonte (`gyp ERR! find Python` sem `python3 make g++`), imagem inflada e build lento a cada `--build` do deploy [CITED: npmjs.com/package/better-sqlite3 + WiseLibs issues #1382, #387].
**How to avoid:** Dockerfile com `node:22-slim` (Debian glibc) → prebuilt binário baixado direto. Nunca copiar `node_modules` de fora do container (ABI/libc).
**Warning signs:** log de build do compose mostrando node-gyp/python.

### Pitfall 6: "Backup" que não é backup (WAL) e backup async dentro de transação
**What goes wrong:** copiar só `flexdiet.db` perde o `-wal` com transações commitadas. E `db.backup()` é promise — não dá pra chamar dentro de `db.transaction(fn)` (que rejeita async).
**How to avoid:** pré-migration: `await db.backup(caminho)` FORA de transação, depois `db.exec(sql)` + `user_version`. Diário: mesmo `db.backup()` com retenção de 7 (D-02). `VACUUM INTO` é alternativa equivalente.
**Warning signs:** arquivos `-wal` grandes acumulados; restore não testado.

### Pitfall 7: Stream do body consumido duas vezes no Express
**What goes wrong:** `createMcpExpressApp` já roda `express.json()`; chamar o node handler sem passar `req.body` faz o adapter tentar reler o stream → erro/timeout.
**How to avoid:** sempre `app.all('/mcp', auth, (req, res) => void nodeHandler(req, res, req.body))` — terceiro argumento obrigatório [VERIFIED: docs serving/express].
**Warning signs:** POST /mcp pendura sem resposta; "stream payload missing".

### Pitfall 8: Deploy "verde" que não deployou
**What goes wrong:** o workflow **pula silenciosamente** quando secrets não estão configurados [VERIFIED: deploy.yml:24–27]; e `git pull --ff-only` falha se a VPS tiver estado divergente.
**How to avoid:** checklist de 1º deploy: secrets `VPS_HOST/VPS_USER/VPS_PORT/VPS_PATH/VPS_SSH_KEY` configurados; repo clonado em `VPS_PATH`; `docker compose` instalado na VPS; `data/` gitignored ANTES do 1º push; smoke pós-deploy via `GET /healthz`.
**Warning signs:** notice "deploy pulado" no Actions; container velho rodando.

### Pitfall 9: `db.transaction()` com função async
**What goes wrong:** better-sqlite3 documentado: "Transaction functions do not work with async functions" — lançam erro ao invocar.
**How to avoid:** todo o trabalho de escrita (registrar/editar/remover) é 100% síncrono (queries better-sqlite3 são sync); nada de `await` dentro do closure da transação.

### Pitfall 10: Dedupe quebrado por não-canonicalização
**What goes wrong:** reenvio idêntico do Hermes vira registro novo porque os itens chegaram em ordem diferente, ou gramas `150` vs `150.0`, ou data resolvida de forma diferente.
**How to avoid:** canonicalizar ANTES do hash: itens ordenados por `alimento_id`, gramas arredondadas (1 casa), `data_local` já resolvida. Janela fixa de 10 min (D-07). Teste: mesmo payload 2x → mesmo `id_curto` + `duplicado: true`; payload com ordem trocada → dedupe pega; payload após 11 min → novo registro.

## Code Examples

### 1. Bootstrap do servidor MCP HTTP com token estático (INFRA-01)
```typescript
// Fonte: github.com/modelcontextprotocol/typescript-sdk — examples/bearer-auth/server.ts
// (adaptado: host 0.0.0.0 + allowedHosts p/ VPS, conforme docs serving/express)
import type { OAuthTokenVerifier } from '@modelcontextprotocol/express';
import { createMcpExpressApp, requireBearerAuth } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { AuthInfo, McpServerFactory } from '@modelcontextprotocol/server';
import { createMcpHandler, McpServer, OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const buildServer: McpServerFactory = (ctx) => {
  const server = new McpServer({ name: 'flex-diet', version: '0.1.0' });
  server.registerTool('consultar_saldo', {
    description: 'Saldo restante do dia (kcal, proteína, carbo, gordura)',
    inputSchema: z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
    annotations: { readOnlyHint: true },
  }, async ({ data }) => {
    const saldo = domain.saldo.doDia(data ?? datas.hojeLocal()); // ou status meta_nao_definida (D-09)
    return { content: [{ type: 'text', text: JSON.stringify(saldo) }], structuredContent: saldo };
  });
  // ... demais tools (Pattern 5)
  return server;
};

const staticTokenVerifier: OAuthTokenVerifier = {
  async verifyAccessToken(token): Promise<AuthInfo> {
    if (!timingSafeEq(token, process.env.MCP_TOKEN ?? '')) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'token inválido');
    }
    return { token, clientId: 'hermes', scopes: ['mcp'], expiresAt: Math.floor(Date.now() / 1000) + 3600 };
  },
};

const handler = createMcpHandler(buildServer);          // stateless: factory POR request
const app = createMcpExpressApp({ host: '0.0.0.0', allowedHosts: [process.env.PUBLIC_HOST!] });
const node = toNodeHandler(handler);
const auth = requireBearerAuth({ verifier: staticTokenVerifier, requiredScopes: ['mcp'] });
app.all('/mcp', auth, (req, res) => void node(req, res, req.body)); // req.body OBRIGATÓRIO (3º arg)
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.listen(Number(process.env.PORT ?? 8787));
```
Smoke sem cliente (docs oficiais):
```sh
curl -s -X POST http://127.0.0.1:8787/mcp -H "Authorization: Bearer $MCP_TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### 2. Conexão SQLite + WAL + runner de migrations com backup pré-migration (INFRA-02)
```typescript
// APIs verificadas em github.com/WiseLibs/better-sqlite3 docs/api.md
import Database from 'better-sqlite3';
const db = new Database('data/flexdiet.db');
db.pragma('journal_mode = WAL');      // testar: db.pragma('journal_mode', { simple: true }) === 'wal'
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

// runner (esqueleto): migrations = [{version: 1, sql}]
const atual = db.pragma('user_version', { simple: true }) as number;
for (const m of migrations.filter(m => m.version > atual)) {
  await db.backup(`data/backups/pre-migration-${m.version}-${Date.now()}.db`); // PROMISE — fora de transação
  db.exec(m.sql);
  db.pragma(`user_version = ${m.version}`);
}
```

### 3. `data_local` America/Sao_Paulo (INFRA-03)
```typescript
// Fonte: day.js.org/docs/en/plugin/timezone (plugins utc + timezone, timezone depende de utc)
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc); dayjs.extend(timezone);

export const agoraIsoUtc = () => new Date().toISOString();                    // timestamp_utc
export const dataLocalSp = (iso: string) =>
  dayjs(iso).tz('America/Sao_Paulo').format('YYYY-MM-DD');                    // data_local
export const hojeLocalSp = () => dayjs().tz('America/Sao_Paulo').format('YYYY-MM-DD');
```

### 4. Seed TACO idempotente com sanidade (ALIM-01/06)
```typescript
// Fonte API: csv.js.org/parse/api/sync; dados: brolesi/taco (clonado e inspecionado nesta sessão)
import { parse } from 'csv-parse/sync';
const rows: TacoRow[] = parse(csvText, { columns: true, skip_empty_lines: true });
// header verbatim: numero_alimento,descricao,umidade_pct,energia_kcal,energia_kj,proteina_g,
// lipideos_g,colesterol_mg,carboidrato_g,fibra_g,cinzas_g,...,base,preparo,qualificadores,categoria
// valores "": NULL (não analisado); 1e-05: Tr → 0
const bananaMaca = rows.find(r => r.numero_alimento === '178')!;  // energia_kcal 86.805
if (!(bananaMaca.energia_kcal > 85 && bananaMaca.energia_kcal < 89)) throw new Error('sanidade: banana');
// upsert por (fonte='taco', numero_taco) → seed re-roda a cada boot/deploy sem duplicar
// medidas: join POF→TACO apenas por nome-base INEQUÍVOCO (~82 alimentos; ver Pitfall 3)
```

### 5. Dedupe hash (REG-06, D-07)
```typescript
import { createHash } from 'node:crypto';
export function dedupeHash(dataLocal: string, itens: {alimento_id: number; gramas: number}[]) {
  const canon = JSON.stringify({
    data_local: dataLocal,
    itens: itens.map(i => ({ alimento_id: i.alimento_id, gramas: Number(i.gramas.toFixed(1)) }))
                .sort((a, b) => a.alimento_id - b.alimento_id),
  });
  return createHash('sha256').update(canon).digest('hex');
}
// busca: SELECT * FROM refeicao WHERE dedupe_hash = ? AND timestamp_utc >= datetime('now', '-10 minutes')
```

### 6. Docker (node:22-slim — NÃO alpine) + compose (contrato do deploy.yml)
```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV NODE_ENV=production
CMD ["npx", "tsx", "src/server.ts"]
```
```yaml
services:
  flex-diet:
    build: .
    restart: unless-stopped
    ports: ["${PORT:-8787}:8787"]
    env_file: compose.env        # MCP_TOKEN, PORT, PUBLIC_HOST (fora do git)
    volumes: ["./data:/app/data"]
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SDK TS `@modelcontextprotocol/sdk` (v1) | `@modelcontextprotocol/server` + adapters (`/express`, `/node`) — v2 | v2 = linha estável junto à spec **2026-07-28** [VERIFIED: README] | Esta fase nasce em v2; fallback v1 (1.30.1, fixes ≥6 meses) só se o Hermes negociar era anterior |
| Transporte HTTP+SSE (deprecated) | Streamable HTTP | Spec 2025/2026 | Único transporte HTTP a implementar |
| Schemas JSON Schema cru nas tools | Standard Schema (zod v4 via `zod/v4`) | SDK v2 | inputSchema tipado e validado no SDK |
| `node:sqlite` como "zero-dep" | better-sqlite3 | — | `node:sqlite` só saiu de experimental no Node 25.7 (PROJECT.md); no 22 LTS é better-sqlite3 |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | O Hermes consegue enviar `Authorization: Bearer <token>` (e o `Accept` JSON/SSE) ao conectar por URL | Code Examples 1, Open Questions | Sem isso, token estático não aplicável — exigiria outra forma de proteção; checkpoint no 1º contato |
| A2 | SDK v2 negocia com a era de protocolo que o Hermes fala; se não, fallback v1 (`@modelcontextprotocol/sdk@1.30.1`) com o mesmo desenho de tools | State of the Art | Re-trabalho pequeno (troca de pacote + transport), não de arquitetura; checkpoint no 1º contato |
| A3 | VPS tem Docker + compose plugin, repo clonado em `VPS_PATH`, e secrets `VPS_*` configurados no GitHub | Pitfall 8 | Deploy pula silenciosamente (workflow verificado) — precisa prep manual antes do 1º merge |
| A4 | America/Sao_Paulo é offset fixo −03 (DST abolido em 2019) | Pattern 3 | Baixo — dayjs usa tzdata; teste de fronteira cobre |
| A5 | Prebuilt glibc do better-sqlite3 13 cobre linux-x64/Node 22 ABI (documentação do pacote diz "prebuilt binaries for major platforms") | Pitfall 5 | Fallback barato: adicionar `python3 make g++` no Dockerfile (build de fonte) |
| A6 | Verdicts [SUS: too-new] dos pacotes MCP/zod/tsx/vitest são artefatos de release recente, não slopsquat (scope npm oficial do org MCP, repos canônicos, milhões de downloads) | Package Legitimacy Audit | Extremamente baixo; checkpoint de nomes no momento do install já mitiga |
| A7 | `db.pragma('journal_mode = WAL')` é a forma de ativar WAL (padrão da API `db.pragma` documentado; string de exemplo não consta verbatim no api.md) | Code Examples 2 | Trivial — o teste asserta `journal_mode === 'wal'` e pega de imediato |

## Open Questions

1. **Hermes: era de protocolo + como envia o token**
   - What we know: spec 2026-07-28 pede `Authorization: Bearer`; SDK v2 tem verifier de token estático pronto (exemplo oficial). STATE.md já marca isso p/ verificação no 1º contato.
   - What's unclear: se o Hermes suporta header customizado e qual era negocia.
   - Recommendation: task final da fase = integrar Hermes com checkpoint humano; fallback v1 documentado (A2).

2. **Secrets de deploy e prep da VPS**
   - What we know: `deploy.yml` pula sem secrets (verbatim verificado); `gh` não está instalado localmente para conferir.
   - Recommendation: checkpoint humano no início da fase: configurar secrets + clonar repo na VPS + confirmar docker/compose lá.

3. **TLS para `/mcp`**
   - What we know: token vai no header; se o Hermes acessa por HTTP puro na internet, o token trafega em claro.
   - What's unclear: se a VPS do usuário já tem reverse proxy (Caddy/nginx) com TLS.
   - Recommendation: perguntar no discuss/checkpoint; default MVP = HTTP + token + firewall, com TLS como follow-up se o proxy existir.

4. **Cobertura real do join POF↔TACO no seed**
   - What we know: 82 inequívocos (análise do dataset, verbatim no Pitfall 3).
   - Recommendation: implementar o join conservador (nome-base único), medir o resultado real no seed e logar a contagem; não prometer cobertura total.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | runtime dev/local | ✓ (local) | 22.16.0 | — |
| npm | install | ✓ (local) | 10.9.2 | — |
| Docker | build/test do container localmente | ✓ (local) | 28.3.2 | build só na VPS |
| git | workflow | ✓ | — | — |
| Docker + compose na VPS | INFRA-05 | ? (não verificável daqui) | — | checkpoint humano (A3) |
| Secrets VPS_* no GitHub | INFRA-05 | ? (`gh` não instalado local) | — | conferir em Settings→Secrets (checkpoint) |
| VPS_PATH com repo clonado | INFRA-05 | ? | — | checkpoint humano |
| Hermes (cliente MCP) | INFRA-01 integração | fora do repo | — | MCP Inspector p/ testar sem Hermes |
| MCP Inspector | test das tools sem Hermes | `npx @modelcontextprotocol/inspector` [CITED: github.com/modelcontextprotocol/inspector] | — | curl do smoke (Code Example 1) |

**Missing dependencies with no fallback:** nenhuma bloqueante localmente; os itens "?" são checkpoints de ambiente (A3), não de código.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 5.0.1 [VERIFIED: npm view 2026-09-23] |
| Config file | nenhum ainda — Wave 0 cria `vitest.config.ts` |
| Quick run command | `npx vitest run tests/saldo.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ALIM-01 | Seed sã: banana maçã 85–89 kcal/100g (não 363=kJ); óleo 884±4; nada >950 exceto óleos | unit (seed em .db temporário) | `npx vitest run tests/seed.test.ts` | ❌ Wave 0 |
| ALIM-06 | `buscar_alimento` retorna kcal/100g + medidas p/ alimentos com match inequívoco (e `[]` nos demais) | unit | `npx vitest run tests/alimentos.test.ts` | ❌ Wave 0 |
| INFRA-02 | Migration roda no boot, grava backup pré-migration, `user_version` avança; roda de novo = no-op | unit (db temporário) | `npx vitest run tests/migrations.test.ts` | ❌ Wave 0 |
| INFRA-03 | 23h50 e 01h10 caem no `data_local` correto America/Sao_Paulo; `timestamp_utc` ISO | unit | `npx vitest run tests/datas.test.ts` | ❌ Wave 0 |
| REG-01/02 | Registrar 150g de arroz tipo 2 cozido debita ~195 kcal e retorna eco + saldo na mesma resposta | unit (domain) | `npx vitest run tests/refeicoes.test.ts` | ❌ Wave 0 |
| REG-03 | Editar gramas / remover `id_curto` reflete no saldo na hora | unit | `npx vitest run tests/refeicoes.test.ts` | ❌ Wave 0 |
| REG-04 | `repetir_refeicao` de ontem cria registro hoje com macros recomputados | unit | `npx vitest run tests/refeicoes.test.ts` | ❌ Wave 0 |
| REG-05 | Retroativo com `data: "ontem"` cai no dia certo | unit | `npx vitest run tests/refeicoes.test.ts` | ❌ Wave 0 |
| REG-06 | Mesmo payload 2x dentro de 10min → 1 registro, `duplicado: true`, saldo consistente; ordem trocada de itens ainda dedupe; após janela → novo | unit | `npx vitest run tests/dedupe.test.ts` | ❌ Wave 0 |
| META-01 | `definir_metas` (4 valores) muda saldo na resposta; sem metas → `meta_nao_definida` + instrução (D-09); 3 valores → erro de schema (D-10) | unit | `npx vitest run tests/metas.test.ts` | ❌ Wave 0 |
| INFRA-01 | `/mcp` sem token → 401; com token → `tools/list` lista as 8 tools; `/healthz` 200 | integration (app.listen(0) + fetch) | `npx vitest run tests/http.test.ts` | ❌ Wave 0 |
| INFRA-04/05 | `data/` gitignored; compose/Dockerfile presentes na raiz (contrato do deploy.yml) | smoke (script/CI) | `node scripts/check-deploy-contract.mjs` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run` (suite curta, segundos)
- **Per wave merge:** suite completa + `docker compose build` local se a wave tocou Dockerfile/compose
- **Phase gate:** suite verde + smoke HTTP (curl do Code Example 1) + deploy real observado no Actions (verde e `/healthz` respondendo na VPS) antes de `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `package.json` + install das dependências (repo greenfield — nada existe)
- [ ] `vitest.config.ts` + `tsconfig.json`
- [ ] `tests/` com os arquivos do mapa acima (podem nascer junto com cada task; os de schema/dedupe/datas antes das tasks de tools)
- [ ] CSVs TACO/POF vendidos em `src/db/seed/` (copiar do clone `brolesi/taco` v1.7.0)

*(Nenhum framework instalado ainda — Wave 0 cobre.)*

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` [VERIFIED: .planning/config.json — `"security_enforcement": true`, `"security_asvs_level": 1`, `"nyquist_validation": true`, `"commit_docs": true`, lidos esta sessão]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | parcial | Token estático Bearer no `/mcp` via `requireBearerAuth`; comparação em tempo constante (`crypto.timingSafeEqual`); token só do env (nunca no git) |
| V3 Session Management | não (stateless) | SDK stateless por request — sem sessões para proteger |
| V4 Access Control | parcial | Token único = acesso total (single-user por decisão de projeto); nenhuma tool anônima; `/healthz` deliberadamente sem segredo (só `{ok:true}`) |
| V5 Input Validation | **yes** | zod v4 em todo inputSchema (gramas > 0 com teto, data regex `YYYY-MM-DD`); prepared statements better-sqlite3 em 100% das queries — busca de texto só por parâmetro |
| V6 Cryptography | parcial | `node:crypto` sha256 (dedupe) + timingSafeEqual (token); nada de cripto próprio |
| V7 Errors & Logging | parcial | Erros de negócio como resultado estruturado (não stack trace); logs em stderr SEM o token; guardar mensagem original do Hermes no registro (trilha de auditoria barata, recomendada pelo PITFALLS.md do projeto) |
| V14 Config | **yes** | `.env`/`compose.env` fora do git; `data/` gitignored desde o 1º commit (dados de saúde); imagem `node:22-slim` |

### Known Threat Patterns for {MCP HTTP + SQLite na VPS}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Endpoint MCP exposto sem auth (0.0.0.0 obrigatório na VPS) | Spoofing/Info Disclosure | `requireBearerAuth` + 401; `allowedHosts`; firewall da VPS limitando a porta ao necessário |
| Token em HTTP puro internet afora | Info Disclosure | Risk aceito no MVP se não houver TLS; preferir reverse proxy com TLS se existir (Open Question 3); token de alta entropia (32+ bytes) |
| SQL injection na busca de alimento | Tampering | Prepared statements sempre; LIKE com escape de `%`/`_` do termo |
| Payload gigante/repetição | DoS | `jsonLimit` do `createMcpExpressApp` (default 100kb, suficiente); dedupe já reduz reescrita; single-user = superfície mínima |
| Vazamento de dados de saúde via git | Info Disclosure | `data/`, `compose.env`, `*.db*` no `.gitignore` ANTES do 1º commit; repo privado |
| Log de token/headers sensíveis | Info Disclosure | Middleware de log próprio: nunca logar `authorization`; logar só método/path/status |
| Migration destrutiva sem volta | Tampering | Backup `db.backup()` obrigatório pré-migration (INFRA-02) + retenção 7 (D-02); restauração testada no phase gate |

## Sources

### Primary (HIGH confidence — lidos integralmente nesta sessão)
- github.com/modelcontextprotocol/typescript-sdk (branch main): `README.md` (nomes de pacotes v2, `registerTool` + zod/v4, status v1); `examples/bearer-auth/server.ts` (verifier estático, `requireBearerAuth`, `createMcpHandler` stateless); `packages/middleware/express/src/express.ts` (`createMcpExpressApp`, host/allowedHosts/jsonLimit); `packages/middleware/{express,node}/src/index.ts` (exports reais); `docs/serving/express.md` + ts.sdk.modelcontextprotocol.io/v2/serving/express.html e /authorization (estrutura de docs)
- brolesi/taco (clone local `--depth 1`, v1.7.0, MIT, DOI 10.5281/zenodo.22145839): `data/processed/taco/taco_composicao.csv` (header verbatim + linhas 1/2/5/175/178/179/182/272 medidas), `data/processed/pof/pof_medidas_caseiras.csv` (header + 11.801 linhas), `docs/dicionario-dados.md` (colunas §67–68, `1e-05`=Tr §13, NULL=não analisado §172, ponte POF §198–205), README.md, CHANGELOG.md
- npm registry (`npm view`, 2026-09-23): versões/engines/peers de todos os pacotes da stack
- github.com/WiseLibs/better-sqlite3 `docs/api.md`: `pragma(simple)`, `backup()` (promise, páginas/progress), `run/get/all`, `transaction()` (rejeita async, savepoints)
- .github/workflows/deploy.yml (repo local): contrato de deploy verbatim
- day.js.org/docs/en/plugin/timezone; csv.js.org/parse/api/sync
- .planning/PROJECT.md (stack com sources npm de 2026-09-23), .planning/research/{STACK,ARCHITECTURE,PITFALLS}.md (contexto do init — ajustado aqui p/ VPS/HTTP, que é posterior)

### Secondary (MEDIUM confidence)
- npmjs.com/package/better-sqlite3 + WiseLibs issues #1382/#387 + writeups Docker (musl: sem prebuild → build fonte; `node:22-slim` como fix canônico)

### Tertiary (LOW confidence — marcados p/ validação)
- Comportamento do Hermes (era de protocolo, header Bearer) — inerentemente não verificável daqui; checkpoint humano
- `npx @modelcontextprotocol/inspector` como ferramenta de teste (referência oficial não executada nesta sessão)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — todos os pacotes e versões confirmados no registry hoje; nomes/SDK v2 confirmados no README e código-fonte oficial
- Architecture: HIGH — padrões derivados de exemplo oficial executável (bearer-auth) + docs do SDK/better-sqlite3; único salto de design é o runner de migrations (trivial, API verificada)
- Pitfalls: HIGH p/ TACO/host/WAL (verificados na fonte); MEDIUM p/ musl/Docker (consenso de issues); LOW p/ integração Hermes (checkpoint)
- Dataset TACO: HIGH — valores medidos diretamente no CSV clonado nesta sessão

**Research date:** 2026-09-23
**Valid until:** ~2026-10-23 (stack estável; só a linha SDK v2 é recente — revalidar nomes/versões se a fase executar >30 dias depois)
