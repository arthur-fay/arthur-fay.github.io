/**
 * Browser tests for the redesigned portfolio homepage (The Architect Lab):
 * the section-cut interaction (tabs, keyboard, deep links, no-JS fallback),
 * reveals and reduced motion, the hero drawing, navigation state, themes,
 * metadata, layout integrity at additional viewports, the professional record
 * (experience, education, contact), the privacy guard on contact details and
 * the qualifications that accompany every ATLAS figure.
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
  laptop: { width: 1100, height: 800 },
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

  for (const url of ['/lab/ecommerce/', '/lab/pathfinding/', '/lab/security-events/', '/does-not-exist']) {
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
      assert.ok(atlas.includes('failed calibration') && /not (statistically )?established/.test(atlas), 'the ATLAS cut keeps the research boundaries');
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
  for (const colorScheme of ['dark', 'light']) {
    it(`draws the system section (${colorScheme}) as five shaded plates with hatched cut faces, solid blocks and a spine`, async () => {
      const { page, close } = await open('/', { colorScheme, reducedMotion: 'reduce' });
      try {
        const stats = await page.evaluate(() => {
          const q = (selector) => document.querySelectorAll(`.iso ${selector}`);
          const luminance = (paint) => {
            const parts = paint.match(/[\d.]+/g).map(Number);
            const [r, g, b] = paint.startsWith('color(srgb') ? parts.map((v) => v * 255) : parts;
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          };
          const svg = document.querySelector('.iso').getBoundingClientRect();
          const sheet = document.querySelector('.hero-figure').getBoundingClientRect();
          // The spine must stay visible where it crosses the opaque plates: hit-test the midpoint of each segment.
          const matrix = document.querySelector('.iso').getScreenCTM();
          const spineHits = [...document.querySelectorAll('.iso .iso-flow')].map((segment) => {
            const [, x, y1, y2] = segment.getAttribute('d').match(/^M([\d.]+) ([\d.]+)V([\d.]+)$/).map(Number);
            const point = new DOMPoint(x, (y1 + y2) / 2).matrixTransform(matrix);
            const hit = document.elementFromPoint(point.x, point.y);
            return hit ? hit.getAttribute('class') : 'none';
          });
          return {
            spineHits,
            plates: q('[data-depth]').length, tops: q('.iso-top').length, sides: q('.iso-side').length, patterns: q('pattern').length,
            blocks: q('.iso-node').length, faces: q('.iso-node path').length, spine: q('.iso-flow').length, posts: q('.iso-post').length, shadow: q('.iso-shade').length,
            topPlate: luminance(getComputedStyle(q('.depth-5 .iso-top')[0]).fill),
            bottomPlate: luminance(getComputedStyle(q('.depth-1 .iso-top')[0]).fill),
            sideFill: getComputedStyle(q('.iso-side')[0]).fill,
            edgeStroke: getComputedStyle(q('.iso-slab')[0]).stroke,
            fits: svg.left >= sheet.left && svg.right <= sheet.right && svg.top >= sheet.top && svg.bottom <= sheet.bottom,
          };
        });
        assert.equal(stats.plates, 5);
        assert.equal(stats.tops, 5);
        assert.equal(stats.sides, 10, 'two cut faces per plate');
        assert.equal(stats.patterns, 2, 'hatch patterns for the cut faces');
        assert.equal(stats.blocks, 17);
        assert.equal(stats.faces, 51, 'every block has three faces');
        assert.equal(stats.spine, 4);
        assert.deepEqual(stats.spineHits.map((hit) => /iso-flow/.test(hit)), [true, true, true, true], `the spine is visible where it crosses each plate (${stats.spineHits.join(' | ')})`);
        assert.equal(stats.posts, 1);
        assert.equal(stats.shadow, 1);
        assert.ok(stats.topPlate > stats.bottomPlate, `the stack is lit from the top (${stats.topPlate.toFixed(1)} > ${stats.bottomPlate.toFixed(1)})`);
        assert.match(stats.sideFill, /iso-hatch/, 'cut faces are hatched');
        assert.match(stats.edgeStroke, /^rgb/, 'plate outlines resolve to a real colour');
        assert.ok(stats.fits, 'the drawing stays inside its sheet');
      } finally {
        await close();
      }
    });
  }
});

describe('portfolio: project scanning and evidence-first actions', () => {
  const targets = {
    atlas: 'https://github.com/arthur-fay/demand-forecasting-model/blob/main/docs/API.md',
    commerce: '/lab/ecommerce/',
    pathfinding: '/lab/pathfinding/',
    security: '/lab/security-events/',
  };

  for (const width of [1280, 1440, 1920]) {
    it(`at ${width}px, every plate has an early verified action and readable specification rows`, async () => {
      const { page, problems, close } = await open('/', { viewport: { width, height: 900 } });
      try {
        for (const [id, href] of Object.entries(targets)) {
          const plate = page.locator(`#plate-${id}`);
          assert.equal(await plate.locator('.project-entry-link').getAttribute('href'), href);
          assert.equal(await plate.locator('.project-entry').count(), 1);
          const geometry = await plate.evaluate((root) => {
            const rect = (selector) => root.querySelector(selector).getBoundingClientRect();
            const disclosure = rect('.project-disclosure');
            const action = rect('.project-entry');
            const facts = rect('.plate-facts');
            const body = rect('.project-body');
            const rows = [...root.querySelectorAll('.plate-facts > div')].map((element) => {
              const box = element.getBoundingClientRect();
              const label = element.querySelector('dt').getBoundingClientRect();
              const detail = element.querySelector('dd').getBoundingClientRect();
              return { top: box.top, labelRight: label.right, detailLeft: detail.left, detailRight: detail.right };
            });
            return { disclosureBottom: disclosure.bottom, actionTop: action.top, actionBottom: action.bottom, factsTop: facts.top,
              actionLeft: action.left, actionRight: action.right, bodyLeft: body.left, bodyRight: body.right,
              columnCount: getComputedStyle(root.querySelector('.plate-facts')).gridTemplateColumns.trim().split(/\s+/).length,
              rows };
          });
          assert.ok(geometry.disclosureBottom <= geometry.actionTop + 1, `${id}: evidence action comes after the disclosure`);
          assert.ok(geometry.actionBottom <= geometry.factsTop + 1, `${id}: evidence action comes before the long specification`);
          assert.ok(geometry.actionLeft >= geometry.bodyLeft - 1 && geometry.actionRight <= geometry.bodyRight + 1, `${id}: action fits its card`);
          assert.equal(geometry.columnCount, 1, `${id}: desktop facts use one readable column of rows`);
          assert.equal(geometry.rows.length, 4);
          for (let i = 0; i < geometry.rows.length; i += 1) {
            const row = geometry.rows[i];
            assert.ok(row.detailLeft >= row.labelRight + 8, `${id}: label and detail have a clear gutter`);
            assert.ok(row.detailRight <= geometry.bodyRight + 1, `${id}: detail stays inside the card`);
            if (i) assert.ok(row.top > geometry.rows[i - 1].top, `${id}: rows read sequentially`);
          }
        }
        assert.match(await page.locator('#plate-atlas .project-entry').innerText(), /No public live ATLAS deployment/);
        assert.deepEqual(problems, []);
      } finally {
        await close();
      }
    });
  }

  for (const width of [320, 375, 768]) {
    it(`at ${width}px, the same project actions remain readable without overflow`, async () => {
      const { page, problems, close } = await open('/', { viewport: { width, height: 850 } });
      try {
        for (const [id, href] of Object.entries(targets)) {
          const plate = page.locator(`#plate-${id}`);
          assert.equal(await plate.locator('.project-entry-link').getAttribute('href'), href);
          const rects = await plate.evaluate((root) => {
            const outer = root.querySelector('.project-body').getBoundingClientRect();
            const action = root.querySelector('.project-entry').getBoundingClientRect();
            const link = root.querySelector('.project-entry-link').getBoundingClientRect();
            return { left: outer.left, right: outer.right, actionLeft: action.left, actionRight: action.right, linkLeft: link.left, linkRight: link.right };
          });
          assert.ok(rects.actionLeft >= rects.left - 1 && rects.actionRight <= rects.right + 1, `${id}: mobile action stays within the card`);
          assert.ok(rects.linkLeft >= rects.left - 1 && rects.linkRight <= rects.right + 1, `${id}: mobile link stays within the card`);
        }
        assert.ok((await overflow(page)) <= 1);
        assert.deepEqual(problems, []);
      } finally {
        await close();
      }
    });
  }
});

describe('portfolio: desktop-first hero hierarchy', () => {
  for (const width of [1280, 1440, 1920]) {
    it(`at ${width}px the role and both recruiter actions are visible before scrolling`, async () => {
      const { page, problems, close } = await open('/', { viewport: { width, height: 900 } });
      try {
        const layout = await page.evaluate(() => {
          const rect = (selector) => document.querySelector(selector).getBoundingClientRect();
          const strap = rect('.hero-roleline');
          const title = rect('#hero-title');
          const summary = rect('.hero-description');
          const primary = rect('.hero-buttons .button-primary');
          const secondary = rect('.hero-buttons .button-secondary');
          const subtle = rect('.hero-buttons .hero-link');
          const art = rect('.hero-figure');
          return { strap: { top: strap.top, bottom: strap.bottom, left: strap.left, right: strap.right },
            title: { top: title.top, bottom: title.bottom }, summary: { top: summary.top, bottom: summary.bottom },
            primary: { top: primary.top, bottom: primary.bottom }, secondary: { top: secondary.top, bottom: secondary.bottom },
            subtle: { top: subtle.top }, art: { left: art.left, right: art.right },
            headerLinks: [...document.querySelectorAll('.desktop-nav a')].map(a => a.getBoundingClientRect().height),
            viewport: document.documentElement.clientWidth };
        });
        assert.ok(layout.strap.top >= 0 && layout.strap.bottom < layout.title.top, 'engineering identity appears before the conceptual title');
        assert.ok(layout.title.bottom < layout.summary.top && layout.summary.bottom <= layout.primary.top + 1, 'editorial headline, summary and actions read top to bottom');
        assert.ok(layout.primary.bottom <= 900 && layout.secondary.bottom <= 900, 'recruiter actions are above the desktop fold');
        assert.ok(Math.abs(layout.primary.top - layout.secondary.top) <= 2, 'the two recruiter actions share one clear primary row');
        assert.ok(layout.subtle.top >= layout.primary.bottom, 'quiet exploration links follow primary actions');
        assert.ok(layout.art.left >= layout.strap.right - 5, 'the technical drawing remains beside the introductory copy');
        assert.ok(layout.art.right <= layout.viewport + 1, 'the drawing is not clipped');
        assert.ok(layout.headerLinks.length === 6 && layout.headerLinks.every(n => n >= 40), 'six desktop navigation links have comfortably sized focus targets');
        assert.ok((await overflow(page)) <= 1);
        assert.deepEqual(problems, []);
      } finally { await close(); }
    });
  }

  for (const width of [320, 375, 768, 1001]) {
    it(`at ${width}px the role strap, actions and technical drawing remain readable`, async () => {
      const { page, problems, close } = await open('/', { viewport: { width, height: 900 } });
      try {
        const strap = await page.locator('.hero-roleline').innerText();
        assert.match(strap, /software engineer/i, 'the role label remains visible even with uppercase styling');
        assert.doesNotMatch(strap, /^\/$/m, 'the decorative divider does not occupy its own line');
        assert.equal(await page.locator('.hero-buttons a[href="#work"]').count(), 1);
        assert.equal(await page.locator('.hero-buttons a[href="#experience"]').count(), 1);
        assert.ok((await overflow(page)) <= 1);
        assert.deepEqual(await clipped(page), []);
        assert.deepEqual(problems, []);
      } finally { await close(); }
    });
  }
});

describe('portfolio: recruiter path and evidence-based claims', () => {
  it('leads from the hero straight to the four plates and keeps the section-cut explorer', async () => {
    const { page, close } = await open('/');
    try {
      const primary = page.locator('.hero .hero-buttons .button-primary');
      assert.equal(await primary.getAttribute('href'), '#work');
      assert.match((await primary.textContent()).replace(/\s+/g, ' ').trim(), /^View projects/);
      assert.equal(await page.locator('.hero .hero-buttons a[href="#systems"]').count(), 1, 'the section cut keeps its hero entry point');
      assert.equal(await page.locator('.hero .hero-buttons a[href="https://github.com/arthur-fay"]').count(), 1);
      assert.deepEqual(await page.$$eval('.hero-index a', (links) => links.map((a) => a.getAttribute('href'))), ['#plate-atlas', '#plate-commerce', '#plate-pathfinding', '#plate-security']);
      await primary.click();
      await page.waitForFunction(() => window.location.hash === '#work');
      const workTop = await page.$eval('#work', (el) => el.getBoundingClientRect().top);
      assert.ok(workTop >= 0 && workTop <= 120, `the projects section sits just below the sticky header (top=${workTop})`);
      assert.equal(await page.locator('.project:visible').count(), 4, 'all four case studies are shown');
      for (const plate of PROJECTS) {
        await page.locator(`.hero-index a[href="#plate-${plate}"]`).click();
        await page.waitForFunction((id) => window.location.hash === `#${id}`, `plate-${plate}`);
        const top = await page.$eval(`#plate-${plate}`, (el) => el.getBoundingClientRect().top);
        assert.ok(top >= 0 && top <= 120, `plate ${plate} is brought into view (top=${top})`);
      }
    } finally {
      await close();
    }
  });

  it('states only evidence-backed fields and describes the author positively', async () => {
    const { page, close } = await open('/');
    try {
      const text = (await page.locator('body').innerText()).toLowerCase();
      // The résumé's practice "AI-assisted development gated by human review, tests and CI" is the one permitted mention; no field of work is claimed.
      assert.ok(!text.includes('artificial intelligence') && !/\bai\b/.test(text.replace(/ai-assisted development/g, '')), 'no unsupported artificial-intelligence claim');
      const about = (await page.locator('#about').innerText()).toLowerCase();
      assert.ok(!/no employment|degrees|certifications|awards/.test(about), 'the about section no longer leads with what is not claimed');
      assert.ok(about.includes('project repositories') && about.includes('résumé-reported'), 'the about note distinguishes published engineering evidence from the self-reported professional record');
      assert.deepEqual(await page.$$eval('.hero-titleblock dt', (dts) => dts.map((dt) => dt.textContent.trim())), ['Role', 'Stack', 'Education', 'Verify']);
      assert.deepEqual(await page.$$eval('.about-fields li', (items) => items.map((li) => li.textContent.replace(/^\d+/, '').trim())), ['Backend services & REST APIs', 'Database engineering & SQL', 'Frontend development & accessible interfaces', 'Automated testing & CI/CD', 'Forecasting research & analytics', 'Interactive engineering labs']);
      assert.equal(await page.locator('.hero-index a').count(), 4);
      const hero = (await page.locator('.hero-copy').innerText()).toLowerCase();
      assert.ok(hero.includes('software engineer'), 'the hero names the kind of engineer');
      for (const term of ['python', 'typescript/react', 'fastapi', 'postgresql', 'rest apis', 'ci/cd']) assert.ok(hero.includes(term), `the hero names ${term}`);
      assert.ok(hero.includes('backend software engineer i'), 'the title block keeps the actual job title');
    } finally {
      await close();
    }
  });
});

describe('portfolio: professional record desktop refinement', () => {
  for (const width of [1280, 1440, 1920]) {
    for (const colorScheme of ['dark', 'light']) {
      it('at '+width+'px in '+colorScheme+', work evidence reads wider than the skills index', async () => {
        const { page, problems, close } = await open('/', { viewport: { width, height: 900 }, colorScheme });
        try {
          const layout = await page.evaluate(() => {
            const record = document.querySelector('.record');
            const left = document.querySelector('.record-main').getBoundingClientRect();
            const right = document.querySelector('.record-aside').getBoundingClientRect();
            const first = document.querySelector('.record-entry');
            const when = first.querySelector('.record-when').getBoundingClientRect();
            const body = first.querySelector('.record-body').getBoundingClientRect();
            const list = document.querySelectorAll('.stack-group dd span');
            const firstChip = getComputedStyle(list[0]);
            const skillGrid = document.querySelector('.stack-groups');
            return {
              leftWidth: left.width, rightWidth: right.width,
              gap: right.left - left.right,
              whenRight: when.right, bodyLeft: body.left, bodyWidth: body.width,
              skillCount: list.length, chipBorder: parseFloat(firstChip.borderTopWidth),
              skillGroupRows: [...skillGrid.querySelectorAll('.stack-group')].map(g => g.getBoundingClientRect().top),
              visibleEducation: [...document.querySelectorAll('.edu-entry')].map(el => el.getBoundingClientRect().width),
              projectLinks: document.querySelectorAll('.record-entry-independent .record-points a[href^="#plate-"]').length,
              columns: getComputedStyle(record).gridTemplateColumns.trim().split(/\s+/).length
            };
          });
          assert.equal(layout.columns, 2, 'the desktop record remains a balanced two-column composition');
          assert.ok(layout.leftWidth > layout.rightWidth * 1.6, 'employment evidence gets more width than the skills index');
          assert.ok(layout.bodyWidth > 420, 'role descriptions are no longer restricted to narrow paragraphs');
          assert.ok(layout.bodyLeft > layout.whenRight + 10, 'dates and content have a readable gutter');
          assert.ok(layout.gap >= 20, 'clear separation between résumé and education');
          assert.ok(layout.skillCount >= 30 && layout.chipBorder === 0, 'all technology terms remain, without excessive chip borders');
          assert.ok(layout.skillGroupRows.every((value, i, all) => i === 0 || value > all[i - 1]), 'skill groups retain a top-to-bottom hierarchy');
          assert.equal(layout.visibleEducation.length, 2, 'both degrees are visible in the academic panel');
          assert.equal(layout.projectLinks, 4, 'the independent-work links are preserved');
          assert.equal(await overflow(page), 0);
          assert.deepEqual(problems, []);
        } finally { await close(); }
      });
    }
  }
  for (const width of [320, 375, 768, 980, 1001, 1180]) {
    it('at '+width+'px the record retains source facts and avoids overflow', async () => {
      const { page, problems, close } = await open('/', { viewport: { width, height: 850 } });
      try {
        assert.equal(await page.locator('#experience .record-body h3').count(), 3, 'two employment roles and independent projects remain');
        assert.equal(await page.locator('#education .edu-entry').count(), 2);
        assert.equal(await overflow(page), 0);
        assert.deepEqual(await clipped(page), []);
        assert.deepEqual(problems, []);
      } finally { await close(); }
    });
  }
});

describe('portfolio: experience, education, contact and privacy', () => {
  it('states the professional record apart from the independent work, with both job titles and both degrees as on the latest résumé', async () => {
    const { page, problems, close } = await open('/');
    try {
      assert.ok(await page.locator('#experience').isVisible());
      assert.deepEqual(await page.$$eval('#experience .record-kind', (els) => els.map((el) => el.textContent.trim())), ['Employment', 'Employment', 'Independent work']);
      assert.deepEqual(await page.$$eval('#experience .record-dates', (els) => els.map((el) => el.textContent.trim())), ['Mar 2026 — Present', 'Mar 2020 — Dec 2025', 'Jul 2026 — Present']);
      assert.deepEqual(await page.$$eval('#experience .record-body h3', (hs) => hs.map((h) => h.firstChild.textContent.trim())), ['Backend Software Engineer I', 'Data Analyst', 'Software & analytics projects']);
      // The independent-work entry links to the four plates; the employment entries link nowhere (no employer systems are referenced).
      assert.deepEqual(await page.$$eval('#experience .record-entry-independent a', (as) => as.map((a) => a.getAttribute('href'))), ['#plate-atlas', '#plate-commerce', '#plate-pathfinding', '#plate-security']);
      assert.equal(await page.locator('#experience .record-entry:not(.record-entry-independent) a').count(), 0);
      const education = page.locator('#education');
      assert.deepEqual(await education.locator('.edu-status').allTextContents(), ['In progress · expected Jan 2027', 'Completed · Aug 2024']);
      assert.deepEqual(await education.locator('h4').allTextContents(), ['B.S. Computer Science', 'A.S. Computer Science']);
      const bachelor = (await education.locator('.edu-entry').first().innerText()).toLowerCase();
      assert.ok(bachelor.includes('in progress') && bachelor.includes('expected january 2027') && !bachelor.includes('completed'), 'the bachelor\'s degree is not presented as completed');
      const associate = (await education.locator('.edu-entry').nth(1).innerText()).toLowerCase();
      assert.ok(associate.includes('completed · aug 2024') && associate.includes('borough of manhattan community college'), 'the associate degree is back on the record with its date');
      const heroEducation = (await page.locator('.hero-titleblock > div').nth(2).innerText()).toLowerCase();
      assert.ok(heroEducation.includes('in progress') && heroEducation.includes('capella') && heroEducation.includes('expected january 2027') && heroEducation.includes('bmcc (cuny), august 2024'), 'the hero title block agrees with the record');
      assert.ok(!(await page.locator('#experience').innerText()).includes('Pharmacy Technician'), 'the former public title is superseded by Data Analyst');
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('keeps experience-card body content clear of the hatch on phone and tablet widths', async () => {
    for (const width of [320, 375, 768]) {
      const { page, problems, close } = await open('/', { viewport: { width, height: 850 } });
      try {
        const positions = await page.locator('.record-entry').evaluateAll((entries) =>
          entries.map((entry) => {
            const stripe = entry.getBoundingClientRect().left + 16;
            const elements = [entry.querySelector('.record-body h3'), ...entry.querySelectorAll('.record-points li, .record-tech li')];
            return { stripe, minLeft: Math.min(...elements.map((node) => node.getBoundingClientRect().left)) };
          })
        );
        for (const { stripe, minLeft } of positions) {
          assert.ok(minLeft >= stripe + 8, `content at ${width}px clears hatch by at least 8px (${minLeft} vs ${stripe})`);
        }
        assert.deepEqual(problems, []);
      } finally {
        await close();
      }
    }
  });

  it('fits both degrees in the hero title block and the education card at phone widths, each status chip on one line', async () => {
    for (const width of [320, 375]) {
      const { page, problems, close } = await open('/', { viewport: { width, height: 850 } });
      try {
        const chips = await page.locator('#education .edu-status').evaluateAll((els) => els.map((el) => {
          const r = el.getBoundingClientRect();
          const card = el.closest('.record-card').getBoundingClientRect();
          return { text: el.textContent, height: r.height, inside: r.left >= card.left + 8 && r.right <= card.right - 8 };
        }));
        assert.deepEqual(chips.map((c) => c.text), ['In progress · expected Jan 2027', 'Completed · Aug 2024']);
        for (const chip of chips) assert.ok(chip.inside, `${width}px: "${chip.text}" stays inside its card`);
        assert.ok(Math.abs(chips[0].height - chips[1].height) < 1, `${width}px: both status chips sit on one line (${chips[0].height} vs ${chips[1].height})`);
        const cell = await page.locator('.hero-titleblock > div').nth(2).evaluate((el) => ({ right: el.getBoundingClientRect().right, fits: el.scrollWidth <= el.clientWidth + 0.5, text: el.innerText }));
        assert.ok(cell.right <= width + 0.5 && cell.fits, `${width}px: the education cell does not overflow`);
        assert.ok(/expected January 2027/.test(cell.text) && /August 2024/.test(cell.text), `${width}px: both degrees are read in the title block`);
        assert.deepEqual(problems, []);
      } finally {
        await close();
      }
    }
  });

  it('keeps the dates row and the body of each experience entry on one left edge below the two-column layout', async () => {
    for (const width of [320, 375, 600, 900]) {
      const { page, close } = await open('/', { viewport: { width, height: 850 } });
      try {
        const edges = await page.locator('.record-entry').evaluateAll((entries) => entries.map((entry) => ({
          when: entry.querySelector('.record-dates').getBoundingClientRect().left,
          body: entry.querySelector('.record-body h3').getBoundingClientRect().left,
        })));
        for (const { when, body } of edges) assert.ok(Math.abs(when - body) < 0.5, `${width}px: dates at ${when}, body at ${body}`);
      } finally {
        await close();
      }
    }
  });

  it('keeps every experience technology tag inside its card at phone widths in both themes', async () => {
    for (const width of [320, 375]) {
      for (const colorScheme of ['dark', 'light']) {
        const { page, problems, close } = await open('/', { viewport: { width, height: 850 }, colorScheme });
        try {
          const outside = await page.evaluate(() => {
            const found = [];
            for (const tag of document.querySelectorAll('#experience .record-tech li, #experience .stack-group dd span')) {
              const card = tag.closest('.record-entry, .record-card');
              const r = tag.getBoundingClientRect();
              const c = card.getBoundingClientRect();
              const s = getComputedStyle(card);
              const left = c.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft);
              const right = c.right - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight);
              if (r.left < left - 0.5 || r.right > right + 0.5) found.push(`"${tag.textContent.trim()}" spans ${r.left.toFixed(1)}-${r.right.toFixed(1)} but the card's content box spans ${left.toFixed(1)}-${right.toFixed(1)}`);
            }
            return found;
          });
          assert.deepEqual(outside, [], `${width}px ${colorScheme}: every technology tag stays inside its card`);
          assert.ok((await page.locator('#experience .record-tech li').count()) >= 15, 'the record carries its technology tags');
          assert.deepEqual(problems, []);
        } finally {
          await close();
        }
      }
    }
  });

  it('carries the résumé headline in the document title and the social metadata, with the job title kept for the record', async () => {
    const { page, close } = await open('/');
    try {
      assert.equal(await page.title(), 'Arthur Fay — Software Engineer · The Architect Lab · Python, TypeScript/React, FastAPI & PostgreSQL');
      assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), 'Arthur Fay — Software Engineer · The Architect Lab');
      assert.match(await page.locator('meta[name="description"]').getAttribute('content'), /^Arthur Fay is a software engineer in New York working in Python, TypeScript\/React, FastAPI, PostgreSQL, REST APIs and CI\/CD\./);
      assert.deepEqual(await page.$$eval('.hero-titleblock dd', (dds) => dds.slice(0, 3).map((dd) => dd.firstChild.textContent.trim())), ['Backend Software Engineer I', 'Python · TypeScript/React · FastAPI · PostgreSQL', 'B.S. Computer Science, in progress']);
      assert.deepEqual(await page.$$eval('.stack-group dt', (dts) => dts.map((dt) => dt.textContent)), ['Programming', 'Backend & data', 'Frontend', 'Testing & quality', 'Infrastructure & CI/CD', 'Practices']);
    } finally {
      await close();
    }
  });

  it('reaches the record from the hero, the navigation and the footer, numbers the sheets in order and marks the section in view', async () => {
    const { page, close } = await open('/');
    try {
      assert.equal(await page.locator('.hero .hero-buttons a[href="#experience"]').count(), 1);
      assert.equal(await page.locator('.hero-titleblock a[href="#education"]').count(), 1);
      assert.equal(await page.locator('.desktop-nav a[href="#experience"]').count(), 1);
      assert.equal(await page.locator('.footer-index a[href="#experience"]').count(), 1);
      assert.deepEqual(await page.$$eval('.desktop-nav a', (as) => as.map((a) => `${a.querySelector('.nav-index').textContent} ${a.lastChild.textContent.trim()}`)), ['01 Systems', '02 Work', '03 Experience', '04 Method', '05 About', '06 Contact']);
      assert.deepEqual(await page.$$eval('main .section-heading .section-index, main .about-heading .section-index, main .contact-top .section-index', (ps) => ps.map((p) => p.textContent.trim().slice(0, 2))), ['01', '02', '03', '04', '05', '06'], 'the visible sheet numbers follow the navigation');
      await page.locator('.hero .hero-buttons a[href="#experience"]').click();
      await page.waitForFunction(() => window.location.hash === '#experience');
      const top = await page.$eval('#experience', (el) => el.getBoundingClientRect().top);
      assert.ok(top >= 0 && top <= 120, `the record sits just below the sticky header (top=${top})`);
      await page.waitForFunction(() => document.querySelector('.desktop-nav a[href="#experience"]').getAttribute('aria-current') === 'true');
    } finally {
      await close();
    }
  });

  it('never states an ATLAS improvement without its statistical qualification and the calibration finding', async () => {
    const { page, close } = await open('/');
    try {
      for (const id of ['cut-atlas', 'plate-atlas', 'atlas-detail']) {
        const text = (await page.locator(`#${id}`).innerText()).toLowerCase();
        if (id !== 'plate-atlas') assert.ok(text.includes('28%') && text.includes('11%'), `#${id} states the measured improvement`);
        assert.ok(text.includes('not statistically established') || text.includes('not established'), `#${id} qualifies the improvement`);
        assert.ok(text.includes('failed calibration'), `#${id} keeps the calibration finding`);
        assert.ok(text.includes('hypothetical'), `#${id} keeps the optimization boundary`);
      }
      const service = (await page.locator('#cut-atlas').innerText()).toLowerCase();
      assert.ok(service.includes('14 versioned endpoints') && service.includes('openapi 3.1'), 'the service layer states the verified API facts');
      assert.ok(service.includes('not published'), 'the dashboard is described as unpublished');
      assert.ok((await page.locator('#plate-atlas').innerText()).includes('not deployed'), 'the deployment package is described as not deployed');
    } finally {
      await close();
    }
  });

  it('offers recruiters a clear path: roles of interest, GitHub as the verified channel and the ATLAS API as the first stop', async () => {
    const { page, close } = await open('/');
    try {
      assert.deepEqual(await page.locator('.contact-roles li').allTextContents(), ['Software Engineer', 'Backend Software Engineer', 'Full-Stack Engineer · Python & React', 'API / Database Engineer']);
      assert.equal(await page.locator('.contact-actions a[href="https://github.com/arthur-fay"]').count(), 1);
      assert.equal(await page.locator('.contact-actions a[href$="/docs/API.md"]').count(), 1);
      assert.equal(await page.locator('.channel-list a').count(), 4);
      assert.equal(await page.locator('.hero-titleblock a[href="https://github.com/arthur-fay"]').count(), 1, 'the hero says where to verify the work');
      const contactCopy = (await page.locator('#contact .contact-left > p').innerText()).toLowerCase();
      assert.match(contactCopy, /résumé you received/, 'direct hiring correspondence uses the separately shared résumé');
      assert.match(contactCopy, /not a private messaging channel/, 'public GitHub evidence is not misrepresented as a messaging service');
      assert.doesNotMatch(contactCopy, /start a discussion|shared on request/, 'never promise unavailable GitHub Discussions or an inaccessible private contact channel');
      const verifyCopy = (await page.locator('.hero-titleblock').innerText()).toLowerCase();
      assert.ok(verifyCopy.includes('available research evidence') && verifyCopy.includes('tested browser labs'), 'hero verification copy distinguishes tested labs from older BI project artifacts');
    } finally {
      await close();
    }
  });

  it('publishes no personal contact details on any page: GitHub is the only committed channel', async () => {
    for (const url of ['/', '/lab/ecommerce/', '/lab/pathfinding/', '/lab/security-events/', '/does-not-exist']) {
      const { page, close } = await open(url);
      try {
        const html = await page.content();
        const text = await page.locator('body').innerText();
        assert.ok(!/mailto:|\btel:/i.test(html), `${url}: no mailto or tel link`);
        assert.ok(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text), `${url}: no e-mail address`);
        assert.ok(!/\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(text), `${url}: no phone number`);
        assert.ok(!/linkedin\.com/i.test(html), `${url}: no LinkedIn link until the owner publishes one`);
        const hosts = await page.$$eval('a[href^="https://"]', (as) => [...new Set(as.map((a) => new URL(a.href).host))]);
        assert.deepEqual(hosts, hosts.length ? ['github.com'] : [], `${url}: outbound links stay on GitHub`);
      } finally {
        await close();
      }
    }
  });

  it('shows the menu button up to 1000px and the full six-link navigation from 1001px, with nothing clipped either side', async () => {
    for (const [width, menu] of [[1000, true], [1001, false]]) {
      const { page, close } = await open('/', { viewport: { width, height: 900 } });
      try {
        assert.equal(await page.locator('#menu-toggle').isVisible(), menu, `${width}px: menu button`);
        assert.equal(await page.locator('.desktop-nav').isVisible(), !menu, `${width}px: primary navigation`);
        assert.equal(await overflow(page), 0);
        assert.deepEqual(await clipped(page), []);
        if (menu) {
          await page.locator('#menu-toggle').click();
          assert.ok(await page.locator('#mobile-nav').isVisible());
          await page.setViewportSize({ width: 1001, height: 900 });
          await page.waitForFunction(() => document.getElementById('mobile-nav').hidden, null, { timeout: 2000 });
        }
      } finally {
        await close();
      }
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
      assert.equal(await page.locator('#mobile-nav a').count(), 7);
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
