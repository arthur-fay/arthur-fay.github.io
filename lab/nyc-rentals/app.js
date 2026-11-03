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
const names = Object.keys(boroughs).sort();
options(month, city.map(({ month: value }) => [value, monthLabel(value)]).reverse());
options(scope, [['city', 'NYC citywide'], ...names.map((name) => [name, name])]);

function drawTrend(rows, keys, selected) {
  const chart = get('trend-chart');
  const points = rows.flatMap((row) => keys.map((key) => row[key]));
  const step = keys[0] === 'concessions' ? 2.5 : keys[0] === 'listings' ? Math.max(1, 10 ** Math.floor(Math.log10(Math.max(...points)) - 1)) : 250;
  const low = keys[0] === 'asking' ? Math.max(0, Math.floor((Math.min(...points) - step / 2) / step) * step) : 0;
  const interval = Math.max(step, Math.ceil((Math.max(...points) + step / 2 - low) / (4 * step)) * step);
  const high = low + 4 * interval;
  const x = (i) => 76 + i * 432 / (rows.length - 1);
  const y = (value) => 208 - 180 * (value - low) / (high - low);
  const nodes = [];
  for (let i = 0; i <= 4; i++) {
    const value = low + i * interval;
    nodes.push(svg('line', { x1: 76, x2: 508, y1: y(value), y2: y(value), class: 'rental-chart-grid' }),
      svg('text', { x: 67, y: y(value) + 4, 'text-anchor': 'end' }, format[keys[0]](value)));
  }
  [0, 5, 10, rows.length - 1].forEach((i) => {
    nodes.push(svg('text', { x: x(i), y: 234, 'text-anchor': 'middle' }, monthLabel(rows[i].month)));
  });
  nodes.push(svg('line', { x1: x(selected), x2: x(selected), y1: 28, y2: 208, class: 'rental-chart-cursor' }));
  keys.forEach((key, i) => {
    nodes.push(svg('polyline', {
      points: rows.map((row, j) => x(j) + ',' + y(row[key])).join(' '),
      class: i ? 'rental-series rental-series-alt' : 'rental-series',
    }), svg('circle', { cx: x(selected), cy: y(rows[selected][key]), r: 5, class: i ? 'rental-point rental-point-alt' : 'rental-point' }));
  });
  chart.replaceChildren(...nodes);
}

function bar(label, text, ratio) {
  const row = element('li');
  const heading = element('div');
  heading.append(element('span', label), element('strong', text));
  const chart = svg('svg', { viewBox: '0 0 100 8', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  chart.append(svg('rect', { width: Math.min(100, Math.max(0, ratio * 100)), height: 8 }));
  row.append(heading, chart);
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
  get('trend-legend').textContent = keys.length === 2 ? 'Solid line · Asking rent    /    Dashed line · Effective rent' : labels[primary];
  get('trend-readout').textContent = monthLabel(row.month) + ' · ' + keys.map((key) => labels[key] + ' ' + format[key](row[key])).join(' · ');
  drawTrend(rows, keys, index);
  get('trend-rows').replaceChildren(...rows.map((entry) => tableRow([monthLabel(entry.month), ...Object.keys(labels).map((key) => format[key](entry[key]))], true)));

  const compared = names.map((name) => [name, boroughs[name][index][primary]]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  get('comparison-context').textContent = monthLabel(row.month) + ' · ' + labels[primary];
  get('borough-bars').replaceChildren(...compared.map(([name, value]) => bar(name, format[primary](value), value / (compared[0][1] || 1))));
  get('borough-note').textContent = 'Staten Island sample: ' + number.format(boroughs['Staten Island'][index].listings) + ' listings. Small samples can make monthly comparisons volatile.';
}

[month, scope, metric].forEach((input) => input.addEventListener('change', renderMarket));
renderMarket();

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
