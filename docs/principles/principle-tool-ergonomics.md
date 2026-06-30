---
name: principle-tool-ergonomics
description: Agent tool choice measurably affects token cost, latency, and success rate. Prefer tools measured to be efficient — a CLI over a heavy MCP server for the same job, token-efficient output over verbose JSON — and record the basis for a tool choice instead of defaulting to the most popular option.
metadata:
  type: principle
  layer: tooling
  enforced-by:
    - planner role agent (agents/planner.md) — design-phase tool choices
    - reviewer (Mode: quality) role agent (agents/reviewer.md)
---

# Tool Ergonomics

The tools an agent reaches for are not free and not interchangeable. The
same task done through different tools can differ by multiples in token
cost and latency, and by a real margin in success rate. A verbose tool
quietly taxes every request that uses it; a chatty MCP server can cost
several times the tokens and double the latency of the equivalent CLI for
the same operation. These costs compound across a long agentic session
and across many parallel sessions.

The discipline: treat tool ergonomics as a real design axis. Prefer the
tool measured to be efficient for the job, and when you add or choose a
tool, record *why* — not "it's popular" but "it's cheaper / faster / more
reliable for this."

## When to apply

- Choosing how a feature or agent will reach an external system (GitHub,
  a browser, a vendor API): CLI vs MCP vs raw HTTP.
- Defining a new tool/command's output format.
- Reviewing a diff that adds a dependency, an MCP server, or a tool
  integration.

## Procedure

1. **Prefer the lean path for the job.** For GitHub operations, prefer
   the `gh` CLI over a general-purpose GitHub MCP server — the CLI is
   markedly cheaper in tokens and latency for the same tasks. Reach for a
   heavier integration only when it buys a capability the lean path
   genuinely lacks.
2. **Make output token-efficient.** When you define a tool or command's
   output, prefer a compact, scannable format over verbose JSON when the
   consumer is an agent; verbose structured output can cost a large
   fraction more tokens for no added signal.
3. **Measure before adopting, not after.** Before standardizing on a tool,
   have a basis (a quick token/latency/success comparison, or a cited
   benchmark). Popularity is not evidence of efficiency
   (`[[principle-vet-third-party-skills]]`).
4. **Record the basis.** Note in `DECISIONS.md` or the design why the
   chosen tool wins, so the choice is auditable and revisitable.

## Anti-patterns

- Wiring in a heavyweight MCP server for something the existing CLI
  already does more cheaply.
- Emitting large JSON blobs from a script an agent reads, when a compact
  line-oriented format carries the same information.
- "Everyone uses tool X" as the justification for adopting it, with no
  cost/latency basis.

## the SDLC harness-specific notes

- This harness already accesses GitHub via the `gh` CLI (not an MCP
  server) — that is a deliberate ergonomics choice, not an accident.
- Deterministic `scripts/` already favor compact stdout (verdict lines,
  exit codes) over verbose payloads; keep new scripts in that style.
- Provenance: adopted 2026-06-30 from external agentic-engineering
  practice (benchmarks showing GitHub MCP ≈ 3× token cost and >2× latency
  vs the CLI, and token-efficient output ≈ 40% cheaper than JSON).
