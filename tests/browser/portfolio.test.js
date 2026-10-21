/**
 * Browser tests for the redesigned portfolio homepage (The Architect Lab):
 * the section-cut interaction (tabs, keyboard, deep links, no-JS fallback),
 * reveals and reduced motion, the hero drawing, navigation state, themes,
 * metadata and layout integrity at additional viewports.
 *
 *   NODE_PATH=/path/to/node_modules node --test tests/browser/*.test.js
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startServer } from './helpers/server.js';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  throw new Error(`Playwright is not resolvable (${error.message}). Install it outside the repository and set NODE_PATH; see lab/pathfinding/README.md → "Reproducing the tests".`);
}

const VIEWPORTS = {
  narrow: { width: 320, height: 568 },
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  wide: { width: 1920, height: 1080 },
};
const PROJECTS = ['atlas', 'commerce', 'pathfinding', 'security'];

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

async function open(url, { viewport = VIEWPORTS.desktop, colorScheme = 'dark', reducedMotion = 'no-preference', javaScriptEnabled = true } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion, javaScriptEnabled });
  if (javaScriptEnabled) {
    await context.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.scrollBehavior = 'auto'; });
    });
  }
  const page = await context.newPage();
  const problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') problems.push(`[console.${message.type()}] ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));
  page.on('requestfailed', (request) => problems.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText}`));
  const response = await page.goto(server.baseUrl + url, { waitUntil: 'load' });
  return { page, context, response, problems, close: () => context.close() };
}

const selected = (page) => page.locator('#section-cut').getAttribute('data-selected');
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
/**
 * Elements whose right edge passes the viewport. The page shell clips overflow, so the
 * scrollWidth check alone cannot see content cut off at the edge; this walk can.
 * Descendants of horizontal scroll containers (the lab timeline, tables, the tab strip) are expected to extend.
 */
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
    if (rect.right > width + 0.5 && !inScroller(el)) found.push(`${el.tagName.toLowerCase()}#${el.id || ''} right=${rect.right.toFixed(1)}`);
  }
  return found.slice(0, 8);
});

describe('portfolio: layout integrity at every viewport and in both themes', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    for (const colorScheme of ['dark', 'light']) {
      it(`renders at ${name} (${viewport.width}px, ${colorScheme}) without errors, overflow or clipped headings`, async () => {
        const { page, response, problems, close } = await open('/', { viewport, colorScheme });
        try {
          assert.equal(response.status(), 200);
          assert.equal(await page.getAttribute('html', 'data-theme'), colorScheme, 'the system colour scheme is respected');
          assert.equal(await page.locator('h1').count(), 1);
          assert.equal(await overflow(page), 0, 'no horizontal overflow');
          assert.deepEqual(await clipped(page), [], 'nothing is cut off at the viewport edge');
          // Every heading fits inside the viewport width (no clipped display type).
          const clippedHeadings = await page.$$eval('h1, h2, h3', (nodes) => nodes.filter((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && (r.left < 0 || r.right > window.innerWidth + 0.5); }).map((n) => n.textContent.trim().slice(0, 40)));
          assert.deepEqual(clippedHeadings, []);
          assert.deepEqual(problems, []);
        } finally {
          await close();
        }
      });
    }
  }

  for (const url of ['/lab/pathfinding/', '/lab/security-events/', '/does-not-exist']) {
    for (const [name, viewport] of [['narrow', VIEWPORTS.narrow], ['mobile', VIEWPORTS.mobile]]) {
      it(`${url} at ${name} keeps every control inside the viewport with the shared stylesheet`, async () => {
        const { page, close } = await open(url, { viewport });
        try {
          assert.equal(await overflow(page), 0);
          assert.deepEqual(await clipped(page), []);
        } finally {
          await close();
        }
      });
    }
  }

  it('keeps the section-cut tabs scrollable on a phone without widening the page', async () => {
    const { page, close } = await open('/', { viewport: VIEWPORTS.mobile });
    try {
      const tabs = page.locator('.cut-tabs');
      await tabs.scrollIntoViewIfNeeded();
      const metrics = await tabs.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, overflowX: getComputedStyle(el).overflowX }));
      assert.ok(metrics.scrollWidth > metrics.clientWidth, 'the tab strip scrolls horizontally');
      assert.equal(metrics.overflowX, 'auto');
      assert.equal(await overflow(page), 0);
    } finally {
      await close();
    }
  });
});

describe('portfolio: the section cut', () => {
  it('wires four tabs to four panels, each describing six layers with technologies and links', async () => {
    const { page, problems, close } = await open('/');
    try {
      assert.equal(await page.locator('[role="tablist"] [role="tab"]').count(), 4);
      for (const key of PROJECTS) {
        const tab = page.locator(`#tab-${key}`);
        assert.equal(await tab.getAttribute('aria-controls'), `cut-${key}`);
        const panel = page.locator(`#cut-${key}`);
        assert.equal(await panel.getAttribute('aria-labelledby'), `tab-${key}`);
        assert.equal(await panel.locator('.stratum').count(), 6, `${key} has six layers`);
        assert.equal(await panel.locator('.stratum h4').count(), 6);
        assert.ok((await panel.locator('.stratum-tech li').count()) >= 6, `${key} names its technologies`);
        assert.ok((await panel.locator('.cut-foot a').count()) >= 2, `${key} links onward`);
      }
      assert.equal(await selected(page), 'atlas');
      assert.equal(await page.locator('.cut-panel:visible').count(), 1, 'only the selected panel is shown');
      assert.ok(await page.locator('#cut-atlas').isVisible());
      const atlas = (await page.locator('#cut-atlas').textContent()).toLowerCase();
      assert.ok(atlas.includes('failed calibration') && atlas.includes('not established'), 'the ATLAS cut keeps the research boundaries');
      const security = (await page.locator('#cut-security').textContent()).toLowerCase();
      assert.ok(security.includes('not a production siem'));
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('selects by click, arrows, Home and End with a roving tab stop, and follows deep links', async () => {
    const { page, close } = await open('/');
    try {
      assert.equal(await page.locator('[role="tablist"]').getAttribute('aria-orientation'), 'vertical', 'the rail is vertical beside the stage on desktop');
      await page.locator('#tab-security').click();
      assert.equal(await selected(page), 'security');
      assert.ok(await page.locator('#cut-security').isVisible());
      assert.ok(await page.locator('#cut-atlas').isHidden());
      assert.equal(await page.locator('#tab-security').getAttribute('aria-selected'), 'true');
      assert.equal(await page.locator('#tab-atlas').getAttribute('aria-selected'), 'false');
      await page.locator('#tab-security').focus();
      await page.keyboard.press('ArrowUp');
      assert.equal(await selected(page), 'pathfinding');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-pathfinding', 'focus follows the selection');
      await page.keyboard.press('ArrowRight');
      assert.equal(await selected(page), 'security');
      await page.keyboard.press('ArrowDown');
      assert.equal(await selected(page), 'atlas', 'arrows wrap around');
      await page.keyboard.press('End');
      assert.equal(await selected(page), 'security');
      await page.keyboard.press('Home');
      assert.equal(await selected(page), 'atlas');
      const stops = await page.$$eval('[role="tab"]', (tabs) => tabs.map((t) => t.getAttribute('tabindex')));
      assert.deepEqual(stops, ['0', '-1', '-1', '-1'], 'exactly one tab is in the tab order');
      await page.goto(`${server.baseUrl}/#cut-commerce`, { waitUntil: 'load' });
      assert.equal(await selected(page), 'commerce', 'a panel id in the hash selects that project');
      assert.ok(await page.locator('#cut-commerce').isVisible());
      await page.locator('#cut-commerce a[href="#plate-commerce"]').click();
      await page.waitForFunction(() => window.location.hash === '#plate-commerce');
      assert.ok(await page.locator('#plate-commerce').isVisible());
    } finally {
      await close();
    }
  });

  it('degrades without JavaScript: every panel is readable in order and nothing stays hidden', async () => {
    const { page, close } = await open('/', { javaScriptEnabled: false });
    try {
      assert.ok(await page.locator('.cut-tabs').isHidden(), 'inert tab buttons are not shown');
      assert.equal(await page.locator('.cut-panel:visible').count(), 4);
      assert.deepEqual(await page.$$eval('.cut-panel h3', (hs) => hs.map((h) => h.firstChild.textContent.trim())), ['ATLAS', 'E-Commerce Analytics', 'Pathfinding Lab', 'Security Lab']);
      const hidden = await page.$$eval('[data-reveal]', (els) => els.filter((el) => getComputedStyle(el).opacity !== '1' || getComputedStyle(el).visibility === 'hidden').length);
      assert.equal(hidden, 0, 'reveal styling never hides content without JS');
      assert.equal(await page.locator('.project').count(), 4);
      assert.equal(await overflow(page), 0);
    } finally {
      await close();
    }
  });
});

describe('portfolio: motion, hero drawing and reveals', () => {
  it('shows everything immediately under prefers-reduced-motion, with the drawing fully drawn', async () => {
    const { page, problems, close } = await open('/', { reducedMotion: 'reduce' });
    try {
      const hidden = await page.$$eval('[data-reveal]', (els) => els.filter((el) => getComputedStyle(el).opacity !== '1').length);
      assert.equal(hidden, 0);
      assert.equal(await page.$eval('.iso .iso-draw', (p) => getComputedStyle(p).strokeDashoffset), '0px');
      assert.equal(await page.$eval('.iso .iso-fade', (p) => getComputedStyle(p).opacity), '1');
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('reveals sections as they scroll into view and draws the hero figure with an accessible description', async () => {
    const { page, close } = await open('/');
    try {
      const iso = page.locator('.hero .iso');
      assert.equal(await iso.getAttribute('role'), 'img');
      assert.ok((await page.locator('#iso-title').textContent()).length > 10);
      assert.equal(await page.locator('.iso-legend li').count(), 5, 'the legend lists the five layers');
      const caption = (await page.locator('.hero-figcaption').textContent()).toLowerCase();
      assert.ok(caption.includes('not a live dashboard'), 'the drawing is labelled as conceptual');
      await page.locator('#contact').evaluate((n) => n.scrollIntoView({ block: 'center' }));
      await page.waitForFunction(() => document.querySelector('.contact-card').classList.contains('is-visible'));
      // The reveal is a 0.7s opacity transition; wait for it to settle rather than sampling mid-fade.
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.contact-card')).opacity === '1', null, { timeout: 5000 });
      assert.equal(await page.$eval('.contact-card', (el) => getComputedStyle(el).opacity), '1');
      await page.waitForFunction(() => [...document.querySelectorAll('.iso .iso-draw')].every((p) => getComputedStyle(p).strokeDashoffset === '0px'), null, { timeout: 5000 });
    } finally {
      await close();
    }
  });
});

describe('portfolio: navigation, theme and metadata', () => {
  it('marks the section in view in the primary navigation and keeps the header stuck while scrolling', async () => {
    const { page, close } = await open('/');
    try {
      await page.evaluate(() => window.scrollTo(0, 1500));
      assert.equal(await page.$eval('.site-header', (el) => el.getBoundingClientRect().top), 0, 'the sticky header stays at the top');
      await page.locator('#about').evaluate((n) => n.scrollIntoView({ block: 'center' }));
      await page.waitForFunction(() => document.querySelector('.desktop-nav a[href="#about"]').getAttribute('aria-current') === 'true');
      assert.equal(await page.locator('.desktop-nav a[aria-current="true"]').count(), 1);
    } finally {
      await close();
    }
  });

  it('moves focus into the mobile menu, closes on Escape and returns focus to the toggle', async () => {
    const { page, close } = await open('/', { viewport: VIEWPORTS.mobile });
    try {
      await page.locator('#menu-toggle').click();
      assert.equal(await page.evaluate(() => document.activeElement.closest('#mobile-nav') !== null), true);
      assert.equal(await page.locator('#mobile-nav a').count(), 6);
      await page.keyboard.press('Escape');
      assert.ok(await page.locator('#mobile-nav').isHidden());
      assert.equal(await page.evaluate(() => document.activeElement.id), 'menu-toggle');
      await page.locator('#menu-toggle').click();
      await page.locator('#mobile-nav a[href="#work"]').click();
      assert.ok(await page.locator('#mobile-nav').isHidden(), 'choosing a destination closes the menu');
    } finally {
      await close();
    }
  });

  it('switches themes, updates the browser chrome colour and remembers the choice', async () => {
    const { page, close } = await open('/', { colorScheme: 'dark' });
    try {
      assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#0b0e13');
      await page.locator('#theme-toggle').click();
      assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
      assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#f4f2ec');
      assert.equal(await page.locator('#theme-toggle').getAttribute('aria-label'), 'Switch to dark theme');
      await page.reload({ waitUntil: 'load' });
      assert.equal(await page.getAttribute('html', 'data-theme'), 'light', 'the preference persists');
    } finally {
      await close();
    }
  });

  it('publishes a self-hosted social card that matches the metadata', async () => {
    const { page, close } = await open('/');
    try {
      const image = await page.locator('meta[property="og:image"]').getAttribute('content');
      assert.equal(image, 'https://arthur-fay.github.io/social-card.png');
      assert.equal(await page.locator('meta[name="twitter:image"]').getAttribute('content'), image);
      const response = await page.request.get(`${server.baseUrl}/social-card.png`);
      assert.equal(response.status(), 200);
      const body = await response.body();
      assert.equal(body.subarray(1, 4).toString(), 'PNG');
      assert.equal(body.readUInt32BE(16), 1200);
      assert.equal(body.readUInt32BE(20), 630);
      assert.ok(body.length < 400 * 1024, 'the card stays small');
    } finally {
      await close();
    }
  });

  it('keeps the skip link as the first tab stop and every control named', async () => {
    const { page, close } = await open('/');
    try {
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#main');
      const unnamed = await page.$$eval('button, a[href]', (els) => els.filter((el) => !(el.getAttribute('aria-label') || el.textContent.replace(/\s+/g, ' ').trim())).length);
      assert.equal(unnamed, 0);
    } finally {
      await close();
    }
  });
});
