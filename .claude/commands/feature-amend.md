---
description: Record a spec amendment with impact analysis on tasks, design, tests, approvals
argument-hint: <feature-slug>
allowed-tools: Bash(scripts/feature-context:*), Read, Edit, Write, Grep, Glob, Agent
---

The spec for `$ARGUMENTS` has changed mid-flight. This command records the
amendment, runs impact analysis, and triggers re-planning only on the affected
tasks. It does **not** automatically re-implement anything — the owner approves
the amendment first.

## Step 1 — Rehydrate

Run `scripts/feature-context $ARGUMENTS` to load current state.

## Step 2 — Capture the change

Ask the user:

1. What changed in SPEC.md? (One paragraph.)
2. Why? (Owner request / discovered ambiguity / external constraint / etc.)
3. Which AC IDs are affected? (Or "I don't know — analyze.")

## Step 3 — Increment SPEC.md version

Bump the version header in `SPEC.md`. Edit the "Acceptance criteria" section to
reflect the new behavior. Do not lose the old AC IDs — mark them with a
status note (`Amended in AMD-###` or `Removed in AMD-###`).

## Step 4 — Invoke planner (Phase: intake) for re-extraction

Invoke `planner` via the Task tool with `Phase: intake` to re-extract AC IDs
that have shifted, open any new ambiguity questions, and refresh
REQUIREMENTS.md.

## Step 5 — Write the amendment record

Append to `docs/features/<slug>/AMENDMENTS.md` using the template schema. Fill
every field:

- Source of the change
- SPEC.md version old → new
- Change paragraph
- Impact on each affected AC ID (unchanged / amended / removed / new)
- Impact on each TASK ID (keep / rework / close / new) — for Done tasks
  decide between "keep as-is", "rework as new TASK-###", or "revert"
- Impact on DESIGN.md sections
- Impact on TRACEABILITY.md rows
- Impact on APPROVALS.md entries (which need re-requesting)

## Step 6 — Surface to the owner

Print the amendment block (the new AMD-### entry) and tell the user:

> The amendment is recorded but **not yet approved**. Confirm or revise by
> editing AMENDMENTS.md and setting "Owner approval of this amendment:
> Approved YYYY-MM-DD by <name>".

Do not invoke `planner (Phase: design)` or `planner (Phase: plan)` yet —
wait for owner approval.

## Step 7 — After owner approval

Once the owner approves, invoke (in order):

1. `planner` with `Phase: design` if DESIGN.md sections need rework. Prompt:
   "Phase: design. Amendment AMD-### landed. Update affected DESIGN sections
   and re-approve."
2. `planner` with `Phase: plan` to re-sequence affected tasks per the
   amendment's "Impact on tasks" section. Prompt: "Phase: plan. Apply AMD-###
   to TASKS.md: rework / close / open the tasks listed in the amendment."

## Step 8 — Final report

```
## Spec amendment recorded: AMD-### for $1

- SPEC.md version: N → N+1
- AC impact: <unchanged X / amended Y / removed Z / new W>
- Tasks affected: <count, list IDs>
- Design sections affected: <list>
- Approvals to re-request: APV-###
- Owner approval status: pending | Approved on YYYY-MM-DD
- Next role: planner (Phase: design) | planner (Phase: plan) | (none — wait for owner)
```
