---
name: principle-prove-it-works
description: Before declaring any task Done, verify against the real artifact on the real surface, not a proxy, self-report, or "tests pass." Tests passing ≠ feature works.
metadata:
  type: principle
  layer: verification
  enforced-by:
    - scripts/feature-verify
    - scripts/feature-reconcile (adversarial-trail check)
    - reviewer (Mode: qa) role agent (.claude/agents/reviewer (Mode: qa).md)
---

# Prove It Works

Unverified work has unknown correctness. Indirect verification (file
mtimes, cached screenshots, agent self-reports, "the diff looks right")
feels cheaper than direct observation but acts on a wrong inference. The
cost of acting wrong is always higher than the cost of checking the real
artifact.

## When to apply

After completing any task, before transitioning to Review or Done. The
check is: "how do I prove this actually works on the real surface?"

## Procedure

1. **Identify the real surface.** UI checkout flow → real browser
   on the staging URL. External-API integration → sandbox endpoint
   API. Migration → query the actual table on a staging copy. SEO page →
   the rendered HTML at the actual route.
2. **Build it.** Necessary but not sufficient.
3. **Run it.** Exercise the actual feature path end-to-end on the real
   surface. Capture output (screenshot, log line, query result, HTTP
   response) as the artifact.
4. **Check the full chain.** Does data flow from input to output? Does
   the user-visible state match the database state? Does the carrier API
   receive what the UI claims it sent?
5. **Trust artifacts, not self-reports.** When verifying delegated work
   (builder → reviewer (Mode: qa)), inspect the actual diff / runtime / log, not the
   sub-agent's summary of what it did.
6. **Suspect the observation method first.** A blank screenshot passes a
   lazy gate. When verification "feels off," check that the verification
   itself is real, not that the system is broken.

## Anti-patterns

- "Tests pass, so it works." Tests prove a code path branches a certain
  way. They do not prove the feature behaves correctly end-to-end.
- "It compiles" / "it lints clean" as the only check.
- Verifying delegated work by reading the sub-agent's summary instead of
  the diff and runtime.
- Recording an EVIDENCE row as `pass` without naming the artifact
  (screenshot path, log path, HTTP response capture).
- Marking a UI-touching task Done without exercising the UI on the
  intended browser / device.

## the SDLC harness-specific notes

- For UI / payment / external-integration paths: `scripts/feature-verify <slug>
  full` is the closest sufficient verification, but is itself a wrapper.
  The owner-approved EVIDENCE artifact is the screenshot of the real
  the user-facing flow completing on staging, not the script's exit code.
- For SEO pages: the artifact is the rendered HTML at the production-style
  route, with Lighthouse / Core Web Vitals capture. Server-side render
  output checked against the JSON-LD schema visible-DOM match.
- For migrations: a query against the migrated table on a staging copy
  whose count and shape match the expected post-migration state.
- For framework changes (this very feature): `scripts/test-framework-v3`
  is the artifact-producing harness. The "real surface" is the framework
  itself, exercised on a real (example-feature)
  feature in dry-run mode.

## How role agents apply this principle

- **builder** must cite this principle before transitioning a task to
  Review or Done.
- **reviewer (Mode: qa)** uses this principle to decide whether a verification mode is
  sufficient (fast/unit/full).
- **reviewer (Mode: adversarial)** uses this principle to look for "tests pass but
  behavior wrong" findings — that adversarial category is the
  operationalization of this principle's negative-space.

## Source

Adapted from [pstack `principle-prove-it-works`](https://github.com/cursor/plugins/blob/main/pstack/skills/principle-prove-it-works/SKILL.md).
This adopter's version names the repo's specific surfaces (e.g. checkout,
SEO, migrations, framework) so the principle is concretely actionable.
