# Agents (roles) reference

> **Layer 4 · Reference** — the gory details. ↑ [Start Here](../START_HERE.md) · [L2 Overview](../AGENT_SDLC_OVERVIEW.md) · [L3 Workflow](../AGENT_SDLC_WORKFLOW.md)

The harness ships five role agents — `planner`, `builder`, `reviewer`, `security`, and `release` — each defined in `.claude/agents/<name>.md`; this page documents what each one owns, the phases or modes it runs in, the task-state transitions it is allowed to make, and the iron laws it enforces.

## At a glance

A role can do several related jobs: `planner` carries a **Phase** (`intake` | `design` | `plan`) and `reviewer` carries a **Mode** (`quality` | `qa` | `adversarial` | `acceptance`), selected by a line in the invocation prompt. Every agent's default model is declared in its file's frontmatter `model:` field.

| Agent | Phases / Modes | Default model | One-line responsibility |
|---|---|---|---|
| `planner` | Phase: `intake`, `design`, `plan` | `opus` | Turn the owner's request into requirements, an approved design, and an ordered DAG of file-scoped tasks. |
| `builder` | implementation | `opus` | Claim one Open task whose deps are Done and make the smallest scoped code change, with TDD + evidence. |
| `reviewer` | Mode: `quality`, `qa`, `adversarial`, `acceptance` | `opus` | Review a diff (or the finished feature) for correctness, verification, hidden failure, and spec conformance. Files findings; never edits product code. |
| `security` | security review | `opus` | Review PCI / secrets / auth / webhook / migration / launch-gate risk against `THREAT_MODEL.md`. |
| `release` | readiness | `opus` | Read-only READY / BLOCKED / NEEDS-APPROVAL verdict from `scripts/feature-ready` + the control plane. |

### The model-assignment principle

The intended assignment principle is: **Opus where the work is judgment-heavy and high-stakes; Sonnet where it is high-volume and well-scoped; Haiku for read-only mechanical roles.** Under that principle the judgment-heavy roles (`planner` design synthesis, `security` PCI/auth judgment, `reviewer`'s `adversarial` and `acceptance` modes) sit at Opus, a high-volume well-scoped role like `builder` sits at Sonnet, and a purely mechanical read-only verdict like `release` sits at Haiku.

As shipped, **every agent's frontmatter pins `model: opus`** — the conservative default for a safety-gated harness. Tune per role by editing the `model:` field, or override for a single run with the Agent tool's `model` parameter. Resolution order: env var `CLAUDE_CODE_SUBAGENT_MODEL` → invocation `model` param → frontmatter → parent session.

---

## `planner`

`tools: Read, Edit, Write, Bash, Grep, Glob` · `model: opus`

Runs the front half of the lifecycle in three sequential phases. It reads a `Phase:` line from the invocation prompt; if absent, it detects the phase from `STATE.md` and the SPEC/DESIGN status and states the detected phase in its output.

| Phase | What it does | Key gate it produces |
|---|---|---|
| `intake` | Extract acceptance criteria (`AC-###`) and non-functional requirements (`NFR-###`) from the owner's spec; surface ambiguities into `QUESTIONS.md`; write `REQUIREMENTS.md`. | `QUESTIONS.md` has zero entries that `Block: design`/`Block: tasks`. |
| `design` | Survey the codebase, write `DESIGN.md`, and the large-tier companions (`TEST_STRATEGY.md`, `THREAT_MODEL.md`, `MIGRATION_PLAN.md`, `ROLLBACK_PLAN.md`). | `DESIGN.md` reaches `Status: Approved` — the gate that unblocks Backlog→Open. |
| `plan` | Decompose the approved design into a DAG of file-ownership-scoped tasks; maintain `STATE.md`, `TASKS.md`, `DECISIONS.md`, `RELEASE_GATES.md`, `APPROVALS.md`. | Tasks move `Backlog → Open` only when every precondition holds. |

**Hand-off / state transitions it owns:**

- Moves `STATE.md` `verdict` through `intake → design → implementation → review → blocked → staging → release-ready`.
- Moves tasks `Backlog → Open`, and — during state hygiene — performs the `Review → Done` flip once the adversarial trail is on the books and the worktree is clean.
- Opens `APV-###` approval entries (with stop-reason codes) for every human signoff the feature needs.

**Backlog→Open preconditions (all must hold):** SPEC has ≥1 AC; `DESIGN.md` is `Approved`; no `Blocks: tasks` question is Open; the task cites ≥1 AC ID; the task declares a `Depends-on` set; all `Depends-on` tasks are `Done`; and any required verification gate is already green on the current base (opening a task over a red required gate is forbidden).

**Must NOT:** write product code (that's `builder`), write to `FINDINGS.md` (that's `reviewer`/`security`), write verification results to `EVIDENCE.md` (that's `reviewer` Mode: qa), invent ACs or NFR thresholds (open a question instead), move `DESIGN.md` to `Approved` with open design questions, mark a `Blocked` task `Done` without external evidence, or deploy / flip launch flags.

**Iron laws & required skills:** intake **must** be driven through the `superpowers:brainstorming` skill before any AC IDs are written (it enforces a HARD-GATE: no implementation until a design is approved). Two file-ownership invariants in plan phase: no two `Open`/`Claimed` tasks may declare the same file path, and `high`-risk tasks on a qualifying surface (migration / PCI / payment / launch-flag / vendor) should recommend `/feature-arena` in the task notes.

**Principles cited (by name, not restated):** `boundary-discipline`, `preserve-domain-invariants`, `prove-it-works`, `no-sensitive-domain-data`, `no-production-deploys-from-loop`, `encode-lessons-in-structure`.

---

## `builder`

`tools: Read, Edit, Write, Bash, Grep, Glob, NotebookEdit` · `model: opus`

Implements **one** claimed task with the smallest scoped change — no drive-by refactors, no scope creep, no contract drift. It starts by reading the `Routing suggestion:` line from `scripts/worktree-hygiene` and dispatches: `new-task` → claim the next DAG-clear task; `resume-claimed:<id>` → continue in-flight work; `resume-review:<id>` → hand back (builder does not pick up review); `halt-*` → stop on a polluted tree.

**Hand-off / state transitions it owns:** the normal transition for a code-bearing task is `Claimed → Review`, **not** `Claimed → Done`. Builder writes the diff, runs verification, and hands off to `/feature-review`. A task may only reach `Done` after every routed reviewer mode + `security` have cleared the exact diff and all P0/P1 findings are resolved; the `Review → Done` flip can be done by `builder` (after re-verification) or by `planner (Phase: plan)`. Pure control-plane/doc tasks with no code diff may transition straight to `Done` (with an adversarial "skipped by routing rule" trail entry).

**Iron laws for completion (a task can leave `Claimed` only when all hold):**

1. **Verification iron law** — no completion claim without fresh, in-message verification output (`superpowers:verification-before-completion`).
2. **Pre-review self-audit gate** — before handoff, name ≥3 plausible ways the diff could still be wrong, run one concrete check each, and end with an **AC-clause coverage table** (one row per clause of every AC, each pointing at diff evidence or marked `UNMET — routed to <FND/TASK/AMENDMENT>`). A red required gate may not be prose-waived ("identical on master" is a diagnosis, not a waiver) — fix it or file a FINDINGS/APPROVALS blocker.
3. **Adversarial-review iron law** — a code-bearing task cannot reach `Done` until `reviewer (Mode: adversarial)` records an "Adversarial review clear" / "skipped by routing" entry, or opens findings where every P0/P1 is `Fixed`/`False positive`.
4. **Worktree hygiene iron law** — `scripts/worktree-hygiene` must report `CLEAN` (or `DIRTY_OWNED` at `Claimed → Review`) at every boundary; `Review → Done` requires `CLEAN`. `DIRTY_MIXED` / `DIRTY_NO_TASK` is a hard stop. The framework never auto-stashes, auto-resets, or auto-commits.
5. **Review hand-off rule** — only `builder` or `planner (Phase: plan)` performs the `Review → Done` flip, and only with the adversarial trail recorded and a clean strict-hygiene verdict.

**Required Superpowers skills:** `superpowers:test-driven-development` (before any production code — no production code without a failing test first), `superpowers:systematic-debugging` (the moment verification fails — no fix without root-cause investigation), `superpowers:verification-before-completion` (before Review/Done).

**Must NOT:** leave its declared file ownership, change a DESIGN contract without `/feature-amend` first, force-push / history-reset / `--no-verify` / broad-delete, fix out-of-ownership issues inline (open a Backlog task instead), or change product code to "fix" a flaky test (re-run 3×, then quarantine + open a P2).

**Principles cited:** `prove-it-works`, `fix-root-causes`, `boundary-discipline`, `no-sensitive-domain-data`, `preserve-domain-invariants`, `no-production-deploys-from-loop`, `encode-lessons-in-structure`.

---

## `reviewer`

`tools: Read, Edit, Bash, Grep, Glob` · `model: opus`

Operates in one of four **modes**, selected by a required `Mode:` line in the invocation prompt (if missing, it stops and asks — it does not guess). It **never modifies product code**; it files findings or appends EVIDENCE entries. **P0/P1 findings from any mode block task `Done`.** Every mode starts by reading the `scripts/worktree-hygiene` verdict — a `DIRTY_NO_TASK` / `DIRTY_MIXED` tree means the diff in front of it isn't the claimed task's work, so it stops and files a P1.

| Mode | What it does |
|---|---|
| `quality` | Style, correctness, design-conformance, and TRACEABILITY discipline on one diff. Does an AC-clause coverage walk **first** (an unmet clause with `Passing` traceability = P1). Severity budget: P0/P1 mandatory, P2 capped at 5 active, P3 collected (never a fix iteration). Defers PCI/auth/webhook scope to `security`. |
| `qa` | Runs the smallest sufficient `scripts/feature-verify <slug> fast\|unit\|full`, applies the flake-quarantine policy, updates `TRACEABILITY.md` test status, and records evidence. If no profile exists it **bootstraps** `scripts/<feature>-verify` and wires it in — the one case where qa edits repo scripts. For UI/full checks it uses the source-grounded test-plan + step-annotation report shape and an anti-cheating note. |
| `adversarial` | The second perspective: "how is this still wrong even though the normal gates passed?" Works the **10-category frame** (false-confidence, missed-edge, spec-loophole, hidden-coupling, negative-path, env-assumption, rollback-gap, stale-evidence, traceability-mismatch, tests-pass-behavior-wrong). Reads the actual test assertion code, not test names. |
| `acceptance` | Final spec-conformance audit — "did we build the right thing?" Walks every AC and NFR in TRACEABILITY, checks DESIGN-contract drift and negative-test coverage, and rewrites the coverage summary. Read-only on product code; runs at end-of-feature, not on every diff. |

**Cross-model requirement (adversarial mode):** for a code-bearing task that will transition to `Done`, same-model adversarial review is **not** acceptable — the reviewer must invoke `scripts/adversary-review` so the pass runs on a different tool family (Codex CLI; Claude-authored work → Codex, Codex-authored work → Claude via `scripts/claude-adversary-review`). The EVIDENCE trail entry must declare `Implementer tool`, `Implementer model`, `Reviewer tool`, `Reviewer model`, and the Codex artifact path; `scripts/feature-reconcile` enforces that the tools differ and the reviewer model matches the pinned cross-model model. If Codex is unavailable (wrapper exit 2), the task stays in `Review` and an `APPROVALS` entry opens with stop reason `NEEDS_CROSS_MODEL_REVIEWER` — **no silent fallback** to same-model review, and no faking a successful Codex review.

**Optional skill (quality mode):** `superpowers:requesting-code-review` for high-risk diffs (payment/secrets/auth/webhook surfaces, migrations with backfill, default-ON flags, >300 LOC across >5 files, or the final pre-acceptance review); default is direct review.

**Hand-off:** files findings back into the feature folder for `builder` to fix; `acceptance` mode hands off to `release` when zero P0/P1 remain, otherwise back to `planner (Phase: plan)` to open follow-ups. Reviewer does **not** flip task state itself — it recommends the next role.

**Must NOT:** rewrite or weaken product code, expand scope beyond the current diff, mark unverified suggestions as confirmed, treat `Skipped` as passing, mark a TRACEABILITY row `Passing` without reading the test code, or invoke `codex` directly (only via the sanctioned wrappers).

**Principles cited:** `prove-it-works`, `fix-root-causes`, `boundary-discipline`, `encode-lessons-in-structure`, `no-sensitive-domain-data`, `preserve-domain-invariants`.

---

## `security`

`tools: Read, Edit, Bash, Grep, Glob` · `model: opus`

Reviews the current diff for security and launch-gate risk against `THREAT_MODEL.md` and `MIGRATION_PLAN.md`. Runs **alongside** `reviewer (Mode: quality)`, not instead of it, and stays narrow — it does not duplicate general code review. Scope: PCI / card handling, secrets, PII, auth/session, webhook validation, logging/cache leakage, dependency/config risk, migration safety, and the production launch gate.

**Cross-model (optional but recommended):** if `scripts/security-review` and Codex are available, it is the preferred primary pass for high-risk surfaces (PCI vault, carrier sandbox, auth bypass, migration with backfill) — the wrapper sends a STRIDE-categorized prompt to a different model with `THREAT_MODEL.md`/`MIGRATION_PLAN.md` in context. If the wrapper reports `codex CLI unavailable` (exit 2), it proceeds with direct Claude-internal review and notes the limitation — security review is **recommended**, not hard-required, so exit 2 is handled by routing rather than blocking. Every "Confirmed" finding the wrapper proposes must be re-validated against the cited file/line before it is opened.

**Threat-model coverage check:** for each diff hunk, it maps to a `THREAT_MODEL.md` threat. A diff that opens a new attack surface not in the model is a P1 "Threat model gap" finding, handed back to `planner (Phase: design)`.

**Severity rubric (overrides the general one):** P0 = raw secrets / PCI / PII exposure, signature or auth bypass, credentials in repo or logs, swapped ID mapping in a migration, real-carrier-traffic gate failing. P1 = missing replay/idempotency, weak validation, log/cache leakage, missing rate-limit, known-vuln dependency, threat-model gap. P2/P3 = hardening without active exploit risk.

**Hand-off:** opens `APPROVALS.md` entries with the matching stop-reason code (`NEEDS_CREDENTIAL_ROTATION`, `NEEDS_COMPLIANCE_SIGNOFF`, `NEEDS_CARRIER_DOC`, `NEEDS_STAGING_ACCESS`, `NEEDS_EXTERNAL_EVIDENCE`) and **blocks release** while any unresolved P0/P1 security finding exists.

**Must NOT:** bless production deploys, credential rotations, or launch-flag flips; attempt to fix anything requiring external rotated credentials / sandbox / vendor docs / compliance signoff (open a `Blocked` finding + an APPROVALS entry instead); or paste raw secrets / cards / webhook bodies.

**Principles cited:** `no-sensitive-domain-data` (central), `boundary-discipline`, `preserve-domain-invariants`, `no-production-deploys-from-loop`, `prove-it-works`.

---

## `release`

`tools: Read, Bash, Grep, Glob` (no Edit) · `model: opus`

**Read-only release-readiness analysis.** It does not deploy, flip flags, mutate production data, edit product code, or modify task state — it reports a verdict; `planner (Phase: plan)` owns the transitions. It runs `scripts/feature-ready` (exit `0` READY / `1` BLOCKED / `2` NEEDS-APPROVAL) and, for risky surfaces, `scripts/feature-verify <slug> full`, then emits the `## Release verdict:` block verbatim.

`scripts/feature-ready` checks: zero `Open`/`Claimed`/`Review` tasks; zero unresolved P0/P1 findings; a TRACEABILITY coverage summary with no "no tests", no failing tests, and no unmeasured NFRs; every `RELEASE_GATES.md` gate `[P]` or pointing at an APPROVALS blocker; every `APPROVALS.md` entry `Approved`/`Withdrawn` with none `waiting_on_human: true`; `feature-verify full` passing (or a recorded blocker); and no secrets / raw payloads / generated bundles / build artifacts in the diff.

**Iron law:** if the script disagrees with the agent's own read of the files, **trust the script** and investigate the divergence. If `reviewer (Mode: acceptance)` has not run since the latest code change, it must return NEEDS-APPROVAL with `Required next action: invoke reviewer (Mode: acceptance)`.

**Principles cited:** `no-production-deploys-from-loop`, `prove-it-works`.

---

## How they hand off

The flow is a pipeline with a parallel review fan-out in the middle:

```text
planner (intake → design → plan)
        │  Open task, deps Done
        ▼
builder  ── Claimed → Review ──┐
                               ▼
        ┌─────────── /feature-review (parallel) ───────────┐
        │  reviewer (quality)   reviewer (qa)              │
        │  reviewer (adversarial)   security               │
        └──────────────────────────────────────────────────┘
                               │  all clear, P0/P1 resolved
                               ▼
        builder / planner ── Review → Done
                               │  feature complete
                               ▼
        reviewer (acceptance) ──→ release  (READY / BLOCKED / NEEDS-APPROVAL)
```

- `planner` produces the requirements, the approved design, and the task DAG; nothing moves Backlog→Open until the design is `Approved`.
- `builder` claims one DAG-clear task and transitions it `Claimed → Review`.
- `/feature-review` spawns the **independent reviews in parallel** — `reviewer` in `quality`, `qa`, and `adversarial` modes plus `security` once — all looking at the same diff for different failure classes and writing findings back into the same feature folder. Risk routing applies (e.g. `security` is skipped for docs-only diffs; adversarial runs in lightweight skip mode for docs-only).
- A task reaches `Done` only after every routed reviewer mode + `security` clear it and all P0/P1 findings are resolved, with the cross-model adversarial trail on record and a clean worktree.
- At end-of-feature, `reviewer (Mode: acceptance)` walks the spec, then `release` emits the read-only verdict. Humans approve the risky boundaries via `APPROVALS.md`.

For longer autonomous runs, `/feature-loop` drives one iteration of this pipeline (claim/resume → build → parallel review → route findings → record evidence → readiness check), and `/loop /feature-loop <slug>` repeats it until the feature is done, blocked, stuck, or out of budget.

---

## Related

- [`commands.md`](commands.md) — the slash commands that drive these agents (`/feature-loop`, `/feature-review`, …).
- [`scripts.md`](scripts.md) — the deterministic gates (`feature-ready`, `feature-verify`, `worktree-hygiene`, the cross-model review wrappers).
- [`control-plane.md`](control-plane.md) — the per-feature Markdown files the agents read and write.
- [`config.md`](config.md) — `sdlc.config.yml` knobs (cross-model model pins, loop budgets, severity budget).
