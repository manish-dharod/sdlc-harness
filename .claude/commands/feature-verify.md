---
description: Run feature verification (fast | unit | full)
argument-hint: <feature-slug> [fast|unit|full]
allowed-tools: Bash(scripts/feature-verify:*), Bash(scripts/example-verify:*)
---

Run `scripts/feature-verify $ARGUMENTS` and report the result.

If a mode isn't supplied, default to `fast`. The script accepts
`fast | unit | full`.

If the script reports `"no <mode> verification profile declared for <slug>"`,
this feature has no domain verification script yet. Hand off to `reviewer`
with `Mode: qa` — that mode is empowered to bootstrap one from
TEST_STRATEGY.md (write `scripts/<feature>-verify`, wire it in
`scripts/feature-verify`). Do not skip verification silently.

If verification fails:

1. Summarize which checks failed (with file/line where possible).
2. If a test failed once and passed on a manual rerun (≤3 retries), record
   the flake per TEST_STRATEGY.md flake policy and open a P2 finding via
   `reviewer` with `Mode: qa`.
3. Recommend one of:
   - **Fix in the current task** — small, scoped failure tied to the claimed work.
   - **Open a new task** — separate concern surfaced by the failure; add it
     to `docs/features/<slug>/TASKS.md` (Backlog) with Depends-on set.
   - **Block the current claim** — cannot proceed without external evidence,
     credentials, or approval; record a `Blocked` task / finding and open the
     corresponding APPROVALS.md entry with the right stop reason code.

Do not invent fixes for failures whose root cause isn't clear from the
output — open a finding and hand off to `builder` or `planner` (with
`Phase: plan`).
