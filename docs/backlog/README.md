# Program backlog

Durable, repo-versioned staging area for proposed enhancements, TBDs, and
future work that does not yet belong in an active feature control plane.

The backlog is intentionally small and mechanical: one Markdown file per item,
frontmatter for machine-readable state, prose for human context, and a generated
index for quick recall.

## Layout

```text
docs/backlog/
  README.md      conventions
  INDEX.md       generated; run scripts/backlog-index
  items/         one file per item: ENH-###-<slug>.md
  notes/         optional source analyses that items cite
```

## What Belongs Here

Use the backlog for ideas and deferred follow-ups that have no live owner yet:
cross-feature enhancements, design debts, process improvements, and proposed
future work that would otherwise be lost in chat history.

Do not duplicate live feature state here. Once work starts, graduate the item to
`docs/features/<slug>/TASKS.md` or another repo-owned control plane, then set
`status: in-progress` and `graduated_to:` in the backlog item.

## Item Format

```markdown
---
id: ENH-001
title: One-line imperative title
area: product | platform | sdlc-harness | security | quality | docs | ops | other
status: proposed | accepted | in-progress | done | rejected | superseded
priority: now | next | later
effort: S | M | L
created: YYYY-MM-DD
updated: YYYY-MM-DD
trigger: event or decision that makes this actionable, or "none"
source: where this came from
graduated_to: feature-slug or TASK-### once work starts, else "none"
related: comma-separated IDs, slugs, paths
---

## Context
Why this exists. Include enough background for a future reader with no chat
history. Cite repo paths when possible.

## Proposal
What to do, concretely.

## Done When
- Acceptance sketch.
- Verification expectation.

## Recall Pointers
Files, IDs, docs, or commands to load before working on this.
```

## Conventions

- IDs are global and permanent. Use the next highest `ENH-###`; never reuse or
  renumber IDs.
- Filenames use `ENH-###-<kebab-slug>.md`.
- Priority is `now`, `next`, or `later`, separate from finding severity.
- `trigger` is the recall contract. If a trigger occurs, re-read `INDEX.md`
  and open matching items.
- Allowed areas can be customized with `SDLC_BACKLOG_AREAS_RE`.

## Agent Workflow

1. Read `docs/backlog/INDEX.md` first.
2. Open only the item files relevant to the current task.
3. After adding or editing items, run `scripts/backlog-index`.
4. Before declaring backlog work done, run `scripts/backlog-index --check`.
