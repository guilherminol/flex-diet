---
phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com
plan: 04
subsystem: infra
tags: [docker, docker-compose, deploy, github-actions, vps, backup, sqlite, better-sqlite3, node22-slim]

# Dependency graph
requires:
  - phase: 01-01
    provides: servidor MCP com boot idempotente (migrations + seed no boot), /healthz sem auth, /mcp com Bearer token do env
provides:
  - Dockerfile node:22-slim + docker-compose.yml na raiz no contrato exato que .github/workflows/deploy.yml executa na VPS (build, ports, env_file, volume ./data:/app/data, healthcheck /healthz)
  - scripts/check-deploy-contract.mjs — check versionado do contrato (compose/Dockerfile/exemplo na raiz + data/ e compose.env gitignored), replica localmente o check da VPS
  - Backup diário do .db via db.backup() (snapshot consistente em WAL) com retenção de 7 (D-02), agendado no boot (job interno, timer unref, erro não derruba o serviço)
  - compose.env.example documentando MCP_TOKEN/PORT/PUBLIC_HOST (o real só existe na VPS)
affects: [01-05, phase-02, phase-05]

# Actuals (#2632) — emparelha com o `estimate` do plan (44000 tokens, 3 tasks)
actuals:
  tokens: 5280     # chars/4 sobre o diff realizado (21122 chars, 10 arquivos — plano de arquivos de config; sem CSVs)
  tasks: 2         # Tasks 1-2 completas; Task 3 (checkpoint do 1º deploy) pendente de confirmação humana
  commits: 2       # MEASURED: git rev-list --count a47192e..HEAD na escrita deste SUMMARY (commits de produção)
commits: 2
plan_head_before: a47192e0ad51213ee85eeb50895f5a05b5afe2c7

# Tech tracking
tech-stack:
  added:
    - "Docker (node:22-slim) + Docker Compose — contrato de deploy do deploy.yml"
  patterns:
    - "Deploy: compose na raiz é o contrato versionado do deploy.yml; check-deploy-contract.mjs roda antes de cada push"
    - "npm ci --ignore-scripts na imagem: melhor-sqlite3 13 traz prebuilds no tarball (carregados em runtime); nenhum lifecycle script de terceiro roda no build"
    - "Backup: db.backup() para snapshot WAL-safe; retenção como função PURA testável (reterUltimos) separada do executor (aplicarRetencao)"
    - "Job interno no processo para agendamento (setInterval 24h + unref) — zero infra extra (discretion do CONTEXT)"

key-files:
  created:
    - "Dockerfile (node:22-slim, npm ci --omit=dev --ignore-scripts, CMD via tsx local)"
    - ".dockerignore (node_modules, data, .git, .planning, compose.env, tests)"
    - "docker-compose.yml (contrato do deploy.yml: build, ports ${PORT:-8787}:8787, env_file compose.env, volume ./data:/app/data, healthcheck /healthz)"
    - "compose.env.example (MCP_TOKEN/PORT/PUBLIC_HOST — o real só na VPS)"
    - "scripts/check-deploy-contract.mjs (check versionado do contrato de deploy)"
    - "src/db/backup.ts (fazerBackupDiario, reterUltimos, aplicarRetencao, agendarBackupDiario)"
    - "tests/backup.test.ts (5 testes: cópia legível, retenção 9→7, remoção cirúrgica, restauração)"
  modified:
    - "package.json / package-lock.json (tsx movido para dependencies — pré-requisito do --omit=dev)"
    - "src/server.ts (boot agenda o backup diário em <dir-do-banco>/backups)"

key-decisions:
  - "--ignore-scripts no npm ci do Dockerfile: npm ci roda o node-gyp rebuild default do binding.gyp do better-sqlite3 e exigiria python3/make/g++ no slim; o tarball v13 já traz prebuilds/linux-x64.node carregado em runtime (provado com smoke no exato node:22-slim) — evita build de fonte a cada deploy (RESEARCH Pitfall 5)"
  - "tsx movido de devDependencies para dependencies: npm ci --omit=dev não pode remover o runner do processo de produção (pré-requisito declarado pelo plan)"
  - "Backup diário como job interno no processo (agendarBackupDiario com setInterval 24h unref) — discretion do CONTEXT (job interno vs cron no compose); erro loga em stderr e NUNCA derruba o serviço"
  - "Lado interno do container fixado em 8787 (healthcheck e mapeamento); PORT do compose.env documenta a porta do host — consistência explícita no compose.env.example"

patterns-established:
  - "Deploy contínuo: merge na main → deploy.yml roda git pull --ff-only + docker compose up -d --build na VPS; migrations+seed idempotentes no boot tornam cada --build seguro"
  - "Check de contrato antes de push: node scripts/check-deploy-contract.mjs (exit 1 se compose/Dockerfile/gitignore quebrados)"
  - "Retenção de backups: decisão pura (reterUltimos) separada da execução (aplicarRetencao); padrão diario-* isolado de pre-migration-*"

requirements-completed: []  # INFRA-05 permanece ABERTO por design: só é completado quando o 1º deploy real for confirmado no checkpoint (Task 3) — nunca com o notice de deploy pulado

coverage:
  - id: D1
    description: "Contrato de deploy versionado: docker-compose.yml na raiz (build, volume ./data:/app/data, env_file compose.env, healthcheck /healthz) + Dockerfile node:22-slim com npm ci --omit=dev e CMD via tsx local + check-deploy-contract.mjs (INFRA-05, T-01-13)"
    requirement: INFRA-05
    verification:
      - kind: other
        ref: "node scripts/check-deploy-contract.mjs → 'contrato de deploy ok' (exit 0); com compose renomeado → exit 1 (prova da falha)"
        status: pass
      - kind: other
        ref: "docker compose build → exit 0, zero linhas node-gyp/python, zero ERROR"
        status: pass
      - kind: integration
        ref: "smoke do container flexdiet-flex-diet: boot com seed 597 TACO, GET /healthz → {\"ok\":true}, POST /mcp sem token → 401"
        status: pass
    human_judgment: false
  - id: D2
    description: "Backup diário do .db via db.backup() com retenção 7 (D-02, T-01-14), agendado no boot sem derrubar o serviço em erro; restauração provada em teste"
    requirement: INFRA-02
    verification:
      - kind: unit
        ref: "tests/backup.test.ts#fazerBackupDiario cria arquivo legível por better-sqlite3 (user_version presente)"
        status: pass
      - kind: unit
        ref: "tests/backup.test.ts#reterUltimos com 9 arquivos mantém 7 e aponta EXATAMENTE os 2 mais antigos (pura)"
        status: pass
      - kind: unit
        ref: "tests/backup.test.ts#aplicarRetencao remove só os apontados (7 restantes + pré-migration intacto)"
        status: pass
      - kind: unit
        ref: "tests/backup.test.ts#restauração barata: o backup abre e consulta dados reais; escrita pós-backup não vaza na cópia"
        status: pass
      - kind: integration
        ref: "npx vitest run → 46/46 (suíte completa com o boot agendando backup nos testes http)"
        status: pass
    human_judgment: false
  - id: D3
    description: "1º deploy real na VPS: run do Actions verde com o step de deploy EXECUTADO (não o notice de pulado) + GET /healthz respondendo de fora + backstops (deploy vazio mantém serviço; sem regressão de versão)"
    requirement: INFRA-05
    verification: []
    human_judgment: true
    rationale: "Pendente no checkpoint Task 3 (gate blocking-human): exige secrets VPS_* no GitHub, repo clonado na VPS e compose.env — fatos não verificáveis da máquina local; os backstops (deploy vazio, ordenação) são observados na UI do Actions e na VPS. Continuação registra data/hora e porta pública no SUMMARY após confirmação."

# Metrics
duration: 20min
completed: 2026-09-24
status: halted
---

# Phase 1 Plan 4: Publicação — Docker/compose no contrato do deploy.yml + backup diário Summary

**Contrato de deploy completo e provado localmente (imagem node:22-slim constrói sem compilar better-sqlite3; container sobe com seed/healthz/401) + backup diário db.backup() com retenção 7 no boot — faltando só o 1º deploy real na VPS, que é checkpoint humano (repo GitHub inexistente bloqueou o push)**

## Performance

- **Duration:** 20 min (até o checkpoint)
- **Started:** 2026-09-24T01:56:10Z
- **Checkpoint atingido:** 2026-09-24T02:16Z
- **Tasks:** 2 de 3 (Task 3 = checkpoint:human-verify gate=blocking-human — aguardando pessoa)
- **Files modified:** 10 (7 criados, 3 modificados)

## Accomplishments

- Contrato de deploy satisfeito e versionado: `docker-compose.yml` na raiz exatamente como o `deploy.yml` consome (build: ., ports `${PORT:-8787}:8787`, env_file compose.env, volume `./data:/app/data`, healthcheck `/healthz`, restart unless-stopped) + `Dockerfile` node:22-slim com `npm ci --omit=dev --ignore-scripts` e CMD via tsx local (sem npx em runtime)
- Imagem provada localmente: `docker compose build` verde (zero node-gyp/python no log), smoke do container com boot completo (seed 597 alimentos TACO, `/healthz` → `{"ok":true}`, `/mcp` sem token → 401)
- `scripts/check-deploy-contract.mjs`: replica localmente o check que o deploy.yml faz na VPS + salvaguardas gitignore de `data/` e `compose.env` (T-01-13); provado exit 0 normal e exit 1 com compose renomeado
- Backup diário (D-02): `fazerBackupDiario` via `db.backup()` (snapshot consistente em WAL), retenção pura de 7 que jamais toca `pre-migration-*`, agendada no boot com timer unref e erro não-fatal — restauração provada em teste (cópia abre, consulta dados reais, escrita pós-backup não vaza)
- tsx movido para dependencies + lock regenerado (produção roda sem devDeps); suíte completa 46/46 verde; `tsc --noEmit` + `biome check` limpos

## Task Commits

Tasks 1 e 2 commitadas atomicamente:

1. **Task 1: Dockerfile + docker-compose.yml no contrato do deploy.yml + check versionado** - `4f9e32f` (feat)
2. **Task 2: Backup diário do .db via db.backup() com retenção 7 (D-02, T-01-14)** - `ff0f69f` (feat)

**Task 3 (checkpoint:** 1º deploy real na VPS**):** SEM COMMIT — parado aguardando confirmação humana (gate blocking-human, nunca auto-aprovado).

**Plan metadata:** (commitado junto com este SUMMARY)

## Files Created/Modified

- `Dockerfile` - node:22-slim (nunca alpine — better-sqlite3 sem prebuild musl), deps em camada cacheável, CMD `./node_modules/.bin/tsx src/server.ts`
- `.dockerignore` - node_modules, data, .git, .planning, .claude, .github, compose.env, tests — imagem não leva dados nem segredos
- `docker-compose.yml` - contrato do deploy.yml na raiz; healthcheck com node -e fetch em /healthz (30s/5s/3 retries)
- `compose.env.example` - modelo de MCP_TOKEN (32+ bytes), PORT=8787, PUBLIC_HOST (allowedHosts)
- `scripts/check-deploy-contract.mjs` - check versionado: compose na raiz, Dockerfile, exemplo de env, gitignore de data/ e compose.env
- `src/db/backup.ts` - fazerBackupDiario / reterUltimos / aplicarRetencao / agendarBackupDiario
- `src/server.ts` - boot (após migrations + seed) agenda o backup diário em `<dir-do-banco>/backups`
- `tests/backup.test.ts` - 5 testes de backup/restauração/retenção
- `package.json` / `package-lock.json` - tsx em dependencies

## Decisions Made

- `--ignore-scripts` no `npm ci` da imagem: o npm ci executa o node-gyp rebuild default do `binding.gyp` do better-sqlite3 e falha sem python3/make/g++; o tarball v13 já traz `prebuilds/linux-x64.node` (carregado em runtime — provado no exato node:22-slim). Evita exatamente o "build de fonte a cada deploy" que o plan manda evitar; bônus: nenhum lifecycle script de terceiro roda no build
- Backup diário como job interno do processo (setInterval 24h + unref) — opção recomendada pelo RESEARCH (zero infra extra, mesma conexão)
- Lado interno do container sempre 8787 (healthcheck e mapeamento fixos); PORT no compose.env documentada como porta do host

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] npm ci dentro do build falhava: node-gyp sem python3 no node:22-slim**
- **Found during:** Task 1 (verificação `docker compose build`)
- **Issue:** melhor que alpine, mas npm ci (diferente do npm install) roda o build default do `binding.gyp` do better-sqlite3; sem python3/make/g++ no slim, o build quebrava — e instalar toolchain compilaria SQLite de fonte a cada deploy (o que o verify do plan rejeita explicitamente)
- **Fix:** `RUN npm ci --omit=dev --ignore-scripts` com comentário no Dockerfile; runtime usa o prebuild embutido no tarball (RUNTIME_OK provado no exato base image antes do fix)
- **Files modified:** Dockerfile
- **Verification:** docker compose build exit 0, zero linhas node-gyp/python; smoke do container com seed+healthz+401
- **Committed in:** 4f9e32f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking Rule 3, dentro do escopo da Task 1)
**Impact on plan:** Nenhum escopo adicional — o fix era pré-requisito para o próprio verify do plan (build verde sem node-gyp no log).

## Issues Encountered

- **`git push origin main` falhou com "Repository not found"** — SSH autenticado corretamente como `guilherminol`, mas o repo `github.com/guilherminol/flex-diet` NÃO EXISTE ainda. Sem `gh` CLI nesta máquina para criar. O push (passo do executor antes do checkpoint) ficou bloqueado; consta no checkpoint e em 01-USER-SETUP.md. **A verificação "1º deploy real" (Task 3) só pode começar depois de criar o repo (PRIVADO) e completar o user_setup.**

## User Setup Required

**External services require manual configuration.** See [01-USER-SETUP.md](./01-USER-SETUP.md) for:
- Criar o repo `guilherminol/flex-diet` **privado** no GitHub (bloqueante descoberto nesta execução)
- Secrets VPS_HOST/VPS_USER/VPS_PORT/VPS_PATH/VPS_SSH_KEY no GitHub Actions
- Na VPS: clone do repo em VPS_PATH, `docker compose version`, compose.env com MCP_TOKEN/PORT/PUBLIC_HOST, firewall restritivo

## Next Phase Readiness

- Tasks 1-2 prontas e commitadas na main local (à frente do origin pelo estado inteiro da wave — push pendente da criação do repo)
- Task 3 desbloqueia com: repo criado no GitHub → push → secrets + prep da VPS (01-USER-SETUP.md) → confirmação dos itens 1-6 do checkpoint → continuação re-escreve este SUMMARY como `status: complete` com data/hora do 1º deploy e porta pública, marca INFRA-05 e avança o estado
- Plan 01-05 (integração Hermes) depende deste deploy confirmado — não iniciar antes

---
*Phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com*
*Completed: 2026-09-24 (halted no checkpoint do 1º deploy)*

## Self-Check: PASSED

- 7/7 arquivos-chave criados e presentes no disco
- Commits de task verificados no histórico: `4f9e32f` (Task 1), `ff0f69f` (Task 2)
- `node scripts/check-deploy-contract.mjs` re-executado no fechamento: exit 0
- `commits: 2` medido via `git rev-list --count a47192e..HEAD` (ledger do plan)
- Task 3 NÃO verificada por design (checkpoint humano) — registrado como pending, não como stub
