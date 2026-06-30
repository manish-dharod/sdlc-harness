# Visual QA Module

`tools/visual-qa/` is an optional visual QA harness for projects that need
browser-rendered evidence without committing screenshots or baselines by
default.

## Run

```bash
scripts/visual-qa-loop --mode=report
```

Set `VQA_BASE_URL` to the app under test. If unset, capture defaults to
`http://127.0.0.1:3000`.

Reports are written to `tools/visual-qa/reports/<runId>/`, which is ignored by
git.

## Configure Targets

Edit `tools/visual-qa/targets.mjs` in the adopting repo:

- `depth: "content"` for static/content pages with no flow steps.
- `depth: "flow"` for safe, bounded interactions.
- `stop_boundaries` for protected actions that capture must not cross.
- `allowed_differences` for values a vision reviewer should ignore.
- `prod_ref` for optional reference-origin screenshots or comparisons.

## Safety

- Report mode is read-only for tracked code.
- Self-heal mode only runs seeded fixtures in a disposable sandbox.
- Existing snapshots, baselines, masks, thresholds, and visual expectation files
  are forbidden edit surfaces.
- Project-specific staging checks and deployment steps belong in the adopting
  repo's domain pack.

## Tests

```bash
node --test tools/visual-qa/__tests__/*.test.mjs
```
