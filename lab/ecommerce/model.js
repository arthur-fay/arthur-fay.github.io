/**
 * Project 02: E-Commerce Analytics Lab — pure analytics engine.
 *
 * No DOM access, no side effects, no network: everything here is data and
 * arithmetic, so the unit tests exercise exactly the code the page runs.
 *
 * Every figure in this module has one of three provenances, and the page
 * labels them differently:
 *
 *  - PUBLISHED: transcribed from the author's public project README
 *    (https://github.com/arthur-fay/customer-revenue-analytics). They are
 *    rounded summary figures, NOT raw transaction records.
 *  - EXPORTED: transcribed from the data labels printed on the dashboard
 *    export (PDF) and the README screenshot of the same report page.
 *  - DERIVED: arithmetic on the figures above (shares, products, cross-checks),
 *    documented as such; and HYPOTHETICAL scenario outputs, which are
 *    projections from explicit assumptions and never business performance.
 *
 * No monthly revenue series, customer-level observation or transaction is
 * reconstructed anywhere: the README publishes none, so the lab shows none.
 */

const deepFreeze = (value) => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const inner of Object.values(value)) deepFreeze(inner);
  }
  return value;
};

/* --------------------------------------------------------------- provenance */

const REPO = 'https://github.com/arthur-fay/customer-revenue-analytics';

/** Where every figure comes from, with the commit the lab was checked against. */
export const SOURCE = deepFreeze({
  repository: REPO,
  readme: `${REPO}/blob/main/README.md`,
  readmeKpis: `${REPO}/blob/main/README.md#key-performance-indicators`,
  readmeInsights: `${REPO}/blob/main/README.md#key-business-insights`,
  readmeModel: `${REPO}/blob/main/README.md#data-model`,
  readmeDax: `${REPO}/blob/main/README.md#selected-dax-measures`,
  commit: '795257de2a80f5118e62d5a2eb84cd063aeef283',
  checked: '2026-10-21',
  files: {
    dashboard: `${REPO}/blob/main/01%20Raw%20Screenshots/Ecommerce_Executive_Dashboard.png`,
    annotated: `${REPO}/blob/main/02%20Annotated%20Images/Ecommerce_Executive_Dashboard_Annotated.png`,
    model: `${REPO}/blob/main/01%20Raw%20Screenshots/Ecommerce_Data_Model.png`,
    pbix: `${REPO}/blob/main/03%20PBIX%20FILE/Ecommerce_Executive_Dashboard.pbix`,
    pdf: `${REPO}/blob/main/04%20Exports/Ecommerce_Executive_Dashboard.pdf`,
  },
});

/* ---------------------------------------------------------------- published */

/**
 * The README's "Key Performance Indicators" table and "Key Business Insights".
 * Orders and customers are published only as rounded thousands, so they are
 * kept as display strings rather than numbers: no exact count is implied.
 */
export const PUBLISHED = deepFreeze({
  currency: 'BRL',
  ordersDisplay: '99K',
  revenueBRL: 15_840_000,
  revenueDisplay: 'R$15.84M',
  customersDisplay: '96K',
  averageOrderBRL: 159.33,
  deliveredPct: 97.02,
  onTimeOfDeliveredPct: 91.88,
  categories: [
    { id: 'health-beauty', name: 'Health and beauty', label: 'health beauty', revenueBRL: 1_440_000, rank: 1 },
    { id: 'watches-gifts', name: 'Watches and gifts', label: 'watches gifts', revenueBRL: 1_310_000, rank: 2 },
  ],
  insights: [
    'Health and beauty generated the highest product-category revenue at approximately R$1.44M.',
    'Watches and gifts followed with approximately R$1.31M.',
    'Monthly revenue increased considerably throughout the analysis period.',
    'Completed orders represented the overwhelming majority of all orders.',
    'Approximately 97% of orders were delivered successfully.',
    'More than 91% of delivered orders arrived on time.',
    'The dashboard includes year-range and order-status filters for interactive analysis.',
  ],
});

/* ----------------------------------------------------------------- exported */

/**
 * Data labels printed on the published report page ("Orders by Status" and
 * "Top 10 Product Categories by Revenue"), read from the PDF export and the
 * README screenshot. The category chart prints its values in millions with
 * two decimals, so each revenue figure is rounded to R$10,000; one category
 * label is truncated with an ellipsis in the export itself and is kept as
 * printed. The monthly trend chart prints no data labels, so no monthly value
 * is transcribed.
 */
export const EXPORTED = deepFreeze({
  statusCounts: [
    { id: 'completed', label: 'completed', orders: 96_478 },
    { id: 'open_or_incomplete', label: 'open_or_incomplete', orders: 1_729 },
    { id: 'failed', label: 'failed', orders: 1_234 },
  ],
  topCategories: [
    { rank: 1, label: 'health beauty', revenueBRL: 1_440_000, truncated: false },
    { rank: 2, label: 'watches gifts', revenueBRL: 1_310_000, truncated: false },
    { rank: 3, label: 'bed bath table', revenueBRL: 1_240_000, truncated: false },
    { rank: 4, label: 'sports leisure', revenueBRL: 1_160_000, truncated: false },
    { rank: 5, label: 'computers acce…', revenueBRL: 1_060_000, truncated: true },
    { rank: 6, label: 'furniture decor', revenueBRL: 900_000, truncated: false },
    { rank: 7, label: 'housewares', revenueBRL: 780_000, truncated: false },
    { rank: 8, label: 'cool stuff', revenueBRL: 720_000, truncated: false },
    { rank: 9, label: 'auto', revenueBRL: 690_000, truncated: false },
    { rank: 10, label: 'garden tools', revenueBRL: 580_000, truncated: false },
  ],
  trend: {
    title: 'Monthly Revenue Trend',
    axisFrom: 'Jan 2017',
    axisTo: 'Jul 2018',
    dataLabels: false,
  },
  yearSlicer: [2016, 2018],
});

/* ------------------------------------------------------------------ derived */

const sum = (values) => values.reduce((total, value) => total + value, 0);
const round = (value, decimals) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Arithmetic on the published and exported figures. Each value is a
 * consequence of figures above, never a new observation; the page labels
 * them "derived" and shows the operation.
 */
export const DERIVED = deepFreeze((() => {
  const statusTotal = sum(EXPORTED.statusCounts.map((row) => row.orders));
  const completed = EXPORTED.statusCounts.find((row) => row.id === 'completed').orders;
  const impliedOrders = PUBLISHED.revenueBRL / PUBLISHED.averageOrderBRL;
  const onTimeOfAllPct = (PUBLISHED.deliveredPct * PUBLISHED.onTimeOfDeliveredPct) / 100;
  const topTenTotalBRL = sum(EXPORTED.topCategories.map((row) => row.revenueBRL));
  const [first, second] = PUBLISHED.categories;
  return {
    /** Orders implied by the two published anchors: revenue ÷ average order value. */
    impliedOrders,
    /** Sum of the three exported status counts. */
    statusTotalOrders: statusTotal,
    /** Completed orders as a share of the exported total, which reproduces the published delivery rate. */
    completedShareOfStatusTotalPct: (completed / statusTotal) * 100,
    /** Average order value implied by the rounded revenue and the exported order total. */
    impliedAverageOrderFromStatusBRL: PUBLISHED.revenueBRL / statusTotal,
    /** Revenue implied by the published average order value and the exported order total. */
    impliedRevenueFromStatusBRL: PUBLISHED.averageOrderBRL * statusTotal,
    /** On-time deliveries as a share of all orders: delivery rate × on-time rate. */
    onTimeOfAllPct,
    /** Orders not delivered, as a share of all orders. */
    notDeliveredPct: 100 - PUBLISHED.deliveredPct,
    /** Delivered but late, as a share of all orders. */
    lateOfAllPct: PUBLISHED.deliveredPct - onTimeOfAllPct,
    /** Each documented category as a share of total revenue. */
    categoryShares: PUBLISHED.categories.map((category) => ({ id: category.id, sharePct: (category.revenueBRL / PUBLISHED.revenueBRL) * 100 })),
    /** The gap between the two documented leading categories. */
    categoryGapBRL: first.revenueBRL - second.revenueBRL,
    categoryGapPct: ((first.revenueBRL - second.revenueBRL) / second.revenueBRL) * 100,
    /** The ten exported categories together, and their share of total revenue. */
    topTenTotalBRL,
    topTenShareOfRevenuePct: (topTenTotalBRL / PUBLISHED.revenueBRL) * 100,
    /** Share of the exported order total by status. */
    statusShares: EXPORTED.statusCounts.map((row) => ({ id: row.id, sharePct: (row.orders / statusTotal) * 100 })),
  };
})());

/* -------------------------------------------------------------- definitions */

/**
 * The six executive KPI cards, with the definition each published DAX measure
 * gives and the caveat that applies to the rounded figure.
 */
export const METRICS = deepFreeze([
  {
    id: 'orders', title: 'Total orders', display: PUBLISHED.ordersDisplay, unit: 'orders', measure: 'Total Orders',
    definition: 'The number of rows in fact_orders, one row per order.',
    caveat: 'Published rounded to thousands; the exact count is not in the README. The exported status chart sums to 99,441 orders.',
  },
  {
    id: 'revenue', title: 'Total revenue', display: PUBLISHED.revenueDisplay, unit: 'BRL', measure: 'Total Revenue',
    definition: 'Merchandise revenue plus freight revenue, summed over fact_order_items.',
    caveat: 'Published rounded to R$10,000. Underlying transactions and the monthly series are not published, so none are loaded here.',
  },
  {
    id: 'customers', title: 'Total customers', display: PUBLISHED.customersDisplay, unit: 'customers', measure: 'Total Customers',
    definition: 'The customer count shown on the dashboard card; the README does not publish the measure\'s DAX definition.',
    caveat: 'Published rounded to thousands. Whether the count is distinct customer_unique_id values is not stated, so the lab does not assume it.',
  },
  {
    id: 'aov', title: 'Average order value', display: 'R$159.33', unit: 'BRL per order', measure: 'Average Order Value',
    definition: 'Total revenue divided by total orders (DIVIDE with a zero fallback).',
    caveat: 'R$15.84M ÷ 99,441 exported orders gives R$159.29: the published R$159.33 is exact while the revenue is rounded, and the two agree within that rounding.',
  },
  {
    id: 'delivery', title: 'Delivery rate', display: '97.02%', unit: 'percent of orders', measure: 'Delivery Rate %',
    definition: 'Delivered orders divided by total orders.',
    caveat: 'An overall aggregate, not a figure by year, product, region or status. The exported status counts reproduce it: 96,478 ÷ 99,441 = 97.02%.',
  },
  {
    id: 'on-time', title: 'On-time delivery rate', display: '91.88%', unit: 'percent of delivered orders', measure: 'On-Time Delivery Rate %',
    definition: 'On-time delivered orders divided by delivered orders.',
    caveat: 'The denominator is delivered orders, not all orders: as a share of all orders, on-time deliveries are about 89.1% (97.02% × 91.88%).',
  },
]);

/** DAX measures: the five the README publishes verbatim, and the ones it references or the model view shows without a definition. */
export const DAX_MEASURES = deepFreeze([
  { id: 'total-orders', name: 'Total Orders', published: true, dax: 'Total Orders =\nCOUNTROWS(fact_orders)', reads: ['fact_orders'], dependsOn: [], feeds: ['aov', 'delivery'], card: 'orders' },
  { id: 'total-revenue', name: 'Total Revenue', published: true, dax: 'Total Revenue =\nSUM(fact_order_items[merchandise_revenue])\n    + SUM(fact_order_items[freight_revenue])', reads: ['fact_order_items'], dependsOn: [], feeds: ['aov'], card: 'revenue' },
  { id: 'aov', name: 'Average Order Value', published: true, dax: 'Average Order Value =\nDIVIDE(\n    [Total Revenue],\n    [Total Orders],\n    0\n)', reads: [], dependsOn: ['total-revenue', 'total-orders'], feeds: [], card: 'aov' },
  { id: 'delivery', name: 'Delivery Rate %', published: true, dax: 'Delivery Rate % =\nDIVIDE(\n    [Delivered Orders],\n    [Total Orders],\n    0\n)', reads: [], dependsOn: ['delivered-orders', 'total-orders'], feeds: [], card: 'delivery' },
  { id: 'on-time', name: 'On-Time Delivery Rate %', published: true, dax: 'On-Time Delivery Rate % =\nDIVIDE(\n    [On-Time Delivered Orders],\n    [Delivered Orders],\n    0\n)', reads: [], dependsOn: ['on-time-delivered-orders', 'delivered-orders'], feeds: [], card: 'on-time' },
  { id: 'delivered-orders', name: 'Delivered Orders', published: false, dax: null, reads: [], dependsOn: [], feeds: ['delivery', 'on-time'], card: null, note: 'referenced by two published measures and listed in the KPI_Measures table of the model view; its definition is not published.' },
  { id: 'on-time-delivered-orders', name: 'On-Time Delivered Orders', published: false, dax: null, reads: [], dependsOn: [], feeds: ['on-time'], card: null, note: 'referenced by the on-time measure; its definition is not published. fact_orders carries a delivered_on_time_flag column in the model view.' },
  { id: 'total-customers', name: 'Total Customers', published: false, dax: null, reads: [], dependsOn: [], feeds: [], card: 'customers', note: 'drives the Total Customers card in the report layout; its definition is not published.' },
]);

/** The dimensional model as the README documents it, with the columns visible in the published model view (partial: the panels are scrolled). */
export const MODEL_TABLES = deepFreeze([
  { id: 'fact_orders', group: 'fact', title: 'Orders', description: 'One row per order. Total Orders counts its rows, and the delivery measures divide delivered orders by it.', columnsSeen: ['analysis_scope', 'average_review_score', 'customer_order_value', 'customer_state', 'customer_unique_id', 'days_late_vs_estimate', 'delivered_on_time_flag', 'distinct_product_count', 'distinct_seller_count'], measures: ['total-orders'], visuals: ['cards', 'status'] },
  { id: 'fact_order_items', group: 'fact', title: 'Order items', description: 'One row per order line. Total Revenue sums merchandise_revenue and freight_revenue here; the model view shows four relationships ending on this table.', columnsSeen: ['analysis_scope', 'customer_line_value', 'customer_unique_id', 'freight_revenue', 'merchandise_revenue', 'order_date_key', 'order_id', 'order_item_id', 'order_purchase_date'], measures: ['total-revenue'], visuals: ['cards', 'trend', 'top10'] },
  { id: 'fact_cohort_retention', group: 'fact', title: 'Cohort retention', description: 'Cohort-level retention facts listed in the README. No published measure or dashboard visual reads it, so the lab shows nothing from it.', columnsSeen: ['cohort_index', 'cohort_month', 'cohort_month_start_date', 'cohort_month_start_date_key', 'cohort_size', 'retained_customers', 'retention_rate', 'retention_rate_pct'], measures: [], visuals: [] },
  { id: 'dim_date', group: 'dimension', title: 'Date', description: 'Calendar dimension. The report layout slices the page by its year column, plots the trend by year_month and filters the trend to complete analysis months.', columnsSeen: ['date', 'date_key', 'day_of_month', 'day_of_week_name', 'day_of_week_number', 'is_complete_analysis_month', 'is_weekend', 'month_name', 'month_number', 'year', 'year_month'], measures: [], visuals: ['trend', 'slicer-year'] },
  { id: 'dim_customer', group: 'dimension', title: 'Customer', description: 'Customer dimension listed in the README, with customer-level attributes visible in the model view. No published measure definition reads it.', columnsSeen: ['average_delivery_days', 'average_order_value', 'average_review_score', 'churn_proxy_90_day_flag', 'customer_lifetime_value', 'customer_retention_status', 'customer_unique_id', 'days_observed_after_first', 'days_to_second_purchase'], measures: [], visuals: [] },
  { id: 'dim_product', group: 'dimension', title: 'Product', description: 'Product dimension. The Top 10 chart groups Total Revenue by its product_category column.', columnsSeen: ['category_translation_status', 'original_category_name', 'product_category', 'product_description_length', 'product_height_cm', 'product_id', 'product_length_cm', 'product_name_length', 'product_photos_qty'], measures: [], visuals: ['top10'] },
  { id: 'dim_seller', group: 'dimension', title: 'Seller', description: 'Seller dimension listed in the README. No dashboard visual on the published page uses its columns.', columnsSeen: ['seller_average_latitude', 'seller_average_longitude', 'seller_city', 'seller_id', 'seller_state', 'seller_zip_code_prefix'], measures: [], visuals: [] },
  { id: 'dim_payment_method', group: 'dimension', title: 'Payment method', description: 'Payment-method dimension listed in the README. No dashboard visual on the published page uses its columns.', columnsSeen: ['payment_method', 'payment_method_group'], measures: [], visuals: [] },
  { id: 'dim_order_status', group: 'dimension', title: 'Order status', description: 'Order-status dimension. The report layout slices the page by status_group and groups the Orders by Status chart by it.', columnsSeen: ['order_status', 'status_group'], measures: [], visuals: ['status', 'slicer-status'] },
  { id: 'KPI_Measures', group: 'measure', title: 'KPI measures', description: 'A dedicated measure table: every card and chart value on the page reads a measure from it. Its only column, Value, is hidden in the model view.', columnsSeen: ['Value (hidden)'], measures: ['total-orders', 'total-revenue', 'aov', 'delivery', 'on-time', 'delivered-orders', 'on-time-delivered-orders', 'total-customers'], visuals: ['cards', 'trend', 'top10', 'status'] },
]);

/** What the README and the model view say about relationships; the lab asserts nothing beyond this. */
export const MODEL_FACTS = deepFreeze([
  'The README documents a dimensional structure whose relationships "support filtering across dates, customers, products, sellers, payment methods, and order statuses".',
  'In the published model view the many-side markers sit on fact_orders and fact_order_items; four relationship lines end on fact_order_items and dim_date shows two one-side markers.',
  'The page-level slicers (dim_date.year and dim_order_status.status_group) filter every card, so those two dimensions filter the fact rows the measures count.',
  'Column-level relationship keys and cross-filter directions are not published, so the diagram draws documented filter paths from each dimension to the fact layer rather than guessed joins.',
]);

/** The published report page, read from the report layout inside the published .pbix file. */
export const DASHBOARD_VISUALS = deepFreeze([
  { id: 'cards', title: 'Six KPI cards', type: 'Card', fields: ['KPI_Measures.Total Orders', 'KPI_Measures.Total Revenue', 'KPI_Measures.Total Customers', 'KPI_Measures.Average Order Value', 'KPI_Measures.Delivery Rate %', 'KPI_Measures.On-Time Delivery Rate %'], filter: null },
  { id: 'trend', title: 'Monthly Revenue Trend', type: 'Line chart', fields: ['KPI_Measures.Total Revenue', 'dim_date.year_month'], filter: 'dim_date.is_complete_analysis_month = 1' },
  { id: 'top10', title: 'Top 10 Product Categories by Revenue', type: 'Bar chart', fields: ['dim_product.product_category', 'KPI_Measures.Total Revenue'], filter: 'Top 10 categories by Total Revenue' },
  { id: 'status', title: 'Orders by Status', type: 'Column chart', fields: ['dim_order_status.status_group', 'KPI_Measures.Total Orders'], filter: null },
  { id: 'slicer-year', title: 'Year Range', type: 'Slicer (between)', fields: ['dim_date.year'], filter: null },
  { id: 'slicer-status', title: 'Order Status', type: 'Slicer', fields: ['dim_order_status.status_group'], filter: null },
]);

/** The toolchain the README names, in the order the data travels. */
export const PIPELINE = deepFreeze([
  { id: 'sql', title: 'SQL', text: 'Queries over the transactional data. The README names SQL first among the tools and lists data cleaning and transformation among the skills; it does not detail which steps run in SQL and which in the notebooks.' },
  { id: 'colab', title: 'Google Colab', text: 'Python notebooks for cleaning and transforming the data before it is modelled.' },
  { id: 'model', title: 'Dimensional model', text: 'Power Query and data modelling in Power BI Desktop: three fact tables, six dimensions and a measure table, related so that dates, customers, products, sellers, payment methods and order statuses filter the facts.' },
  { id: 'dax', title: 'DAX measures', text: 'KPI_Measures holds the measures: row counts and sums over the facts, then ratios built with DIVIDE and a zero fallback.' },
  { id: 'report', title: 'Power BI report', text: 'The Executive Overview page: six cards, a monthly trend filtered to complete months, a Top 10 category bar chart, an orders-by-status column chart and two slicers with cross-filtering.' },
]);

/* -------------------------------------------------------------- simulator */

/** Every change is HYPOTHETICAL. Zero everywhere reproduces the published baseline. */
export const DEFAULT_CHANGES = deepFreeze({ volumePct: 0, basketPct: 0, deliveryPoints: 0, onTimePoints: 0 });

/** Inclusive ranges; the delivery and on-time ceilings keep both rates below 100%. */
export const LIMITS = deepFreeze({
  volumePct: [-50, 50],
  basketPct: [-30, 30],
  deliveryPoints: [-15, 2.5],
  onTimePoints: [-25, 8],
});

export const INPUTS = deepFreeze([
  { key: 'volumePct', label: 'Order volume', unit: '%', step: 1, decimals: 0, description: 'Percentage change in the number of orders. Scales revenue and the order count.' },
  { key: 'basketPct', label: 'Average basket value', unit: '%', step: 1, decimals: 0, description: 'Percentage change in the average order value. Scales revenue and the average order value.' },
  { key: 'deliveryPoints', label: 'Delivery rate', unit: 'pts', step: 0.5, decimals: 1, description: 'Percentage-point change in the share of orders delivered.' },
  { key: 'onTimePoints', label: 'On-time delivery', unit: 'pts', step: 0.5, decimals: 1, description: 'Percentage-point change in the share of delivered orders that arrive on time.' },
]);

/** Hypothetical starting points for the simulator; none is a forecast. */
export const PRESETS = deepFreeze([
  { id: 'baseline', name: 'Published baseline', description: 'No change: the published figures.', changes: { volumePct: 0, basketPct: 0, deliveryPoints: 0, onTimePoints: 0 } },
  { id: 'peak', name: 'Peak-season push', description: 'More orders and slightly fuller baskets; logistics unchanged.', changes: { volumePct: 15, basketPct: 5, deliveryPoints: 0, onTimePoints: 0 } },
  { id: 'logistics', name: 'Logistics investment', description: 'Same demand, better delivery and punctuality.', changes: { volumePct: 0, basketPct: 0, deliveryPoints: 1.5, onTimePoints: 4 } },
  { id: 'slump', name: 'Demand slump', description: 'Fewer, smaller orders and a little more lateness.', changes: { volumePct: -12, basketPct: -3, deliveryPoints: 0, onTimePoints: -2 } },
  { id: 'premium', name: 'Premium mix', description: 'Fewer orders at a higher basket value.', changes: { volumePct: -5, basketPct: 12, deliveryPoints: 0, onTimePoints: 0 } },
]);

/** The scenario formulas as the page documents them; calculateScenario implements exactly these. */
export const FORMULAS = deepFreeze([
  { id: 'revenue', label: 'Scenario revenue', expression: 'R₁ = R₀ × (1 + v) × (1 + b)', note: 'R₀ is the published R$15.84M; v and b are the volume and basket changes as fractions.' },
  { id: 'aov', label: 'Scenario average order value', expression: 'A₁ = A₀ × (1 + b)', note: 'A₀ is the published R$159.33.' },
  { id: 'orders', label: 'Scenario orders', expression: 'N₁ = (R₀ ÷ A₀) × (1 + v)', note: 'R₀ ÷ A₀ ≈ 99,416 orders, consistent with the published "99K" and the exported 99,441; the result is approximate because R₀ is rounded.' },
  { id: 'delivered', label: 'Scenario delivery rate', expression: 'D₁ = D₀ + Δd', note: 'D₀ is the published 97.02%; Δd is in percentage points.' },
  { id: 'on-time', label: 'Scenario on-time rate', expression: 'T₁ = T₀ + Δt', note: 'T₀ is the published 91.88% of delivered orders; Δt is in percentage points.' },
  { id: 'on-time-all', label: 'On-time share of all orders', expression: 'D₁ × T₁', note: 'The on-time rate is conditional on delivery, so the two rates multiply.' },
  { id: 'counts', label: 'Order outcomes', expression: 'delivered = N₁ × D₁ · on time = delivered × T₁ · late = delivered − on time · not delivered = N₁ − delivered', note: 'Approximate counts, rounded for display.' },
]);

export const ASSUMPTIONS = deepFreeze([
  'Revenue scales with the product of the volume and basket factors: no price elasticity, no promotional cost and no cannibalisation are modelled.',
  'Delivery and on-time rates are moved directly in percentage points, independently of volume: capacity effects are not modelled.',
  'The on-time rate stays conditional on delivery, as the published measure defines it.',
  'Customer counts, product mix and the monthly profile are not projected, because the README publishes no basis for them.',
  'The baseline is the published rounded summary, so every scenario output inherits that rounding.',
]);

const KEYS = Object.keys(LIMITS);

/**
 * Validates hypothetical changes. Unknown settings and non-numeric values are
 * rejected; a missing setting means "no change"; every number must be finite
 * and inside its inclusive range.
 */
export function validateChanges(changes = DEFAULT_CHANGES) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
    throw new TypeError('Scenario changes must be an object');
  }
  for (const key of Object.keys(changes)) {
    if (!KEYS.includes(key)) throw new RangeError(`Unknown scenario setting: ${key}`);
  }
  const values = {};
  for (const key of KEYS) {
    const value = Object.hasOwn(changes, key) && changes[key] !== undefined ? changes[key] : DEFAULT_CHANGES[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${key} must be a finite number`);
    }
    const [min, max] = LIMITS[key];
    if (value < min || value > max) {
      throw new RangeError(`${key} must be between ${min} and ${max}`);
    }
    values[key] = value;
  }
  return values;
}

/** Clamps a number into a setting's range; non-finite input returns the default. */
export function clampChange(key, value) {
  if (!KEYS.includes(key)) throw new RangeError(`Unknown scenario setting: ${key}`);
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_CHANGES[key];
  const [min, max] = LIMITS[key];
  return Math.min(max, Math.max(min, value));
}

/**
 * HYPOTHETICAL projection from the published baseline. Revenue is scaled from
 * the published revenue anchor; orders are scaled from revenue ÷ average order
 * value; the two rates are shifted in points; on-time stays conditional on
 * delivered. Nothing here is a forecast or an observed result.
 */
export function calculateScenario(changes = DEFAULT_CHANGES) {
  const values = validateChanges(changes);
  const volumeFactor = 1 + values.volumePct / 100;
  const basketFactor = 1 + values.basketPct / 100;
  const multiplier = volumeFactor * basketFactor;
  const revenueBRL = PUBLISHED.revenueBRL * multiplier;
  const averageOrderBRL = PUBLISHED.averageOrderBRL * basketFactor;
  const orders = DERIVED.impliedOrders * volumeFactor;
  const deliveredPct = PUBLISHED.deliveredPct + values.deliveryPoints;
  const onTimeOfDeliveredPct = PUBLISHED.onTimeOfDeliveredPct + values.onTimePoints;
  const onTimeOfAllPct = (deliveredPct * onTimeOfDeliveredPct) / 100;
  const deliveredOrders = (orders * deliveredPct) / 100;
  const onTimeOrders = (deliveredOrders * onTimeOfDeliveredPct) / 100;
  return deepFreeze({
    changes: values,
    hypothetical: true,
    isBaseline: KEYS.every((key) => values[key] === 0),
    volumeFactor,
    basketFactor,
    multiplier,
    revenueBRL,
    revenueChangeBRL: revenueBRL - PUBLISHED.revenueBRL,
    revenueDeltaPct: (multiplier - 1) * 100,
    averageOrderBRL,
    averageOrderChangeBRL: averageOrderBRL - PUBLISHED.averageOrderBRL,
    orders,
    ordersChange: orders - DERIVED.impliedOrders,
    deliveredPct,
    onTimeOfDeliveredPct,
    onTimeOfAllPct,
    onTimeOfAllChangePoints: onTimeOfAllPct - DERIVED.onTimeOfAllPct,
    notDeliveredPct: 100 - deliveredPct,
    lateOfAllPct: deliveredPct - onTimeOfAllPct,
    deliveredOrders,
    onTimeOrders,
    lateOrders: deliveredOrders - onTimeOrders,
    undeliveredOrders: orders - deliveredOrders,
  });
}

/** The published baseline expressed in the scenario shape (all changes zero). */
export const BASELINE = calculateScenario(DEFAULT_CHANGES);

/* --------------------------------------------------------------- formatting */

const assertFinite = (value, what) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${what} must be a finite number`);
};
const group = (text) => text.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const MINUS = '−';

/** "R$15.84M" style, as the README prints revenue. */
export function formatMillionsBRL(amountBRL, decimals = 2) {
  assertFinite(amountBRL, 'Amount');
  const sign = amountBRL < 0 ? MINUS : '';
  return `${sign}R$${(Math.abs(amountBRL) / 1_000_000).toFixed(decimals)}M`;
}

/** "+R$2.38M" / "−R$1.10M" / "R$0.00M" for changes. */
export function formatSignedMillionsBRL(amountBRL, decimals = 2) {
  assertFinite(amountBRL, 'Amount');
  const rounded = round(amountBRL / 1_000_000, decimals);
  if (rounded === 0) return `R$0.${'0'.repeat(decimals)}M`;
  return `${rounded > 0 ? '+' : MINUS}R$${Math.abs(rounded).toFixed(decimals)}M`;
}

/** "R$159.33" style with thousands separators. */
export function formatBRL(amountBRL, decimals = 2) {
  assertFinite(amountBRL, 'Amount');
  const sign = amountBRL < 0 ? MINUS : '';
  const [whole, fraction] = Math.abs(amountBRL).toFixed(decimals).split('.');
  return `${sign}R$${group(whole)}${fraction ? `.${fraction}` : ''}`;
}

/** "99,441" style integers (rounded to the nearest whole number). */
export function formatInt(value) {
  assertFinite(value, 'Value');
  const rounded = Math.round(value);
  return `${rounded < 0 ? MINUS : ''}${group(String(Math.abs(rounded)))}`;
}

/** "+2,388" / "−1,105" / "0" for count changes. */
export function formatSignedInt(value) {
  assertFinite(value, 'Value');
  const rounded = Math.round(value);
  if (rounded === 0) return '0';
  return `${rounded > 0 ? '+' : MINUS}${group(String(Math.abs(rounded)))}`;
}

/** "99.4K" style, as the README rounds counts; below 1,000 the integer is shown. */
export function formatCompact(value, decimals = 1) {
  assertFinite(value, 'Value');
  const sign = value < 0 ? MINUS : '';
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000) return `${sign}${(magnitude / 1_000_000).toFixed(decimals)}M`;
  if (magnitude >= 1_000) return `${sign}${(magnitude / 1_000).toFixed(decimals)}K`;
  return `${sign}${Math.round(magnitude)}`;
}

/** "97.02%" style. */
export function formatPercent(value, decimals = 2) {
  assertFinite(value, 'Percentage');
  return `${value < 0 ? MINUS : ''}${Math.abs(value).toFixed(decimals)}%`;
}

/** "+3.2%" / "−1.0%" / "0.0%" for relative changes; values that round to zero are shown as zero without a sign. */
export function formatSignedPercent(value, decimals = 1) {
  assertFinite(value, 'Percentage');
  const rounded = round(value, decimals);
  if (rounded === 0) return `${(0).toFixed(decimals)}%`;
  return `${rounded > 0 ? '+' : MINUS}${Math.abs(rounded).toFixed(decimals)}%`;
}

/** "+1.5 pts" / "−2.0 pts" / "0.0 pts" for percentage-point changes. */
export function formatPoints(value, decimals = 1) {
  assertFinite(value, 'Points');
  const rounded = round(value, decimals);
  if (rounded === 0) return `${(0).toFixed(decimals)} pts`;
  return `${rounded > 0 ? '+' : MINUS}${Math.abs(rounded).toFixed(decimals)} pts`;
}
