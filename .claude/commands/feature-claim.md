---
description: Help claim an Open task from a feature's TASKS.md
argument-hint: <feature-slug>
allowed-tools: Bash(scripts/feature-context:*), Bash(scripts/feature-next-task:*), Read, Edit
---

Run `scripts/feature-context $ARGUMENTS`, then
`scripts/feature-next-task $ARGUMENTS`, and read
`docs/features/$ARGUMENTS/TASKS.md` plus `INCREMENTS.md` when present.

If next-task exits 5, stop without editing TASKS.md. For
`feedback-required:INC-###`, show the owner the declared Experience surface
and Ship target and request their verdict. For start/advance routes, hand back
to planner. Never treat exit 5 as a generic error or claim a later task.

List every `Open` task with:
- ID + title
- Acceptance criteria summary
- Verification command
- Intended file ownership
- Suggested branch/worktree (if declared)
- Increment ID (must equal the current increment)

Ask the user which task to claim. If only one is `Open`, suggest it directly.

Once selected, update `docs/features/$ARGUMENTS/TASKS.md`:

- Change the task status to `Claimed`
- Add owner = current session, today's date, branch/worktree

Then state the next step: "Invoke `builder` via the Task tool to implement this task."

**Do not implement the task yourself.** This command only claims and hands off.
