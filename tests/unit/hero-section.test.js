/**
 * Provenance and contrast of "Fig. 00 — System section", the isometric drawing in
 * the homepage hero. The markup in index.html must be exactly what
 * scripts/hero-section.js renders, and the drawing's colour tokens (styles.css)
 * must keep the plates, their edges and the blocks distinguishable in both themes.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHeroSection } from '../../scripts/hero-section.js';
import { tokensFromBlock, contrast, opaque } from './helpers/css-colour.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
const count = (text, pattern) => (text.match(pattern) || []).length;

describe('hero system section drawing', () => {
  const svg = renderHeroSection();

  it('is exactly the generator output, inside the hero figure', () => {
    assert.ok(html.includes(svg), 'index.html must contain the rendered drawing; run: node scripts/hero-section.js');
    assert.equal(count(html, /<svg class="iso"/g), 1);
  });

  it('draws five plates, each with a lit top, two hatched cut faces, a grid, an outline, a leader and a label', () => {
    assert.equal(count(svg, /<g class="depth-\d" data-depth="\d">/g), 5);
    assert.equal(count(svg, /class="iso-top iso-fade/g), 5);
    assert.equal(count(svg, /class="iso-side iso-fade[^"]*" d="[^"]+" fill="url\(#iso-hatch-[lr]\)"/g), 10);
    assert.equal(count(svg, /<pattern id="iso-hatch-[lr]"/g), 2);
    assert.equal(count(svg, /class="iso-grid iso-draw/g), 5);
    assert.equal(count(svg, /class="iso-slab iso-draw/g), 5);
    assert.equal(count(svg, /class="iso-leader iso-draw/g), 5);
    for (const label of ['DATA', 'MODELS', 'EVALUATION', 'INTERFACE', 'EVIDENCE']) assert.ok(svg.includes(`>${label}</tspan>`), label);
    assert.equal(count(svg, /class="iso-shade iso-fade/g), 1, 'the bottom plate casts one shadow');
    assert.equal(count(svg, /class="iso-post iso-fade/g), 1, 'ghosted corner projection lines tie the stack together');
    assert.match(svg, /class="iso-post iso-fade d0" d="M126\.8 149V433M473\.2 179V463"/, 'only the two visible outer corners carry a projection line');
  });

  it('places solid three-faced blocks on the plates and a spine of accent blocks', () => {
    assert.equal(count(svg, /<g class="iso-node iso-fade/g), 17);
    assert.equal(count(svg, /class="iso-node-top"/g), 17);
    assert.equal(count(svg, /class="iso-node-l"/g), 17);
    assert.equal(count(svg, /class="iso-node-r"/g), 17);
    assert.equal(count(svg, /iso-node-accent/g), 5, 'one accent block per plate');
    assert.equal(count(svg, /class="iso-flow d\d"/g), 4, 'four spine segments join the five accent blocks');
    assert.equal(count(svg, /class="iso-flow-under iso-fade/g), 4);
    // Every spine segment is vertical and starts on the accent column.
    for (const [, d] of svg.matchAll(/class="iso-flow d\d" d="([^"]+)"/g)) assert.match(d, /^M264\.6 [\d.]+V[\d.]+$/);
    // Each segment is drawn by the plate it pierces: after that plate's faces and outline, before its blocks.
    const groups = svg.split(/(?=<g class="depth-)/).filter((part) => part.startsWith('<g class="depth-'));
    assert.equal(groups.length, 5);
    groups.forEach((group, index) => {
      const spines = count(group, /class="iso-flow d\d"/g);
      assert.equal(spines, index === 0 ? 0 : 1, `plate ${index + 1} carries ${index === 0 ? 'no' : 'one'} spine segment`);
      if (index > 0) {
        assert.ok(group.indexOf('class="iso-slab') < group.indexOf('class="iso-flow-under') && group.indexOf('class="iso-flow d') < group.indexOf('<g class="iso-node'), 'the segment sits above the faces and below the blocks');
      }
    });
  });

  it('keeps the accessible name, description and the animation hooks the page relies on', () => {
    assert.ok(svg.includes('role="img" aria-labelledby="iso-title iso-desc"'));
    assert.ok(svg.includes('<title id="iso-title">') && svg.includes('<desc id="iso-desc">'));
    for (const [, attrs] of svg.matchAll(/<path class="([^"]*iso-draw[^"]*)"/g)) assert.ok(attrs, 'draw-in paths exist');
    assert.equal(count(svg, /class="[^"]*iso-draw[^"]*" pathLength="1"/g), count(svg, /iso-draw/g), 'every draw-in path declares pathLength="1"');
    assert.ok(svg.includes('class="iso-dims"') && svg.includes('class="iso-marks iso-fade d8"'));
    assert.ok(!/ style=/.test(svg) && !/<script/.test(svg), 'no inline styles or scripts (strict CSP)');
  });
});

for (const theme of ['dark', 'light']) {
  describe(`${theme} theme: hero drawing contrast`, () => {
    const t = { ...tokensFromBlock(css, ':root') };
    if (theme === 'light') Object.assign(t, tokensFromBlock(css, 'html[data-theme="light"]'));
    const bg = opaque('var(--bg)', t);
    const sheet = opaque('color-mix(in srgb,var(--surface) 90%,transparent)', t, bg); // .hero-figure background
    const plate = opaque('var(--plate)', t, sheet);
    const plateHi = opaque('var(--plate-hi)', t, sheet);
    const expect = (label, fg, over, minimum) => {
      const ratio = contrast(opaque(fg, t, over), over);
      assert.ok(ratio >= minimum, `${theme}: ${label} contrast ${ratio.toFixed(2)} < ${minimum}`);
    };

    it('plate outlines and the grid colour stand out from every plate tone and from the sheet (3:1, non-text)', () => {
      expect('plate edge on the bottom plate', 'var(--plate-edge)', plate, 3);
      expect('plate edge on the top plate', 'var(--plate-edge)', plateHi, 3);
      expect('plate edge on the sheet', 'var(--plate-edge)', sheet, 3);
    });

    it('plates read as surfaces: the stack brightens towards the top and lifts off the sheet', () => {
      assert.ok(contrast(plateHi, plate) >= 1.2, `${theme}: top vs bottom plate ${contrast(plateHi, plate).toFixed(2)}`);
      assert.ok(contrast(plate, sheet) >= 1.15, `${theme}: bottom plate vs sheet ${contrast(plate, sheet).toFixed(2)}`);
      assert.ok(contrast(plateHi, sheet) >= 1.2, `${theme}: top plate vs sheet ${contrast(plateHi, sheet).toFixed(2)}`);
    });

    it('blocks, the spine and the stores are legible on the plates', () => {
      expect('block outline on its top face', 'var(--text)', opaque('var(--node-top)', t, plate), 4.5);
      expect('accent (spine) on the bottom plate', 'var(--accent)', plate, 3);
      expect('accent (spine) on the top plate', 'var(--accent)', plateHi, 3);
      expect('cyan (stores) on the bottom plate', 'var(--cyan)', plate, 3);
      expect('cyan (stores) on the top plate', 'var(--cyan)', plateHi, 3);
      const nodeTop = opaque('var(--node-top)', t, plate);
      const nodeSide = opaque('var(--node-l)', t, plate);
      assert.ok(contrast(nodeTop, nodeSide) >= 1.2, `${theme}: block top vs side ${contrast(nodeTop, nodeSide).toFixed(2)}`);
    });

    it('labels, dimensions and the legend meet AA on the sheet', () => {
      expect('label text', 'var(--text)', sheet, 4.5);
      expect('secondary label text', 'var(--muted)', sheet, 4.5);
      expect('accent numerals and dimension labels', 'var(--accent)', sheet, 4.5);
      expect('caption text', 'var(--fine)', sheet, 4.5);
    });
  });
}
