# Feature Evidence Log

Last updated: YYYY-MM-DD
Tier: medium

## Append-only verification log

One row per verification run that produced an outcome worth keeping. Pass and
fail both go here. Skipped checks go here too with the reason.

| Date | Task | Command | Mode | Result | Notes / artifact |
|------|------|---------|------|--------|------------------|
| YYYY-MM-DD | TASK-### | `command` | fast | pass / fail / skipped | <pointer> |

## UI/full verification report

Use this shape when verification depends on a user-visible flow. Keep it
source-grounded and reviewable.

```text
## YYYY-MM-DD - UI/full verification: TASK-###

- Task: TASK-###
- Source-grounded test plan:
  - Target behavior:
  - Source/routes read:
  - Required setup:
  - User path to exercise:
- Setup helpers:
  - setup-script: scripts/... | none
  - State shortcuts used: none | <what was set up before the proof flow>
- Step annotations:
  - Step: <action>
    Expected: <observable result committed before acting>
    Observed: <what happened>
    Result: pass | fail | untested
- Timing-sensitive checks:
  - Wait/poll strategy: <e.g. Playwright expect/toast timeout> | n/a
- Artifacts:
  - Screenshot before action: <path> | n/a
  - Screenshot after action: <path> | n/a
  - Trace/video: <path> | n/a
- Anti-cheating note:
  - Proof used real user actions: yes | no (if no, explain why acceptable)
```

State shortcuts may be used to reach setup cheaply, but not as proof of the
user flow. If proof required browser JavaScript, direct DB mutation, or forced
state, record it explicitly and treat the result as weaker than a real-flow
check.

## Traceability matrix

One row per AC. Updated whenever a task that cites the AC reaches `Done`.

| AC ID | Tests (file:name) | Last result | Task(s) |
|-------|-------------------|-------------|---------|
| AC-001 | `tests/...` | pass / fail / pending | TASK-### |

## Findings

Active review / QA / adversarial findings. Live here for medium tier rather
than a separate `FINDINGS.md`.

- Source: reviewer (Mode: quality) | security | reviewer (Mode: qa) | reviewer (Mode: adversarial) | human
- Severity: P0 / P1 = blocking (any Source, including reviewer (Mode: adversarial)).
  P2 / P3 = informational.
- Status: Unverified → Confirmed → Fixed | False positive | Blocked.

### FND-EXAMPLE-001: Example finding (delete when adding real ones)

- Date: YYYY-MM-DD
- Source: reviewer (Mode: quality)
- Severity: P2
- Status: Unverified
- Task: TASK-### (required when Source is reviewer (Mode: adversarial))
- AC IDs affected: AC-001
- Adversarial category: <one of false-confidence | missed-edge | spec-loophole | hidden-coupling | negative-path | env-assumption | rollback-gap | stale-evidence | traceability-mismatch | tests-pass-behavior-wrong> (only for Source reviewer (Mode: adversarial))
- File/line: path:line
- Failure mode: <what breaks, how, when>
- Evidence: <reproduction or grep/test that demonstrates it>
- Minimal fix: <smallest change that resolves it>
- Owner/next action: <who, what>

## Adversarial review trail (reviewer (Mode: adversarial) writes these)

Medium tier features should still record an adversarial trail per Done
code-bearing task — either an inline "Adversarial review clear: TASK-###"
or "Adversarial review skipped by routing rule: TASK-###" entry in this
file's verification log, or reviewer (Mode: adversarial) findings above with all P0/P1
resolved. The shape mirrors the large tier:

```text
## YYYY-MM-DD - Adversarial review clear: TASK-###

- Task: TASK-###
- Source: reviewer (Mode: adversarial)
- Reviewer mode: codex-backed | direct
- Codex artifact: docs/features/<slug>/adversary/<timestamp>.md (or "n/a — direct")
- Categories examined: false-confidence, missed-edge, spec-loophole,
  hidden-coupling, negative-path, env-assumption, rollback-gap,
  stale-evidence, traceability-mismatch, tests-pass-behavior-wrong
- Result: clear — no P0/P1/P2 adversarial findings
```

> **Note**: `scripts/feature-reconcile` is currently large-tier-aware only,
> so the adversarial-trail gate is **enforced** for large-tier features and
> **advisory** for medium tier. Treat it as discipline you opt into; the
> review value is the same.
