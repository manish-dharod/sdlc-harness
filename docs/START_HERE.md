# Start Here

> The map of this documentation. The harness has a large surface, but you
> never read all of it. Pick a **depth** (L1→L4), pick a **question**, or pick a
> **need** — three routes, all below — and descend only as far as you need.

This page exists because good documentation is *layered*: a newcomer should be
able to understand the whole thing from a two-minute summary, then go one level
deeper, then one more, all the way down to the exact exit code of a single
script — without ever reading a level they didn't need. Each layer below is
roughly **3× deeper** than the one above it and stands on its own.

---

## Route 1 — by depth (the L1→L4 ladder)

Read top-to-bottom. Stop when you know enough for what you're doing.

```
  L1  ┌──────────────────────────────────────────────┐  2 min
      │  README.md — Orientation                      │  what it is, install
      └───────────────────────┬──────────────────────┘
  L2  ┌───────────────────────▼──────────────────────┐  10 min
      │  AGENT_SDLC_OVERVIEW.md — Mental model         │  how to *think* about it
      └───────────────────────┬──────────────────────┘
  L3  ┌───────────────────────▼──────────────────────┐  30 min
      │  AGENT_SDLC_WORKFLOW.md — Lifecycle & mechanics│  how a feature *flows*
      └───────────────────────┬──────────────────────┘
  L4  ┌───────────────────────▼──────────────────────┐  as needed
      │  reference/ — Reference                        │  the exact, gory details
      └──────────────────────────────────────────────┘

      LINEAGE.md runs *alongside* all four — itself L1→L4 — for "where this
      came from and what it borrows."
```

| Layer | Document | Time | After it, you know… |
|---|---|---|---|
| **L1 · Orientation** | [README.md](../README.md) | ~2 min | What the harness is, what you get, where it came from, and how to install it. |
| **L2 · Mental model** | [AGENT_SDLC_OVERVIEW.md](AGENT_SDLC_OVERVIEW.md) | ~10 min | How to *think* about it: the repo is the memory, the five agents, where parallelism and the safety gates live — plus a worked "see it work" example. |
| **L3 · Lifecycle & mechanics** | [AGENT_SDLC_WORKFLOW.md](AGENT_SDLC_WORKFLOW.md) | ~30 min | How a feature actually flows Spec → Design → Tasks → Code → Review → Release; the state machines; the autonomous loop. |
| **L4 · Reference** | [reference/](reference/) | as needed | Every command, agent, script, control-plane file, and config key — exact, with signatures and exit codes. You arrive here from a question, not by reading straight through. |
| **Alongside · Lineage** | [LINEAGE.md](LINEAGE.md) | ~3–20 min | Where the harness came from (an anonymized production line) and exactly what it borrows from `superpowers`, `pstack`, `gstack`, and the skill primitive — and how each is wired. |

---

## Route 2 — by question (the four most-asked)

If you arrived with a specific question, jump straight to its answer.

| Your question | Shortest answer | Go deeper |
|---|---|---|
| **What *is* this?** | [README → top](../README.md) · [Overview → The Short Version](AGENT_SDLC_OVERVIEW.md#the-short-version) | [Overview](AGENT_SDLC_OVERVIEW.md) |
| **What does it *do*?** | [Overview → See it work](AGENT_SDLC_OVERVIEW.md#see-it-work) | [Workflow](AGENT_SDLC_WORKFLOW.md) |
| **Why is it useful / why built this way?** | [Overview → Why This Exists](AGENT_SDLC_OVERVIEW.md#why-this-exists) · [Lineage → the production origin](LINEAGE.md#l3--per-source-what-why-and-how-its-wired) | [principles/](principles/) |
| **What parts of other harnesses does it use — and how?** | [Lineage → L1](LINEAGE.md#l1--the-one-paragraph-answer) | [Lineage → L3/L4](LINEAGE.md#l3--per-source-what-why-and-how-its-wired) |

---

## Route 3 — by need (the four kinds of docs)

If you'd rather start from what you're trying to *do*, this follows the
[Diátaxis](https://diataxis.fr) split — learning, doing, looking up, understanding.

| If you want to… | Kind | Go to |
|---|---|---|
| **Learn by doing** — stand up your first feature end-to-end | Tutorial | [README → How to use it](../README.md#how-to-use-it), then [Workflow](AGENT_SDLC_WORKFLOW.md) |
| **Accomplish a task** — run an autonomous loop, add a domain pack, wire cross-model review, add a verify profile | How-to | [README → Per-project customization](../README.md#per-project-customization) · [Cross-model review](../README.md#cross-model-review) |
| **Look something up** — a command's flags, a script's exit codes, a config key, a control-plane file | Reference | [reference/](reference/) |
| **Understand *why*** — durable state, cross-model review, the severity budget, the lineage | Explanation | [Overview](AGENT_SDLC_OVERVIEW.md) · [principles/](principles/) · [Lineage](LINEAGE.md) |

---

## If you are an AI agent

You are not onboarding — you are operating. Read the
**[Agent Reading Path](AGENT_READING_PATH.md)**: an explicit, ordered ingest
contract that tells you exactly which files to load, in what order, what to
extract from each, the operating loop, and the hard stops. The same harness,
documented once for humans (above) and once as a machine-ingestable contract.

---

## The whole thing in one paragraph

The harness lets AI agents build software without losing the thread. Every
feature is a folder of Markdown under `docs/features/<slug>/` — spec, design,
tasks, evidence, findings, approvals, release status — so **the repo is the
memory, not the chat**. Five role agents (`planner`, `builder`, `reviewer`,
`security`, `release`) do the work; deterministic bash **scripts** enforce the
gates with exit codes (not opinions); independent **reviewers run in parallel**
to cut blind spots, with a different-model adversarial pass for high-risk
diffs; a **severity budget** (P0/P1 block, P2 capped, P3 advisory) keeps review
from oscillating; and the harness **stops and asks** at every risky boundary —
production deploys, secrets, missing approval. Autonomy with brakes. It was
distilled from a real production line and built on `superpowers`, `pstack`, and
the Claude Code skill primitive — see [Lineage](LINEAGE.md).

---

> **Next:** newcomers → [README.md](../README.md) · returning for the model →
> [Overview](AGENT_SDLC_OVERVIEW.md) · operating it → [Workflow](AGENT_SDLC_WORKFLOW.md)
> · where it came from → [Lineage](LINEAGE.md) · agents → [Agent Reading Path](AGENT_READING_PATH.md)
