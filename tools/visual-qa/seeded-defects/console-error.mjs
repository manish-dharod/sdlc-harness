/**
 * tools/visual-qa/seeded-defects/console-error.mjs
 *
 * Seeded defect: Console error on page load (JS runtime error).
 *
 * Simulates a defect where a component throws a TypeError on render because a
 * required prop is missing.  The defect manifests as a console.error in the
 * capture layer.  The gate checks that the console-error log file contains no
 * error entries.
 *
 * Contract:
 *   inject(sandboxDir)             — write a console-errors.json with a seeded error
 *   detectingGate(sandboxDir)      — true (GREEN) if no errors; false (RED) if errors present
 *   fix(sandboxDir)                — rewrite the file with an empty errors array
 *   description                   — human-readable description
 *   gateDescription               — what the gate checks
 *
 * A7 teeth proof contract:
 *   inject → detectingGate() === false (RED: console error detected)
 *   fix    → detectingGate() === true  (GREEN: no console errors)
 *   inject → detectingGate() === false (RED again: teeth proven)
 */

import fs from 'node:fs';
import path from 'node:path';

export const id = 'console-error';
export const description =
  'Console error on page load: a navigation component prop is missing, causing ' +
  '"TypeError: Cannot read properties of undefined (reading \'href\')" on render. ' +
  'The fix adds the required default value / null guard.';
export const gateDescription =
  'Assert that console-errors.json contains an empty errors array — ' +
  'any non-empty entry means a JS runtime error occurred on page load.';

/** Filename used inside the sandbox dir. */
const FILE = 'console-errors.json';

/** Defective console error state (seeded JS error). */
const DEFECTIVE_ERRORS = {
  page: '/example',
  viewport: 'desktop',
  errors: [
    "TypeError: Cannot read properties of undefined (reading 'href')",
  ],
};

/** Correct console error state (no errors after fix). */
const CORRECT_STATE = {
  page: '/example',
  viewport: 'desktop',
  errors: [],
};

/**
 * Inject the defective state into sandboxDir.
 *
 * @param {string} sandboxDir
 */
export function inject(sandboxDir) {
  const filePath = path.join(sandboxDir, FILE);
  fs.writeFileSync(filePath, JSON.stringify(DEFECTIVE_ERRORS, null, 2), 'utf8');
}

/**
 * Run the deterministic gate.
 *
 * Returns true (GREEN) when the errors array is empty.
 * Returns false (RED)  when the errors array has any entry.
 *
 * @param {string} sandboxDir
 * @returns {boolean}
 */
export function detectingGate(sandboxDir) {
  const filePath = path.join(sandboxDir, FILE);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    // Gate PASSES when there are NO errors.
    return Array.isArray(data.errors) && data.errors.length === 0;
  } catch {
    // File absent or parse error → no errors detectable → pass.
    return true;
  }
}

/**
 * Apply the correct fix to sandboxDir.
 *
 * Clears the errors array — simulates applying a code fix that eliminates the
 * TypeError.  In a real scenario this would fix the component; here we patch
 * the artifact so the gate passes.
 *
 * This is an edit to an ordinary source/artifact file, NOT a baseline/snapshot.
 *
 * @param {string} sandboxDir
 */
export function fix(sandboxDir) {
  const filePath = path.join(sandboxDir, FILE);
  fs.writeFileSync(filePath, JSON.stringify(CORRECT_STATE, null, 2), 'utf8');
}
