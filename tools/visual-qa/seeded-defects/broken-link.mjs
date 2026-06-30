/**
 * tools/visual-qa/seeded-defects/broken-link.mjs
 *
 * Seeded defect: Broken internal link (href pointing to a non-existent path).
 *
 * Simulates a broken internal link defect where a navigation anchor's href was
 * accidentally changed to a 404-producing path.  The gate checks that the
 * link registry file does NOT contain any 404-flagged routes.
 *
 * Contract:
 *   inject(sandboxDir)             — write a link registry JSON with a broken link
 *   detectingGate(sandboxDir)      — returns true (GREEN) if no broken links; false (RED) if broken
 *   fix(sandboxDir)                — restore all links to valid paths
 *   description                   — human-readable description
 *   gateDescription               — what the gate checks
 *
 * A7 teeth proof contract:
 *   inject → detectingGate() === false (RED: broken link detected)
 *   fix    → detectingGate() === true  (GREEN: all links valid)
 *   inject → detectingGate() === false (RED again: teeth proven)
 */

import fs from 'node:fs';
import path from 'node:path';

export const id = 'broken-link';
export const description =
  'Broken internal link: the "Start" navigation link was accidentally changed to ' +
  '"/broken-path" (a 404-producing path). Correct href is "/start".';
export const gateDescription =
  'Assert that links.json contains no entry with status:"broken" — ' +
  'any broken status means a 404-producing link is present.';

/** Filename used inside the sandbox dir. */
const FILE = 'links.json';

/** Defective link registry (one broken link). */
const DEFECTIVE_LINKS = {
  routes: [
    { label: 'Start', href: '/broken-path', status: 'broken' },
    { label: 'Docs', href: '/docs', status: 'ok' },
    { label: 'Home', href: '/', status: 'ok' },
  ],
};

/** Correct link registry (all links valid). */
const CORRECT_LINKS = {
  routes: [
    { label: 'Start', href: '/start', status: 'ok' },
    { label: 'Docs', href: '/docs', status: 'ok' },
    { label: 'Home', href: '/', status: 'ok' },
  ],
};

/**
 * Inject the defective state into sandboxDir.
 *
 * @param {string} sandboxDir
 */
export function inject(sandboxDir) {
  const filePath = path.join(sandboxDir, FILE);
  fs.writeFileSync(filePath, JSON.stringify(DEFECTIVE_LINKS, null, 2), 'utf8');
}

/**
 * Run the deterministic gate.
 *
 * Returns true (GREEN) when no broken links exist.
 * Returns false (RED)  when at least one link has status:"broken".
 *
 * @param {string} sandboxDir
 * @returns {boolean}
 */
export function detectingGate(sandboxDir) {
  const filePath = path.join(sandboxDir, FILE);
  try {
    const registry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const hasBroken = registry.routes.some(r => r.status === 'broken');
    // Gate PASSES when there are NO broken links.
    return !hasBroken;
  } catch {
    // File absent or parse error → no broken links detectable → pass.
    return true;
  }
}

/**
 * Apply the correct fix to sandboxDir.
 *
 * Rewrites the link registry with all valid hrefs.
 * This is an edit to an ordinary source file (links registry), NOT a baseline.
 *
 * @param {string} sandboxDir
 */
export function fix(sandboxDir) {
  const filePath = path.join(sandboxDir, FILE);
  fs.writeFileSync(filePath, JSON.stringify(CORRECT_LINKS, null, 2), 'utf8');
}
