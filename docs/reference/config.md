# Configuration Reference

> **Layer 4 · Reference** — the gory details. ↑ [Start Here](../START_HERE.md) · [L2 Overview](../AGENT_SDLC_OVERVIEW.md) · [L3 Workflow](../AGENT_SDLC_WORKFLOW.md)

The harness has no project-specific hardcoding in its engine layer. Everything
adopters need to tune lives in one file, `sdlc.config.yml`, which the scripts
read as environment variables. Anything not set there falls back to a
documented default.

## sdlc.config.yml

Copy `sdlc.config.yml.example` to `sdlc.config.yml` in your project root and
edit the values. The scripts source it at startup via `scripts/load-config`
(the path is overridable with `SDLC_CONFIG_FILE`). Every key has a documented
default, so an empty config is valid — you only set what you want to change.

| Key | Default | What it controls |
|---|---|---|
| `SDLC_BASE_BRANCH` | `master` | The base branch your features merge into. Used for diff ranges (`<base>..HEAD`), artifact-hygiene checks, and diff-hash oscillation detection. The example file documents `master`; when the var is unset and no config is loaded, several scripts fall back to `staging`. |
| `SDLC_ARTIFACT_HYGIENE_PATTERNS` | empty (no checks) | Newline-separated extended-regex patterns for paths that must **never** appear in a branch diff (build outputs, generated files, test reports). Matched against `git diff --name-only <base>..HEAD`. The example file lists per-project-type starting points (web app, Python lib, Rust, Go, static site). |
| `SDLC_ARENA_ELIGIBILITY_REGEX` | empty | Extended regex matched against a task's content (intended file ownership + title + AC IDs) to decide whether `/feature-arena` may auto-spawn for it. Arena is expensive, so it only runs for declared high-risk surfaces. With this empty, `/feature-arena` refuses every task unless the invoker passes `--force`. The example file gives per-domain patterns (payment, healthcare, multi-tenant SaaS, embedded, OSS library). |
| `SDLC_PROTECTED_PATHS` | empty | Newline-separated extended regex for files/paths that no harness agent may modify without explicit human approval (config files, deployment manifests, secrets). Capsule workers reject writes to these paths unless an override flag is set. Beyond this list, the framework's own non-negotiables still apply. |
| `SDLC_DOMAIN_PACK` | none (commented out) | Optional name of a domain pack the project draws from. A pack lives at `examples/domains/<name>/` in the framework repo and supplies domain-specific principles, eligibility-regex defaults, and verification helpers. Adopters can also write their own pack and point at it. |

The example file documents several more knobs as **commented-out hints** with
their defaults, rather than active keys. These are the same Codex/cross-model
and reasoning settings listed in the environment-variable table below
(`CODEX_BIN`, `ADVERSARY_REASONING`, `SECURITY_REASONING`,
`SDLC_CROSS_MODEL_ADVERSARIAL_REQUIRED`, `SDLC_CODEX_ADVERSARY_REQUIRED_MODEL`,
`SDLC_CLAUDE_ADVERSARY_REQUIRED_MODEL`). Uncomment and set them only when you
need to override the built-in default.

Verification profiles are **not** configured here. Each feature declares its
own profile by dropping an executable `scripts/<feature-slug>-verify` that
accepts `fast | unit | full`. Discovery is by file presence; there is no
central case statement and no config key.

## Environment variables

Every key in `sdlc.config.yml` is exported as an environment variable of the
same name, and a handful of additional `SDLC_*` variables tune the cross-model
review, autonomous-loop, error-budget, and capture subsystems. The **precedence
rule** is uniform: an environment variable that is already set in the shell
wins over the value loaded from `sdlc.config.yml`, which in turn wins over the
script default. (In shell terms, every read is `${SDLC_FOO:-<default>}`, and
`load-config` only assigns from the file when the variable is unset.)

### Core / version control

| Var | What it controls | Precedence note |
|---|---|---|
| `SDLC_BASE_BRANCH` | Base branch for diff ranges and hygiene checks (see config table). | Env > config > script fallback (`staging`). |
| `SDLC_CONFIG_FILE` | Path to the config file `load-config` reads. Default: `sdlc.config.yml` in the repo root. | Env only; it *is* the pointer to the config file. |
| `SDLC_ARTIFACT_HYGIENE_PATTERNS` | Diff-forbidden path patterns (see config table). | Env > config > default (empty). |
| `SDLC_ARENA_ELIGIBILITY_REGEX` | Arena auto-spawn eligibility regex (see config table). | Env > config > default (empty → refuse without `--force`). |
| `SDLC_PROTECTED_PATHS` | Paths agents may not modify without approval (see config table). | Env > config > default (empty). |
| `SDLC_NOTIFY_COMMAND` | Optional local command run after `/feature-orchestrate` writes its report. Unset → no notification. Keep it local and context-free. | Env > config > default (unset). |
| `SDLC_DOMAIN_CONTEXT_SCRIPT` | Per-feature override for the domain-context helper; otherwise the convention `scripts/<feature>-context` is used. | Env > convention. |

### Cross-model adversarial review

| Var | What it controls | Precedence note |
|---|---|---|
| `SDLC_CROSS_MODEL_ADVERSARIAL_REQUIRED` | When true, every code-bearing Done task's adversarial trail must declare differing Implementer vs Reviewer tool families and matching pinned reviewer models. Disabling is not recommended. Default: `true`. | Env > config > default (`true`). |
| `SDLC_REVIEW_STAGE_CROSS_MODEL_ADVERSARIAL_REQUIRED` | When true, the Review-stage adversarial gate is not satisfied by a routing-skip on lightweight/docs-only diffs — the opposite-tool reviewer must actually run (for tasks claimed on/after the cutoff date in `feature-reconcile`). Default: `true`. | Env > config > default (`true`). |
| `SDLC_QA_COVERAGE_LEDGER_REQUIRED` | When true, non-doc tasks must record a task-scoped QA coverage ledger in `EVIDENCE.md` (control inventory, production baseline, candidate + data-path proof, `Untested rows: 0`, `Result: PASS`). Default: `true`. | Env > config > default (`true`). |
| `SDLC_CODEX_ADVERSARY_REQUIRED_MODEL` | The Codex model the cross-model adversarial reviewer must use when Claude wrote the code. Default: `gpt-5.5`. | Env > config > default (`gpt-5.5`). |
| `SDLC_CLAUDE_ADVERSARY_REQUIRED_MODEL` | The Claude model the cross-model adversarial reviewer must use when Codex wrote the code. Default: `claude-opus-4-8`. | Env > config > default (`claude-opus-4-8`). |
| `CODEX_BIN` | Override the auto-discovered `codex` binary path used by the review wrappers. Default: discovered via `PATH`. | Env > config > auto-discovery. |
| `ADVERSARY_REASONING` | Reasoning effort for the adversarial-review wrapper's Codex invocation (`minimal \| low \| medium \| high`). Default: `high`. | Env > config > default (`high`). |
| `SECURITY_REASONING` | Reasoning effort for the security-review wrapper's Codex invocation. Default: `high`. | Env > config > default (`high`). |

### Capsule workers (supervisor mode)

| Var | What it controls | Precedence note |
|---|---|---|
| `SDLC_CODEX_WORKER_REQUIRED_MODEL` | Pinned model a Codex capsule worker must run. Default: `gpt-5.5`. | Env > config > default. |
| `SDLC_CLAUDE_WORKER_REQUIRED_MODEL` | Pinned model a Claude capsule worker must run. Default: `claude-opus-4-8`. | Env > config > default. |
| `SDLC_CODEX_WORKER_REASONING` | Reasoning effort for a Codex capsule worker. Default: `high`. | A task-scoped `CODEX_WORKER_REASONING` env var, then this var, then default. |
| `SDLC_CLAUDE_WORKER_EFFORT` | Effort level for a Claude capsule worker. Default: `max`. | A task-scoped `CLAUDE_WORKER_EFFORT` env var, then this var, then default. |
| `SDLC_CAPSULE_TIMEOUT_SECONDS` | Wall-clock timeout for a capsule worker run. Default: `900`. | An `AGENT_CAPSULE_TIMEOUT_SECONDS` env var, then this var, then default. |

### Self-improvement loop

| Var | What it controls | Precedence note |
|---|---|---|
| `SDLC_SELF_IMPROVE_AUTONOMY` | Autonomy level for the continuous-self-improvement loop (e.g. `off \| capture \| distill \| …`). An unrecognized value falls back to `off`. Default: `capture`. | Env > config > default (`capture`). |
| `SDLC_SELF_IMPROVE_APPROVALS_FILE` | Approvals file the self-improvement loop gates against. Default: the loop feature's `APPROVALS.md`. | Env > default. |
| `SDLC_SELF_IMPROVE_AUTO_APPROVAL_ID` | The approval ID that must be `Approved` to unlock auto-apply. Default: `APV-001`. | Env > default. |
| `SDLC_INSIGHT_LEDGER_FILE` | Path to the applied-insight ledger. Default: `docs/insights/APPLIED.md`. | Env > default. |

### Error budget

| Var | What it controls | Precedence note |
|---|---|---|
| `SDLC_ERROR_BUDGET_MAX_REGRESSIONS` | Max regressions tolerated within the window before the budget is breached. Default: `1`. | Env > config > default. |
| `SDLC_ERROR_BUDGET_WINDOW` | Rolling window size (number of runs) the budget is measured over. Default: `10`. | Env > config > default. |
| `SDLC_ERROR_BUDGET_STATE_DIR` | Directory for error-budget state. Default: `.sdlc/error-budget` under the repo root. | Env > default. |
| `SDLC_ERROR_BUDGET_APPROVALS_FILE` | Approvals file consulted on a budget breach. Default: the loop feature's `APPROVALS.md`. | Env > default. |
| `SDLC_CAPTURE_DIR` | Directory where capture artifacts are written. Default: `.sdlc/capture` under the repo root. | Env > default. |

> **Internal / harness-written variables.** A few `SDLC_*` names that appear in
> the scripts are not adopter knobs: `SDLC_CAPTURE_ROOT` and
> `SDLC_CAPTURE_SCRIPT_DIR` are derived from the script's own location;
> `SDLC_EB_ROOT` is the error-budget root path; the
> `SDLC_SELF_IMPROVE_DOWNGRADE_*` group (`_BAD_COUNT`, `_WINDOW`, `_REASON`,
> `_TS`) is **written by** the loop into state when autonomy is downgraded
> after a breach, not set by you; and `__SDLC_NEVER_MATCHES__` is a deliberate
> never-match sentinel used to disable arena routing. Do not set these by hand.

## Per-project customization

Three customization surfaces live outside `sdlc.config.yml`. They are covered
in depth in the repository README and the domain-pack docs; cross-links rather
than duplication:

- **Domain principles.** A domain pack (`SDLC_DOMAIN_PACK`, pack files under
  `examples/domains/<name>/`) supplies domain-specific principles that the role
  agents read, plus eligibility-regex defaults and verification helpers.
  Adopters can write their own pack and point at it.
- **Arena eligibility regex.** Set `SDLC_ARENA_ELIGIBILITY_REGEX` to the
  high-risk surfaces in *your* domain so `/feature-arena` auto-spawns only where
  one implementation attempt could lock in the wrong shape. The example file
  ships per-domain patterns to start from.
- **Verification profiles.** Each feature gets its own verification behavior by
  adding an executable `scripts/<feature-slug>-verify` that accepts
  `fast | unit | full`. The harness auto-discovers it by file presence — no
  config key, no central registration.

## Related

- [control-plane.md](control-plane.md) — the feature control-plane files and state machines these settings gate
- [commands.md](commands.md) — the slash commands that read this configuration
- [scripts.md](scripts.md) — the deterministic scripts that source `sdlc.config.yml`
- [agents.md](agents.md) — the role agents whose behavior the cross-model and autonomy settings tune
