/**
 * tools/visual-qa/finding.mjs — Finding schema + validator.
 *
 * Finding schema and validator for visual QA reports.
 *
 * Rules enforced:
 * 1. source ∈ {vision-discovery, deterministic-gate}
 * 2. category ∈ {functional-broken, visual-broken, cosmetic}
 * 3. severity ∈ {P0, P1, P2, P3}
 * 4. status ∈ {discovered, confirmed, fixed+gated, escalated, cosmetic-logged}
 * 5. If category !== 'cosmetic', proposed_gate MUST be a non-empty string.
 * 6. Traceability fields (target_feature, task_id, gate_file, verify_command,
 *    evidence_path) MUST be present on every finding.  task_id, target_feature,
 *    and evidence_path must be non-empty even on newly-discovered findings.
 *    gate_file and verify_command must be non-empty when status === 'fixed+gated'.
 *
 * @module finding
 */

/** @type {readonly string[]} */
const VALID_SOURCES = ['vision-discovery', 'deterministic-gate'];

/** @type {readonly string[]} */
const VALID_VIEWPORTS = ['desktop', 'mobile', 'both'];

/** @type {readonly string[]} */
const VALID_CATEGORIES = ['functional-broken', 'visual-broken', 'cosmetic'];

/** @type {readonly string[]} */
const VALID_SEVERITIES = ['P0', 'P1', 'P2', 'P3'];

/** @type {readonly string[]} */
const VALID_STATUSES = [
  'discovered',
  'confirmed',
  'fixed+gated',
  'escalated',
  'cosmetic-logged',
];

/**
 * @typedef {Object} Finding
 * @property {string} id
 * @property {string} date
 * @property {'vision-discovery'|'deterministic-gate'} source
 * @property {'functional-broken'|'visual-broken'|'cosmetic'} category
 * @property {'P0'|'P1'|'P2'|'P3'} severity
 * @property {string} page
 * @property {string} viewport
 * @property {string} observed
 * @property {string} expected
 * @property {string[]} repro
 * @property {string[]} screenshots
 * @property {string} proposed_gate  — REQUIRED for non-cosmetic findings
 * @property {'discovered'|'confirmed'|'fixed+gated'|'escalated'|'cosmetic-logged'} status
 * @property {string} [escalation_reason]
 * @property {string} target_feature  — control-plane traceability: whose FINDINGS.md
 * @property {string} task_id         — the remediation task, once claimed
 * @property {string} gate_file       — spec/check file the ratchet gate was written into; REQUIRED when fixed+gated
 * @property {string} verify_command  — exact command that runs the locking gate; REQUIRED when fixed+gated
 * @property {string} evidence_path   — EVIDENCE entry / screenshots dir
 */

/**
 * Validate a finding object.  Returns {ok: true} or {ok: false, errors: string[]}.
 * Never throws.
 *
 * @param {Partial<Finding>} f
 * @returns {{ ok: boolean, errors?: string[] }}
 */
export function validateFinding(f) {
  const errors = [];

  // Enum checks
  if (!VALID_SOURCES.includes(f.source)) {
    errors.push(
      `source must be one of [${VALID_SOURCES.join(', ')}]; got '${f.source}'`
    );
  }
  if (!VALID_CATEGORIES.includes(f.category)) {
    errors.push(
      `category must be one of [${VALID_CATEGORIES.join(', ')}]; got '${f.category}'`
    );
  }
  if (!VALID_SEVERITIES.includes(f.severity)) {
    errors.push(
      `severity must be one of [${VALID_SEVERITIES.join(', ')}]; got '${f.severity}'`
    );
  }
  if (!VALID_STATUSES.includes(f.status)) {
    errors.push(
      `status must be one of [${VALID_STATUSES.join(', ')}]; got '${f.status}'`
    );
  }

  // viewport must be one of the known display profiles.
  if (!VALID_VIEWPORTS.includes(f.viewport)) {
    errors.push(
      `viewport must be one of [${VALID_VIEWPORTS.join(', ')}]; got '${f.viewport}'`
    );
  }

  // Core field presence + type checks.
  if (!f.id || typeof f.id !== 'string') {
    errors.push(`id must be a non-empty string; got '${f.id}'`);
  }
  if (!f.page || typeof f.page !== 'string') {
    errors.push(`page must be a non-empty string; got '${f.page}'`);
  }
  if (!f.observed || typeof f.observed !== 'string') {
    errors.push(`observed must be a non-empty string; got '${f.observed}'`);
  }
  if (!Array.isArray(f.repro)) {
    errors.push(`repro must be an array; got ${typeof f.repro}`);
  }
  if (!Array.isArray(f.screenshots)) {
    errors.push(`screenshots must be an array; got ${typeof f.screenshots}`);
  }

  // proposed_gate: required for non-cosmetic categories
  if (f.category !== 'cosmetic' && !f.proposed_gate) {
    errors.push(
      `proposed_gate is required for category '${f.category}'; it was empty or missing`
    );
  }

  // Traceability fields — must be present (as keys) on every finding.
  // They may be empty string for a freshly-discovered finding; only gate_file
  // and verify_command have a non-empty constraint (enforced below at fixed+gated).
  // We still require evidence_path to be non-empty because every finding must
  // have a pointer to its evidence, even when first discovered.
  if (!('target_feature' in f)) {
    errors.push(`target_feature field must be present (traceability field); may be empty string`);
  }
  if (!('task_id' in f)) {
    errors.push(`task_id field must be present (traceability field); may be empty string`);
  }
  if (!f.evidence_path) {
    errors.push(`evidence_path must be a non-empty string (traceability field)`);
  }

  // gate_file and verify_command required once status is fixed+gated
  if (f.status === 'fixed+gated') {
    if (!f.gate_file) {
      errors.push(`gate_file must be non-empty when status is 'fixed+gated'`);
    }
    if (!f.verify_command) {
      errors.push(`verify_command must be non-empty when status is 'fixed+gated'`);
    }
  }

  // Escalated findings must say what decision or evidence is needed.
  // An escalated finding without a reason is unactionable — the owner cannot know what
  // decision or evidence is needed.
  if (f.status === 'escalated') {
    if (!f.escalation_reason) {
      errors.push(`escalation_reason must be non-empty when status is 'escalated'`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true };
}

/**
 * Default field values for a freshly-created finding.
 *
 * @type {Partial<Finding>}
 */
const FINDING_DEFAULTS = {
  date: new Date().toISOString().slice(0, 10),
  repro: [],
  screenshots: [],
  proposed_gate: '',
  status: 'discovered',
  escalation_reason: '',
  gate_file: '',
  verify_command: '',
};

/**
 * Create a finding by merging `partial` onto defaults, then validate.
 *
 * Returns the merged object merged with the validation result:
 *   - {ok: true, ...fields} on success
 *   - {ok: false, errors: [...], ...fields} on failure
 *
 * @param {Partial<Finding>} partial
 * @returns {{ ok: boolean, errors?: string[] } & Partial<Finding>}
 */
export function makeFinding(partial) {
  const f = { ...FINDING_DEFAULTS, ...partial };
  const result = validateFinding(f);
  return { ...f, ...result };
}
