# Feature Evidence Log

Last updated: YYYY-MM-DD

Do not paste secrets, raw payloads, tokens, credentials, auth headers, customer
PII, raw card data, or full webhook bodies. Sanitized field-shape examples only.

## Evidence format (append per session)

```text
## YYYY-MM-DD - Short Title

- Task: TASK-### (or `none` for cross-task evidence)
- AC IDs covered: AC-###, AC-###
- Branch/worktree:
- Commands:
  - command: pass | fail | skipped — one-line summary
- Manual checks:
  - check: result
- Artifacts:
  - safe path / link (no PII, no bundles) or "none"
- Flake events (if any):
  - test file::name — fail 1/3, pass 2/3, pass 3/3 → quarantined as FND-### (P2)
- Skips/failures:
  - item + reason
- Traceability:
  - rows updated in TRACEABILITY.md (AC-### → test status)
- Follow-up:
  - next action or "none"
```

### UI/full verification report (for browser or end-to-end checks)

Use this shape when verification depends on a user-visible flow. Keep it
source-grounded and reviewable; do not rely on "I clicked around" summaries.

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

### QA coverage ledger (required before Review/Done for non-doc tasks)

Use this shape for frontend, backend, integration, or parity QA. Build the
control inventory before testing so every button, link, tab, menu, form field,
modal, API route, data branch, error state, and newly revealed nested control is
either tested or explicitly routed as a gap. For tasks claimed on or after
2026-06-24, `scripts/feature-reconcile` requires this task-scoped block before
Review/Done for non-doc tasks.

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
open a FINDINGS/TASKS entry. Do not mark `Result: PASS`.

### Worktree hygiene handoff manifest (informational — does NOT satisfy the hygiene gate)

`scripts/feature-reconcile` and the loop's Gate 0 both rely on the live
`scripts/worktree-hygiene` verdict, which scans the actual `git status`
output. They do **NOT** parse this manifest. So writing a manifest does
not let you pass a Done boundary with a dirty tree — for that, commit
a checkpoint (or revert).

The manifest is still useful as **human / next-agent context**: it
explains why the tree looked the way it did at a particular handoff,
which paths were intentionally in-flight, and what cleanup was planned.
Treat it like a structured note in EVIDENCE.md, not a gate-satisfier.

```text
## YYYY-MM-DD - Worktree handoff manifest: TASK-###

- Task: TASK-###
- Source: builder
- Hygiene verdict: DIRTY_OWNED (or DIRTY_MIXED if explicitly extended ownership)
- git status --short:
    M path/owned/file1.php
    M path/owned/file2.js
    ?? path/owned/newfile.md
- All paths in declared "Intended file ownership"? yes | no (cite which extend, why)
- Why no checkpoint commit: <one line — e.g. "in-progress; reviewer requested a single commit on Done">
- Next agent expectations:
  - reviewer (Mode: quality) / reviewer (Mode: adversarial) will see these exact paths in `git diff`
  - reviewer (Mode: qa) verification command was run against this dirty state on <date>
- Cleanup plan: <one line — e.g. "commit as TASK-### checkpoint on Review → Done flip">
```

`scripts/feature-reconcile` does not parse this manifest's contents; it
relies on `scripts/worktree-hygiene` for the live verdict. The manifest
exists so a human or new agent reading EVIDENCE.md understands why the
tree is dirty and what's planned.

### Adversarial review trail (reviewer (Mode: adversarial) writes these — required before Review/Done)

Every task claimed on or after 2026-06-24 needs an opposite-tool adversarial
entry before Review/Done. Codex-authored work uses `scripts/claude-adversary-review`;
Claude-authored work uses `scripts/adversary-review`. Same-tool review and
`routing-skip` do not satisfy the post-cutoff Review-stage gate. The shape
matters: `scripts/feature-reconcile` walks for
`## ... Adversarial review ... <task-id>` headings whose body contains
`Source: reviewer (Mode: adversarial)`.

```text
## YYYY-MM-DD - Adversarial review clear: TASK-###

- Task: TASK-###
- Source: reviewer (Mode: adversarial)
- Implementer tool: claude-code | codex-cli | codex-app
- Implementer model: <model-name>
- Reviewer tool: claude-code | codex-cli
- Reviewer model: <model-name>
- Reviewer mode: codex-backed | claude-backed | direct
- Review receipt: docs/features/<slug>/review-receipts/<timestamp>-TASK-###-adversary-<reviewer>-attempt-<n>.json
- Local transcript: docs/features/<slug>/adversary/<timestamp>.md (optional, gitignored)
- Categories examined: false-confidence, missed-edge, spec-loophole,
  hidden-coupling, negative-path, env-assumption, rollback-gap,
  stale-evidence, traceability-mismatch, tests-pass-behavior-wrong
- Hypotheses formed and rejected:
  - <category>: <hypothesis> — rejected because <reason with evidence>
- Result: clear — no P0/P1/P2 adversarial findings
- Next role: planner (Phase: plan) (to transition TASK-### to Done) | reviewer (Mode: acceptance) | release
```

```text
## YYYY-MM-DD - Adversarial review skipped by routing rule: TASK-###

- Task: TASK-###
- Source: reviewer (Mode: adversarial) (skipped)
- Routing rule: docs-only diff (no .php, .js, .ts, .py, .yml, .json, .sh, .sql, .html, .css outside docs/)
- Rationale: <one line — e.g. "Only docs/features/<slug>/EVIDENCE.md changed">
- Next role: planner (Phase: plan) (to transition TASK-### to Done)
```

### Review risk assessment (the `/feature-review` synthesis persists this)

A durable record of *why a diff was routed for the review depth it got*, so
a later session (or the owner) can see the risk call without re-deriving it,
and a post-hoc audit can check the routing was right. `/feature-review`
writes one of these per review pass. It is a recorded convention, not a
hard reconcile gate — but a Done-bound task with no risk-assessment entry is
a thin trail a reviewer should question.

```text
## YYYY-MM-DD - Review risk assessment: TASK-### (or diff <range>)

- Task / diff: TASK-### | <base>..HEAD
- Surface class: docs-only | test-only | migration | payment/auth/webhook/secrets | default
- Risk: low | medium | high
- Routing applied: <modes run — quality / qa / security / adversarial>
- Modes skipped (and why): <e.g. "security, qa — docs-only diff"> | none
- Cross-model adversarial: codex-backed | claude-backed | blocked (NEEDS_CROSS_MODEL_REVIEWER) | routing-skip (pre-2026-06-24)
- Severity budget at close: P0/P1 open: <n> | P2 active: <n>/5 | P3 collected: <n>
- Human review depth recommended: none (pipeline-cleared) | spot-check | full diff read
- Rationale: <one line — why this depth is right for this surface/risk>
```

For low-risk surfaces where every routed gate is green, "Human review depth
recommended: none" is a legitimate, recorded outcome — the pipeline did the
work. High-risk surfaces (payment / auth / migration / default-ON flag) must
never record `none`; they get full review by routing, and any unresolved
P0/P1 blocks Done regardless.

## Per-task-type artifact requirements (added in framework-v3 Phase 4)

When a task in TASKS.md declares `Type: <type>`, its EVIDENCE entry must
include the type-specific artifact rows below. `scripts/feature-reconcile`
walks Done tasks and asserts these rows exist. Tasks without a `Type:`
field default to the generic `feature` type and have no extra requirement.

## Pre-review self-audit evidence

Before builder hands a code-bearing task to Review or Done, record a
task-scoped self-audit. This is intentionally small: three plausible ways the
diff could still be wrong, plus one concrete local check or explicit skip
reason per item.

```text
## YYYY-MM-DD - Pre-review self-audit: TASK-###

- Task: TASK-###
- Source: builder
- Plausible miss 1: <concrete way this diff could still be wrong>
  - Check: <command/source read/manual check with result>
  - Result: pass | fail | skipped
- Plausible miss 2: <concrete way this diff could still be wrong>
  - Check: <command/source read/manual check with result>
  - Result: pass | fail | skipped
- Plausible miss 3: <concrete way this diff could still be wrong>
  - Skipped: <specific local reason if a concrete check is not feasible>
  - Result: skipped
```

Large-tier `scripts/feature-reconcile` requires the task block to contain
`Pre-review self-audit`, non-empty `Plausible miss 1/2/3:` descriptions, and
one non-empty `Check:`, `Skipped:`, or `Skip reason:` line inside each
plausible-miss stanza. `Type: docs` tasks are exempt.

### Type: bug — failing-then-passing repro (verbatim)

Per [[principle-reproduce-bugs-end-to-end]]: for a **user-facing** bug the
repro must exercise the surface the end user actually hits (browser flow,
API call as the client makes it, rendered route) — not only a unit test. A
unit-test-only repro can pass while the product behavior stays broken. Set
`Repro surface:` accordingly; use `unit-only` only when the bug has no
user-facing surface (and say why a unit test is the real surface). A
regression unit test is welcome *in addition to* the user-flow repro.

```text
## YYYY-MM-DD - Bug fix evidence: TASK-###

- Task: TASK-###
- Type: bug
- Repro surface: user-flow | unit-only (<why a unit test is the real surface>)
- Repro pre-fix:
  - Command/steps: <exact command, or user-flow steps + request, that reproduced the failure>
  - Output (verbatim, sanitized):
    ```
    <failing assertion / error / wrong value / wrong rendered state>
    ```
- Repro post-fix:
  - Command/steps: <same command or user-flow steps>
  - Output (verbatim, sanitized):
    ```
    <passing assertion / correct value / correct rendered state>
    ```
- Notes: <one line — e.g. "Single-line fix in path/foo.php:42 + regression test in tests/foo_test.php">
```

`scripts/feature-reconcile` looks for `Type: bug` plus both
`Repro pre-fix:` and `Repro post-fix:` markers tied to the task ID. For
user-facing bugs, `reviewer (Mode: qa)` / `reviewer (Mode: adversarial)`
also check that `Repro surface:` is `user-flow` (or a justified
`unit-only`).

### Type: perf — baseline / post / delta / trace

```text
## YYYY-MM-DD - Perf evidence: TASK-###

- Task: TASK-###
- Type: perf
- Baseline:
  - Metric: <e.g. "main-page LCP">
  - Value: <e.g. "3.2s p95">
  - Capture: <command or trace artifact path>
- Post-fix:
  - Metric: same metric
  - Value: <new value>
  - Capture: <command or trace artifact path>
- Delta: <e.g. "-1.4s p95 / -44%">
- Trace artifact: <path to before+after traces or "n/a">
```

Reconcile looks for `Type: perf` plus `Baseline:` and `Post-fix:` and
`Delta:` markers tied to the task ID.

### Type: ui — before / after screenshots

```text
## YYYY-MM-DD - UI evidence: TASK-###

- Task: TASK-###
- Type: ui
- Before: <path to before screenshot — PII-free, sanitized>
- After: <path to after screenshot — PII-free, sanitized>
- Visual diff: <pixel-diff value or "n/a — copy-only change">
- Surface: <browser+device or "desktop chrome 120">
```

Reconcile looks for `Type: ui` plus `Before:` and `After:` markers tied
to the task ID.

### Type: migration — backfill + rollback evidence

```text
## YYYY-MM-DD - Migration evidence: TASK-###

- Task: TASK-###
- Type: migration
- Backfill evidence:
  - Pre-migration row count: <N>
  - Post-migration row count: <M> (expected match or documented delta)
  - Sample row check (sanitized): <safe shape — no PII>
- Rollback evidence:
  - Inverse DDL path: <path to migration's down/rollback>
  - Rollback dry-run output: <command + exit code>
  - Staging rollback attempted: yes | no (and date if yes)
```

Reconcile looks for `Type: migration` plus both `Backfill evidence:` and
`Rollback evidence:` markers tied to the task ID.

## Archive policy

When this file exceeds ~300 lines, archive entries older than the current
milestone to `EVIDENCE_ARCHIVE.md` to keep `scripts/feature-context` output
focused on the active milestone.

## Entries

(append below)
