---
description: Help claim an Open task from a feature's TASKS.md
argument-hint: <feature-slug>
allowed-tools: Bash(scripts/feature-context:*), Read, Edit
---

Run `scripts/feature-context $ARGUMENTS` and read `docs/features/$ARGUMENTS/TASKS.md`.

List every `Open` task with:
- ID + title
- Acceptance criteria summary
- Verification command
- Intended file ownership
- Suggested branch/worktree (if declared)

Ask the user which task to claim. If only one is `Open`, suggest it directly.

Once selected, update `docs/features/$ARGUMENTS/TASKS.md`:

- Change the task status to `Claimed`
- Add owner = current session, today's date, branch/worktree

Then state the next step: "Invoke `builder` via the Task tool to implement this task."

**Do not implement the task yourself.** This command only claims and hands off.
