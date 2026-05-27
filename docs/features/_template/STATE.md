# Feature State

Last updated: YYYY-MM-DD

## Current verdict

One of: `intake` | `design` | `implementation` | `review` | `blocked` |
`staging` | `release-ready`. `release` reports a verdict; only
`planner (Phase: plan)` writes it here.

## Machine-readable status (parsed by scripts)

```yaml
verdict: intake
design_status: Draft        # Draft | Approved (only Approved unblocks Backlog→Open)
waiting_on_human: false
stop_reason_code: NONE      # see APPROVALS.md for the enum
open_questions: 0
open_p0: 0
open_p1: 0
open_tasks: 0
claimed_tasks: 0
blocked_tasks: 0
ac_total: 0
ac_passing: 0
nfr_total: 0
nfr_passing: 0
```

`scripts/feature-reconcile` enforces that the YAML above matches what is
actually in TASKS.md / FINDINGS.md / TRACEABILITY.md. If they diverge, the
script refuses to pass until reconciled.

## Feature metadata

- Feature slug: `<feature-slug>`
- Feature name:
- Main product area:
- Branch/worktree expectation: one worktree per `Claimed` task; control-plane
  edits land on the feature branch only.
- Verification profile: `generic`

## Loop budget (read by /feature-loop)

Overrides the defaults in `RUNS.md`. Leave blank to use defaults.

- Max iterations per `/loop` campaign:
- Max consecutive no-progress iterations:
- Max consecutive blocked-external iterations:

## Start every session with

```bash
scripts/feature-context <feature-slug>
```

## Current highest-priority work

- item

## Active blockers

- item

## Stop conditions

Stop and record a blocker instead of guessing when work requires:

- secrets or credentials not configured outside git
- production deploy, DNS / firewall / panel, live DB mutation
- destructive git or filesystem operations
- product / security / compliance / ops approval (open an `APPROVALS.md` entry)
