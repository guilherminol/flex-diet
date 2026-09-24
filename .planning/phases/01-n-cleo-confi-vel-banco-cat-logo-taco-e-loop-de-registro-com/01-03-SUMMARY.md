---
phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com
plan: 03
subsystem: api
tags: [mcp, sqlite, dedupe, idempotencia, sha256, correcao, vitest]

# Dependency graph
requires:
  - phase: 01-01
    provides: loop "registrei → saldo" (registrarRefeicao transacional, calcularSaldo, id_curto, factory de tools MCP, migrations/seed em db temporário de teste)
  - phase: 01-02
    provides: catálogo TACO com busca (alimento_id estável) e padrão de tool de consulta
provides:
  - dedupeHash — sha256 do payload canônico {data_local + itens ordenados por alimento_id, gramas a 1 casa} (D-07)
  - registrarRefeicao com checar-e-inserir de dedupe NA MESMA transação do INSERT; retry dentro de 10 min responde o registro ORIGINAL + saldo + duplicado: true (D-08)
  - listarRegistros / editarRegistro (substituição COMPLETA atômica, move de dia com saldo dos DOIS dias) / removerRegistro — correção trivial por id_curto (REG-03, D-06)
  - repetirRefeicao — reloga refeição de dia anterior com macros recomputados do catálogo e id_curto novo; ambiguidade vira refeicao_ambigua com candidatos (REG-04)
  - Tools MCP listar_registros (readOnlyHint), editar_registro, remover_registro (destructiveHint), repetir_refeicao — 8 de 8 tools da fase ativas
affects: [01-05, phase-02]

# Actuals (#2632) — emparelha com o `estimate` do plan (50000 tokens, 3 tasks)
actuals:
  tokens: 13105    # chars/4 sobre o diff realizado (52420 chars)
  tasks: 3
  commits: 4
commits: 4
plan_head_before: c79be836147b4932863071245dc083fd65c719ff

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Checar-e-inserir do dedupe DENTRO da transação síncrona do INSERT (closure better-sqlite3 serializa) — nenhuma escrita entre consultar e inserir"
    - "Janela temporal comparando ISO-UTC com ISO-UTC (cutoff calculado em JS) — datetime('now') do SQLite produz formato que compara errado contra timestamp_utc ISO com 'T'"
    - "Substituição completa de itens mantém o dedupe_hash da linha recalculado — o hash sempre reflete o conteúdo"
    - "repetirRefeicao REUSA registrarRefeicao (validação/snapshot/id_curto/dedupe num lugar só) em vez de duplicar a regra de inserção"
    - "Regra de débito unificada: carregarAlimentos + debitarItens compartilhados por registrar/editar/repetir"

key-files:
  created:
    - "src/lib/dedupe.ts (dedupeHash canônico + inicioDaJanela)"
    - "src/mcp/tools/registros.ts (listar_registros, editar_registro, remover_registro, repetir_refeicao)"
    - "tests/dedupe.test.ts (9 testes)"
    - "tests/refeicoes.test.ts (13 testes)"
  modified:
    - "src/domain/refeicoes.ts (dedupe no registrar + listar/editar/remover/repetir + helpers compartilhados)"
    - "src/mcp/server.ts (8 de 8 tools registradas)"
    - "tests/http.test.ts (tools/list afirma as 8 tools + annotations)"

key-decisions:
  - "Janela de dedupe via cutoff ISO-UTC parametrizado em vez do literal datetime('now','-10 minutes') do plan: o formato 'YYYY-MM-DD HH:MM:SS' do SQLite comparado lexicograficamente contra timestamp_utc ISO com 'T' sempre sai menor no mesmo dia — a janela vazaria e o teste de 11 min do próprio plan falharia"
  - "refeicao_ambigua para QUALQUER seletor com >1 candidato (inclusive sem tipo_refeicao informado) — a regra do plan citava só o caso com tipo; 'nunca escolha silenciosa' (critério de done) generaliza"
  - "editarRegistro recalcula o dedupe_hash da linha junto com a substituição — retry do payload ANTIGO pós-edição não pode casar com o conteúdo novo"
  - "Repetição carrega o tipo_refeicao da origem para o registro novo (o Hermes pediu 'repetir o almoço' — o novo também é almoço)"
  - "Repetir 2x o mesmo payload para o mesmo dia dentro da janela deduplica de propósito — retry de canal de repetir_refeicao também não duplique débito (espírito do REG-06; a nota do plan sobre 'repetir 2x = 2 registros' vale fora da janela)"

patterns-established:
  - "Testes de escrita usam UM dia fixo por teste — dedupe de 10 min pega payload idêntico no mesmo dia entre testes (comportamento de prod)"
  - "Tool destrutiva: destructiveHint: true + confirmação e saldo na mesma resposta"

requirements-completed: [REG-03, REG-04, REG-06]

coverage:
  - id: D1
    description: "Dedupe canônico (REG-06, D-07/D-08): hash ordenado por alimento_id e gramas a 1 casa; reenvio idêntico (ou com ordem trocada) dentro de 10 min NÃO duplica e responde o registro original + saldo + duplicado: true; fora da janela ou com gramas diferentes cria novo; checar-e-inserir atômico na mesma transação; dedupe_hash gravado na linha"
    requirement: REG-06
    verification:
      - kind: unit
        ref: "tests/dedupe.test.ts#ordem dos itens não muda o hash"
        status: pass
      - kind: unit
        ref: "tests/dedupe.test.ts#gramas 150 e 150.04 produzem o mesmo hash (arredondamento a 1 casa)"
        status: pass
      - kind: unit
        ref: "tests/dedupe.test.ts#reenvio idêntico dentro de 10 min NÃO insere: devolve o registro original + saldo + duplicado true"
        status: pass
      - kind: unit
        ref: "tests/dedupe.test.ts#reenvio com itens em ordem trocada também deduplica"
        status: pass
      - kind: unit
        ref: "tests/dedupe.test.ts#fora da janela (original retroagido 11 min) insere registro NOVO"
        status: pass
      - kind: unit
        ref: "tests/dedupe.test.ts#payload com gramas diferentes não é retry — insere registro novo"
        status: pass
      - kind: unit
        ref: "tests/dedupe.test.ts#registro novo grava o dedupe_hash na linha (consulta temporal, não unique)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Correção trivial por id_curto (REG-03, D-06): listar mostra ids/itens/kcal_total do dia; editar substitui os itens por completo (valida antes de apagar) e o saldo recalcula na mesma resposta; remover exclui com cascade e o saldo volta ao estado anterior na hora; id inexistente → registro_nao_encontrado com dica de listar; editar com data move o registro entre dias com saldo dos DOIS dias consistente"
    requirement: REG-03
    verification:
      - kind: unit
        ref: "tests/refeicoes.test.ts#lista os registros do dia com id_curto, itens e kcal_total"
        status: pass
      - kind: unit
        ref: "tests/refeicoes.test.ts#substitui os itens por completo e o saldo reflete na MESMA resposta"
        status: pass
      - kind: unit
        ref: "tests/refeicoes.test.ts#editar com alimento inexistente NÃO deixa o registro vazio (valida antes de apagar)"
        status: pass
      - kind: unit
        ref: "tests/refeicoes.test.ts#remove e o saldo volta ao estado anterior NA HORA"
        status: pass
      - kind: unit
        ref: "tests/refeicoes.test.ts#editar com id inexistente → registro_nao_encontrado com dica de listar"
        status: pass
      - kind: unit
        ref: "tests/refeicoes.test.ts#remover com id inexistente → registro_nao_encontrado"
        status: pass
      - kind: unit
        ref: "tests/refeicoes.test.ts#saldo dos DOIS dias sai consistente na mesma resposta"
        status: pass
    human_judgment: false
  - id: D3
    description: "repetir_refeicao (REG-04): reloga a refeição do dia anterior com os mesmos pares alimento+gramas, macros RECOMPUTADOS do catálogo atual e id_curto novo; origem por id_curto (vence) ou único registro do tipo; origem inexistente → erro estruturado; ambiguidade → refeicao_ambigua com candidatos; data_destino retroativa cai no dia correto"
    requirement: REG-04
    verification:
      - kind: unit
        ref: "tests/refeicoes.test.ts#repete a refeição de dia anterior p/ hoje: mesmos itens/gramas, id_curto NOVO e saldo do dia destino atualizado"
        status: pass
      - kind: unit
        ref: "tests/refeicoes.test.ts#repetição RECOMPUTA macros do catálogo atual (não copia o snapshot antigo)"
        status: pass
      - kind: unit
        ref: "tests/refeicoes.test.ts#origem inexistente → registro_nao_encontrado estruturado"
        status: pass
      - kind: unit
        ref: "tests/refeicoes.test.ts#dois registros do mesmo tipo na origem sem id_curto → refeicao_ambigua com candidatos"
        status: pass
      - kind: unit
        ref: "tests/refeicoes.test.ts#repetir com data_destino retroativa cai no dia correto"
        status: pass
      - kind: unit
        ref: "tests/refeicoes.test.ts#id_curto_origem vence o filtro por tipo e resolve a ambiguidade"
        status: pass
    human_judgment: false
  - id: D4
    description: "8 de 8 tools da fase registradas e visíveis em tools/list, com annotations corretas (listar/consultar readOnly; remover destructiveHint)"
    requirement: REG-03
    verification:
      - kind: integration
        ref: "tests/http.test.ts#tools/list lista as 8 tools da fase com annotations corretas"
        status: pass
    human_judgment: false

# Metrics
duration: 24 min
completed: 2026-09-24
status: complete
---

# Phase 1 Plan 3: Correção, repetir e idempotência Summary

**Dedupe canônico atômico (sha256 ordenado + janela 10 min) integrado ao registrar + 4 tools de correção/repetição por id_curto — 8 de 8 tools da fase ativas, suíte 68/68 verde**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-24T02:19:19Z (23:19 local)
- **Completed:** 2026-09-24T02:44:14Z (23:44 local)
- **Tasks:** 3
- **Files modified:** 7 (4 criados, 3 modificados)

## Accomplishments

- Idempotência de reenvio provada (REG-06, D-07/D-08): payload idêntico (ou com ordem trocada / 150 vs 150.04) dentro de 10 min NÃO duplica — responde o registro ORIGINAL + saldo + `duplicado: true`; fora da janela (11 min testados) cria novo; o checar-e-inserir acontece na MESMA transação síncrona do INSERT
- Correção trivial (REG-03, D-06): `listar_registros` mostra os ids do dia; `editar_registro` substitui os itens por completo de forma atômica (valida antes de apagar — alimento inválido não deixa o registro vazio) e devolve o saldo recalculado na mesma resposta; `remover_registro` (destructiveHint) exclui com cascade e o saldo volta ao estado anterior na hora; id inexistente → `registro_nao_encontrado` com dica de listar
- `repetir_refeicao` (REG-04): reloga a refeição de dia anterior com macros RECOMPUTADOS do catálogo atual (testado com "atualização" do catálogo: novo registro usa 100 kcal/100g enquanto o snapshot da origem permanece 86,8) e id_curto novo; ambiguidade vira `refeicao_ambigua` com a lista de id_curtos — nunca escolha silenciosa
- 8 de 8 tools da fase registradas; o teste http agora afirma o total e as annotations (listar readOnly, remover destructive)
- Saldo continua derivado em leitura pela ÚNICA implementação (calcularSaldo) — presente em TODAS as respostas de escrita; nenhum saldo armazenado

## Task Commits

Cada task foi commitada atomicamente (Task 1 em TDD — RED e GREEN separados):

1. **Task 1 (RED): casos de dedupe canônico e janela de 10 min** - `3edb6bc` (test)
2. **Task 1 (GREEN): dedupe canônico atômico em registrarRefeicao** - `e06cbf4` (feat)
3. **Task 2: listar/editar/remover por id_curto** - `6c05892` (feat)
4. **Task 3: repetir_refeicao com macros recomputados** - `53698ec` (feat)

## Files Created/Modified

- `src/lib/dedupe.ts` - dedupeHash (payload canônico: itens ordenados por alimento_id, gramas a 1 casa, sem tipo/timestamp) + inicioDaJanela (cutoff ISO-UTC)
- `src/domain/refeicoes.ts` - dedupe checar-e-inserir na transação do registrar; listarRegistros, editarRegistro, removerRegistro, repetirRefeicao; helpers compartilhados validarItens/carregarAlimentos/debitarItens
- `src/mcp/tools/registros.ts` - 4 tools: listar_registros (readOnlyHint), editar_registro (substituição total documentada), remover_registro (destructiveHint), repetir_refeicao
- `src/mcp/server.ts` - 8 de 8 tools registradas no factory
- `tests/dedupe.test.ts` - 9 testes (hash canônico + janela + gravação do hash)
- `tests/refeicoes.test.ts` - 13 testes (listar/editar/remover/ids inexistentes/mover de dia/repetir)
- `tests/http.test.ts` - tools/list afirma as 8 tools + annotations

## Decisions Made

- **Janela por ISO-UTC parametrizado** em vez do literal `datetime('now','-10 minutes')`: o SQLite produz "YYYY-MM-DD HH:MM:SS" e a comparação de string contra timestamp_utc ISO com 'T' sempre sai menor no mesmo dia ('T' > ' ') — a janela vazaria e o teste de 11 min do próprio plan falharia. Cutoff calculado em JS no mesmo formato ISO (strings de mesmo comprimento comparam cronologicamente correto)
- **refeicao_ambigua generalizada**: vale para qualquer seletor com >1 candidato (inclusive quando o Hermes não informa tipo_refeicao) — "nunca escolha silenciosa" é o critério de done
- **editarRegistro recalcula o dedupe_hash** da linha: o hash sempre reflete o conteúdo atual; retry do payload antigo pós-edição cria registro novo (o conteúdo antigo não existe mais)
- **Repetição carrega o tipo da origem** para o novo registro e **deduplica de propósito** quando o mesmo payload é repetido 2x no mesmo dia dentro da janela (retry de canal de repetir_refeicao não pode duplicar débito)
- **Regra de débito unificada** em `carregarAlimentos`/`debitarItens`: registrar, editar e repetir compartilham a mesma implementação de snapshot — zero duplicação da regra

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A consulta de janela literal do plan compararia timestamps em formatos diferentes**
- **Found during:** Task 1 (análise do comportamento exigido — teste de 11 min)
- **Issue:** `timestamp_utc >= datetime('now', '-10 minutes')` compara o ISO armazenado ("2026-09-24T02:08:19.000Z") com o formato do SQLite ("2026-09-24 02:09:19") lexicograficamente; como 'T' > ' ', QUALQUER registro do mesmo dia entraria na janela — o retry de horas atrás seria tratado como duplicado
- **Fix:** cutoff calculado em JS (`new Date(agoraMs - 10*60*1000).toISOString()`) e passado como parâmetro — mesmo formato/comprimento do timestamp_utc, comparação cronologicamente correta; documentado no código (src/lib/dedupe.ts)
- **Files modified:** src/lib/dedupe.ts
- **Verification:** teste "fora da janela (original retroagido 11 min) insere registro NOVO" verde
- **Committed in:** e06cbf4

**2. [Rule 2 - Missing Critical] editarRegistro deixaria o dedupe_hash desatualizado**
- **Found during:** Task 2 (desenho da substituição de itens)
- **Issue:** substituir os itens sem recalcular o dedupe_hash deixaria o hash apontando para um conteúdo que não existe mais; um retry do payload antigo casaria com a linha editada e responderia o conteúdo NOVO como "original"
- **Fix:** UPDATE grava `dedupeHash(novaData, itens)` junto com a substituição, na mesma transação
- **Files modified:** src/domain/refeicoes.ts
- **Verification:** suíte verde (invariante coberta pela gravação testada em tests/dedupe.test.ts)
- **Committed in:** 6c05892

---

**Total deviations:** 2 auto-fixed (2 bugs/correções de corretude — Rule 1 e Rule 2)
**Impact on plan:** Ambas necessárias para a corretude do REG-06; nenhum escopo adicional.

## Issues Encountered

- O dedupe de 10 min (comportamento do Task 1) pegou payloads idênticos registrados no MESMO dia fixo por testes diferentes de tests/refeicoes.test.ts — resolvido dando um dia fixo distinto para cada teste (padrão documentado no arquivo); em produção é exatamente o comportamento desejado

## User Setup Required

None - nenhuma configuração de serviço externo exigida por este plan.

## Next Phase Readiness

- Contratos de confiança do loop fechados e provados: eco+saldo (01-01), correção trivial, repetir, retroativo, reenvio sem duplicar — critérios 1 e 2 do ROADMAP cobertos por testes automatizados
- 8 de 8 tools da fase ativas; resta o plan 01-05 (integração real com o Hermes + checkpoint de 1º contato) — o plan 01-04 segue halted no checkpoint humano do 1º deploy VPS (repo/secrets), independente deste
- Nenhum stub: todas as respostas vêm do banco real; dedupe/editar/repetir operam sobre os mesmos dados do seed TACO

---
*Phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com*
*Completed: 2026-09-24*

## Self-Check: PASSED

- 6/6 arquivos-chave presentes no disco (dedupe.ts, tools/registros.ts, 2 testes novos, refeicoes.ts, server.ts)
- Commits de task verificados no histórico: `3edb6bc` (Task 1 RED), `e06cbf4` (Task 1 GREEN), `6c05892` (Task 2), `53698ec` (Task 3)
- `commits: 4` medido via `git rev-list --count c79be83..HEAD` (ledger do plan)
- Suíte vitest 68/68 verde e `npm run check` limpo re-executados ao final do plan
- Sem deleções de arquivos tracked e sem stubs (todas as respostas vêm do banco real)

