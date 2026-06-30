# /visual-qa

**Usage:** `/visual-qa [--mode=report|heal-seeded]`

Runs the optional visual QA orchestrator (`scripts/visual-qa-loop`) against the
project's target manifest. The default mode is discovery plus report only.

## What it does

1. Loads `tools/visual-qa/targets.mjs`.
2. For each target and viewport, captures screenshots, DOM, console errors,
   failed requests, broken images, and optional flow-step screenshots.
3. Runs deterministic capture-derived gates before any vision review.
4. Writes the capture bundle and `tools/visual-qa/vision-judge.md` prompt path
   into the report so a vision-capable reviewer can produce hypotheses.
5. Triages deterministic failures and confirmed vision hypotheses into
   must-fix findings and logged cosmetic findings.
6. Writes a structured report to `tools/visual-qa/reports/<runId>/`.

## Boundaries

- Report mode does not edit product code, commit, push, deploy, or call live
  production systems.
- Flow steps stop at `stop_boundaries` declared in the target manifest.
- Existing visual baselines, masks, thresholds, snapshots, and visual test
  expectations are forbidden edit surfaces for self-heal mode.
- Project-specific staging checks, authentication, and deployment decisions
  belong in the adopting repo's domain pack, not in this public command.

## Exit codes

| Exit code | Meaning |
|-----------|---------|
| `0` | All-clear, or all seeded fixtures passed. |
| `1` | Must-fix findings present, seeded fixture failure, or guard escalation. |
| `2` | Fatal error such as manifest load failure or unsupported mode. |

## Modules

- `tools/visual-qa/manifest.mjs` - target manifest loader and validator.
- `tools/visual-qa/capture.mjs` - Playwright capture engine.
- `tools/visual-qa/deterministic-checks.mjs` - capture-derived gate runner.
- `tools/visual-qa/triage.mjs` - dedupe, classify, confirm, and gate findings.
- `tools/visual-qa/finding.mjs` - finding schema and validator.
- `tools/visual-qa/heal-seeded.mjs` - disposable sandbox seeded-defect loop.
- `tools/visual-qa/vision-judge.md` - vision reviewer prompt.
- `tools/visual-qa/loop.mjs` - testable orchestrator core.
