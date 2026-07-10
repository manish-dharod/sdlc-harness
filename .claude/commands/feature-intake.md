---
description: Convert messy owner context into a sanitized, plan-first feature intake bundle before implementation
argument-hint: <feature-slug> [context-path-or-url ...]
---

You are running `/feature-intake` for `$ARGUMENTS`.

This command turns raw owner context into durable SDLC state. It captures the
useful agentic-engineering pattern: **plan first, preserve raw context safely,
then let the harness drive execution**. It is not an implementation command.

## Safety boundary

- No production deploys, launch flag flips, live DB mutation, or live customer
  traffic.
- No permission bypass setup, email-to-agent daemon, remote-control default,
  browser-cookie automation, or global "YOLO" configuration.
- Do not paste secrets, payment/card data, auth headers, private keys, or
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

For URLs, record the URL, fetch date, title, and short source notes. Do not
import large third-party text blindly; cite and summarize only what the task
needs.

## Step 2 - Plan for the plan

Before writing implementation tasks, produce a short "plan for the plan":

```text
Context to read:
- <file/url>

Questions to answer from evidence:
- <question>

Artifacts to update:
- SPEC.md / REQUIREMENTS.md / QUESTIONS.md / DESIGN.md / INCREMENTS.md / TASKS.md

Acceptance criteria to extract:
- AC-###

Risk checks:
- security / auth / migration / public URL / launch gate

Verification shape:
- scripts/feature-verify $1 fast|unit|full
```

Use `/feature-why $1 "<question>"` for ambiguity that may already be answered
by repo history, docs, or issues before opening a QUESTIONS.md row.

## Step 3 - Update control-plane files

Invoke the role flow appropriate to the phase:

- `planner` with `Phase: intake` for SPEC / REQUIREMENTS / QUESTIONS.
- `planner` with `Phase: design` for DESIGN / TEST_STRATEGY / threat model /
  rollback.
- `planner` with `Phase: plan` for TASKS / STATE / DECISIONS / APPROVALS /
  RELEASE_GATES.

For medium/large features, `planner` with `Phase: plan` must replace the
generic INC-001 placeholder with the smallest experiential user journey and
map only that increment's tasks as claimable. Later increments remain
Planned/Backlog.

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
- Current increment and experience surface:
- Verification recommendation:
- Sanitizer result:
```

If intake discovers sensitive or production-gated work, stop at APPROVALS.md
and do not continue into implementation.
