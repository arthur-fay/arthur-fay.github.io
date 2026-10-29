/**
 * Phase 5: visual usability regression for the three existing engineering labs.
 * Tests CSS/readability/real DOM and does not modify simulation data or rules.
 */
import { before, after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startServer } from './helpers/server.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
let browser, server;
before(async () => {
  server = await startServer();
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});
const labs = [
  { name: 'E-Commerce Analytics', route: '/lab/ecommerce/', control: '.panel-actions .button-small',
    label: '.field>label', supporting: '.chart-caption', minSupport: 13, workspace: '#dashboard' },
  { name: 'Pathfinding', route: '/lab/pathfinding/', control: '.lab-actions .button-small',
    label: '.field>label', supporting: '.lab-panel-note', minSupport: 12.5, workspace: '#lab' },
  { name: 'Security Events', route: '/lab/security-events/', control: '.lab-actions .button-small',
    label: '.field>label', supporting: '.timeline-summary', minSupport: 12.5, workspace: '#lab' },
];
for (const lab of labs) {
  describe('desktop and mobile readability — ' + lab.name, () => {
    for (const theme of ['dark', 'light']) {
      it('at 1440px in ' + theme + ' has legible controls and faithful lab output', async () => {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 },
          colorScheme: theme, reducedMotion: 'reduce' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
          const response = await page.goto(server.baseUrl + lab.route, { waitUntil: 'load' });
          assert.equal(response.status(), 200);
          await page.waitForSelector(lab.workspace);
          assert.equal(await page.locator('h1').count(), 1);
          const data = await page.evaluate(({ label, control, supporting }) => {
            const px = sel => {
              const element = document.querySelector(sel);
              if (!element) return null;
              return Number.parseFloat(getComputedStyle(element).fontSize);
            };
            const height = sel => {
              const el = document.querySelector(sel);
              return el ? el.getBoundingClientRect().height : null;
            };
            return { label: px(label), caption: px(supporting), actionHeight: height(control),
              docWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
              heading: document.querySelector('#lab-title')?.textContent?.trim(),
              hiddenContent: document.querySelectorAll('script[src^="https://"]').length };
          }, lab);
          assert.ok(data.label >= 13, 'controls should have readable labels: ' + JSON.stringify(data));
          assert.ok(data.caption >= 15, 'annotations deserve legible reading text: ' + JSON.stringify(data));
          assert.ok(data.actionHeight >= 44, 'primary action touch/keyboard target should be at least 44px high');
          assert.ok(data.docWidth <= data.viewportWidth + 1, 'no desktop horizontal overflow');
          assert.ok(data.heading.includes('Lab'), 'preserve the project title');
          assert.equal(data.hiddenContent, 0, 'no third-party runtime scripts');
          assert.deepEqual(errors, []);
        } finally {
          await context.close();
        }
      });
    }
    for (const width of [320, 375]) for (const colorScheme of ['dark', 'light']) {
    it(`at ${width}px in ${colorScheme} keeps typed text and controls legible`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 812 },
        colorScheme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      try {
        const response = await page.goto(server.baseUrl + lab.route, { waitUntil: 'load' });
        assert.equal(response.status(), 200);
        assert.equal(await page.locator(lab.workspace).count(), 1);
        assert.equal(await page.locator('.hero-buttons .button-primary').count(), 1);
        const width = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(width <= 1, 'phone viewport has no horizontal overflow');
        const fields = page.locator('.field input[type="number"],.field input[type="text"],.field textarea,.field select');
        const metrics = await fields.evaluateAll(els => els.filter(el => el.getClientRects().length).map(el => ({
          size: parseFloat(getComputedStyle(el).fontSize), height: el.getBoundingClientRect().height,
          clipped: el.getBoundingClientRect().right > innerWidth + 1,
        })));
        assert.ok(metrics.length > 0);
        assert.ok(metrics.every(item => item.size >= 16 && item.height >= 44 && !item.clipped), JSON.stringify(metrics));
        const number = page.locator('.field input[type="number"]').first();
        await number.fill('7');
        assert.equal(await number.inputValue(), '7', 'typed input stays usable after the visual update');
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
    }
  });
}
