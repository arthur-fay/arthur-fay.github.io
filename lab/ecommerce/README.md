# E-Commerce Executive Analytics Lab

Project 02 of [arthur-fay.github.io](https://arthur-fay.github.io/). Live page (after merge and deployment): `https://arthur-fay.github.io/lab/ecommerce/`.

An interactive, dependency-free companion to the author's public Power BI project, [customer-revenue-analytics](https://github.com/arthur-fay/customer-revenue-analytics). It presents the project's **six published KPIs** with the DAX measure behind each one, compares its **two documented leading categories**, runs a **what-if simulator** whose every output is labelled hypothetical, and walks through the **documented dimensional model**, the **DAX measures** and the **report wiring** that produce the executive dashboard. Everything is computed in the visitor's browser from figures transcribed into one pure module; nothing is fetched, stored or transmitted.

> **Scope statement.** The source project publishes rounded summary figures, two screenshots, a PDF export and the Power BI file. It does not publish a row-level dataset, a monthly series or customer records, and neither does this lab: no transaction, monthly value or customer observation is reconstructed, and every simulator output is a projection from stated assumptions, never a reported result or a forecast.

## Contents

1. [Purpose and limitations](#purpose-and-limitations)
2. [Provenance labels](#provenance-labels)
3. [Every figure on the page](#every-figure-on-the-page)
4. [The what-if simulator](#the-what-if-simulator)
5. [The data-model explorer](#the-data-model-explorer)
6. [Architecture](#architecture)
7. [Charts](#charts)
8. [Accessibility](#accessibility)
9. [Running locally](#running-locally)
10. [Reproducing the tests](#reproducing-the-tests)
11. [Known limitations](#known-limitations)
12. [Extending the lab](#extending-the-lab)

## Purpose and limitations

**Purpose.** Show, in a verifiable way, the analytics and business-intelligence work behind the original project: what each KPI means and how its DAX computes it, how the figures relate to each other, how the dimensional model and the measures feed the report, and how a decision-maker could reason about changes to the business with explicit, bounded assumptions. And show the engineering that makes that trustworthy: one source of truth for every number, provenance on every tile, tests that compare the page with the source.

**What the lab does**

- Presents the six KPIs from the README's KPI table with the README's own DAX for five of them, each with a definition and a caveat about its rounding.
- Compares the two product categories the README names, with derived shares of total revenue and the gap between them, and reproduces the full Top 10 chart as its data labels were printed in the export.
- Shows the exported orders-by-status counts and the cross-check that they reproduce the published delivery rate, and the derived split of all orders into on-time, late and not delivered.
- Recalculates a hypothetical scenario immediately when order volume, average basket value, delivery rate or on-time performance change, with presets, typed inputs, two charts and a table view, and documents the seven formulas and the assumptions behind them.
- Explains the ten documented tables, the columns visible in the published model view, the measures that read each table and the visuals that use its fields; quotes the DAX measures verbatim with their lineage; and lists the report page's visuals, fields and filters as read from the published `.pbix` file.
- Links every source: README sections, both screenshots, the annotated view, the Power BI file and the PDF export.

**What it does not do**

- It draws no monthly trend. The dashboard's line chart prints no data labels and the README gives no monthly values, so a redrawn curve would be invented.
- It reconstructs no transactions, no customer-level observations and no category beyond the ten printed in the export.
- It asserts no join key, cardinality or cross-filter direction: the README states which dimensions filter the facts, and the model-view screenshot shows markers, but column-level relationships are not published.
- It does not host the project's screenshots, data or Power BI file; those stay in the source repository and are linked.
- Its scenarios are arithmetic on the published baseline under explicit assumptions. They are not forecasts, not elasticity models and not statements about the business.

## Provenance labels

Every figure on the page carries one of four labels, in words and in colour:

| Label | Meaning | Where the figure comes from |
| --- | --- | --- |
| **Published** | Transcribed from the README | The KPI table, the "Key Business Insights" list, the DAX section, the data-model section |
| **Exported** | Transcribed from the data labels printed on the published report page | The PDF export `04 Exports/Ecommerce_Executive_Dashboard.pdf` and the screenshot the README embeds (orders by status; Top 10 categories by revenue) |
| **Derived** | Arithmetic on published or exported figures, with the operation shown | Shares, sums, products of rates, implied counts, cross-checks |
| **Hypothetical** | Simulator output: a projection from the stated assumptions | Never a reported result; hatched in the charts |

The lab was checked against commit `795257de2a80f5118e62d5a2eb84cd063aeef283` of the source repository on 21 October 2026. `SOURCE` in `model.js` records the commit, the date and every file link.

## Every figure on the page

| Figure | Value | Provenance |
| --- | ---: | --- |
| Total orders | 99K | Published (README KPI table) |
| Total revenue | R$15.84M | Published |
| Total customers | 96K | Published |
| Average order value | R$159.33 | Published |
| Delivery rate | 97.02% | Published |
| On-time delivery rate | 91.88% of delivered orders | Published |
| Health and beauty revenue | ≈ R$1.44M | Published (README insights) and exported (chart label) |
| Watches and gifts revenue | ≈ R$1.31M | Published and exported |
| Top 10 categories (ranks 3–10) | R$1.24M, R$1.16M, R$1.06M, R$0.90M, R$0.78M, R$0.72M, R$0.69M, R$0.58M | Exported (chart data labels, printed to R$0.01M; the fifth label is truncated in the export and kept as printed) |
| Orders by status: completed / open_or_incomplete / failed | 96,478 / 1,729 / 1,234 | Exported (chart data labels) |
| Exported order total | 99,441 | Derived: sum of the three status counts |
| Completed ÷ exported total | 97.02% | Derived; equals the published delivery rate to two decimals |
| Revenue ÷ average order value | ≈ 99,416 orders | Derived; within 0.03% of the exported total, the difference being the rounding of R$15.84M |
| Average order value × exported total | R$15,843,935 | Derived; rounds to the published R$15.84M |
| On time, as a share of all orders | 89.14% | Derived: 97.02% × 91.88% |
| Delivered late / not delivered | 7.88% / 2.98% | Derived: 97.02% − 89.14% and 100% − 97.02% |
| Category shares of revenue | 9.09% and 8.27% | Derived from the published revenues |
| Gap between the two leading categories | R$0.13M (+9.9%) | Derived |
| Sum of the ten exported categories | R$9.88M (62.4% of revenue) | Derived |
| Monthly revenue values | none | Not published; the lab describes the chart (axis January 2017 to July 2018, filtered to complete analysis months) and draws nothing |

The unit test `tests/unit/ecommerce-page.test.js` checks that the markup prints exactly these values and texts from `model.js`, and `tests/unit/ecommerce.test.js` checks the module against the README's KPI table, DAX text and table list quoted inside the test.

## The what-if simulator

Four hypothetical levers, each a slider with a typed twin:

| Lever | Symbol | Range | Effect |
| --- | --- | --- | --- |
| Order volume | v | −50% to +50%, step 1 | Scales revenue and the order count |
| Average basket value | b | −30% to +30%, step 1 | Scales revenue and the average order value |
| Delivery rate | Δd | −15 to +2.5 points, step 0.5 | Shifts the share of orders delivered |
| On-time delivery | Δt | −25 to +8 points, step 0.5 | Shifts the share of delivered orders that arrive on time |

Formulas, exactly as `calculateScenario()` implements them (R₀ = R$15.84M, A₀ = R$159.33, D₀ = 97.02%, T₀ = 91.88%):

- Scenario revenue `R₁ = R₀ × (1 + v) × (1 + b)`
- Scenario average order value `A₁ = A₀ × (1 + b)`
- Scenario orders `N₁ = (R₀ ÷ A₀) × (1 + v)` — approximate, because R₀ is rounded; R₀ ÷ A₀ ≈ 99,416 agrees with the published "99K" and the exported 99,441
- Scenario delivery rate `D₁ = D₀ + Δd`; scenario on-time rate `T₁ = T₀ + Δt`
- On-time share of all orders `D₁ × T₁` (the on-time rate is conditional on delivery)
- Order outcomes: delivered `= N₁ × D₁`, on time `= delivered × T₁`, late `= delivered − on time`, not delivered `= N₁ − delivered`

Assumptions, stated on the page: revenue scales with the product of the two factors (no elasticity, promotional cost or cannibalisation); the rates move independently of volume (no capacity effects); on-time stays conditional on delivery; customers, product mix and the monthly profile are not projected because the README gives no basis; the baseline is the rounded published summary, so every output inherits that rounding. The ranges keep every rate strictly below 100%.

Validation: unknown settings are rejected, non-numeric or non-finite values are rejected, out-of-range values are rejected by the engine and clamped by the interface (which also rounds typed values to the lever's step and says so). Only own properties of the settings object are read.

Presets ("Published baseline", "Peak-season push", "Logistics investment", "Demand slump", "Premium mix") are illustrative starting points, not scenarios the project studied.

## The data-model explorer

Three sources, each used only for what it states:

1. **The README's data-model section** lists three fact tables (`fact_orders`, `fact_order_items`, `fact_cohort_retention`), six dimensions (`dim_date`, `dim_customer`, `dim_product`, `dim_seller`, `dim_payment_method`, `dim_order_status`) and the measure table `KPI_Measures`, and states that the relationships "support filtering across dates, customers, products, sellers, payment methods, and order statuses".
2. **The model-view screenshot** `01 Raw Screenshots/Ecommerce_Data_Model.png` shows each table's column list (scrolled, so the lists are partial), the hidden `Value` column of the measure table, the one-side and many-side markers (many-side markers on the two transactional fact tables, four relationship lines ending on `fact_order_items`, two one-side markers on `dim_date`). Column names on the page are transcribed from it and labelled partial.
3. **The report layout inside the published `.pbix` file** (`Report/Layout`, a JSON document in the archive) names the measure or column each visual queries and the filters it applies: six card visuals on the six `KPI_Measures` measures; the line chart on `KPI_Measures.Total Revenue` by `dim_date.year_month` with a filter `dim_date.is_complete_analysis_month = 1`; the bar chart on `dim_product.product_category` with a Top 10 filter by Total Revenue; the column chart on `dim_order_status.status_group`; and two slicers on `dim_date.year` (between) and `dim_order_status.status_group`.

The diagram is built from real buttons (keyboard and pointer parity) with connector lines drawn behind them: solid lines are the documented filter paths from each dimension to the fact layer, dashed lines are the two tables the published DAX reads. No join key or cardinality is drawn, because none is published. Selecting a table shows its documented role, the columns seen, the published measures that read it and the dashboard visuals that query its fields, with a provenance note.

The five published DAX measures are quoted verbatim with their lineage (Average Order Value depends on Total Revenue and Total Orders; Delivery Rate % and On-Time Delivery Rate % depend on measures the README references without defining: Delivered Orders and On-Time Delivered Orders; Total Customers drives a card without a published definition).

## Architecture

```
lab/ecommerce/
├── index.html   page markup: shared header/footer, KPI tiles, chart cards, simulator, model explorer, method, engineering
├── lab.css      page styles built on the portfolio's design tokens (/styles.css); the first two rule blocks are colour tokens
├── app.js       UI module (ES module): SVG charts with hover and keyboard reading, simulator state, model explorer, table views
├── model.js     pure engine (ES module): published/exported figures with provenance, derived arithmetic, definitions, scenario formulas, validation, formatters
└── README.md    this document

tests/
├── unit/ecommerce.test.js            engine: README figures, DAX text, exported consistency, formulas by hand, boundaries, invalid input, definitions, formatting
├── unit/ecommerce-page.test.js       provenance: every figure and text printed in index.html equals model.js
├── unit/ecommerce-contrast.test.js   WCAG contrast of the lab's colour tokens in both themes
├── unit/helpers/css-colour.js        colour arithmetic shared with the other labs' contrast tests
└── browser/ecommerce.test.js         Playwright (Chromium) tests at 320, 375, 768, 1280 and 1920 px in both themes
```

Design decisions:

- **Dependency-free, like the rest of the portfolio.** Plain HTML/CSS/JS, ES modules, the same strict Content-Security-Policy (`default-src 'none'; script-src 'self'; style-src 'self'; …`), no inline code, no fonts, no analytics, no third-party code, no network access from the page.
- **Engine apart from rendering.** `model.js` has no DOM access and no side effects; its exports are deeply frozen. `app.js` renders only from the module's output and writes every text with `textContent`. The published figures in the markup are static (readable without JavaScript) and a unit test holds them equal to the module.
- **One shape for scenarios.** `calculateScenario()` returns a frozen object with the normalised changes, every projected figure and every change versus the baseline; `BASELINE` is the same shape with zero changes, so the interface compares like with like.
- **Charts are code, not pictures.** Each chart is drawn from the module's data at the container's measured width, so text keeps its size at every viewport; re-rendering is driven by a `ResizeObserver`.

## Charts

- Bars are thin (16–30 px), grow from one baseline with a 4 px rounded data end, and carry their value at the tip; gridlines and axes are solid hairlines one step off the surface.
- One colour per job: a saturated teal for published and exported marks, a neutral grey for exported-only bars in the emphasis chart, and an amber for hypothetical marks, which are additionally hatched so that published and hypothetical never differ by colour alone. The pair was validated for colour-vision deficiency separation and contrast in both themes with the data-visualization validator used during the review (CVD ΔE 17–18 in OKLab ×100, well above the 8 target); the contrast unit test keeps every mark at or above 3:1 against the chart surface and every in-segment ink at or above 4.5:1.
- Three measures of different scale (revenue, orders, average order value) are indexed to the published baseline = 100 and share one axis; there is no dual axis anywhere.
- Every chart has a hover tooltip, takes keyboard focus as one tab stop and reads each mark with the arrow keys through a live region, carries a legend whenever two series are present, and has a table view beneath it, so no value is reachable only by pointer or colour.

## Accessibility

- Native sliders with visible labels and typed twins; `aria-valuetext` reads each change as "+15%, hypothetical change"; typed values are clamped and rounded with an explanation in the status region; invalid input marks the field `aria-invalid` and keeps the previous value.
- Presets and model tables are real buttons with `aria-pressed`; activating a table from the keyboard moves focus to the detail card.
- A `role="status"` region announces scenario changes on `change` (not on every slider tick), presets, resets and clamping.
- Charts: `role="group"` SVGs with an accessible name that states the arrow-key instruction, tooltip text in a polite live region, legends, and table views with captions and column headers.
- Provenance is carried in words ("Published", "Exported", "Derived", "Hypothetical") and hatching as well as colour; contrast of every token pair used is tested in both themes.
- No motion is started by the page; transitions are disabled under `prefers-reduced-motion`.
- Touch targets of the primary controls are at least 40 px tall; the page has no horizontal overflow from 320 px up, verified by the browser tests.

## Running locally

No build step and no installation. From the repository root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/lab/ecommerce/
```

Any static server works. Do not open the file with a `file://` URL: ES modules and absolute asset paths require an HTTP origin, exactly as on GitHub Pages.

## Reproducing the tests

Requirements: Node.js 20 or newer and Python 3.

```bash
npm test               # static integrity checks + syntax checks + unit tests (all labs)
npm run test:unit      # node --test tests/unit/*.test.js
```

The unit suites cover: every README figure and the DAX text quoted verbatim inside the test; the internal consistency of the exported figures (status sum, delivery-rate cross-check, rounding agreement between revenue, average order value and the order total); the derived figures; the scenario formulas on hand-computed cases, multiplicativity and the separation of the four levers, additivity of outcomes; every limit inclusively and the values just outside each; every class of invalid input (non-objects, unknown settings, non-numbers, non-finite numbers, inherited properties); clamping and stepping; the KPI, DAX, table, visual, pipeline, preset, formula and assumption definitions and their cross-references; immutability; the formatters including signed zero and non-finite input; the page's provenance against the module; and the colour tokens' contrast in both themes.

Browser tests (Playwright, Chromium) run the page at 320 × 568, 375 × 667, 768 × 1024, 1280 × 800 and 1920 × 1080 in both themes and check: no console errors, failed requests or cross-origin requests; no horizontal overflow and nothing cut off at the viewport edge; no duplicate ids; an accessible name on every control; the content security policy blocking injected inline code; the KPI tiles, DAX and all four dashboard charts against the module; hover tooltips and arrow-key reading; the simulator's outputs equal to `calculateScenario()` for slider, typed, keyboard, preset and reset changes, including clamping, rounding, invalid input and the hypothetical labelling; chart re-rendering on resize; the model explorer by pointer and keyboard, its connector lines on wide screens and their absence on phones; theme switching and persistence; reduced motion; the mobile menu; the skip link; internal and outbound links; and the homepage's Project 02 links to the lab with the Interactive filter now showing three projects.

```bash
# one-off local setup outside the repository (no dependency is added to the site)
mkdir -p /tmp/playwright && cd /tmp/playwright && npm init -y && npm install playwright@1.56.1 && npx playwright install --with-deps chromium
cd -  # back to the repository
NODE_PATH=/tmp/playwright/node_modules npm run test:browser
```

Continuous integration (`.github/workflows/portfolio-ci.yml`) runs the static checks, syntax checks and unit tests on every pull request, then installs Playwright in the runner's temporary directory and runs the browser tests for the homepage and all three labs.

## Known limitations

- The README publishes rounded figures only, so every derived and hypothetical figure inherits that rounding; the page says so where it matters (for example R$15.84M ÷ 99,441 = R$159.29 against the published R$159.33).
- The exported category values are printed to R$0.01M and one label is truncated in the export itself; both facts are shown rather than corrected.
- The `Total Customers`, `Delivered Orders` and `On-Time Delivered Orders` measures are used by the dashboard but their DAX is not published; the lab lists them as unpublished and does not guess their definitions.
- Column lists come from a scrolled model view and are therefore partial; relationships are described only as the README describes them.
- The simulator is deliberately linear and bounded. It is a reasoning aid, not a model of the business.
- Screen readers, Firefox and Safari were not exercised in the review environment, which used headless Chromium.

## Extending the lab

- **Add a lever**: add it to `LIMITS`, `DEFAULT_CHANGES` and `INPUTS` in `model.js`, use it in `calculateScenario()`, document it in `FORMULAS` and on the page, add its slider and typed twin to `index.html` and to `LEVER_IDS` in `app.js`, and extend the boundary, invalid-input and hand-computed tests.
- **Add a published figure**: transcribe it into `PUBLISHED` or `EXPORTED` with its provenance, print it in the markup with a provenance badge, and add it to the page provenance test and the figure table above.
- **Add a chart**: render it from the module in `app.js` with `horizontalBars()` or `stackedRows()` (marks, tooltips, keyboard reading and a legend come for free), give it a table view, and keep every mark at or above 3:1 against the surface (the contrast test reads the tokens).
- **Another lab page**: create `lab/<name>/` with its own `index.html`, add it to `sitemap.xml`, to `REQUIRED` in `scripts/check_site.py` and as a card in `index.html`.
