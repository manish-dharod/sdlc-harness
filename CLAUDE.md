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

See `docs/AGENT_SDLC_WORKFLOW.md` for the full lifecycle and
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
- `/feature-context <slug>` — full rehydration for a feature.
- `/feature-next-task <slug>` — print next claimable task respecting
  the DAG.
- `/feature-claim <slug>` — interactive task claim.
- `/feature-amend <slug>` — record a spec amendment with impact
  analysis.

### Execution

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

### Release

- `/feature-reconcile <slug>` — validate control-plane consistency.
- `/feature-ready <slug>` — deterministic readiness verdict.

## Deterministic scripts (`scripts/`)

```bash
scripts/feature-init <slug> [--tier small|medium|large] [--spec path]
scripts/feature-context <slug>
scripts/feature-next-task <slug>
scripts/feature-verify <slug> fast|unit|full
scripts/feature-ready <slug>
scripts/feature-reconcile <slug>
scripts/worktree-hygiene <slug> [task-id] [--strict]
scripts/preflight-credentials <slug>
scripts/adversary-review <slug> [task-id] [review|review-strict]
scripts/security-review  <slug> [task-id] [review|review-strict]
scripts/feature-reflect <slug>
scripts/feature-why <slug> "<question>"
scripts/feature-arena <slug> <task-id> [N] [--force]
scripts/log-decision <slug> <decision> <rationale>
scripts/test-framework-v3
```

## Cross-model review

Two sanctioned wrappers invoke Codex CLI for cross-model perspective:

- `scripts/adversary-review` — 10-category adversarial pass
  (false-confidence, missed-edge, spec-loophole, hidden-coupling,
  negative-path, env-assumption, rollback-gap, stale-evidence,
  traceability-mismatch, tests-pass-behavior-wrong).
- `scripts/security-review` — STRIDE + PCI/auth/webhook/migration focus.

Both source `scripts/lib-sanitize.sh` for shared sensitive-data
sanitization before any context leaves the local machine. Patterns
cover secrets (PEM keys, AWS / Stripe / Slack / GitHub tokens, password=,
api_key=), card data (Visa/Mastercard/Amex/Discover/JCB BINs in
contiguous + spaced + hyphenated forms), labeled CVV/expiry, and US
SSN shape.

The bash guard hook blocks raw `codex` invocation. Only the wrappers
may invoke Codex.

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
# Should report: All AC-001..AC-007 + AC-009 + AC-010 checks pass.
```
