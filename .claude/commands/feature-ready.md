---
description: Deterministic release-readiness verdict for a feature
argument-hint: <feature-slug>
allowed-tools: Bash(scripts/feature-ready:*), Bash(scripts/feature-context:*), Read
---

Run `scripts/feature-ready $ARGUMENTS`.

The script returns one of:

- `0` — **READY**: all technical gates pass and zero approvals are waiting
- `1` — **BLOCKED**: at least one non-approval gate failing; agent work needed
- `2` — **NEEDS-APPROVAL**: technical gates pass but humans must sign off

For `.incremental-delivery` features, READY additionally requires all
owner-accepted increments. A Pending, Ready for feedback, or Changes requested
increment remains BLOCKED even if its implementation tasks are Done.

After the script runs, summarize for the user in 5–8 lines:

- Verdict (READY / BLOCKED / NEEDS-APPROVAL)
- Counts: open/claimed/review tasks, P0/P1 findings, open release gates,
  approvals waiting_on_human
- Increment status: accepted/declared count and the current owner verdict
- The single most important blocker (or "none")
- Recommended next role:
  - `READY` → invoke `release` for the final verdict block, then prepare PR
  - `BLOCKED` → invoke `planner` with `Phase: plan` if the blockers are
    open tasks or findings; invoke `reviewer` with `Mode: acceptance` if
    TRACEABILITY shows gaps
  - `NEEDS-APPROVAL` → tell the owner which APPROVALS entries need humans

This command is read-only and never modifies files. It's the lightweight
pre-check before invoking `release` for the formal verdict.
