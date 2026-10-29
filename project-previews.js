/* Project walkthroughs, reported analytics figures and local engine replays. */
import * as P from './lab/pathfinding/pathfinding.js';
import * as D from './lab/security-events/detection.js';
import { PUBLISHED, EXPORTED } from './lab/ecommerce/model.js';

const round = (value) => Math.round(value * 10) / 10;
const bounded = (value, max) => Math.min(max, Math.max(0, Math.floor(value)));
const RULE_KEY = { repeatedFailures: 'r1', passwordSpray: 'r2', successAfterFailures: 'r3' };
const unit = (value) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const STORIES = {
  atlas: [
    ['Start with reliable records.', 'Organize archived records and check the files before comparing forecasting methods.'],
    ['Compare approaches fairly.', 'Test different forecasting methods against known past outcomes, using the same evaluation process.'],
    ['Make the limits visible.', 'Keep failed calibration and hypothetical planning assumptions visible in the research record.'],
    ['Make the work inspectable.', 'Package a tested API and dashboard code; keep public publication behind its release gate.'],
  ],
  commerce: [
    ['Read the headline totals.', 'See reported revenue, orders and customers together, in one compact view.'],
    ['Compare product categories.', 'Reveal the leading categories using the rounded amounts printed on the original report.'],
    ['Check delivery reliability.', 'Separate delivered orders from the share of delivered orders that arrived on time.'],
    ['Explore the full project.', 'Open the analytics lab for model details, DAX explanations and clearly labelled what-if scenarios.'],
  ],
};
// Conduits between the nine existing schematic boxes, in document order.
const ATLAS_TRANSFERS = [
  [120, 65, 152, 65], [248, 65, 280, 65], [328, 82, 328, 128],
  [280, 145, 248, 145], [152, 145, 120, 145], [72, 162, 72, 208],
  [120, 225, 152, 225], [248, 225, 280, 225],
];

export function storyFrame(kind, progress) {
  const position = unit(progress);
  const chapter = Math.min(3, Math.floor(position * 4));
  const [title, copy] = STORIES[kind][chapter];
  return { chapter, title, copy };
}

export function atlasPreviewFrame(progress) {
  const position = unit(progress);
  const node = Math.min(8, Math.floor(position * 9));
  const packets = ATLAS_TRANSFERS.flatMap(([x1, y1, x2, y2], edge) => [0, 0.5].map(offset => {
    const travel = (position * 12 + edge * 0.17 + offset) % 1;
    return { x: round(x1 + (x2 - x1) * travel), y: round(y1 + (y2 - y1) * travel) };
  }));
  return { ...storyFrame('atlas', position), node, packets, nodeProgress: Math.min(1, position * 9 - node) };
}

export function createCommercePreview() {
  return {
    metrics: { revenue: PUBLISHED.revenueDisplay, orders: PUBLISHED.ordersDisplay, customers: PUBLISHED.customersDisplay,
      delivered: `${PUBLISHED.deliveredPct.toFixed(2)}%`, ontime: `${PUBLISHED.onTimeOfDeliveredPct.toFixed(2)}%` },
    categories: EXPORTED.topCategories.slice(0, 3).map(row => ({ ...row, display: `R$${(row.revenueBRL / 1e6).toFixed(2)}M` })),
  };
}

export function commercePreviewFrame(progress) {
  const position = unit(progress);
  const reveal = unit(position / 0.2);
  return { ...storyFrame('commerce', position), reveal: 1 - (1 - reveal) ** 3,
    category: Math.min(2, Math.floor(unit((position - 0.25) / 0.25) * 3)),
    deliveryReveal: unit((position - 0.5) / 0.18), scan: (position * 8) % 1 };
}

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
    const next = figure.querySelector('.preview-next');
    const stage = figure.querySelector('.preview-stage');
    const project = figure.dataset.previewName;
    const svg = art.querySelector('svg');
    const originalPaths = [...svg.querySelectorAll('path')].map((element) => [element, element.getAttribute('d')]);
    const nodes = kind === 'atlas' ? [...svg.querySelectorAll('rect[width="96"]')] : [];
    const story = figure.querySelector('.preview-story');
    const storyElements = story ? ['.preview-step', '.preview-story-title', '.preview-story-copy'].map(selector => story.querySelector(selector)) : [];
    const initialStory = storyElements.map(element => element.textContent);
    const showStory = frame => {
      if (!story) return;
      storyElements[0].textContent = `Step ${frame.chapter + 1} of 4`;
      storyElements[1].textContent = frame.title;
      storyElements[2].textContent = frame.copy;
    };
    let motionLayer = null;
    let packets = [];
    let meters = [];
    const shape = (tag, attributes) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
      return element;
    };
    if (kind === 'atlas') {
      motionLayer = shape('g', { class: 'atlas-motion', 'aria-hidden': 'true' });
      packets = ATLAS_TRANSFERS.flatMap(() => [0, 1].map(() => {
        const packet = shape('circle', { class: 'story-packet', r: 3.5 });
        motionLayer.append(packet);
        return packet;
      }));
      meters = nodes.map(node => {
        const meter = shape('rect', { class: 'story-node-meter', x: Number(node.getAttribute('x')) + 6,
          y: Number(node.getAttribute('y')) + 29, width: 84, height: 2, rx: 1 });
        motionLayer.append(meter);
        return meter;
      });
      svg.append(motionLayer);
    }
    const reportBars = [...figure.querySelectorAll('.report-bar-fill')];
    const rateBars = [...figure.querySelectorAll('.report-rate-fill')];
    const reportSignals = [];
    const categoryRows = [...figure.querySelectorAll('.report-category')];
    if (kind === 'commerce') {
      const report = createCommercePreview();
      for (const [key, value] of Object.entries(report.metrics)) figure.querySelector(`[data-report-metric="${key}"]`).textContent = value;
      rateBars.forEach((bar, index) => bar.setAttribute('width', String(Number.parseFloat(report.metrics[index === 0 ? 'delivered' : 'ontime']))));
      categoryRows.forEach((row, index) => {
        row.querySelector('span').textContent = report.categories[index].label;
        row.querySelector('b').textContent = report.categories[index].display;
        row.querySelector('svg').setAttribute('viewBox', `0 0 ${report.categories[0].revenueBRL / 10000} 8`);
        row.querySelector('rect').setAttribute('width', String(report.categories[index].revenueBRL / 10000));
        const clip = shape('clipPath', {id:`report-category-clip-${index}`});
        clip.append(shape('rect', {width:report.categories[index].revenueBRL / 10000,height:8}));
        const defs = shape('defs', {});
        defs.append(clip);
        row.querySelector('svg').append(defs);
        const signal = shape('rect', {class:'report-bar-signal',width:5,height:8,'clip-path':`url(#report-category-clip-${index})`});
        row.querySelector('svg').append(signal);
        reportSignals.push(signal);
      });
    }
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
    const duration = kind === 'atlas' ? 20000 : kind === 'commerce' ? 16000 : 10000;

    const draw = (progress) => {
      figure.style.setProperty('--preview-progress', progress.toFixed(4));
      if (kind === 'atlas') {
        const frame = atlasPreviewFrame(progress);
        nodes.forEach((node, i) => node.classList.toggle('is-preview-current', i === frame.node));
        packets.forEach((packet, i) => {
          packet.setAttribute('cx', String(frame.packets[i].x));
          packet.setAttribute('cy', String(frame.packets[i].y));
        });
        meters.forEach((meter, i) => meter.style.setProperty('--node-progress', i < frame.node ? '1' : i === frame.node ? String(frame.nodeProgress) : '0'));
        showStory(frame);
        stage.textContent = 'Illustrated data flow · research only';
        figure.dataset.previewPhase = String(frame.node);
      } else if (kind === 'commerce') {
        const frame = commercePreviewFrame(progress);
        showStory(frame);
        reportBars.forEach(bar => bar.style.setProperty('--bar-reveal', String(frame.reveal)));
        reportSignals.forEach((signal, i) => {
          signal.setAttribute('x', String(round(((frame.scan + i / 3) % 1) * 144 - 5)));
          signal.setAttribute('opacity', frame.reveal === 1 ? '1' : '0');
        });
        rateBars.forEach(bar => bar.style.setProperty('--rate-reveal', String(frame.deliveryReveal)));
        categoryRows.forEach((row, i) => row.classList.toggle('is-report-current', frame.chapter === 1 && i === frame.category));
        figure.querySelector('.commerce-demo').dataset.chapter = String(frame.chapter);
        stage.textContent = 'Fixed reported figures · animated reveal';
        figure.dataset.previewPhase = String(frame.chapter);
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
      if (next) next.disabled = reduced.matches;
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
        if (motionLayer) motionLayer.setAttribute('hidden', '');
        reportBars.forEach(bar => bar.style.setProperty('--bar-reveal', '1'));
        rateBars.forEach(bar => bar.style.setProperty('--rate-reveal', '1'));
        reportSignals.forEach(signal => signal.setAttribute('opacity', '0'));
        categoryRows.forEach(row => row.classList.remove('is-report-current'));
        figure.querySelector('.commerce-demo')?.removeAttribute('data-chapter');
        storyElements.forEach((element, i) => { element.textContent = initialStory[i]; });
        stage.textContent = initialStage;
        figure.style.setProperty('--preview-progress', '1');
      } else if (motionLayer) motionLayer.removeAttribute('hidden');
    };
    toggle.addEventListener('click', () => { if (paused.has(kind)) paused.delete(kind); else paused.add(kind); save(); update(); });
    replay.addEventListener('click', () => { elapsed = 0; previous = performance.now(); paused.delete(kind); save(); draw(0); update(); });
    next?.addEventListener('click', () => {
      const chapter = (Math.floor(((elapsed % duration) / duration) * 4) + 1) % 4;
      elapsed = (chapter * duration) / 4;
      paused.add(kind);
      save();
      draw(elapsed / duration);
      update();
    });
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
