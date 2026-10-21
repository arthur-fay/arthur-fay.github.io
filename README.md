# Arthur Fay — The Architect Lab

A responsive, accessible, dependency-free engineering portfolio served at **https://arthur-fay.github.io/** using GitHub Pages. The homepage is designed as a drafted monograph: numbered project plates with figures and captions, an interactive section cut through each system's architecture, an animated isometric system drawing in the hero, and title-block contact and footer blocks. See [docs/REDESIGN_2026-10.md](docs/REDESIGN_2026-10.md) for the audit, the creative direction, the measurements and the remaining limitations.

**Status:** The portfolio is served from `main` by GitHub Pages. New work is prepared on review branches and pull requests; the owner controls whether and when to merge, and merging into `main` publishes the change.

## Featured work

**01 · ATLAS — Decision Intelligence & Optimization Engine** ([source](https://github.com/arthur-fay/demand-forecasting-model)). Research software for historical NYC 311 demand forecasting, scientific evaluation, uncertainty analysis, and HYPOTHETICAL mathematical optimization. The site does **not** host ATLAS's static dashboard, datasets, projections, or NYC-derived charts. Its forecasting advantage is not robustly established and its prediction intervals have FAILED_CALIBRATION. The MIT license for original ATLAS source code is separate from NYC Open Data terms.

**02 · E-Commerce Executive Analytics Dashboard** ([source](https://github.com/arthur-fay/customer-revenue-analytics)). Real public SQL, Python/Colab, Power BI and DAX analytics project. Actual project files and screenshots remain in the source repository. The site uses generic decorative charts only, not republished source data.

**03 · Interactive Robotics & Pathfinding Lab** ([live page](https://arthur-fay.github.io/lab/pathfinding/), [documentation](lab/pathfinding/README.md)). A working, dependency-free grid pathfinding laboratory: draw walls and weighted terrain, then run breadth-first search, Dijkstra's algorithm or A* with animated exploration, pause/step/stop controls, deterministic maze generation and measured results. It is explicitly a grid-based algorithm simulation, not a validated real-world robotics navigation system. The algorithms live in a pure module covered by unit tests; the page is covered by Playwright browser tests.

**04 · Security Event Detection & Investigation Lab** ([live page](https://arthur-fay.github.io/lab/security-events/), [documentation](lab/security-events/README.md)). A defensive, dependency-free, browser-only security monitoring simulator on **synthetic events only**: a seeded generator plants labelled scenarios (brute force, password spray, distributed failures, forgetful users, shared gateways, misconfigured clients) on top of routine sign-ins; three explainable sliding-window rules with configurable thresholds raise alerts; the timeline replays with play/pause/step/reset; every alert opens an investigation view; precision and recall are scored against the synthetic ground truth, and two threshold sets can be compared. Pseudonymous accounts, reserved documentation IP ranges, no real systems, no telemetry, strict schema for optional local JSON import. It is not a production SIEM and scores on synthetic scenarios do not establish real-world detection accuracy. The engine is a pure module covered by unit tests (including independent reference implementations of the rules); the page is covered by Playwright browser tests.

No professional employment history, degrees, LinkedIn URL, email address, or awards are asserted or fabricated. Add them after verifying details and obtaining consent to publish contact information.

## Architecture

- Plain semantic HTML + CSS + a small, dependency-free JavaScript enhancement file (`script.js`, shared across the portfolio and both lab pages: theme, mobile menu, filters, reading progress, the section-cut tabs, scroll reveals, the active navigation state and the hero drawing's pointer parallax). The custom 404 page uses local CSS and a restrictive Content Security Policy.
- The homepage's drawings are original inline SVG (the hero's isometric system section, the ATLAS pipeline plate, the dimensional-model plate) or regenerated from real lab runs by the tests (the two lab plates). No raster imagery is loaded by the page; `social-card.png` is a self-rendered 1200 × 630 preview referenced only by the Open Graph and Twitter metadata.
- Design tokens live in the first two rule blocks of `styles.css` (dark-first, with a paper light theme) and are read by the contrast tests; the display, body and monospace faces are system font stacks, so no web fonts are requested.
- Every interaction degrades: the section cut shows all four panels in order without JavaScript, reveals never hide content, and all motion is disabled under `prefers-reduced-motion`.
- `lab/pathfinding/` is a second page built the same way: ES modules (`pathfinding.js` holds the pure algorithms, `app.js` the UI), its own stylesheet on top of the shared design tokens, and the same strict CSP. See [lab/pathfinding/README.md](lab/pathfinding/README.md).
- `lab/security-events/` is a third page with the same structure: `detection.js` is the pure engine (synthetic generator, strict event schema, sorting with deterministic tie-breaking, three streaming detection rules, evaluation, explanations), `app.js` the UI (SVG timeline, playback cursor, alerts, investigation view, paginated table, scores, comparison, local import/export), plus its own stylesheet and the same strict CSP. See [lab/security-events/README.md](lab/security-events/README.md).
- Deliberately no React/Vite build step: **ready to publish and test with no npm dependencies or paid infrastructure**. `package.json` declares `"type": "module"` (so Node can import the ES modules in tests), the test scripts and metadata, and no dependencies.
- Four real-project plates, the interactive section cut (an accessible tab interface with arrow-key navigation and deep links such as `/#cut-security`), working category filters (Engineering, Analytics, Interactive, Security), mobile navigation, theme toggle with user preference, accessible landmarks, skip link, reduced-motion support, custom 404 page and SEO/social metadata.
- No third-party scripts, analytics, forms, trackers, fonts, API credentials, or paid services.
- No remote resources are requested to render the site; outgoing links only go to GitHub.

## Preview locally

From the repository root, run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000` (portfolio), `http://localhost:8000/lab/pathfinding/` (pathfinding lab) and `http://localhost:8000/lab/security-events/` (security lab). Avoid opening `file://` URLs: absolute asset paths and ES modules need an HTTP origin, as on GitHub Pages.

## Checks and tests

```bash
npm test               # offline integrity checks (scripts/check_site.py), syntax checks, unit tests for both labs
npm run test:browser   # Playwright browser tests for the homepage and both labs; see lab/pathfinding/README.md for the one-off setup
```

Continuous integration runs the same checks on every pull request (`.github/workflows/portfolio-ci.yml`).

## Publishing changes (OWNER APPROVAL REQUIRED)

The portfolio is already served from `main` by GitHub Pages. Changes to `main` can trigger a public deployment.

1. Create a review branch and pull request; keep `main` unchanged until the owner approves publication.
2. Inspect the PR diff and CI results. The CI workflow runs offline integrity/unit checks and Playwright browser tests.
3. Review all user-facing claims, project links, CSP changes and research boundaries. **Do not publish ATLAS's prepared static demo**, historical data, NYC-derived charts or hypothetical optimization outcomes through this repository.
4. After explicit owner approval, merge the reviewed PR and check the GitHub Pages deployment result.
5. Manually verify the live homepage, two lab pages, 404 page, mobile navigation, filters, theme control, keyboard interaction and outbound GitHub links. A green deployment is not a substitute for a live browser check.

**ATLAS remains an independent project with separate code licensing, NYC Open Data terms, statistical limitations, release decisions and scientific gates.** A portfolio update does not clear or modify those gates.

## Evidence-first recruiter navigation

The homepage links directly to the underlying material in addition to each project's summary:

| Project | Inspectable evidence | Boundaries |
| --- | --- | --- |
| ATLAS | [Source](https://github.com/arthur-fay/demand-forecasting-model), [backtesting protocol and results](https://github.com/arthur-fay/demand-forecasting-model/blob/main/docs/BACKTESTING.md), [release gate](https://github.com/arthur-fay/demand-forecasting-model/blob/main/docs/release/RELEASE_GATE.md) | Forecast improvements not robustly established; prediction intervals failed calibration; optimization hypothetical; static demo not published. |
| E-Commerce Analytics | [Project README with dashboard and data model](https://github.com/arthur-fay/customer-revenue-analytics/blob/main/README.md#dashboard-preview), [data model](https://github.com/arthur-fay/customer-revenue-analytics/blob/main/README.md#data-model) | The portfolio card's decorative charts are illustrative; actual screenshots and PBIX are in the project repository. |
| Pathfinding Lab | [Interactive lab](https://arthur-fay.github.io/lab/pathfinding/), [algorithm implementation](lab/pathfinding/pathfinding.js), [methods and tests](lab/pathfinding/README.md) | Grid-based demonstration, not validated physical robot navigation. |
| Security Events Lab | [Interactive lab](https://arthur-fay.github.io/lab/security-events/), [detection engine](lab/security-events/detection.js), [methods and tests](lab/security-events/README.md) | Synthetic-only educational demonstration, not a production SIEM or real-world accuracy study. |

See [the October 2026 recruiter-readiness audit](docs/PORTFOLIO_AUDIT_2026-10.md) for the reviewed scope, changes, unresolved gaps and validation plan. No employment history, degree, skills rating, personal contact method or performance figure is implied without supporting evidence.

## Edits to make next

- Provide a real LinkedIn URL to add a verified link.
- Choose whether to publish a professional email address or a safe contact form managed by a service you explicitly authorize.
- Supply an optional portrait, resume, and actual project screenshots (ensure rights to use them).
- Add future projects only after they have real source links and verifiable descriptions.
- Consider custom domain only if useful; it's optional and may cost money.

## Ownership & rights

Copyright © 2026 Arthur Fay for original portfolio text/design, to the extent owned. No open-source license for this **separate portfolio** is granted by this README. Each linked external repository or dataset retains its own licensing, terms and notices.