---
description: Record and close one supervisor-mode campaign iteration without bypassing feature-loop telemetry
argument-hint: <feature-slug> <campaign-id> <task-id> <mode>
---

Use this command when the active session supervises external worker capsules or
a merge train instead of running `/feature-loop` directly.

1. Preserve the normal feature-loop safety, reconcile, review, verification,
   readiness, and owner-feedback gates. Campaign mode changes orchestration,
   not policy.
2. Launch workers only through `scripts/codex-capsule-run` or
   `scripts/claude-capsule-run`; never raw worker CLI calls.
3. At every iteration end, call `scripts/campaign-ledger` with explicit in-band
   flags for campaign, iteration, mode, routing, task, file count, diff hash,
   verification, stop reason, and stop code.
4. Then run `scripts/feature-learn` and `scripts/lib-capture.sh emit` using the
   new RUNS.md entry as the source, exactly as `/feature-loop` does.
5. Never omit a ledger entry because work was coordinated outside the slash
   command. Never deploy, merge, or bypass cross-model review from this mode.

Example:

```bash
scripts/campaign-ledger "$1" --campaign "$2" --iteration 0 --mode "$4" \
  --routing "resume-claimed:$3" --task "$3" --files-changed 2 \
  --diff-hash abc123 --verification pass --stop-reason continue --stop-code NONE
```
