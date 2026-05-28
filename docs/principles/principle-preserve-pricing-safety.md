---
name: principle-preserve-pricing-safety
description: Any change touching insurance quote, rate, comparison, or carrier-priced amount must preserve correctness invariants. Wrong price displayed to a customer = booking obligation we cannot honor + compliance liability.
metadata:
  type: principle
  layer: business-correctness
  enforced-by:
    - sg-architect role agent (DESIGN.md must name pricing invariants)
    - sg-reviewer role agent (P0 finding on pricing-touching diff without invariant test)
    - sg-acceptance role agent (spec conformance check on pricing AC IDs)
---

# Preserve Pricing Safety

Pricing is a customer-promise surface. When a quote displays a number,
the customer reasonably believes they can purchase at that price, and a
significant fraction of state insurance regulations make that belief
binding. Software bugs that show wrong prices have an immediate dollar
cost (we honor the displayed price or eat the regulator fine) and a
compounding trust cost.

This principle is not about caution. It's about which class of bug is
acceptable in production. Slow page = annoying. Wrong price = breach.

## Pricing invariants we never break

1. **Quote determinism.** The same input must always produce the same
   quote within the validity window (typically the price-quoted-at
   timestamp). A second refresh that produces a different number is a
   bug regardless of how small the delta.
2. **Carrier amount preserved.** When we show "Carrier X — $123.45,"
   the carrier's response said $123.45. We do not round, re-rate, or
   adjust without an explicit, audited transform that's named in the
   spec.
3. **Currency clarity.** A price is always rendered with its currency
   (USD primarily). No bare numbers.
4. **Quote expiry honored.** A displayed price has a validity window;
   purchasing after the window expires re-quotes, never silently
   succeeds at the stale price.
5. **Insurance-required disclosure shown.** Any quoted price has the
   carrier name, the plan name, the validity, and the disclosures
   visible at the moment of display.
6. **No silent fallback to a different carrier.** If carrier X's API is
   down, the quote page shows "carrier X unavailable" — it does NOT
   silently substitute carrier Y's quote in the same row.

## When to apply

Any diff that touches:

- The quote engine (`/quotes`, `/compare`, rate / score logic).
- The carrier API client(s).
- The rendering of any price on any visible page (insurance and
  marketing surface).
- The session / cookie / cache logic that holds a quoted price.
- The booking handoff (price-as-quoted → price-as-booked verification).
- Any migration on tables that store quoted-or-booked prices.

## Procedure

1. **Name the invariant being changed (or preserved) in DESIGN.md.**
   `sg-architect` writes an explicit "Pricing invariants touched" row
   if any are at risk; "none" if not.
2. **Add or update a regression test that locks the invariant.** A
   functional test that takes a known input and asserts the quoted
   output, on a real carrier sandbox (not a mock that re-implements the
   rate logic).
3. **Run the test on the actual rendered page,** not just at the
   service layer. The user sees the rendered DOM; the test should too
   (per [`principle-prove-it-works`](principle-prove-it-works.md)).
4. **Capture before / after pricing for the same input** if the diff
   intentionally changes a calculation. The PR description must show
   both numbers and the regulatory / business justification.
5. **Coordinate with carrier-coverage testing** for migrations that
   change stored prices. A migration that re-rates historical quotes
   is not a refactor; it's a customer-visible change.

## Anti-patterns

- A "minor refactor" of rate logic with no test that locks the output
  number.
- A change to the rounding / formatting of a price under the assumption
  that the underlying number is unchanged. Verify the underlying number
  first.
- Adding a fallback that returns "$0.00" when a carrier API errors,
  instead of failing the quote-comparison entirely.
- Storing a quoted price without the timestamp + carrier+plan key, so
  later auditing can't reconstruct what was promised when.
- Mocking the carrier rating logic in a test instead of hitting the
  carrier sandbox.

## How role agents apply this principle

- **sg-architect** lists "Pricing invariants touched: <list> | none" in
  DESIGN.md for every feature on the pricing surface.
- **sg-reviewer** opens a P0 finding when a pricing-touching diff has
  no invariant test, or when an existing test is weakened without
  documented business reason.
- **sg-acceptance** walks the AC traceability matrix and verifies
  every pricing AC has a passing test before allowing release.
- **sg-adversary** considers pricing as a category-1 failure mode:
  silent-substitution / stale-quote / rounding-drift findings are P0.

## Source

This principle is a domain-pack example for insurance, payments, travel,
marketplace, and other pricing-sensitive adopters. Wrong prices are
disproportionately expensive (regulatory + customer-promise) compared to
other classes of bug.
