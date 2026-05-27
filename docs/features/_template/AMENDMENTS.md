# Spec Amendments

Last updated: YYYY-MM-DD
Maintained by: planner (Phase: intake) (drafts impact analysis), owner (approves)

When SPEC.md changes after work has started, every amendment lands here with
an impact analysis. `/feature-amend` writes the entry; the owner reviews; then
planner (Phase: plan) replans only the affected tasks.

## Schema

```text
### AMD-### — YYYY-MM-DD — <short title>

- Source: <owner request / discovered ambiguity / external constraint>
- SPEC.md version: old N → new N+1
- Change: <one paragraph — exactly what changed in SPEC.md>

- Impact on AC IDs:
  - AC-### — unchanged / amended / removed / new
  - ...

- Impact on tasks (from TASKS.md):
  - TASK-### (status `Done`) — keep as-is | rework as TASK-### | revert
  - TASK-### (status `Open`) — keep | modify scope | close as obsolete
  - TASK-### (status `Claimed`) — let session finish | request handoff
  - TASK-### (new) — open

- Impact on design (DESIGN.md sections):
  - <section> — unchanged / amended / new

- Impact on tests (TRACEABILITY.md rows):
  - <list of rows that need to change>

- Impact on approvals (APPROVALS.md):
  - <approvals that need to be re-requested>

- Owner approval of this amendment: <pending / Approved YYYY-MM-DD by name>
```

## Amendments

(empty — populated by `/feature-amend`)
