/**
 * tools/visual-qa/deterministic-checks.mjs - Deterministic gate runner.
 *
 * Public-harness default: generic capture-derived gates only. Adopting repos
 * can layer their own project verification commands around this module or fork
 * the gate catalog in their domain pack.
 *
 * @module deterministic-checks
 */

const CAPTURE_GATES = [
  {
    id: 'no-console-errors',
    kind: 'capture-derived',
    signal: 'consoleErrors',
    appliesTo: ['content', 'flow'],
  },
  {
    id: 'no-failed-requests',
    kind: 'capture-derived',
    signal: 'failedRequests',
    appliesTo: ['content', 'flow'],
  },
  {
    id: 'no-broken-images',
    kind: 'capture-derived',
    signal: 'brokenImages',
    appliesTo: ['content', 'flow'],
  },
];

const CAPTURE_SUMMARY_MAX_ITEMS = 5;
const CAPTURE_SUMMARY_MAX_ITEM_LEN = 200;

/**
 * @typedef {Object} GateDescriptor
 * @property {string} id
 * @property {'capture-derived'} kind
 * @property {string} signal
 * @property {string[]} appliesTo
 */

/**
 * Return deterministic gate descriptors that apply to a target.
 *
 * @param {import('./manifest.mjs').Target} target
 * @returns {GateDescriptor[]}
 */
export function gatesForTarget(target) {
  return CAPTURE_GATES.filter(gate => gate.appliesTo.includes(target.depth));
}

/**
 * Render one capture-signal item into a bounded, sanitized display string.
 *
 * @param {string|object} item
 * @returns {string}
 */
function displaySignalItem(item) {
  let text;
  let suffix = '';

  if (typeof item === 'string') {
    text = item;
  } else if (item && typeof item === 'object' && typeof item.url === 'string') {
    text = item.url;
    if (item.status != null) suffix = ` [${item.status}]`;
    else if (item.reason) suffix = ` (${String(item.reason).slice(0, 60)})`;
  } else {
    text = JSON.stringify(item);
  }

  if (text.includes('://')) {
    text = text.split('#')[0].split('?')[0];
  }
  if (text.length > CAPTURE_SUMMARY_MAX_ITEM_LEN) {
    text = text.slice(0, CAPTURE_SUMMARY_MAX_ITEM_LEN) + '...';
  }
  return text + suffix;
}

/**
 * Build a bounded, sanitized payload for a failing capture-derived gate.
 *
 * @param {Array<string|object>} items
 * @returns {string}
 */
function summarizeSignalItems(items) {
  const shown = items.slice(0, CAPTURE_SUMMARY_MAX_ITEMS).map(displaySignalItem);
  const more = items.length - shown.length;
  return shown.join(', ') + (more > 0 ? ` (+${more} more)` : '');
}

/**
 * @typedef {Object} GateResult
 * @property {string} id
 * @property {'capture-derived'} kind
 * @property {string} command
 * @property {boolean} passed
 * @property {number|null} exitCode
 * @property {string} summary
 */

/**
 * @typedef {Object} RunGatesResult
 * @property {string} target
 * @property {GateResult[]} results
 * @property {boolean} allPassed
 * @property {string[]} failed
 */

/**
 * Run deterministic gates for `target`.
 *
 * Capture-derived gates fail closed when their signal key is missing. A caller
 * that cannot provide capture evidence should not get a false all-clear.
 *
 * @param {import('./manifest.mjs').Target} target
 * @param {object} [opts]
 * @param {{ consoleErrors?: string[], failedRequests?: object[], brokenImages?: string[] }} [opts.captureResult]
 * @returns {Promise<RunGatesResult>}
 */
export async function runGates(target, opts = {}) {
  const captureResult = opts.captureResult ?? {};
  const gates = gatesForTarget(target);
  /** @type {GateResult[]} */
  const results = [];

  for (const gate of gates) {
    const signalArray = captureResult[gate.signal];
    if (!Array.isArray(signalArray)) {
      results.push({
        id: gate.id,
        kind: gate.kind,
        command: '',
        passed: false,
        exitCode: null,
        summary:
          `capture-derived: ${gate.id} FAIL CLOSED - required signal '${gate.signal}' is ` +
          `absent from captureResult`,
      });
      continue;
    }

    const passed = signalArray.length === 0;
    results.push({
      id: gate.id,
      kind: gate.kind,
      command: '',
      passed,
      exitCode: null,
      summary: passed
        ? `capture-derived: ${gate.id} OK (${gate.signal} is empty)`
        : `capture-derived: ${gate.id} FAIL - ${gate.signal} has ${signalArray.length} item(s): ` +
          summarizeSignalItems(signalArray),
    });
  }

  const failed = results.filter(r => !r.passed).map(r => r.id);
  return {
    target: target.id,
    results,
    allPassed: failed.length === 0,
    failed,
  };
}
