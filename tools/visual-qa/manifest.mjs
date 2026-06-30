/**
 * tools/visual-qa/manifest.mjs — Manifest loader and validator.
 *
 * Imports from tools/visual-qa/targets.mjs (the ESM data source) and exposes typed
 * accessors with strict validation.
 *
 * @module manifest
 */

import { targets as rawTargets } from './targets.mjs';

/** Valid depth values. */
const VALID_DEPTHS = new Set(['content', 'flow']);

/** Valid viewport values. */
const VALID_VIEWPORTS = new Set(['desktop', 'mobile']);

/**
 * @typedef {Object} FlowStep
 * @property {'fill'|'click'|'assert'} action
 * @property {string} target  — CSS selector or ARIA role expression
 * @property {string} [value] — fill value (for action='fill')
 * @property {string} [description]
 */

/**
 * @typedef {Object} Target
 * @property {string} id
 * @property {string} route
 * @property {'content'|'flow'} depth
 * @property {string|null} prod_ref
 * @property {string[]} viewports
 * @property {FlowStep[]} flow_steps
 * @property {string[]} allowed_differences
 * @property {string[]} stop_boundaries
 */

/**
 * Validate a single target object.  Throws a descriptive TypeError on the first
 * validation failure so callers get an actionable message.
 *
 * Rules:
 * - id, route required and non-empty.
 * - depth ∈ {'content','flow'}.
 * - viewports: non-empty array of valid values.
 * - flow_steps: must be an array; content targets → MUST be empty; flow targets → MUST be non-empty.
 * - allowed_differences, stop_boundaries: must be arrays.
 *
 * @param {Target} t
 * @throws {TypeError} on any validation failure
 */
export function validateTarget(t) {
  if (!t.id || typeof t.id !== 'string') {
    throw new TypeError(`Target missing required string field 'id'`);
  }
  if (!t.route || typeof t.route !== 'string') {
    throw new TypeError(`Target ${t.id}: missing required string field 'route'`);
  }
  if (!VALID_DEPTHS.has(t.depth)) {
    throw new TypeError(
      `Target ${t.id}: invalid depth '${t.depth}'. Must be one of: ${[...VALID_DEPTHS].join(', ')}`
    );
  }
  if (!Array.isArray(t.viewports) || t.viewports.length === 0) {
    throw new TypeError(`Target ${t.id}: viewports must be a non-empty array`);
  }
  for (const vp of t.viewports) {
    if (!VALID_VIEWPORTS.has(vp)) {
      throw new TypeError(`Target ${t.id}: invalid viewport '${vp}'. Must be one of: ${[...VALID_VIEWPORTS].join(', ')}`);
    }
  }
  if (!Array.isArray(t.flow_steps)) {
    throw new TypeError(`Target ${t.id}: flow_steps must be an array`);
  }
  if (t.depth === 'content' && t.flow_steps.length > 0) {
    throw new TypeError(
      `Target ${t.id}: flow_steps must be empty for depth='content' (got ${t.flow_steps.length} steps)`
    );
  }
  if (t.depth === 'flow' && t.flow_steps.length === 0) {
    throw new TypeError(
      `Target ${t.id}: flow_steps must be non-empty for depth='flow'`
    );
  }
  if (!Array.isArray(t.allowed_differences)) {
    throw new TypeError(`Target ${t.id}: allowed_differences must be an array`);
  }
  if (!Array.isArray(t.stop_boundaries)) {
    throw new TypeError(`Target ${t.id}: stop_boundaries must be an array`);
  }
}

/**
 * Load and validate all targets from qa/targets.mjs.
 *
 * Throws if any target fails validation.
 *
 * @returns {Target[]} The validated target list.
 */
export function loadTargets() {
  for (const t of rawTargets) {
    validateTarget(t);
  }
  return rawTargets;
}

/**
 * Return targets filtered by depth.
 *
 * @param {'content'|'flow'} depth
 * @returns {Target[]}
 */
export function getByDepth(depth) {
  return loadTargets().filter(t => t.depth === depth);
}

/**
 * Return a single target by id, or undefined if not found.
 *
 * @param {string} id
 * @returns {Target|undefined}
 */
export function getById(id) {
  return loadTargets().find(t => t.id === id);
}
