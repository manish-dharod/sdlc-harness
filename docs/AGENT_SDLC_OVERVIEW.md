# Agentic SDLC — Overview

> **Level L2 · the mental model · ~10 min.** A simple explanation of the SDLC
> harness: why it exists, what it stores, how the agents work together, and
> where parallelism happens. Up one level: [README](../README.md). Down one
> level: [Workflow](AGENT_SDLC_WORKFLOW.md). Map of all docs:
> [START_HERE](START_HERE.md).

## The Short Version

The SDLC harness is a way to let AI agents help build software without losing
track of what was decided, what was built, what was reviewed, and what still
needs human approval.

The main idea is simple:

> Chat is not the memory. The repo is the memory.

Every feature gets a folder under `docs/features/<feature-name>/`. That folder
holds the spec, design, task list, evidence, findings, approvals, and release
status. If one agent stops and another agent starts later, the new agent reads
those files and continues from there.

## See it work

A concrete pass, so the rest of this page has something to hang on. Say the
owner wants a "saved searches" feature.

1. **Intake.** `/feature-init saved-searches` scaffolds
   `docs/features/saved-searches/`. `planner (Phase: intake)` reads the owner's
   note, drives a short brainstorming pass, and writes `SPEC.md` with acceptance
   criteria `AC-1…AC-4`. Two ambiguities it can't resolve become `QUESTIONS.md`
   rows for the owner.
2. **Design.** `planner (Phase: design)` writes `DESIGN.md` (and, because there's
   a DB table, `MIGRATION_PLAN.md`). Design must be **Approved** before any task
   can open — so nobody codes against a guess.
3. **Plan.** `planner (Phase: plan)` defines INC-001 in `INCREMENTS.md` as the
   smallest coherent journey the owner can try, then decomposes it into an
   ordered task DAG with file ownership and a verify command per task.
4. **Build.** `builder` claims `TASK-1`, invokes
   `superpowers:test-driven-development` (failing test first), implements the
   smallest change, runs the verify command, and records a pre-review self-audit
   + QA coverage ledger in `EVIDENCE.md`. The task moves to **Review**, not Done.
5. **Review, in parallel.** `/feature-review` spawns `reviewer` in `quality`,
   `qa`, and `adversarial` modes plus `security` on the same diff. The
   adversarial pass runs on the **opposite model**. One P1 comes back; `builder`
   fixes it and re-verifies.
6. **Feedback, accept & release.** QA exercises the increment's Experience
   surface; the harness stops for an explicit owner verdict. After acceptance,
   `reviewer (Mode: acceptance)` walks `TRACEABILITY.md` — every `AC` has a
   passing test. `release` returns **READY**. The migration is
   flagged as needing a human to run it: the loop drafts the plan, a person
   executes.

At no point was the state in the chat. Anyone — a new session, a different
agent, the owner a week later — can open the feature folder and see exactly
where things stand.

## Why This Exists

AI coding works better when the work is broken into clear roles and every
important decision is written down. Without that, a long-running feature can
drift:

- One session remembers something another session does not.
- A reviewer says "looks good" without knowing the original requirement.
- A fix passes tests but breaks the product intent.
- Agents keep arguing over small review comments.
- Work reaches a launch boundary without the right human approval.

The harness prevents that by making the process explicit. It asks:

- What are we building?
- What is the approved design?
- Which task owns this change?
- What evidence proves it works?
- What did review find?
- What still needs a human decision?
- Is this actually ready to release?

## The Memory System

The memory system is just files in the repo.

For a large feature, the feature folder usually contains files like:

- `SPEC.md` - what the owner asked for.
- `REQUIREMENTS.md` - the cleaned-up requirements and acceptance criteria.
- `DESIGN.md` - the approved technical plan.
- `INCREMENTS.md` - tryable slices, proof, and explicit owner verdicts.
- `TASKS.md` - the ordered task list, with dependencies.
- `STATE.md` - the current status of the feature.
- `EVIDENCE.md` - commands run, tests passed, screenshots, manual checks.
- `FINDINGS.md` - review, QA, security, and adversarial findings.
- `TRACEABILITY.md` - which tests/evidence prove each requirement.
- `DECISIONS.md` - durable decisions and tradeoffs.
- `APPROVALS.md` - human approvals that are still needed or already granted.
- `RELEASE_GATES.md` - the checklist for release readiness.
- `RUNS.md` - a log of autonomous loop iterations.

This is not a vector database, hidden prompt memory, or chat summary. It is
plain Markdown plus deterministic scripts. That makes it easy to inspect,
diff, commit, review, and resume.

## The Agents

The latest harness uses five role agents. Some roles have a mode or phase in
the prompt so the same agent can do related jobs.

| Agent | Used For | Plain-English Role |
|---|---|---|
| `planner` | `Phase: intake` | Understand the owner's request and turn it into clear requirements. |
| `planner` | `Phase: design` | Write the technical design before implementation starts. |
| `planner` | `Phase: plan` | Break the design into ordered tasks. |
| `builder` | implementation | Claim one task and make the smallest scoped code change. |
| `reviewer` | `Mode: quality` | Review the diff for correctness and design fit. |
| `reviewer` | `Mode: qa` | Run verification and record evidence. |
| `reviewer` | `Mode: adversarial` | Ask, "How could this still be wrong even if normal checks passed?" |
| `reviewer` | `Mode: acceptance` | Check the finished work against the original requirements. |
| `security` | security review | Review sensitive changes such as auth, payments, secrets, and migrations. |
| `release` | readiness | Give a read-only READY / BLOCKED / NEEDS-APPROVAL verdict. |

Older adopter repos may still have older `sdlc-*` or project-specific agent names. The latest
harness vocabulary is the five-role model above.

## Parallelism

Parallelism happens inside Claude Code through the Task tool.

For example, after the builder finishes a code change, `/feature-review` can
start several independent reviews at the same time:

```text
reviewer (Mode: quality)
reviewer (Mode: qa)
reviewer (Mode: adversarial)
security
```

Those reviewers all look at the same diff, but they look for different kinds
of problems. They write findings back into the same feature folder.

This is parallel review, not a big external distributed system. The harness
does not require Conductor, CrewAI, or a custom orchestrator.

## Orchestration

The orchestration is lightweight and local:

- Claude Code slash commands describe the workflow.
- Role agents do the specialized work.
- Shell scripts check state and enforce gates.
- Markdown files hold the durable memory.

The main orchestration command is `/feature-loop`. One loop iteration usually:

1. Checks whether the worktree is clean or belongs to an active task.
2. Rehydrates the feature state from `docs/features/<slug>/`.
3. Claims or resumes the right current-increment task, or stops for owner feedback.
4. Invokes the builder when implementation is needed.
5. Runs parallel review.
6. Sends blocking findings back for fixes.
7. Records evidence.
8. Checks whether the feature is ready, blocked, or needs human approval.

For longer runs, `/loop /feature-loop <slug>` repeats that process until the
feature is done, blocked, stuck, or out of budget.

Two helper commands cover the earlier and supervisory edges of that flow:

- `/feature-intake <slug> [context]` turns raw owner context into a sanitized,
  plan-first feature intake before implementation starts.
- `/feature-orchestrate <slug> [mode]` runs the health check, changed-file
  sanitizer, reconcile/readiness gates, and task-routing preflight before a
  long worker run.
- Optional agent capsules bound long-running worker prompts with task context,
  ownership, invariants, allowed commands, forbidden actions, and stop
  conditions.
- `scripts/worktree-add-external` creates disposable or parallel agent
  worktrees only under a configured `SDLC_WORKTREE_ROOT`.

These helpers keep useful agentic productivity patterns inside the same
repo-backed safety model. They do not enable permission bypasses,
email-to-agent daemons, remote-control defaults, or browser-cookie automation.

## Cross-Model Review

Cross-model review uses the opposite tool from the implementer:

- `scripts/adversary-review`
- `scripts/claude-adversary-review`
- `scripts/security-review`

These wrappers assemble a focused context package, sanitize it for secrets or
sensitive data where context leaves the machine, and then run a different-tool
review. Codex is not the main orchestrator. It is an extra reviewer for
high-risk blind spots; Claude Code is the opposite-tool reviewer for
Codex-authored work.

The wrappers review committed candidates and require the actual implementer
model in-band. They fail closed on dirty task-owned files, incomplete or
oversized diffs, provenance mismatch, and ambiguous terminal verdicts. Raw
transcripts stay local; valid complete reviews produce tracked sanitized
receipts that bind the reviewed diff and reviewer identity.

## False-Confidence Gates

The harness checks for evidence claims that look green but are not actually
proven:

- `scripts/feature-verify` writes `.last-verify.json`; reconcile rejects stale
  or failed verification behind new Passing traceability rows.
- Review/Done task rows need a valid opposite-tool adversarial trail.
- Non-doc Review/Done tasks need a QA coverage ledger with zero untested rows
  and a PASS result.
- `scripts/feature-verify --all-active <mode>` sweeps every active feature
  after integration events.

## Safety Gates

The harness is designed to stop instead of improvise when risk gets real.

It blocks or stops for things like:

- production deploys
- live DB mutation
- launch flag flips
- real external-service traffic
- raw card data or secrets
- force pushes or destructive git commands
- unresolved P0/P1 findings
- missing evidence
- missing human approval

That stop is intentional. The harness should tell the human exactly what is
blocked and what approval or evidence is needed next.

## Philosophy

Four commitments hold the whole thing together:

- **The repo is the memory.** Durable Markdown, not chat history or a hidden
  vector store. Inspectable, diffable, resumable.
- **Gates are deterministic, not opinions.** A script with an exit code decides
  whether a thing passed — so "it's done" is verifiable, not asserted.
- **Evidence before claims.** Nothing is Done on a proxy. Verify against the real
  surface; a confident-but-wrong agent is the failure mode the harness exists to
  catch.
- **Autonomy with brakes.** The loop runs unattended until it hits a real
  boundary — production, secrets, missing approval — then stops and asks.

These are not invented here; they are the lessons of a real production line,
encoded so they can't be forgotten. See [Lineage](LINEAGE.md).

## One-Sentence Summary

The SDLC harness is a repo-backed, locally orchestrated, multi-agent workflow:
agents do the work, Markdown files hold the memory, scripts enforce the gates,
parallel reviewers reduce blind spots, and humans approve the risky boundaries.

---

> **Next:** the full lifecycle → [Workflow](AGENT_SDLC_WORKFLOW.md) · the rules →
> [principles/](principles/) · where it came from → [Lineage](LINEAGE.md) · look
> something up → [reference/](reference/) · the whole map → [START_HERE](START_HERE.md)
