# Reference — Layer 4

> **Layer 4 · Reference** — the gory details. ↑ [Start Here](../START_HERE.md) · [L2 Overview](../AGENT_SDLC_OVERVIEW.md) · [L3 Workflow](../AGENT_SDLC_WORKFLOW.md)

The exact contracts. You usually arrive at one of these pages from a specific
question — *"what flags does `/feature-init` take?"*, *"what does
`feature-ready` exit 2 mean?"*, *"which file owns the threat model?"* — rather
than by reading top to bottom. If you're new, start one or two layers up:
[Overview](../AGENT_SDLC_OVERVIEW.md) for the model, [Workflow](../AGENT_SDLC_WORKFLOW.md)
for the lifecycle.

| Page | Answers |
|---|---|
| [commands.md](commands.md) | Every slash command — signature, what it does, when to use it, what it hands off to. |
| [agents.md](agents.md) | The five role agents — phases/modes, default model, ownership, hand-off rules, iron laws, cited principles. |
| [scripts.md](scripts.md) | Every deterministic script — usage, arguments, and **exit codes** (the contract the agents trust over their own judgment). |
| [control-plane.md](control-plane.md) | The three feature tiers, the full control-plane file set, and the Task / Findings / Design / Approvals **state machines**. |
| [config.md](config.md) | `sdlc.config.yml` keys and every `SDLC_*` environment variable, with precedence. |

For *why* the harness is shaped this way (rather than *what* each piece is),
read the [principles](../principles/) and the [Overview](../AGENT_SDLC_OVERVIEW.md).
