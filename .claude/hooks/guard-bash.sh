#!/usr/bin/env bash
# Pre-tool guard for the the SDLC harness SDLC workflow.
#
# Receives PreToolUse JSON on stdin from Claude Code. Exits 0 to allow,
# 2 (with stderr message) to block. The deny list in .claude/settings.json
# is the primary defense; this hook catches patterns that prefix matching
# can't express, and provides clear error messages.
#
# Patterns must match the *executable position* of the command — not arbitrary
# substrings. A command like `echo "scripts/feature-loop"` is allowed; only
# actual invocation is blocked.

set -u

PAYLOAD="$(cat)"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

if [ -f "$PROJECT_DIR/scripts/load-config" ]; then
  # shellcheck source=/dev/null
  . "$PROJECT_DIR/scripts/load-config"
fi

# Best-effort extraction of the bash command from the JSON payload.
CMD=""
if command -v jq >/dev/null 2>&1; then
  CMD="$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.command // empty' 2>/dev/null)"
fi
if [ -z "$CMD" ]; then
  CMD="$(printf '%s' "$PAYLOAD" | grep -oE '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"command"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/')"
fi

if [ -z "$CMD" ]; then
  exit 0
fi

capture_hook_block() {
  [ -x "$PROJECT_DIR/scripts/lib-capture.sh" ] || return 0
  "$PROJECT_DIR/scripts/lib-capture.sh" emit \
    --source claude-hook \
    --feature global \
    --actor-tool claude-code \
    --actor-model "${CLAUDE_MODEL:-unknown}" \
    --outcome blocked \
    --stop-reason GUARD_BLOCKED \
    --verify-mode none \
    --verify-exit 0 \
    --lesson-hint "Claude Bash hook blocked a guarded command category" \
    >/dev/null 2>&1 || true
}

block() {
  printf 'BLOCKED by .claude/hooks/guard-bash.sh: %s\n' "$1" >&2
  capture_hook_block
  exit 2
}

# Boundary prefix: command-start position only. We want to block *invocation*
# (the path or binary in executable position), not occurrence as an argument
# to git/rm/cat/grep/sed/echo etc. Executable position means: very start of
# the command, or after a shell separator ( ; && || | ( newline ) — NOT after
# plain whitespace, which is how arguments are delimited.
EXEC_BOUNDARY='(^|[;&|(]|[[:space:]]&&[[:space:]]|[[:space:]]\|\|[[:space:]])[[:space:]]*'

# Legacy Codex workflow — fully migrated to Claude Code subagents. v2 also
# deleted scripts/feature-loop entirely; this is the safety net.
if printf '%s' "$CMD" | grep -qE "${EXEC_BOUNDARY}scripts/feature-loop([[:space:]]|$)"; then
  block "scripts/feature-loop is deleted (framework v2). Use the /feature-loop slash command (Claude-native, spawns role agents)."
fi

if printf '%s' "$CMD" | grep -qE "${EXEC_BOUNDARY}codex([[:space:]]|$)"; then
  block "Raw Codex CLI is blocked. Use /feature-loop / /feature-review or sanctioned wrappers (scripts/adversary-review, scripts/security-review, scripts/codex-capsule-run) so context is sanitized and artifacts are captured."
fi

# Shell-wrapper bypass — catches the common pattern of invoking a blocked
# binary inside a quoted argument to bash/sh/zsh/dash -c. e.g.:
#   bash -c 'codex exec foo'
#   sh -lc "scripts/feature-loop"
# We only match when codex / scripts/feature-loop is the FIRST token inside
# the quoted command (after optional whitespace). Creative bypasses like
# `bash -c 'true; codex'` are not blocked here — those fall under the same
# residual-risk caveat as command substitution and here-docs (see CLAUDE.md).
SHELL_WRAPPED='[[:space:]]+(-[a-zA-Z]*c[a-zA-Z]*)[[:space:]]+['"'"'"][[:space:]]*(codex|scripts/feature-loop)([[:space:]'"'"'"]|$)'
if printf '%s' "$CMD" | grep -qE "${EXEC_BOUNDARY}(bash|sh|zsh|dash)${SHELL_WRAPPED}"; then
  block "Shell-wrapped invocation of codex / scripts/feature-loop is blocked. Sanctioned wrappers invoke worker tools as child processes with sanitized context and artifact capture."
fi

# Destructive git patterns.
if printf '%s' "$CMD" | grep -qE "${EXEC_BOUNDARY}git[[:space:]]+push([[:space:]]+[^|;&]*)?[[:space:]]+(--force|-f)([[:space:]=]|$)"; then
  block "git push --force is blocked. Use --force-with-lease (allowed) and confirm with the user if absolutely needed."
fi

if printf '%s' "$CMD" | grep -qE "${EXEC_BOUNDARY}git[[:space:]]+reset[[:space:]]+--hard"; then
  block "git reset --hard is destructive. Use 'git stash' or 'git restore' instead, or ask the user."
fi

if printf '%s' "$CMD" | grep -qE "${EXEC_BOUNDARY}git[[:space:]]+commit([[:space:]]+[^|;&]*)?[[:space:]]+(--no-verify|-n)([[:space:]]|$)"; then
  block "git commit --no-verify bypasses pre-commit hooks. Fix the underlying issue instead."
fi

# Agent worktrees should be created through the configured scratch/external root.
# The project-neutral helper is scripts/worktree-add-external; raw `git worktree
# add` is allowed only when the target command visibly uses SDLC_WORKTREE_ROOT.
if printf '%s' "$CMD" | grep -qE "${EXEC_BOUNDARY}git([[:space:]]+-C[[:space:]]+([^[:space:]]+|\"[^\"]+\"|'[^']+'))?[[:space:]]+worktree[[:space:]]+add([[:space:]]|$)"; then
  if [ -z "${SDLC_WORKTREE_ROOT:-}" ]; then
    block "Raw git worktree add requires SDLC_WORKTREE_ROOT. Prefer scripts/worktree-add-external, which validates the configured scratch/external root."
  fi
  if ! printf '%s' "$CMD" | grep -Fq -- "$SDLC_WORKTREE_ROOT/"; then
    block "Temporary worktrees must be created under SDLC_WORKTREE_ROOT=$SDLC_WORKTREE_ROOT. Use scripts/worktree-add-external or pass a target inside that root."
  fi
fi

# Destructive rm targeting filesystem root, top-level system directories, home,
# or parent paths. Specific subpaths (e.g. /tmp/foo, /Users/me/scratch) are
# allowed — only the catastrophic cases are blocked.
RM_SYS='/(\*|bin|boot|dev|etc|lib|lib64|opt|proc|root|sbin|sys|usr|var)?([[:space:]/]|$)'
RM_HOME='~([[:space:]/]|$)'
RM_PARENT='\.\.([[:space:]/]|$)'
if printf '%s' "$CMD" | grep -qE "${EXEC_BOUNDARY}rm([[:space:]]+--?[a-zA-Z-]+)*[[:space:]]+(${RM_SYS}|${RM_HOME}|${RM_PARENT})"; then
  block "Refusing rm targeting filesystem root, a top-level system dir, home, or parent paths. Specific subpaths under /tmp, /Users, /home, or the project tree are fine."
fi

# Successful allow decisions are deliberately not captured. They are the
# steady-state path and would dominate the learning stream with generic
# boilerplate. Blocked categories remain captured in block() above because
# they are actionable evidence.
exit 0
