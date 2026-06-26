# Feature Folders

Feature folders are the durable memory for agentic SDLC work.

Create a folder under `docs/features/<slug>/` for each feature. Use one of
the templates in this directory:

- `_template-small/` for small, low-risk changes.
- `_template-medium/` for medium changes that need a task plan and evidence.
- `_template/` for large or launch-gated changes.

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
`scripts/claude-adversary-review`.

`scripts/preflight-credentials <feature-slug>` reads legacy
`Preflight command:` rows plus the `## Required capabilities / credentials`
bullets in `DESIGN.md` (or `FEATURE.md` for small tier). Declarative bullets
support `none`, `env:`, `env-file:`, `file:`, `dir-writable:`, `command:`,
and `setup-script:`. It checks presence/readiness only and never prints
credential values. `setup-script:` checks that a deterministic helper under
`scripts/` exists and is executable; reviewer (Mode: qa) decides when to run
it.
