---
description: Print the next claimable task for a feature, respecting the DAG
argument-hint: <feature-slug>
allowed-tools: Bash(scripts/feature-next-task:*), Read
---

Run `scripts/feature-next-task $ARGUMENTS`.

The script prints the first task that is:

- `Status: Open`, AND
- Has every `Depends-on` task in `Status: Done`

Exit codes:

- `0` — a claimable task was printed; consider invoking `builder` to claim it
- `3` — no claimable tasks; the script prints per-status counts and lists
  Open tasks whose dependencies are unsatisfied (these need their deps Done
  before they become claimable)
- `1` — error (file not found, schema parse failure)

After running, summarize for the user in 3–4 lines:

- The task ID returned (or "none claimable")
- The per-status snapshot
- A single recommended next step:
  - **If a task was returned:** "Invoke `builder` via the Task tool to claim
    and implement <TASK-###>."
  - **If no task is claimable but Open tasks exist:** "Tasks are gated by
    unsatisfied Depends-on; either complete the blocking task or invoke
    `planner` with `Phase: plan` to re-sequence."
  - **If no Open tasks exist:** "No Open tasks. Invoke `planner` with
    `Phase: plan` to open one from Backlog (after DESIGN approval) or
    `release` for a verdict."
