import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { startServer } from './helpers/server.js';

const { chromium } = createRequire(import.meta.url)('playwright');

test('the rental case study is discoverable and its controls work on desktop and mobile', async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    for (const width of [320, 1440]) {
      const touch = width < 500;
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce', hasTouch: touch, isMobile: touch });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      try {
        await page.goto(server.baseUrl + '/#plate-rentals');
        await page.locator('#plate-rentals .project-entry-link').click();
        await page.waitForURL('**/lab/nyc-rentals/');
        assert.match(await page.locator('#market-kpis').innerText(), /\$4,050/);
        const chart = page.locator('#trend-chart');
        await chart.scrollIntoViewIfNeeded();
        const plot = await chart.evaluate((node) => {
          const grid = node.querySelector('.rental-chart-grid');
          const matrix = node.getScreenCTM();
          const y = Number(grid.getAttribute('y1')) - 50;
          const start = new DOMPoint(Number(grid.getAttribute('x1')), y).matrixTransform(matrix);
          const end = new DOMPoint(Number(grid.getAttribute('x2')), y).matrixTransform(matrix);
          return { start: start.x, end: end.x, y: start.y };
        });
        const chartX = (index) => plot.start + (plot.end - plot.start) * index / 15;
        const month = page.getByLabel('Snapshot month');
        if (touch) {
          await page.touchscreen.tap(chartX(5), plot.y);
        } else {
          await page.mouse.click(chartX(5), plot.y);
        }
        assert.equal(await month.inputValue(), '2025-07');
        assert.match(await page.locator('#market-kpis').innerText(), /\$3,995/);
        assert.match(await page.locator('#comparison-context').innerText(), /Jul 2025/);

        if (touch) {
          const session = await page.context().newCDPSession(page);
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: chartX(5), y: plot.y }] });
          await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: chartX(10), y: plot.y }] });
          assert.equal(await month.inputValue(), '2025-12');
          await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await session.detach();
        } else {
          await page.mouse.move(chartX(5), plot.y);
          await page.mouse.down();
          await page.mouse.move(chartX(10), plot.y, { steps: 5 });
          assert.equal(await month.inputValue(), '2025-12');
          await page.mouse.move(plot.start - 35, plot.y);
          assert.equal(await month.inputValue(), '2025-02');
          await page.mouse.up();
        }
        assert.equal(await chart.evaluate(node => node.classList.contains('is-scrubbing')), false);
        const slider = page.getByRole('slider', { name: 'Explore month' });
        await slider.press('End');
        assert.equal(await month.inputValue(), '2026-05');
        assert.equal(await slider.getAttribute('aria-valuetext'), 'May 2026');
        assert.equal(await page.getByRole('button', { name: 'Next month', exact: true }).isDisabled(), true);
        await page.getByRole('button', { name: 'Previous month', exact: true }).click();
        assert.equal(await month.inputValue(), '2026-04');
        await page.getByRole('button', { name: 'Next month', exact: true }).click();
        assert.equal(await month.inputValue(), '2026-05');
        const island = page.getByRole('button', { name: /^Staten Island/ });
        await island.click();
        assert.equal(await island.getAttribute('aria-pressed'), 'true');
        assert.equal(await page.getByLabel('Trend geography').inputValue(), 'Staten Island');
        assert.equal(await page.locator('#trend-title').innerText(), 'Staten Island trend');
        await page.getByRole('combobox', { name: /^Measure/ }).selectOption('listings');
        assert.match(await page.locator('#trend-readout').innerText(), /Listings 20/);
        assert.equal(await page.locator('#borough-bars li').count(), 5);
        await page.getByLabel('Snapshot month').selectOption('2025-02');
        assert.match(await page.locator('#trend-readout').innerText(), /Feb 2025/);
        await page.getByRole('button', { name: 'Next →' }).click();
        assert.match(await page.locator('#rank-page').innerText(), /Page 2/);
        await page.getByLabel('Neighborhood', { exact: true }).fill('no such neighborhood');
        assert.match(await page.locator('#rank-profile').innerText(), /No matching neighborhoods/);
        await page.getByLabel('Neighborhood', { exact: true }).fill('');
        await page.getByLabel('Score tier').selectOption('Strong');
        assert.match(await page.locator('#rank-status').innerText(), /6 of 94/);
        const button = page.locator('#rank-rows button').last();
        const name = await button.innerText();
        await button.focus();
        await button.press('Enter');
        assert.equal(await page.locator('#rank-profile h3').innerText(), name);
        assert.equal(await page.locator('#rank-profile li').count(), 4);
        const theme = await page.locator('html').getAttribute('data-theme');
        await page.locator('#theme-toggle').click();
        assert.notEqual(await page.locator('html').getAttribute('data-theme'), theme);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.deepEqual(errors, []);
      } finally { await page.close(); }
    }
  } finally {
    await browser.close();
    await server.close();
  }
});
