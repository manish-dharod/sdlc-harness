# <Feature Name>

Last updated: YYYY-MM-DD
Tier: medium (5-file control plane: 1 navigation + 4 content)
Status: Draft | Active | Done | Archived

> **When to use the medium tier**
>
> - 1–2 week scope.
> - May touch the database (one or two migrations).
> - Does **not** touch PCI / card data / auth / webhook signatures / production
>   feature flags that default ON.
> - No vendor sandbox dependency, no compliance signoff.
>
> If any of those exclusions is violated, upgrade to large (default tier).

## Files (read order)

1. `SPEC.md` — owner spec + AC IDs + NFRs + open questions inline
2. `DESIGN.md` — architecture + test strategy + rollback inline
3. `TASKS.md` — DAG-aware tasks + decisions inline
4. `EVIDENCE.md` — verification log + traceability inline + findings inline

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
scripts/feature-next-task <slug>
scripts/feature-verify <slug> fast
```

> Note: `scripts/feature-ready` is large-tier-aware and may warn about missing
> files for medium-tier features. `scripts/feature-reconcile`'s
> adversarial-trail check is also large-tier-only (it emits an INFO line and
> skips for medium tier — see `EVIDENCE.md` in this template for the
> opt-in adversarial review pattern). Treat both scripts' output as
> advisory for medium tier until/unless they learn about `.tier`
> explicitly.
