# Iteration Ledger

Last updated: YYYY-MM-DD
Maintained by: `/feature-loop` (writes one entry per iteration)

Append-only log of `/feature-loop` iterations. Used by the loop itself for
oscillation detection, and by `release` and the owner for after-the-fact
audit.

## Schema (per iteration)

```text
### RUN-### — YYYY-MM-DD HH:MM TZ

- Iteration index: N (zero-based for this feature)
- Mode: fast | unit | full
- Task claimed: TASK-### or `planning-only` or `none`
- Files changed: <count + paths>
- Diff hash: <short hash of `git diff "${SDLC_BASE_BRANCH:-master}..HEAD"`>
- Findings opened: FND-### (P0/P1/P2/P3)
- Findings closed: FND-###
- Verification: <mode> = pass | fail | skipped (<reason>)
- Approvals touched: APV-### (Requested → Approved | unchanged)
- Stop reason: continue | ready | blocked-external | blocked-human | oscillation | budget-exhausted | error
- Stop reason code: <NONE | NEEDS_HUMAN_APPROVAL | NEEDS_EXTERNAL_EVIDENCE | OSCILLATION_DETECTED | ITERATION_BUDGET_EXHAUSTED | NO_PROGRESS_3X | ERROR>
- Cost estimate: <iteration count> iterations into <feature>
- Next step: <one line>
```

## Oscillation detector (read by /feature-loop)

The loop refuses to start a new iteration if:

- The same task ID was claimed in this run AND the previous run AND no diff
  was produced — that's a thrash.
- The same finding ID was opened and closed in three consecutive runs — that's
  a reviewer ↔ swe oscillation.
- The diff hash matches the previous run's diff hash — no progress.

When any of these triggers, the loop writes a `Stop reason: oscillation` entry
and refuses to continue without owner intervention.

## Iteration budget (read by /feature-loop)

Default budget (override in this feature's `STATE.md` "Loop budget" section):

- Max iterations per `/loop` campaign: 25
- Max consecutive no-progress iterations: 3
- Max consecutive "blocked-external" iterations before forced stop: 3

When exhausted, the loop writes a `Stop reason: budget-exhausted` entry and
halts.

## Runs

(empty — `/feature-loop` appends entries here)
