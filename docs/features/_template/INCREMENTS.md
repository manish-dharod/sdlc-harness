# Shippable Increments

Last updated: YYYY-MM-DD
Delivery mode: feedback-gated
Current increment: INC-001

## Status model

`Planned -> Building -> Ready for feedback -> Accepted`, with
`Ready for feedback -> Changes requested -> Building` for owner-directed
rework. Only the owner can supply an Accepted or Changes requested verdict.

Only the current increment may contain Open, Claimed, Review, or Done work.
Every future increment and its tasks remain Planned/Backlog until the current
increment is owner-accepted.

### INC-001: Experiential MVP

- Status: Planned
- Outcome: pending
- User journey: pending
- Experience surface: pending
- Ship target: pending
- Task IDs: TASK-001
- Verification: pending
- Rollback: pending
- Evidence: pending
- Owner verdict: Pending
- Owner feedback evidence: pending

## Owner feedback record format

Agents prepare the evidence and stop at `Ready for feedback`. They never write
an owner verdict. Append each real owner response to `EVIDENCE.md` in order:

```text
## YYYY-MM-DD - Owner feedback: INC-001 round 1

- Source: owner
- Round: 1
- Verdict: Accepted | Changes requested
- Owner message: <verbatim or faithful owner-provided feedback>
```

After `Changes requested`, keep the same increment current, move it back to
Building, and open only the rework needed for that feedback. After `Accepted`,
the planner may define or activate the next increment.
