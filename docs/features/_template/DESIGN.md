# Design

Last updated: YYYY-MM-DD
Author: planner (Phase: design)
Status: `Draft` | `Approved` (only `Approved` designs unblock Backlog→Open)

`planner (Phase: plan)` cannot move any task to `Open` until this design is `Approved`
*and* `TEST_STRATEGY.md`, `THREAT_MODEL.md`, `MIGRATION_PLAN.md`, and
`ROLLBACK_PLAN.md` are present. Tasks cite design sections by anchor name.

## Goal

One paragraph summary of what the design accomplishes, linked back to the
primary AC IDs (`AC-001`, `AC-002`, …).

## Constraints

- From SPEC.md (NFRs, scope, out-of-scope)
- From existing codebase (frameworks, conventions, libraries, infra)
- From DECISIONS.md (durable prior choices)

## Credentials & external APIs

Declare every external provider action this feature depends on. Use literal
environment variable names, not raw secrets. `scripts/feature-ready` runs any
declared `Preflight command:` rows through `scripts/preflight-credentials`.

- Provider: `<provider name>`
  - Endpoint/action: `<specific API endpoint or operation>`
  - Required scopes/roles: `<exact scopes or IAM roles>`
  - Secret source: `<env var / secret manager path / human approval>`
  - Preflight command: `<read-only or dry-run command that proves this action is authorized>`

## Architecture overview

Text-level architecture. Component boundaries, data flow, where new code lives.
A small ASCII diagram is fine. No Mermaid; keep this file plain-readable.

```text
[client] → [controller] → [service] → [adapter] → [vendor API]
                                    ↓
                                [DB tables]
                                    ↓
                                [audit log]
                                    ↓
                                [notification queue]
```

## Data model

Tables, columns, types, indexes, foreign keys. Cross-link to
`MIGRATION_PLAN.md` for DDL detail.

- `<table_name>`
  - column: type, constraints
  - indexes: ...
  - FKs: ...

## API surface

New / changed routes, request/response shapes (field shapes only, no real
secrets), error codes. Stable contract — `reviewer (Mode: acceptance)` will verify this is
what shipped.

- `POST /api/...` — purpose, request, response, error codes
- `GET /api/...` — ...

## Sequence: happy path

Numbered steps. Reference the AC IDs each step satisfies.

1. Client posts ... (AC-001)
2. Controller validates ... (AC-001)
3. ...

## Sequence: failure / edge paths

For each negative path enumerated in `REQUIREMENTS.md`, name the failure mode,
the visible behavior, and the recovery.

## Observability

What we emit and where. Cross-link to NFR-005 in REQUIREMENTS.md.

- Metrics: <names, labels>
- Logs: <events, levels, fields — no PII, no card data, no secrets>
- Alerts: <thresholds, owners>

## Feature flag

- Flag name: `<flag_name>` (default OFF in all environments at launch)
- Scope of rollout: vendor / product / geography segment
- Rollback: see `ROLLBACK_PLAN.md`

## Open design questions

Anything planner (Phase: design) needs the owner or planner (Phase: plan) to decide before
implementation can start. These also flow into `QUESTIONS.md` if they block.
