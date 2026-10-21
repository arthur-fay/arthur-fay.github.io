/**
 * Shared colour arithmetic for the contrast tests: reads design tokens from
 * the real stylesheets and resolves hex, rgb()/rgba(), var() and
 * color-mix(in srgb, A P%, B) expressions to sRGB, then computes WCAG 2.x
 * contrast ratios. Used by tests/unit/contrast.test.js (pathfinding lab) and
 * tests/unit/security-contrast.test.js (security lab).
 */
import assert from 'node:assert/strict';

export function tokensFromBlock(css, selector) {
  const start = css.indexOf(`${selector}{`);
  assert.ok(start >= 0, `block ${selector} not found`);
  const end = css.indexOf('}', start);
  const body = css.slice(start + selector.length + 1, end);
  const tokens = {};
  for (const match of body.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+)/gi)) tokens[`--${match[1]}`] = match[2].trim();
  return tokens;
}

/** Resolves a CSS colour expression to [r, g, b, a] in sRGB. */
export function resolve(expression, tokens, depth = 0) {
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

export function composite(fg, bg) {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
}

export function luminance([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(fg, bg) {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export function opaque(expression, tokens, over) {
  const colour = resolve(expression, tokens);
  return colour[3] >= 1 ? colour.slice(0, 3) : composite(colour, over);
}
