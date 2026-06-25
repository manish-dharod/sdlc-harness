# sdlc-harness

A reusable agentic SDLC harness. Brings principled, evidence-backed,
cross-model-reviewed software delivery to any project that uses
[Claude Code](https://claude.com/claude-code) (and works with Codex CLI
for cross-model adversarial / security review).

Inspired by [`obra/pstack`](https://github.com/cursor/plugins/tree/main/pstack)
(Lauren Tan / poteto / Cursor) and designed as an adopter-ready template for
Claude Code projects.

## Documentation

The docs are **layered** — read only as deep as you need, each level ~3×
deeper than the last:

| Layer | Read | For |
|---|---|---|
| **L0 · Elevator** | this README (~2 min) | what it is + how to install |
| **L1 · Mental model** | [docs/AGENT_SDLC_OVERVIEW.md](docs/AGENT_SDLC_OVERVIEW.md) (~10 min) | how to *think* about it |
| **L2 · Lifecycle** | [docs/AGENT_SDLC_WORKFLOW.md](docs/AGENT_SDLC_WORKFLOW.md) (~30 min) | how a feature *flows* |
| **L3 · Reference** | [docs/reference/](docs/reference/) (as needed) | every command, script, file, config — exact |

**→ [docs/START_HERE.md](docs/START_HERE.md)** is the full map (navigate by
depth *or* by need). Operating the harness *as an agent* rather than reading
it? Use the machine-ingestable [docs/AGENT_READING_PATH.md](docs/AGENT_READING_PATH.md).

## What you get

| | |
|---|---|
| **Role agents** (`.claude/agents/*.md`) | 5 specialized roles: `planner` (intake / design / plan phases), `builder` (implementation), `reviewer` (quality / qa / adversarial / acceptance modes), `security`, `release`. Each cites principles by name + has clear hand-off rules. (Collapsed from 10 in v1.0 — see [docs/MIGRATING_v1.0_to_v1.1.md](docs/MIGRATING_v1.0_to_v1.1.md).) |
| **Slash commands** (`.claude/commands/`) | 17 commands across the lifecycle: `/feature-init`, `/feature-intake`, `/feature-context`, `/feature-claim`, `/feature-next-task`, `/feature-loop`, `/feature-orchestrate`, `/feature-review`, `/feature-verify`, `/feature-reconcile`, `/feature-ready`, `/feature-amend`, `/feature-reflect`, `/feature-learn`, `/feature-why`, `/feature-arena`, `/harness-improve`. Full catalogue: [docs/reference/commands.md](docs/reference/commands.md). |
| **Principles** (`docs/principles/`) | 5 universal principles + a README index. Meta-principle: `principle-encode-lessons-in-structure` — when a rule recurs, encode it as a script/check, not more prompt text. |
| **Feature templates** (`docs/features/_template{,_medium,_small}/`) | Three tiers: small (1 file), medium (5 files), large (19 files). |
| **Scripts** (`scripts/`) | Deterministic feature lifecycle (init/context/next-task/verify/ready/reconcile), credential preflight, cross-model wrappers (adversary-review, security-review) backed by Codex CLI, shared sensitive-data sanitizer (lib-sanitize.sh), test harness (test-framework-v3). |
| **Bash guard hook** (`.claude/hooks/guard-bash.sh`) | Blocks destructive git operations + raw codex invocations. |
| **Domain packs** (`examples/domains/`) | Optional starter configuration for common project shapes such as web apps, services, and CLI tools. |
| **Shareable docs** (`docs/share/*.html`) | Standalone browser-ready versions of the overview and workflow docs, formatted for easy reading and sharing. |

## How to use it

There are two install paths. Pick whichever fits your project.

### Path 1 — Plugin install (Claude Code v2.1+)

Adds the framework as a Claude Code plugin. Slash commands are
namespaced (`/sdlc-harness:feature-init`), scripts and agents are
loaded from the plugin's cache directory. **Easiest to update** (one
command) but you can't customize the framework files directly without
forking.

```text
/plugin marketplace add manish-dharod/sdlc-harness
/plugin install sdlc-harness@sdlc-harness
```

Then try a slash command:

```text
/sdlc-harness:feature-context <slug>
```

To update: `/plugin update sdlc-harness`. To uninstall: `/plugin uninstall sdlc-harness`.

### Path 2 — Template clone (clone-and-customize)

The original install pattern. Copies the framework files directly into
your project's `.claude/` dir. Slash commands are un-namespaced
(`/feature-init`). **Easiest to customize** — every framework file is
yours to edit — but updates are manual.

```bash
# In your project root:
git clone https://github.com/manish-dharod/sdlc-harness.git /tmp/sdlc-harness

# Copy the framework dirs into your repo:
cp -R /tmp/sdlc-harness/.claude/agents/*.md           .claude/agents/
cp -R /tmp/sdlc-harness/.claude/commands/feature-*.md .claude/commands/
cp -R /tmp/sdlc-harness/.claude/hooks/                .claude/
cp -R /tmp/sdlc-harness/docs/principles/              docs/
cp -R /tmp/sdlc-harness/docs/features/_template*      docs/features/
cp -R /tmp/sdlc-harness/scripts/                      .
cp /tmp/sdlc-harness/docs/AGENT_SDLC_WORKFLOW.md      docs/

# Commit as your initial framework import
git add .claude docs scripts
git commit -m "chore: import sdlc-harness framework"
```

### Picking a path

| Aspect | Plugin install | Template clone |
|---|---|---|
| Slash command names | `/sdlc-harness:feature-init` (namespaced) | `/feature-init` (un-namespaced) |
| Customization | edit your own overlay; framework upgrades wipe local edits | every file is yours to edit |
| Updates | `/plugin update sdlc-harness` | re-run the `cp -R` commands manually |
| Version pinning | pinned to the marketplace's commit SHA | pinned to your import commit |
| Best for | adopters who want to consume the framework as-is | adopters who want to customize per-project |

### Per-project customization

The framework is intentionally generic. There are three places you'll
typically customize:

#### 1. Domain-specific principles

The framework ships 5 universal principles in `docs/principles/`:
- `principle-encode-lessons-in-structure` (the meta-principle)
- `principle-prove-it-works`
- `principle-fix-root-causes`
- `principle-boundary-discipline`
- `principle-no-production-deploys-from-loop`

If your project handles regulated data or business-critical calculations, copy
and specialize the generic principles:

- `principle-no-sensitive-domain-data.md` — customer data, tokens, regulated
  records, or other sensitive payloads.
- `principle-preserve-domain-invariants.md` — prices, balances, permissions,
  quotas, eligibility, or other correctness rules your product cannot violate.

Or write your own (e.g., `principle-no-real-phi-data` for HIPAA). The
role agents are wired to cite principles by `[[principle-X]]`
wiki-links; just add the principle file and reference it from the
relevant role.

#### 2. Arena eligibility surfaces

`scripts/feature-arena` refuses to spawn N parallel candidates unless
the task touches a "high-risk surface" (capping spend). There is no
built-in default: if `SDLC_ARENA_ELIGIBILITY_REGEX` is empty, arena
refuses all tasks unless the invoker passes `--force`. Configure the
regex at install time:

```bash
export SDLC_ARENA_ELIGIBILITY_REGEX="(db/migrations/|your-domain-surface/|...)"
```

Or set `SDLC_ARENA_ELIGIBILITY_REGEX` in `sdlc.config.yml`.

#### 3. Verification profiles

`scripts/feature-verify` auto-discovers `scripts/<feature-slug>-verify`
when the file exists and is executable. Add your own:

```bash
# scripts/my-domain-verify
#!/usr/bin/env bash
case "$1" in
  fast)  ./run-unit-tests --tag fast ;;
  unit)  ./run-unit-tests ;;
  full)  ./run-e2e ;;
esac
```

No central switch is required; file presence is the declaration.

## Verify the install

The framework includes a self-test:

```bash
scripts/test-framework-v3
# In the framework repo: 196/196 checks pass + 7 skipped + 0 fail. The skips
#                        are fixture-dependent checks where the fixture is
#                        absent. (Read the `Summary:` line the harness prints
#                        rather than trusting a number that drifts.)
# In an adopter project: most checks pass, with more skips — framework-self
#                        checks (plugin manifest, MIGRATING doc) and
#                        fixture-dependent tests don't apply. See the
#                        per-skip rationale in the harness output.
```

The harness expects feature directories to exist for some fixture-dependent
tests. Adopter projects skip framework-only fixture checks automatically
(see the `Skipped:` line in the summary).

## Cross-model review (Codex CLI)

The framework expects [Codex CLI](https://github.com/openai/codex)
on PATH for cross-model adversarial and security review:

```bash
npm install -g @openai/codex
codex --version  # 0.133.0 or later recommended
```

The wrappers (`scripts/adversary-review`, `scripts/security-review`) are
the **only** sanctioned paths through which Claude (or any agent in
this framework) can invoke Codex. The bash guard hook blocks all other
`codex` invocations. This is intentional — the wrappers do
prompt-assembly + sensitive-data sanitization + structured output
parsing before sending anything to a third-party model.

If Codex isn't available, the wrappers exit 2 and the framework falls
back to direct Claude-internal review with a noted limitation.

## Workflow

Start with [`docs/AGENT_SDLC_OVERVIEW.md`](docs/AGENT_SDLC_OVERVIEW.md)
for the shareable why/what/how summary. See
[`docs/AGENT_SDLC_WORKFLOW.md`](docs/AGENT_SDLC_WORKFLOW.md) for the full
lifecycle. In one minute:

1. **Intake**: owner writes spec → `planner (Phase: intake)` extracts AC
   IDs + opens QUESTIONS for ambiguities (with `/feature-why` pre-check).
2. **Design**: `planner (Phase: design)` produces DESIGN.md (must be
   `Approved` before tasks open) + TEST_STRATEGY + THREAT_MODEL +
   MIGRATION_PLAN + ROLLBACK_PLAN.
3. **Plan**: `planner (Phase: plan)` decomposes the design into a DAG
   of tasks with file-ownership + verification commands.
4. **Implement**: `builder` claims one Open task, implements the
   smallest scoped change, runs verification, hands off to Review.
5. **Review** (in parallel): `reviewer` is spawned three times with
   different modes (`quality`, `qa`, `adversarial`) plus `security` on
   the same diff. Adversarial is Codex-backed when available. Severity
   budget: P0/P1 mandatory, P2 capped at 5, P3 advisory.
6. **Acceptance**: `reviewer (Mode: acceptance)` walks the AC
   traceability matrix before release.
7. **Release**: `release` produces a READY / BLOCKED / NEEDS-APPROVAL
   verdict.

Loop the iteration via `/feature-loop`. Mine for compounding learning
via `/feature-reflect`.

## License

MIT. See [LICENSE](LICENSE).

## Acknowledgments

- [`obra/pstack`](https://github.com/cursor/plugins/tree/main/pstack)
  (Lauren Tan / poteto) — the principles + playbooks pattern.
- [`obra/superpowers`](https://github.com/obra/superpowers) — the
  coding-craft skills layer this framework sits on top of.
- [`anthropic-skills`](https://docs.claude.com/en/docs/claude-code/skills)
  — the skill primitive itself.

## v1.0 honesty note (2026-05-27)

The original v1.0 Phase 1 commit (`2eb0a03`) claimed three engine
changes — `feature-verify`, `feature-ready`, `feature-arena` all
config-driven. Only `feature-verify` actually landed. A subsequent
external review caught this; the missing `feature-ready` artifact-
hygiene config-drive + the missing `feature-arena` empty-default
landed in commit `5e61b90` (the same commit added 5
regression assertions to `scripts/test-framework-v3` so this class
of overstated-commit bug can't recur).

Project-neutrality is enforced by regression assertions in
`scripts/test-framework-v3`: the engine must stay config-driven and avoid
project-specific defaults.

Adopters who imported the framework between v0.1 and the honesty
fix should re-pull and re-apply per `docs/MIGRATING_v1.0_to_v1.1.md` (the change
is config-API-additive — env vars + `sdlc.config.yml` keys — not
breaking).

## For Codex and non-Claude agents

See [AGENTS.md](AGENTS.md) — the protocol-layer adapter. It describes
how any agent (Codex CLI, custom orchestrator, GitHub Actions) drives
the framework via the deterministic scripts + state machines, without
needing Claude Code's slash commands.

## Domain packs

Pre-built configurations for common project shapes live at
[examples/domains/](examples/domains/):

| Pack | Use for |
|---|---|
| `generic-web-app/` | Rails / Django / Express / Next.js (most web apps). |
| `generic-cli/` | CLI tools + language libraries (npm / pip / gem / crates). |
| `generic-service/` | HTTP / gRPC services + microservices. |

Each pack has a `README.md` with `sdlc.config.yml` snippets,
recommended principles, and domain-specific notes. Copy the pieces
you need into your project.
