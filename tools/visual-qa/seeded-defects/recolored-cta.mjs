/**
 * tools/visual-qa/seeded-defects/recolored-cta.mjs
 *
 * Seeded defect: Recolored CTA button (wrong brand color).
 *
 * Simulates a defect where a CTA button has been given the wrong background color
 * (e.g. the brand primary color was accidentally changed).  The defect is injected
 * into a disposable sandbox file, detected by a deterministic check (grep for the
 * forbidden color), fixed by restoring the correct color, and the fix is locked by
 * a gate that fails if the wrong color reappears.
 *
 * Contract:
 *   inject(sandboxDir)             — write the defective state to sandboxDir/cta-styles.css
 *   detectingGate(sandboxDir)      — returns true if the gate PASSES (no defect found);
 *                                    false if the gate is RED (defect detected)
 *   fix(sandboxDir)                — apply the correct patch to sandboxDir/cta-styles.css
 *   description                   — human-readable description
 *   gateDescription               — what the gate checks
 *
 * A7 teeth proof contract:
 *   inject → detectingGate() === false (RED: gate fails, defect present)
 *   fix    → detectingGate() === true  (GREEN: gate passes, defect absent)
 *   inject → detectingGate() === false (RED again: teeth proven — defect restored → gate fails)
 */

import fs from 'node:fs';
import path from 'node:path';

export const id = 'recolored-cta';
export const description =
  'Recolored CTA button: the primary brand color was accidentally changed to #ff0000 (wrong red). ' +
  'Correct color is #005eb8 (brand blue).';
export const gateDescription =
  'Assert that cta-styles.css does NOT contain the forbidden color #ff0000 — ' +
  'any occurrence of the wrong red means the defect is present.';

/** Filename used inside the sandbox dir. */
const FILE = 'cta-styles.css';

/** The defective CSS content (wrong brand color). */
const DEFECTIVE_CONTENT = `.cta-button {
  background-color: #ff0000; /* WRONG: injected defect — should be brand blue */
  color: #ffffff;
  border-radius: 4px;
  padding: 12px 24px;
  font-weight: 600;
}
`;

/** The correct CSS content (brand color restored). */
const CORRECT_CONTENT = `.cta-button {
  background-color: #005eb8; /* CORRECT: brand blue */
  color: #ffffff;
  border-radius: 4px;
  padding: 12px 24px;
  font-weight: 600;
}
`;

/** The deterministic gate: the wrong color MUST NOT appear. */
const FORBIDDEN_COLOR = '#ff0000';

/**
 * Inject the defective state into sandboxDir.
 *
 * @param {string} sandboxDir — absolute path to the isolated disposable sandbox.
 */
export function inject(sandboxDir) {
  const filePath = path.join(sandboxDir, FILE);
  fs.writeFileSync(filePath, DEFECTIVE_CONTENT, 'utf8');
}

/**
 * Run the deterministic gate.
 *
 * Returns true  (gate PASSES / GREEN) when the defect is absent.
 * Returns false (gate FAILS  / RED)   when the defect is present.
 *
 * This mirrors the "deterministic gate = TRUTH" principle from the design:
 * a red gate is already a confirmed defect, no vision layer needed.
 *
 * @param {string} sandboxDir
 * @returns {boolean} true = pass (GREEN), false = fail (RED)
 */
export function detectingGate(sandboxDir) {
  const filePath = path.join(sandboxDir, FILE);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Gate passes when the forbidden color is ABSENT.
    return !content.includes(FORBIDDEN_COLOR);
  } catch {
    // File does not exist → the gate has nothing to check → pass (no defect to detect).
    return true;
  }
}

/**
 * Apply the correct fix to sandboxDir.
 *
 * Writes the brand-correct CSS, replacing the wrong color.
 * This is the smallest fix in an allowed ordinary source artifact.
 *
 * NOTE: This function does NOT touch any *-snapshots/, baselines/, masks/, or
 * thresholds/ path.  It only writes to the disposable sandbox's own file.
 *
 * @param {string} sandboxDir
 */
export function fix(sandboxDir) {
  const filePath = path.join(sandboxDir, FILE);
  fs.writeFileSync(filePath, CORRECT_CONTENT, 'utf8');
}
