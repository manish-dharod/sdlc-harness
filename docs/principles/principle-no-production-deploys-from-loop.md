---
name: principle-no-production-deploys-from-loop
description: Autonomous SDLC iterations (/feature-loop, /loop, agentic SDLC) never deploy to production, change DNS / firewall / panel, mutate live data, flip a launch flag, or send real carrier traffic. Stop and record a Blocked task + APPROVALS entry instead.
metadata:
  type: principle
  layer: operations
  enforced-by:
    - .claude/hooks/guard-bash.sh (production-affecting command denials)
    - .claude/commands/feature-loop.md (safety boundary section)
    - .claude/agents/release.md (read-only release verdict)
    - scripts/feature-ready (exit 2 NEEDS-APPROVAL on launch-gate items)
---

# No Production Deploys From Loop

The agentic SDLC is the *development* loop. It plans, designs,
implements, reviews, and produces a release verdict. It does not deploy.
Every production-affecting action is gated by a human approval, recorded
in APPROVALS.md with an explicit stop-reason code.

The loop is allowed to be impatient with everything except this. Trust
in the loop is built precisely because the loop knows where it stops.

## Non-negotiable, never-from-loop actions

1. **Production deploys.** Pushing code to a production environment,
   merging into a deploy branch that auto-deploys, kicking off a
   CI/CD pipeline whose target is prod.
2. **DNS / firewall / panel changes.** Any change to Cloudflare DNS,
   AWS Route 53, a hosting control panel, server-level firewall rules, or
   Cloudflare WAF.
3. **Live DB mutation.** Any `UPDATE` / `DELETE` / `INSERT` /
   migration run against a production database, including "small,
   surgical" ones.
4. **Launch flag flips that enable production behavior.** Toggling a
   feature flag from off → on (or staged → 100%) in any environment
   where customers see the result. This includes carrier-enable
   flags, payment-method-enable flags, comparison-page-enable flags.
5. **Real carrier traffic.** Submitting an actual policy bind to a
   carrier API. Calling a real-money payment endpoint. Sending a real
   customer email/SMS from the loop.
6. **Force-push, history reset, broad delete, or `--no-verify`** on a
   shared branch.

## When to apply

Every autonomous iteration (`/feature-loop`, recurring `/loop /feature-loop
<slug>`, `builder` running unsupervised). The principle is the *first*
guardrail the loop checks, before any task work.

## Procedure

When the loop encounters work that would require any of the above:

1. **Stop the iteration.** Do not attempt the action.
2. **Open or update an APPROVALS.md entry** with one of the
   stop-reason codes:
   - `NEEDS_HUMAN_APPROVAL`
   - `NEEDS_EXTERNAL_EVIDENCE`
   - `NEEDS_CREDENTIAL_ROTATION`
   - `NEEDS_COMPLIANCE_SIGNOFF`
   - `NEEDS_CARRIER_DOC`
   - `NEEDS_STAGING_ACCESS`
3. **Record a `Blocked` task** citing the APPROVALS entry.
4. **Write the iteration's RUNS.md row** with the stop reason and the
   APPROVALS reference.
5. **Tell the human owner.** The loop's exit message names the
   required approval and how to unblock.

## Anti-patterns

- "It's just a small DNS change" — never.
- "The migration is reversible" — still no. Reversible migrations
  reversed under load have killed real businesses. Owner-gated.
- "The launch flag was already enabled in staging" — staging ≠ prod.
- A `/feature-loop` iteration that runs `kubectl apply -f
  production.yaml` because the diff "looks safe."
- A `git push` with `--force` on a shared branch to "clean up" the
  history.

## the SDLC harness-specific notes

- **VPS / server deploys:** human runs the deploy (e.g. `rsync` +
  a process-manager restart) via the ops runbook. The loop drafts the
  deploy plan; the human executes.
- **secrets vault credential rotation:** strictly compliance-signoff
  gated. The loop opens the APPROVALS entry with `NEEDS_CREDENTIAL_ROTATION`.
- **Cloudflare DNS for `example.com`:** human-managed in the
  Cloudflare panel. The loop never touches it.
- **Carrier sandbox vs. live:** the loop is allowed to hit the
  carrier sandbox (where present and credentialed) per the
  per-feature verification profile. It never hits the live carrier
  endpoint. Verification profiles must distinguish sandbox from
  live by URL prefix or env var.

## How role agents apply this principle

- **builder** must verify its target environment is non-production
  before running any verification step that mutates state.
- **release** is **read-only**. It produces a `READY` / `BLOCKED` /
  `NEEDS_APPROVAL` verdict via `scripts/feature-ready`. It does not
  deploy. The verdict is what the human acts on.
- **planner (Phase: plan)** opens APPROVALS entries on the loop's behalf and
  links them from STATE.md.
- **security** confirms credential / secret / token boundary is
  not crossed by any iteration.

## Source

This principle is the SDLC harness-specific. It crystallizes the operational
safety guarantee the framework was built around: the agentic SDLC is the
development loop, not the deploy loop. The principle exists so that the
loop's autonomy can be expanded everywhere *else* without compromising
this boundary.
