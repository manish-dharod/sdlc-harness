/**
 * tools/visual-qa/heal-seeded.mjs — Seeded-defect self-heal engine (A4/A5/A7).
 *
 * Self-heal ONLY seeded defects in a DISPOSABLE SANDBOX.
 * Never touches the main repo tree.
 *
 * Exported API:
 *   healSeeded(opts) → Promise<HealResult>
 *   OscillationError — Error subclass thrown / included in verdict on oscillation
 *
 * SANDBOX ISOLATION SAFETY:
 *   sandboxDir MUST be outside REPO_ROOT.  The guard computes REPO_ROOT from this
 *   file's own location (tools/visual-qa/ → 2 ups = repo root), matching capture.mjs
 *   and deterministic-checks.mjs.  The guard resolves symlinks via fs.realpathSync
 *   so a symlinked sandboxDir whose TARGET is inside the repo is also rejected.
 *   If sandboxDir is inside REPO_ROOT (after symlink resolution), healSeeded()
 *   REJECTS immediately with a descriptive error.
 *
 *   Default sandbox: os.tmpdir() / vqa-heal-<timestamp>  (disposable, outside repo).
 *
 * FORBIDDEN-EDIT GUARD (A4) — API-COMPLETE POST-FIX DIFF:
 *   After applying a fixture's fix(), we walk the sandbox tree, diff it against a
 *   pre-fix snapshot, and run checkEdit() on EVERY changed/created path.  If any
 *   changed path is forbidden, the fixture is REFUSED + escalated.
 *
 *   This approach is METHOD-AGNOSTIC: it catches any write mechanism the fix() might
 *   use (writeFileSync, copyFileSync, renameSync, writeSync(fd), async writes, streams,
 *   etc.) because the check operates on the resulting filesystem tree, not on the
 *   write API.  The post-hoc diff cannot be bypassed by choosing a different write API.
 *
 *   This replaces weaker per-method fs monkey-patching, which can miss write
 *   APIs the fixture author did not anticipate.
 *
 * PER-FIXTURE CYCLE (A7 teeth proof):
 *   For each fixture, ONE class at a time:
 *     1. inject()       — write the defective state to sandboxDir
 *     2. detectingGate()  → must return false (RED)
 *     3. snapshot pre-fix state of sandboxDir
 *     4. fix()          — apply the correct patch to sandboxDir
 *     5. diff post-fix tree vs pre-fix snapshot; run checkEdit() on every changed path
 *     6. If any changed path is forbidden → REFUSE + escalate; skip gate check
 *     7. detectingGate()  → must return true (GREEN)
 *     8. inject()       — re-introduce the defect (teeth re-check)
 *     9. detectingGate()  → must return false (RED again = teeth proven)
 *     → record { id, injected, detectedRed, fixAllowed, fixedGreen, reinjectRed, gateAuthored }
 *
 * OSCILLATION GUARD (A5):
 *   Tracks per-fixture attempts.  Halts with oscillation verdict if:
 *     (a) no-progress for maxNoProgressAttempts (default 3) consecutive rounds, or
 *     (b) the same fix content hash repeats maxSameHashAttempts (default 2) times.
 *   The halt reason string correctly identifies which guard tripped (no-progress vs
 *   same-hash), so operators can diagnose oscillation without confusion.
 *
 * @module heal-seeded
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { checkEdit } from './forbidden-edit-guard.mjs';
import { ALL_FIXTURES } from './seeded-defects/index.mjs';

// ─── Module-level constants ──────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Repo root — tools/visual-qa/ is 2 levels below the repo root.
 * Used by the isolation guard to reject sandboxDir inside the main repo.
 */
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ─── OscillationError ────────────────────────────────────────────────────────

/**
 * Thrown / included in result.verdict when the oscillation guard halts the loop.
 *
 * @extends Error
 */
export class OscillationError extends Error {
  /**
   * @param {string} reason — human-readable stop reason.
   * @param {object} detail — extra context (fixtureId, attemptCount, etc.)
   */
  constructor(reason, detail = {}) {
    super(`Oscillation halt: ${reason}`);
    this.name = 'OscillationError';
    this.reason = reason;
    this.detail = detail;
  }
}

// ─── Isolation guard ─────────────────────────────────────────────────────────

/**
 * Resolve symlinks for the nearest existing ancestor of `targetPath`.
 * We must resolve symlinks rather than using path.resolve (which is lexical)
 * because a symlink outside the repo can target a dir inside the repo.
 *
 * @param {string} targetPath — absolute path (may not exist yet).
 * @returns {string} real absolute path of the nearest existing ancestor.
 */
function realpathOfNearestAncestor(targetPath) {
  let p = targetPath;
  // Walk up until we find an existing path or hit the filesystem root.
  while (p !== path.dirname(p)) {
    try {
      return fs.realpathSync(p);
    } catch {
      p = path.dirname(p);
    }
  }
  // Fallback: return the path as-is (should never reach here on a valid filesystem).
  return targetPath;
}

/**
 * Validate that sandboxDir is OUTSIDE REPO_ROOT.
 * Uses fs.realpathSync to resolve symlinks before the prefix check, so a symlinked
 * sandboxDir whose TARGET is inside the repo is also correctly rejected.
 * Throws a descriptive error if not.
 *
 * @param {string} sandboxDir — resolved absolute path (from path.resolve).
 * @throws {Error} if sandboxDir (after symlink resolution) is inside REPO_ROOT.
 */
function assertSandboxIsolated(sandboxDir) {
  // Resolve the real (symlink-resolved) path of the nearest existing ancestor.
  // The sandboxDir itself may not exist yet (it gets created after this check).
  const realSandbox = realpathOfNearestAncestor(sandboxDir);
  const realRepo = (() => {
    try { return fs.realpathSync(REPO_ROOT); } catch { return REPO_ROOT; }
  })();

  const repoPfx = realRepo.endsWith(path.sep) ? realRepo : realRepo + path.sep;
  const isInsideRepo =
    realSandbox === realRepo ||
    realSandbox.startsWith(repoPfx);

  if (isInsideRepo) {
    throw new Error(
      `sandbox isolation violation: sandboxDir '${sandboxDir}' resolves to ` +
      `'${realSandbox}', which is inside REPO_ROOT ('${realRepo}'). ` +
      `healSeeded MUST run in a disposable sandbox OUTSIDE the main ` +
      `repo tree (e.g. os.tmpdir() or another explicit scratch directory). ` +
      `Never pass the main repo root, any tracked path, or a symlink into the ` +
      `repo as sandboxDir.`
    );
  }
}

// ─── Default sandbox dir ─────────────────────────────────────────────────────

/**
 * Compute a fresh disposable sandbox dir.
 *
 * @returns {string} absolute path (NOT yet created).
 */
function defaultSandboxDir() {
  const ts = Date.now();
  return path.join(os.tmpdir(), `vqa-heal-${ts}`);
}

// ─── Utility: compute a short hash of a fixture's fix output ─────────────────

/**
 * Compute a short hash representing "what the fix wrote to the sandbox".
 * Used by the oscillation guard to detect same-content repeated fixes.
 *
 * Lists all files in sandboxDir, reads their contents, concatenates, and hashes.
 *
 * @param {string} sandboxDir
 * @returns {string} hex hash string
 */
function sandboxHash(sandboxDir) {
  let combined = '';
  try {
    const entries = fs.readdirSync(sandboxDir).sort();
    for (const entry of entries) {
      const filePath = path.join(sandboxDir, entry);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        combined += entry + ':' + fs.readFileSync(filePath, 'utf8') + '\n';
      }
    }
  } catch { /* sandbox may be empty or non-existent */ }
  return crypto.createHash('sha256').update(combined).digest('hex').slice(0, 16);
}

// ─── A4 post-fix diff helper ─────────────────────────────────────────────────

/**
 * Walk a directory tree and return a Map<relativePath, contentHash>.
 * Used to snapshot the sandbox before and after fix(), so we can diff them.
 *
 * @param {string} dir — root directory to walk.
 * @returns {Map<string, string>} relative paths → sha256 of content (or '' for dirs).
 */
function snapshotTree(dir) {
  const snap = new Map();
  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d); } catch { return; }
    for (const entry of entries) {
      const full = path.join(d, entry);
      const rel = path.relative(dir, full);
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (stat.isDirectory()) {
        snap.set(rel, '');
        walk(full);
      } else {
        let content;
        try { content = fs.readFileSync(full); } catch { content = Buffer.alloc(0); }
        snap.set(rel, crypto.createHash('sha256').update(content).digest('hex'));
      }
    }
  }
  walk(dir);
  return snap;
}

/**
 * Compute the set of relative paths that changed/appeared in `after` vs `before`.
 *
 * @param {Map<string, string>} before
 * @param {Map<string, string>} after
 * @returns {string[]} relative paths that were created or modified.
 */
function diffTrees(before, after) {
  const changed = [];
  for (const [rel, hash] of after) {
    if (!before.has(rel) || before.get(rel) !== hash) {
      changed.push(rel);
    }
  }
  return changed;
}

/**
 * A4 post-fix guard: run checkEdit on every path the fix() changed/created.
 * Returns the first forbidden result found, or null if all are allowed.
 *
 * This is METHOD-AGNOSTIC — it catches any write mechanism because it works
 * on the resulting filesystem state, not on write API interception.
 *
 * @param {string} sandboxDir
 * @param {Map<string, string>} preFix — sandbox snapshot before fix().
 * @returns {{ path: string, reason: string } | null}
 */
function checkPostFixTree(sandboxDir, preFix) {
  const postFix = snapshotTree(sandboxDir);
  const changed = diffTrees(preFix, postFix);
  for (const rel of changed) {
    const absPath = path.join(sandboxDir, rel);
    const check = checkEdit(absPath);
    if (!check.allowed) {
      return { path: absPath, reason: check.reason };
    }
  }
  return null;
}

// ─── Per-fixture heal cycle ───────────────────────────────────────────────────

/**
 * @typedef {Object} FixtureResult
 * @property {string}  id           — fixture identifier
 * @property {boolean} injected     — true if inject() succeeded
 * @property {boolean} detectedRed  — true if gate was RED after injection (A7 step 2)
 * @property {boolean} fixAllowed   — true if forbidden-edit guard ALLOWED the fix (A4)
 * @property {boolean} [fixedGreen] — true if gate was GREEN after fix (A7 step 7); absent if refused
 * @property {boolean} [reinjectRed]— true if gate was RED after re-inject (A7 step 9 — teeth)
 * @property {boolean} [escalated]  — true if the fix was refused by the forbidden-edit guard
 * @property {string}  gateAuthored — description of the deterministic gate that locks the fix
 * @property {string}  [oscReason]  — set if oscillation halt triggered for this fixture
 */

/**
 * Run the A7 heal cycle for one fixture.
 *
 * @param {object} fixture           — the seeded defect fixture (see seeded-defects/*.mjs)
 * @param {string} sandboxDir        — disposable sandbox dir (outside REPO_ROOT)
 * @param {{ maxNoProgressAttempts:number, maxSameHashAttempts:number }} oscillation
 * @returns {FixtureResult}
 */
function runFixtureCycle(fixture, sandboxDir, oscillation) {
  const result = {
    id: fixture.id,
    injected: false,
    detectedRed: false,
    fixAllowed: false,
    gateAuthored: fixture.gateDescription ?? `gate for ${fixture.id}`,
  };

  // ── Step 1: inject the defect ──────────────────────────────────────────────
  fixture.inject(sandboxDir);
  result.injected = true;

  // ── Step 2: detectingGate should be RED (false = gate fails) ──────────────
  const afterInject = fixture.detectingGate(sandboxDir);
  result.detectedRed = !afterInject; // RED = gate returned false

  // ── Step 3: snapshot the pre-fix sandbox state ────────────────────────────
  //
  // A4 post-fix diff guard: we snapshot the sandbox BEFORE fix() runs, then
  // after fix() we diff the tree and run checkEdit() on every changed/created path.
  // This is API-complete (method-agnostic) — no fs monkey-patching required.
  //
  const preFix = snapshotTree(sandboxDir);

  // ── Step 4: run fix() ──────────────────────────────────────────────────────
  let fixError = null;
  try {
    fixture.fix(sandboxDir);
  } catch (e) {
    fixError = e;
  }

  // ── Step 5: A4 post-fix forbidden-edit check ──────────────────────────────
  const forbiddenWrite = checkPostFixTree(sandboxDir, preFix);

  if (forbiddenWrite) {
    // A4: fix wrote to a forbidden baseline/snapshot/mask/threshold path.
    result.fixAllowed = false;
    result.escalated = true;
    result.fixedGreen = false;
    result.reinjectRed = false;
    return result;
  }

  if (fixError) {
    // fix() threw for a non-guard reason — treat as not-allowed to be safe.
    result.fixAllowed = false;
    result.escalated = false;
    result.fixedGreen = false;
    result.reinjectRed = false;
    return result;
  }

  result.fixAllowed = true;

  // ── Step 7: detectingGate should be GREEN (true = gate passes) ────────────
  const afterFix = fixture.detectingGate(sandboxDir);
  result.fixedGreen = afterFix;

  if (!result.fixedGreen) {
    // Fix didn't actually fix the defect — that's an oscillation/no-progress signal.
    result.reinjectRed = false;
    return result;
  }

  // ── Step 8: re-inject to prove teeth ──────────────────────────────────────
  fixture.inject(sandboxDir);

  // ── Step 9: detectingGate should be RED again ─────────────────────────────
  const afterReinject = fixture.detectingGate(sandboxDir);
  result.reinjectRed = !afterReinject; // RED again = teeth proven

  return result;
}

// ─── Main exported function ──────────────────────────────────────────────────

/**
 * @typedef {Object} HealResult
 * @property {FixtureResult[]} fixtures — one entry per fixture processed
 * @property {'all-passed'|string} verdict — overall outcome
 * @property {string} [oscillationReason] — set when oscillation halted the run
 */

/**
 * Run the seeded-defect self-heal cycle.
 *
 * SAFETY: refuses to run if sandboxDir is inside REPO_ROOT (after symlink resolution).
 * All fixture I/O is confined to sandboxDir (outside the main repo).
 *
 * @param {object} opts
 * @param {string}  [opts.sandboxDir]      — disposable sandbox dir (default: tmpdir).
 *                                           MUST be outside REPO_ROOT.
 * @param {Array}   [opts.fixtures]        — fixtures to run (default: ALL_FIXTURES).
 * @param {object}  [opts.forbiddenGuard]  — custom guard (default: checkEdit from forbidden-edit-guard.mjs).
 * @param {object}  [opts.oscillation]     — oscillation tuning.
 * @param {number}  [opts.oscillation.maxNoProgressAttempts=3]  — halt if no progress N times.
 * @param {number}  [opts.oscillation.maxSameHashAttempts=2]    — halt if same fix hash N times.
 * @returns {Promise<HealResult>}
 */
export async function healSeeded(opts = {}) {
  // ── Resolve sandboxDir ───────────────────────────────────────────────────
  const sandboxDir = path.resolve(opts.sandboxDir ?? defaultSandboxDir());

  // ── Isolation guard (symlink-aware) ─────────────────────────────────────
  assertSandboxIsolated(sandboxDir);

  // ── Create sandbox if not exists ────────────────────────────────────────
  fs.mkdirSync(sandboxDir, { recursive: true });

  // ── Resolve fixtures ─────────────────────────────────────────────────────
  const fixtures = opts.fixtures ?? ALL_FIXTURES;

  // ── Oscillation config ───────────────────────────────────────────────────
  const oscillationOpts = {
    maxNoProgressAttempts: opts.oscillation?.maxNoProgressAttempts ?? 3,
    maxSameHashAttempts: opts.oscillation?.maxSameHashAttempts ?? 2,
  };

  // ── Per-fixture cycle ────────────────────────────────────────────────────
  /** @type {FixtureResult[]} */
  const fixtureResults = [];
  let overallEscalated = false;
  let oscillationReason = null;

  for (const fixture of fixtures) {
    // Oscillation state for this fixture.
    let noProgressCount = 0;
    let sameHashCount = 0;
    let lastHash = null;
    let fixtureResult = null;
    let halted = false;

    // We run the cycle once (or retry up to oscillation limits if no progress).
    while (noProgressCount < oscillationOpts.maxNoProgressAttempts) {
      // Run the A7 cycle for this fixture.
      fixtureResult = runFixtureCycle(fixture, sandboxDir, oscillationOpts);

      // Oscillation: same-hash check (same fix content repeated).
      const currentHash = sandboxHash(sandboxDir);
      if (currentHash === lastHash) {
        sameHashCount++;
        if (sameHashCount >= oscillationOpts.maxSameHashAttempts) {
          // Attribute same-hash halts correctly, not as "no-progress".
          oscillationReason = `same-hash halt: fixture '${fixture.id}' produced the same fix content ` +
            `${sameHashCount} consecutive times (diff-hash: ${currentHash})`;
          halted = true;
          break;
        }
      } else {
        sameHashCount = 0;
      }
      lastHash = currentHash;

      // Progress check: if all phases passed (or fixture was escalated), we're done.
      if (fixtureResult.escalated) {
        overallEscalated = true;
        break; // Escalated — don't retry.
      }

      if (fixtureResult.fixedGreen && fixtureResult.reinjectRed) {
        // All cycle phases succeeded — fixture done.
        break;
      }

      // No progress: fix didn't work or something failed unexpectedly.
      noProgressCount++;

      if (noProgressCount >= oscillationOpts.maxNoProgressAttempts) {
        // Attribute no-progress halts correctly.
        oscillationReason = `no-progress halt: fixture '${fixture.id}' failed to converge after ` +
          `${noProgressCount} attempt(s). detectedRed=${fixtureResult.detectedRed} ` +
          `fixAllowed=${fixtureResult.fixAllowed} fixedGreen=${fixtureResult.fixedGreen} ` +
          `reinjectRed=${fixtureResult.reinjectRed}`;
        halted = true;
        break;
      }
    }

    if (fixtureResult) {
      fixtureResults.push(fixtureResult);
    }

    if (halted) {
      break; // Oscillation halt — stop processing further fixtures.
    }
  }

  // ── Verdict ──────────────────────────────────────────────────────────────

  let verdict;
  if (oscillationReason) {
    verdict = `oscillation-halt: ${oscillationReason}`;
  } else if (overallEscalated) {
    verdict = 'escalated: one or more fixtures were refused by the forbidden-edit guard (A4)';
  } else {
    // All fixtures must have: detectedRed:true, fixedGreen:true, reinjectRed:true.
    const allPassed = fixtureResults.every(
      f => f.detectedRed && f.fixAllowed && f.fixedGreen && f.reinjectRed
    );
    verdict = allPassed ? 'all-passed' : 'partial: some fixtures did not complete the full RED→GREEN→RED cycle';
  }

  return {
    fixtures: fixtureResults,
    verdict,
    ...(oscillationReason ? { oscillationReason } : {}),
  };
}
