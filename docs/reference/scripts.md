# Script Reference

> **Layer 4 · Reference** — the gory details. ↑ [Start Here](../START_HERE.md) · [L2 Overview](../AGENT_SDLC_OVERVIEW.md) · [L3 Workflow](../AGENT_SDLC_WORKFLOW.md)

The scripts in `scripts/` are the deterministic truth layer of the harness — their exit codes are the contract that every gate, loop, and cross-agent handoff branches on, not model opinion.

Every script is invoked as `scripts/<name>`. Shell entry points remain Bash
3.2 compatible (the macOS default); Python-backed tools such as
`feature-increment` require Python 3. They take no global side effects beyond
writing to the feature control plane and local `.sdlc/` state. None deploy,
mutate production, flip flags, or push.

## Exit-code grammar

Most scripts share a common exit-code vocabulary. Where a script defines its own meaning, the per-script table below is authoritative.

| Exit | Meaning |
|---|---|
| `0` | Clean / verdict OK |
| `1` | Drift / failure / blocked (needs more agent work) |
| `2` | Tool unavailable, or NEEDS-APPROVAL, or context-specific second state |
| `3` | Usage error / file-not-found |
| `4` | Sanitization tripwire OR eligibility refusal |
| `5` | Owner-feedback/planner-transition stop for `feature-next-task`, or write failure where documented |
| `6` | Sanitization tripwire on an assembled bundle |

## Lifecycle

These are the day-to-day scripts an adopter runs to drive a feature from intake to release.

| Script | Usage signature | What it does | Exit codes |
|---|---|---|---|
| `feature-init` | `scripts/feature-init <slug> [--tier small\|medium\|large] [--spec path]` | Scaffolds a new feature control plane by copying the tier-appropriate template into `docs/features/<slug>/` and writing a `.tier` marker. Optionally inlines a spec file. Pure file scaffolding — invokes no agent. Tier defaults to `large`. | `0` scaffolded · `1` target already exists / missing template / spec not found · `2` usage |
| `feature-context` | `scripts/feature-context <slug>` | Prints durable feature state: git state, read order, open/blocked tasks, active findings, and the next-step protocol. Read-only rehydration. Invokes an optional adopter domain-context script if one exists. | `0` printed · `1` feature not found · `2` usage |
| `feature-increment` | `scripts/feature-increment <check\|current\|route\|ready\|final> <slug> [INC-###]` | Validates and routes feedback-gated increments: task ownership, proof completeness, build-ahead prevention, append-only owner feedback, and final owner acceptance. Marker-free features are explicit legacy skips. | `0` valid/route ready · `1` invalid or gate blocked · `3` usage / feature error |
| `feature-next-task` | `scripts/feature-next-task <slug>` | Prints the next claimable current-increment task respecting the `Depends-on` DAG. Activated features stop at feedback or planner-transition boundaries. Gated on strict worktree hygiene. | `0` task printed · `3` none claimable · `5` feedback/transition stop · `1` parse/state error · `2` usage · `4` dirty tree (re-run with `HYGIENE_BYPASS=1` to override) |
| `feature-verify` | `scripts/feature-verify <slug> [fast\|unit\|full]`  ·  `scripts/feature-verify --all-active [fast\|unit\|full]`  ·  `scripts/feature-verify --resolve-profile <slug>` | Runs feature-level verification: framework checks, tier-aware file presence (including `INCREMENTS.md` when activated), declared credential preflight (non-fast modes), then auto-discovers and runs `scripts/<slug>-verify` if present. `--all-active` sweeps every active feature and fails if any does. `--resolve-profile` reports the same executable domain script without running framework, feature-state, or domain checks. | `0` passed / profile resolved · `1` failed, feature/profile missing, or any all-active feature failed · `2` usage |
| `feature-ready` | `scripts/feature-ready <slug>` | Deterministic release-readiness verdict over increment acceptance, STATE / TASKS / FINDINGS / TRACEABILITY / RELEASE_GATES / APPROVALS, template-population state, and artifact-hygiene patterns. The release agent must agree with this verdict. | `0` READY · `1` BLOCKED (a non-approval gate fails) · `2` NEEDS-APPROVAL (only blocker is a human sign-off) · `3` usage / feature not found |
| `feature-reconcile` | `scripts/feature-reconcile <slug> [options]` | Validates activated increment sequencing, then checks that STATE agrees with TASKS / FINDINGS / TRACEABILITY and enforces the durable adversarial, evidence, dependency, and stale-claim gates. | `0` consistent · `1` drift detected · `3` usage error |

## Cross-model review

These wrappers invoke a different tool/model family for cross-model perspective on a diff. See [The cross-model wrappers](#the-cross-model-wrappers) below for why they are the only sanctioned path to a third-party model.

| Script | Usage signature | What it does | Exit codes |
|---|---|---|---|
| `adversary-review` | `scripts/adversary-review <slug> [task-id] [review\|review-strict]` | Default Claude → Codex adversarial review. Assembles a narrow, sanitized context package (diff, task block, DESIGN anchor, AC IDs, TRACEABILITY rows, recent EVIDENCE / FINDINGS) and sends it to the reviewer CLI. Captures the transcript to a gitignored artifact under `docs/features/<slug>/adversary/`. | `0` reviewer ran (agent reads the artifact to grade) · `2` reviewer CLI unavailable — task stays Review with `NEEDS_CROSS_MODEL_REVIEWER` · `3` usage · `4` sanitizer tripwire |
| `claude-adversary-review` | `scripts/claude-adversary-review <slug> [task-id] [mode]` | Reverse direction — Codex-authored work reviewed by Claude. Thin wrapper that sets the reviewer backend to Claude Code and execs `adversary-review`, so it shares all of its behavior and exit codes. | same as `adversary-review` |
| `security-review` | `scripts/security-review <slug> [task-id] [review\|review-strict]` | Cross-model security review. Like `adversary-review` but pulls a security-focused context package (THREAT_MODEL, MIGRATION_PLAN, APPROVALS, RELEASE_GATES) and emits STRIDE-categorized findings. Artifact under `docs/features/<slug>/security/`. | `0` reviewer ran · `2` reviewer CLI unavailable (fall back to direct review per routing rules) · `3` usage / feature missing · `4` sanitizer tripwire |
| `review-attempt` | `scripts/review-attempt <validate\|status\|next-attempt\|write\|latest-retryable> ...` | Metadata helper for the review wrappers. Validates wrapper output, reports a status (`clear` / `findings` / `timeout` / `incomplete` / `invalid-output` / `unavailable`), and writes a machine-readable sidecar so orchestration can route retry / resume. | `0` command succeeded · `1` invalid/incomplete output or no retryable attempt found · `3` usage / invalid argument |

## Supervisor / capsule

For supervisor-mode autonomous campaigns, implementation workers are launched only through these capsule scripts. They validate the capsule contract, pin model/effort, capture an artifact, and reject any write outside the task's declared file ownership.

| Script | Usage signature | What it does | Exit codes |
|---|---|---|---|
| `agent-capsule-plan` | `scripts/agent-capsule-plan <slug> [task-id] [agent]` | Generates a Markdown capsule contract from `TASKS.md` (or `FEATURE.md` for small tier). With no task-id, uses hygiene-aware routing: the active Claimed/Review task, else the next claimable task. | `0` capsule written · `1` no eligible task / routing failure · `3` usage / feature not found |
| `agent-capsule-check` | `scripts/agent-capsule-check <capsule.md>` | Validates a capsule before launch: required operating context (Goal, task, agent, worktree, base commit, spec anchors, hard invariants), safety language, a checkpoint target, and no unsafe authorization lines. | `0` valid · `1` validation failed · `3` usage / file not found |
| `agent-capsule-run` | `scripts/agent-capsule-run <slug> <task-id> <capsule.md>` | Internal common runner. Requires `AGENT_CAPSULE_WORKER_TOOL`; do not call directly — use a sanctioned wrapper below. Runs the worker, then rejects the result if it touched paths outside the capsule's Owned files. | `0` worker completed in scope · `1` worker wrote outside ownership (left for review) · `2` worker exited non-zero · `3` usage / invalid worker tool |
| `codex-capsule-run` | `scripts/codex-capsule-run <slug> <task-id> <capsule.md>` | Sanctioned supervisor → Codex CLI worker. Sets the worker tool to `codex-cli`, runs `agent-capsule-run`, and emits a CSI capture row. | passes through `agent-capsule-run` |
| `claude-capsule-run` | `scripts/claude-capsule-run <slug> <task-id> <capsule.md>` | Sanctioned supervisor → Claude Code worker. Sets the worker tool to `claude-code`, runs `agent-capsule-run`, and emits a CSI capture row. | passes through `agent-capsule-run` |

## Self-improvement

The compounding-learning loop. These scripts mine durable artifacts for recurring patterns, distill them into insight (INS) items, gate promotions, and keep the insight index current. No script in this group applies a patch, pushes, merges, or changes branches — promotion is a policy verdict only.

| Script | Usage signature | What it does | Exit codes |
|---|---|---|---|
| `feature-reflect` | `scripts/feature-reflect <slug> [--dry-run\|--full]` | Gathers a feature's durable artifacts (SPEC / DESIGN / TASKS / EVIDENCE / LEARNINGS / RUNS / FINDINGS plus framework docs) into a single timestamped, sanitized context bundle for the `/feature-reflect` command to mine. Invokes no LLM. | `0` bundle written · `3` missing feature / usage · `5` write failure · `6` sanitizer refused the bundle |
| `feature-learn` | `scripts/feature-learn <slug> [task-id] [--run-kind k] [--status ...] [--mode ...] [--source path]` | Captures a bounded post-run learning artifact (tails of source / EVIDENCE / FINDINGS / RUNS) into `learnings/` and appends the feature's `LEARNINGS.md` ledger, so a later reflect run can spot repeat patterns. Auto-applies nothing. | `0` artifact written · `3` usage / missing feature · `5` write error · `6` sanitizer refused |
| `reflect-harness` | `scripts/reflect-harness [--since YYYY-MM-DD] [--dry-run] [--capture-dir dir] [--out path]` | Distills CSI capture logs (`.sdlc/capture`) into proposed INS items and eval-corpus candidates, sanitized. It filters only exact successful hook/capsule boilerplate, reports `Rows skipped noise`, and preserves failures and blocks. `--dry-run` writes the proposal bundle without persisting. | `0` proposal bundle written · `3` usage / environment / IO error · `4` sanitizer tripwire |
| `harness-eval` | `scripts/harness-eval <candidate-result-file>` | Evaluates a candidate promotion against the CSI regression corpus. Passes only when there are no regressions, no missing corpus guards, and at least one `fail→pass` improvement. | `0` promotable · `1` not promotable · `3` usage / file not found |
| `harness-promote` | `scripts/harness-promote <INS-###\|candidate-file>` | Policy gate that classifies an insight promotion. Never applies, pushes, or merges. | `0` auto-structural · `1` reject · `2` human-gate · `3` usage / malformed candidate |
| `insight-index` | `scripts/insight-index [--check]` | Regenerates `docs/insights/INDEX.md` from INS item frontmatter (the index is generated, never hand-edited). `--check` verifies it is current. | `0` regenerated / current · `1` stale or items malformed (`--check`) · `3` usage |
| `continuous-self-improvement-loop-verify` | `scripts/continuous-self-improvement-loop-verify [fast\|unit\|full]` | Portable public-repository packaging profile for the CSI mechanism: checks and sanitizes the CSI scripts/docs shipped here; `unit` and `full` also syntax-check the shipped shell entry points and exercise portable guard-capture/noise-filter fixtures. Adopter-owned feature docs, insight ledgers, corpora, and deeper domain tests are intentionally not assumed. | `0` passed · non-zero on failure · `3` usage |

## Safety & utility

Shared safety tripwires, preflight checks, and config loading. Several of these are sourced by other scripts as libraries as well as run standalone.

| Script | Usage signature | What it does | Exit codes |
|---|---|---|---|
| `sanitize-check` | `scripts/sanitize-check <file>...`  ·  `scripts/sanitize-check --staged`  ·  `scripts/sanitize-check --changed [base]` | File-mode wrapper around the sanitizer library. Scans named files (or git staged / changed files) for secret / card / CVV / expiry / PII shapes and prints a clear pass/fail summary. This is the obvious entrypoint — running `lib-sanitize.sh` directly only runs its self-test. | `0` all clean · `4` at least one file tripped a pattern · `3` usage / argument error |
| `approvals-pending` | `scripts/approvals-pending [--as-of YYYY-MM-DD] [--features-dir path]` | Reads only canonical `docs/features/*/APPROVALS.md` blocks and prints a deterministic age-ranked queue split into owner action, external/joint action, and future-autonomy decisions. It never edits approvals. Ambiguous legacy metadata is classified conservatively as external/joint. | `0` queue printed · `2` argument parsing error · `3` feature directory/read error |
| `preflight-credentials` | `scripts/preflight-credentials <slug>` | Runs only the external-API credential commands explicitly declared as `Preflight command:` lines in the feature's `DESIGN.md`. Prints each literal command before running it (reference env vars, never raw secrets). | `0` none declared OR all passed · `1` at least one failed · `3` usage / feature not found |
| `sdlc-doctor` | `scripts/sdlc-doctor [--quiet]` | Read-only harness health check. Required framework components produce FAIL; optional tools (Codex CLI, `gh`, notify command) produce WARN. Run before orchestration. | `0` healthy · `1` a required component is missing · `3` unknown arg |
| `sdlc-maintain` | `scripts/sdlc-maintain [--quiet] [--as-of YYYY-MM-DD]` | Runs the shipped local-only maintenance checks (doctor, pending approvals, memory ingest/staleness, backlog index, CSI dry-run, plus the insight index when an adopter has installed `docs/insights/INDEX.md`) and writes a report under gitignored `.sdlc/maintenance/`. It invokes no network client or LLM and changes no tracked files. | `0` all checks passed · `1` one or more checks failed · `3` usage / IO error |
| `worktree-hygiene` | `scripts/worktree-hygiene <slug> [task-id] [--strict]` | Pure reporter — never stages, stashes, or resets. Maps every dirty path against the active Claimed task's declared file ownership and emits a verdict. `--strict` makes even in-scope dirtiness non-zero (use at task boundaries). | `0` CLEAN or DIRTY_OWNED · `1` DIRTY_NO_TASK / DIRTY_OWNED with `--strict` / lookup error · `2` DIRTY_MIXED (paths outside ownership) · `3` usage / feature missing |
| `load-config` | `. scripts/load-config` | Sourced by framework scripts to load simple top-level keys from `sdlc.config.yml` into the environment. Caller-set env vars win over file values. No-op if the config file is absent. | sourced — see script |

## Local memory

A local advisory recall index over the repo's durable Markdown. The repo stays the source of truth; memory only surfaces likely context faster. It stores a SQLite database under `.sdlc-memory/` (gitignored) and never holds secrets, card data, or PII — titles are redacted at rest.

| Script | Usage signature | What it does | Exit codes |
|---|---|---|---|
| `sdlc-memory` | `scripts/sdlc-memory <init\|ingest-feature <slug>\|ingest-all-features\|remember\|search\|context\|stale\|verify-source\|forget> [--db path] [--out path]` | Builds and queries the local recall index: ingests `docs/features/`, `docs/principles/`, and workflow docs; FTS + LIKE-fallback search; `context` writes a sanitized Markdown briefing; content-hash staleness checks; source-backed manual records activate while unsourced records remain warning/unverified. | `0` ok · `1` `verify-source` lacks a current source · other non-zero on usage / IO error |

## Tests

| Script | Usage signature | What it does | Exit codes |
|---|---|---|---|
| `test-sdlc-memory` | `scripts/test-sdlc-memory` | Standalone self-test for the local memory tool (ingest dedup, staleness, redaction-at-rest, FTS fallback, WAL mode, link bounding). | `0` all passed · `1` at least one failed |
| `test-approvals-pending` | `scripts/test-approvals-pending` | Fixture coverage for canonical approval parsing, exclusion rules, deterministic age/order, and conservative category routing. | `0` all passed · `1` at least one failed |
| `test-sdlc-maintain` | `scripts/test-sdlc-maintain [fast\|unit\|full]` | Stubbed maintenance/report invariants; `full` also runs the real local suite and proves the tracked worktree is unchanged. | `0` all passed · `1` at least one failed · `3` usage |
| `test-framework-v3` | `scripts/test-framework-v3 [--verbose]` | The harness self-test. Validates the example feature's acceptance criteria and the framework wiring. Detects whether it is running in the framework repo or an adopter's template-clone and skips framework-only checks accordingly, so the expected pass count differs between the two. | `0` all checks pass · `1` at least one check failed · `3` usage |
| `test-guard.sh` | `.claude/hooks/test-guard.sh`  ·  `VERBOSE=1 .claude/hooks/test-guard.sh` | Smoke test for the bash guard hook. Asserts destructive and legacy-framework commands are blocked (the hook exits 2) and benign commands are allowed. Quiet on pass, loud on fail; `VERBOSE=1` prints every case. Run it whenever you change `guard-bash.sh`. | `0` all assertions passed · `1` one or more failed |

## The cross-model wrappers

`scripts/adversary-review`, `scripts/claude-adversary-review`, and `scripts/security-review` are the **only sanctioned path to invoke Codex** (or another third-party model family) from the harness. They matter for three reasons:

- **The guard hook blocks everything else.** `.claude/hooks/guard-bash.sh` intercepts and blocks any raw `codex` / `codex exec` invocation from Claude's Bash tool. These wrappers run as child processes, so their internal model call is not re-checked — that is exactly why they are the controlled aperture, and why no other path is allowed.
- **They sanitize before sending.** Each wrapper sources `scripts/lib-sanitize.sh` and scans the entire assembled prompt for secret / card / CVV / expiry / PII shapes before any context leaves the machine. A tripwire fires **exit 4** and nothing is sent.
- **They fail closed on unavailability.** When the reviewer CLI is not on `PATH`, the wrapper exits **2**. There is no silent fallback to same-model review: the calling agent must leave the task in Review with a `NEEDS_CROSS_MODEL_REVIEWER` approval (security may fall back to a direct review per its routing rules).

Transcripts land in gitignored local artifacts under `docs/features/<slug>/{adversary,security}/`. Record the artifact path in `EVIDENCE.md` so `scripts/feature-reconcile` can confirm the local file exists and its model header matches the recorded reviewer model — do not commit the transcripts themselves.

---

**Related:** [commands.md](commands.md) · [agents.md](agents.md) · [control-plane.md](control-plane.md) · [config.md](config.md)
