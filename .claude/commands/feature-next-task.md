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
- `5` — hard incremental-delivery stop. `feedback-required:INC-###` means the
  owner must try the current increment and provide Accepted or Changes
  requested. Other exit 5 routes require the planner to start/advance an
  increment. Do not claim, implement, or reinterpret this as "no tasks."
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
  - **If exit 5 is `feedback-required`:** report the Experience surface and
    Ship target from INCREMENTS.md, then stop for the owner. Never write the
    owner verdict on their behalf.
