---
gsd_state_version: "1.0"
milestone: v1.0
current_phase: 01
current_phase_name: Núcleo confiável — banco, catálogo TACO e loop de registro com saldo
status: executing
stopped_at: Completed 01-04-PLAN.md (1o deploy real verificado; INFRA-05 complete)
last_updated: "2026-09-24T22:14:03.144Z"
last_activity: 2026-09-23
last_activity_desc: Phase 01 execution started
state_head: 339c24e126d4006fd1ae067dbdd5540c0c1d3280
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 5
  completed_plans: 4
---

# Project State

## Project Reference

See: .planning/PROJECT.md (atualizado 2026-09-23)

**Core value:** A qualquer momento, mandar o que comeu no WhatsApp e receber de volta quanto falta de calorias e macros no dia — com o mínimo de atrito.
**Current focus:** Phase 01 — Núcleo confiável — banco, catálogo TACO e loop de registro com saldo

## Current Position

Phase: 01 (Núcleo confiável — banco, catálogo TACO e loop de registro com saldo) — EXECUTING
Plan: 5 of 5
Status: Ready to execute
Last activity: 2026-09-23 — Phase 01 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
**Per-Plan Metrics:**

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 42 min | 2 tasks | 27 files |
| Phase 01 P02 | 24 min | 2 tasks | 10 files |
| Phase 01 P03 | 24 min | 3 tasks | 7 files |
| Phase 01 P04 | 35min (20 executor + 15 continuacao) | 3 tasks | 10 files |

## Accumulated Context

### Decisions

Decisões registradas na tabela Key Decisions do PROJECT.md. Recentes, que afetam o trabalho corrente:

- Roadmap: contratos de confiança nascem na Phase 1 — eco de item+gramas+fonte+saldo em todo débito, idempotência (REG-06), `timestamp_utc`+`data_local` (INFRA-03), backup automático antes de cada migration (INFRA-02)
- Roadmap: transporte MCP decidido — Streamable HTTP na VPS (Hermes conecta por URL, endpoints com token); era do SDK (v2 vs v1) a verificar no primeiro contato (INFRA-01)
- Roadmap: saldo nunca é armazenado — sempre derivado em leitura por uma única implementação; toda escrita já retorna o saldo na mesma resposta
- [Phase 01]: SDK MCP v2 confirmado no install (npm view 2.1.0 + README oficial); sem fallback v1 — Legitimidade confirmada evita slopsquat; fallback v1 so se o Hermes negociar era anterior
- [Phase 01]: obterMetasVigentes extraida para domain/metas.ts; saldo.ts consome — unica regra de vigencia — Exigencia do Task 2: evita duplicar a regra de vigencia entre saldo e metas
- [Phase 01]: Conexao SQLite exposta as tools via holder setDb/getDb em db/connect.ts — McpServerFactory stateless nao carrega argumentos; holder mantem 1 conexao WAL por processo
- [Phase 01]: Join POF→TACO no seed em 2 passadas EXATAS (nome-base único + nome completo normalizado) com guarda de unicidade dos dois lados — O algoritmo de passada única do plan excluía Óleo de soja (base óleo tem 6 TACOs); 92 alimentos com medidas (724 linhas), resto fica medidas_caseiras: [] por contrato (D-04)
- [Phase 01]: Busca de alimentos acento-insensível via coluna alimento.nome_busca (migration 002) preenchida pelo seed com normalizarParaBusca (lib/texto.ts) — lower() do SQLite é ASCII-only e 'óleo'/'açaí' são alimentos comuns do domínio; mesma normalização no termo e na coluna, 100% parametrizado
- [Phase 01]: Janela de dedupe por cutoff ISO-UTC parametrizado (nao datetime('now') do SQLite — comparacao lexicografica vazaria no mesmo dia)
- [Phase 01]: editarRegistro recalcula dedupe_hash da linha (hash sempre reflete o conteudo); refeicao_ambigua para qualquer seletor com >1 candidato — nunca escolha silenciosa
- [Phase 01]: repetirRefeicao reusa registrarRefeicao (validacao/snapshot/id_curto/dedupe num lugar so); repetir 2x o mesmo payload no mesmo dia dentro da janela deduplica de proposito
- [Phase 01]: 1o deploy real confirmado (INFRA-05): run 36065009857 verde com deploy EXECUTADO, healthz {ok:true} de fora em 177.7.44.211:8787, /mcp 401 — repo PUBLICO por decisao do usuario com scan de segredos (T-01-13 mitigado de outra forma)
- [Phase 01]: healthcheck do compose falha com PUBLIC_HOST setado (allowedHosts rejeita Host 127.0.0.1 -> 403; fetch nao sobrescreve Host) — container (unhealthy) mas servico 100% funcional; fix de 1 linha deferido ao 01-05 (loopback no allowedHosts OU node:http com Host publico — provado 200)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 1: dataset TACO sem conversão canônica certificada — validar `brolesi/taco` (colunas kcal/kJ, encoding, medidas caseiras em gramas) durante o seed (ALIM-01, ALIM-06)
- Phase 1: era do SDK MCP suportada pelo Hermes a confirmar no primeiro contato (Streamable HTTP na VPS) (INFRA-01); VPS + secrets de deploy PRONTOS (INFRA-05 complete 2026-09-24)
- Phase 4: contrato de mídia do Hermes (`msg.timestamp`, staging de arquivos) a confirmar durante a fase (CORPO-03)
- Phase 5: contrato de `get_weekly_summary` (payload JSON) a acertar com o setup real do Hermes (RELAT-02)
- ~~01-04 halted no checkpoint Task 3 (blocking-human)~~ **RESOLVIDO (2026-09-24):** usuário aprovou após setup externo (repo `guilherminol/flex-diet` criado público, secrets VPS_* registrados, VPS com clone + compose.env); run 36065009857 verde com deploy EXECUTADO, healthz `{"ok":true}` de fora (177.7.44.211:8787), /mcp 401 — INFRA-05 complete (ver 01-04-SUMMARY.md)
- 01-05: healthcheck do compose marca container `(unhealthy)` (allowedHosts rejeita `Host: 127.0.0.1` com 403 quando PUBLIC_HOST setado; fetch não sobrescreve Host) — serviço 100% funcional (healthz 200 de fora, /mcp 401; node:http com Host público → 200 provado); fix de 1 linha a escolher no 01-05
- 01-05: decisão de TLS/reverse proxy no checkpoint do Hermes (T-01-15 segue risco aceito: HTTP puro + token de alta entropia)

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-09-24T22:14:03.004Z
Stopped at: Completed 01-04-PLAN.md (1o deploy real verificado; INFRA-05 complete)
Resume file: None
