# Feature Task Queue

Last updated: YYYY-MM-DD
Tier: medium

## Status legend

- `Backlog` — exists but not ready (design unapproved, blocked on questions)
- `Open` — ready to claim; all dependencies are `Done`
- `Claimed` — actively owned by one session
- `Review` — implemented, awaiting review (reviewer (Mode: quality) + reviewer (Mode: qa) + reviewer (Mode: adversarial) as routed)
- `Done` — verified, evidence recorded, adversarial trail recorded in EVIDENCE.md (advisory for medium tier; see EVIDENCE.md note)

## Task schema

```text
### TASK-###: <short title>

- Status: Backlog | Open | Claimed | Review | Done
- AC IDs: AC-001, AC-002
- Type: feature                   # required for new tasks: feature | bug | perf | ui | migration | docs | refactor | infra
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
Reconcile-script enforcement for these artifacts and for the pre-review
self-audit gate is currently large-tier-aware only and advisory at medium tier
— same caveat as the other reconcile checks.

## Active tasks

### TASK-EXAMPLE-001: Example (delete when adding real tasks)

- Status: Backlog
- AC IDs: AC-001
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

## Decisions captured during execution

Decisions made during implementation (not authored in `DESIGN.md`) live here
rather than in a separate `DECISIONS.md`.

- YYYY-MM-DD — TDEC-001: <decision> — <rationale>
