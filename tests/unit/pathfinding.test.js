/**
 * Unit tests for the pure pathfinding module. Run with: node --test tests/unit/*.test.js
 * No dependencies beyond Node's built-in test runner.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../../lab/pathfinding/pathfinding.js';

const EPS = 1e-9;
const ALGOS = ['bfs', 'dijkstra', 'astar'];
const MOVES = [4, 8];

function gridFromRows(rows) {
  // '.' open, '#' wall, '~' terrain, 'S' start (open), 'T' target (open)
  const height = rows.length;
  const width = rows[0].length;
  const grid = P.createGrid(width, height);
  let start = -1;
  let target = -1;
  rows.forEach((row, y) => {
    assert.equal(row.length, width, 'ragged fixture');
    [...row].forEach((ch, x) => {
      const i = P.toIndex(grid, x, y);
      if (ch === '#') grid.cells[i] = P.CELL.WALL;
      else if (ch === '~') grid.cells[i] = P.CELL.TERRAIN;
      else if (ch === 'S') start = i;
      else if (ch === 'T') target = i;
    });
  });
  return { grid, start, target };
}

/** Independent reference BFS depth (moves) from start, or -1 when unreachable. */
function referenceDepths(grid, start, movement) {
  const depth = new Int32Array(grid.cells.length).fill(-1);
  const queue = [start];
  depth[start] = 0;
  for (let head = 0; head < queue.length; head += 1) {
    const i = queue[head];
    for (const nb of P.neighbors(grid, i, movement)) {
      if (depth[nb.index] === -1) {
        depth[nb.index] = depth[i] + 1;
        queue.push(nb.index);
      }
    }
  }
  return depth;
}

function assertValidResult(result, grid, start, target, movement) {
  if (result.found) {
    const check = P.validatePath(grid, result.path, start, target, movement);
    assert.ok(check.ok, `${result.algorithm}: ${check.reason}`);
    assert.equal(result.steps, result.path.length - 1);
    assert.ok(Math.abs(check.cost - result.cost) < EPS, `${result.algorithm}: reported cost ${result.cost} ≠ recomputed ${check.cost}`);
  } else {
    assert.deepEqual(result.path, []);
    assert.equal(result.steps, null);
    assert.equal(result.cost, null);
  }
  assert.equal(result.trace.length, result.expanded, 'one trace event per expansion');
  assert.ok(result.elapsedMs >= 0 && Number.isFinite(result.elapsedMs));
}

describe('grid helpers', () => {
  it('creates grids and validates dimensions', () => {
    const grid = P.createGrid(5, 3);
    assert.equal(grid.cells.length, 15);
    assert.ok(P.isGrid(grid));
    assert.throws(() => P.createGrid(0, 3), RangeError);
    assert.throws(() => P.createGrid(2.5, 3), RangeError);
    assert.throws(() => P.createGrid(P.MAX_DIMENSION + 1, 3), RangeError);
  });

  it('round-trips indices and coordinates', () => {
    const grid = P.createGrid(7, 4);
    for (let i = 0; i < grid.cells.length; i += 1) {
      const { x, y } = P.toCoords(grid, i);
      assert.ok(P.inBounds(grid, x, y));
      assert.equal(P.toIndex(grid, x, y), i);
    }
    assert.equal(P.inBounds(grid, 7, 0), false);
    assert.equal(P.inBounds(grid, 0, -1), false);
  });

  it('clones without sharing memory', () => {
    const grid = P.createGrid(3, 3);
    const copy = P.cloneGrid(grid);
    copy.cells[0] = P.CELL.WALL;
    assert.equal(grid.cells[0], P.CELL.OPEN);
  });

  it('computes default endpoints inside the grid', () => {
    for (const [cols, rows] of [[1, 1], [2, 1], [21, 13], [61, 37]]) {
      const { start, target } = P.defaultEndpoints(cols, rows);
      assert.ok(start >= 0 && start < cols * rows);
      assert.ok(target >= 0 && target < cols * rows);
    }
  });
});

describe('neighbours and the movement rules', () => {
  it('returns 4 orthogonal moves in the interior and 2 in a corner', () => {
    const grid = P.createGrid(3, 3);
    assert.equal(P.neighbors(grid, 4, 4).length, 4);
    assert.equal(P.neighbors(grid, 0, 4).length, 2);
    assert.equal(P.neighbors(grid, 4, 8).length, 8);
    assert.equal(P.neighbors(grid, 0, 8).length, 3);
  });

  it('generates neighbours in a fixed order (N, E, S, W, NE, SE, SW, NW)', () => {
    const grid = P.createGrid(3, 3);
    const indices = P.neighbors(grid, 4, 8).map((nb) => nb.index);
    assert.deepEqual(indices, [1, 5, 7, 3, 2, 8, 6, 0]);
  });

  it('never enters walls and prices terrain and diagonals correctly', () => {
    const { grid } = gridFromRows(['.#.', '.~.', '...']);
    const fromCentre = P.neighbors(grid, 4, 8);
    assert.ok(!fromCentre.some((nb) => nb.index === 1), 'wall is never a neighbour');
    const fromTopLeft = P.neighbors(grid, 0, 8);
    const terrainMove = fromTopLeft.find((nb) => nb.index === 4);
    assert.equal(terrainMove, undefined, 'diagonal into terrain blocked by the wall corner');
    const down = fromTopLeft.find((nb) => nb.index === 3);
    assert.equal(down.cost, 1);
    const fromBottomLeft = P.neighbors(grid, 6, 8);
    const diagTerrain = fromBottomLeft.find((nb) => nb.index === 4);
    assert.ok(diagTerrain, 'diagonal into terrain allowed when both sides are open');
    assert.ok(Math.abs(diagTerrain.cost - Math.SQRT2 * P.TERRAIN_COST) < EPS);
    const upIntoTerrain = P.neighbors(grid, 7, 4).find((nb) => nb.index === 4);
    assert.equal(upIntoTerrain.cost, P.TERRAIN_COST);
  });

  it('forbids corner cutting even when only one orthogonal cell is a wall', () => {
    const oneWall = gridFromRows(['.#', '..']).grid;
    assert.ok(!P.neighbors(oneWall, 0, 8).some((nb) => nb.index === 3));
    const otherWall = gridFromRows(['..', '#.']).grid;
    assert.ok(!P.neighbors(otherWall, 0, 8).some((nb) => nb.index === 3));
    const open = gridFromRows(['..', '..']).grid;
    assert.ok(P.neighbors(open, 0, 8).some((nb) => nb.index === 3));
  });

  it('rejects unsupported movement modes', () => {
    const grid = P.createGrid(2, 2);
    assert.throws(() => P.neighbors(grid, 0, 6), RangeError);
    assert.throws(() => P.runSearch('astar', grid, 0, 3, { movement: '4' }), RangeError);
  });
});

describe('heuristics', () => {
  it('computes Manhattan and octile distances', () => {
    assert.equal(P.manhattan(3, -4), 7);
    assert.ok(Math.abs(P.octile(3, -4) - (4 + (Math.SQRT2 - 1) * 3)) < EPS);
    assert.equal(P.octile(5, 0), 5);
    assert.equal(P.heuristicFor(4), P.manhattan);
    assert.equal(P.heuristicFor(8), P.octile);
  });

  it('is consistent on random weighted grids for both movement modes', () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const { grid } = P.generateRandomField(23, 17, seed, { wallDensity: 0.2, terrainDensity: 0.25 });
      for (const movement of MOVES) {
        const h = P.heuristicFor(movement);
        const target = P.toIndex(grid, 22, 16);
        const { x: tx, y: ty } = P.toCoords(grid, target);
        const hOf = (i) => { const { x, y } = P.toCoords(grid, i); return h(x - tx, y - ty); };
        for (let u = 0; u < grid.cells.length; u += 1) {
          if (!P.isPassable(grid, u)) continue;
          for (const nb of P.neighbors(grid, u, movement)) {
            assert.ok(hOf(u) <= nb.cost + hOf(nb.index) + 1e-12, `inconsistent at ${u}→${nb.index}`);
          }
        }
      }
    }
  });

  it('never overestimates the optimal cost (admissibility, sampled)', () => {
    for (let seed = 100; seed < 120; seed += 1) {
      const { grid } = P.generateRandomField(21, 13, seed, { wallDensity: 0.2, terrainDensity: 0.2 });
      const random = P.mulberry32(seed);
      for (const movement of MOVES) {
        const h = P.heuristicFor(movement);
        for (let sample = 0; sample < 15; sample += 1) {
          const a = Math.floor(random() * grid.cells.length);
          const b = Math.floor(random() * grid.cells.length);
          if (!P.isPassable(grid, a) || !P.isPassable(grid, b)) continue;
          const result = P.runSearch('dijkstra', grid, a, b, { movement });
          if (!result.found) continue;
          const pa = P.toCoords(grid, a);
          const pb = P.toCoords(grid, b);
          assert.ok(h(pa.x - pb.x, pa.y - pb.y) <= result.cost + EPS);
        }
      }
    }
  });
});

describe('MinHeap', () => {
  it('pops items in ascending order with deterministic tie-breaking', () => {
    const heap = new P.MinHeap((a, b) => (a.key - b.key) || (a.order - b.order));
    const random = P.mulberry32(3);
    const items = [];
    for (let i = 0; i < 500; i += 1) items.push({ key: Math.floor(random() * 20), order: i });
    items.forEach((item) => heap.push(item));
    assert.equal(heap.size, 500);
    const popped = [];
    while (heap.size > 0) popped.push(heap.pop());
    const expected = [...items].sort((a, b) => (a.key - b.key) || (a.order - b.order));
    assert.deepEqual(popped, expected);
    assert.equal(heap.pop(), undefined);
  });
});

describe('empty grid', () => {
  it('all algorithms find the straight-line optimum', () => {
    const grid = P.createGrid(21, 13);
    const { start, target } = P.defaultEndpoints(21, 13);
    const sp = P.toCoords(grid, start);
    const tp = P.toCoords(grid, target);
    for (const movement of MOVES) {
      const expectedCost = movement === 4 ? P.manhattan(sp.x - tp.x, sp.y - tp.y) : P.octile(sp.x - tp.x, sp.y - tp.y);
      for (const algo of ALGOS) {
        const result = P.runSearch(algo, grid, start, target, { movement });
        assertValidResult(result, grid, start, target, movement);
        assert.ok(result.found, `${algo} must find a path on an empty grid`);
        if (algo === 'bfs' && movement === 8) {
          assert.equal(result.steps, Math.max(Math.abs(sp.x - tp.x), Math.abs(sp.y - tp.y)), 'BFS minimises moves (Chebyshev distance)');
        } else {
          assert.ok(Math.abs(result.cost - expectedCost) < EPS, `${algo}/${movement}: cost ${result.cost} ≠ ${expectedCost}`);
        }
        assert.equal(result.costOptimalityGuaranteed, algo !== 'bfs' || movement === 4);
      }
    }
  });

  it('A* expands far fewer cells than Dijkstra on an open grid', () => {
    const grid = P.createGrid(31, 19);
    const { start, target } = P.defaultEndpoints(31, 19);
    const astar = P.runSearch('astar', grid, start, target, { movement: 4 });
    const dijkstra = P.runSearch('dijkstra', grid, start, target, { movement: 4 });
    assert.ok(astar.expanded < dijkstra.expanded / 4, `A* ${astar.expanded} vs Dijkstra ${dijkstra.expanded}`);
  });
});

describe('start equals target', () => {
  it('returns a zero-length path after a single expansion', () => {
    const grid = P.createGrid(9, 9);
    for (const algo of ALGOS) {
      for (const movement of MOVES) {
        const result = P.runSearch(algo, grid, 40, 40, { movement });
        assert.ok(result.found);
        assert.deepEqual(result.path, [40]);
        assert.equal(result.steps, 0);
        assert.equal(result.cost, 0);
        assert.equal(result.expanded, 1);
        assert.equal(result.trace.length, 1);
        assert.equal(result.trace[0].index, 40);
      }
    }
  });
});

describe('no route', () => {
  const { grid, start, target } = gridFromRows([
    '....#....',
    '.S..#....',
    '....#..T.',
    '....#....',
  ]);

  it('reports the target as unreachable and explores exactly the reachable component', () => {
    for (const algo of ALGOS) {
      for (const movement of MOVES) {
        const result = P.runSearch(algo, grid, start, target, { movement });
        assertValidResult(result, grid, start, target, movement);
        assert.equal(result.found, false);
        assert.equal(result.expanded, P.reachableCells(grid, start, movement));
        assert.equal(result.expanded, 16);
      }
    }
  });

  it('cannot slip diagonally through a one-cell gap between two walls', () => {
    const diagonalGap = gridFromRows([
      'S#.',
      '#.T',
    ]);
    for (const algo of ALGOS) {
      const result = P.runSearch(algo, diagonalGap.grid, diagonalGap.start, diagonalGap.target, { movement: 8 });
      assert.equal(result.found, false);
      assert.equal(result.expanded, 1);
    }
  });

  it('rejects a start or target placed on a wall, out of range, or an unknown algorithm', () => {
    const wallIndex = P.toIndex(grid, 4, 0);
    assert.throws(() => P.runSearch('astar', grid, wallIndex, target), RangeError);
    assert.throws(() => P.runSearch('astar', grid, start, wallIndex), RangeError);
    assert.throws(() => P.runSearch('astar', grid, -1, target), RangeError);
    assert.throws(() => P.runSearch('astar', grid, start, grid.cells.length), RangeError);
    assert.throws(() => P.runSearch('dfs', grid, start, target), RangeError);
    assert.throws(() => P.runSearch('astar', { cols: 2, rows: 2, cells: [0, 0, 0, 0] }, 0, 3), TypeError);
  });
});

describe('weighted terrain', () => {
  const { grid, start, target } = gridFromRows([
    '.......',
    'S~~~~~T',
    '.......',
  ]);

  it('Dijkstra and A* avoid expensive terrain while BFS takes the fewest moves', () => {
    const bfs = P.runSearch('bfs', grid, start, target, { movement: 4 });
    const dijkstra = P.runSearch('dijkstra', grid, start, target, { movement: 4 });
    const astar = P.runSearch('astar', grid, start, target, { movement: 4 });
    assert.equal(bfs.steps, 6);
    assert.equal(bfs.cost, 5 * P.TERRAIN_COST + 1);
    assert.equal(bfs.costOptimalityGuaranteed, false);
    assert.equal(dijkstra.steps, 8);
    assert.equal(dijkstra.cost, 8);
    assert.equal(astar.cost, 8);
    assert.deepEqual(astar.path, dijkstra.path);
  });

  it('pays the target cell weight but never the start cell weight', () => {
    const fixture = gridFromRows(['~S~T']);
    fixture.grid.cells[fixture.start] = P.CELL.TERRAIN;
    fixture.grid.cells[fixture.target] = P.CELL.TERRAIN;
    const result = P.runSearch('dijkstra', fixture.grid, fixture.start, fixture.target, { movement: 4 });
    assert.equal(result.cost, P.TERRAIN_COST * 2);
  });
});

describe('dense obstacles (random fields)', () => {
  it('keeps every algorithm valid and consistent across 40 dense layouts', () => {
    let routes = 0;
    let blocked = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const { grid, start, target } = P.generateRandomField(31, 19, seed, { wallDensity: 0.42, terrainDensity: 0.15 });
      for (const movement of MOVES) {
        const results = Object.fromEntries(ALGOS.map((algo) => [algo, P.runSearch(algo, grid, start, target, { movement })]));
        for (const algo of ALGOS) assertValidResult(results[algo], grid, start, target, movement);
        const foundValues = new Set(ALGOS.map((algo) => results[algo].found));
        assert.equal(foundValues.size, 1, 'all algorithms agree on reachability');
        if (results.astar.found) {
          routes += 1;
          assert.ok(Math.abs(results.astar.cost - results.dijkstra.cost) < EPS, `seed ${seed}/${movement}: A* ${results.astar.cost} vs Dijkstra ${results.dijkstra.cost}`);
          assert.ok(results.bfs.steps <= results.dijkstra.steps, 'BFS never uses more moves than Dijkstra');
          assert.ok(results.dijkstra.cost <= results.bfs.cost + EPS, 'Dijkstra is never more expensive than BFS');
        } else {
          blocked += 1;
          for (const algo of ALGOS) assert.equal(results[algo].expanded, P.reachableCells(grid, start, movement));
        }
      }
    }
    assert.ok(routes > 0 && blocked > 0, `expected both outcomes, got routes=${routes} blocked=${blocked}`);
  });
});

describe('narrow corridors (perfect mazes)', () => {
  it('has one-cell corridors, a wall border and a unique path that all algorithms return', () => {
    for (const seed of [1, 7, 42, 2024]) {
      const { grid, start, target } = P.generateMaze(31, 19, seed, { braid: 0 });
      for (let x = 0; x < grid.cols; x += 1) {
        assert.equal(grid.cells[P.toIndex(grid, x, 0)], P.CELL.WALL);
        assert.equal(grid.cells[P.toIndex(grid, x, grid.rows - 1)], P.CELL.WALL);
      }
      for (let y = 0; y < grid.rows; y += 1) {
        assert.equal(grid.cells[P.toIndex(grid, 0, y)], P.CELL.WALL);
        assert.equal(grid.cells[P.toIndex(grid, grid.cols - 1, y)], P.CELL.WALL);
      }
      for (let y = 0; y < grid.rows - 1; y += 1) {
        for (let x = 0; x < grid.cols - 1; x += 1) {
          const block = [P.toIndex(grid, x, y), P.toIndex(grid, x + 1, y), P.toIndex(grid, x, y + 1), P.toIndex(grid, x + 1, y + 1)];
          assert.ok(block.some((i) => grid.cells[i] === P.CELL.WALL), `2×2 open block at ${x},${y}`);
        }
      }
      const openCells = grid.cells.filter((c) => c !== P.CELL.WALL).length;
      assert.equal(P.reachableCells(grid, start, 4), openCells, 'every open cell is reachable (perfect maze)');
      const reference = P.runSearch('bfs', grid, start, target, { movement: 4 });
      assert.ok(reference.found);
      for (const algo of ALGOS) {
        for (const movement of MOVES) {
          const result = P.runSearch(algo, grid, start, target, { movement });
          assertValidResult(result, grid, start, target, movement);
          assert.deepEqual(result.path, reference.path, `${algo}/${movement} must return the unique corridor path`);
        }
      }
    }
  });

  it('braiding reopens walls deterministically and keeps the maze solvable', () => {
    const plain = P.generateMaze(31, 19, 5, { braid: 0 });
    const braided = P.generateMaze(31, 19, 5, { braid: 0.1 });
    const openPlain = plain.grid.cells.filter((c) => c !== P.CELL.WALL).length;
    const openBraided = braided.grid.cells.filter((c) => c !== P.CELL.WALL).length;
    assert.ok(openBraided > openPlain, 'braiding opens additional walls');
    assert.ok(P.runSearch('astar', braided.grid, braided.start, braided.target).found);
    assert.deepEqual(P.generateMaze(31, 19, 5, { braid: 0.1 }).grid.cells, braided.grid.cells);
  });

  it('degrades gracefully on tiny grids', () => {
    const tiny = P.generateMaze(2, 2, 1);
    assert.equal(tiny.grid.cells.filter((c) => c === P.CELL.WALL).length, 0);
    assert.ok(P.runSearch('bfs', tiny.grid, tiny.start, tiny.target).found);
    const three = P.generateMaze(3, 3, 1);
    assert.equal(three.grid.cells[P.toIndex(three.grid, 1, 1)], P.CELL.OPEN);
  });
});

describe('deterministic random layouts', () => {
  it('reproduces identical layouts for identical seeds and different layouts otherwise', () => {
    for (const generate of [P.generateMaze, P.generateRandomField]) {
      const a = generate(31, 19, 123);
      const b = generate(31, 19, 123);
      assert.deepEqual(a.grid.cells, b.grid.cells);
      assert.equal(a.start, b.start);
      assert.equal(a.target, b.target);
      const c = generate(31, 19, 124);
      assert.notDeepEqual(a.grid.cells, c.grid.cells);
    }
  });

  it('keeps start and target open and roughly respects the requested densities', () => {
    const { grid, start, target } = P.generateRandomField(101, 101, 99);
    assert.equal(grid.cells[start], P.CELL.OPEN);
    assert.equal(grid.cells[target], P.CELL.OPEN);
    const total = grid.cells.length;
    const walls = grid.cells.filter((c) => c === P.CELL.WALL).length / total;
    const terrain = grid.cells.filter((c) => c === P.CELL.TERRAIN).length / total;
    assert.ok(Math.abs(walls - 0.28) < 0.03, `wall density ${walls}`);
    assert.ok(Math.abs(terrain - 0.12) < 0.03, `terrain density ${terrain}`);
  });

  it('validates seeds and densities', () => {
    assert.throws(() => P.generateMaze(9, 9, -1), RangeError);
    assert.throws(() => P.generateMaze(9, 9, 1.5), RangeError);
    assert.throws(() => P.generateRandomField(9, 9, 1, { wallDensity: 0.8, terrainDensity: 0.5 }), RangeError);
    assert.equal(P.normaliseSeed(0xFFFFFFFF), 0xFFFFFFFF);
  });

  it('mulberry32 produces a reproducible sequence in [0, 1)', () => {
    const a = P.mulberry32(2026);
    const b = P.mulberry32(2026);
    for (let i = 0; i < 1000; i += 1) {
      const value = a();
      assert.equal(value, b());
      assert.ok(value >= 0 && value < 1);
    }
  });
});

describe('trace semantics', () => {
  it('expands each cell at most once, discovers each cell at most once, and orders expansions by key', () => {
    for (const seed of [3, 11]) {
      const { grid, start, target } = P.generateRandomField(31, 19, seed, { wallDensity: 0.25, terrainDensity: 0.2 });
      for (const movement of MOVES) {
        const depths = referenceDepths(grid, start, movement);
        for (const algo of ALGOS) {
          const result = P.runSearch(algo, grid, start, target, { movement });
          const expandedSet = new Set();
          const discoveredSet = new Set([start]);
          let lastKey = -Infinity;
          for (const event of result.trace) {
            assert.equal(event.type, 'expand');
            assert.ok(!expandedSet.has(event.index), 'cell expanded twice');
            expandedSet.add(event.index);
            assert.ok(discoveredSet.has(event.index), 'expanded a cell that was never discovered');
            for (const j of event.discovered) {
              assert.ok(!discoveredSet.has(j), 'cell discovered twice');
              discoveredSet.add(j);
            }
            const key = algo === 'bfs' ? event.g : event.f;
            assert.ok(key >= lastKey - 1e-9, `${algo}: key decreased from ${lastKey} to ${key}`);
            lastKey = key;
            if (algo === 'bfs') assert.equal(event.g, depths[event.index], 'BFS depth matches the reference BFS');
          }
          assert.equal(result.discovered, discoveredSet.size);
          assert.equal(result.expanded, expandedSet.size);
          assert.ok(result.maxFrontier >= 1 && result.maxFrontier <= result.discovered);
        }
      }
    }
  });

  it('is deterministic: identical inputs produce identical traces', () => {
    const { grid, start, target } = P.generateRandomField(31, 19, 8);
    for (const algo of ALGOS) {
      const first = P.runSearch(algo, grid, start, target, { movement: 8 });
      const second = P.runSearch(algo, grid, start, target, { movement: 8 });
      assert.deepEqual(first.trace, second.trace);
      assert.deepEqual(first.path, second.path);
    }
  });
});

describe('cancellation during a search', () => {
  it('can be abandoned part-way without side effects and resumed from scratch identically', () => {
    const { grid, start, target } = P.generateMaze(31, 19, 9);
    const before = Uint8Array.from(grid.cells);
    for (const algo of ALGOS) {
      const generator = P.createSearch(algo, grid, start, target, { movement: 4 });
      const partial = [];
      for (let i = 0; i < 5; i += 1) {
        const step = generator.next();
        assert.equal(step.done, false);
        partial.push(step.value);
      }
      const closed = generator.return(undefined);
      assert.equal(closed.done, true);
      assert.equal(generator.next().done, true, 'a cancelled generator stays finished');
      assert.deepEqual(grid.cells, before, 'the grid is untouched');
      const full = P.runSearch(algo, grid, start, target, { movement: 4 });
      assert.deepEqual(full.trace.slice(0, 5), partial, 'the fresh run replays the same first events');
    }
  });
});

describe('repeated changes to inputs', () => {
  it('never mutates the grid and reacts correctly to walls added and removed', () => {
    const grid = P.createGrid(21, 13);
    const { start, target } = P.defaultEndpoints(21, 13);
    const original = P.runSearch('astar', grid, start, target, { movement: 4 });
    const snapshot = Uint8Array.from(grid.cells);
    assert.deepEqual(grid.cells, snapshot);
    // Block the middle of the found route with a wall that leaves a detour.
    const middle = original.path[Math.floor(original.path.length / 2)];
    grid.cells[middle] = P.CELL.WALL;
    const detour = P.runSearch('astar', grid, start, target, { movement: 4 });
    assert.ok(detour.found);
    assert.ok(!detour.path.includes(middle));
    assert.equal(detour.cost, original.cost + 2, 'the detour around a single wall on a straight route costs two extra moves');
    grid.cells[middle] = P.CELL.OPEN;
    const restored = P.runSearch('astar', grid, start, target, { movement: 4 });
    assert.deepEqual(restored.path, original.path);
    for (let round = 0; round < 10; round += 1) {
      const algo = ALGOS[round % 3];
      const movement = MOVES[round % 2];
      const result = P.runSearch(algo, grid, start, target, { movement });
      assertValidResult(result, grid, start, target, movement);
    }
  });
});

describe('optimality across many layouts (property check)', () => {
  it('A* and Dijkstra return equal optimal costs on 150 seeded weighted layouts in both movement modes', () => {
    let compared = 0;
    for (let seed = 500; seed < 650; seed += 1) {
      const generator = seed % 2 === 0 ? P.generateRandomField : P.generateMaze;
      const { grid, start, target } = generator(31, 19, seed);
      for (const movement of MOVES) {
        const dijkstra = P.runSearch('dijkstra', grid, start, target, { movement });
        const astar = P.runSearch('astar', grid, start, target, { movement });
        assert.equal(astar.found, dijkstra.found);
        if (!astar.found) continue;
        compared += 1;
        assert.ok(Math.abs(astar.cost - dijkstra.cost) < EPS, `seed ${seed}/${movement}: A* ${astar.cost} ≠ Dijkstra ${dijkstra.cost}`);
        assertValidResult(astar, grid, start, target, movement);
        assertValidResult(dijkstra, grid, start, target, movement);
        if (movement === 4 && !P.hasTerrain(grid)) {
          const bfs = P.runSearch('bfs', grid, start, target, { movement });
          assert.ok(Math.abs(bfs.cost - dijkstra.cost) < EPS, 'BFS is cost-optimal for uniform 4-directional grids');
        }
      }
    }
    assert.ok(compared >= 100, `only ${compared} comparisons ran`);
  });
});

describe('path validation', () => {
  const { grid, start, target } = gridFromRows(['S.#', '..T']);
  it('accepts legal paths and rejects malformed ones', () => {
    assert.ok(P.validatePath(grid, [0, 3, 4, 5], start, target, 4).ok);
    assert.equal(P.validatePath(grid, [], start, target, 4).ok, false);
    assert.equal(P.validatePath(grid, [3, 4, 5], start, target, 4).ok, false);
    assert.equal(P.validatePath(grid, [0, 1], start, target, 4).ok, false);
    assert.equal(P.validatePath(grid, [0, 1, 2, 5], start, target, 4).ok, false, 'walks through a wall');
    assert.equal(P.validatePath(grid, [0, 4, 5], start, target, 4).ok, false, 'diagonal under 4-directional rules');
    assert.ok(P.validatePath(grid, [0, 4, 5], start, target, 8).ok, 'diagonal under 8-directional rules');
    assert.equal(P.validatePath(grid, [0, 3, 0, 3, 4, 5], start, target, 4).ok, false, 'revisits a cell');
    assert.throws(() => P.pathCost(grid, [0, 5], start, target, 4), /illegal move/);
  });
});

describe('scale sanity', () => {
  it('handles the largest preset grid without error', () => {
    const grid = P.createGrid(61, 37);
    const { start, target } = P.defaultEndpoints(61, 37);
    for (const algo of ALGOS) {
      const result = P.runSearch(algo, grid, start, target, { movement: 8 });
      assert.ok(result.found);
      assert.ok(result.expanded <= grid.cells.length);
    }
  });
});
