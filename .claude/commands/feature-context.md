---
description: Load full SDLC context for a the SDLC harness feature
argument-hint: <feature-slug>
allowed-tools: Bash(scripts/feature-context:*), Bash(scripts/feature-ready:*), Read, Grep
---

Run `scripts/feature-context $ARGUMENTS` and capture the output.

Then read these files into context (only the active sections — for long
files, read the head and the most recent appended entries):

- `docs/features/$ARGUMENTS/README.md`
- `docs/features/$ARGUMENTS/SPEC.md`
- `docs/features/$ARGUMENTS/QUESTIONS.md`
- `docs/features/$ARGUMENTS/REQUIREMENTS.md`
- `docs/features/$ARGUMENTS/DESIGN.md` (status field + section anchors)
- `docs/features/$ARGUMENTS/STATE.md`
- `docs/features/$ARGUMENTS/TASKS.md` (Active tasks)
- `docs/features/$ARGUMENTS/TRACEABILITY.md` (coverage summary)
- `docs/features/$ARGUMENTS/FINDINGS.md` (Active findings)
- `docs/features/$ARGUMENTS/DECISIONS.md`
- `docs/features/$ARGUMENTS/EVIDENCE.md` (last 3 entries)
- `docs/features/$ARGUMENTS/APPROVALS.md` (Active approvals)
- `docs/features/$ARGUMENTS/RELEASE_GATES.md`
- `docs/features/$ARGUMENTS/RUNS.md` (last 3 RUN entries)

If the slug is `example-feature`, also read:

- `docs/features/<project-feature>/STATE.md`
- `docs/features/<project-feature>/TASKS.md`
- `docs/features/<project-feature>/FINDINGS.md`

Run a lightweight readiness pulse:

```bash
scripts/feature-ready $ARGUMENTS
```

The exit code informs the summary; do not interpret the script as a final
verdict (that's release's job).

Then summarize in 8–12 lines:

- **Current verdict** from STATE.md (`intake | design | implementation |
  review | blocked | staging | release-ready`)
- **Design status** (`Draft | Approved`)
- **AC / NFR coverage** (from TRACEABILITY summary: passing / total)
- **Open questions** count (blocking how many tasks/design)
- **Open tasks** count + DAG note (next claimable per `scripts/feature-next-task`)
- **Active findings** by severity (P0/P1/P2/P3)
- **Approvals waiting on human** (count + stop reason codes)
- **Release gates** (Pass / open / blocked)
- **scripts/feature-ready exit**: 0 / 1 / 2
- **Recommended next role**: `planner (Phase: intake) | planner (Phase: design) |
  planner (Phase: plan) | builder | reviewer (Mode: quality | qa | adversarial |
  acceptance) | security | release | human`

Do not edit any files. This is rehydration only.
