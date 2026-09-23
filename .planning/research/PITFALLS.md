# Pitfalls Research

**Domain:** Dieta flexível (IIFYM) pessoal operada via WhatsApp/Hermes — servidor MCP + SQLite + dashboard
**Researched:** 2026-09-23
**Confidence:** MEDIUM (claims-chave verificadas em fontes primárias: API real do Open Food Facts, guia oficial da Anthropic sobre tools para agentes, estudo NIH jul/2026, documentação oficial do SQLite; claims de inventário ficaram LOW por rate-limit nas buscas — ver seção Sources)

**Leitura rápida para o roadmap:** os piores riscos deste domínio não são técnicos, são de **confiança no saldo**. Um débito silencioso errado (LLM chutou 200g quando eram 80g, kcal importadas de coluna em kJ, refeição duplicada por retry) faz o usuário parar de usar o sistema — apps de dieta morrem por atrito + desconfiança nos números, não por falta de features. Quase todas as prevenções abaixo convergem para três padrões: **(1) ecoar o que foi entendido antes/depois de debitar, (2) trilha de auditoria + comandos de correção, (3) contratos de ferramenta MCP explícitos sobre unidades e datas.**

---

## Critical Pitfalls

### Pitfall 1: Débito silencioso errado destrói a confiança no saldo (o risco nº 1 do projeto)

**What goes wrong:**
O Hermes (LLM) interpreta "almocei arroz, feijão e frango" e debita macros com quantidades chutadas. O usuário vê um saldo que não bate com a sensação do que comeu. Estudo do NIH (jul/2026) com 4 apps de foto/IA mostrou subestimação média de **250–345 kcal por refeição (~1/3 do conteúdo real)** e ~30g de gordura, com piores erros em pratos gordurosos. O problema não é só a estimativa em si — é que o erro entra **sem aviso** e o saldo continua parecendo exato.

**Why it happens:**
LLMs otimizam por plausibilidade, não por precisão; "um filé de frango" vira 150g sem nenhumaBase. O desenvolvedor assume que o número retornado é verdade e o trata igual a um dado de catálogo. O usuário, por sua vez, não distingue visualmente "medido da TACO" de "chutado pelo LLM".

**How to avoid:**
- Toda resposta de `registrar_refeicao` **ecoa** o que foi debitado: item, gramas assumidas, macros e a **fonte** (`TACO` / `Open Food Facts` / `estimativa LLM` / `refeição padrão`), seguida do saldo atualizado.
- Estimativas LLM são sempre rotuladas como "estimado" e nunca entram no catálogo como valor medido; salvar no catálogo só via confirmação explícita do usuário (o requisito "opção de salvar" já cobre isso — a salvaguarda é não salvar silenciosamente).
- Comandos de correção como cidadãos de primeira classe: `desfazer último`, `corrigir frango para 200g`, `apagar almoço de hoje`.
- Guardar a mensagem original do WhatsApp junto do registro (trilha de auditoria barata e valiosa).

**Warning signs:**
O usuário começa a conferir contas manualmente ou a reenviar mensagens corrigidas; logs mostram mais comandos de correção que registros; usuário desiste de logar ("tanto faz, não bate mesmo").

**Phase to address:**
Fase do núcleo (primeira entrega) — o eco + fonte + correção fazem parte do contrato das ferramentas desde o dia 1; retrofit depois é caro.

---

### Pitfall 2: Duplicação de registros (double-logging) por falta de idempotência

**What goes wrong:**
Timeout/entre canais faz o Hermes reenviar a mesma chamada MCP, ou o usuário reenvia a mesma mensagem ("não respondeu"), e o almoço entra duas vezes. O saldo do dia quebra sem nenhum erro aparente. Pesquisas de mercado apontam entradas duplicadas como uma das principais causas de "dado podre" em apps de contagem.

**Why it happens:**
Ferramentas MCP de escrita tratadas como operações naturais sem chave de idempotência; a camada de transporte (WhatsApp → Hermes → MCP) tem retry implícito fora do controle deste projeto.

**How to avoid:**
- Aceitar um parâmetro opcional `idempotency_key` (o Hermes pode usar o id da mensagem); na ausência, dedupe defensivo: hash de (alimentos normalizados + data local + janela de ~3 minutos) → retorna o registro existente em vez de criar outro.
- Sempre retornar o registro criado **ou o já existente** com flag `duplicado: true`, para o Hermes avisar o usuário naturalmente.
- `desfazer` / listar-e-apagar resolvem o caso residual; nunca deixar o usuário preso a um registro órfão.

**Warning signs:**
Duas refeições idênticas minutos apart no banco; saldo "pula" após reenvio; usuário relata "contei duas vezes o mesmo almoço".

**Phase to address:**
Fase do núcleo — idempotência no contrato de escrita das ferramentas, testada com reenvio simulado.

---

### Pitfall 3: Importação da TACO com coluna errada (kJ lido como kcal) ou encoding/decimal errado

**What goes wrong:**
A TACO publica energia **em kcal E kJ** por 100g. Ler a coluna errada infla a energia ~4,18x (1 kcal = 4,184 kJ) e o catálogo inteiro nasce inválido. Somam-se as armadilhas clássicas de CSV brasileiro: separador `;`, decimal com vírgula (`89,0`), encoding latin-1/Windows-1252 nos dumps encontrados na web (o GitHub tem datasets estruturados da 4ª edição, 597 alimentos, mas cada um com seu formato).

**Why it happens:**
As colunas kcal/kJ ficam lado a lado no PDF/dataset e os nomes variam por fonte; o importador "funciona" na primeira execução e ninguém confere valores unitários.

**How to avoid:**
- Teste de sanidade obrigatório no seed: banana ≈ 89 kcal/100g, arroz cozido ≈ 128 kcal/100g, óleo de soja ≈ 884 kcal/100g. Se banana vier ~372, é kJ.
- Schema do catálogo com campo `energia_kcal_por_100g` explícito (nunca um `energia` genérico).
- Preferir dataset estruturado conhecido (GitHub) ao PDF-parse; fixar a fonte no repositório (arquivo versionado).

**Warning signs:**
Primeira refeição logada esgota o saldo do dia; calorias/100g > 900 em qualquer alimento que não seja óleo; pico de correções no dia do deploy do catálogo.

**Phase to address:**
Fase do núcleo (seed do catálogo) — barato de prevenir, caríssimo de descobrir em produção com histórico de refeições calculado em cima.

---

### Pitfall 4: Medida caseira tratada como gramas universais

**What goes wrong:**
"2 colheres de arroz" — na TACO, a coluna "Medida caseira" dá **gramas por medida específicas de cada alimento** (uma colher de sopa de arroz ≠ colher de sopa de feijão ≠ colher de óleo). Converter com um valor fixo (ex.: 15g para toda colher) produz erros sistemáticos de 2–3x. Ainda há ambiguidade cheia vs. rasa, "copo" (200ml? 250ml?), "unidade" (tamanho médio de quê?).

**Why it happens:**
A tabela TACO tem ~597 alimentos e cada um com sua equivalência; é tentador aplicar uma tabela genérica de conversão. O LLM do Hermes também não conhece as equivalências do catálogo a menos que a ferramenta as exponha.

**How to avoid:**
- Semear `gramas_por_medida_caseira` (e o nome da medida) por alimento, direto da TACO.
- **Contrato das ferramentas em gramas, sempre**: o Hermes recebe do catálogo (via tool de busca/consulta) a equivalência e assume as gramas, declarando a premissa no eco ("2 colheres de sopa de arroz ≈ 50g — ok?").
- Ferramenta de busca retorna candidatos com medidas caseiras para o LLM converter com dado real, não com senso comum.
- Quantidade sem unidade reconhecível → a tool rejeita com mensagem acionável ("informe gramas ou uma medida do catálogo").

**Warning signs:**
Registros de arroz/feijão/óleo sistematicamente acima ou abaixo do plausível; usuário corrigindo sempre na mesma direção (sinal de viés de conversão, não de ruído).

**Phase to address:**
Fase do núcleo (catálogo + contrato de ferramentas).

---

### Pitfall 5: Open Food Facts — kJ como padrão, porção vs 100g, campos nulos e cru-vs-cozido

**What goes wrong:**
Quatro falhas verificadas na API real (produto testado ao vivo): (1) o campo base `energy` vem em **kJ** — kcal está em `energy-kcal_100g` separado; (2) valores `*_serving` só existem se `serving_size` existir — usar porção quando falta serving produz erro ou null; (3) dados crowdsourced: campos inteiros ausentes e valores aproximados marcados com modificador `~`; (4) para arroz/macarrão/feijão, a base contém tanto a versão crua quanto a cozida (e `nutrition_data_prepared_per` sinaliza "preparado") — o LLM pode escolher o arroz **cru** (≈360 kcal/100g) para o arroz **cozido** do prato (≈128 kcal/100g), inflando ~2,8x.

**Why it happens:**
A API expõe tudo junto no objeto `nutriments` e nunca lança erro — só retorna ausente. Produtos BR de grandes marcas são bem cobertos, mas marcas regionais podem nem existir.

**How to avoid:**
- Normalização obrigatória na borda: toda consulta vira internamente `{kcal, proteína, carbo, gordura} por 100g` + `serving_size_g` separado; nunca guardar "o que a API retornou" cru.
- Ler preferencialmente `_100g`; usar `energy-kcal_100g` (não `energy`); se kcal ausente, converter de kJ (÷ 4,184) e marcar como derivado.
- Campos nulos → política explícita: tentar outro produto duplicado, senão cair para estimativa rotulada. Nunca debitar 0 silenciosamente por campo faltante.
- Cache automático (já é requisito) com fonte e data — produtos mudam de fórmula e a entrada do OFF pode estar defasada; atualizar cache com TTL longo (meses) em vez de congelar para sempre.
- No prompt/descrição da tool de busca: instruir o Hermes a preferir a variante "cozido/pronto" quando o usuário comeu o alimento preparado.

**Warning signs:**
Refeições com industrializados sistematicamente infladas; erro intermitente "TypeError: cannot read property" em campos nutricionais; produto barcodes BR "não encontrado" repetidamente (marca regional).

**Phase to address:**
Fase de integração Open Food Facts (logo após o núcleo).

---

### Pitfall 6: Fuso horário e fronteira do dia (refeição depois da meia-noite)

**What goes wrong:**
Usuário janta às 23h50 e loga à 1h10 — a refeição cai no dia errado e o saldo de "hoje" nasce sujo. Se os timestamps forem gravados só em UTC e o "dia" calculado onde for conveniente, o saldo muda conforme quem calcula (MCP server, dashboard, relatório). Fronteiras erradas corrompem silenciosamente o relatório semanal.

**Why it happens:**
UTC é o default dos runtimes (JS/Node grava ISO-UTC; SQLite `date()` é UTC por padrão); o Brasil é simples (America/Sao_Paulo, **sem horário de verão desde 2019**, offset fixo -03) e por isso ninguém pensa no assunto — até a refeição da meia-noite.

**How to avoid:**
- Schema: `timestamp_utc` (fonte da verdade) **+ `data_local` (YYYY-MM-DD, America/Sao_Paulo) calculado no momento da escrita**. Toda leitura ("saldo de hoje", relatório) agrupa por `data_local`, nunca deriva de `timestamp_utc` de novo.
- "Hoje" = data local do servidor, com suporte a retroativo explícito: "ontem jantei X", "almoço de sexta" → parâmetro `data` opcional nas tools, com default `data_local` atual.
- Uma única função `hoje()` no núcleo, usada por MCP e dashboard — zero duplicação de lógica de dia.

**Warning signs:**
Saldo de manhã não bate com o log da noite anterior; refeições registradas "hoje" às 02h; relatório semanal com fim de semana deslocado.

**Phase to address:**
Fase do núcleo — é decisão de schema, praticamente impossível de consertar bem depois.

---

### Pitfall 7: Ferramentas MCP demais, estreitas e mal descritas — o Hermes chama errado

**What goes wrong:**
Uma tool por operação de CRUD (`buscar_alimento`, `criar_refeicao`, `adicionar_item`, `calcular_saldo`...) força o Hermes a encadear 3–4 chamadas para "almocei X" — cada chamada é uma chance de erro, contexto desperdiçado e resposta lenta. Descrições vagas ("registra uma refeição") fazem a tool errada ser escolhida (peso vs. medida corporal; treino vs. cardio). Erros como stack trace deixam o LLM sem como se recuperar e ele inventa próxima chamada.

**Why it happens:**
Espelhar o banco de dados em tools parece natural para quem programa APIs. O guia da Anthropic ("Writing effective tools for agents") é explícito: **poucas tools orientadas a workflow vencem muitas tools estreitas**, descrição é o artefato de maior alavancagem, e respostas devem devolver dado de alto sinal (não uuids/linhas cruas).

**How to avoid:**
- Consolidar por workflow: `registrar_refeicao` já debita e **retorna o saldo completo na mesma resposta** (sem segunda chamada); `corrigir_registro(id_ou_ultimo, ...)`; `registrar_peso`, `registrar_treino`, `marcar_suplemento`, `repor_estoque`, `definir_fase`, `consultar_saldo`, `relatorio_semana`. Alvo: ~8–12 tools no total.
- Descrições escritas como onboarding: unidades (gramas/kcal), formato de data (YYYY-MM-DD local), **quando usar e quando não usar**, o que acontece com valores ausentes.
- Erros como mensagens acionáveis para o LLM: `"alimento 'feijao carioca' não encontrado; mais próximos: 'Feijão, carioca, cozido' (id 12), 'Feijão, preto, cozido' (id 13) — repita com um dos nomes ou registre como estimativa"` — nunca exceção crua.
- Validação cedo via JSON Schema (`required`, `minimum: 0`, enums para grupos musculares) com mensagens claras.
- Annotations do MCP (`readOnlyHint`, `destructiveHint`, `idempotentHint`) nas ferramentas — orienta o cliente.
- Manter um arquivo de evolução das descrições: cada vez que o Hermes errar uma chamada, melhorar a descrição (ou o erro), não o prompt do usuário.

**Warning signs:**
Hermes chamando `consultar_saldo` logo após `registrar_refeicao`; escolhendo tool de peso para registrar medida; chamadas em cadeia com parâmetros inventados; retries em loop após erro.

**Phase to address:**
Fase do núcleo (desenho do MCP) — e revisão contínua a cada fase que adiciona ferramentas.

---

### Pitfall 8: Relatório de aderência calculado contra as metas erradas (troca de fase no meio do período)

**What goes wrong:**
Usuário sai de cutting (1800 kcal) para bulk (2800 kcal) numa quarta-feira. O relatório semanal calcula os 7 dias contra as metas atuais → a aderência da semana anterior vira mentira (dias de cutting aparecem como 35% de aderência). O mesmo vale para o saldo do dia se a fase muda com refeições já lançadas. E o requisito do projeto manda: fase terminada sem próxima definida → **perguntar, nunca assumir** — se esse estado não for tratado, o sistema cai num default silencioso.

**Why it happens:**
Só existe "metas atuais" (uma linha configurável) em vez de histórico; o relatório consulta a meta de hoje para a semana inteira.

**How to avoid:**
- Histórico de metas: tabela `fases` com `data_inicio`, `data_fim`, metas — a meta válida de um dia é função da data, não do estado atual.
- Relatório semanal calcula aderência **por dia contra a meta daquele dia** e agrega depois (média dos dias com log; dias sem log aparecem como "sem registro", nunca como 0%).
- Troca de fase com refeições já lançadas no dia: recalcular o saldo contra as novas metas e avisar explicitamente ("fase mudou, saldo recalculado para bulk").
- Estado "sem fase ativa": ferramentas de débito respondem com pergunta estruturada ao Hermes ("defina a próxima fase ou metas") — nunca default implícito.

**Warning signs:**
Aderência >100% ou "negativa" inexplicável exatamente na semana da troca; saldo muda de valor sem refeição nova após troca de fase sem aviso; relatório mostra semana inteira na meta nova.

**Phase to address:**
Fase de fases/metas (modelo de dados) + Fase do relatório semanal (agregação correta).

---

### Pitfall 9: Fotos do WhatsApp — compressão, EXIF stripado e foto amarrada ao dia errado

**What goes wrong:**
Modo foto do WhatsApp **recomprime ~80% da qualidade** (imagens típicas de 200–300KB) e **remove quase todo EXIF**, incluindo a data de captura; o arquivo baixado fica com data de download. Bots recebem sempre a versão comprimida. EXIF de orientação pode ser descartado → fotos de 90° na timeline. E a foto do corpo tirada à noite e enviada na manhã seguinte amarra-se ao dia errado, desalinhandose do peso/medidas daquele dia (requisito do projeto: foto atada ao peso/medidas do dia).

**Why it happens:**
Tratar a foto como arquivo qualquer: salvar com mtime do download, confiar no EXIF para data, esquecer orientação, e assumir que a data de envio = data de referência.

**How to avoid:**
- **Data canônica = timestamp da mensagem WhatsApp** (`msg.timestamp`), nunca mtime do arquivo nem EXIF; gravar `data_local` com a mesma regra do Pitfall 6 (incluindo retroativo: "essa foto é de ontem").
- Nome de arquivo determinístico: `fotos/YYYY/MM/<data_local>_<id-mensagem>.jpg` — colisão impossível, timeline = ordenação do filesystem.
- Auto-orientar no ingest (`ImageOps.exif_transpose` / `sharp.rotate`) e normalizar para JPEG.
- Na prática: aceitar compressão do modo foto para foto de progresso (comparação de linha do tempo não precisa de resolução original); se quiser qualidade, orientar o usuário a mandar "como documento" — mas não depender disso.
- Gerar thumbnail no ingest para o dashboard (não servir original).

**Warning signs:**
Fotos rotacionadas ou fora de ordem na timeline; fotos minúsculas (KB) quando o usuário jura que mandou em alta; foto da semana 3 aparecendo na semana 2.

**Phase to address:**
Fase de fotos/progresso.

---

### Pitfall 10: Estoque de suplementos sem ledger — reposição vs. uso misturados, estoque negativo

**What goes wrong:**
Campo único de quantidade onde o checklist diário debita, o usuário "repor" soma, e "acabou" zera — sem histórico. Qualquer discrepância (esqueceu de marcar creatina por 3 dias, pote novo não reportado) e o número vira ficção; estoque negativo silencioso mascara o que aconteceu. Aviso de "acabando" por percentual do pote também falha: pote de whey com 25% = 7 dias; pote de vitamina com 25% = 2 meses.

**Why it happens:**
Estado mutável simples parece suficiente para uma pessoa só — até o usuário perceber que confia menos no estoque do que no saldo (mesma mecânica do Pitfall 1).

**How to avoid:**
- **Ledger de eventos** (`uso_diario`, `reposicao`, `ajuste_manual`, `zerado`) e estoque = soma dos eventos. Barato em SQLite e permite reconstruir/auditar qualquer divergência.
- Aviso de recompra em **dias restantes de suprimento** (estoque ÷ consumo médio diário) com limiar configurável (ex.: avisar com ≤ 7 dias), não por percentual.
- Comando explícito "acabou a creatina" (zera + encerra o pote) e "comprei X" (reposição + quantidade em doses), para o caso real divergir do ledger sem arrastar erro para sempre.
- Permitir negativo mas **sinalizar** no aviso ("estoque -2 doses: marque os dias faltantes ou zere o pote").

**Warning signs:**
Usuário ignora o aviso de estoque (número já não é real); ajustes manuais frequentes; creatina "acabou" há dias e nada avisou.

**Phase to address:**
Fase de suplementação.

---

### Pitfall 11: Sem backup — SQLite em WAL + fotos é ponto único de falha total

**What goes wrong:**
Single-user significa que perda de dados = perda de **tudo** (anos de histórico, fotos de progresso). Detalhe que pega muita gente: com SQLite em **WAL mode, copiar só o `.db` não é backup** — transações commitadas recentemente podem estar no `-wal`. Restaurar nunca testado = não ter backup.

**Why it happens:**
Sistema local "não precisa" de operação; backup fica para depois; o dia em que o disco ou uma migration falha é o dia em que se descobre o problema.

**How to avoid:**
- Backup via `.backup` (online backup API) ou `VACUUM INTO 'backup.db'` — snapshot consistente em arquivo único; **ou** `PRAGMA wal_checkpoint(TRUNCATE)` antes de copiar os arquivos manualmente.
- Rotina simples e local (respeitando a constraint de privacidade — nada de nuvem de terceiros): script que roda ao ligar o servidor ou via agendamento, gravando em outra pasta/disco e mantendo N gerações (ex.: 7 diárias + 4 semanais).
- **Backup automático imediatamente antes de cada migration** (ponto de restauração se a migration quebrar) + migration versionada via `PRAGMA user_version`, executada no startup do MCP server (downtime de segundos é irrelevante com 1 usuário).
- Fotos entram no mesmo esquema de backup (pasta `fotos/` + o `.db`).
- Teste de restauração uma vez por milestone (restaurar em pasta temporária e conferir `consultar_saldo`).

**Warning signs:**
Arquivos `-wal` com centenas de KB acumulados (ninguém checkpointa); nenhum arquivo de backup com data recente; migrations aplicadas "na mão" sem registro.

**Phase to address:**
Fase do núcleo (o backup e o mecanismo de migration nascem junto com o banco) — verificação de restauração em todo milestone.

---

### Pitfall 12: Scope creep — progressão de treino, social e integrações matam o projeto solo

**What goes wrong:**
O clássico de projetos fitness pessoais: a v1 simples funciona, e então vira "já que registro treino, vou registrar séries/reps/cargas e calcular volume e progressão, e gráficos por exercício, e sincronizar com o Google Fit...". O PROJECT.md já empurra séries/reps para v2 com razão — o risco é a erosão silenciosa durante as fases, quando cada feature nova parece pequena. Projetos solo moram de manutenção: cada domínio novo (treino detalhado, integrações) é outro schema, outras ferramentas MCP, outro dashboard.

**Why it happens:**
O próprio usuário é o dono do produto — não há product manager para dizer não; motivação pós-primeira-demo é máxima justamente quando a base ainda é frágil.

**How to avoid:**
- Tratar a lista **Out of Scope** do PROJECT.md como contrato com teste de "custo de entrada": qualquer feature nova entra lá só depois do loop principal (registrar → saldo → confiar) estar validado em uso real por semanas.
- Ordenar o roadmap para **chegar ao uso diário real o quanto antes** e evoluir por atrito sentido, não por imaginação ("sinto falta de X" > "seria legal X").
- Manter o núcleo de treino propositalmente simples (data + grupos musculares, como decidido) — o schema simples evolui para v2 sem rewrite; o detalhado não volta a ser simples.

**Warning signs:**
Planejamento de fase discutindo modelagem de exercícios/progressão antes do relatório semanal existir; milestones que não reduzem atrito do registro diário; "só mais uma integração" na lista de fase.

**Phase to address:**
Transversal — disciplina de roadmap; maior risco entre a 2ª e a 3ª fase (quando o básico já funciona).

---

## Technical Debt Patterns

Atalhos que parecem razoáveis mas cobram caro depois.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Dashboard calcula o saldo com query própria (lógica fora do núcleo) | Rápido de fazer o gráfico | Duas definições de "saldo do dia" que divergem (fuso, fase, estimativas) — a divergência destrói a confiança exatamente como o Pitfall 1 | Never — saldo calculado em UMA função do núcleo, dashboard só renderiza |
| Refeição guarda macros congelados (sem referência a alimento + gramas) | Resposta rápida, sem join | Corrigir o catálogo (Pitfall 3/5) não corrige o histórico; impossível recomputar | Split: itens de catálogo/OFF guardam `alimento_id + gramas` (macro recomputável); estimativas LLM congelam macros (é a estimativa) — documentado no schema |
| Estoque como campo `quantidade` mutável sem ledger | 10 minutos de schema | Impossível auditar divergência (Pitfall 10); rebuild manual | Só se aceitar que o número não é confiável — não aceitável aqui |
| IDs/nomes de alimento como texto livre nas tools | Hermes "funciona" logo | Duplicação de catálogo ("Frango", "frango grelhado", "peito de frango"); relatório incoerente | Nunca — tools aceitam texto mas resolvem para `alimento_id` e ecoam a resolução |
| Sem `data_local` no schema (derivar dia do timestamp na hora) | Schema minimalista | Toda consulta repete lógica de fuso; relatório e dashboard discordam (Pitfall 6) | Never |
| Migration "na mão" (ALTER TABLE via console, sem versionar) | Agilidade no MVP | Sem ponto de restauração; estado de schema desconhecido; quebra silenciosa do MCP server no restart | Nunca depois da Fase 1 — `user_version` + migration no startup é quase de graça |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Open Food Facts (API v2) | Ler `energy` e tratar como kcal; usar `_serving` sem checar `serving_size`; assumir que todos os campos existem | Ler `energy-kcal_100g` (converter de kJ se ausente), preferir `_100g`, normalizar na borda, tratar null com fallback rotulado; cache com fonte+data (requisito do projeto) e busca alternativa quando produto BR regional não existe |
| TACO (dataset 4ª ed. / NEPA-UNICAMP) | Parse do PDF direto; coluna kJ como kcal; decimal com vírgula; encoding latin-1; ignorar que "cru" e "cozido" são linhas distintas | Usar dataset estruturado versionado no repo; testes de sanidade por alimento conhecido; nomes de entrada preservados (incluindo "cozido") para o match do LLM |
| Hermes (cliente MCP) | Muitas tools estreitas; descrições vagas; erros como exceções cruas; resposta sem o saldo (força 2ª chamada) | ~8–12 tools por workflow, descrições com unidades/datas/quando-usar, erros acionáveis com sugestões, respostas de débito já contendo o saldo; annotations `readOnlyHint`/`destructiveHint`/`idempotentHint` |
| WhatsApp (via Hermes, indireto) | Confiar no EXIF para data; esquecer compressão/orientação; assumir data de envio = data de referência | Data canônica = `msg.timestamp` + `data_local`; auto-orient no ingest; aceitar compressão (ou sugerir modo documento); retroativo suportado por mensagem ("foi ontem") |
| SQLite (WAL) | Copiar `.db` como backup; migration sem backup prévio; confiar no mtime como dado | `.backup`/`VACUUM INTO` ou checkpoint antes de copiar; backup obrigatório antes de migration; `user_version` para estado de schema |

## Performance Traps

Escala real do projeto: 1 usuário, dezenas de registros/dia, ~600 alimentos + cache OFF. Performance de banco é irrelevante aqui; os traps reais são de latência de rede e bloqueio.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Consulta ao Open Food Facts no caminho crítico do débito (rede bloqueando a resposta do WhatsApp) | "almocei X" demora 10–30s ou trava; saldo não volta | Timeout curto (2–3s) + fallback imediato para estimativa rotulada ou catálogo; busca OFF pode ser assíncrona ("procurei o produto, já te digo") | Imediato em queda/leniência da OFF — é a única dependência de rede do caminho principal |
| Re-scraping/re-parse da TACO a cada start | Startup lento, seed duplicado | Seed idempotente por versão (hash do dataset); catálogo em SQLite desde o início | Invisível até o usuário reindexar sem querer |
| Servir fotos originais no dashboard | Dashboard pesa megabytes por visita | Thumbnail no ingest (Pitfall 9); original só em clique explícito | Quando as fotos em modo documento (maiores) acumularem |
| Tool MCP retornando linhas cruas do banco (listas enormes no contexto do LLM) | Respostas do Hermes caras e lentas; agente se perde | Respostas de alto sinal: saldo, confirmações, candidatos de busca limitados (top 5) — nunca dump de tabela | Imediato em contexto do Hermes conforme o histórico cresce |

## Security Mistakes

Domínio: dados pessoais sensíveis (peso, medidas, **fotos do corpo**) num servidor local. Não há multiusuário — o risco é exposição local/acidental, não web-scale.

| Mistake | Risk | Prevention |
|---------|------|------------|
| MCP server (ou dashboard) bindado em `0.0.0.0` sem auth por "é local mesmo" | Qualquer dispositivo da rede lê/escreve peso, dieta e fotos do corpo | Bind em `127.0.0.1`; se o Hermes precisar de rede, token compartilhado simples + firewall local |
| Pasta de dados dentro do repositório git | Push acidental publica fotos e histórico de saúde num remote | Dados fora do repo (ou `.gitignore` em `data/`, `fotos/`) desde o primeiro commit; repositório não tem remote público |
| Enviar dados pessoais a serviços externos sem perceber | Violação da constraint "sem nuvem de terceiros" — busca por nome na OFF expõe padrão alimentar (baixo risco, mas é vazamento) | Aceito e consciente: só consultas de produto/busca vão à OFF; nada de peso/fotos/metas; documentar a exceção no README |
| Dashboard sem qualquer proteção em LAN (requisito diz sem auth) | Visitante/convidado na rede vê fotos de progresso | Manter bind local; se um dia quiser acesso do celular, resolver com túnel/VPN, não abrindo porta |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Confirmação obrigatória para todo registro | Atrito mata o hábito (friction é a causa nº 1 de abandono de apps de dieta) | Confiança graduada: catálogo/OFF → registra direto e ecoa; estimativa ambígua → ecoa com premissa e pergunta só quando o erro é provável (medida caseira estranha, alimento desconhecido) |
| Erro do usuário tratado como exceção rara | Usuário com medo de errar para de logar | Correção deve ser tão fácil quanto registrar: `desfazer`, `corrigir`, `apagar` — e o Hermes deve saber usá-las (descrições!) |
| Estimativa sem rótulo | Usuário acredita em número chutado (erros de ~1/3 por refeição no estudo NIH) | Fonte sempre visível no eco ("≈ estimado"); relatório pode agregar "X% do dia veio de estimativas" |
| Aderência punitiva no relatório semanal | Culpa → abandono (a "guilt" citada como causa de falha de diet apps) | Números neutros + contexto ("5 de 7 dias na meta; melhor sequência: ter–sex"), sem julgamento |
| Saldo esconde o que não está definido | Fase terminada, sistema assume metas velhas silenciosamente → números absurdos sem explicação | Estado explícito "sem fase ativa — defina a próxima" (já é requisito do projeto: perguntar, não assumir) |

## "Looks Done But Isn't" Checklist

- [ ] **Registro de refeição:** parece pronto sem caminho de correção — verificar `desfazer`/`corrigir`/`apagar` funcionando via mensagem
- [ ] **Saldo do dia:** parece pronto sem estado "sem fase ativa / metas não definidas" — verificar resposta perguntando em vez de assumir
- [ ] **Catálogo TACO:** parece pronto sem teste de sanidade unitária (banana ≈ 89 kcal/100g) — verificar contra-valores conhecidos pós-seed
- [ ] **Integração OFF:** parece pronta com o produto de teste — verificar comportamento com campos nulos, `serving_size` ausente, produto BR regional inexistente e OFF fora do ar (timeout → fallback)
- [ ] **Idempotência:** parece pronta no happy path — verificar reenvio da mesma mensagem/chamada não duplica
- [ ] **Troca de fase:** parece pronta mudando a meta — verificar saldo do dia com refeições já lançadas e aviso explícito de recálculo
- [ ] **Relatório semanal:** parece pronto com semanas "limpas" — verificar semana com troca de fase no meio, dias sem log e feriado/escapadinha
- [ ] **Fotos:** parecem prontas no upload — verificar orientação (retrato/paisagem), data correta pós-meia-noite e thumbnail no dashboard
- [ ] **Estoque:** parece pronto com pote cheio — verificar `zerado`, `reposição`, dias restantes e aviso com ≤ limiar
- [ ] **Backup:** parece pronto com o arquivo gerado — verificar restauração real (pasta temporária + `consultar_saldo` batendo)
- [ ] **Dashboard:** parece pronto com dados bonitos — verificar dias sem registro (buracos no gráfico, não zeros) e consistência com o saldo do WhatsApp

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Débitos errados descobertos dias depois | MEDIUM | Corrigir/editar itens via comandos; se macros congelados de catálogo ruim, re-seed + recomputar (exige `alimento_id + gramas` nos itens — ver Technical Debt); mensagem original no log ajuda a reconstruir |
| Catálogo importado com kJ como kcal | MEDIUM | Corrigir seed + re-importar (itens referenciam `alimento_id` → histórico corrige junto); se macros congelados, recompute batch |
| Duplicação em massa (bug de retry) | LOW | Query de dedupe por (conteúdo, data_local, janela) com backup prévio; depois blindar idempotência |
| Dia/partição errada por fuso (schema sem data_local) | HIGH | Migration de backfill recalculando `data_local` por timestamp — possível, mas dolorosa; por isso é prevenção na Fase 1 |
| Corrupção/queda do SQLite | LOW/MEDIUM | Restaurar último backup (`.backup`/`VACUUM INTO`); se sem backup, tentar `.dump` e recuperação do `-wal`; teste de restauração por milestone evita a versão HIGH |
| Foto amarrada ao dia errado | LOW | Comando "mover foto de hoje para ontem"; layout por `data_local` + id facilita |
| Estoque virou ficção | LOW | "Zerar pote" + registrar pote novo → ledger reinicia confiável; histórico antigo fica para auditoria |
| MCP server "mudo" (Hermes não acha tools / chama errado) | LOW | Healthcheck simples + log de chamadas; revisar descrições de tools (o log de erros do Hermes é o guia de refactoring) |

## Pitfall-to-Phase Mapping

Fases indicativas (pré-roadmap): **F1 Núcleo** (MCP + SQLite + catálogo TACO + saldo), **F2 OFF** (integração Open Food Facts + cache), **F3 Rotina** (fases/metas, treinos, refeições padrão), **F4 Corpo** (peso/medidas, fotos), **F5 Insights** (suplementos/estoque, relatório semanal, dashboard). Mapear exatamente é trabalho do roadmap.

| Pitfall | Prevention Phase | Verification |
|----------|------------------|--------------|
| 1. Débito silencioso errado (confiança) | F1 | Toda resposta de registro mostra item+gramas+fonte+saldo; correção via mensagem funciona |
| 2. Double-logging / idempotência | F1 | Reenvio simulado da mesma mensagem não duplica registro |
| 3. TACO kJ/encoding | F1 | Teste de sanidade (banana ~89 kcal/100g) no seed; roda em CI/local |
| 4. Medida caseira → gramas | F1 | Tools só aceitam gramas; busca retorna equivalência da TACO; eco mostra premissa |
| 5. OFF kJ/nulls/cru-vs-cozido | F2 | Testes com produto real (kJ), produto sem `serving_size`, produto inexistente, OFF offline (timeout → fallback rotulado) |
| 6. Fuso/fronteira do dia | F1 (schema) | Refeição às 00h30 cai no dia certo; "ontem jantei X" funciona |
| 7. Tools MCP mal desenhadas | F1 + contínuo | ~8–12 tools; Hermes completa "registrar → responder saldo" em 1 chamada; erros geram recuperação sem intervenção |
| 8. Aderência vs metas por dia | F3 (modelo) + F5 (relatório) | Semana com troca de fase no meio mostra aderência correta por dia; sem fase ativa → pergunta, não default |
| 9. Fotos: compressão/EXIF/dia | F4 | Foto retrato aparece orientada; foto enviada às 08h "de ontem" amarra-se a ontem; dashboard usa thumbnail |
| 10. Estoque sem ledger | F5 (suplementos) | Estoque = soma de eventos; aviso em dias-restantes; "zerar pote"/"comprei" funcionam |
| 11. Backup/migrations | F1 (criar) + todo milestone (testar) | Restauração em pasta temporária confere saldo; backup automático antes de cada migration |
| 12. Scope creep | Transversal | Out of Scope do PROJECT.md intacto entre fases; cada fase reduz atrito do registro diário |

## Sources

- **API Open Food Facts — verificação ao vivo** (produto 5449000000996 via API v2): campos `energy` (kJ), `energy-kcal_100g`, `sugars_serving`, `serving_size`, modificador `~`, `nutrition_data_prepared_per` — [world.openfoodfacts.org/data](https://world.openfoodfacts.org/data), [wiki.openfoodfacts.org/Data_quality](https://wiki.openfoodfacts.org/Data_quality)
- **Anthropic — "Writing effective tools for agents"** ([anthropic.com/engineering/writing-tools-for-agents](https://www.anthropic.com/engineering/writing-tools-for-agents)): consolidação de tools por workflow, descrições como maior alavanca, erros acionáveis, respostas de alto sinal
- **Estudo NIH (jul/2026)** — apps de IA subestimam ~250–345 kcal/refeição (~1/3), gordura ~30g, piores erros em pratos gordurosos: [EurekAlert](https://www.eurekalert.org), [ScienceDaily](https://www.sciencedaily.com), [News-Medical](https://www.news-medical.net), [Medical Daily](https://www.medicaldaily.com)
- **TACO 4ª ed. (NEPA/UNICAMP)** — 597 alimentos, kcal + kJ por 100g, coluna "Medida caseira" em gramas: [portal CRN-1](https://novoportal.crn1.org.br), [TBCA-USP](https://www.tbca.net.br) (medidas caseiras), datasets estruturados no GitHub
- **SQLite oficial** — [WAL](https://www.sqlite.org/wal.html) (`.db` sozinho não é backup; WAL exige mesma máquina), backup via online backup API / `VACUUM INTO` ([oneuptime](https://oneuptime.com), [sqlite.org forum](https://sqlite.org/forum))
- **WhatsApp media** — compressão de modo foto (~80% qualidade, 200–300KB), EXIF stripado vs. modo documento ([metaclean.app](https://metaclean.app/blog/does-whatsapp-remove-metadata)), restauração de datas via EXIF/mensagem ([ikarus.sg](https://ikarus.sg)), `downloadMedia` sem metadata pré-download ([wwebjs #3435](https://github.com/wwebjs/whatsapp-web.js/issues/3435)), orientação EXIF ([code-garage](https://code-garage.com))
- **Falhas de diet apps** — atrito/incerteza/culpa como causas de abandono ([kibora.app](https://kibora.app)), entradas duplicadas e scan errado corroendo confiança ([nutrola.app](https://nutrola.app), [fitia.app](https://fitia.app))
- **Estoque** — princípio ledger vs. campo mutável, days-of-supply: prática geral de inventário (busca rate-limited; **LOW confidence**, tratar como princípio de design)

---
*Pitfalls research for: Flex Diet (diet-tracking pessoal via MCP server + Hermes)*
*Researched: 2026-09-23*
