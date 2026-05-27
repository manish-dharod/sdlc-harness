# Feature Findings Ledger

Last updated: YYYY-MM-DD

## Status legend

- `Unverified` — new, not reproduced
- `Confirmed` — reproduced with file/line + reproduction step
- `False positive` — closer review rejects it (record rationale)
- `Fixed` — EVIDENCE.md records the fix
- `Blocked` — needs external evidence / approval; cite APPROVALS.md entry

## Severity rubric

- **P0** — production breakage, data loss, security/PCI/PII exposure, raw
  secrets in repo, auth/signature bypass
- **P1** — broken core flow, missing required mitigation (replay/idempotency,
  rate limit, validation), known-vuln dependency
- **P2** — quality or robustness gap; recoverable
- **P3** — style, naming, micro-clarity

## Severity budget (enforced by /feature-loop)

- **P0 / P1**: mandatory. Any unresolved P0/P1 blocks task `Done`, blocks
  `/feature-loop` from continuing past 1 fix iteration without escalation, and
  blocks release.
- **P2**: capped at 5 active. Beyond cap, new P2s defer to a cleanup task in
  the backlog instead of churning the loop.
- **P3**: collected for visibility only. Never blocks task `Done` and never
  triggers a fix-and-re-review cycle inside `/feature-loop`. Owner can opt in
  via `/feature-review --include-p3`.

This rule exists to defeat Reviewer-overfit oscillation. `reviewer (Mode: quality)` and
`security` may file as many P3 findings as they like; the loop just won't
spin on them.

## Finding format (append; reviewers/security/adversary write these)

```text
### FND-###: Short title

- Date: YYYY-MM-DD
- Source: reviewer (Mode: quality) | security | reviewer (Mode: qa) | reviewer (Mode: adversarial) | reviewer (Mode: acceptance) | human
- Severity: P0 | P1 | P2 | P3
- Status: Unverified | Confirmed | False positive | Fixed | Blocked
- Task: TASK-###                  # required when Source is reviewer (Mode: adversarial); optional otherwise
- AC IDs affected: AC-### (or `none`)
- Adversarial category: false-confidence | missed-edge | spec-loophole |
  hidden-coupling | negative-path | env-assumption | rollback-gap |
  stale-evidence | traceability-mismatch | tests-pass-behavior-wrong
                                  # required when Source is reviewer (Mode: adversarial); omit otherwise
- File/line: path:line
- Failure mode: what breaks / what exploits / what regresses / how the normal gates missed it
- Evidence: reproduction, grep, test that demonstrates
- Minimal fix: smallest change that resolves it
- Owner/next action: builder | planner (Phase: plan) | planner (Phase: design) | planner (Phase: intake) | blocked-on APV-###
```

P0/P1 findings from any Source — including `reviewer (Mode: adversarial)` — block task
Done and release. P2/P3 obey the severity budget above.

## Active findings

None.

## Closed / archived

When `FINDINGS.md` exceeds ~200 lines, archive `Fixed` and `False positive`
entries to `FINDINGS_ARCHIVE.md` to keep the active context compact. The
archive is git-tracked; nothing is lost.
