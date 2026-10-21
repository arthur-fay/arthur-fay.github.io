/**
 * Security Event Detection & Investigation Lab — UI module.
 *
 * Owns the DOM only. All data work is delegated to ./detection.js, which
 * generates the synthetic events, validates imports, runs the rules and
 * scores them. The UI runs the engine over the whole dataset whenever the
 * data or the thresholds change and keeps a cursor into the sorted events
 * for playback, so play, pause, step, reset and "show all" are cursor
 * operations and the screen can never disagree with the engine's output.
 *
 * Every piece of text is written with textContent or text nodes; nothing
 * from the data is ever interpreted as markup.
 */
import * as D from './detection.js';

const SPEEDS = Object.freeze([1, 2, 5, 10, 20, 50, 100, 250, 500, 1000]); // events per second
const PAGE_SIZE = 50;
const MARK_LIMIT = 3000; // above this many events the timeline draws binned bars instead of one mark per event
const SPAN_LIMIT = 3000; // at most this many alert spans are drawn
const MAX_LANES = 16;
const LANE_LABEL_CHARS = 17;
const EVIDENCE_ROWS = 25;
const ALERT_PAGE = 200; // alert buttons rendered per rule group before a "show more" control
const CITED_LIMIT = 5;
const DIFF_LIST_LIMIT = 12;
const ALERT_RENDER_THROTTLE_MS = 250;
const TEXTAREA_ECHO_LIMIT = 200 * 1024;
const RULE_CLASS = Object.freeze({ repeatedFailures: 'is-r1', passwordSpray: 'is-r2', successAfterFailures: 'is-r3' });
const FIELD_NAMES = Object.freeze({
  'repeatedFailures.threshold': 'R1 failures', 'repeatedFailures.windowSeconds': 'R1 window', 'repeatedFailures.enabled': 'R1 enabled',
  'passwordSpray.accounts': 'R2 distinct accounts', 'passwordSpray.windowSeconds': 'R2 window', 'passwordSpray.enabled': 'R2 enabled',
  'successAfterFailures.failures': 'R3 failures', 'successAfterFailures.windowSeconds': 'R3 window', 'successAfterFailures.scope': 'R3 scope', 'successAfterFailures.enabled': 'R3 enabled',
});
const CONFIG_INPUTS = Object.freeze([
  ['repeatedFailures', 'enabled', 'r1-enabled'], ['repeatedFailures', 'threshold', 'r1-threshold'], ['repeatedFailures', 'windowSeconds', 'r1-window'],
  ['passwordSpray', 'enabled', 'r2-enabled'], ['passwordSpray', 'accounts', 'r2-accounts'], ['passwordSpray', 'windowSeconds', 'r2-window'],
  ['successAfterFailures', 'enabled', 'r3-enabled'], ['successAfterFailures', 'failures', 'r3-failures'], ['successAfterFailures', 'windowSeconds', 'r3-window'], ['successAfterFailures', 'scope', 'r3-scope'],
]);

const byId = (id) => document.getElementById(id);
const dom = {
  datasetLabel: byId('dataset-label'),
  evalPrecisionStrict: byId('eval-precision-strict'),
  stats: { events: byId('stat-events'), successes: byId('stat-successes'), failures: byId('stat-failures'), accounts: byId('stat-accounts'), sources: byId('stat-sources'), alerts: byId('stat-alerts') },
  play: byId('play'), pause: byId('pause'), step: byId('step'), reset: byId('reset'), skip: byId('skip'),
  speed: byId('speed'), speedValue: byId('speed-value'),
  status: byId('lab-status'),
  timeline: byId('timeline'), timelineSummary: byId('timeline-summary'),
  alertsHeading: byId('alerts-heading'), alerts: byId('alerts'),
  detail: byId('detail'), detailBody: byId('detail-body'),
  preset: byId('preset'), presetHint: byId('preset-hint'), seed: byId('seed'), newSeed: byId('new-seed'), generate: byId('generate'), exportButton: byId('export'),
  configErrors: byId('config-errors'), configErrorsB: byId('config-errors-b'), resetThresholds: byId('reset-thresholds'),
  compare: byId('compare'), compareFields: byId('compare-fields'), copyToB: byId('copy-to-b'),
  filterOutcome: byId('filter-outcome'), filterAccount: byId('filter-account'), filterSource: byId('filter-source'), filterVerdict: byId('filter-verdict'), filterFlagged: byId('filter-flagged'), filterClear: byId('filter-clear'),
  tableStatus: byId('table-status'), eventRows: byId('event-rows'), pagePrev: byId('page-prev'), pageNext: byId('page-next'), pageStatus: byId('page-status'),
  evalUnavailable: byId('eval-unavailable'),
  eval: { alerts: byId('eval-alerts'), tp: byId('eval-tp'), fp: byId('eval-fp'), precision: byId('eval-precision'), recall: byId('eval-recall'), recallStrict: byId('eval-recall-strict'), missed: byId('eval-missed'), flagged: byId('eval-flagged') },
  scenarioRows: byId('scenario-rows'),
  comparison: byId('comparison'), comparisonNote: byId('comparison-note'), comparisonRows: byId('comparison-rows'), comparisonDiff: byId('comparison-diff'),
  importText: byId('import-text'), importFile: byId('import-file'), importLoad: byId('import-load'), importClear: byId('import-clear'), importRestore: byId('import-restore'), importResult: byId('import-result'),
  catalogue: byId('scenario-catalogue'),
};

const state = {
  source: { kind: 'synthetic', seed: D.DEFAULT_SEED, preset: 'mixed', label: '' },
  dataset: { events: [], scenarios: [] },
  configA: D.normaliseConfig(D.DEFAULT_CONFIG),
  configB: D.normaliseConfig(D.DEFAULT_CONFIG),
  compare: false,
  result: null,
  evaluation: null,
  resultB: null,
  evaluationB: null,
  eventsById: new Map(),
  alertsByEventId: new Map(),
  cursor: 0,
  playback: { status: 'idle', rafId: 0, lastTs: null, carry: 0 },
  speed: 6,
  selectedAlertId: null,
  filters: { outcome: 'all', account: '', source: '', verdict: 'all', flaggedOnly: false, ids: null, idsLabel: '' },
  page: 0,
  timeline: null,
  timelineWidth: 0,
  alertLimits: {},
  alertsRenderTimer: 0,
};

/* ------------------------------------------------------------------ helpers */

const integer = new Intl.NumberFormat('en-US');
const formatInt = (n) => integer.format(n);
const formatPercent = (value) => (value === null || value === undefined ? 'n/a' : `${(value * 100).toFixed(value === 1 || value === 0 ? 0 : 1)}%`);
const timeOnly = (ts) => D.formatUtc(ts, { date: false });
const tableTime = (ts) => D.formatUtc(ts, { millis: true }).replace(' UTC', '');

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

function svgEl(tag, attrs = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function setStat(element, value, note) {
  element.textContent = '';
  element.append(document.createTextNode(value));
  if (note) element.append(el('small', { text: note }));
}

function setStatus(message) {
  dom.status.textContent = message;
}

function clear(node) {
  node.textContent = '';
}

const rulePill = (ruleId) => el('span', { class: `rule-code ${RULE_CLASS[ruleId]}`, text: D.RULES[ruleId].code });
const verdictPill = (verdict) => el('span', { class: `label-pill is-${verdict}`, text: verdict });
const subjectText = (alert) => (alert.rule === 'successAfterFailures' ? `account ${alert.subject.account}` : `source ${alert.subject.source}`);

/* ------------------------------------------------------------ thresholds */

function readConfigFrom(prefix) {
  const config = { repeatedFailures: {}, passwordSpray: {}, successAfterFailures: {} };
  for (const [rule, key, id] of CONFIG_INPUTS) {
    const input = byId(prefix + id);
    if (key === 'enabled') config[rule][key] = input.checked;
    else if (key === 'scope') config[rule][key] = input.value;
    else {
      const raw = input.value.trim();
      config[rule][key] = raw === '' ? NaN : Number(raw);
    }
  }
  return config;
}

function writeConfigTo(prefix, config) {
  for (const [rule, key, id] of CONFIG_INPUTS) {
    const input = byId(prefix + id);
    if (key === 'enabled') input.checked = config[rule][key];
    else input.value = String(config[rule][key]);
  }
}

function showConfigErrors(list, prefix, errors) {
  clear(list);
  for (const [, , id] of CONFIG_INPUTS) byId(prefix + id).removeAttribute('aria-invalid');
  for (const error of errors) {
    const [rule, key] = error.path.split('.');
    const entry = CONFIG_INPUTS.find((row) => row[0] === rule && row[1] === key);
    if (entry) byId(prefix + entry[2]).setAttribute('aria-invalid', 'true');
    list.append(el('li', { text: `${FIELD_NAMES[error.path] ?? error.path}: ${error.message}.` }));
  }
  if (errors.length > 0) list.append(el('li', { text: prefix ? 'Set B was not applied; the comparison shows the last valid B.' : 'Thresholds were not applied; the last valid thresholds stay in force.' }));
}

/** Reads, validates and applies threshold set A (or B); returns true when the set was valid. */
function applyConfig(which, { announce = true } = {}) {
  const prefix = which === 'B' ? 'b-' : '';
  const validation = D.validateConfig(readConfigFrom(prefix));
  showConfigErrors(which === 'B' ? dom.configErrorsB : dom.configErrors, prefix, validation.errors);
  if (!validation.ok) {
    const n = validation.errors.length;
    if (which === 'B' && state.compare) recompute({ reason: 'configB', announce: false }); // the comparison keeps showing the last valid set B
    if (announce) setStatus(`${which === 'B' ? 'Threshold set B contains' : 'The thresholds contain'} ${n} invalid value${n === 1 ? '' : 's'}; see the message under the fields. The previous valid values stay in force.`);
    return false;
  }
  // A change event that leaves the thresholds as they are (for example the blur after typing the same value) must not
  // rebuild the page: a rebuild would, among other things, replace a button the visitor is in the middle of clicking.
  const current = which === 'B' ? state.configB : state.configA;
  if (D.configsEqual(validation.config, current) && (which === 'A' || state.resultB)) return true;
  if (which === 'B') state.configB = validation.config; else state.configA = validation.config;
  recompute({ reason: which === 'B' ? 'configB' : 'configA', announce });
  return true;
}

/* ------------------------------------------------------------- datasets */

function describeSource() {
  if (state.source.kind === 'import') return `Imported locally · ${formatInt(state.dataset.events.length)} events · not stored or transmitted`;
  return `Synthetic · ${D.PRESETS[state.source.preset].name} · seed ${formatInt(state.source.seed)}`;
}

function loadSynthetic(seed, preset, { announce = true } = {}) {
  const dataset = D.generateDataset({ seed, preset });
  state.source = { kind: 'synthetic', seed, preset, label: D.PRESETS[preset].name };
  state.dataset = { events: dataset.events, scenarios: dataset.scenarios };
  dom.importRestore.hidden = true;
  recompute({ reason: 'dataset', announce: false });
  if (announce) {
    const { summary } = state.result;
    setStatus(`Generated the preset “${D.PRESETS[preset].name}” from seed ${formatInt(seed)}: ${formatInt(summary.events)} synthetic events, ${formatInt(summary.alerts)} alert${summary.alerts === 1 ? '' : 's'} under the current thresholds. The same preset and seed always reproduce this dataset, in every browser.`);
  }
}

function loadImported(events, labelled) {
  state.source = { kind: 'import', seed: null, preset: null, label: 'Imported JSON' };
  state.dataset = { events, scenarios: [] };
  dom.importRestore.hidden = false;
  recompute({ reason: 'dataset', announce: false });
  const { summary } = state.result;
  setStatus(`Loaded ${formatInt(summary.events)} imported event${summary.events === 1 ? '' : 's'} from local JSON (${labelled ? 'with ground-truth labels' : 'without labels, so the scores are unavailable'}): ${formatInt(summary.alerts)} alert${summary.alerts === 1 ? '' : 's'} under the current thresholds. Nothing was uploaded or stored; reloading the page discards the import.`);
}

/* ------------------------------------------------------------- recompute */

/**
 * Runs the engine on the whole dataset for threshold set A (and B when
 * comparing), rebuilds the derived indexes and re-renders every view.
 * The playback cursor is clamped, and the selected alert is kept when the
 * same alert (by rule and subject) still exists under the new thresholds.
 */
function recompute({ reason, announce }) {
  const previousAlert = state.selectedAlertId && state.result ? state.result.alerts.find((a) => a.id === state.selectedAlertId) : null;
  state.result = D.detect(state.dataset.events, state.configA);
  state.evaluation = D.evaluate(state.result.events, state.result.alerts, state.dataset.scenarios);
  state.eventsById = new Map(state.result.events.map((e) => [e.id, e]));
  state.alertsByEventId = new Map();
  for (const alert of state.result.alerts) {
    for (const id of alert.evidence) {
      if (!state.alertsByEventId.has(id)) state.alertsByEventId.set(id, []);
      state.alertsByEventId.get(id).push(alert.id);
    }
  }
  if (state.compare) {
    state.resultB = D.detect(state.dataset.events, state.configB);
    state.evaluationB = D.evaluate(state.resultB.events, state.resultB.alerts, state.dataset.scenarios);
  } else {
    state.resultB = null;
    state.evaluationB = null;
  }
  const n = state.result.events.length;
  if (reason === 'dataset') {
    stopPlayback();
    state.alertLimits = {};
    state.cursor = n;
    state.filters = { outcome: 'all', account: '', source: '', verdict: 'all', flaggedOnly: false, ids: null, idsLabel: '' };
    syncFilterInputs();
    state.page = 0;
    state.selectedAlertId = null;
  } else {
    state.cursor = Math.min(state.cursor, n);
    if (state.filters.ids) state.filters = { ...state.filters, ids: null, idsLabel: '' };
    state.selectedAlertId = previousAlert ? (D.findCounterpart(previousAlert, state.result.alerts)?.id ?? null) : null;
  }
  dom.datasetLabel.textContent = describeSource();
  dom.filterVerdict.disabled = !(state.evaluation && state.evaluation.available);
  renderSummary();
  buildTimeline();
  renderAlerts();
  renderDetail();
  renderTable();
  renderEvaluation();
  renderComparison();
  updateButtons();
  if (announce && reason !== 'dataset') {
    const { summary } = state.result;
    const parts = D.RULE_ORDER.map((rule) => `${D.RULES[rule].code} ${formatInt(summary.byRule[rule])}`).join(', ');
    setStatus(reason === 'configB'
      ? `Threshold set B applied to the comparison: ${formatInt(state.resultB ? state.resultB.alerts.length : 0)} alerts under B versus ${formatInt(summary.alerts)} under A.`
      : `Thresholds applied to all ${formatInt(summary.events)} events: ${formatInt(summary.alerts)} alert${summary.alerts === 1 ? '' : 's'} (${parts}).`);
  }
}

function renderSummary() {
  const { summary } = state.result;
  setStat(dom.stats.events, formatInt(summary.events), state.source.kind === 'import' ? 'imported locally' : 'synthetic');
  setStat(dom.stats.successes, formatInt(summary.successes), 'sign-ins');
  setStat(dom.stats.failures, formatInt(summary.failures), 'attempts');
  setStat(dom.stats.accounts, formatInt(summary.accounts), 'pseudonymous');
  setStat(dom.stats.sources, formatInt(summary.sources), 'documentation IPs');
  setStat(dom.stats.alerts, formatInt(summary.alerts), D.RULE_ORDER.map((rule) => `${D.RULES[rule].code} ${formatInt(summary.byRule[rule])}`).join(' · '));
}

/* --------------------------------------------------------------- timeline */

const LABEL_W = 118;
const PAD_R = 14;
const AXIS_H = 26;
const LANE_H = 20;
const PAD_B = 8;
const MIN_W = 560;
const DAY = 86400;
const TICK_STEPS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, DAY, 2 * DAY, 7 * DAY, 14 * DAY, 30 * DAY, 91 * DAY, 182 * DAY, 365 * DAY, 730 * DAY, 1826 * DAY, 3652 * DAY, 7305 * DAY, 36525 * DAY];
const SPAN_SHAPES = Object.freeze({ repeatedFailures: { top: 1, height: LANE_H - 2, font: 9 }, passwordSpray: { top: 1, height: LANE_H / 2 - 1, font: 8 }, successAfterFailures: { top: LANE_H / 2, height: LANE_H / 2 - 1, font: 8 } });

function chooseLanes(events, alerts) {
  const counts = new Map();
  for (const event of events) counts.set(event.source, (counts.get(event.source) || 0) + 1);
  const priority = new Set(alerts.map((alert) => alert.subject.source));
  const sources = [...counts.keys()].sort((a, b) => {
    const pa = priority.has(a) ? 0 : 1;
    const pb = priority.has(b) ? 0 : 1;
    return pa - pb || counts.get(b) - counts.get(a) || a.localeCompare(b);
  });
  const shown = sources.slice(0, MAX_LANES);
  const rest = sources.slice(MAX_LANES);
  const lanes = shown.map((source) => ({ key: source, label: source, sources: [source], count: counts.get(source) }));
  const laneOf = new Map(shown.map((source, i) => [source, i]));
  if (rest.length > 0) {
    lanes.push({ key: '__other__', label: `${rest.length} other source${rest.length === 1 ? '' : 's'}`, sources: rest, count: rest.reduce((n, s) => n + counts.get(s), 0) });
    for (const source of rest) laneOf.set(source, lanes.length - 1);
  }
  return { lanes, laneOf };
}

function chooseTickStep(spanMs, plotW) {
  const maxTicks = Math.max(3, Math.floor(plotW / 84));
  for (const step of TICK_STEPS) if (spanMs / (step * 1000) <= maxTicks) return { stepMs: step * 1000, maxTicks };
  return { stepMs: Math.ceil(spanMs / maxTicks), maxTicks }; // never more than maxTicks ticks, whatever the span
}

function buildTimeline() {
  const { events, alerts } = state.result;
  clear(dom.timeline);
  const width = Math.max(MIN_W, dom.timeline.clientWidth || 0);
  state.timelineWidth = dom.timeline.clientWidth || 0;
  const svg = svgEl('svg', { role: 'img', xmlns: 'http://www.w3.org/2000/svg' });
  if (events.length === 0) {
    svg.setAttribute('viewBox', `0 0 ${width} 120`);
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', '120');
    svg.setAttribute('aria-label', 'Empty timeline: no events are loaded.');
    const text = svgEl('text', { x: width / 2, y: 64, 'text-anchor': 'middle', class: 'tl-empty' });
    text.textContent = 'No events loaded. Generate a dataset or import synthetic events.';
    svg.append(text);
    dom.timeline.append(svg);
    state.timeline = null;
    dom.timelineSummary.textContent = 'The timeline is empty because no events are loaded.';
    return;
  }
  const { lanes, laneOf } = chooseLanes(events, alerts);
  const t0 = events[0].ts;
  const t1 = events[events.length - 1].ts;
  const plotX = LABEL_W;
  const plotW = width - LABEL_W - PAD_R;
  const height = AXIS_H + lanes.length * LANE_H + PAD_B;
  const scale = (ts) => (t1 === t0 ? plotX + plotW / 2 : plotX + ((ts - t0) / (t1 - t0)) * plotW);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  const binned = events.length > MARK_LIMIT;
  // Lane backgrounds and labels.
  lanes.forEach((lane, i) => {
    const y = AXIS_H + i * LANE_H;
    if (i % 2 === 0) svg.append(svgEl('rect', { x: plotX, y, width: plotW, height: LANE_H, class: 'tl-lane-bg' }));
    const label = svgEl('text', { x: LABEL_W - 8, y: y + LANE_H / 2 + 3.5, 'text-anchor': 'end', class: 'tl-lane-label' });
    label.textContent = lane.label.length > LANE_LABEL_CHARS ? `…${lane.label.slice(-(LANE_LABEL_CHARS - 1))}` : lane.label;
    const full = svgEl('title');
    full.textContent = lane.label;
    label.append(full);
    svg.append(label);
  });
  // Axis.
  const date = D.formatUtc(t0).slice(0, 10);
  const dateText = svgEl('text', { x: 8, y: 16, class: 'tl-date' });
  dateText.textContent = `${date} UTC`;
  svg.append(dateText);
  const { stepMs, maxTicks } = chooseTickStep(t1 - t0, plotW);
  const firstTick = Math.ceil(t0 / stepMs) * stepMs;
  const dateTicks = stepMs >= DAY * 1000;
  for (let tick = firstTick, count = 0; tick <= t1 && count <= maxTicks; tick += stepMs, count += 1) {
    const x = scale(tick);
    svg.append(svgEl('line', { x1: x, y1: AXIS_H - 4, x2: x, y2: height - PAD_B, class: 'tl-grid' }));
    const label = svgEl('text', { x, y: 16, 'text-anchor': 'middle', class: 'tl-axis-label' });
    label.textContent = dateTicks ? D.formatUtc(tick).slice(0, 10) : D.formatUtc(tick, { date: false }).slice(0, 5);
    svg.append(label);
  }
  // Events.
  const marks = [];
  const bins = [];
  const defs = svgEl('defs');
  const hatch = svgEl('pattern', { id: 'tl-hatch', width: 4, height: 4, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  hatch.append(svgEl('rect', { x: 0, y: 0, width: 2, height: 4, class: 'tl-hatch-stripe' }));
  defs.append(hatch);
  svg.append(defs);
  if (!binned) {
    for (const event of events) {
      const lane = laneOf.get(event.source);
      const x = scale(event.ts);
      const tall = event.outcome === 'failure';
      const h = tall ? LANE_H - 6 : LANE_H - 12;
      const mark = svgEl('rect', { x: (x - 1.5).toFixed(2), y: AXIS_H + lane * LANE_H + (LANE_H - h) / 2, width: 3, height: h, class: `tl-mark is-${event.outcome}` });
      marks.push(mark);
      svg.append(mark);
    }
  } else {
    const binCount = Math.max(1, Math.floor(plotW / 4));
    const binMs = (t1 - t0 + 1) / binCount;
    const table = lanes.map(() => new Map());
    for (const event of events) {
      const lane = laneOf.get(event.source);
      const bin = Math.min(binCount - 1, Math.floor((event.ts - t0) / binMs));
      let cell = table[lane].get(bin);
      if (!cell) { cell = { success: 0, failure: 0 }; table[lane].set(bin, cell); }
      cell[event.outcome] += 1;
    }
    let maxCount = 1;
    for (const laneBins of table) for (const cell of laneBins.values()) maxCount = Math.max(maxCount, cell.success + cell.failure);
    table.forEach((laneBins, lane) => {
      for (const [bin, cell] of laneBins) {
        const total = cell.success + cell.failure;
        const h = Math.max(2, Math.sqrt(total / maxCount) * (LANE_H - 6));
        const failureH = h * (cell.failure / total);
        const startTs = t0 + bin * binMs;
        const x = (plotX + bin * (plotW / binCount)).toFixed(2);
        const w = Math.max(1, plotW / binCount - 1).toFixed(2);
        const bottom = AXIS_H + lane * LANE_H + (LANE_H - 3);
        const group = svgEl('g', { class: 'tl-bin' });
        if (cell.success > 0) group.append(svgEl('rect', { x, y: (bottom - (h - failureH)).toFixed(2), width: w, height: (h - failureH).toFixed(2), class: 'tl-bin-part is-success' }));
        if (cell.failure > 0) {
          group.append(svgEl('rect', { x, y: (bottom - h).toFixed(2), width: w, height: failureH.toFixed(2), class: 'tl-bin-part is-failure' }));
          group.append(svgEl('rect', { x, y: (bottom - h).toFixed(2), width: w, height: failureH.toFixed(2), fill: 'url(#tl-hatch)', class: 'tl-bin-hatch' }));
        }
        const title = svgEl('title');
        title.textContent = `${formatInt(total)} events (${formatInt(cell.failure)} failures, hatched) from ${timeOnly(startTs)} in lane ${lanes[lane].label}`;
        group.append(title);
        bins.push({ node: group, startTs });
        svg.append(group);
      }
    });
  }
  // Alert spans on the lane of the subject source: R1 fills the lane, R2 its upper half, R3 its lower half, so overlapping alerts stay visible.
  const spans = [];
  for (const alert of alerts.slice(0, SPAN_LIMIT)) {
    const lane = laneOf.get(alert.subject.source);
    const shape = SPAN_SHAPES[alert.rule];
    const x1 = scale(alert.firstTs);
    const x2 = Math.max(x1 + 3, scale(alert.lastTs));
    const y = AXIS_H + lane * LANE_H + shape.top;
    const rect = svgEl('rect', { x: x1.toFixed(2), y, width: (x2 - x1).toFixed(2), height: shape.height, class: `tl-alert ${RULE_CLASS[alert.rule]}`, 'data-alert': alert.id });
    const title = svgEl('title');
    title.textContent = `${alert.id} (${D.RULES[alert.rule].code}): ${D.explainAlert(alert).headline}`;
    rect.append(title);
    rect.addEventListener('click', () => selectAlert(alert.id, { focus: false }));
    svg.append(rect);
    let code = null;
    if (x2 - x1 >= 30) {
      code = svgEl('text', { x: (x1 + 4).toFixed(2), y: (y + shape.height / 2 + shape.font / 2 - 1).toFixed(2), class: `tl-alert-code${shape.font < 9 ? ' is-small' : ''}` });
      code.textContent = alert.id;
      svg.append(code);
    }
    spans.push({ alert, rect, code });
  }
  const cursorLine = svgEl('line', { x1: plotX, y1: AXIS_H - 4, x2: plotX, y2: height - PAD_B, class: 'tl-cursor' });
  svg.append(cursorLine);
  dom.timeline.append(svg);
  state.timeline = { svg, lanes, laneOf, scale, marks, bins, spans, cursorLine, binned, t0, t1, sourcesShown: lanes.filter((l) => l.key !== '__other__').length, sourcesTotal: new Set(events.map((e) => e.source)).size };
  updateTimelineReveal(0, state.cursor, { force: true });
  updateTimelineSummary();
}

/** Applies the playback cursor to the drawing; only the marks between the previous and the new cursor are touched. */
function updateTimelineReveal(previous, cursor, { force = false } = {}) {
  const tl = state.timeline;
  if (!tl) return;
  const { events } = state.result;
  const cursorTs = cursor > 0 ? events[cursor - 1].ts : null;
  if (!tl.binned) {
    const from = force ? 0 : Math.min(previous, cursor);
    const to = force ? events.length : Math.max(previous, cursor);
    for (let i = from; i < to; i += 1) tl.marks[i].classList.toggle('is-future', i >= cursor);
  } else {
    for (const bin of tl.bins) bin.node.classList.toggle('is-future', cursorTs === null || bin.startTs > cursorTs);
  }
  for (const span of tl.spans) {
    const hidden = span.alert.triggerIndex >= cursor;
    span.rect.classList.toggle('is-hidden', hidden);
    span.rect.classList.toggle('is-selected', span.alert.id === state.selectedAlertId);
    if (span.code) span.code.classList.toggle('is-hidden', hidden);
  }
  const x = cursorTs === null ? tl.scale(tl.t0) : tl.scale(cursorTs);
  tl.cursorLine.setAttribute('x1', x.toFixed(2));
  tl.cursorLine.setAttribute('x2', x.toFixed(2));
  tl.cursorLine.classList.toggle('is-hidden', cursor >= events.length);
}

function updateTimelineSummary() {
  const tl = state.timeline;
  if (!tl) return;
  const { events, alerts, summary } = state.result;
  const visibleAlerts = alerts.filter((a) => a.triggerIndex < state.cursor).length;
  const byRule = D.RULE_ORDER.map((rule) => `${D.RULES[rule].code} ×${formatInt(summary.byRule[rule])}`).join(', ');
  const position = state.cursor >= events.length ? 'all events are shown' : `${formatInt(state.cursor)} of ${formatInt(events.length)} events replayed, ${formatInt(visibleAlerts)} alert${visibleAlerts === 1 ? '' : 's'} so far`;
  const sameDay = D.formatUtc(tl.t0).slice(0, 10) === D.formatUtc(tl.t1).slice(0, 10);
  const span = sameDay ? `from ${timeOnly(tl.t0)} to ${timeOnly(tl.t1)} on ${D.formatUtc(tl.t0).slice(0, 10)}` : `from ${D.formatUtc(tl.t0)} to ${D.formatUtc(tl.t1)}`;
  const spanNote = alerts.length > SPAN_LIMIT ? ` (only the first ${formatInt(SPAN_LIMIT)} spans are drawn)` : '';
  const text = `Timeline of ${formatInt(events.length)} ${state.source.kind === 'import' ? 'imported' : 'synthetic'} events ${span}, one lane per source (${formatInt(tl.sourcesShown)} of ${formatInt(tl.sourcesTotal)} sources shown individually${tl.sourcesTotal > tl.sourcesShown ? ', the rest aggregated in the last lane' : ''}). ${tl.binned ? 'Events are binned into stacked bars because there are many of them; the hatched upper part of a bar is its failures.' : `Marks: ${formatInt(summary.successes)} successes (short marks) and ${formatInt(summary.failures)} failures (tall marks).`} Alert spans: ${formatInt(alerts.length)} (${byRule})${spanNote}; R1 spans fill a lane, R2 spans its upper half and R3 spans its lower half. Replay position: ${position}.`;
  dom.timelineSummary.textContent = text;
  tl.svg.setAttribute('aria-label', text);
}

/* --------------------------------------------------------------- playback */

function updateButtons() {
  const focused = document.activeElement;
  const n = state.result ? state.result.events.length : 0;
  const { status } = state.playback;
  dom.play.disabled = n === 0 || status === 'playing';
  dom.pause.disabled = !(status === 'playing' || status === 'paused');
  dom.pause.textContent = status === 'paused' ? 'Resume' : 'Pause';
  dom.step.disabled = n === 0 || state.cursor >= n;
  dom.reset.disabled = n === 0 || (state.cursor === 0 && status === 'idle');
  dom.skip.disabled = n === 0 || state.cursor >= n;
  dom.exportButton.disabled = n === 0;
  if (focused && focused !== document.body && focused.disabled) {
    // Pause is the natural next action after Play; Play is the natural next action once playback stops.
    const fallback = [dom.pause, dom.play, dom.reset, dom.skip, dom.step].find((button) => !button.disabled) || dom.speed;
    fallback.focus();
  }
}

function setCursor(next) {
  const n = state.result.events.length;
  const cursor = Math.max(0, Math.min(n, next));
  const previous = state.cursor;
  if (cursor === previous) return;
  const previouslyVisible = state.result.alerts.filter((a) => a.triggerIndex < previous).length;
  state.cursor = cursor;
  updateTimelineReveal(previous, cursor);
  const nowVisible = state.result.alerts.filter((a) => a.triggerIndex < cursor).length;
  if (nowVisible !== previouslyVisible) {
    if (state.selectedAlertId) {
      const selected = state.result.alerts.find((a) => a.id === state.selectedAlertId);
      if (selected && selected.triggerIndex >= cursor) {
        state.selectedAlertId = null;
        renderDetail();
      }
    }
    scheduleAlertsRender();
  }
  updateTimelineSummary();
}

/** During playback the alert list is rebuilt at most a few times per second; otherwise immediately. */
function scheduleAlertsRender() {
  if (state.playback.status !== 'playing') {
    clearTimeout(state.alertsRenderTimer);
    state.alertsRenderTimer = 0;
    renderAlerts();
    return;
  }
  if (state.alertsRenderTimer) return;
  state.alertsRenderTimer = setTimeout(() => {
    state.alertsRenderTimer = 0;
    renderAlerts();
  }, ALERT_RENDER_THROTTLE_MS);
}

function stopPlayback() {
  cancelAnimationFrame(state.playback.rafId);
  state.playback = { status: 'idle', rafId: 0, lastTs: null, carry: 0 };
  if (state.alertsRenderTimer) scheduleAlertsRender();
}

function play() {
  const n = state.result.events.length;
  if (n === 0) {
    setStatus('There are no events to replay. Generate a dataset or import synthetic events first.');
    return;
  }
  if (state.cursor >= n) setCursor(0);
  state.playback = { status: 'playing', rafId: 0, lastTs: null, carry: 0 };
  setStatus(`Replaying ${formatInt(n)} events at ${formatInt(SPEEDS[state.speed - 1])} per second from ${state.cursor === 0 ? 'the start' : `event ${formatInt(state.cursor + 1)}`}. Alerts appear the moment their trigger event arrives.`);
  updateButtons();
  state.playback.rafId = requestAnimationFrame(frame);
}

function frame(timestamp) {
  const playback = state.playback;
  if (playback.status !== 'playing') return;
  const dt = playback.lastTs === null ? 1000 / 60 : Math.min(250, timestamp - playback.lastTs); // a hidden tab never produces one giant jump
  playback.lastTs = timestamp;
  playback.carry += (dt * SPEEDS[state.speed - 1]) / 1000;
  const budget = Math.floor(playback.carry);
  playback.carry -= budget;
  if (budget > 0) setCursor(state.cursor + budget);
  if (state.cursor >= state.result.events.length) {
    finishPlayback();
    return;
  }
  // Progress is shown in the (non-live) timeline summary and the alerts heading; the live status only changes on state transitions.
  playback.rafId = requestAnimationFrame(frame);
}

function finishPlayback() {
  stopPlayback();
  const { summary } = state.result;
  setStatus(`Replay complete: ${formatInt(summary.events)} events, ${formatInt(summary.alerts)} alert${summary.alerts === 1 ? '' : 's'} under the current thresholds. Press Play to replay from the start, or select an alert to investigate it.`);
  updateButtons();
}

function pause() {
  if (state.playback.status !== 'playing') return;
  cancelAnimationFrame(state.playback.rafId);
  state.playback.status = 'paused';
  if (state.alertsRenderTimer) scheduleAlertsRender();
  setStatus(`Paused after ${formatInt(state.cursor)} of ${formatInt(state.result.events.length)} events. Resume, step one event at a time, or reset.`);
  updateButtons();
}

function resume() {
  if (state.playback.status !== 'paused') return;
  state.playback.status = 'playing';
  state.playback.lastTs = null;
  state.playback.carry = 0;
  setStatus('Resumed the replay.');
  updateButtons();
  state.playback.rafId = requestAnimationFrame(frame);
}

function step() {
  const n = state.result.events.length;
  if (n === 0) return;
  if (state.playback.status === 'playing') {
    cancelAnimationFrame(state.playback.rafId);
    state.playback.status = 'paused';
    if (state.alertsRenderTimer) scheduleAlertsRender();
  }
  if (state.cursor >= n) {
    updateButtons();
    return;
  }
  const before = state.result.alerts.filter((a) => a.triggerIndex < state.cursor).length;
  setCursor(state.cursor + 1);
  const event = state.result.events[state.cursor - 1];
  const created = state.result.alerts.filter((a) => a.triggerIndex === state.cursor - 1);
  const totalVisible = before + created.length;
  let message = `Step ${formatInt(state.cursor)} of ${formatInt(n)}: ${timeOnly(event.ts)}, ${event.outcome} for ${event.account} from ${event.source}${event.reason ? ` (${event.reason})` : ''}.`;
  if (created.length > 0) message += ` New alert${created.length === 1 ? '' : 's'}: ${created.map((a) => `${a.id} (${D.RULES[a.rule].code})`).join(', ')}.`;
  message += ` ${formatInt(totalVisible)} alert${totalVisible === 1 ? '' : 's'} so far.`;
  setStatus(message);
  if (state.cursor >= n) {
    stopPlayback();
    setStatus(`${message} Replay complete.`);
  }
  updateButtons();
}

function resetPlayback() {
  stopPlayback();
  setCursor(0);
  setStatus('Replay reset: no events have arrived yet and no alerts are shown. Press Play or Step to start.');
  updateButtons();
}

function skipToEnd() {
  stopPlayback();
  setCursor(state.result.events.length);
  const { summary } = state.result;
  setStatus(`Showing all ${formatInt(summary.events)} events and all ${formatInt(summary.alerts)} alert${summary.alerts === 1 ? '' : 's'}.`);
  updateButtons();
}

function updateSpeedLabel() {
  const perSecond = SPEEDS[state.speed - 1];
  dom.speedValue.textContent = `${formatInt(perSecond)} ev / s`;
  dom.speed.setAttribute('aria-valuetext', `${formatInt(perSecond)} events per second`);
}

/* ----------------------------------------------------------------- alerts */

function visibleAlerts() {
  return state.result.alerts.filter((alert) => alert.triggerIndex < state.cursor);
}

function renderAlerts() {
  const { alerts, events } = state.result;
  const shown = visibleAlerts();
  clear(dom.alerts);
  dom.alertsHeading.textContent = state.cursor >= events.length || alerts.length === 0
    ? `Alerts · ${formatInt(alerts.length)}`
    : `Alerts · ${formatInt(shown.length)} of ${formatInt(alerts.length)} so far`;
  if (events.length === 0) {
    dom.alerts.append(el('p', { class: 'empty-state', text: 'No events are loaded, so there is nothing to detect. Generate a synthetic dataset or import one.' }));
    return;
  }
  if (shown.length === 0) {
    let text;
    if (state.cursor === 0) text = 'No events have been replayed yet. Press Play or Step to see alerts appear as their trigger events arrive, or “Show all” to jump to the end.';
    else if (alerts.length === 0) {
      const enabled = D.RULE_ORDER.filter((rule) => state.configA[rule].enabled);
      text = enabled.length === 0
        ? 'All three rules are disabled, so no alert can be raised. Enable a rule in the thresholds panel.'
        : `No alerts: none of the ${formatInt(events.length)} events reached an enabled rule's threshold (${enabled.map((rule) => `${D.RULES[rule].code}: ${describeThreshold(rule)}`).join('; ')}). Lower a threshold, widen a window, or try another preset or seed.`;
    } else text = `No alerts so far: ${formatInt(state.cursor)} of ${formatInt(events.length)} events replayed. The first alert triggers at event ${formatInt(alerts[0].triggerIndex + 1)}.`;
    dom.alerts.append(el('p', { class: 'empty-state', text }));
    return;
  }
  for (const group of D.groupAlerts(shown)) {
    const section = el('section', { class: 'alert-rule', 'aria-labelledby': `alerts-${group.rule}` });
    section.append(el('h4', { id: `alerts-${group.rule}` }, [rulePill(group.rule), `${group.name} · ${formatInt(group.total)}`]));
    if (group.total === 0) {
      section.append(el('p', { class: 'alert-rule-empty', text: state.configA[group.rule].enabled ? 'No alerts from this rule.' : 'Rule disabled.' }));
    }
    const limit = state.alertLimits[group.rule] ?? ALERT_PAGE;
    let rendered = 0;
    let remaining = 0;
    for (const subject of group.groups) {
      if (rendered >= limit) {
        remaining += subject.alerts.length;
        continue;
      }
      const block = el('div', { class: 'alert-subject' });
      block.append(el('p', { class: 'alert-subject-label' }, [`${D.RULES[group.rule].subject === 'account' ? 'Account' : 'Source'} `, el('strong', { text: subject.label }), ` · ${formatInt(subject.alerts.length)} alert${subject.alerts.length === 1 ? '' : 's'}`]));
      const list = el('div', { class: 'alert-buttons' });
      for (const alert of subject.alerts) {
        if (rendered >= limit) {
          remaining += 1;
          continue;
        }
        rendered += 1;
        const explanation = D.explainAlert(alert);
        const button = el('button', { type: 'button', class: `alert-button ${RULE_CLASS[alert.rule]}`, 'aria-pressed': String(alert.id === state.selectedAlertId), 'data-alert': alert.id });
        button.append(el('span', { class: 'alert-button-head' }, [el('span', { class: `rule-code ${RULE_CLASS[alert.rule]}`, text: alert.id }), explanation.headline]));
        button.append(el('span', { class: 'alert-button-meta', text: `${timeOnly(alert.firstTs)} → ${timeOnly(alert.lastTs)} · ${formatInt(alert.evidence.length)} event${alert.evidence.length === 1 ? '' : 's'}${alert.rule === 'successAfterFailures' ? ` · ${formatInt(alert.metrics.distinctSources)} source${alert.metrics.distinctSources === 1 ? '' : 's'}` : ` · ${formatInt(alert.metrics.distinctAccounts)} account${alert.metrics.distinctAccounts === 1 ? '' : 's'}`}` }));
        button.addEventListener('click', (event) => selectAlert(alert.id, { focus: event.detail === 0 }));
        list.append(button);
      }
      block.append(list);
      section.append(block);
    }
    if (remaining > 0) {
      const more = el('button', { type: 'button', class: 'button button-outline button-small', text: `Show ${formatInt(Math.min(ALERT_PAGE, remaining))} more of ${formatInt(remaining)} remaining ${D.RULES[group.rule].code} alerts` });
      more.addEventListener('click', () => {
        state.alertLimits[group.rule] = limit + ALERT_PAGE;
        renderAlerts();
        const buttons = dom.alerts.querySelectorAll(`section[aria-labelledby="alerts-${group.rule}"] .alert-button`);
        const target = buttons[Math.min(limit, buttons.length - 1)];
        if (target) target.focus();
      });
      section.append(el('p', { class: 'alert-rule-empty', text: `${formatInt(rendered)} of ${formatInt(rendered + remaining)} alerts shown.` }), more);
    }
    dom.alerts.append(section);
  }
}

function describeThreshold(rule) {
  const c = state.configA[rule];
  if (rule === 'repeatedFailures') return `${c.threshold} failures within ${D.formatWindow(c.windowSeconds)}`;
  if (rule === 'passwordSpray') return `${c.accounts} accounts within ${D.formatWindow(c.windowSeconds)}`;
  return `${c.failures} failures within ${D.formatWindow(c.windowSeconds)} before a success, ${c.scope} scope`;
}

function selectAlert(id, { focus = false } = {}) {
  state.selectedAlertId = state.selectedAlertId === id ? null : id;
  for (const button of dom.alerts.querySelectorAll('.alert-button')) button.setAttribute('aria-pressed', String(button.dataset.alert === state.selectedAlertId));
  if (state.timeline) for (const span of state.timeline.spans) span.rect.classList.toggle('is-selected', span.alert.id === state.selectedAlertId);
  renderDetail();
  if (focus && state.selectedAlertId) dom.detail.focus({ preventScroll: false });
}

/* ------------------------------------------------------------ investigation */

function groundTruthBlock(alert) {
  const block = el('div', { class: 'detail-block is-verdict' });
  block.append(el('h4', { text: 'Synthetic ground truth' }));
  const evaluation = state.evaluation;
  if (!evaluation || !evaluation.available) {
    block.append(el('p', {}, [el('span', { class: 'verdict-pill is-na', text: 'n/a' }), evaluation ? evaluation.reason : 'No ground truth is available for this dataset.']));
    return block;
  }
  const row = evaluation.alerts.rows.find((r) => r.id === alert.id);
  const scenarios = row.scenarios.map((key) => evaluation.scenarios.rows.find((s) => s.id === key));
  const p = el('p', {}, [el('span', { class: `verdict-pill ${row.truePositive ? 'is-tp' : 'is-fp'}`, text: row.truePositive ? 'True positive' : 'False positive' })]);
  p.append(`Its evidence touches ${scenarios.length === 1 ? 'one scenario' : `${scenarios.length} scenarios`}: `);
  scenarios.forEach((scenario, k) => {
    p.append(el('strong', { text: `${scenario.id} ${scenario.title}` }), ' (', verdictPill(scenario.verdict), ')', k < scenarios.length - 1 ? ', ' : '. ');
  });
  if (row.truePositive && row.truePositiveStrict) p.append('By the lab\u2019s definition this alert is a true positive, and a strict one: the event that triggered it was planted as suspicious. That is a statement about the synthetic labels, not a proof that the rule would catch a real attack.');
  else if (row.truePositive) p.append('By the lab\u2019s definition this alert is a true positive because at least one cited event was planted as suspicious, but only leniently: the event that triggered it was planted as benign (typically a victim\u2019s own routine sign-in after an attack), so it does not count towards strict precision. That is a statement about the synthetic labels, not a proof that the rule would catch a real attack.');
  else p.append('Every cited event was planted as benign, so by the lab\u2019s definition this alert is a false positive: the rule saw a pattern that a benign scenario also produces.');
  block.append(p);
  return block;
}

function renderDetail() {
  clear(dom.detailBody);
  const alert = state.selectedAlertId ? state.result.alerts.find((a) => a.id === state.selectedAlertId) : null;
  if (!alert) {
    dom.detailBody.append(el('p', { class: 'empty-state', text: state.result.alerts.length === 0
      ? 'The investigation view opens when an alert is selected. There are no alerts under the current data and thresholds.'
      : 'Select an alert from the list to see which events triggered it, how the rule’s definition was met, and why that is a reason to investigate rather than proof of compromise.' }));
    return;
  }
  const explanation = D.explainAlert(alert);
  const rule = D.RULES[alert.rule];
  dom.detailBody.append(el('p', { class: 'detail-headline', text: `${alert.id} · ${explanation.headline}` }));
  const chips = el('ul', { class: 'detail-chips' });
  chips.append(el('li', {}, [rulePill(alert.rule), ` ${rule.name}`]));
  if (alert.rule === 'successAfterFailures') {
    chips.append(el('li', {}, ['Account ', el('strong', { text: alert.subject.account })]));
    chips.append(el('li', {}, ['Success from ', el('strong', { text: alert.subject.source })]));
  } else chips.append(el('li', {}, ['Source ', el('strong', { text: alert.subject.source })]));
  chips.append(el('li', {}, ['Window ', el('strong', { text: `${timeOnly(alert.windowStart)} → ${timeOnly(alert.windowEnd)}` })]));
  chips.append(el('li', {}, ['Evidence ', el('strong', { text: `${formatInt(alert.evidence.length)} events` })]));
  chips.append(el('li', {}, ['Trigger ', el('strong', { text: alert.triggerEventId })]));
  dom.detailBody.append(chips);
  const sections = [['What the rule saw', explanation.detail], ['Why it is suspicious, and what it does not prove', explanation.caveat], ['What an analyst would check next', explanation.nextSteps]];
  for (const [title, text] of sections) dom.detailBody.append(el('div', { class: 'detail-block' }, [el('h4', { text: title }), el('p', { text })]));
  dom.detailBody.append(groundTruthBlock(alert));
  const evidence = el('div', { class: 'detail-block' });
  const shownEvidence = alert.evidence.slice(0, EVIDENCE_ROWS).map((id) => state.eventsById.get(id));
  const days = [...new Set(shownEvidence.map((event) => D.formatUtc(event.ts).slice(0, 10)))];
  const dayLabel = days.length === 1 ? `${days[0]} UTC` : `${days[0]} to ${days[days.length - 1]} UTC`;
  evidence.append(el('h4', { text: `${alert.evidence.length > EVIDENCE_ROWS ? `Evidence (first ${EVIDENCE_ROWS} of ${formatInt(alert.evidence.length)} events)` : `Evidence (${formatInt(alert.evidence.length)} event${alert.evidence.length === 1 ? '' : 's'})`} · ${dayLabel}` }));
  const table = el('table', { class: 'evidence-table' });
  table.append(el('thead', {}, [el('tr', {}, ['#', 'Time', 'Outcome', 'Account', 'Source', 'Reason'].map((text) => el('th', { scope: 'col', text })))]));
  const body = el('tbody');
  for (const event of shownEvidence) {
    const id = event.id;
    const tr = el('tr', { class: id === alert.triggerEventId ? 'is-trigger' : undefined });
    tr.append(el('td', { text: String(event.index + 1) }));
    tr.append(el('td', { text: D.formatUtc(event.ts, { date: false, millis: true }).replace(' UTC', '') }));
    tr.append(el('td', {}, [el('span', { class: `outcome-pill is-${event.outcome}`, text: event.outcome }), id === alert.triggerEventId ? ' (trigger)' : '']));
    tr.append(el('td', { text: event.account }));
    tr.append(el('td', { text: event.source }));
    tr.append(el('td', { text: event.reason || '—' }));
    body.append(tr);
  }
  table.append(body);
  evidence.append(el('div', { class: 'evidence-wrap' }, [table]));
  dom.detailBody.append(evidence);
  const actions = el('div', { class: 'detail-actions' });
  const show = el('button', { type: 'button', class: 'button button-outline button-small', text: 'Show all cited events in the table' });
  show.addEventListener('click', () => {
    state.filters = { outcome: 'all', account: '', source: '', verdict: 'all', flaggedOnly: false, ids: new Set(alert.evidence), idsLabel: alert.id };
    syncFilterInputs();
    state.page = 0;
    renderTable();
    byId('events').scrollIntoView({ block: 'start' });
    dom.filterOutcome.focus({ preventScroll: true });
  });
  const close = el('button', { type: 'button', class: 'button button-outline button-small', text: 'Clear selection' });
  close.addEventListener('click', () => selectAlert(alert.id));
  actions.append(show, close);
  dom.detailBody.append(actions);
}

/* ------------------------------------------------------------------ table */

function syncFilterInputs() {
  dom.filterOutcome.value = state.filters.outcome;
  dom.filterAccount.value = state.filters.account;
  dom.filterSource.value = state.filters.source;
  dom.filterVerdict.value = state.filters.verdict;
  dom.filterFlagged.checked = state.filters.flaggedOnly;
}

function filteredEvents() {
  const f = state.filters;
  const account = f.account.trim().toLowerCase();
  const source = f.source.trim().toLowerCase();
  return state.result.events.filter((event) => {
    if (f.ids && !f.ids.has(event.id)) return false;
    if (f.outcome !== 'all' && event.outcome !== f.outcome) return false;
    if (account && !event.account.toLowerCase().includes(account)) return false;
    if (source && !event.source.toLowerCase().includes(source)) return false;
    if (f.verdict !== 'all' && event.verdict !== f.verdict) return false;
    if (f.flaggedOnly && !state.alertsByEventId.has(event.id)) return false;
    return true;
  });
}

function renderTable() {
  const total = state.result.events.length;
  const rows = filteredEvents();
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages - 1);
  const start = state.page * PAGE_SIZE;
  const slice = rows.slice(start, start + PAGE_SIZE);
  clear(dom.eventRows);
  const titles = new Map(state.dataset.scenarios.map((s) => [s.id, s.title]));
  if (slice.length === 0) {
    dom.eventRows.append(el('tr', { class: 'is-empty' }, [el('td', { colspan: '8', text: total === 0 ? 'No events are loaded.' : 'No events match the current filters.' })]));
  }
  for (const event of slice) {
    const cited = state.alertsByEventId.get(event.id) || [];
    const tr = el('tr');
    tr.append(el('td', { text: String(event.index + 1) }));
    tr.append(el('td', { class: 'is-mono', text: tableTime(event.ts) }));
    tr.append(el('td', {}, [el('span', { class: `outcome-pill is-${event.outcome}`, text: event.outcome })]));
    tr.append(el('td', { class: 'is-mono', text: event.account }));
    tr.append(el('td', { class: 'is-mono', text: event.source }));
    tr.append(el('td', { text: event.reason || '—' }));
    tr.append(el('td', {}, event.verdict ? [`${titles.get(event.scenario) ?? event.scenario ?? 'unlabelled'} `, verdictPill(event.verdict)] : ['—']));
    tr.append(el('td', { class: cited.length ? 'is-cited is-mono' : 'is-mono', text: cited.length === 0 ? '—' : cited.length > CITED_LIMIT ? `${cited.slice(0, CITED_LIMIT).join(', ')} and ${formatInt(cited.length - CITED_LIMIT)} more` : cited.join(', ') }));
    dom.eventRows.append(tr);
  }
  const f = state.filters;
  const filtering = f.ids || f.outcome !== 'all' || f.account.trim() || f.source.trim() || f.verdict !== 'all' || f.flaggedOnly;
  if (total === 0) dom.tableStatus.textContent = 'No events are loaded.';
  else if (f.ids) dom.tableStatus.textContent = `Showing the ${formatInt(rows.length)} event${rows.length === 1 ? '' : 's'} cited by alert ${f.idsLabel}. Clear the filters to see all ${formatInt(total)} events.`;
  else if (filtering) dom.tableStatus.textContent = `Showing ${formatInt(rows.length)} of ${formatInt(total)} events matching the filters.`;
  else dom.tableStatus.textContent = `Showing all ${formatInt(total)} events, ${PAGE_SIZE} per page.`;
  dom.pageStatus.textContent = rows.length === 0 ? 'Page 1 of 1' : `Page ${formatInt(state.page + 1)} of ${formatInt(pages)} · rows ${formatInt(start + 1)}–${formatInt(start + slice.length)} of ${formatInt(rows.length)}`;
  const focused = document.activeElement;
  dom.pagePrev.disabled = state.page === 0;
  dom.pageNext.disabled = state.page >= pages - 1;
  if ((focused === dom.pagePrev || focused === dom.pageNext) && focused.disabled) {
    const other = focused === dom.pageNext ? dom.pagePrev : dom.pageNext;
    (other.disabled ? dom.pageStatus : other).focus();
  }
}

function readFilters() {
  state.filters = {
    outcome: dom.filterOutcome.value,
    account: dom.filterAccount.value.slice(0, 64),
    source: dom.filterSource.value.slice(0, 64),
    verdict: dom.filterVerdict.value,
    flaggedOnly: dom.filterFlagged.checked,
    ids: null,
    idsLabel: '',
  };
  state.page = 0;
  renderTable();
}

/* ------------------------------------------------------------- evaluation */

function renderEvaluation() {
  const evaluation = state.evaluation;
  clear(dom.scenarioRows);
  if (!evaluation || !evaluation.available) {
    dom.evalUnavailable.hidden = false;
    dom.evalUnavailable.textContent = evaluation ? evaluation.reason : 'No evaluation available.';
    for (const key of Object.keys(dom.eval)) setStat(dom.eval[key], 'n/a', 'no ground truth');
    setStat(dom.evalPrecisionStrict, 'n/a', 'no ground truth');
    dom.scenarioRows.append(el('tr', { class: 'is-empty' }, [el('td', { colspan: '7', text: 'No labelled scenarios to score.' })]));
    return;
  }
  dom.evalUnavailable.hidden = true;
  const a = evaluation.alerts;
  const s = evaluation.scenarios;
  setStat(dom.eval.alerts, formatInt(a.total), 'raised');
  setStat(dom.eval.tp, formatInt(a.truePositive), 'alerts citing a suspicious event');
  setStat(dom.eval.fp, formatInt(a.falsePositive), 'alerts citing only benign events');
  setStat(dom.eval.precision, formatPercent(evaluation.precision), evaluation.precision === null ? 'undefined: no alerts were raised' : `${formatInt(a.truePositive)} of ${formatInt(a.total)} alerts`);
  setStat(dom.evalPrecisionStrict, formatPercent(evaluation.precisionStrict), evaluation.precisionStrict === null ? 'undefined: no alerts were raised' : `${formatInt(a.truePositiveStrict)} of ${formatInt(a.total)} alerts triggered by a suspicious event`);
  setStat(dom.eval.recall, formatPercent(evaluation.recall), evaluation.recall === null ? 'undefined: no suspicious scenario in the data' : `${formatInt(s.suspicious.detected)} of ${formatInt(s.suspicious.total)} suspicious scenarios`);
  setStat(dom.eval.recallStrict, formatPercent(evaluation.recallStrict), evaluation.recallStrict === null ? 'undefined: no suspicious scenario in the data' : `${formatInt(s.suspicious.detectedStrict)} of ${formatInt(s.suspicious.total)} triggered an alert directly`);
  setStat(dom.eval.missed, formatInt(s.suspicious.missed.length), s.suspicious.missed.length ? s.suspicious.missed.join(', ') : 'no false negatives');
  setStat(dom.eval.flagged, formatInt(s.benign.flagged.length), `of ${formatInt(s.benign.total)} benign scenarios`);
  for (const row of s.rows) {
    const tr = el('tr');
    tr.append(el('td', { text: `${row.id} · ${row.title}` }));
    tr.append(el('td', { text: row.kind ?? '—' }));
    tr.append(el('td', {}, [verdictPill(row.verdict)]));
    tr.append(el('td', { text: formatInt(row.events) }));
    tr.append(el('td', {}, row.rules.length ? row.rules.map((rule) => D.RULES[rule].code).join(', ') : '—'));
    tr.append(el('td', { text: row.alertIds.length ? (row.alertIds.length > 6 ? `${row.alertIds.slice(0, 6).join(', ')} and ${formatInt(row.alertIds.length - 6)} more` : row.alertIds.join(', ')) : '—' }));
    let outcome;
    if (row.verdict === 'suspicious') outcome = row.detectedStrict ? 'Detected: an alert triggered on its events' : row.detected ? 'Detected (leniently): cited only by an alert triggered elsewhere' : 'Missed (false negative)';
    else outcome = row.flagged ? 'Flagged by a false-positive alert' : row.alertIds.length ? 'Cited only by true-positive alerts' : 'Not flagged';
    tr.append(el('td', { text: outcome }));
    dom.scenarioRows.append(tr);
  }
}

function configDifferences(a, b) {
  const diffs = [];
  for (const [rule, key] of CONFIG_INPUTS) {
    if (a[rule][key] !== b[rule][key]) diffs.push(`${FIELD_NAMES[`${rule}.${key}`]} ${String(a[rule][key])} → ${String(b[rule][key])}`);
  }
  return diffs;
}

function renderComparison() {
  dom.comparison.hidden = !state.compare;
  dom.compareFields.hidden = !state.compare;
  if (!state.compare || !state.resultB) return;
  const A = state.result;
  const B = state.resultB;
  const evalA = state.evaluation;
  const evalB = state.evaluationB;
  const diffs = configDifferences(state.configA, state.configB);
  dom.comparisonNote.textContent = diffs.length === 0 ? 'Set B is identical to set A, so every row is equal. Change a value in set B to see the effect.' : `Set B differs from A in: ${diffs.join('; ')}.`;
  clear(dom.comparisonRows);
  const number = (value) => (value === null || value === undefined ? 'n/a' : formatInt(value));
  const percent = (value) => formatPercent(value);
  const delta = (x, y, pct = false) => {
    if (x === null || y === null || x === undefined || y === undefined) return 'n/a';
    const d = y - x;
    if (d === 0) return 'same';
    const sign = d > 0 ? '+' : '−';
    return pct ? `${sign}${(Math.abs(d) * 100).toFixed(1)} pts` : `${sign}${formatInt(Math.abs(d))}`;
  };
  const rows = [];
  for (const rule of D.RULE_ORDER) rows.push([`${D.RULES[rule].code} alerts`, number(A.summary.byRule[rule]), number(B.summary.byRule[rule]), delta(A.summary.byRule[rule], B.summary.byRule[rule])]);
  rows.push(['All alerts', number(A.alerts.length), number(B.alerts.length), delta(A.alerts.length, B.alerts.length)]);
  rows.push(['Events cited by an alert', number(A.summary.flaggedEvents), number(B.summary.flaggedEvents), delta(A.summary.flaggedEvents, B.summary.flaggedEvents)]);
  if (evalA.available && evalB.available) {
    rows.push(['True positives', number(evalA.alerts.truePositive), number(evalB.alerts.truePositive), delta(evalA.alerts.truePositive, evalB.alerts.truePositive)]);
    rows.push(['False positives', number(evalA.alerts.falsePositive), number(evalB.alerts.falsePositive), delta(evalA.alerts.falsePositive, evalB.alerts.falsePositive)]);
    rows.push(['Precision', percent(evalA.precision), percent(evalB.precision), delta(evalA.precision, evalB.precision, true)]);
    rows.push(['Strict precision', percent(evalA.precisionStrict), percent(evalB.precisionStrict), delta(evalA.precisionStrict, evalB.precisionStrict, true)]);
    rows.push(['Recall', percent(evalA.recall), percent(evalB.recall), delta(evalA.recall, evalB.recall, true)]);
    rows.push(['Strict recall', percent(evalA.recallStrict), percent(evalB.recallStrict), delta(evalA.recallStrict, evalB.recallStrict, true)]);
    rows.push(['Missed scenarios', number(evalA.scenarios.suspicious.missed.length), number(evalB.scenarios.suspicious.missed.length), delta(evalA.scenarios.suspicious.missed.length, evalB.scenarios.suspicious.missed.length)]);
    rows.push(['Benign scenarios flagged', number(evalA.scenarios.benign.flagged.length), number(evalB.scenarios.benign.flagged.length), delta(evalA.scenarios.benign.flagged.length, evalB.scenarios.benign.flagged.length)]);
  } else rows.push(['Scores', 'n/a', 'n/a', 'no ground truth']);
  for (const row of rows) dom.comparisonRows.append(el('tr', {}, row.map((text, k) => el(k === 0 ? 'th' : 'td', k === 0 ? { scope: 'row', text } : { text }))));
  const diff = D.diffAlerts(A.alerts, B.alerts);
  clear(dom.comparisonDiff);
  const describe = (alert) => `${alert.id} · ${D.RULES[alert.rule].code} · ${alert.rule === 'successAfterFailures' ? alert.subject.account : alert.subject.source} · ${timeOnly(alert.firstTs)} → ${timeOnly(alert.lastTs)}`;
  const boxes = [
    ['Only under A', `${formatInt(diff.onlyA.length)}`, diff.onlyA],
    ['Only under B', `${formatInt(diff.onlyB.length)}`, diff.onlyB],
    ['Under both (same rule, subject and overlapping span)', `${formatInt(diff.both.length)} A ↔ ${formatInt(diff.bothB.length)} B`, diff.both],
  ];
  for (const [title, count, list] of boxes) {
    const box = el('div');
    box.append(el('h4', { text: `${title} · ${count}` }));
    if (list.length === 0) box.append(el('p', { text: 'none' }));
    else {
      const ul = el('ul');
      for (const alert of list.slice(0, DIFF_LIST_LIMIT)) ul.append(el('li', { text: describe(alert) }));
      if (list.length > DIFF_LIST_LIMIT) ul.append(el('li', { text: `and ${formatInt(list.length - DIFF_LIST_LIMIT)} more` }));
      box.append(ul);
    }
    dom.comparisonDiff.append(box);
  }
}

/* ----------------------------------------------------------- import/export */

function showImportResult(kind, message, errors = [], errorCount = 0) {
  clear(dom.importResult);
  const p = el('p', { class: kind === 'ok' ? 'is-ok' : 'is-error', text: message });
  dom.importResult.append(p);
  if (errors.length > 0) {
    const list = el('ul');
    for (const error of errors) {
      const where = error.index >= 0 ? `Record ${formatInt(error.index + 1)}${error.field ? `, field “${error.field}”` : ''}: ` : (error.field ? `Field “${error.field}”: ` : '');
      list.append(el('li', { text: `${where}${error.message}.` }));
    }
    if (errorCount > errors.length) list.append(el('li', { text: `… and ${formatInt(errorCount - errors.length)} more problem${errorCount - errors.length === 1 ? '' : 's'}.` }));
    dom.importResult.append(list);
  }
}

function importFromText(text, origin) {
  const result = D.parseImport(text);
  if (!result.ok) {
    showImportResult('error', `Nothing was loaded: the ${origin} failed validation with ${formatInt(result.errorCount)} problem${result.errorCount === 1 ? '' : 's'}.`, result.errors, result.errorCount);
    return;
  }
  loadImported(result.events, result.labelled);
  showImportResult('ok', `Loaded ${formatInt(result.events.length)} event${result.events.length === 1 ? '' : 's'} from the ${origin}${result.labelled ? ' with ground-truth labels, so the evaluation section scores them' : ' without labels, so the evaluation section reports the scores as unavailable'}. The data stays in this page only.`);
  dom.importFile.value = ''; // so that choosing the same file again fires a change event
  byId('lab').scrollIntoView({ block: 'start' });
  dom.datasetLabel.focus({ preventScroll: true });
}

function onImportFile() {
  const file = dom.importFile.files && dom.importFile.files[0];
  if (!file) return;
  if (file.size > D.LIMITS.maxImportBytes) {
    showImportResult('error', `The file is ${formatInt(file.size)} bytes; the limit is ${formatInt(D.LIMITS.maxImportBytes)} bytes. Nothing was read.`);
    dom.importFile.value = '';
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    const text = typeof reader.result === 'string' ? reader.result : '';
    if (text.length <= TEXTAREA_ECHO_LIMIT) dom.importText.value = text;
    importFromText(text, `file “${file.name.slice(0, 80)}”`);
  });
  reader.addEventListener('error', () => showImportResult('error', 'The file could not be read.'));
  reader.readAsText(file);
}

function exportDataset() {
  const events = state.result.events;
  if (events.length === 0) return;
  const meta = state.source.kind === 'synthetic' ? { generated: { seed: state.source.seed, preset: state.source.preset } } : { generated: null };
  const text = D.serialiseEvents(events, meta);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const name = state.source.kind === 'synthetic' ? `security-events-${state.source.preset}-seed${state.source.seed}.json` : 'security-events-imported.json';
  const link = el('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`Exported ${formatInt(events.length)} events as ${name} (a local download; the file never leaves your device unless you share it).`);
}

/* ------------------------------------------------------------ catalogue */

function renderCatalogue() {
  clear(dom.catalogue);
  for (const kind of Object.values(D.SCENARIO_KINDS)) {
    const li = el('li');
    li.append(el('strong', { text: kind.title }), verdictPill(kind.verdict), ` ${kind.description} `);
    li.append(el('em', { text: kind.likelyRules.length ? `Likely at the defaults: ${kind.likelyRules.map((rule) => D.RULES[rule].code).join(', ')}.` : 'Expected to escape the default thresholds.' }));
    dom.catalogue.append(li);
  }
}

function updatePresetHint() {
  const preset = D.PRESETS[dom.preset.value];
  if (!preset) return;
  const kinds = preset.scenarios.map((spec) => D.SCENARIO_KINDS[spec.kind].title + (spec.kind === 'brute-force' ? (spec.success ? ' (ending in a success)' : ' (no success)') : ''));
  dom.presetHint.textContent = `${formatInt(preset.accounts)} accounts over ${preset.hours} hours. Planted on top of routine sign-ins: ${kinds.join('; ')}.`;
}

/* ------------------------------------------------------------- bindings */

function readSeed() {
  const raw = dom.seed.value.trim();
  const value = Number(raw);
  if (raw === '' || !Number.isInteger(value) || value < 0 || value > D.MAX_SEED) {
    setStatus('Enter a whole-number seed between 0 and 4,294,967,295 to generate a dataset. The current dataset is unchanged.');
    dom.seed.focus();
    return null;
  }
  return value;
}

function generateFromControls() {
  const seed = readSeed();
  if (seed === null) return;
  dom.seed.value = String(seed);
  loadSynthetic(seed, dom.preset.value);
}

function bindControls() {
  dom.play.addEventListener('click', () => play());
  dom.pause.addEventListener('click', () => { if (state.playback.status === 'paused') resume(); else pause(); });
  dom.step.addEventListener('click', () => step());
  dom.reset.addEventListener('click', () => resetPlayback());
  dom.skip.addEventListener('click', () => skipToEnd());
  dom.speed.addEventListener('input', () => { state.speed = Number(dom.speed.value); updateSpeedLabel(); });

  dom.preset.addEventListener('change', () => updatePresetHint());
  dom.generate.addEventListener('click', () => generateFromControls());
  dom.seed.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); generateFromControls(); } });
  dom.newSeed.addEventListener('click', () => {
    dom.seed.value = String(Math.floor(Math.random() * 1000000));
    generateFromControls();
  });
  dom.exportButton.addEventListener('click', () => exportDataset());

  for (const [, , id] of CONFIG_INPUTS) {
    byId(id).addEventListener('change', () => applyConfig('A'));
    byId(`b-${id}`).addEventListener('change', () => applyConfig('B'));
  }
  dom.resetThresholds.addEventListener('click', () => {
    writeConfigTo('', D.DEFAULT_CONFIG);
    applyConfig('A', { announce: false });
    setStatus('Thresholds reset to the defaults: R1 5 failures within 60 s; R2 5 distinct accounts within 120 s; R3 3 failures within 600 s before a success, account scope.');
  });
  dom.compare.addEventListener('change', () => {
    state.compare = dom.compare.checked;
    dom.compareFields.hidden = !state.compare;
    if (state.compare) {
      const valid = applyConfig('B', { announce: false });
      setStatus(valid
        ? `Comparison mode on: set B runs on the same ${formatInt(state.result.events.length)} events; see the comparison table in the Evaluation section.`
        : 'Comparison mode on, but set B contains invalid values: the comparison uses the last valid set B until they are fixed (see the messages under the B fields).');
    } else {
      recompute({ reason: 'configA', announce: false });
      setStatus('Comparison mode off.');
    }
  });
  dom.copyToB.addEventListener('click', () => {
    writeConfigTo('b-', state.configA);
    applyConfig('B', { announce: false });
    setStatus('Copied the current thresholds into set B.');
  });

  for (const input of [dom.filterOutcome, dom.filterVerdict, dom.filterFlagged]) input.addEventListener('change', () => readFilters());
  for (const input of [dom.filterAccount, dom.filterSource]) input.addEventListener('input', () => readFilters());
  dom.filterClear.addEventListener('click', () => {
    state.filters = { outcome: 'all', account: '', source: '', verdict: 'all', flaggedOnly: false, ids: null, idsLabel: '' };
    syncFilterInputs();
    state.page = 0;
    renderTable();
  });
  dom.pagePrev.addEventListener('click', () => { state.page = Math.max(0, state.page - 1); renderTable(); });
  dom.pageNext.addEventListener('click', () => { state.page += 1; renderTable(); });

  dom.importLoad.addEventListener('click', () => importFromText(dom.importText.value, 'pasted text'));
  dom.importFile.addEventListener('change', () => onImportFile());
  dom.importClear.addEventListener('click', () => {
    dom.importText.value = '';
    dom.importFile.value = '';
    clear(dom.importResult);
  });
  dom.importRestore.addEventListener('click', () => {
    const seed = readSeed();
    if (seed === null) return;
    loadSynthetic(seed, dom.preset.value);
    clear(dom.importResult);
  });

  if (typeof ResizeObserver === 'function') {
    let pending = false;
    new ResizeObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (state.result && Math.abs((dom.timeline.clientWidth || 0) - state.timelineWidth) > 2) buildTimeline();
      });
    }).observe(dom.timeline);
  }
}

/* ------------------------------------------------------------------- init */

function init() {
  state.speed = Number(dom.speed.value);
  updateSpeedLabel();
  writeConfigTo('', D.DEFAULT_CONFIG);
  writeConfigTo('b-', D.DEFAULT_CONFIG);
  dom.compare.checked = false; // browsers may restore form state across reloads; the page state starts from scratch
  renderCatalogue();
  updatePresetHint();
  bindControls();
  dom.seed.value = String(D.DEFAULT_SEED);
  loadSynthetic(D.DEFAULT_SEED, dom.preset.value, { announce: false });
  const { summary } = state.result;
  setStatus(`Ready: the “${D.PRESETS[state.source.preset].name}” preset was generated from seed ${D.DEFAULT_SEED}: ${formatInt(summary.events)} synthetic events and ${formatInt(summary.alerts)} alert${summary.alerts === 1 ? '' : 's'} under the default thresholds. Press Play to replay the day, or select an alert to investigate it.`);
}

init();
