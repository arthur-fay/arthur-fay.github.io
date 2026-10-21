/**
 * E-Commerce Executive Analytics Lab — UI module.
 *
 * Owns the DOM only. Every figure comes from ./model.js: the published and
 * exported transcriptions, the derived arithmetic and the hypothetical
 * scenario calculations. The module renders the dashboard charts as SVG,
 * keeps the four simulator levers as state and recalculates on every change,
 * and builds the data-model explorer from the documented tables. Every piece
 * of text is written with textContent or text nodes.
 */
import * as M from './model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const byId = (id) => document.getElementById(id);
const LEVER_IDS = Object.freeze({ volumePct: 'volume', basketPct: 'basket', deliveryPoints: 'delivery', onTimePoints: 'ontime' });
const GROUP_LABEL = Object.freeze({ fact: 'Fact', dimension: 'Dimension', measure: 'Measure table' });
const GROUP_NOUN = Object.freeze({ fact: 'fact table', dimension: 'dimension table', measure: 'measure table' });
const COLUMN_OF = Object.freeze({ dim_date: 'left', dim_customer: 'left', dim_product: 'left', dim_seller: 'right', dim_payment_method: 'right', dim_order_status: 'right', fact_orders: 'center', fact_order_items: 'center', fact_cohort_retention: 'center', KPI_Measures: 'center' });
const WIDE_DIAGRAM = window.matchMedia ? window.matchMedia('(min-width: 781px)') : { matches: true };

const dom = {
  category: { chart: byId('category-chart'), caption: byId('category-caption'), rows: byId('category-rows') },
  topTen: { chart: byId('top-ten-chart'), caption: byId('top-ten-caption'), rows: byId('top-ten-rows') },
  status: { chart: byId('status-chart'), caption: byId('status-caption'), rows: byId('status-rows') },
  outcome: { chart: byId('outcome-chart'), caption: byId('outcome-caption'), rows: byId('outcome-rows') },
  scenario: { chart: byId('scenario-chart'), caption: byId('scenario-caption'), rows: byId('scenario-rows') },
  scenarioOutcomes: { chart: byId('scenario-outcomes'), caption: byId('scenario-outcomes-caption'), rows: byId('scenario-outcome-rows') },
  outputs: {
    revenue: byId('out-revenue'), revenueChange: byId('out-revenue-change'), orders: byId('out-orders'), aov: byId('out-aov'),
    delivery: byId('out-delivery'), onTime: byId('out-ontime'), onTimeAll: byId('out-ontime-all'), missed: byId('out-missed'),
  },
  simStatus: byId('sim-status'),
  resetScenario: byId('reset-scenario'),
  presets: [...document.querySelectorAll('.preset-button')],
  levers: Object.fromEntries(Object.entries(LEVER_IDS).map(([key, id]) => [key, { range: byId(`${id}-range`), number: byId(`${id}-value`) }])),
  modelDiagram: byId('model-diagram'),
  modelLines: byId('model-lines'),
  modelCols: { left: byId('model-col-left'), center: byId('model-col-center'), right: byId('model-col-right') },
  tableDetail: byId('table-detail'),
  tableDetailHeading: byId('table-detail-heading'),
  tableDetailBody: byId('table-detail-body'),
};

/* ------------------------------------------------------------------ helpers */

/** Element factory: attributes are set verbatim, text is always a text node. */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) if (child !== null && child !== undefined) node.append(child);
  return node;
}

function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

function clear(node) {
  node.textContent = '';
}

function setStat(element, value, note) {
  clear(element);
  element.append(document.createTextNode(value));
  if (note) element.append(el('small', { text: note }));
}

function cell(text, { num = false, head = false } = {}) {
  return el(head ? 'th' : 'td', { class: num ? 'is-num' : undefined, scope: head ? 'row' : undefined, text });
}

function row(cells) {
  return el('tr', {}, cells);
}

const r1 = (value) => Math.round(value * 10) / 10;

/* ------------------------------------------------------------ chart core */

const charts = new Map(); // frame → { render, width }
const tips = new WeakMap(); // frame → tooltip element

function tipOf(frame) {
  let tip = tips.get(frame);
  if (!tip) {
    tip = el('div', { class: 'chart-tip', role: 'status', 'aria-live': 'polite', hidden: true });
    tips.set(frame, tip);
  }
  return tip;
}

function hideTip(frame) {
  const tip = tipOf(frame);
  tip.hidden = true;
}

function showTip(frame, mark) {
  const tip = tipOf(frame);
  clear(tip);
  const [head, ...rest] = String(mark.dataset.tip || '').split('\n');
  tip.append(el('strong', { text: head }));
  for (const line of rest) tip.append(document.createTextNode(line), el('br'));
  tip.hidden = false;
  const frameRect = frame.getBoundingClientRect();
  const markRect = mark.getBoundingClientRect();
  const tipRect = tip.getBoundingClientRect();
  let left = markRect.left - frameRect.left + markRect.width / 2 - tipRect.width / 2;
  left = Math.max(4, Math.min(frameRect.width - tipRect.width - 4, left));
  let top = markRect.top - frameRect.top - tipRect.height - 8;
  if (top < 0) top = markRect.bottom - frameRect.top + 8;
  tip.style.left = `${left.toFixed(1)}px`;
  tip.style.top = `${top.toFixed(1)}px`;
}

/**
 * Mounts a rendered SVG into its frame with the hover layer and keyboard
 * navigation: the chart takes focus as one tab stop, the arrow keys move
 * through the marks and the tooltip (a live region) reads each one.
 */
function mountChart(frame, svg, legend, title) {
  const marks = [...svg.querySelectorAll('.mark')];
  let active = -1;
  const setActive = (index) => {
    active = index;
    marks.forEach((mark, k) => mark.classList.toggle('is-active', k === index));
    if (index >= 0) showTip(frame, marks[index]); else hideTip(frame);
  };
  svg.setAttribute('tabindex', '0');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', `${title}. ${marks.length} marks; use the left and right arrow keys to read each one.`);
  svg.addEventListener('keydown', (event) => {
    if (!marks.length) return;
    let next = active;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (active + 1) % marks.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (active - 1 + marks.length) % marks.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = marks.length - 1;
    else if (event.key === 'Escape') next = -1;
    else return;
    event.preventDefault();
    setActive(next);
  });
  const focusVisible = () => { try { return svg.matches(':focus-visible'); } catch (_) { return true; } };
  svg.addEventListener('focus', () => {
    if (active < 0 && marks.length && focusVisible()) setActive(0);
  });
  svg.addEventListener('blur', () => setActive(-1));
  for (const mark of marks) {
    mark.addEventListener('pointerenter', () => { mark.classList.add('is-hover'); showTip(frame, mark); });
    mark.addEventListener('pointerleave', () => {
      mark.classList.remove('is-hover');
      if (active >= 0) showTip(frame, marks[active]); else hideTip(frame);
    });
  }
  clear(frame);
  frame.append(svg);
  if (legend) frame.append(legend);
  frame.append(tipOf(frame));
  hideTip(frame);
}

function registerChart(frame, render) {
  charts.set(frame, { render, width: -1 });
}

function renderChart(frame, { force = false } = {}) {
  const entry = charts.get(frame);
  if (!entry) return;
  const width = Math.floor(frame.clientWidth);
  if (width <= 0) return;
  if (!force && width === entry.width) return;
  entry.width = width;
  entry.render(width);
}

/** Reads every frame's width first, then renders, so a pass never alternates layout reads and writes. */
function renderAllCharts({ force = false } = {}) {
  const widths = [...charts].map(([frame, entry]) => [frame, entry, Math.floor(frame.clientWidth)]);
  for (const [frame, entry, width] of widths) {
    if (width <= 0) continue;
    if (!force && width === entry.width) continue;
    entry.width = width;
    entry.render(width);
  }
}

let resizeQueued = false;
function queueResize() {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => {
    resizeQueued = false;
    renderAllCharts();
    drawConnectors();
  });
}

/** A hatch pattern in the surface colour, laid over hypothetical marks. */
function hatchPattern(id) {
  return svgEl('pattern', { id, patternUnits: 'userSpaceOnUse', width: 6, height: 6, patternTransform: 'rotate(45)' }, [
    svgEl('path', { class: 'hatch-line', d: 'M0 0V6' }),
  ]);
}

/** A bar growing to the right with a 4px rounded data end and a square baseline. */
function barRight(x, y, w, h) {
  const r = Math.min(4, w / 2, h / 2);
  if (w <= 0) return `M${x} ${y}h0v${h}h0Z`;
  return `M${x} ${y}h${(w - r).toFixed(2)}a${r} ${r} 0 0 1 ${r} ${r}v${(h - 2 * r).toFixed(2)}a${r} ${r} 0 0 1 -${r} ${r}H${x}Z`;
}

/** A column growing upwards with a rounded cap and a square baseline. */
function barUp(x, yTop, w, h) {
  const r = Math.min(4, w / 2, h / 2);
  const base = yTop + h;
  if (h <= 0) return `M${x} ${base}h${w}v0h-${w}Z`;
  return `M${x} ${base}V${(yTop + r).toFixed(2)}a${r} ${r} 0 0 1 ${r} -${r}h${(w - 2 * r).toFixed(2)}a${r} ${r} 0 0 1 ${r} ${r}V${base}Z`;
}

function legendList(items) {
  const list = el('ul', { class: 'chart-legend', 'aria-label': 'Legend' });
  for (const item of items) {
    list.append(el('li', {}, [el('span', { class: `swatch ${item.swatch}`, 'aria-hidden': 'true' }), el('span', {}, [el('strong', { text: item.label }), document.createTextNode(item.note ? ` ${item.note}` : '')])]));
  }
  return list;
}

/** A mark group: the painted shape, an outline for the hover/active state and an enlarged transparent hit area. */
function mark(shape, hit, tip, outline) {
  const group = svgEl('g', { class: 'mark', 'data-tip': tip });
  group.append(shape);
  if (outline) group.append(outline);
  group.append(hit);
  return group;
}

/**
 * Horizontal bars, one series or two: rows carry a label, a value, a display
 * string, a kind (pub, rest, hypo) and a tooltip. Values are labelled at the
 * tip of every bar because the lists are short and the values are the point.
 */
function horizontalBars(frame, width, { rows, max, labelWidth, title, legend, hatchId, barHeight = 20, rowGap = 14, valueWidth = 96, groupGap = 0 }) {
  const left = Math.min(labelWidth, Math.max(80, width * 0.34));
  const right = Math.min(valueWidth, Math.max(64, width * 0.22));
  const plot = Math.max(40, width - left - right - 6);
  const top = 6;
  let y = top;
  const svg = svgEl('svg', { xmlns: SVG_NS });
  const defs = svgEl('defs');
  if (hatchId) defs.append(hatchPattern(hatchId));
  svg.append(defs);
  const body = svgEl('g');
  svg.append(body);
  rows.forEach((item, index) => {
    if (index > 0 && item.groupStart) y += groupGap;
    const w = Math.max(0, (item.value / max) * plot);
    const x0 = left;
    if (item.label !== undefined) {
      body.append(svgEl('text', { x: x0 - 10, y: y + barHeight / 2, 'text-anchor': 'end', 'dominant-baseline': 'middle', class: item.labelClass || 'label-strong', text: item.label }));
    }
    if (item.sublabel) {
      body.append(svgEl('text', { x: x0 - 10, y: y + barHeight / 2 + 13, 'text-anchor': 'end', 'dominant-baseline': 'middle', class: 'label-mono', text: item.sublabel }));
    }
    const shape = svgEl('path', { class: `bar bar-${item.kind}`, d: barRight(x0, y, w, barHeight) });
    const hatch = item.kind === 'hypo' && hatchId ? svgEl('path', { d: barRight(x0, y, w, barHeight), fill: `url(#${hatchId})` }) : null;
    const outline = svgEl('path', { class: 'outline', d: barRight(x0, y, w, barHeight) });
    const hit = svgEl('rect', { class: 'hit', x: x0 - 2, y: y - 4, width: plot + 4, height: barHeight + 8 });
    const group = mark(shape, hit, item.tip, outline);
    if (hatch) group.insertBefore(hatch, outline);
    body.append(group);
    body.append(svgEl('text', { x: x0 + w + 8, y: y + barHeight / 2, 'dominant-baseline': 'middle', class: 'label-value', text: item.display }));
    y += barHeight + rowGap;
  });
  const height = y - rowGap + 6;
  body.insertBefore(svgEl('line', { class: 'axis', x1: left, x2: left, y1: top - 2, y2: height - 4 }), body.firstChild);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  mountChart(frame, svg, legend ? legendList(legend) : null, title);
}

/** A 100% stacked horizontal bar per row, segments separated by a 2px surface gap. */
function stackedRows(frame, width, { rows, segments, title, legend, hatchId, barHeight = 26, rowGap = 22, labelWidth = 150 }) {
  const left = rows.some((item) => item.label) ? Math.min(labelWidth, Math.max(72, width * 0.3)) : 0;
  const plot = Math.max(60, width - left - 4);
  const svg = svgEl('svg', { xmlns: SVG_NS });
  const defs = svgEl('defs');
  if (hatchId) defs.append(hatchPattern(hatchId));
  svg.append(defs);
  let y = 6;
  rows.forEach((item) => {
    if (item.label) {
      svg.append(svgEl('text', { x: left - 10, y: y + barHeight / 2, 'text-anchor': 'end', 'dominant-baseline': 'middle', class: 'label-strong', text: item.label }));
      if (item.sublabel) svg.append(svgEl('text', { x: left - 10, y: y + barHeight / 2 + 13, 'text-anchor': 'end', 'dominant-baseline': 'middle', class: 'label-mono', text: item.sublabel }));
    }
    let x = left;
    const total = item.values.reduce((sum, value) => sum + value, 0);
    item.values.forEach((value, index) => {
      const segment = segments[index];
      const w = Math.max(0, (value / total) * plot - (index < item.values.length - 1 ? 2 : 0));
      const shape = svgEl('rect', { class: `bar bar-${segment.kind}`, x, y, width: w, height: barHeight });
      const outline = svgEl('rect', { class: 'outline', x, y, width: w, height: barHeight });
      const hit = svgEl('rect', { class: 'hit', x: x - 1, y: y - 4, width: w + 2, height: barHeight + 8 });
      const group = mark(shape, hit, item.tips[index], outline);
      if (item.hatched && hatchId) group.insertBefore(svgEl('rect', { x, y, width: w, height: barHeight, fill: `url(#${hatchId})` }), outline);
      svg.append(group);
      const label = item.displays[index];
      const needed = label.length * 6.6 + 14;
      if (w >= needed) {
        svg.append(svgEl('text', { x: x + w / 2, y: y + barHeight / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: `label-inside on-${segment.kind}`, text: label }));
      }
      x += w + 2;
    });
    y += barHeight + rowGap;
  });
  const height = y - rowGap + 6;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  mountChart(frame, svg, legendList(legend), title);
}

/* ------------------------------------------------------- dashboard charts */

function renderCategoryChart(width) {
  const [first, second] = M.PUBLISHED.categories;
  const shares = M.DERIVED.categoryShares;
  const rows = M.PUBLISHED.categories.map((category, index) => ({
    label: category.name,
    sublabel: `${M.formatPercent(shares[index].sharePct, 1)} of revenue · derived`,
    value: category.revenueBRL,
    display: M.formatMillionsBRL(category.revenueBRL),
    kind: 'pub',
    tip: `${category.name}\n${M.formatMillionsBRL(category.revenueBRL)} published (README: approximately)\n${M.formatPercent(shares[index].sharePct, 2)} of total revenue, derived\nRank ${category.rank} of the exported top 10`,
  }));
  horizontalBars(dom.category.chart, width, { rows, max: first.revenueBRL * 1.12, labelWidth: 150, barHeight: 22, rowGap: 26, title: 'Two documented leading categories, revenue in R$ millions', legend: [{ swatch: 'swatch-pub', label: 'Published', note: 'README figure' }] });
  clear(dom.category.caption);
  dom.category.caption.append(
    el('strong', { text: `${first.name} leads ${second.name} by ${M.formatMillionsBRL(M.DERIVED.categoryGapBRL)} (${M.formatSignedPercent(M.DERIVED.categoryGapPct)}).` }),
    document.createTextNode(` Together they are ${M.formatPercent(shares[0].sharePct + shares[1].sharePct, 1)} of the published R$15.84M. Shares and the gap are derived; the README gives both revenues as approximate.`),
  );
  clear(dom.category.rows);
  M.PUBLISHED.categories.forEach((category, index) => {
    dom.category.rows.append(row([cell(category.name), cell(M.formatMillionsBRL(category.revenueBRL), { num: true }), cell(`${M.formatPercent(shares[index].sharePct, 2)} (derived)`, { num: true }), cell('README, Key Business Insights')]));
  });
}

function renderTopTenChart(width) {
  const rows = M.EXPORTED.topCategories.map((category) => {
    const documented = category.rank <= 2;
    const share = (category.revenueBRL / M.PUBLISHED.revenueBRL) * 100;
    return {
      label: category.label,
      labelClass: documented ? 'label-strong' : undefined,
      value: category.revenueBRL,
      display: M.formatMillionsBRL(category.revenueBRL),
      kind: documented ? 'pub' : 'rest',
      tip: `${category.rank}. ${category.label}${category.truncated ? ' (label truncated in the export)' : ''}\n${M.formatMillionsBRL(category.revenueBRL)} as printed on the exported chart\n${M.formatPercent(share, 2)} of total revenue, derived\n${documented ? 'Also named in the README' : 'Exported chart label only'}`,
    };
  });
  horizontalBars(dom.topTen.chart, width, { rows, max: rows[0].value * 1.12, labelWidth: 132, barHeight: 16, rowGap: 9, title: 'Top 10 product categories by revenue, as exported, in R$ millions', legend: [{ swatch: 'swatch-pub', label: 'Named in the README', note: 'published figures' }, { swatch: 'swatch-rest', label: 'Exported chart labels only' }] });
  clear(dom.topTen.caption);
  dom.topTen.caption.append(
    el('strong', { text: `The ten exported categories sum to ${M.formatMillionsBRL(M.DERIVED.topTenTotalBRL)}, ${M.formatPercent(M.DERIVED.topTenShareOfRevenuePct, 1)} of total revenue (derived).` }),
    document.createTextNode(' Values are printed to R$0.01M in the export; the fifth label is cut off there and is shown as printed. No category beyond these ten is published.'),
  );
  clear(dom.topTen.rows);
  for (const category of M.EXPORTED.topCategories) {
    dom.topTen.rows.append(row([cell(String(category.rank), { num: true }), cell(category.label + (category.truncated ? ' (truncated in the export)' : '')), cell(M.formatMillionsBRL(category.revenueBRL), { num: true }), cell(`${M.formatPercent((category.revenueBRL / M.PUBLISHED.revenueBRL) * 100, 2)} (derived)`, { num: true }), cell(category.rank <= 2 ? 'README and exported chart' : 'Exported chart data label')]));
  }
}

function renderStatusChart(width) {
  const counts = M.EXPORTED.statusCounts;
  const shares = M.DERIVED.statusShares;
  const max = 100_000;
  const left = 54;
  const right = 10;
  const top = 18;
  const plotHeight = 170;
  const bottom = 44;
  const plot = Math.max(80, width - left - right);
  const svg = svgEl('svg', { xmlns: SVG_NS });
  for (const tick of [0, 25_000, 50_000, 75_000, 100_000]) {
    const y = top + plotHeight - (tick / max) * plotHeight;
    svg.append(svgEl('line', { class: tick === 0 ? 'axis' : 'grid-line', x1: left, x2: left + plot, y1: y, y2: y }));
    svg.append(svgEl('text', { x: left - 8, y, 'text-anchor': 'end', 'dominant-baseline': 'middle', class: 'label-mono', text: tick === 0 ? '0' : `${tick / 1000}K` }));
  }
  const slot = plot / counts.length;
  const barWidth = Math.min(24, slot * 0.5);
  counts.forEach((item, index) => {
    const x = left + slot * index + slot / 2 - barWidth / 2;
    const h = (item.orders / max) * plotHeight;
    const yTop = top + plotHeight - h;
    const shape = svgEl('path', { class: 'bar bar-pub', d: barUp(x, yTop, barWidth, h) });
    const outline = svgEl('path', { class: 'outline', d: barUp(x, yTop, barWidth, h) });
    const hit = svgEl('rect', { class: 'hit', x: left + slot * index, y: top - 10, width: slot, height: plotHeight + 10 });
    svg.append(mark(shape, hit, `${item.label}\n${M.formatInt(item.orders)} orders, printed on the exported chart\n${M.formatPercent(shares[index].sharePct, 2)} of the exported total, derived`, outline));
    svg.append(svgEl('text', { x: x + barWidth / 2, y: yTop - 7, 'text-anchor': 'middle', class: 'label-value', text: M.formatInt(item.orders) }));
    svg.append(svgEl('text', { x: left + slot * index + slot / 2, y: top + plotHeight + 18, 'text-anchor': 'middle', class: 'label-mono', text: item.label }));
    svg.append(svgEl('text', { x: left + slot * index + slot / 2, y: top + plotHeight + 33, 'text-anchor': 'middle', class: 'label-mono', text: M.formatPercent(shares[index].sharePct, 2) }));
  });
  const height = top + plotHeight + bottom;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', width);
  svg.setAttribute('height', height);
  mountChart(dom.status.chart, svg, legendList([{ swatch: 'swatch-pub', label: 'Exported', note: 'data labels of the Orders by Status chart' }]), 'Orders by status group, as exported');
  clear(dom.status.caption);
  dom.status.caption.append(
    el('strong', { text: `Cross-check: 96,478 completed ÷ 99,441 exported orders = ${M.formatPercent(M.DERIVED.completedShareOfStatusTotalPct, 2)}, the published delivery rate.` }),
    document.createTextNode(` The exported total also agrees with the README's 99K and with revenue ÷ average order value (≈ ${M.formatInt(M.DERIVED.impliedOrders)}) within the rounding of R$15.84M.`),
  );
  clear(dom.status.rows);
  counts.forEach((item, index) => {
    dom.status.rows.append(row([cell(item.label), cell(M.formatInt(item.orders), { num: true }), cell(`${M.formatPercent(shares[index].sharePct, 2)} (derived)`, { num: true }), cell('Exported chart data label')]));
  });
  dom.status.rows.append(row([cell('Total (sum)'), cell(M.formatInt(M.DERIVED.statusTotalOrders), { num: true }), cell('100%', { num: true }), cell('Derived: sum of the three labels')]));
}

const OUTCOME_SEGMENTS = Object.freeze([
  { id: 'on-time', label: 'On time', kind: 'pub', swatch: 'swatch-pub' },
  { id: 'late', label: 'Delivered late', kind: 'late', swatch: 'swatch-late' },
  { id: 'not-delivered', label: 'Not delivered', kind: 'none', swatch: 'swatch-none' },
]);

const outcomeValues = (source) => [source.onTimeOfAllPct, source.lateOfAllPct, source.notDeliveredPct];
const outcomeDisplays = (values) => values.map((value) => M.formatPercent(value, 2));

function renderOutcomeChart(width) {
  const values = outcomeValues(M.DERIVED);
  const displays = outcomeDisplays(values);
  const how = ['97.02% × 91.88%', '97.02% − on time', '100% − 97.02%'];
  stackedRows(dom.outcome.chart, width, {
    rows: [{ values, displays, tips: OUTCOME_SEGMENTS.map((segment, index) => `${segment.label}\n${displays[index]} of all orders, derived\n${how[index]}`) }],
    segments: OUTCOME_SEGMENTS,
    title: 'Delivery outcomes as shares of all orders, derived from the published rates',
    legend: OUTCOME_SEGMENTS.map((segment, index) => ({ swatch: segment.swatch, label: segment.label, note: displays[index] })),
    barHeight: 30,
  });
  clear(dom.outcome.caption);
  dom.outcome.caption.append(
    el('strong', { text: `About ${M.formatPercent(100 - M.DERIVED.onTimeOfAllPct, 1)} of all orders were late or never delivered.` }),
    document.createTextNode(' Derived from the two published rates only; the project publishes no order-level delivery data.'),
  );
  clear(dom.outcome.rows);
  OUTCOME_SEGMENTS.forEach((segment, index) => {
    dom.outcome.rows.append(row([cell(segment.label), cell(displays[index], { num: true }), cell(how[index])]));
  });
}

/* --------------------------------------------------------------- simulator */

const sim = {
  changes: { ...M.DEFAULT_CHANGES },
  scenario: M.BASELINE,
};

const leverLabel = (key) => M.INPUTS.find((input) => input.key === key);

function signedDisplay(key, value) {
  const input = leverLabel(key);
  return input.unit === '%' ? M.formatSignedPercent(value, input.decimals) : M.formatPoints(value, input.decimals);
}

function describeChanges(changes) {
  const parts = M.INPUTS.filter((input) => changes[input.key] !== 0).map((input) => `${input.label.toLowerCase()} ${signedDisplay(input.key, changes[input.key])}`);
  return parts.length ? parts.join(', ') : 'no change';
}

function writeLever(key) {
  const { range, number } = dom.levers[key];
  const value = sim.changes[key];
  range.value = String(value);
  number.value = String(value);
  number.removeAttribute('aria-invalid');
  range.setAttribute('aria-valuetext', `${signedDisplay(key, value)}, hypothetical change`);
}

function syncPresets() {
  for (const button of dom.presets) {
    const preset = M.PRESETS.find((candidate) => candidate.id === button.dataset.preset);
    const pressed = Boolean(preset) && Object.keys(M.LIMITS).every((key) => preset.changes[key] === sim.changes[key]);
    button.setAttribute('aria-pressed', String(pressed));
  }
}

function renderOutputs() {
  const s = sim.scenario;
  const o = dom.outputs;
  setStat(o.revenue, M.formatMillionsBRL(s.revenueBRL), s.isBaseline ? 'published baseline, no change' : `hypothetical · published R$15.84M`);
  setStat(o.revenueChange, M.formatSignedMillionsBRL(s.revenueChangeBRL), `${M.formatSignedPercent(s.revenueDeltaPct)} versus published R$15.84M`);
  setStat(o.orders, `≈ ${M.formatCompact(s.orders)}`, `${M.formatSignedInt(s.ordersChange)} versus ≈ ${M.formatCompact(M.DERIVED.impliedOrders)} implied by R$15.84M ÷ R$159.33`);
  setStat(o.aov, M.formatBRL(s.averageOrderBRL), `${M.formatSignedPercent(s.changes.basketPct, 0)} versus published R$159.33`);
  setStat(o.delivery, M.formatPercent(s.deliveredPct), `${M.formatPoints(s.changes.deliveryPoints)} versus published 97.02%`);
  setStat(o.onTime, M.formatPercent(s.onTimeOfDeliveredPct), `${M.formatPoints(s.changes.onTimePoints)} versus published 91.88% of delivered orders`);
  setStat(o.onTimeAll, M.formatPercent(s.onTimeOfAllPct), `${M.formatPoints(s.onTimeOfAllChangePoints)} versus derived ${M.formatPercent(M.DERIVED.onTimeOfAllPct)}`);
  setStat(o.missed, `≈ ${M.formatInt(s.lateOrders + s.undeliveredOrders)}`, `${M.formatPercent(s.lateOfAllPct + s.notDeliveredPct)} of scenario orders: late ≈ ${M.formatInt(s.lateOrders)}, not delivered ≈ ${M.formatInt(s.undeliveredOrders)}`);
}

function renderScenarioChart(width) {
  const s = sim.scenario;
  const measures = [
    { label: 'Revenue', base: M.formatMillionsBRL(M.PUBLISHED.revenueBRL), value: M.formatMillionsBRL(s.revenueBRL), index: s.multiplier * 100, change: M.formatSignedPercent(s.revenueDeltaPct), changeAbs: M.formatSignedMillionsBRL(s.revenueChangeBRL) },
    { label: 'Orders (≈)', base: `≈ ${M.formatCompact(M.DERIVED.impliedOrders)}`, value: `≈ ${M.formatCompact(s.orders)}`, index: s.volumeFactor * 100, change: M.formatSignedPercent(s.changes.volumePct, 0), changeAbs: M.formatSignedInt(s.ordersChange) },
    { label: 'Avg. order value', base: M.formatBRL(M.PUBLISHED.averageOrderBRL), value: M.formatBRL(s.averageOrderBRL), index: s.basketFactor * 100, change: M.formatSignedPercent(s.changes.basketPct, 0), changeAbs: M.formatBRL(s.averageOrderChangeBRL) },
  ];
  const maxIndex = Math.max(100, ...measures.map((m) => m.index));
  const rows = [];
  for (const measure of measures) {
    rows.push({ label: measure.label, value: 100, display: measure.base, kind: 'pub', tip: `${measure.label}: published baseline\n${measure.base}\nIndex 100 by definition`, groupStart: true });
    rows.push({ value: measure.index, display: `${measure.value} (${measure.change})`, kind: 'hypo', tip: `${measure.label}: hypothetical scenario\n${measure.value}\n${measure.change} (${measure.changeAbs}) versus published\nIndex ${r1(measure.index)}` });
  }
  horizontalBars(dom.scenario.chart, width, { rows, max: Math.ceil((maxIndex * 1.08) / 20) * 20, labelWidth: 128, barHeight: 16, rowGap: 3, groupGap: 16, valueWidth: 118, hatchId: 'hatch-scenario', title: 'Published baseline versus hypothetical scenario, indexed to the baseline = 100', legend: [{ swatch: 'swatch-pub', label: 'Published baseline', note: '= 100' }, { swatch: 'swatch-hypo', label: 'Hypothetical scenario', note: '(hatched)' }] });
  clear(dom.scenario.caption);
  dom.scenario.caption.append(
    el('strong', { text: s.isBaseline ? 'No change: the scenario equals the published baseline.' : `Hypothetical: ${describeChanges(s.changes)}.` }),
    document.createTextNode(s.isBaseline ? ' Move a lever or choose a preset to project a scenario.' : ` Revenue ${M.formatMillionsBRL(s.revenueBRL)} (${M.formatSignedPercent(s.revenueDeltaPct)}), a projection from the formulas below, not a result.`),
  );
  clear(dom.scenario.rows);
  for (const measure of measures) {
    dom.scenario.rows.append(row([cell(measure.label), cell(measure.base, { num: true }), cell(`${measure.value} (hypothetical)`, { num: true }), cell(`${measure.change} · ${measure.changeAbs}`, { num: true }), cell(String(r1(measure.index)), { num: true })]));
  }
}

function renderScenarioOutcomes(width) {
  const s = sim.scenario;
  const base = outcomeValues(M.DERIVED);
  const next = outcomeValues(s);
  const baseDisplays = outcomeDisplays(base);
  const nextDisplays = outcomeDisplays(next);
  stackedRows(dom.scenarioOutcomes.chart, width, {
    rows: [
      { label: 'Published', sublabel: 'derived from two rates', values: base, displays: baseDisplays, tips: OUTCOME_SEGMENTS.map((segment, index) => `${segment.label}: published, derived\n${baseDisplays[index]} of all orders`) },
      { label: 'Hypothetical', sublabel: 'scenario', values: next, displays: nextDisplays, hatched: true, tips: OUTCOME_SEGMENTS.map((segment, index) => `${segment.label}: hypothetical scenario\n${nextDisplays[index]} of all orders\n${M.formatPoints(next[index] - base[index])} versus published, derived`) },
    ],
    segments: OUTCOME_SEGMENTS,
    hatchId: 'hatch-outcomes',
    title: 'Delivery outcomes, published (derived) versus hypothetical scenario, shares of all orders',
    legend: OUTCOME_SEGMENTS.map((segment) => ({ swatch: segment.swatch, label: segment.label })).concat([{ swatch: 'swatch-hypo', label: 'Hatched row', note: '= hypothetical' }]),
    barHeight: 26,
    rowGap: 20,
  });
  clear(dom.scenarioOutcomes.caption);
  const onTimeChange = s.onTimeOfAllChangePoints;
  dom.scenarioOutcomes.caption.append(
    el('strong', { text: s.isBaseline ? 'Both rows are the published baseline.' : `On-time share of all orders ${M.formatPoints(onTimeChange)} (${M.formatPercent(M.DERIVED.onTimeOfAllPct)} → ${M.formatPercent(s.onTimeOfAllPct)}).` }),
    document.createTextNode(s.isBaseline ? '' : ` Under the scenario about ${M.formatInt(s.lateOrders + s.undeliveredOrders)} of ≈ ${M.formatCompact(s.orders)} orders would be late or undelivered; hypothetical counts, rounded.`),
  );
  clear(dom.scenarioOutcomes.rows);
  const counts = [s.onTimeOrders, s.lateOrders, s.undeliveredOrders];
  OUTCOME_SEGMENTS.forEach((segment, index) => {
    dom.scenarioOutcomes.rows.append(row([cell(segment.label), cell(baseDisplays[index], { num: true }), cell(`${nextDisplays[index]} (${M.formatPoints(next[index] - base[index])})`, { num: true }), cell(`≈ ${M.formatInt(counts[index])}`, { num: true })]));
  });
}

function recompute({ announce = false, reason = '' } = {}) {
  sim.scenario = M.calculateScenario(sim.changes);
  for (const key of Object.keys(M.LIMITS)) writeLever(key);
  renderOutputs();
  renderChart(dom.scenario.chart, { force: true });
  renderChart(dom.scenarioOutcomes.chart, { force: true });
  syncPresets();
  if (announce) announceScenario(reason);
}

function announceScenario(reason) {
  const s = sim.scenario;
  const lead = reason ? `${reason} ` : '';
  if (s.isBaseline) {
    dom.simStatus.textContent = `${lead}Published baseline: no change. Revenue R$15.84M, delivery rate 97.02%, on-time delivery 91.88% of delivered orders.`;
    return;
  }
  dom.simStatus.textContent = `${lead}Hypothetical scenario: ${describeChanges(s.changes)}. Projected revenue ${M.formatMillionsBRL(s.revenueBRL)} (${M.formatSignedMillionsBRL(s.revenueChangeBRL)}, ${M.formatSignedPercent(s.revenueDeltaPct)}); on time, of all orders, ${M.formatPercent(s.onTimeOfAllPct)}. The published figures are unchanged.`;
}

function setLever(key, raw, { source }) {
  const input = leverLabel(key);
  const number = Number(raw);
  if (raw === '' || !Number.isFinite(number)) {
    dom.levers[key].number.setAttribute('aria-invalid', 'true');
    dom.simStatus.textContent = `Enter a number for ${input.label.toLowerCase()}; the previous value stays in force.`;
    dom.levers[key].number.value = String(sim.changes[key]);
    return;
  }
  const stepped = Math.round(number / input.step) * input.step;
  const clamped = M.clampChange(key, stepped);
  const notes = [];
  if (Math.abs(stepped - number) > 1e-9) notes.push(`rounded to the nearest ${input.step}${input.unit === '%' ? '%' : ' points'}`);
  if (clamped !== stepped) notes.push(`clamped to the allowed range ${M.LIMITS[key][0]} to ${M.LIMITS[key][1]}`);
  sim.changes = { ...sim.changes, [key]: Object.is(clamped, -0) ? 0 : clamped };
  const reason = notes.length ? `${input.label} ${signedDisplay(key, clamped)} (${notes.join('; ')}).` : '';
  recompute({ announce: source !== 'drag', reason });
}

function applyPreset(id) {
  const preset = M.PRESETS.find((candidate) => candidate.id === id);
  if (!preset) return;
  sim.changes = { ...preset.changes };
  recompute({ announce: true, reason: `Preset “${preset.name}” applied: ${preset.description}` });
}

function bindSimulator() {
  for (const [key, { range, number }] of Object.entries(dom.levers)) {
    range.addEventListener('input', () => setLever(key, range.value, { source: 'drag' }));
    range.addEventListener('change', () => setLever(key, range.value, { source: 'range' }));
    number.addEventListener('change', () => setLever(key, number.value.trim(), { source: 'typed' }));
    number.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); setLever(key, number.value.trim(), { source: 'typed' }); }
    });
  }
  for (const button of dom.presets) button.addEventListener('click', () => applyPreset(button.dataset.preset));
  dom.resetScenario.addEventListener('click', () => {
    sim.changes = { ...M.DEFAULT_CHANGES };
    recompute({ announce: true, reason: 'Reset.' });
  });
}

/* --------------------------------------------------------- model explorer */

const model = { buttons: new Map(), selected: null };

function tableById(id) {
  return M.MODEL_TABLES.find((table) => table.id === id);
}

function buildModel() {
  for (const table of M.MODEL_TABLES) {
    const button = el('button', { type: 'button', class: `table-button is-${table.group}`, 'data-table': table.id, 'aria-pressed': 'false' }, [
      el('span', { class: 'table-button-name', text: table.id }),
      el('span', { class: 'table-button-kind', text: GROUP_LABEL[table.group] }),
      el('span', { class: 'table-button-title', text: table.title }),
    ]);
    button.addEventListener('click', (event) => selectTable(table.id, { focusDetail: event.detail === 0 }));
    model.buttons.set(table.id, button);
    dom.modelCols[COLUMN_OF[table.id]].append(button);
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => queueResize()).observe(dom.modelDiagram);
  if (WIDE_DIAGRAM.addEventListener) WIDE_DIAGRAM.addEventListener('change', () => queueResize());
  drawConnectors();
  renderTableDetail(null);
}

function drawConnectors() {
  const svg = dom.modelLines;
  clear(svg);
  if (!WIDE_DIAGRAM.matches) return;
  const origin = dom.modelDiagram.getBoundingClientRect();
  if (origin.width === 0) return;
  svg.setAttribute('viewBox', `0 0 ${origin.width} ${origin.height}`);
  const box = (id) => {
    const rect = model.buttons.get(id).getBoundingClientRect();
    return { left: rect.left - origin.left, right: rect.right - origin.left, top: rect.top - origin.top, bottom: rect.bottom - origin.top, cy: rect.top - origin.top + rect.height / 2, cx: rect.left - origin.left + rect.width / 2 };
  };
  const facts = ['fact_orders', 'fact_order_items', 'fact_cohort_retention'].map(box);
  const busLeft = Math.min(...facts.map((f) => f.left)) - 16;
  const busRight = Math.max(...facts.map((f) => f.right)) + 16;
  const busTop = facts[0].top + 8;
  const busBottom = facts[facts.length - 1].bottom - 8;
  // A selected dimension lights its own filter path; a selected fact lights every documented path into the fact layer.
  const selectedGroup = model.selected ? tableById(model.selected).group : null;
  const related = (id) => (model.selected === id || selectedGroup === 'fact' ? ' is-related' : '');
  const readsRelated = ['KPI_Measures', 'fact_orders', 'fact_order_items'].includes(model.selected) ? ' is-related' : '';
  svg.append(svgEl('path', { class: 'model-bus', d: `M${busLeft} ${busTop}V${busBottom}M${busRight} ${busTop}V${busBottom}` }));
  for (const f of facts) {
    svg.append(svgEl('path', { class: 'model-bus', d: `M${busLeft} ${f.cy}H${f.left}M${busRight} ${f.cy}H${f.right}` }));
  }
  for (const table of M.MODEL_TABLES.filter((t) => t.group === 'dimension')) {
    const b = box(table.id);
    const side = COLUMN_OF[table.id];
    const cls = related(table.id);
    const from = side === 'left' ? b.right : b.left;
    const to = side === 'left' ? busLeft : busRight;
    svg.append(svgEl('path', { class: `model-link is-filter${cls}`, 'data-link': table.id, d: `M${from} ${b.cy}H${to}` }));
    svg.append(svgEl('circle', { class: `model-dot${cls}`, cx: from, cy: b.cy, r: 3.5 }));
    const dir = side === 'left' ? 1 : -1;
    svg.append(svgEl('path', { class: `model-arrow${cls}`, d: `M${to} ${b.cy}l${-6 * dir} -4v8Z` }));
  }
  const measures = box('KPI_Measures');
  const readers = M.MODEL_TABLES.filter((t) => t.id === 'fact_orders' || t.id === 'fact_order_items').map((t) => box(t.id));
  const x = Math.min(measures.left, ...readers.map((r) => r.left)) - 34;
  svg.append(svgEl('path', { class: `model-link is-reads${readsRelated}`, d: `M${measures.left} ${measures.cy}H${x}V${readers[0].cy + 10}` }));
  for (const r of readers) svg.append(svgEl('path', { class: `model-link is-reads${readsRelated}`, d: `M${x} ${r.cy + 10}H${r.left}` }));
  svg.classList.toggle('has-selection', Boolean(model.selected));
}

function selectTable(id, { focusDetail = false } = {}) {
  const next = model.selected === id ? null : id;
  model.selected = next;
  for (const [tableId, button] of model.buttons) button.setAttribute('aria-pressed', String(tableId === next));
  renderTableDetail(next);
  drawConnectors();
  if (focusDetail && next) dom.tableDetail.focus();
}

function renderTableDetail(id) {
  const body = dom.tableDetailBody;
  clear(body);
  if (!id) {
    dom.tableDetailHeading.textContent = 'Table detail';
    body.append(el('p', { class: 'empty-state' }, [el('strong', { text: 'Select a table' }), document.createTextNode(' to see its documented role, the columns visible in the published model view, the measures that read it and the dashboard visuals that use its fields. The ten tables are exactly those the README lists.')]));
    return;
  }
  const table = tableById(id);
  dom.tableDetailHeading.textContent = `${table.title} · ${GROUP_NOUN[table.group]}`;
  body.append(el('p', { class: 'detail-headline', text: table.id }));
  body.append(el('ul', { class: 'detail-chips' }, [
    el('li', { class: `is-${table.group}` }, [el('strong', { text: GROUP_LABEL[table.group] })]),
    el('li', {}, [document.createTextNode('Columns seen '), el('strong', { text: String(table.columnsSeen.length) })]),
    el('li', {}, [document.createTextNode('Measures '), el('strong', { text: String(table.measures.length) })]),
    el('li', {}, [document.createTextNode('Visuals '), el('strong', { text: String(table.visuals.length) })]),
  ]));
  body.append(el('div', { class: 'detail-block' }, [el('h4', { text: 'Documented role' }), el('p', { text: table.description })]));
  body.append(el('div', { class: 'detail-block' }, [
    el('h4', { text: table.group === 'measure' ? 'Measures listed (model view and README)' : 'Columns visible in the published model view (partial)' }),
    el('ul', { class: 'column-chips' }, (table.group === 'measure' ? table.measures.map((m) => M.DAX_MEASURES.find((d) => d.id === m).name) : table.columnsSeen).map((name) => el('li', { text: name }))),
  ]));
  if (table.group !== 'measure') {
    const measures = M.DAX_MEASURES.filter((d) => d.reads.includes(table.id));
    body.append(el('div', { class: 'detail-block' }, [
      el('h4', { text: 'Published measures that read it' }),
      measures.length
        ? el('ul', { class: 'detail-list' }, measures.map((d) => el('li', {}, [el('strong', { text: d.name }), document.createTextNode(` — ${d.dax.split('\n').slice(1).join(' ').replace(/\s+/g, ' ').trim()}`)])))
        : el('p', { text: 'None of the five published DAX measures reads this table directly.' }),
    ]));
  }
  const visuals = M.DASHBOARD_VISUALS.filter((v) => table.visuals.includes(v.id));
  body.append(el('div', { class: 'detail-block' }, [
    el('h4', { text: 'Dashboard visuals using its fields' }),
    visuals.length
      ? el('ul', { class: 'detail-list' }, visuals.map((v) => el('li', {}, [el('strong', { text: v.title }), document.createTextNode(` (${v.type.toLowerCase()}): ${v.fields.filter((f) => f.startsWith(`${table.id}.`) || table.id === 'KPI_Measures' && f.startsWith('KPI_Measures.')).join(', ') || v.fields.join(', ')}${v.filter ? `; filter: ${v.filter}` : ''}`)])))
      : el('p', { text: 'No visual on the published report page queries this table directly.' }),
  ]));
  body.append(el('div', { class: 'detail-block' }, [el('h4', { text: 'Provenance' }), el('p', { text: `Listed in the README's data model. ${table.group === 'measure' ? 'Measure names' : 'Column names'} are transcribed from the model-view screenshot (panels are scrolled, so the list is partial); the report wiring is read from the report layout inside the published .pbix file. Join keys and cardinalities are not asserted.` })]));
}

/* --------------------------------------------------------------------- init */

function init() {
  registerChart(dom.category.chart, renderCategoryChart);
  registerChart(dom.topTen.chart, renderTopTenChart);
  registerChart(dom.status.chart, renderStatusChart);
  registerChart(dom.outcome.chart, renderOutcomeChart);
  registerChart(dom.scenario.chart, renderScenarioChart);
  registerChart(dom.scenarioOutcomes.chart, renderScenarioOutcomes);
  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(() => queueResize());
    for (const frame of charts.keys()) observer.observe(frame);
  } else {
    window.addEventListener('resize', queueResize, { passive: true });
  }
  bindSimulator();
  buildModel();
  renderAllCharts();
  recompute({ announce: false });
  dom.simStatus.textContent = 'Published baseline loaded: revenue R$15.84M, delivery rate 97.02%, on-time delivery 91.88% of delivered orders. Move a lever or choose a preset to project a hypothetical scenario.';
}

init();
