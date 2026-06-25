#!/usr/bin/env bash
# Best-effort learning checkpoint capture for the SDLC self-improvement loop.
#
# Can be sourced for `sdlc_capture_emit` or executed directly:
#   scripts/lib-capture.sh emit --source feature-loop --feature my-feature ...

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  set -u
fi

case "${BASH_SOURCE[0]}" in
  */*) SDLC_CAPTURE_SCRIPT_DIR="${BASH_SOURCE[0]%/*}" ;;
  *) SDLC_CAPTURE_SCRIPT_DIR="." ;;
esac
SDLC_CAPTURE_ROOT="$(cd "$SDLC_CAPTURE_SCRIPT_DIR/.." && pwd)"
unset SDLC_CAPTURE_SCRIPT_DIR

sdlc_capture_json_string() {
  local value="${1:-}"
  local controls
  value=${value//\\/\\\\}
  value=${value//\"/\\\"}
  value=${value//$'\n'/ }
  value=${value//$'\r'/ }
  value=${value//$'\t'/ }
  controls=$'\001\002\003\004\005\006\007\010\013\014\016\017\020\021\022\023\024\025\026\027\030\031\032\033\034\035\036\037\177'
  value=${value//[$controls]/}
  printf '%s' "$value"
}

sdlc_capture_json_array() {
  local csv="${1:-}"
  local first=1
  local item
  printf '['
  csv=$(printf '%s' "$csv" | tr ';' ',')
  while IFS= read -r item; do
    item=$(printf '%s' "$item" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -n "$item" ] || continue
    if [ "$first" -eq 0 ]; then
      printf ','
    fi
    first=0
    printf '"%s"' "$(sdlc_capture_json_string "$item")"
  done <<EOF
$(printf '%s' "$csv" | tr ',' '\n')
EOF
  printf ']'
}

sdlc_capture_valid_source() {
  case "$1" in
    claude-hook|codex-capsule|claude-capsule|feature-loop|feature-review|feature-reflect|harness-improve) return 0 ;;
    *) return 1 ;;
  esac
}

sdlc_capture_valid_actor_tool() {
  case "$1" in
    claude-code|codex-cli|codex-app) return 0 ;;
    *) return 1 ;;
  esac
}

sdlc_capture_valid_outcome() {
  case "$1" in
    pass|fail|blocked|oscillation|no-progress) return 0 ;;
    *) return 1 ;;
  esac
}

sdlc_capture_valid_verify_mode() {
  case "$1" in
    fast|unit|full|none) return 0 ;;
    *) return 1 ;;
  esac
}

sdlc_capture_has_value() {
  [ $# -ge 2 ] || return 1
  case "$2" in
    --*) return 1 ;;
    *) return 0 ;;
  esac
}

sdlc_capture_append_file() {
  local tmp="$1"
  local capture_dir="$2"
  local file="$3"

  mkdir -p "$capture_dir" 2>/dev/null || return 0
  if [ -e "$file" ] && [ ! -f "$file" ]; then
    # Refuse special files such as FIFOs instead of risking a blocking append.
    return 0
  fi
  cat "$tmp" >> "$file" 2>/dev/null || true
  return 0
}

sdlc_capture_emit() {
  local source="" feature_slug="global" task_id="" actor_tool="codex-app"
  local actor_model="unknown" outcome="pass" stop_reason="NONE"
  local verify_mode="none" verify_exit="0" lesson_hint=""
  local finding_ids="" ac_ids="" diff_hash="" run_id="" capture_dir=""
  local ts date file tmp task_json diff_json

  while [ $# -gt 0 ]; do
    case "$1" in
      --source) sdlc_capture_has_value "$@" || return 0; source="$2"; shift 2 ;;
      --feature|--feature-slug) sdlc_capture_has_value "$@" || return 0; feature_slug="$2"; shift 2 ;;
      --task|--task-id) sdlc_capture_has_value "$@" || return 0; task_id="$2"; shift 2 ;;
      --actor-tool) sdlc_capture_has_value "$@" || return 0; actor_tool="$2"; shift 2 ;;
      --actor-model) sdlc_capture_has_value "$@" || return 0; actor_model="$2"; shift 2 ;;
      --outcome|--status) sdlc_capture_has_value "$@" || return 0; outcome="$2"; shift 2 ;;
      --stop-reason) sdlc_capture_has_value "$@" || return 0; stop_reason="$2"; shift 2 ;;
      --verify-mode|--mode) sdlc_capture_has_value "$@" || return 0; verify_mode="$2"; shift 2 ;;
      --verify-exit) sdlc_capture_has_value "$@" || return 0; verify_exit="$2"; shift 2 ;;
      --lesson-hint) sdlc_capture_has_value "$@" || return 0; lesson_hint="$2"; shift 2 ;;
      --finding-ids) sdlc_capture_has_value "$@" || return 0; finding_ids="$2"; shift 2 ;;
      --ac-ids) sdlc_capture_has_value "$@" || return 0; ac_ids="$2"; shift 2 ;;
      --diff-hash) sdlc_capture_has_value "$@" || return 0; diff_hash="$2"; shift 2 ;;
      --run-id) sdlc_capture_has_value "$@" || return 0; run_id="$2"; shift 2 ;;
      *)
        # Capture must not fail the host run because of a bad optional argument.
        return 0
        ;;
    esac
  done

  if [ "${SDLC_SELF_IMPROVE_AUTONOMY:-}" = "off" ]; then
    return 0
  fi

  # Load config inside the helper when autonomy is not already pinned to a safe
  # non-structural mode. auto-structural must still pass through load-config so
  # APV-001 and error-budget downgrades are enforced.
  case "${SDLC_SELF_IMPROVE_AUTONOMY:-}" in
    off|capture|distill) skip_config_load=1 ;;
    *) skip_config_load=0 ;;
  esac
  if [ "$skip_config_load" -eq 0 ] && [ -f "$SDLC_CAPTURE_ROOT/scripts/load-config" ]; then
    if [ -z "${SDLC_CONFIG_FILE:-}" ]; then
      export SDLC_CONFIG_FILE="$SDLC_CAPTURE_ROOT/sdlc.config.yml"
    fi
    if [ -z "${SDLC_SELF_IMPROVE_APPROVALS_FILE:-}" ]; then
      export SDLC_SELF_IMPROVE_APPROVALS_FILE="$SDLC_CAPTURE_ROOT/docs/features/continuous-self-improvement-loop/APPROVALS.md"
    fi
    # shellcheck source=load-config
    . "$SDLC_CAPTURE_ROOT/scripts/load-config" >/dev/null 2>&1 || true
  fi

  case "${SDLC_SELF_IMPROVE_AUTONOMY:-capture}" in
    off) return 0 ;;
    capture|distill|auto-structural) ;;
    *) return 0 ;;
  esac

  sdlc_capture_valid_source "$source" || return 0
  sdlc_capture_valid_actor_tool "$actor_tool" || actor_tool="codex-app"
  sdlc_capture_valid_outcome "$outcome" || outcome="fail"
  sdlc_capture_valid_verify_mode "$verify_mode" || verify_mode="none"
  case "$verify_exit" in
    ''|*[!0-9]*) verify_exit=0 ;;
  esac

  ts=$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || printf '1970-01-01T00:00:00Z')
  date=${ts%%T*}
  if [ -z "$run_id" ]; then
    run_id="$source-${feature_slug}-${task_id:-feature}-${ts}-$$"
  fi
  capture_dir="${SDLC_CAPTURE_DIR:-$SDLC_CAPTURE_ROOT/.sdlc/capture}"
  file="$capture_dir/$source-$date.jsonl"
  tmp="${TMPDIR:-/tmp}/sdlc-capture.$$.$RANDOM.tmp"

  if [ -n "$task_id" ]; then
    task_json="\"$(sdlc_capture_json_string "$task_id")\""
  else
    task_json="null"
  fi

  if [ -n "$diff_hash" ]; then
    diff_json="\"$(sdlc_capture_json_string "$diff_hash")\""
  else
    diff_json="null"
  fi

  {
    printf '{'
    printf '"schema_version":"1",'
    printf '"run_id":"%s",' "$(sdlc_capture_json_string "$run_id")"
    printf '"ts":"%s",' "$(sdlc_capture_json_string "$ts")"
    printf '"source":"%s",' "$(sdlc_capture_json_string "$source")"
    printf '"feature_slug":"%s",' "$(sdlc_capture_json_string "$feature_slug")"
    printf '"task_id":%s,' "$task_json"
    printf '"actor_tool":"%s",' "$(sdlc_capture_json_string "$actor_tool")"
    printf '"actor_model":"%s",' "$(sdlc_capture_json_string "$actor_model")"
    printf '"outcome":"%s",' "$(sdlc_capture_json_string "$outcome")"
    printf '"stop_reason":"%s",' "$(sdlc_capture_json_string "$stop_reason")"
    printf '"signal":{'
    printf '"finding_ids":%s,' "$(sdlc_capture_json_array "$finding_ids")"
    printf '"ac_ids":%s,' "$(sdlc_capture_json_array "$ac_ids")"
    printf '"diff_hash":%s,' "$diff_json"
    printf '"verify_mode":"%s",' "$(sdlc_capture_json_string "$verify_mode")"
    printf '"verify_exit":%s' "$verify_exit"
    printf '},'
    printf '"lesson_hint":"%s",' "$(sdlc_capture_json_string "$lesson_hint")"
    printf '"sanitized":false'
    printf '}\n'
  } > "$tmp" 2>/dev/null || {
    rm -f "$tmp" 2>/dev/null || true
    return 0
  }

  sdlc_capture_append_file "$tmp" "$capture_dir" "$file"
  rm -f "$tmp" 2>/dev/null || true
  return 0
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  cmd="${1:-}"
  case "$cmd" in
    emit)
      shift
      sdlc_capture_emit "$@"
      exit 0
      ;;
    -h|--help|'')
      cat <<'EOF'
Usage: scripts/lib-capture.sh emit --source <source> [options]

Sources:
  claude-hook | codex-capsule | claude-capsule | feature-loop | feature-review | feature-reflect | harness-improve

Options:
  --feature <slug> --task <TASK-###> --actor-tool <tool> --actor-model <model>
  --outcome <pass|fail|blocked|oscillation|no-progress>
  --stop-reason <reason> --verify-mode <fast|unit|full|none> --verify-exit <n>
  --lesson-hint <text> --finding-ids <csv> --ac-ids <csv> --diff-hash <hash>

Capture is best-effort. `emit` always exits 0 and never fails the host run.
EOF
      exit 0
      ;;
    *)
      # Unknown commands are treated like capture failures: non-fatal.
      exit 0
      ;;
  esac
fi
