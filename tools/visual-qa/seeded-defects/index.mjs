/**
 * tools/visual-qa/seeded-defects/index.mjs
 *
 * Barrel: loads and exports all seeded defect fixtures.
 *
 * Each fixture module exports:
 *   id              : string
 *   description     : string
 *   gateDescription : string
 *   inject(sandboxDir)          — write the defective state
 *   detectingGate(sandboxDir)   — returns true (GREEN / pass) or false (RED / fail)
 *   fix(sandboxDir)             — apply the known correct patch
 *
 * @module seeded-defects
 */

export * as recoloredCta from './recolored-cta.mjs';
export * as brokenLink from './broken-link.mjs';
export * as consoleError from './console-error.mjs';

/**
 * All three fixtures as an ordered array (for iteration in heal-seeded.mjs).
 *
 * @type {Array<{ id:string, description:string, gateDescription:string,
 *               inject:Function, detectingGate:Function, fix:Function }>}
 */
import * as _recoloredCta from './recolored-cta.mjs';
import * as _brokenLink from './broken-link.mjs';
import * as _consoleError from './console-error.mjs';

export const ALL_FIXTURES = [_recoloredCta, _brokenLink, _consoleError];
