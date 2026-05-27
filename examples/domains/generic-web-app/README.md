# Generic web-app domain pack

For typical web app projects (Rails, Django, Express, Next.js,
similar).

## sdlc.config.yml

```yaml
SDLC_BASE_BRANCH: main

SDLC_ARTIFACT_HYGIENE_PATTERNS: |
  ^dist/
  ^build/
  ^.next/
  ^node_modules/
  ^public/build/
  ^playwright-report/
  ^cypress/screenshots/

SDLC_ARENA_ELIGIBILITY_REGEX: "(db/migrations/|migrations/|_migration\\.|payment[/_-]?gateway|webhook[/_-]?handler|launch flag|auth[/_-]?session)"

SDLC_PROTECTED_PATHS: |
  .env
  .env.local
  .env.production
  config/credentials.yml
  config/master.key
  deploy/
```

## Recommended principles to add

Copy these from `docs/principles/` (already in the core) — no extras
needed for typical web app work. Consider:

- A `principle-no-real-pii-data.md` if you store customer data
  (template: copy `principle-no-sensitive-domain-data.md` and
  specialize for PII / GDPR).
