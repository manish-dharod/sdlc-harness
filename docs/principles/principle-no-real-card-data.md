---
name: principle-no-real-card-data
description: No raw card data (PAN, CVV, expiry) in any file, log, commit, test fixture, prompt context, or external system. Sanitized field-shape examples only. PCI gates depend on this; one accidental leak kills compliance.
metadata:
  type: principle
  layer: security
  enforced-by:
    - .claude/hooks/guard-bash.sh (regex deny on card-shape patterns)
    - scripts/adversary-review (sanitization tripwire)
    - scripts/security-review (sanitization tripwire)
    - sg-security role agent (PCI surface review)
---

# No Real Card Data

Raw PAN (card number), CVV, and expiry date must never appear in:

- Any file in the repo (code, test fixture, evidence, log artifact,
  prompt context, EVIDENCE markdown, design doc, screenshot).
- Any commit, ever, in any branch, including ones that get rewritten.
- Any prompt context sent to an external LLM (Codex CLI, Anthropic API,
  any third-party agent).
- Any log line, captured stack trace, or runtime instrumentation output.
- Any URL parameter, query string, or HTTP body that the framework
  controls.
- Any debugging session's transcript, screenshot capture, or HAR file.

Use **sanitized field-shape examples** only: `4xxx-xxxx-xxxx-xxxx`
(PAN shape), `123` (a CVV-shape placeholder), `12/25` (an expiry
placeholder). When you need to reference the canonical industry test
PAN by name, write it as `[Visa canonical test PAN — 41xx ...]`
rather than the full 16 digits — the framework's own sanitizer
(`scripts/lib-sanitize.sh`) treats any contiguous-or-separator 16-digit
Visa-shape sequence as sensitive and will refuse to send the
containing context to a third-party model. Same reasoning for other
brand BINs.

## When to apply

Always, on every code or doc change that touches the payment / checkout
surface. The discipline never relaxes.

## Procedure

1. **Reject raw card data at the form boundary.** The page that captures
   card data ships it directly to PCI Vault via tokenization. The
   framework's own code never sees the raw PAN; only the token.
2. **Treat tokens as if they were card data.** Tokens are not card data
   under PCI but should still be logged and stored with the same
   discipline (no plain-text log, no commit).
3. **Sanitize EVIDENCE / FINDINGS.** A screenshot that captures a card
   field must be redacted before the screenshot is committed. Use the
   sanitized test pattern when capturing happy-path screenshots.
4. **Sanitize adversary-review / security-review prompts.** The
   wrappers already tripwire on common card / secret regex patterns;
   they exit 4 with a clear error if a card-shape value appears in the
   prompt. Do not work around the tripwire.
5. **Never paste a real card number into a chat, IDE, terminal, log
   viewer, or screenshot,** even for a "quick test." There is no quick
   test.

## Anti-patterns

- A test fixture with a real PAN that "we'll clean up later."
- A debug log line that prints the form payload before tokenization.
- A screenshot of a real-card test session committed as EVIDENCE.
- A try/except that captures `request.body` into the error message
  (which may contain a PAN if the request hadn't yet tokenized).
- Prompting an LLM with "the card field receives 4127… how should we
  handle…" — the LLM provider's logs are not in our PCI scope.

## What enforcement is in place

- **Guard hook** (`.claude/hooks/guard-bash.sh`) regex-denies a small set
  of obvious card-shape patterns at Bash-tool execution.
- **Sanitization tripwire** in `scripts/adversary-review` and
  `scripts/security-review`. Both source `scripts/lib-sanitize.sh`
  and refuse to send to Codex if a card / secret / PII pattern is in
  the assembled prompt. Exit code 4.
- **Sanitization tripwire — task-block scan** in `scripts/feature-arena`.
  Before writing the task block to `/tmp` candidate dirs or to the
  coordinator manifest, the wrapper scans `TASK_BLOCK` and refuses if
  any pattern matches. Exit code 6 (distinct from feature-arena's
  exit-4 eligibility-refusal). Added per SEC-FND-001 from the
  framework-v3 PR security review.
- **Sanitization tripwire — bundle scan** in `scripts/feature-reflect`
  and `scripts/feature-why`. Both build their context bundle in a
  `mktemp` file, scan the assembled bundle with `sg_sanitize_scan_file`,
  refuse with exit 6 if any pattern matches (no bundle lands at
  `$OUT_FILE`, nothing dispatched to subagents), then `mv` into place
  on the clean path. Added per SEC-FND-002 from the post-SEC-FND-001
  re-review (the sibling bundle writers were missing the scan; class-
  defect not site-defect).
- **`.gitignore`** entries for known-leak file patterns (HAR captures,
  prod-data dumps, mailer-archive replays).
- **`sg-security` role agent** runs on any diff that touches checkout /
  payment / webhook / vault code.

## What enforcement is NOT yet in place (Backlog)

- Pre-commit hook on the developer machine to grep for card-shape
  patterns. Currently relies on the framework's pre-tool guard, which
  only covers agent-driven changes.
- Automated CI scan on every PR. Currently relies on `sg-security`
  reviewing each diff manually.

These gaps are tracked as Backlog items and routed via
[`principle-encode-lessons-in-structure`](principle-encode-lessons-in-structure.md).

## How role agents apply this principle

- **sg-security** treats any card-shape evidence as a P0 finding,
  irrespective of which sub-agent introduced it.
- **sg-swe** must cite this principle before submitting any change on
  the checkout / payment / vault surface.
- **sg-adversary** considers raw-card-data exposure as part of the
  `hidden-coupling` and `env-assumption` categories.

## Source

This principle is domain-specific (PCI is the local concern).
It loosely parallels pstack's general security posture but the rule and
the enforcement points are domain-specific to this repo.
