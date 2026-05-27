---
description: Validate that a feature's control plane is internally consistent
argument-hint: <feature-slug>
allowed-tools: Bash(scripts/feature-reconcile:*), Read, Agent
---

Run `scripts/feature-reconcile $ARGUMENTS`.

The script checks:

- STATE.md machine-readable yaml block matches TASKS.md / FINDINGS.md /
  TRACEABILITY.md actual counts
- Every `Depends-on` reference resolves to a real task ID
- No task has been `Claimed` for more than 24 hours without a status change

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
