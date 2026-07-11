#!/usr/bin/env python3
"""Committed task-scope and canonical review-diff primitives.

Every input that can authorize a review is read from Git objects.  The current
checkout is used only to locate the repository and object database; task
ledgers, ownership paths, snapshots, and repository attributes come from the
candidate commit.
"""

from __future__ import annotations

import datetime as dt
import fnmatch
import hashlib
import json
import os
from pathlib import PurePosixPath
import re
import selectors
import subprocess
import sys
import time
from typing import NoReturn


ROOT = os.path.realpath(os.path.join(os.path.dirname(__file__), ".."))
BOOKKEEPING_RE = re.compile(
    r"^docs/features/(?P<slug>[A-Za-z0-9_][A-Za-z0-9._-]*)/"
    r"(?:review-receipts/[^/]+\.json|"
    r"(?:adversary|security)/[^/]+(?:\.md|\.attempt\.json))$"
)
SLUG_RE = re.compile(r"[A-Za-z0-9_][A-Za-z0-9._-]*")
TASK_RE = re.compile(r"[A-Za-z0-9_][A-Za-z0-9._-]*")
MAX_TASK_METADATA_BYTES = 1_048_576
MAX_CANONICAL_DIFF_BYTES = 280_000
MAX_SCOPE_PATHS = 512
MAX_SCOPE_SERIALIZED_BYTES = 262_144
MAX_SNAPSHOT_LINES = 800
MAX_SNAPSHOT_BYTES = 90_000
MAX_TREE_BYTES = 16_777_216
MAX_TREE_ENTRIES = 100_000
MAX_CHANGED_PATH_BYTES = 1_048_576
MAX_CHANGED_PATHS = 4_096
MAX_HISTORY_BYTES = 1_048_576
MAX_HISTORY_COMMITS = 4_096
MAX_GIT_STDERR_BYTES = 65_536
GIT_HELPER_TIMEOUT_SECONDS = 60
SCOPED_BASE_CUTOFF = dt.datetime(2026, 7, 10, 20, 19, tzinfo=dt.timezone.utc)


class ScopeError(RuntimeError):
    pass


def fail(message: str, code: int = 3) -> NoReturn:
    print(f"review-attempt: {message}", file=sys.stderr)
    raise SystemExit(code)


def git_env(candidate: str | None = None) -> dict[str, str]:
    redirected = {
        "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_COMMON_DIR",
        "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES",
        "GIT_SHALLOW_FILE", "GIT_NAMESPACE",
    }
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("GIT_CONFIG_")
        and key not in redirected
        and key not in {"GIT_EXTERNAL_DIFF", "GIT_DIFF_OPTS", "GIT_PAGER"}
    }
    env.update(
        {
            "GIT_CONFIG_GLOBAL": os.devnull,
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_ATTR_NOSYSTEM": "1",
            "GIT_LITERAL_PATHSPECS": "1",
            "GIT_NO_REPLACE_OBJECTS": "1",
            "GIT_PAGER": "cat",
            "LC_ALL": "C",
        }
    )
    if candidate:
        # Git 2.42+ reads repository .gitattributes from this committed tree,
        # never from a newer/dirty checkout.
        env["GIT_ATTR_SOURCE"] = candidate
    return env


def git(
    args: list[str],
    *,
    candidate_attrs: str | None = None,
    check: bool = True,
) -> bytes:
    proc = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        env=git_env(candidate_attrs),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if check and proc.returncode:
        detail = proc.stderr.decode("utf-8", "replace").strip()
        raise ScopeError(detail or f"git {' '.join(args)} failed")
    return proc.stdout


def git_bounded(
    args: list[str],
    *,
    stdout_limit: int,
    stdout_label: str,
    candidate_attrs: str | None = None,
    stderr_limit: int = MAX_GIT_STDERR_BYTES,
    timeout: int = GIT_HELPER_TIMEOUT_SECONDS,
) -> bytes:
    """Run Git while concurrently draining and bounding both output pipes."""
    proc = subprocess.Popen(
        ["git", *args],
        cwd=ROOT,
        env=git_env(candidate_attrs),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    assert proc.stdout is not None and proc.stderr is not None
    selector = selectors.DefaultSelector()
    selector.register(proc.stdout, selectors.EVENT_READ, ("stdout", stdout_limit))
    selector.register(proc.stderr, selectors.EVENT_READ, ("stderr", stderr_limit))
    buffers = {"stdout": bytearray(), "stderr": bytearray()}
    overflow: tuple[str, int] | None = None
    deadline = time.monotonic() + timeout
    try:
        while selector.get_map():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise ScopeError(f"git helper timed out after {timeout}s")
            events = selector.select(min(remaining, 1.0))
            if not events:
                if proc.poll() is not None:
                    # A final non-blocking select drains EOF on both pipes.
                    continue
                continue
            for key, _mask in events:
                stream_name, limit = key.data
                chunk = os.read(key.fd, 65_536)
                if not chunk:
                    selector.unregister(key.fileobj)
                    continue
                target = buffers[stream_name]
                available = max(0, limit + 1 - len(target))
                target.extend(chunk[:available])
                if len(target) > limit:
                    overflow = (stream_name, limit)
                    raise ScopeError(
                        f"{stdout_label if stream_name == 'stdout' else 'git stderr'} exceeds hard {limit} byte limit"
                    )
        return_code = proc.wait(timeout=2)
    except (ScopeError, subprocess.TimeoutExpired):
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        raise
    finally:
        selector.close()
    if return_code:
        detail = bytes(buffers["stderr"]).decode("utf-8", "replace").strip()
        raise ScopeError(detail or f"git {' '.join(args)} failed")
    if overflow:
        # Defensive only: overflow exits through the exception path above.
        raise ScopeError(f"{overflow[0]} exceeds hard {overflow[1]} byte limit")
    return bytes(buffers["stdout"])


def require_commit(value: str, label: str) -> str:
    if not re.fullmatch(r"[0-9a-fA-F]{4,64}", value):
        raise ScopeError(f"invalid {label} commit: {value}")
    proc = subprocess.run(
        ["git", "rev-parse", "--verify", f"{value}^{{commit}}"],
        cwd=ROOT,
        env=git_env(),
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if proc.returncode:
        raise ScopeError(f"invalid {label} commit: {value}")
    return proc.stdout.decode("ascii").strip()


def blob_text(commit: str, path: str, *, required: bool = True) -> str | None:
    size_proc = subprocess.run(
        ["git", "cat-file", "-s", f"{commit}:{path}"],
        cwd=ROOT,
        env=git_env(commit),
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if size_proc.returncode:
        if required:
            raise ScopeError(f"candidate is missing committed task ledger {path}")
        return None
    try:
        size = int(size_proc.stdout.decode("ascii").strip())
    except ValueError as exc:
        raise ScopeError(f"could not determine committed task metadata size: {path}") from exc
    if size > MAX_TASK_METADATA_BYTES:
        raise ScopeError(
            f"committed task metadata exceeds {MAX_TASK_METADATA_BYTES} byte limit: {path} ({size} bytes)"
        )
    proc = subprocess.run(
        ["git", "cat-file", "-p", f"{commit}:{path}"],
        cwd=ROOT,
        env=git_env(commit),
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    if proc.returncode:
        if required:
            raise ScopeError(f"candidate is missing committed task ledger {path}")
        return None
    try:
        return proc.stdout.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ScopeError(f"committed task ledger is not UTF-8: {path}") from exc


def tree_entries(commit: str) -> dict[str, tuple[str, str, str]]:
    raw = git_bounded(
        ["ls-tree", "-rz", "--full-tree", commit],
        stdout_limit=MAX_TREE_BYTES,
        stdout_label="candidate tree",
        candidate_attrs=commit,
    )
    entries: dict[str, tuple[str, str, str]] = {}
    for record in raw.split(b"\0"):
        if not record:
            continue
        meta, raw_path = record.split(b"\t", 1)
        mode, kind, oid = meta.decode("ascii").split(" ", 2)
        path = raw_path.decode("utf-8", "surrogateescape")
        if any(ord(char) < 32 or ord(char) == 127 for char in path):
            raise ScopeError("candidate tree contains a control character in a scoped path")
        entries[path] = (mode, kind, oid)
        if len(entries) > MAX_TREE_ENTRIES:
            raise ScopeError(f"candidate tree exceeds hard {MAX_TREE_ENTRIES} entry limit")
    return entries


def normalize_declaration(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value.startswith("`") and value.endswith("`"):
        value = value[1:-1].strip()
    if not value:
        raise ScopeError("empty Intended file ownership entry")
    if "`" in value or "\\" in value:
        raise ScopeError(f"unsafe ownership path syntax: {value}")
    if value.startswith(("/", "~", ":")) or re.match(r"^[A-Za-z]:", value):
        raise ScopeError(f"ownership path must be repository-relative: {value}")
    if value.startswith("./") or value.endswith("/./"):
        raise ScopeError(f"ownership path is not normalized: {value}")
    if "//" in value or any(part in {"", ".", ".."} for part in value.rstrip("/").split("/")):
        raise ScopeError(f"ownership path contains traversal or an empty component: {value}")
    if any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ScopeError("ownership path contains a control character")
    if "${" in value or "$(" in value or value.startswith("-:"):
        raise ScopeError(f"unsafe ownership path syntax: {value}")
    # PurePosixPath is a final platform-independent traversal check.
    if ".." in PurePosixPath(value.rstrip("/")).parts:
        raise ScopeError(f"ownership path contains traversal: {value}")
    return value


def task_ledger(candidate: str, slug: str) -> tuple[str, str]:
    tier_path = f"docs/features/{slug}/.tier"
    tier = blob_text(candidate, tier_path, required=False)
    tier = tier.strip() if tier else "large"
    if tier not in {"small", "medium", "large"}:
        raise ScopeError(f"candidate has invalid tier for {slug}: {tier}")
    ledger = f"docs/features/{slug}/{'FEATURE.md' if tier == 'small' else 'TASKS.md'}"
    return ledger, blob_text(candidate, ledger) or ""


def candidate_config_value(candidate: str, key: str) -> str:
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
        raise ScopeError(f"invalid candidate config key: {key}")
    text = blob_text(candidate, "sdlc.config.yml", required=False)
    if text is None:
        return ""
    matches: list[str] = []
    pattern = re.compile(rf"^{re.escape(key)}:[ \t]*(.*?)[ \t]*$")
    for line in text.splitlines():
        match = pattern.fullmatch(line)
        if match:
            value = match.group(1).strip()
            if value == "|":
                raise ScopeError(f"candidate config key must be a scalar: {key}")
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            matches.append(value)
    if len(matches) > 1:
        raise ScopeError(f"candidate config has duplicate key: {key}")
    return matches[0] if matches else ""


def task_block_and_ownership(candidate: str, slug: str, task_id: str) -> tuple[str, str, list[str]]:
    ledger_path, ledger = task_ledger(candidate, slug)
    lines = ledger.splitlines()
    starts = [
        index
        for index, line in enumerate(lines)
        if line.startswith("### ") and line[4:].split(":", 1)[0].strip() == task_id
    ]
    if not starts:
        raise ScopeError(f"task not found in candidate {ledger_path}: {task_id}")
    if len(starts) != 1:
        raise ScopeError(f"candidate task ledger has duplicate task headings: {task_id}")
    start = starts[0]
    end = len(lines)
    for index in range(start + 1, len(lines)):
        if lines[index].startswith("### "):
            end = index
            break
    block = lines[start:end]

    declarations: list[str] = []
    in_ownership = False
    for line in block:
        if line == "- Intended file ownership:":
            if in_ownership:
                raise ScopeError(f"task has duplicate Intended file ownership lists: {task_id}")
            in_ownership = True
            continue
        if in_ownership and line.startswith("- "):
            break
        if in_ownership and line.startswith("  - "):
            declarations.append(normalize_declaration(line[4:]))
    if not declarations:
        raise ScopeError(f"task has no Intended file ownership entries: {task_id}")
    if len(declarations) != len(set(declarations)):
        raise ScopeError(f"task has duplicate normalized ownership entries: {task_id}")
    return ledger_path, "\n".join(block) + "\n", declarations


def block_field(block: str, label: str, *, required: bool = False) -> str:
    prefix = f"- {label}:"
    values = [line[len(prefix):].strip() for line in block.splitlines() if line.startswith(prefix)]
    if len(values) > 1:
        raise ScopeError(f"task block has duplicate {label} fields")
    if required and (not values or not values[0]):
        raise ScopeError(f"task block is missing {label}")
    return values[0] if values else ""


def claimed_at_utc(block: str) -> dt.datetime | None:
    raw = block_field(block, "Claimed at")
    if not raw:
        return None
    match = re.fullmatch(r"(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?[ ]*(Z|UTC|PDT|PST)", raw)
    if not match:
        raise ScopeError(f"task has invalid Claimed at timestamp: {raw}")
    zone = {
        "Z": dt.timezone.utc,
        "UTC": dt.timezone.utc,
        "PDT": dt.timezone(dt.timedelta(hours=-7)),
        "PST": dt.timezone(dt.timedelta(hours=-8)),
    }[match.group(3)]
    parsed = dt.datetime.strptime(
        f"{match.group(1)} {match.group(2)}", "%Y-%m-%d %H:%M"
    ).replace(tzinfo=zone)
    return parsed.astimezone(dt.timezone.utc)


def task_block_if_present(candidate: str, slug: str, task_id: str) -> tuple[str, str] | None:
    try:
        ledger_path, block, _ownership = task_block_and_ownership(candidate, slug, task_id)
    except ScopeError as exc:
        if "task not found" in str(exc) or "missing committed task ledger" in str(exc):
            return None
        raise
    return ledger_path, block


def task_review_base(slug: str, task_id: str, integration_base: str, candidate: str) -> str:
    """Return an independently derived claim base, or ``legacy`` pre-cutoff."""
    integration_base = require_commit(integration_base, "integration base")
    candidate = require_commit(candidate, "candidate")
    if subprocess.run(
        ["git", "merge-base", "--is-ancestor", integration_base, candidate],
        cwd=ROOT,
        env=git_env(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    ).returncode:
        raise ScopeError("integration base is not an ancestor of candidate")
    if task_id == "feature":
        return integration_base

    current = task_block_if_present(candidate, slug, task_id)
    if current is None:
        raise ScopeError(f"task not found in candidate ledger: {task_id}")
    ledger_path, current_block = current
    current_claimed_at = claimed_at_utc(current_block)

    history_raw = git_bounded(
        ["rev-list", "--ancestry-path", "--reverse", "--topo-order", f"{integration_base}..{candidate}"],
        stdout_limit=MAX_HISTORY_BYTES,
        stdout_label="claim history",
    )
    commits = [line.decode("ascii") for line in history_raw.splitlines() if line]
    if len(commits) > MAX_HISTORY_COMMITS:
        raise ScopeError(f"claim history exceeds hard {MAX_HISTORY_COMMITS} commit limit")

    for commit in commits:
        at_commit = task_block_if_present(commit, slug, task_id)
        if at_commit is None:
            continue
        _commit_ledger, block = at_commit
        if block_field(block, "Status", required=True) != "Claimed":
            continue
        parent_raw = git_bounded(
            ["rev-list", "--parents", "-n", "1", commit],
            stdout_limit=512,
            stdout_label="claim parent list",
        ).decode("ascii").split()
        if len(parent_raw) != 2:
            raise ScopeError("task claim must be a dedicated non-merge commit")
        parent = parent_raw[1]
        before = task_block_if_present(parent, slug, task_id)
        if before is not None and block_field(before[1], "Status", required=True) == "Claimed":
            continue
        claim_paths = changed_paths(parent, commit)
        allowed = {ledger_path, f"docs/features/{slug}/STATE.md"}
        outside = [path for path in claim_paths if path not in allowed]
        if outside:
            raise ScopeError(
                "task claim commit contains implementation changes; claim separately before review: "
                + ", ".join(outside)
            )
        return commit

    if current_claimed_at is None or current_claimed_at < SCOPED_BASE_CUTOFF:
        return "legacy"
    raise ScopeError(
        "post-cutoff task has no independently derivable dedicated claim commit; "
        "claim the task before implementation"
    )


def matches(path: str, declaration: str) -> bool:
    if any(char in declaration for char in "*?["):
        # Git trees expose blobs, not directory entries.  Preserve the slash
        # boundary while letting a globbed directory declaration authorize its
        # descendants; do not broaden `foo-*/` into the sibling prefix `foo-*`.
        pattern = declaration + "*" if declaration.endswith("/") else declaration
        return fnmatch.fnmatchcase(path, pattern)
    if declaration.endswith("/"):
        return path.startswith(declaration)
    return path == declaration or path.startswith(declaration + "/")


def is_bookkeeping(path: str, slug: str) -> bool:
    match = BOOKKEEPING_RE.fullmatch(path)
    return bool(match and match.group("slug") == slug)


def changed_paths(base: str, candidate: str) -> list[str]:
    raw = git_bounded(
        ["diff", "--name-only", "-z", "--no-renames", base, candidate, "--", "."],
        stdout_limit=MAX_CHANGED_PATH_BYTES,
        stdout_label="changed-path list",
        candidate_attrs=candidate,
    )
    paths = [item.decode("utf-8", "surrogateescape") for item in raw.split(b"\0") if item]
    if len(paths) > MAX_CHANGED_PATHS:
        raise ScopeError(f"changed-path list exceeds hard {MAX_CHANGED_PATHS} path limit")
    if any(any(ord(char) < 32 or ord(char) == 127 for char in path) for path in paths):
        raise ScopeError("changed path contains a control character")
    return sorted(set(paths))


def resolve_scope(slug: str, task_id: str, base: str, candidate: str) -> dict[str, object]:
    if not SLUG_RE.fullmatch(slug):
        raise ScopeError(f"invalid feature slug: {slug}")
    if not TASK_RE.fullmatch(task_id):
        raise ScopeError(f"invalid task id: {task_id}")
    assert_info_grafts_empty()
    base = require_commit(base, "base")
    candidate = require_commit(candidate, "candidate")
    if subprocess.run(
        ["git", "merge-base", "--is-ancestor", base, candidate],
        cwd=ROOT,
        env=git_env(),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    ).returncode:
        raise ScopeError("review base is not an ancestor of candidate")

    if task_id == "feature":
        changed = [path for path in changed_paths(base, candidate) if not is_bookkeeping(path, slug)]
        if not changed:
            raise ScopeError("feature-scoped review contains no committed change")
        base_entries = tree_entries(base)
        candidate_entries = tree_entries(candidate)
        scope_entries = []
        for path in changed:
            if path in candidate_entries:
                mode, kind, oid = candidate_entries[path]
                scope_entries.append({"path": path, "state": "candidate", "mode": mode, "type": kind, "oid": oid})
            else:
                mode, kind, oid = base_entries[path]
                scope_entries.append({"path": path, "state": "deleted", "base_mode": mode, "base_type": kind, "base_oid": oid})
        payload = {
            "feature": slug,
            "task_id": task_id,
            "ledger_path": "",
            "ownership": [],
            "scope_paths": changed,
            "scope_entries": scope_entries,
        }
        scope_bytes = json.dumps(
            payload, ensure_ascii=True, sort_keys=True, separators=(",", ":")
        ).encode("ascii")
        if len(changed) > MAX_SCOPE_PATHS or len(scope_bytes) > MAX_SCOPE_SERIALIZED_BYTES:
            raise ScopeError("feature scope exceeds hard path/serialized-byte bounds")
        return {
            **payload,
            "task_block": "",
            "changed_paths": changed,
            "scope_hash": hashlib.sha256(scope_bytes).hexdigest(),
            "base_sha": base,
            "candidate_sha": candidate,
        }

    ledger_path, block, declarations = task_block_and_ownership(candidate, slug, task_id)
    base_entries = tree_entries(base)
    candidate_entries = tree_entries(candidate)
    all_paths = sorted(set(base_entries) | set(candidate_entries))
    resolved: set[str] = set()
    for declaration in declarations:
        found = False
        for path in all_paths:
            if not matches(path, declaration):
                continue
            found = True
            entry = candidate_entries.get(path) or base_entries.get(path)
            if not entry:
                raise ScopeError(f"could not resolve committed scope path: {path}")
            mode, kind, _oid = entry
            if mode in {"120000", "160000"} or kind != "blob":
                raise ScopeError(f"ownership resolves to unsafe symlink/gitlink path: {path}")
            resolved.add(path)
            if len(resolved) > MAX_SCOPE_PATHS:
                raise ScopeError(f"resolved task scope exceeds hard {MAX_SCOPE_PATHS} path limit")
        if not found:
            raise ScopeError(f"ownership entry resolves to no committed path: {declaration}")

    changed = changed_paths(base, candidate)
    substantive = [path for path in changed if not is_bookkeeping(path, slug)]
    owned_changed = [path for path in substantive if path in resolved]
    outside = [path for path in substantive if path not in resolved]
    if outside:
        raise ScopeError(
            "committed candidate changes path(s) outside declared task scope: "
            + ", ".join(outside)
        )
    if not owned_changed:
        raise ScopeError("task-scoped review contains no owned committed change")

    scope_paths = sorted(resolved)
    scope_entries = []
    for path in scope_paths:
        if path in candidate_entries:
            mode, kind, oid = candidate_entries[path]
            scope_entries.append({"path": path, "state": "candidate", "mode": mode, "type": kind, "oid": oid})
        else:
            mode, kind, oid = base_entries[path]
            scope_entries.append({"path": path, "state": "deleted", "base_mode": mode, "base_type": kind, "base_oid": oid})
    scope_payload = {
        "feature": slug,
        "task_id": task_id,
        "ledger_path": ledger_path,
        "ownership": declarations,
        "scope_paths": scope_paths,
        "scope_entries": scope_entries,
    }
    scope_bytes = json.dumps(
        scope_payload, ensure_ascii=True, sort_keys=True, separators=(",", ":")
    ).encode("ascii")
    if len(scope_bytes) > MAX_SCOPE_SERIALIZED_BYTES:
        raise ScopeError(
            f"resolved task scope exceeds hard {MAX_SCOPE_SERIALIZED_BYTES} serialized-byte limit"
        )
    return {
        **scope_payload,
        "task_block": block,
        "changed_paths": owned_changed,
        "scope_hash": hashlib.sha256(scope_bytes).hexdigest(),
        "base_sha": base,
        "candidate_sha": candidate,
    }


def dirty_scope(slug: str, task_id: str, base: str, candidate: str) -> list[tuple[str, str]]:
    scope = resolve_scope(slug, task_id, base, candidate)
    ownership = list(scope["ownership"])
    scope_paths = set(scope["scope_paths"])
    ledger_path = str(scope["ledger_path"])

    def paths_for(args: list[str]) -> list[str]:
        raw = git(args)
        return [item.decode("utf-8", "surrogateescape") for item in raw.split(b"\0") if item]

    states: list[tuple[str, str]] = []
    for label, args in (
        ("staged", ["diff", "--cached", "--name-only", "-z", "--no-renames", "--"]),
        ("unstaged", ["diff", "--name-only", "-z", "--no-renames", "--"]),
        ("untracked", ["ls-files", "--others", "--exclude-standard", "-z", "--"]),
    ):
        for path in paths_for(args):
            if any(ord(char) < 32 or ord(char) == 127 for char in path):
                raise ScopeError("dirty path contains a control character")
            in_scope = task_id == "feature"
            if ledger_path and path == ledger_path:
                in_scope = True
            if path in scope_paths or any(matches(path, declaration) for declaration in ownership):
                in_scope = True
            if in_scope:
                states.append((label, path))
    return sorted(set(states))


def assert_info_attributes_empty() -> None:
    path = git(["rev-parse", "--git-path", "info/attributes"]).decode("utf-8", "strict").strip()
    if not path:
        return
    if not os.path.isabs(path):
        path = os.path.join(ROOT, path)
    try:
        with open(path, encoding="utf-8") as handle:
            effective = [line for line in handle if line.strip() and not line.lstrip().startswith("#")]
    except FileNotFoundError:
        return
    if effective:
        raise ScopeError("non-empty git info/attributes cannot be neutralized; remove it before review")


def assert_info_grafts_empty() -> None:
    path = git(["rev-parse", "--git-path", "info/grafts"]).decode("utf-8", "strict").strip()
    if not path:
        return
    if not os.path.isabs(path):
        path = os.path.join(ROOT, path)
    try:
        with open(path, encoding="utf-8") as handle:
            effective = [line for line in handle if line.strip() and not line.lstrip().startswith("#")]
    except FileNotFoundError:
        return
    if effective:
        raise ScopeError("non-empty git info/grafts is clone-local; remove it before review")


def assert_candidate_attribute_support(candidate: str) -> None:
    try:
        git(["check-attr", f"--source={candidate}", "--all", "--", "."], candidate_attrs=candidate)
    except ScopeError as exc:
        raise ScopeError(
            "git cannot pin attributes to the candidate tree; Git 2.42+ with check-attr --source is required"
        ) from exc


def assert_local_diff_config_safe() -> None:
    proc = subprocess.run(
        ["git", "config", "--includes", "--name-only", "--get-regexp",
         r"^(diff\.|core\.(attributesfile|bigfilethreshold)$|include(if)?\.)"],
        cwd=ROOT,
        env=git_env(),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if proc.returncode not in {0, 1}:
        raise ScopeError("could not inspect clone-local diff configuration")
    if proc.stdout.strip():
        keys = ", ".join(proc.stdout.decode("utf-8", "replace").splitlines()[:5])
        raise ScopeError(f"clone-local Git config can change canonical diff: {keys}")


def review_paths(base: str, candidate: str, slug: str | None, task_id: str | None) -> tuple[list[str], dict[str, object] | None]:
    if bool(slug) != bool(task_id):
        raise ScopeError("feature and task must be provided together for a task-scoped diff")
    if slug and task_id:
        scope = resolve_scope(slug, task_id, base, candidate)
        return list(scope["changed_paths"]), scope
    paths = [path for path in changed_paths(base, candidate) if not BOOKKEEPING_RE.fullmatch(path)]
    if not paths:
        raise ScopeError("canonical diff is empty; refusing no-op review")
    return paths, None


def canonical_diff(
    base: str,
    candidate: str,
    slug: str | None,
    task_id: str | None,
    max_bytes: int = MAX_CANONICAL_DIFF_BYTES,
) -> bytes:
    base = require_commit(base, "base")
    candidate = require_commit(candidate, "candidate")
    assert_candidate_attribute_support(candidate)
    assert_info_attributes_empty()
    assert_info_grafts_empty()
    assert_local_diff_config_safe()
    paths, _scope = review_paths(base, candidate, slug, task_id)
    command = [
        "-c", "core.quotePath=true",
        "-c", "core.attributesFile=/dev/null",
        "-c", "core.bigFileThreshold=512m",
        "-c", "diff.mnemonicPrefix=false",
        "-c", "diff.noprefix=false",
        "-c", "diff.suppressBlankEmpty=false",
        "-c", "diff.submodule=short",
        "diff", "-O/dev/null", "--binary", "--full-index", "--no-color",
        "--no-ext-diff", "--no-renames", "--unified=3",
        "--diff-algorithm=myers", "--indent-heuristic", "--inter-hunk-context=0",
        "--src-prefix=a/", "--dst-prefix=b/", "--no-textconv",
        "--ignore-submodules=none", base, candidate, "--", *paths,
    ]
    if max_bytes <= 0 or max_bytes > MAX_CANONICAL_DIFF_BYTES:
        raise ScopeError(
            f"canonical diff byte limit must be 1..{MAX_CANONICAL_DIFF_BYTES}: {max_bytes}"
        )
    payload = git_bounded(
        command,
        stdout_limit=max_bytes,
        stdout_label="canonical diff",
        candidate_attrs=candidate,
    )
    if not payload:
        raise ScopeError("canonical diff is empty; refusing no-op review")
    return payload


def snapshots(scope: dict[str, object], max_lines: int, max_bytes: int) -> bytes:
    candidate = str(scope["candidate_sha"])
    entries = tree_entries(candidate)
    chunks: list[bytes] = []
    used = 0

    def append_bounded(value: bytes) -> None:
        nonlocal used
        if used >= max_bytes:
            return
        value = value[: max_bytes - used]
        chunks.append(value)
        used += len(value)

    global_marker = f"\n[... committed task snapshots truncated at {max_bytes} bytes ...]\n".encode()
    for path in scope["scope_paths"]:
        mode, kind, oid = entries.get(str(path), ("", "", ""))
        if mode not in {"100644", "100755"} or kind != "blob":
            continue  # deleted paths have no candidate snapshot
        if max_bytes - used <= len(global_marker):
            append_bounded(global_marker)
            break

        size = int(git(["cat-file", "-s", oid], candidate_attrs=candidate).decode("ascii").strip())
        header = f"===== {path} ({size} committed bytes; bounded preview; committed {candidate}) =====\n".encode("utf-8")
        append_bounded(header)
        content_budget = max(0, max_bytes - used - len(global_marker))
        if content_budget == 0:
            append_bounded(global_marker)
            break

        proc = subprocess.Popen(
            ["git", "cat-file", "-p", oid],
            cwd=ROOT,
            env=git_env(candidate),
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        preview = bytearray()
        line_limited = False
        try:
            assert proc.stdout is not None
            while len(preview) <= content_budget:
                block = proc.stdout.read(min(8192, content_budget + 1 - len(preview)))
                if not block:
                    break
                preview.extend(block)
                if preview.count(b"\n") >= max_lines:
                    newline = -1
                    start = 0
                    for _ in range(max_lines):
                        newline = preview.find(b"\n", start)
                        if newline < 0:
                            break
                        start = newline + 1
                    if newline >= 0:
                        del preview[newline + 1 :]
                        line_limited = True
                        break
                if len(preview) > content_budget:
                    del preview[content_budget:]
                    break
        finally:
            if proc.poll() is None:
                proc.terminate()
            try:
                proc.wait(timeout=2)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()

        if b"\0" in preview:
            append_bounded(b"[binary committed blob omitted: NUL in bounded preview]\n")
            continue
        decoded = None
        candidate_preview = bytes(preview)
        for trim in range(0, min(4, len(candidate_preview)) + 1):
            try:
                decoded = candidate_preview[: len(candidate_preview) - trim if trim else None].decode("utf-8")
                break
            except UnicodeDecodeError as exc:
                if exc.start < max(0, len(candidate_preview) - 4):
                    break
        if decoded is None:
            append_bounded(b"[non-UTF-8 committed blob omitted from prompt]\n")
            continue
        encoded = decoded.encode("utf-8")
        append_bounded(encoded)
        if encoded and not encoded.endswith(b"\n"):
            append_bounded(b"\n")
        consumed = len(encoded)
        if line_limited or consumed < size:
            per_blob = f"[... committed blob preview truncated: {path} ...]\n".encode("utf-8")
            if len(per_blob) <= max_bytes - used - len(global_marker):
                append_bounded(per_blob)
            elif consumed < size:
                append_bounded(global_marker)
                break
    return b"".join(chunks)


def usage() -> NoReturn:
    fail(
        "usage: lib-review-scope.py config-value|review-base|scope-json|task-block|changed-paths|dirty-scope|canonical-diff|canonical-hash|snapshots ..."
    )


def main() -> int:
    if len(sys.argv) < 2:
        usage()
    command = sys.argv[1]
    try:
        if command == "config-value":
            if len(sys.argv) != 4:
                usage()
            candidate = require_commit(sys.argv[2], "candidate")
            print(candidate_config_value(candidate, sys.argv[3]))
            return 0
        if command == "review-base":
            if len(sys.argv) != 6:
                usage()
            print(task_review_base(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5]))
            return 0
        if command in {"scope-json", "task-block", "changed-paths"}:
            if len(sys.argv) != 6:
                usage()
            scope = resolve_scope(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
            if command == "scope-json":
                public = {key: scope[key] for key in ("feature", "task_id", "ledger_path", "ownership", "scope_paths", "changed_paths", "scope_hash", "base_sha", "candidate_sha")}
                print(json.dumps(public, ensure_ascii=True, sort_keys=True, separators=(",", ":")))
            elif command == "task-block":
                sys.stdout.write(str(scope["task_block"]))
            else:
                for path in scope["changed_paths"]:
                    print(path)
            return 0
        if command == "dirty-scope":
            if len(sys.argv) != 6:
                usage()
            dirty = dirty_scope(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
            for label, path in dirty:
                print(f"{label}|{path}")
            return 1 if dirty else 0
        if command in {"canonical-diff", "canonical-hash"}:
            valid_lengths = {4, 6, 7} if command == "canonical-diff" else {4, 6}
            if len(sys.argv) not in valid_lengths:
                usage()
            slug = sys.argv[4] if len(sys.argv) == 6 else None
            task_id = sys.argv[5] if len(sys.argv) == 6 else None
            max_bytes = MAX_CANONICAL_DIFF_BYTES
            if len(sys.argv) == 7:
                slug = sys.argv[4]
                task_id = sys.argv[5]
                max_bytes = int(sys.argv[6])
            payload = canonical_diff(sys.argv[2], sys.argv[3], slug, task_id, max_bytes)
            if command == "canonical-hash":
                print(hashlib.sha256(payload).hexdigest())
            else:
                sys.stdout.buffer.write(payload)
            return 0
        if command == "snapshots":
            if len(sys.argv) != 8:
                usage()
            max_lines = int(sys.argv[6])
            max_bytes = int(sys.argv[7])
            if not 0 < max_lines <= MAX_SNAPSHOT_LINES or not 0 < max_bytes <= MAX_SNAPSHOT_BYTES:
                raise ScopeError(
                    f"snapshot bounds must be within lines=1..{MAX_SNAPSHOT_LINES}, bytes=1..{MAX_SNAPSHOT_BYTES}"
                )
            scope = resolve_scope(sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
            sys.stdout.buffer.write(snapshots(scope, max_lines, max_bytes))
            return 0
        usage()
    except (ScopeError, ValueError) as exc:
        fail(str(exc))


if __name__ == "__main__":
    raise SystemExit(main())
