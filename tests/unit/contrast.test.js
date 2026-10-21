/**
 * WCAG 2.x contrast checks for the pathfinding lab's colour tokens, evaluated
 * from the real stylesheets (styles.css design tokens + lab.css cell tokens) in
 * both themes. The colour arithmetic lives in ./helpers/css-colour.js.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokensFromBlock, contrast, opaque } from './helpers/css-colour.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const siteCss = readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const labCss = readFileSync(path.join(ROOT, 'lab/pathfinding/lab.css'), 'utf8');

function themeTokens(theme) {
  const base = { ...tokensFromBlock(siteCss, ':root'), ...tokensFromBlock(labCss, ':root') };
  if (theme === 'light') Object.assign(base, tokensFromBlock(siteCss, 'html[data-theme="light"]'), tokensFromBlock(labCss, 'html[data-theme="light"]'));
  return base;
}

for (const theme of ['dark', 'light']) {
  describe(`${theme} theme contrast`, () => {
    const t = themeTokens(theme);
    const bg = opaque('var(--bg)', t);
    const surface = opaque('var(--surface)', t, bg);
    const open = opaque('var(--cell-open)', t, bg);
    const expectText = (label, fg, over, minimum = 4.5) => {
      const ratio = contrast(opaque(fg, t, over), over);
      assert.ok(ratio >= minimum, `${theme}: ${label} contrast ${ratio.toFixed(2)} < ${minimum}`);
    };
    const expectGraphic = (label, fg, over, minimum = 3) => {
      const ratio = contrast(opaque(fg, t, over), over);
      assert.ok(ratio >= minimum, `${theme}: ${label} contrast ${ratio.toFixed(2)} < ${minimum}`);
    };

    it('body, secondary and accent text meet AA on the page and panel backgrounds', () => {
      expectText('text on bg', 'var(--text)', bg);
      expectText('text on surface', 'var(--text)', surface);
      expectText('muted on bg', 'var(--muted)', bg);
      expectText('muted on surface', 'var(--muted)', surface);
      expectText('accent text on bg', 'var(--accent)', bg);
      expectText('accent text on surface', 'var(--accent)', surface);
      expectText('lab label colour on surface', 'var(--lab-label)', surface);
      expectText('lab label colour on bg', 'var(--lab-label)', bg);
    });

    it('glyphs on the start, target and path cells are readable', () => {
      const start = opaque('var(--cell-start)', t, open);
      const target = opaque('var(--cell-target)', t, open);
      const pathCell = opaque('var(--cell-path)', t, open);
      expectText('S glyph on start cell', 'var(--cell-start-ink)', start);
      expectText('T glyph on target cell', 'var(--cell-target-ink)', target);
      expectGraphic('path dot on path cell', 'var(--cell-path-dot)', pathCell);
      const primaryButtonText = theme === 'light' ? '#ffffff' : 'var(--bg)';
      expectText('primary button text', primaryButtonText, opaque('var(--accent)', t, bg));
    });

    it('cell states are distinguishable from open cells at 3:1 (non-text contrast)', () => {
      expectGraphic('wall vs open', 'var(--cell-wall)', open);
      expectGraphic('terrain vs open', 'var(--cell-terrain)', open);
      expectGraphic('terrain hatch vs open', 'var(--cell-terrain-hatch)', open);
      expectGraphic('expanded vs open', 'var(--cell-visited)', open);
      expectGraphic('path vs open', 'var(--cell-path)', open);
      expectGraphic('start vs open', 'var(--cell-start)', open);
      expectGraphic('target vs open', 'var(--cell-target)', open);
      const frontierFill = opaque('var(--cell-frontier)', t, open);
      const frontierOutline = opaque('var(--cell-frontier-outline)', t, frontierFill);
      const outlineRatio = contrast(frontierOutline, open);
      assert.ok(outlineRatio >= 3, `${theme}: frontier outline vs open contrast ${outlineRatio.toFixed(2)} < 3`);
    });

    it('the final path stands out from expanded cells and the focus ring from every cell state', () => {
      const visited = opaque('var(--cell-visited)', t, open);
      expectGraphic('path vs expanded', 'var(--cell-path)', visited);
      // The focus ring is two-tone (outer --cell-focus-a, inner --cell-focus-b) so that at least one tone is visible on every cell state.
      for (const token of ['--cell-open', '--cell-wall', '--cell-visited', '--cell-frontier', '--cell-path', '--cell-terrain', '--cell-start', '--cell-target']) {
        const cell = opaque(`var(${token})`, t, open);
        const best = Math.max(contrast(opaque('var(--cell-focus-a)', t, cell), cell), contrast(opaque('var(--cell-focus-b)', t, cell), cell));
        assert.ok(best >= 3, `${theme}: focus ring on ${token} contrast ${best.toFixed(2)} < 3`);
      }
    });
  });
}
