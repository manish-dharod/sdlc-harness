---
description: Convert messy owner context into a sanitized, plan-first feature intake bundle before implementation
argument-hint: <feature-slug> [context-path-or-url ...]
---

You are running `/feature-intake` for `$ARGUMENTS`.

This command operationalizes the useful part of the agentic-engineering
article: **plan first, preserve raw context safely, then let the SDLC harness
drive execution**. It is not an implementation command.

## Safety boundary

- No production deploys, launch flag flips, live DB mutation, carrier traffic,
  or payment/card handling.
- No permission bypass setup, email-to-agent daemon, remote-control default,
  browser-cookie automation, or global "YOLO" configuration.
- Do not paste secrets, raw PAN/CVV/expiry, auth headers, private keys, or
  webhook secrets into feature files. If context might contain sensitive data,
  run `scripts/sanitize-check <path>` before reading or moving it.
- Store durable context in repo files. Chat is not the source of truth.

## Step 0 - Rehydrate or initialize

Run:

```bash
scripts/feature-context $1
```

If the feature does not exist, ask before scaffolding unless the user already
asked for a new feature. For a new feature, prefer the smallest workable tier:

```bash
scripts/feature-init $1 --tier medium
```

## Step 1 - Gather raw context safely

For each local context path supplied after the slug:

```bash
scripts/sanitize-check <path>
```

Only after the sanitizer passes, copy or summarize the context into:

```text
docs/features/$1/intake/
```

Use descriptive filenames such as:

```text
YYYY-MM-DD-owner-note.md
YYYY-MM-DD-terminal-error.md
YYYY-MM-DD-meeting-transcript.md
YYYY-MM-DD-source-links.md
```

For URLs, record the URL, fetch date, title, and short source notes. Do not
import large third-party text blindly; cite and summarize only what the task
needs.

## Step 2 - Plan for the plan

Before writing implementation tasks, produce a short "plan for the plan" in
the session:

```text
Context to read:
- <file/url>

Questions to answer from evidence:
- <question>

Artifacts to update:
- SPEC.md / REQUIREMENTS.md / QUESTIONS.md / DESIGN.md / TASKS.md

Acceptance criteria to extract:
- AC-###

Risk checks:
- security / pricing / auth / migration / public URL / SEO / launch gate

Verification shape:
- scripts/feature-verify $1 fast|unit|full
```

Use `/feature-why $1 "<question>"` for ambiguity that may already be answered
by repo history, docs, or issues before opening a QUESTIONS.md row.

## Step 3 - Update control-plane files

Invoke the appropriate role flow:

- `sg-product` for SPEC / REQUIREMENTS / QUESTIONS.
- `sg-architect` for DESIGN / TEST_STRATEGY / THREAT_MODEL / rollback.
- `sg-tech-lead` for TASKS / STATE / DECISIONS / APPROVALS / RELEASE_GATES.

Keep the diff docs-only unless the user explicitly asked for implementation in
the same turn.

## Step 4 - Handoff

Run:

```bash
scripts/feature-reconcile $1
scripts/feature-next-task $1
```

Report:

```text
## Intake result for $1

- Intake files added:
- SPEC / QUESTIONS / DESIGN status:
- New AC/NFR IDs:
- Open ambiguity questions:
- Next claimable task:
- Verification recommendation:
- Sanitizer result:
```

If intake discovers sensitive or production-gated work, stop at APPROVALS.md
and do not continue into implementation.
