# AGENTS.md — Codex / agent-agnostic adapter for sdlc-harness

This file is the **peer of CLAUDE.md** for non-Claude agents (Codex CLI,
custom orchestrators, CI-driven loops). It describes the **durable
SDLC protocol** the framework enforces, in a way that any agent can
adopt by following the protocol rather than executing Claude Code-
specific slash commands.

**Audience:** Codex agents, Cursor agents, custom Anthropic SDK
orchestrators, GitHub Actions workflows, anyone driving the harness
from outside Claude Code.

**Claude Code users:** read `CLAUDE.md` instead. That file is the
Claude-specific adapter; this file is the protocol layer below it.

## The durable protocol

The framework's value sits in **durable repo state**, not in any
specific agent's behavior. Every agent that adopts the framework must:

1. **Read the feature control plane** at `docs/features/<slug>/`
   (file shapes documented in `docs/features/_template{,_medium,_small}/`).
2. **Use the same state machines**: task status (`Backlog → Open →
   Claimed → Review → Done`), increment status (`Planned → Building →
   Ready for feedback → Accepted`, with same-increment rework), finding status
   (`Unverified → Confirmed → Fixed | False positive`), and design status
   (`Draft → Approved`).
3. **Enforce the same gates**: severity budget (P0/P1 mandatory, P2
   capped at 5, P3 advisory), traceability matrix (every behavioral
   change updates `TRACEABILITY.md`), adversarial trail (every code-
   bearing Done task has an EVIDENCE-recorded adversary check).
4. **Run the deterministic scripts** — they ARE the cross-agent
   contract. Whichever agent drives the lifecycle, it invokes the
   same `scripts/feature-*` and gets the same output.

If an agent does those four things, the framework works for it. The
slash commands in `.claude/commands/` are syntactic sugar for Claude
Code; their behavior is implementable by any agent that follows the
protocol.

## How Codex (or any non-Claude agent) follows the protocol

### Setup

```bash
# Once per repo, after cloning sdlc-harness into your project:
cp sdlc.config.yml.example sdlc.config.yml
# Edit sdlc.config.yml — at minimum set SDLC_ARENA_ELIGIBILITY_REGEX
# and SDLC_ARTIFACT_HYGIENE_PATTERNS for your project. Set
# SDLC_WORKTREE_ROOT if you want helper-managed scratch worktrees.

# Verify the harness is wired:
scripts/test-framework-v3
# Framework repo should report all current AC suites passing.
# Template-clone adopter repos may report expected skips for framework-self
# fixtures; each skip should include a reason.
```

### Per-feature lifecycle

The agent (whichever it is) follows this sequence per feature:

**1. Intake.** Read the owner's spec. Extract acceptance criteria
(AC-###) and non-functional requirements (NFR-###). Open ambiguity
questions in `QUESTIONS.md`. Pre-check ambiguities against the
evidence stream first via `scripts/feature-why <slug> "<question>"`.

```bash
scripts/feature-init <slug> --tier {small|medium|large}
# Edit docs/features/<slug>/SPEC.md to populate AC/NFR IDs.
scripts/feature-why <slug> "<the ambiguity in question form>"
# Then either: add the cited answer to SPEC.md/REQUIREMENTS.md,
# OR open a QUESTIONS.md row decorated with the why-result.
```

New small features use 1 file. New medium features use 6 files, including
`INCREMENTS.md`; new large features use a 20-file control plane. Medium and
large scaffolds carry `.incremental-delivery`; historical marker-free features
retain their previous behavior.

**2. Design.** Produce `DESIGN.md` (must be `Status: Approved` before
tasks can move `Backlog → Open`) + `TEST_STRATEGY.md`, plus
`THREAT_MODEL.md` / `MIGRATION_PLAN.md` / `ROLLBACK_PLAN.md` for
large-tier features.

**3. Plan.** For medium/large features, define INC-001 as the smallest
experiential user journey in `INCREMENTS.md`. Decompose the approved design
into increment-mapped tasks with `Depends-on` edges + file ownership + AC ID
citations. Maintain `STATE.md` (machine-readable yaml block) + `TASKS.md` +
`DECISIONS.md` + `APPROVALS.md` + `RELEASE_GATES.md`. Keep future increments
and their tasks Planned/Backlog until the owner accepts the current slice.

**4. Claim + implement.** One task at a time:

```bash
scripts/feature-increment check <slug>
scripts/feature-next-task <slug>     # current task, or exit 5 for owner/planner stop
# Agent claims it: edit TASKS.md, set Status: Claimed, write owner/branch
scripts/worktree-hygiene <slug>       # verify diff stays in declared file ownership
scripts/worktree-add-external <name> [branch-or-commit]  # optional scratch worktree helper
scripts/worktree-gc [--prune] [--all]  # reclaim idle scratch worktrees (clean+merged or stale only); dry-run unless --prune
# Agent implements; runs verification:
scripts/feature-verify <slug> {fast|unit|full}
# Auto-discovers scripts/<slug>-verify if you've written one.
# Agent updates EVIDENCE.md + TRACEABILITY.md.
```

After integration events that touch multiple features or repo-global harness
paths, run the cross-feature sweep before calling the merge done:

```bash
scripts/feature-verify --all-active fast
```

**5. Review.** Spawn parallel review on the diff:

```bash
# Claude version: invokes reviewer three times in parallel
#                 (Mode: quality | qa | adversarial) plus security on the
#                 same diff. (v1.1 collapsed the 4 v1.0 review roles into
#                 one reviewer agent with a Mode: flag — see CLAUDE.md.)
# Codex version:  the orchestrator either spawns parallel Codex sessions,
#                 or runs scripts/claude-adversary-review so Codex-authored
#                 work gets a Claude Code adversarial pass.
scripts/adversary-review <slug> <task-id> review
scripts/claude-adversary-review <slug> <task-id> review
scripts/security-review  <slug> <task-id> review
```

The Codex-backed wrappers source `scripts/lib-sanitize.sh` — sensitive-data tripwire
(secret/card/CVV/expiry/PII patterns) before any context leaves the
machine. Exit 4 on tripwire.

**6. Fix findings, transition Done.** P0/P1 mandatory. Re-run review
on the fix diff. The task transitions `Review → Done` only when:
- Verification passes
- All P0/P1 findings `Fixed` or `False positive`
- An adversarial trail entry exists in `EVIDENCE.md`
- Traceability rows updated for cited AC IDs
- Non-doc Review/Done tasks include a passing QA coverage ledger
- Any new `TRACEABILITY.md` row marked `Passing` is backed by current
  `.last-verify.json` from `scripts/feature-verify`

**7. Accept + release.** When all tasks are Done and all activated increments
carry an explicit owner Accepted record:

```bash
scripts/feature-ready <slug>     # 0 READY / 1 BLOCKED / 2 NEEDS-APPROVAL
scripts/feature-increment final <slug>
scripts/preflight-credentials <slug>  # runs declared external API and local capability checks
```

The script reads STATE/TASKS/FINDINGS/TRACEABILITY/RELEASE_GATES/
APPROVALS, template-population state, and any declared credential
preflight checks, then emits a verdict. Agent reads exit code and acts.

`scripts/preflight-credentials` supports legacy `Preflight command:` rows plus
declarative `## Required capabilities / credentials` bullets (`none`, `env:`,
`env-file:`, `file:`, `dir-writable:`, `command:`, `setup-script:`). It never
prints credential values. `setup-script:` checks that a helper under `scripts/`
exists and is executable; reviewer (Mode: qa) decides when to run it.

For browser/UI/full verification, evidence should include a source-grounded
test plan, step annotations (`Step`, `Expected`, `Observed`, `Result`),
labeled artifacts, timing/wait strategy for transient UI, and an anti-cheating
note that distinguishes setup shortcuts from proof of the user flow.

## Cross-agent operations (the framework's compounding loops)

Three slash commands in `.claude/commands/` describe **multi-agent
patterns**. Each has an underlying deterministic script. Non-Claude
agents implement the pattern by orchestrating per their own primitives,
but they all start with the same `scripts/feature-<name>` invocation.

### /feature-reflect — compounding learning

```bash
scripts/feature-reflect <slug>
# Writes docs/features/<slug>/reflect/<ts>.context.md with a
# sanitized bundle (SPEC/DESIGN/TASKS/EVIDENCE/FINDINGS/etc.).
# Refuses with exit 6 if the bundle would contain sensitive data.
```

The orchestrator then runs three parallel reviewers against the
bundle (judgment / tooling / divergent lenses) + a synthesizer that
applies the **structural-enforcement check**: any accepted "this rule
should be in the prompt" item that could be enforced as a script /
lint / hook is re-routed to a Backlog item instead. Human-approval
gate before any apply.

This is the loop that prevents your prompts from growing forever as
issues recur. Per `docs/principles/principle-encode-lessons-in-
structure.md`.

### /feature-why — multi-source evidence investigation

```bash
scripts/feature-why <slug> "<the question>"
# Writes docs/features/<slug>/why/<ts>.context.md with hits from
# every available evidence category. Refuses with exit 6 on
# sanitization tripwire.
```

Categories: source control (git/gh), GitHub issues / PRs (conditional
on `gh` auth), repo docs (grep), plus MCP-backed categories if any
are installed (Slack / Notion / Datadog / Sentry / data warehouse).
The orchestrator then dispatches one investigator per available
category in parallel, synthesizes with epistemic discipline (null
results first-class; citations mandatory; "appears to" over "because"
for indirect inferences).

### /feature-arena — constructive parallelism for high-risk diffs

```bash
scripts/feature-arena <slug> <task-id> [N]
# Refuses (exit 4) if task doesn't meet SDLC_ARENA_ELIGIBILITY_REGEX
# (you MUST configure this; no default).
# Refuses (exit 6) if task block has sensitive-data patterns.
# Writes per-candidate work dirs + a coordinator manifest.
```

The orchestrator spawns N candidate implementations in parallel
(different models or seeds), runs a cross-model judge on the
candidates, picks a base, grafts the best 1–2 ideas from each
loser, and verifies the synthesis.

## Cross-model review surfaces

Sanctioned wrappers provide cross-model perspective:

| Wrapper | Purpose | Exit codes |
|---|---|---|
| `scripts/adversary-review` | Codex-backed 10-category adversarial review for Claude-authored work | 0 ran, 2 reviewer unavailable, 3 usage, 4 sanitizer tripwire |
| `scripts/claude-adversary-review` | Claude Code adversarial wrapper for Codex-authored work | same |
| `scripts/security-review` | Codex-backed STRIDE + security-sensitive review | same |

The bash guard hook (`.claude/hooks/guard-bash.sh`) blocks raw `codex`
invocation from Claude — only these wrappers may shell to Codex.
For non-Claude agents that already AR Codex, the wrappers are still
useful: they assemble structured prompts and run the sanitizer.

Agent capsules are optional bounded worker prompts for long-running or
parallel lanes:

```bash
scripts/agent-capsule-plan <slug> <task-id> builder > /tmp/agent-capsule.md
scripts/agent-capsule-check /tmp/agent-capsule.md
scripts/codex-capsule-run <slug> <task-id> /tmp/agent-capsule.md
scripts/claude-capsule-run <slug> <task-id> /tmp/agent-capsule.md
```

The program backlog lives upstream of feature work. Add or edit proposed
enhancements in `docs/backlog/items/`, then regenerate and check the index:

```bash
scripts/backlog-index
scripts/backlog-index --check
```

## What's NOT in the protocol (and why)

- **No specific code-style rules.** Style belongs to your project's
  linter, not the framework.
- **No deployment.** Production deploys, DNS / flag flips, live DB
  mutation are explicitly forbidden by `principle-no-production-
  deploys-from-loop`. Adopters wire their own CI/CD outside the
  framework.
- **No language / framework conventions.** Auto-discover `scripts/
  <feature>-verify` is the framework's only opinion on what
  verification looks like. Adopters wire any language / framework
  conventions inside that script.

## When to read CLAUDE.md vs AGENTS.md

| You are | Read |
|---|---|
| Driving the framework via Claude Code | CLAUDE.md (Claude-specific adapter) |
| Driving it via Codex CLI | AGENTS.md (this file) |
| Driving it via your own orchestrator | AGENTS.md + the script docs |
| Setting up CI / scheduled jobs | AGENTS.md + script exit codes |
| Auditing the protocol itself | `docs/features/_template/*.md` + `docs/principles/` |

## Local SDLC memory

- The approved local advisory recall tool is `scripts/sdlc-memory`. It stores
  a SQLite database under `.sdlc-memory/`, which is ignored by git.
- Repo Markdown remains the source of truth. Use local memory to surface likely
  context, then verify against `docs/features/`, `docs/principles/`, and current
  git state before acting. Treat memory hits as pointers, not proof.
- For a durable repo-scoped fact, update and verify the canonical tracked file first,
  then use `remember --source <path>`. Only regular files that resolve inside
  the repository and are tracked by git activate a manual memory. Unsourced,
  outside, untracked, and symlink-escape sources remain `unverified` advisory context.
- Cold-start: `scripts/sdlc-memory search "<slug or issue>"` then
  `scripts/sdlc-memory context "<slug or issue>" --out /tmp/memory-context.md`.
- Local memory supports persistent recall, FTS search, lightweight task/source
  links, content-hash staleness checks, and manual `remember` / `forget`.
- Never commit `.sdlc-memory/`, memory exports, credentials, customer data,
  card data, or secrets.

## Quick reference: every framework command

```bash
# Lifecycle
scripts/feature-init <slug> [--tier small|medium|large] [--spec path]
scripts/feature-context <slug>
scripts/feature-increment check|current|route|ready|final <slug> [INC-###]
scripts/feature-next-task <slug>
scripts/feature-verify <slug> {fast|unit|full}
scripts/feature-verify --all-active {fast|unit|full}
scripts/feature-ready <slug>
scripts/feature-reconcile <slug>
scripts/worktree-hygiene <slug> [task-id] [--strict]
scripts/sdlc-doctor [--quiet] [--offline]
scripts/sanitize-check --changed|--staged|<file...>
scripts/preflight-credentials <slug>

# Cross-model review
scripts/adversary-review <slug> [task-id] [review|review-strict]
scripts/claude-adversary-review <slug> [task-id] [review|review-strict]
scripts/security-review  <slug> [task-id] [review|review-strict]

# Agent capsules
scripts/agent-capsule-plan <slug> <task-id> <role>
scripts/agent-capsule-check <capsule-file>
scripts/codex-capsule-run <slug> <task-id> <capsule-file>
scripts/claude-capsule-run <slug> <task-id> <capsule-file>
scripts/worktree-add-external <name> [branch-or-commit]
scripts/worktree-gc [--prune] [--all]      # reclaim idle scratch worktrees; dry-run unless --prune; never --force, never the main checkout

# Compounding loops
scripts/feature-reflect <slug>
scripts/feature-why <slug> "<question>"
scripts/feature-arena <slug> <task-id> [N] [--force]

# Utilities
scripts/log-decision <slug> <decision> <rationale>
scripts/backlog-index [--check]
scripts/approvals-pending [--as-of YYYY-MM-DD]
scripts/sdlc-maintain [--quiet] [--as-of YYYY-MM-DD]
scripts/lib-sanitize.sh                          # self-test
scripts/sanitize-check --changed                 # file scan
scripts/sdlc-doctor --quiet --offline            # local-only harness health check
scripts/test-framework-v3                        # harness self-test
scripts/example-context                          # copyable context profile
scripts/example-verify fast|unit|full            # copyable verify profile
scripts/load-config                              # sources sdlc.config.yml
```

## Exit-code grammar (the cross-agent contract)

| Exit | Meaning | Where it fires |
|---|---|---|
| `0` | Clean / verdict OK | all |
| `1` | Drift / failure (READY check, reconcile, verify) | feature-ready, feature-reconcile, feature-verify |
| `2` | Codex CLI unavailable; fall back to local model | adversary-review, security-review |
| `3` | Usage error | all |
| `4` | Sanitization tripwire OR eligibility refusal | adversary-review, security-review, feature-arena |
| `5` | Owner-feedback/planner-transition stop, or write failure | feature-next-task; feature-arena, feature-reflect, feature-why |
| `6` | Sanitization tripwire (task-block / bundle scan) | feature-arena, feature-reflect, feature-why |

Any agent driving the framework can branch on these.

---

This file makes sdlc-harness cross-agent at the protocol layer. The slash
commands in `.claude/commands/` are one specific adapter (Claude Code).
Codex / Cursor / custom orchestrators implement the same protocol described
above.
