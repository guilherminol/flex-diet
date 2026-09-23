# Resumo da Pesquisa do Projeto

**Project:** Flex Diet
**Domain:** Sistema pessoal de gestão de dieta flexível (IIFYM) e fitness — MCP server + SQLite local + dashboard web leve, consumido pelo agente de WhatsApp "Hermes" (usuário único, dados 100% locais, foco brasileiro)
**Researched:** 2026-09-23
**Confidence:** MEDIUM-HIGH (stack e arquitetura central: HIGH, fontes oficiais verificadas no dia da pesquisa; features e pitfalls: MEDIUM)

## Executive Summary

O Flex Diet é um **macro tracker conversacional**, não um app tradicional. A categoria "tracker no WhatsApp" já é validada e cobrada por assinatura no Brasil (ZapDieta, ContaCal, Gluti), e o consenso do mercado de macro tracking é que a guerra é **fricção de log e confiança nos números** — não quantidade de features. O diferencial do Flex Diet é ser grátis, 100% local (peso, medidas e fotos do corpo nunca saem da máquina), com catálogo brasileiro nativo (TACO + Open Food Facts) e **controle de estoque de suplementos com aviso de reposição — combinação que nenhum macro tracker mainstream tem**. O produto a construir é o servidor MCP (tools semânticas determinísticas) + banco local + dashboard read-only; toda a interpretação de linguagem natural fica no Hermes (LLM), que já existe.

A abordagem recomendada pela pesquisa: **Node 22 LTS + TypeScript**, SDK MCP oficial v2 (spec 2026-07-28, `@modelcontextprotocol/server` + Zod v4), **better-sqlite3 em WAL** e Express 5. Arquitetura de **"dois entrypoints, um núcleo, um banco"**: o MCP server (stdio como subprocesso do Hermes, ou Streamable HTTP se o Hermes exigir — decidir com spike no início) e um processo HTTP separado para o dashboard, ambos **cascas finas sobre `src/domain/`** (biblioteca pura, sem menção a MCP/HTTP), sobre o mesmo `flexdiet.db` em WAL. Regras de ouro verificadas contra a spec: saldo nunca é armazenado (derivado em uma única função), tools de escrita **já retornam o saldo na mesma resposta**, erros de negócio voltam como resultados conversáveis (`isError: true` + `structuredContent` com códigos como `phase_expired`) para o Hermes se autocorrigir. O escopo v1 do PROJECT.md está bem alinhado ao mercado; a pesquisa de features recomenda **adicionar dois table stakes baratos que faltaram: editar/remover registro e "repetir refeição anterior"**.

O maior risco **não é técnico, é de confiança no saldo**. Um débito silencioso errado (estimativa LLM subestima ~250–345 kcal/refeição segundo estudo NIH/2026; coluna kJ lida como kcal na TACO ou no OFF; refeição duplicada por retry) faz o usuário parar de usar o sistema — apps de dieta morrem por atrito + desconfiança, não por falta de features. As prevenções convergem em três padrões que devem nascer na primeira fase: **(1) ecoar item + gramas + fonte + saldo em todo débito; (2) correção (`desfazer`/`corrigir`/`apagar`) e idempotência como cidadãos de primeira classe; (3) contratos de tool explícitos sobre unidades (sempre gramas), datas (`data_local` America/Sao_Paulo gravada na escrita) e fontes (TACO/OFF/estimativa)**. Completam o quadro: backup desde o dia 1 (em WAL, copiar só o `.db` não é backup) e disciplina contra scope creep (treino detalhado, integrações e "comer de volta" calorias ficam fora).

## Key Findings

### Recommended Stack

Stack de **um runtime só (Node 22 LTS)** servindo Hermes e dashboard, com dependências mínimas — coerente com a constraint de simplicidade. Versões verificadas direto no registro npm em 2026-09-23 (detalhes em [STACK.md](STACK.md)).

**Tecnologias centrais:**
- **Node.js 22 LTS + TypeScript ^5.9** — runtime e linguagem únicos; TS 7 (compilador nativo) existe mas é recém-estável; migrar depois
- **@modelcontextprotocol/server ^2.1.0 (+ @modelcontextprotocol/express)** — SDK oficial MCP linha v2, spec 2026-07-28; fallback documentado: pinar v1 (`@modelcontextprotocol/sdk` 1.30.1) se o Hermes negociar apenas a era anterior
- **zod ^4.6.5** — validação de input das tools (peer oficial do SDK v2 via Standard Schema); valida gramas/macros antes de tocar o banco
- **better-sqlite3 ^13 (WAL + busy_timeout)** — banco local arquivo único; API síncrona ideal para 1 usuário; WAL permite dashboard ler enquanto MCP escreve
- **express ^5.2.1** — HTTP do dashboard (rotas JSON read-only + estáticos)
- **React 19 + Vite 8 + Recharts 3** — dashboard (gráficos de macros/peso/semana)

**Suporte:** tsx (dev sem build), csv-parse (seed TACO), dayjs (datas locais), `fetch` nativo para Open Food Facts (User-Agent obrigatória; sem SDK), biome + vitest.

**O que NÃO usar** (consenso forte das 4 pesquisas): banco na nuvem, ORM (Prisma etc.), auth real, Docker, frameworks pesados (NestJS), parser NLP no servidor (duplica o Hermes), LangChain/LLM embutido, transporte legado HTTP+SSE, Electron.

### Expected Features

**Must have (table stakes):** registro de refeição por mensagem + **saldo restante na mesma resposta** (é o produto); catálogo TACO com busca por 100g; barcode/nome via Open Food Facts + cache automático; metas ajustáveis por mensagem; **editar/remover registro (adição da pesquisa — barato e indispensável)**; **repetir refeição anterior (adição — maior alavanca de fricção)**; alimento personalizado + estimativa LLM rotulada e salvável; peso corporal; diário do dia; gráficos mínimos.

**Should have (diferenciais):** WhatsApp zero-install grátis vs. categoria paga; catálogo BR nativo (TACO + OFF + fallback LLM); **fases cutting/bulk/manutenção com metas próprias e troca explícita (fim de fase → perguntar, nunca assumir)**; **suplementos: checklist + estoque com aviso de reposição (único no segmento)**; relatório semanal **empurrado** no WhatsApp; fotos amarradas a peso/medidas do dia; núcleo MCP headless (reutilizável por qualquer agente).

**Defer (v1.x/v2+):** "Posso comer X?" (top candidato a v2 — tool barata de simulação de saldo), trend weight (média móvel ~7 dias), quick-add de kcal. **Fora (anti-features confirmadas):** log de treino por série/reps, "comer de volta" calorias do cardio (estimativas erram ~50%; MacroFactor rejeita), ajuste automático de metas, micronutrientes, água, gamificação, lembretes gerais, refeições planejadas, integrações externas.

### Architecture Approach

Padrão central: **ferramentas semânticas de domínio sobre um núcleo determinístico** — o LLM do Hermes só traduz linguagem natural em argumentos estruturados; validação, conversão gramas→macros, regras de fase/estoque e cálculo de saldo são 100% código no servidor. Detalhes em [ARCHITECTURE.md](ARCHITECTURE.md).

**Componentes principais:**
1. **MCP server (`src/mcp/`)** — entrada stdio (subprocesso do Hermes) com as tools; valida schema, delega ao núcleo, traduz erros de negócio em resultados conversáveis
2. **Dashboard (`src/dashboard/` + `dashboard-ui/`)** — processo HTTP separado, **read-only**, vive independentemente do Hermes; serve JSON + estáticos
3. **Núcleo de domínio (`src/domain/`)** — foods, meals, saldo, targets/fases, training, supplements, body, presets, reports; **nenhuma menção a MCP/HTTP/WhatsApp**; `saldo` tem UMA implementação
4. **Dados (`src/db/`)** — SQLite WAL + busy_timeout, migrations versionadas (`user_version`, rodadas no boot, backup automático antes de cada), seed TACO; fotos como arquivos em `data/photos/` (path no banco, nunca blob)

**Contratos que a arquitetura impõe:** data sempre como parâmetro explícito (`YYYY-MM-DD` local, com `timestamp_utc` como fonte da verdade); OFF normalizado na borda (kcal por 100g, nunca o JSON cru); erros de negócio com `structuredContent` (`food_not_found`, `phase_expired`, `insufficient_stock`); log do servidor em **stderr** (logging via protocolo desprecado na spec).

**Nota de reconciliação:** STACK.md sugere um único processo (MCP via Streamable HTTP na mesma porta do dashboard); ARCHITECTURE.md recomenda stdio + dashboard separado, porque o servidor stdio só vive enquanto o Hermes roda. **Ambos concordam no essencial:** mesmo núcleo, mesmo banco WAL, tools idênticas (~5 linhas mudam o transporte). Decidir com spike no início da Fase 1 conforme o que o Hermes suporta.

### Critical Pitfalls

Os 5 mais críticos (de 12 mapeados em [PITFALLS.md](PITFALLS.md) — leitura rápida: os piores riscos são de **confiança no saldo**, não técnicos):

1. **Débito silencioso errado destrói a confiança** (risco nº 1) — estimativas LLM erram ~1/3 do conteúdo real; mitigar ecoando item+gramas+fonte+saldo em todo registro, rotulando estimativas e tornando correção trivial via mensagem. Nasce na Fase 1 — retrofit é caro.
2. **Double-logging por falta de idempotência** — retry do canal WhatsApp→Hermes→MCP duplica refeições; mitigar com `idempotency_key` opcional + dedupe defensivo (hash conteúdo+data+janela de ~3 min) retornando o registro existente com flag `duplicado`.
3. **TACO importado com kJ como kcal / encoding brasileiro** — colunas kcal e kJ lado a lado, `;` como separador, decimal com vírgula, latin-1; mitigar com teste de sanidade obrigatório no seed (banana ≈ 89 kcal/100g; se vier ~372, é kJ).
4. **Medida caseira tratada como gramas universais** — "2 colheres de arroz" ≠ 2 colheres de óleo (erros de 2–3x); mitigar semeando gramas-por-medida da TACO por alimento, tools aceitando **só gramas** e busca retornando as equivalências para o Hermes declarar a premissa no eco.
5. **Datas/fuso: fronteira do dia torta** — UTC default corrói o saldo à noite (refeição da 1h cai no dia errado); mitigar com `timestamp_utc` + `data_local` (America/Sao_Paulo, sem horário de verão) calculada **na escrita**, e `date` sempre explícito nas tools (com retroativo: "ontem jantei X").

Menções honrosas que moldam o roadmap: tools demais/estreitas/mal descritas (alvo **~8–12 tools por workflow**, descrições como maior alavancagem — guia Anthropic); aderência calculada contra metas erradas na troca de fase (metas como **histórico por data**, aderência por dia contra a meta daquele dia); fotos do WhatsApp (EXIF stripado → data canônica = `msg.timestamp`, auto-orient, thumbnail); estoque de suplementos sem **ledger** de eventos (aviso em dias-restantes, não percentual); sem backup (`.backup`/`VACUUM INTO`, nunca copiar só o `.db` em WAL); scope creep pós-demo (Out of Scope do PROJECT.md como contrato).

## Implications for Roadmap

Estrutura sugerida de **5 fases**, convergindo a ordem de construção da ARCHITECTURE.md, o mapeamento pitfall→fase da PITFALLS.md e as dependências de features da FEATURES.md. Cada estágio é verificável isoladamente **sem depender do Hermes** (MCP Inspector nas fases 1–2; Hermes entra de verdade na Fase 1 via spike e na configuração final).

### Fase 1: Núcleo confiável — domínio + banco + catálogo TACO + loop MCP mínimo
**Rationale:** tudo o mais é casca sobre isto; o loop de valor central ("registrei → saldo") fica demonstrável no MCP Inspector sem Hermes; e os contratos que protegem a confiança (eco com fonte, idempotência, `data_local`, migrations versionadas + backup) **têm que nascer aqui** — retrofit é caro ou impossível.
**Delivers:** schema SQLite (WAL, `busy_timeout`) com `timestamp_utc` + `data_local`; seed TACO com testes de sanidade (banana ≈ 89 kcal/100g); `src/domain/` (foods, meals, saldo, targets) com testes unitários; MCP server com o circuito mínimo de tools: registrar refeição (retorna saldo na mesma resposta), consultar saldo, buscar/criar alimento, **corrigir/apagar registro**, **repetir anterior**, definir metas; runner de migrations + backup (`VACUUM INTO`).
**Addresses (FEATURES):** catálogo TACO + busca; registro + saldo; metas ajustáveis; editar/remover (adição recomendada); repetir anterior (adição recomendada); alimento personalizado.
**Avoids (PITFALLS):** 1 (débito silencioso), 2 (idempotência), 3 (TACO kJ/encoding), 4 (medida caseira), 6 (fuso — decisão de schema), 7 (desenho de tools), 11 (backup/migrations).
**Inclui spike obrigatório:** conectividade do Hermes — stdio vs Streamable HTTP, SDK v2 vs v1 (se falhar, pinar `@modelcontextprotocol/sdk` 1.30.1).

### Fase 2: Open Food Facts + cache do catálogo
**Rationale:** enriquece o catálogo criado na Fase 1 (o write-through depende dele) e é a **única dependência de rede do caminho principal** — isolar e blindar cedo.
**Delivers:** tool de busca OFF (barcode OU nome) com normalização na borda (`energy-kcal_100g`, preferir `_100g`, kJ→kcal derivado quando ausente, política explícita para nulls), cache write-through com fonte+data, timeout curto (2–3s) com fallback para estimativa rotulada.
**Addresses:** OFF barcode/nome + cache automático; estimativa LLM salvável no catálogo.
**Avoids:** 5 (kJ/porção/nulls/cru-vs-cozido) e parte do 7 (descrições ricas instruindo preferência por variante "cozido").

### Fase 3: Rotina — fases/metas históricas, treino, presets
**Rationale:** metas-como-histórico (tabela `phases` com período + metas) precisa existir **antes** do relatório semanal poder calcular aderência; domínios secundários reaproveitam a infra de tools pronta na Fase 1, cada um independente do outro.
**Delivers:** `create_phase`/`switch_phase`/`get_current_phase` com estado estruturado `phase_expired` (o Hermes pergunta, nunca assume — requisito do PROJECT.md); registro de treino (musculação data+grupos, cardio como log puro sem ajustar metas); presets (salvar/log, expandindo itens e retornando saldo).
**Addresses:** fases cutting/bulk/manutenção; treino simples + cardio; presets.
**Avoids:** 8 (lado schema: meta válida = função da data), 12 (treino detalhado permanece fora).

### Fase 4: Corpo — peso, medidas, fotos
**Rationale:** domínios independentes entre si; fotos dependem do fluxo de mídia do Hermes (fora do escopo, mas o contrato `save_photo` por path precisa existir e as armadilhas de mídia são conhecidas).
**Delivers:** registrar peso/medida; `save_photo` com data canônica = `msg.timestamp` (nunca mtime/EXIF), `data_local` com retroativo, layout `data/photos/YYYY/MM/<data_local>_<id>.jpg`, auto-orientação e thumbnail no ingest.
**Addresses:** peso/medidas com evolução; fotos amarradas ao dia (timeline).
**Avoids:** 9 (compressão/EXIF/dia errado).

### Fase 5: Insights — suplementos/estoque, relatório semanal, dashboard
**Rationale:** o relatório é **o nó mais dependente** (agrega refeições+treinos+suplementos+peso) — por definição o último; o dashboard é read-only e consome tudo já pronto (pode ser puxado para execução paralela a partir da Fase 2 sem bloquear nada, se o roadmap preferir).
**Delivers:** suplementos com **ledger de eventos** (uso/reposição/ajuste/zerado) e aviso de reposição em **dias restantes de suprimento**; `get_weekly_summary` (aderência **por dia contra a meta daquele dia**, dias sem log = "sem registro", nunca 0%); dashboard HTTP read-only (React/Vite/Recharts) sobre o mesmo núcleo — o saldo do dashboard é o mesmo cálculo do WhatsApp; configuração final do Hermes + automação do envio do relatório (lado Hermes).
**Addresses:** suplementos checklist+estoque (diferencial único no segmento); relatório semanal empurrado; dashboard web.
**Avoids:** 10 (estoque sem ledger), 8 (lado relatório), 12 (última chance de creep antes do uso real).

### Phase Ordering Rationale

- **Dependências de features mandam a ordem:** catálogo → registro+saldo → metas → fases; relatório depende de 4 domínios (por isso último); dashboard conflita com nada (read-only, paralelizável).
- **Riscos de confiança concentram-se na Fase 1 de propósito:** eco, idempotência, fuso, seed TACO, backup e desenho de tools são decisões de schema/contrato — baratas na Fase 1, altíssimo custo depois (PITFALLS: recovery cost HIGH só para o fuso).
- **Agrupamento espelha a arquitetura:** cada fase adiciona módulos em `src/domain/` + arquivo de tools + rotas de leitura; nenhuma fase reescreve a anterior.
- **Uso diário real o quanto antes:** ao fim da Fase 2 o usuário já consegue viver no sistema (TACO + OFF + correções); Fases 3–5 evoluem por atrito sentido, não por imaginação — antídoto direto ao scope creep.

### Research Flags

Fases que provavelmente precisam de pesquisa adicional no planning:
- **Fase 1:** spike de **transporte/compatibilidade do Hermes** (stdio vs Streamable HTTP; SDK v2 vs v1) — única incerteza técnica real do projeto, e o dataset **TACO** (nenhuma conversão canônica verificada; validar `brolesi/taco` — colunas kcal/kJ, encoding, medidas caseiras). Recomendação: resolver como spike no início da fase, sem `/gsd:plan-phase --research-phase` completo.

Fases com padrões consolidados (dispensam research-phase):
- **Fase 2:** API do Open Food Facts documentada oficialmente e já verificada ao vivo (gotchas conhecidos: kJ, `_100g`, nulls, cru-vs-cozido) — validar com produtos BR reais durante a execução.
- **Fases 3, 4 e 5:** CRUD/agregação sobre schema próprio, SQLite WAL, dashboard React/Recharts e fotos em filesystem — padrões bem documentados; as armadilhas específicas já estão catalogadas em PITFALLS.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Versões e engines verificadas via `npm view` no dia da pesquisa; docs oficiais MCP/SQLite/OFF lidas integralmente; matriz de compatibilidade resolvida (única condição: Node >= 22, satisfeito na máquina local) |
| Features | MEDIUM | Categoria validada por múltiplas fontes de produto consistentes entre si, mas várias são vendor marketing (MacroFactor) ou páginas de venda (trackers WhatsApp BR) |
| Architecture | HIGH (núcleo) / MEDIUM (tool surface, data model) | Deriva diretamente da spec MCP 2026-07-28, sqlite.org (WAL/backup) e docs OFF; tool surface e esqueleto do data model são consenso de domínio; dataset TACO: LOW |
| Pitfalls | MEDIUM | Claims-chave verificadas em fontes primárias (API OFF testada ao vivo, guia Anthropic de tools, estudo NIH jul/2026, docs SQLite); princípios de inventário/estoque ficaram LOW |

**Overall confidence:** MEDIUM-HIGH — pronto para o roadmap; as incertezas restantes são localizadas e têm plano de resolução (gaps abaixo).

### Gaps to Address

- **Transporte MCP do Hermes (stdio vs Streamable HTTP; SDK v2 vs v1):** resolução via spike no início da Fase 1; o núcleo de domínio e as tools não mudam em nenhum cenário (~5 linhas de entrypoint).
- **Modelo de processos (1 processo HTTP vs 2 processos stdio+dashboard):** discrepância entre STACK.md e ARCHITECTURE.md; mesmo seam — decidir junto com o spike; em qualquer cenário o dashboard vive independente do Hermes.
- **Dataset TACO:** nenhuma conversão canônica verificada (fonte oficial é PDF/XLSX); usar dataset estruturado versionado no repo (recomendado: `brolesi/taco`, MIT, atualizado 2026-09) + testes de sanidade no seed; confirmar que o dataset inclui a coluna de medidas caseiras em gramas (dependência do pitfall 4).
- **Granularidade das tools:** ARCHITECTURE.md sugere ~18 agrupadas; PITFALLS.md (guia Anthropic) mira 8–12 por workflow. Resolver no planning consolidando por workflow (toda escrita já retorna o saldo); nomes ASCII sem acento — escolher convenção pt (`registrar_refeicao`) ou en (`log_meal`) e manter.
- **Dois table stakes fora do PROJECT.md:** editar/remover registro e repetir refeição anterior devem ser adicionados ao Active antes da definição de requisitos (custo irrisório, valor alto).
- **Agendamento do relatório semanal:** o envio é lado Hermes (fora do escopo); definir o contrato de `get_weekly_summary` (payload JSON) com o setup real do Hermes durante a Fase 5.
- **Mídia WhatsApp via Hermes:** compressão/EXIF são comportamento do WhatsApp, mas o que o Hermes expõe (`msg.timestamp`, staging de arquivos) precisa ser confirmado na Fase 4.

## Sources

### Primary (HIGH confidence)
- Model Context Protocol — spec 2026-07-28: Architecture, Transports, Tools (annotations, `structuredContent`, `isError`, naming, stateless), desprecação de sampling/logging/HTTP+SSE — modelcontextprotocol.io
- SDK TypeScript MCP v2 — github.com/modelcontextprotocol/typescript-sdk (pacotes, `McpServer`/`registerTool`, Zod v4, janela de manutenção da v1)
- SQLite oficial — sqlite.org: WAL (concorrência multi-processo, `.db` sozinho não é backup), `VACUUM INTO`/online backup API, `node:sqlite` só RC no Node 25.7
- Open Food Facts — docs oficiais da API + verificação ao vivo de produto (campos `energy` em kJ, `energy-kcal_100g`, `_serving`, modificador `~`, `nutrition_data_prepared_per`); rate limits 15/10 req/min; User-Agent obrigatória; ODbL
- Registro npm (2026-09-23, `npm view`): versões/engines de todas as packages recomendadas

### Secondary (MEDIUM confidence)
- Anthropic — "Writing effective tools for agents": tools por workflow, descrições como maior alavancagem, erros acionáveis, respostas de alto sinal
- Estudo NIH (jul/2026) via EurekAlert/ScienceDaily/News-Medical: apps de IA subestimam ~250–345 kcal/refeição (~1/3)
- MacroFactor (oficial): fricção de log como eixo competitivo, rejeição a "comer de volta", trend weight, review semanal — cross-checked com agregadores
- ZapDieta, ContaCal, Gluti, kcalm, CaloriChat: categoria de tracking via WhatsApp (validação de mercado)
- Re:Stock/SuppCo, Hevy/Strong, Happy Scale/Libra: nichos de suplemento, treino e peso que ancoram os diferenciais
- Comparações Recharts vs Chart.js 2026 (LogRocket, FusionCharts, Querio)

### Tertiary (LOW confidence — validar na execução)
- Dataset TACO: `brolesi/taco` (MIT, 2026-09) e `marcelosanto/tabela_taco` inspecionados via API do GitHub, mas nenhuma conversão canônica certificada — validar colunas/encoding/medidas caseiras no seed
- Princípios de inventário/ledger e days-of-supply para estoque de suplementos (busca rate-limited; tratar como princípio de design)
- Práticas IIFYM/weekly tracking (RippedBody; corroboradas indiretamente)

---
*Research completed: 2026-09-23*
*Ready for roadmap: yes*
