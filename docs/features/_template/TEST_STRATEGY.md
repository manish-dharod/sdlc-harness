# Test Strategy

Last updated: YYYY-MM-DD
Author: planner (Phase: design), refined by reviewer (Mode: qa)

Defines what level of test guards what behavior. `reviewer (Mode: qa)` uses this file to know
what verification *should* exist. `reviewer (Mode: acceptance)` uses it to verify every AC
has a corresponding test before release.

## Per-AC test matrix

Every AC ID in `SPEC.md` must have at least one test row. `reviewer (Mode: acceptance)` fails
the release if any AC has no test, or any test is `Skipped`.

| AC ID | Test level | Test file | Test name | Status |
|---|---|---|---|---|
| AC-001 | unit | path/to/spec | name | `Not started` / `Passing` / `Failing` / `Skipped` |
| AC-002 | integration | ... | ... | ... |
| AC-003 | e2e | ... | ... | ... |

## Per-NFR test plan

Every NFR needs a measurable check. If a check can't be automated, name the
manual procedure and the human who owns it.

| NFR ID | Measurement | Tool / command | Threshold | Owner |
|---|---|---|---|---|
| NFR-001 (perf) | p95 latency | wrk / k6 | <200ms | name |
| NFR-002 (a11y) | WCAG AA | axe-playwright | 0 violations | name |
| NFR-003 (i18n) | locale rendering | playwright per-locale | all locales render | name |

## Negative tests

Every entry in REQUIREMENTS.md "Edge cases and negative paths" must have a
negative test row. The test asserts the *failure* is graceful (correct error,
correct rollback, no data corruption, no secret leakage).

- <case> → <test file>:<test name>

## Flake policy

- A failing test is retried at most 3 times by `reviewer (Mode: qa)`.
- A test that fails-then-passes within those 3 retries is recorded as flaky in
  `FINDINGS.md` (severity P2 minimum) and quarantined in EVIDENCE.md.
- `builder` MUST NOT modify product code in response to a flaky test. Fix the
  test or quarantine; do not change behavior.

## What gets run when

| Mode | When | Includes |
|---|---|---|
| `fast` | builder, every change | lint + syntax + cheap unit + framework checks |
| `unit` | backend/logic changes | fast + unit + integration where cheap |
| `full` | UI / E2E / pre-release | unit + frontend build + E2E + NFR checks |

If this feature needs additions to `scripts/feature-verify`, reviewer (Mode: qa) creates a
domain script and wires it in.
