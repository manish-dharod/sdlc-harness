---
description: Run parallel review (reviewer in 3 modes + security) on the current feature diff, with risk routing
argument-hint: <feature-slug> [unit|full] [--include-p3]
---

Run multi-agent review for `$ARGUMENTS`. The second argument (default `unit`)
is the QA verification mode. The optional `--include-p3` flag tells
`reviewer` and `security` that the loop should act on P3 findings this pass
(normally they're collected but not loop-blocking).

## Pre-flight

1. Run `scripts/feature-context $1` to load state.
2. Capture the diff scope:

```bash
git diff --stat
git diff --stat "${SDLC_BASE_BRANCH:-master}..HEAD"
git diff --name-only "${SDLC_BASE_BRANCH:-master}..HEAD"
```

## Risk routing — choose which agent modes to invoke

Look at the changed paths from `git diff --name-only`:

- **Docs-only diff** (paths all start with `docs/`, only `.md` files): invoke
  `reviewer (Mode: quality)` only. Skip `security` and `reviewer (Mode: qa)`
  — these tax tokens for no real-world risk on prose changes. **For
  `reviewer (Mode: adversarial)`**: invoke it in *lightweight skip* mode —
  the agent records an explicit "Adversarial review skipped by routing
  rule" EVIDENCE entry naming the task(s) touched, so
  `scripts/feature-reconcile` still sees a valid trail. Do **not** silently
  omit the adversarial pass; the reconcile check enforces it.
- **Test-only diff** (paths all under `tests/` or `*.test.*` / `*.spec.*`):
  invoke `reviewer (Mode: quality)`, `reviewer (Mode: qa)`, and
  `reviewer (Mode: adversarial)`. Skip `security`.
- **Migration diff** (any path under `database/migrations/` or DDL): invoke
  all four modes; pass to `security` an explicit reminder to cross-check
  MIGRATION_PLAN.md; pass to `reviewer (Mode: adversarial)` an explicit
  reminder to use `review-strict` for rollback-gap analysis.
- **Payment / auth / webhook / secrets surface** (secrets vault,
  controllers matching `Payment|Auth|Webhook|Token`, `*.env*`): invoke all
  four with emphasis on `security` and `reviewer (Mode: adversarial)` (use
  `review-strict`).
- **Default** (anything else): invoke all four in parallel.

## Spawn subagents in parallel (one message, multiple Agent tool calls)

The new 5-agent shape collapses the old 4 review roles into one `reviewer`
agent with a `Mode:` flag in the prompt. Spawn `reviewer` three times in
parallel (different modes) plus `security` once:

- **reviewer (Mode: quality)** — general code review on the current diff.
  Brief: "Mode: quality. Review the diff for feature `$1`. Capture findings
  in docs/features/$1/FINDINGS.md with FND-### IDs. Respect severity budget
  (P0/P1 mandatory, P2 capped at 5, P3 collected but not loop-blocking
  unless --include-p3). Check that TRACEABILITY.md was updated for any
  behavioral change."

- **security** *(if routed in)* — security and launch-gate review on the
  same diff. Brief: "Security-review the diff for feature `$1`. Prefer
  `scripts/security-review $1 [task-id] [review|review-strict]` if Codex
  CLI is available — cross-model perspective is especially valuable for
  PCI / auth / webhook / migration surfaces. Otherwise direct security
  review. Cross-check THREAT_MODEL.md and MIGRATION_PLAN.md (if
  migrations changed). Open APPROVALS.md entries with stop reason codes
  for any external evidence needed. Tag Source: security on all findings.
  Validate every 'Confirmed' finding the wrapper proposes against the
  actual code before opening it as a real FINDING."

- **reviewer (Mode: qa)** *(if routed in)* — run verification and record
  evidence. Brief: "Mode: qa. Run `scripts/feature-verify $1 $2` (default
  unit). Apply flake quarantine policy (3 retries). Update TRACEABILITY.md
  test-status fields for any AC rows touched. Append an evidence entry to
  docs/features/$1/EVIDENCE.md."

- **reviewer (Mode: adversarial)** *(always — see routing for
  lightweight-skip path)* — independent adversarial review on the same diff.
  Brief: "Mode: adversarial. Review the diff for feature `$1`. Prefer
  `scripts/adversary-review $1 [task-id] [review|review-strict]` if Codex
  CLI is available; otherwise direct adversarial review. Walk the 10
  categories (false-confidence, missed-edge, spec-loophole, hidden-coupling,
  negative-path, env-assumption, rollback-gap, stale-evidence,
  traceability-mismatch, tests-pass-behavior-wrong). Open FINDINGS only
  for validated hypotheses with concrete evidence. If nothing survives
  validation, append an 'Adversarial review clear' entry to EVIDENCE.md
  citing the task ID. For docs-only routing, append an 'Adversarial review
  skipped by routing rule' entry instead — do not skip silently."

Use the Task tool with `subagent_type=reviewer` (three times, different
prompts) and `subagent_type=security` (once). Run them concurrently for
speed.

## Synthesize

Once all (invoked) subagents return, report:

- **Routing applied** — which modes ran, which were skipped, why
- **Findings opened** — FND-### IDs + severity + status, grouped by mode
- **Pattern clusters** — scan the union of findings for *repeats of the
  same defect class* (e.g., 2+ findings about webhook signature validation,
  2+ findings about missing CSRF, 2+ findings about stale TRACEABILITY
  rows). If a cluster exists, name it explicitly in the synthesis and
  recommend that `builder` widen the fix to close the class — not just the
  N individual sites. This is the blast-radius principle from CLAUDE.md
  applied at the orchestrator level.
- **Severity budget** — P0/P1 mandatory count, P2 active count vs cap, P3
  collected count (and whether `--include-p3` was set)
- **TRACEABILITY discipline** — was it updated? If not, name the finding ID
- **Verification** — mode run + pass/fail (+ flake events handled)
- **Evidence** — section added to EVIDENCE.md
- **Adversarial result** — `clear` | `skipped-by-routing` | `findings opened`
  (with FND-### list). Always state this explicitly; the absence of an
  adversarial-trail entry is itself drift.
- **APPROVALS opened** — APV-### IDs + stop reason codes
- **Blockers** — any external-evidence-required items
- **Recommended next role**:
  - `builder` if there are Confirmed P0/P1 findings in scope to fix
    (including P0/P1 from `reviewer (Mode: adversarial)` — these block
    Done just like findings from any other mode)
  - `planner (Phase: plan)` if findings span multiple tasks or need
    re-sequencing
  - `reviewer (Mode: acceptance)` if all task work is done and AC coverage
    needs auditing
  - `release` if no P0/P1 remain, verification passed, AC coverage clean,
    AND every Done-bound task has an adversarial trail
  - Stop if blocked on external evidence

Do not duplicate the subagents' work yourself. Your job is orchestration +
synthesis.

## After the parallel pass — re-check if builder fixed P0/P1 findings

If `builder` was invoked downstream to fix Confirmed P0/P1 findings opened
in this review (from any mode — quality, security, qa, or adversarial),
the *final* diff is a new change set. That new diff needs an adversarial
re-check before any task can transition to Done:

- Invoke `reviewer` with `Mode: adversarial` targeted at the fix diff (cite
  the FND-### IDs that were fixed). It can be lightweight (focused on
  whether the fix introduces a new category of adversarial concern), but
  it must record a trail entry in EVIDENCE.md citing the task.

`scripts/feature-reconcile` treats any Done task without an adversarial
trail as drift — missing the re-check counts as drift.
