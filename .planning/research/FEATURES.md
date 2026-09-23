# Pesquisa de Features

**Domínio:** Rastreamento pessoal de dieta flexível (IIFYM) e fitness — chat-first via WhatsApp (Hermes como cliente MCP), usuário único, foco brasileiro
**Pesquisado:** 2026-09-23
**Confiança:** MEDIUM (cross-checked entre múltiplas fontes de produto; ver ressalvas em Fontes)

## Panorama do Ecossistema

O mercado de rastreamento de macros divide-se em três famílias, e o Flex Diet toca as três:

1. **Macro trackers gerais** (MyFitnessPal, MacroFactor, Cronometer, YAZIO, FatSecret, Lose It): a guerra hoje é **fricção de log** e **qualidade do banco de alimentos**. A MacroFactor publica um argumento oficial ("Food Logging Speed Index") de que o MyFitnessPal exige ~1,5x mais ações para registrar os mesmos alimentos — e que velocidade de log é o melhor preditor de adesão de longo prazo. O Cronometer compete por precisão/verificação de dados; o MyFitnessPal por tamanho de base e comunidade.
2. **Trackers conversacionais no WhatsApp** (ZapDieta, ContaCal, Gluti — todos brasileiros e em português; kcalm, CaloriChat, CalorAI — internacionais): categoria **validada e cobrada por assinatura**. Registro por texto em linguagem natural, foto do prato, áudio; resposta imediata com kcal/macros; relatório semanal no próprio chat. Ou seja: a interação central do Flex Diet já é um produto de mercado — o diferencial aqui é ser pessoal, grátis, com dados locais e catálogo TACO-nativo.
3. **Apps de nicho** (Re:Stock e SuppCo para suplementos; Hevy/Strong para treino; Happy Scale/Libra para peso): cada nicho resolve um problema com profundidade que os apps gerais não têm. **Estoque de suplementos com aviso de reposição existe como categoria** (Re:Stock faz contagem regressiva por dose), mas **nenhum macro tracker mainstream tem** — é um diferencial real do Flex Diet.

**Conclusão central:** o split de v1 definido no PROJECT.md é bem alinhado com o mercado. A análise abaixo valida quase tudo, adiciona **duas features table stakes baratas que faltam no escopo** (correção/edição de registros e "copiar de ontem") e confirma que os itens deferidos podem continuar fora.

## Validação do Escopo v1 (Flags para o PROJECT.md)

| Achado | Implicação |
|--------|------------|
| **Editar/remover registro de refeição não está explícito no escopo** | Gap real. Erro de log é inevitável ("registrei 2x", "errei o peso"); todo tracker do mercado tem correção. É barato (é só DELETE/UPDATE + resposta com saldo). Recomendo tornar explícito em Active. |
| **"Copiar de ontem" / "de novo" não está no escopo** | Os presets cobrem refeições fixas, mas o padrão mais comum do mercado é repetir a **refeição anterior imediata** ("almocei igual ontem"). Ainda mais barato que presets. Recomendo para v1 ou v1.x imediato. |
| Cardio não ajusta metas | Decisão correta e alinhada ao estado da arte: a MacroFactor deliberadamente **não** "devolve" calorias de exercício (estimativas de gasto erram ~50%); é um anti-pattern dos apps generalistas. |
| Log simples de treino (data + grupos) | Validado. Consenso da comunidade: registrar só o que muda a próxima decisão; usuário casual abandona log por série. Estrutura deixa evoluir para v2. |
| "Posso comer X?" deferido | OK deferir, mas é **o mais valioso dos deferidos** — no chat é apenas uma consulta hipotética de saldo (tool MCP barata). Primeiro candidato a v2. |
| Água, lembretes gerais, refeições planejadas, integrações | Mercado confirma que são descartáveis para o Core Value (a única notificação com ROI claro — reposição de suplemento — já está no escopo). Manter fora. |
| Dashboard de peso | Sugestão barata: além do peso bruto, mostrar **trend weight** (média móvel de ~7 dias) — é a leitura padrão dos trackers de peso (Happy Scale/MacroFactor), porque o peso diário é ruidoso. v1.x. |

## Feature Landscape

### Table Stakes (Users Expect These)

Ausência faz o produto parecer quebrado. Complexidade estimada para este projeto (MCP + SQLite + dashboard leve; parsing NL delegado ao Hermes).

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Registro de refeição por mensagem + saldo restante do dia (kcal, proteína, carbo, gordura) | É o produto. Todo tracker responde "quanto falta"; no chat é a resposta natural | LOW-MEDIUM | Núcleo: tool MCP `registrar_refeicao` + `consultar_saldo` |
| Catálogo de alimentos com busca e valores por 100g | Banco de alimentos é a base de todo tracker; busca com falha = abandono | MEDIUM | Seed TACO (~600 itens, resolve in natura BR); normalizar nomes/sinônimos |
| Lookup por código de barras para industrializados | Universal (MyFitnessPal, YAZIO etc.); sem ele, produto industrializado dá trabalho | MEDIUM | Open Food Facts v2 API por barcode; ~4M produtos, prefixo 789/790 = Brasil |
| Metas diárias ajustáveis (kcal + 3 macros, livremente) | Dieta flexível define os 4 números; apps que travam customização atrás de paywall são criticados | LOW | Decisão do projeto: metas do usuário, não calculadas |
| **Correção: editar/remover registro** | Erro de log é rotina; sem undo o usuário perde confiança no saldo | LOW | Não está explícito no PROJECT.md — tornar explícito |
| Alimento personalizado + cache de frequentes | Todo tracker permite criar alimento próprio e reaproveita os usados | LOW | Cache automático já no escopo |
| Estimativa LLM **explícita e corrigível** para alimento desconhecido | kcalm (chat) faz grading de confiança por ingrediente; estimativa silenciosa corrói confiança | MEDIUM | Estimativa marcada como tal + opção de salvar no catálogo (já no escopo; reforçar editabilidade) |
| Presets de refeição + **repetir refeição anterior** | Features de QoL universais (favorites/recent/copy); MacroFactor lista todas como "efficiency features"; maior alavanca de adesão | LOW-MEDIUM | Presets no escopo; "igual ontem"/"de novo" é adição barata |
| Peso corporal com evolução | Padrão em 100% dos trackers; âncora do progresso | LOW | Já no escopo |
| Saldo do dia + diário do que foi comido (visível no dashboard e no chat) | "O que comi hoje / quanto falta" é a pergunta nº 1 | LOW | Lista de refeições do dia com macros |
| Visualização mínima de gráficos (dia/semana) | Onde está a evolução; esperado por quem vem de apps | LOW-MEDIUM | Dashboard web leve, read-only |

### Differentiators (Competitive Advantage)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Interface conversacional zero-install via WhatsApp (Hermes) | Categoria validada e **paga** no Brasil (ZapDieta, ContaCal, Gluti cobram assinatura); Flex Diet entrega o mesmo fluxo, grátis, com dados 100% locais | LOW | Já é a arquitetura; nenhuma infra de bot no escopo |
| Catálogo brasileiro nativo: TACO + Open Food Facts + fallback LLM | Apps globais são fracos em comida BR in natura (arroz/feijão, medidas caseiras); TACO é domínio público; OFF cobre industrializados BR | MEDIUM | Fontes já mapeadas (TACO em GitHub: brolesi/taco, raulfdm/taco-api); OFF sob ODbL (atribuição) |
| Fases cutting/bulk/manutenção com metas próprias e troca por mensagem | Apps gerais tratam fase como "program" pago ou não modelam; troca explícita evita suposição silenciosa (o sistema **pergunta** quando a fase acaba) | LOW-MEDIUM | Raro no mercado; modelo de dados: fase = período + conjunto de metas |
| Suplementos: checklist diário + **estoque com aviso de reposição** | Categoria provada (Re:Stock), mas **nenhum macro tracker mainstream tem**; combinação checklist+estoque+relatório é única no segmento | LOW-MEDIUM | Estoque simples: porções restantes − consumo diário previsto = dias restantes |
| Relatório semanal **empurrado** no WhatsApp (aderência, treinos, suplementos, peso) | É o análogo manual do coaching da MacroFactor (cujo valor central é o review semanal); apps deixam o usuário puxar o relatório — empurrar no chat fecha o loop | MEDIUM | Agregador; depende de quase todo o resto; agendamento via Hermes/MCP |
| Foto de progresso amarrada a peso e medidas do mesmo dia | Apps grandes têm fotos, mas como galeria solta; a amarração foto+peso+medidas em linha do tempo é rara | LOW-MEDIUM | Ja no escopo; basta metadado de data compartilhado |
| Núcleo exposto como servidor MCP | Reutilizável por qualquer agente (não só Hermes); nenhum produto do mercado é "headless" assim | LOW | Decisão arquitetural; custo zero extra |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Log detalhado de treino (séries/reps/cargas) em v1 | "Sério" Levantador de peso quer progressive overload | Fricção de entrada por série é o motivo nº 1 de abandono de workout log entre casuais; Hevy/Strong já dominam o segmento detalhado | Manter data + grupos (v1); schema extensível; v2 avalia séries/reps |
| "Comer de volta" calorias do cardio | Apps generalistas somam calorias queimadas ao saldo | Estimativas de gasto erram até ~50%; a MacroFactor explicitamente rejeita a prática | Cardio como registro puro (decisão atual, correta) |
| Ajuste automático de metas (adaptive expenditure) | É a promessa "mágica" do MacroFactor | É literalmente o produto inteiro de um app pago; algoritmo complexo (trend weight + expenditure); usuário já tem nutricionista | Metas fixas por fase + relatório semanal informando tendência |
| Micronutrientes (vitaminas, fibras, sódio...) | Cronometer mostra que é possível | Explosão de escopo de dados/UI; TACO/OFF nem sempre têm os dados | Foco nos 4 números da dieta flexível |
| Água | Table stakes de apps generalistas | Valor comprovado baixo; custo de mais um estado diário para manter | Preterida pelo usuário em favor de suplementos |
| Gamificação, streaks, social | Engajamento no curto prazo (MyFitnessPal investiu) | Para usuário único é ruído; streak quebrado gera sensação de falha e abandono | Relatório semanal factual (aderência sem julgamento) |
| Lembretes proativos gerais | "O bot podia me lembrar" | Problema de agendamento/estado sem ROI claro; único lembrete de valor é reposição | Aviso de estoque dentro do relatório semanal (já no escopo) |
| Refeições planejadas (montar o dia antes) | Desejável para quem pré-monta a dieta | UX complexa (plano vs realizado); deferida corretamente | v2+: simulador simples ("se eu comer X...") |
| Integrações externas (Google Fit, Garmin, balanças) | Auto-import parece conveniente | OAuth, sincronização e manutenção por terceiros; conflito com "tudo local" | Entrada manual pelo chat (baixa fricção já resolvida) |
| Pipeline próprio de visão para foto de comida | "Mandar foto e contar" (Cal AI etc.) | Construir reconhecimento visual é um produto à parte; Hermes/LLM já pode interpretar fotos se necessário | Deixar interpretação de foto (se vier) para o Hermes; MCP só registra |

## Feature Dependencies

```
[Catálogo de alimentos (TACO seed)]
    └──requires──> [Registro de refeição + saldo]
                       └──requires──> [Metas diárias]
                                          └──requires──> [Fases cutting/bulk (metas por fase)]

[Open Food Facts barcode/nome] ──enhances──> [Catálogo] (cache automático)
[Estimativa LLM (Hermes)]      ──enhances──> [Catálogo] (salvar desconhecidos)
[Presets / repetir anterior]   ──requires──> [Registro + Catálogo]

[Checklist de suplementos]
    └──requires──> [Estoque + aviso de reposição]

[Peso/medidas] ──requires──> nada (independente)
[Fotos de progresso] ──requires──> [Peso/medidas] (amarrar no dia)

[Relatório semanal] ──requires──> [Refeições+saldo] + [Treinos] + [Suplementos] + [Peso]
[Dashboard web]     ──requires──> (read-only sobre os mesmos dados)
```

### Dependency Notes

- **Saldo requer metas e catálogo:** sem metas não há "quanto falta"; sem catálogo não há macros por alimento. Por isso catálogo+metas são a fase 1 de qualquer roadmap.
- **Fases são uma camada sobre metas:** fase = período que aponta um conjunto de metas. Barato se o modelo de metas for abstrato desde o início.
- **Relatório semanal é o nó mais dependente:** agrega 4 domínios; naturalmente última feature do MVP (mas dentro dele).
- **Dashboard conflita com nada:** read-only; pode ser construído em paralelo após o modelo de dados.
- **"Posso comer X?" (v2) requer saldo + catálogo:** é uma consulta hipotética sobre o que já existe — por isso é v2 barata.

## MVP Definition

### Launch With (v1)

Alinhado ao PROJECT.md, com duas adições baratas:

- [ ] Catálogo de alimentos (seed TACO) + busca — base de tudo
- [ ] Registro de refeição por mensagem + saldo restante — core value
- [ ] Open Food Facts por barcode/nome + cache automático — industrializados sem atrito
- [ ] Estimativa LLM para desconhecidos, marcada e salvável — zero beco sem saída
- [ ] Metas ajustáveis por mensagem — contrato do saldo
- [ ] Fases cutting/bulk/manutenção — diferencial raro, modelo de metas por período
- [ ] **Editar/remover registro de refeição** — table stakes que faltava no escopo (custo irrisório)
- [ ] **Repetir refeição anterior ("igual ontem")** — maior alavanca de fricção, quase grátis
- [ ] Treino simples (data + grupos) e cardio como log — validado pelo mercado casual
- [ ] Peso/medidas + fotos amarradas ao dia — progresso físico
- [ ] Presets de refeição — QoL
- [ ] Suplementos: checklist + estoque com aviso — diferencial único no segmento
- [ ] Relatório semanal empurrado no WhatsApp — fecha o loop (última a ser construída; agrega tudo)
- [ ] Dashboard web simples — read-only sobre os mesmos dados
- [ ] Núcleo MCP + banco local — a plataforma em si

### Add After Validation (v1.x)

- [ ] **"Posso comer X?"** — consulta prévia de saldo; barata (tool MCP de simulação) e de altíssimo valor no chat
- [ ] Trend weight (média móvel ~7 dias) no dashboard — leitura correta do peso ruidoso; padrão Happy Scale/MacroFactor
- [ ] Quick-add de calorias apenas ("lanche ~300kcal") — sem buscar alimento
- [ ] Aderência semanal expandida (dias no alvo por macro no dashboard)

### Future Consideration (v2+)

- [ ] Log de treino detalhado (séries/reps/cargas) — quando o usuário de fato quiser progressive overload; schema já extensível
- [ ] Refeed/diet breaks agendados dentro de fases
- [ ] Refeições planejadas (dia montado com antecedência, comparar planejado vs realizado)
- [ ] Exportação/backup (CSV/JSON) — hoje os dados locais já são o backup; formalizar quando houver valor

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Registro de refeição + saldo | HIGH | MEDIUM | P1 |
| Catálogo TACO + busca | HIGH | MEDIUM | P1 |
| Metas ajustáveis | HIGH | LOW | P1 |
| Editar/remover registro | HIGH | LOW | P1 |
| OFF barcode/nome + cache | HIGH | MEDIUM | P1 |
| Fases (cutting/bulk) | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| Repetir refeição anterior | HIGH | LOW | P1 |
| Presets | MEDIUM-HIGH | LOW | P1 |
| Estimativa LLM salvável | HIGH | MEDIUM | P1 |
| Peso/medidas/fotos | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| Treino simples + cardio | MEDIUM | LOW | P1 |
| Suplementos + estoque | MEDIUM-HIGH | LOW-MEDIUM | P1 |
| Relatório semanal | HIGH | MEDIUM | P1 (último) |
| Dashboard web | MEDIUM | MEDIUM | P2 (pode seguir o núcleo) |
| "Posso comer X?" | HIGH | LOW | P2 |
| Trend weight | MEDIUM | LOW | P2 |
| Quick-add kcal | MEDIUM | LOW | P2 |
| Treino detalhado | MEDIUM (v2) | HIGH | P3 |
| Refeições planejadas | LOW-MEDIUM | HIGH | P3 |
| Integrações externas | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | MyFitnessPal | MacroFactor | ZapDieta/Gluti/kcalm (WhatsApp BR) | Re:Stock / SuppCo | Hevy | Flex Diet (nossa abordagem) |
|---------|--------------|-------------|-------------------------------------|-------------------|------|------------------------------|
| Log por linguagem natural | Não (busca+menus) | Parcial (AI Describe, editável) | Sim (texto/foto/áudio) — core | — | — | Sim, via Hermes; MCP registra |
| Saldo de macros do dia | Sim | Sim (dashboards) | Sim, no chat | — | — | Sim, resposta imediata no chat |
| Barcode | Sim (paywall recentemente) | Sim | Parcial (foto do rótulo via AI) | — | — | Sim via OFF, grátis + cache |
| Banco de alimentos BR | Fraco (user-submitted) | Verificado, mas EUA-centric | Desconhecido/fechado | — | — | **TACO nativo + OFF + LLM** |
| Customização total de metas | Premium | Sim | Sim (com plano pago) | — | — | Sim, por mensagem |
| Fases cutting/bulk com metas | Não modelado | Program (pago, auto-ajuste) | Não | — | — | Sim, troca manual explícita |
| Suplementos + estoque | Não | Não | Não | Sim (nicho) | — | **Sim (checklist + reposição)** |
| Relatório semanal | Premium | Sim (review + auto-ajuste) | Sim no chat | Logbook | Volume semanal | Sim, empurrado, sem auto-ajuste |
| Fotos de progresso | Sim | Sim | Não | — | — | Sim, amarradas a peso/medidas |
| Treino detalhado | Básico | Básico | Não | — | Sim (nicho, excelente) | v1 simples; v2 avalia detalhe |
| Custo/dados | Assinatura + nuvem | Assinatura + nuvem | Assinatura + nuvem | Freemium | Assinatura | **Grátis, 100% local, MCP headless** |

## Sources

- [MacroFactor vs MyFitnessPal (MacroFactor oficial)](https://macrofactor.com/macrofactor-vs-myfitnesspal-2025) — fricção de log como eixo competitivo; eficiência (favorites, smart history, copy, quick add); analytics (trend weight, photos, measurements). Confiança MEDIUM (fonte primária do produto, mas vendor marketing — cross-checked com agregadores)
- [MacroFactor V3 Expenditure (oficial)](https://macrofactor.com/expenditure-new-v3/) — ajuste semanal de metas como coração do coaching. Confiança MEDIUM
- [ZapDieta](https://zapdieta.com), [ContaCal](https://contacal.com), [Gluti](https://gluti.com.br), [kcalm](https://kcalm.app), [CaloriChat](https://calorichat.com), [CalorAI](https://apps.apple.com) — categoria de tracking via WhatsApp (BR e global): NL/foto/áudio, resposta de macros no chat, relatório semanal. Confiança MEDIUM (páginas de produto; feature sets consistentes entre si)
- [Open Food Facts — Data/API](https://world.openfoodfacts.org/data) — v2 API por barcode e busca, licença ODbL, 4M+ produtos, bulk export. Confiança HIGH (documentação oficial, página lida diretamente)
- [brolesi/taco](https://github.com/brolesi/taco) e [raulfdm/taco-api](https://github.com/raulfdm/taco-api) — TACO normalizada em APIs comunitárias (REST/GraphQL). Confiança MEDIUM
- [Re:Stock](https://mwm.ai), [SuppCo](https://apps.apple.com), [Pillo](https://pillo.care) — categoria de suplemento tracking: checklist diário, contagem de estoque, reorder alerts. Confiança MEDIUM (páginas de loja, consistente entre fontes)
- [Hevy](https://www.hevyapp.com), [SetGraph](https://setgraph.app), [Quantified Self forum](https://forum.quantifiedself.com), [Simple Workout Log](https://play.google.com/store/apps/details?id=com.selahsoft.workoutlog) — espectro de log de treino; consenso "registre só o que muda a próxima decisão". Confiança MEDIUM
- [Lose It! blog](https://www.loseit.com), [Nutrola](https://nutrola.app), [WellyPal](https://www.wellypal.com) — features de redução de fricção (copy meal, presets, foto/voz, quick add). Confiança MEDIUM (vendor sources consistentes)
- [RippedBody](https://rippedbody.com) — prática de tracking semanal em dieta física (medidas, peso, aderência). Confiança LOW-MEDIUM (busca acadêmica direta limitada por rate limiting do serviço de busca; práticas IIFYM/weekly corroboradas indiretamente)
- BodyPal, Fitia, Hoot Fitness, NutriScan, Bodly, Happy Scale/Libra (roundups de mercado) — posicionamento dos players (precisão Cronometer, base MFP, coaching MacroFactor). Confiança LOW-MEDIUM (blogs/agregadores)

---
*Feature research for: personal flexible-diet/fitness management (MCP-first, WhatsApp via Hermes)*
*Researched: 2026-09-23*
