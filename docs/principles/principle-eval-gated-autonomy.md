---
name: principle-eval-gated-autonomy
description: Self-improvement changes are not improvements until a held-out or deterministic evaluation proves the target gets better without regressing protected behavior.
metadata:
  type: principle
  layer: governance
  enforced-by:
    - scripts/test-self-improve
    - scripts/harness-eval
    - scripts/harness-promote
    - scripts/feature-reconcile
---

# Eval-Gated Autonomy

Self-improvement changes are not improvements until a held-out or deterministic
evaluation proves the target gets better without regressing protected behavior.

The loop may capture, distill, and propose. It may not silently promote its own
ideas into structural controls without a deterministic gate, sanitizer pass,
feature reconciliation, and independent review. The system must never grade its
own grader, auto-edit the eval corpus, self-merge, or bypass a human approval
row for judgment-layer changes.

## When to apply

- A run suggests a reusable learning, principle, prompt edit, or harness check.
- A change would affect `scripts/harness-eval`, corpus fixtures, promotion
  gates, reconciler behavior, role prompts, or safety policies.
- An agent proposes that a recurring lesson should become automatic behavior.
- `SDLC_SELF_IMPROVE_AUTONOMY` is raised above `capture`.

## Procedure

1. Capture the raw event locally under `.sdlc/capture/`.
2. Sanitize before any model consumes the bundle.
3. Distill only recurring patterns with reviewable evidence.
4. Route mechanical lessons to structure before prompt text.
5. Run the candidate through `scripts/harness-eval`.
6. Promote only through `scripts/harness-promote`, which enforces tests,
   sanitizer, `scripts/feature-reconcile`, and cross-model review.
7. Record every applied promotion in `docs/insights/APPLIED.md`.

## Hard Boundaries

- The eval corpus and grader are permanently human-gated.
- `auto-structural` requires APV-001 approval and remains dark by default.
- Judgment-layer changes stay human-gated even when autonomy is armed.
- Production deploys, `staging`/`master` promotion, live DB changes, live
  carrier traffic, and launch flag flips are never part of this loop.
- Error-budget breach automatically downgrades autonomy instead of trying to
  repair itself at the same autonomy level.

## Relationship to Structure

This principle complements
`[[principle-encode-lessons-in-structure]]`. Encode repeated mechanical
lessons in scripts, hooks, templates, or checks; then use this principle to
govern whether that structural change can be promoted.
