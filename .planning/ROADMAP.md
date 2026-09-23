# Roadmap: Flex Diet

## Overview

O caminho do v1.0 vai do núcleo confiável até o uso diário completo. A Fase 1 entrega o loop de valor central — "registrei o que comi → recebi o saldo restante de macros" — sobre um servidor MCP + SQLite com catálogo TACO semeado, rodando na VPS pessoal do usuário, já nascendo com os contratos que protegem a confiança nos números (eco de item/gramas/fonte, correção trivial, idempotência, datas locais, backup pré-migration). A Fase 2 elimina o atrito dos industrializados com Open Food Facts e cache automático. A Fase 3 cobre a rotina: fases de cutting/bulk com metas históricas, treinos simples e presets. A Fase 4 traz o acompanhamento do corpo (peso, medidas, fotos). A Fase 5 fecha o ciclo com suplementação e estoque, relatório semanal e dashboard web read-only. Cada fase é uma capacidade verificável de ponta a ponta; do fim da Fase 2 em diante o usuário já consegue viver no sistema.

**Cobertura:** 32/32 requisitos v1 mapeados — nenhuma exigência órfã, nenhuma duplicada. Rastreamento completo em `.planning/REQUIREMENTS.md` (seção Traceability).

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Núcleo confiável — banco, catálogo TACO e loop de registro com saldo** - Servidor MCP (Streamable HTTP na VPS) + SQLite WAL + catálogo TACO semeado e o circuito "registrei → saldo restante" com correção e idempotência de primeira classe, publicado por deploy contínuo
- [ ] **Phase 2: Open Food Facts + cache do catálogo** - Produtos industrializados por código de barras ou nome, cache automático no catálogo e estimativa LLM salvável
- [ ] **Phase 3: Rotina — fases, treinos e refeições padrão** - Fases de cutting/bulk/manutenção com metas como histórico por data, treino simples (musculação + cardio) e presets de refeição
- [ ] **Phase 4: Corpo — peso, medidas e fotos** - Registro de peso e medidas e fotos de progresso arquivadas por dia, prontas para linha do tempo
- [ ] **Phase 5: Insights — suplementos, relatório semanal e dashboard** - Checklist + estoque de suplementos com aviso de reposição, relatório semanal e dashboard web read-only

## Phase Details

### Phase 1: Núcleo confiável — banco, catálogo TACO e loop de registro com saldo

**Goal**: O loop de valor central funciona de ponta a ponta via ferramentas MCP — registrar o que comeu debita os macros e devolve o saldo restante do dia, com correção trivial, números em que se pode confiar desde o primeiro dia e deploy automático na VPS a cada merge
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05, ALIM-01, ALIM-06, REG-01, REG-02, REG-03, REG-04, REG-05, REG-06, META-01
**Success Criteria** (what must be TRUE):

  1. Registrar uma refeição com alimentos do catálogo TACO debita calorias e macros, e a resposta traz item + gramas + fonte (TACO) + saldo restante do dia (calorias, proteína, carbo, gordura)
  2. Correção é trivial e confiável: editar ou apagar um registro reflete no saldo na hora, "repetir almoço de ontem" reloga a refeição, registro retroativo ("ontem jantei X") cai no dia correto America/Sao_Paulo e reenvio da mesma mensagem não duplica o registro
  3. Buscar alimento no catálogo retorna valores por 100g e as equivalências de medidas caseiras em gramas; o seed TACO passa no teste de sanidade (banana ≈ 89 kcal/100g — se vier ~372, é kJ)
  4. Ajustar as metas do dia por mensagem ("meta 1800kcal") muda o saldo restante imediatamente
  5. Fundação técnica verificável: servidor MCP exposto via Streamable HTTP na VPS e consumível pelo Hermes por URL com endpoints protegidos por token (era do SDK v2 vs v1 verificada no primeiro contato, com fallback documentado p/ v1), SQLite em WAL com migrations versionadas + backup automático antes de cada migration, datas gravadas como `timestamp_utc` + `data_local`, e deploy automático funcionando — merge na `main` publica a versão nova na VPS via GitHub Actions

**Plans**: 5 plans

Plans:
**Wave 1**

- [ ] 01-01-PLAN.md — Walking Skeleton: loop "registrei → saldo" end-to-end (HTTP MCP + token, SQLite WAL + migrations/backup, seed TACO, datas duplas, definir_metas)

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 01-02-PLAN.md — Catálogo: buscar_alimento com macros por 100g + medidas caseiras (join POF↔TACO inequívoco)
- [ ] 01-04-PLAN.md — Deploy contínuo: Docker/compose no contrato do deploy.yml, backup diário (D-02), 1º deploy real na VPS

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 01-03-PLAN.md — Correção trivial (listar/editar/remover por id_curto), idempotência (dedupe janela 10min) e repetir_refeicao

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 01-05-PLAN.md — Integração Hermes: cliente MCP e2e, era do SDK verificada com fallback v1 documentado, 1º registro real via WhatsApp

### Phase 2: Open Food Facts + cache do catálogo

**Goal**: Produtos industrializados entram no registro sem atrito — por código de barras ou nome — e o catálogo cresce sozinho com o uso
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: ALIM-02, ALIM-03, ALIM-04, ALIM-05
**Success Criteria** (what must be TRUE):

  1. Consultar um produto industrializado por código de barras retorna kcal/macros por 100g normalizados na borda (kJ convertido quando necessário) e o registro sai com fonte "Open Food Facts"
  2. Buscar produto industrializado pelo nome encontra candidatos e permite registrar com o mesmo eco de item + gramas + fonte + saldo
  3. Todo alimento consultado externamente fica cacheado no catálogo com fonte e data da consulta — repetir o produto não depende mais de rede
  4. Alimento fora do catálogo: Hermes estima os macros (rotulados como estimativa) e consegue salvar o alimento no catálogo para os próximos registros

**Plans**: TBD

### Phase 3: Rotina — fases, treinos e refeições padrão

**Goal**: A rotina de cutting/bulk, treinos e refeições repetidas vira comando de uma mensagem — e cada dia é avaliado contra as metas que valiam naquele dia, nunca contra metas de outra fase
**Mode:** mvp
**Depends on**: Phase 1 (Phase 2 não é bloqueante)
**Requirements**: META-02, META-03, META-04, TREINO-01, TREINO-02, RELAT-01
**Success Criteria** (what must be TRUE):

  1. O usuário cria uma fase (cutting/bulk/manutenção) com período e conjunto próprio de metas e troca de fase por mensagem; ao fim de uma fase sem próxima definida, o sistema pergunta o que fazer em vez de assumir metas silenciosamente
  2. A aderência de qualquer dia passado é calculada contra a meta vigente naquele dia (metas mantidas como histórico por data)
  3. "Treinei peito e tríceps" registra musculação com data + grupos musculares; cardio é registrado como atividade simples (tipo + data) sem alterar as metas do dia
  4. Salvar uma combinação repetida como preset ("café da manhã de sempre") e registrá-la com um comando loga todos os itens e devolve o saldo restante

**Plans**: TBD

### Phase 4: Corpo — peso, medidas e fotos

**Goal**: O usuário acompanha a evolução do corpo com o mínimo de atrito: peso, medidas e fotos registrados por mensagem e amarrados ao dia certo
**Mode:** mvp
**Depends on**: Phase 1 (Phase 2 não é bloqueante)
**Requirements**: CORPO-01, CORPO-02, CORPO-03
**Success Criteria** (what must be TRUE):

  1. Registrar peso corporal por mensagem grava o valor com a data correta, inclusive retroativo ("ontem pesei X")
  2. Medidas (cintura, braço etc.) são registradas por mensagem e ficam disponíveis com histórico por data
  3. Foto enviada pelo WhatsApp é arquivada com data canônica da mensagem (nunca EXIF/mtime), amarrada ao peso/medidas do dia e recuperável em ordem cronológica (linha do tempo)

**Plans**: TBD

### Phase 5: Insights — suplementos, relatório semanal e dashboard

**Goal**: O sistema fecha o ciclo: suplementos sob controle de estoque com aviso de reposição, relatório semanal no WhatsApp e um dashboard web na VPS para ver tudo de relance
**Mode:** mvp
**Depends on**: Phase 1, Phase 3, Phase 4
**Requirements**: SUPLE-01, SUPLE-02, RELAT-02, DASH-01, DASH-02
**Success Criteria** (what must be TRUE):

  1. Marcar o checklist diário de suplementos (creatina, whey, vitaminas...) registra o uso e mostra a aderência da semana
  2. O estoque de cada suplemento é movido por ledger de eventos (uso/reposição/ajuste) e o sistema avisa quantos dias restam de suprimento quando o pote está acabando
  3. O relatório semanal (payload gerado pelo MCP; envio é feito pelo Hermes) traz aderência de macros por dia — dias sem log aparecem como "sem registro", nunca 0% — mais treinos da semana e suplementos, cada dia contra a meta vigente naquele dia
  4. O dashboard web (na VPS) read-only mostra gráficos do dia/semana (macros, peso, treinos) com o mesmo saldo calculado pelo núcleo que responde no WhatsApp
  5. A linha do tempo de fotos de progresso é visível no dashboard junto da evolução de peso/medidas

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Núcleo confiável | 0/5 | Not started | - |
| 2. Open Food Facts + cache | 0/TBD | Not started | - |
| 3. Rotina (fases, treinos, presets) | 0/TBD | Not started | - |
| 4. Corpo (peso, medidas, fotos) | 0/TBD | Not started | - |
| 5. Insights (suplementos, relatório, dashboard) | 0/TBD | Not started | - |
