/**
 * WCAG 2.x contrast checks for the analytics lab's colour tokens, evaluated
 * from the real stylesheets (styles.css design tokens + lab/ecommerce/lab.css)
 * in both themes: text on every background, chart marks against the chart
 * surface, the inks printed inside filled segments, adjacent stacked
 * segments, provenance badges and the data-model diagram.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokensFromBlock, contrast, opaque } from './helpers/css-colour.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const siteCss = readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const labCss = readFileSync(path.join(ROOT, 'lab/ecommerce/lab.css'), 'utf8');

function themeTokens(theme) {
  const base = { ...tokensFromBlock(siteCss, ':root'), ...tokensFromBlock(labCss, ':root') };
  if (theme === 'light') Object.assign(base, tokensFromBlock(siteCss, 'html[data-theme="light"]'), tokensFromBlock(labCss, 'html[data-theme="light"]'));
  return base;
}

for (const theme of ['dark', 'light']) {
  describe(`analytics lab ${theme} theme contrast`, () => {
    const t = themeTokens(theme);
    const bg = opaque('var(--bg)', t);
    const bg2 = opaque('var(--bg2)', t, bg);
    const surface = opaque('var(--surface)', t, bg);
    const expect = (label, fg, over, minimum) => {
      const ratio = contrast(opaque(fg, t, over), over);
      assert.ok(ratio >= minimum, `${theme}: ${label} contrast ${ratio.toFixed(2)} < ${minimum}`);
    };

    it('text tokens meet AA on the page, the alternate band and the cards', () => {
      for (const [name, over] of [['bg', bg], ['bg2', bg2], ['surface', surface]]) {
        expect(`text on ${name}`, 'var(--text)', over, 4.5);
        expect(`muted on ${name}`, 'var(--muted)', over, 4.5);
        expect(`fine on ${name}`, 'var(--fine)', over, 4.5);
        expect(`lab label on ${name}`, 'var(--lab-label)', over, 4.5);
        expect(`accent (links, summaries) on ${name}`, 'var(--accent)', over, 4.5);
      }
    });

    it('chart marks reach 3:1 against the chart surface and the page background', () => {
      for (const token of ['--eco-pub', '--eco-hypo', '--eco-late', '--eco-none', '--eco-rest']) {
        expect(`${token} on surface`, `var(${token})`, surface, 3);
        expect(`${token} on bg`, `var(${token})`, bg, 3);
      }
      // The hatch over hypothetical marks is drawn in the surface colour, so it is as visible as the mark itself.
      expect('surface hatch on the hypothetical fill', 'var(--surface)', opaque('var(--eco-hypo)', t, surface), 3);
    });

    it('inks printed inside filled segments meet AA on their fills', () => {
      expect('ink on the on-time segment', 'var(--eco-ink-pub)', opaque('var(--eco-pub)', t, surface), 4.5);
      expect('ink on the late segment', 'var(--eco-ink-late)', opaque('var(--eco-late)', t, surface), 4.5);
      expect('ink on the not-delivered segment', 'var(--eco-ink-none)', opaque('var(--eco-none)', t, surface), 4.5);
    });

    it('adjacent stacked segments and the two series differ in luminance as well as in hue, gap and hatching', () => {
      const pub = opaque('var(--eco-pub)', t, surface);
      const late = opaque('var(--eco-late)', t, surface);
      const none = opaque('var(--eco-none)', t, surface);
      const hypo = opaque('var(--eco-hypo)', t, surface);
      const rest = opaque('var(--eco-rest)', t, surface);
      assert.ok(contrast(pub, late) >= 1.4, `${theme}: on-time vs late ${contrast(pub, late).toFixed(2)}`);
      assert.ok(contrast(late, none) >= 1.4, `${theme}: late vs not delivered ${contrast(late, none).toFixed(2)}`);
      // Documented versus exported-only bars differ mainly in chroma (teal versus neutral grey), plus bold labels and the legend.
      assert.ok(contrast(pub, rest) >= 1.1, `${theme}: documented vs exported-only bars ${contrast(pub, rest).toFixed(2)}`);
      // Published and hypothetical are told apart by hue (cool versus warm), by hatching and by wording, not by luminance:
      // the data-visualization validator run in the review found their CVD separation at ΔE 17–18 (target 8) in both themes.
      assert.ok(contrast(pub, hypo) >= 1 && contrast(pub, hypo) < 2, `${theme}: the two series sit in the same lightness band (${contrast(pub, hypo).toFixed(2)})`);
    });

    it('provenance badges, buttons and the data-model diagram stay visible', () => {
      expect('published badge border on surface', 'var(--eco-pub)', surface, 3);
      expect('hypothetical badge border on surface', 'var(--eco-hypo)', surface, 3);
      expect('fact table edge on surface', 'var(--eco-fact)', surface, 3);
      expect('dimension table edge on surface', 'var(--eco-dim)', surface, 3);
      expect('measure table edge on surface', 'var(--eco-measure)', surface, 3);
      expect('filter path lines on the diagram background', 'var(--eco-link)', bg2, 3);
      expect('measure-reads dashes on the diagram background', 'var(--eco-measure)', bg2, 3);
      expect('primary button text', 'var(--on-accent)', opaque('var(--accent)', t, bg), 4.5);
      expect('table-button name on surface2', 'var(--text)', opaque('var(--surface2)', t, bg), 4.5);
    });

    it('the chart axis and gridlines are recessive but present', () => {
      const axis = contrast(opaque('var(--chart-axis)', t, surface), surface);
      const grid = contrast(opaque('var(--chart-grid)', t, surface), surface);
      assert.ok(axis >= 1.4 && axis <= 3.5, `${theme}: axis ${axis.toFixed(2)}`);
      assert.ok(grid >= 1.08 && grid <= axis, `${theme}: grid ${grid.toFixed(2)}`);
    });
  });
}
