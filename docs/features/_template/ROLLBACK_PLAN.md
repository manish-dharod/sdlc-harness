# Rollback Plan

Last updated: YYYY-MM-DD
Author: planner (Phase: design), reviewed by security

How to undo this feature without data loss or downtime. Required for all
features behind a flag. `release` blocks `READY` if this file is missing or
has unverified items.

## Rollback tiers

Try the lowest tier first. Escalate only when the lower one is insufficient.

### Tier 1 — Flag flip

- Flag name: `<flag_name>`
- How to flip: <admin UI / config file / env var>
- Effect: <user-visible result of flipping off>
- Time-to-revert: <seconds>
- Recovery for in-flight requests: <how partial flows complete or fail>
- Owner: name
- Tested in staging on: YYYY-MM-DD (record in EVIDENCE.md)

### Tier 2 — Code rollback

- Method: redeploy previous tag / revert commit / etc.
- Migration handling: which migrations from MIGRATION_PLAN.md must NOT roll
  back (typically additive ones) and which can
- Time-to-revert: <minutes>
- Owner: name

### Tier 3 — Data rollback

- Required only for irreversible migrations or corrupted-data scenarios
- Procedure: <step-by-step, including backup source, restore steps, validation>
- Time-to-revert: <hours>
- Owner: DBA + named approver

## Triggers

When to actually pull each tier. Be specific.

- Tier 1 if: error rate > X%, p95 latency > Y, observed customer impact, ...
- Tier 2 if: Tier 1 doesn't stop the bleeding within Z minutes
- Tier 3 if: data corruption confirmed

## Communications plan

- Customer comms: <who writes, channel, approval>
- Internal comms: <oncall channel, escalation>
- Vendor comms (if applicable): <who notifies>

## Test of rollback

Rollback that isn't tested is hypothetical. Record in EVIDENCE.md:

- Date of staging rollback test
- Result
- Time-to-revert measured
- Issues found, fixes applied
