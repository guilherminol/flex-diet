---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-09-24T22:30:11.198Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | docker-compose.yml | 14 | Healthcheck do compose falha sempre com PUBLIC_HOST setado (allowedHosts responde 403 ao Host: 127.0.0.1; fetch não sobrescreve Host) — container (unhealthy), serviço funcional; fix de 1 linha deferido ao plan 01-05 | open |  | 2026-09-24T22:15:32.988Z |  |
| 2 | 01 | unrun-verify | docs/sdk-v1-fallback.md |  | Verify do Task 3 (grep 'Era observada:') não roda até o checkpoint humano do 1º contato com o Hermes registrar a era do protocolo — Tasks 1-2 commitadas, serviço no ar, aguardando configuração do Hermes + 3 perguntas do WhatsApp | open |  | 2026-09-24T22:30:11.198Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "docker-compose.yml",
    "line": 14,
    "description": "Healthcheck do compose falha sempre com PUBLIC_HOST setado (allowedHosts responde 403 ao Host: 127.0.0.1; fetch não sobrescreve Host) — container (unhealthy), serviço funcional; fix de 1 linha deferido ao plan 01-05",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-24T22:15:32.988Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "docs/sdk-v1-fallback.md",
    "line": null,
    "description": "Verify do Task 3 (grep 'Era observada:') não roda até o checkpoint humano do 1º contato com o Hermes registrar a era do protocolo — Tasks 1-2 commitadas, serviço no ar, aguardando configuração do Hermes + 3 perguntas do WhatsApp",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-24T22:30:11.198Z",
    "resolved_at": null
  }
]
````
