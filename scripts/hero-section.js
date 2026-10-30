/**
 * Renders "Fig. 00 — System section": the isometric drawing in the homepage hero.
 * Deterministic and dependency-free, so the markup in index.html can be regenerated
 * (and is checked by tests/unit/hero-section.test.js). Run: node scripts/hero-section.js
 *
 * Geometry: five plates in true isometric projection (30°), 230 × 170 drawing
 * units, 12 units thick, 68 units apart. Each plate has a lit top face, two cut
 * (hatched) side faces, a quarter grid, a drafted outline, a leader and label,
 * and small isometric blocks; the accent blocks line up on a vertical spine that
 * is drawn over each plate it pierces (a hidden-line conduit, as in a section).
 * Colours come from styles.css (design tokens), never from this file.
 */
const PLATES = 5;
const GAP = 68;
const THICKNESS = 12;
const BOTTOM_BACK_Y = 336;
const X = { back: 274, right: 473.2, front: 326, left: 126.8 };
const LABELS = ['DATA', 'MODELS', 'EVALUATION', 'INTERFACE', 'EVIDENCE'];
const NODE = { halfWidth: 20.8, halfHeight: 12, height: 11 };
const SPINE_X = 264.6;
/** Blocks per plate (bottom plate first): [centre x, top vertex y, variant]. Back-most first. */
const NODES = [
  [[207.1, 432.6, ''], [393.2, 444.8, 'cyan'], [264.6, 445.4, 'accent'], [315.6, 485, 'cyan']],
  [[204.9, 342.9, ''], [264.6, 377.4, 'accent'], [371.7, 398.4, '']],
  [[220, 293.8, ''], [392.1, 304.8, 'cyan'], [264.6, 309.4, 'accent']],
  [[195.9, 198.3, ''], [264.6, 241.4, 'accent'], [349.1, 273.2, '']],
  [[279.6, 107.3, ''], [355.6, 171.5, ''], [264.6, 173.4, 'accent'], [316.6, 217, '']],
];

const n = (value) => String(Math.round(value * 10) / 10);
const pt = (x, y) => `${n(x)} ${n(y)}`;
const lerp = (a, b, s) => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s];

function plateCorners(k) {
  const yb = BOTTOM_BACK_Y - GAP * (k - 1);
  return {
    back: [X.back, yb], right: [X.right, yb + 115], front: [X.front, yb + 200], left: [X.left, yb + 85],
  };
}

function plate(k, conduit = '') {
  const { back, right, front, left } = plateCorners(k);
  const t = THICKNESS;
  const delay = `d${(k - 1) * 2}`;
  const top = `M${pt(...back)}L${pt(...right)}L${pt(...front)}L${pt(...left)}Z`;
  const sideLeft = `M${pt(...left)}L${pt(...front)}v${t}L${pt(left[0], left[1] + t)}Z`;
  const sideRight = `M${pt(...front)}L${pt(...right)}v${t}L${pt(front[0], front[1] + t)}Z`;
  const outline = `${top}M${pt(...left)}v${t}L${pt(front[0], front[1] + t)}L${pt(right[0], right[1] + t)}v-${t}M${pt(...front)}v${t}`;
  const grid = [0.75, 0.25, 0.5, 0.5, 0.25, 0.75].map((s, i) => (i % 2 === 0
    ? `M${pt(...lerp(left, back, s))}L${pt(...lerp(front, right, s))}`
    : `M${pt(...lerp(back, right, s))}L${pt(...lerp(left, front, s))}`)).join('');
  const leader = `M${pt(...left)}H24`;
  const label = `<text class="iso-fade ${delay}" x="22" y="${n(left[1] - 7)}"><tspan class="iso-label-accent">0${k}</tspan> <tspan class="iso-label-strong">${LABELS[k - 1]}</tspan></text>`;
  const nodes = NODES[k - 1].map(([cx, topY, variant]) => node(cx, topY, variant, delay)).join('');
  // The bottom plate casts a soft shadow on the sheet: its own outline, offset, with a radial fade.
  const shadow = k === 1
    ? `<path class="iso-shade iso-fade ${delay}" d="M${pt(back[0] + 8, back[1] + 12)}L${pt(right[0] + 8, right[1] + 12)}L${pt(front[0] + 8, front[1] + 12)}L${pt(left[0] + 8, left[1] + 12)}Z" fill="url(#iso-shade)"/>`
    : '';
  return `<g class="depth-${k}" data-depth="${k}"><g class="iso-float">${shadow}`
    + `<path class="iso-side iso-fade ${delay}" d="${sideLeft}" fill="url(#iso-hatch-l)"/>`
    + `<path class="iso-side iso-fade ${delay}" d="${sideRight}" fill="url(#iso-hatch-r)"/>`
    + `<path class="iso-top iso-fade ${delay}" d="${top}"/>`
    + `<path class="iso-grid iso-draw ${delay}" pathLength="1" d="${grid}"/>`
    + `<path class="iso-slab iso-draw ${delay}" pathLength="1" d="${outline}"/>`
    + `<path class="iso-leader iso-draw ${delay}" pathLength="1" d="${leader}"/>`
    + label + conduit + nodes + '</g></g>';
}

function node(cx, topY, variant, delay) {
  const { halfWidth: w, halfHeight: h, height: d } = NODE;
  const classes = `iso-node iso-fade ${delay}${variant ? ` iso-node-${variant}` : ''}`;
  const top = `M${pt(cx, topY)}L${pt(cx + w, topY + h)}L${pt(cx, topY + 2 * h)}L${pt(cx - w, topY + h)}Z`;
  const left = `M${pt(cx - w, topY + h)}L${pt(cx, topY + 2 * h)}v${d}L${pt(cx - w, topY + h + d)}Z`;
  const right = `M${pt(cx, topY + 2 * h)}L${pt(cx + w, topY + h)}v${d}L${pt(cx, topY + 2 * h + d)}Z`;
  return `<g class="${classes}"><path class="iso-node-l" d="${left}"/><path class="iso-node-r" d="${right}"/><path class="iso-node-top" d="${top}"/></g>`;
}

function spine(k) {
  // From the top of the accent block on plate k up into the accent block on plate k + 1. The plates are
  // opaque, so plate k + 1 draws this segment over its own faces (before its blocks): the spine reads as a
  // conduit passing through the plate, and the block above covers the segment's end.
  const from = NODES[k - 1].find((entry) => entry[2] === 'accent');
  const to = NODES[k].find((entry) => entry[2] === 'accent');
  const d = `M${pt(SPINE_X, from[1])}V${n(to[1] + 13)}`;
  const delay = `d${k * 2 - 1}`;
  return `<path class="iso-flow-under iso-fade ${delay}" d="${d}"/><path class="iso-flow ${delay}" d="${d}"/>`
    + `<circle class="iso-packet packet-${k}" cx="${n(SPINE_X)}" cy="${n(from[1])}" r="3.5" aria-hidden="true"/>`;
}

function frame() {
  // Ghosted projection lines at the two visible outer corners tie the stack together
  // (the front corner's line would be entirely covered by the plates).
  const topPlate = plateCorners(PLATES);
  const bottomPlate = plateCorners(1);
  const posts = ['left', 'right'].map((corner) => `M${pt(...topPlate[corner])}V${n(bottomPlate[corner][1] + THICKNESS)}`).join('');
  return `<g class="iso-backdrop"><ellipse class="iso-glow iso-fade d0" cx="300" cy="330" rx="280" ry="240" fill="url(#iso-glow)"/><path class="iso-post iso-fade d0" d="${posts}"/></g>`;
}

function dimensions() {
  const ticks = [];
  for (let k = 1; k <= PLATES; k += 1) {
    const { right } = plateCorners(k);
    ticks.push(`M521 ${n(right[1])}h10M477.2 ${n(right[1])}H520`);
  }
  const labels = [];
  for (let k = 1; k <= PLATES; k += 1) labels.push(`<text class="iso-fade d8" x="536" y="${n(plateCorners(k).right[1] + 4)}">L${k}</text>`);
  const topY = plateCorners(PLATES).right[1];
  const bottomY = plateCorners(1).right[1];
  return `<g class="iso-dims"><path class="iso-dim iso-draw d8" pathLength="1" d="M526 ${n(topY - 10)}V${n(bottomY + 10)}${ticks.join('')}"/>${labels.join('')}<text class="iso-fade d8" x="536" y="${n(topY - 16)}">LAYERS</text></g>`;
}

const DEFS = '<defs>'
  + '<pattern id="iso-hatch-l" patternUnits="userSpaceOnUse" width="6" height="6"><rect class="iso-hatch-bg-l" width="6" height="6"/><path class="iso-hatch-line" d="M-1 1l2-2M-1 7l8-8M5 7l2-2"/></pattern>'
  + '<pattern id="iso-hatch-r" patternUnits="userSpaceOnUse" width="6" height="6"><rect class="iso-hatch-bg-r" width="6" height="6"/><path class="iso-hatch-line" d="M-1 1l2-2M-1 7l8-8M5 7l2-2"/></pattern>'
  + '<radialGradient id="iso-glow"><stop class="iso-glow-a" offset="0"/><stop class="iso-glow-b" offset="1"/></radialGradient>'
  + '<radialGradient id="iso-shade"><stop class="iso-shade-a" offset="0"/><stop class="iso-shade-b" offset="1"/></radialGradient>'
  + '</defs>';

const MARKS = '<g class="iso-marks iso-fade d8"><circle class="iso-mark" cx="34" cy="518" r="12"/><text class="iso-mark-text" x="34" y="521.5" text-anchor="middle">A</text><path class="iso-mark" d="M46 518h26"/><circle class="iso-mark" cx="566" cy="42" r="12"/><text class="iso-mark-text" x="566" y="45.5" text-anchor="middle">A′</text><path class="iso-mark" d="M554 42h-26"/></g>';

export function renderHeroSection() {
  let body = '';
  for (let k = 1; k <= PLATES; k += 1) body += plate(k, k > 1 ? spine(k - 1) : '');
  return '<svg class="iso" viewBox="0 0 600 560" role="img" aria-labelledby="iso-title iso-desc" focusable="false">'
    + '<title id="iso-title">Isometric section drawing of a layered system</title>'
    + '<desc id="iso-desc">Five stacked plates labelled data, models, evaluation, interface and evidence, connected by a vertical flow line. A conceptual drawing, not a live system.</desc>'
    + DEFS + '<g class="iso-camera">' + frame() + '<g class="iso-plates">' + body + '</g>' + dimensions() + MARKS + '</g></svg>';
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.stdout.write(renderHeroSection());
}
