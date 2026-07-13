# CLAUDE.md — sdlc-harness framework rules

Auto-loaded by Claude Code at the start of every session in this repo.
This file documents the **framework's own internal rules** while it is
under development. **Adopting projects do NOT use this CLAUDE.md** —
they keep their own project-level CLAUDE.md and just import the
framework files (per [README.md](README.md)).

> **Install paths**: this framework ships as a Claude Code plugin
> (`/plugin marketplace add manish-dharod/sdlc-harness` then
> `/plugin install sdlc-harness@sdlc-harness`) AND as a template-clone
> source (copy `.claude/` files into your project). See
> [README.md](README.md) for the trade-offs.

## Agentic SDLC at a glance

The framework treats features as durable repo state. Each feature has a
control plane at `docs/features/<slug>/` with files that flow:

```
Spec → Design → Tasks → Code → Tests → Evidence → Approvals → Release
```

See `docs/AGENT_SDLC_HANDBOOK.md` for the practical guide,
`docs/AGENT_SDLC_WORKFLOW.md` for the full lifecycle, and
`docs/features/_template*/` for the three tier templates.

## Subagents — invoke via the Task tool

Defined in `.claude/agents/`:

As of v1.1 the framework ships **five** role agents (down from ten in
v1.0). Three of them use a phase / mode flag in the invocation prompt to
select which sub-role they're operating as.

| Agent | Flag (set in prompt) | When to use |
|---|---|---|
| `planner` | `Phase: intake` | Spec intake. Read SPEC.md, extract AC/NFR IDs, open ambiguity questions. Run `/feature-why` pre-check before opening QUESTIONS rows. |
| `planner` | `Phase: design` | Produce DESIGN.md (must be Approved before tasks open) + TEST_STRATEGY, THREAT_MODEL, MIGRATION_PLAN, ROLLBACK_PLAN. |
| `planner` | `Phase: plan` | Decompose Approved design into DAG-aware tasks with depends-on edges. Maintain STATE / TASKS / DECISIONS / APPROVALS / RELEASE_GATES. |
| `builder` | (no flag) | Claim one Open task whose deps are Done, implement smallest scoped change, update EVIDENCE + TRACEABILITY. |
| `reviewer` | `Mode: quality` | Evidence-backed review of current diff. Severity budget: P0/P1 mandatory, P2 capped at 5, P3 advisory. |
| `reviewer` | `Mode: qa` | Run verification, apply flake quarantine, update TRACEABILITY test status, bootstrap `<feature>-verify` profile if missing. |
| `reviewer` | `Mode: adversarial` | Independent adversarial review before Done. 10-category framing. Codex-backed via `scripts/adversary-review`. |
| `reviewer` | `Mode: acceptance` | Final spec conformance: walk TRACEABILITY, confirm every AC/NFR has a passing test, check design-contract drift. |
| `security` | (no flag) | Security / launch-gate review against THREAT_MODEL. Codex-backed via `scripts/security-review`. |
| `release` | (no flag) | Read-only release-readiness verdict using `scripts/feature-ready`. |

For independent work, invoke multiple subagents in parallel in a single
message. `/feature-review` does this automatically — it spawns
`reviewer` three times (different modes) plus `security` in parallel,
applying risk routing.

If you imported the framework before v1.1, the 10 `sdlc-*` agents are now
renamed. See [docs/MIGRATING_v1.0_to_v1.1.md](docs/MIGRATING_v1.0_to_v1.1.md)
for the recipe.

### Per-role model assignment

Each agent declares its default model in its frontmatter. **Opus where
the work is judgment-heavy and high-stakes; Sonnet where the work is
high-volume and well-scoped; Haiku for read-only mechanical roles.**
Defaults in v1.1:

- `planner` — opus (design phase is highest-stakes; override to sonnet for
  intake/plan via the Task tool's `model` param)
- `builder` — sonnet (highest-volume role; scoped tasks; quality gate is
  the parallel review downstream)
- `reviewer` — opus (the adversarial + acceptance modes are judgment-heavy;
  override to sonnet for quality/qa on low-risk diffs via `model` param)
- `security` — opus (PCI / auth / webhook / migration judgment)
- `release` — haiku (read-only verdict; mechanical)

Override per invocation with the Task tool's `model` parameter, or
per environment with `CLAUDE_CODE_SUBAGENT_MODEL`.

## Slash commands

Defined in `.claude/commands/`:

### Feature lifecycle

- `/feature-init <slug> [--tier small|medium|large] [--spec path]` —
  scaffold control plane, run intake.
- `/feature-intake <slug> [context-path-or-url ...]` — sanitize raw owner
  context, preserve intake notes, and plan before implementation.
- `/feature-context <slug>` — full rehydration for a feature.
- `/feature-next-task <slug>` — print next claimable task respecting
  the DAG.
- `/feature-claim <slug>` — interactive task claim.
- `/feature-amend <slug>` — record a spec amendment with impact
  analysis.

### Execution

- `/feature-orchestrate <slug> [mode]` — supervisor preflight: doctor,
  sanitizer, reconcile, readiness, and task routing before workers run.
- `/feature-loop <slug> [mode]` — one autonomous SDLC iteration with
  budget + oscillation + readiness gates.
- `/feature-review <slug> [mode] [--include-p3]` — parallel review
  with risk routing.
- `/feature-verify <slug> [fast|unit|full]` — feature verification.

### Cross-cutting

- `/feature-reflect <slug>` — mine artifacts for recurring patterns,
  surface Accepted/Rejected/Backlog with structural-enforcement check.
- `/feature-why <slug> "<question>"` — multi-source evidence
  investigation at intake time.
- `/feature-arena <slug> <task-id> [N]` — constructive parallelism
  for high-risk diffs (N candidates, cross-judge, graft, verify).
- `/feature-learn <slug> [task-id]` — capture post-run learning
  candidates for a feature/task without auto-applying harness changes.

### Harness self-improvement

- `/harness-improve` — run the continuous self-improvement distill loop
  (capture → review → eval gate → human-approved apply). Gated by
  `scripts/harness-eval` and `scripts/harness-promote`; default autonomy is
  capture-only. See `docs/principles/principle-eval-gated-autonomy.md`.

### Release

- `/feature-reconcile <slug>` — validate control-plane consistency.
- `/feature-ready <slug>` — deterministic readiness verdict.

## Deterministic scripts (`scripts/`)

```bash
scripts/feature-init <slug> [--tier small|medium|large] [--spec path]
scripts/feature-context <slug>
scripts/feature-next-task <slug>
scripts/feature-verify <slug> fast|unit|full
scripts/feature-verify --all-active fast|unit|full
scripts/feature-ready <slug>
scripts/feature-reconcile <slug>
scripts/worktree-hygiene <slug> [task-id] [--strict]
scripts/worktree-add-external <name> [branch-or-commit]
scripts/worktree-gc [--prune] [--all]      # GC idle scratch worktrees: removes only clean + merged (or stale) ones; dry-run unless --prune; never --force, never the main checkout
scripts/sdlc-doctor [--quiet]
scripts/sanitize-check --changed|--staged|<file...>
scripts/preflight-credentials <slug>
scripts/adversary-review <slug> [task-id] [review|review-strict] [base-ref]
scripts/claude-adversary-review <slug> [task-id] [review|review-strict]
scripts/security-review  <slug> [task-id] [review|review-strict] [base-ref]
scripts/agent-capsule-plan <slug> <task-id> <role>
scripts/agent-capsule-check <capsule-file>
scripts/codex-capsule-run <slug> <task-id> <capsule-file>
scripts/claude-capsule-run <slug> <task-id> <capsule-file>
scripts/backlog-index [--check]
scripts/feature-reflect <slug>
scripts/feature-learn <slug> [task-id]
scripts/feature-why <slug> "<question>"
scripts/feature-arena <slug> <task-id> [N] [--force]
scripts/log-decision <slug> <decision> <rationale>
scripts/sdlc-memory <init|ingest-feature|ingest-all-features|remember|search|context|stale|verify-source|forget>
scripts/harness-eval                       # eval gate for self-improvement candidates
scripts/harness-promote                    # human-approved apply of a graduated candidate
scripts/reflect-harness                    # mine RUNS/EVIDENCE for harness-level patterns
scripts/insight-index                      # maintain the insight ledger
scripts/review-attempt                     # score a self-improvement candidate
scripts/continuous-self-improvement-loop-verify
scripts/test-framework-v3
scripts/test-sdlc-memory                   # local memory tool self-test
scripts/example-context
scripts/example-verify fast|unit|full
```

### Practical agentic-intake additions

The framework adopts only the high-value subset of common
agentic-engineering productivity advice:

- Plan-first intake: `/feature-intake` turns docs, transcripts, errors, and
  URLs into sanitized feature context before implementation.
- Raw-context safety: `scripts/sanitize-check` scans local context and changed
  files with the same `scripts/lib-sanitize.sh` tripwire used by wrappers.
- Orchestration preflight: `/feature-orchestrate` runs `scripts/sdlc-doctor`,
  sanitizer, reconcile, readiness, and task routing before dispatching workers.
- Optional agent capsules: `scripts/agent-capsule-plan` and
  `scripts/agent-capsule-check` produce bounded worker prompts for long-running
  or parallel lanes; `scripts/codex-capsule-run` and
  `scripts/claude-capsule-run` are the sanctioned wrappers.
- External worktrees: set `SDLC_WORKTREE_ROOT` and use
  `scripts/worktree-add-external` for disposable or parallel lanes; the bash
  guard blocks raw worktree creation outside that root. To reclaim idle
  worktrees, use `scripts/worktree-gc` — dry-run by default; it removes only
  worktrees that are BOTH clean (no uncommitted changes) AND merged into a base
  ref (`origin/main`, override with `SDLC_GC_BASE_REFS`), plus stale admin
  entries whose directory is already gone. It never removes the main checkout
  or a protected branch (`main`, override with `SDLC_GC_PROTECTED_BRANCHES`),
  never uses `git worktree remove --force`, and never auto-commits/stashes/
  resets. Pass `--prune` to actually remove; `--all` widens the scan beyond
  `SDLC_WORKTREE_ROOT`.
- Program backlog: `docs/backlog/` stores proposed enhancements that are not
  active feature tasks; regenerate `docs/backlog/INDEX.md` with
  `scripts/backlog-index`.
- Optional notification: `SDLC_NOTIFY_COMMAND` may run after the final
  orchestration report. Keep it local and context-free.

The framework does **not** install permission bypasses, email-to-agent daemons,
remote-control defaults, or browser-cookie automation. Those are personal
workflow choices, not SDLC controls, unless an adopter adds them as separate
approved features with explicit allowlists and sanitizer gates.

`scripts/preflight-credentials` supports legacy `Preflight command:` rows plus
declarative `## Required capabilities / credentials` bullets (`none`, `env:`,
`env-file:`, `file:`, `dir-writable:`, `command:`, `setup-script:`). It never
prints credential values. `setup-script:` only checks that a helper under
`scripts/` exists and is executable.

For browser/UI/full verification, reviewer (Mode: qa) records a
source-grounded test plan, step annotations (`Step`, `Expected`, `Observed`,
`Result`), labeled screenshots/traces where feasible, timing/wait strategy for
transient UI, and an anti-cheating note distinguishing setup shortcuts from
proof of the user flow.

Before builder hands a code-bearing diff to Review or Done, EVIDENCE.md must
include a task-scoped `Pre-review self-audit` block with three non-empty
`Plausible miss N:` descriptions and one non-empty `Check:`, `Skipped:`, or
`Skip reason:` under each. This is a cheap "but for real" reality check by the
implementer; it does not replace reviewer / QA / security / adversarial review.
It must also include a task-scoped `QA coverage ledger` for non-doc
Review/Done tasks, with control inventory, baseline proof, candidate proof,
data-path proof, untested rows, and PASS/FAIL result. `scripts/feature-reconcile`
enforces these evidence shapes for large-tier code-bearing tasks in Review/Done
and rejects new Passing traceability claims unless the last
`scripts/feature-verify` status is current and strong enough.

## Local SDLC Memory

- The approved local advisory recall tool is `scripts/sdlc-memory`. It stores
  a SQLite database under `.sdlc-memory/`, which is ignored by git.
- Repo Markdown remains the source of truth. Use local memory to find likely
  context, then verify against `docs/features/`, `docs/principles/`, and the
  current git state before acting.
- Recommended cold-start flow:
  - `scripts/feature-context <feature-slug>`
  - `scripts/sdlc-memory search "<feature slug or issue>"`
  - `scripts/sdlc-memory context "<feature slug or issue>" --out /tmp/memory-context.md`
- Local memory supports persistent recall, FTS search, lightweight task/source
  links, content-hash staleness checks, and manual `remember` / `forget`.
- Do not commit `.sdlc-memory/`, generated memory exports, credentials, raw
  customer data, card data, or secrets. Memory is a local recall index, never
  the durable record of a decision.

## Agentic-craft principles (adopted 2026-06-30)

Owner-approved judgment rules distilled from external agentic-engineering
practice. Each is a citable leaf in `docs/principles/` (the rules live
there; this is just the map). Cite by name; do not restate inline.

- [[principle-weight-quality-over-dev-cost]] — when choosing between
  implementation/design options, don't over-weight development cost.
  Agents estimate effort in human time and under-value the better option.
  Decide on merit (correctness/scalability/maintainability). Not a license
  to over-engineer — YAGNI and smallest-scoped-change still govern.
- [[principle-reproduce-bugs-end-to-end]] — fix a user-facing bug only
  after reproducing it on the real user surface; a unit-test-only repro can
  pass while the product stays broken. Operationalized in the `Type: bug`
  EVIDENCE shape (`Repro surface:`).
- [[principle-tool-ergonomics]] — agent tool choice measurably affects
  token cost/latency/success. Prefer measured-efficient tools (e.g. `gh`
  CLI over a heavy GitHub MCP) and token-efficient output over verbose
  JSON; record the basis for a tool choice.
- [[principle-vet-third-party-skills]] — never install a third-party
  skill/plugin/MCP on popularity alone. A skill can run arbitrary commands
  and exfiltrate secrets, and high-star skills have measurably degraded
  agents. Require a security read + eval evidence; prefer first-party/vetted.
  Consistent with the existing "do not add global permission bypasses"
  stance.

These are cited by `planner`, `builder`, and `reviewer`; `/feature-review`
also persists a durable **Review risk assessment** to EVIDENCE.md so the
review-depth routing call is auditable rather than ephemeral.

## Cross-model review

Sanctioned wrappers provide cross-model perspective:

- `scripts/adversary-review` — 10-category adversarial pass
  (false-confidence, missed-edge, spec-loophole, hidden-coupling,
  negative-path, env-assumption, rollback-gap, stale-evidence,
  traceability-mismatch, tests-pass-behavior-wrong). Use for Claude-authored
  work reviewed by Codex CLI.
- `scripts/claude-adversary-review` — Claude Code adversarial wrapper. Use for
  Codex-authored work reviewed by Claude Code.
- `scripts/security-review` — STRIDE + PCI/auth/webhook/migration focus.

Both source `scripts/lib-sanitize.sh` for shared sensitive-data
sanitization before any context leaves the local machine. Patterns
cover secrets (PEM keys, AWS / Stripe / Slack / GitHub tokens, password=,
api_key=), card data (Visa/Mastercard/Amex/Discover/JCB BINs in
contiguous + spaced + hyphenated forms), labeled CVV/expiry, and US
SSN shape.

The bash guard hook blocks raw `codex` invocation. Only the sanctioned wrappers
may invoke Codex. If the required opposite-tool reviewer is unavailable, keep
the task in Review with `NEEDS_CROSS_MODEL_REVIEWER`; do not downgrade to
same-tool review.

## Severity budget

- **P0/P1** — mandatory. Unresolved P0/P1 blocks task Done and release.
- **P2** — capped at 5 active per feature.
- **P3** — collected for visibility, never blocks Done.

## Sanitizer exit codes

| Code | Meaning | Wrappers |
|---|---|---|
| `0` | Clean | all |
| `2` | Codex CLI unavailable | adversary-review, security-review |
| `3` | Usage error | all |
| `4` | Sanitization tripwire (assembled prompt) | adversary-review, security-review |
| `5` | Write failure | feature-arena |
| `6` | Sanitization tripwire (task-block / bundle) | feature-arena, feature-reflect, feature-why |

## Non-negotiable guardrails

- **No production deploys**, DNS / firewall changes, or live DB mutation.
- **No launch flag flips** that enable production behavior.
- **No raw card data, credentials, tokens, auth headers, webhook secrets**
  in any file, log, or commit. Sanitized field-shape examples only —
  the sanitizer enforces.
- **No force-push, history reset, `--no-verify`**, broad deletes, or
  destructive git operations. Enforced by `.claude/hooks/guard-bash.sh`.
- **Local / mock success is local / mock only.** Never bless production
  readiness without external evidence.

## Verification before "done"

`scripts/test-framework-v3` reports the framework's own self-test
results. Pre-merge:

```bash
scripts/test-framework-v3
# Should report all current AC suites passing.
```

For repo-global or multi-feature integration events, also run:

```bash
scripts/feature-verify --all-active fast
```
