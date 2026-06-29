#!/usr/bin/env bash
# Local CSI error-budget state. Records auto-structural outcomes and writes a
# gitignored downgrade marker when the rolling regression budget is breached.

# Resolve this script's repo root so the DEFAULT downgrade-marker location is
# anchored to the repo, not the caller's CWD. load-config reads the same
# repo-root-anchored floor, so a CWD redirect cannot hide a breach (FND-068).
SDLC_EB_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd)"
[ -n "$SDLC_EB_ROOT" ] || SDLC_EB_ROOT="."

sdlc_error_budget_usage() {
  cat >&2 <<'EOF'
Usage: scripts/lib-error-budget.sh record --insight INS-### --outcome pass|regression|rollback [options]
       scripts/lib-error-budget.sh rearm [options]

Options:
  --state-dir DIR       default: .sdlc/error-budget
  --approvals-file FILE default: docs/features/continuous-self-improvement-loop/APPROVALS.md
  --max-regressions N   default: 1
  --window N            default: 10

The rearm command clears state.env only after APV-CSI-ERROR-BUDGET is Approved.
EOF
}

sdlc_error_budget_is_bad_outcome() {
  case "$1" in
    regression|rollback) return 0 ;;
    *) return 1 ;;
  esac
}

sdlc_error_budget_require_value() {
  flag="$1"
  value="${2:-}"
  if [ -z "$value" ]; then
    printf 'lib-error-budget: %s requires a value\n' "$flag" >&2
    return 3
  fi
}

sdlc_error_budget_rearm_approval_status() {
  approvals_file="$1"

  [ -f "$approvals_file" ] || return 1
  awk '
    /^### / {
      if ($0 == "### APV-CSI-ERROR-BUDGET: Re-arm auto-structural after error-budget downgrade") {
        in_block = 1
      } else if (in_block) {
        in_block = 0
      }
    }
    in_block && /^- Status: / {
      status = $0
      sub(/^- Status: /, "", status)
      gsub(/`/, "", status)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", status)
      print status
      found = 1
      exit
    }
    END { exit(found ? 0 : 1) }
  ' "$approvals_file"
}

sdlc_error_budget_approval_has_status() {
  approvals_file="$1"
  expected_status="$2"
  status="$(sdlc_error_budget_rearm_approval_status "$approvals_file" 2>/dev/null || true)"
  [ "$status" = "$expected_status" ]
}

sdlc_error_budget_reopen_rearm_approval() {
  approvals_file="$1"
  event_ts="$2"
  bad_count="$3"
  window="$4"
  tmp_file="${approvals_file}.tmp.$$"

  awk -v event_date="${event_ts%%T*}" -v bad_count="$bad_count" -v window="$window" '
    function append_reopen() {
      if (!reopened) {
        print "- Reopened by: scripts/lib-error-budget.sh on " event_date
        print "- Budget evidence: " bad_count " regression/rollback event(s) in the last " window " auto-structural promotion(s)"
        reopened = 1
      }
    }
    /^### / {
      if (in_block && $0 != "### APV-CSI-ERROR-BUDGET: Re-arm auto-structural after error-budget downgrade") {
        append_reopen()
        in_block = 0
      }
      if ($0 == "### APV-CSI-ERROR-BUDGET: Re-arm auto-structural after error-budget downgrade") {
        in_block = 1
      }
    }
    in_block && /^- Status: / {
      print "- Status: Requested"
      next
    }
    in_block && /^- waiting_on_human: / {
      print "- waiting_on_human: true"
      next
    }
    in_block && /^- Stop reason code: / {
      print "- Stop reason code: NEEDS_HUMAN_APPROVAL"
      next
    }
    {
      print
    }
    END {
      if (in_block) append_reopen()
    }
  ' "$approvals_file" > "$tmp_file" || {
    rm -f "$tmp_file"
    return 3
  }
  mv "$tmp_file" "$approvals_file" || {
    rm -f "$tmp_file"
    return 3
  }
}

sdlc_error_budget_open_rearm_approval() {
  approvals_file="$1"
  event_ts="$2"
  bad_count="$3"
  window="$4"

  mkdir -p "$(dirname "$approvals_file")" || return 3
  if sdlc_error_budget_approval_has_status "$approvals_file" "Requested"; then
    return 0
  fi
  if [ -f "$approvals_file" ] &&
     grep -q '^### APV-CSI-ERROR-BUDGET: Re-arm auto-structural after error-budget downgrade$' "$approvals_file"; then
    sdlc_error_budget_reopen_rearm_approval "$approvals_file" "$event_ts" "$bad_count" "$window"
    return $?
  fi

  cat >> "$approvals_file" <<EOF

### APV-CSI-ERROR-BUDGET: Re-arm auto-structural after error-budget downgrade

- Status: Requested
- waiting_on_human: true
- Stop reason code: NEEDS_HUMAN_APPROVAL
- Owner: repo owner
- Requested by: scripts/lib-error-budget.sh on ${event_ts%%T*}
- What is being approved: re-arm auto-structural after the CSI error budget downgraded autonomy to distill.
- Linked artifacts: SPEC.md AC-014; STATE.md#csi-error-budget; TASK-011
- Approval evidence (when Approved): pending
- Decision date:
- Budget evidence: ${bad_count} regression/rollback event(s) in the last ${window} auto-structural promotion(s)
EOF
}

sdlc_error_budget_record() {
  insight_id=""
  outcome=""
  state_dir="${SDLC_ERROR_BUDGET_STATE_DIR:-$SDLC_EB_ROOT/.sdlc/error-budget}"
  approvals_file="${SDLC_ERROR_BUDGET_APPROVALS_FILE:-docs/features/continuous-self-improvement-loop/APPROVALS.md}"
  max_regressions="${SDLC_ERROR_BUDGET_MAX_REGRESSIONS:-1}"
  window="${SDLC_ERROR_BUDGET_WINDOW:-10}"

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --insight)
        sdlc_error_budget_require_value "$1" "${2:-}" || return $?
        insight_id="${2:-}"
        shift 2
        ;;
      --outcome)
        sdlc_error_budget_require_value "$1" "${2:-}" || return $?
        outcome="${2:-}"
        shift 2
        ;;
      --state-dir)
        sdlc_error_budget_require_value "$1" "${2:-}" || return $?
        state_dir="${2:-}"
        shift 2
        ;;
      --approvals-file)
        sdlc_error_budget_require_value "$1" "${2:-}" || return $?
        approvals_file="${2:-}"
        shift 2
        ;;
      --max-regressions)
        sdlc_error_budget_require_value "$1" "${2:-}" || return $?
        max_regressions="${2:-}"
        shift 2
        ;;
      --window)
        sdlc_error_budget_require_value "$1" "${2:-}" || return $?
        window="${2:-}"
        shift 2
        ;;
      *)
        printf 'lib-error-budget: unknown arg: %s\n' "$1" >&2
        return 3
        ;;
    esac
  done

  case "$insight_id" in
    INS-[0-9][0-9][0-9]) ;;
    *)
      printf 'lib-error-budget: --insight must be INS-###\n' >&2
      return 3
      ;;
  esac
  case "$outcome" in
    pass|regression|rollback) ;;
    *)
      printf 'lib-error-budget: --outcome must be pass, regression, or rollback\n' >&2
      return 3
      ;;
  esac
  case "$max_regressions" in
    ''|*[!0-9]*|0)
      printf 'lib-error-budget: --max-regressions must be a positive integer\n' >&2
      return 3
      ;;
  esac
  case "$window" in
    ''|*[!0-9]*|0)
      printf 'lib-error-budget: --window must be a positive integer\n' >&2
      return 3
      ;;
  esac

  mkdir -p "$state_dir" || return 3
  events_file="$state_dir/events.tsv"
  state_file="$state_dir/state.env"
  event_ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

  printf '%s\t%s\t%s\n' "$event_ts" "$insight_id" "$outcome" >> "$events_file" || return 3

  recent_file="$state_dir/.recent.$$"
  tail -n "$window" "$events_file" > "$recent_file"
  bad_count="$(awk -F '\t' '$3 == "regression" || $3 == "rollback" { count++ } END { print count+0 }' "$recent_file")"
  rm -f "$recent_file"

  downgraded="false"
  if sdlc_error_budget_is_bad_outcome "$outcome" && [ "$bad_count" -ge "$max_regressions" ]; then
    downgraded="true"
    cat > "$state_file" <<EOF
SDLC_SELF_IMPROVE_AUTONOMY=distill
SDLC_SELF_IMPROVE_DOWNGRADE_REASON=ERROR_BUDGET_BREACH
SDLC_SELF_IMPROVE_DOWNGRADE_TS=$event_ts
SDLC_SELF_IMPROVE_DOWNGRADE_BAD_COUNT=$bad_count
SDLC_SELF_IMPROVE_DOWNGRADE_WINDOW=$window
EOF
    sdlc_error_budget_open_rearm_approval "$approvals_file" "$event_ts" "$bad_count" "$window" || return 3
  fi

  printf 'ERROR_BUDGET_SUMMARY insight=%s outcome=%s bad_count=%s window=%s max_regressions=%s downgraded=%s state_dir=%s\n' \
    "$insight_id" "$outcome" "$bad_count" "$window" "$max_regressions" "$downgraded" "$state_dir"
}

sdlc_error_budget_rearm() {
  state_dir="${SDLC_ERROR_BUDGET_STATE_DIR:-$SDLC_EB_ROOT/.sdlc/error-budget}"
  approvals_file="${SDLC_ERROR_BUDGET_APPROVALS_FILE:-docs/features/continuous-self-improvement-loop/APPROVALS.md}"

  while [ "$#" -gt 0 ]; do
    case "$1" in
      --state-dir)
        sdlc_error_budget_require_value "$1" "${2:-}" || return $?
        state_dir="${2:-}"
        shift 2
        ;;
      --approvals-file)
        sdlc_error_budget_require_value "$1" "${2:-}" || return $?
        approvals_file="${2:-}"
        shift 2
        ;;
      *)
        printf 'lib-error-budget: unknown arg: %s\n' "$1" >&2
        return 3
        ;;
    esac
  done

  if ! sdlc_error_budget_approval_has_status "$approvals_file" "Approved"; then
    printf 'lib-error-budget: APV-CSI-ERROR-BUDGET must be Approved before rearm clears downgrade state\n' >&2
    return 2
  fi

  state_file="$state_dir/state.env"
  rm -f "$state_file" || return 3
  printf 'ERROR_BUDGET_REARMED state_file=%s approval=APV-CSI-ERROR-BUDGET\n' "$state_file"
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  set -euo pipefail
  cmd="${1:-}"
  case "$cmd" in
    record)
      shift
      sdlc_error_budget_record "$@"
      ;;
    rearm)
      shift
      sdlc_error_budget_rearm "$@"
      ;;
    -h|--help)
      sdlc_error_budget_usage
      ;;
    *)
      sdlc_error_budget_usage
      exit 3
      ;;
  esac
fi
