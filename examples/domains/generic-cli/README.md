# Generic CLI / library domain pack

For command-line tools, language libraries, package-manager-distributed
software (npm, pip, gem, crates, etc.).

## sdlc.config.yml

```yaml
SDLC_BASE_BRANCH: main

# Most CLI / lib projects don't need bundle hygiene — adjust per language
SDLC_ARTIFACT_HYGIENE_PATTERNS: |
  ^dist/
  ^build/
  ^target/
  ^htmlcov/
  ^.coverage
  ^.tox/
  ^.pytest_cache/

# CLI / lib high-risk surfaces are usually api-contract changes and
# version bumps with breaking-change implications.
SDLC_ARENA_ELIGIBILITY_REGEX: "(public-?api|breaking-?change|major-?version|cli[/_-]?contract)"

SDLC_PROTECTED_PATHS: |
  CHANGELOG.md
  pyproject.toml
  package.json
  Cargo.toml
  go.mod
```

## Recommended principles

- Keep the 5 universal principles in `docs/principles/`.
- Add a `principle-no-breaking-api-changes-without-deprecation.md`
  for any project that distributes a public API.
