# Domain Pack Authoring

The public harness stays project-neutral. Put product-specific rules in the
adopting repo as a domain pack.

## What Belongs In A Domain Pack

- Business invariants that must not regress, such as balances, pricing,
  eligibility, permissions, quotas, data retention, or workflow completion.
- Protected surfaces that require human approval before agents touch them.
- Branch and deployment policy for the adopting repo.
- Verification profiles and credentials/capability preflights.
- Artifact hygiene patterns for generated files that should not be committed.
- Arena eligibility patterns for high-risk code paths.

## What Stays Out Of The Public Harness

- Private hostnames, IPs, usernames, or deployment commands.
- Product-specific route inventories.
- Customer, regulated, credential, or production data examples.
- Vendor-specific live integration instructions.
- One company's branch names or release process, unless shown as a clearly
  generic placeholder.

## Suggested Files

```text
docs/SDLC_DOMAIN_PACK.md
sdlc.config.yml
docs/principles/principle-preserve-domain-invariants.md
docs/principles/principle-no-sensitive-domain-data.md
scripts/<feature-slug>-verify
```

## Minimal Template

```md
# <Project> SDLC Domain Pack

This repo uses the public `sdlc-harness` as its base. Project-specific rules
live here and should not be promoted back into the public harness unless they
are made generic.

## Installed Principles

- `<principle-file>` - what invariant it protects.

## Config

- `SDLC_BASE_BRANCH: <branch>`
- `SDLC_ARTIFACT_HYGIENE_PATTERNS: <generated artifacts>`
- `SDLC_ARENA_ELIGIBILITY_REGEX: <high-risk paths>`
- Protected paths: `<env/config/credential/vendor-doc paths>`

## Branch And Deployment Policy

- `<integration branch>` receives feature work.
- `<release branch>` is production/live only.
- Production changes require explicit owner approval and current evidence.

## Human Approval Required For

- `<protected workflow>`
- `<regulated or sensitive data>`
- `<live external system>`
- `<production config or deploy action>`
```

## Promotion Rule

If a private rule recurs across projects, promote the mechanism, not the domain
facts. Examples:

- Promote a generic sanitizer hook, not a private customer-data example.
- Promote `scripts/preflight-credentials`, not a real credential path.
- Promote visual QA target schema, not one product's route inventory.
