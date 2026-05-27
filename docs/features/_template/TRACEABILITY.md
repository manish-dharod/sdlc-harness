# Traceability Matrix

Last updated: YYYY-MM-DD
Maintained by: builder (per-task), reviewer (Mode: qa) (test rows), reviewer (Mode: acceptance) (final audit)

The single source of truth that every requirement maps through to a passing
test with recorded evidence. `reviewer (Mode: acceptance)` walks this file at release time
and refuses `READY` if any row is incomplete.

## Schema

Each row links one chain: `AC → DESIGN section → TASK → tests → evidence`.

| AC ID | NFR? | Design anchor | Task IDs | Test files | Test status | Evidence date | Owner |
|---|---|---|---|---|---|---|---|

## Active rows

| AC-001 | — | DESIGN.md#api-surface | TASK-002, TASK-005 | tests/Feature/...Test.php::it_does_x | Passing | 2026-05-21 | builder |
| AC-002 | NFR-001 perf | DESIGN.md#sequence-happy-path | TASK-008 | tests/Perf/...Test.php | Passing | 2026-05-21 | reviewer (Mode: qa) |

## Coverage summary (machine-checkable)

`reviewer (Mode: acceptance)` derives this from the rows above. Format is exact so scripts
can parse. **For a fresh scaffold, leave the values at 0 — reviewer (Mode: acceptance)
overwrites them on first run. Do not use `N` / `M` placeholders here; the
reconcile script reads these as literal values.**

```text
AC total: 0
AC with passing tests: 0
AC with failing tests: 0
AC with no tests: 0
NFR total: 0
NFR measured and passing: 0
NFR measured and failing: 0
NFR unmeasured: 0
```

`READY` requires: zero failing, zero unmeasured, zero with-no-tests, *and*
`AC total > 0` (a feature with zero ACs is not a feature).

## Gaps (auto-listed by reviewer (Mode: acceptance))

- AC-### — no test row
- NFR-### — measurement missing or failing
- DESIGN section "..." — not referenced by any task

## Drift watch

When a task lands or a finding closes, the owning role MUST update this file.
A diff that changes behavior without updating TRACEABILITY.md is a P1 finding
from reviewer (Mode: quality).
