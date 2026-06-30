# Lineage — where this harness comes from, and what it borrows

> **Level L1→L4 · read as deep as you need · ~3 min for L1, ~20 min for all four.**
> This is the "why does it look like this, and whose ideas are in it" document.
> It answers four things in increasing detail: where the harness came from, the
> family of tools it belongs to, what it takes from each, and exactly how each
> borrowing is wired in. Map of all docs: [START_HERE](START_HERE.md).

This harness did not appear from nothing, and it did not invent most of its good
ideas. It was **distilled from a real production codebase** and it **stands on
the shoulders of several public projects**. Being honest about that is the point
of this page: you should be able to see exactly which idea came from where, why
it was worth taking, and how it shows up in the code you're about to adopt.

---

## L1 · The one-paragraph answer

The harness was **extracted and genericized from a real, money-moving production
line** — a payments / insurance / regulated-data codebase where a wrong price,
a leaked card number, or a deploy that *reported* green while the live site was
broken all had real consequences. Every gate in here exists because a class of
failure actually happened. On top of that hard-won core, it **builds on three
public projects** — [`obra/superpowers`](https://github.com/obra/superpowers)
(the coding-craft skills it runs *on*), [`pstack`](https://github.com/cursor/plugins/tree/main/pstack)
by Lauren Tan (the principles-and-playbooks pattern, plus two commands adapted
almost directly), and the [Claude Code skill primitive](https://docs.claude.com/en/docs/claude-code/skills)
itself. And it sits inside a **recognizable family** of agentic Claude Code
harnesses — most visibly [`gstack`](https://github.com/garrytan/gstack) by Garry
Tan — that have independently converged on the same shape: specialist roles, a
staged workflow, and review gates. If you only read one section, that was it.

---

## L2 · The family, and the two kinds of borrowing

### It belongs to a family

Several teams, working independently, arrived at the same answer to "how do you
let an AI build software without it losing the thread?" The shared shape:

- **Specialist roles instead of one blank-slate assistant** — a planner, a
  builder, reviewers, a security reviewer, a release gate.
- **A staged workflow** — think → plan → build → review → test → ship → reflect.
- **Gates that can say no** — a second opinion, a security pass, a brake before
  destructive or production actions.

`gstack` (Garry Tan), `pstack` (Lauren Tan / Cursor), Superpowers (obra), and
this harness all share that DNA. Recognizing the family matters: it tells an
adopter this is a *converged* design, not one person's private habit.

### Two kinds of borrowing — kept honest

There is a real difference between "we depend on this" and "we learned from
this." This page never blurs them.

**(a) Direct dependencies — code in this repo actually uses these:**

| Source | What we take | Why it was worth taking |
|---|---|---|
| **[Superpowers](https://github.com/obra/superpowers)** (obra) | The coding-craft skills the role agents run *on*: TDD, systematic-debugging, verification-before-completion, brainstorming. | Our roles decide *what to build and in what order with what gates*; Superpowers decides *how each line gets written*. We did not want to re-derive disciplined coding. |
| **[pstack](https://github.com/cursor/plugins/tree/main/pstack)** (Lauren Tan / poteto, Cursor) | The principles-and-playbooks pattern, plus two whole commands adapted from it: `/feature-arena` ← `/arena`, `/feature-why` ← `/why`. | pstack already solved "name the rule once, cite it everywhere" and "pick a playbook for the task." Reinventing it would have been worse. |
| **[Claude Code skills](https://docs.claude.com/en/docs/claude-code/skills)** (Anthropic) | The skill primitive itself — the unit every role, command, and Superpowers capability is packaged as. | It's the substrate. Without it none of the above composes. |

**(b) Peer / convergent design — we learned from these, we do not depend on them:**

| Source | What's parallel | What we took from it |
|---|---|---|
| **[gstack](https://github.com/garrytan/gstack)** (Garry Tan, YC) | Specialist personas as slash commands; the think→plan→build→review→test→ship→reflect sprint; a cross-model second opinion; a "warn before destructive commands" guard; a release/retro step. | Validation that the shape is right, several **documentation practices** (a "see it work" worked example, decision/parallel tables, a credibility hook), and a vocabulary for explaining roles. We do **not** install or call gstack. |

---

## L3 · Per-source: what, why, and how it's wired

### The production origin (anonymized) — why the gates exist

The harness's safety machinery is not theoretical. Each gate traces to a **class
of failure that actually happened** on the production line it came from. Names,
companies, and products are deliberately stripped; the failure *shapes* are the
durable lesson:

| Incident class (what went wrong) | The gate it produced |
|---|---|
| A deploy reported **"9/9 checks green"** while the live surface was broken (an ignored file shipped, a legacy 500, a leaked env var). | `prove-it-works` + `verification-before-completion` + the false-confidence reconcile gates (`.last-verify.json` freshness; whole-surface smoke, not a proxy). |
| A PII scan keyed on **data shape** let a card-shaped value through (and flagged a benign one). | `no-real-card-data` + the sanitizer's **provenance-not-shape** discipline; the bash guard's card-shape deny. |
| A re-rate / rounding path could show a customer **a price the source never quoted**. | `preserve-pricing-safety` / `preserve-domain-invariants` — quoted amounts are locked by a regression test. |
| Reviewers **oscillated forever** re-litigating cosmetic findings. | The severity budget: P0/P1 block, P2 capped at 5, P3 advisory. |
| Three **same-model** adversarial passes missed findings a different model caught immediately. | The cross-model adversarial requirement (opposite-tool review, fail-closed if unavailable). |

This is the part no public project could give us: the gates are credible because
they are scar tissue.

### Superpowers — the coding-craft layer *under* the roles

The relationship is a clean stack: **our roles sit on top of Superpowers skills.**
Our role prompts decide the SDLC; they delegate "how to actually code this" down
to Superpowers, and they cite those skills as **iron laws** at fixed triggers:

- **`builder`** must invoke `superpowers:test-driven-development` *before any
  production code*, `superpowers:systematic-debugging` *the moment verification
  fails*, and `superpowers:verification-before-completion` *before claiming
  Done*. These are not suggestions in the prompt — they are gates.
- **`planner` (intake)** drives the conversation through
  `superpowers:brainstorming` *before writing a single acceptance-criterion ID*,
  inheriting its hard gate: no design proceeds without an approved spec.

Why borrow instead of write our own? Because disciplined TDD, root-cause
debugging, and evidence-before-claims are *solved problems* with a maintained
implementation. We spend our design budget on the SDLC, not on re-deriving them.

### pstack — the principles-and-playbooks pattern, and two adopted commands

pstack's core insight — **name a rule once and cite it by name everywhere,
instead of restating it in every prompt** — is the backbone of our
`docs/principles/` layer. Two of our commands are adapted almost directly:

- **`/feature-arena`** ← pstack's `/arena`: spawn N candidate implementations of
  one risky task, judge them, graft the best ideas into a winner. We kept the
  6-phase pattern and added an eligibility regex so it only spends tokens on
  genuinely high-risk surfaces.
- **`/feature-why`** ← pstack's `/why`: a multi-source evidence investigation
  with named evidence categories, so "why is it like this?" is answered from
  the record, not from a guess.

### gstack — convergent design, and where we learned our docs

We do not call gstack, but the parallels are striking enough to be worth a map —
both because it validates the design and because gstack's README taught us how to
*explain* a harness:

| gstack | this harness | 
|---|---|
| `/codex` — independent second opinion from another model on the same diff | `scripts/adversary-review` / `claude-adversary-review` — opposite-tool adversarial review |
| `/cso` — OWASP/STRIDE security pass with confidence threshold | the `security` role + `scripts/security-review` against `THREAT_MODEL.md` |
| `/careful`, `/guard` — warn/restrict before destructive or production actions | `.claude/hooks/guard-bash.sh` — blocks force-push, `rm -rf`, raw `codex`, unsafe worktrees |
| `/retro` — engineering retrospective | `/feature-reflect` — mine a finished feature for recurring patterns |
| the think→…→reflect sprint | the Spec → Design → Tasks → Code → Review → Release lifecycle |

**Documentation practices we adopted from gstack and Superpowers:** a concrete
"see it work" worked example ([Overview](AGENT_SDLC_OVERVIEW.md#see-it-work)),
scannable role/parallel tables, a short philosophy statement, a credibility hook
up front, and progressive disclosure (read only as deep as you need — this very
page is built that way).

### anthropic-skills — the primitive everything is built from

Every role agent, slash command, and Superpowers capability is a **skill**: a
named, self-contained unit Claude Code can load on demand. The harness is, at
bottom, an opinionated arrangement of skills plus deterministic scripts. The
primitive is Anthropic's; the arrangement is ours.

---

## L4 · Exact wiring and the honest boundaries

### The layering stack

```
        ┌──────────────────────────────────────────────────────────┐
        │  Agentic SDLC harness (THIS repo)                         │  what to build,
        │  roles · lifecycle · gates · principles · scripts         │  in what order,
        └───────────────────────────┬──────────────────────────────┘  with what gates
                                     │  role prompts delegate "how to code"
        ┌───────────────────────────▼──────────────────────────────┐
        │  Superpowers skills (obra)                                │  how each line
        │  TDD · systematic-debugging · verification · brainstorming│  gets written
        └───────────────────────────┬──────────────────────────────┘
                                     │  packaged as
        ┌───────────────────────────▼──────────────────────────────┐
        │  Claude Code skill primitive (Anthropic)                  │  the substrate
        └──────────────────────────────────────────────────────────┘

  pstack (Lauren Tan) ──▶ principles+playbooks pattern, /feature-arena, /feature-why
  gstack (Garry Tan)  ──▶ convergent design + documentation practices (peer, not a dep)
```

### Exact skill wiring (file → skill → trigger → enforcement)

| File | Skill it cites | Trigger | Enforcement |
|---|---|---|---|
| `.claude/agents/builder.md` | `superpowers:test-driven-development` | before any production code | iron law — no prod code without a failing test |
| `.claude/agents/builder.md` | `superpowers:systematic-debugging` | the moment verification fails | iron law — no fix without root-cause first |
| `.claude/agents/builder.md` | `superpowers:verification-before-completion` | before Review/Done | iron law — no completion claim without fresh evidence |
| `.claude/agents/planner.md` | `superpowers:brainstorming` | start of intake, before any AC ID | hard gate — no design without an approved spec |
| `.claude/commands/feature-arena.md` | adapted from pstack `/arena` | high-risk task, N candidates | eligibility regex gates the spend |
| `.claude/commands/feature-why.md` | adapted from pstack `/why` | ambiguity at intake | named evidence categories |

### What we deliberately do NOT take — and where we differ

Honesty cuts both ways. We left things on the table on purpose:

- **From gstack:** no taste-memory / design-shotgun, no cross-vendor agent
  hand-off, no browser-security classifier, no persistent cloud "brain." Those
  are excellent for a high-velocity solo founder; our bias is auditability over
  velocity, and a repo-as-memory model over a separate memory service.
- **From pstack:** we did not import all 19 principles or 14 playbooks — we keep
  a small, owner-approved principle set that *shrinks* over time as rules move
  into deterministic scripts (`principle-encode-lessons-in-structure`).
- **From Superpowers:** we depend on its skills but do not re-document them here;
  the source is authoritative and maintained.

The throughline of every difference: this harness optimizes for **a regulated,
money-moving context where the cost of a confident-but-wrong agent is high** —
so it leans on durable repo state, deterministic gates, cross-model review, and
hard stops at risky boundaries.

---

> **Next:** the mental model → [Overview](AGENT_SDLC_OVERVIEW.md) · the full
> lifecycle → [Workflow](AGENT_SDLC_WORKFLOW.md) · the rules themselves →
> [principles/](principles/) · the whole map → [START_HERE](START_HERE.md).
