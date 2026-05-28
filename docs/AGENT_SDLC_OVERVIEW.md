# Agentic SDLC - Overview

> A simple explanation of the SDLC harness: why it exists, what it stores,
> how the agents work together, and where parallelism happens. Detailed
> reference: [docs/AGENT_SDLC_WORKFLOW.md](AGENT_SDLC_WORKFLOW.md). Last
> updated: 2026-05-27.

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

Older adopter repos may still have older `sg-*` agent names. The latest
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
3. Claims or resumes the right task.
4. Invokes the builder when implementation is needed.
5. Runs parallel review.
6. Sends blocking findings back for fixes.
7. Records evidence.
8. Checks whether the feature is ready, blocked, or needs human approval.

For longer runs, `/loop /feature-loop <slug>` repeats that process until the
feature is done, blocked, stuck, or out of budget.

## Codex And Cross-Model Review

Codex is used for cross-model perspective through two sanctioned wrappers:

- `scripts/adversary-review`
- `scripts/security-review`

These wrappers assemble a focused context package, sanitize it for secrets or
sensitive data, and then run a different-model review. Codex is not the main
orchestrator. It is an extra reviewer for high-risk blind spots.

## Safety Gates

The harness is designed to stop instead of improvise when risk gets real.

It blocks or stops for things like:

- production deploys
- live DB mutation
- launch flag flips
- real carrier or payment traffic
- raw card data or secrets
- force pushes or destructive git commands
- unresolved P0/P1 findings
- missing evidence
- missing human approval

That stop is intentional. The harness should tell the human exactly what is
blocked and what approval or evidence is needed next.

## One-Sentence Summary

The SDLC harness is a repo-backed, locally orchestrated, multi-agent workflow:
agents do the work, Markdown files hold the memory, scripts enforce the gates,
parallel reviewers reduce blind spots, and humans approve the risky boundaries.
