---
name: principle-vet-third-party-skills
description: Do not install third-party skills, plugins, or tools on popularity alone. A skill can run arbitrary commands and exfiltrate secrets, and high-star skills have measurably degraded agents in benchmarks. Require a security read and eval evidence before adopting; prefer first-party or vetted sources.
metadata:
  type: principle
  layer: safety
  enforced-by:
    - hooks/guard-bash.sh — command-level guard on what tools can run
    - scripts/sanitize-check / scripts/lib-sanitize.sh — context-scan tripwire
    - owner approval — new skills/plugins are an owner-approved addition
---

# Vet Third-Party Skills

A skill or plugin is executable trust. When you install one you grant it
the ability to run commands on the machine and read whatever the agent
can read — which on a regulated-data surface can include credentials,
tokens, and customer data. A malicious or careless skill can quietly
exfiltrate those to an untrusted third party. That is the security floor.

Above the floor is a quality problem that popularity hides: GitHub stars
measure how widely a thing spread, not whether it helps. Widely-shared
skills have been measured to *degrade* an agent — spending more tokens
and producing worse results than not using them at all. "Lots of stars"
and "named after someone famous" are not evidence of either safety or
quality.

The discipline: treat any third-party skill/plugin/tool as untrusted
until it has passed a security read and has eval evidence, and prefer
first-party or already-vetted sources.

## When to apply

Before installing, enabling, or recommending any third-party skill,
plugin, MCP server, or agent tool — especially one found on the internet,
and especially one that claims to make the agent "smarter" or "better."

## Procedure

1. **Read what it can do.** Inspect the skill/plugin source for the
   commands it runs, the network egress it performs, and the files/secrets
   it can reach. Treat "runs arbitrary shell" + "reaches credentials" as a
   stop until justified.
2. **Demand eval evidence, not stars.** Adopt a performance-claiming skill
   only if it has published a rigorous evaluation, or you run your own
   quick comparison (does it actually improve outcomes / reduce tokens on
   a representative task?). Popularity alone is not a reason.
3. **Prefer vetted sources.** First-party skills, the harness's own
   `examples/domains/*` packs, and the explicitly-installed
   `obra/superpowers` plugin are the trusted set. New third-party
   additions need owner approval.
4. **Keep the guardrails on.** The `hooks/guard-bash.sh` guard and
   `scripts/sanitize-check` tripwire exist so an untrusted tool cannot
   silently run destructive commands or leak sensitive context. Do not
   add permission bypasses to accommodate a skill.

## Anti-patterns

- Installing a high-star "make your agent better" skill without reading
  its source or checking any eval.
- Treating GitHub stars / a famous author's name as a safety or quality
  signal.
- Adding a global permission bypass, broadened allowlist, or sanitizer
  exemption so a third-party tool can run unimpeded.

## the SDLC harness-specific notes

- This is consistent with the existing CLAUDE.md stance: the framework
  does not add global permission bypasses, email-to-agent daemons,
  remote-control defaults, or browser-cookie automation.
- Pairs with `[[principle-tool-ergonomics]]` (efficiency) and
  `[[principle-no-sensitive-domain-data]]` (what must never leak).
- Provenance: adopted 2026-06-30 from external agentic-engineering
  practice (a benchmarked example where a 100k+-star skill increased token
  use ~5% and made results worse; plus the standing exfiltration risk of
  arbitrary-command skills).
