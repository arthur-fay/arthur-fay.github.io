import assert from 'node:assert/strict';
import { test } from 'node:test';
import { city, boroughs, scores } from '../../lab/nyc-rentals/data.js';
import { rankNeighborhoods } from '../../lab/nyc-rentals/model.js';

test('the public aggregates retain all 16 snapshots and five boroughs', () => {
  assert.equal(city.length, 16);
  assert.equal(city[0].month, '2025-02');
  assert.deepEqual(city.at(-1), { month: '2026-05', listings: 20385, asking: 4050, effective: 4000, concessions: 10.29 });
  assert.equal(Object.keys(boroughs).length, 5);
  for (const rows of Object.values(boroughs)) assert.deepEqual(rows.map(r => r.month), city.map(r => r.month));
  assert.equal(boroughs['Staten Island'].at(-1).listings, 20);
  assert.equal(boroughs.Bronx.at(-1).concessions, 21.09);
});

test('ranking filters and sorts published scores without inventing a Staten Island result', () => {
  const filters = { borough: '', tier: '', search: '', sort: 'score' };
  assert.equal(scores.length, 94);
  assert.equal(rankNeighborhoods(scores, filters).filter(r => r.tier === 'Strong').length, 6);
  assert.deepEqual(rankNeighborhoods(scores, { ...filters, borough: 'Staten Island' }), []);
  const result = rankNeighborhoods(scores, { ...filters, borough: 'Brooklyn', search: '  a ', sort: 'asking' });
  assert.ok(result.length > 1);
  assert.ok(result.every((r, i) => r.borough === 'Brooklyn' && r.name.toLowerCase().includes('a') && (!i || result[i - 1].asking <= r.asking)));
  assert.ok(scores.every(r => r.components.length === 4 && r.components.every(Number.isFinite)));
});
