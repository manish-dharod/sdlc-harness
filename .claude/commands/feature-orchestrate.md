---
description: Run the safe supervisor preflight for a feature and route the next agentic SDLC step
argument-hint: <feature-slug> [fast|unit|full]
---

You are running `/feature-orchestrate` for `$ARGUMENTS`.

This is the lightweight supervisor command for long-running agentic work. It
does not replace `/feature-loop`; it checks the harness, scans changed files,
loads feature state, and tells the operator which role should run next.

## Safety boundary

- No production deploys, launch flag flips, live DB mutation, real carrier
  traffic, DNS/firewall/panel changes, force-push, history reset, or
  `--no-verify`.
- No raw `codex` / `codex exec` invocation. The sanctioned Codex paths remain
  `scripts/adversary-review` and `scripts/security-review`.
- No permission bypass, email-to-agent daemon, remote-control default, or
  browser-cookie automation setup.
- Stop on sanitizer failures, unresolved P0/P1 findings, missing external
  evidence, unavailable required credentials, unowned dirty files, or any
  production-facing action.

## Step 0 - Harness health

Run:

```bash
scripts/sdlc-doctor --quiet
```

If it exits non-zero, stop and fix the harness wiring before dispatching any
worker.

## Step 1 - Sensitive-data tripwire on current diff

Run:

```bash
scripts/sanitize-check --changed
```

If it exits 4, stop. Do not send context to another model or start a worker
until the flagged file is cleaned.

## Step 2 - Feature gates

Run:

```bash
scripts/feature-context $1
scripts/feature-reconcile $1
scripts/feature-ready $1
```

Interpret `feature-ready` exit codes:

- `0` READY: route to `sg-release`, then stop.
- `2` NEEDS-APPROVAL: stop unless there is non-public, non-production prep
  still possible.
- `1` BLOCKED/not ready: continue to task routing.
- If the output contains a `reviewer-unavailable` route, do not infer a new
  build task. Run the printed `review-resume` / `review-narrow` command or
  stop on `NEEDS_CROSS_MODEL_REVIEWER` after retry budget exhaustion.

## Step 3 - Task routing

Run:

```bash
scripts/worktree-hygiene $1
scripts/feature-next-task $1
```

Route as follows:

- Clean tree + claimable task: invoke `sg-swe` on the task.
- Dirty owned `Claimed` task: resume `sg-swe` on the claimed task.
- Dirty owned `Review` task: run `/feature-review $1 <mode>`.
- No claimable task + `resume-review:<TASK>` route: run the printed
  sidecar `recommended_next_command`; keep the task in Review until a valid
  cross-model verdict lands.
- Dirty unowned or mixed: stop and ask for cleanup; do not let unrelated diff
  ride under the next task.
- No claimable task: invoke `sg-tech-lead` if DESIGN is Approved and planning
  is stale; otherwise route to `sg-product` or `sg-architect` based on the
  missing control-plane stage.

## Step 4 - Post-run learning capture

Before any optional notification, capture the orchestration run as a learning
source:

```bash
scripts/feature-learn $1 --run-kind feature-orchestrate --status <pass|fail|blocked|unknown> --mode ${2:-fast} --source docs/features/$1/EVIDENCE.md
```

Use `pass` when preflight routes cleanly to the next role, `fail` when a local
gate fails, `blocked` when a human/external dependency stops progress, and
`unknown` only when the routing state is ambiguous. This writes capture-only
input for `/feature-reflect`; it must not apply prompt, skill, script, or
template edits.

## Step 5 - Optional completion notification

If `SDLC_NOTIFY_COMMAND` is set in the environment, run it only after the
final report is written. Pass no secrets and no feature context. Keep it to a
local sound or notification command, for example:

```bash
SDLC_NOTIFY_COMMAND='afplay /System/Library/Sounds/Blow.aiff'
```

Notifications are optional. Do not add global permission bypasses to make them
work.

## Final report

Output:

```text
## Orchestration preflight for $1

- sdlc-doctor: pass | fail
- sanitize-check --changed: pass | fail
- feature-reconcile: pass | fail
- feature-ready exit: 0 | 1 | 2
- worktree hygiene: CLEAN | DIRTY_OWNED | DIRTY_NO_TASK | DIRTY_MIXED
- Next role: sg-product | sg-architect | sg-tech-lead | sg-swe | sg-reviewer/sg-security/sg-qa/sg-adversary | sg-release | stop
- Stop reason:
- Learning capture: docs/features/$1/learnings/<timestamp>.feature.learning.md
- Notification: skipped | ran SDLC_NOTIFY_COMMAND
```
