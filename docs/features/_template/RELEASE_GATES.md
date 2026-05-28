# Release Gates

Last updated: YYYY-MM-DD
Maintained by: planner (Phase: design) (defines gates), release (checks them),
reviewer (Mode: acceptance) (audits AC/NFR coverage)

Machine-checkable launch checklist for this feature. `scripts/feature-ready`
parses this file and emits `READY` only when every gate is `Pass`. Each gate is
a single line with a status marker so a script can grep it without ambiguity.

## Format

```
- [P/F/B] GATE-###: <short title> — <one-line criterion> — evidence: <pointer>
```

- `[P]` Pass — verified, evidence attached
- `[F]` Fail — known failure, blocks release
- `[B]` Blocked — needs external evidence or human approval; cite APV-### or
  the missing evidence

## Gates (default set — extend per feature)

### Spec & traceability

- [ ] GATE-001: Every AC in SPEC.md has a passing test row in TRACEABILITY.md — evidence: TRACEABILITY.md coverage summary
- [ ] GATE-002: Every NFR has a measured-and-passing result — evidence: TRACEABILITY.md NFR rows
- [ ] GATE-003: All QUESTIONS.md questions are `Answered` or `Withdrawn` — evidence: QUESTIONS.md

### Design & threat

- [ ] GATE-010: DESIGN.md status is `Approved` — evidence: DESIGN.md header
- [ ] GATE-011: THREAT_MODEL.md residual risks are accepted in DECISIONS.md or mitigated — evidence: THREAT_MODEL.md + DECISIONS.md
- [ ] GATE-012: MIGRATION_PLAN.md dry-run completed (if migrations exist) — evidence: EVIDENCE.md entry
- [ ] GATE-013: ROLLBACK_PLAN.md tier-1 rollback tested in staging — evidence: EVIDENCE.md entry

### Code & review

- [ ] GATE-020: Zero unresolved P0 or P1 findings (any Source — reviewer (Mode: quality), security, reviewer (Mode: qa), reviewer (Mode: adversarial)) — evidence: FINDINGS.md
- [ ] GATE-021: No generated artifacts in diff per `SDLC_ARTIFACT_HYGIENE_PATTERNS` — evidence: `scripts/feature-ready <slug>` or `git diff --name-status "${SDLC_BASE_BRANCH:-master}..HEAD"`
- [ ] GATE-022: All `Done` tasks have evidence rows — evidence: EVIDENCE.md vs TASKS.md cross-check
- [ ] GATE-023: All `Done` tasks have an adversarial-review trail (EVIDENCE clear/skip with `Source: reviewer (Mode: adversarial)` OR reviewer (Mode: adversarial) FINDINGS with all P0/P1 resolved OR listed in `.adversarial-exempt`) — evidence: `scripts/feature-reconcile <slug>` passes
- [ ] GATE-024: Worktree is hygiene-clean at release (`scripts/worktree-hygiene <slug> --strict` returns `CLEAN` — commit any in-flight checkpoint or revert; the handoff manifest in EVIDENCE.md is informational only and does NOT satisfy this gate) — evidence: `scripts/feature-reconcile <slug>` passes the "Worktree hygiene" section

### Verification

- [ ] GATE-030: `scripts/feature-verify <slug> full` passes — evidence: latest EVIDENCE.md entry
- [ ] GATE-031: Negative-test assertions in TEST_STRATEGY.md pass — evidence: same
- [ ] GATE-032: Flake quarantine list is empty OR explicitly accepted — evidence: EVIDENCE.md

### Observability

- [ ] GATE-040: Required metrics emit in staging — evidence: EVIDENCE.md
- [ ] GATE-041: Required alerts fire on dry-run — evidence: EVIDENCE.md
- [ ] GATE-042: Dashboard / query links exist and are owned — evidence: DESIGN.md observability section

### Launch

- [ ] GATE-050: Feature flag exists and defaults OFF — evidence: code + DESIGN.md
- [ ] GATE-051: Initial scope (carrier / product / geography) confirmed — evidence: DESIGN.md
- [ ] GATE-052: All APPROVALS.md entries are `Approved` — evidence: APPROVALS.md
- [ ] GATE-053: Rollback owner on-call for launch window — evidence: APPROVALS.md APV-###

## Per-feature additions

Add extra gates specific to this feature here. Use the same `GATE-###` numbering.
