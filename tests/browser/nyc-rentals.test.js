import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { startServer } from './helpers/server.js';

const { chromium } = createRequire(import.meta.url)('playwright');

test('the rental case study is discoverable and its controls work on desktop and mobile', async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      try {
        await page.goto(server.baseUrl + '/#plate-rentals');
        await page.locator('#plate-rentals .project-entry-link').click();
        await page.waitForURL('**/lab/nyc-rentals/');
        assert.match(await page.locator('#market-kpis').innerText(), /\$4,050/);
        await page.getByLabel('Trend geography').selectOption('Staten Island');
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
