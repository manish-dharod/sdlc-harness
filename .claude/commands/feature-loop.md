---
description: Run one autonomous SDLC iteration on a feature, with budget + oscillation + readiness checks
argument-hint: <feature-slug> [fast|unit|full]
---

You are running **one local-only iteration** of the SDLC harness feature SDLC
for `$ARGUMENTS`.

The first argument is the feature slug. The optional second argument is the
verification mode (default `fast`).

## Safety boundary (non-negotiable)

- **No production deploys**, DNS, firewall/panel, or live DB mutation.
- **No launch flag flips** that enable production behavior.
- **No real external-service traffic** unless explicitly owned by the feature
  and approved.
- **No collection of raw PAN, CVV, expiry**, credentials, tokens, auth
  headers, passphrases, or webhook secrets.
- **No force-push, history reset, broad deletes**, or `--no-verify`.
- **No recursive `/feature-loop` invocation** from within this iteration.
- **Stop and record a `Blocked` task** (and open an `APPROVALS.md` entry with
  a stop reason code) if external evidence, credentials, staging access,
  external vendor docs, compliance signoff, or human approval is needed.

## Pre-iteration gates (run before any subagent)

### Gate 0 — Worktree hygiene + active-task routing

```bash
scripts/worktree-hygiene $1
```

The verdict drives a **routing decision** that controls step 3 of the
iteration. The loop does NOT always claim a new task — that would
contradict the worktree-hygiene principle by trying to start work while
the current task is mid-flight.

| Verdict | Active task state | Routing | Step-3 behavior |
|---|---|---|---|
| `CLEAN` | none | `new-task` | run `scripts/feature-next-task`; if a task is returned, invoke `builder` to claim it |
| `DIRTY_OWNED` | one `Claimed` task | `resume-claimed: <id>` | invoke `builder` on the existing claim — do NOT call `scripts/feature-next-task` (it uses `--strict` and would refuse) |
| `DIRTY_OWNED` | one `Review` task | `resume-review: <id>` | skip implementation and proceed directly to step 4 (parallel review) — the diff is exactly what reviewers need to see |
| `DIRTY_OWNED` | multiple active tasks | (halt) | unusual state — write `Stop reason: dirty-worktree-ambiguous` and ask the human to decide which task to resume |
| `DIRTY_NO_TASK` (exit 1) | n/a | (halt) | dirty paths exist but no Claimed/Review task to attribute them to. Write `Stop reason: dirty-worktree` with code `DIRTY_WORKTREE`. Owner must either claim the task that owns those changes, commit a local checkpoint, or revert. |
| `DIRTY_MIXED` (exit 2) | any | (halt) | dirty includes files outside the active task's ownership (and outside the implicit SDLC set). Continuing would let unrelated changes ride out under the task's review and corrupt the diff hash. Same `DIRTY_WORKTREE` stop code. |

Record the routing decision in the iteration's RUN entry (`Routing:
new-task | resume-claimed:<id> | resume-review:<id>`) so oscillation
detection can compare across iterations.

This gate runs first because every downstream agent (reviewer modes,
security) reads `git diff` and assumes the diff = the active task's
work. If that invariant is false, every finding they produce is suspect.

### Gate 1 — Reconcile

```bash
scripts/feature-reconcile $1
```

If the script exits non-zero, stop the iteration. Invoke `planner` with
`Phase: plan` to reconcile drift, then the user can re-run `/feature-loop`.
Do not paper over drift.

### Gate 1b — Agent capsule preflight

Before invoking `builder`, `reviewer`, or `security`, generate a capsule from
repo state and validate it:

```bash
scripts/agent-capsule-plan $1 [TASK-ID] > /tmp/agent-capsule.md
scripts/agent-capsule-check /tmp/agent-capsule.md
```

Do this automatically; the human should not hand-author routine capsule
prompts. If generation or validation fails, stop before dispatching any
subagent and record `Stop reason: error` with a short explanation. A failed
capsule preflight usually means task ownership, required checks, checkpoint
state, or safety invariants are missing.

For supervisor-mode campaigns where this session coordinates external workers
instead of invoking Claude subagents directly, launch implementation capsules
only through:

```bash
scripts/codex-capsule-run $1 TASK-ID /tmp/agent-capsule.md
scripts/claude-capsule-run $1 TASK-ID /tmp/agent-capsule.md
```

Do not run raw `codex`, `codex exec`, or unwrapped `claude` implementation
commands.

### Gate 2 — Iteration budget

Run the deterministic budget/oscillation parser before interpreting the
ledger in prose:

```bash
scripts/loop-budget-check $1
```

Exit `10`, `11`, or `12` means iteration, no-progress, or blocked-external
budget exhaustion. Write `Stop reason: budget-exhausted` with the exact reason
printed by the script and stop. Defaults are 25 / 3 / 3; explicit budget rows
in RUNS.md or STATE.md override them.

### Gate 3 — Oscillation detection

The same `scripts/loop-budget-check` call returns exit `20`, `21`, or `22` for
same-task/zero-file thrash, repeated diff hash, or a three-run finding cycle.
Write `Stop reason: oscillation` with the script's exact reason and stop. Tell
the user which deterministic pattern fired and recommend `planner` (`Phase:
plan`) intervention. Exit `0` is the only proceed verdict; exit `3` is malformed
or missing ledger state and must stop as `error`.

### Gate 4 — Readiness check

```bash
scripts/feature-ready $1
```

If exit code is `0` (READY), write a `Stop reason: ready` RUN entry and
invoke `release` for the final verdict — then stop. The feature is done.
If exit is `2` (NEEDS-APPROVAL), write a `Stop reason: blocked-human` RUN
entry and stop unless there is real agent work still possible (open tasks
whose dependencies are unsatisfied don't count as "real work").

## Iteration

Use the Task tool to invoke the corresponding subagents. Where work is
independent, invoke in parallel (multiple Agent tool calls in one message).

1. **Rehydrate** — read STATE/TASKS/FINDINGS/TRACEABILITY/APPROVALS,
   `scripts/feature-context $1`.

2. **Plan if needed** — invoke `planner` only when Gate 0 routing is
   `new-task` AND `scripts/feature-next-task $1` returns no claimable
   task (exit 3) AND `DESIGN.md` is `Approved`. Use the appropriate phase:
   - If design is `Approved` but tasks need decomposition → `planner` with
     `Phase: plan`.
   - If design is `Draft` → `planner` with `Phase: design`.
   - If SPEC is empty → `planner` with `Phase: intake`.
   - If routing is `resume-claimed` or `resume-review` → skip planning;
     the work-in-flight is what to advance.

   If planning is the only useful work this iteration, stop after the plan
   lands and write a `Stop reason: continue` RUN entry.

3. **Claim + implement, or resume, or hand to review** — branch on the
   Gate 0 routing decision:

   - **`new-task`** — run `scripts/feature-next-task $1`. If it returns
     a task ID, generate and validate a capsule for that task:
     `scripts/agent-capsule-plan $1 TASK-ID "Claude Code builder" >
     /tmp/agent-capsule.md && scripts/agent-capsule-check
     /tmp/agent-capsule.md`. Include the validated capsule text in the
     `builder` prompt, then invoke `builder` to claim it and implement
     inside declared file ownership. If `feature-next-task` exits 3 (no
     claimable), the iteration ends after the planning step ran (or stops
     with `continue` if not).
   - **`resume-claimed: <id>`** — invoke `builder` with the existing
     claim. Do NOT call `scripts/feature-next-task`; the current claim
     is still in flight and `feature-next-task --strict` would refuse.
     Generate and validate a capsule for `<id>` first, include it in the
     `builder` prompt, then `builder` continues the implementation
     (verification, fix, evidence) until the task transitions to Review
     or Done.
   - **`resume-review: <id>`** — skip implementation entirely and
     proceed to step 4 (parallel review). Generate and validate a capsule
     for `<id>` first and include it in the review prompts. The task has
     already been handed off to Review by a prior iteration; the diff is
     exactly what reviewer modes + security need to see.

4. **Parallel review** — invoke `reviewer` three times (Mode: quality,
   Mode: qa, Mode: adversarial) and `security` concurrently on the
   resulting diff. (See `/feature-review` pattern.)

   **Risk routing**: skip `security` for docs-only diffs (no `.php`, `.js`,
   `.ts`, `.py`, `.yml`, `.json` changes outside `docs/`). Skip
   `reviewer (Mode: qa)` for diffs that touch only `docs/features/<slug>/`
   files. Always invoke `reviewer (Mode: quality)`. For
  `reviewer (Mode: adversarial)`: always invoke. For tasks claimed on or
  after 2026-06-24, brief it to run the opposite-tool reviewer even for
  lightweight/docs-only diffs; routing-skip does not satisfy the Review-stage
  gate. Never silently omit the adversarial trail; `scripts/feature-reconcile`
  treats its absence as drift.

5. **Targeted fix** — if **Confirmed P0 or P1** findings exist inside the
   claimed task's file ownership, invoke `builder` again to fix only those.
   This includes P0/P1 findings from `reviewer (Mode: adversarial)` — they
   block Done identically to findings from any other mode.
   **P2 findings**: defer beyond the cap (5 active per feature). **P3
   findings**: never trigger a fix iteration. This is the severity-budget
   rule from FINDINGS.md.

5b. **Adversarial re-check after a fix iteration** — if step 5 ran (i.e.,
    builder produced a new diff to fix P0/P1 findings), invoke `reviewer`
    with `Mode: adversarial` one more time on the fix diff before moving
    on. The new diff is a new change set with its own adversarial-trail
    requirement. Brief the adversarial pass that it may run in lightweight
    mode (focused on whether the fix introduced a new adversarial
    category), but it MUST append a fresh EVIDENCE trail entry citing the
    same task ID. Missing this re-check = drift, and
    `scripts/feature-reconcile` will flag it.

6. **Verify** — run `scripts/feature-verify $1 $2` (default `fast`).

7. **Acceptance check** — if all `Open`/`Claimed`/`Review` tasks for the
   current AC IDs are now `Done`, invoke `reviewer` with `Mode: acceptance`
   to walk TRACEABILITY and audit spec conformance. Open follow-up tasks
   if gaps surface.

8. **Readiness check + release** — run `scripts/feature-ready $1`. If
   READY, invoke `release` to produce the verdict block and stop. If
   NEEDS-APPROVAL, write the stop reason and stop. If BLOCKED, continue.

9. **State hygiene** — confirm TASKS / STATE / FINDINGS / DECISIONS /
   EVIDENCE / TRACEABILITY / APPROVALS / RELEASE_GATES are current. If a
   file wasn't updated, hand it back to the right role rather than editing
   it directly.

10. **Write RUN ledger entry** — append a `RUN-###` block to RUNS.md with
    iteration index, mode, task, diff hash (`git rev-parse HEAD` or
    `git diff "${SDLC_BASE_BRANCH:-master}..HEAD" | sha256sum | head -c 12`), findings opened/closed,
    verification result, stop reason, and stop reason code.

## Final report

Output exactly one block:

```
## Loop iteration result for $1

- Run ID: RUN-### (recorded in docs/features/$1/RUNS.md)
- Gate 0 routing: new-task | resume-claimed:TASK-### | resume-review:TASK-###
- Task claimed / resumed: TASK-### (or "planning only" / "none")
- Files changed: N (paths)
- Diff hash: <short hash>
- Findings opened: FND-### (severity / status)
- Findings closed: FND-###
- Verification: <mode> = pass | fail | skipped (reason)
- Acceptance check: ran | skipped (reason)
- scripts/feature-ready exit: 0 | 1 | 2
- Approvals opened/touched: APV-### (status)
- Stop reason: continue | ready | blocked-external | blocked-human | oscillation | budget-exhausted | dirty-worktree | error
- Stop reason code: NONE | NEEDS_HUMAN_APPROVAL | NEEDS_EXTERNAL_EVIDENCE | OSCILLATION_DETECTED | ITERATION_BUDGET_EXHAUSTED | NO_PROGRESS_3X | DIRTY_WORKTREE | ERROR
- Next step: continue with another /feature-loop | stop as Blocked | wait for human review | feature READY (run release)
```

To run multiple iterations, the user can invoke `/feature-loop` again. For
recurring execution, use the `/loop` skill: `/loop /feature-loop $1`. The
budget and oscillation gates above will halt `/loop` cleanly when the feature
converges or stalls.
