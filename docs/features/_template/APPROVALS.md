# Approvals

Last updated: YYYY-MM-DD
Maintained by: planner (Phase: plan) (opens approvals), release (gates on them)

Human-only signoffs. The framework cannot grant these. Each entry is
machine-checkable so `scripts/feature-ready` can detect "waiting on human"
without an agent re-interpreting prose.

## Status legend

- `Requested` — opened, owner notified, awaiting signoff
- `Approved` — owner signed off; record date + reference
- `Rejected` — owner rejected; record rationale, may trigger rework
- `Withdrawn` — no longer needed; explain why

## Schema (one block per approval)

Field syntax shown with `<placeholder>` brackets so the
`scripts/feature-ready` grep does NOT match `waiting_on_human: true` here:

```text
### APV-###: <short title>

- Status: <Requested | Approved | Rejected | Withdrawn>
- waiting_on_human: <true | false>
- Stop reason code: <NEEDS_HUMAN_APPROVAL | NEEDS_EXTERNAL_EVIDENCE | NEEDS_CREDENTIAL_ROTATION | NEEDS_COMPLIANCE_SIGNOFF | NEEDS_VENDOR_DOC | NEEDS_STAGING_ACCESS>
- Owner: <named human or role>
- Requested by: <agent / human> on YYYY-MM-DD
- What is being approved: <one paragraph>
- Linked artifacts: <DESIGN.md section / TASK-### / FINDING-### / RELEASE_GATES.md item>
- Approval evidence (when Approved): <reference — Slack URL, email, PR comment, doc link>
- Decision date:
- Rationale (Rejected only):
```

## Active approvals

(None yet. `planner (Phase: plan)` opens approvals as needed. Each entry uses the
schema above with real values. Below is a *withdrawn* example so the script
does not count it as a waiting approval.)

### APV-EXAMPLE-001: Example — illustration only, withdrawn

- Status: Withdrawn
- waiting_on_human: false
- Stop reason code: NONE
- Owner: example
- Requested by: template on 2026-05-22
- What is being approved: this is a template example showing the field shape;
  delete this block when adding real approvals
- Linked artifacts: none
- Approval evidence: n/a
- Decision date: 2026-05-22
- Rationale: example only
