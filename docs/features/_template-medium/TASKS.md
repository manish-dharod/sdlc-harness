# Feature Task Queue

Last updated: YYYY-MM-DD
Tier: medium

## Status legend

- `Backlog` — exists but not ready (design unapproved, blocked on questions)
- `Open` — ready to claim; all dependencies are `Done`
- `Claimed` — actively owned by one session
- `Review` — implemented, awaiting review (reviewer (Mode: quality) + reviewer (Mode: qa) + reviewer (Mode: adversarial) as routed)
- `Done` — verified, evidence recorded, QA coverage complete for non-doc tasks, and a tracked opposite-tool receipt recorded

## Task schema

```text
### TASK-###: <short title>

- Status: Backlog | Open | Claimed | Review | Done
- AC IDs: AC-001, AC-002
- Type: feature                   # required: feature | bug | perf | ui | migration | docs | refactor | infra | workflow
- Application verification: required | not-applicable — <specific reason>
- Increment: INC-###              # required; only the current increment may advance
- Design anchor: DESIGN.md#section
- Owner/session: unclaimed | <session id>
- Branch/worktree:
- Claimed at:
- Depends-on:
- Risk: low | medium | high
- Intended file ownership:
  - path/to/file.ext
- Verification:
  - command
  - mode: fast | unit | full
- Tests added:
  - test file + name
- Evidence:
  - EVIDENCE.md pointer
```

`Type:` is required for new tasks. When set to `bug` / `perf` / `ui` /
`migration`, EVIDENCE.md must include the corresponding artifact rows
(failing-then-passing repro / baseline-post-delta / before-after screenshots /
backfill+rollback evidence). See the large-tier template
(`docs/features/_template/EVIDENCE.md`) for the exact artifact shapes.
Code-bearing tasks also require a pre-review self-audit and QA ledger before
Review/Done. `scripts/feature-reconcile` enforces these gates across all tiers.
Every non-doc task must classify `Application verification:`; use `required`
for UI/server/runtime-config work and a specific `not-applicable —` reason for
other work.

## Active tasks

### TASK-001: Define the INC-001 implementation slice (replace during planning)

- Status: Backlog
- AC IDs: AC-001
- Type: feature
- Application verification: not-applicable — replace with the real task disposition
- Increment: INC-001
- Design anchor: DESIGN.md#architecture-summary
- Owner/session: unclaimed
- Branch/worktree:
- Claimed at:
- Depends-on:
- Risk: low
- Intended file ownership:
  - path
- Verification:
  - command
  - mode: fast
- Tests added:
  - pending
- Evidence:
  - pending

This initial Backlog task keeps a fresh scaffold structurally valid but is not
claimable. During planning, replace it with the smallest task set that delivers
the INC-001 user journey. Do not open future-increment tasks before owner
acceptance.

## Decisions captured during execution

Decisions made during implementation (not authored in `DESIGN.md`) live here
rather than in a separate `DECISIONS.md`.

- YYYY-MM-DD — TDEC-001: <decision> — <rationale>
