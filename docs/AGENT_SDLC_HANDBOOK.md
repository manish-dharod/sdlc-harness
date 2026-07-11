# Agent SDLC Handbook

> **Plain-language companion to [L2 Overview](AGENT_SDLC_OVERVIEW.md) /
> [L3 Workflow](AGENT_SDLC_WORKFLOW.md).** Read this for the day-to-day operating
> feel rather than the formal model. Map of all docs: [START_HERE](START_HERE.md).

A plain-language guide to the public agentic SDLC harness.

For the authoritative contract, read `CLAUDE.md` and `AGENTS.md`. For detailed
lifecycle mechanics, read `docs/AGENT_SDLC_WORKFLOW.md`. This handbook explains
how the pieces fit and which commands matter day to day.

## Mental Model

The repo is the memory. A feature is tracked in Markdown files under
`docs/features/<slug>/`, not in chat.

The harness simulates a small software team with five agent roles:

| Agent | Job |
|---|---|
| `planner` | Intake, design, and task planning. |
| `builder` | Claim one scoped task, implement it, verify it, and record evidence. |
| `reviewer` | Quality, QA, adversarial, and acceptance review modes. |
| `security` | Security and release-risk review for sensitive surfaces. |
| `release` | Read-only readiness verdict from deterministic gates. |

The normal lifecycle is:

```text
Spec -> Design -> Shippable Increment -> Tasks -> Code -> Tests -> Owner Feedback -> Release
```

Agents can write prose, but durable proof lives in the repo: task state,
evidence, traceability, findings, approvals, release gates, and command output.

## Feature Tiers

Use the smallest tier that matches the risk. The tier is recorded in
`docs/features/<slug>/.tier`.

| Tier | Scaffold | Use when |
|---|---|---|
| `small` | `FEATURE.md` | Short local changes with no schema, auth, payment, webhook, or external integration risk. |
| `medium` | 6 files: `README.md`, `SPEC.md`, `DESIGN.md`, `INCREMENTS.md`, `TASKS.md`, `EVIDENCE.md` | Multi-day work that needs design and feedback evidence but not the full launch gate stack. |
| `large` | 20-file full control plane, including `INCREMENTS.md` | High-risk, launch-gated, multi-team, security-sensitive, or public-contract work. |

Create features with:

```bash
scripts/feature-init <slug> --tier small
scripts/feature-init <slug> --tier medium
scripts/feature-init <slug> --tier large
```

## State Machines

Tasks in `TASKS.md`:

```text
Backlog -> Open -> Claimed -> Review -> Done
                         \-> Blocked
```

Shippable increments in `INCREMENTS.md`:

```text
Planned -> Building -> Ready for feedback -> Accepted
                         \-> Changes requested -> Building
```

Only explicit owner evidence may set `Accepted` or `Changes requested`.
Agents prepare a tryable Experience surface and stop for feedback.

Findings in `FINDINGS.md`:

```text
Unverified -> Confirmed -> Fixed
                         \-> False positive
                         \-> Blocked
```

Key rules:

- Open only work whose dependencies are Done.
- Claim one task at a time.
- Code-bearing tasks normally move from `Claimed` to `Review`, not straight to
  `Done`.
- Done requires current evidence, traceability, findings disposition, and a
  valid adversarial trail when the task is code-bearing.

## Daily Commands

Context and task selection:

```bash
scripts/feature-context <slug>
scripts/feature-increment check <slug>
scripts/feature-next-task <slug>
```

Verification:

```bash
scripts/feature-verify <slug> fast
scripts/feature-verify <slug> unit
scripts/feature-verify <slug> full
```

Integration sweep after repo-global or multi-feature changes:

```bash
scripts/feature-verify --all-active fast
```

Consistency and readiness:

```bash
scripts/feature-reconcile <slug>
scripts/feature-ready <slug>
scripts/sdlc-doctor --quiet
scripts/sanitize-check --changed
```

External or scratch worktrees:

```bash
export SDLC_WORKTREE_ROOT=/absolute/path/to/agent-worktrees
scripts/worktree-add-external worker-1 codex/example
```

## False-Confidence Gates

The public harness includes deterministic checks that prevent common "green but
not proven" states.

- `scripts/feature-verify` writes `.last-verify.json` for each verified
  feature. `feature-reconcile` rejects new `TRACEABILITY.md` rows marked
  `Passing` when the last verify run failed, is stale, or used too weak a mode.
- Review-stage adversarial review is required for new Review/Done task rows
  after the cutoff encoded in `scripts/feature-reconcile`.
- Non-doc Review/Done tasks need a QA coverage ledger in evidence with control
  inventory, baseline proof, candidate proof, data-path proof, untested rows,
  and PASS/FAIL result.
- Cross-model adversarial trails must name implementer and reviewer
  tool/model, and the tools must differ.
- Activated medium/large features cannot build ahead: task routing is limited
  to the current increment, and final readiness requires every increment to
  have owner-backed acceptance evidence.

## Cross-Model Review

Use the opposite tool for adversarial review:

```bash
# Claude-authored implementation reviewed by Codex CLI
scripts/adversary-review <slug> <task-id> review "" <claude-model>

# Codex-authored implementation reviewed by Claude Code
scripts/claude-adversary-review <slug> <task-id> review "" <codex-model>
```

Raw transcripts and retry sidecars are local and gitignored under
`docs/features/<slug>/adversary/`. A valid complete review writes a tracked,
sanitized schema-v2 `review-receipts/*.json` file that binds the committed
scope, candidate blob identities, complete diff, and both tool/model
identities. Record that receipt path in EVIDENCE and validate it with
`scripts/review-attempt validate-receipt <path> --require-scoped`.

Security review uses:

```bash
scripts/security-review <slug> <task-id> review "" <claude-model>
```

## Agent Capsules

Agent capsules give worker sessions a bounded prompt with task context,
ownership, invariants, allowed commands, forbidden actions, and stop conditions.
They are optional for small manual work and useful for long-running loops or
parallel agent lanes.

Generate and check a capsule:

```bash
scripts/agent-capsule-plan <slug> <task-id> builder > /tmp/agent-capsule.md
scripts/agent-capsule-check /tmp/agent-capsule.md
```

Run through sanctioned wrappers:

```bash
scripts/codex-capsule-run <slug> <task-id> /tmp/agent-capsule.md
scripts/claude-capsule-run <slug> <task-id> /tmp/agent-capsule.md
```

Use `scripts/worktree-add-external` when those capsules run in disposable or
parallel lanes. The helper requires a configured absolute, writable
`SDLC_WORKTREE_ROOT` and keeps generated worktrees under that root.

## Program Backlog

Use `docs/backlog/` for proposed enhancements and TBDs that do not yet belong
to an active feature. Read `docs/backlog/INDEX.md` first, then open only the
relevant item files.

After adding or editing backlog items:

```bash
scripts/backlog-index
scripts/backlog-index --check
```

## Release Readiness

`scripts/feature-ready <slug>` is deterministic:

- exit `0`: READY
- exit `1`: BLOCKED
- exit `2`: NEEDS-APPROVAL
- exit `3`: usage or missing feature

The release agent is read-only. If readiness is blocked, fix the underlying
task, evidence, traceability, approval, or release-gate state before asking for
another release verdict.

For activated features, `scripts/feature-increment final <slug>` must also
pass. Passing tests or agent prose never substitute for an owner verdict.
