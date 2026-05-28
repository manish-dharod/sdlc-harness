---
name: principle-boundary-discipline
description: Guards at system boundaries (HTTP/webhook in, carrier API out, DB write-time, user input). Trust internal types. Keep business logic pure. Validation belongs at the edge, not scattered through call chains.
metadata:
  type: principle
  layer: architecture
  enforced-by:
    - reviewer (Mode: quality) role agent (calls out scattered validation)
    - security role agent (PCI / webhook boundary verification)
    - planner (Phase: design) role agent (DESIGN.md API surface section)
---

# Boundary Discipline

A system has a small number of boundaries (HTTP requests in, webhook
events in, DB writes, calls to external carriers/PCI vault/payment
processor, user-supplied form input). Defensive logic — validation,
parsing, type narrowing, error wrapping — belongs at those boundaries.
Once a value is inside the system's typed core, downstream code should be
able to trust it.

When validation leaks past the boundary, every call site becomes a place
that has to re-check, re-cast, re-handle nulls. The codebase becomes
defensive everywhere and trustful nowhere.

## When to apply

Whenever you're about to write a guard, a try/except, a null-check, or a
type narrow inside business logic that's already 3+ levels deep from the
boundary. The right question is: should this validation exist HERE, or at
the boundary?

## Procedure

1. **Name the boundaries explicitly.** For the SDLC harness:
   - HTTP request handlers (controllers, view methods).
   - Webhook event consumers (carrier callbacks, PayPal IPN, Stripe
     webhooks).
   - Database write operations (form submission → INSERT/UPDATE).
   - Outbound HTTP to carrier APIs / PCI vault.
   - User-uploaded files.
   - Cron / job entry points.
2. **Push validation to the boundary.** Validate, parse, narrow types
   ONCE, at the boundary. Throw / 4xx / log+reject at the boundary.
3. **Trust internal types.** Inside a domain service, after the boundary,
   downstream code receives validated types and assumes them. No second
   null check on the same field.
4. **Keep business logic pure.** A quote-rating function takes a
   validated `QuoteRequest`, returns a `QuoteResult`. No HTTP types, no
   ORM lazy loads, no error swallowing.
5. **Error-wrap at the boundary on the way out.** A domain exception
   bubbles up; the boundary translates it to a 4xx, a webhook ack, or a
   carrier-error log.

## Anti-patterns

- Null checks in every method of a 4-deep call chain because "you never
  know" — you do know, if validation is at the boundary.
- Boundary code that *also* contains business logic, so the boundary
  layer thickens and validation drifts.
- Internal services that take untyped `dict`s and rebuild the validation
  inside themselves.
- "Defensive" try/except in the middle of business logic that catches
  errors the boundary should have rejected.
- Webhook handlers that parse the payload inline in the handler with
  no schema validation — the next carrier upgrade changes one field shape
  and nothing notices until production.

## the SDLC harness-specific examples

- **Insurance quote form → quote service.** Form validation lives in the
  controller; the quote service receives a typed `QuoteRequest` and
  trusts it. No re-validation of date formats inside the rating logic.
- **Carrier webhook ack.** Webhook signature verification at the
  boundary; payload parsed into a typed event object; the event-handler
  service trusts the parsed event.
- **secrets vault tokenization request.** Card-shape validation at the
  boundary (controller); the vault-client service trusts the validated
  request. The vault-client must never see raw card data
  (cross-references [`principle-no-real-card-data`](principle-no-real-card-data.md)).
- **DB write at form submission.** Schema validation + business-rule
  validation at the controller; the persistence layer trusts the
  validated entity.

## How role agents apply this principle

- **planner (Phase: design)** names the system boundaries explicitly in DESIGN.md's
  "API surface" section. Validation at the boundary is a design
  invariant, not an implementation detail.
- **reviewer (Mode: quality)** opens findings when validation is scattered through
  internal services or when the boundary itself does business logic.
- **security** uses this principle to check webhook signature
  handling, PCI tokenization, and authentication checks: all must happen
  at the boundary, not deep in handler chains.

## Source

Adapted from [pstack `principle-boundary-discipline`](https://github.com/cursor/plugins/blob/main/pstack/skills/principle-boundary-discipline/SKILL.md).
The the SDLC harness version names this repo's specific boundaries (forms,
webhooks, carrier APIs, secrets vault) so reviewers can point at concrete
boundaries when applying the principle.
