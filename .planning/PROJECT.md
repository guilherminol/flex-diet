# Flex Diet

## What This Is

Sistema pessoal de gestão fitness para uma única pessoa (o próprio dono do projeto), com foco em **dieta flexível** (IIFYM): registrar o que comeu pelo WhatsApp e saber na hora quanto falta de cada macronutriente no dia. Inclui registro de treinos (musculação e cardio), suplementação com controle de estoque, peso/medidas/fotos de progresso, relatório semanal e um dashboard web simples para visualização.

A interface principal é o **WhatsApp via Hermes** (bot já configurado pelo usuário, que consome o sistema como servidor MCP). Nenhum bot é construído neste projeto — o produto é o **servidor MCP + banco de dados + dashboard web leve**.

## Core Value

A qualquer momento, mandar uma mensagem no WhatsApp ("almocei arroz, feijão e frango") e receber de volta quanto falta de calorias, proteína, carbo e gordura no dia — com o mínimo de atrito possível.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Registro de refeições por mensagem em linguagem natural, com débito dos macros e resposta com o saldo restante do dia
- [ ] Catálogo próprio de alimentos (semeado com a tabela TACO) com valores por 100g
- [ ] Consulta a base externa por código de barras e por nome (Open Food Facts) para produtos industrializados
- [ ] Cache automático no catálogo dos alimentos usados com frequência
- [ ] Alimento desconhecido: estimativa via LLM (Hermes) com opção de salvar no catálogo
- [ ] Metas diárias fixas (calorias + macros) ajustáveis por mensagem ("meta 1800kcal")
- [ ] Fases de cutting/bulk/manutenção, cada uma com seu próprio conjunto de metas e período; troca de fase por mensagem; fim de fase sem próxima definida → sistema pergunta em vez de assumir
- [ ] Registro de musculação simples: data + grupos musculares ("treinei peito e tríceps"), sem duração
- [ ] Registro de cardio como atividade simples (tipo/data), **sem** ajustar as metas do dia
- [ ] Peso corporal e medidas (cintura, braço etc.) com evolução no dashboard
- [ ] Progresso por foto: foto enviada pelo WhatsApp, arquivada com data e amarrada ao peso/medidas do dia; linha do tempo no dashboard
- [ ] Relatório semanal automático no WhatsApp: aderência de macros, treinos da semana, suplementos
- [ ] Refeições padrão: salvar combinações repetidas ("café da manhã de sempre") e registrar com um comando
- [ ] Suplementação: checklist diário (creatina, whey, vitaminas...) + controle de estoque com aviso quando o pote estiver acabando
- [ ] Dashboard web simples com gráficos do dia/semana (macros, peso, fotos, treinos)
- [ ] Núcleo técnico: servidor MCP (ferramentas consumíveis pelo Hermes) + banco de dados local (ex.: SQLite)

### Out of Scope

- Bot/infraestrutura de WhatsApp — Hermes já existe e é mantido fora deste projeto
- Multiusuário e autenticação — sistema pessoal de usuário único
- Log detalhado de musculação (exercícios, séries, reps, cargas, progressão) — fica pra v2; estrutura simples deixa evoluir
- Controle de água — preterido pelo usuário em favor da suplementação
- "Posso comer X?" (consulta prévia contra macros restantes) — não selecionado para v1, candidato a v2
- Lembretes/proativas do bot — não selecionado para v1
- Refeições planejadas (montar o dia com antecedência) — não selecionado para v1
- Integrações com apps externos (Google Fit, Garmin etc.) — não selecionado para v1

## Context

- Usuário brasileiro: tabela **TACO** (Tabela Brasileira de Composição de Alimentos, ~600 alimentos in natura, domínio público) é a fonte prioritária do catálogo; **Open Food Facts** (API gratuita, busca por código de barras e nome, muitos produtos BR) cobre industrializados.
- O Hermes (runtime de agente do usuário, já conectado ao WhatsApp) é o **cliente MCP**. A interpretação de linguagem natural das mensagens ("2 colheres de arroz") fica a cargo do LLM do Hermes; o MCP expõe ferramentas semânticas (registrar_refeicao, consultar_saldo, etc.) — não precisa de parser próprio.
- Projeto greenfield, pasta vazia, repositório git recém-inicializado.
- Dados pessoais e sensíveis (peso, fotos do corpo): tudo local, sem multiusuário.

## Constraints

- **Simplicidade**: requisito explícito do usuário — manter o sistema simples de operar e de manter; evitar dependências desnecessárias
- **Interface**: núcleo obrigatoriamente exposto como servidor MCP (ferramentas) para consumo pelo Hermes
- **Região**: base de alimentos prioriza dados brasileiros (TACO / produtos BR no Open Food Facts)
- **Privacidade**: dados e fotos ficam locais; sem nuvem de terceiros para dados pessoais

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Produto = servidor MCP + dashboard; WhatsApp via Hermes pré-existente | Bot já configurado pelo usuário; elimina toda a camada de mensageria do escopo | — Pending |
| Alimentos: catálogo próprio (semeado da TACO) + Open Food Facts (código de barras/nome) + estimativa LLM para desconhecidos | Precisão nos alimentos do dia a dia, zero atrito para industrializados e refeições fora do padrão | — Pending |
| Metas fixas ajustáveis por mensagem (não calculadas pelo sistema) | Usuário define/com nutricionista; sistema só controla o saldo | — Pending |
| Cardio só registra, não ajusta metas | Preferência do usuário | — Pending |
| Musculação: data + grupos musculares, sem duração | Simplicidade; detalhe (séries/reps/carga) fica pra v2 | — Pending |
| Suplementação com controle de estoque e aviso de reposição | Escolha explícita do usuário | — Pending |
| Fases (cutting/bulk) trocam todas as metas; fim de fase cobra próxima definição | Evita assumir metas silenciosamente | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-23 after initialization*
