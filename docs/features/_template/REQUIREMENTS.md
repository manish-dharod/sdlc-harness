# Requirements

Last updated: YYYY-MM-DD

Structured restatement of `SPEC.md` produced by `planner (Phase: intake)`. Where SPEC.md is
the owner's words, this file is the agent's interpretation, organized for
implementation. `reviewer (Mode: acceptance)` later checks that every requirement here is
traced through to a passing test.

## User stories

### US-001: As a <role>, I want <capability> so that <outcome>

- Linked AC IDs: AC-001, AC-002
- Primary path: <happy path summary>
- Alternate paths: <list>
- Error paths: <list>
- Edge cases: <list>

## Functional requirements

(Bulleted assertions, each citing the AC ID it satisfies. If an FR doesn't map
to an AC, push back to SPEC.md or open a question.)

- FR-001 (AC-001): <assertion>
- FR-002 (AC-001, AC-002): <assertion>

## Non-functional requirements

Carried from SPEC.md. Each one must have a measurable threshold and an owner.

- NFR-001 — Performance: <threshold + owner>
- NFR-002 — Accessibility: <threshold + owner>

## Edge cases and negative paths

Explicit list of what *must not* happen and what *must* fail gracefully. These
become test assertions in `TEST_STRATEGY.md`.

- <case>
