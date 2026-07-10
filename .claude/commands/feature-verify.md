---
description: Run feature verification (fast | unit | full)
argument-hint: <feature-slug> [fast|unit|full]
allowed-tools: Bash(scripts/feature-verify:*), Bash(scripts/example-verify:*)
---

Run `scripts/feature-verify $ARGUMENTS` and report the result.

If a mode isn't supplied, default to `fast`. The script accepts
`fast | unit | full`.

After a non-terminal verification result is known, capture the run as learning
input:

```bash
scripts/feature-learn <feature-slug> --run-kind feature-verify --status <pass|fail|skipped|blocked|unknown> --mode <fast|unit|full> --source auto:feature-verify
```

Use `skipped` only when there is no declared verification profile or the
command explicitly skipped for a documented reason. This capture is evidence
for future `/feature-reflect`; it must not auto-apply any learning.

For the final readiness run, use the **terminal sealing sequence** instead:

1. Capture all tracked learning, EVIDENCE, RUNS, review receipts, and other
   control-plane updates first.
2. Commit those tracked files.
3. Run `scripts/feature-verify <slug> full` from that clean exact HEAD.
4. Run `scripts/feature-ready <slug>` without another tracked write.

Do not run `feature-learn`, append evidence, or make any other tracked write
after the final full verification. A post-full capture would change HEAD or
dirty the tree and correctly invalidate the AC-017 readiness receipt.

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

Include the learning artifact path in the final report. For a terminal sealing
run, report the pre-seal capture path and say that no tracked write followed
the final full verification.
