# Generic HTTP / gRPC service domain pack

For API services, microservices, internal-tool services.

## sdlc.config.yml

```yaml
SDLC_BASE_BRANCH: main

SDLC_ARTIFACT_HYGIENE_PATTERNS: |
  ^dist/
  ^build/
  ^target/
  ^vendor/
  ^bin/

SDLC_ARENA_ELIGIBILITY_REGEX: "(db/migrations/|api/v[0-9]+/|grpc/|proto/|auth[/_-]?session|webhook[/_-]?handler|rate-?limit)"

SDLC_PROTECTED_PATHS: |
  .env
  config/secrets/
  config/production.yml
  helm/
  kustomize/
  terraform/
```

## Recommended principles

- `principle-no-real-pii-data.md` if the service handles customer data.
- `principle-preserve-domain-invariants.md` already in core — copy +
  rename to project-specific (e.g. `principle-preserve-ratelimit-
  invariants.md`).
