/**
 * Reproducible visual QA captures for The Architect Lab.
 * Runs only in GitHub Actions / local development; never shipped as a site asset.
 * Screenshots are CI artifacts rather than committed binary files.
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { startServer } from '../tests/browser/helpers/server.js';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const output = process.env.VISUAL_REVIEW_DIR || join(tmpdir(), 'architect-lab-visual-review');
const shots = [
  { width: 1280, height: 900, theme: 'dark', areas: ['hero', 'experience'] },
  { width: 1440, height: 900, theme: 'dark', areas: ['hero', 'experience'] },
  { width: 1440, height: 900, theme: 'light', areas: ['hero', 'experience'] },
  { width: 1920, height: 1080, theme: 'dark', areas: ['hero', 'experience'] },
  { width: 1920, height: 1080, theme: 'light', areas: ['hero', 'experience'] },
  { width: 375, height: 812, theme: 'dark', areas: ['hero', 'experience'] },
];
await mkdir(output, { recursive: true });
const server = await startServer();
const browser = await chromium.launch({ headless: true });
const report = { version: 1, generatedAt: new Date().toISOString(), sha: process.env.GITHUB_SHA || null, captures: [] };
let failures = [];
try {
  for (const spec of shots) {
    const context = await browser.newContext({
      viewport: { width: spec.width, height: spec.height },
      deviceScaleFactor: 1,
      colorScheme: spec.theme,
      reducedMotion: 'reduce',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('requestfailed', request => errors.push(request.url() + ': ' + request.failure()?.errorText));
    try {
      const response = await page.goto(server.baseUrl + '/', { waitUntil: 'load' });
      if (response.status() !== 200) throw new Error('HTTP ' + response.status());
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (const node of document.querySelectorAll('[data-reveal]')) node.classList.add('is-visible');
      });
      const metrics = await page.evaluate(() => {
        const box = selector => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width),
            height: Math.round(rect.height), right: Math.round(rect.right) };
        };
        const skills = [...document.querySelectorAll('.stack-group')].map(group => ({
          label: group.querySelector('dt')?.textContent?.trim(),
          count: group.querySelectorAll('dd span').length,
        }));
        return { viewport: innerWidth, docWidth: document.documentElement.scrollWidth,
          hero: box('.hero'), heroCopy: box('.hero-copy'), heroArt: box('.hero-figure'),
          firstCTA: box('.hero-buttons .button-primary'),
          experience: box('#experience'), employment: box('.record-main'), sidebar: box('.record-aside'),
          firstJob: box('.record-body'), education: box('#education'), skills: box('.stack-groups'),
          skillsGroups: skills };
      });
      const captured = [];
      for (const area of spec.areas) {
        const selector = area === 'hero' ? '.hero' : '#experience';
        const filename = area + '-' + spec.width + '-' + spec.theme + '.png';
        await page.locator(selector).screenshot({
          path: join(output, filename), animations: 'disabled', caret: 'hide',
          timeout: 30000,
        });
        captured.push(filename);
      }
      report.captures.push({ ...spec, metrics, errors, files: captured });
      if (metrics.docWidth > spec.width + 1) failures.push(spec.width + '/' + spec.theme + ' horizontal overflow');
      if (errors.length) failures.push(spec.width + '/' + spec.theme + ': ' + errors.join(', '));
      console.log(JSON.stringify({ viewport: spec.width, theme: spec.theme, docWidth: metrics.docWidth,
        jobWidth: metrics.employment?.width, skillsWidth: metrics.sidebar?.width, screenshots: captured }));
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
  await writeFile(join(output, 'layout-report.json'), JSON.stringify(report, null, 2) + '\n');
}
if (failures.length) {
  for (const item of failures) console.error('Visual QA failure: ' + item);
  process.exitCode = 1;
}
