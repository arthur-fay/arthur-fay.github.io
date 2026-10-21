# Project 02 — E-Commerce Executive Analytics Lab (October 2026)

**Repository:** `arthur-fay/arthur-fay.github.io` · **Branch:** `feat/ecommerce-analytics-lab` · **Status:** review branch; nothing is published until the owner merges.

This document records what the lab was built from, the design decisions, what was measured, what the independent review found and what remains. It follows the same rule as the rest of the site: nothing is claimed that was not checked, and every figure on the new page carries its provenance. The lab's own documentation is [lab/ecommerce/README.md](../lab/ecommerce/README.md).

## 1. Sources inspected

The source project is the public repository [customer-revenue-analytics](https://github.com/arthur-fay/customer-revenue-analytics), checked at commit `795257de2a80f5118e62d5a2eb84cd063aeef283` on 21 October 2026 through a read-only clone.

| Source | What it contributed | What was deliberately not taken from it |
| --- | --- | --- |
| `README.md` | The six KPIs (99K orders, R$15.84M revenue, 96K customers, R$159.33 average order value, 97.02% delivery rate, 91.88% on-time delivery rate), the two leading categories (≈ R$1.44M and ≈ R$1.31M), the seven insight sentences, the ten documented tables, the five DAX measures quoted verbatim, the tool list | Nothing beyond what it states; "monthly revenue increased considerably" is quoted, not turned into numbers |
| `01 Raw Screenshots/Ecommerce_Executive_Dashboard.png` and `04 Exports/Ecommerce_Executive_Dashboard.pdf` | The data labels printed on two visuals: Orders by Status (96,478 / 1,729 / 1,234) and Top 10 Product Categories by Revenue (ten values printed to R$0.01M, one label truncated by the report itself); the slicer range 2016–2018 and the trend axis January 2017 to July 2018 | The monthly trend line, which prints no values and is therefore not redrawn |
| `01 Raw Screenshots/Ecommerce_Data_Model.png` | The column names visible in each table panel (partial, the panels are scrolled), the hidden `Value` column and four measure names of `KPI_Measures`, the many-side markers on the three fact tables and the one-side markers on the dimensions | Join keys, cardinalities, cross-filter directions and marker counts, which cannot be read reliably from the picture and are not stated in the README |
| `03 PBIX FILE/Ecommerce_Executive_Dashboard.pbix`, file `Report/Layout` inside the archive | Which measure or column each visual queries and the filters it applies (six cards, the trend filtered to `is_complete_analysis_month = 1`, the Top 10 filter, the status chart, the two slicers); two `dim_date` columns (`year`, `year_month`) that the layout queries but the scrolled model view does not show | The `DataModel` part of the archive is a binary database and was not parsed; nothing about relationships was inferred from it |

Three cross-checks tie the sources together and are shown on the page: 96,478 ÷ 99,441 = 97.02% (the published delivery rate), R$159.33 × 99,441 = R$15,843,935 (rounds to the published R$15.84M), and R$15.84M ÷ R$159.33 ≈ 99,416 (within 0.03% of the exported order total, the difference being the rounding of the revenue).

## 2. Design direction

The page keeps The Architect Lab's drafting-table language (numbered sections, monograph typography, hairline frames, the shared header and footer) and adds four conventions of its own:

- **Provenance badges.** Every tile and chart carries one word: Published, Exported, Derived or Hypothetical, drawn as a labelled chip with a small swatch (solid, dashed, grey or hatched). The hero's ledger counts what the page is built from: 6 KPIs, 2 categories, 5 DAX measures, 10 tables, 0 monthly values.
- **Hypothetical is hatched.** Simulator marks use an amber hue *and* a 45° hatch, and every simulator tile, chart and status message says "hypothetical", so the distinction never rests on colour alone.
- **Charts are code.** All six charts are SVG rendered from `model.js` at the container's measured width, with thin bars, rounded data ends, hairline axes, values at the tip, a legend whenever two series are present, a hover tooltip (a tap toggles it), keyboard reading of each mark and a table view. Label and value gutters are measured from the rendered text; below 460 px, or wherever a label would not fit beside its bar, labels move above the bars. Three measures of different scale are indexed to the baseline = 100 on one axis rather than drawn on two.
- **Validated colour.** The two chart hues were chosen from the site's own teal and amber families and validated with the data-visualization palette validator against both chart surfaces: dark `#2aa6bb` / `#bd8a2a` on `#131921` (worst colour-vision-deficiency pair ΔE 18.2, normal-vision 21.2, all checks pass), light `#0f8aa3` / `#a8761a` on `#fbfaf6` (ΔE 17.3 and 20.7, all checks pass). The site's original teal reads as grey under the chroma check and was therefore not used for marks.

## 3. What was built

- `lab/ecommerce/model.js` — the pure engine (no DOM): transcribed figures with provenance (columns seen in the model view kept apart from columns named only by the report layout), derived arithmetic, the KPI, DAX, table, visual, pipeline, preset, formula and assumption definitions, scenario calculation on integer indices with validation, a decimal rounding helper and formatters. Deeply frozen.
- `lab/ecommerce/index.html`, `lab.css`, `app.js` — the page: executive dashboard (six KPI tiles with DAX, four charts with their table rows also printed in the markup, the trend note), what-if simulator (four levers with typed twins, presets, reset, eight outputs, two charts, formulas and assumptions), data-model explorer (ten table buttons laid out as a diagram with connector lines, a detail card, the DAX lineage, the pipeline and the report wiring), methodology and engineering notes; `<noscript>` notes in the three interactive sections.
- Site integration: a prominent "Open the interactive analytics lab" link on plate 02, links in the section cut and the footer, the Interactive filter now including the plate, the ledger counting three labs, the sitemap, the offline checker, `package.json`, the CI workflow and the README.
- Tests: `tests/unit/ecommerce.test.js` (engine), `tests/unit/ecommerce-page.test.js` (markup equals engine, including the static table rows), `tests/unit/ecommerce-contrast.test.js` (tokens in both themes), `tests/browser/ecommerce.test.js` (Playwright at five widths in both themes, with and without JavaScript, with a touch screen); the pathfinding and security suites updated for the third interactive project.

Captures from the review environment (headless Chromium, Linux system fonts; the sticky header was unstuck for the section captures so the content is not covered):

| | |
| --- | --- |
| ![Executive dashboard, desktop, dark](ecommerce-lab-2026-10/desktop-dashboard-dark.png) | ![Executive dashboard, desktop, light](ecommerce-lab-2026-10/desktop-dashboard-light.png) |
| ![Simulator with the peak-season preset and a delivery change, desktop, dark](ecommerce-lab-2026-10/desktop-simulator-scenario-dark.png) | ![Simulator with the logistics preset, desktop, light](ecommerce-lab-2026-10/desktop-simulator-scenario-light.png) |
| ![Data-model explorer with fact_order_items selected](ecommerce-lab-2026-10/desktop-model-selected-dark.png) | ![DAX lineage cards, light](ecommerce-lab-2026-10/desktop-dax-light.png) |
| ![Hero, desktop, dark](ecommerce-lab-2026-10/desktop-hero-dark.png) | ![Homepage plate 02 with the lab link](ecommerce-lab-2026-10/homepage-plate-02-dark.png) |
| ![Top of the page on a phone, dark](ecommerce-lab-2026-10/mobile-top-dark.png) | ![Simulator with the demand-slump preset on a phone](ecommerce-lab-2026-10/mobile-simulator-scenario-dark.png) |
| ![Executive dashboard on a phone, light](ecommerce-lab-2026-10/mobile-dashboard-light.png) | |

## 4. Measurements

All numbers below were measured in the review environment (Linux, headless Chromium 141, Node 22, Lighthouse 13.5.0 installed outside the repository, pages served by a local static server) on the final state of the branch. They are not live-site measurements.

**Lighthouse**

| Page | Preset | Performance | Accessibility | Best practices | SEO | FCP | LCP | TBT | CLS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/lab/ecommerce/` | mobile, run 1 | 98 | 100 | 100 | 92 | 1.8 s | 2.0 s | 24 ms | 0 |
| `/lab/ecommerce/` | mobile, run 2 | 98 | 100 | 100 | 92 | 1.8 s | 2.0 s | 19 ms | 0 |
| `/lab/ecommerce/` | mobile, run 3 | 98 | 100 | 100 | 92 | 1.8 s | 2.0 s | 6 ms | 0 |
| `/lab/ecommerce/` | desktop | 100 | 100 | 100 | 92 | 0.5 s | 0.5 s | 0 ms | 0 |
| `/` | mobile | 100 | 100 | 100 | 92 | 1.4 s | 1.5 s | 0 ms | 0 |

Two performance regressions were found and removed on the way. The first mobile run of the lab scored 94 with 180 ms of total blocking time and a "forced reflow" insight: the chart pass read each frame's width and then wrote its SVG, alternating layout reads and writes; the pass was changed to read every width first. After the independent review, measuring the chart text (finding 4 below) forced one layout per chart again, and one mobile run scored 97 with 94 ms of blocking time. Chart drawing now runs in three phases per batch (build and stage every SVG, measure every text, lay out and mount), so a pass forces one layout; the forced-reflow insight passes on every run above. SEO is 92 on every page for the reason recorded for the redesign: Lighthouse's `robots-txt` audit fetches `robots.txt` from inside the page, which the strict Content Security Policy blocks, so the audit reports the file as invalid although it is valid and served. No accessibility or best-practices audit scored below 1 on any run.

**Transfer size (gzip, as GitHub Pages serves it)**

| File | Raw | Gzip |
| --- | ---: | ---: |
| `lab/ecommerce/index.html` | 53.2 KB | 12.6 KB |
| `lab/ecommerce/lab.css` | 25.7 KB | 5.4 KB |
| `lab/ecommerce/app.js` | 51.3 KB | 14.3 KB |
| `lab/ecommerce/model.js` | 33.2 KB | 9.6 KB |
| Page total with the shared `styles.css` (10.2 KB) and `script.js` (3.5 KB) | | ≈ 56 KB |

No image is loaded by the page; the charts are SVG built in the browser.

**Automated tests** (final run on the branch)

| Suite | Result |
| --- | --- |
| `python3 scripts/check_site.py` | passed (analytics lab: 33 links, 90 IDs) |
| `node --test tests/unit/*.test.js` | 192 passed, 0 failed (133 earlier + 59 new) |
| `node --test tests/browser/*.test.js` | 122 passed, 0 failed (90 earlier + 32 new) |

**Layout checks** (Playwright in both themes): no horizontal overflow, nothing cut off at either viewport edge, no chart text outside its chart and no console errors at 320, 375, 768, 1280 and 1920 px, before and after a scenario with the longest value labels; the simulator, the chart tooltips by hover, tap and keyboard, the table views, the model explorer, the theme toggle, the mobile menu, the reduced-motion state and the page without JavaScript were exercised by script, and the captures above were inspected by eye.

## 5. Independent review

An independent reviewer (a separate agent that took no part in the build) read every file of the lab in full, re-derived the figures from the source README, the three screenshots (with 2–3× crops), the PDF text layer and the decoded `Report/Layout` of the PBIX, swept the simulator's whole integer input space with exact rational arithmetic, probed the page with Playwright at 320 and 375 px (with and without JavaScript, by touch and by keyboard) and ran the suites three times. It reported twenty findings, most severe first. The first CI run of the pull request failed three browser tests at 320 px for the same reason as finding 4 (chart text 1.4 px past the viewport edge under the runner's fonts). Every finding was resolved on the branch; the table records the change and how it is now checked.

| # | Severity | Finding | Resolution | Checked by |
| --- | --- | --- | --- | --- |
| 1 | High | The relationship sentence counted markers wrongly: zoomed crops show many-side markers on all three fact tables (not two), five lines ending on `fact_order_items` (not four) and three one-side markers on `dim_date` (not two). | The sentence now states what the picture shows without counting: many-side markers on the three fact tables, one-side markers on the dimensions, more lines ending on `fact_order_items` than on any other table. The `fact_order_items` description, the page and the lab README changed with it. | The page text equals the engine text (page unit test). The crops are review material outside the repository, so the statement rests on the review; section 6 says so. |
| 2 | Medium | `year` and `year_month` were listed as columns seen in the model view, whose scrolled `dim_date` panel ends at `month_number`; the `KPI_Measures` list mixed four names visible there with six that are not, and omitted the visible `Average Review Score` and `Delivered Customers`. | Each table keeps `columnsSeen` (model view) apart from `columnsFromLayout` (report layout); the measure table lists `measuresSeen`; the detail card prints each under its own heading and its provenance paragraph names both sources; the unpublished-DAX card names the two extra measures. | Unit tests pin the split (`dim_date` alone has layout-only columns, exactly `year` and `year_month`; no name is in both lists) and resolve every visual field against both; browser tests read the headings and chip counts. |
| 3 | Medium | Binary floating point printed the wrong tenth on exact halves: +3% volume with +15% basket is exactly +18.45% but printed "+18.4%", the index for −15%/−15% (72.25) printed "72.2", and negative halves rounded the other way from positive ones. | The scenario multiplies integer indices, (100 + v)(100 + b), so the percentage change and the indices are exact decimals; `roundTo` rounds half away from zero from the shortest decimal representation and never returns a negative zero; every formatter uses it. | Unit tests with literal expectations (+18.5%, index 118.45 printed 118.5, 72.25 printed 72.3, −27.8%, 1.005 → 1.01, −2.5 → −3); a browser test reads +18.5% and 118.5 off the page. |
| 4 | Medium | At 320–375 px chart labels started up to 51 px left of the chart, several were cut by the card edge and a value label ran past the right edge; the clipping test looked only at the right edge and only before a scenario change. | Label and value gutters are measured from the rendered text; below 460 px, or wherever a label would not fit beside its bar, labels move above the bars and sublabels are dropped (the table view keeps them); sublabelled charts gained room beneath the last bar. | Browser tests flag either viewport edge and any chart text outside its SVG at five widths in both themes, before and after a scenario with the longest value labels. |
| 5 | Low | Without JavaScript the page showed "Loading the simulator…" forever, six empty chart frames and an empty explorer. | The status line says what needs JavaScript; `<noscript>` notes sit in the three interactive sections; the four published charts' table rows are printed in the markup. | A browser test with JavaScript disabled reads the tiles, opens the four tables, counts their rows and reads the notes; a page test keeps the static rows cell for cell equal to what the engine renders. |
| 6 | Low | The keyboard help said Page Up and Page Down move "ten steps"; Chromium moves by about a tenth of the range. | Reworded. | Page text. |
| 7 | Low | The bold-label cue for the two README categories never rendered: every label fell back to bold, so the Top 10 chart separated its two groups by colour alone. | Labels default to a plain class; only README-named rows are bold, and the legend says so. | Browser test: exactly two strong and eight plain labels. |
| 8 | Low | A fact table's detail listed all six KPI cards as "visuals using its fields", implying `fact_orders` feeds Total Revenue. | Fact tables reach visuals only through the published measures that read them, printed as "measure Total Orders"; `fact_cohort_retention` states that no published measure reads it. | Browser tests read both texts. |
| 9 | Low | Inferences worded as documentation: "Python notebooks", "star-shaped model", "one row per order". | The Colab stage says only what the README says; "dimensional model"; "the number of rows in fact_orders". | Page text equals the engine text. |
| 10 | Low | At the published baseline the simulator tiles printed unpublished order-level counts ("late ≈ 7,832") under the Hypothetical banner, beside "published baseline, no change". | Baseline tiles say "implied by R$15.84M ÷ R$159.33, not a published count" and "derived from the published rates and the implied order count, not a published figure"; "hypothetical" appears once a lever is non-zero. | Browser tests read the baseline and the scenario wording, with the literal "≈ 10,795". |
| 11 | Low | A focused chart lost focus and its tooltip when it was redrawn on resize. | The mount routine restores focus and the active mark on the new SVG. | Browser test: focus, arrow to the third mark, resize, same mark and tooltip, arrows still working. |
| 12 | Low | A tap showed no tooltip. | A tap or click toggles the tooltip for any pointer. | Browser test with a touch screen at 375 px. |
| 13 | Low | ARIA names on role-less `div`s, and the simulator controls in a complementary landmark with an `<h2>`. | `role="group"` on the diagram, `<section>` for the DAX and pipeline blocks, a `<section>` with an `<h3>` for the controls. | The accessible-name check now also flags an ARIA name on a role-less element. |
| 14 | Low | 9 px control labels, badges and captions; 28 px sliders. | Control labels 11 px; badges, captions and definition terms 10 px; sliders 34 px tall. | Contrast unit tests (tokens unchanged); the captures. |
| 15 | Nit | The average-order change printed without a sign beside signed neighbours. | A signed BRL formatter. | Browser scenario table. |
| 16 | Nit | `aria-valuetext` read "0%, hypothetical change" at the baseline. | "no change, published baseline". | Browser tests at baseline and after reset. |
| 17 | Nit | The diagram's JavaScript breakpoint (min-width 781 px) did not negate the stylesheet's (max-width 780 px). | The script uses the stylesheet's query. | Browser tests of the wide and phone layouts. |
| 18 | Nit | Overstated wording ("exact DAX definitions" where one KPI of six has none); a validator result cited without its inputs; a "Published" badge on the trend note whose facts come from the export and the layout. | "the five DAX definitions it publishes"; the README lists the colours, surfaces and ΔE values so the check can be repeated with any OKLab-based validator; the trend note is badged Exported. | Page and README text. |
| 19 | Nit | The element factory accepted any attribute; hovered marks at 82% opacity dipped below 3:1 in the light theme. | The factories refuse `style`, `on*`, `srcdoc`, `href`, `src`, `xlink:href`, `action` and `formaction`; hover is an outline only, with no opacity change. `img-src data:` stays in the policy because it is the site-wide policy; this page loads no image. | Contrast unit tests; the CSP browser test. |
| 20 | Tests | Tautologies (the index cell checked against the same expression the page uses; outcomes checked against module output) and gaps (half cases, literals, left-edge and post-scenario clipping, JavaScript off, bold labels, touch, focus, role-less ARIA). | Each gap above has a test; literal expectations were added for the baseline tiles, a scenario's order outcomes and the half-way case. | 192 unit and 122 browser tests. |

The reviewer also listed what it checked and found correct, which is unchanged: all six KPIs, both insight values, the ten exported labels and values (including the truncated "computers acce…" exactly as the PDF text layer prints it), the three status counts, the axis labels and slicer range, the five DAX measures verbatim, the ten table names, the report wiring against `Report/Layout` (no page- or report-level filters, so the exported figures are unfiltered totals), every derived figure by exact rational recomputation, every preset's displayed outputs, all 2,345 delivery and on-time combinations, and revenue, revenue change and average order value for all 6,161 volume and basket combinations; the security properties (no inline code, text nodes only, no network or storage APIs in the lab scripts, every outbound link on GitHub with `noopener noreferrer`); about 4 ms per slider event and no re-render while idle.

The three-phase chart drawing and the tests added after the review were not re-read by the reviewer; they are covered by the suites and the Lighthouse runs in section 4.

## 6. Remaining limitations

- The source publishes rounded figures only; every derived and hypothetical figure inherits that rounding, and the page says so where it matters.
- The exported category values are read from data labels printed to R$0.01M; one label is truncated in the export itself and is shown as printed rather than guessed.
- Three measures the dashboard uses (`Total Customers`, `Delivered Orders`, `On-Time Delivered Orders`) have no published DAX; they are listed as unpublished, and nothing is inferred about them. The model view also shows `Average Review Score` and `Delivered Customers`, which no published visual uses; they are named, not described.
- Column lists come from a scrolled model view and are partial; two `dim_date` columns are known only from the report layout; relationships are described only as the README describes them and as the model view's markers show, so the diagram draws documented filter paths, not joins. The sentence about the markers rests on a visual reading of the screenshot made during the review; no test can check it against the source.
- The simulator is linear and bounded by design: a reasoning aid, not a model of the business.
- Chart text is measured with the fonts available when a chart is drawn; the page uses system fonts only, so no late font swap can invalidate the measurement, and a resize redraws. The Content Security Policy keeps the site-wide `img-src 'self' data:` although this page loads no image.
- Lighthouse was run against a local static server, not the live deployment; `robots-txt` fails only because of that setup and should be re-checked after publication.
- Screen readers, Firefox, Safari and low-end devices were not exercised; the review used headless Chromium on Linux, so the system serif renders differently from macOS and Windows.

## 7. After merge

Verify on the live site: `/lab/ecommerce/` at a phone width and a desktop width in both themes, the homepage's three links to the lab, the Interactive filter, the simulator (a preset, a typed value, keyboard on a slider), one chart tooltip by hover, by tap and by arrow keys, one table selection in the model explorer, the outbound links to the source repository, the page with JavaScript disabled, and the 404 page for a wrong path under `/lab/`.
