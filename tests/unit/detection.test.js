/**
 * Unit tests for the pure detection engine (lab/security-events/detection.js).
 * Run with: node --test tests/unit/*.test.js — no dependencies beyond Node's test runner.
 *
 * Fixtures are hand-built so that every expected number is derived by hand
 * from the rule definitions; property checks compare the streaming detector
 * with independent O(n²) reference implementations of the same definitions.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../../lab/security-events/detection.js';

const T0 = Date.UTC(2026, 2, 2, 8, 0, 0);
const at = (seconds) => T0 + Math.round(seconds * 1000);
const SRC_A = '192.0.2.10';
const SRC_B = '198.51.100.20';
const SRC_C = '203.0.113.30';

/** Fixture builder: ids follow insertion order (e1, e2, …), which is also the tie-break order. */
function builder() {
  const events = [];
  const add = (seconds, outcome, account, source, extra) => {
    const event = { id: `e${events.length + 1}`, ts: at(seconds), outcome, account, source, reason: outcome === 'failure' ? 'bad_password' : '', ...extra };
    events.push(event);
    return event;
  };
  return {
    events,
    fail: (seconds, account = 'u-a', source = SRC_A, extra = {}) => add(seconds, 'failure', account, source, extra),
    ok: (seconds, account = 'u-a', source = SRC_A, extra = {}) => add(seconds, 'success', account, source, extra),
  };
}

/** Configuration with a single rule enabled. */
const only = (rule, settings = {}) => ({
  repeatedFailures: { enabled: false },
  passwordSpray: { enabled: false },
  successAfterFailures: { enabled: false },
  [rule]: { enabled: true, ...settings },
});
const R1 = (threshold = 5, windowSeconds = 60) => only('repeatedFailures', { threshold, windowSeconds });
const R2 = (accounts = 5, windowSeconds = 120) => only('passwordSpray', { accounts, windowSeconds });
const R3 = (failures = 3, windowSeconds = 600, scope = 'account') => only('successAfterFailures', { failures, windowSeconds, scope });

const ids = (alert) => alert.evidence;
const stripLabels = (events) => events.map(({ scenario, verdict, ...rest }) => rest);

/* ------------------------------------------------------- reference checks */

/** Ids of failure events whose trailing inclusive window holds ≥ T failures from the same source (R1 definition). */
function referenceR1Triggers(sorted, threshold, windowSeconds) {
  const out = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const e = sorted[i];
    if (e.outcome !== 'failure') continue;
    let count = 0;
    for (let j = 0; j <= i; j += 1) {
      const f = sorted[j];
      if (f.outcome === 'failure' && f.source === e.source && f.ts >= e.ts - windowSeconds * 1000) count += 1;
    }
    if (count >= threshold) out.push(e.id);
  }
  return out;
}

/** Ids of failure events whose trailing window holds failures from the same source against ≥ A distinct accounts (R2). */
function referenceR2Triggers(sorted, accounts, windowSeconds) {
  const out = [];
  for (let i = 0; i < sorted.length; i += 1) {
    const e = sorted[i];
    if (e.outcome !== 'failure') continue;
    const distinct = new Set();
    for (let j = 0; j <= i; j += 1) {
      const f = sorted[j];
      if (f.outcome === 'failure' && f.source === e.source && f.ts >= e.ts - windowSeconds * 1000) distinct.add(f.account);
    }
    if (distinct.size >= accounts) out.push(e.id);
  }
  return out;
}

/**
 * Ids of success events that open an R3 episode: preceded (earlier in order,
 * inclusive window) by ≥ F failures for the account, and not absorbed into an
 * open episode (a previous episode success within W seconds).
 */
function referenceR3Triggers(sorted, failures, windowSeconds, scope) {
  const out = [];
  const lastEpisodeSuccess = new Map();
  for (let i = 0; i < sorted.length; i += 1) {
    const e = sorted[i];
    if (e.outcome !== 'success') continue;
    const open = lastEpisodeSuccess.get(e.account);
    if (open !== undefined && e.ts - open <= windowSeconds * 1000) {
      lastEpisodeSuccess.set(e.account, e.ts); // absorbed into the open episode
      continue;
    }
    lastEpisodeSuccess.delete(e.account);
    let count = 0;
    for (let j = 0; j < i; j += 1) {
      const f = sorted[j];
      if (f.outcome !== 'failure' || f.account !== e.account || f.ts < e.ts - windowSeconds * 1000) continue;
      if (scope === 'source' && f.source !== e.source) continue;
      count += 1;
    }
    if (count >= failures) {
      out.push(e.id);
      lastEpisodeSuccess.set(e.account, e.ts);
    }
  }
  return out;
}

/** Structural invariants every alert must satisfy, plus agreement with the reference definitions. */
function assertAlertsAgreeWithReference(result) {
  const { events, alerts, config } = result;
  const byId = new Map(events.map((e) => [e.id, e]));
  for (const alert of alerts) {
    assert.ok(D.RULES[alert.rule], 'known rule');
    assert.equal(new Set(alert.evidence).size, alert.evidence.length, `${alert.id}: evidence ids are unique`);
    for (let k = 1; k < alert.evidenceIndices.length; k += 1) assert.ok(alert.evidenceIndices[k] > alert.evidenceIndices[k - 1], `${alert.id}: evidence indices increase`);
    alert.evidence.forEach((id, k) => {
      const event = byId.get(id);
      assert.ok(event, `${alert.id}: evidence ${id} exists`);
      assert.equal(event.index, alert.evidenceIndices[k]);
    });
    const trigger = byId.get(alert.triggerEventId);
    assert.equal(trigger.index, alert.triggerIndex);
    assert.equal(alert.triggerTs, trigger.ts);
    assert.ok(alert.windowStart <= alert.windowEnd && alert.windowEnd === alert.triggerTs && alert.triggerTs <= alert.lastTs, `${alert.id}: window ordering`);
    if (alert.rule === 'successAfterFailures') {
      assert.equal(trigger.outcome, 'success');
      const w = config.successAfterFailures.windowSeconds * 1000;
      const m = alert.metrics;
      assert.equal(alert.evidence[m.failureCount], alert.triggerEventId, 'the trigger success follows the failures of its window');
      const failures = alert.evidence.slice(0, m.failureCount).map((id) => byId.get(id));
      assert.ok(failures.every((f) => f.outcome === 'failure' && f.account === trigger.account && f.index < trigger.index && f.ts >= trigger.ts - w));
      if (config.successAfterFailures.scope === 'source') assert.ok(failures.every((f) => f.source === trigger.source));
      assert.ok(failures.length >= config.successAfterFailures.failures);
      assert.equal(m.sameSource, failures.filter((f) => f.source === trigger.source).length);
      assert.equal(m.distinctSources, new Set(failures.map((f) => f.source)).size);
      const later = alert.evidence.slice(m.failureCount + 1).map((id) => byId.get(id));
      let lastSuccessTs = trigger.ts;
      const successSources = new Set([trigger.source]);
      let successCount = 1;
      let laterFailures = 0;
      for (const e of later) {
        assert.equal(e.account, trigger.account, `${alert.id}: absorbed events belong to the account`);
        assert.ok(e.index > trigger.index && e.ts - lastSuccessTs <= w, `${alert.id}: absorbed events arrive within W of the previous success`);
        if (e.outcome === 'success') { successCount += 1; successSources.add(e.source); lastSuccessTs = e.ts; } else laterFailures += 1;
      }
      assert.equal(m.successCount, successCount);
      assert.equal(m.laterFailures, laterFailures);
      assert.equal(m.lastSuccessTs, lastSuccessTs);
      assert.deepEqual(m.successSources, [...successSources].sort());
      assert.equal(m.total, alert.evidence.length);
    } else {
      assert.equal(trigger.outcome, 'failure');
      const rule = config[alert.rule];
      const w = rule.windowSeconds * 1000;
      const evidence = alert.evidence.map((id) => byId.get(id));
      assert.ok(evidence.every((f) => f.outcome === 'failure' && f.source === alert.subject.source), `${alert.id}: evidence is failures from the subject source`);
      for (let k = 1; k < evidence.length; k += 1) assert.ok(evidence[k].ts - evidence[k - 1].ts <= w, `${alert.id}: episode has no gap longer than the window`);
      const inWindow = evidence.filter((f) => f.index <= trigger.index && f.ts >= trigger.ts - w);
      if (alert.rule === 'repeatedFailures') {
        assert.equal(alert.metrics.windowCount, inWindow.length);
        assert.ok(inWindow.length >= rule.threshold);
      } else {
        assert.equal(alert.metrics.windowAccounts, new Set(inWindow.map((f) => f.account)).size);
        assert.ok(alert.metrics.windowAccounts >= rule.accounts);
      }
      assert.equal(alert.metrics.total, evidence.length);
      assert.deepEqual(alert.metrics.accounts, [...new Set(evidence.map((f) => f.account))].sort());
    }
  }
  // Every reference trigger is covered by an alert on the same subject, and every alert trigger is a reference trigger.
  const covered = (rule) => {
    const set = new Set();
    for (const alert of alerts) if (alert.rule === rule) for (const id of alert.evidence) set.add(id);
    return set;
  };
  if (config.repeatedFailures.enabled) {
    const ref = referenceR1Triggers(events, config.repeatedFailures.threshold, config.repeatedFailures.windowSeconds);
    const inEvidence = covered('repeatedFailures');
    for (const id of ref) assert.ok(inEvidence.has(id), `R1 reference trigger ${id} is covered by an alert`);
    const refSet = new Set(ref);
    for (const alert of alerts) if (alert.rule === 'repeatedFailures') assert.ok(refSet.has(alert.triggerEventId), `${alert.id}: trigger satisfies the R1 definition`);
    const seen = new Set();
    for (const alert of alerts) if (alert.rule === 'repeatedFailures') for (const id of alert.evidence) { assert.ok(!seen.has(id), 'R1 episodes are disjoint'); seen.add(id); }
  }
  if (config.passwordSpray.enabled) {
    const ref = referenceR2Triggers(events, config.passwordSpray.accounts, config.passwordSpray.windowSeconds);
    const inEvidence = covered('passwordSpray');
    for (const id of ref) assert.ok(inEvidence.has(id), `R2 reference trigger ${id} is covered by an alert`);
    const refSet = new Set(ref);
    for (const alert of alerts) if (alert.rule === 'passwordSpray') assert.ok(refSet.has(alert.triggerEventId), `${alert.id}: trigger satisfies the R2 definition`);
  }
  if (config.successAfterFailures.enabled) {
    const ref = referenceR3Triggers(events, config.successAfterFailures.failures, config.successAfterFailures.windowSeconds, config.successAfterFailures.scope).sort();
    const triggers = alerts.filter((a) => a.rule === 'successAfterFailures').map((a) => a.triggerEventId).sort();
    assert.deepEqual(triggers, ref, 'R3 alerts are exactly the successes that open an episode under the definition');
    const cited = alerts.filter((a) => a.rule === 'successAfterFailures').reduce((n, a) => n + a.evidence.length, 0);
    assert.ok(cited <= 2 * events.length, 'R3 evidence stays linear in the number of events');
  }
  // Alert ids and ordering follow the trigger order, then the rule order.
  alerts.forEach((alert, k) => {
    assert.equal(alert.id, `A-${k + 1}`);
    if (k > 0) {
      const prev = alerts[k - 1];
      assert.ok(prev.triggerIndex < alert.triggerIndex || (prev.triggerIndex === alert.triggerIndex && D.RULES[prev.rule].order < D.RULES[alert.rule].order));
    }
  });
}

/* ---------------------------------------------------------------- sorting */

describe('sorting and tie-breaking', () => {
  it('sorts by timestamp, keeps input order for equal timestamps, and indexes the result', () => {
    const b = builder();
    b.ok(10); b.ok(5); b.ok(5); b.ok(0);
    const sorted = D.sortEvents(b.events);
    assert.deepEqual(sorted.map((e) => e.id), ['e4', 'e2', 'e3', 'e1']);
    assert.deepEqual(sorted.map((e) => e.index), [0, 1, 2, 3]);
    assert.deepEqual(sorted.map((e) => e.seq), [3, 1, 2, 0]);
    assert.deepEqual(b.events.map((e) => e.id), ['e1', 'e2', 'e3', 'e4'], 'the input array is not mutated');
    assert.equal(b.events[0].index, undefined, 'input objects are not mutated');
  });

  it('honours an explicit seq as the tie-break and normalises missing optional fields', () => {
    const sorted = D.sortEvents([
      { id: 'x', ts: at(1), outcome: 'success', account: 'u-a', source: SRC_A, seq: 5 },
      { id: 'y', ts: at(1), outcome: 'failure', account: 'u-a', source: SRC_A, seq: 2 },
    ]);
    assert.deepEqual(sorted.map((e) => e.id), ['y', 'x']);
    assert.equal(sorted[0].reason, '');
    assert.equal(sorted[0].scenario, null);
    assert.equal(sorted[0].verdict, null);
  });

  it('rejects malformed events and duplicate ids', () => {
    assert.throws(() => D.sortEvents('nope'), TypeError);
    assert.throws(() => D.sortEvents([{ ts: at(0), outcome: 'success', account: 'u-a', source: SRC_A }]), /id/);
    assert.throws(() => D.sortEvents([{ id: 'a', ts: 'soon', outcome: 'success', account: 'u-a', source: SRC_A }]), /ts/);
    assert.throws(() => D.sortEvents([{ id: 'a', ts: at(0), outcome: 'maybe', account: 'u-a', source: SRC_A }]), /outcome/);
    assert.throws(() => D.sortEvents([{ id: 'a', ts: at(0), outcome: 'success', account: '', source: SRC_A }]), /account/);
    assert.throws(() => D.sortEvents([{ id: 'a', ts: at(0), outcome: 'success', account: 'u-a' }]), /source/);
    assert.throws(() => D.sortEvents([{ id: 'a', ts: at(0), outcome: 'success', account: 'u-a', source: SRC_A }, { id: 'a', ts: at(1), outcome: 'success', account: 'u-a', source: SRC_A }]), /duplicate event id/);
  });
});

/* --------------------------------------------------------------------- R1 */

describe('R1: repeated failures from one source (sliding window)', () => {
  it('counts an event exactly W seconds earlier (inclusive window boundary)', () => {
    const b = builder();
    for (const s of [0, 15, 30, 45, 60]) b.fail(s);
    const { alerts } = D.detect(b.events, R1(5, 60));
    assert.equal(alerts.length, 1);
    const [a] = alerts;
    assert.equal(a.rule, 'repeatedFailures');
    assert.equal(a.code, 'R1');
    assert.deepEqual(a.subject, { source: SRC_A });
    assert.equal(a.metrics.windowCount, 5);
    assert.equal(a.windowStart, at(0));
    assert.equal(a.windowEnd, at(60));
    assert.equal(a.triggerEventId, 'e5');
    assert.equal(a.triggerIndex, 4);
    assert.deepEqual(ids(a), ['e1', 'e2', 'e3', 'e4', 'e5']);
    assert.deepEqual(a.evidenceIndices, [0, 1, 2, 3, 4]);
    assert.equal(a.metrics.windowSpanMs, 60000);
  });

  it('drops an event one millisecond older than the window', () => {
    const b = builder();
    for (const s of [0, 15, 30, 45, 60.001]) b.fail(s);
    assert.equal(D.detect(b.events, R1(5, 60)).alerts.length, 0);
    b.fail(61);
    const { alerts } = D.detect(b.events, R1(5, 60));
    assert.equal(alerts.length, 1, 'a sixth failure brings five into the window again');
    assert.deepEqual(ids(alerts[0]), ['e2', 'e3', 'e4', 'e5', 'e6']);
    assert.equal(alerts[0].windowStart, at(15));
  });

  it('respects the threshold boundary exactly', () => {
    const b = builder();
    for (const s of [0, 1, 2, 3]) b.fail(s);
    assert.equal(D.detect(b.events, R1(5, 60)).alerts.length, 0, 'four failures: no alert');
    assert.equal(D.detect(b.events, R1(4, 60)).alerts.length, 1, 'threshold 4: alert');
    const every = D.detect(b.events, R1(1, 60)).alerts;
    assert.equal(every.length, 1, 'threshold 1 raises on the first failure and absorbs the rest into one episode');
    assert.deepEqual(ids(every[0]), ['e1', 'e2', 'e3', 'e4']);
    assert.equal(every[0].metrics.windowCount, 1);
    assert.equal(every[0].metrics.peakWindowCount, 4);
  });

  it('keeps one alert per episode: extends within the window, closes after a longer pause, re-raises on a new burst', () => {
    const b = builder();
    for (const s of [0, 10, 20, 30, 40]) b.fail(s); // e1..e5 trigger at 40
    b.fail(99); // e6: 59 s after the previous failure → absorbed
    b.fail(160); // e7: 61 s later → the episode is closed; alone in its window
    for (const s of [170, 180, 190, 200]) b.fail(s); // e8..e11 → new alert at 200
    const { alerts } = D.detect(b.events, R1(5, 60));
    assert.equal(alerts.length, 2);
    const [first, second] = alerts;
    assert.deepEqual(ids(first), ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']);
    assert.equal(first.metrics.total, 6);
    assert.equal(first.metrics.windowCount, 5);
    assert.equal(first.metrics.peakWindowCount, 5);
    assert.equal(first.lastTs, at(99));
    assert.equal(first.metrics.durationMs, 99000);
    assert.equal(first.windowEnd, at(40), 'the trigger window ends at the fifth failure');
    assert.deepEqual(ids(second), ['e7', 'e8', 'e9', 'e10', 'e11']);
    assert.equal(second.windowStart, at(160));
    assert.equal(second.triggerEventId, 'e11');
    assert.equal(second.id, 'A-2');
  });

  it('treats sources independently and ignores successes', () => {
    const b = builder();
    for (let k = 0; k < 4; k += 1) { b.fail(k * 5, 'u-a', SRC_A); b.fail(k * 5 + 2, 'u-b', SRC_B); }
    assert.equal(D.detect(b.events, R1(5, 60)).alerts.length, 0, 'four failures per source');
    b.fail(30, 'u-a', SRC_A);
    const { alerts } = D.detect(b.events, R1(5, 60));
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].subject.source, SRC_A);
    const successes = builder();
    for (const s of [0, 1, 2, 3, 4, 5]) successes.ok(s);
    successes.fail(6); successes.fail(7); successes.fail(8); successes.fail(9);
    assert.equal(D.detect(successes.events, R1(5, 60)).alerts.length, 0, 'successes never count towards R1');
  });

  it('counts failures against several accounts from the same source and lists them', () => {
    const b = builder();
    for (const [s, account] of [[0, 'u-c'], [1, 'u-a'], [2, 'u-b'], [3, 'u-a'], [4, 'u-c']]) b.fail(s, account, SRC_A);
    const { alerts } = D.detect(b.events, R1(5, 60));
    assert.equal(alerts.length, 1);
    assert.deepEqual(alerts[0].metrics.accounts, ['u-a', 'u-b', 'u-c']);
    assert.equal(alerts[0].metrics.distinctAccounts, 3);
  });

  it('handles simultaneous failures (identical timestamps) deterministically', () => {
    const b = builder();
    for (let k = 0; k < 5; k += 1) b.fail(7, `u-${k}`, SRC_A);
    const { alerts, events } = D.detect(b.events, R1(5, 60));
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].metrics.windowSpanMs, 0);
    assert.deepEqual(ids(alerts[0]), ['e1', 'e2', 'e3', 'e4', 'e5'], 'input order breaks the tie');
    assert.deepEqual(events.map((e) => e.id), ['e1', 'e2', 'e3', 'e4', 'e5']);
  });

  it('produces identical alerts for out-of-order input', () => {
    const b = builder();
    for (const s of [0, 10, 20, 30, 40, 99, 160, 170, 180, 190, 200]) b.fail(s);
    const ordered = D.detect(b.events, R1(5, 60));
    const shuffled = [b.events[7], b.events[2], b.events[10], b.events[0], b.events[5], b.events[9], b.events[1], b.events[3], b.events[8], b.events[4], b.events[6]];
    const result = D.detect(shuffled, R1(5, 60));
    assert.deepEqual(result.alerts, ordered.alerts);
    assert.deepEqual(result.events.map((e) => e.id), ordered.events.map((e) => e.id));
  });

  it('can be disabled without affecting the other rules', () => {
    const b = builder();
    for (const s of [0, 1, 2, 3, 4]) b.fail(s);
    b.ok(5);
    const result = D.detect(b.events, { repeatedFailures: { enabled: false } });
    assert.deepEqual(result.alerts.map((a) => a.rule), ['successAfterFailures']);
  });
});

/* --------------------------------------------------------------------- R2 */

describe('R2: password spraying (distinct accounts per source)', () => {
  it('fires on A distinct accounts within an inclusive window, not on repeats of one account', () => {
    const b = builder();
    ['u-a', 'u-b', 'u-c', 'u-d', 'u-e'].forEach((account, k) => b.fail(k * 30, account, SRC_A));
    const { alerts } = D.detect(b.events, R2(5, 120));
    assert.equal(alerts.length, 1);
    const [a] = alerts;
    assert.equal(a.rule, 'passwordSpray');
    assert.equal(a.metrics.windowAccounts, 5);
    assert.equal(a.windowStart, at(0));
    assert.equal(a.windowEnd, at(120));
    assert.deepEqual(a.metrics.accounts, ['u-a', 'u-b', 'u-c', 'u-d', 'u-e']);
    const repeats = builder();
    ['u-a', 'u-a', 'u-a', 'u-b', 'u-b', 'u-c', 'u-d'].forEach((account, k) => repeats.fail(k, account, SRC_A));
    assert.equal(D.detect(repeats.events, R2(5, 120)).alerts.length, 0, 'seven failures over four accounts is not a spray at A = 5');
    assert.equal(D.detect(repeats.events, R2(4, 120)).alerts.length, 1);
  });

  it('drops an account whose only failure is one millisecond older than the window', () => {
    const b = builder();
    ['u-a', 'u-b', 'u-c', 'u-d'].forEach((account, k) => b.fail(k * 30, account, SRC_A));
    b.fail(120.001, 'u-e', SRC_A);
    assert.equal(D.detect(b.events, R2(5, 120)).alerts.length, 0);
  });

  it('decrements the per-account count on eviction and re-counts a returning account', () => {
    const b = builder();
    b.fail(0, 'u-a'); b.fail(10, 'u-b'); b.fail(20, 'u-c'); b.fail(30, 'u-d');
    b.fail(125, 'u-a'); // e5: window [5, 125] holds b, c, d, a → 4 distinct
    b.fail(130, 'u-e'); // e6: window [10, 130] holds b (inclusive), c, d, a, e → 5
    const { alerts } = D.detect(b.events, R2(5, 120));
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].triggerEventId, 'e6');
    assert.equal(alerts[0].windowStart, at(10));
    assert.deepEqual(ids(alerts[0]), ['e2', 'e3', 'e4', 'e5', 'e6']);
  });

  it('is per source: one account failing from many sources, or many accounts from many sources, never looks like a spray', () => {
    const b = builder();
    for (let k = 0; k < 6; k += 1) b.fail(k, 'u-a', `203.0.113.${k + 1}`);
    assert.equal(D.detect(b.events, R2(2, 120)).alerts.length, 0);
    const spread = builder();
    for (let k = 0; k < 6; k += 1) spread.fail(k, `u-${k}`, `203.0.113.${k + 1}`);
    assert.equal(D.detect(spread.events, R2(2, 120)).alerts.length, 0);
  });

  it('keeps an episode open while failures keep arriving within the window', () => {
    const b = builder();
    ['u-a', 'u-b', 'u-c'].forEach((account, k) => b.fail(k * 10, account, SRC_A)); // trigger at 20 (A = 3)
    b.fail(100, 'u-a'); // absorbed (gap 80 ≤ 120)
    b.fail(250, 'u-d'); // gap 150 → closed; alone
    b.fail(260, 'u-e'); b.fail(270, 'u-f'); // new alert at 270
    const { alerts } = D.detect(b.events, R2(3, 120));
    assert.equal(alerts.length, 2);
    assert.deepEqual(ids(alerts[0]), ['e1', 'e2', 'e3', 'e4']);
    assert.equal(alerts[0].metrics.total, 4);
    assert.equal(alerts[0].metrics.distinctAccounts, 3);
    assert.deepEqual(ids(alerts[1]), ['e5', 'e6', 'e7']);
  });

  it('fires alongside R1 on the same burst and both alerts cite the same source', () => {
    const b = builder();
    ['u-a', 'u-b', 'u-c', 'u-d', 'u-e'].forEach((account, k) => b.fail(k, account, SRC_A));
    const { alerts } = D.detect(b.events, { repeatedFailures: { threshold: 5, windowSeconds: 60 }, passwordSpray: { accounts: 5, windowSeconds: 120 } });
    assert.deepEqual(alerts.map((a) => [a.id, a.rule]), [['A-1', 'repeatedFailures'], ['A-2', 'passwordSpray']]);
    assert.equal(alerts[0].triggerEventId, alerts[1].triggerEventId);
  });
});

/* --------------------------------------------------------------------- R3 */

describe('R3: success following repeated failures', () => {
  it('fires when F failures for the account precede a success within the window', () => {
    const b = builder();
    b.fail(0); b.fail(100); b.fail(200); b.ok(500);
    const { alerts } = D.detect(b.events, R3(3, 600));
    assert.equal(alerts.length, 1);
    const [a] = alerts;
    assert.equal(a.rule, 'successAfterFailures');
    assert.deepEqual(a.subject, { account: 'u-a', source: SRC_A });
    assert.deepEqual(ids(a), ['e1', 'e2', 'e3', 'e4']);
    assert.equal(a.triggerEventId, 'e4');
    assert.equal(a.metrics.failureCount, 3);
    assert.equal(a.metrics.sameSource, 3);
    assert.equal(a.metrics.distinctSources, 1);
    assert.deepEqual(a.metrics.sources, [SRC_A]);
    assert.equal(a.metrics.firstFailureTs, at(0));
    assert.equal(a.metrics.lastFailureTs, at(200));
    assert.equal(a.metrics.successTs, at(500));
    assert.equal(a.metrics.spanMs, 500000);
    assert.equal(a.windowStart, at(0));
    assert.equal(a.windowEnd, at(500));
  });

  it('counts a failure exactly W seconds before the success and drops one a millisecond older', () => {
    const b = builder();
    b.fail(0); b.fail(100); b.fail(200); b.ok(600);
    assert.equal(D.detect(b.events, R3(3, 600)).alerts.length, 1);
    const late = builder();
    late.fail(0); late.fail(100); late.fail(200); late.ok(600.001);
    assert.equal(D.detect(late.events, R3(3, 600)).alerts.length, 0);
  });

  it('needs at least F failures and only failures for the same account', () => {
    const b = builder();
    b.fail(0); b.fail(10); b.ok(20);
    assert.equal(D.detect(b.events, R3(3, 600)).alerts.length, 0, 'two failures');
    assert.equal(D.detect(b.events, R3(2, 600)).alerts.length, 1, 'threshold boundary');
    const other = builder();
    other.fail(0, 'u-a'); other.fail(10, 'u-a'); other.fail(20, 'u-a'); other.ok(30, 'u-b');
    assert.equal(D.detect(other.events, R3(3, 600)).alerts.length, 0, 'another account\'s success');
  });

  it('applies the scope: account counts any source, source counts only the success\'s source', () => {
    const b = builder();
    b.fail(0, 'u-a', SRC_A); b.fail(100, 'u-a', SRC_B); b.fail(200, 'u-a', SRC_B); b.ok(300, 'u-a', SRC_A);
    const account = D.detect(b.events, R3(3, 600, 'account')).alerts;
    assert.equal(account.length, 1);
    assert.equal(account[0].metrics.failureCount, 3);
    assert.equal(account[0].metrics.sameSource, 1);
    assert.equal(account[0].metrics.distinctSources, 2);
    assert.deepEqual(account[0].metrics.sources, [SRC_A, SRC_B]);
    assert.equal(D.detect(b.events, R3(3, 600, 'source')).alerts.length, 0, 'only one same-source failure');
    const sourceScoped = D.detect(b.events, R3(1, 600, 'source')).alerts;
    assert.equal(sourceScoped.length, 1);
    assert.deepEqual(ids(sourceScoped[0]), ['e1', 'e4']);
    assert.equal(sourceScoped[0].metrics.scope, 'source');
  });

  it('orders a failure and a success at the same timestamp by input position', () => {
    const before = builder();
    before.fail(0); before.fail(10); before.fail(20); before.ok(20); // the failure precedes the success
    assert.equal(D.detect(before.events, R3(3, 600)).alerts.length, 1);
    const after = builder();
    after.fail(0); after.fail(10); after.ok(20); after.fail(20); // the success precedes the third failure
    assert.equal(D.detect(after.events, R3(3, 600)).alerts.length, 0);
  });

  it('absorbs further successes and failures of the account into one episode and closes after a pause longer than W', () => {
    const b = builder();
    b.fail(0); b.fail(10); b.fail(20); b.ok(30); b.ok(40, 'u-a', SRC_B);
    const { alerts } = D.detect(b.events, R3(3, 600));
    assert.equal(alerts.length, 1, 'a second success ten seconds later is the same incident');
    assert.equal(alerts[0].triggerEventId, 'e4');
    assert.deepEqual(ids(alerts[0]), ['e1', 'e2', 'e3', 'e4', 'e5']);
    assert.equal(alerts[0].metrics.successCount, 2);
    assert.equal(alerts[0].metrics.lastSuccessTs, at(40));
    assert.equal(alerts[0].lastTs, at(40));
    assert.deepEqual(alerts[0].metrics.successSources, [SRC_A, SRC_B]);
    assert.deepEqual(alerts[0].subject, { account: 'u-a', source: SRC_A }, 'the subject source is the source of the first success');
    assert.match(D.explainAlert(alerts[0]).detail, /signed in successfully 1 more time, each within 10 min of the previous success, until 2026-03-02 08:00:40 UTC; the successes came from 2 distinct sources/);
    const c = builder();
    c.fail(0); c.fail(10); c.fail(20); c.ok(30); // e1–e4: the episode opens
    c.fail(100); // e5: absorbed, 70 s after the success
    c.ok(500); // e6: absorbed, 470 s after the previous success
    c.ok(1200); // e7: 700 s later: the episode is closed and the window [600, 1200] holds no failure
    c.fail(1300); c.fail(1310); c.fail(1320); c.ok(1330); // e8–e11: a new episode
    const result = D.detect(c.events, R3(3, 600)).alerts;
    assert.equal(result.length, 2);
    assert.deepEqual(ids(result[0]), ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']);
    assert.equal(result[0].metrics.laterFailures, 1);
    assert.equal(result[0].metrics.successCount, 2);
    assert.equal(result[0].metrics.failureCount, 3, 'the count at trigger time is kept');
    assert.match(D.explainAlert(result[0]).detail, /with 1 further failure in between; all from the same source/);
    assert.deepEqual(ids(result[1]), ['e8', 'e9', 'e10', 'e11']);
    assert.equal(result[1].id, 'A-2');
    const d = builder();
    d.fail(0); d.fail(10); d.fail(20); d.ok(30); d.fail(631); d.fail(632); d.fail(633); d.ok(634);
    const closedByFailure = D.detect(d.events, R3(3, 600)).alerts;
    assert.equal(closedByFailure.length, 2, 'a failure more than W after the last success closes the episode; the next qualifying success opens a new one');
    assert.deepEqual(ids(closedByFailure[1]), ['e5', 'e6', 'e7', 'e8']);
    const reset = builder();
    reset.fail(0); reset.fail(10); reset.ok(20); reset.fail(30); reset.ok(40);
    const second = D.detect(reset.events, R3(3, 600)).alerts;
    assert.equal(second.length, 1, 'a success between failures does not reset the count');
    assert.equal(second[0].triggerEventId, 'e5');
  });

  it('ignores failures that come after the success', () => {
    const b = builder();
    b.ok(0); b.fail(10); b.fail(20); b.fail(30);
    assert.equal(D.detect(b.events, R3(3, 600)).alerts.length, 0);
  });
});

/* --------------------------------------------------------- empty and none */

describe('no events and zero alerts', () => {
  it('handles an empty dataset', () => {
    const result = D.detect([]);
    assert.deepEqual(result.events, []);
    assert.deepEqual(result.alerts, []);
    assert.equal(result.summary.events, 0);
    assert.equal(result.summary.alerts, 0);
    assert.equal(result.summary.spanMs, 0);
    assert.equal(result.summary.firstTs, null);
    const evaluation = D.evaluate(result.events, result.alerts);
    assert.equal(evaluation.available, false);
    assert.match(evaluation.reason, /no events/);
    assert.deepEqual(D.groupAlerts([]).map((g) => g.total), [0, 0, 0]);
  });

  it('reports zero alerts for benign-looking traffic and for thresholds nothing reaches', () => {
    const b = builder();
    for (let k = 0; k < 50; k += 1) b.ok(k * 60, `u-${k % 7}`, k % 2 ? SRC_A : SRC_B);
    b.fail(100); b.ok(130);
    const result = D.detect(b.events);
    assert.equal(result.alerts.length, 0);
    assert.equal(result.summary.failures, 1);
    assert.equal(result.summary.successes, 51);
    assert.equal(result.summary.accounts, 8);
    assert.equal(result.summary.sources, 2);
    assert.equal(result.summary.flaggedEvents, 0);
    const attack = builder();
    for (let k = 0; k < 30; k += 1) attack.fail(k, 'u-a', SRC_C);
    attack.ok(31, 'u-a', SRC_C);
    assert.equal(D.detect(attack.events, { repeatedFailures: { threshold: 1000 }, passwordSpray: { accounts: 1000 }, successAfterFailures: { failures: 1000 } }).alerts.length, 0);
  });
});

/* ---------------------------------------------------------- configuration */

describe('threshold configuration', () => {
  it('fills missing settings from the defaults', () => {
    const { ok, config } = D.validateConfig({ repeatedFailures: { threshold: 3 } });
    assert.ok(ok);
    assert.equal(config.repeatedFailures.threshold, 3);
    assert.equal(config.repeatedFailures.windowSeconds, 60);
    assert.deepEqual(config.passwordSpray, { enabled: true, accounts: 5, windowSeconds: 120 });
    assert.deepEqual(D.normaliseConfig(), D.normaliseConfig(D.DEFAULT_CONFIG));
    assert.ok(D.configsEqual({}, D.DEFAULT_CONFIG));
    assert.ok(!D.configsEqual({ passwordSpray: { accounts: 6 } }, D.DEFAULT_CONFIG));
  });

  it('rejects invalid settings with a path for every problem', () => {
    const bad = D.validateConfig({
      repeatedFailures: { threshold: 0, windowSeconds: 1.5, bogus: 1 },
      passwordSpray: { accounts: D.LIMITS.maxThreshold + 1, windowSeconds: D.LIMITS.maxWindowSeconds + 1 },
      successAfterFailures: { failures: '3', scope: 'planet', enabled: 'yes' },
      unknownRule: {},
    });
    assert.equal(bad.ok, false);
    assert.equal(bad.config, null);
    const paths = bad.errors.map((e) => e.path).sort();
    assert.deepEqual(paths, ['passwordSpray.accounts', 'passwordSpray.windowSeconds', 'repeatedFailures.bogus', 'repeatedFailures.threshold', 'repeatedFailures.windowSeconds', 'successAfterFailures.enabled', 'successAfterFailures.failures', 'successAfterFailures.scope', 'unknownRule']);
    assert.throws(() => D.normaliseConfig({ repeatedFailures: { threshold: -1 } }), RangeError);
    assert.throws(() => D.detect([], { repeatedFailures: 'fast' }), RangeError);
    assert.equal(D.validateConfig('x').ok, false);
    assert.equal(D.validateConfig({ repeatedFailures: { windowSeconds: 1 } }).ok, true, 'the smallest window is one second');
    assert.equal(D.validateConfig({ repeatedFailures: { windowSeconds: D.LIMITS.maxWindowSeconds } }).ok, true);
  });
});

/* --------------------------------------------------------------- streaming */

describe('streaming detector', () => {
  it('reports created and updated alerts per event and matches the batch result', () => {
    const b = builder();
    for (const s of [0, 10, 20, 30, 40, 99]) b.fail(s);
    b.ok(100);
    const sorted = D.sortEvents(b.events);
    const detector = D.createDetector({ repeatedFailures: { threshold: 5, windowSeconds: 60 }, successAfterFailures: { failures: 3, windowSeconds: 600 } });
    const log = sorted.map((event) => detector.push(event));
    assert.deepEqual(log.slice(0, 4).map((r) => [r.created.length, r.updated.length]), [[0, 0], [0, 0], [0, 0], [0, 0]]);
    assert.deepEqual([log[4].created.length, log[4].updated.length], [1, 0]);
    assert.deepEqual([log[5].created.length, log[5].updated.length], [0, 1]);
    assert.equal(log[5].updated[0].id, 'A-1');
    assert.equal(log[6].created[0].rule, 'successAfterFailures');
    const streamed = detector.finish();
    assert.equal(detector.pushed, 7);
    assert.deepEqual(streamed, D.detect(b.events, detector.config).alerts);
    assert.deepEqual(streamed[0].metrics.accounts, ['u-a']);
    assert.equal(streamed[0].metrics.accountSet, undefined, 'finish() replaces working sets with sorted arrays');
  });

  it('rejects events pushed out of order or without a sorted index', () => {
    const b = builder();
    b.fail(10); b.fail(0);
    const detector = D.createDetector();
    assert.throws(() => detector.push(b.events[0]), TypeError);
    const sorted = D.sortEvents(b.events);
    detector.push(sorted[0]);
    assert.throws(() => detector.push(sorted[0]), /sorted order/);
    const fresh = D.createDetector();
    assert.throws(() => fresh.push(sorted[1]), /expected index 0/);
    const tie = D.createDetector();
    const same = D.sortEvents([{ id: 'p', ts: at(0), outcome: 'success', account: 'u-a', source: SRC_A }, { id: 'q', ts: at(0), outcome: 'success', account: 'u-a', source: SRC_A }]);
    tie.push(same[0]);
    tie.push(same[1]);
    assert.equal(tie.pushed, 2);
  });

  it('can be abandoned part-way and replayed from scratch with identical results (cancel and replay)', () => {
    const dataset = D.generateDataset({ seed: 8, preset: 'mixed' });
    const sorted = D.sortEvents(dataset.events);
    const abandoned = D.createDetector();
    const half = Math.floor(sorted.length / 2);
    for (let k = 0; k < half; k += 1) abandoned.push(sorted[k]);
    const partial = abandoned.finish();
    assert.ok(partial.length > 0 && partial.every((alert) => alert.triggerIndex < half), 'a partial run only reports alerts triggered so far');
    const replayed = D.createDetector();
    for (const event of sorted) replayed.push(event);
    const full = replayed.finish();
    assert.deepEqual(full, D.detect(dataset.events).alerts, 'a fresh detector after a cancelled one is unaffected by it');
    assert.deepEqual(full.filter((alert) => alert.triggerIndex < half).map((alert) => [alert.id, alert.triggerEventId]), partial.map((alert) => [alert.id, alert.triggerEventId]), 'the abandoned run agrees with the prefix of the full run');
    const stricter = D.detect(dataset.events, { repeatedFailures: { threshold: 6 } }).alerts;
    assert.notDeepEqual(stricter, full, 'changing a threshold changes the result');
    assert.deepEqual(D.detect(dataset.events).alerts, full, 'and changing it back restores it exactly');
  });

  it('streams a whole synthetic dataset to exactly the batch alerts', () => {
    const dataset = D.generateDataset({ seed: 3, preset: 'mixed' });
    const sorted = D.sortEvents(dataset.events);
    const detector = D.createDetector();
    let created = 0;
    for (const event of sorted) created += detector.push(event).created.length;
    const streamed = detector.finish();
    const batch = D.detect(dataset.events);
    assert.equal(created, batch.alerts.length);
    assert.deepEqual(streamed, batch.alerts);
  });
});

/* ------------------------------------------------- labels and detection */

describe('ground truth is separate from detection', () => {
  it('never lets scenario or verdict labels influence the alerts', () => {
    const dataset = D.generateDataset({ seed: 11, preset: 'mixed' });
    const labelled = D.detect(dataset.events).alerts;
    const stripped = D.detect(stripLabels(dataset.events)).alerts;
    const inverted = D.detect(dataset.events.map((e) => ({ ...e, verdict: e.verdict === 'benign' ? 'suspicious' : 'benign', scenario: 'x' }))).alerts;
    assert.deepEqual(stripped, labelled);
    assert.deepEqual(inverted, labelled);
  });
});

/* -------------------------------------------------------------- evaluation */

describe('evaluation metrics', () => {
  const labelled = (b, scenario, verdict) => b.events.forEach((e) => { if (!e.scenario) Object.assign(e, { scenario, verdict }); });

  it('computes precision, recall, false positives and false negatives from the labels', () => {
    const b = builder();
    // scenario atk-1 (suspicious): brute force, detected by R1
    for (let k = 0; k < 6; k += 1) b.fail(k, 'u-victim', SRC_C, { scenario: 'atk-1', verdict: 'suspicious' });
    // scenario atk-2 (suspicious): two slow failures, never detected
    b.fail(1000, 'u-other', '203.0.113.99', { scenario: 'atk-2', verdict: 'suspicious' });
    b.fail(2000, 'u-other', '203.0.113.99', { scenario: 'atk-2', verdict: 'suspicious' });
    // scenario ben-1 (benign): forgetful user, flagged by R3 → false positive
    b.fail(3000, 'u-f', SRC_A, { scenario: 'ben-1', verdict: 'benign' }); b.fail(3010, 'u-f', SRC_A, { scenario: 'ben-1', verdict: 'benign' }); b.fail(3020, 'u-f', SRC_A, { scenario: 'ben-1', verdict: 'benign' }); b.ok(3030, 'u-f', SRC_A, { scenario: 'ben-1', verdict: 'benign' });
    // routine (benign) success for the victim shortly after the attack → R3 alert with suspicious evidence → true positive
    b.ok(30, 'u-victim', SRC_A, { scenario: 'routine', verdict: 'benign' });
    labelled(b, 'routine', 'benign');
    const result = D.detect(b.events);
    const evaluation = D.evaluate(result.events, result.alerts, [{ id: 'atk-1', kind: 'brute-force', title: 'Brute force' }]);
    assert.equal(evaluation.available, true);
    assert.equal(evaluation.alerts.total, 3);
    assert.equal(evaluation.alerts.truePositive, 2);
    assert.equal(evaluation.alerts.falsePositive, 1);
    assert.ok(Math.abs(evaluation.precision - 2 / 3) < 1e-12);
    assert.equal(evaluation.recall, 0.5);
    assert.deepEqual(evaluation.scenarios.suspicious, { total: 2, detected: 1, detectedStrict: 1, missed: ['atk-2'] });
    assert.equal(evaluation.recallStrict, 0.5);
    assert.deepEqual(evaluation.scenarios.benign, { total: 2, flagged: ['ben-1'] });
    assert.deepEqual(evaluation.alerts.byRule, {
      repeatedFailures: { total: 1, truePositive: 1, truePositiveStrict: 1, falsePositive: 0 },
      passwordSpray: { total: 0, truePositive: 0, truePositiveStrict: 0, falsePositive: 0 },
      successAfterFailures: { total: 2, truePositive: 1, truePositiveStrict: 0, falsePositive: 1 },
    });
    assert.equal(evaluation.alerts.truePositiveStrict, 1, 'only the R1 alert was triggered by an attack event');
    assert.ok(Math.abs(evaluation.precisionStrict - 1 / 3) < 1e-12);
    const lenient = evaluation.alerts.rows.find((row) => row.id === 'A-2');
    assert.deepEqual([lenient.truePositive, lenient.truePositiveStrict, lenient.triggerScenario], [true, false, 'routine'], 'the victim\'s routine login is a lenient true positive only');
    const rows = Object.fromEntries(evaluation.scenarios.rows.map((row) => [row.id, row]));
    assert.equal(rows['atk-1'].title, 'Brute force', 'catalogue titles are used');
    assert.equal(rows['atk-1'].kind, 'brute-force');
    assert.equal(rows['atk-1'].detected, true);
    assert.equal(rows['atk-1'].detectedStrict, true, 'the R1 alert triggered on an attack event');
    assert.deepEqual(rows['atk-1'].triggeredAlertIds, ['A-1']);
    assert.deepEqual(rows.routine.triggeredAlertIds, ['A-2'], 'the R3 alert triggered on the victim\'s routine login');
    assert.deepEqual(rows['atk-1'].rules.sort(), ['repeatedFailures', 'successAfterFailures']);
    assert.equal(rows['atk-2'].detected, false);
    assert.equal(rows.routine.flagged, false, 'a benign scenario touched only by a true-positive alert is not flagged');
    assert.equal(rows['ben-1'].flagged, true);
    assert.equal(rows.routine.detected, null);
  });

  it('handles zero denominators explicitly', () => {
    const quiet = builder();
    quiet.ok(0, 'u-a', SRC_A, { scenario: 'routine', verdict: 'benign' });
    quiet.ok(5, 'u-b', SRC_A, { scenario: 'routine', verdict: 'benign' });
    const none = D.detect(quiet.events);
    const evaluation = D.evaluate(none.events, none.alerts);
    assert.equal(evaluation.available, true);
    assert.equal(evaluation.precision, null, 'no alerts: precision undefined');
    assert.equal(evaluation.precisionStrict, null);
    assert.equal(evaluation.recall, null, 'no suspicious scenario: recall undefined');
    assert.deepEqual(evaluation.scenarios.suspicious, { total: 0, detected: 0, detectedStrict: 0, missed: [] });
    assert.equal(evaluation.recallStrict, null);
    const missed = builder();
    missed.fail(0, 'u-a', SRC_C, { scenario: 'atk', verdict: 'suspicious' });
    const miss = D.detect(missed.events);
    const scored = D.evaluate(miss.events, miss.alerts);
    assert.equal(scored.precision, null);
    assert.equal(scored.recall, 0, 'one suspicious scenario, nothing detected');
  });

  it('refuses to score unlabelled or partially labelled data', () => {
    const b = builder();
    b.fail(0); b.ok(1);
    const result = D.detect(b.events);
    const unlabelled = D.evaluate(result.events, result.alerts);
    assert.equal(unlabelled.available, false);
    assert.match(unlabelled.reason, /no ground-truth labels/);
    b.events[0].verdict = 'benign';
    const partial = D.detect(b.events);
    const half = D.evaluate(partial.events, partial.alerts);
    assert.equal(half.available, false);
    assert.match(half.reason, /Only 1 of 2 events/);
  });

  it('groups verdict-only labels and rejects alerts that cite unknown events', () => {
    const b = builder();
    for (let k = 0; k < 5; k += 1) b.fail(k, 'u-a', SRC_C, { verdict: 'suspicious' });
    b.ok(100, 'u-b', SRC_A, { verdict: 'benign' });
    const result = D.detect(b.events);
    const evaluation = D.evaluate(result.events, result.alerts);
    assert.deepEqual(evaluation.scenarios.rows.map((r) => r.id).sort(), [`${D.UNLABELLED_PREFIX}benign`, `${D.UNLABELLED_PREFIX}suspicious`]);
    assert.equal(evaluation.recall, 1);
    assert.ok(!/^[\x20-\x7E]*$/.test(D.UNLABELLED_PREFIX), 'the pseudo-scenario key cannot be a valid scenario name');
    const collision = builder();
    collision.ok(0, 'u-a', SRC_A, { scenario: 'unlabelled benign', verdict: 'benign' });
    collision.ok(1, 'u-b', SRC_A, { verdict: 'benign' });
    const c = D.detect(collision.events);
    assert.equal(D.evaluate(c.events, c.alerts).scenarios.rows.length, 2, 'a scenario named like the pseudo scenario stays separate');
    assert.throws(() => D.evaluate(result.events, [{ ...result.alerts[0], evidence: ['ghost'] }]), /unknown event/);
  });
});

/* ---------------------------------------------- grouping, keys, diffs */

describe('grouping and comparison helpers', () => {
  it('groups alerts by rule and subject in alert order', () => {
    const b = builder();
    for (const s of [0, 1, 2, 3, 4]) b.fail(s, `u-${s}`, SRC_A);
    for (const s of [10, 11, 12, 13, 14]) b.fail(s, 'u-x', SRC_B);
    b.ok(20, 'u-x', SRC_B);
    const { alerts } = D.detect(b.events);
    const groups = D.groupAlerts(alerts);
    assert.deepEqual(groups.map((g) => [g.rule, g.code, g.total]), [['repeatedFailures', 'R1', 2], ['passwordSpray', 'R2', 1], ['successAfterFailures', 'R3', 1]]);
    assert.deepEqual(groups[0].groups.map((g) => g.label), [SRC_A, SRC_B]);
    assert.equal(groups[2].groups[0].label, 'u-x');
    assert.equal(D.subjectKey(alerts[0]), `source:${SRC_A}`);
    assert.equal(D.subjectKey(alerts[alerts.length - 1]), 'account:u-x');
    assert.equal(D.alertKey(alerts[alerts.length - 1]), 'successAfterFailures|account:u-x');
  });

  it('matches alerts across threshold configurations by incident (rule, subject and overlapping span)', () => {
    const b = builder();
    for (const s of [0, 10, 20, 30]) b.fail(s, 'u-a', SRC_A);
    for (const s of [0, 1, 2, 3, 4, 5]) b.fail(s, `u-${s}`, SRC_B);
    const strict = D.detect(b.events, { repeatedFailures: { threshold: 5 }, passwordSpray: { accounts: 5 } }).alerts;
    const loose = D.detect(b.events, { repeatedFailures: { threshold: 4 }, passwordSpray: { accounts: 7 } }).alerts;
    const diff = D.diffAlerts(strict, loose);
    assert.deepEqual(diff.both.map((a) => [a.rule, a.subject.source]), [['repeatedFailures', SRC_B]]);
    assert.deepEqual(diff.bothB.map((a) => [a.rule, a.subject.source]), [['repeatedFailures', SRC_B]]);
    assert.deepEqual(diff.onlyA.map((a) => [a.rule, a.subject.source]), [['passwordSpray', SRC_B]]);
    assert.deepEqual(diff.onlyB.map((a) => [a.rule, a.subject.source]), [['repeatedFailures', SRC_A]]);
    assert.deepEqual(D.diffAlerts([], []), { onlyA: [], onlyB: [], both: [], bothB: [] });
    // Three short bursts under a 60 s window are one long episode under a 300 s window: matched 3 ↔ 1, nothing "only".
    const bursts = builder();
    for (const start of [0, 200, 400]) for (let k = 0; k < 5; k += 1) bursts.fail(start + k, 'u-a', SRC_A);
    const narrow = D.detect(bursts.events, R1(5, 60)).alerts;
    const wide = D.detect(bursts.events, R1(5, 300)).alerts;
    assert.equal(narrow.length, 3);
    assert.equal(wide.length, 1);
    const episodes = D.diffAlerts(narrow, wide);
    assert.deepEqual([episodes.onlyA.length, episodes.onlyB.length, episodes.both.length, episodes.bothB.length], [0, 0, 3, 1]);
    assert.equal(D.findCounterpart(narrow[2], wide), wide[0]);
    assert.equal(D.findCounterpart(wide[0], narrow), narrow[0]);
    assert.equal(D.findCounterpart(narrow[0], []), null);
    assert.ok(!D.sameIncident(narrow[0], narrow[1]), 'episodes of one source that do not overlap are different incidents');
  });
});

/* --------------------------------------------------------- explanations */

describe('alert explanations', () => {
  it('state the thresholds, the subject, the counts and the caveat for every rule, and bound long field echoes', () => {
    const longKey = 'k'.repeat(200);
    const echo = D.validateEvents([{ id: 'e-1', time: '2026-03-02T08:00:00Z', outcome: 'success', account: 'u-a', source: SRC_A, [longKey]: 1 }]);
    assert.equal(echo.errors[0].field.length, 64);
    assert.ok(echo.errors[0].message.length < 100 && echo.errors[0].message.endsWith('…"'));
    const b = builder();
    for (const s of [0, 1, 2, 3, 4]) b.fail(s, `u-${s}`, SRC_A);
    for (const s of [10, 11, 12]) b.fail(s, 'u-x', SRC_B);
    b.ok(20, 'u-x', SRC_B);
    const { alerts } = D.detect(b.events);
    const [r1, r2, r3] = alerts;
    const e1 = D.explainAlert(r1);
    assert.equal(e1.headline, `5 failed sign-ins from ${SRC_A} within 4 s`);
    assert.match(e1.detail, /at least 5 failures within 1 min/);
    assert.match(e1.detail, /against 5 accounts/);
    assert.match(e1.detail, /2026-03-02 08:00:00 UTC/);
    assert.match(e1.caveat, /not as evidence of compromise/);
    assert.ok(e1.nextSteps.length > 20);
    const e2 = D.explainAlert(r2);
    assert.equal(e2.headline, `Failures against 5 distinct accounts from ${SRC_A} within 4 s`);
    assert.match(e2.detail, /at least 5 distinct accounts within 2 min/);
    assert.match(e2.caveat, /not who was behind it/);
    const e3 = D.explainAlert(r3);
    assert.equal(e3.headline, `Successful sign-in for u-x from ${SRC_B} after 3 failed attempts`);
    assert.match(e3.detail, /at least 3 failures for the same account within 10 min \(counting failures from any source\)/);
    assert.match(e3.detail, /3 from 198\.51\.100\.20; one source/);
    assert.match(e3.caveat, /does not prove that the account was compromised/);
    const scoped = D.detect(b.events, { successAfterFailures: { scope: 'source' } }).alerts.find((a) => a.rule === 'successAfterFailures');
    assert.match(D.explainAlert(scoped).detail, /counting only failures from the same source/);
  });

  it('works on a streaming alert before finish() and truncates long lists', () => {
    const b = builder();
    for (let k = 0; k < 9; k += 1) b.fail(k, `u-${k}`, SRC_A);
    const sorted = D.sortEvents(b.events);
    const detector = D.createDetector();
    let alert = null;
    for (const event of sorted) {
      const { created } = detector.push(event);
      if (created.length && !alert) {
        alert = created.find((a) => a.rule === 'repeatedFailures');
        assert.match(D.explainAlert(alert).detail, /against 5 accounts \(u-0, u-1, u-2, u-3, u-4\)/, 'explainable the moment it is created');
      }
    }
    detector.finish();
    assert.match(D.explainAlert(alert).detail, /against 9 accounts \(u-0, u-1, u-2, u-3, u-4, u-5 and 3 more\)/);
  });
});

/* ------------------------------------------------------- format helpers */

describe('formatting helpers', () => {
  it('formats UTC timestamps and durations deterministically', () => {
    assert.equal(D.formatUtc(at(3.25)), '2026-03-02 08:00:03 UTC');
    assert.equal(D.formatUtc(at(3.25), { millis: true }), '2026-03-02 08:00:03.250 UTC');
    assert.equal(D.formatUtc(at(3), { date: false }), '08:00:03 UTC');
    assert.equal(D.formatUtc(NaN), 'invalid time');
    assert.equal(D.isoTime(at(0)), '2026-03-02T08:00:00.000Z');
    assert.equal(D.formatDuration(250), '250 ms');
    assert.equal(D.formatDuration(42000), '42 s');
    assert.equal(D.formatDuration(200000), '3 min 20 s');
    assert.equal(D.formatDuration(120000), '2 min');
    assert.equal(D.formatDuration(7500000), '2 h 05 min');
    assert.equal(D.formatDuration(7200000), '2 h');
    assert.equal(D.formatDuration(-1), 'unknown');
    assert.equal(D.formatWindow(600), '10 min');
    assert.equal(D.formatWindow(86400), '24 h');
  });
});

/* ------------------------------------------------- reference agreement */

describe('agreement with reference definitions (property checks)', () => {
  it('matches the O(n²) reference on synthetic presets at the default thresholds', () => {
    for (const [preset, seeds] of [['mixed', [1, 2, 3, 4, 5]], ['noisy', [1, 2]], ['stealthy', [1, 2]], ['quiet', [1]]]) {
      for (const seed of seeds) {
        const dataset = D.generateDataset({ seed, preset });
        assertAlertsAgreeWithReference(D.detect(dataset.events));
      }
    }
  });

  it('matches the reference on dense random traffic with tight thresholds, ties and both scopes', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const random = D.mulberry32(seed);
      const events = [];
      const sources = [SRC_A, SRC_B, SRC_C];
      const accounts = ['u-a', 'u-b', 'u-c', 'u-d'];
      for (let k = 0; k < 400; k += 1) {
        events.push({
          id: `d${k}`,
          ts: at(Math.floor(random() * 600)), // whole seconds over ten minutes: many exact ties
          outcome: random() < 0.6 ? 'failure' : 'success',
          account: accounts[Math.floor(random() * accounts.length)],
          source: sources[Math.floor(random() * sources.length)],
        });
      }
      for (const scope of ['account', 'source']) {
        const config = { repeatedFailures: { threshold: 3, windowSeconds: 20 }, passwordSpray: { accounts: 3, windowSeconds: 30 }, successAfterFailures: { failures: 2, windowSeconds: 60, scope } };
        const result = D.detect(events, config);
        assert.ok(result.alerts.length > 0, 'dense traffic produces alerts');
        assertAlertsAgreeWithReference(result);
      }
    }
  });
});

/* --------------------------------------------------------------- scale */

describe('large synthetic datasets', () => {
  it('processes the large preset and twenty thousand tightly packed failures within a time budget', () => {
    const dataset = D.generateDataset({ seed: 5, preset: 'large' });
    assert.ok(dataset.events.length > 10000 && dataset.events.length <= D.LIMITS.maxEvents);
    const started = performance.now();
    const result = D.detect(dataset.events);
    const elapsed = performance.now() - started;
    assert.ok(result.alerts.length > 0);
    assert.ok(elapsed < 3000, `detection took ${elapsed.toFixed(0)} ms`);
    const byId = new Map(result.events.map((e) => [e.id, e]));
    for (const alert of result.alerts) for (const id of alert.evidence) assert.ok(byId.has(id));
    const burst = [];
    for (let k = 0; k < D.LIMITS.maxEvents; k += 1) burst.push({ id: `b${k}`, ts: at(k), outcome: 'failure', account: `u-${k % 3}`, source: SRC_C });
    const t1 = performance.now();
    const one = D.detect(burst, { repeatedFailures: { threshold: 5, windowSeconds: 60 }, passwordSpray: { accounts: 3, windowSeconds: 10 }, successAfterFailures: { enabled: false } });
    assert.ok(performance.now() - t1 < 3000);
    assert.equal(one.alerts.length, 2, 'one R1 episode and one R2 episode span the whole burst');
    // Ten thousand failures followed by ten thousand successes for one account, all at one timestamp: the
    // episodic R3 keeps the evidence linear (one R1 alert with 10,000 ids, one R3 alert with 20,000 ids).
    const flood = [];
    for (let k = 0; k < 10000; k += 1) flood.push({ id: `ff${k}`, ts: at(0), outcome: 'failure', account: 'u-a', source: SRC_C });
    for (let k = 0; k < 10000; k += 1) flood.push({ id: `fs${k}`, ts: at(0), outcome: 'success', account: 'u-a', source: SRC_C });
    const t2 = performance.now();
    const flooded = D.detect(flood);
    assert.ok(performance.now() - t2 < 3000, 'linear, not quadratic');
    assert.equal(flooded.alerts.length, 2);
    assert.equal(flooded.alerts.reduce((n, a) => n + a.evidence.length, 0), 30000);
    const r3 = flooded.alerts.find((a) => a.rule === 'successAfterFailures');
    assert.equal(r3.metrics.successCount, 10000);
    assert.equal(r3.metrics.failureCount, 10000);
    assert.equal(flooded.summary.flaggedEvents, 20000);
    const r1 = one.alerts.find((a) => a.rule === 'repeatedFailures');
    const r2 = one.alerts.find((a) => a.rule === 'passwordSpray');
    assert.equal(r2.id, 'A-1', 'three distinct accounts are reached before five failures');
    assert.equal(r1.metrics.total, D.LIMITS.maxEvents, 'the episode absorbs every failure, trigger window included');
    assert.equal(r1.metrics.windowCount, 5);
    assert.equal(r1.metrics.peakWindowCount, 61, 'an inclusive 60 s window holds 61 one-second failures');
    assert.equal(r2.metrics.total, D.LIMITS.maxEvents);
    assert.equal(r2.metrics.accountThreshold, 3);
    assert.equal(one.summary.flaggedEvents, D.LIMITS.maxEvents);
  });
});
