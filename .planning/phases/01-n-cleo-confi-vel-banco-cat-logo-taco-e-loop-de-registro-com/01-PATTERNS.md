# Phase 1: Núcleo confiável — banco, catálogo TACO e loop de registro com saldo - Pattern Map

**Mapped:** 2026-09-23
**Files analyzed:** 36 (25 src/config + 2 CSVs vendados + 9 tests + 1 script)
**Analogs found:** 2 / 36 — `Dockerfile` e `docker-compose.yml` têm o `deploy.yml` como analog real; TODO o resto é greenfield

> **GREENFIELD EXPLÍCITO:** O repositório NÃO tem código-fonte. `git ls-files` confirma que os únicos
> arquivos tracked são `.claude/CLAUDE.md`, `.github/workflows/deploy.yml` e `.planning/*`.
> Não existe `src/`, `package.json`, `tsconfig`, testes, Dockerfile ou migrations.
> O `CLAUDE.md` do projeto declara: *"Conventions not yet established"* / *"Architecture not yet mapped"*.
>
> **Consequência para o planner:** para 34 dos 36 arquivos, a fonte de padrão NÃO é o codebase —
> são os **§Code Examples 1–6 do `01-RESEARCH.md`** (todos verificados contra fontes primárias nesta
> sessão de research: README/fonte do SDK oficial MCP v2, docs better-sqlite3, day.js.org, csv.js.org,
> dataset `brolesi/taco` clonado). Os excerpts abaixo já trazem o código concreto + a linha do
> RESEARCH.md onde vivem. Esta fase **estabelece** os padrões que as fases 2–5 vão copiar (CONTEXT.md:
> "os padrões de projeto nascem nesta fase e viram referência pras fases 2–5") — escolhas do planner
> aqui viram o analog futuro.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `package.json` | config | — | nenhum (greenfield) — RESEARCH.md §Standard Stack "Installation" (L116-121) | no-analog |
| `tsconfig.json` | config | — | nenhum — convenção TS 5.9 + tsx sem build (RESEARCH L90, 101) | no-analog |
| `vitest.config.ts` | config | — | nenhum — RESEARCH §Validation Architecture (L539-546) | no-analog |
| `.gitignore` | config | — | nenhum — MAS obrigatório ANTES do 1º commit (Security V14, RESEARCH L590) | no-analog |
| `compose.env.example` | config | — | nenhum — RESEARCH estrutura (L216) | no-analog |
| `src/server.ts` | entrypoint/controller | request-response | RESEARCH §Code Example 1 (L346-393) | no-analog (external verified) |
| `src/mcp/server.ts` | provider (factory McpServer) | request-response | RESEARCH §Code Example 1 `buildServer` (L357-369) | no-analog (external verified) |
| `src/mcp/tools/registrar.ts` | controller (tool MCP) | request-response + CRUD | RESEARCH §Pattern 5 tabela (L241-249) + Example 1 | no-analog |
| `src/mcp/tools/saldo.ts` | controller (tool MCP) | request-response | RESEARCH §Pattern 5 (L243) + Example 1 `consultar_saldo` (L359-366) | no-analog |
| `src/mcp/tools/catalogo.ts` | controller (tool MCP) | request-response (search) | RESEARCH §Pattern 5 `buscar_alimento` (L244) | no-analog |
| `src/mcp/tools/registros.ts` | controller (tool MCP) | CRUD | RESEARCH §Pattern 5 (L245-247) | no-analog |
| `src/mcp/tools/metas.ts` | controller (tool MCP) | CRUD | RESEARCH §Pattern 5 `definir_metas` (L248-249) | no-analog |
| `src/domain/refeicoes.ts` | service | CRUD (transacional) | RESEARCH §Pattern 2 + Pitfall 9 (sync-only) | no-analog |
| `src/domain/saldo.ts` | service | transform (derivado em leitura) | RESEARCH §Architectural Responsibility Map (L78) + Pattern 3 | no-analog |
| `src/domain/alimentos.ts` | service | CRUD-read (busca) | RESEARCH §Pattern 5 `buscar_alimento` + Security V5 (prepared stmt) | no-analog |
| `src/domain/metas.ts` | service | CRUD | RESEARCH §Pattern 5 `definir_metas` + D-09/D-10 | no-analog |
| `src/db/connect.ts` | model (connection) | CRUD | RESEARCH §Code Example 2 (L398-403) | no-analog (external verified) |
| `src/db/migrate.ts` | migration runner | batch | RESEARCH §Pattern 4 + Code Example 2 (L405-410) | no-analog (external verified) |
| `src/db/migrations/001_init.sql` | migration | batch | nenhum — schema nasce aqui (tabelas refeicao/item/alimento/metas/dedupe) | no-analog |
| `src/db/seed/seed.ts` | service (seed) | batch + file-I/O | RESEARCH §Code Example 4 (L428-439) + Pitfalls 1-3 | no-analog (external verified) |
| `src/db/seed/taco_composicao.csv` | vendored data | file-I/O | dataset `brolesi/taco` v1.7.0 (header verbatim em RESEARCH L432-434) | no-analog (vendored) |
| `src/db/seed/pof_medidas_caseiras.csv` | vendored data | file-I/O | idem (RESEARCH L608) | no-analog (vendored) |
| `src/lib/datas.ts` | utility | transform | RESEARCH §Code Example 3 (L414-424) | no-analog (external verified) |
| `src/lib/dedupe.ts` | utility | transform (hash) | RESEARCH §Code Example 5 (L442-453) | no-analog (external verified) |
| `Dockerfile` | config (container) | — | **`​.github/workflows/deploy.yml`** (tracked) + RESEARCH Example 6 (L456-464) | role-match (contrato real) |
| `docker-compose.yml` | config (container) | — | **`​.github/workflows/deploy.yml`** (tracked) + RESEARCH Example 6 (L465-478) | **exact** (é o contrato que ele consome) |
| `tests/*.test.ts` (9 arquivos) | test | — | nenhum — mapa req→teste pronto em RESEARCH §Validation Architecture (L547-561) | no-analog |
| `scripts/check-deploy-contract.mjs` | utility (script CI) | file-I/O | `deploy.yml` L37 (o check que ele faz na VPS, versionado localmente) | partial |

## Pattern Assignments

### `docker-compose.yml` + `Dockerfile` (config, deploy) — ÚNICO ANALOG REAL DO CODEBASE

**Analog:** `.github/workflows/deploy.yml` (git-tracked, verificado via `git ls-files`)
**What to copy:** o contrato EXATO que o workflow remoto executa. O compose tem que existir com um
destes dois nomes na RAIZ do repo, e o deploy é `git pull --ff-only` + `docker compose up -d --build`.

**Contrato de deploy que o novo compose satisfaz** (deploy.yml linhas 34-43, verbatim):
```yaml
          ssh -i /tmp/deploy_key -p "${VPS_PORT:-22}" \
              -o StrictHostKeyChecking=accept-new \
              -o ConnectTimeout=15 \
              "$VPS_USER@$VPS_HOST" bash -s -- "${VPS_PATH:-/opt/flex-diet}" <<'REMOTE'
            set -euo pipefail
            cd "$1"
            if [ ! -f docker-compose.yml ] && [ ! -f compose.yaml ]; then
              echo "Nada para deployar ainda (sem compose file em $1) — pulando."
              exit 0
            fi
            git pull --ff-only
            docker compose up -d --build
          REMOTE
```

**Skip silencioso sem secrets** (deploy.yml linhas 24-27) — o 1º deploy exige checkpoint humano
(secrets `VPS_HOST/VPS_USER/VPS_PORT/VPS_PATH/VPS_SSH_KEY`), senão o Actions fica "verde" sem deployar:
```
          if [ -z "$VPS_HOST" ] || [ -z "$VPS_USER" ] || [ -z "$SSH_KEY" ]; then
            echo "::notice::Secrets VPS_HOST / VPS_USER / VPS_SSH_KEY nao configurados — deploy pulado."
            exit 0
          fi
```

**Implicações concretas para o planner:**
1. Compose na raiz, bind mount `./data:/app/data` (sobrevive ao `git pull`; `data/` gitignored).
2. Migrations + seed idempotentes rodando NO BOOT do container → o `--build` de cada merge é seguro.
3. Healthcheck apontando para `/healthz` (smoke pós-deploy).
4. Dockerfile: `node:22-slim` — NUNCA alpine (better-sqlite3 sem prebuild musl; RESEARCH Pitfall 5, L316-319).

**Template completo pronto** — RESEARCH.md §Code Example 6 (linhas 456-478) traz Dockerfile + compose
já aderentes a esse contrato; copiar de lá.

---

### `src/server.ts` + `src/mcp/server.ts` (entrypoint/provider, request-response)

**Analog:** nenhum no codebase. Fonte: RESEARCH.md §Code Example 1 (L346-393), adaptado do exemplo
OFICIAL do SDK (`github.com/modelcontextprotocol/typescript-sdk` → `examples/bearer-auth/server.ts`).

**Imports + bootstrap do app MCP** (RESEARCH L350-356, 380-386):
```typescript
import type { OAuthTokenVerifier } from '@modelcontextprotocol/express';
import { createMcpExpressApp, requireBearerAuth } from '@modelcontextprotocol/express';
import { toNodeHandler } from '@modelcontextprotocol/node';
import type { AuthInfo, McpServerFactory } from '@modelcontextprotocol/server';
import { createMcpHandler, McpServer, OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
// ...
const handler = createMcpHandler(buildServer);          // stateless: factory POR request
const app = createMcpExpressApp({ host: '0.0.0.0', allowedHosts: [process.env.PUBLIC_HOST!] });
const node = toNodeHandler(handler);
const auth = requireBearerAuth({ verifier: staticTokenVerifier, requiredScopes: ['mcp'] });
app.all('/mcp', auth, (req, res) => void node(req, res, req.body)); // req.body OBRIGATÓRIO (3º arg)
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.listen(Number(process.env.PORT ?? 8787));
```

**Factory stateless do servidor MCP** (RESEARCH L357-369):
```typescript
const buildServer: McpServerFactory = (ctx) => {
  const server = new McpServer({ name: 'flex-diet', version: '0.1.0' });
  server.registerTool('consultar_saldo', {
    description: 'Saldo restante do dia (kcal, proteína, carbo, gordura)',
    inputSchema: z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
    annotations: { readOnlyHint: true },
  }, async ({ data }) => {
    const saldo = domain.saldo.doDia(data ?? datas.hojeLocal()); // ou status meta_nao_definida (D-09)
    return { content: [{ type: 'text', text: JSON.stringify(saldo) }], structuredContent: saldo };
  });
  // ... demais tools (Pattern 5)
  return server;
};
```

**Gotchas que o excerpt carrega (não omitir na implementação):**
- `host: '0.0.0.0'` + `allowedHosts` obrigatórios na VPS — sem isso o próprio servidor responde 403 ao Hermes (Pitfall 4, RESEARCH L311-314).
- `req.body` como 3º argumento do node handler é OBRIGATÓRIO — express.json já consumiu o stream (Pitfall 7, L326-329).
- Stateless por request: zero estado em memória; tudo no SQLite (Pattern 1, L220-223).

---

### `src/mcp/tools/*.ts` (controller/tool MCP, request-response)

**Analog:** nenhum no codebase. Fonte: RESEARCH.md §Pattern 5 (L237-251) — tabela completa das 8 tools
com input zod e output estruturado de cada uma. O planner usa essa tabela como contrato por tool.

**Shape de input/output por tool** (RESEARCH L242-249, resumo):
| Tool | Input (zod) | Output |
|------|-------------|--------|
| `registrar_refeicao` | `data?`, `itens[] {alimento_id, gramas>0}` OBRIGATÓRIO, `tipo_refeicao?` | eco dos itens (nome+gramas+fonte+macros), `id_curto`, `saldo`, `duplicado?` |
| `consultar_saldo` | `data?` | `saldo` OU `status: "meta_nao_definida"` + instrução (D-09) |
| `buscar_alimento` | `termo` | top-5: id, nome, macros por 100g, `medidas_caseiras[]` (vazio sem match inequívoco) |
| `listar_registros` | `data?` | registros do dia com `id_curto` |
| `editar_registro` | `id_curto`, `itens[]` (substituição completa, atômica), `data?` | eco novo + saldo |
| `remover_registro` | `id_curto` | confirmação + saldo |
| `repetir_refeicao` | `data_origem`, `id_curto_origem?`/`tipo_refeicao?`, `data_destino?` | novo registro + saldo |
| `definir_metas` | `kcal, proteina_g, carbo_g, gordura_g` — OS 4 required (D-10) | metas + saldo recalculado |

**Erros de negócio — padrão obrigatório** (RESEARCH L251): `isError: true` + texto acionável + código
estruturado (`alimento_nao_encontrado` com sugestões, `registro_nao_encontrado`, `meta_nao_definida`) —
NUNCA exceção crua. Annotations: `readOnlyHint` em consultas, `destructiveHint` em remover.

---

### `src/domain/refeicoes.ts` (service, CRUD transacional)

**Analog:** nenhum no codebase. Fonte: RESEARCH.md §Pattern 2 (L226-227) + §Pattern 3 (L229-231).

**Fluxo de registro** (RESEARCH L186): valida zod → dedupe (hash+janela) → transação sync (insere
refeição + itens com macros snapshot) → `saldo.ts` deriva consumo vs metas → resposta estruturada.
Toda escrita 100% SÍNCRONA — `db.transaction()` rejeita funções async (Pitfall 9, RESEARCH L336-338):
> "todo o trabalho de escrita (registrar/editar/remover) é 100% síncrono (queries better-sqlite3 são
> sync); nada de `await` dentro do closure da transação."

**Id curto** (RESEARCH L279, "Don't Hand-Roll"):
```typescript
crypto.randomBytes(2).toString('hex')  // 4 hex chars (#a3f2) + retry em colisão no dia
```

### `src/domain/saldo.ts` (service, transform)

**Analog:** nenhum. REgra dura do roadmap (RESEARCH L78): saldo NUNCA armazenado — derivado em leitura
por ESTA ÚNICA implementação. Sem metas → `meta_nao_definida` + instrução, nunca números inventados (D-09).
`COALESCE(col, 0)` nos macros não analisados (Pitfall 2, RESEARCH L301-304).

---

### `src/db/connect.ts` + `src/db/migrate.ts` (model/migration, batch)

**Analog:** nenhum no codebase. Fonte: RESEARCH.md §Code Example 2 (L395-411), APIs verificadas nos
docs oficiais better-sqlite3.

**Conexão + pragmas** (RESEARCH L398-403):
```typescript
import Database from 'better-sqlite3';
const db = new Database('data/flexdiet.db');
db.pragma('journal_mode = WAL');      // testar: db.pragma('journal_mode', { simple: true }) === 'wal'
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');
```

**Runner user_version + backup pré-migration** (RESEARCH L405-410):
```typescript
const atual = db.pragma('user_version', { simple: true }) as number;
for (const m of migrations.filter(m => m.version > atual)) {
  await db.backup(`data/backups/pre-migration-${m.version}-${Date.now()}.db`); // PROMISE — fora de transação
  db.exec(m.sql);
  db.pragma(`user_version = ${m.version}`);
}
```
Gotcha (Pitfall 6, L321-324): `db.backup()` é promise e NÃO pode rodar dentro de `db.transaction(fn)`.
Backup em WAL feito com `db.backup()` — nunca `copyFileSync` do `.db` cru.

---

### `src/db/seed/seed.ts` (service, batch + file-I/O)

**Analog:** nenhum no codebase. Fonte: RESEARCH.md §Code Example 4 (L427-439) + Pitfalls 1-3.

**Seed idempotente + sanidade** (RESEARCH L429-438):
```typescript
import { parse } from 'csv-parse/sync';
const rows: TacoRow[] = parse(csvText, { columns: true, skip_empty_lines: true });
// valores "": NULL (não analisado); 1e-05: Tr → 0
const bananaMaca = rows.find(r => r.numero_alimento === '178')!;  // energia_kcal 86.805
if (!(bananaMaca.energia_kcal > 85 && bananaMaca.energia_kcal < 89)) throw new Error('sanidade: banana');
// upsert por (fonte='taco', numero_taco) → seed re-roda a cada boot/deploy sem duplicar
// medidas: join POF→TACO apenas por nome-base INEQUÍVOCO (~82 alimentos; ver Pitfall 3)
```
Regras duras do excerpt:
- Ler EXCLUSIVAMENTE `energia_kcal` (nunca `energia_kj` — catálogo inflado 4,18x, Pitfall 1).
- Vazio → NULL ("não analisado"); `1e-05` (Tr) → 0 (Pitfall 2).
- Join POF↔TACO só por nome-base inequívoco; resto fica `medidas_caseiras: []` (Pitfall 3) — NÃO inventar fuzzy-match.
- CSVs vendados no repo em `src/db/seed/` (Wave 0 gap, RESEARCH L572).

---

### `src/lib/datas.ts` (utility, transform)

**Analog:** nenhum no codebase. Fonte: RESEARCH.md §Code Example 3 (L413-425), day.js.org verificado.

```typescript
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc); dayjs.extend(timezone);

export const agoraIsoUtc = () => new Date().toISOString();                    // timestamp_utc
export const dataLocalSp = (iso: string) =>
  dayjs(iso).tz('America/Sao_Paulo').format('YYYY-MM-DD');                    // data_local
export const hojeLocalSp = () => dayjs().tz('America/Sao_Paulo').format('YYYY-MM-DD');
```
Padrão de escrita (Pattern 3, L229-231): todo insert grava `timestamp_utc` (fonte da verdade) E
`data_local` calculado UMA vez na escrita; toda leitura/agregação usa `data_local`.

---

### `src/lib/dedupe.ts` (utility, transform)

**Analog:** nenhum no codebase. Fonte: RESEARCH.md §Code Example 5 (L441-453).

```typescript
import { createHash } from 'node:crypto';
export function dedupeHash(dataLocal: string, itens: {alimento_id: number; gramas: number}[]) {
  const canon = JSON.stringify({
    data_local: dataLocal,
    itens: itens.map(i => ({ alimento_id: i.alimento_id, gramas: Number(i.gramas.toFixed(1)) }))
                .sort((a, b) => a.alimento_id - b.alimento_id),
  });
  return createHash('sha256').update(canon).digest('hex');
}
// busca: SELECT * FROM refeicao WHERE dedupe_hash = ? AND timestamp_utc >= datetime('now', '-10 minutes')
```
Gotcha (Pitfall 10, L340-342): arredondar gramas e ordenar itens ANTES do hash. Payload canônico é
EXATAMENTE `{itens + gramas + data_local}` (D-07) — não incluir tipo de refeição nem timestamp.
Consulta temporal, não unique index. Hit → registro original + saldo + `duplicado: true` (D-08).

---

### `tests/*.test.ts` (test) + `scripts/check-deploy-contract.mjs`

**Analog:** nenhum — repo sem testes. O mapa req→teste JÁ ESTÁ PRONTO no RESEARCH §Validation
Architecture (L547-561): 12 linhas cobrindo ALIM-01/06, INFRA-01/02/03/04/05, REG-01..06, META-01,
cada uma com comando `npx vitest run tests/<arquivo>.test.ts`. Valores de sanidade reais do TACO
(banana maçã 86,805 kcal; óleo soja 884; assert `journal_mode === 'wal'`) em RESEARCH L287-298.
`check-deploy-contract.mjs` replica localmente o check que o deploy.yml faz na VPS (L37:
`docker-compose.yml` OU `compose.yaml` existe na raiz) + `data/` gitignored.

## Shared Patterns

### Autenticação Bearer com token estático
**Source:** RESEARCH.md §Code Example 1 (L371-384) — padrão OFICIAL do SDK (exemplo `bearer-auth`)
**Apply to:** rota `/mcp` apenas; `/healthz` deliberadamente sem auth (só `{ok:true}`)
```typescript
const staticTokenVerifier: OAuthTokenVerifier = {
  async verifyAccessToken(token): Promise<AuthInfo> {
    if (!timingSafeEq(token, process.env.MCP_TOKEN ?? '')) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'token inválido');
    }
    return { token, clientId: 'hermes', scopes: ['mcp'], expiresAt: Math.floor(Date.now() / 1000) + 3600 };
  },
};
```
Comparação em tempo constante (`crypto.timingSafeEqual`); token só do env, nunca no git (ASVS V2, L584).

### Resposta JSON estruturada das tools (D-05)
**Source:** RESEARCH.md L365 + Pattern 5
**Apply to:** TODAS as 8 tools
```typescript
return { content: [{ type: 'text', text: JSON.stringify(saldo) }], structuredContent: saldo };
```
Nunca texto pronto pra repassar — o Hermes escreve a mensagem do WhatsApp.

### Erro de negócio como resultado estruturado
**Source:** RESEARCH.md L251, ASVS V7 (L589)
**Apply to:** todas as tools e services — `isError: true` + código estruturado + texto acionável; logs em stderr SEM o token.

### Escrita síncrona em transação
**Source:** RESEARCH.md Pitfall 9 (L336-338), docs better-sqlite3
**Apply to:** `domain/refeicoes.ts` (registrar/editar/remover), `db/migrate.ts`, `db/seed/seed.ts` — zero `await` dentro de `db.transaction(fn)`.

### Prepared statements em 100% das queries
**Source:** RESEARCH.md ASVS V5 (L587) + threat table (L598)
**Apply to:** todo acesso a dados; busca de texto via parâmetro com escape de `%`/`_` do LIKE.

### Data dupla: `timestamp_utc` + `data_local`
**Source:** RESEARCH.md Pattern 3 (L229-231) + Code Example 3
**Apply to:** todo insert (refeicao, itens, metas); `data` opcional nas tools com default = hoje local America/Sao_Paulo.

### Boot idempotente (migrations → seed)
**Source:** RESEARCH.md Pattern 4 + Code Example 4 (upsert por fonte+id externo)
**Apply to:** `src/server.ts` — cada boot/deploy roda migrations pendentes (com backup prévio) e o seed do TACO/POF sem duplicar; torna o `--build` do deploy seguro.

### Privacidade gitignore-first
**Source:** RESEARCH.md ASVS V14 (L590) + Pitfall 8
**Apply to:** `.gitignore` criado ANTES do 1º commit: `data/`, `compose.env`, `*.db*` (dados de saúde nunca no git). Nota: o "What NOT to Use" do CLAUDE.md lista "Docker/compose" como evitar — isso descrevia o cenário antigo local/Windows; a decisão da fase (CONTEXT.md domain + deploy.yml existente) é Docker Compose na VPS e prevalece.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Todos exceto `Dockerfile`/`docker-compose.yml`/`check-deploy-contract.mjs` | todos | todos | Repositório greenfield: nenhum código-fonte tracked além de `deploy.yml`. Usar os §Code Examples 1–6 do RESEARCH.md (verificados contra fontes oficiais) — NÃO procurar analogs em `node_modules` ou caches |

## Metadata

**Analog search scope:** repo inteiro (`git ls-files` + varredura de diretórios) — confirmando que só existem `.claude/CLAUDE.md`, `.github/workflows/deploy.yml` e `.planning/*`
**Files scanned:** 3 tracked de código/docs (deploy.yml lido integralmente, CLAUDE.md lido integralmente, planning docs via required reading)
**Verificação tracked-source:** `.github/workflows/deploy.yml` confirmado git-tracked; nenhum caminho de mirror/gitignore nomeado como analog
**Pattern extraction date:** 2026-09-23
