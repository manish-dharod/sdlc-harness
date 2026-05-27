# Migrating an adopter project from sdlc-harness v1.0 to v1.1

If you cloned `sdlc-harness` into your repo while v1.0 was current (the
ten-agent shape), the rename to the five-agent shape in v1.1 is a
breaking but mechanical change. This doc gives the migration recipe and
the explicit list of behavioral drops (there are none of substance — the
collapse is structural).

The framework's own self-test (`scripts/test-framework-v3`) verifies the
v1.1 shape end-to-end. The lightweight health check (`scripts/sdlc-doctor`)
also accepts both shapes during a migration window: it passes on v1.1
and warns (does not fail) on v1.0 so you can run it mid-migration.

## What changed

| v1.0 agent | v1.1 successor | How to invoke |
|---|---|---|
| `sdlc-product` | `planner` | Prompt includes `Phase: intake` |
| `sdlc-architect` | `planner` | Prompt includes `Phase: design` |
| `sdlc-tech-lead` | `planner` | Prompt includes `Phase: plan` |
| `sdlc-swe` | `builder` | (no flag) |
| `sdlc-reviewer` | `reviewer` | Prompt includes `Mode: quality` |
| `sdlc-qa` | `reviewer` | Prompt includes `Mode: qa` |
| `sdlc-adversary` | `reviewer` | Prompt includes `Mode: adversarial` |
| `sdlc-acceptance` | `reviewer` | Prompt includes `Mode: acceptance` |
| `sdlc-security` | `security` | (no flag) |
| `sdlc-release` | `release` | (no flag) |

Three roles (product / architect / tech-lead) collapse into a single
`planner` agent that operates in one of three phases. Four roles
(reviewer / qa / adversary / acceptance) collapse into a single
`reviewer` agent that operates in one of four modes. `builder`,
`security`, and `release` rename without collapse.

The Task tool's `subagent_type` parameter now takes one of five values
instead of ten: `planner | builder | reviewer | security | release`.
The phase or mode goes in the freeform prompt body.

## Migration recipe

**You only need to do this if you imported the v1.0 agent files into
your own project.** The framework repo itself is already on v1.1.

### Step 1 — Pull the new agent files into your repo

```bash
# In your project root:
git clone https://github.com/manish-dharod/sdlc-harness.git /tmp/sdlc-harness-v1.1

# Remove the v1.0 agents (clean cut — these no longer exist):
rm -f .claude/agents/sdlc-product.md \
      .claude/agents/sdlc-architect.md \
      .claude/agents/sdlc-tech-lead.md \
      .claude/agents/sdlc-swe.md \
      .claude/agents/sdlc-reviewer.md \
      .claude/agents/sdlc-qa.md \
      .claude/agents/sdlc-adversary.md \
      .claude/agents/sdlc-acceptance.md \
      .claude/agents/sdlc-security.md \
      .claude/agents/sdlc-release.md

# Copy the v1.1 agents:
cp /tmp/sdlc-harness-v1.1/.claude/agents/*.md .claude/agents/

# Refresh slash commands (they reference the new agent names):
cp /tmp/sdlc-harness-v1.1/.claude/commands/feature-*.md .claude/commands/

# Refresh scripts (parsers now accept both v1.0 and v1.1 source-tag
# shapes for backward compat, but the prompt templates emit v1.1):
cp /tmp/sdlc-harness-v1.1/scripts/* scripts/
chmod +x scripts/feature-* scripts/adversary-review scripts/security-review \
         scripts/worktree-hygiene scripts/sdlc-doctor scripts/test-framework-v3 \
         scripts/lib-sanitize.sh scripts/load-config scripts/log-decision

# Refresh feature templates (status legends and EVIDENCE format mention
# the new agent names):
cp -R /tmp/sdlc-harness-v1.1/docs/features/_template* docs/features/

# Optional: refresh the workflow doc (your README and CLAUDE.md may have
# adopter customizations — diff before overwriting):
diff -q docs/AGENT_SDLC_WORKFLOW.md /tmp/sdlc-harness-v1.1/docs/AGENT_SDLC_WORKFLOW.md && \
  cp /tmp/sdlc-harness-v1.1/docs/AGENT_SDLC_WORKFLOW.md docs/
```

### Step 2 — Update your own CLAUDE.md / AGENTS.md

If your project's `CLAUDE.md` or `AGENTS.md` mentions any of the v1.0
agent names (e.g., "invoke `sdlc-swe` to claim a task"), search and
replace them with the new names + flag conventions. Useful pattern:

```bash
# In your project root (NOT in sdlc-harness — that's already done):
grep -rEln 'sdlc-(product|architect|tech-lead|swe|reviewer|qa|adversary|acceptance|release|security)\b' \
  CLAUDE.md AGENTS.md docs/ 2>/dev/null
```

For each hit, apply the mapping table at the top of this file. Most
references will be in narrative prose; the agent-tool calls in
`.claude/commands/` are already updated by the file copy in Step 1.

### Step 3 — Verify

```bash
scripts/test-framework-v3   # should report all checks pass
scripts/sdlc-doctor          # should report HEALTHY
```

`test-framework-v3` will fail if any `sdlc-*.md` agent file is still
present in `.claude/agents/` or if any slash command still references a
v1.0 agent name. `sdlc-doctor` detects the v1.1 shape automatically and
also accepts the v1.0 shape with a WARN during migration windows.

### Step 4 — (optional) Update any historical FINDINGS / EVIDENCE tags

Existing FINDINGS.md and EVIDENCE.md entries from before the migration
will have `- Source: sdlc-adversary`, `- Source: sdlc-security`, etc.
The framework's parsers in `scripts/feature-reconcile` and
`scripts/security-review` accept both v1.0 and v1.1 source-tag shapes, so
your historical entries continue to validate without edits.

If you want to normalize history for clarity (purely cosmetic), use:

```bash
# DESTRUCTIVE — make a commit first.
perl -i -pe '
  s/Source: sdlc-adversary/Source: reviewer (Mode: adversarial)/g;
  s/Source: sdlc-security/Source: security/g;
  s/Source: sdlc-reviewer/Source: reviewer (Mode: quality)/g;
  s/Source: sdlc-qa/Source: reviewer (Mode: qa)/g;
  s/Source: sdlc-acceptance/Source: reviewer (Mode: acceptance)/g;
' docs/features/*/FINDINGS.md docs/features/*/EVIDENCE.md
```

Skip this step unless you want history to read in the new style. The
parsers don't care.

## Intentional drops

The collapse preserves every behavioral rule. The only intentional
drops are:

1. **Per-agent description-shaped frontmatter examples** — each v1.0
   agent file had a self-contained `<example>...<example>` block in its
   frontmatter. In v1.1 the `planner` and `reviewer` files have one
   block per phase / mode, so the original 10 examples become 3 + 4 + 1
   + 1 + 1 = 9 examples (one fewer because the `planner` description
   shares a single intro example across the three phases).
2. **"Always invoke this skill" wording differences between
   sdlc-reviewer and sdlc-adversary** — the v1.0 reviewer described
   `superpowers:requesting-code-review` as "optional" for high-risk
   diffs; the v1.0 adversary did not invoke it at all. v1.1's
   `reviewer (Mode: quality)` preserves the optional-for-high-risk
   semantics; `reviewer (Mode: adversarial)` continues to not invoke
   that skill (it has its own codex-backed wrapper, which is the
   adversarial-flavored equivalent). No actual behavior change.
3. **The two distinct opening paragraphs of sdlc-product** — one
   described the role and one described the brainstorming HARD-GATE. In
   v1.1 these are merged into the `Phase: intake` section of
   `planner.md` with the same content, but the role-overview is shared
   across all three phases at the top of the file. Net text reduction:
   ~6 lines of duplicated framing.

If you find a v1.0 rule that's missing in v1.1, please file an issue at
`https://github.com/manish-dharod/sdlc-harness/issues`. The collapse is
meant to be lossless on semantics.

## What about my own custom agents?

If you added project-specific agents alongside the v1.0 sdlc-* set
(e.g., `.claude/agents/myproject-deploy-bot.md`), those are untouched by
this migration. The framework's self-test only checks for the 5 v1.1
agents and the absence of the 10 v1.0 ones. Your custom agents continue
to live alongside the framework's.

## Rolling back

If something breaks in your project after the migration:

1. `git revert <merge sha>` — restores the 10 v1.0 agents in your repo
   and reverts your slash command / scripts updates.
2. Re-run `scripts/test-framework-v3` — should show the v1.0 shape's
   174-pass count.
3. File the breakage at `https://github.com/manish-dharod/sdlc-harness/issues`
   so we can fix it in v1.1.x.

The framework repo (`manish-dharod/sdlc-harness`) does not provide a
sidecar v1.0 release on a branch; if you need v1.0 long-term, pin to
the `v1.0` tag.
