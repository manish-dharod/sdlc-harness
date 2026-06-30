/**
 * tools/visual-qa/loop.mjs — Orchestrator core (importable, testable).
 *
 * Report mode + heal-seeded mode.
 *   - report mode (default): Loads targets, runs gates, writes report.
 *     NEVER deploys, NEVER mutates tracked git paths.
 *   - heal-seeded mode: Runs seeded-defect fixtures in a DISPOSABLE SANDBOX.
 *     NEVER touches the main repo tree. Sandbox must be outside REPO_ROOT.
 *     Wires to tools/visual-qa/heal-seeded.mjs; exposes via --mode=heal-seeded.
 *   - outDir defaults to tools/visual-qa/reports/<runId>/ (added to .gitignore).
 *
 * SAFETY PROPERTIES:
 *   1. No deploy path: no pm2/rsync/ssh/deploy/ invocation anywhere in this file.
 *   2. outDir is always an untracked location (tools/visual-qa/reports/ or os.tmpdir()).
 *   3. Vision dispatch is a documented HOOK — defaults to a no-op that emits
 *      "vision pass deferred to discovery agent". The orchestrator itself never
 *      fabricates vision verdicts.
 *
 * DEPENDENCY INJECTION SEAMS (all testable without real I/O):
 *   - seams.capture(target, viewport, captureOpts) → CaptureResult
 *   - seams.runCommand(cmd, args, env) → { exitCode, stdout, stderr }
 *   - seams.visionDispatch(bundle) → { verdict, hypotheses }
 *   - now — timestamp override (for deterministic runId in tests)
 *
 * @module loop
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import { loadTargets } from './manifest.mjs';
import { capture as defaultCapture } from './capture.mjs';
import { runGates } from './deterministic-checks.mjs';
import {
  dedupeIntoClasses,
  confirmHypotheses,
  gateBySeverity,
  toFindings,
} from './triage.mjs';
import { healSeeded } from './heal-seeded.mjs';

// ─── Module-level constants ──────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Repo root — tools/visual-qa/ is two levels below the repo root (matching capture.mjs + deterministic-checks.mjs).
 * Used by validateOutDir to reject outDir paths that would mutate tracked git paths.
 */
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Default report output root — added to .gitignore so report runs never mutate tracked paths. */
export const DEFAULT_REPORTS_ROOT = path.join(__dirname, 'reports');

/** Vision judge prompt path — documented hook for the vision subagent. */
export const VISION_JUDGE_PROMPT_PATH = path.join(__dirname, 'vision-judge.md');

// ─── Default vision dispatch (documented no-op hook) ────────────────────────

/**
 * Default visionDispatch: a no-op hook.
 *
 * The orchestrator itself does NOT fabricate vision verdicts.
 * A vision subagent is given the capture bundle + the vision-judge.md prompt path
 * and runs separately. This default emits the deferred-pass signal.
 *
 * @param {object} _bundle — { target, viewport, captureResult, visionJudgePromptPath }
 * @returns {Promise<{ verdict: string, hypotheses: Array }>}
 */
async function defaultVisionDispatch(_bundle) {
  return {
    verdict: 'vision pass deferred to discovery agent',
    hypotheses: [],
  };
}

// ─── Per-target processing ───────────────────────────────────────────────────

/**
 * Process one target × viewport: capture → gates → vision dispatch.
 *
 * @param {import('./manifest.mjs').Target} target
 * @param {string} viewport
 * @param {object} seams
 * @param {string} captureOutDir — directory for screenshot files
 * @returns {Promise<{ captureResult: object, gateResults: object, visionResult: object }>}
 */
async function processTargetViewport(target, viewport, seams, captureOutDir) {
  // 1. Capture (screenshots, DOM, console, network, flow steps).
  const captureResult = await seams.capture(target, viewport, { outDir: captureOutDir });

  // 2. Deterministic gates - truth layer runs first.
  const gateResults = await runGates(target, {
    runCommand: seams.runCommand,
    captureResult,
  });

  // 3. Vision dispatch hook - documented seam.
  //    The loop writes the bundle + prompt path into the report so a vision subagent
  //    can run discovery. The loop itself never fabricates verdicts.
  const visionBundle = {
    target: target.id,
    viewport,
    captureResult,
    visionJudgePromptPath: VISION_JUDGE_PROMPT_PATH,
  };
  const visionResult = await seams.visionDispatch(visionBundle);

  return { captureResult, gateResults, visionResult };
}

// ─── Signal collection ───────────────────────────────────────────────────────

/**
 * Collect raw signals from gate results and vision hypotheses for a target × viewport.
 *
 * Red deterministic gates → 'deterministic-gate' signals (already confirmed).
 * Vision hypotheses → 'vision-hypothesis' signals (need confirmation).
 *
 * @param {import('./manifest.mjs').Target} target
 * @param {string} viewport
 * @param {object} gateResults
 * @param {object} visionResult
 * @returns {import('./triage.mjs').RawSignal[]}
 */
function collectSignals(target, viewport, gateResults, visionResult) {
  const signals = [];

  // Red deterministic gates → confirmed defect signals.
  for (const gate of gateResults.results) {
    if (!gate.passed) {
      signals.push({
        source: 'deterministic-gate',
        route: target.route,
        viewport,
        category: gateCategory(gate.id),
        signature: gate.id,
        observed: gate.summary,
        expected: `Gate '${gate.id}' must pass`,
      });
    }
  }

  // Vision hypotheses → need confirmation before they become findings.
  for (const hyp of (visionResult.hypotheses ?? [])) {
    signals.push({
      source: 'vision-hypothesis',
      route: hyp.route ?? target.route,
      viewport: hyp.viewport ?? viewport,
      category: hyp.category ?? 'visual-broken',
      signature: hyp.signature ?? `vision-${target.id}-${viewport}`,
      observed: hyp.observed ?? 'Vision hypothesis',
      expected: hyp.expected ?? 'Matches production reference',
    });
  }

  return signals;
}

/**
 * Map a gate id to the best-guess defect category.
 *
 * Capture-derived gates (no-console-errors, no-failed-requests, no-broken-images)
 * are functional-broken because they indicate a runtime error or asset failure.
 *
 * @param {string} gateId
 * @returns {'functional-broken'|'visual-broken'|'cosmetic'}
 */
function gateCategory(gateId) {
  if (gateId === 'no-console-errors' || gateId === 'no-failed-requests' || gateId === 'no-broken-images') {
    return 'functional-broken';
  }
  if (gateId.startsWith('check-') || gateId === 'smoke-all') {
    return 'visual-broken';
  }
  return 'visual-broken';
}

// ─── Report writing ──────────────────────────────────────────────────────────

/**
 * Write structured JSON + human markdown report to outDir.
 *
 * The report dir is either the injected outDir (tests use tmpdir) or
 * DEFAULT_REPORTS_ROOT/<runId>/ (default run). Both are untracked.
 *
 * @param {object} report
 * @param {string} outDir
 * @param {string} runId
 */
function writeReport(report, outDir, runId) {
  fs.mkdirSync(outDir, { recursive: true });

  // JSON report — machine-parseable, full fidelity.
  const jsonPath = path.join(outDir, `report-${runId}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

  // Markdown summary — human-readable.
  const mdPath = path.join(outDir, `report-${runId}.md`);
  const md = buildMarkdownSummary(report, runId);
  fs.writeFileSync(mdPath, md, 'utf8');
}

/**
 * Build a human-readable markdown summary of the report.
 *
 * @param {object} report
 * @param {string} runId
 * @returns {string}
 */
function buildMarkdownSummary(report, runId) {
  const lines = [
    `# Visual QA Report — ${runId}`,
    ``,
    `**Date:** ${report.date}`,
    `**Mode:** ${report.mode}`,
    `**Verdict:** ${report.verdict}`,
    ``,
    `## Targets processed`,
    ``,
  ];

  for (const t of report.targets) {
    const gateStatus = t.gateResults?.allPassed ? 'PASS' : `FAIL (${t.gateResults?.failed?.join(', ') ?? '?'})`;
    lines.push(`- **${t.id}** (${t.depth} / ${t.viewports?.join('+')}) — gates: ${gateStatus}`);
  }

  lines.push(``, `## Findings`, ``);

  if (report.findings.mustFix.length === 0 && report.findings.logged.length === 0) {
    lines.push(`No findings. All gates passed.`);
  } else {
    if (report.findings.mustFix.length > 0) {
      lines.push(`### Must Fix (${report.findings.mustFix.length})`, ``);
      for (const f of report.findings.mustFix) {
        lines.push(`- **${f.id}** [${f.severity}] ${f.observed} (${f.page})`);
      }
    }
    if (report.findings.logged.length > 0) {
      lines.push(``, `### Cosmetic / Logged (${report.findings.logged.length})`, ``);
      for (const f of report.findings.logged) {
        lines.push(`- **${f.id}** [${f.severity}] ${f.observed} (${f.page})`);
      }
    }
  }

  lines.push(``, `## Vision discovery`, ``);
  lines.push(
    `Vision subagent discovery is deferred. To run vision discovery:`,
    `1. Pass the capture bundle paths and the vision judge prompt (\`tools/visual-qa/vision-judge.md\`)`,
    `   to a vision-capable subagent.`,
    `2. The subagent's hypothesis output feeds back into a subsequent triage run.`,
    ``,
    `Vision judge prompt: \`${VISION_JUDGE_PROMPT_PATH}\``,
  );

  return lines.join('\n') + '\n';
}

// ─── Main orchestrator function (exported for unit tests) ────────────────────

/**
 * Run the visual QA orchestrator.
 *
 * Report mode (default).
 *   - Discovers targets, runs gates, writes report.
 *   - NEVER deploys, NEVER mutates tracked git paths.
 *   - outDir must be an untracked location.
 *
 * @param {object} opts
 * @param {'report'|'heal-seeded'} [opts.mode='report']  — 'report' or 'heal-seeded'.
 * @param {import('./manifest.mjs').Target[]} [opts.targets] — inject targets (default: loadTargets()).
 * @param {object} [opts.seams]                    — DI seams for tests.
 * @param {Function} [opts.seams.capture]          — async (target, viewport, opts) => CaptureResult.
 * @param {Function} [opts.seams.runCommand]       — async (cmd, args, env) => { exitCode, stdout, stderr }.
 * @param {Function} [opts.seams.visionDispatch]   — async (bundle) => { verdict, hypotheses }.
 * @param {string} [opts.outDir]                   — where to write reports (default: DEFAULT_REPORTS_ROOT/<runId>).
 * @param {string|number} [opts.runId]             — deterministic id for tests; defaults to Date.now().
 * @param {string} [opts.sandboxDir]               — for heal-seeded mode: disposable sandbox dir (must be outside repo).
 * @returns {Promise<{ mode, runId, date, targets, findings, verdict }|import('./heal-seeded.mjs').HealResult>}
 */
/**
 * Validate the resolved outDir.
 *
 * Accepts ONLY:
 *   (a) any path outside REPO_ROOT, OR
 *   (b) a path inside REPO_ROOT that is under DEFAULT_REPORTS_ROOT (gitignored).
 *
 * Rejects any outDir that is inside REPO_ROOT but NOT under DEFAULT_REPORTS_ROOT,
 * because that would write report files into tracked git paths (violating the
 * "never mutates tracked paths" guarantee).
 *
 * The check is purely path-prefix based and does NOT depend on any git subprocess,
 * so it works correctly even when git is unavailable.
 *
 * @param {string} resolvedOutDir — absolute, already-resolved path
 * @throws {Error} if the path is inside the repo but not under the gitignored reports root
 */
function validateOutDir(resolvedOutDir) {
  // Normalise paths with trailing sep so prefix check is unambiguous
  // (avoids /foo/bar matching /foo/barbaz).
  const repoPfx = REPO_ROOT.endsWith(path.sep) ? REPO_ROOT : REPO_ROOT + path.sep;
  const reportsPfx = DEFAULT_REPORTS_ROOT.endsWith(path.sep)
    ? DEFAULT_REPORTS_ROOT
    : DEFAULT_REPORTS_ROOT + path.sep;

  const isInsideRepo = resolvedOutDir.startsWith(repoPfx) || resolvedOutDir === REPO_ROOT;
  const isUnderReports =
    resolvedOutDir.startsWith(reportsPfx) || resolvedOutDir === DEFAULT_REPORTS_ROOT;

  if (isInsideRepo && !isUnderReports) {
    throw new Error(
      `outDir validation failed: '${resolvedOutDir}' is inside the repo working tree but not ` +
      `under the gitignored reports root (${DEFAULT_REPORTS_ROOT}). ` +
      `Use a path under tools/visual-qa/reports/ or an external path (e.g. os.tmpdir()).`
    );
  }
}

export async function runLoop(opts = {}) {
  const mode = opts.mode ?? 'report';

  // ── heal-seeded mode ───────────────────────────────────────────────────
  // Delegates entirely to heal-seeded.mjs which enforces sandbox isolation.
  // The main repo tree is NEVER touched in this mode.
  if (mode === 'heal-seeded') {
    return healSeeded({
      sandboxDir: opts.sandboxDir,
      fixtures: opts.fixtures,
      forbiddenGuard: opts.forbiddenGuard,
      oscillation: opts.oscillation,
    });
  }

  // P3 fix: derive runId and date from injectable `now` seam (default: Date.now()).
  const now = typeof opts.now === 'number' ? opts.now : Date.now();
  const runId = String(opts.runId ?? now);
  const date = new Date(now).toISOString().slice(0, 10);

  // Resolve seams (DI for testability).
  const seams = {
    capture: opts.seams?.capture ?? defaultCapture,
    runCommand: opts.seams?.runCommand ?? undefined, // undefined → runGates uses its own default
    visionDispatch: opts.seams?.visionDispatch ?? defaultVisionDispatch,
  };

  // Resolve targets (injected or loaded from manifest).
  const targets = opts.targets ?? loadTargets();

  // Resolve outDir — must be an untracked location (never tracked git paths).
  const outDir = path.resolve(opts.outDir ?? path.join(DEFAULT_REPORTS_ROOT, runId));

  // Validate the resolved outDir BEFORE any I/O.
  // Rejects any path inside REPO_ROOT that is not under DEFAULT_REPORTS_ROOT.
  validateOutDir(outDir);

  // Capture sub-directory (screenshots live here, also untracked).
  const captureOutDir = path.join(outDir, 'captures');

  // ── DISCOVERY: breadth-first, read-only ─────────────────────────────────

  /** @type {Array<{ id, depth, viewports, gateResults, visionResults }>} */
  const targetEntries = [];
  /** @type {import('./triage.mjs').RawSignal[]} */
  const allSignals = [];

  for (const target of targets) {
    // Per-target isolation. If capture/gates throw for one target,
    // record an error entry and continue to the next target — do not abort the run.
    try {
      const viewportGateResults = [];
      const viewportVisionResults = [];

      for (const viewport of target.viewports) {
        const { captureResult, gateResults, visionResult } = await processTargetViewport(
          target,
          viewport,
          seams,
          captureOutDir,
        );

        viewportGateResults.push({ viewport, ...gateResults });
        viewportVisionResults.push({ viewport, verdict: visionResult.verdict });

        // Collect raw signals for triage.
        const signals = collectSignals(target, viewport, gateResults, visionResult);
        allSignals.push(...signals);
      }

      // Summarise gate results across viewports (allPassed = ALL viewports passed).
      const allPassed = viewportGateResults.every(r => r.allPassed);
      const failed = [...new Set(viewportGateResults.flatMap(r => r.failed ?? []))];

      targetEntries.push({
        id: target.id,
        route: target.route,
        depth: target.depth,
        viewports: target.viewports,
        gateResults: { allPassed, failed, viewports: viewportGateResults },
        visionResults: viewportVisionResults,
      });
    } catch (err) {
      // Record the error in the report and continue processing other targets.
      targetEntries.push({
        id: target.id,
        route: target.route,
        depth: target.depth,
        viewports: target.viewports,
        status: 'errored',
        error: err.message ?? String(err),
      });
    }
  }

  // ── TRIAGE ───────────────────────────────────────────────────────────────

  const classes = dedupeIntoClasses(allSignals);

  // Confirm vision hypotheses against the live tree.
  // In report mode, deterministic-gate classes pass through; vision hypotheses
  // are confirmed via an injected predicate (default: pass through for now,
  // since real confirmation requires a live browser.
  const confirmed = await confirmHypotheses(classes, {
    confirm: async (cls) => {
      // Default public behavior: confirm all vision hypotheses as-is (no live re-check).
      // Adopting repos should replace this seam when they can re-check live DOM state.
      // deterministic-gate classes always pass through (handled in confirmHypotheses).
      return true;
    },
  });

  const { mustFix, logged } = gateBySeverity(confirmed);

  const mustFixFindings = toFindings(mustFix, { target_feature: 'visual-qa' });
  const loggedFindings = toFindings(logged, { target_feature: 'visual-qa' });

  // ── VERDICT ──────────────────────────────────────────────────────────────

  let verdict;
  if (mustFixFindings.length === 0 && loggedFindings.length === 0) {
    verdict = 'all-clear: no findings; all gates passed';
  } else if (mustFixFindings.length > 0) {
    verdict = `needs-fix: ${mustFixFindings.length} must-fix finding(s); ${loggedFindings.length} cosmetic`;
  } else {
    verdict = `cosmetic-only: ${loggedFindings.length} cosmetic finding(s); no blockers`;
  }

  // ── REPORT ───────────────────────────────────────────────────────────────

  const report = {
    mode,
    runId,
    date,
    targets: targetEntries,
    findings: {
      mustFix: mustFixFindings,
      logged: loggedFindings,
    },
    verdict,
    visionJudgePromptPath: VISION_JUDGE_PROMPT_PATH,
    meta: {
      visionNote:
        'Vision discovery is a documented hook. Pass the capture bundles and ' +
        'vision-judge.md to a vision-capable subagent for full discovery. This report ' +
        'reflects deterministic-gate results only.',
    },
  };

  // Write to outDir (untracked — reports/ is in .gitignore).
  writeReport(report, outDir, runId);

  return report;
}
