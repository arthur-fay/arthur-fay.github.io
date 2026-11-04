import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { startServer } from './helpers/server.js';
import { city } from '../../lab/nyc-rentals/data.js';

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
        const points = await chart.evaluate((node) => {
          const matrix = node.getScreenCTM();
          return Array.from(node.querySelector('.rental-series').points, (point) => {
            const { x, y } = point.matrixTransform(matrix);
            return { x, y };
          });
        });
        const month = page.getByLabel('Snapshot month');
        if (touch) {
          await page.touchscreen.tap(points[5].x, points[5].y);
        } else {
          await page.mouse.click(points[5].x, points[5].y);
        }
        assert.equal(await month.inputValue(), '2025-07');
        assert.match(await page.locator('#market-kpis').innerText(), /\$3,995/);
        assert.match(await page.locator('#comparison-context').innerText(), /Jul 2025/);

        const touchSession = touch ? await page.context().newCDPSession(page) : null;
        if (touchSession) {
          await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] });
        } else {
          await page.mouse.move(points[0].x, points[0].y);
          await page.mouse.down();
        }
        const dates = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
        const rent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });
        for (const [i, point] of points.entries()) {
          if (i && touchSession) {
            await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
            // Touch moves can be delivered to the page on the next animation frame.
            await page.waitForFunction(value => document.querySelector('#market-month').value === value, city[i].month, { timeout: 2000 })
              .catch(async (error) => {
                const dragging = await chart.evaluate(node => node.classList.contains('is-scrubbing'));
                throw new Error(`Touch did not reach ${city[i].month}; selected ${await month.inputValue()}; drag active ${dragging}`, { cause: error });
              });
          } else if (i) {
            await page.mouse.move(point.x, point.y);
          }
          assert.equal(await month.inputValue(), city[i].month, `month ${i + 1} while dragging along the line`);
          assert.equal(await chart.locator('.rental-tooltip-month').textContent(), dates.format(new Date(city[i].month + '-01T00:00:00Z')));
          assert.deepEqual(await chart.locator('.rental-tooltip-value').allTextContents(), [rent.format(city[i].asking), rent.format(city[i].effective)]);
        }
        assert.equal(points.length, 16);
        if (touchSession) {
          await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
          await touchSession.detach();
        } else {
          await page.mouse.move(points[0].x - 80, points[0].y);
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
