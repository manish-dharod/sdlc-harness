---
name: principle-preserve-domain-invariants
description: "Apply when a change touches a value or rule with downstream business semantics (pricing, billing, eligibility, regulatory thresholds, audit invariants). Any breakage of these invariants is a P0 finding regardless of test coverage."
disable-model-invocation: true
---

# Preserve Domain Invariants

When code touches a value or rule with downstream business
semantics — pricing, billing, refunds, eligibility, regulatory
thresholds, audit invariants — those invariants must be preserved
under every change. A subtle invariant break that ships is
expensive in a way unit-test failures aren't: it's a customer-
facing or compliance-facing error.

**Why:** Domain invariants are the contract between the system and
the business / regulator. They're often implicit (the database
schema enforces nothing; the application code is the only place
"a refund cannot exceed the original charge" lives). When that
invariant is silently broken by a refactor, no test fails — but
real money / claims / eligibility moves wrong.

**The rule:**

- Every change to a domain-invariant surface (your project's
  pricing / billing / eligibility / regulatory logic, where
  applicable) must:
  1. Identify which invariants the change could affect.
  2. Cite an explicit test (per AC) that asserts each invariant
     still holds.
  3. Run that test as part of the verification step.
- A change without identified invariants on this surface is
  itself a P1 finding.

**What enforcement is in place** (framework-level):

- `planner (Phase: design)` adds an "Invariants touched" section to
  DESIGN.md when the feature touches a domain-invariant surface.
- `reviewer (Mode: acceptance)` walks every declared invariant at release time
  and confirms each has a passing test before READY.
- `reviewer (Mode: adversarial)` considers invariant violations under the
  `tests-pass-behavior-wrong` and `false-confidence` categories.

**Adopter customization:**

Your domain has its own invariants. Examples:
- Billing: "refund ≤ original charge", "invoice total equals line items
  plus tax minus discounts".
- E-commerce: "cart total = sum(line items) - discounts + tax",
  "inventory never goes negative on a confirmed order".
- Multi-tenant SaaS: "tenant A can never read tenant B's data",
  "API rate limit per tenant ≤ plan cap".
- Healthcare: "PHI access events are always logged", "diagnosis
  codes are always normalized to ICD-10".

Create a project-specific principle file that enumerates the specific
invariants and the tests that assert each. Start from this file and make
the examples concrete for your product.

**Anti-pattern:**

A "refactor for clarity" PR that subtly changes a rounding rule
in pricing. A "switch ORM" PR that drops a NOT NULL constraint on
a column the business logic depends on. A "rename column" PR
that doesn't backfill the old column for in-flight transactions.
These are exactly the changes adversarial review must catch.
