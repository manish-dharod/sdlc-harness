# Feature Name

Last updated: YYYY-MM-DD

## Goal

One or two sentences. The owner-provided spec lives in `SPEC.md`, not here.

## Scope

- In scope:
  - item
- Out of scope:
  - item

## Main areas

- path or system area

## Start commands (canonical)

```text
/feature-context <feature-slug>
/feature-next-task <feature-slug>
/feature-verify <feature-slug> fast
/feature-ready <feature-slug>
```

Or call the deterministic scripts directly:

```bash
scripts/feature-context <feature-slug>
scripts/feature-increment check <feature-slug>
scripts/feature-next-task <feature-slug>
scripts/feature-verify <feature-slug> fast
scripts/feature-ready <feature-slug>
scripts/feature-reconcile <feature-slug>
```

## Control plane (read order)

The framework expects every feature folder to contain these files. `planner (Phase: intake)`
populates the spec side; `planner (Phase: design)` populates the design side; the roles
update state/tasks/findings/evidence as work happens.

1. `SPEC.md` — owner-provided spec + extracted AC/NFR IDs
2. `QUESTIONS.md` — open ambiguities blocking task intake
3. `REQUIREMENTS.md` — structured restatement of SPEC
4. `DESIGN.md` — architecture, data model, API, sequences
5. `TEST_STRATEGY.md` — per-AC and per-NFR test plan
6. `THREAT_MODEL.md` — feature-level security threat model
7. `MIGRATION_PLAN.md` — schema/data migrations + rollback DDL
8. `ROLLBACK_PLAN.md` — flag / code / data rollback tiers
9. `STATE.md` — current verdict, blockers, budget
10. `INCREMENTS.md` — current experiential slice, shippable proof, owner verdict
11. `TASKS.md` — DAG-aware task queue (depends-on, AC IDs, increment ID)
12. `TRACEABILITY.md` — AC → DESIGN → TASK → tests → evidence
13. `FINDINGS.md` — review/security findings + severity budgets
14. `DECISIONS.md` — durable ADR-style decisions
15. `EVIDENCE.md` — command results, manual checks, artifacts
16. `APPROVALS.md` — human signoffs as machine-checkable records
17. `RELEASE_GATES.md` — machine-checkable launch checklist
18. `AMENDMENTS.md` — spec change log + impact analysis
19. `RUNS.md` — append-only iteration ledger (`/feature-loop` writes)

The `.incremental-delivery` marker activates feedback-gated delivery. Complete
and verify INC-001, move it to `Ready for feedback`, and stop until the owner
records `Accepted` or `Changes requested`.

## Verification profile

This feature uses the `<generic | your-domain-specific-profile>` verification profile.
Profile name controls what `scripts/feature-verify` runs.

## Adversarial review artifacts

`scripts/adversary-review <slug> [task-id] [mode] [base-assertion]
<implementer-model>` writes a gitignored local transcript and retry sidecar.
A valid terminal review also writes a tracked, sanitized schema-v2 receipt
under `docs/features/<slug>/review-receipts/`. Cite the receipt in EVIDENCE
and validate it with
`scripts/review-attempt validate-receipt <path> --require-scoped`; do not
commit raw transcripts.

Legacy status is derived from task state at the immutable
`SDLC_REVIEW_RECEIPT_ADOPTION_COMMIT`. Current code-bearing Review/Done tasks
cannot use mutable dates or exemption files to bypass the tracked receipt and
same-attempt evidence gates.
`Type: docs` skips the heavy gates only when reconcile proves a dedicated
claim plus a non-empty, fully owned documentation-only claim-to-candidate diff.
