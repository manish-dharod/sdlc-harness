---
name: principle-encode-lessons-in-structure
description: When you catch yourself writing the same instruction a second time, encode it as a script, lint rule, hook, metadata flag, or template field instead of more prompt text. The text is a symptom; the structure is the fix.
metadata:
  type: principle
  layer: meta
  enforced-by:
    - scripts/feature-reconcile (drift detection)
    - .claude/hooks/guard-bash.sh (regex enforcement)
    - scripts/feature-reflect (structural-enforcement check in /feature-reflect synthesizer)
---

# Encode Lessons in Structure

When the same correction or instruction shows up twice, the right answer is
almost never "make the documentation longer." Encode the rule in a
deterministic mechanism so it cannot be missed:

1. A script check (`scripts/feature-reconcile`, `scripts/test-framework-v3`,
   `scripts/feature-verify`, etc.).
2. A pre-tool guard hook (`.claude/hooks/guard-bash.sh`).
3. A template field in `docs/features/_template{,_small,_medium}/`.
4. A required EVIDENCE row shape.
5. A metadata flag on a feature, task, or finding.
6. A runtime assertion in code.

Only when none of those fit — when the rule genuinely requires human or
agentic judgment — does it earn a place in a role prompt or a principles
file.

## When to apply

- A reviewer keeps catching the same issue across features.
- A loop iteration keeps re-discovering the same blocker.
- A CLAUDE.md or AGENTS.md section keeps growing because new edge cases
  keep landing on it.
- `/feature-reflect` synthesizer produces an Accepted item whose
  enforcement is clearly mechanical.

## Procedure

When you catch yourself about to write the same instruction a second time:

1. Ask: can this be a script, lint, hook, template field, or check?
2. If yes, **build that and delete the textual instruction.**
3. If no (genuinely requires judgment), make the instruction more
   prominent, name a concrete failure mode, and link to an enforcement
   gate that surfaces the failure even when the instruction is missed.

## Anti-patterns

- Acknowledging the recurring issue without recording the fix
  ("I'll keep that in mind" does not persist across sessions).
- Adding the rule to CLAUDE.md as more prose ("we should always X")
  when the same rule could be a check.
- Adding both a structural enforcement AND prose. Pick one — the prose
  becomes stale the moment the structural enforcement diverges from it.
- Building the structural enforcement and forgetting to remove the
  obsolete instructions it replaces.

## the SDLC harness-specific examples

- "Don't claim ready when worktree is dirty" → `scripts/worktree-hygiene`.
  The text in CLAUDE.md is now a pointer to the script, not a re-statement
  of the rule.
- "Don't directly invoke `codex` / `codex exec`" → regex in
  `.claude/hooks/guard-bash.sh` plus prefix allowlist in
  `.claude/settings.json`. The hook fires on a violation; nobody has to
  remember the rule.
- "Adversarial-trail must exist on Done tasks" → enforced by
  `scripts/feature-reconcile`. Role prompts only need to reference the
  output.
- "Don't push raw cards to Codex prompts" → sanitization tripwire in
  `scripts/adversary-review` and `scripts/security-review`. The wrapper
  refuses to send.

## How this principle interacts with `/feature-reflect`

The `/feature-reflect` synthesizer applies this principle as a hard
post-pass: any Accepted recommendation that could be a script/lint/hook
gets re-routed to Backlog with `routing: encode-in-structure`. The loop's
output is therefore structural-improvement candidates first, prompt-text
deltas second. Without this principle the loop would just accrete more
text into CLAUDE.md every iteration, which is exactly the failure mode the
framework is built to prevent.

## Source

Adapted from [pstack `principle-encode-lessons-in-structure`](https://github.com/cursor/plugins/blob/main/pstack/skills/principle-encode-lessons-in-structure/SKILL.md).
The the SDLC harness version names this repo's actual enforcement points
(scripts, hooks, templates) rather than restating the abstract rule.
