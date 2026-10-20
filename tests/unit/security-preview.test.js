/**
 * Provenance of the Project 04 card artwork in index.html: the SVG must be
 * exactly what the security engine produces for the documented seed on the
 * "card" preset — the timeline lanes, every event mark, the alert spans and
 * the replay cursor — so the picture on the portfolio is a real run.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../../lab/security-events/detection.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CARD_SEED = 13;
export const CARD_PRESET = 'card';
const RULE_KEY = { repeatedFailures: 'r1', passwordSpray: 'r2', successAfterFailures: 'r3' };

export function renderSecurityPreview() {
  const run = D.runSynthetic({ seed: CARD_SEED, preset: CARD_PRESET });
  const { events, alerts } = run;
  const X0 = 6;
  const X1 = 154;
  const TOP = 6;
  const LANE = 11;
  const MAX_LANES = 7;
  const counts = new Map();
  for (const event of events) counts.set(event.source, (counts.get(event.source) || 0) + 1);
  const priority = new Set(alerts.map((alert) => alert.subject.source));
  const sources = [...counts.keys()].sort((a, b) => (priority.has(a) ? 0 : 1) - (priority.has(b) ? 0 : 1) || counts.get(b) - counts.get(a) || a.localeCompare(b)).slice(0, MAX_LANES);
  const laneOf = new Map(sources.map((source, i) => [source, i]));
  const t0 = events[0].ts;
  const t1 = events[events.length - 1].ts;
  const x = (ts) => X0 + ((ts - t0) / (t1 - t0)) * (X1 - X0);
  const r = (value) => Math.round(value * 10) / 10;
  const cursor = Math.round(events.length * 0.72);
  const paths = { success: [], failure: [], future: [], r1: [], r2: [], r3: [] };
  for (const event of events) {
    const lane = laneOf.get(event.source);
    if (lane === undefined) continue;
    const tall = event.outcome === 'failure';
    const d = tall ? `M${r(x(event.ts) - 1)} ${TOP + lane * LANE + 1.5}h2v8h-2z` : `M${r(x(event.ts) - 1)} ${TOP + lane * LANE + 3.5}h2v4h-2z`;
    if (event.index >= cursor) paths.future.push(d); else paths[event.outcome].push(d);
  }
  for (const alert of alerts) {
    const lane = laneOf.get(alert.subject.source);
    if (lane === undefined || alert.triggerIndex >= cursor) continue;
    const px1 = r(x(alert.firstTs) - 1.5);
    const px2 = r(Math.max(x(alert.lastTs) + 1.5, x(alert.firstTs) + 3));
    const width = r(px2 - px1);
    paths[RULE_KEY[alert.rule]].push(`M${px1} ${TOP + lane * LANE}h${width}v${LANE}h-${width}z`);
  }
  const grid = sources.map((source, i) => `M${X0} ${TOP + (i + 1) * LANE}H${X1}`).join('');
  return {
    run,
    lanes: sources.length,
    cursor,
    grid,
    cursorPath: `M${r(x(events[cursor - 1].ts))} 3V${TOP + sources.length * LANE + 3}`,
    paths: Object.fromEntries(Object.entries(paths).map(([key, parts]) => [key, parts.join('')])),
  };
}

describe('portfolio card preview provenance (security lab)', () => {
  it('is exactly the engine output for the documented seed on the card preset', () => {
    const preview = renderSecurityPreview();
    assert.ok(preview.run.alerts.some((a) => a.rule === 'repeatedFailures') && preview.run.alerts.some((a) => a.rule === 'passwordSpray') && preview.run.alerts.some((a) => a.rule === 'successAfterFailures'), 'the card shows all three rules');
    assert.ok(preview.lanes >= 5 && preview.run.events.length >= 30 && preview.run.events.length <= 80);
    assert.equal(preview.paths.future.length > 0, true, 'part of the day is still to be replayed');
    const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.ok(html.includes(`class="sec-art-grid" d="${preview.grid}"`), 'lane grid differs');
    for (const key of ['r1', 'r2', 'r3', 'success', 'failure', 'future']) {
      assert.ok(html.includes(`class="sec-art-${key}" d="${preview.paths[key]}"`), `${key} marks differ from the engine output`);
    }
    assert.ok(html.includes(`class="sec-art-cursor" d="${preview.cursorPath}"`), 'replay cursor position');
    assert.ok(html.includes(`seeded “card” dataset (seed ${CARD_SEED})`), 'the card names the seed it was drawn from');
  });
});
