---
description: Run the continuous self-improvement distill loop with review, eval, and approval gates
argument-hint: [--since YYYY-MM-DD]
---

You are running `/harness-improve` for `$ARGUMENTS`.

This command is the cross-feature continuous self-improvement orchestrator. It
turns accumulated local capture logs into proposed INS items, eval-corpus
candidates, and routing decisions, then gates every consequential action behind
review, deterministic eval, promotion policy, and owner approval.

## Safety Boundary

- Do not push, merge, deploy, mutate production, flip launch flags, or touch
  live carrier/payment/auth surfaces.
- Do not approve APV-001, edit APV-001 to `Approved`, or tell the user that
  `auto-structural` is armed. The framework cannot grant its own approval.
- `auto-structural` is inactive unless `scripts/load-config` returns
  `SDLC_SELF_IMPROVE_AUTONOMY=auto-structural` after reading an Approved APV-001.
- Judgment routes are always human-gated:
  `add-or-update-principle` and `role-prompt-edit` never auto-apply.
- Permanently human-gated paths stay human-gated even when autonomy is armed.
- If the cross-model reviewer is unavailable, stop at `human-gate`; do not
  silently substitute same-tool review.

## Step 0 - Preflight

Run:

```bash
scripts/feature-context continuous-self-improvement-loop
. scripts/load-config
```

Then inspect `SDLC_SELF_IMPROVE_AUTONOMY`.

- `off` or `capture`: stop after reporting that distill is not enabled. Raw
  capture may continue, but this command must not run `scripts/reflect-harness`.
- `distill`: proceed through proposal, review, eval, and owner approval. Do not
  auto-apply.
- `auto-structural`: proceed only if `scripts/load-config` preserved that value
  after APV-001 was Approved. If APV-001 is not Approved, `scripts/load-config`
  downgrades to `distill`; honor the downgrade.

## Stop Capture Rule

Every invocation emits exactly one `harness-improve` checkpoint. Early stops
emit at the stop point; completed runs emit in Step 6. If the emit fails, keep
the original stop decision because capture is best-effort.

For any stop before Step 6, run:

```bash
scripts/lib-capture.sh emit --source harness-improve --feature global --actor-tool claude-code --actor-model claude-opus-4-8 --outcome <fail|blocked|no-progress> --stop-reason <STOP_REASON_CODE> --verify-mode none --verify-exit <exit-code> --lesson-hint "harness-improve stopped before promotion"
```

Use the most specific stop reason available, such as `DISTILL_DISABLED`,
`REFLECT_SANITIZER_TRIPWIRE`, `REFLECT_USAGE_ERROR`, `REVIEW_BLOCKED`,
`EVAL_REGRESSION`, `NEEDS_EVAL_EVIDENCE`, `PROMOTE_UNAVAILABLE`, or
`OWNER_DEFERRED`.

## Step 1 - Distill

Run the deterministic distill primitive:

```bash
scripts/reflect-harness $ARGUMENTS --dry-run
```

The script prints a local proposal bundle under `.sdlc/reflect/` unless
`--out` is supplied. It sanitizes capture before parsing or proposal output.
If it exits 4, stop with a sanitizer tripwire message. If it exits 3, stop with
the usage/environment error. Do not attempt review or eval on a failed bundle.

## Step 2 - Review Fan-Out

Dispatch review on the proposal bundle before any promotion decision.

Use parallel reviewers when available:

- `reviewer (Mode: quality)`: check proposal structure, evidence threshold,
  routing, and TRACEABILITY implications.
- `reviewer (Mode: adversarial)`: run the 10-category adversarial pass. Use the
  sanctioned cross-model wrapper when a task-bound diff exists; otherwise review
  the bundle as a proposal artifact and record any findings in
  `docs/features/continuous-self-improvement-loop/FINDINGS.md`.
- `security`: check sanitizer posture, prompt-injection handling, permanently
  human-gated paths, and production/no-secret boundaries.

Any Confirmed P0/P1 finding stops promotion. Confirmed P2 findings follow the
feature severity budget. P3 findings are recorded but do not force churn unless
the user explicitly asks to include P3s.

## Step 3 - Eval

For every structural candidate that has a candidate-result file, run:

```bash
scripts/harness-eval <candidate-result-file>
```

Promotion cannot proceed if `scripts/harness-eval` reports a regression,
missing corpus guard, or no improvement. If a proposed insight has no candidate
result file yet, classify it as `human-gate` with reason `NEEDS_EVAL_EVIDENCE`.

## Step 4 - Promote Proposal

For each reviewed/evaluated proposed INS item, run the promotion classifier when
available:

```bash
scripts/harness-promote <insight-id>
```

Interpret the result:

- `reject`: record the rejection and stop for that item.
- `human-gate`: present the item to the owner for approval. Do not apply it.
- `auto-structural`: allowed only when all of these are true:
  - `SDLC_SELF_IMPROVE_AUTONOMY=auto-structural` after `scripts/load-config`;
  - APV-001 is Approved;
  - routing is `encode-in-structure`;
  - the touched paths are not permanently human-gated;
  - deterministic tests, sanitizer, `scripts/feature-reconcile`, and
    cross-model review all passed.

If `scripts/harness-promote` is not present yet, stop after review/eval with a
promotion-proposal summary. TASK-010 owns the classifier implementation.

## Step 4a - Auto-Structural Apply Outcome

For an `auto-structural` decision, record an error-budget event only after the
structural change has actually been applied locally and the post-apply
verification result is known. Never record a pre-apply classifier decision as an
applied outcome.

```bash
scripts/lib-error-budget.sh record --insight <INS-ID> --outcome <pass|regression|rollback>
```

- Use `pass` only after the applied change passes the required eval,
  sanitizer, reconcile, and task verification.
- Use `regression` when post-apply verification fails and the change is left
  unapplied or reverted.
- Use `rollback` when a previously applied auto-structural change is rolled
  back.
- If the command writes a downgrade marker, immediately honor the resulting
  `auto-structural -> distill` downgrade and request human re-arm through
  `APV-CSI-ERROR-BUDGET`.

## Step 4b - Applied Insight Ledger

For every promotion that is actually applied, append the promotion ledger only
after the local apply commit exists. This applies to human-gated and
auto-structural promotions.

```bash
scripts/lib-insight-ledger.sh append --insight <INS-ID> --routing <routing> --target <changed-paths> --eval-delta <eval-delta> --autonomy <off|capture|distill|auto-structural> --reviewer-tool <tool> --reviewer-model <model> --commit <post-apply-commit> --branch <feature-branch>
```

- Do not append the ledger row for rejected, deferred, or proposal-only items.
- Use the post-apply commit SHA, not a pre-apply classifier or proposal commit.
- The branch must be the current feature branch. Never use `staging` or
  `master` as the apply branch.

## Step 5 - Owner Approval Gate

Before any human-gated apply, present a concise approval prompt:

```text
Approve applying <INS-ID>?
- Routing:
- Evidence:
- Eval result:
- Promotion decision:
- Paths that would change:
- Rollback:
Choices: approve | reject | defer
```

No response means `defer`. The command must not infer approval from silence,
prior chat context, APV-002, green tests, or the user's request to implement the
feature. APV-001 is the only approval that can arm `auto-structural`, and this
command cannot grant it.

## Step 6 - Record

Append a concise entry to `docs/features/continuous-self-improvement-loop/EVIDENCE.md`
with:

- bundle path
- review result
- eval result
- promotion decision
- owner approval result, if requested
- files changed, or `none`
- stop reason

Emit a raw local capture checkpoint:

```bash
scripts/lib-capture.sh emit --source harness-improve --feature global --actor-tool claude-code --actor-model claude-opus-4-8 --outcome <pass|fail|blocked|no-progress> --stop-reason <STOP_REASON_CODE> --verify-mode none --verify-exit 0 --lesson-hint "harness-improve proposal recorded from reflect bundle"
```

## Final Report

Return exactly:

```text
## /harness-improve result

- Bundle:
- Autonomy:
- Review result:
- Eval result:
- Promotion decisions:
- Owner approvals requested:
- Applied changes: none | <files>
- Stop reason:
- Next command:
```
