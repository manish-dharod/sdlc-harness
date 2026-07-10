# Feature Folders

Feature folders are the durable memory for agentic SDLC work.

Create a folder under `docs/features/<slug>/` for each feature. Use one of
the templates in this directory:

- `_template-small/` for small, low-risk changes (1 file; no increment marker).
- `_template-medium/` for medium changes that need a task plan and evidence
  (6 files, including `INCREMENTS.md`).
- `_template/` for large or launch-gated changes (20 files, including
  `INCREMENTS.md`).

New medium and large scaffolds contain `.incremental-delivery` with value `v1`.
Their planner replaces the generic INC-001 with the smallest experiential user
journey, maps every task to an increment, and keeps future work
Planned/Backlog. After implementation and real-surface verification, the slice
moves to `Ready for feedback`; only explicit owner evidence may record
`Accepted` or `Changes requested`. Historical marker-free features retain
their prior routing behavior.

The scripts in `scripts/feature-*` read and update these files so work can
resume across agents, sessions, and tools.

Verification writes `docs/features/<slug>/.last-verify.json`. Reconcile uses
that status to reject new `TRACEABILITY.md` rows marked `Passing` when the last
verify run failed, is stale, or used a weaker mode than the task requires. Use
`scripts/feature-verify --all-active <mode>` after integration events that
touch multiple features or repo-global harness paths.

For non-doc Review/Done tasks, evidence should include a `QA coverage ledger`
with control inventory, production or baseline proof, candidate proof,
data-path proof, untested rows, and PASS/FAIL result. Cross-model adversarial
review must name implementer and reviewer tool/model; Claude-authored work uses
`scripts/adversary-review`, while Codex-authored work uses
`scripts/claude-adversary-review`. Review wrappers operate on a committed
candidate, choose the configured integration branch remote-first (or accept an
explicit fourth-position base), and require the actual implementer model as the
fifth positional argument. They fail closed on task-owned dirty state, empty or
oversized diffs, model/tool-family mismatch, and malformed terminal verdicts.
Raw transcripts and attempt sidecars stay gitignored; a valid complete review
writes a sanitized receipt under
`docs/features/<slug>/review-receipts/*.json`. Cite that tracked receipt in
EVIDENCE and validate it with
`scripts/review-attempt validate-receipt <receipt-path>`.

`scripts/preflight-credentials <feature-slug>` reads legacy
`Preflight command:` rows plus the `## Required capabilities / credentials`
bullets in `DESIGN.md` (or `FEATURE.md` for small tier). Declarative bullets
support `none`, `env:`, `env-file:`, `file:`, `dir-writable:`, `command:`,
and `setup-script:`. It checks presence/readiness only and never prints
credential values. `setup-script:` checks that a deterministic helper under
`scripts/` exists and is executable; reviewer (Mode: qa) decides when to run
it.
