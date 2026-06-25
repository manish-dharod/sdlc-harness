---
description: Multi-source parallel investigation of why something is the way it is. Queries available evidence categories (source control, GitHub issues / PRs, repo docs, plus any installed MCPs for Slack / observability / analytics) in parallel. Synthesizes with epistemic discipline. Use during intake when an ambiguity could be answered from the evidence stream before bothering the owner.
argument-hint: <feature-slug> "<question>"
---

You are running `/feature-why` for `$ARGUMENTS`.

This slash command is the framework's **evidence-discipline investigator**:
when ambiguity surfaces during intake (or any later phase), instead of
opening a QUESTIONS.md row immediately, query every available evidence
category in parallel and synthesize a cited answer. Many "questions"
have answers already in the evidence stream — surface them before
bothering the owner.

Adapted from pstack's `/why` skill. The non-negotiable disciplines from
that source apply here too: **null results are first-class evidence**;
**every claim has a citation**; **prefer "appears to" over "because"**
when the evidence is indirect; **don't pick a story and recruit
evidence to fit it**.

## Operating posture (read this first)

- **Evidence before narrative.** Collect the pieces first, then see what
  story they support. Not the other way around.
- **Cite everything.** Every claim about intent should reference a
  specific commit SHA, PR number, issue number, doc URL, code comment
  (`file:line`), or chat permalink. If you can't cite it, it's
  inference, not fact.
- **Acknowledge gaps.** If a thread goes cold, a category isn't
  searchable, or the question has no answer in the sources you queried,
  document the gap. Do not paper it over.
- **Hedge on purpose.** When the evidence is indirect, the language
  signals that ("appears to", "likely", "suggests"). Don't drop the
  hedge to sound more authoritative.
- **No shortcut by code-reading.** Code can tell you what something
  does. It rarely tells you why it exists.

This is the working method, not a disclaimer. The rest of the command
operationalizes it.

## Steps

### Step 0 — Gather context

Run the deterministic wrapper to build the context bundle:

```bash
scripts/feature-why $1 "$2"
```

The script prints the path to a context bundle at
`docs/features/$1/why/<timestamp>.context.md`. The bundle pre-populates
the three always-available categories (source control, GitHub
issues/PRs, repo docs) with hits and explicit "no results" markers.

If the script exits 3, stop and tell the user what was missing
(feature slug, question text).

### Step 1 — Enumerate evidence categories

The seven evidence categories from pstack's /why, adapted to this repo:

| # | Category | Source | Condition |
|---|---|---|---|
| 1 | Source control history | `git log`, `git blame` | always available (git is required) |
| 2 | GitHub issues / PRs | `gh search issues`, `gh search prs` | conditionally available — requires `gh` CLI installed AND authenticated. The wrapper records an explicit skip line with reason when unavailable; the synthesizer must surface that skip in its coverage map. (Per ADV-FND-003 from the Phase-5 Codex review: "always-available" was overstated; this is the corrected classification.) |
| 3 | Long-form documents | grep over `docs/` + repo README/CLAUDE/AGENTS | always available (filesystem read) |
| 4 | Real-time team chat | Slack / Discord / Microsoft Teams MCP | MCP-backed; available only when MCP installed |
| 5 | Infrastructure observability | Datadog / Grafana / Honeycomb MCP | MCP-backed |
| 6 | Error / exception tracking | Sentry / Rollbar / Bugsnag MCP | MCP-backed |
| 7 | Product analytics warehouse | Databricks / Snowflake / BigQuery MCP | MCP-backed |

Before dispatching investigators, list the available MCPs from the
session. Map each MCP to a category. Record a "coverage map" showing
which categories will be queried, which are skipped, and why.

### Step 2 — Dispatch parallel investigators

Spawn one investigator subagent per available category, all in a single
message:

- `subagent_type`: `general-purpose`
- `model`: `opus` (`claude-opus-4-8` with max effort; investigators specialize per category)
- Each gets:
  1. The full context bundle path from Step 0
  2. Its assigned category playbook (inline below — keep it tight)
  3. The original question + extracted keywords
  4. The code anchors from the bundle

**Category 1 investigator (source control)**:

> Read the context bundle. Search git log + git blame + gh PR search
> for the question's keywords and the feature slug. Identify: who
> wrote this code, in which PR/commit, what the PR description said,
> what review comments debated, what alternatives were rejected. Cite
> every claim by commit SHA / PR number. Return findings as
> structured rows: `<finding> — evidence: <SHA / PR# / file:line>`.
> Document null results: "git log for keyword X returned no hits."

**Category 2 investigator (issues / tickets)**:

> Read the context bundle. Search GitHub issues for keywords. Look
> for: customer requests, compliance deadlines, parent-initiative
> framing, label patterns (`customer:*`, `compliance`, `incident-followup`).
> Cite every claim by issue number. Return structured findings.
> Document null results: "issue search for X returned zero results."

**Category 3 investigator (long-form docs)**:

> Read the context bundle. Search CLAUDE.md, AGENTS.md, docs/,
> README files, and docs/features/<slug>/. Look for: explicit
> rationale, "alternatives considered" sections, ADRs / RFCs, threat
> models, prior decisions. Cite every claim by `file:line`. Document
> null results: "no doc mentions X."

**Categories 4-7 investigators (MCP-backed)**: dispatch only when the
matching MCP is available. Use the MCP's query vocabulary; cite by
permalink / record-id. Document null results explicitly.

**Skip discipline**: a category may be skipped ONLY if:
- The matching MCP is not installed in this session, OR
- The category is provably irrelevant (a *high* bar — "probably
  irrelevant" doesn't count; let the null result speak).

State each skip in the synthesizer output with a one-line reason.

### Step 3 — Synthesize

Spawn one synthesizer subagent:

- `subagent_type`: `general-purpose`
- `model`: `opus` (synthesis is judgment-heavy)
- Input: all investigator outputs + the original question + the
  context bundle path + the epistemic framework from the operating
  posture above

The synthesizer:

1. Groups findings by the question they answer.
2. Separates **direct evidence** (with citation) from **inference**
   (combination of indirect signals).
3. Surfaces **competing hypotheses** when the evidence fits multiple
   stories — does not force a winner.
4. Documents **gaps**: questions the user asked that the evidence
   didn't answer; categories skipped and why.
5. Uses hedged language for inferences. Reserves confident language
   for direct citations.

### Step 4 — Present

Output the synthesizer's verdict in this structure:

```text
## /feature-why result: <question>

### The question
<restate concisely>

### What we found (direct evidence)
- <claim> — evidence: <commit SHA | PR# | issue# | file:line | doc URL>
(repeat per finding with a citation)

### What we can reasonably infer
- Given <A> and <B>, it's likely that <C>. (hedged language)
(repeat per inferred claim)

### Competing hypotheses (if any)
- Hypothesis A: <claim> — evidence for: <…> — evidence against: <…>
- Hypothesis B: <claim> — evidence for: <…> — evidence against: <…>

### What we don't know
- <gap> — searched <category> with <query>, no results.
- <gap> — category <category> skipped, reason: <…>

### Sources consulted (coverage map)
- Source control (git/gh): searched <…>. Found: <…>.
- GitHub issues: searched <…>. Found: <…>.
- Repo docs: searched <…>. Found: <…>.
- (categories 4-7): skipped (no matching MCP installed) | searched <…>

### Recommendation (if the question was a precursor to action)
- Preserve: <…>
- Change: <…>
- Avoid: <…>
- Risk: <…>
```

## When planner (Phase: intake) invokes this command

The intake phase's "Open ambiguity questions" step includes a
**pre-question check**: when an ambiguity surfaces, before opening a
QUESTIONS.md row, planner (Phase: intake) invokes `/feature-why $slug
"<the ambiguity question>"`. If the evidence stream answers the question,
the answer + citations go into REQUIREMENTS.md or SPEC.md directly. Only
ambiguities that survive the evidence check become QUESTIONS.md rows
requiring owner decision.

This pattern operationalizes
[[principle-encode-lessons-in-structure]]: when the same kind of
ambiguity recurs across features, the structural fix is a script that
queries the evidence stream — not the same question asked of the owner N
times.

## Failure modes to avoid

- **Confident storytelling**: inventing a plausible narrative from thin
  evidence. If a bullet doesn't have a citation, it goes in "inferred"
  or "hypotheses", not "what we found".
- **Skipping investigators by anticipation**: deciding up front that "X
  probably won't have it" without searching. The default is coverage.
- **Citing the code as evidence for its own intent**: "this function
  handles null because it checks for null" is mechanics, not motivation.
  Motivation comes from an external source.
- **Sycophantic agreement**: if the user suggested a reason in their
  question ("I assume it's for performance?"), treat it as a hypothesis
  and check independently. Don't just confirm.

## Final report

Output exactly one block:

```text
## /feature-why result for $1

- Question: <one-line restatement>
- Bundle: docs/features/$1/why/<timestamp>.context.md
- Categories queried: <count + names>
- Categories skipped: <count + names + reasons>
- Direct-evidence findings: <count>
- Inferences: <count>
- Competing hypotheses surfaced: <count>
- Gaps documented: <count>
- Recommendation produced: yes | no
- Routing: REQUIREMENTS.md update | SPEC.md AC | QUESTIONS.md row | owner-only
```

Routing:
- **REQUIREMENTS.md update / SPEC.md AC**: the evidence answered the
  question; planner (Phase: intake) adds the cited answer to REQUIREMENTS /
  SPEC and drops the would-be QUESTIONS row.
- **QUESTIONS.md row**: the evidence did not resolve the ambiguity;
  this becomes a real owner decision with a hint of what's known
  attached.
- **owner-only**: the ambiguity is product / business / regulatory —
  no amount of evidence-mining would have answered it; surface
  directly to the owner.
