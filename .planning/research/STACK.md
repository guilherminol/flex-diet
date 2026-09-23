# Stack Research

**Domain:** Servidor MCP pessoal + banco local + dashboard web leve (gestão de dieta flexível / fitness, usuário único, dados 100% locais)
**Researched:** 2026-09-23
**Confidence:** HIGH (versões verificadas direto no registro npm/PyPI e docs oficiais no dia da pesquisa)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS (local: v22.16.0) | Runtime único para MCP server + API do dashboard + build | Uma linguagem/processo só serve Hermes (MCP) e dashboard; Node 22 LTS cobre todos os requisitos de engines das deps escolhidas. **Confidence: HIGH** |
| TypeScript | ^5.9.3 | Linguagem do servidor e do dashboard | Tipagem reduz bugs em schemas de macros (números, unidades) e melhora codegen assistido por LLM. TS 7 (compilador nativo) já está no registro (7.0.2), mas é recém-estável — ^5.9 é o caminho conservador; se zero atrito, adotar 7 depois. **Confidence: MEDIUM-HIGH** |
| `@modelcontextprotocol/server` + `@modelcontextprotocol/express` | ^2.1.0 / ^2.0.1 | SDK oficial MCP (linha v2, spec 2026-07-28): `McpServer` + `registerTool`, transportes stdio e Streamable HTTP | SDK oficial, linha estável atual; adaptares finos para Express; schemas via Standard Schema (Zod v4). A v1 (`@modelcontextprotocol/sdk` 1.30.1) recebe correções por pelo menos 6 meses pós-v2 — fallback documentado caso o Hermes seja cliente de spec antiga. **Confidence: HIGH** |
| zod | ^4.6.5 | Schema de input das tools MCP e validação interna | Peer dependency oficial do SDK v2 (Standard Schema); valida gramas/macros antes de tocar o banco. **Confidence: HIGH** |
| better-sqlite3 | ^13.0.3 | Banco local (arquivo único `flexdiet.db`) | API síncrona = código direto sem pool/conexões, ideal para 1 usuário local; WAL permite o dashboard ler enquanto o MCP escreve. Requer Node >=22 (a máquina tem 22.16). **Confidence: HIGH** |
| express | ^5.2.1 | Um processo HTTP que expõe `/mcp` (Streamable HTTP) + endpoints JSON do dashboard + arquivos estáticos | O adapter oficial do SDK é peer de express ^4.18 \|\| ^5; um único servidor/porta para tudo mantém a operação simples (`npm start` e pronto). **Confidence: HIGH** |

**Decisão-chave de transporte:** rodar o MCP sobre **Streamable HTTP em localhost** (ex.: `http://localhost:8787/mcp`), não apenas stdio. Motivo: o dashboard já exige um servidor HTTP — com Streamable HTTP um único processo/porta atende Hermes (cliente MCP remoto por HTTP) e dashboard. O mesmo `McpServer` pode ser conectado a um `StdioServerTransport` com ~5 linhas se o Hermes preferir spawnar como subprocesso — a camada de tools é idêntica. **Confidence: HIGH** (spec 2026-07-28 lista stdio + Streamable HTTP como os dois transportes padrão; o antigo HTTP+SSE está deprecated).

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tsx | ^4.23.15 | Rodar TypeScript direto em dev (`tsx watch src/server.ts`), sem etapa de build no servidor | Sempre em dev; em "produção" pessoal também pode rodar com tsx (evita tsc build) |
| csv-parse | ^7.0.2 | Importar o CSV da TACO no seed do catálogo | Script one-off de seed (`scripts/seed-taco.ts`) |
| fetch nativo do Node 22 | — | Cliente Open Food Facts (barcode + busca por nome) | NÃO instalar SDK do OFF — a API é REST simples; uma função com `fetch` + User-Agent correta basta. Respeitar limites: 15 req/min (produto), 10 req/min (busca) |
| dayjs | ^1.11.23 | Datas/semanas locais (saldo do dia, relatório semanal, fuso America/Sao_Paulo) | Sempre para cálculo de "hoje/esta semana"; alternativa: `Intl` puro se quiser zero deps |
| React | ^19.3.0 | UI do dashboard | Dashboard com gráficos + timeline de fotos |
| Vite | ^8.3.0 | Build/dev do dashboard (`@vitejs/plugin-react`), output estático servido pelo Express | Requer Node ^20.19 \|\| >=22.12 (OK local) |
| Recharts | ^3.10.1 | Gráficos (macros do dia, peso/medidas, semana) | Consenso 2026 para dashboards React: declarativo, SVG, rápido de entregar (Querio, LogRocket, FusionCharts) |
| fs nativo | — | Arquivo de fotos (`data/photos/YYYY-MM-DD_*.jpg`) + metadados no SQLite | Fotos nunca no banco (blob), só caminho + data + vínculo com peso/medidas |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| @biomejs/biome | ^2.5.14 | Lint + format em um binário só (substitui ESLint+Prettier) — coerente com o requisito de simplicidade |
| vitest | ^5.0.1 | Testes das funções de saldo/macros e do migration runner; opcional, mas barato com o ecosystem Vite já presente |
| @types/express, @types/better-sqlite3 | ^5.0.6 / ^9.6.0 | Tipos oficiais em DefinitelyTyped |

## Installation

```bash
# Core (servidor: MCP + API + estáticos)
npm install @modelcontextprotocol/server @modelcontextprotocol/express zod better-sqlite3 express dayjs

# Dashboard
npm install react react-dom recharts
npm install -D vite @vitejs/plugin-react

# Dev
npm install -D typescript tsx csv-parse @biomejs/biome vitest @types/express @types/better-sqlite3 @types/react @types/react-dom
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| SDK TS oficial v2 (`@modelcontextprotocol/server` 2.1.0) | SDK TS v1 (`@modelcontextprotocol/sdk` 1.30.1) | Se o Hermes negociar apenas a spec anterior (era `initialize`): a v1 é compatível e mantida; o SDK v2 documenta fallback de era na spec. Trocar só se testar e falhar |
| SDK TS oficial | Python: `mcp` oficial (2.2.0) ou FastMCP independente (4.0.5) | Só se o usuário preferir manter tudo em Python; aqui o dashboard + ecossistema já empurram para Node, e 2 linguagens dobram a manutenção |
| SDK TS oficial | Framework `fastmcp` npm (4.20.16, TS) | DX com decorators, mas é uma dependência a mais sobre o SDK oficial; desnecessária para ~15 tools |
| better-sqlite3 | `node:sqlite` (DatabaseSync, zero deps) | `node:sqlite` só virou Release candidate no Node 25.7 — no Node 22 ainda é experimental. Reavaliar quando o projeto migrar para Node 24/26 LTS |
| better-sqlite3 | Drizzle ORM + drizzle-kit (0.31.11) | Se quiser type-safety de queries e migrations geradas; custo: mais uma camada. Para ~10 tabelas de usuário único, SQL puro com runner próprio é mais simples e auditável |
| Migrations: arquivos `NNN_*.sql` + runner de ~30 linhas | Knex/Umzug/graphile-migrate | Nenhum cenário neste projeto — o volume não justifica |
| Express 5 | Fastify / Hono | Ambos têm adapter oficial do SDK; escolha livre, mas Express é o peer mais documentado e o que o SDK já traz como dependência |
| Vite+React+Recharts | Página única HTML + Chart.js 4.5.1 (zero build) | Se quiser eliminar o frontend build: 1 arquivo `.html` + `<script>` do Chart.js serve os mesmos gráficos; perde componentes/timeline de fotos organizados. Variante "ainda mais simples" legítima |
| Streamable HTTP localhost | stdio (Hermes spawnando o processo) | Se o Hermes rodar na mesma máquina e suportar apenas stdio — o mesmo código de tools funciona; perde a porta compartilhada com o dashboard (o dashboard precisaria de segundo processo lendo o mesmo .db em WAL) |
| Acesso LAN direto ou Tailscale | Port-forwarding de roteador / ngrok | Se o Hermes rodar fora da máquina: Tailscale (free, WireGuard) expõe localhost sem exposição pública |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Banco na nuvem (Supabase, Firebase, Mongo Atlas, Turso) | Viola a constraint de privacidade (peso, fotos) e adiciona latência/rede para um usuário local | SQLite arquivo local + backup por cópia do `.db` |
| ORM completo (Prisma, Sequelize, TypeORM) | Prisma carrega engine binário próprio e codegen; overkill para ~10 tabelas de usuário único; cada camada a mais é fricção de manutenção | better-sqlite3 + SQL puro com tipos via `@types/better-sqlite3` |
| Auth real (OAuth, JWT, passport, sessões) | Sistema pessoal, localhost/LAN, sem multiusuário (explícito no PROJECT.md) | Nada; se exposto na LAN, um token estático checado no header do Hermes resolve |
| Docker/compose | Um processo Node + um arquivo .db numa máquina Windows pessoal; container só adiciona barreira entre o usuário e os dados | `npm start` direto |
| Frameworks server-side pesados (NestJS, Adonis) | 15 tools MCP + 5 endpoints JSON não precisam de DI/modules/decorators | Express 5 fino + módulos ES próprios |
| Transporte legado HTTP+SSE | Deprecated na spec em favor do Streamable HTTP | Streamable HTTP |
| Parser NLP próprio para refeições ("2 colheres de arroz") | O PROJECT.md atribui a interpretação ao LLM do Hermes; duplicar no servidor quebra a divisão de responsabilidades | Tools MCP semânticas com input já estruturado (gramas, food_id) |
| SDK/cliente pesado do Open Food Facts ou bulk dumps (JSONL de GBs) | Uso pessoal = poucas requisições/dia; os limites (15/10 req/min) só mordem sem cache | `fetch` nativo + cache no catálogo SQLite (o projeto já planejou isso) |
| LangChain/qualquer orquestrador de LLM no servidor | Não há LLM neste projeto; o LLM é o Hermes, fora do escopo | Tools MCP puramente determinísticas |
| Electron/Tauri para o dashboard | O navegador já está lá; empacotar app desktop é complexidade sem ganho | Página estática servida pelo próprio Express |
| TypeScript 7 imediato | Recém-estabilizado; risco pequeno mas real de atrito com tooling (tsx/esbuild, tipos de libs) | ^5.9.3 agora; migrar para 7 quando o ecossistema consolidar |

## Stack Patterns by Variant

**Se o Hermes roda na mesma máquina (caminho provável):**
- Subir o Express em `localhost:8787` com `/mcp` (Streamable HTTP) + `/api/*` + estáticos do dashboard
- Hermes aponta o cliente MCP para `http://localhost:8787/mcp`; sem auth (ou token estático)
- Um processo, um banco, um comando

**Se o Hermes roda em outra máquina da LAN:**
- Bind do Express em `0.0.0.0` (ou IP da LAN) e Hermes usa `http://<ip-da-maquina>:8787/mcp`
- Adicionar token estático no header; para acesso fora de casa, Tailscale em vez de port-forwarding

**Se o Hermes exigir stdio:**
- Mesmo `McpServer` conectado a `StdioServerTransport` num entrypoint alternativo (`src/stdio.ts`)
- Dashboard passa a rodar como segundo processo lendo o mesmo `flexdiet.db` — ativar WAL (`PRAGMA journal_mode=WAL`) para leitura concorrente segura

**Importação TACO (seed do catálogo):**
- Fonte recomendada: repositório `brolesi/taco` (MIT, TACO 4ª ed. NEPA/UNICAMP, DOI Zenodo, atualizado em 2026-09) — `data/processed/taco/taco_composicao.csv` (valores por 100g) + CSV de medidas caseiras em gramas (útil para "2 colheres de arroz")
- Alternativa verificada: `marcelosanto/tabela_taco` (`TACO.json`, pronto para importar, menos mantido)
- Script one-off `scripts/seed-taco.ts` com csv-parse → `INSERT` em `food_catalog` com flag `source='taco'`

**Open Food Facts:**
- Barcode: `GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=...`
- Busca por nome: `/api/v2/search` (estruturada) ou `/cgi/search.pl` (busca textual legada; o full-text está migrando para search-a-licious)
- Enviar `User-Agent: FlexDiet/0.1 (email)` — obrigatório; cachear todo resultado no catálogo local (limites: 15 req/min leitura, 10 req/min busca)
- Caveat oficial: dados crowdsourced, "sem garantia de exatidão" — tratar valores do OFF como estimativa editável pelo usuário

**Relatório semanal:**
- Números 100% via SQL (aderência de macros, treinos, suplementos) numa tool `get_weekly_report` que retorna JSON estruturado; a prosa para o WhatsApp é montada pelo LLM do Hermes
- Regra: dado determinístico no banco, linguagem no LLM — nenhuma lib nova necessária

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| better-sqlite3@^13 | Node >=22 | Máquina local tem v22.16.0 — OK. Se rodar em Node 20, usar better-sqlite3@^12.4.5 |
| @modelcontextprotocol/server@^2.1.0 | zod@^4 (Standard Schema), spec 2026-07-28 | v1 do SDK aceita zod ^3.25 \|\| ^4.0 |
| @modelcontextprotocol/express@^2.0.1 | express@^4.18 \|\| ^5, @modelcontextprotocol/server@^2.1.0 | Usar express@^5.2.1 |
| @modelcontextprotocol/server@^2 (cliente Hermes) | Espec 2026-07-28 + fallback p/ eras anteriores | Testar cedo a conexão do Hermes; se falhar, pinar @modelcontextprotocol/sdk@1.30.1 (v1) |
| vite@^8 | Node ^20.19.0 \|\| >=22.12.0 | OK com Node 22.16 local |
| react@19 + recharts@^3 | Recharts 3 suporta React 19 | Não usar recharts@2 com React 19 |
| tsx@^4 | TypeScript ^5.9 (type-check à parte com tsc) | tsx não faz type-check; rodar `tsc --noEmit` no script de check |

## Sources

- Registro npm (consultado 2026-09-23, via `npm view`): versões e engines de todas as packages citadas — **HIGH**
- github.com/modelcontextprotocol/typescript-sdk (README v2): pacotes v2, `McpServer`/`registerTool`, transportes, Zod v4/Standard Schema, janela de manutenção da v1 — **HIGH**
- modelcontextprotocol.io — Specification 2026-07-28, Transports (stdio, Streamable HTTP, compatibilidade com eras anteriores) — **HIGH**
- openfoodfacts.github.io/openfoodfacts-server/api/: endpoints v2, User-Agent obrigatória, rate limits (15/10 req/min), licença ODbL, caveat de qualidade — **HIGH**
- nodejs.org/api/sqlite.html: `node:sqlite` Release candidate a partir do Node 25.7 — **HIGH**
- api.github.com: repositórios `brolesi/taco` (22 stars, push 2026-09-14, MIT, Zenodo DOI) e `marcelosanto/tabela_taco` (19 stars) inspecionados diretamente — **HIGH**
- Comparações Recharts vs Chart.js 2026 (LogRocket, FusionCharts, PkgPulse, Querio): consenso Recharts para dashboards React — **MEDIUM**
- PyPI (via API JSON): `mcp` 2.2.0 (oficial, v2, Py>=3.10), `fastmcp` 4.0.5 (independente) — **MEDIUM** (contexto da alternativa Python)

---
*Stack research for: Flex Diet — MCP server pessoal + SQLite + dashboard*
*Researched: 2026-09-23*
