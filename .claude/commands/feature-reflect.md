---
description: Mine a feature's durable artifacts (SPEC/DESIGN/TASKS/EVIDENCE/RUNS/FINDINGS) for recurring patterns; surface Accepted/Rejected/Backlog with a structural-enforcement check that routes mechanical fixes to scripts/lints instead of more prompt text. Human approval gate before any apply.
argument-hint: <feature-slug>
---

You are running `/feature-reflect` for `$ARGUMENTS`.

This slash command is the framework's **self-improvement loop**. It mines a
completed (or in-flight) feature for recurring patterns — places the loop
keeps re-discovering the same correction, places the reviewer keeps
catching the same defect class, places the role agents keep applying the
same procedure inline — and produces a structured Accepted/Rejected/Backlog
plan for routing those patterns into the right layer.

The keystone is the **structural-enforcement check**: any Accepted item
whose enforcement would be *more reliable* as a script, lint, hook,
template field, or runtime check is moved to Backlog with a `routing:
encode-in-structure` tag, instead of being silently re-emitted as more
prompt text. This is what stops CLAUDE.md from growing every iteration.

## Safety boundary (non-negotiable)

- **Auto-apply is forbidden.** The slash command produces a plan; the
  human approves a subset; only then are role-prompt / skill / CLAUDE.md
  edits made.
- **No production-affecting actions** from this loop, ever. Same
  guardrails as `/feature-loop` (see `docs/principles/principle-no-production-deploys-from-loop.md`).
- **Worktree hygiene unchanged.** This command does not commit on the
  user's behalf; any approved edits are normal file edits the user
  reviews + commits.

## Steps

### Step 0 — Gather context

Run the deterministic context-gathering wrapper:

```bash
scripts/feature-reflect $1 --dry-run
```

The script prints the path to a context bundle at
`docs/features/$1/reflect/<timestamp>.context.md`. The bundle has SPEC,
DESIGN, TASKS, EVIDENCE, RUNS (large), FINDINGS (large or medium-inlined),
TRACEABILITY, STATE, DECISIONS, AMENDMENTS, APPROVALS, RELEASE_GATES,
QUESTIONS, plus `docs/principles/` index and CLAUDE.md / AGENTS.md.

If the script exits 3, stop. Tell the user what went wrong.

### Step 1 — Dispatch three reviewer subagents in parallel

Use the Task tool with three Agent calls in a single message. Each
reviewer reads the **same** context bundle but through a different lens:

| Lens | Agent type | Model | Prompt focus |
|---|---|---|---|
| Judgment | `general-purpose` | (default sonnet) | Mine RUNS/EVIDENCE/FINDINGS for principle violations or recurring corrections that point at a missing principle. Cite specific RUN / EVIDENCE / FINDING rows. |
| Tooling | `general-purpose` | (default sonnet) | Mine the same artifacts for **repeat corrections that should be scripts, lint rules, hooks, template fields, or runtime checks**. Apply `principle-encode-lessons-in-structure` as the filter: if a rule recurred 2+ times, propose the structural enforcement. |
| Divergent | `general-purpose` | (default sonnet, opus if user explicitly asks) | Look for blind spots the other two lenses miss: stale evidence, contradictory decisions, principles that were cited but not applied, follow-ups that were filed and silently dropped. |

For each Task call:

- `description`: e.g. `"feature-reflect judgment lens on <slug>"`
- `subagent_type`: `general-purpose`
- `prompt`: the full reviewer prompt below, with `<CONTEXT_PATH>`
  substituted to the bundle path from Step 0

Reviewer prompt template (for all three lenses; vary the focus paragraph):

```text
You are the <lens> reviewer for /feature-reflect on feature <slug>.

Read the context bundle at <CONTEXT_PATH> end to end. It contains every
durable artifact for the feature plus framework-level CLAUDE.md +
AGENTS.md + docs/principles/ index.

Your job: surface recurring patterns through the <lens> lens.

<lens-specific focus paragraph>

Output strictly the following structure. Do not propose code edits. Cite
specific rows by file:line or by section heading. If a pattern only
occurred once, do not report it — one-offs are not learnings.

## <Lens> findings

### F-1
- Pattern: <what recurs>
- Evidence: <cite at least 2 instances by file + section/line>
- Proposed routing: <one of: encode-in-structure (name the script/lint/hook),
                   add-or-update-principle (name the principle),
                   role-prompt-edit (name the agent), rejected>
- Rationale: <why this routing and not another>

(repeat per finding; if none, write "(no findings)")

## Confidence note
<one paragraph on what the bundle did not let you see — e.g. "RUNS.md
was empty so I could not analyze loop oscillation patterns">
```

### Step 2 — Synthesize

Once all three reviewers return, spawn one synthesizer subagent:

- `description`: `"feature-reflect synthesizer for <slug>"`
- `subagent_type`: `general-purpose`
- `model`: prefer opus when available (this is the keystone judgment
  step)
- `prompt`: synthesizer prompt below, with each reviewer's full output
  inlined where marked

Synthesizer prompt:

```text
You are the synthesizer for /feature-reflect on feature <slug>.

You have three reviewer outputs (judgment / tooling / divergent lenses)
to consolidate into one Accepted / Rejected / Backlog plan.

<lens 1 output>
<lens 2 output>
<lens 3 output>

Phase 1 — Consolidate

- Deduplicate findings that two or more lenses raised (these are the
  highest-signal items).
- Group by proposed routing.
- Drop one-off lens findings unless they cite at least 2 distinct
  evidence instances.

Phase 2 — Pre-enforcement Accepted list (REQUIRED OUTPUT SECTION)

Emit your **Pre-enforcement Accepted** list BEFORE running the
structural-enforcement check. This list is the synthesizer's raw
judgment about what could become a role-prompt or principle edit if
nothing got re-routed. The reviewer needs to see this list to audit
the structural-enforcement pass that follows.

Output strictly:

## Pre-enforcement Accepted

### PA-1
- Routing intent (pre-check): add-or-update-principle | role-prompt-edit
- Target: <e.g. docs/principles/principle-X.md OR .claude/agents/<role>.md>
- Change: <one paragraph describing the edit>
- Lenses that raised it: <judgment | tooling | divergent | multiple>
- Evidence: <cited rows>
(repeat per pre-enforcement accepted item; "(none)" if empty)

Phase 3 — Structural-enforcement check (MANDATORY)

For each item in Pre-enforcement Accepted, ask:

  "Could this rule be enforced more reliably by a script, lint rule,
   hook, runtime check, template field, metadata flag, or
   reconcile-script rule?"

If YES, move it from Accepted to Backlog and tag it
`routing: encode-in-structure`. Name the concrete enforcement target
(e.g. "scripts/feature-reconcile: add check that …"). This is per
docs/principles/principle-encode-lessons-in-structure.md. Items routed
this way do NOT become role-prompt or CLAUDE.md edits — they become
follow-up structural-improvement tasks.

Items that genuinely require judgment (cannot be a deterministic check)
stay in the Post-enforcement Accepted list. They become candidate
role-prompt edits or new principle files, gated by human approval.

Phase 4 — Output (Post-enforcement)

Output strictly this structure, side by side with the Pre-enforcement
list above so the reviewer can see what was re-routed by the
structural-enforcement check:

## Post-enforcement Accepted (judgment-layer changes, human-approval gated)
### A-1
- Source: PA-### (which Pre-enforcement item survived the structural check, if any)
- Routing: add-or-update-principle | role-prompt-edit
- Target: <e.g. docs/principles/principle-X.md OR .claude/agents/<role>.md>
- Change: <one paragraph describing the edit>
- Lenses that raised it: <judgment | tooling | divergent | multiple>
- Evidence: <cited rows>
(repeat per accepted item)

## Backlog (encode-in-structure, follow-up PRs)
### B-1
- Source: PA-### (which Pre-enforcement item was re-routed here, if any)
- Routing: encode-in-structure
- Target enforcement: <script / lint / hook / template-field / reconcile-check>
- What needs to be encoded: <one paragraph>
- Lenses that raised it: <…>
- Evidence: <cited rows>
(repeat per backlog item)

## Rejected
### R-1
- Reason: <why this isn't worth promoting (one-off, already covered,
          out of scope for /feature-reflect, owner-judgment territory)>
- Source lens: <…>
- Evidence: <cited rows>
(repeat per rejected item)

## Structural-enforcement summary
- Pre-enforcement accepted count: N
- Post-enforcement accepted count: M
- Re-routed to encode-in-structure backlog: K (=N-M when no rejections happened)
- The delta documents what the meta-principle moved out of "more prompt text"
  and into "encoded in structure" this run.

## Synthesis note
<one paragraph: total findings considered, what the bundle did not let
you see, and any limitations of the lenses>
```

### Step 3 — Present to user (mandatory human approval gate)

Print the synthesizer's full Accepted / Rejected / Backlog block to the
user verbatim. Then present each Accepted item with a per-item question:

> "Apply this change? Yes / No / Defer to Backlog"

Or, if there are many items, present a batch question:

> "Approve the following N Accepted items as a batch? Yes (all) / No
>  (none) / Custom (per-item)"

Use the `AskUserQuestion` tool. **Auto-apply is forbidden — see AC-006 +
docs/principles/principle-no-production-deploys-from-loop.md.**

If the user says no on all items, write a single "no edits applied" line
and stop. The synthesizer output is still preserved at the reflect
bundle path for future reference.

### Step 4 — Apply approved items

For each approved item:

- **`add-or-update-principle`**: create or edit the principle file under
  `docs/principles/`. Apply the meta-principle (encode-lessons-in-structure)
  to decide if the rule belongs as a principle vs. a script.
- **`role-prompt-edit`**: edit the named `.claude/agents/<role>.md` (one
  of: planner, builder, reviewer, security, release). Keep the edit
  small and citation-shaped (principle citation, not re-statement).

Each edit is a normal file edit the user can review in the diff. Commit
the changes when the user has reviewed them.

For Backlog items (`routing: encode-in-structure`):

- File them in TASKS.md (large/medium) or FEATURE.md (small) as new
  Backlog tasks with `Risk: low | medium | high` and `Intended file
  ownership: <script-or-lint-target>`.
- Do NOT implement the encoded check inline here — that's a follow-up
  PR. The /feature-reflect output's job is to surface the right
  structural target, not to land all of them at once.

### Step 5 — Record the reflect run

Append a row to EVIDENCE.md (medium tier) or RUNS.md (large tier) with:

```text
| <date> | /feature-reflect <slug> | accepted: N, rejected: M, backlog (encode-in-structure): K, bundle: <path> |
```

Use `scripts/log-decision <slug> "ran /feature-reflect" "<short summary>"`
to also record a decision-log row.

## Final report

Output exactly one block:

```text
## /feature-reflect result for $1

- Bundle: docs/features/$1/reflect/<timestamp>.context.md
- Lenses dispatched: judgment, tooling, divergent
- Synthesizer accepted: N items
- Synthesizer rejected: M items
- Routed to encode-in-structure backlog: K items
- User approved: P items (of N)
- Applied edits: <list of files edited, or "none">
- New backlog tasks: <list of TASK ids, or "none">
- EVIDENCE row appended: <yes / no>
- Stop reason: complete | user-declined-all | bundle-gather-failed | error
```

To make this loop self-improving over multiple features: run
`/feature-reflect` on a closed feature whenever the framework hits the
"same pattern caught twice" smell. The structural-enforcement check keeps
the framework's documentation shrinking even as its enforcement grows.
