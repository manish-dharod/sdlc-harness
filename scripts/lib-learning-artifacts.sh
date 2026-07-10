#!/usr/bin/env bash
# Shared fail-closed helpers for scripts/feature-learn and
# scripts/feature-reflect. This file defines functions only.

SDLC_LEARNING_MAX_SOURCE_BYTES=2097152
SDLC_LEARNING_MAX_INCLUDED_BYTES=2097152
SDLC_LEARNING_MAX_CAPTURE_BYTES=4194304
SDLC_REFLECT_MAX_BUNDLE_BYTES=8388608

sdlc_learning_validate_slug() {
  local slug="$1"
  if ! [[ "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]]; then
    printf '%s: feature slug must be canonical lower-kebab-case\n' "$2" >&2
    return 1
  fi
}

sdlc_learning_validate_task_id() {
  local task_id="$1"
  [ -z "$task_id" ] && return 0
  if ! [[ "$task_id" =~ ^[A-Z][A-Z0-9]*-[0-9]{3,}[a-z]?$ ]]; then
    printf '%s: task ID must use an uppercase alphanumeric prefix, a dash, at least three digits, and at most one lowercase suffix letter\n' "$2" >&2
    return 1
  fi
}

# Resolve the durable source that exists for a run kind at each tier. Explicit
# path arguments remain supported and fail closed when missing.
sdlc_learning_resolve_source() {
  local tier="$1"
  local feature_dir="$2"
  local purpose="$3"
  case "$tier:$purpose" in
    small:feature-review|small:feature-verify|small:feature-orchestrate|small:feature-loop)
      printf '%s/FEATURE.md\n' "$feature_dir"
      ;;
    medium:feature-review|medium:feature-verify|medium:feature-orchestrate|medium:feature-loop)
      printf '%s/EVIDENCE.md\n' "$feature_dir"
      ;;
    large:feature-review)
      printf '%s/FINDINGS.md\n' "$feature_dir"
      ;;
    large:feature-loop)
      printf '%s/RUNS.md\n' "$feature_dir"
      ;;
    large:feature-verify|large:feature-orchestrate)
      printf '%s/EVIDENCE.md\n' "$feature_dir"
      ;;
    *)
      return 1
      ;;
  esac
}

sdlc_learning_realpath() {
  python3 - "$1" <<'PY'
import os
import sys
print(os.path.realpath(sys.argv[1]))
PY
}

sdlc_learning_validate_feature_dir() {
  local root_real="$1"
  local feature_dir="$2"
  local caller="$3"
  local feature_real

  if [ -L "$feature_dir" ] || [ ! -d "$feature_dir" ]; then
    printf '%s: feature not found or not a real directory: %s\n' "$caller" "$feature_dir" >&2
    return 1
  fi
  feature_real=$(sdlc_learning_realpath "$feature_dir") || return 1
  case "$feature_real" in
    "$root_real"/docs/features/*) ;;
    *)
      printf '%s: feature directory resolves outside docs/features: %s\n' "$caller" "$feature_dir" >&2
      return 1
      ;;
  esac
  printf '%s\n' "$feature_real"
}

# Validate file identity/containment independently from how much of its content
# a prompt will consume. Append-only evidence may be much larger than the
# bounded tail that is safe to materialize.
# Arguments: caller label path allowed-root.
sdlc_learning_validate_file_path() {
  local caller="$1"
  local label="$2"
  local path="$3"
  local allowed_root="$4"
  local resolved

  if [ -L "$path" ] || [ ! -f "$path" ] || [ ! -r "$path" ]; then
    printf '%s: %s must be a readable, non-symlink regular file: %s\n' \
      "$caller" "$label" "$path" >&2
    return 1
  fi

  resolved=$(sdlc_learning_realpath "$path") || return 1
  case "$resolved" in
    "$allowed_root"/*) ;;
    *)
      printf '%s: %s resolves outside its allowed root: %s\n' \
        "$caller" "$label" "$path" >&2
      return 1
      ;;
  esac

  printf '%s\n' "$resolved"
}

# Materialize exactly the validated text slice a prompt will consume.
# Arguments: caller label path allowed-root max-bytes tail-lines output-path.
# tail-lines=0 means a bounded whole file. A positive value reverse-reads only
# enough bytes to return the last N complete lines. A single required line that
# exceeds max-bytes fails closed rather than being cut at an arbitrary byte or
# UTF-8 boundary.
sdlc_learning_materialize_text_slice() {
  local caller="$1"
  local label="$2"
  local path="$3"
  local allowed_root="$4"
  local max_bytes="$5"
  local tail_lines="$6"
  local output_path="$7"
  local resolved

  case "$max_bytes:$tail_lines" in
    *[!0-9:]*|:*|*:)
      printf '%s: invalid slice bounds for %s\n' "$caller" "$label" >&2
      return 1
      ;;
  esac
  if [ "$max_bytes" -le 0 ] || [ "$tail_lines" -lt 0 ]; then
    printf '%s: invalid slice bounds for %s\n' "$caller" "$label" >&2
    return 1
  fi

  if ! resolved=$(sdlc_learning_validate_file_path \
    "$caller" "$label" "$path" "$allowed_root"); then
    return 1
  fi

  if ! python3 - "$resolved" "$output_path" "$max_bytes" "$tail_lines" <<'PY'
import os
import stat
import sys

source, output, max_raw, tail_raw = sys.argv[1:]
max_bytes = int(max_raw)
tail_lines = int(tail_raw)

flags = os.O_RDONLY
if hasattr(os, "O_NOFOLLOW"):
    flags |= os.O_NOFOLLOW

fd = None
try:
    fd = os.open(source, flags)
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode):
        raise ValueError("not a regular file")

    if tail_lines == 0:
        if info.st_size > max_bytes:
            raise ValueError("whole-file slice exceeds bound")
        chunks = []
        remaining = info.st_size
        while remaining:
            chunk = os.read(fd, min(65536, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        data = b"".join(chunks)
        if len(data) != info.st_size:
            raise OSError("short read")
    else:
        position = info.st_size
        data = b""
        selected = None
        ends_with_newline = False

        while position > 0:
            remaining_capacity = max_bytes + 1 - len(data)
            if remaining_capacity <= 0:
                raise ValueError("required tail exceeds bound")
            read_size = min(65536, position, remaining_capacity)
            position -= read_size
            os.lseek(fd, position, os.SEEK_SET)
            chunk = os.read(fd, read_size)
            if len(chunk) != read_size:
                raise OSError("short reverse read")
            data = chunk + data

            if info.st_size and len(data) == read_size:
                ends_with_newline = data.endswith(b"\n")
            required = tail_lines + (1 if ends_with_newline else 0)
            if data.count(b"\n") >= required:
                cut = len(data)
                for _ in range(required):
                    cut = data.rfind(b"\n", 0, cut)
                selected = data[cut + 1:]
                break

        if selected is None:
            if position == 0:
                selected = data
            else:
                raise ValueError("required tail exceeds bound")
        data = selected
        if len(data) > max_bytes:
            raise ValueError("required tail exceeds bound")

    if b"\x00" in data:
        raise ValueError("NUL byte in consumed slice")
    data.decode("utf-8")
    with open(output, "wb") as target:
        target.write(data)
except (OSError, UnicodeDecodeError, ValueError):
    try:
        os.unlink(output)
    except OSError:
        pass
    raise SystemExit(1)
finally:
    if fd is not None:
        os.close(fd)
PY
  then
    printf '%s: %s consumed slice must fit the %s-byte bound and be UTF-8 text without NUL bytes: %s\n' \
      "$caller" "$label" "$max_bytes" "$path" >&2
    return 1
  fi

  printf '%s\n' "$resolved"
}

# Validate a non-prompt text file in a streaming pass. This is used when the
# learning ledger is copied for an atomic append; it deliberately has no
# prompt-slice byte ceiling and never loads the whole file in memory.
sdlc_learning_validate_utf8_stream() {
  local caller="$1"
  local label="$2"
  local path="$3"
  local allowed_root="$4"
  local resolved

  if ! resolved=$(sdlc_learning_validate_file_path \
    "$caller" "$label" "$path" "$allowed_root"); then
    return 1
  fi

  if ! python3 - "$resolved" <<'PY'
import codecs
import sys

try:
    decoder = codecs.getincrementaldecoder("utf-8")()
    with open(sys.argv[1], "rb") as source:
        while True:
            chunk = source.read(65536)
            if not chunk:
                break
            if b"\x00" in chunk:
                raise ValueError("NUL byte")
            decoder.decode(chunk)
        decoder.decode(b"", final=True)
except (OSError, UnicodeDecodeError, ValueError):
    raise SystemExit(1)
PY
  then
    printf '%s: %s must be UTF-8 text without NUL bytes: %s\n' \
      "$caller" "$label" "$path" >&2
    return 1
  fi

  printf '%s\n' "$resolved"
}

sdlc_learning_validate_output_size() {
  local caller="$1"
  local label="$2"
  local path="$3"
  local max_bytes="$4"
  local bytes
  bytes=$(wc -c < "$path" | tr -d '[:space:]')
  if [ -z "$bytes" ] || [ "$bytes" -gt "$max_bytes" ]; then
    printf '%s: assembled %s exceeds the %s-byte bound\n' \
      "$caller" "$label" "$max_bytes" >&2
    return 1
  fi
}

# Create or validate a direct output directory without following a symlink out
# of the feature. Callers still publish through their repo-relative path so
# durable ledger entries remain portable across clones.
sdlc_learning_prepare_output_dir() {
  local caller="$1"
  local label="$2"
  local path="$3"
  local allowed_root="$4"
  local resolved

  if [ -L "$path" ] || { [ -e "$path" ] && [ ! -d "$path" ]; }; then
    printf '%s: %s must be a real directory inside the feature: %s\n' \
      "$caller" "$label" "$path" >&2
    return 1
  fi
  if ! mkdir -p "$path"; then
    printf '%s: failed to create %s: %s\n' "$caller" "$label" "$path" >&2
    return 1
  fi
  if [ -L "$path" ] || [ ! -d "$path" ]; then
    printf '%s: %s must remain a real directory: %s\n' \
      "$caller" "$label" "$path" >&2
    return 1
  fi
  resolved=$(sdlc_learning_realpath "$path") || return 1
  case "$resolved" in
    "$allowed_root"/*) ;;
    *)
      printf '%s: %s resolves outside the feature: %s\n' \
        "$caller" "$label" "$path" >&2
      return 1
      ;;
  esac
  printf '%s\n' "$resolved"
}

sdlc_learning_dirty_state() {
  local repo_root="$1"
  if [ -n "$(git -C "$repo_root" status --porcelain --untracked-files=normal -- . 2>/dev/null)" ]; then
    printf 'yes\n'
  else
    printf 'no\n'
  fi
}

# Publish a complete same-filesystem staging file under a collision-resistant
# name. Callers that share a ledger must hold their feature lock first.
# Prints the final path on success.
sdlc_learning_atomic_publish() {
  local caller="$1"
  local source_file="$2"
  local out_dir="$3"
  local stem="$4"
  local suffix="$5"
  local stage token final

  stage=$(mktemp "$out_dir/.sdlc-artifact-stage.XXXXXX") || {
    printf '%s: failed to create same-filesystem staging file\n' "$caller" >&2
    return 1
  }
  if ! COPYFILE_DISABLE=1 cp "$source_file" "$stage"; then
    rm -f "$stage"
    printf '%s: failed to stage artifact\n' "$caller" >&2
    return 1
  fi
  token=${stage##*.}
  final="$out_dir/${stem}.${token}.${suffix}"
  if [ -e "$final" ] || [ -L "$final" ]; then
    rm -f "$stage"
    printf '%s: refusing to replace existing artifact: %s\n' "$caller" "$final" >&2
    return 1
  fi
  if ! COPYFILE_DISABLE=1 mv "$stage" "$final"; then
    rm -f "$stage"
    printf '%s: failed to publish artifact\n' "$caller" >&2
    return 1
  fi
  # External macOS volumes may synthesize AppleDouble companions even when
  # COPYFILE_DISABLE is set. They are transport metadata, never SDLC input.
  rm -f "$out_dir/._$(basename "$stage")" "$out_dir/._$(basename "$final")"
  printf '%s\n' "$final"
}

sdlc_learning_lock_acquire() {
  local caller="$1"
  local repo_root="$2"
  local feature_key="$3"
  local common_raw common_candidate common_real lock_parent
  local digest lock_dir attempts

  if ! common_raw=$(git -C "$repo_root" rev-parse --git-common-dir 2>/dev/null); then
    printf '%s: could not resolve the repository common Git directory\n' "$caller" >&2
    return 1
  fi
  case "$common_raw" in
    /*) common_candidate="$common_raw" ;;
    *) common_candidate="$repo_root/$common_raw" ;;
  esac
  common_real=$(sdlc_learning_realpath "$common_candidate") || return 1
  if [ ! -d "$common_real" ] || [ ! -w "$common_real" ]; then
    printf '%s: repository common Git directory is not writable\n' "$caller" >&2
    return 1
  fi

  # The common Git directory is shared by every linked worktree and does not
  # vary with a caller's TMPDIR. Keep coordination metadata private and outside
  # the tracked tree; the empty parent may persist safely between sessions.
  lock_parent="$common_real/sdlc-learning-locks"
  if [ -L "$lock_parent" ]; then
    printf '%s: refusing symlinked learning lock parent\n' "$caller" >&2
    return 1
  fi
  if [ ! -d "$lock_parent" ]; then
    if ! (umask 077 && mkdir "$lock_parent") 2>/dev/null && \
       { [ -L "$lock_parent" ] || [ ! -d "$lock_parent" ]; }; then
      printf '%s: failed to create the private learning lock parent\n' "$caller" >&2
      return 1
    fi
  fi
  if [ -L "$lock_parent" ] || [ ! -d "$lock_parent" ] || [ ! -w "$lock_parent" ]; then
    printf '%s: learning lock parent is not a writable real directory\n' "$caller" >&2
    return 1
  fi
  chmod 700 "$lock_parent" 2>/dev/null || {
    printf '%s: failed to secure the learning lock parent\n' "$caller" >&2
    return 1
  }

  digest=$(printf '%s\n%s\n' "$common_real" "$feature_key" | \
    shasum -a 256 | awk '{print substr($1,1,20)}')
  lock_dir="$lock_parent/feature-${digest}.lock"
  attempts=0
  while ! (umask 077 && mkdir "$lock_dir") 2>/dev/null; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 200 ]; then
      printf '%s: timed out waiting for the feature learning ledger lock\n' "$caller" >&2
      return 1
    fi
    sleep 0.05
  done
  printf '%s\n' "$lock_dir"
}
