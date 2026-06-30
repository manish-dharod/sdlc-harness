---
name: principle-reproduce-bugs-end-to-end
description: Before fixing a user-facing bug, reproduce it end-to-end the way an end user hits it — not only with a unit test. A unit-test-only repro can pass while the product behavior stays broken. Capture the failing user-flow repro before the fix and the passing one after.
metadata:
  type: principle
  layer: verification
  enforced-by:
    - builder role agent (agents/builder.md)
    - reviewer (Mode: qa) role agent (agents/reviewer.md)
    - docs/features/_template/EVIDENCE.md (Type: bug)
---

# Reproduce Bugs End-to-End

Agents default to writing a unit test when asked to fix a bug. A unit
test is cheap and feels like proof, but it asserts a code path branches a
certain way — not that the user-facing behavior is correct. Many real
bugs live precisely in the gap a unit test cannot see: the wiring between
layers, the rendered UI state, the actual HTTP round-trip, the external
API response shape. A fix "proven" only by a green unit test can ship
while the product stays broken.

The discipline: reproduce the failure first, on the surface the end user
actually touches, and only then fix it. Reproducing first also pins the
root cause (pairs with `[[principle-fix-root-causes]]`) instead of
patching a symptom, and the post-fix repro on the same surface is what
actually proves the fix (pairs with `[[principle-prove-it-works]]`).

## When to apply

Any task that fixes a bug in user-facing behavior — a UI flow, an API
response, a checkout/payment/eligibility path, a rendered page. Skip the
end-to-end requirement only for bugs with no user-facing surface (pure
internal helper logic, build tooling), where a unit-level repro is the
real surface.

## Procedure

1. **Identify the user-facing surface** the bug manifests on (the browser
   flow, the API endpoint as the client calls it, the rendered route).
2. **Reproduce the failure on that surface, pre-fix.** Capture the exact
   trigger (user steps / request) and the wrong observable result
   (screenshot, HTTP response, rendered value) — verbatim and sanitized.
3. **Fix the root cause** (`[[principle-fix-root-causes]]`).
4. **Re-run the same user-flow repro, post-fix.** Capture the now-correct
   observable result with the same trigger.
5. **Add a regression test** at the appropriate level. A unit test is
   welcome as a regression guard — but it is in *addition* to the
   end-to-end repro, not a substitute for it.

## Anti-patterns

- Writing a unit test that asserts the fixed function returns the right
  value, then declaring the user-facing bug fixed without ever exercising
  the user flow.
- A `Repro pre-fix` and `Repro post-fix` that both run a unit test for a
  bug whose symptom was a broken button, a non-rendering toast, or a
  wrong rendered total.
- Marking the bug Done with a passing test suite but no artifact showing
  the actual user-facing failure and its resolution.

## the SDLC harness-specific notes

- The `Type: bug` EVIDENCE shape in `docs/features/_template/EVIDENCE.md`
  requires `Repro pre-fix:` and `Repro post-fix:`. For user-facing bugs,
  those repros must exercise the user-facing surface; record
  `Repro surface: user-flow` (or `unit-only` with an explicit reason it is
  the real surface).
- `reviewer (Mode: qa)` and `reviewer (Mode: adversarial)` should flag a
  user-facing bug "fixed" with only a unit-level repro as weak evidence
  (category: tests-pass-behavior-wrong).
- Provenance: adopted 2026-06-30 from external agentic-engineering
  practice ("for bug fixes, always start by reproducing the bug in an
  end-to-end setting as close to how an end user experiences it as
  possible").
