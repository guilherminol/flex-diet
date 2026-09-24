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
  tasks: 3         # Tasks 1-2 (código) + Task 3 (checkpoint do 1º deploy — resolvido em 2026-09-24T22:03Z pelo orchestrator + humano, verificação re-feita pela continuação)
  commits: 14      # MEASURED: git rev-list --count a47192e..HEAD na escrita deste SUMMARY (2 tasks de código + docs/CI do setup do deploy)
commits: 14
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

requirements-completed: [INFRA-05]  # 1º deploy real confirmado em 2026-09-24 (run 36065009857 success, healthz {"ok":true} de fora) — nunca declarado com o notice de deploy pulado

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
    verification:
      - kind: integration
        ref: "GitHub run 36065009857 (repo guilherminol/flex-diet) — conclusion: success, headSha 339c24e (descendente de 5e08876), job 'Deploy to VPS' 24s com o step 'Deploy over SSH' EXECUTADO: imagem flex-diet-flex-diet construída na VPS (npm ci 84 pacotes, 0 vulnerabilities), container flex-diet-flex-diet-1 Created→Started em 2026-09-24T22:01:39Z (log do job verificado pela continuação)"
        status: pass
      - kind: integration
        ref: "curl http://177.7.44.211:8787/healthz de FORA da VPS → {\"ok\":true}; POST /mcp sem token → 401 (Bearer ativo) — verificado pela continuação em 2026-09-24T22:04Z"
        status: pass
      - kind: other
        ref: "VPS via SSH (ro): repo em /opt/flex-diet no commit 339c24e; docker logs do container: migrations 001+002 aplicadas com backups pre-migration, seed 597 TACO + 92 POF (724 medidas), backup diário CRIADO (diario-2026-09-24-220141.db, retenção 7) — D-02 ativo em produção"
        status: pass
      - kind: other
        ref: "Backstops de ordenação: git pull --ff-only + docker compose up -d --build no log do run; VPS no commit mais recente da main (339c24e) — sem regressão de versão. Deploy vazio (re-run) não derruba o serviço: o serviço manteve-se no ar através de 4 re-runs do workflow durante o setup (runs 2-4 + run final)"
        status: pass
    human_judgment: true
    rationale: "Confirmado pelo humano no checkpoint (resposta 'aprovado', 2026-09-24) após setup externo (repo no GitHub, secrets VPS_*, clone + compose.env na VPS); TODA a evidência foi re-verificada por máquinas da continuação (gh run view + curl de fora + SSH na VPS) — nenhum item tomado só da fé do checkpoint."

# Metrics
duration: 20min (executor) + ~15min (continuação de verificação/registro em 2026-09-24T22:03Z, após setup humano do deploy)
completed: 2026-09-24
status: complete
---

# Phase 1 Plan 4: Publicação — Docker/compose no contrato do deploy.yml + backup diário Summary

**Serviço publicado de ponta a ponta: contrato Docker/compose versionado + 1º deploy real na VPS via GitHub Actions (run 36065009857 verde, deploy EXECUTADO, container no ar em 177.7.44.211:8787 com healthz {"ok":true} de fora e /mcp 401 sem token) + backup diário db.backup() com retenção 7 já rodando em produção**

## Performance

- **Duration:** 20 min (executor) + ~15 min (continuação de verificação/registro)
- **Started:** 2026-09-24T01:56:10Z
- **Checkpoint atingido:** 2026-09-24T02:16Z — **resolvido:** 2026-09-24T22:01-22:15Z (setup humano + continuação)
- **Tasks:** 3 de 3 (Task 3 = checkpoint:human-verify resolvido com "aprovado" + evidência re-verificada por máquina)
- **Files modified:** 10 (7 criados, 3 modificados) + registros desta continuação (SUMMARY, USER-SETUP, REQUIREMENTS, STATE, ROADMAP)

## Accomplishments

- Contrato de deploy satisfeito e versionado: `docker-compose.yml` na raiz exatamente como o `deploy.yml` consome (build: ., ports `${PORT:-8787}:8787`, env_file compose.env, volume `./data:/app/data`, healthcheck `/healthz`, restart unless-stopped) + `Dockerfile` node:22-slim com `npm ci --omit=dev --ignore-scripts` e CMD via tsx local (sem npx em runtime)
- Imagem provada localmente: `docker compose build` verde (zero node-gyp/python no log), smoke do container com boot completo (seed 597 alimentos TACO, `/healthz` → `{"ok":true}`, `/mcp` sem token → 401)
- `scripts/check-deploy-contract.mjs`: replica localmente o check que o deploy.yml faz na VPS + salvaguardas gitignore de `data/` e `compose.env` (T-01-13); provado exit 0 normal e exit 1 com compose renomeado
- Backup diário (D-02): `fazerBackupDiario` via `db.backup()` (snapshot consistente em WAL), retenção pura de 7 que jamais toca `pre-migration-*`, agendada no boot com timer unref e erro não-fatal — restauração provada em teste (cópia abre, consulta dados reais, escrita pós-backup não vaza)
- tsx movido para dependencies + lock regenerado (produção roda sem devDeps); suíte completa 46/46 verde; `tsc --noEmit` + `biome check` limpos
- **1º deploy real concluído (INFRA-05)**: push na main → run 36065009857 verde com o step "Deploy over SSH" EXECUTADO na VPS (imagem construída lá, container iniciado 22:01:39Z) → `{"ok":true}` de fora. Migrations (001, 002) aplicadas na VPS com backups pre-migration; seed 597 TACO + 92 POF; **backup diário já rodou em produção** (`diario-2026-09-24-220141.db`)

## Task Commits

Tasks 1 e 2 commitadas atomicamente:

1. **Task 1: Dockerfile + docker-compose.yml no contrato do deploy.yml + check versionado** - `4f9e32f` (feat)
2. **Task 2: Backup diário do .db via db.backup() com retenção 7 (D-02, T-01-14)** - `ff0f69f` (feat)

**Task 3 (checkpoint:** 1º deploy real na VPS**):** RESOLVIDO em 2026-09-24 — sem commit de código próprio (o deploy levou a main já commitada: `4f9e32f`/`ff0f69f` + chain de setup `5203c11`→`339c24e` do orchestrator). Humanos fizeram o setup externo (repo, secrets, VPS); a continuação verificou toda a evidência por máquina e fez só o commit de registro (`docs(01-04)`). Ver seção "1º Deploy Real — Registro".

**Plan metadata:** (commitado junto com este SUMMARY)

## 1º Deploy Real — Registro (INFRA-05)

**Data/hora:** 2026-09-24, run concluído às 22:01:39Z (container iniciado).

| Fato | Evidência (re-verificada por máquina na continuação) |
|------|------------------------------------------------------|
| Run do Actions | [36065009857](https://github.com/guilherminol/flex-diet/actions/runs/36065009857) — `success`, headSha `339c24e` (na main, descendente de `5e08876` "1º deploy real — secrets configurados"), job "Deploy to VPS" em 24s |
| Step de deploy EXECUTADO (não pulado) | Log do job: guard de secrets passou, `git pull --ff-only` + `docker compose up -d --build` rodaram na VPS; imagem `flex-diet-flex-diet` construída lá (npm ci 84 pacotes, 0 vulnerabilities), container `flex-diet-flex-diet-1` Created→Started 22:01:39Z |
| Endpoint público | `http://177.7.44.211:8787/healthz` → `{"ok":true}` (curl de FORA da VPS) |
| Bearer enforcement | `POST /mcp` sem token → `401` |
| VPS consistente | `/opt/flex-diet` no commit `339c24e` (SSH); boot no log do container: migrations 001+002 com backups pre-migration, seed 597 TACO + 92 POF (724 medidas), `ouvindo em 0.0.0.0:8787` |
| D-02 em produção | `[backup] diário ok: /app/data/backups/diario-2026-09-24-220141.db (retenção 7)` no primeiro boot |
| Backstops | Sem regressão: VPS no commit mais recente (`git pull --ff-only` no log); serviço manteve-se no ar através dos 4 re-runs do workflow durante o setup (deploy "vazio" entre retests não derrubou) |

**Setup de deploy (feito pelo humano no checkpoint, confirmado):**
- Repo `github.com/guilherminol/flex-diet` criado — **PÚBLICO por decisão do usuário** (mitigação T-01-13 atualizada: nenhum segredo nem dado pessoal commitado, verificado por scan; `data/` e `compose.env` gitignored e checados por `check-deploy-contract.mjs`; MCP_TOKEN só no compose.env da VPS e nos secrets do Actions)
- Secrets `VPS_HOST`/`VPS_USER`/`VPS_PORT`/`VPS_PATH`/`VPS_SSH_KEY` registrados no GitHub Actions
- Deploy key **ed25519** autorizada na VPS (o workflow SSH-a como root em 177.7.44.211, porta não-secretas nos secrets)
- `compose.env` na VPS com MCP_TOKEN/PORT/PUBLIC_HOST (FORA do git — confirmado)

### Problema conhecido pós-deploy (deferido para 01-05)

**O container aparece `(unhealthy)` no `docker compose ps`** — FailingStreak 12 desde o boot. Causa diagnosticada (não é o serviço): o healthcheck do compose faz `fetch('http://127.0.0.1:8787/healthz')` com `Host: 127.0.0.1`, e o `allowedHosts` do servidor (alimentado por `PUBLIC_HOST=177.7.44.211` desde o plan 01-01, proteção DNS-rebinding) responde **403 "Invalid Host: 127.0.0.1"**. `fetch` não deixa sobrescrever o header Host (header proibido), então o check falha SEMPRE que PUBLIC_HOST está setado. O serviço em si está 100% funcional (healthz 200 de fora, /mcp 401, e `node:http` com header `Host: 177.7.44.211` → **200** provado dentro do container).

Fixes candidatos (1 linha cada, decisão no 01-05 junto com a integração Hermes/PUBLIC_HOST):
1. `allowedHosts` incluir loopback: `[PUBLIC_HOST, "127.0.0.1", "localhost"]` (src/server.ts), OU
2. healthcheck do compose trocar `fetch` por `node:http` com header `Host` do `PUBLIC_HOST` (provado: status 200)

Enquanto isso: `restart: unless-stopped` não reinicia por unhealthy (só por exit), então o serviço não é afetado. Registrado em WINDOWS.md e nos blockers do STATE.md.

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

- ~~**`git push origin main` falhou com "Repository not found"**~~ **RESOLVIDO (2026-09-24):** o usuário criou o repo `guilherminol/flex-diet` (público, por decisão dele — ver mitigação T-01-13 na seção de deploy), secrets registrados, VPS preparada; o push e o 1º deploy ocorreram via chain de commits `5203c11`→`339c24e` do orchestrator com o usuário.
- **Healthcheck do compose falha com PUBLIC_HOST setado** (container `(unhealthy)`; serviço normal) — diagnosticado e deferido para 01-05; ver seção "1º Deploy Real — Registro".

## User Setup Required

**Nada pendente.** Todos os itens de [01-USER-SETUP.md](./01-USER-SETUP.md) foram completados pelo usuário em 2026-09-24 (repo criado, secrets VPS_*, clone em /opt/flex-diet, compose.env, porta pública) e o arquivo foi marcado como **Complete**.

## Next Phase Readiness

- **INFRA-05 COMPLETE:** merge/push na main → deploy automático na VPS provado de ponta a ponta (run 36065009857 + healthz de fora). Deploy contínuo ativo para todas as fases seguintes.
- **INFRA-01 permanece ABERTO de propósito:** a metade "exposto na VPS com token" está feita (healthz 200, /mcp 401), mas a metade "**consumido pelo Hermes por URL**" só se fecha no plan 01-05 (primeiro contato com o Hermes; era do SDK v2 vs v1 a confirmar) — NÃO marcar INFRA-01 antes disso.
- **Entrar no 01-05 sabendo:** (1) healthcheck/unhealthy a corrigir (1 linha, ver seção de deploy); (2) T-01-15 (HTTP puro + token) segue risco aceito — decisão de TLS/reverse proxy no checkpoint do Hermes; (3) PUBLIC_HOST atual = IP (177.7.44.211) — se o Hermes usar domínio, allowedHosts precisa do valor que o Hermes manda no Host.
- Decisões operacionais herdadas: repo público com scan de segredos; deploy key ed25519; VPS_PATH=/opt/flex-diet.

---
*Phase: 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com*
*Completed: 2026-09-24 (Task 3 resolvida — 1º deploy real verificado; SUMMARY finalizado pela continuação às 22:03-22:15Z)*

## Self-Check: PASSED

- 7/7 arquivos-chave criados e presentes no disco
- Commits de task verificados no histórico: `4f9e32f` (Task 1), `ff0f69f` (Task 2)
- Task 3 verificada por máquina na continuação: run 36065009857 `success` (gh run view), healthz `{"ok":true}` de fora (curl), `/mcp` → 401, VPS no commit `339c24e` com container no ar e backup diário criado (SSH)
- `commits: 14` medido via `git rev-list --count a47192e..HEAD` (ledger do plan) na escrita deste SUMMARY (+1 commit de registro docs que fecha o plan)
- Problema conhecido documentado (healthcheck/unhealthy) — não é stub nem serviço fora do ar; fix deferido ao 01-05 com WINDOWS.md registrado
