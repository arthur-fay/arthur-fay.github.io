/**
 * Browser tests for the Interactive Robotics & Pathfinding Lab and the portfolio page.
 *
 * Runs with Node's built-in test runner and the Playwright library (Chromium).
 * Playwright is resolved through Node's module paths, so point NODE_PATH at a
 * directory containing node_modules/playwright (see lab/pathfinding/README.md).
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
  desktop: { width: 1280, height: 800 },
  tablet: { width: 834, height: 1112 },
  mobile: { width: 375, height: 667 },
  narrow: { width: 320, height: 568 },
};
const LAB = '/lab/pathfinding/';

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

/** Opens a page and collects console errors, page errors and failed requests. */
async function open(url, { viewport = VIEWPORTS.desktop, colorScheme = 'light', reducedMotion = 'no-preference', hasTouch = false } = {}) {
  const context = await browser.newContext({ viewport, colorScheme, reducedMotion, hasTouch, isMobile: hasTouch });
  // Smooth scrolling is a product feature; tests need deterministic coordinates, so scroll instantly (CSSOM write, CSP-safe).
  await context.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.scrollBehavior = 'auto'; });
  });
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

const status = (page) => page.locator('#lab-status').textContent();
const stat = async (page, id) => (await page.locator(`#${id}`).evaluate((dd) => dd.firstChild.textContent)).trim();
const number = (text) => Number(text.replace(/,/g, ''));
const cell = (page, x, y) => page.locator(`#grid [role="row"]:nth-child(${y + 1}) [role="gridcell"]:nth-child(${x + 1})`);
const count = (page, selector) => page.locator(selector).count();
const gridSignature = (page) => page.evaluate(() => [...document.querySelectorAll('#grid .lab-cell')].map((c) => (c.classList.contains('is-wall') ? '#' : c.classList.contains('is-terrain') ? '~' : c.classList.contains('is-start') ? 'S' : c.classList.contains('is-target') ? 'T' : '.')).join(''));
const setRange = (page, id, value) => page.evaluate(([i, v]) => { const el = document.getElementById(i); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, [id, String(value)]);
const noOverflow = (page) => page.evaluate(() => ({ docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, bodyOverflow: document.body.scrollWidth - document.body.clientWidth }));
const accessibleNameGaps = (page) => page.evaluate(() => {
  // Text hidden from assistive technology (aria-hidden) must not count towards a name.
  const visibleText = (node) => {
    let text = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) text += child.textContent;
      else if (child.nodeType === Node.ELEMENT_NODE && child.getAttribute('aria-hidden') !== 'true') text += visibleText(child);
    }
    return text;
  };
  const gaps = [];
  for (const el of document.querySelectorAll('button, input, select, textarea, a[href], [role="grid"]')) {
    const labelledBy = el.getAttribute('aria-labelledby');
    const byId = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
    const wrapped = el.closest('label');
    const name = (el.getAttribute('aria-label') || '')
      || (labelledBy ? visibleText(document.getElementById(labelledBy) || el) : '')
      || (byId ? visibleText(byId) : '')
      || (wrapped ? visibleText(wrapped) : '')
      || visibleText(el)
      || (el.getAttribute('title') || '');
    if (!name.trim()) gaps.push(`${el.tagName.toLowerCase()}#${el.id || ''}.${el.className || ''}`);
  }
  return gaps;
});
const focusedRect = (page) => page.evaluate(() => {
  const r = document.activeElement.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, height: window.innerHeight, role: document.activeElement.getAttribute('role') };
});
const duplicateIds = (page) => page.evaluate(() => {
  const seen = new Map();
  for (const el of document.querySelectorAll('[id]')) seen.set(el.id, (seen.get(el.id) || 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
});

async function drawWallColumn(page, x, rows) {
  // Pointer stroke from the top to the bottom of column x.
  await page.locator('#grid').scrollIntoViewIfNeeded();
  const top = await cell(page, x, 0).boundingBox();
  const bottom = await cell(page, x, rows - 1).boundingBox();
  await page.mouse.move(top.x + top.width / 2, top.y + top.height / 2);
  await page.mouse.down();
  for (let y = 0; y < rows; y += 1) {
    const box = await cell(page, x, y).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  }
  await page.mouse.move(bottom.x + bottom.width / 2, bottom.y + bottom.height / 2);
  await page.mouse.up();
}

describe('page integrity across viewports', () => {
  for (const [name, viewport] of Object.entries(VIEWPORTS)) {
    for (const url of ['/', LAB]) {
      it(`${url} at ${name} (${viewport.width}px) loads without errors or horizontal overflow`, async () => {
        const { page, response, problems, close } = await open(url, { viewport });
        try {
          assert.equal(response.status(), 200);
          assert.equal(await page.locator('h1').count(), 1, 'exactly one h1');
          const overflow = await noOverflow(page);
          assert.equal(overflow.docOverflow, 0, `document overflows by ${overflow.docOverflow}px`);
          assert.equal(overflow.bodyOverflow, 0, `body overflows by ${overflow.bodyOverflow}px`);
          assert.deepEqual(await duplicateIds(page), []);
          assert.deepEqual(await accessibleNameGaps(page), [], 'controls without an accessible name');
          if (url === LAB) {
            await page.locator('#run').click();
            await page.waitForFunction(() => !/Loading|Running/.test(document.getElementById('lab-status').textContent));
          }
          assert.deepEqual(problems, []);
        } finally {
          await close();
        }
      });
    }
  }

  it('the lab page loads cleanly in dark mode and the cell colours change with the theme', async () => {
    const { page, problems, close } = await open(LAB, { colorScheme: 'dark' });
    try {
      assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
      await page.locator('label.tool-wall').click();
      assert.ok(await page.locator('input[name="tool"][value="wall"]').isChecked());
      await page.locator('#grid [tabindex="0"]').focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Enter');
      const wall = page.locator('#grid .is-wall').first();
      const darkColour = await wall.evaluate((el) => getComputedStyle(el).backgroundColor);
      await page.locator('#theme-toggle').click();
      assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
      const lightColour = await wall.evaluate((el) => getComputedStyle(el).backgroundColor);
      assert.notEqual(darkColour, lightColour);
      assert.equal(await page.evaluate(() => localStorage.getItem('af-portfolio-theme')), 'light');
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });

  it('internal links resolve and outbound links follow the GitHub-only policy on both pages', async () => {
    for (const url of ['/', LAB]) {
      const { page, close } = await open(url);
      try {
        const hrefs = await page.$$eval('a[href]', (anchors) => anchors.map((a) => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') })));
        assert.ok(hrefs.length > 5);
        for (const { href, target, rel } of hrefs) {
          if (href.startsWith('#')) {
            assert.equal(await page.locator(`[id="${href.slice(1)}"]`).count(), 1, `${url}: missing anchor target ${href}`);
          } else if (href.startsWith('/')) {
            const response = await page.request.get(server.baseUrl + href.split('#')[0]);
            assert.equal(response.status(), 200, `${url}: ${href} returned ${response.status()}`);
          } else {
            assert.ok(href.startsWith('https://github.com/'), `${url}: unexpected outbound link ${href}`);
            if (target === '_blank') assert.ok(/noopener/.test(rel) && /noreferrer/.test(rel), `${url}: ${href} lacks rel noopener noreferrer`);
          }
        }
      } finally {
        await close();
      }
    }
  });

  it('serves the custom 404 page for unknown paths', async () => {
    const { page, response, close } = await open('/does-not-exist');
    try {
      assert.equal(response.status(), 404);
      assert.equal(await page.locator('a[href="/"]').count(), 1);
      assert.ok(await page.locator('main.not-found').isVisible());
      assert.equal(await page.locator('[style], style').count(), 0, '404 has no inline styles');
      assert.equal(await page.locator('link[rel="stylesheet"][href="/404.css"]').count(), 1);
      assert.ok((await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).includes("default-src 'none'"));
      assert.ok((await page.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'));
    } finally {
      await close();
    }
  });
});

describe('portfolio page', () => {
  it('lists four projects, filters them, and links Project 03 to the lab', async () => {
    const { page, close } = await open('/');
    try {
      assert.equal(await count(page, '.project'), 4);
      assert.equal(await count(page, '#project-list > .project'), 4, 'cards are direct children of the list');
      await page.locator('[data-filter="interactive"]').click();
      assert.equal(await count(page, '.project:not([hidden])'), 2, 'both labs are interactive');
      assert.ok(await page.locator('.project-lab').isVisible());
      assert.equal(await page.locator('#filter-status').textContent(), 'Showing 2 projects.');
      await page.locator('[data-filter="analytics"]').click();
      assert.equal(await count(page, '.project:not([hidden])'), 1);
      assert.ok(await page.locator('.project-commerce').isVisible());
      await page.locator('[data-filter="engineering"]').click();
      assert.equal(await count(page, '.project:not([hidden])'), 3, 'both labs are also engineering projects');
      await page.locator('[data-filter="all"]').click();
      assert.equal(await count(page, '.project:not([hidden])'), 4);
      assert.equal(await page.locator('#filter-status').textContent(), 'Showing 4 projects.');
      assert.ok((await page.locator('.project-lab').textContent()).includes('not a validated real-world robotics navigation system'));
      await page.locator('.project-lab a[href="/lab/pathfinding/"]').click();
      await page.waitForURL(`**${LAB}`);
      assert.ok((await page.locator('h1').textContent()).includes('Pathfinding Lab'));
    } finally {
      await close();
    }
  });

  it('opens and closes the mobile navigation', async () => {
    const { page, close } = await open('/', { viewport: VIEWPORTS.mobile });
    try {
      const toggle = page.locator('#menu-toggle');
      assert.ok(await toggle.isVisible());
      await toggle.click();
      assert.equal(await page.getAttribute('#menu-toggle', 'aria-expanded'), 'true');
      assert.ok(await page.locator('#mobile-nav').isVisible());
      await page.keyboard.press('Escape');
      assert.equal(await page.getAttribute('#menu-toggle', 'aria-expanded'), 'false');
      assert.ok(!(await page.locator('#mobile-nav').isVisible()));
    } finally {
      await close();
    }
  });
});

describe('lab: initial state and instant runs (desktop)', () => {
  it('starts with a deterministic 31 × 19 random field and sensible control states', async () => {
    const { page, close } = await open(LAB);
    try {
      assert.equal(await page.getAttribute('#grid', 'aria-colcount'), '31');
      assert.equal(await page.getAttribute('#grid', 'aria-rowcount'), '19');
      assert.equal(await count(page, '#grid [role="row"]'), 19);
      assert.equal(await count(page, '#grid [role="gridcell"]'), 589);
      assert.equal(await count(page, '#grid [tabindex="0"]'), 1, 'one roving tab stop');
      assert.ok((await status(page)).includes('seed 42'));
      assert.ok(await page.locator('#run').isEnabled());
      assert.ok(await page.locator('#step').isEnabled());
      assert.ok(await page.locator('#pause').isDisabled());
      assert.ok(await page.locator('#stop').isDisabled());
      assert.ok(await page.locator('#clear-search').isDisabled());
      assert.ok(await page.locator('#animate').isChecked());
      const first = await gridSignature(page);
      await page.reload();
      assert.equal(await gridSignature(page), first, 'the initial layout is reproducible');
    } finally {
      await close();
    }
  });

  it('runs A*, Dijkstra and BFS instantly with consistent measured results', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#animate').uncheck();
      const results = {};
      for (const algorithm of ['astar', 'dijkstra', 'bfs']) {
        await page.selectOption('#algorithm', algorithm);
        await page.locator('#run').click();
        const text = await status(page);
        assert.match(text, /found a path of \d+ moves with cost [\d.,]+ after expanding [\d,]+ cells in [\d.]+ ms/);
        results[algorithm] = {
          steps: number(await stat(page, 'stat-steps')),
          cost: number(await stat(page, 'stat-cost')),
          expanded: number(await stat(page, 'stat-expanded')),
          pathCells: await count(page, '#grid .is-path'),
          visited: await count(page, '#grid .is-visited'),
        };
        assert.equal(results[algorithm].pathCells, results[algorithm].steps + 1, 'path cells = moves + 1');
        assert.equal(results[algorithm].visited + results[algorithm].pathCells, results[algorithm].expanded, 'every expanded cell is rendered as expanded or as part of the path');
        assert.ok(await page.locator('#clear-search').isEnabled());
        assert.equal(await stat(page, 'stat-outcome'), 'Path found');
        assert.ok((await page.locator('#stat-outcome').textContent()).includes('4 directions'), 'the outcome names the movement rule');
        assert.ok(/ms$/.test(await stat(page, 'stat-time')));
      }
      await page.selectOption('#movement', '8');
      assert.equal(await stat(page, 'stat-outcome'), '—', 'a finished result is cleared when the movement rule changes');
      assert.ok(Math.abs(results.astar.cost - results.dijkstra.cost) < 1e-6, 'A* and Dijkstra agree on the optimal cost');
      assert.ok(results.bfs.cost >= results.dijkstra.cost, 'BFS is never cheaper than Dijkstra');
      assert.ok(results.bfs.steps <= results.dijkstra.steps, 'BFS never uses more moves');
      assert.ok(results.astar.expanded <= results.dijkstra.expanded, 'A* expands no more than Dijkstra on this layout');
      assert.ok(await page.locator('#clear-search').isDisabled(), 'nothing is left to clear after the setting change');
      await page.locator('#run').click();
      assert.equal(await stat(page, 'stat-outcome'), 'Path found');
      await page.locator('#clear-search').click();
      assert.equal(await count(page, '#grid .is-path, #grid .is-visited, #grid .is-frontier'), 0);
      assert.equal(await stat(page, 'stat-outcome'), '—');
      assert.ok(await page.locator('#clear-search').isDisabled());
      assert.equal(await page.evaluate(() => document.activeElement.id), 'run', 'focus moves to Run when the focused button becomes disabled');
    } finally {
      await close();
    }
  });

  for (const [setting, select, value, phrase] of [['algorithm', '#algorithm', 'bfs', 'algorithm changed'], ['movement rule', '#movement', '8', 'movement rule changed']]) {
    it(`clears a completed result when the ${setting} changes without pressing Run`, async () => {
      const { page, close } = await open(LAB);
      try {
        await page.locator('#animate').uncheck();
        await page.selectOption('#algorithm', 'astar');
        await page.locator('#run').click();
        assert.equal(await stat(page, 'stat-outcome'), 'Path found');
        const pathCells = await count(page, '#grid .is-path');
        assert.ok(pathCells > 1 && Number.isInteger(number(await stat(page, 'stat-steps'))), 'a route and statistics are shown');
        await page.selectOption(select, value);
        assert.equal(await count(page, '#grid .is-path, #grid .is-visited, #grid .is-frontier'), 0, 'the overlay is cleared');
        for (const id of ['stat-outcome', 'stat-steps', 'stat-cost', 'stat-expanded', 'stat-time']) assert.equal(await stat(page, id), '—', `${id} is reset`);
        assert.ok(await page.locator('#clear-search').isDisabled(), 'nothing is left to clear');
        assert.ok(await page.locator('#pause').isDisabled() && await page.locator('#stop').isDisabled());
        const text = await status(page);
        assert.ok(text.includes(phrase) && text.includes('previous result was cleared'), text);
        assert.equal(await count(page, '#grid .is-start'), 1, 'the grid itself is untouched');
        await page.locator('#run').click();
        assert.equal(await stat(page, 'stat-outcome'), 'Path found', 'a new run with the new setting works');
        assert.ok((await page.locator('#stat-outcome').textContent()).includes(value === 'bfs' ? 'Breadth-first search' : '8 directions'), 'the new result is labelled with the new setting');
      } finally {
        await close();
      }
    });
  }

  it('explains that BFS is not cost-optimal on weighted terrain', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#animate').uncheck();
      await page.selectOption('#algorithm', 'bfs');
      await page.locator('#run').click();
      assert.ok((await status(page)).includes('BFS minimises moves, not cost'));
      assert.ok((await page.locator('#stat-cost').textContent()).includes('fewest moves, not lowest cost'));
    } finally {
      await close();
    }
  });

  it('supports 8-directional movement with a legal, corner-safe path', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#animate').uncheck();
      await page.selectOption('#movement', '8');
      assert.ok((await page.locator('#movement-hint').textContent()).includes('octile'));
      await page.locator('#run').click();
      assert.equal(await stat(page, 'stat-outcome'), 'Path found');
      const legal = await page.evaluate(() => {
        const cols = Number(document.getElementById('grid').getAttribute('aria-colcount'));
        const cells = [...document.querySelectorAll('#grid .lab-cell')];
        const path = cells.filter((c) => c.classList.contains('is-path')).map((c) => Number(c.dataset.index));
        const isWall = (i) => cells[i].classList.contains('is-wall');
        // Order the path cells by walking from the start.
        const set = new Set(path);
        const start = path.find((i) => cells[i].classList.contains('is-start'));
        const visited = new Set([start]);
        let current = start;
        let moves = 0;
        for (;;) {
          const x = current % cols;
          const y = Math.floor(current / cols);
          let next = null;
          for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0], [1, -1], [1, 1], [-1, 1], [-1, -1]]) {
            const j = (y + dy) * cols + (x + dx);
            if (!set.has(j) || visited.has(j) || x + dx < 0 || x + dx >= cols) continue;
            if (dx !== 0 && dy !== 0 && (isWall(y * cols + (x + dx)) || isWall((y + dy) * cols + x))) return { ok: false, reason: 'corner cut' };
            next = j;
            break;
          }
          if (next === null) break;
          visited.add(next);
          current = next;
          moves += 1;
        }
        return { ok: cells[current].classList.contains('is-target') && visited.size === path.length, moves };
      });
      assert.ok(legal.ok, `path is not a legal 8-directional walk: ${JSON.stringify(legal)}`);
      assert.equal(legal.moves, number(await stat(page, 'stat-steps')));
    } finally {
      await close();
    }
  });

  it('reports an unreachable target clearly and counts the explored cells', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#animate').uncheck();
      await page.locator('#reset').click();
      await drawWallColumn(page, 15, 19);
      assert.equal(await count(page, '#grid .is-wall'), 19, 'a full wall column was painted by one drag');
      await page.locator('#run').click();
      assert.equal(await stat(page, 'stat-outcome'), 'No route');
      const text = await status(page);
      assert.ok(text.includes('cannot be reached'), text);
      assert.equal(number(await stat(page, 'stat-expanded')), 15 * 19, 'exactly the reachable half was explored');
      assert.equal(await stat(page, 'stat-steps'), '—');
      assert.equal(await count(page, '#grid .is-path'), 0);
    } finally {
      await close();
    }
  });

  it('handles start equal to target', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#animate').uncheck();
      await page.locator('#reset').click();
      await page.locator('label.tool-start').click();
      assert.ok(await page.locator('input[name="tool"][value="start"]').isChecked(), 'clicking the label selects the tool');
      await page.locator('#grid').scrollIntoViewIfNeeded();
      await page.locator('#grid .is-target').click();
      assert.equal(await count(page, '#grid .is-start.is-target'), 1, 'the Start tool places the start on the target cell');
      assert.match(await page.locator('#grid .is-start').getAttribute('aria-label'), /start, target/);
      await page.locator('#run').click();
      assert.equal(await stat(page, 'stat-outcome'), 'Same cell');
      assert.equal(await stat(page, 'stat-steps'), '0');
      assert.ok((await status(page)).includes('same cell'));
    } finally {
      await close();
    }
  });
});

describe('lab: editing with keyboard and pointer', () => {
  it('navigates and edits the grid from the keyboard', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#reset').click();
      await page.locator('#grid [tabindex="0"]').focus();
      assert.ok(await page.evaluate(() => document.activeElement.classList.contains('is-start')), 'the start cell is the initial tab stop');
      await page.keyboard.press('Control+Home');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.index), '0');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.index), '32');
      await page.keyboard.press('Enter');
      assert.ok(await page.evaluate(() => document.activeElement.classList.contains('is-wall')));
      assert.match(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), /Row 2, column 2: wall/);
      await page.keyboard.press(' ');
      assert.ok(!(await page.evaluate(() => document.activeElement.classList.contains('is-wall'))), 'Space toggles the wall off again');
      await page.keyboard.press('2');
      assert.ok(await page.locator('input[name="tool"][value="terrain"]').isChecked(), 'digit keys switch tools');
      assert.ok((await status(page)).startsWith('Drawing tool: Terrain'), 'the switch is announced');
      await page.keyboard.press('Enter');
      assert.ok(await page.evaluate(() => document.activeElement.classList.contains('is-terrain')));
      await page.keyboard.press('End');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.index), String(31 + 30));
      await page.keyboard.press('PageDown');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.index), String(6 * 31 + 30));
      await page.keyboard.press('Control+End');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.index), String(31 * 19 - 1));
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.index), String(31 * 19 - 1), 'movement clamps at the edge');
      await page.keyboard.press('4');
      await page.keyboard.press('Enter');
      assert.ok(await page.evaluate(() => document.activeElement.classList.contains('is-start')), 'the Start tool moves the marker to the focused cell');
      assert.equal(await count(page, '#grid .is-start'), 1);
      await page.keyboard.press('Tab');
      assert.notEqual(await page.evaluate(() => document.activeElement.getAttribute('role')), 'gridcell', 'a single Tab leaves the grid');
    } finally {
      await close();
    }
  });

  it('paints with pointer strokes, toggles walls, and drags the markers', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#reset').click();
      await drawWallColumn(page, 3, 5);
      assert.equal(await count(page, '#grid .is-wall'), 5);
      await cell(page, 3, 0).click();
      assert.equal(await count(page, '#grid .is-wall'), 4, 'clicking a wall with the Wall tool erases it');
      await page.locator('label.tool-erase').click();
      assert.ok(await page.locator('input[name="tool"][value="erase"]').isChecked());
      await cell(page, 3, 1).click();
      assert.equal(await count(page, '#grid .is-wall'), 3);
      // Drag the start marker two cells to the right with the Erase tool still selected.
      await page.locator('#grid').scrollIntoViewIfNeeded();
      const start = await page.locator('#grid .is-start').boundingBox();
      await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
      await page.mouse.down();
      await page.mouse.move(start.x + start.width * 1.5, start.y + start.height / 2);
      await page.mouse.move(start.x + start.width * 2.5, start.y + start.height / 2);
      await page.mouse.up();
      assert.equal(await count(page, '#grid .is-start'), 1);
      assert.equal(await page.locator('#grid .is-start').evaluate((el) => el.dataset.index), String(9 * 31 + 7));
      assert.equal(await count(page, '#grid .is-wall'), 3, 'dragging a marker never paints');
      // After the button is released, moving the pointer never paints.
      const walls = await count(page, '#grid .is-wall');
      const probe = await cell(page, 10, 2).boundingBox();
      await page.mouse.move(probe.x + probe.width / 2, probe.y + probe.height / 2);
      await page.mouse.move(probe.x + probe.width * 1.5, probe.y + probe.height / 2);
      assert.equal(await count(page, '#grid .is-wall'), walls, 'a finished stroke does not keep painting');
      // The Target tool places the target on any pressed cell.
      await page.locator('label.tool-target').click();
      await cell(page, 12, 3).click();
      assert.equal(await page.locator('#grid .is-target').evaluate((el) => el.dataset.index), String(3 * 31 + 12));
      assert.equal(await count(page, '#grid .is-target'), 1);
      await page.locator('#clear-walls').click();
      assert.equal(await count(page, '#grid .is-wall, #grid .is-terrain'), 0);
      assert.equal(await count(page, '#grid .is-start'), 1);
    } finally {
      await close();
    }
  });

  it('keeps the focused cell inside the viewport during keyboard navigation', async () => {
    const { page, close } = await open(LAB, { viewport: { width: 1280, height: 600 } });
    try {
      await page.selectOption('#size', '61x37');
      await page.locator('#grid [tabindex="0"]').focus();
      const moves = ['ArrowDown', 'ArrowDown', 'Control+End', 'PageUp', 'Control+Home', 'End', 'PageDown', 'PageDown', 'PageDown'];
      for (const key of moves) {
        await page.keyboard.press(key);
        const rect = await focusedRect(page);
        assert.equal(rect.role, 'gridcell');
        assert.ok(rect.top >= 0 && rect.bottom <= rect.height, `after ${key}: focused cell at ${rect.top}–${rect.bottom} is outside the ${rect.height}px viewport`);
      }
    } finally {
      await close();
    }
  });

  it('keeps focus inside the grid when the layout is regenerated while a cell is focused', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#grid [tabindex="0"]').focus();
      await page.keyboard.press('ArrowRight');
      // A programmatic activation (as from a browser that does not focus buttons on click) rebuilds the grid.
      await page.evaluate(() => document.getElementById('generate').click());
      const active = await page.evaluate(() => ({ role: document.activeElement.getAttribute('role'), tabIndex: document.activeElement.tabIndex, inGrid: document.getElementById('grid').contains(document.activeElement) }));
      assert.deepEqual(active, { role: 'gridcell', tabIndex: 0, inGrid: true });
      await page.locator('#size').focus();
      await page.selectOption('#size', '21x13');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'size', 'a control that holds focus keeps it');
    } finally {
      await close();
    }
  });

  it('stops a running search when the grid or the settings change', async () => {
    const { page, close } = await open(LAB);
    try {
      await setRange(page, 'speed', 1);
      await page.locator('#run').click();
      assert.ok(await page.locator('#pause').isEnabled());
      await page.locator('#grid [tabindex="0"]').focus();
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('Enter');
      assert.ok((await status(page)).includes('stopped'));
      assert.ok(await page.locator('#pause').isDisabled());
      assert.equal(await count(page, '#grid .is-visited, #grid .is-frontier'), 0);
      await page.locator('#run').click();
      await page.selectOption('#algorithm', 'bfs');
      assert.ok((await status(page)).includes('Stopped: the algorithm changed'));
      await page.locator('#run').click();
      await page.selectOption('#movement', '8');
      assert.ok((await status(page)).includes('movement rule changed'));
    } finally {
      await close();
    }
  });
});

describe('lab: animation controls', () => {
  it('animates, pauses, steps, resumes and stops', async () => {
    const { page, close } = await open(LAB);
    try {
      await setRange(page, 'speed', 1);
      assert.equal(await page.getAttribute('#speed', 'aria-valuetext'), '12 expansions per second');
      await page.locator('#run').click();
      assert.ok((await status(page)).startsWith('Running'));
      await page.waitForFunction(() => document.querySelectorAll('#grid .is-visited').length >= 2);
      await page.locator('#pause').click();
      assert.match(await status(page), /Paused after \d+ of [\d,]+ expansions/);
      assert.equal(await page.locator('#pause').textContent(), 'Resume');
      const paused = await count(page, '#grid .is-visited');
      await page.waitForTimeout(250);
      assert.equal(await count(page, '#grid .is-visited'), paused, 'nothing advances while paused');
      await page.locator('#step').click();
      assert.equal(await count(page, '#grid .is-visited'), paused + 1, 'Step advances exactly one expansion');
      assert.match(await status(page), /^Step \d+ of [\d,]+: expanded row \d+, column \d+/);
      await page.locator('#pause').click();
      assert.ok((await status(page)).startsWith('Resumed'));
      assert.equal(await page.locator('#pause').textContent(), 'Pause');
      await page.waitForFunction((n) => document.querySelectorAll('#grid .is-visited').length > n, paused + 1);
      await page.locator('#stop').click();
      assert.match(await status(page), /^Stopped after \d+ of [\d,]+ expansions/);
      assert.equal(await count(page, '#grid .is-visited, #grid .is-frontier, #grid .is-path'), 0);
      assert.ok(await page.locator('#stop').isDisabled());
      assert.equal(await page.evaluate(() => document.activeElement.id), 'run');
      // A fast animated run completes on its own.
      await setRange(page, 'speed', 10);
      await page.locator('#run').click();
      await page.waitForFunction(() => /found a path|No route/.test(document.getElementById('lab-status').textContent), null, { timeout: 15000 });
      assert.equal(await stat(page, 'stat-outcome'), 'Path found');
      assert.equal(await count(page, '#grid .is-path'), number(await stat(page, 'stat-steps')) + 1);
    } finally {
      await close();
    }
  });

  it('steps from idle, one expansion at a time, until the result appears', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.locator('#reset').click();
      await page.selectOption('#size', '21x13');
      await page.locator('#step').click();
      assert.match(await status(page), /^Step 1 of/);
      assert.equal(await count(page, '#grid .is-visited'), 1);
      assert.equal(await page.locator('#pause').textContent(), 'Resume');
      for (let i = 0; i < 5; i += 1) await page.locator('#step').click();
      assert.equal(await count(page, '#grid .is-visited'), 6);
      assert.match(await stat(page, 'stat-expanded'), /^6$/);
      const total = number((await status(page)).match(/of ([\d,]+):/)[1]);
      for (let i = 6; i < total; i += 1) await page.locator('#step').click();
      assert.equal(await stat(page, 'stat-outcome'), 'Path found');
      assert.ok(await page.locator('#pause').isDisabled());
    } finally {
      await close();
    }
  });

  it('turns animation off by default under prefers-reduced-motion', async () => {
    const { page, problems, close } = await open(LAB, { reducedMotion: 'reduce' });
    try {
      assert.ok(!(await page.locator('#animate').isChecked()));
      assert.ok((await page.locator('#animate-hint').textContent()).includes('reduced motion'));
      await page.locator('#run').click();
      assert.equal(await stat(page, 'stat-outcome'), 'Path found', 'the result appears immediately');
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });
});

describe('lab: layouts, seeds and sizes', () => {
  it('generates identical layouts for identical seeds and different layouts otherwise', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.selectOption('#layout', 'maze');
      await page.locator('#seed').fill('123');
      await page.locator('#generate').click();
      assert.ok((await status(page)).includes('perfect maze'));
      const a = await gridSignature(page);
      await page.locator('#seed').fill('124');
      await page.locator('#seed').press('Enter');
      const b = await gridSignature(page);
      assert.notEqual(a, b);
      await page.locator('#seed').fill('123');
      await page.locator('#generate').click();
      assert.equal(await gridSignature(page), a);
      assert.equal(await count(page, '#grid .is-start'), 1);
      assert.equal(await count(page, '#grid .is-target'), 1);
      await page.locator('#animate').uncheck();
      await page.locator('#run').click();
      assert.equal(await stat(page, 'stat-outcome'), 'Path found', 'a perfect maze is always solvable');
      await page.selectOption('#layout', 'braided');
      await page.locator('#generate').click();
      assert.ok((await status(page)).includes('braided maze'), 'the braided option is announced as braided');
      assert.notEqual(await gridSignature(page), a, 'braiding reopens walls of the same seeded maze');
      assert.ok((await status(page)).includes('loops'));
      await page.selectOption('#layout', 'maze');
      await page.locator('#generate').click();
      assert.ok((await status(page)).includes('exactly one route'), 'the perfect maze is described as loop-free');
      assert.equal(await gridSignature(page), a);
      await page.locator('#new-seed').click();
      assert.notEqual(await page.inputValue('#seed'), '123');
      assert.notEqual(await gridSignature(page), a);
      await page.locator('#seed').fill('1e3');
      await page.locator('#seed').press('Enter');
      assert.equal(await page.inputValue('#seed'), '1000', 'the field shows the integer that was used');
      assert.ok((await status(page)).includes('seed 1,000'));
    } finally {
      await close();
    }
  });

  it('rejects an invalid seed without changing the grid', async () => {
    const { page, close } = await open(LAB);
    try {
      const before = await gridSignature(page);
      await page.locator('#seed').fill('');
      await page.locator('#generate').click();
      assert.ok((await status(page)).includes('whole-number seed'));
      assert.equal(await gridSignature(page), before);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'seed');
    } finally {
      await close();
    }
  });

  it('resizes the grid and keeps every control working at the largest size', async () => {
    const { page, close } = await open(LAB);
    try {
      await page.selectOption('#size', '61x37');
      assert.equal(await count(page, '#grid [role="gridcell"]'), 61 * 37);
      assert.equal(await page.getAttribute('#grid', 'aria-label'), 'Pathfinding grid, 61 columns by 37 rows');
      await page.locator('#animate').uncheck();
      await page.selectOption('#layout', 'field');
      await page.locator('#generate').click();
      const started = Date.now();
      await page.locator('#run').click();
      assert.ok(['Path found', 'No route'].includes(await stat(page, 'stat-outcome')));
      assert.ok(Date.now() - started < 5000, 'an instant run on the largest grid completes promptly');
      await page.selectOption('#size', '21x13');
      assert.equal(await count(page, '#grid [role="gridcell"]'), 273);
      assert.ok((await status(page)).includes('21 × 13'));
    } finally {
      await close();
    }
  });
});

describe('lab: mobile usability', () => {
  it('fits a 375px viewport, paints with touch, and keeps touch targets large enough', async () => {
    const { page, context, problems, close } = await open(LAB, { viewport: VIEWPORTS.mobile, hasTouch: true });
    try {
      assert.equal(await page.getAttribute('#grid', 'aria-colcount'), '21', 'compact default size on small screens');
      const grid = await page.locator('#grid').boundingBox();
      assert.ok(grid.x >= 0 && grid.x + grid.width <= 375, 'grid fits the viewport width');
      assert.equal(await page.locator('#grid').evaluate((el) => getComputedStyle(el).touchAction), 'pinch-zoom');
      await page.locator('#reset').click();
      await page.locator('#grid').scrollIntoViewIfNeeded();
      const box = await cell(page, 2, 2).boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      assert.ok(await cell(page, 2, 2).evaluate((el) => el.classList.contains('is-wall')), 'a tap paints a wall');
      const small = await page.$$eval('.lab-actions button, .panel-actions button, .tool span', (els) => els.filter((el) => el.getBoundingClientRect().height < 40).length);
      assert.equal(small, 0, 'all primary controls are at least 40px tall');
      // A one-finger drag paints a row of walls without scrolling the page (touch-action: pinch-zoom).
      const cdp = await context.newCDPSession(page);
      const points = [];
      for (let x = 2; x <= 12; x += 1) {
        const b = await cell(page, x, 1).boundingBox();
        points.push({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
      }
      const scrollBefore = await page.evaluate(() => window.scrollY);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [points[0]] });
      for (const point of points.slice(1)) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await count(page, '#grid .is-wall'), 1 + points.length, 'the drag painted every cell it crossed');
      assert.equal(await page.evaluate(() => window.scrollY), scrollBefore, 'the drag did not scroll the page');
      await page.locator('#animate').uncheck();
      await page.locator('#run').click();
      assert.equal(await stat(page, 'stat-outcome'), 'Path found');
      assert.deepEqual(problems, []);
    } finally {
      await close();
    }
  });
});
