/**
 * Browser tests for the E-Commerce Executive Analytics Lab.
 *
 * Runs with Node's built-in test runner and the Playwright library (Chromium),
 * resolved through NODE_PATH exactly like the other browser suites. Expected
 * numbers are computed in Node from the same pure engine the page imports, so
 * every figure the page shows is checked against actual computation.
 *
 *   NODE_PATH=/path/to/node_modules node --test tests/browser/*.test.js
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startServer } from './helpers/server.js';
import * as M from '../../lab/ecommerce/model.js';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  throw new Error(`Playwright is not resolvable (${error.message}). Install it outside the repository and set NODE_PATH; see lab/ecommerce/README.md → "Reproducing the tests".`);
}

const VIEWPORTS = {
  narrow: { width: 320, height: 568 },
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1920, height: 1080 },
};
const LAB = '/lab/ecommerce/';

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
async function open(url, { viewport = VIEWPORTS.desktop, colorScheme = 'dark', reducedMotion = 'no-preference', hasTouch = false, javaScriptEnabled = true } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion, hasTouch, isMobile: hasTouch, javaScriptEnabled });
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

const status = (page) => page.locator('#sim-status').textContent();
const stat = async (page, id) => (await page.locator(`#${id}`).evaluate((dd) => dd.firstChild.textContent)).trim();
const count = (page, selector) => page.locator(selector).count();
const setRange = (page, id, value) => page.evaluate(([i, v]) => {
  const el = document.getElementById(i);
  el.value = v;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}, [id, String(value)]);
const setNumber = async (page, id, value) => { await page.locator(`#${id}`).fill(String(value)); await page.locator(`#${id}`).dispatchEvent('change'); };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const clipped = (page) => page.evaluate(() => {
  const width = window.innerWidth;
  const inScroller = (el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
    return false;
  };
  const found = [];
  for (const el of document.querySelectorAll('body *')) {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height || getComputedStyle(el).visibility === 'hidden') continue;
    if ((rect.right > width + 0.5 || rect.left < -0.5) && !inScroller(el)) found.push(`${el.tagName.toLowerCase()}#${el.id || ''} left=${rect.left.toFixed(1)} right=${rect.right.toFixed(1)}`);
  }
  return found.slice(0, 8);
});
/** Chart text drawn outside its own SVG: labels pushed past the edge at narrow widths or by long values. */
const strayChartText = (page) => page.evaluate(() => {
  const found = [];
  for (const svg of document.querySelectorAll('.chart-frame > svg')) {
    const width = Number(svg.getAttribute('width'));
    const height = Number(svg.getAttribute('height'));
    for (const text of svg.querySelectorAll('text')) {
      const box = text.getBBox();
      if (box.x < -0.5 || box.y < -0.5 || box.x + box.width > width + 0.5 || box.y + box.height > height + 0.5) found.push(`${svg.parentElement.id}: "${text.textContent}" x=${box.x.toFixed(1)} w=${box.width.toFixed(1)} y=${box.y.toFixed(1)} h=${box.height.toFixed(1)} in ${width}×${height}`);
    }
  }
  return found.slice(0, 8);
});
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
  for (const el of document.querySelectorAll('button, input, select, textarea, a[href], [role="img"], [role="group"], table')) {
    const labelledBy = el.getAttribute('aria-labelledby');
    const byId = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
    const wrapped = el.closest('label');
    const caption = el.tagName === 'TABLE' ? el.querySelector('caption') : null;
    const name = (el.getAttribute('aria-label') || '')
      || (labelledBy ? visibleText(document.getElementById(labelledBy) || el) : '')
      || (byId ? visibleText(byId) : '')
      || (wrapped ? visibleText(wrapped) : '')
      || (caption ? visibleText(caption) : '')
      || (el.tagName === 'TABLE' || el.tagName === 'DIV' ? '' : visibleText(el))
      || (el.getAttribute('title') || '');
    if (!name.trim()) gaps.push(`${el.tagName.toLowerCase()}#${el.id || ''}.${el.className || ''}`);
  }
  // An ARIA name on a generic element is not exposed; it needs a role.
  for (const el of document.querySelectorAll('div[aria-label], span[aria-label], div[aria-labelledby], span[aria-labelledby]')) {
    if (!el.getAttribute('role')) gaps.push(`${el.tagName.toLowerCase()}#${el.id || ''} carries an ARIA name without a role`);
  }
  return gaps;
});
const duplicateIds = (page) => page.evaluate(() => {
  const seen = new Map();
  for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) || 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
});
const expectOutputs = async (page, scenario) => {
  assert.equal(await stat(page, 'out-revenue'), M.formatMillionsBRL(scenario.revenueBRL));
  assert.equal(await stat(page, 'out-revenue-change'), M.formatSignedMillionsBRL(scenario.revenueChangeBRL));
  assert.equal(await stat(page, 'out-orders'), `≈ ${M.formatCompact(scenario.orders)}`);
  assert.equal(await stat(page, 'out-aov'), M.formatBRL(scenario.averageOrderBRL));
  assert.equal(await stat(page, 'out-delivery'), M.formatPercent(scenario.deliveredPct));
  assert.equal(await stat(page, 'out-ontime'), M.formatPercent(scenario.onTimeOfDeliveredPct));
  assert.equal(await stat(page, 'out-ontime-all'), M.formatPercent(scenario.onTimeOfAllPct));
  assert.equal(await stat(page, 'out-missed'), `≈ ${M.formatInt(scenario.lateOrders + scenario.undeliveredOrders)}`);
};

describe('analytics lab: page integrity across viewports and themes', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    for (const colorScheme of ['dark', 'light']) {
      it(`${LAB} at ${name} (${viewport.width}px, ${colorScheme}) loads without errors, overflow, clipping or unnamed controls`, async () => {
        const { page, response, problems, requests, close } = await open(LAB, { viewport, colorScheme });
        try {
          assert.equal(response.status(), 200);
          assert.equal(await page.getAttribute('html', 'data-theme'), colorScheme, 'the system colour scheme is respected');
          assert.equal(await page.locator('h1').count(), 1, 'exactly one h1');
          assert.equal(await overflow(page), 0, 'no horizontal overflow');
          assert.deepEqual(await clipped(page), [], 'nothing is cut off at the viewport edge');
          assert.deepEqual(await duplicateIds(page), []);
          assert.deepEqual(await accessibleNameGaps(page), [], 'controls without an accessible name');
          assert.equal(await count(page, '#category-chart svg, #top-ten-chart svg, #status-chart svg, #outcome-chart svg, #scenario-chart svg, #scenario-outcomes svg'), 6, 'all six charts are drawn');
          assert.deepEqual(await strayChartText(page), [], 'no chart text is drawn outside its chart');
          await setRange(page, 'volume-range', 20);
          assert.equal(await stat(page, 'out-revenue'), M.formatMillionsBRL(M.calculateScenario({ volumePct: 20 }).revenueBRL));
          await setRange(page, 'basket-range', -30);
          await setRange(page, 'ontime-range', -25);
          assert.equal(await overflow(page), 0, 'still no overflow after a scenario change');
          assert.deepEqual(await clipped(page), [], 'nothing is cut off after a scenario change');
          assert.deepEqual(await strayChartText(page), [], 'no chart text outside its chart after a scenario change');
          assert.ok(requests.every((url) => url.startsWith(server.baseUrl)), `only same-origin requests: ${requests.filter((u) => !u.startsWith(server.baseUrl)).join(', ')}`);
          assert.deepEqual(problems, []);
        } finally {
          await close();
        }
      });
    }
  }

  it('reads without JavaScript: the KPIs, the chart tables, the DAX and the wiring stay in the markup and the notes say what is missing', async () => {
    const { page, response, close } = await open(LAB, { javaScriptEnabled: false });
    try {
      assert.equal(response.status(), 200);
      for (const metric of M.METRICS) assert.equal(await page.locator(`[data-metric="${metric.id}"]`).evaluate((p) => p.firstChild.textContent), metric.display);
      assert.equal(await count(page, '.chart-frame svg'), 0, 'no chart is drawn');
      assert.equal(await count(page, '.table-button'), 0, 'no explorer is built');
      // Playwright's text engine skips <noscript>, so the notes are located by structure and read directly.
      const notes = page.locator('noscript > p.empty-state');
      assert.equal(await notes.count(), 3);
      for (const [index, lead] of [['The four charts below need JavaScript.', 0], ['The simulator and its two charts need JavaScript', 1], ['The data-model explorer needs JavaScript.', 2]].map(([text, i]) => [i, text])) {
        assert.ok(await notes.nth(index).isVisible(), `note ${index} is rendered`);
        assert.ok((await notes.nth(index).textContent()).startsWith(lead), `note ${index} says what is missing`);
      }
      assert.ok((await status(page)).startsWith('The simulator needs JavaScript'));
      for (const [figure, rows, expected] of [['#categories', '#category-rows', 2], ['#top-ten', '#top-ten-rows', 10], ['#status-mix', '#status-rows', 4], ['#delivery-outcomes', '#outcome-rows', 3]]) {
        await page.locator(`${figure} .table-view summary`).click();
        assert.equal(await count(page, `${rows} tr`), expected, `${figure} rows without JavaScript`);
        assert.ok(await page.locator(`${rows} tr`).first().isVisible(), `${figure} table opens without JavaScript`);
      }
      assert.ok((await page.locator('#top-ten-rows').textContent()).includes('computers acce… (truncated in the export)'));
      assert.equal(await count(page, '.dax-card .dax-block'), M.DAX_MEASURES.filter((d) => d.published).length, 'the published DAX is in the markup');
      assert.equal(await count(page, '.dax-card'), M.DAX_MEASURES.filter((d) => d.published).length + 1, 'plus the card naming the unpublished measures');
      assert.equal(await count(page, '#wiring-table tbody tr'), M.DASHBOARD_VISUALS.length);
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

  it('resolves every internal link and keeps outbound links on GitHub with safe rel attributes', async () => {
    const { page, close } = await open(LAB);
    try {
      const hrefs = await page.$$eval('a[href]', (anchors) => anchors.map((a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') })));
      assert.ok(hrefs.length > 20);
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
      for (const url of Object.values(M.SOURCE.files)) assert.ok(hrefs.some((h) => h.href === url), `source file link ${url}`);
    } finally {
      await close();
    }
  });
});

describe('analytics lab: published dashboard', () => {
  it('shows the six README KPIs with their definitions and the DAX behind them', async () => {
    const { page, close } = await open(LAB);
    try {
      for (const metric of M.METRICS) {
        const tile = page.locator(`.kpi-tile:has([data-metric="${metric.id}"])`);
        assert.equal(await tile.locator('.kpi-value').evaluate((p) => p.firstChild.textContent), metric.display);
        assert.ok((await tile.textContent()).includes(metric.definition));
        await tile.locator('summary').click();
        assert.ok(await tile.locator('.kpi-caveat').isVisible());
        const measure = M.DAX_MEASURES.find((d) => d.card === metric.id);
        if (measure.published) assert.equal(await tile.locator('.dax-block').textContent(), measure.dax);
        else assert.ok((await tile.locator('.dax-missing').textContent()).includes('not published'));
      }
      const quoted = await page.$$eval('.dax-card .dax-block', (blocks) => blocks.map((b) => b.textContent));
      assert.deepEqual(quoted, M.DAX_MEASURES.filter((d) => d.published).map((d) => d.dax), 'the lineage cards quote the DAX verbatim');
    } finally {
      await close();
    }
  });

  it('draws the category, top-ten, status and outcome charts from the engine, each with a table view', async () => {
    const { page, problems, close } = await open(LAB);
    try {
      assert.equal(await count(page, '#category-chart .mark'), 2);
      const categoryText = await page.locator('#category-chart').textContent();
      assert.ok(categoryText.includes('R$1.44M') && categoryText.includes('R$1.31M') && categoryText.includes('Health and beauty'));
      assert.ok((await page.locator('#category-caption').textContent()).includes(`by ${M.formatMillionsBRL(M.DERIVED.categoryGapBRL)} (${M.formatSignedPercent(M.DERIVED.categoryGapPct)})`));
      assert.equal(await count(page, '#top-ten-chart .mark'), 10);
      assert.equal(await count(page, '#top-ten-chart .bar-pub'), 2, 'the two README categories are emphasised');
      assert.equal(await count(page, '#top-ten-chart .bar-rest'), 8);
      assert.equal(await count(page, '#top-ten-chart text.label-strong'), 2, 'the two README categories carry bold labels');
      assert.equal(await count(page, '#top-ten-chart text.label-plain'), 8, 'the exported-only labels are plain');
      assert.ok((await page.locator('#top-ten-chart').textContent()).includes('computers acce…'), 'the truncated label is shown as printed');
      assert.ok((await page.locator('#top-ten-caption').textContent()).includes(M.formatMillionsBRL(M.DERIVED.topTenTotalBRL)));
      assert.equal(await count(page, '#status-chart .mark'), 3);
      const statusText = await page.locator('#status-chart').textContent();
      for (const row of M.EXPORTED.statusCounts) assert.ok(statusText.includes(M.formatInt(row.orders)), `${row.label} count`);
      assert.ok((await page.locator('#status-caption').textContent()).includes('= 97.02%, the published delivery rate'));
      assert.equal(await count(page, '#outcome-chart .mark'), 3);
      const legend = await page.locator('#outcome-chart .chart-legend').textContent();
      assert.ok(legend.includes(M.formatPercent(M.DERIVED.onTimeOfAllPct)) && legend.includes(M.formatPercent(M.DERIVED.lateOfAllPct)) && legend.includes(M.formatPercent(M.DERIVED.notDeliveredPct)));
      for (const [figure, rows, expected] of [['#categories', '#category-rows', 2], ['#top-ten', '#top-ten-rows', 10], ['#status-mix', '#status-rows', 4], ['#delivery-outcomes', '#outcome-rows', 3]]) {
        await page.locator(`${figure} .table-view summary`).click();
        assert.equal(await count(page, `${rows} tr`), expected, `${figure} table rows`);
      }
      assert.equal(await page.locator('#status-rows tr').last().locator('td').nth(1).textContent(), M.formatInt(M.DERIVED.statusTotalOrders));
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('shows a tooltip on hover and reads each mark with the arrow keys', async () => {
    const { page, close } = await open(LAB);
    try {
      const tip = page.locator('#top-ten-chart .chart-tip');
      assert.ok(await tip.isHidden());
      await page.locator('#top-ten-chart .mark').first().hover();
      assert.ok(await tip.isVisible());
      const hovered = await tip.textContent();
      assert.ok(hovered.includes('health beauty') && hovered.includes('R$1.44M') && hovered.includes('Also named in the README'));
      await page.mouse.move(0, 0);
      assert.ok(await tip.isHidden(), 'the tooltip hides when the pointer leaves');
      const svg = page.locator('#top-ten-chart svg');
      assert.equal(await svg.getAttribute('tabindex'), '0');
      assert.ok((await svg.getAttribute('aria-label')).includes('arrow keys'));
      await svg.focus();
      await page.keyboard.press('Home');
      assert.ok((await tip.textContent()).startsWith('1. health beauty'));
      await page.keyboard.press('ArrowRight');
      assert.ok((await tip.textContent()).startsWith('2. watches gifts'));
      assert.equal(await count(page, '#top-ten-chart .mark.is-active'), 1);
      await page.keyboard.press('End');
      assert.ok((await tip.textContent()).startsWith('10. garden tools'));
      await page.keyboard.press('ArrowRight');
      assert.ok((await tip.textContent()).startsWith('1. health beauty'), 'the arrows wrap around');
      await page.keyboard.press('Escape');
      assert.ok(await tip.isHidden());
      await page.keyboard.press('Tab');
      assert.equal(await count(page, '#top-ten-chart .mark.is-active'), 0, 'leaving the chart clears the active mark');
    } finally {
      await close();
    }
  });

  it('toggles the tooltip with a tap on a touch screen', async () => {
    const { page, problems, close } = await open(LAB, { viewport: VIEWPORTS.mobile, hasTouch: true });
    try {
      const tip = page.locator('#category-chart .chart-tip');
      await page.locator('#category-chart').evaluate((frame) => frame.scrollIntoView({ block: 'center' }));
      const mark = page.locator('#category-chart .mark').first();
      const box = await mark.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      assert.ok(await tip.isVisible(), 'a tap shows the tooltip');
      assert.ok((await tip.textContent()).includes('R$1.44M'));
      assert.equal(await count(page, '#category-chart .mark.is-active'), 1);
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      assert.ok(await tip.isHidden(), 'a second tap on the same mark hides it');
      assert.equal(await count(page, '#category-chart .mark.is-active'), 0);
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('keeps focus and the active mark when a chart is redrawn at a new width', async () => {
    const { page, close } = await open(LAB);
    try {
      const third = M.EXPORTED.topCategories[2].label;
      await page.locator('#top-ten-chart svg').focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      assert.ok((await page.locator('#top-ten-chart .chart-tip').textContent()).startsWith(`3. ${third}`));
      const before = await page.locator('#top-ten-chart svg').getAttribute('width');
      await page.setViewportSize({ width: 900, height: 800 });
      await page.waitForFunction((previous) => { const svg = document.querySelector('#top-ten-chart svg'); return svg && svg.getAttribute('width') !== previous; }, before);
      assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#top-ten-chart svg')), true, 'the redrawn chart holds focus');
      assert.equal(await page.evaluate(() => [...document.querySelectorAll('#top-ten-chart .mark')].findIndex((m) => m.classList.contains('is-active'))), 2, 'the same mark is active');
      assert.ok((await page.locator('#top-ten-chart .chart-tip').textContent()).startsWith(`3. ${third}`), 'the tooltip still reads it');
      await page.keyboard.press('ArrowRight');
      assert.ok((await page.locator('#top-ten-chart .chart-tip').textContent()).startsWith('4. '), 'the keyboard keeps working on the redrawn chart');
    } finally {
      await close();
    }
  });

  it('re-renders the charts at the container width when the viewport changes', async () => {
    const { page, close } = await open(LAB);
    try {
      const widthOf = () => page.locator('#top-ten-chart svg').evaluate((svg) => ({ attr: Number(svg.getAttribute('width')), frame: svg.parentElement.clientWidth }));
      const before = await widthOf();
      assert.equal(before.attr, before.frame);
      await page.setViewportSize({ width: 900, height: 800 });
      await page.waitForFunction(() => { const svg = document.querySelector('#top-ten-chart svg'); return Number(svg.getAttribute('width')) === svg.parentElement.clientWidth && Number(svg.getAttribute('width')) !== 0; });
      const after = await widthOf();
      assert.notEqual(after.attr, before.attr, 'the chart was redrawn for the new width');
      assert.equal(await overflow(page), 0);
    } finally {
      await close();
    }
  });
});

describe('analytics lab: what-if simulator', () => {
  it('starts at the published baseline with every output equal to the engine', async () => {
    const { page, close } = await open(LAB);
    try {
      await expectOutputs(page, M.BASELINE);
      assert.equal(await stat(page, 'out-orders'), '≈ 99.4K', 'literal, not the engine formatter');
      assert.equal(await stat(page, 'out-ontime-all'), '89.14%');
      assert.equal(await stat(page, 'out-missed'), '≈ 10,795');
      assert.equal(await page.locator('[data-preset="baseline"]').getAttribute('aria-pressed'), 'true');
      assert.ok((await status(page)).startsWith('Published baseline loaded'));
      for (const id of ['volume-range', 'basket-range', 'delivery-range', 'ontime-range']) {
        assert.equal(await page.inputValue(`#${id}`), '0');
        assert.equal(await page.getAttribute(`#${id}`, 'aria-valuetext'), 'no change, published baseline');
      }
      assert.ok((await page.locator('#out-revenue small').textContent()).includes('published baseline, no change'));
      assert.ok((await page.locator('#out-orders small').textContent()).includes('implied by R$15.84M ÷ R$159.33, not a published count'));
      assert.ok((await page.locator('#out-ontime-all small').textContent()).includes('derived: 97.02% × 91.88%, not a published figure'));
      assert.ok((await page.locator('#out-missed small').textContent()).startsWith('derived from the published rates and the implied order count, not a published figure'));
      assert.ok((await page.locator('#scenario-caption').textContent()).includes('No change'));
      assert.ok((await page.locator('#hypo-banner').textContent()).includes('Not a reported result'));
    } finally {
      await close();
    }
  });

  it('recalculates immediately when sliders move, matching calculateScenario, and labels the result hypothetical', async () => {
    const { page, problems, close } = await open(LAB);
    try {
      await setRange(page, 'volume-range', 15);
      const one = M.calculateScenario({ volumePct: 15 });
      await expectOutputs(page, one);
      assert.equal(await page.inputValue('#volume-value'), '15', 'the typed twin follows the slider');
      assert.equal(await page.getAttribute('#volume-range', 'aria-valuetext'), '+15%, hypothetical change');
      assert.ok((await status(page)).includes('Hypothetical scenario: order volume +15%.'));
      assert.equal(await page.locator('[data-preset="baseline"]').getAttribute('aria-pressed'), 'false');
      assert.ok((await page.locator('#scenario-caption').textContent()).startsWith('Hypothetical: order volume +15%.'));
      assert.equal(await count(page, '#scenario-chart .bar-hypo'), 3);
      assert.equal(await count(page, '#scenario-chart pattern'), 1, 'hypothetical bars carry the hatch pattern');
      await setRange(page, 'basket-range', 10);
      await setRange(page, 'delivery-range', -5);
      await setRange(page, 'ontime-range', 3);
      const all = M.calculateScenario({ volumePct: 15, basketPct: 10, deliveryPoints: -5, onTimePoints: 3 });
      await expectOutputs(page, all);
      assert.ok((await status(page)).includes('order volume +15%, average basket value +10%, delivery rate −5.0 pts, on-time delivery +3.0 pts'));
      await page.locator('#scenario-figure .table-view summary').click();
      const rows = await page.$$eval('#scenario-rows tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent)));
      assert.equal(rows[0][2], `${M.formatMillionsBRL(all.revenueBRL)} (hypothetical)`);
      assert.equal(rows[0][4], String(M.roundTo(all.index.revenue, 1)));
      assert.equal(rows[1][4], String(all.index.orders));
      assert.equal(rows[2][4], String(all.index.averageOrder));
      assert.ok((await page.locator('#out-missed small').textContent()).startsWith('hypothetical:'));
      await page.locator('#scenario-outcomes-figure .table-view summary').click();
      const outcomes = await page.$$eval('#scenario-outcome-rows tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent)));
      assert.equal(outcomes[0][1], M.formatPercent(M.DERIVED.onTimeOfAllPct));
      assert.ok(outcomes[0][2].startsWith(M.formatPercent(all.onTimeOfAllPct)));
      assert.equal(outcomes[2][3], `≈ ${M.formatInt(all.undeliveredOrders)}`);
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('rounds a half-way percentage away from zero: volume +3% with basket +15% reads +18.5% and index 118.5', async () => {
    const { page, close } = await open(LAB);
    try {
      await setRange(page, 'volume-range', 3);
      await setRange(page, 'basket-range', 15);
      assert.equal(await stat(page, 'out-revenue'), 'R$18.76M');
      assert.equal(await stat(page, 'out-revenue-change'), '+R$2.92M');
      assert.equal(await page.locator('#out-revenue-change small').textContent(), '+18.5% versus published R$15.84M');
      assert.ok((await status(page)).includes('(+R$2.92M, +18.5%)'));
      assert.ok((await page.locator('#scenario-caption').textContent()).includes('R$18.76M (+18.5%)'));
      await page.locator('#scenario-figure .table-view summary').click();
      const rows = await page.$$eval('#scenario-rows tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent)));
      assert.equal(rows[0][3], '+18.5% · +R$2.92M');
      assert.equal(rows[0][4], '118.5');
      assert.equal(rows[1][4], '103');
      assert.equal(rows[2][4], '115');
      await setRange(page, 'volume-range', -15);
      await setRange(page, 'basket-range', -15);
      const down = await page.$$eval('#scenario-rows tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent)));
      assert.equal(down[0][4], '72.3');
      assert.equal(await page.locator('#out-revenue-change small').textContent(), '−27.8% versus published R$15.84M');
    } finally {
      await close();
    }
  });

  it('accepts typed values, clamps and steps them, keeps the previous value on invalid input, and applies on Enter', async () => {
    const { page, close } = await open(LAB);
    try {
      await setNumber(page, 'basket-value', 300);
      assert.equal(await page.inputValue('#basket-range'), '30');
      assert.equal(await page.inputValue('#basket-value'), '30');
      assert.ok((await status(page)).includes('clamped to the allowed range -30 to 30'));
      await expectOutputs(page, M.calculateScenario({ basketPct: 30 }));
      await setNumber(page, 'delivery-value', 1.3);
      assert.equal(await page.inputValue('#delivery-range'), '1.5');
      assert.ok((await status(page)).includes('rounded to the nearest 0.5 points'));
      await setNumber(page, 'delivery-value', '');
      assert.ok((await status(page)).includes('Enter a number for delivery rate'));
      assert.equal(await page.getAttribute('#delivery-value', 'aria-invalid'), 'true');
      assert.equal(await page.inputValue('#delivery-value'), '1.5', 'the previous value stays in force');
      await page.locator('#ontime-value').fill('-2');
      await page.locator('#ontime-value').press('Enter');
      assert.equal(await page.inputValue('#ontime-range'), '-2');
      assert.ok((await status(page)).includes('on-time delivery −2.0 pts'));
      await expectOutputs(page, M.calculateScenario({ basketPct: 30, deliveryPoints: 1.5, onTimePoints: -2 }));
      assert.equal(await page.getAttribute('#delivery-value', 'aria-invalid'), null, 'a valid change clears the invalid state');
    } finally {
      await close();
    }
  });

  it('applies presets and resets, keeping the pressed state in sync', async () => {
    const { page, close } = await open(LAB);
    try {
      for (const preset of M.PRESETS.filter((p) => p.id !== 'baseline')) {
        await page.locator(`[data-preset="${preset.id}"]`).click();
        await expectOutputs(page, M.calculateScenario(preset.changes));
        assert.equal(await page.locator(`[data-preset="${preset.id}"]`).getAttribute('aria-pressed'), 'true');
        assert.equal(await count(page, '.preset-button[aria-pressed="true"]'), 1);
        assert.ok((await status(page)).includes(`Preset “${preset.name}” applied`));
        for (const [key, id] of Object.entries({ volumePct: 'volume', basketPct: 'basket', deliveryPoints: 'delivery', onTimePoints: 'ontime' })) {
          assert.equal(Number(await page.inputValue(`#${id}-range`)), preset.changes[key], `${preset.id} ${key} slider`);
        }
      }
      await page.locator('#reset-scenario').click();
      await expectOutputs(page, M.BASELINE);
      assert.equal(await page.locator('[data-preset="baseline"]').getAttribute('aria-pressed'), 'true');
      assert.ok((await status(page)).startsWith('Reset. Published baseline'));
      assert.equal(await page.getAttribute('#volume-range', 'aria-valuetext'), 'no change, published baseline');
      assert.ok((await page.locator('#scenario-caption').textContent()).startsWith('No change'));
    } finally {
      await close();
    }
  });

  it('is operable from the keyboard: arrows, Home and End on the sliders', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#volume-range').focus();
      for (let i = 0; i < 3; i += 1) await page.keyboard.press('ArrowRight');
      assert.equal(await page.inputValue('#volume-range'), '3');
      await expectOutputs(page, M.calculateScenario({ volumePct: 3 }));
      assert.ok((await status(page)).includes('order volume +3%'));
      await page.keyboard.press('End');
      assert.equal(await page.inputValue('#volume-range'), '50');
      assert.equal(await stat(page, 'out-revenue'), M.formatMillionsBRL(M.calculateScenario({ volumePct: 50 }).revenueBRL));
      await page.keyboard.press('Home');
      assert.equal(await page.inputValue('#volume-range'), '-50');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'volume-value', 'the typed twin follows the slider in the tab order');
    } finally {
      await close();
    }
  });
});

describe('analytics lab: data-model explorer', () => {
  it('lists the ten documented tables as buttons and opens their details by pointer', async () => {
    const { page, close } = await open(LAB);
    try {
      assert.equal(await count(page, '.table-button'), M.MODEL_TABLES.length);
      assert.deepEqual(await page.$$eval('.table-button', (buttons) => buttons.map((b) => b.dataset.table).sort()), M.MODEL_TABLES.map((t) => t.id).sort());
      assert.ok((await page.locator('#table-detail-body').textContent()).includes('Select a table'));
      await page.locator('[data-table="fact_orders"]').click();
      assert.equal(await page.locator('[data-table="fact_orders"]').getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#table-detail-heading').textContent(), 'Orders · fact table');
      const body = await page.locator('#table-detail-body').textContent();
      assert.ok(body.includes('Total Orders') && body.includes('COUNTROWS(fact_orders)') && body.includes('Six KPI cards') && body.includes('Orders by Status'));
      assert.equal(await count(page, '#table-detail-body .column-chips li'), M.MODEL_TABLES.find((t) => t.id === 'fact_orders').columnsSeen.length);
      assert.ok(body.includes('Dashboard visuals reached through its measures') && body.includes('measure Total Orders'), 'a fact table reaches visuals through the measures that read it');
      await page.locator('[data-table="fact_cohort_retention"]').click();
      assert.ok((await page.locator('#table-detail-body').textContent()).includes('No published measure reads this table, so no visual on the published report page is traced to it.'));
      await page.locator('[data-table="KPI_Measures"]').click();
      assert.equal(await count(page, '.table-button[aria-pressed="true"]'), 1, 'one table is selected at a time');
      const measures = await page.locator('#table-detail-body').textContent();
      assert.ok(measures.includes('Measures visible in the published model view (partial)') && measures.includes('Average Review Score') && measures.includes('Delivered Customers'), 'the model-view measure names are listed as seen');
      assert.ok(measures.includes('Measures named by the README and the report layout') && measures.includes('Delivered Orders (definition not published)'));
      assert.equal(await count(page, '#table-detail-body .column-chips li'), M.MODEL_TABLES.find((t) => t.id === 'KPI_Measures').measuresSeen.length + M.DAX_MEASURES.length);
      await page.locator('[data-table="KPI_Measures"]').click();
      assert.equal(await count(page, '.table-button[aria-pressed="true"]'), 0, 'activating the selected table again clears the selection');
      assert.ok((await page.locator('#table-detail-body').textContent()).includes('Select a table'));
    } finally {
      await close();
    }
  });

  it('moves focus to the detail card when a table is activated from the keyboard', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('[data-table="dim_date"]').focus();
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'table-detail');
      const body = await page.locator('#table-detail-body').textContent();
      assert.ok(body.includes('Year Range') && body.includes('Monthly Revenue Trend') && body.includes('is_complete_analysis_month'));
      assert.ok(body.includes('Columns named by the report layout, not visible in the scrolled panel') && body.includes('year_month'), 'layout-only columns are labelled as such');
      const dimDate = M.MODEL_TABLES.find((t) => t.id === 'dim_date');
      assert.equal(await count(page, '#table-detail-body .column-chips li'), dimDate.columnsSeen.length + dimDate.columnsFromLayout.length);
      assert.ok(body.includes('None of the five published DAX measures reads this table directly.'));
    } finally {
      await close();
    }
  });

  it('draws the documented filter paths on wide screens and hides them on phones', async () => {
    const { page, close } = await open(LAB);
    try {
      assert.equal(await count(page, '#model-lines .model-link.is-filter'), 6, 'one filter path per dimension');
      assert.equal(await count(page, '#model-lines .model-link.is-reads'), 3, 'the measure table reads two fact tables');
      await page.locator('[data-table="dim_product"]').click();
      assert.equal(await count(page, '#model-lines .model-link.is-filter.is-related'), 1);
      assert.ok(await page.locator('#model-lines').evaluate((svg) => svg.classList.contains('has-selection')));
      await page.locator('[data-table="fact_order_items"]').click();
      assert.equal(await count(page, '#model-lines .model-link.is-filter.is-related'), 6, 'a selected fact lights every documented path');
      assert.equal(await count(page, '#model-lines .model-link.is-reads.is-related'), 3);
    } finally {
      await close();
    }
    const phone = await open(LAB, { viewport: VIEWPORTS.mobile });
    try {
      assert.equal(await phone.page.locator('#model-lines').evaluate((svg) => getComputedStyle(svg).display), 'none');
      assert.equal(await count(phone.page, '.table-button'), M.MODEL_TABLES.length);
      await phone.page.locator('[data-table="dim_seller"]').click();
      assert.equal(await phone.page.locator('#table-detail-heading').textContent(), 'Seller · dimension table');
      assert.deepEqual(phone.problems, []);
    } finally {
      await phone.close();
    }
  });
});

describe('analytics lab: themes, motion and navigation', () => {
  it('switches themes, recolours the charts and remembers the choice', async () => {
    const { page, problems, close } = await open(LAB, { colorScheme: 'dark' });
    try {
      const mark = page.locator('#category-chart .bar-pub').first();
      const dark = await mark.evaluate((el) => getComputedStyle(el).fill);
      await page.locator('#theme-toggle').click();
      assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
      assert.notEqual(await mark.evaluate((el) => getComputedStyle(el).fill), dark);
      assert.equal(await page.evaluate(() => localStorage.getItem('af-portfolio-theme')), 'light');
      await page.reload({ waitUntil: 'load' });
      assert.equal(await page.getAttribute('html', 'data-theme'), 'light', 'the preference persists');
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('starts no motion of its own under prefers-reduced-motion and still recalculates on request', async () => {
    const { page, problems, close } = await open(LAB, { reducedMotion: 'reduce' });
    try {
      await expectOutputs(page, M.BASELINE);
      assert.equal(await page.$$eval('*', (els) => els.filter((el) => { const s = getComputedStyle(el); return s.animationName !== 'none' && s.animationDuration !== '0.01ms' && s.animationDuration !== '0s'; }).length), 0, 'no running animations');
      await page.locator('[data-preset="logistics"]').click();
      await expectOutputs(page, M.calculateScenario(M.PRESETS.find((p) => p.id === 'logistics').changes));
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('opens and closes the mobile menu with focus management, and keeps the skip link first', async () => {
    const { page, close } = await open(LAB, { viewport: VIEWPORTS.mobile, hasTouch: true });
    try {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
      await page.locator('#menu-toggle').click();
      assert.equal(await page.evaluate(() => document.activeElement.closest('#mobile-nav') !== null), true);
      assert.equal(await count(page, '#mobile-nav a'), 6);
      await page.keyboard.press('Escape');
      assert.ok(await page.locator('#mobile-nav').isHidden());
      assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-toggle');
      const small = await page.$$eval('.preset-button, .panel-actions button, .table-button, .table-view summary', (els) => els.filter((el) => el.getClientRects().length > 0 && el.getBoundingClientRect().height < 24).length);
      assert.equal(small, 0, 'controls keep a usable height on a phone');
      const tall = await page.$$eval('.preset-button, .panel-actions button, .table-button', (els) => els.filter((el) => el.getBoundingClientRect().height < 40).length);
      assert.equal(tall, 0, 'primary controls are at least 40px tall');
      await page.locator('[data-preset="peak"]').scrollIntoViewIfNeeded();
      const box = await page.locator('[data-preset="peak"]').boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await page.locator('[data-preset="peak"]').getAttribute('aria-pressed'), 'true', 'a tap applies a preset');
    } finally {
      await close();
    }
  });

  it('is reachable from the homepage: plate 02, the section cut and the footer link to it, and the Interactive filter shows three projects', async () => {
    const { page, problems, close } = await open('/');
    try {
      const plateLink = page.locator('.project-commerce .project-links a[href="/lab/ecommerce/"]');
      assert.equal(await plateLink.count(), 1);
      assert.match((await plateLink.textContent()).replace(/\s+/g, ' ').trim(), /^Open the interactive analytics lab/);
      assert.equal(await count(page, '#cut-commerce a[href="/lab/ecommerce/"]'), 1);
      assert.equal(await count(page, '.site-footer a[href="/lab/ecommerce/"]'), 1);
      assert.equal(await page.locator('.ledger .stat-number').nth(1).textContent(), '03');
      await page.locator('[data-filter="interactive"]').click();
      assert.equal(await count(page, '.project:not([hidden])'), 3);
      assert.ok(await page.locator('.project-commerce').isVisible());
      await page.locator('[data-filter="analytics"]').click();
      assert.equal(await count(page, '.project:not([hidden])'), 1);
      await page.locator('[data-filter="all"]').click();
      await plateLink.click();
      await page.waitForURL(`**${LAB}`);
      assert.ok((await page.locator('h1').textContent()).includes('E-Commerce Executive'));
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });
});
