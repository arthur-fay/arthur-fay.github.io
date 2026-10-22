# Arthur Fay — The Architect Lab

A responsive, accessible, dependency-free engineering portfolio served at **https://arthur-fay.github.io/** using GitHub Pages. It presents Arthur Fay, a backend software engineer (Python, FastAPI, PostgreSQL, SQL), through four public projects, an employment and education record, and a contact title block. The homepage is designed as a drafted monograph: numbered project plates with figures and captions, an interactive section cut through each system's architecture, an animated isometric system drawing in the hero, a title block of profile facts, a schedule-style record of experience and education, and title-block contact and footer blocks. See [docs/REDESIGN_2026-10.md](docs/REDESIGN_2026-10.md) for the redesign's audit, creative direction and measurements, and [docs/PROFILE_ALIGNMENT_2026-10.md](docs/PROFILE_ALIGNMENT_2026-10.md) for the professional-profile update, the résumé audit against the repositories, and the privacy decisions.

**Status:** The portfolio is served from `main` by GitHub Pages. New work is prepared on review branches and pull requests; the owner controls whether and when to merge, and merging into `main` publishes the change.

## Featured work

**01 · ATLAS — Decision Intelligence & Forecasting Research** ([source](https://github.com/arthur-fay/demand-forecasting-model)). Reproducible research software for NYC 311 demand forecasting, scientific evaluation, uncertainty analysis and HYPOTHETICAL mathematical optimization: a hash-verified snapshot of daily counts (2023-01-01 to 2026-06-30), seven models backtested at 822 rolling origins under a pre-registered protocol, a FastAPI service with 14 versioned endpoints and a committed OpenAPI 3.1 contract, a React 19 and TypeScript dashboard typed from that contract, and a systemd/nginx deployment package tested in a disposable container (not deployed). The homepage states the selected model's error reduction (28 % below seasonal naive, 11 % below the best simple baseline) only together with its qualification: the lead is not statistically established (Holm-adjusted p 0.054 against the baseline) and the prediction intervals have FAILED_CALIBRATION. The site does **not** host ATLAS's static dashboard, datasets, projections, or NYC-derived charts. The MIT license for original ATLAS source code is separate from NYC Open Data terms.

**02 · E-Commerce Executive Analytics Dashboard** ([source](https://github.com/arthur-fay/customer-revenue-analytics), [interactive lab](https://arthur-fay.github.io/lab/ecommerce/), [lab documentation](lab/ecommerce/README.md)). Real public SQL, Python/Colab, Power BI and DAX analytics project. The site's **E-Commerce Executive Analytics Lab** republishes the README's six rounded KPIs with the five DAX definitions it publishes, compares the two documented leading categories, runs a what-if simulator whose every output is labelled hypothetical, and walks through the documented dimensional model and the report wiring read from the published Power BI file. Every figure carries its provenance (published, exported, derived or hypothetical); no transaction, monthly value or customer record is reconstructed. Actual project files and screenshots remain in the source repository. The analytics engine is a pure module covered by unit tests; the page is covered by Playwright browser tests.

**03 · Interactive Robotics & Pathfinding Lab** ([live page](https://arthur-fay.github.io/lab/pathfinding/), [documentation](lab/pathfinding/README.md)). A working, dependency-free grid pathfinding laboratory: draw walls and weighted terrain, then run breadth-first search, Dijkstra's algorithm or A* with animated exploration, pause/step/stop controls, deterministic maze generation and measured results. It is explicitly a grid-based algorithm simulation, not a validated real-world robotics navigation system. The algorithms live in a pure module covered by unit tests; the page is covered by Playwright browser tests.

**04 · Security Event Detection & Investigation Lab** ([live page](https://arthur-fay.github.io/lab/security-events/), [documentation](lab/security-events/README.md)). A defensive, dependency-free, browser-only security monitoring simulator on **synthetic events only**: a seeded generator plants labelled scenarios (brute force, password spray, distributed failures, forgetful users, shared gateways, misconfigured clients) on top of routine sign-ins; three explainable sliding-window rules with configurable thresholds raise alerts; the timeline replays with play/pause/step/reset; every alert opens an investigation view; precision and recall are scored against the synthetic ground truth, and two threshold sets can be compared. Pseudonymous accounts, reserved documentation IP ranges, no real systems, no telemetry, strict schema for optional local JSON import. It is not a production SIEM and scores on synthetic scenarios do not establish real-world detection accuracy. The engine is a pure module covered by unit tests (including independent reference implementations of the rules); the page is covered by Playwright browser tests.

## Professional profile

The homepage follows the owner's **updated October 2026 résumé**. It identifies Arthur as a backend software engineer working with Python, FastAPI, PostgreSQL and SQL; presents résumé-level employment at Blue Sky Trading (Backend Software Engineer I, since March 2026) and 21st Ave Pharmacy & Medical Supply (Pharmacy Technician — Inventory Analysis & Data Processing, March 2020–December 2025); and keeps independent software projects separate from employment. The public résumé summary also describes more than five years of HIPAA-regulated data operations, source-tested ATLAS research, the interactive analytics lab and the automated portfolio test suite.

**Education reconciliation:** The new résumé lists **Capella University — B.S. Computer Science**, without a status or completion date, and omits the previously listed A.S. The website therefore omits the former expected-2027 date and A.S. listing. It retains **in progress** based on the owner's previous résumé and the existing professional profile to avoid suggesting a completed bachelor's degree. The owner should confirm that status; do not infer graduation from the latest PDF.

**Research boundaries:** ATLAS's measured model advantages were not robustly established statistically, its nominal 95% intervals failed calibration and optimization is hypothetical. The Ubuntu deployment package was tested in a disposable systemd container, not deployed to a production server. Technical counts, reports and API details are substantiated in their source repositories. The site does not restate unsupported degree completion or promise WCAG certification.

**Contact and privacy:** GitHub is the only public contact channel committed to this repository. The owner's phone number, personal e-mail, LinkedIn URL and raw résumé PDF have not been published. Public branches are visible before merging, and the site checker rejects phone numbers, e-mail addresses, `mailto:`/`tel:` links and unapproved external hosts. A downloadable résumé with contact details requires separate owner approval; updating the résumé-derived public *content* does not authorize posting its private PDF.

See [October résumé refresh](docs/RESUME_REFRESH_2026-10.md) for the change log, technical limitations, validation and the one remaining education-status confirmation.

## Architecture

- Plain semantic HTML + CSS + a small, dependency-free JavaScript enhancement file (`script.js`, shared across the portfolio and all lab pages: theme, mobile menu, filters, reading progress, the section-cut tabs, scroll reveals, the active navigation state and the hero drawing's pointer parallax). The custom 404 page uses local CSS and a restrictive Content Security Policy.
- The homepage's drawings are original inline SVG (the hero's isometric system section, the ATLAS pipeline plate, the dimensional-model plate) or regenerated from real lab runs by the tests (the two lab plates). The hero drawing is rendered deterministically by `scripts/hero-section.js` and a unit test checks that `index.html` carries exactly that markup and that its colour tokens keep the plates, edges and blocks distinguishable in both themes. No raster imagery is loaded by the page; `social-card.png` is a 1200 × 630 preview rendered from the same tokens and drawing by `scripts/social-card.js` (Playwright as a renderer only, installed outside the repository), palette-reduced with Pillow, and referenced only by the Open Graph and Twitter metadata.
- Design tokens live in the first two rule blocks of `styles.css` (dark-first, with a paper light theme) and are read by the contrast tests; the display, body and monospace faces are system font stacks, so no web fonts are requested.
- Every interaction degrades: the section cut shows all four panels in order without JavaScript, reveals never hide content, and all motion is disabled under `prefers-reduced-motion`.
- `lab/pathfinding/` is a second page built the same way: ES modules (`pathfinding.js` holds the pure algorithms, `app.js` the UI), its own stylesheet on top of the shared design tokens, and the same strict CSP. See [lab/pathfinding/README.md](lab/pathfinding/README.md).
- `lab/security-events/` is a third page with the same structure: `detection.js` is the pure engine (synthetic generator, strict event schema, sorting with deterministic tie-breaking, three streaming detection rules, evaluation, explanations), `app.js` the UI (SVG timeline, playback cursor, alerts, investigation view, paginated table, scores, comparison, local import/export), plus its own stylesheet and the same strict CSP. See [lab/security-events/README.md](lab/security-events/README.md).
- `lab/ecommerce/` is a fourth page with the same structure: `model.js` is the pure engine (the published and exported figures with their provenance, the derived arithmetic, the KPI, DAX, table and report definitions, the scenario formulas with validation, and the formatters), `app.js` the UI (SVG charts with hover and keyboard reading, the what-if simulator, the data-model explorer built from real buttons), plus its own stylesheet and the same strict CSP. See [lab/ecommerce/README.md](lab/ecommerce/README.md).
- Deliberately no React/Vite build step: **ready to publish and test with no npm dependencies or paid infrastructure**. `package.json` declares `"type": "module"` (so Node can import the ES modules in tests), the test scripts and metadata, and no dependencies.
- A hero that leads straight to the work: a primary "View projects" call to action, a plate index linking to each of the four case studies, and the section-cut explorer as the second path. Four real-project plates, the interactive section cut (an accessible tab interface with arrow-key navigation and deep links such as `/#cut-security`), working category filters (Engineering, Analytics, Interactive, Security), mobile navigation, theme toggle with user preference, accessible landmarks, skip link, reduced-motion support, custom 404 page and SEO/social metadata.
- No third-party scripts, analytics, forms, trackers, fonts, API credentials, or paid services.
- No remote resources are requested to render the site; outgoing links only go to GitHub.

## Preview locally

From the repository root, run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000` (portfolio), `http://localhost:8000/lab/ecommerce/` (analytics lab), `http://localhost:8000/lab/pathfinding/` (pathfinding lab) and `http://localhost:8000/lab/security-events/` (security lab). Avoid opening `file://` URLs: absolute asset paths and ES modules need an HTTP origin, as on GitHub Pages.

The shared header shows its full navigation from 1001 px up and the menu button below that (six primary links on the homepage no longer fit beside the wordmark and the actions on narrower screens); the header's GitHub button appears from 1181 px up so the navigation also fits wider system fonts.

## Checks and tests

```bash
npm test               # offline integrity checks (scripts/check_site.py), syntax checks, unit tests for all labs
npm run test:browser   # Playwright browser tests for the homepage (tests/browser/portfolio.test.js) and all three labs; see lab/pathfinding/README.md for the one-off setup
```

Continuous integration runs the same checks on every pull request (`.github/workflows/portfolio-ci.yml`).

## Publishing changes (OWNER APPROVAL REQUIRED)

The portfolio is already served from `main` by GitHub Pages. Changes to `main` can trigger a public deployment.

1. Create a review branch and pull request; keep `main` unchanged until the owner approves publication.
2. Inspect the PR diff and CI results. The CI workflow runs offline integrity/unit checks and Playwright browser tests.
3. Review all user-facing claims, project links, CSP changes and research boundaries. **Do not publish ATLAS's prepared static demo**, historical data, NYC-derived charts or hypothetical optimization outcomes through this repository.
4. After explicit owner approval, merge the reviewed PR and check the GitHub Pages deployment result.
5. Manually verify the live homepage, three lab pages, 404 page, mobile navigation, filters, theme control, keyboard interaction and outbound GitHub links. A green deployment is not a substitute for a live browser check.

**ATLAS remains an independent project with separate code licensing, NYC Open Data terms, statistical limitations, release decisions and scientific gates.** A portfolio update does not clear or modify those gates.

## Evidence-first recruiter navigation

The homepage links directly to the underlying material in addition to each project's summary:

| Project | Inspectable evidence | Boundaries |
| --- | --- | --- |
| ATLAS | [Source](https://github.com/arthur-fay/demand-forecasting-model), [backtesting protocol and results](https://github.com/arthur-fay/demand-forecasting-model/blob/main/docs/BACKTESTING.md), [release gate](https://github.com/arthur-fay/demand-forecasting-model/blob/main/docs/release/RELEASE_GATE.md) | Forecast improvements not robustly established; prediction intervals failed calibration; optimization hypothetical; static demo not published. |
| E-Commerce Analytics | [Interactive lab](https://arthur-fay.github.io/lab/ecommerce/), [analytics engine](lab/ecommerce/model.js), [methods and tests](lab/ecommerce/README.md), [project README with dashboard and data model](https://github.com/arthur-fay/customer-revenue-analytics/blob/main/README.md#dashboard-preview), [data model](https://github.com/arthur-fay/customer-revenue-analytics/blob/main/README.md#data-model) | The lab republishes only the README's rounded summary figures and the export's printed data labels, labelled by provenance; its scenarios are hypothetical. Actual screenshots and PBIX are in the project repository. |
| Pathfinding Lab | [Interactive lab](https://arthur-fay.github.io/lab/pathfinding/), [algorithm implementation](lab/pathfinding/pathfinding.js), [methods and tests](lab/pathfinding/README.md) | Grid-based demonstration, not validated physical robot navigation. |
| Security Events Lab | [Interactive lab](https://arthur-fay.github.io/lab/security-events/), [detection engine](lab/security-events/detection.js), [methods and tests](lab/security-events/README.md) | Synthetic-only educational demonstration, not a production SIEM or real-world accuracy study. |

See [the October 2026 recruiter-readiness audit](docs/PORTFOLIO_AUDIT_2026-10.md) for the reviewed scope, changes, unresolved gaps and validation plan, and [the profile alignment record](docs/PROFILE_ALIGNMENT_2026-10.md) for the résumé audit. Employment and education are stated as the owner provided them; no skills rating, personal contact method or performance figure is implied without supporting evidence.

## Edits to make next

- Decide whether to publish the LinkedIn URL and a professional e-mail address (see "Contact details" above); both are left out until then.
- Supply an optional portrait or a downloadable résumé only after deciding what personal information the public repository may hold.
- Update the record when a role, a degree or its expected date changes; the bachelor's degree is shown as in progress until it is conferred.
- Add future projects only after they have real source links and verifiable descriptions.
- Consider custom domain only if useful; it's optional and may cost money.

## Ownership & rights

Copyright © 2026 Arthur Fay for original portfolio text/design, to the extent owned. No open-source license for this **separate portfolio** is granted by this README. Each linked external repository or dataset retains its own licensing, terms and notices.