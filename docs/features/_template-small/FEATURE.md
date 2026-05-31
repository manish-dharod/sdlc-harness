# <Feature Name>

Last updated: YYYY-MM-DD
Tier: small (single-file control plane)
Status: Draft | Active | Done | Archived

> **When to use the small tier**
>
> - 1–3 day scope, one developer.
> - No database migration, no payment / auth / webhook surface, no PCI.
> - No new external integration.
>
> If any of the above are false, upgrade to medium (`scripts/feature-init <slug>
> --tier medium`) or large (default). It is cheaper to upgrade tier early than
> to discover mid-flight that the small tier was the wrong choice.

## Goal

One or two sentences. What changes for the user? Why now?

## Acceptance criteria

Lightweight AC IDs — still useful for traceability without the ceremony of a
separate SPEC file.

- AC-001: <observable outcome>
- AC-002: <observable outcome>

## Out of scope

- <explicit non-goal>

## Required capabilities / credentials

Small-tier work should normally declare `- none`. If this needs new external
credentials, staging access, a new integration, PCI, auth, or webhook access,
upgrade the feature tier before implementing.

- none

## Plan

One task block per logical change. Same `### TASK-###` / `- Status:` /
`- Depends-on:` schema as the large tier. `scripts/feature-next-task` reads
this file directly for small-tier features (it picks the right source file
by reading the `.tier` marker). `scripts/feature-reconcile` is currently
large-tier-aware only — its checks will warn or no-op for small tier; that's
expected until it learns about `.tier` explicitly.

### TASK-001: <short title>

- Status: Backlog | Open | Claimed | Review | Done
- AC IDs: AC-001
- Type: feature                   # optional: feature | bug | perf | ui | migration | docs | refactor | infra
- Owner/session: unclaimed
- Branch/worktree:
- Depends-on:
- Risk: low | medium | high
- Intended file ownership:
  - path/to/file.ext
- Verification:
  - command
  - mode: fast | unit | full

> `Type:` is optional. When set, the Evidence section below must include
> the type-specific artifact (failing-then-passing repro for `bug`,
> baseline/post/delta for `perf`, before/after screenshots for `ui`,
> backfill+rollback for `migration`). See the large-tier template's
> EVIDENCE.md for exact shapes. Small-tier features have no
> reconcile-script enforcement of this; it's discipline, not a gate.

## Decisions

Durable architectural / scope decisions only — not chat-level notes.

- YYYY-MM-DD — DEC-001: <decision> — <one-line rationale>

## Evidence

Append-only log of what was actually verified, with the command and result.
For UI/full checks, include a source-grounded test plan, expected/observed
step annotations, labeled screenshots or trace/video paths, and whether any
state shortcut was used for setup rather than proof of the user flow.

- YYYY-MM-DD — <command run> — <pass/fail> — <pointer to artifact if any>

## Findings

Active review / QA / adversarial findings. Severity: P0 P1 (blocking, any
Source including reviewer (Mode: adversarial)) / P2 P3 (informational).

- FND-001 — Source — Pn — <status> — <one-line description> — <file:line if applicable>

## Release readiness

Tick when true. The small tier deliberately has no `APPROVALS.md`,
`RELEASE_GATES.md`, or `RUNS.md` — if release gating matters, you are not on
the small tier.

- [ ] All ACs have at least one passing test or recorded manual verification
- [ ] All tasks are `Done`
- [ ] No unresolved P0/P1 findings (any Source)
- [ ] No new PCI / auth / webhook surface introduced (if any, upgrade tier)

## Adversarial review (intentionally lighter at small tier)

The full `reviewer (Mode: adversarial)` gate (separate FINDINGS + EVIDENCE adversarial-trail
entry per Done task, enforced by `scripts/feature-reconcile`) is required
at the **large** tier. At small tier the adversarial discipline is opt-in:
either invoke `reviewer (Mode: adversarial)` directly via the Task tool for a high-stakes
small-tier change, or rely on the constraint that small-tier work has no
PCI / payment / auth / webhook surface, no DB schema, and no new external
integration — i.e. the risk surface that adversarial review primarily
defends against is absent by construction.

If the change *does* touch any of those surfaces during execution, that's
the signal to upgrade tier (small → medium or large) and pull in the full
adversarial gate. Upgrade is cheaper than retroactive review.
