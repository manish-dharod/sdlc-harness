---
description: "Scaffold a new feature control plane and run intake (planner phases intake then design)"
argument-hint: <feature-slug> [--spec path/to/spec.md]
allowed-tools: Bash(scripts/feature-init:*), Bash(scripts/feature-context:*), Read, Edit, Write, Grep, Glob, Agent
---

You are starting a brand new SDLC harness feature: `$ARGUMENTS`.

The first argument is the feature slug (kebab-case). An optional `--spec
path/to/spec.md` drops a freeform spec file directly into `SPEC.md`. If neither
is provided, the slug alone is fine; the owner will paste the spec interactively.

## Step 1 — Scaffold

Run `scripts/feature-init $ARGUMENTS`. This copies `docs/features/_template`
to `docs/features/<slug>/` and (if `--spec` was supplied) drops the spec
contents into `SPEC.md`.

Medium and large scaffolds also activate `.incremental-delivery` and create
`INCREMENTS.md`. INC-001 is the planning placeholder for the smallest
experiential MVP; it is not permission to claim the template's Backlog task.
Small-tier features remain marker-free.

If the script fails (e.g., feature already exists), stop and tell the user.

## Step 2 — Prompt the owner if spec is missing

After scaffolding, check `docs/features/<slug>/SPEC.md` for the placeholder
`> <spec text>`. If it's still there, ask the user to paste the spec into the
"Owner-provided spec" section and re-invoke `/feature-init` (or continue with
the existing scaffold). Do not invent a spec.

## Step 3 — Set feature metadata

Edit `docs/features/<slug>/STATE.md` and `README.md`:

- `Feature name`: ask the user (one-line human title)
- `Main product area`: best-effort guess from spec; confirm with user
- `Verification profile`: `generic` by default, or a domain name if one exists

Do not guess; ask the user when these aren't obvious.

## Step 4 — Run intake via planner (Task tool)

Invoke `planner` via the Task tool with `Phase: intake`. Prompt:

> Phase: intake. Run intake on feature `<slug>`. Read SPEC.md, extract AC IDs
> and NFR IDs, open ambiguity questions in QUESTIONS.md (each with options +
> recommended default), produce REQUIREMENTS.md, update STATE.md
> machine-readable block. Do not write tasks or design.

## Step 5 — Surface blockers to the user

After planner returns, summarize:

- AC IDs extracted (count + range)
- NFR IDs extracted
- Questions blocking task intake (Q-### + the option list)
- Recommended next phase / role

If any question `Blocks: tasks` or `Blocks: design`, **stop and tell the user
which questions they must answer**. Do not invoke planner (Phase: design) yet.

## Step 6 — When questions are clean

Once QUESTIONS.md has zero `Open` entries that block, invoke `planner` via
the Task tool with `Phase: design`. Prompt:

> Phase: design. Run architecture on feature `<slug>`. SPEC.md has AC/NFR IDs
> populated and QUESTIONS.md is clear. Produce DESIGN.md (Draft → Approved
> after review), TEST_STRATEGY.md, THREAT_MODEL.md (required for
> payment/auth/webhook surface), MIGRATION_PLAN.md (if DDL/backfill),
> ROLLBACK_PLAN.md. Do not write tasks.

## Step 7 — Final report

Output exactly:

```
## Feature scaffolded: $1

- Spec: <path | pasted | placeholder>
- AC IDs: AC-001 … AC-### (N total)
- NFR IDs: NFR-001 … NFR-### (M total)
- Questions open: Q-### count (blocking: K)
- Design status: Draft | Approved
- Current increment: INC-001 (experiential MVP; planning pending | defined)
- Next role: planner (Phase: design) | planner (Phase: plan) | human (questions blocking)
- Next command: /feature-context $1
```

Do not invoke `planner (Phase: plan)` from this command. Task decomposition
happens once DESIGN.md is `Approved`.
