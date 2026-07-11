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

Post-run learning capture is durable but promotion-gated. Standard
review/verify/orchestrate/loop callsites use `scripts/feature-learn` with a
tier-aware `auto:<run-kind>` source, append an atomic row to `LEARNINGS.md`,
and publish a collision-resistant artifact under `learnings/`. Inputs must be
contained, non-symlink UTF-8 files; prompt-consumed slices are byte-bounded and
reject NUL data or an over-cap required line. Symlinked learning/reflect output
directories are refused before publication. A shared Git-common-dir lock
prevents concurrent sessions or linked worktrees from losing ledger rows.
Canonical task IDs accept uppercase alphanumeric prefixes such as `TASK` and
`ICLR` while rejecting path, whitespace, and Markdown-injection characters.
`scripts/feature-reflect` consumes bounded recent learning tails along with
the control plane. The terminal sealing sequence completes all tracked
learning writes before the final clean `feature-verify full` plus
`feature-ready` pair; make no tracked write afterward.

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
candidate. Config and reviewer pins come from that candidate. Feature reviews
derive the integration merge base; contract-adopted task reviews derive the
dedicated claim commit. Adoption comes from committed history: tasks already
at the integration base or first introduced on parent history without
`# sdlc-claim-base-contract:v1` remain legacy, while tasks introduced after
the marker must have a dedicated claim. The fourth positional argument asserts
the derived base; it does not select a later partial range. The fifth
positional argument supplies the implementer model. Committed ownership must
cover every changed path. Dirty task scope, empty or oversized diffs, unsafe
paths, provenance mismatch, and malformed terminal verdicts fail closed.
Retry modes preserve the complete canonical diff and reduce only adjacent
context.

Raw transcripts and attempt sidecars stay gitignored and use no-clobber,
nonce-suffixed names. A valid complete review writes a tracked schema-v2
receipt under `docs/features/<slug>/review-receipts/*.json`, binding scope,
candidate blob identity, canonical diff, prompt, and transcript. Cite that
receipt in EVIDENCE and validate it with
`scripts/review-attempt validate-receipt <receipt-path> --require-scoped`.
Receipt validation requires Git 2.42+, full history, and history-preserving
integration of the reviewed candidate.

`scripts/preflight-credentials <feature-slug>` reads legacy
`Preflight command:` rows plus the `## Required capabilities / credentials`
bullets in `DESIGN.md` (or `FEATURE.md` for small tier). Declarative bullets
support `none`, `env:`, `env-file:`, `file:`, `dir-writable:`, `command:`,
and `setup-script:`. It checks presence/readiness only and never prints
credential values. `setup-script:` checks that a deterministic helper under
`scripts/` exists and is executable; reviewer (Mode: qa) decides when to run
it.
