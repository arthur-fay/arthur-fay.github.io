/**
 * WCAG 2.x contrast checks for the security lab's colour tokens, evaluated
 * from the real stylesheets (styles.css design tokens + lab/security-events/lab.css)
 * in both themes.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokensFromBlock, contrast, opaque } from './helpers/css-colour.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const siteCss = readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const labCss = readFileSync(path.join(ROOT, 'lab/security-events/lab.css'), 'utf8');

function themeTokens(theme) {
  const base = { ...tokensFromBlock(siteCss, ':root'), ...tokensFromBlock(labCss, ':root') };
  if (theme === 'light') Object.assign(base, tokensFromBlock(siteCss, 'html[data-theme="light"]'), tokensFromBlock(labCss, 'html[data-theme="light"]'));
  return base;
}

for (const theme of ['dark', 'light']) {
  describe(`security lab ${theme} theme contrast`, () => {
    const t = themeTokens(theme);
    const bg = opaque('var(--bg)', t);
    const surface = opaque('var(--surface)', t, bg);
    const timeline = opaque('var(--tl-bg)', t, bg);
    const expect = (label, fg, over, minimum) => {
      const ratio = contrast(opaque(fg, t, over), over);
      assert.ok(ratio >= minimum, `${theme}: ${label} contrast ${ratio.toFixed(2)} < ${minimum}`);
    };

    it('text tokens meet AA on the page, panel and timeline backgrounds', () => {
      expect('text on bg', 'var(--text)', bg, 4.5);
      expect('text on surface', 'var(--text)', surface, 4.5);
      expect('muted on timeline', 'var(--muted)', timeline, 4.5);
      expect('lab label on surface', 'var(--lab-label)', surface, 4.5);
      expect('benign label text on surface', 'var(--sec-benign)', surface, 4.5);
      expect('suspicious label text on surface', 'var(--sec-suspicious)', surface, 4.5);
      expect('failure-coloured text on surface', 'var(--sec-failure)', surface, 4.5);
      expect('success-coloured text on surface', 'var(--sec-success)', surface, 4.5);
      expect('R3 verdict pill text on surface', 'var(--sec-r3)', surface, 4.5);
    });

    it('timeline marks, alert spans and the cursor stand out from the timeline background at 3:1', () => {
      expect('success mark', 'var(--sec-success)', timeline, 3);
      expect('failure mark', 'var(--sec-failure)', timeline, 3);
      expect('R1 span border', 'var(--sec-r1)', timeline, 3);
      expect('R2 span border', 'var(--sec-r2)', timeline, 3);
      expect('R3 span border', 'var(--sec-r3)', timeline, 3);
      expect('cursor line', 'var(--sec-cursor)', timeline, 3);
      expect('selected span outline', 'var(--sec-selected)', timeline, 3);
      // Successes and failures are also told apart by shape (short versus tall marks, hatched bar segments), never by colour alone.
    });

    it('rule borders on alert buttons and legend digits stay readable on the surface', () => {
      expect('R1 border on bg', 'var(--sec-r1)', bg, 3);
      expect('R2 border on bg', 'var(--sec-r2)', bg, 3);
      expect('R3 border on bg', 'var(--sec-r3)', bg, 3);
      expect('legend digit on R1 swatch', 'var(--text)', opaque('color-mix(in srgb, var(--sec-r1) 25%, transparent)', t, surface), 4.5);
      expect('legend digit on R2 swatch', 'var(--text)', opaque('color-mix(in srgb, var(--sec-r2) 25%, transparent)', t, surface), 4.5);
      expect('legend digit on R3 swatch', 'var(--text)', opaque('color-mix(in srgb, var(--sec-r3) 25%, transparent)', t, surface), 4.5);
    });
  });
}
