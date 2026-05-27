# Migration Plan

Last updated: YYYY-MM-DD
Author: planner (Phase: design), reviewed by security

Schema / data migrations required for this feature. Required if the feature
touches DDL, backfills, column type changes, or ID-mapping. Reviewed by
security for safety; `release` blocks if this file is missing or has
unresolved blockers when migrations are in the diff.

## Migration list

Each migration is a numbered entry. Order is execution order.

### MIG-001: <short title>

- Type: `additive` / `destructive` / `data-only` / `index` / `enum-rename` / ...
- DDL (sketch — not real SQL until written in code):
  ```
  ALTER TABLE ... ADD COLUMN ... NULLABLE
  ```
- Lock duration estimate: <ms / s / minutes>
- Row count touched: <rough estimate>
- Reversibility: `safe` / `requires-backfill-rollback` / `irreversible`
- Backfill plan: <how, batch size, throttle, runtime estimate>
- Rollback DDL (must exist for non-irreversible):
  ```
  ALTER TABLE ... DROP COLUMN ...
  ```
- Concurrent-write safety: <does it block writes? require app downtime? need
  zero-downtime pattern like expand-migrate-contract?>
- Dry-run command: <how to test on a copy or staging>

## Sequencing with code

- Code change that *requires* MIG-001 is in TASK-### — must land *after*
  migration is applied.
- Code change that *can run without* MIG-001 is in TASK-### — can land first.

## Data integrity checks

Post-migration verification queries (sanitized; no real PII):

- `SELECT COUNT(*) FROM ... WHERE ...` — expected: ...
- `SELECT * FROM ... WHERE <invariant violated>` — expected: 0 rows

## Risks

- ID-mapping correctness (if applicable — see Reviewer 3's swap concern)
- NOT NULL backfill blocking writes
- Foreign key cascade surprises
- Index creation locking

## Required external evidence

- Staging dry-run of full migration with realistic data volume
- Approved by: <DBA / ops / security>
- Recorded in: `EVIDENCE.md`
