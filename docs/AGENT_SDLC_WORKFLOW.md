# Agent SDLC Workflow (sdlc-harness v1.1)

> **Level L3 · lifecycle & mechanics · ~30 min.** The detailed operating guide.
> Up one level: [Overview](AGENT_SDLC_OVERVIEW.md). Down one level:
> [reference/](reference/). Map of all docs: [START_HERE](START_HERE.md).
> For a shorter plain-language guide, read [the Handbook](AGENT_SDLC_HANDBOOK.md).

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
  -> smallest shippable increment
  -> current-increment tasks
  -> one task implemented
  -> parallel review
  -> tryable proof and owner feedback
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
Increment         A coherent, tryable user journey that stops for owner feedback.
Finding           A review, QA, security, or adversarial issue.
Approval          A human decision needed before risky work continues.
Release gate      A condition that must be true before release.
AC                Acceptance criterion: a specific thing the feature must do.
NFR               Non-functional requirement: speed, security, reliability, etc.
```

Do not use chat as the source of truth. Each session must update the repo
files that future sessions will read.

## Feature Folders: The Memory System

For small work, a feature may have one file. New medium work has six. New
large or launch-gated work has the 20-file control plane; historical
marker-free features retain their previous shape:

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
  INCREMENTS.md       # experiential slices, proof, and owner verdicts
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
- `/feature-intake <slug> [context-path-or-url ...]` - sanitize messy owner
  context, preserve an intake bundle, and plan before implementation.
- `/feature-context <slug>` - print the current feature state.
- `/feature-next-task <slug>` - find the next current-increment task, or stop
  with exit 5 for owner feedback/planner transition.
- `/feature-claim <slug>` - claim a task for the builder.
- `/feature-amend <slug>` - record a spec change and its impact.
- `/feature-orchestrate <slug> [fast|unit|full]` - run the supervisor
  preflight (`sdlc-doctor`, sanitizer, reconcile, readiness, routing) before
  long-running worker/reviewer dispatch.
- `/feature-review <slug> [unit|full] [--include-p3]` - run parallel review.
- `/feature-loop <slug> [fast|unit|full]` - run one full build/review loop.
- `/feature-verify <slug> [fast|unit|full]` - run verification.
- `/feature-reconcile <slug>` - check that the feature files agree.
- `/feature-ready <slug>` - return READY, BLOCKED, or NEEDS-APPROVAL.
- `/feature-learn <slug> [task-id] ...` - capture a bounded, sanitized
  post-run learning artifact without auto-applying it.
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
scripts/feature-increment check|current|route|ready|final <slug> [INC-###]
scripts/feature-next-task <slug>         # 0 task / 3 none / 5 feedback-transition stop / 1 error / 4 dirty refusal
scripts/feature-verify <slug> fast|unit|full
scripts/feature-verify --all-active fast|unit|full
scripts/feature-ready <slug>             # 0 READY / 1 BLOCKED / 2 NEEDS-APPROVAL
scripts/feature-reconcile <slug>         # 0 consistent / 1 drift (includes adversarial-trail + worktree-hygiene checks)
scripts/worktree-hygiene <slug> [task-id] [--strict]  # 0 CLEAN/DIRTY_OWNED / 1 DIRTY_NO_TASK / 2 DIRTY_MIXED
scripts/worktree-add-external <name> [branch-or-commit]
scripts/sdlc-doctor [--quiet] [--offline] # read-only; offline skips network-capable probes
scripts/sanitize-check --changed|--staged|<file...>  # file-mode sanitizer scan
scripts/preflight-credentials <slug>      # runs declared external API and local capability checks
scripts/adversary-review <slug> [task-id] [review|review-strict|review-resume|review-narrow] [base-assertion] <implementer-model>
scripts/claude-adversary-review <slug> [task-id] [review|review-strict|review-resume|review-narrow] [base-assertion] <implementer-model>
scripts/security-review  <slug> [task-id] [review|review-strict|review-resume|review-narrow] [base-assertion] <implementer-model>
scripts/review-attempt validate-receipt <receipt.json> --require-scoped
scripts/agent-capsule-plan <slug> <task-id> <role>
scripts/agent-capsule-check <capsule-file>
scripts/codex-capsule-run <slug> <task-id> <capsule-file>
scripts/claude-capsule-run <slug> <task-id> <capsule-file>
scripts/backlog-index [--check]
scripts/feature-learn <slug> [task-id] --run-kind <kind> --status <status> --mode <mode> --source <path|auto:run-kind>
scripts/feature-reflect <slug>
scripts/feature-why <slug> "<question>"
scripts/feature-arena <slug> <task-id> [N] [--force]
scripts/log-decision <slug> <decision> <rationale>
scripts/test-framework-v3
scripts/test-feature-readiness
scripts/test-feature-verify-locking
scripts/test-feature-verify-fanout
scripts/example-context
scripts/example-verify fast|unit|full
```

The slash commands wrap these scripts, but the scripts are the cross-agent
contract. Any agent or CI job can call them and get the same result.

`feature-verify --all-active` owns one Git-common-directory lock across linked
worktrees. Nested sweeps fail clearly. A thin profile may opt into
invocation-local result reuse with exactly one
`# sdlc-feature-verify-equivalence: <stable-key>` marker; unmarked or
differently keyed profiles never share, failures remain red, and every feature
still writes its own `.last-verify.json`.

For feedback-gated features, `Owner feedback evidence` is an exact-record
pointer, not a generic file citation. It must resolve to the Markdown anchor of
the latest `Owner feedback: INC-### round N` record for that same increment.
Missing, unrelated, or stale-round anchors fail
`scripts/feature-increment check`.

Note: `scripts/feature-loop` was deleted. Use the `/feature-loop` slash
command instead.

### Plan-first intake and orchestration preflight

The harness supports a narrow, practical subset of agentic-engineering
workflow improvements:

- `/feature-intake` captures raw owner context only after sanitizer checks and
  turns it into SPEC/REQUIREMENTS/QUESTIONS/DESIGN/TASKS updates.
- `scripts/sanitize-check` is the file-mode wrapper for
  `scripts/lib-sanitize.sh`; use it for local transcripts, terminal logs, and
  changed files before sending context to another model.
- `/feature-orchestrate` is a supervisor preflight for long-running agentic
  work. It checks harness health, changed-file sanitization, feature drift,
  readiness, worktree hygiene, and next-task routing before any worker runs.
- Agent capsules can bound long-running or parallel worker prompts with task
  context, ownership, invariants, allowed commands, forbidden actions, and stop
  conditions.
- `scripts/worktree-add-external` creates disposable or parallel agent
  worktrees only under a configured `SDLC_WORKTREE_ROOT`; the bash guard blocks
  raw `git worktree add` targets outside that root.
- `docs/backlog/` captures proposed enhancements and TBDs that are not yet
  live feature tasks; `scripts/backlog-index` regenerates the cheap recall
  index.
- Optional completion notification is controlled only by
  `SDLC_NOTIFY_COMMAND`; it must be local, context-free, and non-blocking.
- Local maintenance notification is a separate, per-run opt-in:
  `scripts/sdlc-maintain --notify-hook /absolute/executable`. The hook is
  validated before any maintenance step, the report is atomically published
  before invocation, and the executable runs with zero arguments and an empty
  inherited environment. Hook failure is reported but never overrides the
  deterministic maintenance exit result.

The harness deliberately does not install permission bypasses,
email-to-agent daemons, remote-control defaults, or browser-cookie automation.
Those can be useful personal tooling, but they are not SDLC controls and need
separate threat modeling before they belong in an adopter repo.

### Declared capability preflight

`scripts/preflight-credentials <slug>` supports legacy `Preflight command:`
rows plus the declarative bullets under
`## Required capabilities / credentials` in `DESIGN.md` (or `FEATURE.md` for
small tier):

```text
- none
- env: ENV_VAR_NAME
- env-file: path/to/.env ENV_VAR_NAME
- file: path/to/file
- dir-writable: path/to/dir
- command: executable-name
- setup-script: scripts/path-to-helper
```

Declarative checks verify presence/readiness only and never print credential
values. `setup-script:` checks that a deterministic helper under `scripts/`
exists and is executable; it does not run it. `scripts/feature-verify <slug>
unit|full` runs preflight before domain checks; `fast` mode stays lightweight.

## Local SDLC Memory

The repo remains the source of truth, but agents may use `scripts/sdlc-memory`
as a local advisory recall index. It stores a SQLite database under
`.sdlc-memory/` and indexes durable SDLC artifacts such as `docs/features/`,
`docs/principles/`, `AGENTS.md`, `CLAUDE.md`, and this workflow guide.

Recommended cold-start sequence:

```bash
scripts/feature-context <feature-slug>
scripts/sdlc-memory search "<feature slug or issue>"
scripts/sdlc-memory context "<feature slug or issue>" --out /tmp/memory-context.md
```

Treat memory hits as pointers, not proof. If local memory disagrees with the
current repo files, current repo files win. The memory system intentionally
uses FTS plus lightweight task/source links; embeddings, URL crawling, MCP, and
managed memory services are deferred until a real gap justifies them.

Before saving a durable repo-scoped fact, update and verify the canonical tracked file first,
then record the pointer with `scripts/sdlc-memory remember
--source <path> ...`. The source must be a regular, git-tracked file that
resolves inside the repository. Unsourced, outside, untracked, and
symlink-escape sources remain `unverified` local advisory context.

## Safety Layer

- `.claude/settings.example.json` is the template-clone starter for
  `.claude/settings.json`, which defines allowed and denied tool patterns.
- `.claude/hooks/guard-bash.sh` blocks destructive commands such as force
  pushes, hard resets, `--no-verify`, dangerous deletes, raw `codex`, raw
  worktree creation outside `SDLC_WORKTREE_ROOT`, and the deleted
  `scripts/feature-loop` entry point.
- `scripts/adversary-review`, `scripts/claude-adversary-review`, and
  `scripts/security-review` are the sanctioned cross-model paths. Codex-backed
  paths sanitize the assembled context before anything leaves the machine.

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

Output belongs in `INCREMENTS.md`, `TASKS.md`, `STATE.md`, `DECISIONS.md`,
`APPROVALS.md`, and `RELEASE_GATES.md`.

For an activated feature, replace the generic INC-001 with the smallest
experiential MVP. Map every task to an increment, open only current-increment
work, and keep future increments/tasks Planned/Backlog. After a real owner
`Accepted` record, activate exactly one next increment. After `Changes
requested`, open only same-increment rework.

### 4. Implement — `builder`

If invoking builder **directly** (outside the loop), first check the
worktree hygiene routing suggestion:

```text
scripts/worktree-hygiene <slug>
```

Then dispatch based on `Routing suggestion:`:

- `new-task` → `scripts/feature-next-task <slug>` to pick a claimable
  task ID, then invoke builder to claim and implement it.
- next-task exit `5` → stop. `feedback-required` goes to the owner; start,
  advance, or complete routes go to planner. Do not claim another task.
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
relevant verification mode, update EVIDENCE.md and TRACEABILITY.md,
record the pre-review self-audit, then transition Claimed → Review
(not directly to Done).
```

The `/feature-loop` slash command automates this routing — humans
typically just run that.

### 5. Review — parallel (`reviewer` ×3 modes + `security`)

Use the `/feature-review <slug>` slash command, which spawns `reviewer`
three times (with `Mode: quality | qa | adversarial`) plus `security` in
parallel, with risk-routing. Or manually invoke individual roles.
Severity budgets apply: P0/P1 mandatory, P2 capped at 5, P3 collected.

For the final task in the current increment, QA exercises the declared
Experience surface against its Ship target and acceptance checks the
increment proof. A clear review can support `Ready for feedback`; it cannot
create an owner `Accepted` verdict.

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
to Done**, AND it MUST be **cross-model** (the model that wrote the code
cannot be the model that adversarially reviews it). This was tightened to
a hard requirement on 2026-05-27 in response to a postmortem where three
findings were missed by same-model adversarial walks and caught later by
an out-of-session cross-model reviewer.

The cross-model rule (`SDLC_CROSS_MODEL_ADVERSARIAL_REQUIRED: true` in
`sdlc.config.yml`):

- If Claude Code wrote the code (any Claude model — Opus, Sonnet, Haiku),
  the adversarial reviewer MUST be invoked via `scripts/adversary-review`
  (which uses Codex CLI; different tool family, different model lineage)
  using `SDLC_CODEX_ADVERSARY_REQUIRED_MODEL` from `sdlc.config.yml`
  (currently `gpt-5.5`).
- If Codex CLI wrote the code, the adversarial reviewer MUST be Claude
  Code via `scripts/claude-adversary-review`, using
  `SDLC_CLAUDE_ADVERSARY_REQUIRED_MODEL` from `sdlc.config.yml`
  (currently `claude-opus-4-8`) and invoking a fresh adversarial pass on the diff.
- Same-tool-family review (e.g., Claude Opus reviewing Claude Sonnet
  code, or one Codex model reviewing another) does NOT satisfy the gate.
  RLHF lineage + training-data overlap make the blind spots correlated.

Wrappers review committed candidates. The integration ref and pinned reviewer
models come from the candidate's committed `sdlc.config.yml`; ambient
`SDLC_BASE_BRANCH`, `SDLC_CONFIG_FILE`, and reviewer-pin overrides are
rejected. Feature reviews derive the configured integration merge base.
Contract-adopted task reviews independently derive the dedicated commit that
first claimed the task, and the fourth positional argument can only assert
that exact base. Adoption is derived from committed Git history, not a
wall-clock cutoff: tasks already present at the integration base, or first
introduced on parent history without the versioned
`# sdlc-claim-base-contract:v1` marker, retain the legacy merge-base path.
Once that marker is present in the task's parent history, omitting the
dedicated claim commit fails closed. This grandfathers parallel pre-contract
branches that could not have observed the rule without trusting a
candidate-authored timestamp. The actual implementer model remains the
required fifth positional argument.

Task ownership, snapshots, attributes, and config are read from candidate Git
objects. Ownership is normalized and expanded against the committed tree, then
checked against every changed path. Absolute, traversal, symlink, empty, or
out-of-scope ownership fails closed. Unrelated dirty paths are ignored, while
dirty task scope, an empty canonical diff, resource-limit overflow,
model/tool-family mismatch, or a malformed/non-terminal verdict blocks review.
Retries keep the same complete canonical diff and shrink only surrounding
context; they never issue a receipt for a partial diff.

Reviewer stdout is streamed through a byte-bounded process-group supervisor.
That capture bound does not apply a file-size limit to reviewer-owned session
files. Timeout or INT/TERM tears down the whole reviewer process group and
preserves exit `124`, `130`, or `143`; only exit `0` satisfies the wrapper.

Each run allocates no-clobber, nonce-suffixed local transcript and sidecar
paths. A valid complete verdict writes a tracked schema-v2 receipt under
`docs/features/<slug>/review-receipts/` that binds the tools/models, base,
candidate, canonical diff, normalized scope paths, candidate blob identities,
prompt, transcript, and timestamp. Canonical object reads disable user/system
Git config, replacement refs, clone-local attributes, and grafts; Git 2.42+
and full history are required. Receipt issuance completes before a terminal
sidecar is written, so receipt failure remains retryable. Cite the receipt in
EVIDENCE and validate it with
`scripts/review-attempt validate-receipt <path> --require-scoped`.

Schema-v1 receipts remain readable as historical records but cannot satisfy a
new scoped gate. Integrate a reviewed candidate by fast-forward or a
history-preserving merge; squash/rebase changes its object identity and
invalidates the ancestry proof. CI receipt validation must use full history
(`fetch-depth: 0`).

Current code-bearing Review/Done work uses one authoritative trail shape: the
newest exact-task EVIDENCE H2 cites the newest HEAD-tracked allocator-named
schema-v2 scoped clear opposite-tool receipt and contains the current
self-audit, QA ledger, and required application-verification block. The
receipt's reviewer model must match the committed pin, and any later
task-owned product change requires a fresh receipt. Local transcripts,
FINDINGS prose, routing-skip prose, older receipts, mutable dates, and
exemption files do not satisfy this boundary.

Tasks already Done at the immutable committed
`SDLC_REVIEW_RECEIPT_ADOPTION_COMMIT` remain legacy. `Type: docs` skips the
heavy gates only when committed history proves a dedicated claim and a
non-empty, fully owned documentation-only claim-to-candidate diff.

**Codex-unavailable behavior**: if `scripts/adversary-review` exits 2
(codex CLI not on PATH or otherwise unavailable), the task is BLOCKED at
Review. Open an APPROVALS.md entry with stop reason code
`NEEDS_CROSS_MODEL_REVIEWER`. Retry after the required tool is available;
there is no exemption or silent fallback to direct same-model review for
current code-bearing work.

Review/Done tasks also need task-scoped QA proof. For non-doc work, record a
`QA coverage ledger` in `EVIDENCE.md` with `Control inventory:`, `Production
baseline:`, `Candidate proof:`, `Data-path proof:`, `Untested rows: 0`, and
`Result: PASS`. `scripts/feature-reconcile` rejects ledgers with untested rows
or non-PASS results. Put the QA and application typed blocks in the same H2 as
the newest receipt so proof cannot be borrowed across review attempts.

When updating `TRACEABILITY.md`, do not mark new rows `Passing` unless
`scripts/feature-verify` has produced a current `.last-verify.json` for the
feature, at or above the task's required verification mode.

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
- Any activated increment not owner-accepted (`scripts/feature-increment final`)

## Automated local loop

Use `/feature-loop <slug> [fast|unit|full]` for one autonomous SDLC iteration.
The slash command orchestrates with pre-iteration gates:

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
1b. **Agent capsule preflight** — for worker dispatch, generate and validate a task capsule before invoking Codex or Claude wrapper sessions.
2. **Iteration budget** — read RUNS.md and STATE.md "Loop budget"; halt if exhausted.
3. **Oscillation detection** — halt if same task / same diff hash / oscillating finding.
4. **Readiness** — `scripts/feature-ready`; if READY, invoke `release` and stop.
5. **Increment route** — on `feature-next-task` exit 5, stop for owner feedback
   or planner transition; never fall through to ordinary no-task planning.

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

Standard loop, orchestrate, review, and verify callsites run
`scripts/feature-learn` first with a tier-aware `auto:<run-kind>` source.
Small features resolve to `FEATURE.md`; medium features use `EVIDENCE.md`;
large features use `FINDINGS.md` for review, `RUNS.md` for loop, and
`EVIDENCE.md` for verify/orchestrate. Explicit sources must be readable,
non-symlink files inside the feature and fail closed when missing.
Task IDs may use any canonical uppercase alphanumeric prefix (such as
`TASK-001b` or `ICLR-010`); slashes, dots, whitespace, and metadata injection
are refused before durable writes.

Learning and reflect inputs are materialized as bounded UTF-8 slices without
NUL bytes. Append-only evidence may grow beyond the slice cap when its required
tail fits; fixed governing contracts are whole-file inputs and fail closed if
they exceed the cap. Publication is no-clobber and atomic, and output-directory
symlinks are refused before writes. Concurrent learning
ledger appends share a private per-feature lock under Git's common directory,
so linked worktrees and different `TMPDIR` values cannot lose rows. A private
lock records bounded host-hash/PID/nonce ownership. Acquisition stages the
complete private owner-bearing directory and atomically renames it into the
canonical path; release atomically retires that directory before cleanup.
Legacy ownerless directories are replaced without opening a new metadata gap.
Only a kernel-confirmed absent same-host PID is reclaimable after a crash,
while active, foreign, and ambiguous owner records remain untouched.

The terminal sealing sequence is intentionally different: finish and commit every
learning/evidence/receipt write first, then run `feature-verify full` and
`feature-ready` from the same clean exact HEAD. Make no tracked write afterward;
a post-full learning artifact would invalidate the terminal proof.
A missing full verification profile blocks this sequence. Bootstrap the exact
auto-discovered `scripts/<feature-slug>-verify`; never substitute `fast`,
`unit`, `skipped`, or a closest-available result, and do not edit a central
feature switch.

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
- No real external-service traffic unless explicitly owned by the feature and approved.
- No raw PAN, CVV, expiry, credentials, tokens, auth headers, passphrases, or webhook secrets in any file, log, or commit.
- No force-push, history reset, `--no-verify`, broad deletes, or destructive git operations.
- Stop and open an `APPROVALS.md` entry (with stop reason code) when external evidence, credentials, staging access, external vendor docs, compliance signoff, or human approval is required.

## Status state machines

- **Tasks** (`TASKS.md`): `Backlog → Open → Claimed → Blocked/Review → Done`.
  - `Backlog → Open` requires: Approved DESIGN; zero blocking QUESTIONS; all Depends-on Done.
  - `Open → Claimed` requires: `scripts/feature-next-task` returned this ID (DAG-satisfied).
  - `Claimed → Review` or `Done` requires: TRACEABILITY updated, EVIDENCE recorded, and code-bearing tasks have a pre-review self-audit block.
- **Findings** (`FINDINGS.md`): `Unverified → Confirmed → Fixed | False positive | Blocked`.
- **Design** (`DESIGN.md`): `Draft → Approved`. Only `Approved` unblocks Backlog→Open.
- **Approvals** (`APPROVALS.md`): `Requested → Approved | Rejected | Withdrawn`. Each entry has `waiting_on_human: true/false` + stop reason code.
- **Shippable increment lifecycle** (`INCREMENTS.md`): `Planned -> Building -> Ready for feedback -> Accepted`, with `Ready for feedback -> Changes requested -> Building`. Only owner evidence supplies Accepted/Changes requested.

A task is **Done** only when the tier-appropriate control-plane files are
current, verification passes, P0/P1 findings are resolved, and the all-tier
reconcile contract passes. Current code-bearing work needs the newest tracked
scoped clear opposite-tool receipt plus same-attempt self-audit, zero-gap QA,
and application-verification disposition/proof. Terminal release additionally
requires a clean successful `full` receipt at exact HEAD and a clean live
worktree.

## Severity budget

- **P0/P1** — mandatory. Block task Done and release. Applies to findings from any source: `reviewer` (any mode) and `security`. An adversarial-mode P0/P1 blocks identically to one from any other source.
- **P2** — capped at 5 active per feature. Beyond cap, append to cleanup task.
- **P3** — collected for visibility. Never blocks Done; never triggers a fix iteration. Owner opts in via `/feature-review --include-p3`.

## Stop reason codes

When `/feature-loop` halts on a human-required block, the RUNS.md entry and
the iteration report carry one of:

`NONE | OWNER_FEEDBACK_REQUIRED | INCREMENT_TRANSITION_REQUIRED | NEEDS_HUMAN_APPROVAL | NEEDS_EXTERNAL_EVIDENCE | NEEDS_CREDENTIAL_ROTATION | NEEDS_COMPLIANCE_SIGNOFF | NEEDS_EXTERNAL_DOC | NEEDS_STAGING_ACCESS | NEEDS_CROSS_MODEL_REVIEWER | OSCILLATION_DETECTED | ITERATION_BUDGET_EXHAUSTED | NO_PROGRESS_3X | DIRTY_WORKTREE | ERROR`

## Example feature

```bash
scripts/feature-context example-feature
```

The framework repo carries example feature directories for self-test coverage.
Adopter repos should use their own `docs/features/<slug>/` state as the source
of truth.

## Phase 2 (owner decision required)

The following are **designed for but not yet built**. They turn the framework
from "human-supervised SDLC autopilot" into a true "spec-in / deploy-ready-out"
runtime:

1. **Claude Agent SDK orchestrator** with `maxTurns` + `maxBudgetUsd`. The
   slash-command loop above has iteration and oscillation gates but no hard
   cost ceiling. An SDK runner can enforce one.
2. **Sandboxed network gateway** — outbound HTTP whitelist (e.g., carrier
   sandboxes only). Lets `reviewer (Mode: qa)` run real integration tests without
   compromising production safety.
3. **Staging deploy + smoke automation** — auto-deploy a green PR to staging,
   run smoke, attach evidence to APPROVALS. Closes the Mock Trap.
4. **Out-of-band notification** when the loop halts on `NEEDS_HUMAN_APPROVAL`.

Each requires owner sign-off (security, ops) before implementation. Until
then, the framework reliably stops at the staging boundary and reports the
exact stop reason code, which is the correct behavior for high-risk work.

## Legacy / deprecated

- Older external Codex skill files outside the repo — kept for local reference only, no longer authoritative.
- `scripts/feature-loop` — **deleted in v2** (was the Codex CLI Ralph loop).
- Any `codex exec ...` invocation — blocked by the hook.

## Future orchestration (optional)

CrewAI, the Claude Agent SDK, or similar orchestrators may layer on top of
the same repo files. They must read and write `docs/features/<slug>/*.md` and
`docs/features/<project-feature>/*.md`. They must not become a parallel source of truth.
