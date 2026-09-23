# Requirements: Flex Diet

**Defined:** 2026-09-23
**Core Value:** A qualquer momento, mandar o que comeu no WhatsApp e receber de volta quanto falta de calorias e macros no dia — com o mínimo de atrito.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Registro de Refeições

- [x] **REG-01**: User registra o que comeu por mensagem em linguagem natural ("almocei arroz, feijão e frango") e a refeição é logada com os macros debitados
- [x] **REG-02**: Todo registro responde com o saldo restante do dia (calorias, proteína, carbo, gordura) junto dos itens debitados + gramas + fonte (TACO / Open Food Facts / estimativa)
- [ ] **REG-03**: User pode editar ou remover um registro feito, por mensagem
- [ ] **REG-04**: User pode repetir uma refeição de dia anterior ("repetir almoço de ontem")
- [x] **REG-05**: Registro retroativo ("ontem jantei X") cai no dia correto
- [ ] **REG-06**: Mensagem repetida/reenviada (retry do canal) não duplica registro (idempotência)

### Catálogo de Alimentos

- [x] **ALIM-01**: Catálogo próprio com valores por 100g semeado com a tabela TACO, com teste de sanidade no import (banana ≈ 89 kcal/100g; se vier ~372, é kJ)
- [ ] **ALIM-02**: Consulta ao Open Food Facts por código de barras (produto industrializado)
- [ ] **ALIM-03**: Consulta ao Open Food Facts por nome do produto
- [ ] **ALIM-04**: Resultado de consulta externa é cacheado automaticamente no catálogo, com fonte e data da consulta
- [ ] **ALIM-05**: Alimento fora do catálogo: Hermes estima os macros (rotulado como estimativa) e pode salvar o alimento no catálogo
- [ ] **ALIM-06**: Busca de alimento retorna as equivalências de medidas caseiras em gramas (dados da TACO) para o Hermes declarar a premissa usada

### Metas e Fases

- [x] **META-01**: Metas diárias fixas de calorias + macros, ajustáveis por mensagem ("meta 1800kcal")
- [ ] **META-02**: Fases de cutting/bulk/manutenção, cada uma com período e conjunto próprio de metas
- [ ] **META-03**: Troca de fase por mensagem; fim de fase sem próxima definida → sistema pergunta o que fazer, nunca assume
- [ ] **META-04**: Aderência de cada dia é calculada contra a meta vigente naquele dia (metas como histórico por data)

### Treinos

- [ ] **TREINO-01**: Registro de musculação simples: data + grupos musculares ("treinei peito e tríceps"), sem duração
- [ ] **TREINO-02**: Registro de cardio como atividade simples (tipo + data), sem alterar as metas do dia

### Corpo

- [ ] **CORPO-01**: Registro de peso corporal
- [ ] **CORPO-02**: Registro de medidas (cintura, braço etc.)
- [ ] **CORPO-03**: Foto de progresso enviada pelo WhatsApp é arquivada com data e amarrada ao peso/medidas do dia; visualizável em linha do tempo

### Suplementação

- [ ] **SUPLE-01**: Checklist diário de suplementos (creatina, whey, vitaminas...) com aderência na semana
- [ ] **SUPLE-02**: Controle de estoque via ledger de eventos (uso/reposição/ajuste) com aviso de reposição em dias restantes de suprimento

### Rotina e Relatórios

- [ ] **RELAT-01**: Refeições padrão (presets): salvar combinação repetida ("café da manhã de sempre") e registrar com um comando, retornando o saldo
- [ ] **RELAT-02**: Relatório semanal: aderência de macros por dia (dias sem log = "sem registro", nunca 0%), treinos da semana, suplementos — payload gerado pelo MCP; envio é feito pelo Hermes

### Dashboard

- [ ] **DASH-01**: Página web simples, read-only, com gráficos do dia/semana (macros, peso, treinos) servidos localmente
- [ ] **DASH-02**: Linha do tempo de fotos de progresso no dashboard

### Núcleo Técnico

- [ ] **INFRA-01**: Servidor MCP com ferramentas semânticas de domínio, exposto via Streamable HTTP na VPS e consumido pelo Hermes por URL, com endpoints protegidos por token; verificar a era do SDK (v2 vs v1) que o Hermes negocia no primeiro contato
- [x] **INFRA-02**: SQLite local em modo WAL; migrations versionadas rodadas no boot com backup automático antes de cada migration
- [x] **INFRA-03**: Datas gravadas na escrita como `timestamp_utc` + `data_local` (America/Sao_Paulo); saldo derivado em leitura por uma única implementação
- [x] **INFRA-04**: Dados e fotos 100% na VPS pessoal do usuário (sem nuvem de terceiros)
- [ ] **INFRA-05**: Merge na `main` no GitHub dispara deploy automático na VPS (GitHub Actions + SSH): a versão nova do serviço sobe sem intervenção manual

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Consultas

- **CONS-01**: "Posso comer X?" — simulação de saldo contra uma refeição hipotética (top candidato a v2; tool barata)

### Treino

- **TREI-01**: Log detalhado de musculação: exercícios, séries, repetições, cargas, com progressão
- **TREI-02**: Trend weight (média móvel ~7 dias) nos gráficos

### Extras

- **EXTR-01**: Controle de água
- **EXTR-02**: Quick-add de kcal sem itens
- **EXTR-03**: Lembretes proativos (refeição não registrada, suplemento do horário)
- **EXTR-04**: Refeições planejadas (montar o dia com antecedência)
- **EXTR-05**: Integrações externas (Google Fit, Garmin etc.)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Bot/infra de WhatsApp | Hermes já existe e é mantido fora deste projeto |
| Multiusuário e autenticação | Sistema pessoal de usuário único |
| Dados pessoais na nuvem | Privacidade: peso, medidas e fotos ficam locais |
| Cardio ajustando metas ("comer de volta") | Decisão do usuário; estimativas de gasto erram demais |
| Micronutrientes | v1 é de macros; micro é expansão futura sem decisão |
| Gamificação (streaks, pontos) | Fora da visão do produto |
| Parser de linguagem natural no servidor | Interpretação é papel do LLM do Hermes; servidor é determinístico |

## Traceability

Which phases cover which requirements. Updated during roadmap creation (2026-09-23).

| Requirement | Phase | Status |
|-------------|-------|--------|
| REG-01 | Phase 1 | Complete |
| REG-02 | Phase 1 | Complete |
| REG-03 | Phase 1 | Pending |
| REG-04 | Phase 1 | Pending |
| REG-05 | Phase 1 | Complete |
| REG-06 | Phase 1 | Pending |
| ALIM-01 | Phase 1 | Complete |
| ALIM-06 | Phase 1 | Pending |
| META-01 | Phase 1 | Complete |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Pending |
| ALIM-02 | Phase 2 | Pending |
| ALIM-03 | Phase 2 | Pending |
| ALIM-04 | Phase 2 | Pending |
| ALIM-05 | Phase 2 | Pending |
| META-02 | Phase 3 | Pending |
| META-03 | Phase 3 | Pending |
| META-04 | Phase 3 | Pending |
| TREINO-01 | Phase 3 | Pending |
| TREINO-02 | Phase 3 | Pending |
| RELAT-01 | Phase 3 | Pending |
| CORPO-01 | Phase 4 | Pending |
| CORPO-02 | Phase 4 | Pending |
| CORPO-03 | Phase 4 | Pending |
| SUPLE-01 | Phase 5 | Pending |
| SUPLE-02 | Phase 5 | Pending |
| RELAT-02 | Phase 5 | Pending |
| DASH-01 | Phase 5 | Pending |
| DASH-02 | Phase 5 | Pending |

**Coverage:**

- v1 requirements: 32 total
- Mapped to phases: 32
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-23*
*Last updated: 2026-09-23 — hospedagem na VPS + deploy contínuo (INFRA-01/04 ajustados, INFRA-05 adicionado; cobertura 32/32)*
