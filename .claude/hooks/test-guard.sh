#!/usr/bin/env bash
# Smoke test for .claude/hooks/guard-bash.sh
#
# Verifies that:
#   - Destructive commands exit 2 (blocked)
#   - Benign commands exit 0 (allowed)
#   - Legacy-framework commands exit 2 (blocked)
#
# Exit codes:
#   0  all assertions passed
#   1  one or more assertions failed
#
# Usage:
#   .claude/hooks/test-guard.sh           # quiet on pass, loud on fail
#   VERBOSE=1 .claude/hooks/test-guard.sh # always print every case

set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOK="$ROOT/.claude/hooks/guard-bash.sh"
VERBOSE="${VERBOSE:-0}"

if [ ! -x "$HOOK" ] && [ ! -f "$HOOK" ]; then
  printf 'FAIL: hook not found at %s\n' "$HOOK" >&2
  exit 1
fi

FAILS=0
RAN=0

# JSON-encode an arbitrary string. The previous version used printf with %s
# and no escaping, which produced malformed JSON whenever the command
# contained `"` or `\`. The hook's jq parser then failed and fell back to
# a grep regex that captured only the prefix up to the first stray quote,
# giving false confidence (the test would "pass" because the hook saw a
# benign truncated command, not the intended payload).
#
# We use jq -n --arg if available (matches the hook's own dependency), else
# fall back to a python3 one-liner — both are essentially always present on
# macOS / Linux dev boxes. If neither exists, the test bails loudly so the
# user knows their local checks aren't trustworthy.
json_payload() {
  local cmd="$1"
  if command -v jq >/dev/null 2>&1; then
    jq -nc --arg command "$cmd" '{tool_input:{command:$command}}'
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys; print(json.dumps({"tool_input":{"command":sys.argv[1]}}))' "$cmd"
  else
    printf 'FATAL: neither jq nor python3 available; cannot safely build JSON payloads for test-guard.\n' >&2
    exit 1
  fi
}

# run_case <expected_exit> <description> <command>
run_case() {
  local expected="$1"
  local desc="$2"
  local cmd="$3"

  RAN=$((RAN + 1))
  local payload actual
  payload="$(json_payload "$cmd")"
  # Swallow stderr — hook prints "BLOCKED: ..." which is expected, not a failure.
  actual=0
  printf '%s' "$payload" | bash "$HOOK" >/dev/null 2>&1 || actual=$?

  if [ "$actual" = "$expected" ]; then
    [ "$VERBOSE" = "1" ] && printf '  PASS [exit %s] %s\n' "$actual" "$desc"
  else
    printf '  FAIL [expected exit %s, got %s] %s\n    cmd: %s\n    payload: %s\n' \
      "$expected" "$actual" "$desc" "$cmd" "$payload" >&2
    FAILS=$((FAILS + 1))
  fi
}

printf '== guard-bash.sh smoke test ==\n'

# Destructive: must block (exit 2).
run_case 2 'rm -rf /'                       'rm -rf /'
run_case 2 'git push --force'               'git push --force origin master'
run_case 2 'git push -f shorthand'          'git push -f origin master'
run_case 2 'git reset --hard'               'git reset --hard HEAD~1'
run_case 2 'git commit --no-verify'         'git commit --no-verify -m foo'
run_case 2 'git commit -n shorthand'        'git commit -n -m foo'
run_case 2 'raw worktree add without configured root' 'git worktree add /tmp/sdlc-wrong-root/foo foo'

# Legacy / migrated-away: must block (exit 2).
run_case 2 'legacy scripts/feature-loop'    'scripts/feature-loop foo'
run_case 2 'legacy codex CLI (exec)'        'codex exec foo'
run_case 2 'raw codex with prompt'          'codex "do this thing"'
run_case 2 'raw codex bare'                 'codex'
run_case 2 'codex after && separator'       'true && codex exec foo'
run_case 2 'codex after | pipe'             'echo hi | codex exec foo'

# Shell-wrapper bypass — must block (exit 2). These are the patterns the
# reviewer flagged: bash -c '...codex...' style invocations that the old
# regex missed because it required a shell separator (; & | () or string
# start before `codex`, and a single-quote inside `bash -c` did not count.
run_case 2 'bash -lc codex single-quote'    "bash -lc 'codex exec foo'"
run_case 2 'bash -c codex single-quote'     "bash -c 'codex exec foo'"
run_case 2 'bash -c codex double-quote'     'bash -c "codex exec foo"'
run_case 2 'sh -c codex'                    "sh -c 'codex exec foo'"
run_case 2 'zsh -c codex'                   "zsh -c 'codex'"
run_case 2 'bash -lc scripts/feature-loop'  "bash -lc 'scripts/feature-loop foo'"

# Command substitution + chained separators inside bash -c — must block
# (exit 2). These were previously documented as "unblocked" caveats; they
# are actually caught by the EXEC_BOUNDARY regex (`(` and `;` are shell
# separators that match wherever they appear in the string). Lock the
# behavior in so future regex changes don't silently weaken it.
run_case 2 'codex in POSIX command sub'     'result=$(codex exec foo)'
run_case 2 'codex in $( with spaces'        'echo $( codex exec foo)'
run_case 2 'codex after chained ; in bash -c'  "bash -c 'true; codex exec foo'"
run_case 2 'codex after chained && in bash -c' "bash -c 'true && codex exec foo'"

# Benign: must allow (exit 0).
run_case 0 'plain ls'                       'ls -la'
run_case 0 'git status'                     'git status'
run_case 0 'git push (no force)'            'git push origin master'
export SDLC_WORKTREE_ROOT=/tmp/sdlc-worktrees
run_case 0 'worktree add under configured root' 'git worktree add /tmp/sdlc-worktrees/foo foo'
run_case 2 'worktree add outside configured root' 'git worktree add /tmp/other-worktrees/foo foo'
unset SDLC_WORKTREE_ROOT
run_case 0 'rm specific subpath'            'rm -rf /tmp/scratch/foo'
run_case 0 'echo containing scripts/feature-loop in arg' 'echo scripts/feature-loop'
run_case 0 'grep containing rm -rf / in arg'             'grep rm-pattern foo.txt'
run_case 0 'echo containing codex in arg'   'echo "use codex for X"'
run_case 0 'grep for codex pattern'         'grep codex foo.txt'
run_case 0 'bash -c benign echo'            "bash -c 'echo hello'"
run_case 0 'bash -c echo codex in middle'   "bash -c 'echo use codex for X'"

# Sanctioned adversary wrapper: must allow (exit 0). The wrapper invokes
# codex internally as a child process; the hook only inspects Claude's
# Bash tool calls, so direct codex stays blocked while the wrapper passes.
run_case 0 'scripts/adversary-review'                   'scripts/adversary-review my-feature'
run_case 0 'scripts/adversary-review with task id'      'scripts/adversary-review my-feature TASK-001'
run_case 0 'scripts/adversary-review with mode'         'scripts/adversary-review my-feature TASK-001 review-strict'
run_case 0 './scripts/adversary-review relative path'   './scripts/adversary-review my-feature'
run_case 0 'scripts/claude-adversary-review'            'scripts/claude-adversary-review my-feature TASK-001 review-strict'
run_case 0 './scripts/claude-adversary-review relative path' './scripts/claude-adversary-review my-feature TASK-001 review-strict'

# Second sanctioned wrapper for cross-model security review. Same
# allowance pattern as adversary-review (script is what Claude invokes;
# codex spawned as child process is not re-checked by the hook).
run_case 0 'scripts/security-review'                    'scripts/security-review my-feature'
run_case 0 'scripts/security-review with task id'       'scripts/security-review my-feature TASK-001'
run_case 0 'scripts/security-review with mode'          'scripts/security-review my-feature TASK-001 review-strict'
run_case 0 './scripts/security-review relative path'    './scripts/security-review my-feature'

# Sanctioned implementation capsule wrappers. Raw codex remains blocked above;
# supervisor-managed worker launch goes through these scripts so the capsule
# checker, model pinning, artifact capture, and ownership checks run first.
run_case 0 'scripts/codex-capsule-run'                  'scripts/codex-capsule-run my-feature TASK-001 /tmp/capsule.md'
run_case 0 './scripts/codex-capsule-run relative path'  './scripts/codex-capsule-run my-feature TASK-001 /tmp/capsule.md'
run_case 0 'scripts/claude-capsule-run'                 'scripts/claude-capsule-run my-feature TASK-001 /tmp/capsule.md'
run_case 0 './scripts/claude-capsule-run relative path' './scripts/claude-capsule-run my-feature TASK-001 /tmp/capsule.md'
run_case 0 'scripts/worktree-add-external'              'scripts/worktree-add-external worker-1 codex/example'

printf '\n== result: %d ran, %d failed ==\n' "$RAN" "$FAILS"
[ "$FAILS" -eq 0 ] && exit 0 || exit 1
