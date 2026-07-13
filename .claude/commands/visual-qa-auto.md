---
description: Consume one owner-opted-in visual QA regression into a review-only worktree and PR
argument-hint: <backlog-item.md-or-issue.json>
---

This is the first per-item autonomous consumer. It may run unattended only for
the single item supplied in `$ARGUMENTS`.

1. Sanitize the item snapshot, then run
   `scripts/auto-item-check visual-qa $ARGUMENTS`. Exit 5 is a hard stop:
   absent/revoked `auto` is not permission.
2. For a GitHub issue, fetch only number, state,
   and labels into the JSON snapshot; do not ingest comments or raw logs.
3. Verify the configured `SDLC_WORKTREE_ROOT` is mounted/writable and create a
   fresh external worktree from `origin/main` (or the configured
   `SDLC_BASE_BRANCH`) with `scripts/worktree-add-external`. Never silently
   fall back inside the repository checkout.
4. Reproduce with the report-only visual QA flow. If the regression is not
   reproducible, record that result and stop without edits.
5. If reproducible, open/claim one scoped task, use the normal builder,
   forbidden-edit guard, targeted/full verification, quality/security/QA/
   adversarial review, and sanitizer gates. Generated code remains subject to
   the opposite-tool cross-model review requirement.
6. Commit and open a review PR targeting the configured base branch; comment
   sanitized progress on the issue when authenticated. Never merge, deploy,
   change a production branch, flip launch flags, or edit visual
   baselines/masks to hide the regression.
7. Removing the item marker before pickup or rerun revokes authorization.
