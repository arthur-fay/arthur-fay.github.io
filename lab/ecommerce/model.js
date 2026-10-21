/**
 * Project 02: E-Commerce Analytics Lab.
 *
 * Published figures are transcribed from the author's public project README:
 * https://github.com/arthur-fay/customer-revenue-analytics
 * They are rounded summary figures, NOT raw transaction records. No attempt is
 * made to reconstruct missing transactions or monthly/category breakdowns.
 */
export const PUBLISHED = Object.freeze({
  orders: "99K",
  revenueBRL: 15_840_000,
  customers: "96K",
  averageOrderBRL: 159.33,
  deliveredPct: 97.02,
  onTimeOfDeliveredPct: 91.88,
  categories: Object.freeze([
    Object.freeze({ name: "Health & beauty", revenueBRL: 1_440_000 }),
    Object.freeze({ name: "Watches & gifts", revenueBRL: 1_310_000 }),
  ]),
});

export const DEFAULT_CHANGES = Object.freeze({
  volumePct: 0,
  basketPct: 0,
  deliveryPoints: 0,
  onTimePoints: 0,
});

export const LIMITS = Object.freeze({
  volumePct: Object.freeze([-30, 40]),
  basketPct: Object.freeze([-20, 30]),
  deliveryPoints: Object.freeze([-10, 2]),
  onTimePoints: Object.freeze([-15, 8]),
});

/**
 * All four adjustments are HYPOTHETICAL inputs; none are historic data.
 * Revenue is scaled from the published rounded revenue anchor, not recomputed
 * from the separately rounded 99K orders and R$159.33 average-order figure.
 * Delivery and on-time rates are separate metrics; on-time is conditional on
 * delivered orders. No individual order counts are inferred.
 */
export function calculateScenario(changes = DEFAULT_CHANGES) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    throw new TypeError("Changes must be an object");
  }
  const keys = Object.keys(LIMITS);
  if (Object.keys(changes).some((key) => !keys.includes(key))) {
    throw new RangeError("Unknown scenario setting");
  }
  const values = {};
  for (const key of keys) {
    const value = changes[key] ?? DEFAULT_CHANGES[key];
    const [min, max] = LIMITS[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(key + " must be a finite number from " + min + " to " + max);
    }
    values[key] = value;
  }
  const multiplier = (1 + values.volumePct / 100) * (1 + values.basketPct / 100);
  const revenueBRL = Math.round(PUBLISHED.revenueBRL * multiplier);
  return Object.freeze({
    ...values,
    multiplier,
    revenueBRL,
    revenueChangeBRL: revenueBRL - PUBLISHED.revenueBRL,
    revenueDeltaPct: (multiplier - 1) * 100,
    deliveredPct: PUBLISHED.deliveredPct + values.deliveryPoints,
    onTimeOfDeliveredPct: PUBLISHED.onTimeOfDeliveredPct + values.onTimePoints,
  });
}

export function formatMillionsBRL(amountBRL) {
  if (!Number.isFinite(amountBRL)) throw new TypeError("Amount must be finite");
  return "R$" + (amountBRL / 1_000_000).toFixed(2) + "M";
}

export function formatSignedPercent(value) {
  if (!Number.isFinite(value)) throw new TypeError("Percentage must be finite");
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  return (rounded > 0 ? "+" : "") + rounded.toFixed(1) + "%";
}

export const METRICS = Object.freeze([
  Object.freeze({ id: "revenue", title: "Total revenue", display: "R$15.84M", definition: "Merchandise revenue plus freight revenue, as defined by the project's published DAX measure.", caveat: "The README reports an aggregated, rounded total. Underlying transactions and monthly history are not loaded in this lab." }),
  Object.freeze({ id: "orders", title: "Total orders", display: "99K", definition: "Count of rows in fact_orders in the published DAX measure.", caveat: "99K is rounded; do not infer an exact order count." }),
  Object.freeze({ id: "customers", title: "Total customers", display: "96K", definition: "Reported distinct customers in the executive dashboard.", caveat: "96K is rounded in the public project README; the precise distinct-count definition is not reproduced here." }),
  Object.freeze({ id: "aov", title: "Average order value", display: "R$159.33", definition: "Total revenue divided by total orders, as defined by the published DAX measure.", caveat: "Because total orders and revenue are separately rounded in the README, the displayed figures cannot be used to reverse-engineer the exact ratio." }),
  Object.freeze({ id: "delivery", title: "Delivery rate", display: "97.02%", definition: "Delivered orders divided by total orders.", caveat: "This is the reported overall aggregate, not an outcome by year, product, region or order status." }),
  Object.freeze({ id: "on-time", title: "On-time delivery", display: "91.88%", definition: "On-time delivered orders divided by delivered orders.", caveat: "The denominator is delivered orders, not all orders. A higher delivery rate does not mechanically imply a higher on-time rate." }),
]);

export const MODEL_TABLES = Object.freeze([
  Object.freeze({ id: "fact_orders", group: "Fact", description: "Order-level records. The published Total Orders DAX measure counts rows here.", focus: "Order counts and delivery status" }),
  Object.freeze({ id: "fact_order_items", group: "Fact", description: "Order-item values. The published Total Revenue DAX measure sums merchandise and freight revenue from this fact table.", focus: "Merchandise and freight" }),
  Object.freeze({ id: "fact_cohort_retention", group: "Fact", description: "Cohort-retention fact table listed by the author's data-model documentation.", focus: "Retention analysis" }),
  Object.freeze({ id: "dim_date", group: "Dimension", description: "Date dimension used for calendar-oriented filtering and reporting.", focus: "Dates and time slicing" }),
  Object.freeze({ id: "dim_customer", group: "Dimension", description: "Customer dimension listed in the documented dimensional model.", focus: "Customer analysis" }),
  Object.freeze({ id: "dim_product", group: "Dimension", description: "Product dimension that supports product-category analysis.", focus: "Product classification" }),
  Object.freeze({ id: "dim_seller", group: "Dimension", description: "Seller dimension listed in the project's documented model.", focus: "Seller reporting" }),
  Object.freeze({ id: "dim_payment_method", group: "Dimension", description: "Payment-method dimension listed in the project's documented model.", focus: "Payment methods" }),
  Object.freeze({ id: "dim_order_status", group: "Dimension", description: "Order-status dimension that supports status filtering.", focus: "Order states" }),
  Object.freeze({ id: "KPI_Measures", group: "Measure", description: "Dedicated table of DAX measures used to drive the Power BI executive dashboard.", focus: "Reusable KPI calculations" }),
]);
