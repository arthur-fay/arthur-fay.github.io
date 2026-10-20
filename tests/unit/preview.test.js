/**
 * Provenance of the Project 03 card artwork in index.html: the SVG must be
 * exactly what a real A* run (4-directional) produces on the seeded random
 * field generateRandomField(16, 9, 11, { wallDensity: 0.26, terrainDensity: 0 }).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as P from '../../lab/pathfinding/pathfinding.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function renderPreview() {
  const cols = 16;
  const rows = 9;
  const size = 10;
  const { grid, start, target } = P.generateRandomField(cols, rows, 11, { wallDensity: 0.26, terrainDensity: 0 });
  const result = P.runSearch('astar', grid, start, target, { movement: 4 });
  const square = (i) => {
    const { x, y } = P.toCoords(grid, i);
    return `M${x * size} ${y * size}h${size}v${size}h-${size}z`;
  };
  const onPath = new Set(result.path);
  const expanded = new Set(result.trace.map((event) => event.index));
  const walls = [];
  for (let i = 0; i < grid.cells.length; i += 1) if (grid.cells[i] === P.CELL.WALL) walls.push(square(i));
  const visited = [];
  for (const event of result.trace) {
    if (!onPath.has(event.index)) visited.push(square(event.index));
    for (const j of event.discovered) if (!onPath.has(j) && !expanded.has(j)) visited.push(square(j));
  }
  const route = result.path.map((i, k) => {
    const { x, y } = P.toCoords(grid, i);
    return `${k === 0 ? 'M' : 'L'}${x * size + size / 2} ${y * size + size / 2}`;
  }).join('');
  const sp = P.toCoords(grid, start);
  const tp = P.toCoords(grid, target);
  return {
    result,
    walls: walls.join(''),
    visited: visited.join(''),
    route,
    startRect: `x="${sp.x * size + 2}" y="${sp.y * size + 2}"`,
    targetRect: `x="${tp.x * size + 2}" y="${tp.y * size + 2}"`,
  };
}

describe('portfolio card preview provenance', () => {
  it('is exactly the A* run on the documented seeded field', () => {
    const preview = renderPreview();
    assert.ok(preview.result.found);
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.ok(html.includes(`class="lab-art-walls" d="${preview.walls}"`), 'wall cells differ from the generator output');
    assert.ok(html.includes(`class="lab-art-visited" d="${preview.visited}"`), 'expanded/frontier cells differ from the A* run');
    assert.ok(html.includes(`class="lab-art-route" d="${preview.route}"`), 'route differs from the A* path');
    assert.ok(html.includes(`class="lab-art-start" ${preview.startRect}`), 'start marker position');
    assert.ok(html.includes(`class="lab-art-target" ${preview.targetRect}`), 'target marker position');
    const optimal = P.runSearch('dijkstra', P.generateRandomField(16, 9, 11, { wallDensity: 0.26, terrainDensity: 0 }).grid, preview.result.path[0], preview.result.path.at(-1), { movement: 4 });
    assert.equal(preview.result.cost, optimal.cost, 'the drawn route is optimal');
  });
});
