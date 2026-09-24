# Phase 1: User Setup Required

**Generated:** 2026-09-24
**Phase:** 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com (plan 01-04 — INFRA-05)
**Status:** Complete (confirmado 2026-09-24 — 1º deploy real verificado: run 36065009857 verde, healthz {"ok":true} de fora)

Complete these items for the deploy contínuo (INFRA-05) to function. O executor automatizou tudo que dá (Dockerfile, compose, check de contrato, backup diário); o que sobra exige acesso humano ao GitHub e à VPS. **Sem os secrets, o workflow `deploy.yml` fica "verde" com o notice "deploy pulado" — nunca declarar INFRA-05 completo nesse estado.**

## Descoberta desta execução (bloqueante #1)

- [x] **Criar o repositório no GitHub: `guilherminol/flex-diet`** — feito pelo usuário em 2026-09-24, como **PÚBLICO** (decisão do usuário, diferente do "PRIVADO" sugerido aqui). Mitigação T-01-13 atualizada: o repositório contém apenas código/config — scan verificou **nenhum segredo nem dado pessoal commitado** (data/ e compose.env gitignored, checados por scripts/check-deploy-contract.mjs; MCP_TOKEN só existe no compose.env da VPS e nos secrets do Actions).

## Environment Variables

GitHub → Settings → Secrets and variables → Actions → New repository secret:

| Status | Secret | Source |
|--------|--------|--------|
| [x] | `VPS_HOST` | IP ou hostname da sua VPS |
| [x] | `VPS_USER` | usuário SSH da VPS |
| [x] | `VPS_PORT` | porta SSH (22 se padrão) |
| [x] | `VPS_PATH` | caminho do repo na VPS (ex.: `/opt/flex-diet`) |
| [x] | `VPS_SSH_KEY` | chave PRIVADA (conteúdo completo, formato OpenSSH) autorizada na VPS — deploy key **ed25519** autorizada na VPS |

## Account Setup / VPS

SSH na VPS (`ssh <VPS_USER>@<VPS_HOST>`):

- [x] **Clonar este repo em `VPS_PATH`** — clonado em `/opt/flex-diet` (HEAD no commit deployado; verificado via SSH)
- [x] **Confirmar Docker + plugin compose** — `docker compose up -d --build` executado pelo workflow sem erro
- [x] **Criar `compose.env` ao lado do `docker-compose.yml` em `VPS_PATH`** (FORA do git — verificado: contém MCP_TOKEN, PORT, PUBLIC_HOST):
  - `MCP_TOKEN=` 32+ bytes aleatórios
  - `PORT=8787`
  - `PUBLIC_HOST=` IP pelo qual o Hermes alcança a VPS (alimenta `allowedHosts`)
- [x] **Firewall/porta** — serviço acessível apenas na porta pública escolhida (8787). Nota: decisão de TLS/reverse proxy fica para o checkpoint do Hermes (plan 01-05); até lá o risco T-01-15 (token em HTTP puro) está aceito com token de alta entropia.

## Verification

Depois de completar os itens acima, o executor (ou você) verifica:

```bash
# 1. Push chega ao GitHub (sem "Repository not found")
git push origin main

# 2. Run do Actions: https://github.com/guilherminol/flex-diet/actions
#    — o step "Deploy over SSH" deve EXECUTAR (sem o notice "deploy pulado")

# 3. Na VPS: container no ar e saudável
docker compose ps        # container flex-diet com status (healthy)

# 4. Healthcheck de FORA da VPS (prova o 1º deploy real)
curl http://<vps>:8787/healthz     # esperado: {"ok":true}
```

Expected: Actions verde com deploy executado; `{"ok":true}` de fora; `docker compose ps` healthy.

**Verificação real (2026-09-24, pela continuação do executor):** run [36065009857](https://github.com/guilherminol/flex-diet/actions/runs/36065009857) **success** com o step "Deploy over SSH" EXECUTADO (imagem construída na VPS, container `flex-diet-flex-diet-1` iniciado 22:01:39Z); `curl http://177.7.44.211:8787/healthz` de fora → `{"ok":true}`; `POST /mcp` sem token → `401`. Conhecido: o status do container aparece `(unhealthy)` — defeito do healthcheck com Host loopback (403 do allowedHosts), documentado no 01-04-SUMMARY.md; o serviço responde normalmente (provas acima + `node:http` com Host público → 200).

---

**Once all items complete:** Mark status as "Complete" at top of file. ✅ Feito em 2026-09-24.
