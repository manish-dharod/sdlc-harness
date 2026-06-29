#!/usr/bin/env bash
# Append applied insight promotions to docs/insights/APPLIED.md.

sdlc_insight_ledger_usage() {
  cat >&2 <<'EOF'
Usage: scripts/lib-insight-ledger.sh append --insight INS-### --routing ROUTE --target PATHS --eval-delta TEXT --autonomy LEVEL --reviewer-tool TOOL --reviewer-model MODEL --commit COMMIT --branch BRANCH [options]

Options:
  --ledger-file FILE   default: docs/insights/APPLIED.md
  --date YYYY-MM-DD    default: current UTC date

Routes:
  encode-in-structure | add-or-update-principle | role-prompt-edit

Autonomy levels:
  off | capture | distill | auto-structural
EOF
}

sdlc_insight_ledger_fail() {
  printf 'lib-insight-ledger: %s\n' "$1" >&2
  return 3
}

sdlc_insight_ledger_require_value() {
  flag="$1"
  value="${2:-}"
  if [ -z "$value" ]; then
    sdlc_insight_ledger_fail "$flag requires a value"
    return $?
  fi
}

sdlc_insight_ledger_validate_table_cell() {
  field_name="$1"
  value="$2"

  if [ -z "$value" ]; then
    sdlc_insight_ledger_fail "--$field_name is required"
    return $?
  fi
  case "$value" in
    *'|'*|*$'\n'*|*$'\r'*)
      sdlc_insight_ledger_fail "--$field_name may not contain table delimiters or newlines"
      return $?
      ;;
  esac
}

sdlc_insight_ledger_ensure_file() {
  ledger_file="$1"

  if [ -f "$ledger_file" ]; then
    if grep -qF '| Date | INS | Routing | Target | Eval delta | Autonomy | Reviewer | Commit | Branch |' "$ledger_file"; then
      return 0
    fi
    sdlc_insight_ledger_fail "ledger file has unexpected header: $ledger_file"
    return $?
  fi

  mkdir -p "$(dirname "$ledger_file")" || return 3
  cat > "$ledger_file" <<'EOF'
# Applied Insight Ledger

Append-only ledger for applied continuous self-improvement promotions.

Every applied promotion, whether human-gated or auto-structural, gets one row
with enough information to reconstruct the change and revert it if needed.
Rows are appended by `scripts/lib-insight-ledger.sh`; do not hand-edit existing
rows.

| Date | INS | Routing | Target | Eval delta | Autonomy | Reviewer | Commit | Branch |
|---|---|---|---|---|---|---|---|---|
EOF
}

sdlc_insight_ledger_append() {
  ledger_file="${SDLC_INSIGHT_LEDGER_FILE:-docs/insights/APPLIED.md}"
  applied_date="$(date -u +%Y-%m-%d)"
  insight_id=""
  routing=""
  target=""
  eval_delta=""
  autonomy=""
  reviewer_tool=""
  reviewer_model=""
  commit_ref=""
  branch_name=""

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --ledger-file)
        sdlc_insight_ledger_require_value "$1" "${2:-}" || return $?
        ledger_file="${2:-}"
        shift 2
        ;;
      --date)
        sdlc_insight_ledger_require_value "$1" "${2:-}" || return $?
        applied_date="${2:-}"
        shift 2
        ;;
      --insight)
        sdlc_insight_ledger_require_value "$1" "${2:-}" || return $?
        insight_id="${2:-}"
        shift 2
        ;;
      --routing)
        sdlc_insight_ledger_require_value "$1" "${2:-}" || return $?
        routing="${2:-}"
        shift 2
        ;;
      --target)
        sdlc_insight_ledger_require_value "$1" "${2:-}" || return $?
        target="${2:-}"
        shift 2
        ;;
      --eval-delta)
        sdlc_insight_ledger_require_value "$1" "${2:-}" || return $?
        eval_delta="${2:-}"
        shift 2
        ;;
      --autonomy)
        sdlc_insight_ledger_require_value "$1" "${2:-}" || return $?
        autonomy="${2:-}"
        shift 2
        ;;
      --reviewer-tool)
        sdlc_insight_ledger_require_value "$1" "${2:-}" || return $?
        reviewer_tool="${2:-}"
        shift 2
        ;;
      --reviewer-model)
        sdlc_insight_ledger_require_value "$1" "${2:-}" || return $?
        reviewer_model="${2:-}"
        shift 2
        ;;
      --commit)
        sdlc_insight_ledger_require_value "$1" "${2:-}" || return $?
        commit_ref="${2:-}"
        shift 2
        ;;
      --branch)
        sdlc_insight_ledger_require_value "$1" "${2:-}" || return $?
        branch_name="${2:-}"
        shift 2
        ;;
      *)
        sdlc_insight_ledger_fail "unknown arg: $1"
        return $?
        ;;
    esac
  done

  case "$applied_date" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]) ;;
    *)
      sdlc_insight_ledger_fail "--date must be YYYY-MM-DD"
      return $?
      ;;
  esac
  case "$insight_id" in
    INS-[0-9][0-9][0-9]) ;;
    *)
      sdlc_insight_ledger_fail "--insight must be INS-###"
      return $?
      ;;
  esac
  case "$routing" in
    encode-in-structure|add-or-update-principle|role-prompt-edit) ;;
    *)
      sdlc_insight_ledger_fail "--routing must be encode-in-structure, add-or-update-principle, or role-prompt-edit"
      return $?
      ;;
  esac
  case "$autonomy" in
    off|capture|distill|auto-structural) ;;
    *)
      sdlc_insight_ledger_fail "--autonomy must be off, capture, distill, or auto-structural"
      return $?
      ;;
  esac

  for pair in \
    "date:$applied_date" \
    "insight:$insight_id" \
    "routing:$routing" \
    "target:$target" \
    "eval-delta:$eval_delta" \
    "autonomy:$autonomy" \
    "reviewer-tool:$reviewer_tool" \
    "reviewer-model:$reviewer_model" \
    "commit:$commit_ref" \
    "branch:$branch_name"; do
    field_name="${pair%%:*}"
    value="${pair#*:}"
    sdlc_insight_ledger_validate_table_cell "$field_name" "$value" || return $?
  done

  sdlc_insight_ledger_ensure_file "$ledger_file" || return $?

  reviewer="${reviewer_tool}/${reviewer_model}"
  printf '| %s | %s | %s | %s | %s | %s | %s | %s | %s |\n' \
    "$applied_date" "$insight_id" "$routing" "$target" "$eval_delta" "$autonomy" "$reviewer" "$commit_ref" "$branch_name" >> "$ledger_file" || return 3

  printf 'INSIGHT_LEDGER_APPENDED insight=%s routing=%s target=%s commit=%s branch=%s ledger=%s\n' \
    "$insight_id" "$routing" "$target" "$commit_ref" "$branch_name" "$ledger_file"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  set -euo pipefail
  cmd="${1:-}"
  case "$cmd" in
    append)
      shift
      sdlc_insight_ledger_append "$@"
      ;;
    -h|--help)
      sdlc_insight_ledger_usage
      ;;
    *)
      sdlc_insight_ledger_usage
      exit 3
      ;;
  esac
fi
