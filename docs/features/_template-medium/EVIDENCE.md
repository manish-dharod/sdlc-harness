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

## QA coverage ledger

Use this shape for frontend, backend, integration, or parity QA. Build the
control inventory before testing so every button, link, tab, menu, form field,
modal, API route, data branch, error state, and newly revealed nested control is
either tested or explicitly routed as a gap.

```text
## YYYY-MM-DD - QA coverage ledger: TASK-###

- Task: TASK-###
- QA coverage ledger
- Control inventory:
  - Source(s): production DOM | candidate DOM | code routes/controllers/components | API schema
  - Rows: <count>; artifact: <path>
- Production baseline:
  - Artifact(s): <screenshots/traces/responses/code refs>
  - Behavior summary:
- Candidate proof:
  - Artifact(s): <screenshots/traces/responses/test output>
  - Parity/functionality result:
- Data-path proof:
  - Inputs checked:
  - Request/body/query/response/rendered-state proof:
- Untested rows: 0
- Result: PASS
```

If any in-scope row is not tested, set `Untested rows:` to the real count and
open a finding/task. Do not mark `Result: PASS`.

## Pre-review self-audit

Before handing a code-bearing task to Review or Done, sg-swe records this
task-scoped block. Medium tier treats this as advisory discipline; large tier
enforces the same shape in `scripts/feature-reconcile`.

```text
## YYYY-MM-DD - Pre-review self-audit: TASK-###

- Task: TASK-###
- Plausible miss 1: <how this diff could still be wrong>
  - Check: <concrete check run, or Skipped: <explicit local-skip reason>>
  - Result: pass | fail | skipped
- Plausible miss 2: <how this diff could still be wrong>
  - Check: <concrete check run, or Skipped: <explicit local-skip reason>>
  - Result: pass | fail | skipped
- Plausible miss 3: <how this diff could still be wrong>
  - Check: <concrete check run, or Skipped: <explicit local-skip reason>>
  - Result: pass | fail | skipped
```

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

Medium tier features still record an adversarial trail per Review/Done task.
For tasks claimed on or after 2026-06-24, the review must use the opposite AI
tool family: Claude-authored work uses `scripts/adversary-review`, and
Codex-authored work uses `scripts/claude-adversary-review`. Same-tool review
and routing-skip are not acceptable for that post-cutoff Review-stage gate. The
shape mirrors the large tier:

```text
## YYYY-MM-DD - Adversarial review clear: TASK-###

- Task: TASK-###
- Source: reviewer (Mode: adversarial)
- Implementer tool: claude-code | codex-cli | codex-app
- Implementer model: <model-name>
- Reviewer tool: claude-code | codex-cli
- Reviewer model: <model-name>
- Reviewer mode: codex-backed | claude-backed | direct
- Codex artifact: docs/features/<slug>/adversary/<timestamp>.md (when Reviewer tool: codex-cli)
- Claude artifact: docs/features/<slug>/adversary/<timestamp>.md (when Reviewer tool: claude-code)
- Categories examined: false-confidence, missed-edge, spec-loophole,
  hidden-coupling, negative-path, env-assumption, rollback-gap,
  stale-evidence, traceability-mismatch, tests-pass-behavior-wrong
- Result: clear — no P0/P1/P2 adversarial findings
```

> **Note**: `scripts/feature-reconcile` enforces the post-2026-06-24
> Review-stage adversarial and QA-ledger gates for feature tiers that have
> TASKS.md/EVIDENCE.md. Historical Done tasks remain grandfathered by date.
