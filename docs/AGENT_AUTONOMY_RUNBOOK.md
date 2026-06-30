# Agent Autonomy Runbook

This is the thin operating layer for 60-120 minute autonomous capsules across
Codex and Claude Code. It sits on top of the existing SDLC harness; it does not
replace feature folders, task ownership, review gates, or human approval.

## North Star

Every capsule starts by restating:

- Goal
- Current task
- Spec anchors
- Hard invariants
- Ownership
- Stop rules

If an agent cannot name those items, it is not ready to start autonomous work.

## Campaign And Capsule Model

A campaign is a sequence of focused capsules. Codex acts as the engineering
lead: it rehydrates repo state, chooses the next safe task, generates and
validates the capsule, dispatches Codex or Claude Code work, verifies, records
evidence, and then repeats. Claude Code is a capable peer co-worker/reviewer,
not a low-context executor.

A capsule is one focused autonomous unit of work, usually 60-120 minutes. It
should end with a checkpoint that another agent can resume from without reading
chat history. A campaign may run many capsules consecutively until a real stop
condition appears.

Capsules are not long memory-dependent sessions. They should be small enough to
review, verify, and commit as one coherent change. Campaigns are long-running
because they chain small capsules, not because any one agent relies on a large
chat context.

## Agent Roles

- Codex: senior engineer, implementation agent, or supervisor/monitor where a
  practical engineering judgment pass is useful.
- Claude Code: scoped co-worker, implementation agent, reviewer, QA runner, or
  adversarial reviewer through the repo's Claude workflow.

The role must match the owned files and task. Do not ask an implementation agent
to approve its own risky work.

## Supervisor And Worker CLIs

For unattended parallel campaigns, the active Codex app session should normally
act as the supervisor, not as one of the long-running workers. It prepares
capsules, launches worker CLIs through sanctioned wrappers, monitors committed
diffs, runs gates, and stops on blockers.

The sanctioned implementation runners are:

```bash
scripts/codex-capsule-run <feature-slug> <task-id> <capsule.md>
scripts/claude-capsule-run <feature-slug> <task-id> <capsule.md>
```

These wrappers validate the capsule with `scripts/agent-capsule-check`, confirm
the capsule's worktree matches the current worktree, refuse dirty worktrees,
pin the configured model/effort, capture an artifact under
`${AGENT_CAPSULE_ARTIFACT_ROOT:-${TMPDIR:-/tmp}/sdlc-capsules}/<slug>` by
default, and check that changed paths stay inside the capsule's Owned files.
Set `AGENT_CAPSULE_ARTIFACT_DIR` only when a capsule intentionally needs an
exact artifact directory, such as tracked review evidence.

Raw `codex`, `codex exec`, or unwrapped `claude` implementation launches are
not the operating-system path. Use the wrappers so supervisor sessions can
reason from repeatable artifacts instead of ad hoc terminal transcripts.

## Worktree Isolation

Use a separate worktree per active capsule. Do not edit another agent's
worktree, and do not rely on uncommitted work from another worktree.

Review committed diffs or explicit patches only. If another worktree owns the
same files, stop and escalate the ownership conflict.

## Ownership Contract

Each capsule prompt must include:

```text
Goal:
Current task:
Agent:
Worktree:
Base commit:
Spec anchors:
Hard invariants:
Owned files:
Forbidden files:
Stop conditions:
Required checks:
Commit rule:
Checkpoint:
```

Ownership means the agent may edit only the owned files. Forbidden files are
explicit stop signs, not suggestions. The base commit is the comparison point
for review and rollback.

The commit rule must say whether the capsule may commit. Most capsules should
commit only after required checks pass and should never push.

## Durable Memory

Chat is not memory. Durable state lives in repo artifacts:

- `STATE.md`
- `TASKS.md`
- `EVIDENCE.md`
- `FINDINGS.md`
- `TRACEABILITY.md`
- research artifacts under `research/` when a feature defines them

At the end of a capsule, update the smallest relevant artifact so the next
agent can resume from repo state.

## Stop Conditions

Stop and hand off when any of these appear:

- P0/P1 finding, unresolved sanitizer failure, or `feature-reconcile` failure
- Ownership conflict or unowned dirty files
- Protected domain, credential, regulated-data, production, or launch-flag drift
- Reviewer unavailable when cross-model review is required
- Spec, task state, or acceptance criteria are unclear
- Required checks cannot run or fail without a clear local fix
- Tooling/auth is unavailable for a required gate

The correct stop is a short checkpoint with evidence and the exact next action.

## Verification Cadence

- Run targeted checks in every capsule.
- Run `scripts/feature-reconcile <slug>` every few capsules and before release
  handoff.
- Run full verification when the changed surface, task acceptance criteria, or
  release gate warrants it.
- Before commit, check status, diff hygiene, sanitizer output, and task/evidence
  freshness.

Prefer the smallest check that proves the capsule's change. Do not claim broad
feature readiness from a narrow test.

## Cross-Model Rule

- Claude-authored work gets Codex CLI adversarial review through
  `scripts/adversary-review`.
- Codex-authored work gets Claude Code CLI adversarial review through
  `scripts/claude-adversary-review`.
- Codex worker capsules use the pinned `SDLC_CODEX_WORKER_REQUIRED_MODEL` with
  `SDLC_CODEX_WORKER_REASONING`.
- Claude worker capsules use the pinned `SDLC_CLAUDE_WORKER_REQUIRED_MODEL`
  with `SDLC_CLAUDE_WORKER_EFFORT`.

If the required reviewer is unavailable, stop with a reviewer-unavailable
checkpoint. Same-tool review does not satisfy a cross-model gate.

## Human Escalation

Escalate only for:

- approval requirements
- ownership conflicts
- launch, production, protected-domain, credential, regulated-data, or sensitive-data risk
- reviewer disagreement on blocking severity
- spec ambiguity
- required tool/auth unavailable

Escalation should include the task, owned files, evidence path, and one concrete
decision needed.

## Prompt Templates

### Codex Implementation Capsule

```text
Goal:
Current task:
Agent: Codex implementation
Worktree:
Base commit:
Spec anchors:
- docs/features/<slug>/SPEC.md#...
- docs/features/<slug>/DESIGN.md#...
Hard invariants:
- preserve declared domain invariants
- do not cross protected workflow boundaries
- do not touch live external systems
- no production action
Owned files:
- path/to/file
Forbidden files:
- protected workflow controllers
- live integration submission code
- production config
Stop conditions:
- P0/P1 finding
- sanitizer failure
- feature-reconcile failure
- ownership conflict
- unclear spec/task state
Required checks:
- command
Commit rule:
- Commit only after required checks pass. Do NOT push.
Checkpoint:
- docs/features/<slug>/EVIDENCE.md

Start by restating the goal, task, spec anchors, invariants, ownership, and
stop rules. Then implement the smallest diff that satisfies the task.
```

### Claude Implementation Capsule

```text
Goal:
Current task:
Agent: Claude Code implementation
Worktree:
Base commit:
Spec anchors:
- docs/features/<slug>/SPEC.md#...
- docs/features/<slug>/TASKS.md#...
Hard invariants:
- preserve declared domain invariants
- do not cross protected workflow boundaries
- do not touch live external systems
- no production action
Owned files:
- path/to/file
Forbidden files:
- unowned worktrees
- production config
Stop conditions:
- P0/P1 finding
- sanitizer failure
- ownership conflict
- reviewer unavailable
Required checks:
- command
Commit rule:
- Commit only after required checks pass. Do NOT push.
Checkpoint:
- docs/features/<slug>/EVIDENCE.md

Use the repo SDLC files as source of truth. Do not rely on chat memory.
```

### Codex Supervisor/Monitor Capsule

```text
Goal:
Current task:
Agent: Codex supervisor/monitor
Worktree:
Base commit:
Spec anchors:
- docs/features/<slug>/STATE.md
- docs/features/<slug>/TASKS.md
- docs/features/<slug>/FINDINGS.md
Hard invariants:
- no protected workflow drift
- no live external-system traffic
- no production action
Owned files:
- docs/features/<slug>/EVIDENCE.md
- docs/features/<slug>/FINDINGS.md
Forbidden files:
- product code
- another agent's worktree
Stop conditions:
- unowned dirty files
- P0/P1 unresolved
- feature-reconcile failure
- unclear task ownership
Required checks:
- scripts/feature-reconcile <slug>
Commit rule:
- Do not commit unless explicitly instructed. Do NOT push.
Checkpoint:
- docs/features/<slug>/EVIDENCE.md

Inspect repo state and report whether the running capsule is still inside its
ownership, invariants, and verification contract.
```

### End-Of-Capsule Handoff

```text
Task:
Agent:
Worktree:
Base commit:
Head commit:
Files changed:
Checks run:
Results:
Evidence checkpoint:
Open findings:
Stop reason, if any:
Next action:
```

### Cross-Model Adversarial Review Instruction

```text
Review the committed diff for this task as an independent adversarial reviewer.
Assume normal tests and review may have missed something. Focus on:
false confidence, missed edge cases, spec loopholes, hidden coupling,
negative paths, environment assumptions, rollback gaps, stale evidence,
traceability mismatch, and tests that pass while behavior is wrong.

Return P0/P1 findings first. If there are no P0/P1 findings, say so clearly.
Do not approve launch, production, protected workflow, live integration, or sensitive-data
changes without the required human approval evidence.
```

## Pre-Launch Check

The harness should generate and validate capsule prompts before launching
implementation or review work:

```bash
scripts/agent-capsule-plan <feature-slug> [task-id] > /tmp/capsule.md
scripts/agent-capsule-check /tmp/capsule.md
```

For supervisor-managed worker launch, run exactly one of:

```bash
scripts/codex-capsule-run <feature-slug> <task-id> /tmp/capsule.md
scripts/claude-capsule-run <feature-slug> <task-id> /tmp/capsule.md
```

For normal `/feature-loop` usage, capsule generation and validation are an
internal preflight. Humans should not need to hand-author routine capsule
prompts.

The checker and runners catch missing operating context, obvious unsafe
authorizations, wrong worktrees, unavailable worker CLIs, wrong model/effort
configuration, and out-of-ownership writes. They do not replace review,
sanitizer checks, `feature-reconcile`, or the feature's verification plan.
