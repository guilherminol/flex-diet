# Architecture Research

**Domain:** Sistema pessoal de dieta flexível (IIFYM) — MCP server + SQLite local + dashboard web, single-user, local-first
**Researched:** 2026-09-23
**Confidence:** HIGH para a arquitetura central (baseada em documentação oficial do MCP spec 2026-07-28, sqlite.org e docs oficiais do Open Food Facts, lidas diretamente e corroboradas entre si); MEDIUM para detalhes de tool surface e data model (consenso de domínio); LOW para pontos específicos sinalizados inline (dataset TACO, nomes exatos de annotations de eras antigas do spec).

> **Nota sobre o seam `classify-confidence`:** o comando retornou `LOW` para os providers `webfetch`/`websearch` (providers web genéricos sem verificação de package). As afirmações centrais deste documento vêm, na prática, de páginas oficiais de primeira parte lidas integralmente durante a pesquisa (spec MCP, sqlite.org, docs OFF) — para essas, uso HIGH/MEDIUM conforme a fonte, e mantenho LOW apenas onde a única base é conhecimento de treino não reverificado. Digests cacheados no `research-store` carregam o valor LOW do seam, conforme exigido pelo protocolo.

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────┐
│                       CAMADA DE CONSUMO (já existe / interface)       │
│  ┌────────────────────────────┐      ┌──────────────────────────────┐ │
│  │ Hermes (pré-existente)     │      │ Dashboard Web (a construir)  │ │
│  │ WhatsApp + LLM             │      │ navegador → 127.0.0.1        │ │
│  │ = cliente MCP +            │      │ leitura/gráficos             │ │
│  │ interpretador de linguagem │      │ (sem auth, single-user)      │ │
│  └─────────────┬──────────────┘      └───────────────┬──────────────┘ │
├────────────────┼─────────────────────────────────────┼────────────────┤
│                ▼ stdio (JSON-RPC, subprocesso)       ▼ HTTP + JSON    │
│  ┌────────────────────────────┐      ┌──────────────────────────────┐ │
│  │ ENTRYPONT 1: MCP server    │      │ ENTRYPONT 2: dashboard HTTP  │ │
│  │ src/mcp/server.ts (stdio)  │      │ src/dashboard/server.ts      │ │
│  │ registra ~18 tools         │      │ rotas JSON só-leitura +      │ │
│  │ vive enquanto Hermes roda  │      │ estáticos; roda independente │ │
│  └─────────────┬──────────────┘      └───────────────┬──────────────┘ │
├────────────────┴─────────────────────────────────────┼────────────────┤
│         NÚCLEO DE DOMÍNIO (biblioteca compartilhada,  │                │
│         sem dependência de MCP nem HTTP)              │                │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────┴──────────────┐ │
│  │ meals/    │ │ targets/  │ │ training/ │ │ catalog/              │ │
│  │ saldo,    │ │ phases,   │ │ musculação│ │ busca local,          │ │
│  │ entries   │ │ metas     │ │ + cardio  │ │ create/update foods   │ │
│  └───────────┘ └───────────┘ └───────────┘ └───────────────────────┘ │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────────┐ │
│  │ body/     │ │ supps/    │ │ presets/  │ │ reports/ (agregações  │ │
│  │ peso,     │ │ checklist │ │ refeições │ │ semanais, SQL views)  │ │
│  │ medidas,  │ │ + estoque │ │ padrão    │ │                       │ │
│  │ fotos     │ │           │ │           │ │                       │ │
│  └───────────┘ └───────────┘ └───────────┘ └───────────────────────┘ │
├───────────────────────────────────────────────────────────────────────┤
│                          CAMADA DE DADOS                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────────┐  │
│  │ SQLite (WAL)     │  │ Fotos: filesystem│  │ Seed: TACO vendido  │  │
│  │ data/flexdiet.db │  │ data/photos/     │  │ como CSV no repo    │  │
│  │ + busy_timeout   │  │ (paths no DB)    │  │ scripts/seed.ts     │  │
│  └──────────────────┘  └──────────────────┘  └─────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
                    │ lookup sob demanda (HTTP externo)
                    ▼
      Open Food Facts API — world.openfoodfacts.org
      (barcode 15 req/min · busca 10 req/min · User-Agent obrigatório)
```

### Decisão estrutural central: dois entrypoints, um núcleo, um banco

A forma que melhor se encaixa no caso de uso (verificada contra os docs oficiais do MCP e do SQLite):

1. **MCP server via stdio** é um **subprocesso do Hermes** — o Hermes o inicia, conversa por newline-delimited JSON-RPC no stdin/stdout, e o servidor morre quando o Hermes desconecta. Docs oficiais: *"Local MCP servers that use the STDIO transport typically serve a single MCP client"* — exatamente este caso. Zero configuração de rede, zero daemon, zero autenticação. [HIGH]
2. **Dashboard é um processo separado** que serve HTTP em `127.0.0.1`. Motivo: o servidor stdio **só existe enquanto o Hermes está rodando**; o dashboard precisa funcionar com o Hermes desligado. Um único processo que expõe stdio + HTTP acoplaria a vida do dashboard ao Hermes — rejeitado. [HIGH — deriva diretamente do modelo de lifecycle do stdio]
3. **Ambos compartilham a mesma biblioteca de domínio e o mesmo arquivo SQLite em WAL.** Duas processos na mesma máquina, um writer + N readers, sem bloqueio mútuo no caso comum; `busy_timeout` cobre as janelas raras de `SQLITE_BUSY` (fechamento da última conexão, crash recovery). Verificado em sqlite.org. [HIGH]

Alternativas consideradas e rejeitadas:

| Alternativa | Por que não |
|---|---|
| Um único processo (MCP stdio + HTTP na mesma porta de vida) | Dashboard morre quando Hermes desconecta; acoplamento de lifecycle |
| Daemon sempre-ativo + MCP via Streamable HTTP | Complexidade de gerenciar daemon + escolha de porta + o Hermes teria que falar Streamable HTTP; desnecessário para single-user local. Fica como **plano B documentado** caso o Hermes exija cliente HTTP: o mesmo núcleo pode ser exposto via Streamable HTTP em `127.0.0.1` sem mudar uma linha de domínio |
| Dashboard embutido no MCP server via recursos/prompt | Dashboard no WhatsApp não atende (gráficos, linha do tempo de fotos); MCP não serve UI |

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Hermes (fora do escopo) | Interpreta a mensagem em PT-BR, decide quais tools chamar, resolve quantidades vagas ("2 colheres"), formata a resposta final para o usuário | Runtime de agente existente do usuário |
| MCP server (`src/mcp/`) | Expõe as tools semânticas com `inputSchema`/`outputSchema`, valida entrada, delega ao núcleo, traduz erros de negócio em `isError: true` com texto acionável | SDK MCP (TypeScript) + stdio transport |
| Núcleo de domínio (`src/domain/`) | Toda a lógica: cálculo de macros e saldo, regras de fase/metas, estoque de suplementos, agregações semanais. **Nenhuma menção a MCP, HTTP ou WhatsApp aqui** | Módulos TS puros sobre o banco |
| Acesso a dados (`src/db/`) | Conexão SQLite (WAL + `busy_timeout`), migrations versionadas, seed TACO | driver SQLite síncrono (ex.: better-sqlite3 ou `node:sqlite`) |
| Cliente OFF (`src/off/`) | Busca por barcode e nome na Open Food Facts, respeitando rate limits, com write-through no catálogo local | fetch + User-Agent `FlexDiet/1.0 (email)` |
| Dashboard (`src/dashboard/`) | HTTP só-leitura: dia/semana (macros), evolução de peso/medidas, treinos, timeline de fotos, estado de suplementos | Servidor HTTP minúsculo (Express/Fastify/nativo) + UI estática |
| Fotos (`data/photos/`) | Arquivos de imagem em filesystem, organizados por data; DB guarda só o path | `data/photos/YYYY/MM/...` |
| Relatório semanal (`src/reports/`) | Agregação SQL da semana (aderência de macros, treinos, suplementos) exposta como **dados** por uma tool; a entrega/agendamento no WhatsApp é do Hermes | SQL views + formatação estruturada |

## Recommended Project Structure

```
flex-diet/
├── src/
│   ├── db/                  # conexão SQLite (WAL, busy_timeout), migrations/, seed/
│   │   ├── migrations/      # 001_init.sql, 002_... (versionadas, rodadas no boot)
│   │   └── seed/
│   │       └── taco.csv     # tabela TACO convertida, vendida no repo
│   ├── domain/              # núcleo — puro, testável sem MCP/HTTP
│   │   ├── foods.ts         # catálogo: busca local, criar/editar alimento
│   │   ├── meals.ts         # registrar refeição (itens + gramas), editar/remover
│   │   ├── saldo.ts         # consumo do dia vs metas → saldo (fonte única)
│   │   ├── targets.ts       # metas diárias + fases (cutting/bulk/manutenção)
│   │   ├── training.ts      # musculação (grupos) + cardio
│   │   ├── supplements.ts   # checklist diário + estoque + aviso de reposição
│   │   ├── body.ts          # peso, medidas, fotos (path + data)
│   │   ├── presets.ts       # refeições padrão
│   │   └── reports.ts       # agregações semanais
│   ├── off/                 # cliente Open Food Facts (barcode, busca, cache)
│   ├── mcp/
│   │   ├── server.ts        # entrypoint stdio: registra as tools
│   │   └── tools/           # 1 arquivo por grupo de tools (meals.ts, body.ts...)
│   ├── dashboard/
│   │   ├── server.ts        # entrypoint HTTP: rotas JSON + estáticos
│   │   └── routes/          # /api/day, /api/week, /api/weight, /api/photos...
│   └── reports/             # queries de agregação semanal (compartilhadas)
├── dashboard-ui/            # HTML/JS/CSS estáticos (gráficos) — servidos pelo entrypoint
├── data/                    # gitignored: flexdiet.db, flexdiet.db-wal, photos/
├── scripts/                 # seed.ts, backup.ts
└── package.json
```

### Structure Rationale

- **`domain/` isolado:** é a decisão que mantém o sistema simples de evoluir. As tools MCP e as rotas do dashboard viram *cascas finas* sobre a mesma lógica — zero duplicação de regra de negócio (o saldo nunca é calculado em dois lugares).
- **`mcp/tools/` espelha `domain/`:** cada arquivo de tools delega a exatamente um módulo de domínio; adicionar um domínio novo = adicionar módulo + arquivo de tools + rotas de leitura.
- **`data/` fora do código e gitignored:** banco WAL + fotos nunca vão pro git; `scripts/backup.ts` resolve o histórico.
- **`dashboard-ui/` separado de `dashboard/`:** UI estática simples (sem build pesado) servida por rotas; se um dia virar Vite/React, o contrato `/api/*` já está pronto.

## MCP Tool Surface Design

A pergunta central: ferramentas semânticas vs. um CRUD genérico. **Resposta: ferramentas semânticas de domínio, sem dúvida** — e é o que o PROJECT.md já assume. Razões verificadas:

1. No MCP, tools são **model-controlled**: o LLM do Hermes escolhe a tool pela `description`. Tools semânticas com descrições claras ("Registra uma refeição com itens {food_id, gramas} e devolve o saldo do dia") fazem o LLM acertar de primeira; um `db_execute(sql)` genérico empurra semântica, validação e risco para o LLM. O spec exige que o servidor **valide toda entrada** — com tools semânticas isso é um `inputSchema` JSON; com SQL genérico seria reescrever um ORM. [HIGH]
2. O spec (2026-07-28) é **stateless**: não há sessão entre chamadas; estado relevante entra como argumento explícito (`date`, `phase_id`). Tools semânticas com parâmetros explícitos casam perfeitamente com esse modelo. [HIGH]
3. Nomes de tool: 1–128 chars, apenas ASCII (letras, dígitos, `_`, `-`, `.`) — `registrar_refeicao`, `consultar_saldo` etc. são válidos; nomes com acento não são. [HIGH]

### Divisão de trabalho Hermes ↔ servidor

| Responsabilidade | Quem | Por quê |
|---|---|---|
| Interpretar "almocei arroz, feijão e frango" → itens + gramas | **Hermes (LLM)** | É literalmente o trabalho de um LLM; o spec desprecou `sampling` (servidor pedir LLM ao cliente) na versão 2026-07-28 — o servidor **não deve** depender de LLM do cliente [HIGH] |
| Resolver "arroz" → `food_id` | Hermes, chamando `search_foods` / `search_open_food_facts` | O servidor devolve candidatos; o LLM escolhe |
| Estimar macros de comida desconhecida | **Hermes** (estimativa própria), depois `create_food` + `log_meal` | PROJECT.md define assim; servidor só persiste com flag `source='llm_estimate'` |
| Validação, conversão gramas→macros, cálculo de saldo, regras de fase/estoque | **Servidor (determinístico)** | Matemática e regras de negócio nunca no LLM — reproduzível e testável |
| Perguntar ao usuário (fase acabou, qual a próxima?) | **Hermes**, a partir de um resultado estruturado | Não depender de `elicitation` (suporte no Hermes desconhecido); a tool retorna `status: "phase_expired"` e o Hermes conversa. Isso endereça diretamente o requisito "fim de fase sem próxima definida → sistema pergunta" |

### Superfície de tools proposta (~18, agrupadas)

| Grupo | Tools (sugestão de nome) | Observações |
|---|---|---|
| Catálogo | `search_foods`, `search_open_food_facts` (barcode OU nome), `create_food` | `search_open_food_facts` aplica cache write-through no catálogo |
| Refeições | `log_meal` (itens[] com `food_id`+gramas, ou macros inline), `update_meal_entry`, `delete_meal_entry`, `get_day_log` | itens com macros inline dispensam cadastro prévio |
| Saldo | `get_daily_summary` | consumed/targets/remaining por macro; **a tool mais chamada** — retornar tudo que o Hermes precisa em uma chamada |
| Metas/fases | `get_current_phase`, `set_targets`, `create_phase`, `switch_phase` | `switch_phase` valida sobreposição de períodos |
| Treino | `log_training` (kind: musculação/cardio, grupos), `get_training_history` | musculação e cardio na mesma tabela, `kind` distingue |
| Suplementos | `list_supplements` (com estoque), `toggle_supplement_today`, `add_supplement`, `update_stock` | `list_supplements` já devolve flag `low_stock` |
| Corpo | `log_weight`, `log_measurement`, `save_photo` (path do arquivo) | fotos: Hermes salva o arquivo recebido do WhatsApp em staging e passa o path |
| Presets | `save_preset`, `log_preset` | `log_preset` expande itens e retorna saldo |
| Relatório | `get_weekly_summary` | dados agregados; Hermes formata e agenda o envio |

Cada tool com `outputSchema` (`structuredContent`) **e** texto já formatado como cortesia — o spec recomenda devolver o JSON serializado também como text content; isso deixa o Hermes livre para repassar o texto ou recompor. `annotations` (`readOnlyHint` nas consultas, `destructiveHint` em delete) são metadados úteis, mas o Hermes pode ou não usá-los — não são garantia funcional (nomes exatos dos hints vieram de eras anteriores do spec; [MEDIUM] para os nomes, [HIGH] para a existência do campo `annotations`).

### Comportamento de erro que habilita conversa

Erros de negócio **não são exceções de protocolo**: voltam como resultado com `isError: true` e texto acionável ("Alimento 'whey 3W' não encontrado no catálogo. Use search_foods ou create_food.") + `structuredContent` com código de status (`food_not_found`, `phase_expired`, `insufficient_stock`). O spec define exatamente esse mecanismo para que o modelo se autocorrija — que é o loop conversacional que o produto quer. [HIGH]

## Data Flow

### Request Flow — caso principal: "almocei arroz, feijão e frango"

```
WhatsApp → Hermes (LLM interpreta: 3 itens, quantidades estimadas)
    ↓ tools/call search_foods {terms: ["arroz","feijão","frango"]}
Servidor MCP → domain/foods → SQLite (catálogo TACO + cache) → candidatos
    ↓ (LLM resolve: arroz branco cozido, id=42, 150g...)
Hermes → tools/call log_meal {date: "2026-09-23", meal: "almoco",
                              items: [{food_id: 42, grams: 150}, ...]}
    ↓
Servidor: valida schema → domain/meals: busca macros/100g no catálogo,
converte por gramas, INSERE entries com macros calculados (snapshot)
    ↓
domain/saldo: metas da fase ativa − consumo do dia → saldo restante
    ↓ structuredContent {consumed, targets, remaining} + texto resumo
Hermes formata em PT-BR natural → WhatsApp
```

### Key Data Flows

1. **Barcode ("código de barras 7891234"):** Hermes → `search_open_food_facts {barcode}`. Servidor: (a) procura no catálogo local por barcode → hit: responde na hora; (b) miss: chama OFF `GET /api/v3/product/{barcode}.json` com `fields` mínimos **durante a tool call** (~1s, aceitável e síncrono), grava no catálogo com `source='openfoodfacts'` (write-through) e responde. Limite de 15 req/min do OFF é folgado para uso pessoal com cache. [HIGH — docs OFF]
2. **Busca por nome em produtos industrializados:** mesma tool com `name`. Cuidado: busca do OFF tem limite de **10 req/min** e o docs oficial desencoraja search-as-you-type — como o Hermes agrupa termos numa chamada só e o cache local cresce com o uso, a frequência natural cai rápido. Se um dia insuficiente, Search-a-licious (`search.openfoodfacts.org`) é o caminho oficial de busca full-text. [HIGH]
3. **Comida desconhecida:** Hermes estima macros → `create_food {name, per_100g..., source:'llm_estimate'}` → `log_meal`. O catálogo aprende; nas próximas vezes `search_foods` acha direto. [conforme PROJECT.md]
4. **Foto pelo WhatsApp:** Hermes recebe a mídia (fora do escopo), salva em `data/photos/staging/` e chama `save_photo {date, path}`; servidor move para `data/photos/YYYY/MM/`, registra `(date, path)` no DB, amarrado ao peso/medidas do dia quando existirem. Passar **path**, não base64 — evita payload gigante no JSON-RPC e mantém o DB pequeno. [MEDIUM — decisão de desenho]
5. **Relatório semanal:** agendamento e envio pelo Hermes (não há bot neste projeto); `get_weekly_summary {week_start}` devolve aderência de macros (dias dentro da meta ±tolerância), treinos, cardio, suplementos tomados/pendentes e estoque baixo. Servidor nunca "envia" nada. [derivação direta do escopo]
6. **Dashboard:** processo HTTP separado lendo o **mesmo núcleo** (`domain/` + views SQL). Nenhuma escrita pelo dashboard em v1 — escritas continuam pelo WhatsApp, eliminando duplicação de fluxos e conflito de escritores. [opinião — simplicidade]

### State Management

```
SQLite (WAL) = única fonte de verdade
    ↑ leitura/escrita via domain/ (mesma biblioteca nos 2 processos)
MCP server (stdio)          Dashboard (HTTP)
- stateless por chamada     - stateless por request
- date/ids sempre explícitos - sempre reflete o estado atual do DB
```

- **Saldo nunca é armazenado — é derivado na leitura** (metas da fase ativa na data − soma dos entries da data). Fonte única de cálculo: `domain/saldo.ts`.
- **Data do dia sempre explícita** nas tool calls (o Hermes sabe a data local do usuário; o spec MCP é stateless e não "sabe" nada entre chamadas). Datas gravadas como `TEXT 'YYYY-MM-DD'` **local** (convenção SQLite), nunca derivadas de UTC no servidor — ver anti-padrão 3.

## Data Model (áreas e esqueleto)

| Tabela | Colunas-chave | Notas |
|---|---|---|
| `foods` | id, name, barcode?, kcal/protein/carb/fat/fiber **per 100g**, source (`taco`/`openfoodfacts`/`llm_estimate`/`manual`), brand?, portions? (JSON: "1 colher = 30g") | catálogo único; source flag preserva rastreabilidade TACO/OFF/LLM |
| `meal_entries` | id, date, meal_type, food_id?, name_snapshot, grams, **kcal/protein/carb/fat calculados no log (snapshot)** | snapshot protege o histórico de edições futuras do catálogo [opinião forte] |
| `phases` | id, kind (cutting/bulk/manutencao), start_date, end_date?, targets: kcal/protein/carb/fat | metas vivem na fase; fim sem próxima → `phase_expired` estruturado |
| `training_sessions` | id, date, kind (`musculacao`/`cardio`), muscle_groups (JSON/text)?, notes? | uma tabela simples; v2 pode evoluir para séries/reps sem quebrar |
| `supplements` | id, name, stock_qty, unit, low_stock_threshold | aviso de reposição = leitura comparando qty × threshold |
| `supplement_intakes` | date, supplement_id, taken | checklist diário |
| `weight_logs` | date, weight_kg | |
| `measurements` | date, body_part, cm | cintura, braço... |
| `photos` | id, date, file_path, caption? | path relativo a `data/` |
| `presets` / `preset_items` | id, name / preset_id, food_id, grams | |
| views SQL | `v_daily_totals`, `v_weekly_adherence` | rollups como **views**, não tabelas materializadas [opinião] |

## Architectural Patterns

### Pattern 1: Ferramentas semânticas sobre núcleo determinístico

**What:** o LLM (Hermes) faz só a tradução linguagem-natural → argumentos estruturados; toda matemática e regra de negócio é código determinístico no servidor.
**When to use:** sempre que um agente LLM consome um sistema de registro — é o caso do MCP por definição.
**Trade-offs:** mais tools para manter (vs. 1 CRUD genérico); em troca, validação por schema, testabilidade e respostas confiáveis.

**Example:**
```typescript
// src/mcp/tools/meals.ts — casca fina sobre domain/meals.ts
server.registerTool("log_meal", {
  description: "Registra uma refeição (itens com food_id e gramas) e devolve o saldo do dia",
  inputSchema: {
    type: "object",
    properties: {
      date: { type: "string", description: "Data local YYYY-MM-DD" },
      meal: { type: "string", enum: ["cafe", "almoco", "janta", "snack"] },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: { food_id: { type: "number" }, grams: { type: "number" } },
          required: ["food_id", "grams"],
        },
      },
    },
    required: ["date", "meal", "items"],
  },
}, async (args) => {
  const result = domain.meals.logMeal(args);        // valida, calcula, insere
  const saldo  = domain.saldo.dailySummary(args.date); // metas − consumo
  return {
    content: [{ type: "text", text: renderSaldo(saldo) }],
    structuredContent: saldo,
  };
});
```

### Pattern 2: Cache write-through no catálogo (local-first)

**What:** toda comida usada com frequência mora no SQLite local; OFF é consultado só no miss, e o resultado é gravado de volta com flag de source.
**When to use:** fontes externas com rate limit + itens de alta recorrência (dieta real tem dezenas de alimentos repetidos).
**Trade-offs:** dado local pode ficar obsoleto se o produto mudar no OFF — irrelevante aqui (edição manual cobre).
**Ordem de resolução:** catálogo local (nome/barcode) → OFF síncrono com `fields` mínimos → grava → responde. Estimativa LLM (Hermes) fica **fora** do servidor.

### Pattern 3: Erro de negócio como resultado conversável

**What:** validações e estados que exigem decisão do usuário voltam como `isError: true` + texto acionável + `structuredContent` com código de status — nunca como exceção de protocolo nem como suposição silenciosa.
**When to use:** fim de fase sem próxima definida, estoque insuficiente, alimento ambíguo.
**Trade-offs:** nenhum relevante; é o mecanismo que o spec recomenda para auto-correção do modelo.

**Example:**
```typescript
// fim de fase sem próxima — o sistema PERGUNTA (via Hermes), nunca assume
if (!nextPhase) {
  return {
    isError: true,
    content: [{ type: "text", text: "A fase 'cutting' terminou em 2026-09-20 e não há próxima definida. Quer criar uma nova fase? (ex.: 'criar fase bulk a partir de 2026-09-24 com meta 2800kcal')" }],
    structuredContent: { status: "phase_expired", ended_phase: "cutting", ended_at: "2026-09-20" },
  };
}
```

## Scaling Considerations

Projeto single-user local — escala é volume de dados ao longo dos anos, não usuários.

| Escala (horizonte de uso) | Ajustes de arquitetura |
|-------|--------------------------|
| Ano 0–1 (~1k entries, ~100 fotos) | Nada a fazer: SQLite WAL dá conta sobrando; queries de agregação são <1ms |
| Anos 1–5 (~10k entries, ~1k fotos) | Ainda nada estrutural. Fotos: filesystem já evitou inflar o DB. Backup periódico (`VACUUM INTO` ou cópia com checkpoint) vira hábito |
| 5+ anos / se abrir dados a outra pessoa | Aí sim: separar `user_id` no schema (barato se previsto nas migrations) e considerar Streamable HTTP com auth — mas **não** fazer agora |

### Scaling Priorities

1. **Primeiro "gargalo" possível:** checkpoint starvation por leitor de longa duração no WAL (dashboard mantendo transação aberta). Mitigação: transações de leitura curtas no dashboard; `wal_autocheckpoint` padrão resolve.
2. **Segundo:** crescimento de `data/photos/` — mitigação é só disposição/limpeza manual; sem CDNs nem thumbnails em v1 (thumbnails podem entrar no dashboard depois, é cambio isolado).

## Anti-Patterns

### Anti-Pattern 1: CRUD genérico ("uma tool que executa SQL")
**What people do:** expor `db_query(sql)` ou uma tool `manage(entity, op, data)` universal.
**Why it's wrong:** transfere semântica, validação e segurança para o LLM a cada chamada; o spec obriga o servidor a validar entradas — com SQL genérico isso é inviável; descrições vagas = seleção de tool errada.
**Do this instead:** tools semânticas por domínio com `inputSchema` estrito (Pattern 1).

### Anti-Pattern 2: Parser de linguagem natural dentro do servidor
**What people do:** tool `log_meal_from_text {"text": "2 colheres de arroz"}` com parser próprio ou LLM embutido.
**Why it's wrong:** duplica o Hermes (que É o interpretador do produto); `sampling` foi desprecado no spec 2026-07-28 — servidor não deve contar com LLM do cliente, nem embutir SDK de LLM.
**Do this instead:** Hermes resolve texto → argumentos estruturados; servidor só valida e executa.

### Anti-Pattern 3: Datas por UTC / dia-x-base-de-dados torto
**What people do:** `date = new Date().toISOString().slice(0,10)` no servidor (UTC) para "o dia de hoje".
**Why it's wrong:** o saldo "de hoje" viraria o dia errado à noite no fuso de Brasília (UTC−3); pior bug possível num app de saldo diário.
**Do this instead:** `date` é sempre argumento explícito da tool, calculado pelo Hermes no fuso do usuário; gravado como `TEXT 'YYYY-MM-DD'`.

### Anti-Pattern 4: Fotos como BLOB no SQLite
**What people do:** guardar a foto na tabela.
**Why it's wrong:** infla o DB e o WAL, complica backup do banco, e o dashboard teria que servir bytes via rota dinâmica.
**Do this instead:** arquivos em `data/photos/`, DB guarda path; dashboard serve estáticos.

### Anti-Pattern 5: Bater no OFF sem cache / search-as-you-type
**What people do:** buscar no OFF a cada mensagem, ou autocomplete letra a letra.
**Why it's wrong:** limites oficiais de 15 (produto) e 10 (busca) req/min/IP; 503 e banimento.
**Do this instead:** cache write-through (Pattern 2); uma chamada OFF por mensagem no máximo.

### Anti-Pattern 6: Recalcular saldo no cliente (Hermes ou dashboard)
**What people do:** dashboard devolve "consumed" bruto e o frontend calcula o saldo; ou o LLM soma macros.
**Why it's wrong:** duas (ou três) implementações da regra central do produto; divergência silenciosa.
**Do this instead:** `domain/saldo.ts` é a única implementação; todo consumidor recebe o saldo pronto.

### Anti-Pattern 7: Supor estado do usuário na resposta
**What people do:** troca de fase sem próxima → assumir manutenção ou repetir metas antigas silenciosamente.
**Why it's wrong:** requisito explícito em contrário no PROJECT.md; erro silencioso de metas corrompe a confiança no saldo.
**Do this instead:** status estruturado `phase_expired` + Hermes pergunta (Pattern 3).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Hermes (cliente MCP) | stdio; Hermes lança `node dist/mcp/server.js` como subprocesso; config de MCP server do lado do Hermes | Sem rede; log do servidor vai para **stderr** (logging via protocolo está desprecado no 2026-07-28) [HIGH] |
| Open Food Facts | HTTP `GET /api/v3/product/{barcode}.json` (v2 deprecado) e busca v2/Search-a-licious; User-Agent `FlexDiet/1.0 (email do usuário)` | 15 req/min produto, 10 req/min busca; `fields` mínimos; write-through no catálogo [HIGH — docs oficiais] |
| TACO | Seed one-time: CSV convertido e vendido no repo; `scripts/seed.ts` popula `foods` com `source='taco'` | Fonte oficial (UNICAMP/NEPA) é PDF/XLSX; conversões comunitárias existem (GitHub/Kaggle) — nenhuma canônica verificada; revisar a conversão escolhida antes de semear [LOW] |
| Nuvem | **Nenhuma.** Tudo em `data/` local; sem telemetry | Constraint de privacidade do PROJECT.md |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `mcp/tools` ↔ `domain` | chamada de função direta | tools não conhecem SQL |
| `dashboard/routes` ↔ `domain` | chamada de função direta | mesmíssimo núcleo; saldo idêntico ao do WhatsApp |
| `domain` ↔ `db` | camada fina de queries | migrations no boot; WAL + `busy_timeout=5000` |
| MCP server ↔ dashboard | **nenhuma** | processos independentes; só dividem o arquivo SQLite (WAL suporta) |
| Hermes ↔ usuário | WhatsApp | fora do escopo |

## Ordem de Construção Sugerida (dependências entre componentes)

Cada estágio é verificável isoladamente, sem depender do Hermes:

1. **Núcleo + banco + seed** (`src/db`, `src/domain`, TACO)
   Migrações, WAL, seed do catálogo; serviços de domínio com testes unitários (saldo, fases, macros × gramas). *Verificação:* testes passam; nada de MCP/HTTP ainda. **Por quê primeiro:** tudo o mais é casca sobre isto.
2. **MCP server stdio com o circuito mínimo** (`log_meal`, `get_daily_summary`, `search_foods`, `set_targets`)
   *Verificação:* MCP Inspector (ferramenta oficial de dev) exercita as tools sem Hermes — o loop de valor central ("registrei → saldo") já existe e é demonstrável. **Por quê antes do OFF:** o saldo funciona só com TACO + itens inline.
3. **Integração OFF + cache** (`src/off`, `search_open_food_facts`, `create_food`)
   *Verificação:* barcode real → catálogo local cresce com `source='openfoodfacts'`; respeitar rate limits. **Depende de:** catálogo do estágio 1 para o write-through.
4. **Domínios secundários** (treino/cardio, suplementos+estoque, peso/medidas, presets, fases completas com `phase_expired`)
   Tools em lotes por domínio; cada um independente do outro. **Depende de:** só do estágio 2 (infra de tools pronta).
5. **Dashboard** (`src/dashboard`, `dashboard-ui`)
   Leitura do dia/semana, gráficos de peso, treinos, estoque; por último, timeline de fotos (depende do fluxo de fotos do estágio 4). **Depende de:** núcleo e domínios — e por ser só-leitura, nunca bloqueia nada.
6. **Fechamento:** `save_photo` + `get_weekly_summary` + configuração final no Hermes e automação do relatório (lado Hermes).

**Racional de dependência:** núcleo → (MCP ∥ dashboard são cascas do núcleo, mas MCP primeiro porque é o Core Value) → OFF enriquece o catálogo que o estágio 1 criou → domínios secundários reaproveitam a infra de tools → dashboard por último consome tudo já pronto, sem bloquear nenhuma entrega anterior.

## Sources

- Model Context Protocol — Architecture overview (spec 2026-07-28): https://modelcontextprotocol.io/docs/learn/architecture [oficial, lida integralmente]
- Model Context Protocol — Transports: https://modelcontextprotocol.io/docs/concepts/transports [oficial]
- Model Context Protocol — Tools (spec 2026-07-28): https://modelcontextprotocol.io/specification/2026-07-28/server/tools [oficial — annotations, outputSchema/structuredContent, isError, naming, stateless handles]
- SQLite — Write-Ahead Logging: https://www.sqlite.org/wal.html [oficial — concorrência multi-processo, busy_timeout]
- Open Food Facts — API documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/ [oficial — v3 barcode, busca, rate limits, User-Agent, bulk exports]
- MCP Inspector (ferramenta oficial de desenvolvimento/teste de servers): https://github.com/modelcontextprotocol/inspector [referência oficial; não executada nesta pesquisa]
- TACO (UNICAMP/NEPA) e conversões comunitárias (Kaggle, taco-api, repositórios GitHub): não verificado em detalhe — busca web limitada por rate limit do provider [LOW]
- Padrões de schema de diet trackers (foods per-100g + entries + targets): consenso de domínio corroborado indiretamente pelo data model do OFF (`nutriments` per 100g) e pela base TACO; referências self-hosted (wger, FitTrackee) conhecidas de treino, não reverificadas [MEDIUM]

---
*Architecture research for: Flex Diet — MCP server + SQLite + dashboard (personal flexible dieting)*
*Researched: 2026-09-23*
