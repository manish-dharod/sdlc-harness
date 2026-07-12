# <Feature Name>

Last updated: YYYY-MM-DD
Tier: medium (6-file control plane: 1 navigation + 5 content)
Status: Draft | Active | Done | Archived

> **When to use the medium tier**
>
> - 1–2 week scope.
> - May touch the database (one or two migrations).
> - Does **not** touch PCI / card data / auth / webhook signatures / production
>   feature flags that default ON.
> - No carrier sandbox dependency, no compliance signoff.
>
> If any of those exclusions is violated, upgrade to large (default tier).

## Files (read order)

1. `SPEC.md` — owner spec + AC IDs + NFRs + open questions inline
2. `DESIGN.md` — architecture + test strategy + rollback inline
3. `INCREMENTS.md` — current experiential slice, shippable proof, owner verdict
4. `TASKS.md` — DAG-aware tasks + decisions inline
5. `EVIDENCE.md` — verification log + traceability inline + findings inline

The medium tier deliberately omits: `REQUIREMENTS.md`, `QUESTIONS.md`,
`TEST_STRATEGY.md`, `THREAT_MODEL.md`, `MIGRATION_PLAN.md`, `ROLLBACK_PLAN.md`,
`STATE.md`, `TRACEABILITY.md`, `FINDINGS.md`, `APPROVALS.md`,
`RELEASE_GATES.md`, `AMENDMENTS.md`, `RUNS.md`. Those exist in the large tier
because PCI / payment / multi-team work needs them. Medium-tier features do
not, and forcing them creates documentation drift.

## Verification profile

`<generic | feature-specific>` — controls `scripts/feature-verify` routing.

## Start commands

```bash
scripts/feature-context <slug>
scripts/feature-increment check <slug>
scripts/feature-next-task <slug>
scripts/feature-verify <slug> fast
```

`scripts/feature-ready` and `scripts/feature-reconcile` are tier-aware. Current
code-bearing Review/Done tasks use the same tracked receipt, self-audit, QA,
and application-verification gates as small and large features.

The `.incremental-delivery` marker activates feedback-gated delivery. Complete
and verify INC-001, move it to `Ready for feedback`, and stop until the owner
records `Accepted` or `Changes requested`.
