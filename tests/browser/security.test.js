/**
 * Browser tests for the Security Event Detection & Investigation Lab.
 *
 * Runs with Node's built-in test runner and the Playwright library (Chromium),
 * resolved through NODE_PATH exactly like tests/browser/lab.test.js. Expected
 * numbers are computed in Node from the same pure engine the page imports, so
 * every figure the page shows is checked against actual computation.
 *
 *   NODE_PATH=/path/to/node_modules node --test tests/browser/*.test.js
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { startServer } from './helpers/server.js';
import * as D from '../../lab/security-events/detection.js';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  throw new Error(`Playwright is not resolvable (${error.message}). Install it outside the repository and set NODE_PATH; see lab/security-events/README.md → "Reproducing the tests".`);
}

const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 375, height: 667 },
  narrow: { width: 320, height: 568 },
};
const LAB = '/lab/security-events/';
const MIXED = D.runSynthetic({ seed: 42, preset: 'mixed' });
const QUIET = D.runSynthetic({ seed: 42, preset: 'quiet' });
const LARGE = D.runSynthetic({ seed: 42, preset: 'large' });

let server;
let browser;

before(async () => {
  server = await startServer();
  browser = await chromium.launch();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

/** Opens a page and collects console errors, page errors, failed requests and every request URL. */
async function open(url, { viewport = VIEWPORTS.desktop, colorScheme = 'light', reducedMotion = 'no-preference', hasTouch = false } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion, hasTouch, isMobile: hasTouch });
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.scrollBehavior = 'auto'; });
  });
  const page = await context.newPage();
  const problems = [];
  const requests = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(`[console.${message.type()}] ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText}`));
  page.on('request', (request) => requests.push(request.url()));
  const response = await page.goto(server.baseUrl + url, { waitUntil: 'load' });
  return { page, context, response, problems, requests, close: () => context.close() };
}

const status = (page) => page.locator('#lab-status').textContent();
const stat = async (page, id) => (await page.locator(`#${id}`).evaluate((dd) => dd.firstChild.textContent)).trim();
const number = (text) => Number(String(text).replace(/,/g, ''));
const count = (page, selector) => page.locator(selector).count();
const setRange = (page, id, value) => page.evaluate(([i, v]) => { const el = document.getElementById(i); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, [id, String(value)]);
const setNumber = async (page, id, value) => { await page.locator(`#${id}`).fill(String(value)); await page.locator(`#${id}`).dispatchEvent('change'); };
const noOverflow = (page) => page.evaluate(() => ({ docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, bodyOverflow: document.body.scrollWidth - document.body.clientWidth }));
const accessibleNameGaps = (page) => page.evaluate(() => {
  const visibleText = (node) => {
    let text = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text += child.textContent;
      else if (child.nodeType === Node.ELEMENT_NODE && child.getAttribute('aria-hidden') !== 'true') text += visibleText(child);
    }
    return text;
  };
  const gaps = [];
  for (const el of document.querySelectorAll('button, input, select, textarea, a[href], [role="img"], table')) {
    const labelledBy = el.getAttribute('aria-labelledby');
    const byId = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
    const wrapped = el.closest('label');
    const caption = el.tagName === 'TABLE' ? el.querySelector('caption') : null;
    const name = (el.getAttribute('aria-label') || '')
      || (labelledBy ? visibleText(document.getElementById(labelledBy) || el) : '')
      || (byId ? visibleText(byId) : '')
      || (wrapped ? visibleText(wrapped) : '')
      || (caption ? visibleText(caption) : '')
      || (el.tagName === 'TABLE' ? '' : visibleText(el))
      || (el.getAttribute('title') || '');
    if (!name.trim()) gaps.push(`${el.tagName.toLowerCase()}#${el.id || ''}.${el.className || ''}`);
  }
  return gaps;
});
const duplicateIds = (page) => page.evaluate(() => {
  const seen = new Map();
  for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) || 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
});
const revealedMarks = (page) => count(page, '#timeline .tl-mark:not(.is-future)');
const summaryByRule = (run) => D.RULE_ORDER.map((rule) => `${D.RULES[rule].code} ${run.summary.byRule[rule]}`).join(' · ');
const sample = (overrides = {}) => ({ time: '2026-03-02T08:00:00Z', outcome: 'failure', account: 'u-test', source: '203.0.113.5', reason: 'bad_password', ...overrides });
const bruteForceJson = (labels) => JSON.stringify([
  ...[0, 1, 2, 3, 4].map((k) => sample({ time: `2026-03-02T08:00:0${k}Z`, ...(labels ? { scenario: 'bf', verdict: 'suspicious' } : {}) })),
  sample({ time: '2026-03-02T08:00:09Z', outcome: 'success', reason: undefined, ...(labels ? { scenario: 'bf', verdict: 'suspicious' } : {}) }),
  sample({ time: '2026-03-02T09:00:00Z', outcome: 'success', account: 'u-other', source: '192.0.2.7', reason: '<img src=x onerror=alert(1)>', ...(labels ? { scenario: 'routine', verdict: 'benign' } : {}) }),
]);

describe('security lab: page integrity across viewports', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    it(`${LAB} at ${name} (${viewport.width}px) loads without errors or horizontal overflow and replays cleanly`, async () => {
      const { page, response, problems, requests, close } = await open(LAB, { viewport });
      try {
        assert.equal(response.status(), 200);
        assert.equal(await page.locator('h1').count(), 1, 'exactly one h1');
        const overflow = await noOverflow(page);
        assert.equal(overflow.docOverflow, 0, `document overflows by ${overflow.docOverflow}px`);
        assert.equal(overflow.bodyOverflow, 0, `body overflows by ${overflow.bodyOverflow}px`);
        assert.deepEqual(await duplicateIds(page), []);
        assert.deepEqual(await accessibleNameGaps(page), [], 'controls without an accessible name');
        await page.locator('#reset').click();
        await page.locator('#step').click();
        await setRange(page, 'speed', 10);
        await page.locator('#play').click();
        await page.waitForFunction(() => document.getElementById('lab-status').textContent.startsWith('Replay complete'), null, { timeout: 15000 });
        await page.locator('.alert-button').first().click();
        assert.ok(await page.locator('.detail-headline').isVisible());
        assert.ok(requests.every((url) => url.startsWith(server.baseUrl)), `only same-origin requests: ${requests.filter((u) => !u.startsWith(server.baseUrl)).join(', ')}`);
        assert.deepEqual(problems, []);
      } finally {
        await close();
      }
    });
  }

  it('loads cleanly in dark mode and the timeline colours change with the theme', async () => {
    const { page, problems, close } = await open(LAB, { colorScheme: 'dark' });
    try {
      assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
      const mark = page.locator('#timeline .tl-mark.is-failure').first();
      const dark = await mark.evaluate((el) => getComputedStyle(el).fill);
      await page.locator('#theme-toggle').click();
      assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
      const light = await mark.evaluate((el) => getComputedStyle(el).fill);
      assert.notEqual(dark, light);
      assert.equal(await page.evaluate(() => localStorage.getItem('af-portfolio-theme')), 'light');
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('resolves every internal link and keeps outbound links on GitHub', async () => {
    const { page, close } = await open(LAB);
    try {
      const hrefs = await page.$$eval('a[href]', (anchors) => anchors.map((a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') })));
      assert.ok(hrefs.length > 8);
      for (const { href, target, rel } of hrefs) {
        if (href.startsWith('#')) {
          assert.equal(await page.locator(`[id="${href.slice(1)}"]`).count(), 1, `missing anchor target ${href}`);
        } else if (href.startsWith('/')) {
          const response = await page.request.get(server.baseUrl + href.split('#')[0]);
          assert.equal(response.status(), 200, `${href} returned ${response.status()}`);
        } else {
          assert.ok(href.startsWith('https://github.com/'), `unexpected outbound link ${href}`);
          if (target === '_blank') assert.ok(/noopener/.test(rel) && /noreferrer/.test(rel), `${href} lacks rel noopener noreferrer`);
        }
      }
    } finally {
      await close();
    }
  });

  it('enforces the content security policy: inline scripts and inline styles are blocked', async () => {
    const { page, problems, close } = await open(LAB);
    try {
      const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
      assert.match(csp, /default-src 'none'/);
      assert.ok(!csp.includes('unsafe-inline') && !csp.includes('unsafe-eval'));
      const result = await page.evaluate(() => {
        const script = document.createElement('script');
        script.textContent = 'window.__inlineRan = true;';
        document.body.append(script);
        const probe = document.createElement('div');
        probe.setAttribute('style', 'margin-left: 123px');
        document.body.append(probe);
        return { inlineRan: window.__inlineRan === true, margin: getComputedStyle(probe).marginLeft };
      });
      assert.equal(result.inlineRan, false, 'inline script executed despite the CSP');
      assert.notEqual(result.margin, '123px', 'inline style applied despite the CSP');
      assert.ok(problems.some((p) => /Content Security Policy/i.test(p)), 'the browser reported the blocked inline code');
    } finally {
      await close();
    }
  });
});

describe('security lab: initial state and investigation (desktop)', () => {
  it('shows the mixed preset from seed 42 with numbers that match the engine, and is reproducible', async () => {
    const { page, close } = await open(LAB);
    try {
      assert.ok((await status(page)).includes('seed 42'));
      assert.equal(number(await stat(page, 'stat-events')), MIXED.summary.events);
      assert.equal(number(await stat(page, 'stat-successes')), MIXED.summary.successes);
      assert.equal(number(await stat(page, 'stat-failures')), MIXED.summary.failures);
      assert.equal(number(await stat(page, 'stat-accounts')), MIXED.summary.accounts);
      assert.equal(number(await stat(page, 'stat-sources')), MIXED.summary.sources);
      assert.equal(number(await stat(page, 'stat-alerts')), MIXED.alerts.length);
      assert.ok((await page.locator('#stat-alerts').textContent()).includes(summaryByRule(MIXED)));
      assert.equal(await page.locator('#alerts-heading').textContent(), `Alerts · ${MIXED.alerts.length}`);
      assert.equal(await count(page, '.alert-button'), MIXED.alerts.length);
      assert.equal(await count(page, '#timeline .tl-mark'), MIXED.events.length, 'one timeline mark per event');
      assert.equal(await count(page, '#timeline .tl-alert'), MIXED.alerts.length, 'one timeline span per alert');
      assert.equal(await revealedMarks(page), MIXED.events.length, 'all events are shown initially');
      assert.equal(await stat(page, 'eval-precision'), `${(MIXED.evaluation.precision * 100).toFixed(1)}%`);
      assert.equal(await stat(page, 'eval-recall'), '100%');
      assert.equal(number(await stat(page, 'eval-fp')), MIXED.evaluation.alerts.falsePositive);
      assert.equal(await count(page, '#scenario-rows tr'), MIXED.dataset.scenarios.length);
      assert.ok(await page.locator('#play').isEnabled() && await page.locator('#pause').isDisabled() && await page.locator('#step').isDisabled() && await page.locator('#skip').isDisabled());
      const summary = await page.locator('#timeline-summary').textContent();
      assert.ok(summary.includes(`Timeline of ${MIXED.events.length} synthetic events`));
      await page.reload();
      assert.equal(await page.locator('#timeline-summary').textContent(), summary, 'the initial dataset is reproducible');
    } finally {
      await close();
    }
  });

  it('opens the investigation view for an alert with its explanation, ground truth and evidence', async () => {
    const { page, close } = await open(LAB);
    try {
      const first = MIXED.alerts[0];
      const explanation = D.explainAlert(first);
      const button = page.locator('.alert-button').first();
      assert.ok((await button.textContent()).includes(explanation.headline));
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('.detail-headline').textContent(), `${first.id} · ${explanation.headline}`);
      const body = await page.locator('#detail-body').textContent();
      assert.ok(body.includes(explanation.detail) && body.includes(explanation.caveat) && body.includes(explanation.nextSteps));
      const truth = MIXED.evaluation.alerts.rows.find((row) => row.id === first.id);
      assert.ok(body.includes(truth.truePositive ? 'True positive' : 'False positive'));
      assert.ok(body.includes('not a proof that the rule would catch a real attack') || body.includes('false positive'));
      assert.equal(await count(page, '.evidence-table tbody tr'), Math.min(25, first.evidence.length));
      assert.equal(await count(page, '#timeline .tl-alert.is-selected'), 1, 'the selected alert is highlighted on the timeline');
      await page.locator('#detail-body button', { hasText: 'Show all cited events' }).click();
      assert.ok((await page.locator('#table-status').textContent()).includes(`cited by alert ${first.id}`));
      assert.equal(await count(page, '#event-rows tr'), Math.min(50, first.evidence.length));
      await page.locator('#filter-clear').click();
      assert.ok((await page.locator('#table-status').textContent()).startsWith(`Showing all ${MIXED.events.length} events`));
      await page.locator('#detail-body button', { hasText: 'Clear selection' }).click();
      assert.equal(await count(page, '.alert-button[aria-pressed="true"]'), 0);
      assert.ok((await page.locator('#detail-body').textContent()).includes('Select an alert'));
      await page.locator('#timeline .tl-alert').nth(1).dispatchEvent('click');
      assert.equal(await page.locator('.alert-button[aria-pressed="true"]').getAttribute('data-alert'), await page.locator('#timeline .tl-alert').nth(1).getAttribute('data-alert'), 'a timeline span selects its alert');
    } finally {
      await close();
    }
  });

  it('is operable from the keyboard: alert activation moves focus to the investigation view', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('.alert-button').first().focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'detail');
      assert.equal(await page.locator('.alert-button').first().getAttribute('aria-pressed'), 'true');
      await page.locator('.alert-button').first().focus();
      await page.keyboard.press(' ');
      assert.equal(await page.locator('.alert-button').first().getAttribute('aria-pressed'), 'false', 'activating again clears the selection');
      await page.locator('#speed').focus();
      const before = await page.getAttribute('#speed', 'aria-valuetext');
      await page.keyboard.press('ArrowRight');
      assert.notEqual(await page.getAttribute('#speed', 'aria-valuetext'), before);
      await page.locator('#play').focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'reset', 'disabled Pause and Step (all events shown) are skipped in the tab order');
      await page.locator('#reset').click();
      await page.locator('#play').focus();
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'step', 'Step is reachable once there is something to step');
      await page.keyboard.press('Enter');
      assert.match(await status(page), /^Step 1 of/, 'Step activates from the keyboard');
    } finally {
      await close();
    }
  });
});

describe('security lab: playback', () => {
  it('resets, steps, plays, pauses, resumes and shows all, revealing alerts exactly when their trigger arrives', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#reset').click();
      assert.equal(await page.locator('#alerts-heading').textContent(), `Alerts · 0 of ${MIXED.alerts.length} so far`);
      assert.equal(await revealedMarks(page), 0);
      assert.equal(await count(page, '#timeline .tl-alert:not(.is-hidden)'), 0);
      assert.ok((await page.locator('#alerts').textContent()).includes('No events have been replayed yet'));
      assert.ok(await page.locator('#step').isEnabled() && await page.locator('#skip').isEnabled());
      const firstTrigger = MIXED.alerts[0].triggerIndex;
      for (let k = 0; k < firstTrigger; k += 1) await page.locator('#step').click();
      assert.equal(await revealedMarks(page), firstTrigger);
      assert.equal(await page.locator('#alerts-heading').textContent(), `Alerts · 0 of ${MIXED.alerts.length} so far`);
      await page.locator('#step').click();
      assert.match(await status(page), new RegExp(`^Step ${firstTrigger + 1} of ${MIXED.events.length}:`));
      assert.ok((await status(page)).includes(`New alert: ${MIXED.alerts[0].id}`));
      assert.equal(await page.locator('#alerts-heading').textContent(), `Alerts · 1 of ${MIXED.alerts.length} so far`);
      assert.equal(await count(page, '#timeline .tl-alert:not(.is-hidden)'), 1);
      await setRange(page, 'speed', 1);
      assert.equal(await page.getAttribute('#speed', 'aria-valuetext'), '1 events per second');
      await page.locator('#play').click();
      assert.ok((await status(page)).startsWith('Replaying'));
      assert.ok(await page.locator('#pause').isEnabled());
      assert.equal(await page.evaluate(() => document.activeElement.id), 'pause', 'focus moves to Pause when Play disables itself');
      await page.waitForFunction((n) => document.querySelectorAll('#timeline .tl-mark:not(.is-future)').length >= n, firstTrigger + 2, { timeout: 10000 });
      await page.locator('#pause').click();
      assert.match(await status(page), /^Paused after \d+ of [\d,]+ events/);
      assert.equal(await page.locator('#pause').textContent(), 'Resume');
      const paused = await revealedMarks(page);
      await page.waitForTimeout(1200);
      assert.equal(await revealedMarks(page), paused, 'nothing advances while paused');
      await page.locator('#step').click();
      assert.equal(await revealedMarks(page), paused + 1, 'Step advances exactly one event');
      await page.locator('#pause').click();
      assert.ok((await status(page)).startsWith('Resumed'));
      await page.waitForFunction((n) => document.querySelectorAll('#timeline .tl-mark:not(.is-future)').length > n, paused + 1, { timeout: 10000 });
      await page.locator('#skip').click();
      assert.equal(await revealedMarks(page), MIXED.events.length);
      assert.equal(await page.locator('#alerts-heading').textContent(), `Alerts · ${MIXED.alerts.length}`);
      assert.ok(await page.locator('#pause').isDisabled() && await page.locator('#step').isDisabled() && await page.locator('#skip').isDisabled());
      await setRange(page, 'speed', 10);
      await page.locator('#play').click();
      await page.waitForFunction(() => document.getElementById('lab-status').textContent.startsWith('Replay complete'), null, { timeout: 15000 });
      assert.equal(await revealedMarks(page), MIXED.events.length);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'play', 'focus returns to Play when the focused control is disabled');
    } finally {
      await close();
    }
  });

  it('does nothing on its own under prefers-reduced-motion but still plays on request', async () => {
    const { page, problems, close } = await open(LAB, { reducedMotion: 'reduce' });
    try {
      assert.ok((await status(page)).startsWith('Ready'));
      await page.waitForTimeout(400);
      assert.equal(await revealedMarks(page), MIXED.events.length, 'the full dataset is shown without any animation');
      await page.locator('#reset').click();
      await setRange(page, 'speed', 10);
      await page.locator('#play').click();
      await page.waitForFunction(() => document.getElementById('lab-status').textContent.startsWith('Replay complete'), null, { timeout: 15000 });
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });
});

describe('security lab: thresholds and comparison', () => {
  it('applies valid thresholds immediately, rejects invalid ones without changing the alerts, and resets', async () => {
    const { page, close } = await open(LAB);
    try {
      const loose = D.detect(MIXED.dataset.events, { repeatedFailures: { threshold: 3 } });
      await setNumber(page, 'r1-threshold', 3);
      assert.equal(number(await stat(page, 'stat-alerts')), loose.alerts.length);
      assert.ok((await status(page)).startsWith(`Thresholds applied to all ${MIXED.events.length} events: ${loose.alerts.length} alerts`));
      await setNumber(page, 'r1-threshold', 0);
      assert.equal(await page.getAttribute('#r1-threshold', 'aria-invalid'), 'true');
      assert.ok((await page.locator('#config-errors').textContent()).includes('R1 failures: must be a whole number between 1 and 1000'));
      assert.equal(number(await stat(page, 'stat-alerts')), loose.alerts.length, 'the last valid thresholds stay in force');
      assert.ok((await status(page)).includes('invalid value'));
      await setNumber(page, 'r2-window', 100000);
      assert.ok((await page.locator('#config-errors').textContent()).includes('R2 window'));
      await page.locator('#reset-thresholds').click();
      assert.equal(await page.inputValue('#r1-threshold'), '5');
      assert.equal(await page.inputValue('#r2-window'), '120');
      assert.equal(await page.inputValue('#r3-scope'), 'account');
      assert.equal(await count(page, '#config-errors li'), 0);
      assert.equal(number(await stat(page, 'stat-alerts')), MIXED.alerts.length);
      for (const id of ['r1-enabled', 'r2-enabled', 'r3-enabled']) await page.locator(`#${id}`).uncheck();
      assert.equal(await page.locator('#alerts-heading').textContent(), 'Alerts · 0');
      assert.ok((await page.locator('#alerts').textContent()).includes('All three rules are disabled'));
      assert.equal(await stat(page, 'eval-precision'), 'n/a');
      assert.ok((await page.locator('#eval-precision').textContent()).includes('undefined: no alerts were raised'));
      await page.locator('#r3-enabled').check();
      await setNumber(page, 'r3-failures', 1000);
      assert.ok((await page.locator('#alerts').textContent()).includes('No alerts: none of the'));
    } finally {
      await close();
    }
  });

  it('keeps the selected alert across a threshold change when it still exists', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('.alert-button').first().click();
      const source = MIXED.alerts[0].subject.source;
      await setNumber(page, 'r3-failures', 4);
      const headline = await page.locator('.detail-headline').textContent();
      assert.ok(headline.includes(source), `the same R1 alert stays selected: ${headline}`);
      assert.equal(await count(page, '.alert-button[aria-pressed="true"]'), 1);
    } finally {
      await close();
    }
  });

  it('compares two threshold sets on the same events with numbers that match the engine', async () => {
    const { page, close } = await open(LAB);
    try {
      assert.ok(await page.locator('#comparison').isHidden() && await page.locator('#compare-fields').isHidden());
      await page.locator('#compare').check();
      assert.ok(await page.locator('#comparison').isVisible() && await page.locator('#compare-fields').isVisible());
      assert.ok((await page.locator('#comparison-note').textContent()).includes('identical'));
      await setNumber(page, 'b-r2-window', 1800);
      await setNumber(page, 'b-r1-threshold', 3);
      assert.ok((await page.locator('#comparison-note').textContent()).includes('R1 failures 5 → 3; R2 window 120 → 1800'));
      const configB = { repeatedFailures: { threshold: 3 }, passwordSpray: { windowSeconds: 1800 } };
      const B = D.detect(MIXED.dataset.events, configB);
      const evalB = D.evaluate(B.events, B.alerts, MIXED.dataset.scenarios);
      const rows = await page.$$eval('#comparison-rows tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent)));
      const row = (label) => rows.find((r) => r[0] === label);
      assert.deepEqual(row('All alerts').slice(1, 3), [String(MIXED.alerts.length), String(B.alerts.length)]);
      assert.deepEqual(row('R1 alerts').slice(1, 3), [String(MIXED.summary.byRule.repeatedFailures), String(B.summary.byRule.repeatedFailures)]);
      assert.equal(row('Precision')[2], `${(evalB.precision * 100).toFixed(evalB.precision === 1 ? 0 : 1)}%`);
      assert.equal(row('False positives')[2], String(evalB.alerts.falsePositive));
      const diff = D.diffAlerts(MIXED.alerts, B.alerts);
      const boxes = await page.$$eval('#comparison-diff h4', (hs) => hs.map((h) => h.textContent));
      assert.deepEqual(boxes, [`Only under A · ${diff.onlyA.length}`, `Only under B · ${diff.onlyB.length}`, `Under both · ${diff.both.length}`]);
      await page.locator('#copy-to-b').click();
      assert.equal(await page.inputValue('#b-r2-window'), '120');
      assert.ok((await page.locator('#comparison-note').textContent()).includes('identical'));
      await setNumber(page, 'b-r1-threshold', -2);
      assert.ok((await page.locator('#config-errors-b').textContent()).includes('Set B was not applied'));
      await page.locator('#compare').uncheck();
      assert.ok(await page.locator('#comparison').isHidden());
    } finally {
      await close();
    }
  });
});

describe('security lab: datasets, seeds and export', () => {
  it('generates other presets deterministically and reports undefined recall without attacks', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.selectOption('#preset', 'quiet');
      assert.ok((await page.locator('#preset-hint').textContent()).includes('Forgetful user'));
      await page.locator('#generate').click();
      assert.equal(number(await stat(page, 'stat-events')), QUIET.summary.events);
      assert.equal(number(await stat(page, 'stat-alerts')), QUIET.alerts.length);
      assert.equal(await stat(page, 'eval-recall'), 'n/a');
      assert.ok((await page.locator('#eval-recall').textContent()).includes('undefined: no suspicious scenario'));
      assert.equal(await stat(page, 'eval-precision'), `${(QUIET.evaluation.precision * 100).toFixed(0)}%`);
      const before = await page.locator('#timeline-summary').textContent();
      await page.locator('#seed').fill('');
      await page.locator('#generate').click();
      assert.ok((await status(page)).includes('whole-number seed'));
      assert.equal(await page.locator('#timeline-summary').textContent(), before, 'an invalid seed changes nothing');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'seed');
      await page.locator('#seed').fill('7');
      await page.locator('#seed').press('Enter');
      const seven = D.runSynthetic({ seed: 7, preset: 'quiet' });
      assert.equal(number(await stat(page, 'stat-events')), seven.summary.events);
      await page.locator('#new-seed').click();
      assert.notEqual(await page.inputValue('#seed'), '7');
      assert.ok((await status(page)).includes(`seed ${Number(await page.inputValue('#seed')).toLocaleString('en-US')}`));
    } finally {
      await close();
    }
  });

  it('handles the large preset with a binned timeline and a paginated table, promptly', async () => {
    const { page, problems, close } = await open(LAB);
    try {
      await page.selectOption('#preset', 'large');
      const started = Date.now();
      await page.locator('#generate').click();
      assert.equal(number(await stat(page, 'stat-events')), LARGE.summary.events);
      assert.ok(Date.now() - started < 8000, 'the large preset renders promptly');
      assert.equal(number(await stat(page, 'stat-alerts')), LARGE.alerts.length);
      assert.equal(await count(page, '#timeline .tl-mark'), 0);
      assert.ok((await count(page, '#timeline .tl-bin')) > 50, 'events are binned');
      assert.ok((await page.locator('#timeline-summary').textContent()).includes('binned'));
      assert.ok((await page.locator('#timeline-summary').textContent()).includes('2026-03-03'), 'a dataset that crosses midnight shows both dates');
      assert.equal(await count(page, '#event-rows tr'), 50);
      const pages = Math.ceil(LARGE.summary.events / 50);
      assert.ok((await page.locator('#page-status').textContent()).startsWith(`Page 1 of ${pages.toLocaleString('en-US')}`));
      await page.locator('#page-next').click();
      assert.ok((await page.locator('#page-status').textContent()).startsWith(`Page 2 of ${pages.toLocaleString('en-US')}`));
      assert.equal(await page.locator('#event-rows tr td').first().textContent(), '51');
      await page.locator('#page-prev').click();
      assert.equal(await page.locator('#event-rows tr td').first().textContent(), '1');
      await page.locator('#reset').click();
      assert.equal(await count(page, '#timeline .tl-bin:not(.is-future)'), 0);
      await page.locator('#skip').click();
      assert.equal(await count(page, '#timeline .tl-bin.is-future'), 0);
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('exports the current synthetic dataset as a local JSON download in the import schema', async () => {
    const { page, close } = await open(LAB);
    try {
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export').click()]);
      assert.equal(download.suggestedFilename(), 'security-events-mixed-seed42.json');
      const text = readFileSync(await download.path(), 'utf8');
      const parsed = JSON.parse(text);
      assert.equal(parsed.format, 'security-events-lab/v1');
      assert.equal(parsed.events.length, MIXED.events.length);
      assert.ok(parsed.events.every((e) => D.isAllowedSource(e.source)));
      const reimport = D.parseImport(text);
      assert.ok(reimport.ok && reimport.labelled);
      assert.ok((await status(page)).startsWith(`Exported ${MIXED.events.length.toLocaleString('en-US')} events`));
    } finally {
      await close();
    }
  });
});

describe('security lab: event table filters', () => {
  it('filters by outcome, account, source, label and citation, with counts that match the engine', async () => {
    const { page, close } = await open(LAB);
    try {
      const events = MIXED.events;
      await page.selectOption('#filter-outcome', 'failure');
      assert.equal(await page.locator('#table-status').textContent(), `Showing ${MIXED.summary.failures} of ${events.length} events matching the filters.`);
      await page.selectOption('#filter-outcome', 'all');
      const account = events[0].account;
      await page.locator('#filter-account').fill(account.slice(0, 4));
      const expectedAccount = events.filter((e) => e.account.includes(account.slice(0, 4))).length;
      assert.ok((await page.locator('#table-status').textContent()).startsWith(`Showing ${expectedAccount} of`));
      await page.locator('#filter-account').fill('');
      await page.locator('#filter-source').fill('203.0.113.');
      const expectedSource = events.filter((e) => e.source.includes('203.0.113.')).length;
      assert.ok((await page.locator('#table-status').textContent()).startsWith(`Showing ${expectedSource} of`));
      await page.locator('#filter-source').fill('');
      await page.selectOption('#filter-verdict', 'suspicious');
      const suspicious = events.filter((e) => e.verdict === 'suspicious').length;
      assert.ok((await page.locator('#table-status').textContent()).startsWith(`Showing ${suspicious} of`));
      assert.equal(await count(page, '#event-rows .label-pill.is-benign'), 0);
      await page.selectOption('#filter-verdict', 'all');
      await page.locator('#filter-flagged').check();
      assert.ok((await page.locator('#table-status').textContent()).startsWith(`Showing ${MIXED.summary.flaggedEvents} of`));
      assert.equal(await count(page, '#event-rows td.is-cited'), Math.min(50, MIXED.summary.flaggedEvents));
      await page.locator('#filter-account').fill('no-such-account');
      assert.ok((await page.locator('#event-rows').textContent()).includes('No events match the current filters.'));
      await page.locator('#filter-clear').click();
      assert.equal(await page.locator('#table-status').textContent(), `Showing all ${events.length} events, 50 per page.`);
      assert.ok(!(await page.locator('#filter-flagged').isChecked()));
      assert.equal(await page.locator('#event-rows tr').first().locator('td').nth(1).textContent(), D.formatUtc(events[0].ts, { millis: true }).replace(' UTC', ''));
    } finally {
      await close();
    }
  });
});

describe('security lab: local import', () => {
  it('validates pasted JSON strictly and loads labelled synthetic events as inert text', async () => {
    const { page, problems, close } = await open(LAB);
    try {
      await page.locator('#import-text').fill('{not json');
      await page.locator('#import-load').click();
      assert.ok((await page.locator('#import-result').textContent()).includes('not valid JSON'));
      assert.equal(number(await stat(page, 'stat-events')), MIXED.events.length, 'nothing was loaded');
      await page.locator('#import-text').fill(JSON.stringify([sample({ source: '10.0.0.1', bogus: true })]));
      await page.locator('#import-load').click();
      const errors = await page.locator('#import-result').textContent();
      assert.ok(errors.includes('Record 1, field “bogus”') && errors.includes('Record 1, field “source”') && errors.includes('reserved documentation ranges only'));
      await page.locator('#import-text').fill(bruteForceJson(true));
      await page.locator('#import-load').click();
      const expected = D.parseImport(bruteForceJson(true));
      const run = D.detect(expected.events);
      assert.ok((await page.locator('#import-result').textContent()).includes('Loaded 7 events from the pasted text with ground-truth labels'));
      assert.equal(number(await stat(page, 'stat-events')), 7);
      assert.equal(number(await stat(page, 'stat-alerts')), run.alerts.length);
      assert.ok((await page.locator('#dataset-label').textContent()).startsWith('IMPORTED LOCALLY') || (await page.locator('#dataset-label').textContent()).startsWith('Imported locally'));
      assert.ok(await page.locator('#import-restore').isVisible());
      assert.ok(await page.locator('#eval-unavailable').isHidden());
      assert.equal(await stat(page, 'eval-recall'), '100%');
      assert.equal(await count(page, 'img'), 0, 'markup in a field is never interpreted');
      const reasonCell = await page.locator('#event-rows tr').last().locator('td').nth(5).textContent();
      assert.equal(reasonCell, '<img src=x onerror=alert(1)>');
      await page.locator('#import-text').fill(bruteForceJson(false));
      await page.locator('#import-load').click();
      assert.ok((await page.locator('#import-result').textContent()).includes('without labels'));
      assert.ok(await page.locator('#eval-unavailable').isVisible());
      assert.ok((await page.locator('#eval-unavailable').textContent()).includes('no ground-truth labels'));
      assert.equal(await stat(page, 'eval-precision'), 'n/a');
      assert.ok(await page.locator('#filter-verdict').isDisabled());
      await page.locator('.alert-button').first().click();
      assert.ok((await page.locator('#detail-body').textContent()).includes('no ground-truth labels'));
      await page.locator('#import-restore').click();
      assert.equal(number(await stat(page, 'stat-events')), MIXED.events.length);
      assert.ok(await page.locator('#import-restore').isHidden());
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('reads a local file, refuses oversized files, and shows every empty state for an empty dataset', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#import-file').setInputFiles({ name: 'events.json', mimeType: 'application/json', buffer: Buffer.from(bruteForceJson(true)) });
      await page.waitForFunction(() => document.getElementById('import-result').textContent.includes('Loaded'));
      assert.ok((await page.locator('#import-result').textContent()).includes('file “events.json”'));
      assert.equal(number(await stat(page, 'stat-events')), 7);
      assert.ok((await page.inputValue('#import-text')).includes('u-test'), 'small files are echoed into the text area');
      await page.locator('#import-file').setInputFiles({ name: 'huge.json', mimeType: 'application/json', buffer: Buffer.alloc(D.LIMITS.maxImportBytes + 1, 0x20) });
      await page.waitForFunction(() => document.getElementById('import-result').textContent.includes('limit is'));
      assert.equal(number(await stat(page, 'stat-events')), 7, 'an oversized file is refused without being read');
      await page.locator('#import-text').fill('[]');
      await page.locator('#import-load').click();
      assert.equal(number(await stat(page, 'stat-events')), 0);
      assert.ok((await page.locator('#alerts').textContent()).includes('No events are loaded'));
      assert.ok((await page.locator('#timeline').textContent()).includes('No events loaded'));
      assert.ok((await page.locator('#event-rows').textContent()).includes('No events are loaded.'));
      assert.ok((await page.locator('#eval-unavailable').textContent()).includes('no events'));
      assert.ok(await page.locator('#play').isDisabled() && await page.locator('#export').isDisabled());
      assert.equal(await page.locator('#page-status').textContent(), 'Page 1 of 1');
      await page.locator('#import-clear').click();
      assert.equal(await page.inputValue('#import-text'), '');
      assert.equal(await page.locator('#import-result').textContent(), '');
    } finally {
      await close();
    }
  });
});

describe('security lab: mobile usability', () => {
  it('fits a 375px viewport, scrolls the timeline inside its frame, and opens an investigation by touch', async () => {
    const { page, problems, close } = await open(LAB, { viewport: VIEWPORTS.mobile, hasTouch: true });
    try {
      const frame = await page.locator('#timeline').evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth, right: el.getBoundingClientRect().right }));
      assert.ok(frame.scroll > frame.client, 'the timeline scrolls inside its own frame');
      assert.ok(frame.right <= 375);
      const small = await page.$$eval('.lab-actions button, .panel-actions button, .alert-button, .pager button', (els) => els.filter((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().height < 40).map((el) => el.id || el.className).length);
      assert.equal(small, 0, 'all primary controls are at least 40px tall');
      await page.locator('.alert-button').first().scrollIntoViewIfNeeded();
      const box = await page.locator('.alert-button').first().boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await page.locator('.alert-button').first().getAttribute('aria-pressed'), 'true');
      assert.ok(await page.locator('.detail-headline').isVisible());
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });
});

describe('portfolio page with the security lab', () => {
  it('lists four projects, filters Security, and links Project 04 to the lab', async () => {
    const { page, problems, close } = await open('/');
    try {
      assert.equal(await count(page, '.project'), 4);
      assert.equal(await page.locator('#filter-status').textContent(), 'Showing 4 projects.');
      await page.locator('[data-filter="security"]').click();
      assert.equal(await count(page, '.project:not([hidden])'), 1);
      assert.ok(await page.locator('.project-security').isVisible());
      assert.equal(await page.locator('#filter-status').textContent(), 'Showing 1 project.');
      await page.locator('[data-filter="interactive"]').click();
      assert.equal(await count(page, '.project:not([hidden])'), 2, 'both labs are interactive');
      await page.locator('[data-filter="engineering"]').click();
      assert.equal(await count(page, '.project:not([hidden])'), 3);
      await page.locator('[data-filter="all"]').click();
      assert.equal(await count(page, '.project:not([hidden])'), 4);
      const card = (await page.locator('.project-security').textContent()).toLowerCase();
      assert.ok(card.includes('synthetic events only') && card.includes('not a production siem'));
      assert.ok((await page.locator('.stat-number').first().textContent()).includes('04'));
      await page.locator('.project-security a[href="/lab/security-events/"]').click();
      await page.waitForURL(`**${LAB}`);
      assert.ok((await page.locator('h1').textContent()).includes('Security Event Detection'));
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });
});
