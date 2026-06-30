/**
 * tools/visual-qa/targets.mjs - Example target manifest for the visual QA loop.
 *
 * Copy or edit this file in an adopting repo. Keep protected workflow boundaries
 * explicit in `stop_boundaries`; capture will refuse a flow step whose selector,
 * value, or description contains one of those terms.
 */

const REFERENCE_BASE = process.env.VQA_REFERENCE_BASE_URL ?? null;

/** @type {import('./manifest.mjs').Target[]} */
export const targets = [
  {
    id: 'content-home',
    route: '/',
    depth: 'content',
    prod_ref: REFERENCE_BASE ? `${REFERENCE_BASE}/` : null,
    viewports: ['desktop', 'mobile'],
    flow_steps: [],
    allowed_differences: [
      'timestamps',
      'session IDs',
      'personalized content',
    ],
    stop_boundaries: [],
  },
  {
    id: 'flow-primary-action',
    route: '/',
    depth: 'flow',
    prod_ref: REFERENCE_BASE ? `${REFERENCE_BASE}/` : null,
    viewports: ['desktop', 'mobile'],
    flow_steps: [
      {
        action: 'assert',
        target: 'main, body',
        description: 'Confirm the primary page surface renders',
      },
    ],
    allowed_differences: [
      'timestamps',
      'session IDs',
      'test data',
    ],
    stop_boundaries: [
      'checkout',
      'purchase',
      'submit-payment',
      'delete',
      'production-write',
    ],
  },
];
