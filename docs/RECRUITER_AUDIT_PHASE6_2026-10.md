# Phase 6 — Recruiter journey and evidence-integrity review

**Status:** Feature branch for review; nothing in this phase is published until PR merge.

## Audit scope

Reviewed the published homepage hero, four project entry points, the document title/profile, six primary navigation destinations, employment/education presentation, contact card, footer and the three live lab routes. Compared project statements with current source repositories. The main ATLAS API-document link resolves to the real `docs/API.md` in `demand-forecasting-model`. The existing 1440px/1920px screenshots and responsive browser tests provide previous visual baselines.

## Verified corrections

1. **Hiring-contact affordance:** The homepage had promised visitors could *start a discussion on any repository*. Both the current portfolio and linked source repositories have GitHub Discussions **disabled**. GitHub repository Issues are public and are not a private hiring inbox, so the site now presents GitHub as a source-evidence destination, not as an employer-messaging service. Recruiters who already have the owner's résumé are directed to its contact details.
2. **Overgeneralized test assertion:** The hero claimed public source code, tests *and continuous integration for every project*. The older standalone Power BI source repository does not document its own CI/test suite; the separately deployed interactive analytics lab **does** have browser/unit tests within the portfolio repository. The new wording specifically says project repositories, research evidence and tested browser labs.
3. **Original analytics methodology:** The public Power BI README names SQL, Google Colab and Power BI but does not publish notebook language or exact transformation steps. The homepage's *Python notebooks* language was unjustifiably specific. The corrected section cut and Architecture description acknowledge the documentation limit rather than asserting unstated implementation details.
4. **Professional vs source evidence:** About now distinguishes independently inspectable projects from résumé-reported employment/education. Existing résumé roles, dates, degrees and technical competencies remain unchanged.

## Retained

- Four independent projects, three live browser labs and all destinations.
- ATLAS uncertain backtesting, failed interval calibration, hypothetical optimization, and production-publication restrictions.
- E-Commerce rounded/derived/hypothetical provenance separation.
- Security laboratory's strictly synthetic data.
- The existing premium drawing-sheet design, responsive CSS and keyboard navigation.
- Strict CSP, dependency-free GitHub Pages runtime, privacy tests and **no** additional personal contact details.

## Manual decisions / items not changed

- **Direct contact gap:** A recruiter who discovers the portfolio without already having the owner's résumé has no private direct-contact route. This is a real conversion limitation. Introducing a professional email, LinkedIn or an approved contact channel is a *separate owner privacy decision*, not something an auditor should silently do.
- **GitHub repository metadata:** The top-level repository description currently ends with "Data Science & AI Portfolio", although the public website does not position the owner as a professional AI engineer. This external GitHub setting cannot be reviewed as a normal website pull-request diff; owner can later approve an update to keep GitHub's search preview aligned with the portfolio.
- **Employer and education history:** These are user-supplied résumé statements, not independently verified against an employer or academic transcript.
- **Accessibility:** Passing the existing Playwright and contrast checks does not certify WCAG compliance or manual screen-reader usability.

## Verification

The dedicated recruiter-evidence unit tests cover contact honesty, provenance distinctions, Colab-methodology precision, existing lab destinations and the ATLAS API source. Existing site integrity, privacy, unit and browser tests must all remain green. Review homepage copy on desktop at 1440px and mobile at 375px in both themes before merge.

**Do not merge or deploy without the owner's permission.**
