---
phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com
plan: 02
subsystem: api
tags: [mcp, sqlite, taco, pof, medidas-caseiras, busca, csv, vitest]

# Dependency graph
requires:
  - phase: 01-01
    provides: catálogo TACO semeado (seed idempotente), tabela medida_caseira no schema, factory de tools MCP, padrão de testes com db temporário
provides:
  - Tool MCP buscar_alimento: top-5 candidatos com kcal/proteina_g/carbo_g/gordura_g POR 100g, fonte e medidas_caseiras em gramas (readOnlyHint, structuredContent D-05)
  - Medidas caseiras POF/IBGE vendidas no repo (pof_medidas_caseiras.csv, brolesi/taco v1.7.0 — 11.8k linhas)
  - Join POF→TACO conservador no seed: 2 passadas EXATAS com guarda de unicidade dos dois lados — 92 alimentos TACO com >= 1 medida (724 linhas), cobertura logada no boot
  - Busca acento-insensível: coluna alimento.nome_busca (migration 002) normalizada por lib/texto.ts — "óleo de soja" acha "Óleo, de soja"
affects: [01-03, 01-04, 01-05, phase-02]

# Actuals (#2632) — emparelha com o `estimate` do plan (34000 tokens, 2 tasks)
actuals:
  tokens: 313505    # chars/4 sobre o diff realizado (1254023 chars; dominado pelo pof_medidas_caseiras.csv vendado — 11.8k linhas)
  tasks: 2
  commits: 2
commits: 2
plan_head_before: 36309fa8e3872202a8f92770d09e6382c4a975f8

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Join de datasets por correspondência EXATA em 2 passadas (nome-base único → nome completo normalizado) com guarda de unicidade dos dois lados; ambíguo fica sem match, nunca fuzzy"
    - "Coluna derivada de busca (nome_busca) preenchida pelo seed com a MESMA normalização usada no termo (lib/texto.ts) — fold de acentos sem função SQL custom"

key-files:
  created:
    - "src/db/seed/pof_medidas_caseiras.csv (vendado de brolesi/taco v1.7.0)"
    - "src/domain/alimentos.ts (buscarAlimentos + escaparLike)"
    - "src/mcp/tools/catalogo.ts (tool buscar_alimento)"
    - "src/lib/texto.ts (dobrarTexto, normalizarParaBusca)"
    - "src/db/migrations/002_alimento_nome_busca.sql"
    - "tests/alimentos.test.ts (7 testes)"
  modified:
    - "src/db/seed/seed.ts (join POF + nome_busca + log de cobertura)"
    - "src/mcp/server.ts (registra buscar_alimento — 4ª tool)"
    - "tests/seed.test.ts (+3 testes: medidas, teto, nome_busca)"
    - "tests/migrations.test.ts (count-derived)"

key-decisions:
  - "Join POF→TACO em 2 passadas EXATAS: (1) nome-base idêntico único dos dois lados (78 alimentos); (2) nome completo normalizado idêntico, desempatando bases ambíguas (+14, incluindo Óleo, de soja) — o algoritmo literal de passada única do plan excluía o próprio exemplo-obrigatório do plan"
  - "Busca acento-insensível via coluna nome_busca (lower() do SQLite é ASCII-only e 'açaí'/'óleo' são alimentos comuns do domínio) — normalização única em lib/texto.ts usada pelo seed (coluna) e pela busca (termo)"
  - "Cobertura parcial é contrato: 92/597 alimentos com medidas; o resto responde medidas_caseiras: [] e o Hermes estima com premissa declarada (D-04)"

patterns-established:
  - "Tool de consulta: wrapper fino com zod/v4 + readOnlyHint + structuredContent; zero resultados é resposta normal com lista vazia, nunca erro"
  - "Busca SQL 100% parametrizada: escape de %/_/\\ do termo + ESCAPE '\\' — curinga do usuário casa literal (T-01-07/T-01-08)"

requirements-completed: [ALIM-06]

coverage:
  - id: D1
    description: "Seed popula medida_caseira só por correspondência POF↔TACO inequívoca (2 passadas exatas, guarda de unicidade dos dois lados); CSV POF vendado; gramas inválidos pulados"
    requirement: ALIM-06
    verification:
      - kind: unit
        ref: "tests/seed.test.ts#óleo de soja (272) tem >= 1 medida caseira com gramas > 0 (join POF inequívoco)"
        status: pass
      - kind: unit
        ref: "tests/seed.test.ts#contagem de alimentos com medidas é > 0 e <= 200 (guarda contra join explosivo/fuzzy)"
        status: pass
      - kind: unit
        ref: "tests/seed.test.ts#re-seed não duplica (contagem estável)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Boot loga a cobertura de medidas (92 alimentos com >= 1 medida caseira, 724 linhas — cobertura parcial é resultado válido, RESEARCH Pitfall 3)"
    requirement: ALIM-06
    verification:
      - kind: unit
        ref: "npx vitest run tests/seed.test.ts (stderr: '[seed] pof: 92 alimentos com >= 1 medida caseira (724 linhas de medida)')"
        status: pass
    human_judgment: false
  - id: D3
    description: "buscar_alimento: top-5 por 100g + medidas caseiras em gramas; 'banana' inclui Banana maçã 86–89 kcal/100g; busca acento-insensível ('óleo de soja' acha 'Óleo, de soja')"
    requirement: ALIM-06
    verification:
      - kind: unit
        ref: "tests/alimentos.test.ts#busca 'banana' retorna >= 1 candidato e inclui Banana maçã com 86–89 kcal/100g"
        status: pass
      - kind: unit
        ref: "tests/alimentos.test.ts#busca acento-insensível: 'óleo de soja' e 'açaí' acham os nomes acentuados"
        status: pass
      - kind: unit
        ref: "tests/alimentos.test.ts#candidato com match POF traz >= 1 medida com gramas > 0; sem match traz []"
        status: pass
    human_judgment: false
  - id: D4
    description: "Termo de busca é seguro: curingas %/_ escapados (match literal, nunca a tabela), schema zod min 2/max 100, prepared statement sem interpolação, lista vazia sem erro"
    requirement: ALIM-06
    verification:
      - kind: unit
        ref: "tests/alimentos.test.ts#termo com '%' não expande a busca — só match literal, nunca a tabela (T-01-07)"
        status: pass
      - kind: unit
        ref: "tests/alimentos.test.ts#schema rejeita termo com menos de 2 ou mais de 100 caracteres (T-01-08)"
        status: pass
      - kind: unit
        ref: "tests/alimentos.test.ts#usa prepared statement — termo malicioso não corrompe query nem dados (T-01-07)"
        status: pass
      - kind: unit
        ref: "tests/alimentos.test.ts#busca sem resultado retorna lista vazia sem erro"
        status: pass
    human_judgment: false

# Metrics
duration: 24 min
completed: 2026-09-23
status: complete
---

# Phase 1 Plan 2: Catálogo — busca e medidas caseiras Summary

**Tool buscar_alimento com macros por 100g + 92 alimentos TACO com medidas caseiras POF em gramas (join inequívoco de 2 passadas, guarda de unicidade) e busca acento-insensível sobre nome_busca — suíte 41/41 verde**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-24T01:22:05Z (22:22 local)
- **Completed:** 2026-09-24T01:46:14Z (22:46 local)
- **Tasks:** 2
- **Files modified:** 10 (6 criados, 4 modificados)

## Accomplishments

- Tool MCP `buscar_alimento` ativa (4ª do servidor): top-5 candidatos com id, nome, fonte, macros POR 100g e `medidas_caseiras: [{ descricao, gramas }]` — zero resultados é resposta normal com lista vazia (quem decide é o Hermes)
- Medidas caseiras POF/IBGE vendidas no repo (11.8k linhas) e joinadas ao catálogo TACO por correspondência EXATA com guarda de unicidade dos DOIS lados: 92 alimentos com >= 1 medida (724 linhas), cobertura logada no boot — "arroz" (6 TACOs) e "feijão" (15) ficam de fora DE PROPÓSITO
- Busca funciona como o Hermes vai usar: acento-insensível ("óleo de soja" → "Óleo, de soja"; "açaí" → "Açaí, cru") via coluna `nome_busca` preenchida pelo seed com a mesma normalização do termo (lib/texto.ts)
- SQL 100% parametrizado: `%`/`_`/`\` escapados com `ESCAPE '\'` — curinga do usuário casa literal ("banana%" não expande), schema zod min 2/max 100 (T-01-07/T-01-08)
- Suíte completa 41/41 verde (31 do plan 01 + 10 novos) e `npm run check` limpo

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Medidas caseiras POF no seed — join conservador por nome-base inequívoco** - `8fcb226` (feat)
2. **Task 2: Tool buscar_alimento — top-5 por 100g + medidas caseiras** - `aae661d` (feat)

**Plan metadata:** (commitado junto com este SUMMARY)

## Files Created/Modified

- `src/db/seed/pof_medidas_caseiras.csv` - Medidas caseiras POF/IBGE vendadas (brolesi/taco v1.7.0; header: codigo_alimento, descricao_alimento, descricao_medida, quantidade_g, ...)
- `src/db/seed/seed.ts` - Join POF→TACO em 2 passadas exatas dentro da transação síncrona; upsert por UNIQUE(alimento_id, descricao); preenche nome_busca; loga cobertura no boot
- `src/domain/alimentos.ts` - buscarAlimentos (prepared statement, escape de curingas, top-5, medidas agregadas) + escaparLike
- `src/mcp/tools/catalogo.ts` - Tool buscar_alimento (zod min 2/max 100, readOnlyHint, structuredContent D-05)
- `src/mcp/server.ts` - Registra buscar_alimento no factory (stateless por request)
- `src/lib/texto.ts` - dobrarTexto + normalizarParaBusca (única implementação da normalização)
- `src/db/migrations/002_alimento_nome_busca.sql` - ALTER TABLE alimento ADD COLUMN nome_busca (seed preenche no boot)
- `tests/alimentos.test.ts` - 7 testes: banana 86–89 kcal/100g, acento-insensível, espelho do join, wildcard, schema, lista vazia, injection inofensivo
- `tests/seed.test.ts` - +3 testes: óleo de soja com medidas, teto de 200 alimentos + sem órfãos, nome_busca preenchido
- `tests/migrations.test.ts` - count-derived (não quebra com novas migrations)

## Decisions Made

- **Join em 2 passadas exatas** em vez da passada única do plan: "óleo" tem 6 alimentos TACO e "banana" tem 8 — a guarda de unicidade da passada única excluiria o próprio exemplo-obrigatório do plan ('Óleo, de soja'). A passada 2 (nome completo normalizado idêntico: "OLEO DE SOJA" == "Óleo, de soja") usa a MESMA guarda de unicidade dos dois lados — continua exato, zero fuzzy (medido: 78 + 14 = 92 alimentos, dentro do esperado ~82 e do teto de teste de 200)
- **Busca acento-insensível** via `nome_busca` (migration 002): `lower()` do SQLite é ASCII-only — sem o fold, "óleo"/"açaí" (alimentos comuns do domínio, nomes TACO em Title-case acentuado) não casavam. Normalização única em `lib/texto.ts`, usada pelo seed (coluna) e pela busca (termo)
- **POF mantém parênteses na chave do join** removidos, mas `nome_busca` (busca) mantém o texto entre parênteses — mais palavras pesquisáveis, join idêntico ao medido

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Algoritmo de join do plan excluía o próprio exemplo obrigatório (óleo de soja)**
- **Found during:** Task 1 (medição pré-implementação com script descartável)
- **Issue:** o nome-base "óleo" corresponde a 6 alimentos TACO (babaçu, canola, girassol, milho, pequi, soja) e "banana" a 8 — a guarda "EXATAMENTE 1 alimento TACO por nome-base" da passada única deixaria Óleo, de soja SEM medidas, violando o `<done>`, o must-have e o teste (a) exigidos pelo próprio plan
- **Fix:** join em 2 passadas EXATAS com a mesma guarda de unicidade dos dois lados — passada 1 por nome-base único (78 alimentos), passada 2 por nome completo normalizado idêntico (+14, incluindo Óleo, de soja com 6 medidas); nenhum fuzzy, ambíguo continua sem medida
- **Files modified:** src/db/seed/seed.ts
- **Verification:** tests/seed.test.ts (óleo com medidas; teto 200; idempotência) + busca "óleo de soja" retorna o candidato com medidas
- **Committed in:** 8fcb226 / aae661d

**2. [Rule 1 - Bug] lower() do SQLite é ASCII-only — busca não achava alimentos acentuados**
- **Found during:** Task 2 (probe de dados: busca "óleo" não retornava "Óleo, de soja"; "açaí" não retornava "Açaí, cru")
- **Issue:** nomes TACO são Title-case acentuado; o lower() nativo do SQLite não converte caracteres acentuados, então termos comuns do domínio (óleo, açaí, açúcar) falhavam silenciosamente
- **Fix:** migration 002 adiciona `alimento.nome_busca` (normalizado: minúsculas, sem acentos, vírgulas→espaço) preenchida pelo seed com `normalizarParaBusca` de lib/texto.ts — a busca usa a MESMA função no termo; 100% parametrizado e com escape de curingas mantido
- **Files modified:** src/db/migrations/002_alimento_nome_busca.sql, src/lib/texto.ts, src/db/seed/seed.ts, src/domain/alimentos.ts, tests/alimentos.test.ts, tests/seed.test.ts, tests/migrations.test.ts
- **Verification:** teste de busca acento-insensível verde; seed test trava nome_busca de 272 = "oleo de soja" e zero nulos
- **Committed in:** aae661d

**3. [Rule 3 - Blocking] tests/migrations.test.ts fixava user_version = 1**
- **Found during:** Task 2 (a migration 002 quebraria o teste do plan 01)
- **Issue:** assertivas literais (aplicadas=1, versaoAtual=1) não sobrevivem a novas migrations
- **Fix:** teste tornou-se count-derived (conta os .sql do diretório) — futuras migrations não o tocam
- **Files modified:** tests/migrations.test.ts
- **Verification:** suíte verde com 2 migrations aplicadas e re-run no-op
- **Committed in:** aae661d

---

**Total deviations:** 3 auto-fixed (3 bugs Rule 1/3 — todos necessários para que o comportamento exigido pelo plan funcione de verdade no domínio PT-BR)
**Impact on plan:** Nenhum escopo adicional — o algoritmo de join ficou MAIS fiel ao must-have (óleo de soja com medidas) e a busca cobre o domínio real do Hermes; cobertura do join (92) dentro do esperado (~82) e do guard de teste (<= 200).

## Issues Encountered

- O teste de curinga '%' precisou aceitar match LITERAL: nomes TACO contêm '%' real (ex.: "Margarina ... (65% de lipídeos)") — o plano previa "retorna vazio ou match literal"; o teste afirma que todo hit contém '%' no nome e que o resultado nunca é a tabela inteira
- Nomes POF usam parênteses onde TACO usa vírgulas ("ARROZ (POLIDO, PARBOILIZADO)") e maiúsculas sem acento — as normalizações (dobrarTexto/nomeBaseDe) foram medidas com script descartável ANTES da implementação para não inventar heurística

## User Setup Required

None - nenhuma configuração de serviço externo exigida por este plan (a rede foi usada apenas para clonar o dataset público brolesi/taco; o CSV ficou vendado no repo).

## Next Phase Readiness

- Hermes já consegue resolver nomes → alimento_ids e ver equivalências em gramas para declarar premissas (D-04) — resto dos plans da fase (01-03: correção/listar/repetir; 01-04: Docker/deploy; 01-05: integração + checkpoint Hermes)
- 4 de 8 tools da fase registradas; padrão de wrapper fino, erro estruturado e db temporário de teste reutilizado sem fricção
- Nenhum stub: medidas e macros vêm do banco real; cobertura do join é parcial POR DESIGN e o caso "sem medida" é contrato de primeira classe (medidas_caseiras: [])
- Nota para o verifier: a aderência real da tool ao fluxo do Hermes (escolha do candidato certo a partir de linguagem natural) é validada no checkpoint de integração do plan 01-05

---
*Phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com*
*Completed: 2026-09-23*

## Self-Check: PASSED

- 6/6 arquivos-chave criados presentes no disco (CSV POF, domain/alimentos, tools/catalogo, lib/texto, migration 002, tests/alimentos)
- Commits de task verificados no histórico: `8fcb226` (Task 1), `aae661d` (Task 2)
- `commits: 2` medido via `git rev-list --count 36309fa..HEAD` (ledger do plan)
- Suíte vitest 41/41 verde e `npm run check` limpo re-executados ao final do plan
- Boot log da cobertura capturado: "[seed] pof: 92 alimentos com >= 1 medida caseira (724 linhas de medida)"
