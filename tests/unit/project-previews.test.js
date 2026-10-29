import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPathPreview, pathPreviewFrame, createSecurityPreview, securityPreviewFrame } from '../../project-previews.js';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const committedPath = (name) => html.match(new RegExp(`class="${name}" d="([^"]*)"`))[1];

describe('animated project previews preserve their underlying evidence', () => {
  it('replays the A* trace and ends at the same route as the provenance-checked static artwork', () => {
    const model = createPathPreview();
    assert.deepEqual(pathPreviewFrame(model, 0), { visited: '', frontier: '', route: '', expanded: 0, found: false });
    const first = pathPreviewFrame(model, 1);
    assert.equal(first.expanded, 1);
    assert.ok(first.visited.length > 0 && first.frontier.length > 0);
    assert.equal(first.route, '', 'the route is not revealed during search');
    const end = pathPreviewFrame(model, model.result.trace.length, model.result.path.length);
    assert.equal(end.route, committedPath('lab-art-route'));
    assert.equal(end.expanded, new Set(model.result.trace.map((event) => event.index)).size);
    assert.equal(end.found, true);
  });

  it('keeps repeated pathfinding frames deterministic without mutating the recorded trace', () => {
    const model = createPathPreview();
    const original = JSON.stringify(model.result);
    const before = pathPreviewFrame(model, 5);
    pathPreviewFrame(model, 100000, 100000);
    assert.deepEqual(pathPreviewFrame(model, 5), before);
    assert.equal(JSON.stringify(model.result), original);
  });

  it('matches the provenance-checked security events and cursor, while clipping alert spans at the playhead', () => {
    const model = createSecurityPreview();
    const frame = securityPreviewFrame(model, Math.round(model.events.length * 0.72));
    for (const key of ['success', 'failure', 'future']) assert.equal(frame.paths[key], committedPath(`sec-art-${key}`), key);
    assert.equal(frame.cursorPath, committedPath('sec-art-cursor'));
    const spans = (value) => [...value.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)v([\d.]+)/g)].map((m) => m.slice(1).map(Number));
    const playhead = Number(frame.cursorPath.match(/^M([\d.]+)/)[1]);
    for (const key of ['r1', 'r2', 'r3']) {
      const original = spans(committedPath(`sec-art-${key}`));
      const current = spans(frame.paths[key]);
      assert.equal(current.length, original.length);
      current.forEach(([left, top, width, height], i) => {
        assert.deepEqual([left, top, height], [original[i][0], original[i][1], original[i][3]]);
        assert.ok(width <= original[i][2], 'a replay cannot exceed the full recorded episode');
        assert.ok(left + width <= Math.max(playhead + 1.6, left + 3.1), 'future alert extent remains hidden');
      });
    }
  });

  it('reveals security events and alerts only when their recorded trigger has been reached', () => {
    const model = createSecurityPreview();
    const start = securityPreviewFrame(model, 0);
    assert.equal(start.paths.success, '');
    assert.equal(start.paths.failure, '');
    assert.equal(start.visibleAlerts, 0);
    assert.ok(start.paths.future.length > 0);
    const firstTrigger = Math.min(...model.alerts.filter((alert) => model.lanes.has(alert.subject.source)).map((alert) => alert.triggerIndex));
    assert.equal(securityPreviewFrame(model, firstTrigger).visibleAlerts, 0);
    assert.ok(securityPreviewFrame(model, firstTrigger + 1).visibleAlerts > 0);
    const end = securityPreviewFrame(model, model.events.length);
    assert.equal(end.paths.future, '');
    assert.equal(end.cursor, model.events.length);
    assert.equal(end.visibleAlerts, model.alerts.filter((alert) => model.lanes.has(alert.subject.source)).length);
  });
});
