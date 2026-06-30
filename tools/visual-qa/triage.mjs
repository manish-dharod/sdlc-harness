/**
 * tools/visual-qa/triage.mjs — Finding triage + dedupe layer.
 *
 * Implements the visual QA triage layer.
 *
 * Design principle: the vision layer is an adversarial DISCOVERY
 * layer, never the source of truth. Vision signals are HYPOTHESES. This module:
 *   1. Collapses raw signals that share a `signature` (defect class key) across
 *      ANY number of routes/viewports into ONE class — the blast-radius rule.
 *   2. Classifies each class with a category and severity.
 *   3. Confirms vision-hypothesis classes via an injected predicate; drops
 *      unconfirmed ones. Deterministic-gate classes pass through unconditionally.
 *   4. Partitions confirmed classes into mustFix (broken) vs logged (cosmetic)
 *      — cosmetic classes are NEVER blocking.
 *   5. Maps confirmed classes to findings via makeFinding.
 *
 * @module triage
 */

import { makeFinding } from './finding.mjs';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} RawSignal
 * @property {'deterministic-gate'|'vision-hypothesis'} source
 * @property {string} route
 * @property {string} viewport
 * @property {'functional-broken'|'visual-broken'|'cosmetic'} category
 * @property {string} signature    — defect class key (e.g. 'header-menu-missing')
 * @property {string} observed
 * @property {string} expected
 * @property {'P0'|'P1'|'P2'|'P3'} [severity] — optional override
 */

/**
 * @typedef {Object} DefectClass
 * @property {string} signature
 * @property {'functional-broken'|'visual-broken'|'cosmetic'} category
 * @property {'P0'|'P1'|'P2'|'P3'} severity
 * @property {string} observed
 * @property {string} expected
 * @property {Array<{route:string, viewport:string}>} sites
 * @property {'deterministic-gate'|'vision-hypothesis'} source  — 'deterministic-gate' if ANY signal was a gate
 * @property {string} [proposed_gate]
 */

// ---------------------------------------------------------------------------
// Severity rules:
//   functional-broken → P0 (primary, high-urgency)
//   visual-broken     → P1 (real but non-crash)
//   cosmetic          → P3 (logged, not blocking)
// The spec allows P2 for "minor-but-real" broken; we default to the canonical
// assignments and let callers override via a signal.severity field.
// ---------------------------------------------------------------------------

const CATEGORY_SEVERITY = {
  'functional-broken': 'P0',
  'visual-broken': 'P1',
  cosmetic: 'P3',
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * Collapse raw signals into defect classes.
 *
 * Signals that share the same `signature` (regardless of route or viewport)
 * are folded into ONE class listing every (route, viewport) pair as a `site`.
 * This is the blast-radius rule: a header defect on 7 anchor pages = ONE class,
 * not 7.
 *
 * The `source` of the merged class is 'deterministic-gate' if ANY contributing
 * signal came from a deterministic gate (proven red = already confirmed), or
 * 'vision-hypothesis' if all signals are hypotheses.
 *
 * @param {RawSignal[]} signals
 * @returns {DefectClass[]}
 */
export function dedupeIntoClasses(signals) {
  /** @type {Map<string, DefectClass>} */
  const bySignature = new Map();

  for (const s of signals) {
    const existing = bySignature.get(s.signature);
    if (existing) {
      // Add this (route, viewport) pair to the class's site list
      existing.sites.push({ route: s.route, viewport: s.viewport });
      // A single deterministic-gate signal upgrades the class to gate-confirmed
      if (s.source === 'deterministic-gate') {
        existing.source = 'deterministic-gate';
      }
    } else {
      bySignature.set(s.signature, {
        signature: s.signature,
        category: s.category,
        severity: s.severity ?? CATEGORY_SEVERITY[s.category] ?? 'P3',
        observed: s.observed,
        expected: s.expected,
        sites: [{ route: s.route, viewport: s.viewport }],
        source: s.source,
      });
    }
  }

  return [...bySignature.values()];
}

/**
 * Assign (or confirm) category and severity for a defect class.
 *
 * Severity categories:
 *   - functional-broken | visual-broken → broken band (P0/P1); MUST be fixed.
 *   - cosmetic → cosmetic band (P2/P3); logged, never blocking.
 *
 * The class's own `category` is authoritative; this function calculates
 * severity from it if not already set, and returns the enriched class object.
 *
 * @param {DefectClass} cls
 * @returns {DefectClass}
 */
export function classify(cls) {
  const severity = cls.severity ?? CATEGORY_SEVERITY[cls.category] ?? 'P3';
  return { ...cls, category: cls.category, severity };
}

/**
 * Confirm vision-hypothesis classes against the live tree.
 *
 * - deterministic-gate classes: already confirmed (gate was red) → pass through.
 * - vision-hypothesis classes: drop unless `confirm(cls)` returns true.
 *
 * The `confirm` predicate is injected to keep this module testable without a
 * real browser or tree. Adopting repos can inject a predicate that re-checks
 * the suspected element / property in the running app.
 *
 * @param {DefectClass[]} classes
 * @param {{ confirm: (cls: DefectClass) => Promise<boolean> }} opts
 * @returns {Promise<DefectClass[]>}
 */
export async function confirmHypotheses(classes, { confirm }) {
  const results = [];
  for (const cls of classes) {
    if (cls.source === 'deterministic-gate') {
      // Gate classes are already proven — pass through unconditionally.
      results.push(cls);
    } else {
      // vision-hypothesis: must be confirmed before it becomes a finding.
      const ok = await confirm(cls);
      if (ok) {
        results.push(cls);
      }
      // else: drop silently until the hypothesis is confirmed.
    }
  }
  return results;
}

/**
 * Partition confirmed defect classes by severity gate.
 *
 * Finding routing:
 *   - functional-broken | visual-broken → mustFix (blocks remediation loop).
 *   - cosmetic → logged (owner polish backlog; NEVER blocks).
 *
 * @param {DefectClass[]} classes
 * @returns {{ mustFix: DefectClass[], logged: DefectClass[] }}
 */
export function gateBySeverity(classes) {
  const mustFix = [];
  const logged = [];
  for (const cls of classes) {
    if (cls.category === 'cosmetic') {
      logged.push(cls);
    } else {
      mustFix.push(cls);
    }
  }
  return { mustFix, logged };
}

/**
 * Map confirmed defect classes to validated Finding objects.
 *
 * Each class produces exactly ONE finding regardless of how many sites it spans
 * (the blast-radius rule: ONE class = ONE finding that enumerates all sites).
 *
 * The `proposed_gate` on the class is carried into the finding. For non-cosmetic
 * findings, a proposed_gate is REQUIRED. If
 * the class does not provide one, a placeholder is inserted so the finding still
 * passes schema validation — callers must fill it with the real gate before
 * transitioning status to fixed+gated.
 *
 * @param {DefectClass[]} classes
 * @param {{ target_feature: string }} opts
 * @returns {import('./finding.mjs').Finding[]}
 */
export function toFindings(classes, { target_feature }) {
  return classes.map((cls, i) => {
    // For multi-site classes, represent all sites in the page field.
    const page = cls.sites.length === 1
      ? cls.sites[0].route
      : cls.sites.map(s => s.route).join(', ');

    // viewport: 'both' when multiple viewports; use single viewport value when uniform.
    const viewports = [...new Set(cls.sites.map(s => s.viewport))];
    const viewport = viewports.length > 1 ? 'both' : viewports[0] ?? 'desktop';

    // non-cosmetic MUST have proposed_gate.
    // Use the class's proposed_gate if present, otherwise generate a placeholder.
    const proposed_gate =
      cls.proposed_gate ||
      (cls.category !== 'cosmetic'
        ? `PLACEHOLDER: add deterministic gate for '${cls.signature}'`
        : '');

    // Map triage source to finding schema source.
    // 'vision-hypothesis' in triage becomes 'vision-discovery' in the finding, because
    // by the time we create a finding the hypothesis has been confirmed (confirmHypotheses
    // already dropped unconfirmed ones). 'deterministic-gate' maps 1:1.
    const findingSource =
      cls.source === 'deterministic-gate' ? 'deterministic-gate' : 'vision-discovery';

    return makeFinding({
      id: `VQA-T${String(i + 1).padStart(3, '0')}`,
      source: findingSource,
      category: cls.category,
      severity: cls.severity,
      page,
      viewport,
      observed: cls.observed,
      expected: cls.expected,
      proposed_gate,
      target_feature,
      task_id: '',
      evidence_path: `tools/visual-qa/reports/`,
    });
  });
}
