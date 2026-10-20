/**
 * Unit tests for the synthetic data generator, the ground-truth evaluation of
 * the detector over many seeds, and the strict import validation of the
 * Security Event Detection & Investigation Lab (lab/security-events/detection.js).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../../lab/security-events/detection.js';

const ACCOUNT = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,63}$/;

const sample = (overrides = {}) => ({ id: 'e-1', time: '2026-03-02T08:14:03Z', outcome: 'failure', account: 'u-3f9c', source: '203.0.113.9', reason: 'bad_password', ...overrides });
const errorsOf = (result) => result.errors.map((e) => `${e.index}:${e.field}`);

/* --------------------------------------------------------------- generator */

describe('synthetic dataset generator', () => {
  it('is deterministic for a seed and preset, and different otherwise', () => {
    const a = D.generateDataset({ seed: 42, preset: 'mixed' });
    const b = D.generateDataset({ seed: 42, preset: 'mixed' });
    assert.deepEqual(a, b);
    assert.notDeepEqual(D.generateDataset({ seed: 43, preset: 'mixed' }).events, a.events);
    assert.notDeepEqual(D.generateDataset({ seed: 42, preset: 'quiet' }).events, a.events);
    assert.deepEqual(D.generateDataset(), D.generateDataset({ seed: D.DEFAULT_SEED, preset: 'mixed' }));
    assert.deepEqual(D.detect(a.events).alerts, D.detect(b.events).alerts);
  });

  it('validates its options', () => {
    assert.throws(() => D.generateDataset({ seed: -1 }), RangeError);
    assert.throws(() => D.generateDataset({ seed: 1.5 }), RangeError);
    assert.throws(() => D.generateDataset({ seed: D.MAX_SEED + 1 }), RangeError);
    assert.throws(() => D.generateDataset({ preset: 'enterprise' }), RangeError);
    assert.equal(D.normaliseSeed(D.MAX_SEED), D.MAX_SEED);
  });

  it('produces well-formed, clearly labelled synthetic events in every preset', () => {
    for (const preset of Object.keys(D.PRESETS)) {
      const dataset = D.generateDataset({ seed: 9, preset });
      assert.equal(dataset.preset, preset);
      assert.ok(dataset.events.length > 0 && dataset.events.length <= D.LIMITS.maxEvents, `${preset}: ${dataset.events.length} events`);
      const ids = new Set();
      const scenarioIds = new Set(dataset.scenarios.map((s) => s.id));
      const verdictOf = new Map(dataset.scenarios.map((s) => [s.id, s.verdict]));
      const spanEnd = dataset.meta.baseTs + dataset.meta.durationMs + 2 * 3600 * 1000;
      for (const event of dataset.events) {
        assert.ok(!ids.has(event.id), 'unique ids');
        ids.add(event.id);
        assert.ok(Number.isInteger(event.ts) && event.ts >= dataset.meta.baseTs && event.ts <= spanEnd, `${preset}: timestamp inside the synthetic span`);
        assert.ok(D.OUTCOMES.includes(event.outcome));
        assert.match(event.account, ACCOUNT);
        assert.ok(D.isDocumentationIPv4(event.source), `${event.source} is a documentation address`);
        assert.ok(scenarioIds.has(event.scenario), 'every event belongs to a scenario');
        assert.equal(event.verdict, verdictOf.get(event.scenario), 'the verdict is the scenario verdict');
        assert.equal(event.verdict, D.SCENARIO_KINDS[dataset.scenarios.find((s) => s.id === event.scenario).kind].verdict);
        if (event.outcome === 'failure') assert.ok(D.FAILURE_REASONS.includes(event.reason)); else assert.equal(event.reason, '');
      }
      assert.deepEqual(dataset.scenarios.map((s) => s.kind), ['baseline', ...D.PRESETS[preset].scenarios.map((s) => s.kind)], `${preset}: scenario kinds in preset order`);
      for (const scenario of dataset.scenarios) {
        assert.ok(scenario.eventIds.length > 0, `${preset}: scenario ${scenario.id} (${scenario.kind}) has events`);
        assert.ok(scenario.accounts.length > 0 && scenario.sources.length > 0);
        assert.ok(scenario.startTs <= scenario.endTs);
        assert.equal(scenario.title, D.SCENARIO_KINDS[scenario.kind].title);
      }
      const validation = D.validateEvents(dataset.events.map(({ id, ts, outcome, account, source, reason, scenario, verdict }) => ({ id, ts, outcome, account, source, reason, scenario, verdict })));
      assert.ok(validation.ok, `${preset}: generated events satisfy the import schema: ${JSON.stringify(validation.errors.slice(0, 3))}`);
      assert.equal(validation.labelled, true);
    }
  });

  it('stays below the event limit for many seeds of the large preset', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const dataset = D.generateDataset({ seed, preset: 'large' });
      assert.ok(dataset.events.length <= D.LIMITS.maxEvents, `seed ${seed}: ${dataset.events.length}`);
      assert.ok(dataset.events.length >= 10000, `seed ${seed}: ${dataset.events.length}`);
    }
  });

  it('emits events out of time order (so the sort path is always exercised) and uses one PRNG stream', () => {
    const dataset = D.generateDataset({ seed: 42, preset: 'mixed' });
    let ascending = true;
    for (let k = 1; k < dataset.events.length; k += 1) if (dataset.events[k].ts < dataset.events[k - 1].ts) { ascending = false; break; }
    assert.equal(ascending, false);
    const r1 = D.mulberry32(1);
    const r2 = D.mulberry32(1);
    const first = [r1(), r1(), r1()];
    assert.deepEqual([r2(), r2(), r2()], first);
    assert.ok(first.every((v) => v >= 0 && v < 1));
  });
});

/* ------------------------------------------------- ground truth vs rules */

describe('ground truth versus detector output (synthetic scenarios only)', () => {
  const rulesHitting = (run, kind) => {
    const hits = new Set();
    for (const row of run.evaluation.scenarios.rows) if (row.kind === kind) for (const rule of row.rules) hits.add(rule);
    return hits;
  };

  it('catches the scenarios each rule is designed for at the default thresholds, across seeds', () => {
    let sprays = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const run = D.runSynthetic({ seed, preset: 'mixed' });
      assert.ok(rulesHitting(run, 'brute-force').has('repeatedFailures'), `seed ${seed}: R1 catches the brute force`);
      assert.ok(rulesHitting(run, 'brute-force').has('successAfterFailures'), `seed ${seed}: R3 catches the brute-force success`);
      assert.ok(rulesHitting(run, 'distributed-failures').has('successAfterFailures'), `seed ${seed}: R3 catches the distributed attack`);
      assert.ok(!rulesHitting(run, 'distributed-failures').has('repeatedFailures') && !rulesHitting(run, 'distributed-failures').has('passwordSpray'), `seed ${seed}: per-source rules miss the distributed attack`);
      assert.ok(rulesHitting(run, 'misconfigured-client').has('repeatedFailures'), `seed ${seed}: R1 flags the misconfigured client (an expected false positive)`);
      assert.ok(rulesHitting(run, 'forgetful-user').has('successAfterFailures'), `seed ${seed}: R3 flags the forgetful user (an expected false positive)`);
      if (rulesHitting(run, 'password-spray').has('passwordSpray')) sprays += 1;
      assert.ok(run.evaluation.available);
      assert.ok(run.evaluation.precision >= 0 && run.evaluation.precision <= 1);
      assert.ok(run.evaluation.recall >= 0 && run.evaluation.recall <= 1);
      assert.ok(run.evaluation.alerts.falsePositive >= 2, `seed ${seed}: the two benign look-alikes count as false positives`);
      assert.ok(run.evaluation.scenarios.benign.flagged.length >= 2);
    }
    assert.ok(sprays >= 15, `R2 catches the spray in ${sprays} of 20 seeds`);
  });

  it('misses the low-and-slow spray at the defaults and catches it with a wider R2 window, at the price of more false positives on noisy data', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const defaults = D.runSynthetic({ seed, preset: 'stealthy' });
      assert.ok(!rulesHitting(defaults, 'low-and-slow-spray').has('passwordSpray'), `seed ${seed}: missed at the defaults`);
      const slow = defaults.evaluation.scenarios.rows.find((r) => r.kind === 'low-and-slow-spray');
      assert.equal(slow.detectedStrict, false, `seed ${seed}: no alert ever triggers on one of the spray's own events (it has no successes, and R1/R2 see too little)`);
      assert.ok(defaults.evaluation.recallStrict < 1);
      const wide = D.runSynthetic({ seed, preset: 'stealthy' }, { passwordSpray: { accounts: 5, windowSeconds: 1800 } });
      assert.ok(rulesHitting(wide, 'low-and-slow-spray').has('passwordSpray'), `seed ${seed}: caught with a 30-minute window`);
      assert.equal(wide.evaluation.scenarios.rows.find((r) => r.kind === 'low-and-slow-spray').detectedStrict, true);
      assert.ok(wide.evaluation.recall >= defaults.evaluation.recall);
      assert.ok(wide.evaluation.recallStrict > defaults.evaluation.recallStrict);
    }
    const strict = D.runSynthetic({ seed: 2, preset: 'noisy' });
    const loose = D.runSynthetic({ seed: 2, preset: 'noisy' }, { passwordSpray: { accounts: 2, windowSeconds: 1800 } });
    assert.ok(loose.alerts.length > strict.alerts.length);
    assert.ok(loose.evaluation.alerts.falsePositive > strict.evaluation.alerts.falsePositive, 'a very loose spray rule flags the shared gateways');
  });

  it('shows that source scope hides the distributed attack from R3', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const scoped = D.runSynthetic({ seed, preset: 'stealthy' }, { successAfterFailures: { scope: 'source' } });
      const row = scoped.evaluation.scenarios.rows.find((r) => r.kind === 'distributed-failures');
      assert.equal(row.detected, false, `seed ${seed}: the final success comes from a source that never failed`);
    }
  });

  it('reports the quiet preset without attacks: recall undefined, forgetful user flagged', () => {
    const run = D.runSynthetic({ seed: 42, preset: 'quiet' });
    assert.equal(run.evaluation.recall, null);
    assert.equal(run.evaluation.scenarios.suspicious.total, 0);
    assert.ok(run.evaluation.scenarios.benign.flagged.length >= 1);
  });

  it('keeps the scenario catalogue and presets internally consistent', () => {
    for (const [kind, spec] of Object.entries(D.SCENARIO_KINDS)) {
      assert.equal(spec.kind, kind);
      assert.ok(D.VERDICTS.includes(spec.verdict));
      for (const rule of spec.likelyRules) assert.ok(D.RULES[rule], `${kind}: ${rule}`);
    }
    for (const [id, preset] of Object.entries(D.PRESETS)) {
      assert.equal(preset.id, id);
      for (const spec of preset.scenarios) assert.ok(D.SCENARIO_KINDS[spec.kind], `${id}: ${spec.kind}`);
    }
    assert.deepEqual(D.RULE_ORDER, ['repeatedFailures', 'passwordSpray', 'successAfterFailures']);
    for (const rule of Object.values(D.RULES)) assert.ok(rule.definition.length > 100 && rule.code.startsWith('R'));
  });
});

/* -------------------------------------------------------- import schema */

describe('strict import validation', () => {
  it('accepts a bare array or an object with an events array and normalises the records', () => {
    const asArray = D.validateEvents([sample(), sample({ id: 'e-2', time: '2026-03-02T08:14:04.5+02:00', outcome: 'success', reason: undefined })]);
    assert.ok(asArray.ok, JSON.stringify(asArray.errors));
    assert.equal(asArray.events.length, 2);
    assert.equal(asArray.events[0].ts, Date.UTC(2026, 2, 2, 8, 14, 3));
    assert.equal(asArray.events[1].ts, Date.UTC(2026, 2, 2, 6, 14, 4, 500), 'offsets are applied');
    assert.equal(asArray.events[1].reason, '');
    assert.equal(asArray.events[0].scenario, null);
    assert.equal(asArray.events[0].verdict, null);
    assert.equal(asArray.events[0].seq, 0);
    assert.equal(asArray.labelled, false);
    const asObject = D.validateEvents({ format: 'security-events-lab/v1', note: 'ignored', events: [sample()] });
    assert.ok(asObject.ok);
    const withTs = D.validateEvents([sample({ time: undefined, ts: 1772439243000 })]);
    assert.ok(withTs.ok);
    assert.equal(withTs.events[0].ts, 1772439243000);
  });

  it('assigns ids when none are given and insists on all or none', () => {
    const none = D.validateEvents([sample({ id: undefined }), sample({ id: undefined })]);
    assert.ok(none.ok);
    assert.deepEqual(none.events.map((e) => e.id), ['imp-00001', 'imp-00002']);
    const mixed = D.validateEvents([sample(), sample({ id: undefined })]);
    assert.equal(mixed.ok, false);
    assert.deepEqual(errorsOf(mixed), ['-1:id']);
    const duplicate = D.validateEvents([sample(), sample()]);
    assert.deepEqual(errorsOf(duplicate), ['1:id']);
    assert.match(duplicate.errors[0].message, /duplicate id "e-1"/);
    const badId = D.validateEvents([sample({ id: 'has space' }), sample({ id: 'x'.repeat(65) }), sample({ id: '' })]);
    assert.deepEqual(errorsOf(badId), ['0:id', '1:id', '2:id']);
  });

  it('rejects unknown fields, malformed outcomes, accounts and reasons', () => {
    const result = D.validateEvents([
      sample({ extra: 1 }),
      sample({ id: 'e-2', outcome: 'ok' }),
      sample({ id: 'e-3', account: '' }),
      sample({ id: 'e-4', account: '-starts-with-dash' }),
      sample({ id: 'e-5', account: 'a'.repeat(65) }),
      sample({ id: 'e-6', account: 'name with space' }),
      sample({ id: 'e-7', reason: 'x'.repeat(65) }),
      sample({ id: 'e-8', reason: 'tab\there' }),
      sample({ id: 'e-9', reason: 42 }),
      sample({ id: 'e-10', account: 42 }),
      'not an object',
      null,
    ]);
    assert.equal(result.ok, false);
    assert.deepEqual(errorsOf(result), ['-1:id', '0:extra', '1:outcome', '2:account', '3:account', '4:account', '5:account', '6:reason', '7:reason', '8:reason', '9:account', '10:', '11:'], 'non-object records also break the all-or-none id rule');
    assert.equal(result.errorCount, 13);
    assert.deepEqual(result.events, []);
  });

  it('accepts markup-looking strings as inert data (rendering is text-only, never markup)', () => {
    const result = D.validateEvents([sample({ reason: '<img src=x onerror=alert(1)>', account: 'u-1', scenario: 'javascript:alert(1)', verdict: 'benign' })]);
    assert.ok(result.ok, JSON.stringify(result.errors));
    assert.equal(result.events[0].reason, '<img src=x onerror=alert(1)>');
    assert.equal(result.events[0].scenario, 'javascript:alert(1)');
  });

  it('validates timestamps strictly: exactly one of ts/time, real calendar instants, sane years', () => {
    const result = D.validateEvents([
      sample({ ts: 1, time: '2026-03-02T08:14:03Z' }),
      sample({ id: 'e-2', time: undefined, ts: undefined }),
      sample({ id: 'e-3', time: undefined, ts: 1.5 }),
      sample({ id: 'e-4', time: undefined, ts: '1772439243000' }),
      sample({ id: 'e-5', time: '2026-02-30T00:00:00Z' }),
      sample({ id: 'e-6', time: '2026-03-02T24:00:00Z' }),
      sample({ id: 'e-7', time: '2026-03-02T08:14:03' }),
      sample({ id: 'e-8', time: '2026-03-02 08:14:03Z' }),
      sample({ id: 'e-9', time: '1999-12-31T23:59:59Z' }),
      sample({ id: 'e-10', time: '2100-01-01T00:00:00Z' }),
      sample({ id: 'e-11', time: undefined, ts: Date.UTC(1999, 0, 1) }),
      sample({ id: 'e-12', time: '2026-03-02T08:14:03+25:00' }),
      sample({ id: 'e-13', time: '2026-13-02T08:14:03Z' }),
    ]);
    assert.deepEqual(errorsOf(result), ['0:ts', '1:time', '2:ts', '3:ts', '4:time', '5:time', '6:time', '7:time', '8:time', '9:time', '10:ts', '11:time', '12:time']);
    assert.equal(D.parseIsoTime('2024-02-29T12:00:00Z'), Date.UTC(2024, 1, 29, 12));
    assert.equal(D.parseIsoTime('2023-02-29T12:00:00Z'), null);
    assert.equal(D.parseIsoTime('2026-03-02T08:14:03.7Z'), Date.UTC(2026, 2, 2, 8, 14, 3, 700));
    assert.equal(D.parseIsoTime('2026-03-02T08:14:03.123456Z'), null, 'at most three fractional digits');
    assert.equal(D.parseIsoTime('2026-03-02T08:14:03-05:30'), Date.UTC(2026, 2, 2, 13, 44, 3));
    assert.equal(D.parseIsoTime(12), null);
  });

  it('accepts only reserved documentation addresses as sources', () => {
    const good = ['192.0.2.1', '192.0.2.254', '198.51.100.77', '203.0.113.200', '2001:db8::1', '2001:DB8:0:0:0:0:0:2', '2001:db8:dead:beef::'];
    const bad = ['8.8.8.8', '10.0.0.1', '192.168.1.1', '172.16.0.1', '192.0.2.256', '192.0.2.01', '192.0.2', '192.0.2.1.1', '203.0.114.1', '2001:db9::1', '2001::db8:1', '::1', 'fe80::1', '2001:db8::1::2', 'localhost', '', '192.0.2.1 ', ' 192.0.2.1'];
    for (const source of good) assert.ok(D.isAllowedSource(source), source);
    for (const source of bad) assert.ok(!D.isAllowedSource(source), source);
    const result = D.validateEvents(bad.map((source, k) => sample({ id: `e-${k}`, source })));
    assert.equal(result.errorCount, bad.length);
    assert.ok(result.errors.every((e) => e.field === 'source'));
    assert.match(result.errors[0].message, /reserved documentation ranges only/);
    assert.ok(D.validateEvents(good.map((source, k) => sample({ id: `e-${k}`, source }))).ok);
  });

  it('validates ground-truth labels: verdict values, scenario needs a verdict, all-or-nothing, consistent per scenario', () => {
    assert.deepEqual(errorsOf(D.validateEvents([sample({ verdict: 'unsure' })])), ['0:verdict']);
    assert.deepEqual(errorsOf(D.validateEvents([sample({ scenario: 'atk' })])), ['0:verdict']);
    assert.deepEqual(errorsOf(D.validateEvents([sample({ verdict: 'benign' }), sample({ id: 'e-2' })])), ['-1:verdict']);
    const inconsistent = D.validateEvents([sample({ scenario: 'atk', verdict: 'benign' }), sample({ id: 'e-2', scenario: 'atk', verdict: 'suspicious' })]);
    assert.deepEqual(errorsOf(inconsistent), ['1:verdict']);
    assert.match(inconsistent.errors[0].message, /both benign and suspicious/);
    assert.deepEqual(errorsOf(D.validateEvents([sample({ scenario: '', verdict: 'benign' })])), ['0:scenario']);
    const labelled = D.validateEvents([sample({ scenario: 'atk', verdict: 'suspicious' }), sample({ id: 'e-2', verdict: 'benign' })]);
    assert.ok(labelled.ok);
    assert.equal(labelled.labelled, true);
  });

  it('bounds the record count and the number of reported errors', () => {
    const many = Array.from({ length: 11 }, (_, k) => sample({ id: `e-${k}` }));
    const result = D.validateEvents(many, { maxEvents: 10 });
    assert.equal(result.ok, false);
    assert.match(result.errors[0].message, /too many events: 11 \(the limit is 10\)/);
    assert.ok(D.validateEvents(many.slice(0, 10), { maxEvents: 10 }).ok);
    const broken = Array.from({ length: 40 }, (_, k) => sample({ id: `e-${k}`, outcome: 'nope' }));
    const capped = D.validateEvents(broken);
    assert.equal(capped.errors.length, D.LIMITS.maxErrorsReported);
    assert.equal(capped.errorCount, 40);
    assert.equal(D.validateEvents({ events: 'nope' }).ok, false);
    assert.equal(D.validateEvents(42).ok, false);
    assert.ok(D.validateEvents([]).ok, 'an empty array is valid (and yields the empty state)');
    assert.equal(D.validateEvents([]).labelled, false);
  });

  it('parses JSON text safely with size limits and clear messages', () => {
    assert.match(D.parseImport('').errors[0].message, /empty/);
    assert.match(D.parseImport('   ').errors[0].message, /empty/);
    assert.match(D.parseImport('{not json').errors[0].message, /not valid JSON/);
    assert.match(D.parseImport('x'.repeat(100), { maxBytes: 50 }).errors[0].message, /100 bytes; the limit is 50 bytes/);
    assert.equal(D.parseImport(undefined).ok, false);
    const ok = D.parseImport(JSON.stringify([sample()]));
    assert.ok(ok.ok);
    assert.equal(ok.events.length, 1);
    const code = D.parseImport('{"events":[{"id":"e-1","time":"2026-03-02T08:14:03Z","outcome":"failure","account":"u-1","source":"192.0.2.1","reason":"alert(1)"}], "__proto__": {"polluted": true}}');
    assert.ok(code.ok);
    assert.equal(({}).polluted, undefined, 'JSON.parse never pollutes prototypes');
    assert.equal(code.events[0].reason, 'alert(1)');
  });

  it('round-trips a generated dataset through export and import with identical detection results', () => {
    const dataset = D.generateDataset({ seed: 17, preset: 'mixed' });
    const text = D.serialiseEvents(dataset.events, { generated: { seed: 17, preset: 'mixed' } });
    const parsed = JSON.parse(text);
    assert.equal(parsed.format, 'security-events-lab/v1');
    assert.match(parsed.note, /Not real log data/);
    assert.deepEqual(parsed.generated, { seed: 17, preset: 'mixed' });
    assert.equal(parsed.events.length, dataset.events.length);
    assert.ok(parsed.events.every((e) => e.ts === undefined && typeof e.time === 'string'));
    const imported = D.parseImport(text);
    assert.ok(imported.ok, JSON.stringify(imported.errors));
    assert.equal(imported.labelled, true);
    assert.deepEqual(imported.events.map((e) => [e.id, e.ts, e.outcome, e.account, e.source, e.reason, e.scenario, e.verdict]), dataset.events.map((e) => [e.id, e.ts, e.outcome, e.account, e.source, e.reason, e.scenario, e.verdict]));
    const before = D.detect(dataset.events);
    const after = D.detect(imported.events);
    assert.deepEqual(after.alerts, before.alerts);
    assert.deepEqual(D.evaluate(after.events, after.alerts, dataset.scenarios), D.evaluate(before.events, before.alerts, dataset.scenarios));
  });
});
