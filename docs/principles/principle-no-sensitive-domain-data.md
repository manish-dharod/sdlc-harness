---
name: principle-no-sensitive-domain-data
description: "Apply when handling regulated / sensitive data in code, logs, fixtures, prompts, or evidence. Never let real values reach disk or third-party services; use sanitized field-shape examples only. Adopters extend the specific patterns (card data, PHI, secrets) in their domain principle file."
disable-model-invocation: true
---

# No Sensitive Domain Data

Sensitive data — by your domain's definition — never reaches the
repo, the prompt context, the evidence trail, or a third-party model.
Sanitized field-shape examples only.

**Why:** Regulated data has compliance consequences (PCI, HIPAA,
GDPR, CCPA, ITAR, sector-specific). Even one accidental commit
or LLM prompt with real values is a breach, regardless of how
quickly it gets reverted. The strict rule "no real values, ever, in
any tracked or transmitted artifact" is the only one that scales.

**The rule:**

- Real cardholder data, PHI, customer PII, credentials, tokens,
  webhook secrets, or any value your domain classifies as
  regulated: never in code, logs, fixtures, prompts, evidence, or
  commits.
- Replace with **sanitized field-shape examples**: `cardNumber:
  string (16-19 digits, Luhn-valid)` instead of `4111 1111 1111
  1111`; `email: string (RFC 5322)` instead of `jane@example.com`
  unless that example domain is the agreed convention.

**What enforcement is in place** (framework-level):

- `scripts/lib-sanitize.sh` — shared sanitizer covering secrets
  (PEM keys, AWS / Stripe / Slack / GitHub tokens, password= /
  api_key=), card patterns (Visa / Mastercard / Amex / Discover /
  JCB BINs in contiguous + spaced + hyphenated forms), labeled
  CVV/expiry, US SSN shape.
- Three cross-model surfaces source the library:
  `scripts/adversary-review` (exit 4 on tripwire),
  `scripts/security-review` (exit 4),
  `scripts/feature-arena` (exit 6 — refuses before any /tmp write
  or candidate dispatch),
  `scripts/feature-reflect` (exit 6 — refuses before bundle
  lands),
  `scripts/feature-why` (exit 6 — refuses before bundle lands).
- The bash guard hook blocks raw `codex` invocations; only the
  sanctioned wrappers may invoke Codex.
- `.gitignore` excludes per-invocation context bundles (`reflect/`,
  `why/`, `arena/` artifacts).

**Adopter customization:**

Your domain-specific principle extends this with the specific value classes
you care about. Add the relevant `grep` patterns to
`scripts/lib-sanitize.sh` `sg_sanitize_patterns()`.

**How role agents apply this principle:**

- `security` treats any matched sensitive-data pattern in a
  diff as a P0 finding.
- `builder` must cite this principle before submitting any change
  on a regulated-data surface.
- `reviewer (Mode: adversarial)` considers raw-data exposure as part of the
  `hidden-coupling`, `env-assumption`, and `tests-pass-behavior-
  wrong` categories.

**Anti-pattern:**

A debug log line that prints a request body before tokenization.
A fixture that uses a real test value. A screenshot with real PII
committed as EVIDENCE. Pasting a real value into an LLM prompt —
the model provider's logs are not in your compliance scope.
