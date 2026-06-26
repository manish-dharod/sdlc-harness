---
description: Arena-with-graft for high-risk implementations. Spawns N parallel builder candidates against the same task, runs a cross-model judge, picks the strongest as the base, grafts the best 1-2 ideas from each loser into it, and verifies the synthesized result. Reserved for tasks where one attempt would lock in the wrong shape (PCI / migration / payment state machine / default-ON flag). N capped at 5.
argument-hint: <feature-slug> <task-id> [N]
---

You are running `/feature-arena` for `$ARGUMENTS`.

This is **constructive parallelism** — distinct from the adversarial
parallelism of `/feature-review`. Adversarial review (reviewer in
quality/qa/adversarial modes + security) attacks one implementation
looking for defects. Arena builds **N independent implementations** of the
same task, then synthesizes the strongest base plus the best ideas from
each loser. It's expensive — gated to genuinely high-risk diffs where
the cost of locking in the wrong shape on the first pass would dwarf
the cost of running N candidates.

Adapted from pstack's `/arena` skill. The 6-phase pattern below is
preserved verbatim from that source.

## Safety boundary (non-negotiable)

- Same boundary as `/feature-loop`: no production deploys, no DNS /
  firewall / panel changes, no live DB mutation, no launch-flag flips,
  no real external-service traffic unless explicitly owned and approved.
  Candidates work in isolated `/tmp` dirs;
  none of them can touch production. See
  [[principle-no-production-deploys-from-loop]].
- The lead (you) is the only agent that writes back to the real repo.
  Candidates produce diffs in their own work dirs; the lead applies
  the chosen synthesis after Phase E.
- No raw card / PCI data in any candidate prompt, rationale, or diff.
  See [[principle-no-sensitive-domain-data]] — the sanctioned wrappers
  enforce this; candidate prompts must too.

## Steps

### Step 0 — Run the coordinator script

```bash
scripts/feature-arena $1 $2 ${3:-3}
```

The script:
- Validates feature + task ID exist.
- Checks **arena-eligibility**: task must have `Risk: high` AND touch a
  qualifying surface (migration / regulated data / payment / launch-flag / public contract).
  Use `--force` only with explicit owner acknowledgment of the cost.
- Creates `/tmp/sdlc-arena-<slug>-<task-id>-<ts>/candidate-1..N/` work
  dirs, each with `task.md`, `CANDIDATE_INSTRUCTIONS.md`, and slots
  for `diff.patch` + `RATIONALE.md` + `test-output.txt`.
- Writes a coordinator manifest at
  `docs/features/<slug>/arena/<task-id>-<ts>.coordinator.md` and
  prints the path.

If the script exits 3 (usage) or 4 (ineligible), stop and surface the
reason. Do not silently `--force`.

### Phase A — Frame

Read the task block + DESIGN.md anchor + AC IDs end to end. Derive a
**concrete rubric** for the lead to apply in Phase D — 3 to 6
gradeable criteria specific to this task. Examples:

- `Adds the new `is_recurring` column with NOT NULL default false`
- `Backfill produces zero rows with NULL is_recurring`
- `Rollback DDL drops the column without data loss`
- `Refactor preserves the test-coverage delta within ±2%`

**Concrete > vague.** "Code is correct" is not a criterion. The
candidates do not see the rubric — only the task. The lead applies
the rubric in Phase D.

### Phase B — Fan out

Spawn all N candidate subagents in one message:

- `subagent_type`: `general-purpose`
- `model`: vary across candidates for diversity. Recommended set for
  N=3: `sonnet`, `sonnet`, `opus`. For N=4: add a `haiku` candidate
  for a fast cheap baseline. For N=5: add a second `opus`. Same model
  across candidates is fine if the task is *generation-bound* (the
  point is exploring different shapes), but variety is preferred.
- Each candidate gets:
  1. Its candidate-i work dir path
  2. The `CANDIDATE_INSTRUCTIONS.md` content from that dir verbatim
  3. The task block (already in `task.md`)
  4. The DESIGN.md section the task cites

Each candidate writes:

- `diff.patch` — unified diff of its proposed change, scoped to the
  task's `Intended file ownership`.
- `RATIONALE.md` — design notes, alternatives considered, what it
  rejected. **Mandatory** — without this the lead cannot graft.
  Also contains: the verification commands the candidate WOULD run
  + what shape of output would indicate success. The lead uses this
  as a verification checklist in Phase F.

Candidates MUST stay inside their own work dir. They may read the
real repo (read-only) for context but must NOT modify it. Per
ADV-FND-004 of the Phase-6 Codex adversary review on this feature:
candidates do NOT produce `test-output.txt` — they cannot validly
run the verification command without modifying files outside their
isolated dir. The **lead** runs verification in a temporary checkout
after Phase D / E, against the synthesized diff. The candidate's
RATIONALE.md tells the lead what to check.

### Phase C — Cross-judge

After all candidates complete, spawn ONE judge subagent on a different
model family from the parent. The judge:

- `subagent_type`: `general-purpose`
- `model`: prefer Codex via `scripts/adversary-review` for cross-model
  signal. If Codex is unavailable for a gating review, block and record
  `NEEDS_CROSS_MODEL_REVIEWER`; do not treat same-tool fallback as satisfying
  the cross-model gate.
- `readonly`: `true`.

The judge sees:
- The rubric from Phase A (the candidates did NOT see this)
- All N candidates by sanitized label (`candidate-1` … `candidate-N`,
  never by model name)
- Their rationales

The judge scores each candidate criterion-by-criterion and recommends
a base with rationale. **Do not auto-accept the judge's pick** — the
lead reviews in Phase D and may override with stated reason.

### Phase D — Pick a base

Read every candidate end to end. Skimming surfaces only the candidate
whose shape looks most familiar — that's the failure mode arena
exists to prevent.

Score each candidate against the rubric, criterion by criterion.
Compare against the cross-judge:

- **Agreement** confirms the pick.
- **Disagreement** means one of you (or the rubric) is wrong. Read
  both rationales before deciding.

Pick the base on **maintainability** — which candidate can a future
maintainer extend without breaking invariants? Prefer the cleaner
boundary or smaller surface area when two feel tied. (pstack calls
this "laziness protocol" — not yet promoted into this repo's
`docs/principles/`; cite by description rather than wiki-link until
or unless it's added.)

Record the pick and the reason alongside the base artifact in
`docs/features/<slug>/arena/<task-id>-<ts>.synthesis.md`, including
the cross-judge's verdict.

### Phase E — Graft

Walk each losing candidate once more. Identify what's worth porting
into the base. The signal is usually one or two things per
candidate, not most of it.

Apply each graft **by hand**, per
[[principle-fix-root-causes]] (the new code has to remain coherent
under one mental model — paste-merging breaks coherence).

Record:
- What was grafted, from which candidate (auditability).
- What was rejected from each, and **why** (the highest-signal output
  of arena per pstack — future readers learn from what was considered
  and dropped).

Convergence: when N candidates all converge on the same shape, that's
a strong agreement signal. Note convergence in the synthesis file and
ship the consensus shape. No graft needed.

Divergence: when N candidates wildly differ, Phase A was
under-specified. Reframe (tighten the rubric) and re-run rather than
averaging the divergence.

### Phase F — Verify

The synthesized artifact has to hold up under the same scrutiny as
any other diff. Apply the regular review chain (reviewer in quality/qa/adversarial
modes + security in parallel via `/feature-review`) once you've applied
the synthesis to the real repo.

If verification surfaces a problem the arena missed:
- Either Phase A was wrong (re-frame and re-run), OR
- One candidate caught it and you missed the graft (back to Phase E).

Don't paper over with a quick patch. The arena spent N+ subagents'
work — invest the cycle to fix the synthesis correctly.

## Output (every invocation)

Output exactly this block:

```text
## /feature-arena result for $1 / $2

- N candidates: <N>
- Eligibility check: passed | forced (with reason)
- Coordinator manifest: docs/features/$1/arena/$2-<ts>.coordinator.md
- Candidate work dir: /tmp/sdlc-arena-$1-$2-<ts>/
- Rubric (Phase A): <one-line summary; full text in synthesis file>
- Cross-judge model: codex / opus / other (with reason)
- Cross-judge pick: candidate-<i>
- Lead pick: candidate-<i>  (matches | overrides judge)
- Grafts applied: <from-candidate, what-graft> × N
- Rejections recorded: <count>
- Synthesis file: docs/features/$1/arena/$2-<ts>.synthesis.md
- Verification: passed via /feature-review | pending | failed (with reason)
- Final diff applied to real repo: yes | no (with reason)
- Next role: reviewer (quality + qa + adversarial) + security (parallel) | planner (Phase: plan, state hygiene)
```

## Cost notes

- N=3 with mixed Claude (sonnet+sonnet+opus): ~3x builder cost.
- Add Codex cross-judge: +~1x adversary-review cost.
- Total: roughly 4x the cost of a single builder pass.
- Pay this for tasks where the cost of *getting the shape wrong* is
  much higher: PCI handler, migration with backfill, payment state
  machine, default-ON flag flip.

The arena does NOT replace `/feature-review`. After Phase F, the
synthesized diff goes through the regular parallel review just like
any other builder output.
