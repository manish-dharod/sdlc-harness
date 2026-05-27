---
name: principle-fix-root-causes
description: When debugging, trace every symptom to its root cause and fix it there. Reproduce first. Resist guards that silence crashes. Symptom fixes accumulate; root-cause fixes shrink the total bug count over time.
metadata:
  type: principle
  layer: verification
  enforced-by:
    - builder role agent (uses superpowers:systematic-debugging skill)
    - reviewer (Mode: adversarial) role agent (looks for symptom-fix patterns)
---

# Fix Root Causes

A nil-check added to silence a crash is a symptom fix. A retry wrapper
around an intermittent failure is a symptom fix. A try/except that
swallows an exception is a symptom fix. Every symptom fix carries
interest: the next debugger has to read the workaround AND the real bug,
and the real bug is still there waiting for the next surface.

Root-cause fixes are slower upfront and reduce total debugging time over
the lifetime of the system.

## When to apply

Whenever debugging a failure, a flake, an "intermittent" issue, or any
behavior that requires a workaround to keep something passing.

## Procedure

1. **Reproduce first.** If you can't reproduce it, you can't verify your
   fix. A bug you can't reproduce on demand is a hypothesis, not a known
   failure.
2. **Ask "why" until you hit the root cause.** Surface symptom → mechanism
   → underlying invariant violation. Don't stop at the first mechanism;
   stop at the place where fixing it makes the symptom impossible.
3. **Resist guards.** A nil-check or try/except that silences a crash
   without explaining why nil could appear in the first place is the
   anti-pattern. The right fix usually establishes the invariant that
   nil cannot reach this point, not the guard that tolerates it.
4. **Check for the pattern, not just the instance.** `rg` for the same
   defect across the codebase. Fix all instances in one diff (per the
   blast-radius discipline in CLAUDE.md).
5. **When stuck, instrument.** Add logging, capture the actual error
   payload, run with a debugger. Don't guess.

## Restart bugs: suspect state, not code

Code doesn't change between runs. State does. When something "fails after
restart," suspect stale persistent state first: config files, caches,
lock files, serialized session state. If clearing a state file restores
behavior, the fix is state validation, not a code patch.

## Anti-patterns

- A `try: ... except Exception: pass` that swallows the real error.
- A retry wrapper around an "intermittent" failure without naming the
  intermittency's source.
- A `defaultdict(int)` that hides a missing-key bug.
- A `.coalesce(0)` or `?? 0` on a value that should never be null.
- A `sleep(1)` to "fix" a race condition.
- Patching one call-site when the same defect exists in N adjacent
  call-sites.

## the SDLC harness-specific notes

- For PCI / payment failures: a guard that silently retries is a
  compliance risk, not just a code smell. Every payment-state-machine
  symptom requires a documented root cause and an evidence trail.
- For vendor API integration failures: capture the vendor's response
  payload before retrying. Most "vendor intermittent" issues are
  payload-shape mismatches that retries don't fix and that the next
  vendor release will make worse.
- For migration failures: the root cause is usually a data-shape
  assumption, not a SQL error. Inspect the offending row before "fixing"
  the migration to be more permissive.
- For SDLC framework bugs (oscillation, drift detection, reconcile
  failures): the root cause is usually a missing structural enforcement
  (per [`principle-encode-lessons-in-structure`](principle-encode-lessons-in-structure.md)).
  The fix is to add the enforcement, not to make the loop tolerate the
  drift.

## How role agents apply this principle

- **builder** invokes `superpowers:systematic-debugging` skill before
  proposing any fix. That skill operationalizes this principle.
- **reviewer (Mode: adversarial)** scans for symptom-fix patterns (guards added without
  invariant explanations, retry wrappers without root-cause notes) as
  one of the false-confidence and negative-path categories.
- **reviewer (Mode: qa)** flags any verification that needs a `sleep` / `retry` /
  `flaky-skip` annotation as a symptom-fix signal.

## Source

Adapted from [pstack `principle-fix-root-causes`](https://github.com/cursor/plugins/blob/main/pstack/skills/principle-fix-root-causes/SKILL.md).
The the SDLC harness version names this repo's specific failure modes (PCI,
vendor integration, migrations, SDLC drift) so the principle ties to
concrete classes of bugs.
