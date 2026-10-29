import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPathPreview, pathPreviewFrame, createSecurityPreview, securityPreviewFrame, atlasPreviewFrame, createCommercePreview, commercePreviewFrame } from '../../project-previews.js';
import { PUBLISHED, EXPORTED } from '../../lab/ecommerce/model.js';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const committedPath = (name) => html.match(new RegExp(`class="${name}" d="([^"]*)"`))[1];

describe('animated project previews preserve their underlying evidence', () => {
  it('moves sixteen conceptual packets along their conduits without changing the scientific status', () => {
    const bounds = [[120,65,152,65],[248,65,280,65],[328,82,328,128],[280,145,248,145],[152,145,120,145],[72,162,72,208],[120,225,152,225],[248,225,280,225]];
    for (const progress of [0, 0.1, 0.32, 0.56, 0.81, 1]) {
      const frame = atlasPreviewFrame(progress);
      assert.equal(frame.packets.length, 16);
      assert.ok(frame.node >= 0 && frame.node <= 8 && frame.nodeProgress >= 0 && frame.nodeProgress <= 1);
      frame.packets.forEach(({x,y}, i) => {
        const [x1,y1,x2,y2] = bounds[Math.floor(i / 2)];
        assert.ok(x >= Math.min(x1,x2) && x <= Math.max(x1,x2));
        assert.ok(y >= Math.min(y1,y2) && y <= Math.max(y1,y2));
      });
    }
    assert.notDeepEqual(atlasPreviewFrame(0).packets, atlasPreviewFrame(0.01).packets);
    assert.deepEqual(atlasPreviewFrame(0.4), atlasPreviewFrame(0.4));
    assert.match(atlasPreviewFrame(0.6).copy, /failed calibration/);
    assert.match(atlasPreviewFrame(0.9).copy, /release gate/);
    assert.match(html, /No ATLAS data, charts or projections are reproduced/);
  });

  it('uses the analytics engine published values and original export labels, including honest rounding', () => {
    const report = createCommercePreview();
    assert.equal(report.metrics.revenue, PUBLISHED.revenueDisplay);
    assert.equal(report.metrics.orders, PUBLISHED.ordersDisplay);
    assert.equal(report.metrics.customers, PUBLISHED.customersDisplay);
    assert.equal(report.metrics.delivered, `${PUBLISHED.deliveredPct.toFixed(2)}%`);
    assert.equal(report.metrics.ontime, `${PUBLISHED.onTimeOfDeliveredPct.toFixed(2)}%`);
    for (const [key, value] of Object.entries(report.metrics)) {
      assert.equal(html.match(new RegExp(`data-report-metric="${key}">([^<]+)`))[1], value, `${key}: no-JS figure matches the source`);
    }
    assert.deepEqual([...html.matchAll(/class="report-rate-fill" width="([\d.]+)"/g)].map(match=>Number(match[1])), [PUBLISHED.deliveredPct,PUBLISHED.onTimeOfDeliveredPct]);
    report.categories.forEach((category, index) => {
      assert.equal(category.label, EXPORTED.topCategories[index].label);
      assert.equal(category.revenueBRL, EXPORTED.topCategories[index].revenueBRL);
      const row = html.match(new RegExp(`data-report-category="${index}">([\\s\\S]*?)</div>`))[1];
      assert.ok(row.includes(`<span>${category.label}</span>`) && row.includes(`<b>${category.display}</b>`));
      assert.ok(row.includes(`width="${category.revenueBRL / 10000}"`));
    });
  });

  it('reveals category bars proportionally, holds the complete snapshot and retains the delivery denominator', () => {
    assert.equal(commercePreviewFrame(0).reveal, 0);
    const middle = commercePreviewFrame(0.1);
    assert.ok(middle.reveal > 0 && middle.reveal < 1);
    assert.equal(commercePreviewFrame(0.5).reveal, 1);
    assert.equal(commercePreviewFrame(1).reveal, 1);
    assert.equal(commercePreviewFrame(1).deliveryReveal, 1);
    assert.equal(commercePreviewFrame(-1).chapter, 0);
    assert.equal(commercePreviewFrame(2).chapter, 3);
    assert.match(commercePreviewFrame(0.6).copy, /share of delivered orders/);
    assert.match(html, /of delivered orders/);
  });

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
