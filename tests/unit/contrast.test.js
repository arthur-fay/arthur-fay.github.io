/**
 * WCAG 2.x contrast checks for the lab's colour tokens, evaluated from the real
 * stylesheets (styles.css design tokens + lab.css cell tokens) in both themes.
 * Supports hex colours, rgb()/rgba(), var() references and
 * color-mix(in srgb, A P%, B) as used by the stylesheets.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const siteCss = readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const labCss = readFileSync(path.join(ROOT, 'lab/pathfinding/lab.css'), 'utf8');

function tokensFromBlock(css, selector) {
  const start = css.indexOf(`${selector}{`);
  assert.ok(start >= 0, `block ${selector} not found`);
  const end = css.indexOf('}', start);
  const body = css.slice(start + selector.length + 1, end);
  const tokens = {};
  for (const match of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+)/gi)) tokens[`--${match[1]}`] = match[2].trim();
  return tokens;
}

function themeTokens(theme) {
  const base = { ...tokensFromBlock(siteCss, ':root'), ...tokensFromBlock(labCss, ':root') };
  if (theme === 'light') Object.assign(base, tokensFromBlock(siteCss, 'html[data-theme="light"]'), tokensFromBlock(labCss, 'html[data-theme="light"]'));
  return base;
}

/** Resolves a CSS colour expression to [r, g, b, a] in sRGB. */
function resolve(expression, tokens, depth = 0) {
  assert.ok(depth < 20, 'token recursion too deep');
  const value = expression.trim();
  const varMatch = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (varMatch) {
    assert.ok(tokens[varMatch[1]] !== undefined, `undefined token ${varMatch[1]}`);
    return resolve(tokens[varMatch[1]], tokens, depth + 1);
  }
  if (value === 'transparent') return [0, 0, 0, 0];
  const hex = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
    const parts = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    const alpha = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return [...parts, alpha];
  }
  const rgb = value.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(',').map((p) => parseFloat(p));
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }
  const mix = value.match(/^color-mix\(in srgb,\s*(.+?)\s+(\d+(?:\.\d+)?)%\s*,\s*(.+)\)$/i);
  if (mix) {
    const a = resolve(mix[1], tokens, depth + 1);
    const pa = Number(mix[2]) / 100;
    const b = resolve(mix[3], tokens, depth + 1);
    // CSS color-mix with alpha: premultiplied interpolation.
    const alpha = a[3] * pa + b[3] * (1 - pa);
    if (alpha === 0) return [0, 0, 0, 0];
    const channel = (i) => (a[i] * a[3] * pa + b[i] * b[3] * (1 - pa)) / alpha;
    return [channel(0), channel(1), channel(2), alpha];
  }
  throw new Error(`unsupported colour expression: ${value}`);
}

function composite(fg, bg) {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
}

function luminance([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function opaque(expression, tokens, over) {
  const colour = resolve(expression, tokens);
  return colour[3] >= 1 ? colour.slice(0, 3) : composite(colour, over);
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
