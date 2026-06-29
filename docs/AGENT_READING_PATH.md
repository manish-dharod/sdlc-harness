# Agent Reading Path

> **For AI agents operating this harness — not humans onboarding.** This is an
> ingest *contract*: the exact files to load, in order, what to extract from
> each, the loop to run, and the hard stops. Humans get the same harness as a
> layered narrative ([Start Here](START_HERE.md)); you get it as a checklist.

If you are an agent (Claude Code, Codex CLI, a custom orchestrator, or a CI
job) about to act on a feature in this repo, do not skim the prose docs. Ingest
the files below in order, then run the operating loop, then honor the stops.

---

## 1. Ingest order

Load these in sequence. Each line says **why** and **what to extract**.

1. **`CLAUDE.md`** (repo root) — the operating rules. Extract: the five agents
   and their phases/modes, the severity budget, the non-negotiable guardrails,
   the sanitizer exit codes.
2. **`docs/features/<slug>/STATE.md`** — the machine-readable current state.
   Extract: current phase, active task, loop budget, stop reason. *This is your
   resume point.* If it conflicts with prose, STATE.md wins.
3. **`docs/features/<slug>/TASKS.md`** — the task DAG. Extract: which tasks are
   `Open` with all `Depends-on` `Done` (these are claimable), file ownership
   per task, and verification commands.
4. **`docs/features/<slug>/DESIGN.md`** — extract its status. If not `Approved`,
   no `Backlog → Open` transition is legal; planning is the only work.
5. **`docs/features/<slug>/FINDINGS.md`** — open findings and severities.
   Extract: any unresolved `P0`/`P1` (these block `Done` and release).
6. **`docs/features/<slug>/APPROVALS.md`** — extract: anything `Requested` with
   `waiting_on_human: true` and its stop-reason code. You may not self-approve.
7. **`docs/features/<slug>/TRACEABILITY.md`** — extract: which AC/NFR IDs lack a
   passing test (acceptance and release read this).
8. Only as needed: `docs/reference/` for the exact contract of any command,
   script (and its exit codes), control-plane file, or config key you're about
   to use.

Do not load files you don't need. The control plane is addressable: read the
one file that answers your question.

---

## 2. Operating loop

Once ingested, one iteration is:

```
preflight → route → act → verify → record → stop-check
```

1. **Preflight.** Run `scripts/worktree-hygiene <slug>`. If the worktree is
   dirty with changes outside the active task's ownership, **halt** — do not
   ride unrelated changes into a review.
2. **Route.** Clean tree → claim the next task from `scripts/feature-next-task`.
   Dirty-but-owned by a `Claimed` task → resume it. Owned by a `Review` task →
   go straight to review.
3. **Act.** Builder: implement the smallest change inside declared file
   ownership, test-first. Reviewer: review the diff in your assigned mode.
   Never expand scope beyond the task.
4. **Verify.** Run the task's verification command (or
   `scripts/feature-verify <slug> <mode>`). The **exit code is the truth**, not
   your judgment of the output.
5. **Record.** Update STATE / TASKS / EVIDENCE / TRACEABILITY / FINDINGS in the
   same change. A task is not `Done` until these are current (see the full
   checklist in [reference/control-plane.md](reference/control-plane.md)).
6. **Stop-check.** Evaluate the hard stops below before continuing.

For repeated iterations, the loop is gated by budget, oscillation detection,
and readiness — see [`/feature-loop`](reference/commands.md) for the exact
gates.

---

## 3. Hard stops (halt and write a Blocked record + an APPROVALS entry)

Stop the iteration — do **not** improvise around — when you hit any of:

- A required **human approval** that is `Requested`/un-granted.
- A need for **external evidence**, credentials, staging access, or a
  third-party document you cannot produce locally.
- An unresolved **P0/P1** finding inside the change's scope.
- A request that would cross a guardrail: **production deploy, DNS/firewall
  change, live DB mutation, launch-flag flip, real payment/carrier traffic,
  raw secrets/card data, force-push, or history rewrite.**
- **Oscillation**: the same task re-claimed with zero file changes, an
  identical diff hash to the prior run, or a finding opened-and-closed three
  runs in a row.
- Loop **budget exhausted**.

On any stop: record a `Blocked` task and an `APPROVALS.md` entry with the
stop-reason code, then surface it to the human. Stopping cleanly is a success
state, not a failure.

---

## 4. Machine-readable summary

```yaml
ingest_order:
  - CLAUDE.md                              # operating rules
  - docs/features/<slug>/STATE.md          # resume point; authoritative on conflict
  - docs/features/<slug>/TASKS.md          # DAG; Open + deps Done = claimable
  - docs/features/<slug>/DESIGN.md         # must be Approved to open tasks
  - docs/features/<slug>/FINDINGS.md       # P0/P1 block Done + release
  - docs/features/<slug>/APPROVALS.md      # waiting_on_human: true => cannot proceed
  - docs/features/<slug>/TRACEABILITY.md   # AC/NFR -> passing test coverage
  - docs/reference/*                       # on demand: exact contracts

loop: [preflight, route, act, verify, record, stop_check]

truth_source:
  state: docs/features/<slug>/STATE.md     # over any prose
  pass_fail: script_exit_code              # over model judgment

hard_stops:
  - needs_human_approval
  - needs_external_evidence
  - unresolved_P0_or_P1
  - guardrail_crossing            # deploy | dns | live_db | launch_flag | real_traffic | secrets | force_push
  - oscillation_detected
  - budget_exhausted

on_stop:
  - write_blocked_task
  - open_approvals_entry_with_stop_reason
  - surface_to_human
```

---

> **See also:** [Start Here](START_HERE.md) (the human map) ·
> [reference/control-plane.md](reference/control-plane.md) (file specs + state
> machines) · [reference/scripts.md](reference/scripts.md) (exit-code contracts).
