# Feature Design

Last updated: YYYY-MM-DD
Status: Draft | Approved
Tier: medium

> Tasks cannot move from `Backlog` to `Open` until this document's Status is
> `Approved` and every blocking question in `SPEC.md` is `Answered`.

## Architecture summary

One paragraph. What changes structurally? What stays the same?

## Credentials & external APIs

Declare every external provider action this feature depends on. Use literal
environment variable names, not raw secrets. `scripts/feature-ready` runs any
declared `Preflight command:` rows and any declarative required-capability
checks through `scripts/preflight-credentials`.

- Provider: `<provider name>`
  - Endpoint/action: `<specific API endpoint or operation>`
  - Required scopes/roles: `<exact scopes or IAM roles>`
  - Secret source: `<env var / secret manager path / human approval>`
  - Preflight command: `<read-only or dry-run command that proves this action is authorized>`

## Required capabilities / credentials

Keep this section boring. `scripts/preflight-credentials <feature-slug>` reads
only these declaration bullets and checks presence/readiness without printing
values. Leave `- none` for normal local-only work.

Supported declaration shapes: `none`, `env: ENV_VAR_NAME`,
`env-file: path/to/.env ENV_VAR_NAME`, `file: path/to/file`,
`dir-writable: path/to/dir`, `command: executable-name`,
`setup-script: scripts/path-to-helper`. A `setup-script` is only checked
for existence/executability here; reviewer (Mode: qa) decides when to run it.

- none

## Data model

Schema deltas only. For medium-tier features this is typically 1–2 tables or
columns; if it grows past that, you are probably on the wrong tier.

```sql
-- example:
ALTER TABLE foo ADD COLUMN bar VARCHAR(64) NULL;
```

## API surface

Routes added, modified, or removed. Include request/response shape sketches.

- `POST /api/foo` — request: `{...}` — response: `{...}` — auth: <session|none>

## Sequence (happy path)

Brief textual sequence; ASCII diagram only if it clarifies. Not required.

## Test strategy

Per-AC test plan. Stays in this file rather than a separate `TEST_STRATEGY.md`
for medium-tier features.

| AC ID | Test type | Test file / location | Status |
|-------|-----------|----------------------|--------|
| AC-001 | unit / feature / e2e | `tests/...` | planned |

## Rollback plan

Three tiers, in order of preference:

1. **Flag-off**: if behind a feature flag, flip off. Time to revert: seconds.
2. **Code revert**: `git revert <merge sha>` + redeploy. Time to revert: minutes.
3. **Data revert**: only if schema/data changed. State the inverse migration
   or backfill script path. Time to revert: depends.

For medium-tier features, rollback should never require ops paging or
compliance signoff. If it does, upgrade to large tier.

## Decisions

Significant design decisions made during this doc's authoring. Durable, not
chat-level.

- YYYY-MM-DD — DDEC-001: <decision> — <rationale>
