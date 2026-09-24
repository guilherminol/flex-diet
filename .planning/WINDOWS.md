---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-24T22:15:32.988Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | docker-compose.yml | 14 | Healthcheck do compose falha sempre com PUBLIC_HOST setado (allowedHosts responde 403 ao Host: 127.0.0.1; fetch não sobrescreve Host) — container (unhealthy), serviço funcional; fix de 1 linha deferido ao plan 01-05 | open |  | 2026-09-24T22:15:32.988Z |  |

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
  }
]
````
