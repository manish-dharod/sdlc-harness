# Command Reference

> **Layer 4 · Reference** — the gory details. ↑ [Start Here](../START_HERE.md) · [L2 Overview](../AGENT_SDLC_OVERVIEW.md) · [L3 Workflow](../AGENT_SDLC_WORKFLOW.md)

These are the slash commands the harness ships with. You usually arrive here from a specific question ("what does `/feature-loop` actually do?"), not by reading top to bottom.

The commands live in `.claude/commands/*.md`. Each one is a thin orchestration layer: it runs a deterministic script, reads or updates the feature's control-plane files under `docs/features/<slug>/`, and hands the specialized work off to a role agent through the Task tool. The commands describe *what* happens; the [agents](agents.md) do the judgment and the [scripts](scripts.md) enforce the gates.

A note on names: the latest harness uses five role agents (`planner`, `builder`,
`reviewer`, `security`, `release`). Older adopter overlays may still use
project-specific role names; map those through the five-role model in the
[Overview](../AGENT_SDLC_OVERVIEW.md).

## Quick reference

| Command | Purpose | Phase |
|---|---|---|
| `/feature-init` | Scaffold a new feature control plane and run intake. | Intake |
| `/feature-intake` | Turn messy owner context into a sanitized, plan-first intake bundle. | Intake |
| `/feature-why` | Investigate "why is it this way?" across every available evidence source before opening a question. | Intake |
| `/feature-amend` | Record a mid-flight spec change with impact analysis. | Intake |
| `/feature-context` | Rehydrate full feature state (read-only). | Plan |
| `/feature-next-task` | Print the next current-increment task, or stop for owner/planner transition. | Plan |
| `/feature-claim` | Claim an Open task and hand it off to the builder. | Plan |
| `/feature-arena` | Run N parallel builder candidates and synthesize the best for a high-risk task. | Execution |
| `/feature-verify` | Run feature verification (fast / unit / full). | Execution |
| `/feature-review` | Run parallel review (reviewer modes + security) on the current diff. | Review |
| `/feature-reconcile` | Validate that the control plane is internally consistent. | Review |
| `/feature-ready` | Deterministic READY / BLOCKED / NEEDS-APPROVAL verdict. | Release |
| `/feature-loop` | Run one autonomous SDLC iteration with budget + oscillation + readiness gates. | Loop |
| `/feature-orchestrate` | Supervisor preflight: health-check the harness, then route the next step. | Loop |
| `/feature-learn` | Capture post-run learning candidates without applying any change. | Meta |
| `/feature-reflect` | Mine a feature's artifacts for recurring patterns; route fixes to structure vs. prompts. | Meta |
| `/harness-improve` | Cross-feature self-improvement loop with review, eval, and approval gates. | Meta |

## Intake

### `/feature-init <slug> [--spec path/to/spec.md]`

Scaffolds a brand-new feature. It copies the tier template to `docs/features/<slug>/`; medium and large tiers activate `.incremental-delivery` and create `INCREMENTS.md` with a Planned INC-001 placeholder. It drops a supplied `--spec` file into `SPEC.md` (or prompts the owner to paste one), then runs intake. Design only begins once `QUESTIONS.md` has no blocking entries.

- **When to use:** the very first command for a new feature.
- **Hands off to:** `planner` with `Phase: intake`, then `planner` with `Phase: design` once questions are clear. Runs `scripts/feature-init`.

### `/feature-intake <slug> [context-path-or-url ...]`

Converts raw, messy owner context — notes, transcripts, screenshots, error logs, URLs — into a sanitized, plan-first intake bundle before any implementation. Each local context path is passed through `scripts/sanitize-check` first; only sanitized content is copied into `docs/features/<slug>/intake/`. It then produces a short "plan for the plan" and updates the control-plane files. The diff stays docs-only unless the owner explicitly asked for implementation in the same turn.

- **When to use:** when you have a pile of source material and want it captured safely as durable repo state instead of chat history.
- **Hands off to:** the intake/design/plan role flows; finishes with `scripts/feature-reconcile` and `scripts/feature-next-task`. If it surfaces sensitive or production-gated work, it stops at `APPROVALS.md`.

### `/feature-why <slug> "<question>"`

Investigates why something is the way it is by querying every available evidence source in parallel — source control, GitHub issues/PRs, repo docs, plus any installed MCPs for chat, observability, error tracking, or analytics — then synthesizing a cited answer. The disciplines are strict: null results are first-class evidence, every claim carries a citation, and indirect evidence is hedged ("appears to", not "because"). Many apparent questions already have answers in the evidence stream; this surfaces them before bothering the owner.

- **When to use:** during intake (or later) when an ambiguity might be answerable from repo history, issues, or docs before it becomes a `QUESTIONS.md` row.
- **Hands off to:** parallel `general-purpose` investigators plus a synthesizer. Routes the result to a `REQUIREMENTS.md`/`SPEC.md` update, a `QUESTIONS.md` row, or owner-only. Runs `scripts/feature-why`.

### `/feature-amend <slug>`

Records a spec change that lands mid-flight. It bumps the `SPEC.md` version (preserving old AC IDs with a status note), re-extracts shifted AC IDs, and writes an amendment record (`AMD-###`) to `AMENDMENTS.md` with the impact on each affected AC, task, design section, traceability row, and approval. It does **not** re-implement anything — the owner approves the amendment first, and only then does re-planning run on the affected tasks.

- **When to use:** when the requirements change after a feature is already in flight.
- **Hands off to:** `planner` with `Phase: intake` for re-extraction; after owner approval, `planner` with `Phase: design` and `Phase: plan` for the affected sections and tasks.

## Plan

### `/feature-context <slug>`

Rehydrates full feature state. It runs `scripts/feature-context`, reads the active sections of the control-plane files (spec, design status, tasks, traceability, findings, decisions, recent evidence, approvals, release gates, recent runs), takes a readiness pulse with `scripts/feature-ready`, and summarizes the current verdict, design status, coverage, open questions, open tasks, findings by severity, approvals waiting on a human, and the recommended next role. It is read-only — pure rehydration, no edits.

- **When to use:** at the start of any session on an existing feature, to load context before doing anything.
- **Hands off to:** nothing — it ends with a recommended next role for you to invoke.

### `/feature-next-task <slug>`

Prints the next claimable current-increment task. A task is claimable only when its status is `Open`, its increment matches `Current increment:`, and every `Depends-on` task is `Done`. Exit `0` means a task was printed; exit `3` means nothing is claimable; exit `5` is a hard owner-feedback or planner-transition stop; exit `1` is a state/parse error.

- **When to use:** to find out what to work on next without scanning `TASKS.md` by hand.
- **Hands off to:** `builder` (if a task was returned) or `planner` with `Phase: plan` (if tasks are gated or none are Open). Runs `scripts/feature-next-task`.

### `/feature-claim <slug>`

Claims an Open task. It lists every Open task with its acceptance summary, verification command, and intended file ownership, asks which to claim (suggesting the only one if there is just one), then sets that task to `Claimed` with owner, date, and branch in `TASKS.md`. It claims and hands off only — it does not implement the task itself.

- **When to use:** once you have picked a task and want to take ownership of it.
- **Hands off to:** `builder`, via the Task tool, to implement the claimed task.

## Execution

### `/feature-arena <slug> <task-id> [N]`

Runs **constructive parallelism** for a high-risk task: it spawns N independent builder candidates (capped at 5) against the same task in isolated work directories, runs a cross-model judge over their diffs and rationales, picks the strongest as a base, grafts the best one or two ideas from each losing candidate into it, and verifies the synthesized result. This is distinct from `/feature-review`, which attacks one implementation for defects. The coordinator script enforces eligibility — the task must be `Risk: high` and touch a qualifying surface (migration, payment, launch-flag, or similar) — and only the lead writes back to the real repo.

- **When to use:** reserved for tasks where one attempt would lock in the wrong shape and a redo is far more expensive than running N candidates (payment state machine, migration with backfill, a default-ON flag).
- **Hands off to:** N `general-purpose` candidates, a cross-model judge (Codex via `scripts/adversary-review`, falling back to `opus`), and finally `/feature-review` on the synthesized diff. Runs `scripts/feature-arena`.

### `/feature-verify <slug> [fast|unit|full]`

Runs feature verification at the requested depth (default `fast`) via `scripts/feature-verify`, then captures the run as learning input. If the feature has no verification profile yet, it does not skip silently — it hands off to `reviewer` with `Mode: qa` to bootstrap one from `TEST_STRATEGY.md`. On failure it summarizes which checks failed, applies the flake policy (up to 3 retries) where applicable, and recommends fixing in the current task, opening a new task, or blocking the claim with an approval entry. It does not invent fixes for failures whose root cause is unclear.

- **When to use:** to confirm a change works before claiming a task complete, or any time you want a verification result.
- **Hands off to:** `reviewer` with `Mode: qa` (to bootstrap a profile or record a flake) or `builder`/`planner` (for an unclear failure). Runs `scripts/feature-verify` and `scripts/feature-learn`.

## Review

### `/feature-review <slug> [unit|full] [--include-p3]`

Runs multi-agent review on the current diff. It first captures the diff scope, then applies **risk routing** to decide which modes to invoke: docs-only diffs get quality review only and rely on the committed-history classifier rather than a synthetic skip entry; test-only diffs skip security; migration and payment/auth/webhook/secrets surfaces invoke all four modes with extra emphasis on security and strict adversarial review. For every current non-doc task on every tier, the newest task-scoped evidence H2 must keep the pre-review self-audit, zero-gap QA ledger, any required application proof, and tracked opposite-tool clear receipt together. It then synthesizes the independent results, naming repeated defect classes so fixes can target the class rather than individual sites. The `--include-p3` flag tells reviewers to act on P3 findings this pass.

- **When to use:** after a builder change, to review it before the task can move toward Done. This is the parallel-review workhorse.
- **Hands off to:** `reviewer` (three modes) and `security` in parallel; then recommends `builder` (to fix Confirmed P0/P1), `planner`, `reviewer (Mode: acceptance)`, or `release`. Captures a learning pass via `scripts/feature-learn`.

### `/feature-reconcile <slug>`

Validates that the control plane is internally consistent. For activated features it first validates `INCREMENTS.md`, task mappings, build-ahead prevention, and owner-feedback provenance; it then checks STATE counts, dependencies, evidence gates, and stale claims. All tiers share one parser and immutable adoption boundary. Current non-doc Review/Done tasks must have the newest same-H2 evidence bundle and a tracked, scoped, allocator-nonce opposite-tool clear receipt with no later task-owned product change. Current docs-only tasks are exempt only when committed claim history proves a non-empty, fully owned docs diff. Exit `0` is consistent; exit `1` prints divergences. The command never repairs state itself.

- **When to use:** when state looks inconsistent, after integration events, or as a gate inside the loop.
- **Hands off to:** `planner` with `Phase: plan` to reconcile drift; for stale claims, it asks the owner whether to release, take over, or leave the claim. Runs `scripts/feature-reconcile`.

## Release

### `/feature-ready <slug>`

Produces a deterministic release-readiness verdict via `scripts/feature-ready`: exit `0` is **READY**, exit `1` is **BLOCKED**, and exit `2` is **NEEDS-APPROVAL**. It composes `feature-reconcile --require-current-full --terminal`, so READY requires a clean live worktree and an exact-HEAD clean full-verification receipt in addition to the all-tier review evidence rules. Activated features also require every declared increment to be `Accepted` with owner evidence. It summarizes the increment/task/finding/gate/approval state and is read-only.

- **When to use:** to check whether a feature is ready, before invoking `release` for the formal verdict block.
- **Hands off to:** `release` (when READY), `planner` or `reviewer (Mode: acceptance)` (when BLOCKED), or the owner (when NEEDS-APPROVAL). Runs `scripts/feature-ready`.

## Loop

### `/feature-loop <slug> [fast|unit|full]`

Runs **one** autonomous, local-only iteration under the normal safety gates. Current-increment routing is a hard boundary: exit 5 stops for owner feedback or a planner transition rather than dispatching another builder. The iteration otherwise claims/resumes/reviews, verifies, and writes the RUN ledger.

- **When to use:** to advance a feature autonomously one step at a time. For a recurring campaign, drive it with the `/loop` skill: `/loop /feature-loop <slug>` — the budget, oscillation, reconcile, and capsule-preflight gates halt the campaign when work converges or stalls.
- **Hands off to:** `planner`, `builder`, `reviewer` (modes), `security`, and `release` as the routing requires; records each run in `RUNS.md`.

### `/feature-orchestrate <slug> [fast|unit|full]`

The lightweight supervisor preflight for long-running agentic work. It checks health, sanitizer, feature gates, worktree hygiene, and the next current-increment route. Exit 5 stops for owner feedback or planner transition; it is never treated as ordinary no-task routing.

- **When to use:** at the start of an orchestration session, to confirm the harness is healthy and find out which role should run next before dispatching any worker.
- **Hands off to:** the routed next role (planner / builder / review via `/feature-review` / release), or stops on a sanitizer failure, unresolved P0/P1, missing evidence, or any production-facing action.

## Meta

### `/feature-learn <slug> [task-id] [--run-kind ...] [--status ...] [--mode ...] [--source path]`

The continuous learning-capture step. It runs after agent work, verification, review, orchestration, and loop iterations so useful lessons do not vanish into chat history. It runs `scripts/feature-learn`, which writes a timestamped learning artifact and appends to `LEARNINGS.md`, then prompts for a generalized capture of the observed signal and candidate learnings. Capture is automatic; promotion is gated — it never auto-edits role prompts, skills, scripts, hooks, or product code, and never stores secrets or PII.

- **When to use:** after every material SDLC run. Most lifecycle commands already invoke it for you; run it manually after a recovery from a failed command, stale branch, missing credential, or repeated correction.
- **Hands off to:** nothing directly — the captured candidates are mined later by `/feature-reflect`.

### `/feature-reflect <slug>`

The framework's self-improvement loop for a single feature. It mines the feature's durable artifacts (spec, design, tasks, evidence, runs, findings, learnings) for recurring patterns and produces a structured Accepted / Rejected / Backlog plan. The keystone is the **structural-enforcement check**: any accepted item that would be more reliable as a script, lint, hook, template field, or runtime check is routed to the backlog tagged `encode-in-structure` instead of being re-emitted as more prompt text — which is what stops the documentation from growing every iteration. Auto-apply is forbidden; a human approves a subset before any prompt or principle edit is made.

- **When to use:** on a closed (or in-flight) feature when you hit the "same pattern caught twice" smell.
- **Hands off to:** three `general-purpose` reviewers (judgment / tooling / divergent lenses) plus a synthesizer, then a mandatory human approval gate. Runs `scripts/feature-reflect`.

### `/harness-improve [--since YYYY-MM-DD]`

The cross-feature self-improvement orchestrator. It turns accumulated local capture logs into proposed insight items, eval-corpus candidates, and routing decisions, gating every consequential action behind review, deterministic eval, a promotion policy, and owner approval. Its behavior is controlled by an autonomy setting (`off` / `capture` / `distill` / `auto-structural`): below `distill` it stops after reporting that distill is not enabled, and `auto-structural` is inactive unless an explicit owner approval has armed it. Judgment routes (`add-or-update-principle`, `role-prompt-edit`) are always human-gated; the command cannot grant its own approval.

- **When to use:** periodically, to distill cross-feature capture logs into reviewed, evaluated, owner-approved harness improvements.
- **Hands off to:** `reviewer` (quality, adversarial) and `security` on the proposal bundle; runs `scripts/reflect-harness`, `scripts/harness-eval`, and `scripts/harness-promote`, then an owner approval gate.

## Composing commands

The commands are designed to chain. A few common sequences:

- **Start a feature:** `/feature-init <slug>` → `/feature-context <slug>` → `/feature-next-task <slug>` → `/feature-claim <slug>` → (builder implements) → `/feature-review <slug>`.
- **Resume an existing feature:** `/feature-context <slug>` to rehydrate, then `/feature-next-task <slug>` to find the next move.
- **Messy intake:** `/feature-intake <slug> <context...>` to capture and sanitize source material, with `/feature-why <slug> "<question>"` to resolve ambiguities from evidence before they become owner questions.
- **Autonomous campaign:** `/loop /feature-loop <slug>` — one iteration per pass, with the loop's budget, oscillation, reconcile, and readiness gates halting the campaign cleanly when the feature converges or a real blocker appears. `/feature-orchestrate <slug>` is the safer, preflight-only supervisor when you want to inspect the next step before dispatching a worker.
- **High-risk task:** `/feature-arena <slug> <task-id>` to synthesize the best of N candidates, then the regular `/feature-review` on the result.
- **Release:** `/feature-ready <slug>` for the deterministic pre-check, then the `release` agent for the formal verdict.
- **Learn from the work:** `/feature-learn` captures continuously; `/feature-reflect <slug>` mines one feature; `/harness-improve` distills lessons across features.

---

**Related:** [agents.md](agents.md) · [scripts.md](scripts.md) · [control-plane.md](control-plane.md) · [config.md](config.md)
