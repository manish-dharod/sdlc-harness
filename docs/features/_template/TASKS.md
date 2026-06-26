# Feature Task Queue

Last updated: YYYY-MM-DD

## Status legend

- `Backlog` — exists but not ready (design unapproved, blocked on questions)
- `Open` — ready to claim; all dependencies are `Done`
- `Claimed` — actively owned by one session
- `Blocked` — needs external evidence / credentials / approval (see APPROVALS.md)
- `Review` — implemented, waiting on review/QA
- `Done` — verified, evidence recorded, TRACEABILITY row updated

`planner (Phase: plan)` cannot move tasks from `Backlog` to `Open` until: (a) all
QUESTIONS that block the task are `Answered`, (b) DESIGN.md status is `Approved`
if the task touches design surface, and (c) the task's `Depends-on` set is all
`Done`.

## Claim protocol

1. Run `scripts/feature-next-task <feature-slug>` to find the next claimable task.
2. The script refuses to print a task if its dependencies are not all `Done`.
3. Change status to `Claimed`, add owner + session + branch/worktree + date.
4. Before stopping, update status, evidence, TRACEABILITY row, and any opened
   findings.

## Task schema (every task block must use these fields)

```text
### TASK-###: <short title>

- Status: Backlog | Open | Claimed | Blocked | Review | Done
- AC IDs: AC-001, AC-002         # at least one; planner (Phase: plan) enforces
- NFR IDs: NFR-001                # optional
- Type: feature                   # required for new tasks: feature | bug | perf | ui | migration | docs | refactor | infra
- Design anchor: DESIGN.md#section-name
- Owner/session: unclaimed | <session id>
- Branch/worktree: <branch>
- Claimed at: YYYY-MM-DD HH:MM TZ
- Depends-on: TASK-###, TASK-###  # other task IDs; empty for roots
- Risk: low | medium | high
- Intended file ownership:
  - path/to/file.php
  - path/to/file.js
- Acceptance criteria (task-local — supplements the AC IDs above):
  - bullet
- Verification:
  - command
  - mode: fast | unit | full
- Tests added (filled by builder / reviewer (Mode: qa)):
  - test file + name
- Evidence:
  - EVIDENCE.md entry pointer
- Traceability:
  - TRACEABILITY.md row updated: yes / no
```

## `Type:` field semantics (added in framework-v3 Phase 4)

`Type:` is required for new tasks. Historical tasks without `Type:` remain
valid only when they predate the self-audit cutoff documented in
`scripts/feature-reconcile`. When set, `Type:` triggers per-type
artifact-requirement checks at Done-time where applicable.

| Type | Required artifact in EVIDENCE.md | Why |
|---|---|---|
| `bug` | failing-then-passing repro (pre-fix failure output + post-fix passing output, both captured verbatim) | Per `[[principle-prove-it-works]]`: a bug fix that didn't reproduce first cannot be verified, and a fix without before/after evidence is unfalsifiable. |
| `perf` | baseline metric + post-fix metric + delta + trace artifact path | A perf change with no measurement is a hypothesis, not a fix. Per the pstack perf-issue playbook. |
| `ui` | before / after screenshots (paths in EVIDENCE; PII-free) | Pixel-level UI change verified visually. Tests passing ≠ feature works at the UI layer ([[principle-prove-it-works]]). |
| `migration` | backfill evidence (row counts, sanitized sample) + rollback evidence (inverse DDL path + dry-run output) | DDL + data-mutation safety. The rollback path must be exercised, not just documented. |
| `feature` (default) | none beyond the standard Verification + Tests rows | Generic case; standard evidence sufficient. |
| `refactor` | none beyond standard, but Verification must demonstrate behavior preservation | Refactor evidence is "same behavior" — the standard verification log carries it. |
| `docs` | none | Documentation change; standard evidence sufficient. |
| `infra` | none beyond standard | CI / tooling / script change; standard evidence sufficient. |

The exact artifact shapes are documented in EVIDENCE.md under
"Per-task-type artifact requirements".

`scripts/feature-reconcile` walks Done tasks; for any with a `Type:` that
has an artifact requirement, it looks up the task ID in EVIDENCE.md and
asserts the artifact rows are present. Missing artifacts surface as
DRIFT.

## Lifecycle invariants (checked by scripts/feature-reconcile)

- A task in `Open` has zero unsatisfied `Depends-on`.
- A task in `Claimed` has a non-empty owner/session and a recent `Claimed at`
  (stale claim > 24h = automatic candidate for reconciliation).
- A task in `Blocked` has a corresponding APPROVALS entry or a stop reason code.
- A task in `Review` has implementation landed and is waiting for one or
  more of: `reviewer (Mode: quality)`, `security`, `reviewer (Mode: qa)`,
  `reviewer (Mode: adversarial)`, and has a task-scoped pre-review
  self-audit for code-bearing `Type:` values. For post-2026-06-24 tasks,
  Review also requires the opposite-tool adversarial trail and, for non-doc
  tasks, a QA coverage ledger with zero untested rows.
- A code-bearing task in `Review` or `Done` has a task-scoped pre-review
  self-audit recorded in EVIDENCE.md: three non-empty `Plausible miss N:`
  descriptions and one non-empty `Check:`, `Skipped:`, or `Skip reason:`
  under each. `Type: docs` tasks are exempt.
- A task in `Done` has all of:
  - passing verification recorded in EVIDENCE,
  - TRACEABILITY row updated, AC coverage filled in,
  - zero unresolved P0/P1 findings (any Source),
  - **adversarial trail recorded** — an EVIDENCE entry
    `## YYYY-MM-DD - Adversarial review clear: TASK-###` with
    `- Source: reviewer (Mode: adversarial)`, Implementer/Reviewer
    tool+model fields, and the opposite-tool artifact,
    OR reviewer (Mode: adversarial) FINDINGS for the task where every P0/P1 is `Fixed`
    or `False positive`, OR the task ID listed in
    `docs/features/<slug>/.adversarial-exempt` (grandfathered pre-cutoff
    Done; see `scripts/feature-reconcile` header).

## Transition norms

- Code-bearing tasks normally go `Claimed → Review`, then `Review → Done`
  after `/feature-review` (or equivalent parallel
  reviewer+security+qa+adversary pass) clears the diff and any P0/P1
  findings are `Fixed`/`False positive`. `builder` or `planner (Phase: plan)` flips
  `Review → Done` once `scripts/feature-reconcile` is clean for this task.
- Pure documentation-control-plane tasks (no code diff) may transition
  `Claimed → Done` directly only after the post-2026-06-24 opposite-tool
  adversarial trail exists. Historical pre-cutoff docs-only tasks may use the
  old routing-skip shape.
- If `builder` fixes P0/P1 findings after the initial review, the fix diff
  needs a fresh adversarial re-check before Done. The pre-fix
  "Adversarial review clear" does not satisfy this requirement.
- **Worktree hygiene at every transition**: `builder` runs
  `scripts/worktree-hygiene <slug>` at `Claimed → Review`,
  `Review → Done`, and before claiming the next task. Acceptable at
  `Claimed → Review`: `CLEAN` or `DIRTY_OWNED` (reviewers need to see
  the in-flight diff). Required at `Review → Done` and before
  next-claim: `CLEAN` — i.e. either commit a local checkpoint or
  revert any remaining dirty paths. `DIRTY_MIXED` or `DIRTY_NO_TASK`
  at any transition is a hard stop — pollutes the next agent's review
  scope and the loop's diff-hash oscillation signal. The handoff
  manifest schema in this template's `EVIDENCE.md` is **informational
  human context only** — `scripts/feature-reconcile` does not parse
  it, so writing a manifest does NOT satisfy the gate; commits do.
  The framework never auto-stashes or auto-resets.

## Active tasks

### TASK-EXAMPLE-001: Example Task (delete this block when adding real tasks)

> This block is illustrative only. `scripts/feature-next-task` and
> `scripts/feature-reconcile` parse `### TASK-` headers, so this example
> uses `TASK-EXAMPLE-001` to avoid colliding with real task numbering. The
> `Depends-on:` field is intentionally empty here — never use `TASK-###`
> placeholders in field values; the parsers read them literally.

- Status: Backlog
- AC IDs: AC-001
- NFR IDs:
- Design anchor: DESIGN.md#architecture-overview
- Owner/session: unclaimed
- Branch/worktree:
- Claimed at:
- Depends-on:
- Risk: low
- Intended file ownership:
  - path
- Acceptance criteria:
  - criterion
- Verification:
  - command
  - mode: fast
- Tests added:
  - pending
- Evidence:
  - pending
- Traceability:
  - TRACEABILITY.md row updated: no
