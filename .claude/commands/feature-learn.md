---
description: Capture post-run learning candidates for a feature/task without auto-applying harness changes
argument-hint: <feature-slug> [task-id] [--run-kind kind] [--status pass|fail|blocked|skipped|unknown] [--mode fast|unit|full|manual] [--source path]
allowed-tools: Bash(scripts/feature-learn:*)
---

You are running `/feature-learn` for `$ARGUMENTS`.

This command is the harness's continuous learning capture step. It runs after
agent work, verification, review, orchestration, and loop iterations so that
useful lessons do not disappear into chat history. It captures candidates for
future improvement; it does not self-modify the harness.

## Safety Boundary

- Capture is automatic; promotion is gated.
- Never auto-edit role prompts, skills, CLAUDE.md, AGENTS.md, templates,
  scripts, hooks, or product code from this command.
- Never store secrets, tokens, raw PAN/CVV/expiry, customer PII, auth headers,
  production-only values, or raw private payloads in learning artifacts.
- If the sanitizer refuses, stop and clean the source artifact before trying
  again. Do not bypass the sanitizer.
- Apply the structural-enforcement rule: repeated mechanical lessons belong
  in scripts, lints, hooks, templates, reconcile checks, or verify profiles;
  judgment-only lessons belong in principles or role prompts.

## When To Run

Run this after every material SDLC run:

- `/feature-loop` iteration, whether it passes, fails, blocks, or reaches
  readiness.
- `/feature-orchestrate` preflight/routing run.
- `/feature-review` parallel review synthesis.
- `/feature-verify` run.
- Builder, reviewer, security, QA, adversarial, acceptance, release, planner,
  product, and architecture handoffs when they produce evidence, findings,
  tasks, approvals, or blockers.
- Manual recovery from a failed command, stale branch, missing credential,
  flaky test, or repeated user correction.

Exception for a terminal readiness pass: complete this tracked capture before
the terminal sealing commit. Then run the final clean `full` verification and
`feature-ready` from that exact HEAD with no later tracked writes. Do not run a
post-full learning capture; doing so would correctly make the full receipt
stale or the worktree dirty.

## Command

Run the deterministic capture wrapper:

```bash
scripts/feature-learn <feature-slug> [task-id] \
  --run-kind <feature-loop|feature-orchestrate|feature-review|feature-verify|builder|reviewer|security|qa|adversarial|acceptance|release|manual> \
  --status <pass|fail|blocked|skipped|unknown> \
  --mode <fast|unit|full|manual|none|unknown> \
  --source <path-to-artifact|auto:feature-review|auto:feature-verify|auto:feature-orchestrate|auto:feature-loop>
```

The script writes:

- `docs/features/<slug>/learnings/<timestamp>.<task>.<nonce>.learning.md`
- `docs/features/<slug>/LEARNINGS.md`

The feature slug must be canonical lower-kebab-case, and an optional task ID
must use an uppercase alphanumeric prefix that starts with a letter, a dash,
at least three digits, and at most one lowercase suffix letter (for example,
`TASK-001b` or `ICLR-010`). `--source` is an explicit contract:
it must exist as a readable, non-symlink regular file inside that feature.
Prompt-consumed content is first materialized into a bounded staged slice; an
append-only source may exceed 2 MiB when its required tail fits the slice cap.
Missing or escaped paths, an over-cap required line/fixed-file slice, or
invalid UTF-8/NUL data in the consumed slice fail before durable writes.
Artifact publication is no-clobber, and concurrent ledger appends are locked
and atomically replaced. Symlinked output directories are refused rather than
followed outside the feature. The lock lives under the repository's absolute Git
common directory, so linked worktrees and sessions with different `TMPDIR`
values share the same private per-feature lock namespace.

Use the `auto:<run-kind>` selectors at standard command callsites. They resolve
to the tier's existing durable source: small -> `FEATURE.md`, medium ->
`EVIDENCE.md`, and large -> `FINDINGS.md` for review, `RUNS.md` for loop, or
`EVIDENCE.md` for verify/orchestrate. An explicitly supplied path remains
strict: if it is missing, capture fails before durable writes.

## Capture Prompt

After the script writes the artifact, complete the `Observed Signal` and
`Candidate Learning Items` sections only from evidence in the run. Use this
prompt to keep the learning generalized:

```text
Review the run that just completed.

Goal: extract only lessons that could improve future SDLC work beyond this
single run.

Inputs:
- Feature slug:
- Task ID, if any:
- Run kind:
- Status:
- Source artifact:
- Relevant EVIDENCE/FINDINGS/RUNS entries:
- Verification output summary:
- User correction or reviewer finding, if any:

For each possible learning, answer:

1. What repeated or generalizable pattern did this reveal?
2. What concrete evidence proves it happened?
3. Is it one-off, repeated, or systemic?
4. Where should it route?
   - no-change: not worth preserving
   - docs-note: useful context, not behavior-changing
   - role-prompt-edit: judgment guidance that cannot be deterministic
   - add-or-update-principle: stable rule worth citing by name
   - encode-in-structure: deterministic check, script, lint, hook, template,
     metadata field, reconcile rule, or verify profile
5. What exact target would change if promoted?
6. What safety concern could make the learning harmful if generalized?
7. What next action is appropriate: none, include in next /feature-reflect,
   open a task, or ask the owner?

Reject learnings that are unsupported by evidence, only restate the task,
depend on private data, or would make the harness more permissive without a
testable safety gate.
```

## Promotion Path

Captured items are mined by `/feature-reflect`; they are not applied here.

`scripts/feature-reflect` includes `LEARNINGS.md` plus recent
`learnings/*.learning.md` captures in the context bundle. The reflect
synthesizer then decides whether each repeated lesson is:

- rejected,
- accepted as judgment-layer guidance behind human approval, or
- routed to Backlog as `encode-in-structure` for a future harness task.

## Final Report

Report:

```text
## Learning capture for <slug>

- Artifact: docs/features/<slug>/learnings/<timestamp>.<task>.<nonce>.learning.md
- Ledger: docs/features/<slug>/LEARNINGS.md
- Run kind:
- Status:
- Candidate learnings completed: N
- Promotion: captured only; next synthesis happens through /feature-reflect
```
