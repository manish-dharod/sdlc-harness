# SDLC pre-triage and per-item autonomy

Pre-triage is an upstream, read-only work-discovery lane. It may summarize
sanitized signals into a report and create a proposed `docs/backlog/` item. It
must never edit `TASKS.md`, claim work, change feature state, merge, or deploy.

## First loop: staging health

Run this locally on a schedule, where existing VPS/GitHub access remains on the
owner's machine. Do not place raw server-log credentials or customer-bearing
logs into a cloud routine. Collect bounded local snapshots, then run:

```bash
scripts/pretriage-health \
  --nginx-log /restricted/nginx-errors.snapshot \
  --pm2-log /restricted/pm2-errors.snapshot \
  --vqa-status /restricted/vqa-status.snapshot \
  --github-issue-state /restricted/visual-qa-issue.json \
  --report .sdlc/pretriage/latest.md \
  --write-backlog
scripts/backlog-index
```

The miner sanitizes inputs before parsing, retains aggregate counts only,
sanitizes each output before atomic write, and deduplicates repeated signal
fingerprints. Generated backlog items start `auto: false`.

## Per-item autonomy

The owner may set both `auto: true` and a narrow `auto_consumer` on one accepted
backlog item, or add both `auto` and `visual-qa-regression` labels to one open
GitHub issue. `scripts/auto-item-check` is the fail-closed pickup gate.

The first consumer is `/visual-qa-auto`. It creates a fresh external worktree,
reproduces the issue, uses normal feature/review/verification gates, and may
open a PR/comment. It never merges or deploys. Removing the marker revokes
future pickup. There is no global auto switch for backlog work.

## Learning and campaign telemetry

The project uses the `distill` CSI tier: weekly maintenance may prepare
sanitized proposals and lists them in the owner queue, but applies nothing.
`auto-structural` remains gated by APV-001.

Supervisor and merge-train modes must append the same RUNS.md telemetry as
`/feature-loop` through `scripts/campaign-ledger`, then call
`scripts/feature-learn` and `scripts/lib-capture.sh emit`.
