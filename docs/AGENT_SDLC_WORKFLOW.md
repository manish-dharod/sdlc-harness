# Agent SDLC Workflow (sdlc-harness v1.1)

Last updated: 2026-05-27

This is the detailed operating guide for the SDLC harness.

If you are new, read this section first. The harness has three simple ideas:

1. **The repo is the memory.** Agents do not rely on chat history. They read
   and update files under `docs/features/<slug>/`.
2. **Each agent has one job.** Planning, building, review, security, QA,
   adversarial review, acceptance, and release readiness are separate roles.
3. **Scripts enforce the gates.** Shell scripts check task order, dirty files,
   evidence, findings, approvals, and release readiness.

The goal is not to make agents autonomous at all costs. The goal is to make
agent work resumable, reviewable, and safe enough that a human can trust the
state of the feature.

## Big Picture

```text
Owner spec
  -> approved design
  -> ordered tasks
  -> one task implemented
  -> parallel review
  -> fixes and evidence
  -> acceptance check
  -> release readiness verdict
```

If the spec changes, the change goes through `AMENDMENTS.md` and the plan is
updated. If something needs a human decision, it goes through `APPROVALS.md`.

## Vocabulary

```text
Feature folder    The memory for one feature: docs/features/<slug>/
Agent             A Claude Code subagent with a narrow job.
Slash command     A workflow entry point, such as /feature-loop.
Script            A deterministic check, such as scripts/feature-ready.
Evidence          Proof that something was run or checked.
Finding           A review, QA, security, or adversarial issue.
Approval          A human decision needed before risky work continues.
Release gate      A condition that must be true before release.
AC                Acceptance criterion: a specific thing the feature must do.
NFR               Non-functional requirement: speed, security, reliability, etc.
```

Do not use chat as the source of truth. Each session must update the repo
files that future sessions will read.

## Feature Folders: The Memory System

For small work, a feature may have one file. For medium work, it may have five.
For large or launch-gated work, the folder contains the full control plane:

```text
docs/features/<slug>/
  README.md
  SPEC.md             # owner request and acceptance criteria
  QUESTIONS.md        # open ambiguities
  REQUIREMENTS.md     # cleaned-up requirements
  DESIGN.md           # technical design; must be Approved before tasks open
  TEST_STRATEGY.md    # what will prove the feature works
  THREAT_MODEL.md     # security risks for large/sensitive work
  MIGRATION_PLAN.md   # schema/backfill plan, when needed
  ROLLBACK_PLAN.md    # how to back out safely
  STATE.md            # current feature status
  TASKS.md            # ordered tasks and dependencies
  TRACEABILITY.md     # requirement -> task -> test/evidence
  FINDINGS.md         # review/QA/security/adversarial issues
  DECISIONS.md        # durable decisions
  EVIDENCE.md         # commands run and proof collected
  APPROVALS.md        # human approvals
  RELEASE_GATES.md    # release checklist
  AMENDMENTS.md       # spec changes
  RUNS.md             # loop iteration log
```

These files are intentionally plain Markdown. They are easy to read, diff,
commit, and review.

## Agents

Agents are defined in `.claude/agents/` and invoked through Claude Code's Task
tool. The current harness has five agent files. Two of them use a prompt flag
to choose the exact job.

| Agent | Flag | Role |
|---|---|---|
| `planner` | `Phase: intake` | Understand the request and extract requirements. |
| `planner` | `Phase: design` | Write the design and test/security/rollback plans. |
| `planner` | `Phase: plan` | Break the design into ordered tasks. |
| `builder` | none | Implement one scoped task and record evidence. |
| `reviewer` | `Mode: quality` | Review the diff for correctness and design fit. |
| `reviewer` | `Mode: qa` | Run verification and update test evidence. |
| `reviewer` | `Mode: adversarial` | Look for hidden ways the change can still be wrong. |
| `reviewer` | `Mode: acceptance` | Check the final feature against the original requirements. |
| `security` | none | Review security and launch-gate risk. |
| `release` | (none) | Read-only release-readiness verdict via `scripts/feature-ready`. |

Older v1.0 installs had ten separate role files. v1.1 keeps the same logical
jobs but collapses them into five agent files.

## Parallelism

Parallelism is simple: Claude Code can start multiple Task-tool agents in one
message. `/feature-review` uses that to run independent review passes at the
same time:

```text
reviewer (Mode: quality)
reviewer (Mode: qa)
reviewer (Mode: adversarial)
security
```

Each pass looks at the same work but has a different purpose. Security can be
skipped for docs-only changes. QA can be skipped for docs-only feature-state
updates. Adversarial review should still leave a clear or skipped-by-routing
trail so the audit record is not missing.

If you imported the framework before v1.1, see
[docs/MIGRATING_v1.0_to_v1.1.md](MIGRATING_v1.0_to_v1.1.md) for the
rename recipe.

## Commands Humans Usually Run

Slash commands are the human-friendly entry points:

- `/feature-init <slug> [--tier small|medium|large] [--spec path]` -
  create the feature folder and run intake/design.
- `/feature-context <slug>` - print the current feature state.
- `/feature-next-task <slug>` - find the next task that can be claimed.
- `/feature-claim <slug>` - claim a task for the builder.
- `/feature-amend <slug>` - record a spec change and its impact.
- `/feature-review <slug> [unit|full] [--include-p3]` - run parallel review.
- `/feature-loop <slug> [fast|unit|full]` - run one full build/review loop.
- `/feature-verify <slug> [fast|unit|full]` - run verification.
- `/feature-reconcile <slug>` - check that the feature files agree.
- `/feature-ready <slug>` - return READY, BLOCKED, or NEEDS-APPROVAL.
- `/feature-reflect <slug>` - learn from repeated issues and route lessons
  into durable structure.
- `/feature-why <slug> "<question>"` - gather evidence before opening an
  ambiguity question.
- `/feature-arena <slug> <task-id> [N]` - run several candidate
  implementations for a high-risk task.
- `/<domain>-context`, `/<domain>-verify [mode]` - optional project-specific
  shortcuts.

For recurring iteration, use:

```text
/loop /feature-loop <slug>
```

## Scripts The Commands Rely On

Scripts are the deterministic layer. They are useful from Claude Code, a
terminal, or CI.

```bash
scripts/feature-init <slug> [--tier small|medium|large] [--spec path/to/spec.md]
scripts/feature-context <slug>
scripts/feature-next-task <slug>         # 0 task printed / 3 none claimable / 1 error / 4 worktree-dirty refusal
scripts/feature-verify <slug> fast|unit|full
scripts/feature-ready <slug>             # 0 READY / 1 BLOCKED / 2 NEEDS-APPROVAL
scripts/feature-reconcile <slug>         # 0 consistent / 1 drift (includes adversarial-trail + worktree-hygiene checks)
scripts/worktree-hygiene <slug> [task-id] [--strict]  # 0 CLEAN/DIRTY_OWNED / 1 DIRTY_NO_TASK / 2 DIRTY_MIXED
scripts/preflight-credentials <slug>      # runs DESIGN.md-declared external API credential checks
scripts/adversary-review <slug> [task-id] [review|review-strict]  # sanctioned Codex CLI wrapper for cross-model adversarial review
scripts/security-review  <slug> [task-id] [review|review-strict]  # sanctioned Codex CLI wrapper for cross-model SECURITY review (pulls THREAT_MODEL/MIGRATION_PLAN/APPROVALS/RELEASE_GATES). Same exit codes: 0 / 2 (codex unavailable) / 3 (usage) / 4 (sanitization tripwire).
scripts/feature-reflect <slug>
scripts/feature-why <slug> "<question>"
scripts/feature-arena <slug> <task-id> [N] [--force]
scripts/log-decision <slug> <decision> <rationale>
scripts/test-framework-v3
scripts/example-context
scripts/example-verify fast|unit|full
```

The slash commands wrap these scripts, but the scripts are the cross-agent
contract. Any agent or CI job can call them and get the same result.

Note: `scripts/feature-loop` was deleted. Use the `/feature-loop` slash
command instead.

## Safety Layer

- `.claude/settings.json` defines allowed and denied tool patterns.
- `.claude/hooks/guard-bash.sh` blocks destructive commands such as force
  pushes, hard resets, `--no-verify`, dangerous deletes, raw `codex`, and the
  deleted `scripts/feature-loop` entry point.
- `scripts/adversary-review` and `scripts/security-review` are the sanctioned
  Codex paths. They sanitize the assembled context before anything leaves the
  machine.

## Step-by-Step Feature Lifecycle

This is what normally happens for one feature. The commands automate much of
it, but the steps are useful to understand.

### 1. Intake — `/feature-init` + `planner (Phase: intake)`

For a brand-new feature:

```text
/feature-init <slug> --tier medium --spec path/to/spec.md
```

Or `cp -R docs/features/_template docs/features/<slug>` manually, then
invoke `planner` with `Phase: intake` to extract AC/NFR IDs from the
pasted SPEC.md.

Output lives in `SPEC.md` (AC and NFR sections), `REQUIREMENTS.md`, and
`QUESTIONS.md`. **No task can move past Backlog while any question with
`Blocks: tasks` is `Open`.**

### 2. Design — `planner (Phase: design)`

```text
Use planner with Phase: design for feature <slug>. SPEC.md has AC/NFR IDs
populated and QUESTIONS.md is clear. Produce DESIGN.md (Draft → Approved
after self-review), TEST_STRATEGY.md, THREAT_MODEL.md (required for
payment/auth/webhook surface), MIGRATION_PLAN.md (if DDL/backfill),
ROLLBACK_PLAN.md. Do not write tasks.
```

DESIGN.md status must be `Approved` before `planner (Phase: plan)` can
move any task from `Backlog` to `Open`.

### 3. Plan — `planner (Phase: plan)`

```text
Use planner with Phase: plan for feature <slug>. DESIGN.md is Approved.
Refine TASKS.md into DAG-aware tasks with depends-on edges, AC IDs, file
ownership, acceptance criteria, verification commands. Open APPROVALS
entries for human signoffs required. Do not edit product code.
```

Output belongs in `TASKS.md`, `STATE.md`, `DECISIONS.md`, `APPROVALS.md`,
`RELEASE_GATES.md`.

### 4. Implement — `builder`

If invoking builder **directly** (outside the loop), first check the
worktree hygiene routing suggestion:

```text
scripts/worktree-hygiene <slug>
```

Then dispatch based on `Routing suggestion:`:

- `new-task` → `scripts/feature-next-task <slug>` to pick a claimable
  task ID, then invoke builder to claim and implement it.
- `resume-claimed:<id>` → invoke builder with the existing claim (do NOT
  call `scripts/feature-next-task` — it uses `--strict` and will refuse).
- `resume-review:<id>` → skip implementation; the diff is ready for
  parallel review (step 5).
- `halt-ambiguous` or `halt (DIRTY_WORKTREE)` → resolve hygiene first
  (commit checkpoint / revert / claim the right task), then re-check.

Sample direct invocation when routing is `new-task`:

```text
Use the builder subagent for feature <slug>. Worktree hygiene reports
Routing suggestion: new-task. Run scripts/feature-next-task <slug> to
pick a claimable task (DAG-respecting), claim it, implement the
smallest scoped change inside declared file ownership, run the
relevant verification mode, update EVIDENCE.md and TRACEABILITY.md.
Transition Claimed → Review (not directly to Done).
```

The `/feature-loop` slash command automates this routing — humans
typically just run that.

### 5. Review — parallel (`reviewer` ×3 modes + `security`)

Use the `/feature-review <slug>` slash command, which spawns `reviewer`
three times (with `Mode: quality | qa | adversarial`) plus `security` in
parallel, with risk-routing. Or manually invoke individual roles.
Severity budgets apply: P0/P1 mandatory, P2 capped at 5, P3 collected.

Routing summary:

- Always invoke `reviewer (Mode: quality)` and `reviewer (Mode: adversarial)` on a code-bearing diff.
- Skip `security` for docs-only diffs (no `.php`/`.js`/`.ts`/`.py`/`.yml`/`.json` changes outside `docs/`).
- Skip `reviewer (Mode: qa)` for diffs that touch only `docs/features/<slug>/` files.
- For docs-only diffs, `reviewer (Mode: adversarial)` runs in lightweight skip mode and records an "Adversarial review skipped by routing rule" EVIDENCE entry. Never silently omit the adversarial trail — `scripts/feature-reconcile` flags its absence on a Done task as drift.
- For migrations or payment/auth/webhook surfaces, brief `reviewer (Mode: adversarial)` to use `review-strict` for rollback-gap and env-assumption emphasis.

After P0/P1 fix iterations (`builder` responds to findings), the fix diff
is a fresh change set and needs an adversarial re-check — the prior
"Adversarial review clear" was for the pre-fix diff, not this one.

Findings move through:

```text
Unverified → Confirmed → Fixed
Unverified → False positive
Confirmed → Blocked (open APPROVALS entry with stop reason code)
```

Adversarial review is **required before any code-bearing task can transition
to Done**. The acceptable trail shapes are:

1. EVIDENCE.md entry `## YYYY-MM-DD - Adversarial review clear: TASK-###` with `- Source: reviewer (Mode: adversarial)`.
2. EVIDENCE.md entry `## YYYY-MM-DD - Adversarial review skipped by routing rule: TASK-###` with `- Source: reviewer (Mode: adversarial, skipped)`.
3. FINDINGS.md entries with `- Source: reviewer (Mode: adversarial)` and `- Task: TASK-###` where every P0/P1 is `Fixed` or `False positive`.

`scripts/feature-reconcile` checks all Done tasks in large-tier features
against this and exits non-zero on drift. Historical Done tasks that predate
the adversarial gate (cutoff: 2026-05-24) can be grandfathered via
`docs/features/<slug>/.adversarial-exempt`.

### 6. Acceptance — `reviewer (Mode: acceptance)`

Before release:

```text
Use reviewer with Mode: acceptance for feature <slug>. Walk TRACEABILITY.md;
verify every AC has a passing test and every NFR has a measured passing
result. Check DESIGN contract drift. Refuse to pass if any row is
incomplete.
```

### 7. Release readiness — `release`

```text
Use release for feature <slug>. Run scripts/feature-ready <slug>. Read
STATE/TASKS/FINDINGS/DECISIONS/EVIDENCE/TRACEABILITY/APPROVALS/RELEASE_GATES.
Report READY / BLOCKED / NEEDS-APPROVAL with named blockers and approval
stop reason codes.
```

Release blocks on:

- Any `scripts/feature-ready` failure
- Unresolved P0/P1 findings
- Missing or stale evidence
- Failing full verification
- TRACEABILITY gaps (AC with no tests, NFR unmeasured)
- DESIGN.md not Approved
- Secrets or generated artifacts in the diff
- Production deploy / live DB / credential / launch-flag actions without explicit approval
- Any APPROVALS entry with `waiting_on_human: true`

## Automated local loop

Use `/feature-loop <slug> [fast|unit|full]` for one autonomous SDLC iteration.
The slash command orchestrates with **five pre-iteration gates**:

0. **Worktree hygiene + active-task routing** — `scripts/worktree-hygiene` reports the verdict AND prints a `Routing suggestion` the loop honors:

   | Verdict | Active task(s) | Routing | Step-3 behavior |
   |---|---|---|---|
   | `CLEAN` | none | `new-task` | run `scripts/feature-next-task`; if a task returns, invoke `builder` to claim it |
   | `DIRTY_OWNED` | one `Claimed` | `resume-claimed:<id>` | invoke `builder` on the existing claim — do NOT call `scripts/feature-next-task` (it uses `--strict` and would refuse) |
   | `DIRTY_OWNED` | one `Review` | `resume-review:<id>` | skip implementation; proceed straight to step 4 (parallel review) — the diff IS the review surface |
   | `DIRTY_OWNED` | multiple active | `halt-ambiguous` | unusual; halt and ask human which to resume first |
   | `DIRTY_NO_TASK` | n/a | `halt (DIRTY_WORKTREE)` | dirty paths exist but no Claimed/Review owns them — halt with stop reason `DIRTY_WORKTREE` |
   | `DIRTY_MIXED` | any | `halt (DIRTY_WORKTREE)` | dirty paths span outside the active task's ownership — same halt |

1. **Reconcile** — `scripts/feature-reconcile` must pass (includes adversarial-trail + worktree-hygiene checks).
2. **Iteration budget** — read RUNS.md and STATE.md "Loop budget"; halt if exhausted.
3. **Oscillation detection** — halt if same task / same diff hash / oscillating finding.
4. **Readiness** — `scripts/feature-ready`; if READY, invoke `release` and stop.

Then it runs the iteration with the routing-aware step 3:

```
rehydrate
  → plan if needed (planner (Phase: plan) only when routing=new-task AND no claimable)
  → step 3 BRANCH ON ROUTING:
        new-task          → claim + builder implement
        resume-claimed:ID → builder continues the in-flight implementation
        resume-review:ID  → skip implementation, fall through to parallel review
  → parallel review (reviewer Mode: quality + Mode: qa + Mode: adversarial + security)
  → targeted fix of P0/P1 (builder; new fix diff)
  → adversarial re-check on the fix diff (reviewer Mode: adversarial)
  → verify (scripts/feature-verify)
  → acceptance check (reviewer Mode: acceptance, when AC scope is complete)
  → readiness check + release if READY
  → state hygiene
  → append RUN-### entry to RUNS.md (with routing decision)
```

This gate-0 routing is what prevents the loop from trying to claim a new
task while one is mid-flight — which `scripts/feature-next-task --strict`
explicitly refuses. The slash command file at
`.claude/commands/feature-loop.md` is the canonical step-by-step; this
doc is the durable narrative summary.

For recurring execution, layer the `/loop` skill on top:

```text
/loop /feature-loop example-feature
```

`/loop` paces itself between iterations and can be stopped at any time. The
budget + oscillation gates halt it cleanly when the feature converges or
stalls.

## Compounding loops

These commands are part of the current harness shape and are deliberately
separate from the normal build/review loop.

### `/feature-why`

Use before turning an ambiguity into a blocking question. The script assembles
a sanitized evidence bundle for the question, then the orchestrator can inspect
source control, repo docs, issues/PRs, and any configured knowledge connectors.
The output should distinguish "not found" from "not checked" and cite evidence
before adding or closing a QUESTIONS row.

### `/feature-reflect`

Use after a meaningful run or feature slice. It packages SPEC/DESIGN/TASKS/
FINDINGS/EVIDENCE/TRACEABILITY/DECISIONS and asks reviewers to identify
recurring process lessons. Accepted lessons that can be enforced as scripts,
hooks, tests, templates, or backlog tasks should be routed there instead of
growing the prompt.

### `/feature-arena`

Use sparingly for high-risk implementation tasks where one attempt could lock
in the wrong architecture. `scripts/feature-arena` refuses unless the task
matches `SDLC_ARENA_ELIGIBILITY_REGEX` or an explicit force override is used.
It creates candidate work dirs, runs N candidate implementations, judges them,
grafts the best ideas into one result, and sends that result through the normal
review and verification chain.

### Local-only safety (built in)

The `/feature-loop` prompt, the subagent prompts, and the bash guard hook
collectively enforce:

- No production deploys, DNS / firewall / panel changes, live DB mutation.
- No launch flag flips that enable production behavior.
- No live external submission or live external traffic.
- No raw PAN, CVV, expiry, credentials, tokens, auth headers, passphrases, or webhook secrets in any file, log, or commit.
- No force-push, history reset, `--no-verify`, broad deletes, or destructive git operations.
- Stop and open an `APPROVALS.md` entry (with stop reason code) when external evidence, credentials, staging access, live external docs, compliance signoff, or human approval is required.

## Status state machines

- **Tasks** (`TASKS.md`): `Backlog → Open → Claimed → Blocked/Review → Done`.
  - `Backlog → Open` requires: Approved DESIGN; zero blocking QUESTIONS; all Depends-on Done.
  - `Open → Claimed` requires: `scripts/feature-next-task` returned this ID (DAG-satisfied).
  - `Claimed → Review` or `Done` requires: TRACEABILITY updated, EVIDENCE recorded.
- **Findings** (`FINDINGS.md`): `Unverified → Confirmed → Fixed | False positive | Blocked`.
- **Design** (`DESIGN.md`): `Draft → Approved`. Only `Approved` unblocks Backlog→Open.
- **Approvals** (`APPROVALS.md`): `Requested → Approved | Rejected | Withdrawn`. Each entry has `waiting_on_human: true/false` + stop reason code.

A task is **Done** only when all 18 files are current for that task, the
closest `feature-verify` mode passes (or remaining failures are explicitly
documented as `Blocked` with APPROVALS pointers), AND `reviewer (Mode: adversarial)` has
recorded a valid adversarial trail (clear / skipped-by-routing / findings
with all P0/P1 resolved). `scripts/feature-reconcile` enforces the
adversarial-trail requirement for Done tasks in large-tier features.

## Severity budget

- **P0/P1** — mandatory. Block task Done and release. Applies to findings from any source: `reviewer` (any mode) and `security`. An adversarial-mode P0/P1 blocks identically to one from any other source.
- **P2** — capped at 5 active per feature. Beyond cap, append to cleanup task.
- **P3** — collected for visibility. Never blocks Done; never triggers a fix iteration. Owner opts in via `/feature-review --include-p3`.

## Stop reason codes

When `/feature-loop` halts on a human-required block, the RUNS.md entry and
the iteration report carry one of:

`NONE | NEEDS_HUMAN_APPROVAL | NEEDS_EXTERNAL_EVIDENCE | NEEDS_CREDENTIAL_ROTATION | NEEDS_COMPLIANCE_SIGNOFF | NEEDS_VENDOR_DOC | NEEDS_STAGING_ACCESS | OSCILLATION_DETECTED | ITERATION_BUDGET_EXHAUSTED | NO_PROGRESS_3X | DIRTY_WORKTREE | ERROR`

## Example feature

```bash
scripts/feature-context example-feature
```

Adopter repos should use their own `docs/features/<slug>/` state as the source
of truth. The framework templates under `docs/features/_template*` are only
starting points.

## Phase 2 (owner decision required)

The following are **designed for but not yet built**. They turn the framework
from "human-supervised SDLC autopilot" into a true "spec-in / deploy-ready-out"
runtime:

1. **Claude Agent SDK orchestrator** with `maxTurns` + `maxBudgetUsd`. The
   slash-command loop above has iteration and oscillation gates but no hard
   cost ceiling. An SDK runner can enforce one.
2. **Sandboxed network gateway** — outbound HTTP whitelist (e.g., vendor
   sandboxes only). Lets `reviewer (Mode: qa)` run real integration tests without
   compromising production safety.
3. **Staging deploy + smoke automation** — auto-deploy a green PR to staging,
   run smoke, attach evidence to APPROVALS. Closes the Mock Trap.
4. **Out-of-band notification** when the loop halts on `NEEDS_HUMAN_APPROVAL`.

Each requires owner sign-off (security, ops) before implementation. Until
then, the framework reliably stops at the staging boundary and reports the
exact stop reason code — which is the correct behavior for a regulated or
launch-gated codebase.

## Legacy / deprecated

- `~/.codex/skills/sg-*` (Codex CLI skill files outside the repo) — kept for reference, no longer authoritative.
- `scripts/feature-loop` — **deleted in v2** (was the Codex CLI Ralph loop).
- Any `codex exec ...` invocation — blocked by the hook.

## Future orchestration (optional)

CrewAI, the Claude Agent SDK, or similar orchestrators may layer on top of
the same repo files. They must read and write `docs/features/<slug>/*.md` and
`docs/features/<project-feature>/*.md`. They must not become a parallel source of truth.
