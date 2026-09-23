# Walking Skeleton — Flex Diet

**Phase:** 1
**Generated:** 2026-09-23

## Capability Proven End-to-End

> Uma chamada MCP autenticada por Bearer token (`registrar_refeicao` com itens + gramas) chega por Streamable HTTP ao servidor na VPS, debita os macros do catálogo TACO semeado e responde JSON estruturado com eco (item + gramas + fonte + id_curto) e o saldo restante do dia — com o deploy automático publicando isso na VPS a cada merge.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework / linguagem | TypeScript + Node 22 LTS, Express 5 + SDK MCP v2 (`@modelcontextprotocol/server` + `/express` + `/node`), server MCP **stateless por request** (`createMcpHandler(factory)`) | D-01 (one-way, decidido pelo usuário): um ecossistema só p/ servidor + dashboard futuro; SDK oficial; spec 2026-07-28 é stateless — zero sessão atrás do deploy |
| Data layer | better-sqlite3 13 (WAL, `busy_timeout`, `foreign_keys`) em arquivo único `data/flexdiet.db`; migrations versionadas `NNN_*.sql` com runner próprio por `PRAGMA user_version` + `db.backup()` pré-migration; saldo NUNCA armazenado — derivado em leitura só em `src/domain/saldo.ts` | INFRA-02/INFRA-03; API síncrona = transações diretas p/ 1 usuário; WAL habilita leitura concorrente futura (dashboard Phase 5) |
| Auth | Bearer token estático do env (`MCP_TOKEN`) via `requireBearerAuth` + verifier próprio com `crypto.timingSafeEqual`; `/healthz` sem auth (só `{ok:true}`) | INFRA-01; padrão do exemplo oficial `bearer-auth` do SDK; sistema de usuário único — sem OAuth/JWT (PROJECT.md) |
| Datas | Todo insert grava `timestamp_utc` (ISO UTC) + `data_local` (`YYYY-MM-DD`, America/Sao_Paulo via dayjs utc+timezone); `data?` opcional nas tools cai no dia certo (retroativo) | INFRA-03, REG-05 |
| Deployment target | Docker Compose na VPS pessoal (`node:22-slim`, volume `./data:/app/data`, healthcheck `/healthz`) publicado por `.github/workflows/deploy.yml` já existente (`git pull --ff-only` + `docker compose up -d --build`); migrations + seed idempotentes rodam no boot do container | INFRA-04/INFRA-05; dados 100% na VPS; cada merge é deploy seguro porque boot é idempotente |
| Directory layout | `src/server.ts` (entrypoint) · `src/mcp/server.ts` (factory) · `src/mcp/tools/*.ts` (1 arquivo por domínio de tools) · `src/domain/*.ts` (regras puras, sem MCP/HTTP) · `src/db/{connect,migrate,migrations,seed}` · `src/lib/*.ts` (datas, dedupe) · `tests/*.test.ts` (vitest) | Padrão que nasce aqui e vira referência das fases 2–5 (CONTEXT.md) |
| Idempotência | Dedupe por sha256 do payload canônico (itens ordenados + gramas 1 casa + data_local), janela 10 min; retry devolve registro original + saldo + `duplicado: true` | D-07/D-08 (REG-06) |
| Contrato das tools | 8 tools em português, JSON estruturado (`structuredContent`), erros de negócio como `isError` + código; servidor recebe sempre gramas (Hermes resolve medidas) | D-03..D-06 (costly — contrato publicado com o Hermes) |

## Stack Touched in Phase 1

- [x] Project scaffold (package.json, tsconfig, tsx, biome, vitest)
- [x] Routing — `/mcp` (Streamable HTTP + Bearer) e `/healthz` reais
- [x] Database — escrita real (`registrar_refeicao`) e leitura real (`consultar_saldo` via `data_local`)
- [x] "UI interaction" — a interação desta fase é a chamada MCP pelo Hermes/cliente: tool call wired de ponta a ponta ao SQLite (nenhuma UI nesta fase)
- [x] Deployment — Docker Compose na VPS via deploy.yml, 1º deploy observado + `/healthz` na VPS

## Out of Scope (Deferred to Later Slices)

- Open Food Facts, cache automático de produtos e estimativa LLM salvável (Phase 2)
- Fases cutting/bulk, treinos, presets de refeição (Phase 3)
- Peso, medidas, fotos de progresso (Phase 4)
- Suplementação, relatório semanal, dashboard web (Phase 5)
- TLS obrigatório em `/mcp` (decidido no checkpoint do Hermes; MVP = HTTP + token + firewall)
- Multiusuário, parsers de linguagem natural no servidor (fora de escopo por decisão de projeto)

## Subsequent Slice Plan

Cada fase seguinte adiciona uma fatia vertical sobre este esqueleto **sem alterar as decisões arquiteturais**:

- Phase 2: `buscar_produto`/registrar por barcode via OFF + cache no catálogo (nova fonte em `alimento.fonte`, reusa seed/busca/registrar)
- Phase 3: fases com metas históricas (`meta_diaria` já nasce com `data_inicio`), treinos e presets (novas tabelas + tools, mesmo padrão)
- Phase 4: peso/medidas/fotos no volume `./data` + metadados no SQLite
- Phase 5: relatório semanal (payload das tools) + dashboard read-only no mesmo Express (WAL permite leitura concorrente)
