/**
 * Interactive Robotics & Pathfinding Lab — UI module.
 *
 * Owns the DOM only. All algorithmic work is delegated to ./pathfinding.js.
 * A run is computed to completion first (so results and timings are exact),
 * then its trace is replayed on requestAnimationFrame. Pause, resume, step and
 * stop are therefore simple operations on a cursor into that trace.
 */
import * as P from './pathfinding.js';

const SIZES = Object.freeze({ '21x13': [21, 13], '31x19': [31, 19], '45x27': [45, 27], '61x37': [61, 37] });
const SPEEDS = Object.freeze([12, 24, 48, 96, 180, 360, 720, 1440, 2880, 5760]); // expansions per second
const OVERLAY = Object.freeze({ NONE: 0, FRONTIER: 1, VISITED: 2, PATH: 3 });
const TOOL_KEYS = Object.freeze({ 1: 'wall', 2: 'terrain', 3: 'erase', 4: 'start', 5: 'target' });
const DEFAULT_SEED = 42;
const MOVEMENT_NAMES = Object.freeze({ 4: '4-directional movement', 8: '8-directional movement without corner cutting' });
const ALGORITHM_HINTS = Object.freeze({
  bfs: 'Explores layer by layer with a FIFO queue. Guarantees the fewest moves; ignores terrain cost and the longer length of diagonal moves.',
  dijkstra: 'Always expands the cheapest known cell using a binary-heap priority queue. Guarantees the lowest total cost for any non-negative weights.',
  astar: 'Orders cells by cost so far plus an admissible estimate of the remaining distance. Same optimal cost as Dijkstra, usually with far fewer expansions.',
});
const MOVEMENT_HINTS = Object.freeze({
  4: 'Steps cost 1 × the entered cell\'s weight. A* uses the Manhattan distance, which is admissible and consistent here.',
  8: 'Diagonal steps cost √2 × the entered cell\'s weight and never cut corners. A* uses the octile distance, which is admissible and consistent here.',
});

const byId = (id) => document.getElementById(id);
const dom = {
  grid: byId('grid'),
  status: byId('lab-status'),
  run: byId('run'),
  pause: byId('pause'),
  step: byId('step'),
  stop: byId('stop'),
  clearSearch: byId('clear-search'),
  algorithm: byId('algorithm'),
  algorithmHint: byId('algorithm-hint'),
  movement: byId('movement'),
  movementHint: byId('movement-hint'),
  size: byId('size'),
  speed: byId('speed'),
  speedValue: byId('speed-value'),
  animate: byId('animate'),
  layout: byId('layout'),
  seed: byId('seed'),
  newSeed: byId('new-seed'),
  generate: byId('generate'),
  clearWalls: byId('clear-walls'),
  reset: byId('reset'),
  statOutcome: byId('stat-outcome'),
  statSteps: byId('stat-steps'),
  statCost: byId('stat-cost'),
  statExpanded: byId('stat-expanded'),
  statTime: byId('stat-time'),
  tools: [...document.querySelectorAll('input[name="tool"]')],
};

const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  grid: null,
  start: 0,
  target: 0,
  overlay: null,
  cells: [],
  active: 0,
  tool: 'wall',
  algorithm: 'astar',
  movement: 4,
  speed: 6,
  animate: !reducedMotion,
  run: null,
  stroke: null,
};

/* ------------------------------------------------------------ formatting */

const integer = new Intl.NumberFormat('en-US');
const formatInt = (n) => integer.format(n);
const formatCost = (c) => (Number.isInteger(c) ? formatInt(c) : c.toFixed(2));
const formatMs = (ms) => `${ms < 1 ? ms.toFixed(3) : ms.toFixed(2)} ms`;
const algorithmName = () => P.ALGORITHMS[state.algorithm].name;

function setStat(element, value, note) {
  element.textContent = '';
  element.append(document.createTextNode(value));
  if (note) {
    const small = document.createElement('small');
    small.textContent = note;
    element.append(small);
  }
}

function setStatus(message) {
  dom.status.textContent = message;
}

function resetStats() {
  setStat(dom.statOutcome, '—');
  setStat(dom.statSteps, '—', 'moves');
  setStat(dom.statCost, '—', 'weighted sum');
  setStat(dom.statExpanded, '—', 'closed set');
  setStat(dom.statTime, '—', 'pure computation');
}

/* ------------------------------------------------------------------ grid */

function describeCell(i) {
  const { x, y } = P.toCoords(state.grid, i);
  const parts = [];
  const type = state.grid.cells[i];
  parts.push(type === P.CELL.WALL ? 'wall' : type === P.CELL.TERRAIN ? 'terrain, cost 5' : 'open');
  if (i === state.start) parts.push('start');
  if (i === state.target) parts.push('target');
  const overlay = state.overlay[i];
  if (overlay === OVERLAY.PATH) parts.push('on the final path');
  else if (overlay === OVERLAY.VISITED) parts.push('expanded');
  else if (overlay === OVERLAY.FRONTIER) parts.push('frontier');
  return `Row ${y + 1}, column ${x + 1}: ${parts.join(', ')}`;
}

function renderCell(i) {
  const element = state.cells[i];
  const type = state.grid.cells[i];
  const overlay = state.overlay[i];
  let className = 'lab-cell';
  if (type === P.CELL.WALL) className += ' is-wall';
  else if (type === P.CELL.TERRAIN) className += ' is-terrain';
  if (overlay === OVERLAY.FRONTIER) className += ' is-frontier';
  else if (overlay === OVERLAY.VISITED) className += ' is-visited';
  else if (overlay === OVERLAY.PATH) className += ' is-path';
  if (i === state.start) className += ' is-start';
  if (i === state.target) className += ' is-target';
  element.className = className;
  element.setAttribute('aria-label', describeCell(i));
}

function renderAll() {
  for (let i = 0; i < state.cells.length; i += 1) renderCell(i);
}

function setActiveCell(i, { focus = false } = {}) {
  if (i === state.active && !focus) return;
  const previous = state.cells[state.active];
  if (previous) previous.tabIndex = -1;
  state.active = i;
  const element = state.cells[i];
  element.tabIndex = 0;
  if (focus) element.focus({ preventScroll: true });
}

function buildGrid(grid, start, target) {
  cancelRun({ silent: true });
  state.grid = grid;
  state.start = start;
  state.target = target;
  state.overlay = new Uint8Array(grid.cells.length);
  state.cells = new Array(grid.cells.length);
  dom.grid.textContent = '';
  dom.grid.style.setProperty('--cols', String(grid.cols));
  dom.grid.style.setProperty('--rows', String(grid.rows));
  dom.grid.setAttribute('aria-rowcount', String(grid.rows));
  dom.grid.setAttribute('aria-colcount', String(grid.cols));
  dom.grid.setAttribute('aria-label', `Pathfinding grid, ${grid.cols} columns by ${grid.rows} rows`);
  const fragment = document.createDocumentFragment();
  for (let y = 0; y < grid.rows; y += 1) {
    const row = document.createElement('div');
    row.className = 'lab-row';
    row.setAttribute('role', 'row');
    for (let x = 0; x < grid.cols; x += 1) {
      const i = P.toIndex(grid, x, y);
      const cell = document.createElement('div');
      cell.setAttribute('role', 'gridcell');
      cell.dataset.index = String(i);
      cell.tabIndex = -1;
      state.cells[i] = cell;
      row.append(cell);
    }
    fragment.append(row);
  }
  dom.grid.append(fragment);
  renderAll();
  state.active = start;
  state.cells[start].tabIndex = 0;
  resetStats();
  updateButtons();
  updateCellSize();
}

function updateCellSize() {
  const first = state.cells[0];
  if (!first) return;
  const width = first.getBoundingClientRect().width;
  if (width > 0) dom.grid.style.setProperty('--cell', `${width.toFixed(2)}px`);
}

/* ------------------------------------------------------------- editing */

function gridChanged() {
  if (state.run) {
    const wasFinished = state.run.status === 'finished';
    cancelRun({ silent: true });
    setStatus(wasFinished
      ? 'The grid changed, so the previous result was cleared. Run again to search the new map.'
      : 'The grid changed while a search was in progress; that search was stopped and its overlay cleared.');
    resetStats();
  }
}

function moveMarker(which, i) {
  const current = which === 'start' ? state.start : state.target;
  if (current === i) return false;
  if (!P.isPassable(state.grid, i)) state.grid.cells[i] = P.CELL.OPEN;
  gridChanged();
  if (which === 'start') state.start = i; else state.target = i;
  renderCell(current);
  renderCell(i);
  return true;
}

function setCellType(i, type) {
  if (state.grid.cells[i] === type) return false;
  if (type === P.CELL.WALL && (i === state.start || i === state.target)) return false;
  gridChanged();
  state.grid.cells[i] = type;
  renderCell(i);
  return true;
}

/** Applies the selected tool to a cell (keyboard activation or the first cell of a stroke). */
function applyTool(i, tool) {
  switch (tool) {
    case 'wall': return setCellType(i, state.grid.cells[i] === P.CELL.WALL ? P.CELL.OPEN : P.CELL.WALL);
    case 'terrain': return setCellType(i, state.grid.cells[i] === P.CELL.TERRAIN ? P.CELL.OPEN : P.CELL.TERRAIN);
    case 'erase': return setCellType(i, P.CELL.OPEN);
    case 'start': return moveMarker('start', i);
    case 'target': return moveMarker('target', i);
    default: return false;
  }
}

/**
 * Decides what a pointer stroke does from its first cell. The Start and Target
 * tools always place their marker; with a drawing tool, pressing on a marker
 * drags it instead of painting over it.
 */
function strokeModeFor(i) {
  if (state.tool === 'start') return 'move-start';
  if (state.tool === 'target') return 'move-target';
  if (i === state.start) return 'move-start';
  if (i === state.target) return 'move-target';
  const type = state.grid.cells[i];
  if (state.tool === 'wall') return type === P.CELL.WALL ? 'erase' : 'wall';
  if (state.tool === 'terrain') return type === P.CELL.TERRAIN ? 'erase' : 'terrain';
  return 'erase';
}

function applyStroke(i) {
  const { mode } = state.stroke;
  if (state.stroke.last === i) return;
  state.stroke.last = i;
  switch (mode) {
    case 'wall': setCellType(i, P.CELL.WALL); break;
    case 'terrain': setCellType(i, P.CELL.TERRAIN); break;
    case 'erase': setCellType(i, P.CELL.OPEN); break;
    case 'move-start':
      if (P.isPassable(state.grid, i) || state.stroke.first) moveMarker('start', i);
      break;
    case 'move-target':
      if (P.isPassable(state.grid, i) || state.stroke.first) moveMarker('target', i);
      break;
    default: break;
  }
  state.stroke.first = false;
}

function cellIndexFromElement(element) {
  const cell = element && element.closest ? element.closest('.lab-cell') : null;
  if (!cell || !dom.grid.contains(cell)) return -1;
  return Number(cell.dataset.index);
}

function cellIndexFromPoint(x, y) {
  return cellIndexFromElement(document.elementFromPoint(x, y));
}

function onPointerDown(event) {
  if (event.button !== 0 && event.pointerType === 'mouse') return;
  const i = cellIndexFromElement(event.target);
  if (i < 0) return;
  state.stroke = { mode: strokeModeFor(i), last: -1, first: true, pointerId: event.pointerId };
  setActiveCell(i, { focus: true });
  applyStroke(i);
}

function onPointerMove(event) {
  if (!state.stroke || event.pointerId !== state.stroke.pointerId) return;
  const i = cellIndexFromPoint(event.clientX, event.clientY);
  if (i >= 0) applyStroke(i);
}

function endStroke(event) {
  if (!state.stroke) return;
  if (event && event.pointerId !== undefined && event.pointerId !== state.stroke.pointerId) return;
  state.stroke = null;
}

function onGridKeyDown(event) {
  const i = cellIndexFromElement(event.target);
  if (i < 0) return;
  const { x, y } = P.toCoords(state.grid, i);
  const { cols, rows } = state.grid;
  let nx = x;
  let ny = y;
  switch (event.key) {
    case 'ArrowLeft': nx = Math.max(0, x - 1); break;
    case 'ArrowRight': nx = Math.min(cols - 1, x + 1); break;
    case 'ArrowUp': ny = Math.max(0, y - 1); break;
    case 'ArrowDown': ny = Math.min(rows - 1, y + 1); break;
    case 'Home': nx = 0; if (event.ctrlKey) ny = 0; break;
    case 'End': nx = cols - 1; if (event.ctrlKey) ny = rows - 1; break;
    case 'PageUp': ny = Math.max(0, y - 5); break;
    case 'PageDown': ny = Math.min(rows - 1, y + 5); break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      applyTool(i, state.tool);
      state.cells[i].setAttribute('aria-label', describeCell(i));
      return;
    default:
      if (TOOL_KEYS[event.key]) {
        event.preventDefault();
        selectTool(TOOL_KEYS[event.key]);
      }
      return;
  }
  event.preventDefault();
  setActiveCell(P.toIndex(state.grid, nx, ny), { focus: true });
}

function selectTool(tool) {
  state.tool = tool;
  for (const input of dom.tools) input.checked = input.value === tool;
}

/* --------------------------------------------------------------- running */

function applyEvent(event) {
  const { overlay } = state;
  if (overlay[event.index] !== OVERLAY.PATH) overlay[event.index] = OVERLAY.VISITED;
  renderCell(event.index);
  for (const j of event.discovered) {
    if (overlay[j] === OVERLAY.NONE) {
      overlay[j] = OVERLAY.FRONTIER;
      renderCell(j);
    }
  }
}

function clearOverlay() {
  const { overlay } = state;
  for (let i = 0; i < overlay.length; i += 1) {
    if (overlay[i] !== OVERLAY.NONE) {
      overlay[i] = OVERLAY.NONE;
      renderCell(i);
    }
  }
}

function updateButtons() {
  // Capture focus first: browsers blur a button the moment it becomes disabled.
  const focused = document.activeElement;
  const status = state.run ? state.run.status : 'idle';
  const running = status === 'running';
  const paused = status === 'paused';
  dom.pause.disabled = !(running || paused);
  dom.pause.textContent = paused ? 'Resume' : 'Pause';
  dom.stop.disabled = !(running || paused);
  dom.clearSearch.disabled = !state.run;
  if (focused && focused !== document.body && focused.disabled && focused !== dom.run) dom.run.focus();
}

function runLabel() {
  return `${algorithmName()} (${MOVEMENT_NAMES[state.movement]})`;
}

function startRun({ stepping = false } = {}) {
  cancelRun({ silent: true });
  const result = P.runSearch(state.algorithm, state.grid, state.start, state.target, { movement: state.movement });
  state.run = { result, cursor: 0, status: 'running', rafId: 0, lastTs: null, carry: 0 };
  resetStats();
  setStat(dom.statOutcome, stepping ? 'Stepping' : 'Running…', algorithmName());
  setStat(dom.statTime, formatMs(result.elapsedMs), 'pure computation');
  if (stepping) {
    state.run.status = 'paused';
    stepRun();
    return;
  }
  if (!state.animate) {
    while (state.run.cursor < result.trace.length) applyEvent(result.trace[state.run.cursor++]);
    finishRun();
    return;
  }
  setStatus(`Running ${runLabel()}…`);
  updateButtons();
  state.run.rafId = requestAnimationFrame(frame);
}

function frame(timestamp) {
  const run = state.run;
  if (!run || run.status !== 'running') return;
  const dt = run.lastTs === null ? 1000 / 60 : Math.min(100, timestamp - run.lastTs);
  run.lastTs = timestamp;
  run.carry += (dt * SPEEDS[state.speed - 1]) / 1000;
  let budget = Math.floor(run.carry);
  run.carry -= budget;
  const { trace } = run.result;
  while (budget > 0 && run.cursor < trace.length) {
    applyEvent(trace[run.cursor++]);
    budget -= 1;
  }
  setStat(dom.statExpanded, formatInt(run.cursor), `of ${formatInt(trace.length)}`);
  if (run.cursor >= trace.length) {
    finishRun();
  } else {
    run.rafId = requestAnimationFrame(frame);
  }
}

function finishRun() {
  const run = state.run;
  if (!run) return;
  const { result } = run;
  run.status = 'finished';
  cancelAnimationFrame(run.rafId);
  for (const i of result.path) {
    state.overlay[i] = OVERLAY.PATH;
    renderCell(i);
  }
  const name = algorithmName();
  setStat(dom.statExpanded, formatInt(result.expanded), `of ${formatInt(state.grid.cells.length)} cells`);
  setStat(dom.statTime, formatMs(result.elapsedMs), 'pure computation');
  if (!result.found) {
    setStat(dom.statOutcome, 'No route', name);
    setStat(dom.statSteps, '—', 'moves');
    setStat(dom.statCost, '—', 'weighted sum');
    setStatus(`No route: the target cannot be reached from the start under the current walls and ${MOVEMENT_NAMES[state.movement]}. ${name} explored all ${formatInt(result.expanded)} reachable cells before giving up. Remove a wall between them or choose another seed.`);
  } else if (result.steps === 0) {
    setStat(dom.statOutcome, 'Same cell', name);
    setStat(dom.statSteps, '0', 'moves');
    setStat(dom.statCost, '0', 'weighted sum');
    setStatus('The start and the target are the same cell, so the path has 0 moves and cost 0. Move one of the markers to search for a route.');
  } else {
    setStat(dom.statOutcome, 'Path found', name);
    setStat(dom.statSteps, formatInt(result.steps), 'moves');
    setStat(dom.statCost, formatCost(result.cost), result.costOptimalityGuaranteed ? 'optimal' : 'fewest moves, not lowest cost');
    let message = `${name} found a path of ${formatInt(result.steps)} moves with cost ${formatCost(result.cost)} after expanding ${formatInt(result.expanded)} cells in ${formatMs(result.elapsedMs)}.`;
    if (!result.costOptimalityGuaranteed) {
      message += ' BFS minimises moves, not cost: with terrain or diagonal moves a cheaper route may exist. Run Dijkstra or A* on the same map to compare.';
    } else if (state.algorithm === 'astar') {
      message += ` The ${result.heuristic} heuristic is admissible here, so this cost is optimal.`;
    } else if (state.algorithm === 'dijkstra') {
      message += ' This cost is optimal for the current weights.';
    } else {
      message += ' With uniform costs and 4-directional moves this is also the cheapest path.';
    }
    setStatus(message);
  }
  updateButtons();
}

function pauseRun() {
  const run = state.run;
  if (!run || run.status !== 'running') return;
  run.status = 'paused';
  cancelAnimationFrame(run.rafId);
  setStat(dom.statOutcome, 'Paused', algorithmName());
  setStatus(`Paused after ${formatInt(run.cursor)} of ${formatInt(run.result.trace.length)} expansions. Resume, step or stop.`);
  updateButtons();
}

function resumeRun() {
  const run = state.run;
  if (!run || run.status !== 'paused') return;
  run.status = 'running';
  run.lastTs = null;
  run.carry = 0;
  setStat(dom.statOutcome, 'Running…', algorithmName());
  setStatus(`Resumed ${runLabel()}.`);
  updateButtons();
  run.rafId = requestAnimationFrame(frame);
}

function stepRun() {
  if (!state.run || state.run.status === 'finished') {
    startRun({ stepping: true });
    return;
  }
  const run = state.run;
  if (run.status === 'running') {
    run.status = 'paused';
    cancelAnimationFrame(run.rafId);
  }
  const { trace } = run.result;
  if (run.cursor < trace.length) {
    const event = run.result.trace[run.cursor++];
    applyEvent(event);
    setStat(dom.statExpanded, formatInt(run.cursor), `of ${formatInt(trace.length)}`);
    setStat(dom.statOutcome, 'Stepping', algorithmName());
    const { x, y } = P.toCoords(state.grid, event.index);
    const keyName = state.algorithm === 'bfs' ? 'depth' : (state.algorithm === 'astar' ? 'f' : 'g');
    setStatus(`Step ${formatInt(run.cursor)} of ${formatInt(trace.length)}: expanded row ${y + 1}, column ${x + 1} (${keyName} = ${formatCost(event.f)}), discovered ${event.discovered.length} new ${event.discovered.length === 1 ? 'cell' : 'cells'}.`);
  }
  if (run.cursor >= trace.length) finishRun();
  else updateButtons();
}

function cancelRun({ silent = false } = {}) {
  const run = state.run;
  if (!run) return;
  cancelAnimationFrame(run.rafId);
  const progress = run.cursor;
  const total = run.result.trace.length;
  const wasActive = run.status === 'running' || run.status === 'paused';
  state.run = null;
  clearOverlay();
  resetStats();
  if (!silent) {
    setStatus(wasActive
      ? `Stopped after ${formatInt(progress)} of ${formatInt(total)} expansions. The overlay was cleared.`
      : 'Search overlay cleared.');
  }
  updateButtons();
}

/* ---------------------------------------------------------------- layouts */

function readSeed() {
  const raw = dom.seed.value.trim();
  const value = Number(raw);
  if (raw === '' || !Number.isInteger(value) || value < 0 || value > 0xFFFFFFFF) {
    setStatus('Enter a whole-number seed between 0 and 4,294,967,295 to generate a layout.');
    dom.seed.focus();
    return null;
  }
  return value;
}

function generateLayout({ announce = true } = {}) {
  const seed = readSeed();
  if (seed === null) return false;
  const layoutId = dom.layout.value;
  const layout = P.LAYOUTS[layoutId];
  const { cols, rows } = state.grid;
  const generated = layout.generate(cols, rows, seed);
  buildGrid(generated.grid, generated.start, generated.target);
  if (announce) {
    setStatus(`Generated a ${layoutId === 'maze' ? 'perfect maze' : 'random field'} of ${cols} × ${rows} cells from seed ${formatInt(seed)}. The same generator, size and seed always reproduce this exact layout.`);
  }
  return true;
}

function newSeed() {
  const seed = Math.floor(Math.random() * 1000000);
  dom.seed.value = String(seed);
  generateLayout();
}

function clearObstacles() {
  cancelRun({ silent: true });
  state.grid.cells.fill(P.CELL.OPEN);
  renderAll();
  resetStats();
  setStatus('All walls and terrain were removed. The start and target markers stay where they were.');
}

function resetGrid() {
  const { cols, rows } = state.grid;
  const { start, target } = P.defaultEndpoints(cols, rows);
  buildGrid(P.createGrid(cols, rows), start, target);
  setStatus(`Grid reset to an empty ${cols} × ${rows} map with the start and target in their default positions.`);
  setActiveCell(state.start, { focus: false });
}

/* --------------------------------------------------------------- settings */

function applySize(value, { announce = true } = {}) {
  const dims = SIZES[value];
  if (!dims) return;
  const [cols, rows] = dims;
  const { start, target } = P.defaultEndpoints(cols, rows);
  buildGrid(P.createGrid(cols, rows), start, target);
  if (announce) setStatus(`Grid resized to ${cols} × ${rows} cells (${formatInt(cols * rows)} cells). Draw obstacles or generate a layout, then press Run.`);
}

function updateSpeedLabel() {
  const perSecond = SPEEDS[state.speed - 1];
  dom.speedValue.textContent = `${formatInt(perSecond)} / s`;
  dom.speed.setAttribute('aria-valuetext', `${formatInt(perSecond)} expansions per second`);
}

function settingsChangedDuringRun(what) {
  if (state.run && state.run.status !== 'finished') {
    cancelRun({ silent: true });
    setStatus(`Stopped: the ${what} changed during the search. Press Run to search again with the new setting.`);
  }
}

function bindControls() {
  dom.run.addEventListener('click', () => startRun());
  dom.pause.addEventListener('click', () => {
    if (state.run && state.run.status === 'paused') resumeRun(); else pauseRun();
  });
  dom.step.addEventListener('click', () => stepRun());
  dom.stop.addEventListener('click', () => cancelRun());
  dom.clearSearch.addEventListener('click', () => cancelRun());

  dom.algorithm.addEventListener('change', () => {
    state.algorithm = dom.algorithm.value;
    dom.algorithmHint.textContent = ALGORITHM_HINTS[state.algorithm];
    settingsChangedDuringRun('algorithm');
  });
  dom.movement.addEventListener('change', () => {
    state.movement = Number(dom.movement.value);
    dom.movementHint.textContent = MOVEMENT_HINTS[state.movement];
    settingsChangedDuringRun('movement rule');
  });
  dom.size.addEventListener('change', () => applySize(dom.size.value));
  dom.speed.addEventListener('input', () => {
    state.speed = Number(dom.speed.value);
    updateSpeedLabel();
  });
  dom.animate.addEventListener('change', () => { state.animate = dom.animate.checked; });
  dom.generate.addEventListener('click', () => generateLayout());
  dom.newSeed.addEventListener('click', () => newSeed());
  dom.seed.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      generateLayout();
    }
  });
  dom.clearWalls.addEventListener('click', () => clearObstacles());
  dom.reset.addEventListener('click', () => resetGrid());
  for (const input of dom.tools) {
    input.addEventListener('change', () => { if (input.checked) state.tool = input.value; });
  }

  dom.grid.addEventListener('pointerdown', onPointerDown);
  dom.grid.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', endStroke);
  window.addEventListener('pointercancel', endStroke);
  window.addEventListener('blur', () => endStroke());
  dom.grid.addEventListener('keydown', onGridKeyDown);
  dom.grid.addEventListener('focusin', (event) => {
    const i = cellIndexFromElement(event.target);
    if (i >= 0) {
      setActiveCell(i);
      state.cells[i].setAttribute('aria-label', describeCell(i));
    }
  });

  if (typeof ResizeObserver === 'function') {
    new ResizeObserver(() => updateCellSize()).observe(dom.grid);
  } else {
    window.addEventListener('resize', updateCellSize, { passive: true });
  }
}

/* ------------------------------------------------------------------- init */

function init() {
  const compact = window.innerWidth < 700;
  const initialSize = compact ? '21x13' : '31x19';
  dom.size.value = initialSize;
  state.algorithm = dom.algorithm.value;
  state.movement = Number(dom.movement.value);
  state.speed = Number(dom.speed.value);
  dom.animate.checked = state.animate;
  dom.algorithmHint.textContent = ALGORITHM_HINTS[state.algorithm];
  dom.movementHint.textContent = MOVEMENT_HINTS[state.movement];
  if (reducedMotion) {
    byId('animate-hint').textContent = 'Your system asks for reduced motion, so animation is off by default: Run shows the finished result immediately. Tick the box to animate anyway. Step always works one expansion at a time.';
  }
  updateSpeedLabel();
  selectTool('wall');
  bindControls();
  applySize(initialSize, { announce: false });
  dom.seed.value = String(DEFAULT_SEED);
  generateLayout({ announce: false });
  setStatus(`Ready: a ${state.grid.cols} × ${state.grid.rows} random field was generated from seed ${DEFAULT_SEED}. Press Run to search with ${runLabel()}, or draw your own map first.`);
}

init();
