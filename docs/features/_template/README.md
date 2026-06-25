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
10. `TASKS.md` — DAG-aware task queue (depends-on, AC IDs)
11. `TRACEABILITY.md` — AC → DESIGN → TASK → tests → evidence
12. `FINDINGS.md` — review/security findings + severity budgets
13. `DECISIONS.md` — durable ADR-style decisions
14. `EVIDENCE.md` — command results, manual checks, artifacts
15. `APPROVALS.md` — human signoffs as machine-checkable records
16. `RELEASE_GATES.md` — machine-checkable launch checklist
17. `AMENDMENTS.md` — spec change log + impact analysis
18. `RUNS.md` — append-only iteration ledger (`/feature-loop` writes)

## Verification profile

This feature uses the `<generic | your-domain-specific-profile>` verification profile.
Profile name controls what `scripts/feature-verify` runs.

## Adversarial review artifacts

`scripts/adversary-review <slug> [task-id] [mode]` writes cross-model
adversarial review artifacts to `docs/features/<slug>/adversary/<ts>.md`
(Claude-authored work -> Codex by default). `scripts/claude-adversary-review`
is the Codex-authored work -> Claude Code path and is pinned to
`claude-opus-4-8`. These are cited by EVIDENCE.md adversarial-clear entries
via `Codex artifact:` or `Claude artifact:` as appropriate. Keep them in git
as durable evidence.

Optional grandfathering: `docs/features/<slug>/.adversarial-exempt` lists
task IDs (one per line, `#` comments allowed) whose Done transitions
predate the adversarial gate (cutoff: 2026-05-24). New features should
not need this file.
