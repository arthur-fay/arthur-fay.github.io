# The Architect Lab — homepage redesign (October 2026)

**Repository:** `arthur-fay/arthur-fay.github.io` · **Branch:** `claude/arthur-fay-portfolio-redesign-fk9r2h` · **Status:** review branch; nothing is published until the owner merges.

This document records the audit, the creative direction, what changed, what was measured and what remains. It is the companion to the pull request and follows the same rule as the rest of the site: nothing is claimed that was not checked.

## 1. Audit of the previous homepage

What already worked and was kept: honest content with research boundaries on every project; direct evidence links; a dependency-free HTML/CSS/JS architecture with a strict Content Security Policy, no fonts, no trackers; CI with offline integrity checks, unit tests and Playwright tests at four viewports; a theme toggle, mobile navigation, project filters, a skip link, reduced-motion support; and card artwork for both labs that is regenerated from real runs by the test suite.

What held the design back:

- Typography set at 9–12 px for most body copy and labels, so the page read as cramped and template-like; the display face (Georgia) carried all the hierarchy.
- The hero's visual was a decorative mock dashboard ("SYSTEM STATUS", orbit rings, pipeline panels) next to a giant letter — exactly the kind of fake operational UI the brief rules out.
- The summary strip mixed a licence ("MIT") with counts, and said little.
- Every project used the same card; ATLAS was a giant glyph and the analytics project a fake bar chart. The problem, architecture, evidence and limits were not structured.
- No section reveals, no active navigation state, a plain dropdown mobile menu and a light theme that was an afterthought.
- No social-sharing image.

## 2. Creative direction

Three directions were explored before any code changed:

| Direction | Idea | Verdict |
| --- | --- | --- |
| A. Drafting table | Architectural drawing conventions: plates, section marks, dimension lines, title blocks, hatching, isometric drawings. | Strong tie to "The Architect Lab"; honest, because a drawing of an architecture is not a fake dashboard. Risk of cliché if overdone with blueprint blue. |
| B. Instrument panel | Oscilloscope traces, dials, phosphor glow. | Rejected: drifts straight into fake dashboards and glowing gradients. |
| C. Editorial monograph | Large serif typography, generous whitespace, numbered figures with captions, footnote-style disclosures. | Premium and readable, but too quiet alone for an engineering portfolio. |

**Chosen: A fused with C, "The Architect's Monograph".** Projects are *plates* with numbered figures and captions; the signature interaction is a *section cut* through each system; the hero is an animated isometric *system section*; the footer and contact card are *title blocks*. The palette keeps the existing identity (graphite ink, warm paper text, the chartreuse pen accent used by the favicon) and adds a vellum light theme. Type is set from system font stacks only (no web fonts, by policy): a Charter/Palatino-class serif for display, the platform sans for copy and a monospace for annotations, with body copy at 15–19 px instead of 9–12 px.

## 3. What changed

### Homepage (`index.html`, `styles.css`, `script.js`)

- **Hero.** Typographic composition (an outlined "Systems", a pen-coloured "work") over a drafting grid, with "Fig. 00 — System section": an original isometric SVG of five plates (data, models, evaluation, interface, evidence) that draws itself in with `stroke-dashoffset`, carries a slow marching flow line, and shifts by depth under a fine pointer. It is captioned as a conceptual drawing, not a live dashboard, and has an accessible title and description. On phones the SVG keeps its geometry and the HTML legend carries the labels.
- **Navigation.** Numbered links with an active-section indicator (IntersectionObserver), a refined mobile menu (large serif links, focus moved into the menu, Escape returns focus), a drafted monogram wordmark shared by all three pages.
- **Ledger.** Four honest facts: 04 projects, 02 labs, 00 frameworks/fonts/trackers, 3 layers of automated checks.
- **Signature interaction: the section cut (`#systems`).** An accessible tab interface (`role="tablist"`, roving `tabindex`, arrow keys, Home/End, deep links such as `#cut-security`) over four panels. Each panel is a six-layer cross-section of one project, from interface down to verification, with the technologies per layer, onward links and the project's boundary statement. Without JavaScript the tabs disappear and the four panels read in order; the content is plain HTML, so nothing is generated at runtime.
- **Plates (`#work`).** The four projects are case studies with a numbered figure, caption, problem, architecture, evidence (deep links), limits, technologies and links. ATLAS gets a conceptual pipeline drawing of milestones M0–M9 that keeps the `FAILED_CALIBRATION` finding visible; the analytics project gets an illustrative dimensional-model drawing with the SQL → Python → DAX → Power BI toolchain; the two labs keep their provenance-tested artwork (the exact SVG paths the unit tests regenerate from real runs).
- **Detail sheet, method, about, contact, footer.** Restyled in the same language. The method cards use original line glyphs. The about section states explicitly that no employment, degrees, certifications or awards are claimed. The contact title block lists the four verified GitHub channels only.
- **Motion.** Section reveals, the hero draw-in and flow, tab-panel stagger, hover states and a flowing line on plate drawings — all disabled under `prefers-reduced-motion`, and content is never hidden without JavaScript.
- **Metadata.** Title, description and Open Graph/Twitter cards updated; a self-rendered `social-card.png` (1200 × 630, 50 KB, drawn from the site's own design system) replaces the text-only preview.

### Shared pages

- `lab/pathfinding/` and `lab/security-events/` inherit the new header, type scale, buttons and sections through the shared stylesheet; their own stylesheets now use the shared font tokens. Their range sliders can now shrink below the browser's intrinsic slider width, which stops the security lab's timeline toolbar being cut off by 5 px at 320 px (pre-existing). Three `<dl>` elements that carried `role="group"` are wrapped in a labelled group instead so the lists keep their list semantics (an axe `dlitem` finding), the footer link names now include their visible text (axe `label-content-name-mismatch`), and the light-theme failure ink in the security lab was deepened to `#a3471f` because its small text measured 4.07:1 on the new paper tone. Lab logic, controls and tests are untouched.
- `404.html` / `404.css` restyled; `favicon.svg` redrawn as the new monogram.

### Tests

- `tests/browser/portfolio.test.js` (new, 27 tests): layout integrity at 320/375/768/1280/1920 in both themes with no overflow, no clipped headings and no element cut off at the viewport edge (the page shell clips, so `scrollWidth` alone cannot see that), the same clipping check for both labs and the 404 page at 320 and 375 px, the sticky header; the section cut's wiring, click and keyboard behaviour, roving tab stop and deep links; the no-JavaScript fallback; reduced-motion behaviour; the hero drawing's accessibility and animation completion; active navigation; the mobile menu's focus handling; theme switching and persistence; the social card's existence and dimensions; the skip link and control names.
- All existing checks still pass unchanged: `scripts/check_site.py`, 121 unit tests (including the contrast tests against the new tokens and the provenance tests for the lab artwork) and the 57 existing browser tests.
- The analytics plate's drawing and copy use the table names documented in the project's own README (`fact_orders`, `fact_order_items`, `fact_cohort_retention`; `dim_date`, `dim_customer`, `dim_product`, `dim_seller`, `dim_payment_method`, `dim_order_status`; `KPI_Measures`), checked against a read-only clone of that repository during the review. No figures from it are repeated.

## 4. Measurements

All numbers below were measured in this review environment (Linux, headless Chromium 141, Node 22, Lighthouse 12.8.2 installed outside the repository, pages served by the repository's own static test server). They are not live-site measurements.

**Lighthouse (final run, after the accessibility fixes)**

| Page | Preset | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | mobile (3 isolated runs, identical) | 100 | 100 | 100 | 92 | 1.4 s | 0 | 0 ms |
| `/` | desktop | 100 | 100 | 100 | 92 | 0.4 s | 0 | 0 ms |
| `/lab/pathfinding/` | mobile | 100 | 100 | 100 | 92 | 1.5 s | 0 | 10 ms |
| `/lab/security-events/` | mobile | 98 | 100 | 100 | 92 | 2.0 s | 0 | 80 ms |

One homepage mobile run taken while screenshot captures were running on the same machine scored 81 with 800 ms of total blocking time; the three runs taken on an idle machine all scored 100 with 0 ms, so the outlier is machine contention, not the page. The SEO score is 92 on every page for one reason: Lighthouse's `robots-txt` audit fetches `robots.txt` from inside the page, and the strict CSP blocks that request, so the audit reports the file as invalid although it is valid and served correctly. The `bf-cache` audit fails only because the local test server sends `Cache-Control: no-store`. The first run (before the fixes in this branch) had scored 97/100/100/92 on `/` mobile and 97/93/100/92 on the security lab; the three findings it surfaced (footer and wordmark link names, `<dl>` elements with `role="group"`, and 4.07:1 failure-coloured text in the light security lab) are fixed here.

**Transfer size (gzip, as GitHub Pages serves it)**

| File | Before | After |
| --- | ---: | ---: |
| `index.html` | 7.5 KB | 15.0 KB |
| `styles.css` | 6.2 KB | 9.7 KB |
| `script.js` | 1.5 KB | 3.3 KB |
| Page total (no images are loaded by the page) | ≈ 15 KB | ≈ 28 KB |
| `social-card.png` (crawlers only) | — | 49 KB |

**Automated tests**

| Suite | Result |
| --- | --- |
| `python3 scripts/check_site.py` | passed (61 links, 41 IDs on the homepage) |
| `node --test tests/unit/*.test.js` | 121 passed, 0 failed |
| `node --test tests/browser/*.test.js` | 84 passed, 0 failed (57 existing + 27 new) |

**Layout checks** (Playwright screenshots in both themes): no horizontal overflow and no console errors at 320, 375, 768, 1280 and 1920 px on the homepage; both labs and the 404 page rendered at 1280 and 375 px with the shared stylesheet; the mobile menu, the section cut (click, arrows, Home/End, deep link), the filters, the theme toggle, the no-JavaScript fallback and the reduced-motion state were exercised by script and inspected.

**Colour contrast**: the unit contrast suite evaluates the new tokens in both themes (text, muted text, accent, labels and lab-specific colours at 4.5:1 for text and 3:1 for graphics). Lighthouse's axe pass reports no contrast failures on any page in the final run.

## 5. Independent review

An adversarial review was run as a separate pass (accessibility, security, mobile usability, performance, factual integrity and regressions, with its own Playwright and Lighthouse runs). Its findings and what was done:

| Severity | Finding | Resolution |
| --- | --- | --- |
| High | `.site-shell{overflow:hidden}` made the shell a scroll container, so `position:sticky` on the header never engaged (pre-existing on `main`; the redesign's sticky tab rail and blurred header depended on it). | `overflow:clip` on the shell. The header and the section-cut rail now stick; a browser test asserts the header stays at the top after scrolling. |
| Medium | Plate drawing labels rendered at 3.6–4.3 px on phones. | Primary labels enlarged; all drawing text is hidden below 600 px, where the figure captions and plate copy carry the content. |
| Medium | "Artificial intelligence" appears as a field although the four projects are forecasting, business intelligence, graph search and rule-based detection. | Kept as a field of work because the brief for this redesign lists it; it is presented as a field, not a credential. Flagged in the pull request for the owner's decision. |
| Medium | About a fifth of the homepage's characters were 10–11 px monospace labels. | Label floor raised to 11 px (12 px for the filter buttons and footer note); body copy was already 15–19 px. |
| Medium | Security lab timeline toolbar cut off by ~5 px at 320 px (pre-existing). | Sliders may shrink; a browser test now checks both labs and the 404 page for clipped elements at 320 and 375 px. |
| Medium | The analytics drawing invented dimension names. | Redrawn from the repository's documented data model (see above); copy aligned with that README. |
| Low | Tablist orientation; CSS counters inside link names; the faded tab strip hiding the last tab at scroll end; `will-change` on SVG groups, an infinite animation while off-screen and a large backdrop blur; small header targets; the 404 page lacking an icon link and a light theme; the labs' stale `theme-color`; wording slightly beyond the sources for the ATLAS service and demo. | All addressed: `aria-orientation` follows the layout; numerals are hidden spans; the strip has end padding under the fade; `will-change` and the figure blur removed and the flow line pauses off-screen; header controls are 42 px; the 404 page has an icon and follows the system colour scheme without JavaScript; `theme-color` updated; wording trimmed to what the sources say. |
| Low | Hairline borders are below 3:1 against their backgrounds. | Left as is: icons and text carry the affordance; noted here. |
| Nit | "3×" could be announced as "3"; the same arrow marked new-tab and same-tab links; dead selectors. | "03"; same-tab lab links use a horizontal arrow; dead rules removed. |

Checked by the review and found fine: no overflow at any viewport or theme on all pages, CLS 0, text contrast at or above 4.5:1 for every token pair in both themes, heading order, landmarks, focus order, hidden-panel semantics, keyboard operation of the section cut, deep links, the mobile menu's focus handling, reduced-motion guards, CSP compliance (inline injection attempts were blocked), link policy, and every required disclaimer. Not verified by the review: screen readers, Firefox and Safari.

## 6. Remaining limitations

- Lighthouse was run locally against the repository's static test server, not against the live GitHub Pages deployment. Two audits fail only because of that setup: `bf-cache` (the test server sends `Cache-Control: no-store`) and `robots-txt` (Lighthouse fetches `robots.txt` from inside the page, which the strict CSP blocks; the file itself is valid). These should be re-checked on the live site after publication.
- Screen-reader, Firefox, Safari and low-end-device testing were not performed in this environment; the review used headless Chromium.
- The e-commerce figure is an illustrative drawing of a dimensional model, not the project's actual model; the real screenshots and data model remain in the project repository, as before.
- System font stacks render differently per platform (Charter/Palatino-class serif on macOS and Windows, a fallback serif elsewhere); screenshots here were rendered on Linux.
- No contact channel other than GitHub exists in the repository's records, so none was added.
- The security lab's timeline toolbar leaves a tall gap above the speed slider on phones; this layout is unchanged from the previous design and is outside the homepage redesign.
