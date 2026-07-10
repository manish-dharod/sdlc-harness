---
description: Run the safe supervisor preflight for a feature and route the next agentic SDLC step
argument-hint: <feature-slug> [fast|unit|full]
---

You are running `/feature-orchestrate` for `$ARGUMENTS`.

This is the lightweight supervisor command for long-running agentic work. It
does not replace `/feature-loop`; it checks the harness, scans changed files,
loads feature state, and tells the operator which role should run next.

## Safety boundary

- No production deploys, launch flag flips, live DB mutation, live customer
  traffic, force-push, history reset, or `--no-verify`.
- No raw `codex` / `codex exec` invocation from Claude. The sanctioned Codex
  paths remain `scripts/adversary-review`, `scripts/security-review`, and
  `scripts/codex-capsule-run`.
- For Codex-authored work, use `scripts/claude-adversary-review` for the
  opposite-tool adversarial pass.
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

- `0` READY: route to `release`, then stop.
- `2` NEEDS-APPROVAL: stop unless there is non-public, non-production prep
  still possible.
- `1` BLOCKED/not ready: continue to task routing.

## Step 3 - Task routing

Run:

```bash
scripts/worktree-hygiene $1
scripts/feature-next-task $1
```

If `feature-next-task` exits 5, this orchestration run is a hard stop:

- `feedback-required:INC-###` — report the current Experience surface and
  Ship target, record a human-feedback stop, and wait for the owner.
- `start-increment`, `advance-increment`, or `increment-complete` — route to
  `planner` with `Phase: plan` for the named transition; do not dispatch
  `builder`.

Never collapse exit 5 into the ordinary no-claimable exit 3 route.

Route as follows:

- Clean tree + claimable task: invoke `builder` on the task.
- Dirty owned `Claimed` task: resume `builder` on the claimed task.
- Dirty owned `Review` task: run `/feature-review $1 <mode>`.
- Dirty unowned or mixed: stop and ask for cleanup; do not let unrelated diff
  ride under the next task.
- No claimable task: invoke `planner` with `Phase: plan` if DESIGN is
  Approved and planning is stale; otherwise route to `planner` with
  `Phase: intake` or `Phase: design` based on the missing stage.

Before dispatching a long-running worker or wrapper session, generate and
validate an agent capsule:

```bash
scripts/agent-capsule-plan $1 <task-id> builder > /tmp/agent-capsule.md
scripts/agent-capsule-check /tmp/agent-capsule.md
```

Use only the sanctioned capsule runners when handing a capsule to another
tool:

```bash
scripts/codex-capsule-run $1 <task-id> /tmp/agent-capsule.md
scripts/claude-capsule-run $1 <task-id> /tmp/agent-capsule.md
```

Capture the completed preflight/routing run as learning input:

```bash
scripts/feature-learn $1 --run-kind feature-orchestrate --status <pass|fail|blocked|unknown> --mode ${2:-fast} --source auto:feature-orchestrate
scripts/lib-capture.sh emit --source feature-orchestrate --feature $1 --actor-tool claude-code --actor-model claude-opus-4-8 --outcome <pass|fail|blocked|no-progress> --stop-reason <STOP_REASON_CODE> --verify-mode ${2:-fast} --verify-exit <exit-code> --lesson-hint "feature-orchestrate preflight and routing completed"
```

If this run is the last tracked bookkeeping before readiness, commit the
capture with every other control-plane update, then use the terminal sealing
sequence: clean exact HEAD -> `feature-verify full` -> `feature-ready`, with no
tracked write afterward.

## Step 4 - Optional completion notification

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
- feature-next-task route: task | none | feedback-required:INC-### | advance/start/complete
- worktree hygiene: CLEAN | DIRTY_OWNED | DIRTY_NO_TASK | DIRTY_MIXED
- capsule preflight: pass | skipped | fail
- Learning capture: docs/features/$1/learnings/<timestamp>.feature.<nonce>.learning.md
- Next role: planner | builder | reviewer/security | release | stop
- Stop reason:
- Notification: skipped | ran SDLC_NOTIFY_COMMAND
```
