/**
 * tools/visual-qa/forbidden-edit-guard.mjs — A4 load-bearing safety gate.
 *
 * Exported API:
 *   checkEdit(filePath) → { allowed: boolean, reason: string, escalate: boolean }
 *   DENY_PATTERNS       → RegExp[] — exported so it can be inspected + tested for teeth
 *
 * FORBIDDEN paths (allowed:false, escalate:true) — matched by FILE ROLE, not invented dir names:
 *   - Any path under a *-snapshots/ directory (Playwright visual baselines).
 *   - Any masks.ts / masks.js / masks.json under a playwright dir.
 *   - Any playwright.config.ts / .js / .cjs / .mjs file.
 *   - EXISTING visual-bearing spec files: paths matching *-visual.spec.ts (or .js) — these
 *     carry inline toHaveScreenshot thresholds + snapshot expectations.
 *   - Generic legacy dir-segment forms: baselines/, masks/ dir, thresholds/, thresholds.json
 *     (kept for defence-in-depth on other repo layouts).
 *
 * ALLOWED paths: ordinary product source, tools/visual-qa/**, and genuinely
 * NEW additive gate files that do NOT match the visual-bearing spec pattern.
 *
 * METHOD: match by file ROLE (extension pattern + known path segment) — NOT by invented
 * canonical directory names.  This is the "fingerprint not enumeration" lesson applied to
 * the guard.  The deny patterns are verified against REAL repo paths in the test suite.
 *
 * This is the structural enforcement of the forbidden-edit rule:
 * "Editing/regenerating existing baselines, masks, thresholds, snapshots, or test
 *  expectations to make a check pass."
 *
 * @module forbidden-edit-guard
 */

import path from 'node:path';

// ---------------------------------------------------------------------------
// Deny-pattern list (exported so it can be inspected + unit-tested for teeth).
//
// Each RegExp is tested against the POSIX-normalised file path (forward slashes,
// even on Windows).  Patterns are ordered from most-specific to most-general so
// the first match reason is the clearest.
//
// IMPORTANT: patterns match by FILE ROLE, not invented directory names.
// Each pattern is proven against a real repo path in the test suite.
// ---------------------------------------------------------------------------

/**
 * Deny patterns for forbidden edit paths.
 * Exported for inspection and teeth testing.
 *
 * @type {RegExp[]}
 */
export const DENY_PATTERNS = [
  // ── Visual baseline and threshold surfaces ──────────────────────────────

  // Playwright *-snapshots/ directories and everything inside them.
  // and any future *-snapshots/ dir anywhere.
  /(^|[\\/])[^/]+-snapshots([\\/]|$)/,

  // Mask-definition files: masks.ts / masks.js / masks.json under any playwright dir,
  // Pattern: a path segment named "playwright" followed by /masks.<ext>.
  /(^|[\\/])playwright[\\/]masks?\.(ts|js|json)$/,

  // Playwright config files — the threshold home (maxDiffPixelRatio lives here).
  // Matches any playwright.config.{ts,js,cjs,mjs} anywhere.
  /(^|[\\/])playwright\.config\.(ts|js|cjs|mjs)$/,

  // EXISTING visual-bearing spec files: *-visual.spec.ts (or .js).
  // These carry inline toHaveScreenshot() thresholds + snapshot expectations.
  // NOTE: this intentionally blocks ALL *-visual.spec.ts edits — new visual
  // gate files should use a non-"*-visual.spec.ts" naming convention, or be
  // added with explicit owner approval (the ratchet adds NEW gates; it must not
  // edit EXISTING visual expectations).
  /(^|[\\/])[^/]*-visual\.spec\.(ts|js)$/,

  // ── GENERIC DEFENCE-IN-DEPTH (other repo layouts) ───────────────────────

  // Files or directories named exactly "baseline" or "baselines" (any ancestor).
  /(^|[\\/])baselines?([\\/]|$)/,

  // Files or directories named exactly "mask" or "masks" as a dir segment
  // (e.g. /masks/header-mask.png). NOTE: "masks.ts" at the playwright/ level
  // is already caught by the playwright/masks.* pattern above — this catches
  // a "masks/" directory segment for completeness.
  /(^|[\\/])masks([\\/]|$)/,

  // Files or directories named exactly "thresholds" (any ancestor),
  // OR files named "thresholds.json" anywhere.
  /(^|[\\/])thresholds(\.json)?([\\/]|$)/,
];

// ---------------------------------------------------------------------------
// Human-readable deny-reason descriptions (parallel to DENY_PATTERNS, same order).
// ---------------------------------------------------------------------------

const DENY_REASONS = [
  'Path is inside a Playwright *-snapshots/ directory (visual baseline - forbidden edit)',
  'Path is a mask-definition file under a playwright/ directory (forbidden edit)',
  'Path is a Playwright config file (threshold home - forbidden edit)',
  'Path is a visual-bearing spec file (*-visual.spec.ts/js carries inline thresholds + snapshot expectations - forbidden edit)',
  'Path is a baseline or baselines directory/file (visual baseline - forbidden edit)',
  'Path is a masks directory/file (visual mask directory - forbidden edit)',
  'Path is a thresholds directory/file or thresholds.json (threshold tuning - forbidden edit)',
];

// ---------------------------------------------------------------------------
// checkEdit — the public API.
// ---------------------------------------------------------------------------

/**
 * Check whether editing `filePath` is allowed by the autonomous visual QA loop.
 *
 * Returns:
 *   { allowed: true,  reason: string, escalate: false } — edit is permitted.
 *   { allowed: false, reason: string, escalate: true }  — edit is FORBIDDEN; the loop
 *     MUST escalate this to the owner rather than proceeding silently.
 *
 * The check is purely path-based (no file-system I/O).  It normalises the path to
 * POSIX-style forward slashes before matching, so it works correctly on both macOS
 * and (if ever needed) Windows.
 *
 * @param {string} filePath — absolute or relative path to the file being considered.
 * @returns {{ allowed: boolean, reason: string, escalate: boolean }}
 */
export function checkEdit(filePath) {
  // Normalise to forward slashes for consistent matching.
  const normalised = filePath.split(path.sep).join('/');

  for (let i = 0; i < DENY_PATTERNS.length; i++) {
    if (DENY_PATTERNS[i].test(normalised)) {
      return {
        allowed: false,
        reason: DENY_REASONS[i],
        escalate: true,
      };
    }
  }

  return {
    allowed: true,
    reason: 'Path is within the allowed edit surface (ordinary source, tools/visual-qa, or a new gate file)',
    escalate: false,
  };
}
