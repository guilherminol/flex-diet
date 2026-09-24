# Phase 1: User Setup Required

**Generated:** 2026-09-24
**Phase:** 01-n-cleo-confi-vel-banco-cat-logo-taco-e-loop-de-registro-com (plan 01-04 — INFRA-05)
**Status:** Incomplete

Complete these items for the deploy contínuo (INFRA-05) to function. O executor automatizou tudo que dá (Dockerfile, compose, check de contrato, backup diário); o que sobra exige acesso humano ao GitHub e à VPS. **Sem os secrets, o workflow `deploy.yml` fica "verde" com o notice "deploy pulado" — nunca declarar INFRA-05 completo nesse estado.**

## Descoberta desta execução (bloqueante #1)

- [ ] **Criar o repositório no GitHub: `guilherminol/flex-diet` (PRIVADO — dados de saúde, T-01-13)**
  - O `git push origin main` desta execução falhou com `Repository not found`.
  - SSH autenticado OK como `guilherminol` — o problema é só a ausência do repo (ou nome errado no remote).
  - Crie em: https://github.com/new → nome `flex-diet` → **Private** → NÃO inicialize com README (o histórico local já existe).
  - Depois de criar, o push pode ser feito pelo executor (continuação do checkpoint).

## Environment Variables

GitHub → Settings → Secrets and variables → Actions → New repository secret:

| Status | Secret | Source |
|--------|--------|--------|
| [ ] | `VPS_HOST` | IP ou hostname da sua VPS |
| [ ] | `VPS_USER` | usuário SSH da VPS |
| [ ] | `VPS_PORT` | porta SSH (22 se padrão) |
| [ ] | `VPS_PATH` | caminho do repo na VPS (ex.: `/opt/flex-diet`) |
| [ ] | `VPS_SSH_KEY` | chave PRIVADA (conteúdo completo, formato OpenSSH) autorizada na VPS |

## Account Setup / VPS

SSH na VPS (`ssh <VPS_USER>@<VPS_HOST>`):

- [ ] **Clonar este repo em `VPS_PATH`** — `git clone git@github.com:guilherminol/flex-diet.git $VPS_PATH` (a chave da VPS precisa acesso de leitura ao repo; ou clone via https/deploy key)
- [ ] **Confirmar Docker + plugin compose** — `docker compose version` deve responder sem erro
- [ ] **Criar `compose.env` ao lado do `docker-compose.yml` em `VPS_PATH`** (fica FORA do git — nunca commitar):
  - `MCP_TOKEN=` 32+ bytes aleatórios — gere com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
  - `PORT=8787`
  - `PUBLIC_HOST=` domínio ou IP pelo qual o Hermes alcança a VPS (alimenta `allowedHosts`; sem isso o servidor responde 403 ao Hermes)
- [ ] **Firewall da VPS liberando somente a porta necessária** (8787 ou a que você escolher) — superfície mínima (T-01-16). Nota: decisão de TLS/reverse proxy fica para o checkpoint do Hermes (plan 01-05); até lá o risco T-01-15 (token em HTTP puro) está aceito com token de alta entropia + firewall.

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

---

**Once all items complete:** Mark status as "Complete" at top of file.
