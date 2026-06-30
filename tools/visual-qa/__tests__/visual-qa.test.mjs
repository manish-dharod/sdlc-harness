import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { capture } from '../capture.mjs';
import { runGates } from '../deterministic-checks.mjs';
import { checkEdit } from '../forbidden-edit-guard.mjs';
import { healSeeded } from '../heal-seeded.mjs';
import { loadTargets } from '../manifest.mjs';
import { runLoop } from '../loop.mjs';
import {
  confirmHypotheses,
  dedupeIntoClasses,
  gateBySeverity,
  toFindings,
} from '../triage.mjs';

function makeTmpDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function fakeBrowser({ content = '<html><body><main>ok</main></body></html>', brokenImages = [] } = {}) {
  const events = new Map();
  const screenshots = [];
  const page = {
    on(name, handler) {
      events.set(name, handler);
    },
    async setViewportSize() {},
    async goto() {},
    async screenshot(opts) {
      screenshots.push(opts.path);
      fs.mkdirSync(path.dirname(opts.path), { recursive: true });
      fs.writeFileSync(opts.path, '');
    },
    async content() {
      return content;
    },
    async evaluate() {
      return brokenImages;
    },
    async waitForSelector() {},
    async fill() {},
    async click() {},
    _events: events,
    _screenshots: screenshots,
  };

  return {
    page,
    browser: {
      async newContext() {
        return {
          async newPage() {
            return page;
          },
          async close() {},
        };
      },
      async close() {},
    },
  };
}

test('default visual QA target manifest is valid and portable', () => {
  const targets = loadTargets();
  assert.equal(targets.length, 2);
  assert.deepEqual(targets.map(t => t.id), ['content-home', 'flow-primary-action']);
  assert.equal(targets[0].depth, 'content');
  assert.equal(targets[1].depth, 'flow');
});

test('capture records screenshots, broken images, and boundary stops with injected browser', async () => {
  const { browser } = fakeBrowser({ brokenImages: ['https://example.test/broken.png?token=secret'] });
  const outDir = makeTmpDir('vqa-capture-');

  const result = await capture(
    {
      id: 'flow-test',
      route: '/example',
      depth: 'flow',
      prod_ref: null,
      viewports: ['desktop'],
      flow_steps: [
        { action: 'assert', target: 'main', description: 'main renders' },
        { action: 'click', target: '#danger', description: 'delete production-write data' },
      ],
      allowed_differences: [],
      stop_boundaries: ['production-write'],
    },
    'desktop',
    { outDir, launchBrowser: async () => browser, baseUrl: 'http://127.0.0.1:3000' },
  );

  assert.equal(result.route, '/example');
  assert.equal(result.brokenImages.length, 1);
  assert.equal(result.flowShots.length, 2);
  assert.ok(result.flowShots[0].screenshotPath.endsWith('__step0.png'));
  assert.deepEqual(result.flowShots[1], { step: 1, stoppedAt: 'production-write' });
});

test('capture-derived gates pass, fail, and fail closed', async () => {
  const target = { id: 'content-home', depth: 'content' };

  const pass = await runGates(target, {
    captureResult: { consoleErrors: [], failedRequests: [], brokenImages: [] },
  });
  assert.equal(pass.allPassed, true);

  const fail = await runGates(target, {
    captureResult: {
      consoleErrors: [],
      failedRequests: [{ url: 'https://example.test/a.js?token=secret', status: 404 }],
      brokenImages: [],
    },
  });
  assert.equal(fail.allPassed, false);
  assert.equal(fail.failed[0], 'no-failed-requests');
  assert.match(fail.results.find(r => r.id === 'no-failed-requests').summary, /https:\/\/example\.test\/a\.js \[404\]/);
  assert.doesNotMatch(fail.results.find(r => r.id === 'no-failed-requests').summary, /token=secret/);

  const closed = await runGates(target, { captureResult: { consoleErrors: [], failedRequests: [] } });
  assert.equal(closed.allPassed, false);
  assert.equal(closed.failed.includes('no-broken-images'), true);
});

test('triage dedupes blast radius and converts confirmed classes into findings', async () => {
  const classes = dedupeIntoClasses([
    {
      source: 'vision-hypothesis',
      route: '/a',
      viewport: 'desktop',
      category: 'visual-broken',
      signature: 'nav-missing',
      observed: 'Navigation missing',
      expected: 'Navigation visible',
    },
    {
      source: 'vision-hypothesis',
      route: '/b',
      viewport: 'mobile',
      category: 'visual-broken',
      signature: 'nav-missing',
      observed: 'Navigation missing',
      expected: 'Navigation visible',
    },
  ]);

  assert.equal(classes.length, 1);
  assert.equal(classes[0].sites.length, 2);

  const confirmed = await confirmHypotheses(classes, { confirm: async () => true });
  const { mustFix, logged } = gateBySeverity(confirmed);
  const findings = toFindings(mustFix, { target_feature: 'visual-qa' });

  assert.equal(logged.length, 0);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].viewport, 'both');
  assert.equal(findings[0].target_feature, 'visual-qa');
  assert.equal(findings[0].evidence_path, 'tools/visual-qa/reports/');
});

test('runLoop writes a report under the requested output directory', async () => {
  const outDir = makeTmpDir('vqa-report-');
  const report = await runLoop({
    outDir,
    runId: 'test-run',
    now: Date.parse('2026-06-26T00:00:00Z'),
    targets: [
      {
        id: 'content-home',
        route: '/',
        depth: 'content',
        prod_ref: null,
        viewports: ['desktop'],
        flow_steps: [],
        allowed_differences: [],
        stop_boundaries: [],
      },
    ],
    seams: {
      capture: async () => ({
        route: '/',
        viewport: 'desktop',
        screenshotPath: path.join(outDir, 'shot.png'),
        dom: '<html></html>',
        consoleErrors: [],
        failedRequests: [],
        brokenImages: [],
        flowShots: [],
      }),
      visionDispatch: async () => ({ verdict: 'deferred', hypotheses: [] }),
    },
  });

  assert.match(report.verdict, /all-clear/);
  assert.equal(fs.existsSync(path.join(outDir, 'report-test-run.json')), true);
  assert.equal(fs.existsSync(path.join(outDir, 'report-test-run.md')), true);
});

test('forbidden edit guard blocks visual baseline mutation surfaces', () => {
  assert.equal(checkEdit('tests/home-visual.spec.ts-snapshots/home.png').allowed, false);
  assert.equal(checkEdit('playwright/masks.ts').allowed, false);
  assert.equal(checkEdit('playwright.config.ts').allowed, false);
  assert.equal(checkEdit('src/components/Button.tsx').allowed, true);
});

test('seeded self-heal proves red-green-red cycles in an isolated sandbox', async () => {
  const sandboxDir = makeTmpDir('vqa-heal-');
  const result = await healSeeded({ sandboxDir });

  assert.equal(result.verdict, 'all-passed');
  assert.equal(result.fixtures.length, 3);
  for (const fixture of result.fixtures) {
    assert.equal(fixture.detectedRed, true);
    assert.equal(fixture.fixAllowed, true);
    assert.equal(fixture.fixedGreen, true);
    assert.equal(fixture.reinjectRed, true);
  }
});
