/* Animated project figures. All replays use the same local engines as the labs. */
import * as P from './lab/pathfinding/pathfinding.js';
import * as D from './lab/security-events/detection.js';

const round = (value) => Math.round(value * 10) / 10;
const bounded = (value, max) => Math.min(max, Math.max(0, Math.floor(value)));
const RULE_KEY = { repeatedFailures: 'r1', passwordSpray: 'r2', successAfterFailures: 'r3' };

export function createPathPreview() {
  const field = P.generateRandomField(16, 9, 11, { wallDensity: 0.26, terrainDensity: 0 });
  return { ...field, result: P.runSearch('astar', field.grid, field.start, field.target, { movement: 4 }) };
}

export function pathPreviewFrame(model, count, routeCount = 0) {
  const trace = model.result.trace.slice(0, bounded(count, model.result.trace.length));
  const expanded = new Set(trace.map((event) => event.index));
  const discovered = new Set(trace.flatMap((event) => event.discovered));
  const square = (index) => {
    const { x, y } = P.toCoords(model.grid, index);
    return `M${x * 10} ${y * 10}h10v10h-10z`;
  };
  const route = model.result.path.slice(0, bounded(routeCount, model.result.path.length));
  return {
    visited: [...expanded].map(square).join(''),
    frontier: [...discovered].filter((index) => !expanded.has(index)).map(square).join(''),
    route: route.map((index, i) => {
      const { x, y } = P.toCoords(model.grid, index);
      return `${i ? 'L' : 'M'}${x * 10 + 5} ${y * 10 + 5}`;
    }).join(''),
    expanded: expanded.size,
    found: count >= model.result.trace.length,
  };
}

export function createSecurityPreview() {
  const run = D.runSynthetic({ seed: 13, preset: 'card' });
  const counts = new Map();
  for (const event of run.events) counts.set(event.source, (counts.get(event.source) || 0) + 1);
  const priority = new Set(run.alerts.map((alert) => alert.subject.source));
  const sources = [...counts.keys()].sort((a, b) => (priority.has(a) ? 0 : 1) - (priority.has(b) ? 0 : 1) || counts.get(b) - counts.get(a) || a.localeCompare(b)).slice(0, 7);
  const lanes = new Map(sources.map((source, i) => [source, i]));
  const t0 = run.events[0].ts;
  const t1 = run.events.at(-1).ts;
  return { ...run, lanes, t0, t1, x: (ts) => 6 + ((ts - t0) / (t1 - t0)) * 148 };
}

export function securityPreviewFrame(model, count, playhead) {
  const cursor = bounded(count, model.events.length);
  const currentTime = playhead ?? (cursor ? model.events[cursor - 1].ts : model.t0);
  const paths = { success: [], failure: [], future: [], r1: [], r2: [], r3: [] };
  for (const event of model.events) {
    const lane = model.lanes.get(event.source);
    if (lane === undefined) continue;
    const y = 6 + lane * 11;
    const d = event.outcome === 'failure'
      ? `M${round(model.x(event.ts) - 1)} ${y + 1.5}h2v8h-2z`
      : `M${round(model.x(event.ts) - 1)} ${y + 3.5}h2v4h-2z`;
    paths[event.index >= cursor ? 'future' : event.outcome].push(d);
  }
  let visibleAlerts = 0;
  for (const alert of model.alerts) {
    if (alert.triggerIndex >= cursor) continue;
    const lane = model.lanes.get(alert.subject.source);
    if (lane === undefined) continue;
    visibleAlerts += 1;
    const left = round(model.x(alert.firstTs) - 1.5);
    const right = round(Math.max(model.x(Math.min(alert.lastTs, currentTime)) + 1.5, model.x(alert.firstTs) + 3));
    const width = round(right - left);
    const [offset, height] = alert.rule === 'repeatedFailures' ? [0, 11] : alert.rule === 'passwordSpray' ? [0, 5.5] : [5.5, 5.5];
    paths[RULE_KEY[alert.rule]].push(`M${left} ${6 + lane * 11 + offset}h${width}v${height}h-${width}z`);
  }
  return {
    paths: Object.fromEntries(Object.entries(paths).map(([key, parts]) => [key, parts.join('')])),
    cursorPath: `M${round(model.x(currentTime))} 3V${6 + model.lanes.size * 11 + 3}`,
    visibleAlerts,
    cursor,
  };
}

function initializePreviews() {
  const figures = [...document.querySelectorAll('[data-project-preview]')];
  if (!figures.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'af-project-preview-pauses';
  const knownIds = new Set(figures.map((figure) => figure.dataset.projectPreview));
  let paused = new Set();
  try { paused = new Set((window.localStorage.getItem(storageKey) || '').split(',').filter((id) => knownIds.has(id))); } catch (_) { /* optional preference */ }
  const save = () => { try { window.localStorage.setItem(storageKey, [...paused].join(',')); } catch (_) { /* optional preference */ } };
  const players = new Map();

  for (const figure of figures) {
    const kind = figure.dataset.projectPreview;
    const card = figure.closest('.project');
    const art = figure.querySelector('.plate-art');
    const toggle = figure.querySelector('.preview-toggle');
    const replay = figure.querySelector('.preview-replay');
    const stage = figure.querySelector('.preview-stage');
    const project = figure.dataset.previewName;
    const svg = art.querySelector('svg');
    const originalPaths = [...svg.querySelectorAll('path')].map((element) => [element, element.getAttribute('d')]);
    const nodes = kind === 'atlas' ? [...svg.querySelectorAll('rect[width="96"]')]
      : kind === 'commerce' ? [...svg.querySelectorAll('rect[y="240"]')] : [];
    const steps = kind === 'atlas'
      ? ['Archive', 'Integrity', 'Models', 'Backtesting', 'Calibration audit', 'Hypothetical optimization', 'API', 'Unpublished dashboard', 'Release gate']
      : ['SQL', 'Google Colab', 'DAX measures', 'Power BI'];
    const model = kind === 'pathfinding' ? createPathPreview() : kind === 'security' ? createSecurityPreview() : null;
    let frontier = null;
    if (kind === 'pathfinding') {
      frontier = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      frontier.setAttribute('class', 'preview-frontier');
      svg.insertBefore(frontier, svg.querySelector('.lab-art-walls'));
    }
    const initialStage = stage.textContent;
    let elapsed = 0;
    let previous = 0;
    let timer = null;
    let visible = false;
    const duration = kind === 'atlas' ? 15300 : kind === 'commerce' ? 9200 : 10000;

    const draw = (progress) => {
      figure.style.setProperty('--preview-progress', progress.toFixed(4));
      if (nodes.length) {
        const index = Math.min(nodes.length - 1, Math.floor(progress * nodes.length));
        nodes.forEach((node, i) => node.classList.toggle('is-preview-current', i === index));
        stage.textContent = steps[index];
        figure.dataset.previewPhase = String(index);
      } else if (kind === 'pathfinding') {
        const count = Math.min(model.result.trace.length, Math.floor((progress / 0.65) * model.result.trace.length));
        const routeCount = progress < 0.65 ? 0 : Math.min(model.result.path.length, Math.ceil(((progress - 0.65) / 0.22) * model.result.path.length));
        const frame = pathPreviewFrame(model, count, routeCount);
        svg.querySelector('.lab-art-visited').setAttribute('d', frame.visited);
        frontier.setAttribute('d', frame.frontier);
        svg.querySelector('.lab-art-route').setAttribute('d', frame.route);
        stage.textContent = routeCount ? `A* route · ${model.result.path.length - 1} moves` : 'A* · exploring the seeded grid';
        figure.dataset.previewPhase = routeCount ? 'route' : 'search';
      } else {
        const time = model.t0 + (model.t1 - model.t0) * Math.min(progress / 0.88, 1);
        let count = 0;
        while (count < model.events.length && model.events[count].ts <= time) count += 1;
        const frame = securityPreviewFrame(model, count, time);
        for (const [key, path] of Object.entries(frame.paths)) svg.querySelector(`.sec-art-${key}`).setAttribute('d', path);
        svg.querySelector('.sec-art-cursor').setAttribute('d', frame.cursorPath);
        stage.textContent = `Synthetic replay · ${frame.visibleAlerts} rule alerts`;
        figure.dataset.previewPhase = String(frame.cursor);
      }
    };
    const tick = () => {
      const now = performance.now();
      elapsed += now - previous;
      previous = now;
      draw((elapsed % duration) / duration);
      timer = window.setTimeout(tick, 100);
    };
    const update = () => {
      const running = visible && !card.hidden && !document.hidden && !reduced.matches && !paused.has(kind);
      figure.dataset.previewState = running ? 'playing' : 'paused';
      figure.querySelector('.preview-loop').textContent = reduced.matches ? 'Still view' : running ? 'Playing' : 'Paused';
      toggle.disabled = reduced.matches;
      replay.disabled = reduced.matches;
      toggle.textContent = reduced.matches ? 'Motion off' : paused.has(kind) ? 'Play' : 'Pause';
      toggle.setAttribute('aria-label', `${reduced.matches ? 'Motion reduced for' : paused.has(kind) ? 'Play' : 'Pause'} ${project} preview`);
      if (running && timer === null) {
        previous = performance.now();
        draw((elapsed % duration) / duration);
        timer = window.setTimeout(tick, 100);
      } else if (!running && timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
      if (reduced.matches) {
        for (const [element, d] of originalPaths) element.setAttribute('d', d);
        if (frontier) frontier.setAttribute('d', '');
        nodes.forEach((node) => node.classList.remove('is-preview-current'));
        stage.textContent = initialStage;
        figure.style.setProperty('--preview-progress', '1');
      }
    };
    toggle.addEventListener('click', () => { if (paused.has(kind)) paused.delete(kind); else paused.add(kind); save(); update(); });
    replay.addEventListener('click', () => { elapsed = 0; previous = performance.now(); paused.delete(kind); save(); draw(0); update(); });
    figure.querySelectorAll('[data-preview-ui]').forEach((element) => { element.hidden = false; });
    figure.classList.add('is-preview-ready');
    players.set(figure, { update, setVisible: (value) => { visible = value; update(); } });
    update();
  }

  document.addEventListener('visibilitychange', () => players.forEach((player) => player.update()));
  reduced.addEventListener('change', () => players.forEach((player) => player.update()));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => players.get(entry.target).setVisible(entry.isIntersecting)));
    players.forEach((_, figure) => observer.observe(figure));
  } else players.forEach((player) => player.setVisible(true));
}

if (typeof document !== 'undefined') initializePreviews();
