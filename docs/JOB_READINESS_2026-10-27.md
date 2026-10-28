# Portfolio job-readiness review — 27 October 2026

## Outcome

The existing work supports several distinct technical review paths. The homepage now gives each one a concise entry point above the project filters, without claiming that one portfolio proves suitability for every job or seniority level. This change is prepared on `feat/role-evidence-paths-v8`; publication follows the repository's review-and-merge workflow.

## Evidence by role

| Review path | Evidence available now | Limit of that evidence / useful next work |
| --- | --- | --- |
| Backend / API engineering | ATLAS's FastAPI service, OpenAPI contract, schemas, worker limits and tests; résumé-reported Python/PostgreSQL/ERP employment | ATLAS's tested deployment package is not a public production deployment. A separate, synthetic-data PostgreSQL service with migrations and integration tests would make database work publicly reproducible without exposing employer systems. |
| Frontend / full stack | ATLAS's React/TypeScript dashboard and generated API types; three live JavaScript labs with keyboard interaction and browser tests | The live labs use JavaScript, while the React dashboard is inspectable in source and runs locally. Keep that distinction clear in applications. |
| Data analyst / BI | Original Power BI dashboard, PBIX/PDF, dimensional model and documented DAX; companion browser lab | The original analytics repository does not publish its SQL or preparation notebook. Recover and document those authentic files if available; do not manufacture a historical pipeline or treat hypothetical scenarios as business outcomes. |
| QA / test automation | Unit tests with independent algorithm references, browser regression tests, CI, ATLAS API and property-based tests | Public project evidence is available; a dedicated professional QA title or production QA tenure is not established by these repositories. Prepare an interview explanation of a real defect and the regression test that caught it. |
| Security-related review | Strict schema validation, CSP, explainable detection rules and a browser investigation lab | The security lab uses synthetic events. It does not establish SOC employment, incident-response experience, real-world detection accuracy or a production SIEM deployment. |
| Forecasting / research review | Seven-model comparison, rolling-origin evaluation, reproducibility and documented statistical corrections | The baseline improvement is not robustly established, interval calibration failed, and optimization assumptions are hypothetical. Preserve those conclusions. |

This is an assessment of inspectable portfolio evidence, not a guarantee of hiring outcomes or a verification of résumé-reported employment and education.

## Changes in this branch

1. Add four role review paths with direct links to the relevant case study, live lab, documentation, source tests and CI workflow. The guide remains readable without JavaScript.
2. Repair project anchor navigation after filtering, including a keyboard-activated link to the current fragment and fragment navigation to a heading inside a hidden project. Unrelated fragment links retain the chosen category.
3. Correct the About note: three public repositories document four projects. The browser labs share the portfolio repository.
4. Remove Python from the original e-commerce project's label and technology chips: its public README documents Google Colab but does not establish the notebook language. Python remains listed for the independently evidenced ATLAS work and résumé-reported professional work.

No employer code, contact details, credentials, private résumé, research dataset or ATLAS dashboard is added.

## Remaining work, ordered by recruiting impact

| Priority | Gap | Concrete completion condition |
| --- | --- | --- |
| 1 | A visitor without the résumé has no private hiring contact route | Owner selects a public professional contact address or verified profile. Add that exact approved route, then update the privacy checks for that narrow exception. Do not infer publication approval from an address visible to a connector. |
| 2 | GitHub profile presentation is staged rather than live | Review the existing portfolio PR #16, including its prepared profile README. Publishing a profile requires a separate public username-matching repository; merging that PR alone does not create one. |
| 3 | Applications need a clear target | Tailor the résumé summary and the first project to the specific role. Use the same verified roles, dates, degree status and project limits across the résumé, website and GitHub. A public résumé still needs an owner decision about its contact details. |
| 4 | Original analytics implementation is hard to reproduce | Add the authentic SQL/notebook plus inputs, definitions, run steps and data terms when available. Clearly separate original reported figures from a new reproducible demonstration. |
| 5 | Database and operational evidence is mostly professional or local | If pursuing backend/database roles, build a small independent PostgreSQL/API example with synthetic data, migrations, integration tests, an architecture note and documented failure handling. Publish only what is actually implemented and verified. |

The existing review PRs are separate: portfolio #16 stages profile documentation; customer-revenue-analytics #1 improves the Power BI entry page; demand-forecasting-model #14 improves research navigation. ATLAS release-preparation PR #13 has independent release gates. This portfolio change does not approve or merge any of them.

## Verification record

- `npm test`: passed locally — offline site/anchor/CSP/privacy checks, JavaScript syntax checks and 217 unit tests.
- Three browser regressions added for filter-to-anchor navigation, repeated keyboard fragment activation and nested fragment targets. The existing responsive/no-JavaScript/theme/lab suite remains applicable.
- GitHub Actions passed on implementation commit `599f9427468ea2a42380a912532154f4d88ac846`: offline integrity/unit checks, **172 browser tests** (zero failures or skips) and the native Chrome visual job. [Verified run](https://github.com/arthur-fay/arthur-fay.github.io/actions/runs/40564080295). Local Playwright launch was unavailable because this executor has no installed Chromium executable; the full browser result is from CI.
- The managed preview was reviewed in the cloud browser in light and dark themes. A hidden analytics plate was opened from the role guide, restoring the card, All work and the live result count. Phone review frames had content viewports of 320px and 375px with no horizontal document overflow. This is separate from automated testing and does not certify accessibility or cross-browser compatibility.

Visual review: [desktop light](job-readiness-2026-10-27/role-guide-light.jpg), [desktop dark](job-readiness-2026-10-27/role-guide-dark.jpg), [phone content viewports](job-readiness-2026-10-27/role-guide-mobile.jpg). The phone screenshot shows same-origin review frames, not physical devices. The subsequent evidence commit adds only these screenshots and this verification record; implementation and tests are unchanged.

Review the PR's current checks before merge. GitHub Pages publishes from `main`; this branch leaves the live website unchanged until that merge.


## Follow-up — 28 October 2026

Priority 1 now has an owner-selected recruiting route: the homepage and GitHub introduction use the exact email and LinkedIn URL the owner supplied. See [the contact update](PUBLIC_CONTACT_2026-10-28.md) for scope and verification. The next engineering-evidence task remains a compact, reproducible FastAPI/PostgreSQL project with migrations and integration tests.
