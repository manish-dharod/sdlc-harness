# Start Here

> The map of this documentation. The harness has a large surface, but you
> never read all of it. Pick a **depth** or pick a **need** — both routes are
> below — and descend only as far as you actually need to go.

This page exists because good documentation is *layered*: a newcomer should be
able to understand the whole thing from a two-minute summary, then go one level
deeper, then one more, all the way down to the exact exit code of a single
script — without ever reading a level they didn't need. Each layer below is
roughly **3× deeper** than the one above it and stands on its own.

---

## Route 1 — by depth (the ladder)

Read top-to-bottom. Stop when you know enough for what you're doing.

```
  L0  ┌──────────────────────────────────────────────┐  2 min
      │  README.md — Elevator                         │  what it is, install
      └───────────────────────┬──────────────────────┘
  L1  ┌───────────────────────▼──────────────────────┐  10 min
      │  AGENT_SDLC_OVERVIEW.md — Mental model         │  how to *think* about it
      └───────────────────────┬──────────────────────┘
  L2  ┌───────────────────────▼──────────────────────┐  30 min
      │  AGENT_SDLC_WORKFLOW.md — Lifecycle & mechanics│  how a feature *flows*
      └───────────────────────┬──────────────────────┘
  L3  ┌───────────────────────▼──────────────────────┐  as needed
      │  reference/ — Reference                        │  the exact, gory details
      └──────────────────────────────────────────────┘
```

| Layer | Document | Time | After it, you know… |
|---|---|---|---|
| **L0 · Elevator** | [README.md](../README.md) | ~2 min | What the harness is, what you get, and how to install it (plugin or template clone). |
| **L1 · Mental model** | [AGENT_SDLC_OVERVIEW.md](AGENT_SDLC_OVERVIEW.md) | ~10 min | How to *think* about it: the repo is the memory, the five agents, where parallelism and the safety gates live. |
| **L2 · Lifecycle & mechanics** | [AGENT_SDLC_WORKFLOW.md](AGENT_SDLC_WORKFLOW.md) | ~30 min | How a feature actually flows Spec → Design → Tasks → Code → Review → Release; the state machines; the autonomous loop. |
| **L3 · Reference** | [reference/](reference/) | as needed | Every command, agent, script, control-plane file, and config key — exact, with signatures and exit codes. You arrive here from a question, not by reading straight through. |

---

## Route 2 — by need (the four kinds of docs)

If you'd rather start from what you're trying to *do*, this follows the
[Diátaxis](https://diataxis.fr) split — learning, doing, looking up, understanding.

| If you want to… | Kind | Go to |
|---|---|---|
| **Learn by doing** — stand up your first feature end-to-end | Tutorial | [README → How to use it](../README.md#how-to-use-it), then [Workflow](AGENT_SDLC_WORKFLOW.md) |
| **Accomplish a task** — run an autonomous loop, add a domain pack, wire cross-model review, add a verify profile | How-to | [README → Per-project customization](../README.md#per-project-customization) · [Cross-model review](../README.md#cross-model-review-codex-cli) |
| **Look something up** — a command's flags, a script's exit codes, a config key, a control-plane file | Reference | [reference/](reference/) |
| **Understand *why*** it's built this way — durable state, cross-model review, the severity budget | Explanation | [Overview](AGENT_SDLC_OVERVIEW.md) · [principles/](principles/) |

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
production deploys, secrets, missing approval. Autonomy with brakes.

---

> **Next:** newcomers → [README.md](../README.md) · returning for the model →
> [Overview](AGENT_SDLC_OVERVIEW.md) · operating it → [Workflow](AGENT_SDLC_WORKFLOW.md)
> · agents → [Agent Reading Path](AGENT_READING_PATH.md)
