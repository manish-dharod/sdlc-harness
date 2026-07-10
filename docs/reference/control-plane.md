# Control Plane Reference

> **Layer 4 · Reference** — the gory details. ↑ [Start Here](../START_HERE.md) · [L2 Overview](../AGENT_SDLC_OVERVIEW.md) · [L3 Workflow](../AGENT_SDLC_WORKFLOW.md)

Every feature is a folder under `docs/features/<slug>/`. That folder is the
feature's memory: spec, design, tasks, evidence, findings, approvals, and
release status all live as plain Markdown. Agents read and update these files
instead of relying on chat history. Deterministic scripts parse them to enforce
the gates.

This page is the exact spec for those files: which files exist at each tier,
what each file is for, who owns it, and the state machines the scripts enforce.

## Tiers

Pick the smallest tier that fits the change. The tier is recorded in a `.tier`
marker file in the feature folder; `scripts/feature-init <slug> --tier <tier>`
scaffolds the right set. It is cheaper to upgrade a tier early than to discover
mid-flight that the smaller tier was the wrong choice.

| Tier | Files | When to use |
|---|---|---|
| `small` | 1 (`FEATURE.md`) | 1–3 day scope, one developer. No database migration, no payment / auth / webhook surface, no PCI, no new external integration. |
| `medium` | 6 (`README`, `SPEC`, `DESIGN`, `INCREMENTS`, `TASKS`, `EVIDENCE`) | 1–2 week scope with feedback-gated INC-001. May touch the database (one or two migrations). Does **not** touch PCI / card data / auth / webhook signatures / production flags that default ON. No external-sandbox dependency, no compliance signoff. |
| `large` | 20 (full control plane below) | Default. Feedback-gated INC-001; PCI / payment / multi-team / launch-gated work, schema changes with backfill, anything that needs threat modeling or human approvals. |

The small and medium tiers fold multiple concerns into fewer files (for
example, the medium tier keeps the test strategy, rollback plan, traceability,
and findings inline rather than as separate files). They deliberately omit the
ceremony the large tier needs, because forcing unused scaffolding creates
documentation drift. If a small/medium feature grows a migration, a credential,
or a PCI/auth/webhook surface mid-flight, that is the signal to upgrade the
tier and pull in the full plane.

> Note: `scripts/feature-ready` and the adversarial-trail check in
> `scripts/feature-reconcile` are currently large-tier-aware. They may warn
> about missing files, or emit an INFO line and skip, for small/medium
> features. Treat that output as advisory at the smaller tiers.

## The full (large-tier) control plane

The large tier carries the complete set: the **19-file control plane** (the
numbered Spec → … → Loop files below) plus the `README.md` navigation file that
fronts the folder — 20 Markdown files in all. Files are listed in read order.
The "Owner role" column uses the five-agent vocabulary (`planner` with a phase
flag, `builder`, `reviewer` with a mode flag, `security`, `release`).

| Phase | File | Owner role | Purpose |
|---|---|---|---|
| Intake | `SPEC.md` | `planner (Phase: intake)` | The owner's raw spec pasted verbatim, plus extracted acceptance criteria (`AC-###`) and non-functional requirements (`NFR-###`). The source of truth for *what the feature is*. Every task cites at least one AC ID. |
| Intake | `QUESTIONS.md` | `planner (Phase: intake)` opens; owner answers | Spec ambiguities and decisions only a human can make. Each question marks what it `Blocks:` (tasks / design / none). A question with `Blocks: tasks` that is still `Open` freezes task intake. |
| Intake | `REQUIREMENTS.md` | `planner (Phase: intake)` | Structured restatement of `SPEC.md` organized for implementation: user stories (`US-###`), functional requirements (`FR-###`), NFRs, and an explicit list of edge cases and negative paths. Where SPEC is the owner's words, this is the agent's interpretation. |
| Design | `DESIGN.md` | `planner (Phase: design)` | Technical design: architecture, data model, API surface, happy-path and failure-path sequences, observability, declared credentials/external APIs, and the feature flag. Carries a `Status: Draft \| Approved`. Tasks cite design sections by anchor. |
| Design | `TEST_STRATEGY.md` | `planner (Phase: design)` → `reviewer (Mode: qa)` | Per-AC test matrix and per-NFR measurement plan, the negative-test list, the flake policy, and what each verify mode (`fast` / `unit` / `full`) runs. `reviewer (Mode: acceptance)` uses it to confirm every AC has a test before release. |
| Design | `THREAT_MODEL.md` | `planner (Phase: design)` → `security` | Whole-feature, strategic security analysis: trust boundaries, data classification, STRIDE threats with mitigations and residual risk, compliance scope, and required external evidence. Required before any task opens when the feature touches payment, auth, webhooks, secrets, PII, or credentialed external APIs. |
| Design | `MIGRATION_PLAN.md` | `planner (Phase: design)` → `security` | Schema/data migrations: each migration's type, DDL sketch, lock/row estimates, reversibility, backfill plan, rollback DDL, concurrent-write safety, and post-migration integrity checks. Required when the diff touches DDL, backfills, type changes, or ID-mapping. |
| Design | `ROLLBACK_PLAN.md` | `planner (Phase: design)` | How to undo the feature without data loss or downtime, in tiers: flag flip → code rollback → data rollback. States the triggers for each tier, the comms plan, and records the staging rollback test. Required for any flag-gated feature. |
| Plan / exec | `README.md` | `planner` | Feature overview: goal, scope, main areas, start commands, and the canonical read order for the control plane. The human entry point to the folder. |
| Plan / exec | `STATE.md` | `planner (Phase: plan)` | Current verdict plus a machine-readable YAML status block (open questions, open P0/P1, task counts, AC/NFR coverage) that scripts parse. Also holds feature metadata and the per-feature loop budget overrides. |
| Plan / feedback | `INCREMENTS.md` | `planner (Phase: plan)`; owner supplies verdict | The experiential delivery ledger. Each `INC-###` names one coherent user journey, Experience surface, Ship target, task IDs, verification, rollback, evidence, and append-only owner-feedback pointer. |
| Plan / exec | `TASKS.md` | `planner (Phase: plan)` | The DAG-aware task queue. Each `TASK-###` declares status, AC/NFR IDs, `Type:`, `Increment:`, design anchor, `Depends-on:` edges, intended file ownership, verification commands, and evidence pointers. Only current-increment tasks may advance. |
| Plan / exec | `DECISIONS.md` | `planner (Phase: plan)` | Durable, ADR-style decisions (`DEC-###`): product, architecture, security, workflow, launch. Point-in-time and stable; a reversed decision is superseded by a new entry, never edited in place. |
| Exec | `TRACEABILITY.md` | `builder` (per task) + `reviewer (Mode: qa)` (test rows) + `reviewer (Mode: acceptance)` (final audit) | The single matrix linking each chain `AC → DESIGN section → TASK → tests → evidence`, plus a machine-checkable coverage summary. `reviewer (Mode: acceptance)` walks it at release and refuses `READY` if any row is incomplete. |
| Exec | `FINDINGS.md` | `reviewer` (any mode) / `security` | The findings ledger (`FND-###`) with severity (P0–P3), status, source, and minimal fix. Holds the severity rubric and the severity budget. P0/P1 from any source block task `Done` and release. |
| Exec | `EVIDENCE.md` | `builder` / `reviewer (Mode: qa)` / `reviewer (Mode: adversarial)` | Append-only log of commands run, manual checks, artifacts, the pre-review self-audit, per-task-type artifacts (bug repro, perf baseline, UI screenshots, migration backfill/rollback), and the adversarial-review trail. Proof that things were actually run. No secrets — sanitized field shapes only. |
| Release | `APPROVALS.md` | `planner (Phase: plan)` opens; owner approves; `release` gates | Human-only signoffs (`APV-###`) as machine-checkable records, each with `waiting_on_human: true/false` and a stop-reason code. The framework cannot grant these; `scripts/feature-ready` detects a waiting approval without re-interpreting prose. |
| Release | `RELEASE_GATES.md` | `planner (Phase: design)` defines; `release` checks; `reviewer (Mode: acceptance)` audits coverage | The machine-checkable launch checklist. Each `GATE-###` is one line with a `[P/F/B]` marker. `scripts/feature-ready` emits `READY` only when every gate is `Pass`. |
| Mid-flight | `AMENDMENTS.md` | `planner (Phase: intake)` drafts; owner approves | The spec change log. When `SPEC.md` changes after work starts, each `AMD-###` records the change plus an impact analysis on AC IDs, tasks, design, tests, and approvals. `/feature-amend` writes the entry; `planner (Phase: plan)` then replans only the affected tasks. |
| Loop | `RUNS.md` | `/feature-loop` (append-only) | The iteration ledger. One `RUN-###` per loop iteration (task claimed, files changed, diff hash, findings, verification, stop reason). The loop reads it for oscillation detection; `release` and the owner read it for after-the-fact audit. |

The `.incremental-delivery` marker (value `v1`) activates the ledger. New
medium/large scaffolds include it; historical marker-free features retain the
legacy task-only path.

## State machines

Four artifacts carry an explicit status field. The scripts enforce the
allowed transitions; an out-of-order status is drift that
`scripts/feature-reconcile` refuses to pass.

### Tasks (`TASKS.md`)

```text
Backlog → Open → Claimed → Review → Done
                     │
                     └────→ Blocked
```

| Transition | What gates it |
|---|---|
| `Backlog → Open` | (a) `DESIGN.md` status is `Approved` (when the task touches design surface), **and** (b) every `QUESTIONS.md` question that blocks the task is `Answered`, **and** (c) the task's entire `Depends-on:` set is `Done`. |
| `Open → Claimed` | `scripts/feature-next-task <slug>` returned this task ID — i.e. the DAG is satisfied. The script refuses to print a task whose dependencies are not all `Done`. The claim records owner/session, branch/worktree, and a timestamp. |
| `Claimed → Review` | Implementation has landed; `TRACEABILITY.md` is updated and `EVIDENCE.md` records the verification run. Code-bearing tasks go here, **not** directly to `Done`. A code-bearing task also needs a pre-review self-audit in `EVIDENCE.md`. Worktree hygiene must be `CLEAN` or `DIRTY_OWNED` (reviewers need to see the in-flight diff). |
| `Claimed → Blocked` | Needs external evidence, credentials, or human approval. Requires a corresponding `APPROVALS.md` entry or a stop-reason code. |
| `Review → Done` | See the **"A task is Done only when…"** checklist below. In short: review/QA/adversarial passes are clear, all P0/P1 findings are resolved, the adversarial trail is recorded, verification passes, and the worktree is hygiene-clean. |

Pure documentation-control-plane tasks (no code diff) may go `Claimed → Done`
directly, but the adversarial-trail requirement still applies — typically as an
"Adversarial review skipped by routing rule" EVIDENCE entry.

### Shippable increments (`INCREMENTS.md`)

```text
Planned → Building → Ready for feedback → Accepted
                     └→ Changes requested → Building
```

`scripts/feature-increment` validates the ledger, task mappings, proof fields,
future-work Backlog state, and append-only owner-feedback records. Only owner
evidence may supply `Accepted` or `Changes requested`; agents stop at `Ready
for feedback`.

### Findings (`FINDINGS.md`)

```text
Unverified → Confirmed → Fixed
                  │
                  ├──────→ Blocked   (cite an APPROVALS.md entry / stop reason)
                  │
Unverified ───────┴──────→ False positive   (record the rationale)
```

| Status | Meaning |
|---|---|
| `Unverified` | New; not yet reproduced. |
| `Confirmed` | Reproduced with file/line and a reproduction step. |
| `Fixed` | `EVIDENCE.md` records the fix. |
| `False positive` | Closer review rejects it; the rationale is recorded. |
| `Blocked` | Needs external evidence or approval; cites an `APPROVALS.md` entry. |

Severity governs whether a finding blocks. **P0/P1** (from any source —
`reviewer` in any mode, or `security`) are mandatory: any unresolved P0/P1
blocks task `Done` and release, and stops `/feature-loop` from spinning past
one fix iteration without escalation. **P2** is capped at 5 active per feature;
beyond the cap, new P2s defer to a cleanup task. **P3** is collected for
visibility only — it never blocks `Done` and never triggers a fix iteration
(owner opts in via `/feature-review --include-p3`). This budget exists to
defeat reviewer-overfit oscillation.

### Design (`DESIGN.md`)

```text
Draft → Approved
```

`DESIGN.md` is authored as `Draft` and self-reviewed to `Approved`. Only an
`Approved` design unblocks the `Backlog → Open` task transition, and only once
`TEST_STRATEGY.md`, `THREAT_MODEL.md`, `MIGRATION_PLAN.md`, and
`ROLLBACK_PLAN.md` are present. `reviewer (Mode: acceptance)` checks the shipped
work against the design contract at release; drift from the approved design is
a finding.

### Approvals (`APPROVALS.md`)

```text
Requested → Approved
        │
        ├──→ Rejected   (record the rationale; may trigger rework)
        │
        └──→ Withdrawn  (no longer needed; explain why)
```

| Status | Meaning |
|---|---|
| `Requested` | Opened, owner notified, awaiting signoff. Carries `waiting_on_human: true` and a stop-reason code. |
| `Approved` | Owner signed off; the entry records the decision date and an evidence reference. |
| `Rejected` | Owner rejected; the rationale is recorded. |
| `Withdrawn` | No longer needed; the reason is recorded. |

Each entry is machine-checkable so `scripts/feature-ready` can detect "waiting
on human" without an agent re-interpreting prose. Any entry with
`waiting_on_human: true` blocks `READY`. The stop-reason code is one of:
`NEEDS_HUMAN_APPROVAL`, `NEEDS_EXTERNAL_EVIDENCE`, `NEEDS_CREDENTIAL_ROTATION`,
`NEEDS_COMPLIANCE_SIGNOFF`, `NEEDS_CARRIER_DOC`, `NEEDS_STAGING_ACCESS`.

## A task is `Done` only when…

A code-bearing task may move `Review → Done` only when **all** of the following
hold. `scripts/feature-reconcile` enforces these for large-tier Done tasks and
refuses to pass on drift.

1. **`TASKS.md` status updated** to `Done`.
2. **`STATE.md` YAML block reflects the change** — the machine-readable counts
   match what is actually in `TASKS.md` / `FINDINGS.md` / `TRACEABILITY.md`.
3. **`TRACEABILITY.md` rows updated** for the AC IDs the task cites, with AC
   coverage filled in.
4. **`FINDINGS.md` current** for any review/security/adversarial issues, with
   **zero unresolved P0/P1 findings** (any source) and the severity budget
   respected.
5. **`DECISIONS.md` captures** any durable decisions made.
6. **`EVIDENCE.md` records** the commands run and their results, plus any
   `Type:`-specific artifact rows the task requires.
7. **The closest `feature-verify` mode passes**, or remaining failures are
   documented as `Blocked` with `APPROVALS.md` pointers.
8. **A pre-review self-audit is recorded** in `EVIDENCE.md`: at least three
   plausible ways the diff could still be wrong, each with a concrete check or
   an explicit local-skip reason. (Builder-side reality check; does not replace
   reviewer / QA / adversarial review.)
9. **A QA coverage ledger is recorded** for non-doc tasks (control inventory,
   production baseline, candidate proof, data-path proof, `Untested rows: 0`,
   `Result: PASS`).
10. **The adversarial review passed** — a cross-model adversarial trail is
    recorded: an EVIDENCE "Adversarial review clear" entry with
    `Source: reviewer (Mode: adversarial)` and matching Implementer/Reviewer
    tool+model fields, OR adversarial FINDINGS for the task with every P0/P1
    `Fixed` / `False positive`. The reviewing tool family must differ from the
    implementing tool family. If the builder fixed P0/P1 findings after the
    initial review, the fix diff needs a **fresh** adversarial re-check — the
    pre-fix clear does not count. (For tasks after the gate cutoff,
    "skipped by routing rule" does not satisfy a code-bearing Done.)
11. **Worktree hygiene is clean at the boundary** — `scripts/worktree-hygiene
    <slug>` reports `CLEAN`, or every dirty path is committed as a local
    checkpoint inside the active task's ownership. The framework never
    auto-stashes, auto-resets, or auto-commits; passing dirty unowned changes
    to the next task is exactly the failure mode this gate prevents. The
    handoff manifest in `EVIDENCE.md` is informational only and does **not**
    satisfy this gate — commits do.

## Related

- [commands.md](commands.md) — the slash-command catalogue that drives these files
- [agents.md](agents.md) — the five role agents and the modes/phases that own each file
- [scripts.md](scripts.md) — the deterministic scripts that parse and gate the control plane
- [config.md](config.md) — `sdlc.config.yml` keys and `SDLC_*` environment variables
