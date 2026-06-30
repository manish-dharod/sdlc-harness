---
name: principle-weight-quality-over-dev-cost
description: When choosing between implementation or design options, do not over-weight development cost. Agents estimate effort from human-developer training data and systematically over-price the higher-quality option, biasing toward cheap, less scalable, harder-to-maintain solutions. Weight correctness, scalability, and maintainability on their own merits.
metadata:
  type: principle
  layer: design
  enforced-by:
    - planner role agent (agents/planner.md) — design-phase trade-offs
    - builder role agent (agents/builder.md) — implementation choices
    - reviewer (Mode: quality) role agent (agents/reviewer.md)
---

# Weight Quality Over Development Cost

Coding agents are trained on human-authored data, so when they estimate
"how long would this take" they answer in human terms — days, weeks,
months. That estimate is wrong for an agent: the same change is far
cheaper for the agent to actually build. The bias is silent but
corrosive. When an agent weighs option A (clean, scalable, more code) vs
option B (a quick hack), it implicitly inflates A's cost using the human
estimate and picks B. The result is a steady drift toward cheap,
low-quality, hard-to-maintain solutions that nobody explicitly chose.

## When to apply

Any time you choose between two or more ways to satisfy the same
requirement: design-phase architecture trade-offs, an implementation
approach inside a task, or a reviewer judging whether a diff took the
lazy path.

## Procedure

1. **Name the options.** State the candidate approaches and what each
   optimizes for (correctness, scalability, maintainability, blast
   radius, dev effort).
2. **Discount the effort axis.** When the only thing pushing you toward
   the weaker option is "it's less work to build," treat that as a weak
   signal. Agent build cost is a fraction of the human-scale estimate
   your prior is anchored to.
3. **Decide on merit.** Choose on correctness, scalability, and
   maintainability. Pick the cheaper option when it is genuinely the
   right design (YAGNI still applies — don't gold-plate), not merely
   because it is faster to type.
4. **Record the trade-off.** If the decision is durable, capture it in
   `DECISIONS.md` (or the design rationale) naming why the chosen option
   wins on merit, not on effort.

## Anti-patterns

- "Let's just inline it / hardcode it / skip the abstraction — the
  proper version would take too long." The "too long" is a
  human-scale estimate applied to an agent.
- Choosing a non-scalable data shape, a copy-paste over a shared helper,
  or a string-match over a real parser because the robust version "isn't
  worth the build time."
- Confusing this principle with "always build the bigger thing." It is
  not a license to over-engineer. YAGNI and smallest-scoped-change still
  govern; this only removes the false effort penalty on the *better*
  design.

## the SDLC harness-specific notes

- Pairs with `[[principle-encode-lessons-in-structure]]`: the structural
  fix is usually the higher-quality option whose cost the agent was
  over-pricing.
- Does not override `[[principle-no-production-deploys-from-loop]]` or any
  safety guardrail — "higher quality" never means reaching outside task
  ownership or the loop's safety boundary.
- Provenance: adopted 2026-06-30 from external agentic-engineering
  practice (a senior practitioner's observation that frontier models
  estimate dev cost in human time and under-value the better option).
