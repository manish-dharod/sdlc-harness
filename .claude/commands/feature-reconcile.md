---
description: Validate that a feature's control plane is internally consistent
argument-hint: <feature-slug>
allowed-tools: Bash(scripts/feature-reconcile:*), Read, Agent
---

Run `scripts/feature-reconcile $ARGUMENTS`.

Normal reconcile stays usable during implementation. At release readiness,
`scripts/feature-ready` invokes it with `--require-current-full --terminal`.
Use `--print-task-metadata TASK-###` when another deterministic tool needs the
shared tier/task/evidence routing rather than duplicating Markdown parsing.

The script checks:

- STATE.md machine-readable yaml block matches TASKS.md / FINDINGS.md /
  TRACEABILITY.md actual counts
- Every `Depends-on` reference resolves to a real task ID
- No task has been `Claimed` for more than 24 hours without a status change
- When `.incremental-delivery` exists, `INCREMENTS.md` is valid: every task is
  mapped, only the current increment advances, future work remains Backlog,
  and the exact latest owner-feedback heading anchor matches the increment,
  round, and verdict
- Current Review/Done work on every tier has the newest exact-task self-audit,
  QA ledger, application-verification disposition/evidence, and tracked scoped
  clear opposite-tool receipt

Exit codes:

- `0` — consistent
- `1` — drift detected; print the divergences

When drift is detected, do **not** edit STATE.md yourself. Invoke
`planner` (with `Phase: plan`) via the Task tool with a prompt naming the
specific drift points to reconcile. The plan phase owns STATE.md
transitions.

For stale claims (>24h), ask the user whether to:

1. Release the claim (set the task back to `Open`)
2. Take over the claim (set owner = current session)
3. Leave it pending more information

After reconciliation, re-run the script to confirm the drift is gone.
