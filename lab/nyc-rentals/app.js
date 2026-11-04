import { city, boroughs, scores } from './data.js';
import { rankNeighborhoods } from './model.js';

const get = (id) => document.getElementById(id);
const number = new Intl.NumberFormat('en-US');
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const dates = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthLabel = (value) => dates.format(new Date(value + '-01T00:00:00Z'));
const format = {
  asking: (v) => money.format(v),
  effective: (v) => money.format(v),
  listings: (v) => number.format(v),
  concessions: (v) => v.toFixed(1) + '%',
};
const labels = { asking: 'Median asking rent', effective: 'Median effective rent', listings: 'Listings', concessions: 'Concession rate' };
const chartLabels = { asking: 'Asking', effective: 'Effective', listings: 'Listings', concessions: 'Concessions' };

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function svg(tag, attributes, text) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function options(select, values) {
  select.replaceChildren(...values.map(([value, label]) => new Option(label, value)));
}

const month = get('market-month');
const scope = get('market-scope');
const metric = get('market-metric');
const chart = get('trend-chart');
const slider = get('trend-month');
const previous = get('trend-prev');
const next = get('trend-next');
const comparison = get('borough-bars');
const names = Object.keys(boroughs).sort();
options(month, city.map(({ month: value }) => [value, monthLabel(value)]).reverse());
options(scope, [['city', 'NYC citywide'], ...names.map((name) => [name, name])]);
slider.max = String(city.length - 1);
get('trend-controls').hidden = false;
get('trend-help').hidden = false;
let trend;

function drawTrend(rows, keys, width) {
  const points = rows.flatMap((row) => keys.map((key) => row[key]));
  const step = keys[0] === 'concessions' ? 2.5 : keys[0] === 'listings' ? Math.max(1, 10 ** Math.floor(Math.log10(Math.max(...points)) - 1)) : 250;
  const low = keys[0] === 'asking' ? Math.max(0, Math.floor((Math.min(...points) - step / 2) / step) * step) : 0;
  const interval = Math.max(step, Math.ceil((Math.max(...points) + step / 2 - low) / (4 * step)) * step);
  const high = low + 4 * interval;
  const compact = width < 410;
  const left = compact ? 61 : 76;
  const right = width - 18;
  const top = 82;
  const bottom = compact ? 231 : 281;
  const x = (i) => left + i * (right - left) / (rows.length - 1);
  const y = (value) => bottom - (bottom - top) * (value - low) / (high - low);
  const nodes = [];
  for (let i = 0; i <= 4; i++) {
    const value = low + i * interval;
    nodes.push(svg('line', { x1: left, x2: right, y1: y(value), y2: y(value), class: 'rental-chart-grid' }),
      svg('text', { x: left - 8, y: y(value) + 4, 'text-anchor': 'end' }, format[keys[0]](value)));
  }
  const last = rows.length - 1;
  rows.forEach((_, i) => {
    nodes.push(svg('line', { x1: x(i), x2: x(i), y1: bottom, y2: bottom + 4, class: 'rental-chart-grid' }));
  });
  const ticks = compact ? [0, 7, last] : [0, 5, 10, last];
  ticks.forEach((i) => {
    const label = monthLabel(rows[i].month);
    nodes.push(svg('text', { x: x(i), y: bottom + 24, 'text-anchor': i === last ? 'end' : 'middle' }, compact ? label.replace(/ 20(\d{2})$/, " ’$1") : label));
  });
  keys.forEach((key, i) => {
    const points = rows.map((row, j) => x(j) + ',' + y(row[key])).join(' ');
    nodes.push(svg('polyline', { points, class: i ? 'rental-series rental-series-alt' : 'rental-series' }));
    rows.forEach((row, j) => {
      nodes.push(svg('circle', { cx: x(j), cy: y(row[key]), r: 2, class: i ? 'rental-month-dot rental-month-dot-alt' : 'rental-month-dot' }));
    });
  });
  const guide = svg('g', { class: 'rental-chart-selection' });
  const dots = keys.map((_, i) => svg('circle', { cx: 0, r: 5, class: i ? 'rental-point rental-point-alt' : 'rental-point' }));
  guide.append(svg('line', { x1: 0, x2: 0, y1: 72, y2: bottom, class: 'rental-chart-cursor' }), ...dots);
  const tooltip = svg('g', { class: 'rental-chart-tooltip', 'aria-hidden': 'true' });
  const tooltipWidth = 164;
  const tooltipMonth = svg('text', { x: 10, y: 18, class: 'rental-tooltip-month' });
  tooltip.append(svg('rect', { width: tooltipWidth, height: 28 + keys.length * 18, rx: 8 }), tooltipMonth);
  const tooltipValues = keys.map((key, i) => {
    const y = 36 + i * 18;
    const value = svg('text', { x: tooltipWidth - 10, y, 'text-anchor': 'end', class: 'rental-tooltip-value' });
    tooltip.append(svg('text', { x: 10, y }, chartLabels[key]), value);
    return value;
  });
  chart.setAttribute('viewBox', `0 0 ${width} ${bottom + 36}`);
  chart.replaceChildren(...nodes, guide, tooltip);
  trend = { rows, keys, width, x, y, guide, dots, tooltip, tooltipWidth, tooltipMonth, tooltipValues };
}

function renderTrend(rows, keys, index) {
  const width = Math.max(240, chart.clientWidth || 540);
  if (!trend || trend.rows !== rows || trend.keys[0] !== keys[0] || trend.width !== width) drawTrend(rows, keys, width);
  trend.guide.setAttribute('transform', `translate(${trend.x(index)} 0)`);
  trend.dots.forEach((dot, i) => dot.setAttribute('cy', trend.y(rows[index][keys[i]])));
  const left = Math.max(8, Math.min(width - trend.tooltipWidth - 8, trend.x(index) - trend.tooltipWidth / 2));
  trend.tooltip.setAttribute('transform', `translate(${left} 8)`);
  trend.tooltipMonth.textContent = monthLabel(rows[index].month);
  trend.tooltipValues.forEach((node, i) => { node.textContent = format[keys[i]](rows[index][keys[i]]); });
}

function bar(label, text, ratio, selectable = false) {
  const row = element('li');
  const content = selectable ? element('button', undefined, 'rental-bar-button') : row;
  if (selectable) {
    content.type = 'button';
    content.value = label;
    row.append(content);
  }
  const heading = element('div');
  heading.append(element('span', label), element('strong', text));
  const chart = svg('svg', { viewBox: '0 0 100 8', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  chart.append(svg('rect', { width: Math.min(100, Math.max(0, ratio * 100)), height: 8 }));
  content.append(heading, chart);
  return row;
}

function tableRow(values, rowHeader = false) {
  const tr = element('tr');
  for (const [index, value] of values.entries()) {
    const cell = element(rowHeader && index === 0 ? 'th' : 'td', typeof value === 'string' ? value : undefined);
    if (rowHeader && index === 0) cell.scope = 'row';
    if (typeof value !== 'string') cell.append(value);
    tr.append(cell);
  }
  return tr;
}

let tableScope;
let comparisonMonth;
let comparisonMeasure;

function renderMarket() {
  const rows = scope.value === 'city' ? city : boroughs[scope.value];
  const index = city.findIndex((row) => row.month === month.value);
  const row = rows[index];
  const keys = metric.value === 'rent' ? ['asking', 'effective'] : [metric.value];
  const primary = keys[0];
  get('market-kpis').replaceChildren(...Object.keys(labels).map((key) => {
    const tile = element('div');
    tile.append(element('dt', labels[key]), element('dd', format[key](row[key])));
    return tile;
  }));
  get('trend-title').textContent = scope.selectedOptions[0].text + ' trend';
  get('trend-legend').replaceChildren(...keys.map((key, i) => element('span', labels[key], i ? 'rental-legend-alt' : 'rental-legend-main')));
  get('trend-readout').textContent = monthLabel(row.month) + ' · ' + keys.map((key) => labels[key] + ' ' + format[key](row[key])).join(' · ');
  slider.value = String(index);
  slider.setAttribute('aria-valuetext', monthLabel(row.month));
  get('trend-month-label').textContent = monthLabel(row.month);
  previous.disabled = index === 0;
  next.disabled = index === city.length - 1;
  renderTrend(rows, keys, index);
  if (rows !== tableScope) {
    get('trend-rows').replaceChildren(...rows.map((entry) => tableRow([monthLabel(entry.month), ...Object.keys(labels).map((key) => format[key](entry[key]))], true)));
    tableScope = rows;
  }

  if (index !== comparisonMonth || primary !== comparisonMeasure) {
    const compared = names.map((name) => [name, boroughs[name][index][primary]]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    get('comparison-context').textContent = monthLabel(row.month) + ' · ' + labels[primary];
    comparison.replaceChildren(...compared.map(([name, value]) => bar(name, format[primary](value), value / (compared[0][1] || 1), true)));
    get('borough-note').textContent = 'Staten Island sample: ' + number.format(boroughs['Staten Island'][index].listings) + ' listings. Small samples can make monthly comparisons volatile.';
    comparisonMonth = index;
    comparisonMeasure = primary;
  }
  for (const button of comparison.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.value === scope.value));
  }
}

function selectMonth(index) {
  const value = city[Math.max(0, Math.min(city.length - 1, index))].month;
  if (month.value === value) return;
  month.value = value;
  renderMarket();
}

[month, scope, metric].forEach((input) => input.addEventListener('change', renderMarket));
slider.addEventListener('input', () => selectMonth(Number(slider.value)));
previous.addEventListener('click', () => selectMonth(Number(slider.value) - 1));
next.addEventListener('click', () => selectMonth(Number(slider.value) + 1));
comparison.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  scope.value = button.value;
  renderMarket();
});
renderMarket();
new ResizeObserver(() => renderTrend(trend.rows, trend.keys, Number(slider.value))).observe(chart);

let dragId = null;
function selectPointer(event) {
  const matrix = chart.getScreenCTM();
  if (!matrix) return;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  const last = city.length - 1;
  const fraction = (point.x - trend.x(0)) / (trend.x(last) - trend.x(0));
  selectMonth(Math.round(fraction * last));
}

chart.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary || event.button !== 0) return;
  dragId = event.pointerId;
  chart.setPointerCapture(event.pointerId);
  chart.classList.add('is-scrubbing');
  selectPointer(event);
});
chart.addEventListener('pointermove', (event) => {
  if (dragId === event.pointerId) selectPointer(event);
});
function finishDrag(event) {
  if (dragId !== event.pointerId) return;
  dragId = null;
  chart.classList.remove('is-scrubbing');
}
chart.addEventListener('pointerup', (event) => {
  if (dragId !== event.pointerId) return;
  selectPointer(event);
  finishDrag(event);
});
chart.addEventListener('pointercancel', finishDrag);
chart.addEventListener('lostpointercapture', finishDrag);

const rankBorough = get('rank-borough');
const rankTier = get('rank-tier');
const rankSort = get('rank-sort');
const rankSearch = get('rank-search');
options(rankBorough, [['', 'All scored boroughs'], ...names.filter((name) => scores.some((row) => row.borough === name)).map((name) => [name, name])]);
const pageSize = 8;
let page = 0;
let chosen;

function renderProfile(row) {
  const profile = get('rank-profile');
  if (!row) {
    profile.replaceChildren(element('h3', 'No matching neighborhoods'), element('p', 'Try a different borough, tier, or name.', 'rental-note'));
    return;
  }
  const score = element('p', row.score.toFixed(2) + ' ', 'rental-profile-score');
  score.append(element('small', '/ 100'));
  const facts = element('p', undefined, 'rental-profile-facts');
  facts.append(element('span', row.tier + ' tier'), element('span', number.format(row.listings) + ' listings'), element('span', money.format(row.asking) + ' median asking'));
  const componentList = element('ul', undefined, 'rental-components');
  componentList.append(...['Affordability', 'Rent momentum', 'Inventory momentum', 'Pricing power'].map((name, i) => (
    bar(name, row.components[i].toFixed(2), row.components[i] / 100)
  )));
  profile.replaceChildren(element('p', row.borough, 'rental-kicker'), element('h3', row.name), score, facts, componentList,
    element('p', 'May 2025 comparison sample: ' + number.format(row.prior) + ' listings.', 'rental-note'));
}

function renderRanks() {
  const rows = rankNeighborhoods(scores, { borough: rankBorough.value, tier: rankTier.value, search: rankSearch.value, sort: rankSort.value });
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visible = rows.slice(page * pageSize, (page + 1) * pageSize);
  if (!visible.includes(chosen)) chosen = visible[0];
  get('rank-status').textContent = rows.length + ' of ' + scores.length + ' scored neighborhoods';
  get('rank-page').textContent = 'Page ' + (page + 1) + ' of ' + pages;
  get('rank-prev').disabled = page === 0;
  get('rank-next').disabled = page + 1 >= pages;
  const buttons = [];
  get('rank-rows').replaceChildren(...visible.map((row) => {
    const pick = element('button', row.name);
    pick.type = 'button';
    pick.setAttribute('aria-pressed', String(row === chosen));
    buttons.push(pick);
    pick.addEventListener('click', () => {
      chosen = row;
      buttons.forEach((button) => button.setAttribute('aria-pressed', String(button === pick)));
      renderProfile(row);
    });
    return tableRow([pick, row.score.toFixed(2), number.format(row.listings), money.format(row.asking)]);
  }));
  renderProfile(chosen);
}

[rankBorough, rankTier, rankSort, rankSearch].forEach((input) => input.addEventListener('input', () => {
  page = 0;
  renderRanks();
}));
get('rank-prev').addEventListener('click', () => { page -= 1; renderRanks(); });
get('rank-next').addEventListener('click', () => { page += 1; renderRanks(); });
renderRanks();
