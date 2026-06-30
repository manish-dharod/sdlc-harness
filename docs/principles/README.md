# docs/principles/

Named engineering principles for the SDLC harness. Each principle is a
short, single-file rule the role agents and slash commands cite by name
instead of duplicating the rule text inline.

The principles are the **judgment layer** of the framework: they sit
between the deterministic enforcement scripts (e.g. `scripts/feature-reconcile`,
`.claude/hooks/guard-bash.sh`) and the procedural role agents
(`.claude/agents/<role>.md`). When a rule recurs, the answer is rarely "add
more text to the role prompt." It's one of:

1. Encode it in a script / lint / hook (deterministic enforcement).
2. Cite an existing principle that already covers it.
3. Add a new principle here, then have the relevant role(s) cite it.

The order is deliberate. Path 1 is preferred; path 3 is the fallback when
the rule genuinely requires judgment. The meta-principle
[`principle-encode-lessons-in-structure`](principle-encode-lessons-in-structure.md)
is the framework's enforcement of that ordering.

## Initial set (v3)

| Principle | When to cite |
|---|---|
| [encode-lessons-in-structure](principle-encode-lessons-in-structure.md) | **Meta-principle.** Apply whenever a rule recurs. Decide structure vs. principle before adding text. |
| [prove-it-works](principle-prove-it-works.md) | Before marking any task Done. Verify against the real artifact / surface, not a proxy. |
| [fix-root-causes](principle-fix-root-causes.md) | Debugging. Reproduce, trace to the root, fix there. Not papering over symptoms. |
| [boundary-discipline](principle-boundary-discipline.md) | Designing validation, error handling, framework adapters. Guards at system boundaries; trust internal types. |
| [no-sensitive-domain-data](principle-no-sensitive-domain-data.md) | Any code, log, fixture, or commit touching regulated / sensitive data. Sanitized field-shape examples only. |
| [preserve-domain-invariants](principle-preserve-domain-invariants.md) | Any change touching a value or rule with downstream business semantics (pricing, billing, eligibility, regulatory). |
| [no-production-deploys-from-loop](principle-no-production-deploys-from-loop.md) | Any autonomous iteration (`/feature-loop`, `/loop`, agentic SDLC). Production deploys, DNS/firewall changes, live DB mutation, launch flag flips, real carrier traffic are non-negotiably out-of-scope. |

## Agentic-craft additions (adopted 2026-06-30)

Owner-approved additions distilled from external agentic-engineering
practice. They sharpen judgment at decision, debugging, and tooling time.

| Principle | When to cite |
|---|---|
| [weight-quality-over-dev-cost](principle-weight-quality-over-dev-cost.md) | Choosing between implementation/design options. Agents over-price the higher-quality option using human-scale effort estimates; decide on merit, not typing cost. (Not a license to over-engineer — YAGNI still holds.) |
| [reproduce-bugs-end-to-end](principle-reproduce-bugs-end-to-end.md) | Fixing a user-facing bug. Reproduce on the real user surface before fixing; a unit-test-only repro can pass while product behavior stays broken. |
| [tool-ergonomics](principle-tool-ergonomics.md) | Choosing or adding an agent tool (CLI vs MCP, output format). Tool choice measurably affects token cost/latency/success; prefer measured-efficient, record the basis. |
| [vet-third-party-skills](principle-vet-third-party-skills.md) | Before installing/enabling any third-party skill/plugin/MCP. Popularity ≠ safety or quality; require a security read + eval evidence; prefer first-party/vetted. |

## Domain pack (example: payment + insurance pricing)

Domain-specific principles installed alongside the generic set, useful
for adopters whose features touch PCI / payment surfaces or pricing
correctness invariants. The framework ships the two below as a worked
reference set; adopters in other domains write their own pack under
`examples/domains/<your-pack>/` and add similarly-shaped principle
files here.

| Principle | When to cite |
|---|---|
| [no-real-card-data](principle-no-real-card-data.md) | Any code, log, evidence, screenshot, or commit on a PCI surface (vault, card capture, tokens, webhook signature handling). Sanitized field-shape examples only. Specializes `[[principle-no-sensitive-domain-data]]`. |
| [preserve-pricing-safety](principle-preserve-pricing-safety.md) | Any change touching quote, compare, rate, premium, carrier-priced amount, eligibility, or fulfillment of a previously-quoted price. Specializes `[[principle-preserve-domain-invariants]]`. |

## How role agents cite principles

In a role agent's prompt or in CLAUDE.md, reference a principle by its file
slug:

```markdown
Before transitioning a task to Done, apply the
[principle-prove-it-works](docs/principles/principle-prove-it-works.md):
exercise the actual feature on its real surface, not a unit test alone.
```

Or in skill-style wiki-link form:

```markdown
[[principle-prove-it-works]] — verify against the real artifact, not a
proxy.
```

Both forms are valid. Role agents and slash commands should prefer
explicit citations to inline restatement.

## How `/feature-reflect` interacts with this directory

`/feature-reflect <slug>` mines a completed feature's RUNS, EVIDENCE,
FINDINGS, and TASKS for recurring patterns. When it surfaces a candidate
new rule, the **structural-enforcement check** rules on whether the rule
belongs as:

- A new script or lint check (preferred — Path 1 above)
- A citation of an existing principle here (Path 2)
- A new principle file here (Path 3 — last resort)

Items routed to Path 1 are added to the Backlog with `routing:
encode-in-structure` and surfaced for follow-up. Items routed to Path 3
become draft principle files that need owner approval before being added
to this directory.

The directory must never auto-grow. Each new principle is an owner-approved
addition; the agentic loop only proposes.

## Principles vs. CLAUDE.md vs. AGENTS.md

- **CLAUDE.md / AGENTS.md** — framework overview, file map, command
  catalogue. Stable contractual reference for the agentic SDLC. Should
  *shrink* over time as principles take over the rule-statement role.
- **docs/principles/*.md** — atomic, citable rules. Each principle is
  small enough to be the unit of citation.
- **`.claude/agents/<role>.md`** — role prompts. Cite principles by name;
  do not restate them.

The end state: CLAUDE.md is the map, principles are the rules, role
prompts are the procedures. Today CLAUDE.md is doing all three jobs and
has grown past its useful length.
