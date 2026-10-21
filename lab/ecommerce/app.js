/**
 * E-Commerce Executive Analytics Lab — UI module.
 *
 * Owns the DOM only. Every figure comes from ./model.js: the published and
 * exported transcriptions, the derived arithmetic and the hypothetical
 * scenario calculations. The module renders the dashboard charts as SVG,
 * keeps the four simulator levers as state and recalculates on every change,
 * and builds the data-model explorer from the documented tables. Every piece
 * of text is written with textContent or text nodes; the element factories
 * refuse inline styles, event-handler attributes and URL attributes outright.
 */
import * as M from './model.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const byId = (id) => document.getElementById(id);
const LEVER_IDS = Object.freeze({ volumePct: 'volume', basketPct: 'basket', deliveryPoints: 'delivery', onTimePoints: 'ontime' });
const GROUP_LABEL = Object.freeze({ fact: 'Fact', dimension: 'Dimension', measure: 'Measure table' });
const GROUP_NOUN = Object.freeze({ fact: 'fact table', dimension: 'dimension table', measure: 'measure table' });
const COLUMN_OF = Object.freeze({ dim_date: 'left', dim_customer: 'left', dim_product: 'left', dim_seller: 'right', dim_payment_method: 'right', dim_order_status: 'right', fact_orders: 'center', fact_order_items: 'center', fact_cohort_retention: 'center', KPI_Measures: 'center' });
// The same query the stylesheet uses to stack the diagram, so the lines are drawn exactly when the columns sit side by side.
const NARROW_DIAGRAM = window.matchMedia ? window.matchMedia('(max-width: 780px)') : { matches: false };
const NARROW_CHART = 460; // below this width labels sit above their bars instead of beside them

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

const FORBIDDEN_ATTRIBUTE = /^(style|on.+|srcdoc|href|src|xlink:href|action|formaction)$/i;

/** Element factory: attributes are set verbatim (never styles or handlers), text is always a text node. */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (FORBIDDEN_ATTRIBUTE.test(key)) throw new Error(`Refusing to set attribute ${key}`);
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
    if (FORBIDDEN_ATTRIBUTE.test(key)) throw new Error(`Refusing to set attribute ${key}`);
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

function cell(text, { num = false } = {}) {
  return el('td', { class: num ? 'is-num' : undefined, text });
}

function row(cells) {
  return el('tr', {}, cells);
}

const r1 = (value) => M.roundTo(value, 1);

/** A BRL change with its sign (a true minus), signless when it rounds to zero. */
const signedBRL = (value) => {
  const rounded = M.roundTo(value, 2);
  if (rounded === 0) return 'R$0.00';
  return `${rounded > 0 ? '+' : '−'}${M.formatBRL(Math.abs(rounded))}`;
};

const setAttrs = (node, attrs) => { for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value)); };
const textLength = (node) => (node && typeof node.getComputedTextLength === 'function' ? node.getComputedTextLength() : 0);

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
  tipOf(frame).hidden = true;
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
 * through the marks and the tooltip (a live region) reads each one; a tap
 * or click toggles the tooltip for pointers that cannot hover. A chart that
 * held focus keeps it, and its active mark, when it is redrawn.
 */
function mountChart(frame, svg, legend, title) {
  const marks = [...svg.querySelectorAll('.mark')];
  const hadFocus = frame.contains(document.activeElement);
  const previousActive = Number(frame.dataset.active ?? -1);
  let active = -1;
  const setActive = (index) => {
    active = index;
    frame.dataset.active = String(index);
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
  marks.forEach((mark, index) => {
    mark.addEventListener('pointerenter', () => { mark.classList.add('is-hover'); showTip(frame, mark); });
    mark.addEventListener('pointerleave', () => {
      mark.classList.remove('is-hover');
      if (active >= 0) showTip(frame, marks[active]); else hideTip(frame);
    });
    mark.addEventListener('click', () => setActive(active === index ? -1 : index));
  });
  clear(frame);
  frame.append(svg);
  if (legend) frame.append(legend);
  frame.append(tipOf(frame));
  hideTip(frame);
  if (hadFocus) {
    svg.focus({ preventScroll: true });
    setActive(previousActive >= 0 && previousActive < marks.length ? previousActive : -1);
  }
}

function registerChart(frame, render) {
  charts.set(frame, { render, width: -1 });
}

/**
 * Reads the frames' widths (a layout read) and returns the charts that need
 * drawing. Callers read widths before they write anything, then run the jobs.
 */
function chartJobs(frames, { force = false } = {}) {
  const jobs = [];
  for (const frame of frames) {
    const entry = charts.get(frame);
    if (!entry) continue;
    const width = Math.floor(frame.clientWidth);
    if (width <= 0 || (!force && width === entry.width)) continue;
    entry.width = width;
    jobs.push({ entry, width });
  }
  return jobs;
}

/**
 * Draws a batch of charts in three phases so the pass forces one layout, not
 * one per chart: every renderer builds its SVG and stages it in its frame
 * (writes), then every pending chart measures its text (reads), then every
 * chart is laid out and mounted (writes). A renderer that measures nothing
 * mounts during the first phase and returns nothing.
 */
function runChartJobs(jobs) {
  const pending = [];
  for (const { entry, width } of jobs) {
    const job = entry.render(width);
    if (job) pending.push(job);
  }
  for (const job of pending) job.measure();
  for (const job of pending) job.finish();
}

function renderAllCharts({ force = false } = {}) {
  runChartJobs(chartJobs(charts.keys(), { force }));
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
 * Horizontal bars, one series or two. Rows carry a label, a value, a display
 * string, a kind (pub, rest, hypo) and a tooltip. Every bar is labelled at
 * its tip because the lists are short and the values are the point. Label
 * and value gutters are measured from the rendered text; when the frame is
 * narrow, or a label would not fit beside its bar, labels move above the
 * bars and sublabels are dropped (the table view keeps them). The SVG is
 * staged in the frame so that its text can be measured, and finish() lays
 * it out and mounts it in place of the current chart.
 */
function horizontalBars(frame, width, { rows, max, title, legend, hatchId, barHeight = 20, rowGap = 14, groupGap = 0, labelShare = 0.42 }) {
  let narrow = width < NARROW_CHART;
  const svg = svgEl('svg', { xmlns: SVG_NS });
  const defs = svgEl('defs');
  if (hatchId) defs.append(hatchPattern(hatchId));
  const axis = svgEl('line', { class: 'axis' });
  const body = svgEl('g');
  svg.append(defs, axis, body);
  const items = rows.map((item) => {
    const label = item.label !== undefined ? svgEl('text', { class: item.labelClass || 'label-plain', text: item.label }) : null;
    const sublabel = item.sublabel && !narrow ? svgEl('text', { class: 'label-mono', text: item.sublabel }) : null;
    const shape = svgEl('path', { class: `bar bar-${item.kind}` });
    const hatch = item.kind === 'hypo' && hatchId ? svgEl('path', { fill: `url(#${hatchId})` }) : null;
    const outline = svgEl('path', { class: 'outline' });
    const hit = svgEl('rect', { class: 'hit' });
    const group = mark(shape, hit, item.tip, outline);
    if (hatch) group.insertBefore(hatch, outline);
    const value = svgEl('text', { class: 'label-value', text: item.display });
    for (const node of [label, sublabel, group, value]) if (node) body.append(node);
    return { item, label, sublabel, shape, hatch, outline, hit, value };
  });
  frame.append(svg);
  let labelWidth = 0;
  let valueWidth = 0;
  return {
    measure() {
      labelWidth = Math.max(0, ...items.map((entry) => Math.max(textLength(entry.label), textLength(entry.sublabel))));
      valueWidth = Math.max(0, ...items.map((entry) => textLength(entry.value)));
    },
    finish() {
      if (!narrow && labelWidth + 12 > width * labelShare) {
        narrow = true;
        for (const entry of items) if (entry.sublabel) { entry.sublabel.remove(); entry.sublabel = null; }
      }
      const left = narrow ? 0 : Math.ceil(labelWidth) + 12;
      const right = Math.ceil(valueWidth) + 10;
      const plot = Math.max(40, width - left - right);
      let y = 6;
      items.forEach((entry, index) => {
        if (index > 0 && entry.item.groupStart) y += groupGap;
        if (entry.label) {
          if (narrow) {
            setAttrs(entry.label, { x: 0, y: y + 10, 'dominant-baseline': 'middle' });
            y += 20;
          } else {
            setAttrs(entry.label, { x: left - 10, y: y + barHeight / 2, 'text-anchor': 'end', 'dominant-baseline': 'middle' });
          }
        }
        if (entry.sublabel) setAttrs(entry.sublabel, { x: left - 10, y: y + barHeight / 2 + 13, 'text-anchor': 'end', 'dominant-baseline': 'middle' });
        const w = Math.max(0, (entry.item.value / max) * plot);
        const d = barRight(left, y, w, barHeight);
        entry.shape.setAttribute('d', d);
        if (entry.hatch) entry.hatch.setAttribute('d', d);
        entry.outline.setAttribute('d', d);
        setAttrs(entry.hit, { x: left - 2, y: y - 4, width: plot + 4, height: barHeight + 8 });
        setAttrs(entry.value, { x: left + w + 8, y: y + barHeight / 2, 'dominant-baseline': 'middle' });
        y += barHeight + rowGap;
      });
      // A sublabel hangs below its bar, so the last row needs more room beneath it.
      const height = y - rowGap + (items.some((entry) => entry.sublabel) ? 14 : 6);
      setAttrs(axis, { x1: left, x2: left, y1: 4, y2: Math.min(height - 4, y - rowGap + 2) });
      setAttrs(svg, { viewBox: `0 0 ${width} ${height}`, width, height });
      mountChart(frame, svg, legend ? legendList(legend) : null, title);
    },
  };
}

/**
 * A 100% stacked horizontal bar per row, segments separated by a 2px surface
 * gap. Row labels sit beside the bars when they fit, above them otherwise.
 * Staged, measured and mounted the same way as horizontalBars.
 */
function stackedRows(frame, width, { rows, segments, title, legend, hatchId, barHeight = 26, rowGap = 22, labelShare = 0.34 }) {
  let narrow = width < NARROW_CHART;
  const svg = svgEl('svg', { xmlns: SVG_NS });
  const defs = svgEl('defs');
  if (hatchId) defs.append(hatchPattern(hatchId));
  svg.append(defs);
  const built = rows.map((item) => {
    let label = null;
    let sublabel = null;
    if (item.label) {
      label = svgEl('text', { class: 'label-strong', text: item.label });
      if (item.sublabel) sublabel = svgEl('text', { class: 'label-mono', text: item.sublabel });
      svg.append(label);
      if (sublabel) svg.append(sublabel);
    }
    return { item, label, sublabel };
  });
  frame.append(svg);
  let labelWidth = 0;
  return {
    measure() {
      labelWidth = Math.max(0, ...built.map((entry) => Math.max(textLength(entry.label), textLength(entry.sublabel))));
    },
    finish() {
      if (!narrow && labelWidth + 12 > width * labelShare) narrow = true;
      const left = built.some((entry) => entry.label) && !narrow ? Math.ceil(labelWidth) + 12 : 0;
      const plot = Math.max(60, width - left - 4);
      let y = 6;
      for (const entry of built) {
        if (entry.label) {
          if (narrow) {
            setAttrs(entry.label, { x: 0, y: y + 10, 'dominant-baseline': 'middle' });
            if (entry.sublabel) setAttrs(entry.sublabel, { x: 0, y: y + 26, 'dominant-baseline': 'middle' });
            y += entry.sublabel ? 36 : 20;
          } else {
            setAttrs(entry.label, { x: left - 10, y: y + barHeight / 2, 'text-anchor': 'end', 'dominant-baseline': 'middle' });
            if (entry.sublabel) setAttrs(entry.sublabel, { x: left - 10, y: y + barHeight / 2 + 13, 'text-anchor': 'end', 'dominant-baseline': 'middle' });
          }
        }
        let x = left;
        const item = entry.item;
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
      }
      const height = y - rowGap + (!narrow && built.some((entry) => entry.sublabel) ? 14 : 6);
      setAttrs(svg, { viewBox: `0 0 ${width} ${height}`, width, height });
      mountChart(frame, svg, legendList(legend), title);
    },
  };
}

/** Splits an underscore-joined label into lines that fit a slot of the given width (10px monospace, about 6px per glyph). */
function splitLabel(label, slot) {
  const fits = (text) => text.length * 6 <= slot - 6;
  if (fits(label) || !label.includes('_')) return [label];
  const lines = [];
  let current = '';
  for (const part of label.split('_')) {
    const candidate = current ? `${current}_${part}` : part;
    if (current && !fits(candidate)) { lines.push(`${current}_`); current = part; } else current = candidate;
  }
  lines.push(current);
  return lines;
}

/* ------------------------------------------------------- dashboard charts */

function renderCategoryChart(width) {
  const [first, second] = M.PUBLISHED.categories;
  const shares = M.DERIVED.categoryShares;
  const rows = M.PUBLISHED.categories.map((category, index) => ({
    label: category.name,
    labelClass: 'label-strong',
    sublabel: `${M.formatPercent(shares[index].sharePct, 1)} of revenue · derived`,
    value: category.revenueBRL,
    display: M.formatMillionsBRL(category.revenueBRL),
    kind: 'pub',
    tip: `${category.name}\n${M.formatMillionsBRL(category.revenueBRL)} published (README: approximately)\n${M.formatPercent(shares[index].sharePct, 2)} of total revenue, derived\nRank ${category.rank} of the exported top 10`,
  }));
  const job = horizontalBars(dom.category.chart, width, { rows, max: first.revenueBRL * 1.12, barHeight: 22, rowGap: 26, title: 'Two documented leading categories, revenue in R$ millions', legend: [{ swatch: 'swatch-pub', label: 'Published', note: 'README figure' }] });
  clear(dom.category.caption);
  dom.category.caption.append(
    el('strong', { text: `${first.name} leads ${second.name} by ${M.formatMillionsBRL(M.DERIVED.categoryGapBRL)} (${M.formatSignedPercent(M.DERIVED.categoryGapPct)}).` }),
    document.createTextNode(` Together they are ${M.formatPercent(shares[0].sharePct + shares[1].sharePct, 1)} of the published R$15.84M. Shares and the gap are derived; the README gives both revenues as approximate.`),
  );
  clear(dom.category.rows);
  M.PUBLISHED.categories.forEach((category, index) => {
    dom.category.rows.append(row([cell(category.name), cell(M.formatMillionsBRL(category.revenueBRL), { num: true }), cell(`${M.formatPercent(shares[index].sharePct, 2)} (derived)`, { num: true }), cell('README, Key Business Insights')]));
  });
  return job;
}

function renderTopTenChart(width) {
  const rows = M.EXPORTED.topCategories.map((category) => {
    const documented = category.rank <= 2;
    const share = (category.revenueBRL / M.PUBLISHED.revenueBRL) * 100;
    return {
      label: category.label,
      labelClass: documented ? 'label-strong' : 'label-plain',
      value: category.revenueBRL,
      display: M.formatMillionsBRL(category.revenueBRL),
      kind: documented ? 'pub' : 'rest',
      tip: `${category.rank}. ${category.label}${category.truncated ? ' (label truncated in the export)' : ''}\n${M.formatMillionsBRL(category.revenueBRL)} as printed on the exported chart\n${M.formatPercent(share, 2)} of total revenue, derived\n${documented ? 'Also named in the README' : 'Exported chart label only'}`,
    };
  });
  const job = horizontalBars(dom.topTen.chart, width, { rows, max: rows[0].value * 1.12, barHeight: 16, rowGap: 9, title: 'Top 10 product categories by revenue, as exported, in R$ millions', legend: [{ swatch: 'swatch-pub', label: 'Named in the README', note: 'published figures, bold labels' }, { swatch: 'swatch-rest', label: 'Exported chart labels only' }] });
  clear(dom.topTen.caption);
  dom.topTen.caption.append(
    el('strong', { text: `The ten exported categories sum to ${M.formatMillionsBRL(M.DERIVED.topTenTotalBRL)}, ${M.formatPercent(M.DERIVED.topTenShareOfRevenuePct, 1)} of total revenue (derived).` }),
    document.createTextNode(' Values are printed to R$0.01M in the export; the fifth label is cut off there and is shown as printed. No category beyond these ten is published.'),
  );
  clear(dom.topTen.rows);
  for (const category of M.EXPORTED.topCategories) {
    dom.topTen.rows.append(row([cell(String(category.rank), { num: true }), cell(category.label + (category.truncated ? ' (truncated in the export)' : '')), cell(M.formatMillionsBRL(category.revenueBRL), { num: true }), cell(`${M.formatPercent((category.revenueBRL / M.PUBLISHED.revenueBRL) * 100, 2)} (derived)`, { num: true }), cell(category.rank <= 2 ? 'README and exported chart' : 'Exported chart data label')]));
  }
  return job;
}

function renderStatusChart(width) {
  const counts = M.EXPORTED.statusCounts;
  const shares = M.DERIVED.statusShares;
  const max = 100_000;
  const left = 54;
  const right = 10;
  const top = 18;
  const plotHeight = 170;
  const plot = Math.max(80, width - left - right);
  const slot = plot / counts.length;
  const labelLines = counts.map((item) => splitLabel(item.label, slot));
  const lineCount = Math.max(...labelLines.map((lines) => lines.length));
  const bottom = 32 + lineCount * 12;
  const svg = svgEl('svg', { xmlns: SVG_NS });
  for (const tick of [0, 25_000, 50_000, 75_000, 100_000]) {
    const y = top + plotHeight - (tick / max) * plotHeight;
    svg.append(svgEl('line', { class: tick === 0 ? 'axis' : 'grid-line', x1: left, x2: left + plot, y1: y, y2: y }));
    svg.append(svgEl('text', { x: left - 8, y, 'text-anchor': 'end', 'dominant-baseline': 'middle', class: 'label-mono', text: tick === 0 ? '0' : `${tick / 1000}K` }));
  }
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
    const centre = left + slot * index + slot / 2;
    labelLines[index].forEach((line, lineIndex) => {
      svg.append(svgEl('text', { x: centre, y: top + plotHeight + 18 + lineIndex * 12, 'text-anchor': 'middle', class: 'label-mono', text: line }));
    });
    svg.append(svgEl('text', { x: centre, y: top + plotHeight + 18 + lineCount * 12 + 3, 'text-anchor': 'middle', class: 'label-mono', text: M.formatPercent(shares[index].sharePct, 2) }));
  });
  const height = top + plotHeight + bottom;
  setAttrs(svg, { viewBox: `0 0 ${width} ${height}`, width, height });
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
  const job = stackedRows(dom.outcome.chart, width, {
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
  return job;
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
  range.setAttribute('aria-valuetext', value === 0 ? 'no change, published baseline' : `${signedDisplay(key, value)}, hypothetical change`);
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
  const derivedNote = s.isBaseline ? 'derived from the published rates and the implied order count, not a published figure' : 'hypothetical';
  setStat(o.revenue, M.formatMillionsBRL(s.revenueBRL), s.isBaseline ? 'published baseline, no change' : 'hypothetical · published R$15.84M');
  setStat(o.revenueChange, M.formatSignedMillionsBRL(s.revenueChangeBRL), `${M.formatSignedPercent(s.revenueDeltaPct)} versus published R$15.84M`);
  setStat(o.orders, `≈ ${M.formatCompact(s.orders)}`, s.isBaseline ? 'implied by R$15.84M ÷ R$159.33, not a published count' : `${M.formatSignedInt(s.ordersChange)} versus ≈ ${M.formatCompact(M.DERIVED.impliedOrders)} implied by R$15.84M ÷ R$159.33`);
  setStat(o.aov, M.formatBRL(s.averageOrderBRL), s.isBaseline ? 'published baseline, no change' : `${M.formatSignedPercent(s.changes.basketPct, 0)} versus published R$159.33`);
  setStat(o.delivery, M.formatPercent(s.deliveredPct), s.isBaseline ? 'published baseline, no change' : `${M.formatPoints(s.changes.deliveryPoints)} versus published 97.02%`);
  setStat(o.onTime, M.formatPercent(s.onTimeOfDeliveredPct), s.isBaseline ? 'published baseline, of delivered orders' : `${M.formatPoints(s.changes.onTimePoints)} versus published 91.88% of delivered orders`);
  setStat(o.onTimeAll, M.formatPercent(s.onTimeOfAllPct), s.isBaseline ? 'derived: 97.02% × 91.88%, not a published figure' : `${M.formatPoints(s.onTimeOfAllChangePoints)} versus derived ${M.formatPercent(M.DERIVED.onTimeOfAllPct)}`);
  setStat(o.missed, `≈ ${M.formatInt(s.lateOrders + s.undeliveredOrders)}`, `${derivedNote}: ${M.formatPercent(s.lateOfAllPct + s.notDeliveredPct)} of ≈ ${M.formatCompact(s.orders)} orders, late ≈ ${M.formatInt(s.lateOrders)}, not delivered ≈ ${M.formatInt(s.undeliveredOrders)}`);
}

function renderScenarioChart(width) {
  const s = sim.scenario;
  const measures = [
    { label: 'Revenue', base: M.formatMillionsBRL(M.PUBLISHED.revenueBRL), value: M.formatMillionsBRL(s.revenueBRL), index: s.index.revenue, change: M.formatSignedPercent(s.revenueDeltaPct), changeAbs: M.formatSignedMillionsBRL(s.revenueChangeBRL) },
    { label: 'Orders (≈)', base: `≈ ${M.formatCompact(M.DERIVED.impliedOrders)}`, value: `≈ ${M.formatCompact(s.orders)}`, index: s.index.orders, change: M.formatSignedPercent(s.changes.volumePct, 0), changeAbs: M.formatSignedInt(s.ordersChange) },
    { label: 'Avg. order value', base: M.formatBRL(M.PUBLISHED.averageOrderBRL), value: M.formatBRL(s.averageOrderBRL), index: s.index.averageOrder, change: M.formatSignedPercent(s.changes.basketPct, 0), changeAbs: signedBRL(s.averageOrderChangeBRL) },
  ];
  const maxIndex = Math.max(100, ...measures.map((m) => m.index));
  const rows = [];
  for (const measure of measures) {
    rows.push({ label: measure.label, labelClass: 'label-strong', value: 100, display: measure.base, kind: 'pub', tip: `${measure.label}: published baseline\n${measure.base}\nIndex 100 by definition`, groupStart: true });
    rows.push({ value: measure.index, display: `${measure.value} (${measure.change})`, kind: 'hypo', tip: `${measure.label}: hypothetical scenario\n${measure.value}\n${measure.change} (${measure.changeAbs}) versus published\nIndex ${r1(measure.index)}` });
  }
  const job = horizontalBars(dom.scenario.chart, width, { rows, max: Math.ceil((maxIndex * 1.08) / 20) * 20, barHeight: 16, rowGap: 3, groupGap: 16, hatchId: 'hatch-scenario', title: 'Published baseline versus hypothetical scenario, indexed to the baseline = 100', legend: [{ swatch: 'swatch-pub', label: 'Published baseline', note: '= 100' }, { swatch: 'swatch-hypo', label: 'Hypothetical scenario', note: '(hatched)' }] });
  clear(dom.scenario.caption);
  dom.scenario.caption.append(
    el('strong', { text: s.isBaseline ? 'No change: the scenario equals the published baseline.' : `Hypothetical: ${describeChanges(s.changes)}.` }),
    document.createTextNode(s.isBaseline ? ' Move a lever or choose a preset to project a scenario.' : ` Revenue ${M.formatMillionsBRL(s.revenueBRL)} (${M.formatSignedPercent(s.revenueDeltaPct)}), a projection from the formulas below, not a result.`),
  );
  clear(dom.scenario.rows);
  for (const measure of measures) {
    dom.scenario.rows.append(row([cell(measure.label), cell(measure.base, { num: true }), cell(`${measure.value} (hypothetical)`, { num: true }), cell(`${measure.change} · ${measure.changeAbs}`, { num: true }), cell(String(r1(measure.index)), { num: true })]));
  }
  return job;
}

function renderScenarioOutcomes(width) {
  const s = sim.scenario;
  const base = outcomeValues(M.DERIVED);
  const next = outcomeValues(s);
  const baseDisplays = outcomeDisplays(base);
  const nextDisplays = outcomeDisplays(next);
  const job = stackedRows(dom.scenarioOutcomes.chart, width, {
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
  return job;
}

function recompute({ announce = false, reason = '', charts: redraw = true } = {}) {
  // Widths are read before anything is written, so a lever change forces one layout: the text measurement.
  const jobs = redraw ? chartJobs([dom.scenario.chart, dom.scenarioOutcomes.chart], { force: true }) : [];
  sim.scenario = M.calculateScenario(sim.changes);
  for (const key of Object.keys(M.LIMITS)) writeLever(key);
  renderOutputs();
  runChartJobs(jobs);
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
  const stepped = M.roundTo(Math.round(number / input.step) * input.step, input.decimals);
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
  if (NARROW_DIAGRAM.addEventListener) NARROW_DIAGRAM.addEventListener('change', () => queueResize());
  drawConnectors();
  renderTableDetail(null);
}

function drawConnectors() {
  const svg = dom.modelLines;
  clear(svg);
  if (NARROW_DIAGRAM.matches) return;
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

/** The dashboard visuals a table reaches: through its own columns for dimensions, through the measures that read it for facts. */
function visualsFor(table) {
  if (table.group === 'measure') {
    return M.DASHBOARD_VISUALS.filter((v) => v.fields.some((f) => f.startsWith('KPI_Measures.'))).map((v) => ({ visual: v, via: v.fields.filter((f) => f.startsWith('KPI_Measures.')).map((f) => f.slice('KPI_Measures.'.length)) }));
  }
  if (table.group === 'fact') {
    const readers = M.DAX_MEASURES.filter((d) => d.reads.includes(table.id));
    return M.DASHBOARD_VISUALS
      .map((v) => ({ visual: v, via: readers.filter((d) => v.fields.includes(`KPI_Measures.${d.name}`)).map((d) => `measure ${d.name}`) }))
      .filter((entry) => entry.via.length);
  }
  return M.DASHBOARD_VISUALS
    .map((v) => ({ visual: v, via: v.fields.filter((f) => f.startsWith(`${table.id}.`)) }))
    .filter((entry) => entry.via.length);
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
  const visuals = visualsFor(table);
  dom.tableDetailHeading.textContent = `${table.title} · ${GROUP_NOUN[table.group]}`;
  body.append(el('p', { class: 'detail-headline', text: table.id }));
  body.append(el('ul', { class: 'detail-chips' }, [
    el('li', { class: `is-${table.group}` }, [el('strong', { text: GROUP_LABEL[table.group] })]),
    el('li', {}, [document.createTextNode(table.group === 'measure' ? 'Measures seen ' : 'Columns seen '), el('strong', { text: String(table.group === 'measure' ? table.measuresSeen.length : table.columnsSeen.length) })]),
    el('li', {}, [document.createTextNode('Measures '), el('strong', { text: String(table.measures.length) })]),
    el('li', {}, [document.createTextNode('Visuals '), el('strong', { text: String(visuals.length) })]),
  ]));
  body.append(el('div', { class: 'detail-block' }, [el('h4', { text: 'Documented role' }), el('p', { text: table.description })]));
  if (table.group === 'measure') {
    body.append(el('div', { class: 'detail-block' }, [
      el('h4', { text: 'Measures visible in the published model view (partial)' }),
      el('ul', { class: 'column-chips' }, table.measuresSeen.map((name) => el('li', { text: name }))),
      el('p', { text: 'The model view also shows a hidden Value column; its measure list is scrolled, so more measures may exist.' }),
    ]));
    body.append(el('div', { class: 'detail-block' }, [
      el('h4', { text: 'Measures named by the README and the report layout' }),
      el('ul', { class: 'column-chips' }, table.measures.map((m) => M.DAX_MEASURES.find((d) => d.id === m)).map((d) => el('li', { text: `${d.name}${d.published ? '' : ' (definition not published)'}` }))),
    ]));
  } else {
    body.append(el('div', { class: 'detail-block' }, [
      el('h4', { text: 'Columns visible in the published model view (partial)' }),
      el('ul', { class: 'column-chips' }, table.columnsSeen.map((name) => el('li', { text: name }))),
    ]));
    if (table.columnsFromLayout.length) {
      body.append(el('div', { class: 'detail-block' }, [
        el('h4', { text: 'Columns named by the report layout, not visible in the scrolled panel' }),
        el('ul', { class: 'column-chips' }, table.columnsFromLayout.map((name) => el('li', { text: name }))),
      ]));
    }
    const measures = M.DAX_MEASURES.filter((d) => d.reads.includes(table.id));
    body.append(el('div', { class: 'detail-block' }, [
      el('h4', { text: 'Published measures that read it' }),
      measures.length
        ? el('ul', { class: 'detail-list' }, measures.map((d) => el('li', {}, [el('strong', { text: d.name }), document.createTextNode(` — ${d.dax.split('\n').slice(1).join(' ').replace(/\s+/g, ' ').trim()}`)])))
        : el('p', { text: 'None of the five published DAX measures reads this table directly.' }),
    ]));
  }
  body.append(el('div', { class: 'detail-block' }, [
    el('h4', { text: table.group === 'fact' ? 'Dashboard visuals reached through its measures' : 'Dashboard visuals using its fields' }),
    visuals.length
      ? el('ul', { class: 'detail-list' }, visuals.map(({ visual, via }) => el('li', {}, [el('strong', { text: visual.title }), document.createTextNode(` (${visual.type.toLowerCase()}): ${via.join(', ')}${visual.filter ? `; filter: ${visual.filter}` : ''}`)])))
      : el('p', { text: table.group === 'fact' ? 'No published measure reads this table, so no visual on the published report page is traced to it.' : 'No visual on the published report page queries this table directly.' }),
  ]));
  body.append(el('div', { class: 'detail-block' }, [el('h4', { text: 'Provenance' }), el('p', { text: `Listed in the README's data model. ${table.group === 'measure' ? 'Measure names' : 'Column names'} marked as seen are transcribed from the model-view screenshot, whose panels are scrolled, so the lists are partial; names marked as from the report layout are read from the report layout inside the published .pbix file, which also gives the visual wiring. Join keys and cardinalities are not asserted.` })]));
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
  recompute({ announce: false, charts: false });
  renderAllCharts();
  dom.simStatus.textContent = 'Published baseline loaded: revenue R$15.84M, delivery rate 97.02%, on-time delivery 91.88% of delivered orders. Move a lever or choose a preset to project a hypothetical scenario.';
}

init();
