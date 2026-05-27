# Threat Model

Last updated: YYYY-MM-DD
Author: planner (Phase: design), reviewed by security

Whole-feature threat model. Per-diff security review (security on each diff)
covers tactical issues; this file is strategic. Required before any task moves
Backlog→Open if the feature touches: payment, auth, webhooks, secrets, PII,
external APIs with credentials, or anything that affects the launch gate.

## Trust boundaries

List each component pair where data crosses a trust level. Mark direction.

- Browser → public API
- Public API → internal service
- Internal service → vendor API
- App → DB
- App → webhook receiver

## Data classification

For every field the feature touches, classify it.

| Field | Classification | At rest | In transit | In logs |
|---|---|---|---|---|
| <field> | PCI / PII / credential / public | encrypted? | TLS? | redacted? |

## Threats (STRIDE)

For each threat type, list applicable threats, the asset at risk, the mitigation
in `DESIGN.md`, and the residual risk.

### Spoofing

- Threat: ...
- Asset: ...
- Mitigation (link to DESIGN section): ...
- Residual risk: low / medium / high
- Owner: name

### Tampering

(repeat)

### Repudiation

### Information disclosure

### Denial of service

### Elevation of privilege

## Compliance scope

- PCI: in scope / out of scope; explain
- PII: in scope / out of scope; explain
- Vendor contractual: any specific vendor requirements
- Regulatory (GDPR, HIPAA, sector-specific, etc.): ...

## Required external evidence

Things that cannot be verified in this repo and must be attached as evidence
later. Each is a `Blocked` finding until external proof arrives.

- Rotated credentials configured outside git
- Vendor sandbox proof of <behavior>
- Compliance signoff (named human, date)
- secrets vault hosted-iframe scope review

## Residual risks accepted

Risks the owner has explicitly chosen to accept. Record in `DECISIONS.md` as
`DEC-###` with rationale.
