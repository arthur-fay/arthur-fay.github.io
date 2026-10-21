# Recruiter-readiness and security audit — October 2026

**Repository:** `arthur-fay/arthur-fay.github.io`  
**Status:** Review document for `audit/recruiter-readiness-oct2026`; changes are intentionally unmerged.  
**Review objective:** Help a recruiter verify implemented technical work quickly, without inflating scientific or professional claims.

## Scope and evidence

Inspected the committed portfolio source (`index.html`, `script.js`, `styles.css`, `404.html`, `README.md`, `sitemap.xml`, `robots.txt`, `package.json`, `scripts/check_site.py`, GitHub Actions configuration and existing browser tests) and the root documentation of both external project repositories. Inspected the lab page markup and lab READMEs. The code structure and test inventory are inspectable; **this review did not independently run the live website, Lighthouse, a screen reader, Firefox, Safari, or a low-end mobile device**. Direct access to the public Pages website was unavailable through the review environment. The existing green CI result for the previous Project 04 merge is evidence of that commit's configured checks, *not proof that this new branch passes*.

The two lab READMEs and the tests provide more detailed algorithm and implementation evidence than the homepage can appropriately fit. The source-code links intentionally expose those materials rather than claim a numerical quality score.

## Project evidence map

| Work | Verified repository evidence | Claims and scientific boundary to preserve |
| --- | --- | --- |
| **01 — ATLAS** | [Research repository](https://github.com/arthur-fay/demand-forecasting-model), [backtesting](https://github.com/arthur-fay/demand-forecasting-model/blob/main/docs/BACKTESTING.md), [release gate](https://github.com/arthur-fay/demand-forecasting-model/blob/main/docs/release/RELEASE_GATE.md) | Archived NYC 311 request-count research, not an operating city system. Forecasting advantages are not robustly established, prediction-interval calibration failed, and optimization assumptions are hypothetical. No ATLAS static demo or NYC-derived data is republished here. |
| **02 — E-Commerce Analytics** | [Repository and Power BI dashboard previews](https://github.com/arthur-fay/customer-revenue-analytics/blob/main/README.md#dashboard-preview), [data model](https://github.com/arthur-fay/customer-revenue-analytics/blob/main/README.md#data-model) | The actual screenshots and PBIX reside in the separate project; portfolio artwork is decorative and not a chart computed from those data. |
| **03 — Pathfinding Lab** | [Page markup](../lab/pathfinding/index.html), [algorithm module](../lab/pathfinding/pathfinding.js), [README / design and test explanation](../lab/pathfinding/README.md), [unit tests](../tests/unit/pathfinding.test.js) | It is an interactive grid-search simulation with BFS, Dijkstra and A*, not validated robotics hardware or a physical navigation stack. |
| **04 — Security Events Lab** | [Page markup](../lab/security-events/index.html), [detection engine](../lab/security-events/detection.js), [README / limitations and test explanation](../lab/security-events/README.md), [unit tests](../tests/unit/detection.test.js) | Synthetic-only auth event replay and explainable toy rules. Not a production SIEM, real attack detector or measure of real-world predictive performance. |

## Findings and actions

### Addressed in this pull request

1. **Medium: source and testing evidence buried behind broad repository links.** Added concise, direct deep links from each project card to verifiable results, the data model, the live labs, the pure algorithms, and methodology/test documentation. This reduces unnecessary navigation without adding unsupported metrics.
2. **Medium: custom 404 inconsistent with the site's restrictive Content Security Policy.** The original error page used several inline `style` attributes and had no explicit CSP. Moved its styling to `404.css`, added a restrictive CSP meta policy and `noindex`, preserved a one-click home link, and added offline/browser regression assertions. The stylesheet is local; no third-party assets or JavaScript are needed.
3. **Low: outdated README launch instructions.** The README still described a *future initial publication* although Pages and Projects 01–04 were already merged. Replaced those instructions with the actual review-branch workflow, explicit owner-controlled publishing, project evidence links and scientific boundaries.

### Not changed without additional evidence or owner approval

1. **High for recruiting: no verified direct contact route.** The current homepage directs visitors to GitHub but does not have an owner-approved contact email, verified LinkedIn account, or downloadable résumé. Do not invent addresses or claim any degree, employer or certification. Confirm a public contact method and whether a résumé should be posted before editing the site.
2. **Medium: external visual/performance verification incomplete.** A successful Pages build and automated Chromium checks are insufficient to establish real-world load speed, layout across all browsers, or screen-reader usability. Manually verify desktop and mobile, keyboard navigation, focus, contrast, light/dark mode and lab interactivity; capture Lighthouse results in a real browser *before* publishing numerical performance claims.
3. **Medium: screenshots/portfolio visuals.** The e-commerce card honestly calls its graphics illustrative, and the source repository holds real dashboard screenshots. A rights-cleared portfolio screenshot could strengthen evidence, but no imagery has been copied or licensed as part of this review. ATLAS NYC-derived charts/datasets remain excluded pending project-specific publication gates.
4. **Medium: production/security scope limitations.** The security lab imports only strictly validated synthetic events; its simulated precision/recall must never be marketed as detection accuracy. The pathfinding lab is a grid simulation, not a validated robot. The portfolio's research disclaimers should remain visible.
5. **Low: social preview polish.** The site has description, canonical URL and Open Graph text. A custom share preview image is optional, requires an actual owned artifact and browser verification, and is deliberately not fabricated here.

## Validation requirements for this PR

- GitHub Actions **Offline site integrity and unit tests** must pass on this branch. Among other checks, the offline validator now requires evidence links and verifies that the 404 HTML has no inline style/handlers, has a restrictive CSP, uses local CSS and instructs search engines not to index the error page.
- GitHub Actions **Browser tests** must pass, including the new 404 regression assertions.
- Review the diff for unexpected links, dependencies, tracking, data publication, changes to ATLAS, and unintended changes to the labs' numerical logic.
- After owner-approved merge: inspect `/`, `/lab/pathfinding/`, `/lab/security-events/` and an invalid URL returning the custom 404. Test project filters, mobile menu, both themes, scrolling, links, keyboard focus and lab interactions, including a 320px-wide viewport.
- If either CI job fails, do **not** merge. Fix the failing assertion and rerun. Do not treat any pending or incomplete job as a pass.

## Restrictions

This audit does **not** change ATLAS, the e-commerce source repository, Pages settings, passwords, data, license decisions, publication gates, deployments, hosting costs or identity information. It does not introduce a paid service, third-party asset, analytics, trackers, or contact forms. The portfolio remains plain HTML/CSS/JS on GitHub Pages.

**Release control:** This pull request is for owner review. Merging into `main` may publish the changes automatically; it must not be merged without the owner's explicit approval.
