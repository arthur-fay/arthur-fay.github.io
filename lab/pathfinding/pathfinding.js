/**
 * Interactive Robotics & Pathfinding Lab — pure algorithm module.
 *
 * This file has no DOM access and no side effects, so it can be imported by
 * the browser UI (app.js) and by the Node test-suite (tests/unit) unchanged.
 *
 * Model
 * -----
 * - The environment is a rectangular grid of `cols × rows` cells stored in a
 *   Uint8Array (row-major). A cell is OPEN, a WALL or weighted TERRAIN.
 * - Walls are impassable. Entering an OPEN cell costs 1 × step length;
 *   entering a TERRAIN cell costs TERRAIN_COST × step length.
 * - Movement is either 4-directional (N, E, S, W; step length 1) or
 *   8-directional (adds NE, SE, SW, NW; step length √2). Corner cutting is
 *   never allowed: a diagonal move is legal only when both orthogonal cells it
 *   passes between are not walls.
 * - The cost of a path is the sum of the costs of its moves. The start cell's
 *   own weight is never paid; the target cell's weight is paid on entry.
 *
 * Algorithms
 * ----------
 * - Breadth-first search (BFS): FIFO queue, ignores weights. Returns a path
 *   with the fewest moves. It is cost-optimal only when every move costs the
 *   same, i.e. 4-directional movement on a grid without terrain.
 * - Dijkstra: best-first search ordered by g (cost so far) using a binary
 *   heap with lazy deletion. Optimal for any non-negative edge costs.
 * - A*: best-first search ordered by f = g + h. h is the Manhattan distance
 *   for 4-directional movement and the octile distance for 8-directional
 *   movement. Both are admissible and consistent under the cost model above
 *   because every move costs at least its geometric length and the minimum
 *   cell weight is 1, so A* returns an optimal path.
 *
 * All three searches terminate when the target is *dequeued* (expanded), so
 * their "expanded" counts are directly comparable. Ties are broken
 * deterministically: neighbours are generated in a fixed order and the heap
 * orders equal keys by smaller h, then by insertion order (FIFO).
 */

export const CELL = Object.freeze({ OPEN: 0, WALL: 1, TERRAIN: 2 });
export const TERRAIN_COST = 5;
export const ORTHOGONAL_COST = 1;
export const DIAGONAL_COST = Math.SQRT2;
export const MAX_DIMENSION = 400;

export const ALGORITHMS = Object.freeze({
  bfs: Object.freeze({ id: 'bfs', name: 'Breadth-first search', short: 'BFS' }),
  dijkstra: Object.freeze({ id: 'dijkstra', name: "Dijkstra's algorithm", short: 'Dijkstra' }),
  astar: Object.freeze({ id: 'astar', name: 'A* search', short: 'A*' }),
});

export const HEURISTIC_NAMES = Object.freeze({ 4: 'Manhattan distance', 8: 'Octile distance' });

// Neighbour generation order is part of the deterministic tie-breaking.
const ORTHOGONAL_STEPS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, W
const DIAGONAL_STEPS = [[1, -1], [1, 1], [-1, 1], [-1, -1]]; // NE, SE, SW, NW

function assertInteger(value, name, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer between ${min} and ${max}, received ${String(value)}`);
  }
}

export function normaliseMovement(movement) {
  if (movement === 4 || movement === 8) return movement;
  throw new RangeError(`movement must be 4 or 8, received ${String(movement)}`);
}

/* ------------------------------------------------------------------ grid */

export function createGrid(cols, rows) {
  assertInteger(cols, 'cols', 1, MAX_DIMENSION);
  assertInteger(rows, 'rows', 1, MAX_DIMENSION);
  return { cols, rows, cells: new Uint8Array(cols * rows) };
}

export function cloneGrid(grid) {
  return { cols: grid.cols, rows: grid.rows, cells: Uint8Array.from(grid.cells) };
}

export function isGrid(grid) {
  return Boolean(grid) && Number.isInteger(grid.cols) && Number.isInteger(grid.rows)
    && grid.cells instanceof Uint8Array && grid.cells.length === grid.cols * grid.rows;
}

export function toIndex(grid, x, y) { return y * grid.cols + x; }
export function toCoords(grid, index) { return { x: index % grid.cols, y: Math.floor(index / grid.cols) }; }
export function inBounds(grid, x, y) { return x >= 0 && y >= 0 && x < grid.cols && y < grid.rows; }
export function isPassable(grid, index) { return grid.cells[index] !== CELL.WALL; }
export function hasTerrain(grid) { return grid.cells.includes(CELL.TERRAIN); }

/** Cost multiplier paid when a move ENTERS the given cell. Walls are Infinity. */
export function cellCost(grid, index) {
  const type = grid.cells[index];
  if (type === CELL.WALL) return Infinity;
  return type === CELL.TERRAIN ? TERRAIN_COST : 1;
}

/**
 * Default start (left-middle) and target (right-middle) cells for a grid size.
 * The two cells are always distinct when the grid has more than one cell.
 */
export function defaultEndpoints(cols, rows) {
  const inset = Math.max(0, Math.floor(cols / 6));
  const y = Math.floor(rows / 2);
  const grid = { cols, rows };
  let start = toIndex(grid, Math.min(inset, cols - 1), y);
  let target = toIndex(grid, Math.max(0, cols - 1 - inset), y);
  if (start === target && cols * rows > 1) {
    start = 0;
    target = cols * rows - 1;
  }
  return { start, target };
}

/**
 * Legal moves out of `index`, each as { index, step, cost }.
 * `step` is the geometric length (1 or √2), `cost` = step × weight of the
 * entered cell. Diagonal moves never cut corners.
 */
export function neighbors(grid, index, movement = 4) {
  movement = normaliseMovement(movement);
  const { x, y } = toCoords(grid, index);
  const result = [];
  for (const [dx, dy] of ORTHOGONAL_STEPS) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(grid, nx, ny)) continue;
    const j = toIndex(grid, nx, ny);
    if (!isPassable(grid, j)) continue;
    result.push({ index: j, step: ORTHOGONAL_COST, cost: ORTHOGONAL_COST * cellCost(grid, j) });
  }
  if (movement === 8) {
    for (const [dx, dy] of DIAGONAL_STEPS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(grid, nx, ny)) continue;
      const j = toIndex(grid, nx, ny);
      if (!isPassable(grid, j)) continue;
      // Strict no-corner-cutting rule: both cells the move passes between must be open.
      if (!isPassable(grid, toIndex(grid, nx, y)) || !isPassable(grid, toIndex(grid, x, ny))) continue;
      result.push({ index: j, step: DIAGONAL_COST, cost: DIAGONAL_COST * cellCost(grid, j) });
    }
  }
  return result;
}

/* ------------------------------------------------------------ heuristics */

export function manhattan(dx, dy) { return Math.abs(dx) + Math.abs(dy); }

export function octile(dx, dy) {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return Math.max(ax, ay) + (DIAGONAL_COST - 1) * Math.min(ax, ay);
}

export function heuristicFor(movement) {
  return normaliseMovement(movement) === 8 ? octile : manhattan;
}

/* ---------------------------------------------------------- binary heap */

export class MinHeap {
  constructor(compare) {
    this.compare = compare;
    this.items = [];
  }

  get size() { return this.items.length; }

  peek() { return this.items[0]; }

  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(a[i], a[parent]) >= 0) break;
      [a[i], a[parent]] = [a[parent], a[i]];
      i = parent;
    }
  }

  pop() {
    const a = this.items;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      const n = a.length;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < n && this.compare(a[left], a[smallest]) < 0) smallest = left;
        if (right < n && this.compare(a[right], a[smallest]) < 0) smallest = right;
        if (smallest === i) break;
        [a[i], a[smallest]] = [a[smallest], a[i]];
        i = smallest;
      }
    }
    return top;
  }
}

/* ------------------------------------------------------------- searches */

function validateSearchInputs(grid, start, target, movement) {
  if (!isGrid(grid)) throw new TypeError('grid must be created with createGrid()');
  const n = grid.cells.length;
  assertInteger(start, 'start', 0, n - 1);
  assertInteger(target, 'target', 0, n - 1);
  if (!isPassable(grid, start)) throw new RangeError('the start cell is a wall');
  if (!isPassable(grid, target)) throw new RangeError('the target cell is a wall');
  return normaliseMovement(movement);
}

/** Follows the predecessor links from target back to start. */
export function reconstructPath(cameFrom, start, target) {
  const path = [];
  let i = target;
  const limit = cameFrom.length + 1;
  while (i !== -1 && path.length < limit) {
    path.push(i);
    if (i === start) break;
    i = cameFrom[i];
  }
  if (path[path.length - 1] !== start) return [];
  path.reverse();
  return path;
}

/**
 * Checks that `path` is a legal route from start to target under the movement
 * rules and recomputes its cost from the grid. Used by BFS (to report the
 * weighted cost of its step-optimal route), by the UI and by the tests.
 */
export function validatePath(grid, path, start, target, movement = 4) {
  movement = normaliseMovement(movement);
  if (!Array.isArray(path) || path.length === 0) return { ok: false, reason: 'the path is empty', cost: null, steps: null };
  if (path[0] !== start) return { ok: false, reason: 'the path does not begin at the start cell', cost: null, steps: null };
  if (path[path.length - 1] !== target) return { ok: false, reason: 'the path does not end at the target cell', cost: null, steps: null };
  if (new Set(path).size !== path.length) return { ok: false, reason: 'the path revisits a cell', cost: null, steps: null };
  let cost = 0;
  for (let k = 1; k < path.length; k += 1) {
    const from = path[k - 1];
    const to = path[k];
    const move = neighbors(grid, from, movement).find((nb) => nb.index === to);
    if (!move) return { ok: false, reason: `illegal move from cell ${from} to cell ${to}`, cost: null, steps: null };
    cost += move.cost;
  }
  return { ok: true, reason: null, cost, steps: path.length - 1 };
}

export function pathCost(grid, path, start, target, movement = 4) {
  const check = validatePath(grid, path, start, target, movement);
  if (!check.ok) throw new Error(check.reason);
  return check.cost;
}

/**
 * Breadth-first search. Yields one event per dequeued cell —
 * { type: 'expand', index, g, f, discovered } where g = f = depth in moves and
 * `discovered` lists the cells enqueued by this expansion — and returns the
 * result object when finished.
 */
export function* bfs(grid, start, target, options = {}) {
  const movement = validateSearchInputs(grid, start, target, options.movement ?? 4);
  const n = grid.cells.length;
  const visited = new Uint8Array(n);
  const cameFrom = new Int32Array(n).fill(-1);
  const depth = new Int32Array(n);
  const queue = new Int32Array(n); // every cell is enqueued at most once
  let head = 0;
  let tail = 0;
  queue[tail++] = start;
  visited[start] = 1;
  let expanded = 0;
  let discovered = 1;
  let maxFrontier = 1;
  let found = false;
  while (head < tail) {
    const i = queue[head++];
    expanded += 1;
    if (i === target) {
      found = true;
      yield { type: 'expand', index: i, g: depth[i], f: depth[i], discovered: [] };
      break;
    }
    const newly = [];
    for (const nb of neighbors(grid, i, movement)) {
      const j = nb.index;
      if (visited[j]) continue;
      visited[j] = 1;
      cameFrom[j] = i;
      depth[j] = depth[i] + 1;
      queue[tail++] = j;
      newly.push(j);
      discovered += 1;
    }
    maxFrontier = Math.max(maxFrontier, tail - head);
    yield { type: 'expand', index: i, g: depth[i], f: depth[i], discovered: newly };
  }
  const path = found ? reconstructPath(cameFrom, start, target) : [];
  const cost = found ? pathCost(grid, path, start, target, movement) : null;
  return { algorithm: 'bfs', found, path, steps: found ? path.length - 1 : null, cost, expanded, discovered, maxFrontier };
}

function* bestFirst(grid, start, target, movement, heuristic, algorithmId) {
  const n = grid.cells.length;
  const g = new Float64Array(n).fill(Infinity);
  const cameFrom = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const { x: tx, y: ty } = toCoords(grid, target);
  const h = (index) => {
    if (!heuristic) return 0;
    const { x, y } = toCoords(grid, index);
    return heuristic(x - tx, y - ty);
  };
  let order = 0;
  const heap = new MinHeap((a, b) => (a.f - b.f) || (a.h - b.h) || (a.order - b.order));
  g[start] = 0;
  const h0 = h(start);
  heap.push({ index: start, g: 0, h: h0, f: h0, order: order++ });
  let expanded = 0;
  let discovered = 1;
  let maxFrontier = 1;
  let found = false;
  while (heap.size > 0) {
    const node = heap.pop();
    const i = node.index;
    if (closed[i] || node.g > g[i]) continue; // stale heap entry (lazy deletion)
    closed[i] = 1;
    expanded += 1;
    if (i === target) {
      found = true;
      yield { type: 'expand', index: i, g: node.g, f: node.f, discovered: [] };
      break;
    }
    const newly = [];
    for (const nb of neighbors(grid, i, movement)) {
      const j = nb.index;
      if (closed[j]) continue; // consistent heuristic ⇒ closed cells are final
      const candidate = g[i] + nb.cost;
      if (candidate < g[j]) {
        if (g[j] === Infinity) {
          newly.push(j);
          discovered += 1;
        }
        g[j] = candidate;
        cameFrom[j] = i;
        const hj = h(j);
        heap.push({ index: j, g: candidate, h: hj, f: candidate + hj, order: order++ });
      }
    }
    maxFrontier = Math.max(maxFrontier, discovered - expanded);
    yield { type: 'expand', index: i, g: node.g, f: node.f, discovered: newly };
  }
  const path = found ? reconstructPath(cameFrom, start, target) : [];
  return { algorithm: algorithmId, found, path, steps: found ? path.length - 1 : null, cost: found ? g[target] : null, expanded, discovered, maxFrontier };
}

/** Dijkstra's algorithm: best-first search on g alone (heuristic 0). */
export function* dijkstra(grid, start, target, options = {}) {
  const movement = validateSearchInputs(grid, start, target, options.movement ?? 4);
  return yield* bestFirst(grid, start, target, movement, null, 'dijkstra');
}

/** A*: best-first search on f = g + h with an admissible, consistent heuristic. */
export function* astar(grid, start, target, options = {}) {
  const movement = validateSearchInputs(grid, start, target, options.movement ?? 4);
  return yield* bestFirst(grid, start, target, movement, heuristicFor(movement), 'astar');
}

const SEARCHES = { bfs, dijkstra, astar };

export function createSearch(algorithmId, grid, start, target, options = {}) {
  const search = SEARCHES[algorithmId];
  if (!search) throw new RangeError(`unknown algorithm "${String(algorithmId)}"`);
  return search(grid, start, target, options);
}

function now() {
  return (typeof performance !== 'undefined' && typeof performance.now === 'function') ? performance.now() : Date.now();
}

/**
 * Runs a search to completion, recording every yielded event in `trace` and
 * measuring wall-clock time around the pure computation (including the cost
 * of recording the trace). The grid is never mutated.
 */
export function runSearch(algorithmId, grid, start, target, options = {}) {
  const movement = normaliseMovement(options.movement ?? 4);
  const generator = createSearch(algorithmId, grid, start, target, { movement });
  const trace = [];
  const t0 = now();
  let step = generator.next();
  while (!step.done) {
    trace.push(step.value);
    step = generator.next();
  }
  const elapsedMs = now() - t0;
  const result = step.value;
  const costOptimalityGuaranteed = algorithmId === 'bfs' ? (movement === 4 && !hasTerrain(grid)) : true;
  return {
    ...result,
    trace,
    elapsedMs,
    movement,
    heuristic: algorithmId === 'astar' ? HEURISTIC_NAMES[movement] : null,
    costOptimalityGuaranteed,
  };
}

/** Number of cells reachable from `start` (including itself) under the movement rules. */
export function reachableCells(grid, start, movement = 4) {
  movement = normaliseMovement(movement);
  const seen = new Uint8Array(grid.cells.length);
  const stack = [start];
  seen[start] = 1;
  let count = 0;
  while (stack.length > 0) {
    const i = stack.pop();
    count += 1;
    for (const nb of neighbors(grid, i, movement)) {
      if (!seen[nb.index]) {
        seen[nb.index] = 1;
        stack.push(nb.index);
      }
    }
  }
  return count;
}

/* ------------------------------------------------------ layout generators */

/** Small, fast, seedable PRNG (mulberry32). Same seed ⇒ same sequence everywhere. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normaliseSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xFFFFFFFF) {
    throw new RangeError(`seed must be an integer between 0 and ${0xFFFFFFFF}, received ${String(seed)}`);
  }
  return seed >>> 0;
}

/**
 * Perfect maze by iterative recursive backtracking on the odd-coordinate
 * lattice (1-cell-wide corridors, 1-cell-thick walls), optionally "braided"
 * by reopening a deterministic fraction of walls to create loops.
 * Returns { grid, start, target } with start at the top-left room and target
 * at the bottom-right room. Grids whose odd lattice holds fewer than two rooms
 * (both dimensions below 5, or any dimension below 3) are too small for a maze
 * and fall back to an open grid with the default endpoints.
 */
export function generateMaze(cols, rows, seed, options = {}) {
  const braid = options.braid ?? 0.08;
  const grid = createGrid(cols, rows);
  const random = mulberry32(normaliseSeed(seed));
  const maxX = cols - 2 - ((cols - 2) % 2 === 0 ? 1 : 0); // largest odd x ≤ cols − 2
  const maxY = rows - 2 - ((rows - 2) % 2 === 0 ? 1 : 0);
  if (cols < 3 || rows < 3 || (maxX === 1 && maxY === 1)) {
    return { grid, ...defaultEndpoints(cols, rows) };
  }
  grid.cells.fill(CELL.WALL);
  const carve = (x, y) => { grid.cells[toIndex(grid, x, y)] = CELL.OPEN; };
  const visited = new Uint8Array(cols * rows);
  const stack = [[1, 1]];
  visited[toIndex(grid, 1, 1)] = 1;
  carve(1, 1);
  while (stack.length > 0) {
    const [x, y] = stack[stack.length - 1];
    const candidates = [];
    for (const [dx, dy] of ORTHOGONAL_STEPS) {
      const nx = x + 2 * dx;
      const ny = y + 2 * dy;
      if (nx < 1 || ny < 1 || nx > maxX || ny > maxY) continue;
      if (!visited[toIndex(grid, nx, ny)]) candidates.push([nx, ny, dx, dy]);
    }
    if (candidates.length === 0) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = candidates[Math.floor(random() * candidates.length)];
    carve(x + dx, y + dy);
    carve(nx, ny);
    visited[toIndex(grid, nx, ny)] = 1;
    stack.push([nx, ny]);
  }
  if (braid > 0) {
    // Row-major scan so that the random draws happen in a fixed order.
    for (let y = 1; y <= maxY; y += 1) {
      for (let x = 1; x <= maxX; x += 1) {
        const betweenHorizontal = (y % 2 === 1) && (x % 2 === 0);
        const betweenVertical = (x % 2 === 1) && (y % 2 === 0);
        if (!betweenHorizontal && !betweenVertical) continue;
        const i = toIndex(grid, x, y);
        if (grid.cells[i] !== CELL.WALL) continue;
        if (random() < braid) grid.cells[i] = CELL.OPEN;
      }
    }
  }
  return { grid, start: toIndex(grid, 1, 1), target: toIndex(grid, maxX, maxY) };
}

/**
 * Independent random obstacles: each cell becomes a wall with probability
 * `wallDensity`, otherwise terrain with probability `terrainDensity`. The
 * start and target cells are always kept open. A route is not guaranteed —
 * that is deliberate, so the "no route" outcome can be demonstrated.
 */
export function generateRandomField(cols, rows, seed, options = {}) {
  const wallDensity = options.wallDensity ?? 0.28;
  const terrainDensity = options.terrainDensity ?? 0.12;
  if (!(wallDensity >= 0 && terrainDensity >= 0 && wallDensity + terrainDensity <= 1)) {
    throw new RangeError('densities must be non-negative and sum to at most 1');
  }
  const grid = createGrid(cols, rows);
  const random = mulberry32(normaliseSeed(seed));
  for (let i = 0; i < grid.cells.length; i += 1) {
    const r = random();
    if (r < wallDensity) grid.cells[i] = CELL.WALL;
    else if (r < wallDensity + terrainDensity) grid.cells[i] = CELL.TERRAIN;
  }
  const { start, target } = defaultEndpoints(cols, rows);
  grid.cells[start] = CELL.OPEN;
  grid.cells[target] = CELL.OPEN;
  return { grid, start, target };
}

export const LAYOUTS = Object.freeze({
  maze: Object.freeze({ id: 'maze', name: 'Perfect maze (recursive backtracker)', generate: generateMaze }),
  field: Object.freeze({ id: 'field', name: 'Random field (walls + terrain)', generate: generateRandomField }),
});
