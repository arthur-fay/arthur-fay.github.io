/**
 * Unit tests for the pure analytics engine of the E-Commerce Analytics Lab
 * (lab/ecommerce/model.js). Run with: node --test tests/unit/*.test.js
 *
 * Expected numbers are computed by hand from the README figures the module
 * transcribes; the README's own text is quoted where the module must match it
 * verbatim, so any drift from the source is caught here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../lab/ecommerce/model.js';

const close = (actual, expected, tolerance = 1e-9, label = '') => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${label} expected ${expected}, got ${actual}`);
};
const KEYS = ['volumePct', 'basketPct', 'deliveryPoints', 'onTimePoints'];

/* ------------------------------------------------------- README transcription */

/** The README's KPI table, as published. */
const README_KPIS = [
  ['Total Orders', '99K'],
  ['Total Revenue', 'R$15.84M'],
  ['Total Customers', '96K'],
  ['Average Order Value', 'R$159.33'],
  ['Delivery Rate', '97.02%'],
  ['On-Time Delivery Rate', '91.88%'],
];

/** The README's "Selected DAX Measures", verbatim. */
const README_DAX = {
  'Total Orders': 'Total Orders =\nCOUNTROWS(fact_orders)',
  'Total Revenue': 'Total Revenue =\nSUM(fact_order_items[merchandise_revenue])\n    + SUM(fact_order_items[freight_revenue])',
  'Average Order Value': 'Average Order Value =\nDIVIDE(\n    [Total Revenue],\n    [Total Orders],\n    0\n)',
  'Delivery Rate %': 'Delivery Rate % =\nDIVIDE(\n    [Delivered Orders],\n    [Total Orders],\n    0\n)',
  'On-Time Delivery Rate %': 'On-Time Delivery Rate % =\nDIVIDE(\n    [On-Time Delivered Orders],\n    [Delivered Orders],\n    0\n)',
};

/** The README's documented tables. */
const README_TABLES = {
  fact: ['fact_orders', 'fact_order_items', 'fact_cohort_retention'],
  dimension: ['dim_date', 'dim_customer', 'dim_product', 'dim_seller', 'dim_payment_method', 'dim_order_status'],
  measure: ['KPI_Measures'],
};

describe('published figures match the README', () => {
  it('transcribes the six KPIs exactly as the README prints them', () => {
    assert.equal(M.PUBLISHED.ordersDisplay, '99K');
    assert.equal(M.PUBLISHED.revenueBRL, 15_840_000);
    assert.equal(M.PUBLISHED.revenueDisplay, 'R$15.84M');
    assert.equal(M.formatMillionsBRL(M.PUBLISHED.revenueBRL), 'R$15.84M');
    assert.equal(M.PUBLISHED.customersDisplay, '96K');
    assert.equal(M.PUBLISHED.averageOrderBRL, 159.33);
    assert.equal(M.PUBLISHED.deliveredPct, 97.02);
    assert.equal(M.PUBLISHED.onTimeOfDeliveredPct, 91.88);
    const displays = M.METRICS.map((metric) => [metric.measure.replace(' %', ''), metric.display]);
    assert.deepEqual(displays, README_KPIS, 'the KPI definitions show exactly the README figures, in README order');
  });

  it('documents the two leading categories at approximately R$1.44M and R$1.31M', () => {
    assert.equal(M.PUBLISHED.categories.length, 2);
    assert.deepEqual(M.PUBLISHED.categories.map((c) => [c.name, c.revenueBRL, c.rank]), [['Health and beauty', 1_440_000, 1], ['Watches and gifts', 1_310_000, 2]]);
    assert.ok(M.PUBLISHED.insights.some((text) => text.includes('approximately R$1.44M')));
    assert.ok(M.PUBLISHED.insights.some((text) => text.includes('approximately R$1.31M')));
  });

  it('keeps orders and customers as rounded display strings, never as exact numbers', () => {
    assert.equal(typeof M.PUBLISHED.ordersDisplay, 'string');
    assert.equal(typeof M.PUBLISHED.customersDisplay, 'string');
    assert.ok(!('orders' in M.PUBLISHED) && !('customers' in M.PUBLISHED));
  });

  it('publishes no monthly series and no transaction', () => {
    const text = JSON.stringify(M.EXPORTED) + JSON.stringify(M.PUBLISHED) + JSON.stringify(M.DERIVED);
    assert.ok(!/monthly(Revenue|Series|Values)/i.test(text));
    assert.equal(M.EXPORTED.trend.dataLabels, false, 'the trend chart prints no data labels, so none are transcribed');
    assert.ok(!('values' in M.EXPORTED.trend) && !('points' in M.EXPORTED.trend));
  });
});

describe('exported figures are internally consistent', () => {
  it('sums the three status counts to the exported order total and reproduces the delivery rate', () => {
    assert.deepEqual(M.EXPORTED.statusCounts.map((row) => [row.id, row.orders]), [['completed', 96_478], ['open_or_incomplete', 1_729], ['failed', 1_234]]);
    assert.equal(M.DERIVED.statusTotalOrders, 99_441);
    close(M.DERIVED.completedShareOfStatusTotalPct, (96_478 / 99_441) * 100, 1e-9, 'completed share');
    assert.equal(M.DERIVED.completedShareOfStatusTotalPct.toFixed(2), M.PUBLISHED.deliveredPct.toFixed(2), 'the exported status mix reproduces the published 97.02%');
    close(M.DERIVED.statusShares.reduce((total, row) => total + row.sharePct, 0), 100, 1e-9, 'status shares sum');
  });

  it('lists the ten exported categories in non-increasing order, headed by the two README categories', () => {
    const rows = M.EXPORTED.topCategories;
    assert.equal(rows.length, 10);
    assert.deepEqual(rows.map((row) => row.rank), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (let i = 1; i < rows.length; i += 1) assert.ok(rows[i].revenueBRL <= rows[i - 1].revenueBRL, `rank ${i + 1} is not above rank ${i}`);
    assert.equal(rows[0].revenueBRL, M.PUBLISHED.categories[0].revenueBRL);
    assert.equal(rows[1].revenueBRL, M.PUBLISHED.categories[1].revenueBRL);
    assert.equal(rows[0].label, M.PUBLISHED.categories[0].label);
    assert.equal(rows[1].label, M.PUBLISHED.categories[1].label);
    const truncated = rows.filter((row) => row.truncated);
    assert.equal(truncated.length, 1, 'exactly one label is truncated in the export');
    assert.ok(truncated[0].label.endsWith('…'), 'the truncated label is kept as printed');
    assert.ok(rows.every((row) => row.revenueBRL % 10_000 === 0), 'exported values are printed to R$0.01M');
    assert.equal(M.DERIVED.topTenTotalBRL, 9_880_000);
    close(M.DERIVED.topTenShareOfRevenuePct, (9_880_000 / 15_840_000) * 100, 1e-9, 'top-ten share');
  });

  it('agrees with the published anchors within their rounding', () => {
    close(M.DERIVED.impliedOrders, 15_840_000 / 159.33, 1e-9, 'implied orders');
    assert.ok(Math.abs(M.DERIVED.impliedOrders - M.DERIVED.statusTotalOrders) / M.DERIVED.statusTotalOrders < 0.0005, 'revenue ÷ AOV lands within 0.05% of the exported order total');
    assert.equal(M.formatCompact(M.DERIVED.impliedOrders, 0), '99K', 'the implied order count rounds to the README\'s 99K');
    assert.equal(M.formatMillionsBRL(M.DERIVED.impliedRevenueFromStatusBRL), 'R$15.84M', 'AOV × exported orders rounds to the README revenue');
    assert.equal(M.formatBRL(M.DERIVED.impliedAverageOrderFromStatusBRL), 'R$159.29', 'revenue ÷ exported orders differs from the published AOV only by the revenue rounding');
  });
});

describe('derived figures', () => {
  it('multiplies the two published rates for the on-time share of all orders', () => {
    close(M.DERIVED.onTimeOfAllPct, (97.02 * 91.88) / 100, 1e-9, 'on-time of all');
    close(M.DERIVED.onTimeOfAllPct, 89.141976, 1e-9, 'on-time of all (literal)');
    close(M.DERIVED.notDeliveredPct, 2.98, 1e-9, 'not delivered');
    close(M.DERIVED.lateOfAllPct, 97.02 - 89.141976, 1e-9, 'late of all');
    close(M.DERIVED.onTimeOfAllPct + M.DERIVED.lateOfAllPct + M.DERIVED.notDeliveredPct, 100, 1e-9, 'outcome shares sum');
  });

  it('computes category shares and the gap between the two leading categories', () => {
    const [first, second] = M.DERIVED.categoryShares;
    close(first.sharePct, (1_440_000 / 15_840_000) * 100, 1e-9, 'first share');
    close(second.sharePct, (1_310_000 / 15_840_000) * 100, 1e-9, 'second share');
    assert.equal(first.id, 'health-beauty');
    assert.equal(M.DERIVED.categoryGapBRL, 130_000);
    close(M.DERIVED.categoryGapPct, (130_000 / 1_310_000) * 100, 1e-9, 'gap percent');
  });
});

describe('calculateScenario: formulas', () => {
  it('reproduces the published baseline when nothing changes', () => {
    const base = M.calculateScenario();
    assert.equal(base.isBaseline, true);
    assert.equal(base.hypothetical, true);
    assert.equal(base.revenueBRL, 15_840_000);
    assert.equal(base.revenueChangeBRL, 0);
    assert.equal(base.revenueDeltaPct, 0);
    assert.equal(base.averageOrderBRL, 159.33);
    assert.equal(base.deliveredPct, 97.02);
    assert.equal(base.onTimeOfDeliveredPct, 91.88);
    close(base.orders, M.DERIVED.impliedOrders, 1e-9, 'orders');
    close(base.onTimeOfAllPct, M.DERIVED.onTimeOfAllPct, 1e-9, 'on-time of all');
    close(base.lateOrders, 7_832.0404, 1e-4, 'late orders (literal: 99,416.3058 × 0.9702 × 0.0812)');
    close(base.undeliveredOrders, 2_962.6059, 1e-4, 'undelivered orders (literal: 99,416.3058 × 0.0298)');
    assert.equal(M.formatInt(base.lateOrders + base.undeliveredOrders), '10,795', 'missed orders as the page prints them at baseline');
    assert.deepEqual(M.calculateScenario({}), base, 'an empty object means no change');
    assert.deepEqual(M.BASELINE, base);
  });

  it('scales revenue by the product of the volume and basket factors (hand-computed)', () => {
    const s = M.calculateScenario({ volumePct: 15, basketPct: 5, deliveryPoints: 1.5, onTimePoints: 4 });
    assert.equal(s.isBaseline, false);
    close(s.multiplier, 1.15 * 1.05, 1e-12, 'multiplier');
    close(s.revenueBRL, 15_840_000 * 1.2075, 1e-6, 'revenue');
    close(s.revenueBRL, 19_126_800, 1e-6, 'revenue (literal)');
    close(s.revenueChangeBRL, 3_286_800, 1e-6, 'revenue change');
    close(s.revenueDeltaPct, 20.75, 1e-9, 'revenue delta %');
    close(s.averageOrderBRL, 159.33 * 1.05, 1e-9, 'AOV');
    close(s.averageOrderChangeBRL, 159.33 * 0.05, 1e-9, 'AOV change');
    close(s.orders, (15_840_000 / 159.33) * 1.15, 1e-6, 'orders');
    close(s.ordersChange, (15_840_000 / 159.33) * 0.15, 1e-6, 'orders change');
    close(s.deliveredPct, 98.52, 1e-9, 'delivered');
    close(s.onTimeOfDeliveredPct, 95.88, 1e-9, 'on-time');
    close(s.onTimeOfAllPct, (98.52 * 95.88) / 100, 1e-9, 'on-time of all');
    close(s.onTimeOfAllChangePoints, (98.52 * 95.88) / 100 - 89.141976, 1e-9, 'on-time of all change');
    close(s.notDeliveredPct, 1.48, 1e-9, 'not delivered');
    close(s.lateOfAllPct, 98.52 - (98.52 * 95.88) / 100, 1e-9, 'late of all');
    close(s.deliveredOrders, s.orders * 0.9852, 1e-6, 'delivered orders');
    close(s.onTimeOrders, s.orders * 0.9852 * 0.9588, 1e-6, 'on-time orders');
    close(s.orders, 114_328.7516, 1e-4, 'orders (literal: 99,416.3058 × 1.15)');
    close(s.deliveredOrders, 112_636.6861, 1e-4, 'delivered orders (literal: × 0.9852)');
    close(s.onTimeOrders, 107_996.0547, 1e-4, 'on-time orders (literal: × 0.9588)');
    close(s.lateOrders, 4_640.6315, 1e-4, 'late orders (literal)');
    close(s.undeliveredOrders, 1_692.0655, 1e-4, 'undelivered orders (literal)');
    assert.equal(M.formatInt(s.lateOrders + s.undeliveredOrders), '6,333', 'missed orders as the page prints them');
  });

  it('computes the percentage change and the indices exactly, so half-way cases round the way decimal arithmetic does', () => {
    const s = M.calculateScenario({ volumePct: 3, basketPct: 15 });
    assert.equal(s.revenueDeltaPct, 18.45, '1.03 × 1.15 − 1 is exactly 18.45%');
    assert.equal(M.formatSignedPercent(s.revenueDeltaPct), '+18.5%', 'rounded half away from zero, not to 18.4% through 18.449999…');
    assert.deepEqual(s.index, { revenue: 118.45, orders: 103, averageOrder: 115 });
    assert.equal(M.roundTo(s.index.revenue, 1), 118.5);
    const down = M.calculateScenario({ volumePct: -15, basketPct: -15 });
    assert.equal(down.revenueDeltaPct, -27.75);
    assert.equal(M.formatSignedPercent(down.revenueDeltaPct), '−27.8%');
    assert.deepEqual(down.index, { revenue: 72.25, orders: 85, averageOrder: 85 });
    assert.equal(M.roundTo(down.index.revenue, 1), 72.3);
    assert.deepEqual(M.BASELINE.index, { revenue: 100, orders: 100, averageOrder: 100 });
    for (const [v, b] of [[7, 9], [-33, 21], [50, 30], [-50, -30], [1, -1], [0, 30]]) {
      const scenario = M.calculateScenario({ volumePct: v, basketPct: b });
      close(scenario.index.revenue, ((100 + v) * (100 + b)) / 100, 1e-12, `revenue index for ${v}/${b}`);
      assert.equal(scenario.index.orders, 100 + v);
      assert.equal(scenario.index.averageOrder, 100 + b);
      close(scenario.multiplier, scenario.index.revenue / 100, 1e-12, 'the multiplier is the revenue index over 100');
      close(scenario.revenueDeltaPct, scenario.index.revenue - 100, 1e-12, 'the percentage change is the index less 100');
      assert.ok(Object.isFrozen(scenario.index));
    }
  });

  it('is multiplicative, symmetric in volume and basket, and separates the four levers', () => {
    const volume = M.calculateScenario({ volumePct: 10 });
    const basket = M.calculateScenario({ basketPct: 10 });
    close(volume.revenueBRL, 17_424_000, 1e-6, 'volume +10% revenue');
    close(basket.revenueBRL, 17_424_000, 1e-6, 'basket +10% revenue');
    assert.equal(volume.averageOrderBRL, 159.33, 'volume does not change the average order');
    close(volume.orders, M.DERIVED.impliedOrders * 1.1, 1e-6, 'volume scales orders');
    close(basket.orders, M.DERIVED.impliedOrders, 1e-9, 'basket does not change orders');
    close(basket.averageOrderBRL, 175.263, 1e-9, 'basket scales the average order');
    const both = M.calculateScenario({ volumePct: 10, basketPct: 10 });
    close(both.multiplier, 1.21, 1e-12, 'the factors multiply (not 1.20)');
    const delivery = M.calculateScenario({ deliveryPoints: -5, onTimePoints: 3 });
    assert.equal(delivery.revenueBRL, 15_840_000, 'logistics changes leave revenue untouched');
    assert.equal(delivery.averageOrderBRL, 159.33);
    close(delivery.deliveredPct, 92.02, 1e-9, 'delivery −5 pts');
    close(delivery.onTimeOfDeliveredPct, 94.88, 1e-9, 'on-time +3 pts');
    close(delivery.onTimeOfAllPct, (92.02 * 94.88) / 100, 1e-9, 'on-time of all');
  });

  it('keeps order outcomes and rates additive', () => {
    for (const changes of [{}, { volumePct: 33, basketPct: -7, deliveryPoints: -3.5, onTimePoints: 6.5 }, { volumePct: -50, basketPct: 30, deliveryPoints: 2.5, onTimePoints: -25 }]) {
      const s = M.calculateScenario(changes);
      close(s.deliveredOrders + s.undeliveredOrders, s.orders, 1e-6, 'delivered + undelivered = orders');
      close(s.onTimeOrders + s.lateOrders, s.deliveredOrders, 1e-6, 'on time + late = delivered');
      close(s.onTimeOfAllPct + s.lateOfAllPct + s.notDeliveredPct, 100, 1e-9, 'shares of all orders sum to 100');
      close(s.revenueBRL - s.revenueChangeBRL, 15_840_000, 1e-6, 'change is relative to the published revenue');
      close(s.orders - s.ordersChange, M.DERIVED.impliedOrders, 1e-6, 'order change is relative to the implied baseline');
      assert.ok(s.deliveredPct > 0 && s.deliveredPct < 100 && s.onTimeOfDeliveredPct > 0 && s.onTimeOfDeliveredPct < 100, 'rates stay strictly inside (0, 100)');
    }
  });

  it('returns frozen results with the normalised changes', () => {
    const s = M.calculateScenario({ volumePct: 5 });
    assert.ok(Object.isFrozen(s) && Object.isFrozen(s.changes));
    assert.deepEqual(s.changes, { volumePct: 5, basketPct: 0, deliveryPoints: 0, onTimePoints: 0 });
    assert.throws(() => { s.revenueBRL = 0; }, TypeError);
  });
});

describe('calculateScenario: boundary values', () => {
  it('accepts every limit inclusively and the extremes together', () => {
    for (const key of KEYS) {
      const [min, max] = M.LIMITS[key];
      assert.doesNotThrow(() => M.calculateScenario({ [key]: min }), `${key} min`);
      assert.doesNotThrow(() => M.calculateScenario({ [key]: max }), `${key} max`);
      assert.equal(M.calculateScenario({ [key]: min }).changes[key], min);
      assert.equal(M.calculateScenario({ [key]: max }).changes[key], max);
    }
    const low = M.calculateScenario({ volumePct: -50, basketPct: -30, deliveryPoints: -15, onTimePoints: -25 });
    close(low.multiplier, 0.35, 1e-12, 'lowest multiplier');
    close(low.revenueBRL, 5_544_000, 1e-6, 'lowest revenue');
    close(low.deliveredPct, 82.02, 1e-9, 'lowest delivery');
    close(low.onTimeOfDeliveredPct, 66.88, 1e-9, 'lowest on-time');
    close(low.onTimeOfAllPct, (82.02 * 66.88) / 100, 1e-9, 'lowest on-time of all');
    const high = M.calculateScenario({ volumePct: 50, basketPct: 30, deliveryPoints: 2.5, onTimePoints: 8 });
    close(high.multiplier, 1.95, 1e-12, 'highest multiplier');
    close(high.revenueBRL, 30_888_000, 1e-6, 'highest revenue');
    close(high.deliveredPct, 99.52, 1e-9, 'highest delivery');
    close(high.onTimeOfDeliveredPct, 99.88, 1e-9, 'highest on-time');
    assert.ok(high.onTimeOfAllPct < 100 && high.deliveredPct < 100 && high.onTimeOfDeliveredPct < 100, 'the ceilings keep every rate below 100%');
  });

  it('rejects values just outside the limits with a RangeError naming the setting', () => {
    for (const key of KEYS) {
      const [min, max] = M.LIMITS[key];
      assert.throws(() => M.calculateScenario({ [key]: min - 1e-9 }), { name: 'RangeError', message: new RegExp(`^${key} must be between`) });
      assert.throws(() => M.calculateScenario({ [key]: max + 1e-9 }), { name: 'RangeError', message: new RegExp(`^${key} must be between`) });
      assert.throws(() => M.calculateScenario({ [key]: min - 1 }), RangeError);
      assert.throws(() => M.calculateScenario({ [key]: max + 1 }), RangeError);
    }
  });

  it('treats zero and negative zero as the baseline', () => {
    assert.equal(M.calculateScenario({ volumePct: -0 }).isBaseline, true);
    assert.equal(M.calculateScenario({ volumePct: 0, basketPct: 0, deliveryPoints: 0, onTimePoints: 0 }).isBaseline, true);
    assert.equal(M.calculateScenario({ onTimePoints: 0.5 }).isBaseline, false);
  });
});

describe('calculateScenario: invalid inputs', () => {
  it('rejects anything that is not a plain object of settings', () => {
    for (const bad of [null, [], [1], 'volumePct', 5, true, () => {}]) {
      assert.throws(() => M.calculateScenario(bad), { name: 'TypeError', message: 'Scenario changes must be an object' });
    }
  });

  it('rejects unknown settings', () => {
    assert.throws(() => M.calculateScenario({ nope: 1 }), { name: 'RangeError', message: 'Unknown scenario setting: nope' });
    assert.throws(() => M.calculateScenario({ volumePct: 1, VolumePct: 1 }), RangeError);
    assert.throws(() => M.calculateScenario({ volume: 1 }), RangeError);
  });

  it('rejects non-numeric and non-finite values with a TypeError naming the setting', () => {
    for (const key of KEYS) {
      for (const bad of [NaN, Infinity, -Infinity, '5', '', null, true, false, {}, [], () => 1]) {
        assert.throws(() => M.calculateScenario({ [key]: bad }), { name: 'TypeError', message: `${key} must be a finite number` }, `${key} = ${String(bad)}`);
      }
    }
  });

  it('ignores inherited properties but validates own ones', () => {
    const inherited = Object.create({ volumePct: 999 });
    assert.equal(M.calculateScenario(inherited).isBaseline, true, 'inherited values are not read');
    inherited.basketPct = 1000;
    assert.throws(() => M.calculateScenario(inherited), RangeError);
  });

  it('validateChanges returns the normalised values and clampChange clamps into range', () => {
    assert.deepEqual(M.validateChanges({ basketPct: -3 }), { volumePct: 0, basketPct: -3, deliveryPoints: 0, onTimePoints: 0 });
    assert.equal(M.clampChange('volumePct', 500), 50);
    assert.equal(M.clampChange('volumePct', -500), -50);
    assert.equal(M.clampChange('deliveryPoints', 2.5), 2.5);
    assert.equal(M.clampChange('deliveryPoints', 2.6), 2.5);
    assert.equal(M.clampChange('onTimePoints', -25.0001), -25);
    assert.equal(M.clampChange('basketPct', 7), 7);
    assert.equal(M.clampChange('basketPct', NaN), 0);
    assert.equal(M.clampChange('basketPct', '7'), 0);
    assert.throws(() => M.clampChange('nope', 1), RangeError);
  });
});

describe('definitions and documentation', () => {
  it('defines six KPIs with unique ids, a definition and a caveat each, mapped to a measure', () => {
    assert.equal(M.METRICS.length, 6);
    assert.equal(new Set(M.METRICS.map((m) => m.id)).size, 6);
    const measureNames = new Set(M.DAX_MEASURES.map((d) => d.name));
    for (const metric of M.METRICS) {
      for (const field of ['id', 'title', 'display', 'unit', 'measure', 'definition', 'caveat']) assert.ok(typeof metric[field] === 'string' && metric[field].length > 0, `${metric.id}.${field}`);
      assert.ok(measureNames.has(metric.measure), `${metric.id} maps to a listed measure`);
      assert.ok(metric.definition.length >= 30 && metric.caveat.length >= 40, `${metric.id} explains itself`);
      assert.ok(/[.)]$/.test(metric.definition) && /[.)]$/.test(metric.caveat), `${metric.id} definition and caveat are sentences`);
    }
    assert.equal(M.METRICS.find((m) => m.id === 'on-time').unit, 'percent of delivered orders', 'the on-time denominator is stated');
    assert.equal(M.METRICS.find((m) => m.id === 'delivery').unit, 'percent of orders');
  });

  it('quotes the five published DAX measures verbatim and marks the others as unpublished', () => {
    const published = M.DAX_MEASURES.filter((d) => d.published);
    assert.equal(published.length, 5);
    for (const measure of published) {
      assert.equal(measure.dax, README_DAX[measure.name], `${measure.name} matches the README`);
      assert.ok(measure.dax.startsWith(`${measure.name} =`));
    }
    const unpublished = M.DAX_MEASURES.filter((d) => !d.published);
    assert.deepEqual(unpublished.map((d) => d.name), ['Delivered Orders', 'On-Time Delivered Orders', 'Total Customers']);
    for (const measure of unpublished) {
      assert.equal(measure.dax, null);
      assert.ok(measure.note && measure.note.includes('not published'));
    }
    const ids = new Set(M.DAX_MEASURES.map((d) => d.id));
    for (const measure of M.DAX_MEASURES) {
      for (const dependency of measure.dependsOn) {
        assert.ok(ids.has(dependency), `${measure.id} depends on ${dependency}`);
        assert.ok(M.DAX_MEASURES.find((d) => d.id === dependency).feeds.includes(measure.id), `${dependency} feeds ${measure.id}`);
      }
      for (const fed of measure.feeds) assert.ok(M.DAX_MEASURES.find((d) => d.id === fed).dependsOn.includes(measure.id), `${fed} depends on ${measure.id}`);
      if (measure.card) assert.ok(M.METRICS.some((m) => m.id === measure.card), `${measure.id} drives KPI ${measure.card}`);
    }
    assert.deepEqual(M.DAX_MEASURES.find((d) => d.id === 'total-revenue').reads, ['fact_order_items']);
    assert.deepEqual(M.DAX_MEASURES.find((d) => d.id === 'total-orders').reads, ['fact_orders']);
  });

  it('lists exactly the README tables, with the columns the DAX and the report use among the columns seen', () => {
    const byGroup = (group) => M.MODEL_TABLES.filter((t) => t.group === group).map((t) => t.id);
    assert.deepEqual(byGroup('fact'), README_TABLES.fact);
    assert.deepEqual(byGroup('dimension'), README_TABLES.dimension);
    assert.deepEqual(byGroup('measure'), README_TABLES.measure);
    assert.equal(M.MODEL_TABLES.length, 10);
    const table = (id) => M.MODEL_TABLES.find((t) => t.id === id);
    assert.ok(table('fact_order_items').columnsSeen.includes('merchandise_revenue') && table('fact_order_items').columnsSeen.includes('freight_revenue'));
    const dateColumns = [...table('dim_date').columnsSeen, ...table('dim_date').columnsFromLayout];
    assert.ok(dateColumns.includes('year') && dateColumns.includes('year_month') && table('dim_date').columnsSeen.includes('is_complete_analysis_month'));
    assert.deepEqual(table('dim_date').columnsFromLayout, ['year', 'year_month'], 'the two columns the layout queries but the scrolled panel does not show are declared as such');
    assert.deepEqual(table('KPI_Measures').columnsSeen, ['Value (hidden)']);
    assert.deepEqual(table('KPI_Measures').measuresSeen, ['Average Order Value', 'Average Review Score', 'Delivered Orders'].toSpliced(2, 0, 'Delivered Customers'), 'the four measure names visible in the model view, in order');
    assert.ok(table('dim_product').columnsSeen.includes('product_category'));
    assert.ok(table('dim_order_status').columnsSeen.includes('status_group'));
    const measureIds = new Set(M.DAX_MEASURES.map((d) => d.id));
    const visualIds = new Set(M.DASHBOARD_VISUALS.map((v) => v.id));
    for (const t of M.MODEL_TABLES) {
      assert.ok(t.description.length >= 40 && t.title.length > 0, `${t.id} is described`);
      assert.ok(t.columnsSeen.length >= 1, `${t.id} lists columns seen`);
      assert.ok(Array.isArray(t.columnsFromLayout), `${t.id} declares its layout-only columns`);
      if (t.id !== 'dim_date') assert.deepEqual(t.columnsFromLayout, [], `${t.id} has no layout-only column`);
      for (const column of t.columnsFromLayout) assert.ok(!t.columnsSeen.includes(column), `${t.id}.${column} is listed once`);
      if (t.group !== 'measure') assert.equal(t.measuresSeen, undefined, `${t.id} lists no measures seen`);
      for (const id of t.measures) assert.ok(measureIds.has(id), `${t.id} measure ${id}`);
      for (const id of t.visuals) assert.ok(visualIds.has(id), `${t.id} visual ${id}`);
    }
    for (const measure of M.DAX_MEASURES) for (const id of measure.reads) assert.ok(table(id), `${measure.id} reads ${id}`);
  });

  it('describes the report page by its fields, every field naming a listed table or measure', () => {
    assert.equal(M.DASHBOARD_VISUALS.length, 6);
    const tables = new Set(M.MODEL_TABLES.map((t) => t.id));
    const measureNames = new Set(M.DAX_MEASURES.map((d) => d.name));
    for (const visual of M.DASHBOARD_VISUALS) {
      for (const field of visual.fields) {
        const [tableName, column] = field.split('.');
        assert.ok(tables.has(tableName), `${visual.id}: ${field} names a documented table`);
        if (tableName === 'KPI_Measures') assert.ok(measureNames.has(column), `${visual.id}: ${column} is a listed measure`);
        else {
          const table = M.MODEL_TABLES.find((t) => t.id === tableName);
          assert.ok([...table.columnsSeen, ...table.columnsFromLayout].includes(column), `${visual.id}: ${field} is a column seen in the model view or named by the report layout`);
        }
      }
    }
    assert.equal(M.DASHBOARD_VISUALS.find((v) => v.id === 'cards').fields.length, 6);
    assert.equal(M.DASHBOARD_VISUALS.find((v) => v.id === 'trend').filter, 'dim_date.is_complete_analysis_month = 1');
    assert.equal(M.PIPELINE.length, 5);
    assert.deepEqual(M.PIPELINE.map((stage) => stage.title), ['SQL', 'Google Colab', 'Dimensional model', 'DAX measures', 'Power BI report']);
    assert.ok(M.MODEL_FACTS.length >= 3 && M.MODEL_FACTS.every((fact) => fact.length > 40));
  });

  it('keeps presets, inputs, formulas and assumptions coherent with the limits', () => {
    assert.deepEqual(Object.keys(M.LIMITS), KEYS);
    assert.deepEqual(M.INPUTS.map((input) => input.key), KEYS);
    assert.deepEqual(M.DEFAULT_CHANGES, { volumePct: 0, basketPct: 0, deliveryPoints: 0, onTimePoints: 0 });
    for (const input of M.INPUTS) {
      const [min, max] = M.LIMITS[input.key];
      assert.ok(min < 0 && max > 0, `${input.key} brackets zero`);
      assert.ok(input.step > 0 && Number.isInteger(Math.round(((max - min) / input.step) * 1e6) / 1e6), `${input.key} range is a whole number of steps`);
      assert.ok(input.label && input.unit && input.description.length > 20);
    }
    assert.equal(M.PRESETS.length, 5);
    assert.equal(new Set(M.PRESETS.map((p) => p.id)).size, 5);
    assert.equal(M.PRESETS[0].id, 'baseline');
    for (const preset of M.PRESETS) {
      assert.deepEqual(Object.keys(preset.changes), KEYS, `${preset.id} sets all four levers`);
      const scenario = M.calculateScenario(preset.changes);
      assert.equal(scenario.isBaseline, preset.id === 'baseline', `${preset.id} baseline flag`);
      assert.ok(preset.name && preset.description);
    }
    assert.ok(M.FORMULAS.length >= 6 && M.FORMULAS.every((f) => f.id && f.label && f.expression && f.note));
    assert.ok(M.FORMULAS.some((f) => f.expression.includes('(1 + v) × (1 + b)')));
    assert.ok(M.ASSUMPTIONS.length >= 4 && M.ASSUMPTIONS.every((a) => a.length > 40));
  });

  it('records provenance with encoded GitHub links and the checked commit', () => {
    assert.equal(M.SOURCE.repository, 'https://github.com/arthur-fay/customer-revenue-analytics');
    assert.match(M.SOURCE.commit, /^[0-9a-f]{40}$/);
    assert.match(M.SOURCE.checked, /^\d{4}-\d{2}-\d{2}$/);
    for (const url of [M.SOURCE.readme, M.SOURCE.readmeKpis, M.SOURCE.readmeModel, M.SOURCE.readmeDax, ...Object.values(M.SOURCE.files)]) {
      assert.ok(url.startsWith(`${M.SOURCE.repository}/blob/main/`), url);
      assert.ok(!/\s/.test(url), `no raw whitespace in ${url}`);
    }
    assert.ok(M.SOURCE.files.pbix.endsWith('.pbix') && M.SOURCE.files.pdf.endsWith('.pdf') && M.SOURCE.files.model.endsWith('.png'));
  });

  it('exposes deeply frozen data', () => {
    for (const value of [M.SOURCE, M.PUBLISHED, M.EXPORTED, M.DERIVED, M.METRICS, M.DAX_MEASURES, M.MODEL_TABLES, M.MODEL_FACTS, M.DASHBOARD_VISUALS, M.PIPELINE, M.DEFAULT_CHANGES, M.LIMITS, M.INPUTS, M.PRESETS, M.FORMULAS, M.ASSUMPTIONS, M.BASELINE]) {
      assert.ok(Object.isFrozen(value));
    }
    assert.ok(Object.isFrozen(M.PUBLISHED.categories[1]) && Object.isFrozen(M.MODEL_TABLES[3].columnsSeen) && Object.isFrozen(M.PRESETS[2].changes) && Object.isFrozen(M.SOURCE.files));
    assert.throws(() => { M.PUBLISHED.revenueBRL = 1; }, TypeError);
    assert.throws(() => { M.EXPORTED.statusCounts.push({}); }, TypeError);
    assert.throws(() => { M.LIMITS.volumePct[1] = 1000; }, TypeError);
  });
});

describe('formatting helpers', () => {
  it('formats currency the way the README prints it', () => {
    assert.equal(M.formatMillionsBRL(15_840_000), 'R$15.84M');
    assert.equal(M.formatMillionsBRL(1_440_000), 'R$1.44M');
    assert.equal(M.formatMillionsBRL(580_000), 'R$0.58M');
    assert.equal(M.formatMillionsBRL(-1_100_000), '−R$1.10M');
    assert.equal(M.formatMillionsBRL(19_126_800, 1), 'R$19.1M');
    assert.equal(M.formatBRL(159.33), 'R$159.33');
    assert.equal(M.formatBRL(15_843_934.53), 'R$15,843,934.53');
    assert.equal(M.formatBRL(1234.5, 0), 'R$1,235');
    assert.equal(M.formatBRL(-0.5), '−R$0.50');
    assert.equal(M.formatBRL(0), 'R$0.00');
  });

  it('formats signed changes with a true minus sign and a signless zero', () => {
    assert.equal(M.formatSignedMillionsBRL(3_286_800), '+R$3.29M');
    assert.equal(M.formatSignedMillionsBRL(-10_296_000), '−R$10.30M');
    assert.equal(M.formatSignedMillionsBRL(0), 'R$0.00M');
    assert.equal(M.formatSignedMillionsBRL(4_000), 'R$0.00M', 'a change that rounds to zero carries no sign');
    assert.equal(M.formatSignedPercent(20.75), '+20.8%');
    assert.equal(M.formatSignedPercent(-65), '−65.0%');
    assert.equal(M.formatSignedPercent(0), '0.0%');
    assert.equal(M.formatSignedPercent(0.04), '0.0%');
    assert.equal(M.formatSignedPercent(-0.04), '0.0%');
    assert.equal(M.formatSignedPercent(2.345, 2), '+2.35%');
    assert.equal(M.formatPoints(5.319), '+5.3 pts');
    assert.equal(M.formatPoints(-2), '−2.0 pts');
    assert.equal(M.formatPoints(0), '0.0 pts');
    assert.equal(M.formatSignedInt(14_912.4), '+14,912');
    assert.equal(M.formatSignedInt(-1_234.6), '−1,235');
    assert.equal(M.formatSignedInt(0.4), '0');
  });

  it('formats counts, compact counts and percentages', () => {
    assert.equal(M.formatInt(99_441), '99,441');
    assert.equal(M.formatInt(99_416.3), '99,416');
    assert.equal(M.formatInt(-1_234.6), '−1,235');
    assert.equal(M.formatInt(0), '0');
    assert.equal(M.formatCompact(99_416.3), '99.4K');
    assert.equal(M.formatCompact(99_416.3, 0), '99K');
    assert.equal(M.formatCompact(114_328.75), '114.3K');
    assert.equal(M.formatCompact(1_250_000), '1.3M');
    assert.equal(M.formatCompact(999), '999');
    assert.equal(M.formatCompact(999.6), '1000');
    assert.equal(M.formatCompact(-2_500), '−2.5K');
    assert.equal(M.formatPercent(97.02), '97.02%');
    assert.equal(M.formatPercent(89.141976), '89.14%');
    assert.equal(M.formatPercent(9.0909, 1), '9.1%');
    assert.equal(M.formatPercent(-3.456, 1), '−3.5%');
  });

  it('rounds half away from zero from the shortest decimal representation, never to a negative zero', () => {
    assert.equal(M.roundTo(18.45, 1), 18.5);
    assert.equal(M.roundTo(-18.45, 1), -18.5);
    assert.equal(M.roundTo(1.005, 2), 1.01, 'not 1 through 1.00499999…');
    assert.equal(M.roundTo(0.615, 2), 0.62);
    assert.equal(M.roundTo(2.5), 3);
    assert.equal(M.roundTo(-2.5), -3);
    assert.equal(M.roundTo(1.25, 1), 1.3);
    assert.equal(M.roundTo(159.33, 2), 159.33);
    assert.equal(M.roundTo(99_416.3), 99_416);
    assert.equal(M.roundTo(0, 1), 0);
    assert.ok(Object.is(M.roundTo(-0.04, 1), 0), 'a negative value that rounds to zero is a plain zero');
    assert.ok(Object.is(M.roundTo(-0, 2), 0));
    assert.equal(M.roundTo(1e21, 2), 1e21, 'a value too large to carry a fraction is returned as it is');
    assert.equal(M.roundTo(2 ** 53 + 2, 3), 2 ** 53 + 2);
    assert.equal(M.roundTo(1.5e-7, 7), 2e-7, 'exponent notation is shifted the same way');
    assert.equal(M.roundTo(-1.5e-7, 7), -2e-7);
    assert.equal(M.roundTo(123.456e3, 1), 123_456);
    assert.equal(M.formatPercent(18.45, 1), '18.5%');
    assert.equal(M.formatSignedPercent(18.45), '+18.5%');
    assert.equal(M.formatBRL(1.005), 'R$1.01');
    assert.equal(M.formatMillionsBRL(1_005_000), 'R$1.01M', 'not R$1.00M');
    assert.equal(M.formatSignedMillionsBRL(-1_005_000), '−R$1.01M');
    assert.equal(M.formatPoints(0.05), '+0.1 pts');
    assert.equal(M.formatPoints(-0.05), '−0.1 pts');
    assert.equal(M.formatCompact(99_450), '99.5K');
    assert.equal(M.formatInt(2.5), '3');
    assert.equal(M.formatSignedInt(-2.5), '−3');
  });

  it('refuses non-finite input', () => {
    for (const formatter of [M.formatMillionsBRL, M.formatSignedMillionsBRL, M.formatBRL, M.formatInt, M.formatSignedInt, M.formatCompact, M.formatPercent, M.formatSignedPercent, M.formatPoints]) {
      for (const bad of [NaN, Infinity, -Infinity, '12', null, undefined, {}]) assert.throws(() => formatter(bad), TypeError, `${formatter.name}(${String(bad)})`);
    }
  });
});
