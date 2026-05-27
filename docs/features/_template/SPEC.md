# Feature Specification

Last updated: YYYY-MM-DD
Source: <owner | linked doc | meeting notes | etc.>
Version: 1 (increment on every amendment; record amendments in `AMENDMENTS.md`)

## Owner-provided spec

Paste the raw feature spec here verbatim. Do not paraphrase. Subsequent agents
read this section as the source of truth for what the feature *is*.

> <spec text>

## Acceptance criteria (extracted by planner (Phase: intake))

Each acceptance criterion gets a stable ID `AC-###`. Every task in `TASKS.md`
must cite at least one AC ID. `reviewer (Mode: acceptance)` verifies at release time that
every AC ID has a passing test recorded in `TRACEABILITY.md`.

### AC-001: <one-line behavioral assertion>

- Given: <preconditions>
- When: <action>
- Then: <observable outcome>
- Out of scope: <explicit non-goals, if any>

### AC-002: <next>

(repeat)

## Non-functional requirements (NFRs)

Extracted by `planner (Phase: intake)`. Each NFR gets a stable ID `NFR-###` and a measurable
threshold. NFRs without a measurable threshold are pushed back to the owner via
`QUESTIONS.md`.

- NFR-001 — Performance: <p50 / p95 latency, throughput>
- NFR-002 — Accessibility: <WCAG level, screen reader paths>
- NFR-003 — i18n / l10n: <locales, RTL, currency, dates>
- NFR-004 — Security / compliance: <PCI scope, PII handling, audit>
- NFR-005 — Observability: <required metrics, logs, alerts>
- NFR-006 — Error budget / SLA: <target>

## Out of scope

- <explicit non-goals — kept here so future amendments can re-open them>

## Open ambiguities

Anything that could plausibly be interpreted two ways. Each item becomes a
question in `QUESTIONS.md` and blocks task intake until resolved.

- <ambiguity>
