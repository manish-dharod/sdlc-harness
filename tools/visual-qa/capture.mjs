/**
 * tools/visual-qa/capture.mjs — Capture engine for the autonomous visual QA loop.
 *
 * Drives a Playwright-like browser per target×viewport.  Collects:
 *   - Full-page screenshot
 *   - DOM snapshot (page.content())
 *   - Console errors (type === 'error' only)
 *   - Failed requests (requestfailed events + HTTP responses with status ≥ 400)
 *   - Broken images (rendered with naturalWidth=0 — see brokenImages signal)
 *   - Per-step flow screenshots (depth === 'flow' targets only)
 *
 * The browser dependency is INJECTED via opts.launchBrowser — an async factory
 * that returns a Playwright-browser-like object.  This makes the module fully
 * unit-testable without a real browser.
 *
 * Default launchBrowser resolves @playwright/test or playwright via Node's
 * normal package resolution from this file and the repo root. Tests can inject a
 * fake browser factory, so this module remains unit-testable without Playwright.
 *
 * @module capture
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// ─── Compute repo root from this file's location ────────────────────────────
// tools/visual-qa/capture.mjs → up 2 = repo root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ─── Viewport dimensions ────────────────────────────────────────────────────
// Conservative defaults matching common desktop and mobile QA viewports.
const VIEWPORT_SIZES = {
  desktop: { width: 1365, height: 768 },
  mobile: { width: 390, height: 844 },
};

// ─── Default launchBrowser factory ──────────────────────────────────────────

/**
 * Resolve and launch Playwright's chromium. This is the default launchBrowser;
 * unit tests inject a fake instead.
 *
 * @returns {Promise<import('playwright').Browser>}
 * @throws if @playwright/test cannot be resolved from any of the search paths
 */
async function defaultLaunchBrowser() {
  // createRequire anchored to this file's location lets Node walk up the
  // directory tree from tools/visual-qa/ to the repo root.
  const require = createRequire(import.meta.url);

  // Explicit search paths tried after natural resolution.
  const explicitPaths = [
    path.join(REPO_ROOT, 'node_modules'),
    REPO_ROOT,
  ];

  let chromium;
  const tried = [];

  // Try @playwright/test first, then playwright (bare)
  for (const pkg of ['@playwright/test', 'playwright']) {
    // Attempt natural resolution first, then explicit repo-root search paths.
    for (const resolvePaths of [undefined, explicitPaths]) {
      try {
        const pkgPath = resolvePaths
          ? require.resolve(pkg, { paths: resolvePaths })
          : require.resolve(pkg);
        const pw = await import(pkgPath);
        // @playwright/test may export `chromium` as a named export or via `default`
        chromium = pw.chromium ?? pw.default?.chromium;
        if (chromium) break;
      } catch (e) {
        tried.push(`${pkg} (${resolvePaths ? 'explicit' : 'natural'}): ${e.message.split('\n')[0]}`);
      }
    }
    if (chromium) break;
  }

  if (!chromium) {
    throw new Error(
      `capture.mjs: could not resolve playwright/chromium.\n` +
      tried.map(t => `  ${t}`).join('\n') + '\n' +
      `Install @playwright/test or playwright, or inject a launchBrowser factory via opts.`
    );
  }
  return chromium.launch({ headless: true });
}

// ─── Boundary detection ──────────────────────────────────────────────────────

/**
 * Return the first stop_boundary keyword that matches anywhere in the step's
 * description or target selector (case-insensitive).  Returns null if safe.
 *
 * Rules:
 *   - stop_boundaries are declared per target in tools/visual-qa/targets.mjs.
 *   - A step is refused if its description, target, or value contains any
 *     boundary keyword.
 *   - Production/reference targets should be navigation and render checks only.
 *
 * @param {import('./manifest.mjs').FlowStep} step
 * @param {string[]} stopBoundaries
 * @returns {string|null} matched boundary keyword, or null if safe
 */
function detectBoundary(step, stopBoundaries) {
  const haystack = [
    (step.description ?? '').toLowerCase(),
    (step.target ?? '').toLowerCase(),
    (step.value ?? '').toLowerCase(),
  ].join(' ');

  for (const boundary of stopBoundaries) {
    if (haystack.includes(boundary.toLowerCase())) {
      return boundary;
    }
  }
  return null;
}

// ─── Flow step execution ─────────────────────────────────────────────────────

/**
 * Execute a single flow step against the Playwright page.
 * Supported actions: fill, click, assert (waitForSelector).
 *
 * @param {object} page — Playwright page object
 * @param {import('./manifest.mjs').FlowStep} step
 */
async function executeStep(page, step) {
  switch (step.action) {
    case 'fill':
      // Use the first matching selector from the comma-separated list
      await page.fill(step.target, step.value ?? '');
      break;
    case 'click':
      await page.click(step.target);
      break;
    case 'assert':
      // assert = wait for the selector to appear
      await page.waitForSelector(step.target);
      break;
    default:
      throw new Error(`capture: unknown flow step action '${step.action}'`);
  }
}

// ─── Main capture function ───────────────────────────────────────────────────

/**
 * @typedef {Object} FlowShot
 * @property {number} step            — zero-based index into target.flow_steps
 * @property {string} [screenshotPath] — path to the screenshot (absent if stoppedAt)
 * @property {string} [stoppedAt]     — boundary keyword that caused the stop (absent if executed)
 */

/**
 * @typedef {Object} FailedRequest
 * @property {string} url
 * @property {number} [status]  — HTTP status (for response events with status ≥ 400)
 * @property {string} [reason]  — error text (for requestfailed events)
 */

/**
 * @typedef {Object} CaptureResult
 * @property {string}         route
 * @property {string}         viewport
 * @property {string}         screenshotPath
 * @property {string}         dom
 * @property {string[]}       consoleErrors
 * @property {FailedRequest[]} failedRequests  — network-layer failures (HTTP ≥400 + requestfailed)
 * @property {string[]}       brokenImages    — asset URLs that rendered with naturalWidth=0 (render-layer; read by the no-broken-images gate)
 * @property {FlowShot[]}     flowShots
 */

/**
 * Capture a target at the given viewport.
 *
 * @param {import('./manifest.mjs').Target} target
 * @param {string} viewport  — 'desktop' | 'mobile'
 * @param {object} [opts]
 * @param {string} [opts.baseUrl]       — base URL for navigation (default: VQA_BASE_URL env or 'http://127.0.0.1:3000')
 * @param {string} [opts.outDir]        — directory for screenshots (default: os.tmpdir()/vqa-shots)
 * @param {Function} [opts.launchBrowser] — async factory returning a Playwright-browser-like object
 * @returns {Promise<CaptureResult>}
 */
export async function capture(target, viewport, opts = {}) {
  const baseUrl = opts.baseUrl ?? process.env.VQA_BASE_URL ?? 'http://127.0.0.1:3000';
  const outDir = opts.outDir ?? path.join(os.tmpdir(), 'vqa-shots');
  const launchBrowser = opts.launchBrowser ?? defaultLaunchBrowser;

  // Resolve viewport size
  const vpSize = VIEWPORT_SIZES[viewport];
  if (!vpSize) {
    throw new Error(`capture: unknown viewport '${viewport}'. Expected one of: ${Object.keys(VIEWPORT_SIZES).join(', ')}`);
  }

  // Ensure output directory exists
  fs.mkdirSync(outDir, { recursive: true });

  /** @type {string[]} */
  const consoleErrors = [];
  /** @type {FailedRequest[]} */
  const failedRequests = [];
  /** @type {string[]} */
  const brokenImages = [];
  /** @type {FlowShot[]} */
  const flowShots = [];

  const browser = await launchBrowser();
  let context;
  let page;

  try {
    // Basic-auth support for protected preview origins.
    // Backward-compatible: no creds -> plain context, unchanged behavior.
    const authUser = opts.authUser ?? process.env.VQA_BASE_AUTH_USER;
    const authPass = opts.authPass ?? process.env.VQA_BASE_AUTH_PASS;
    context = authUser && authPass
      ? await browser.newContext({ httpCredentials: { username: authUser, password: authPass } })
      : await browser.newContext();
    page = await context.newPage();

    // Set viewport size
    await page.setViewportSize(vpSize);

    // ── Attach event listeners BEFORE goto so we catch all events ─────────
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('requestfailed', (request) => {
      failedRequests.push({
        url: request.url(),
        reason: request.failure()?.errorText ?? 'unknown',
      });
    });

    page.on('response', (response) => {
      const status = response.status();
      if (status >= 400) {
        failedRequests.push({
          url: response.url(),
          status,
        });
      }
    });

    // ── Navigate ─────────────────────────────────────────────────────────
    // Use 'load' (fires after images attempt to load/fail) with a bounded
    // timeout. 'networkidle' can hang indefinitely on sites with a persistent
    // beacon/long-poll (e.g. web-vitals), so it is NOT used here.
    const fullUrl = `${baseUrl.replace(/\/$/, '')}${target.route}`;
    await page.goto(fullUrl, { waitUntil: 'load', timeout: 20000 }).catch(() => {
      // tolerate slow/odd loads (and test fakes that don't implement waits)
    });

    // ── Full-page screenshot ──────────────────────────────────────────────
    const shotFilename = `${target.id}__${viewport}__full.png`;
    const screenshotPath = path.join(outDir, shotFilename);
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // ── DOM snapshot ─────────────────────────────────────────────────────
    const dom = await page.content().catch(async () => page.evaluate(() => document.documentElement.outerHTML));

    // ── Broken-image detection (robust to 3xx/404/CDN-redirect) ───────────
    // A broken <img> has naturalWidth === 0 after load. This catches broken
    // assets regardless of HTTP status — a missing asset may 404 OR be 302'd to
    // an HTML error page (which the status>=400 response listener misses).
    //
    // Broken renders are a DIFFERENT class from network failures, so they get
    // their own `brokenImages` signal (NOT folded into failedRequests). The
    // deterministic `no-broken-images` gate reads this signal directly; keeping
    // the two separate means one broken asset trips exactly one gate and the
    // 302→HTML case is caught even though the network layer saw HTTP 200.
    const brokenRaw = await page
      .evaluate(() =>
        Array.from(document.images)
          .filter((img) => img.complete && img.naturalWidth === 0 && (img.currentSrc || img.src))
          .map((img) => img.currentSrc || img.src)
      )
      .catch(() => []);
    for (const url of Array.isArray(brokenRaw) ? brokenRaw : []) {
      if (!brokenImages.includes(url)) brokenImages.push(url);
    }

    // ── Flow steps (depth === 'flow' only) ────────────────────────────────
    if (target.depth === 'flow' && Array.isArray(target.flow_steps)) {
      for (let i = 0; i < target.flow_steps.length; i++) {
        const step = target.flow_steps[i];

        // Boundary check — refuse to execute a step that crosses a stop boundary
        const matched = detectBoundary(step, target.stop_boundaries ?? []);
        if (matched) {
          flowShots.push({ step: i, stoppedAt: matched });
          // Stop processing further steps — they would be past the boundary too
          break;
        }

        // Execute the step
        try {
          await executeStep(page, step);
        } catch (err) {
          // Record execution failure as a special stoppedAt entry and stop
          flowShots.push({ step: i, stoppedAt: `execution-error: ${err.message}` });
          break;
        }

        // Capture screenshot after the step
        const stepFilename = `${target.id}__${viewport}__step${i}.png`;
        const stepShotPath = path.join(outDir, stepFilename);
        await page.screenshot({ path: stepShotPath, fullPage: true });
        flowShots.push({ step: i, screenshotPath: stepShotPath });
      }
    }

    return {
      route: target.route,
      viewport,
      screenshotPath,
      dom,
      consoleErrors,
      failedRequests,
      brokenImages,
      flowShots,
    };
  } finally {
    if (context) await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}
