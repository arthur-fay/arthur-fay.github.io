# Résumé refresh — October 2026

**Status:** Review branch; the current published site remains on `main` until the owner authorizes merging.

## New source and reconciliation

The owner provided a one-page revised PDF résumé on 21 October 2026. The private file was reviewed to update portfolio content; it was **not committed** or published.

| Topic | Updated résumé says | Public portfolio treatment |
| --- | --- | --- |
| Identity | Backend Software Engineer, Python/FastAPI/PostgreSQL/SQL and data analytics | Updated hero summary: backend REST APIs, tests, CI/CD and independently evidenced systems |
| Experience | Blue Sky Trading, Backend Software Engineer I, March 2026–present; pharmacy technician and inventory analysis at 21st Ave Pharmacy & Medical Supply, March 2020–December 2025 | Existing résumé-level descriptions retained without operational counts, equipment workflow specifics, patient data or proprietary records; abbreviated employer name follows the newer résumé |
| Regulated operations | Five-plus years processing HIPAA-regulated data | Added a concise five-plus-years description without identifying patients, throughput or an internal system |
| ATLAS | 1,277-day snapshot, 12.3M requests, seven models/822 origins, 14 API operations, tested React 19 client and container-tested Ubuntu deployment | Independent-work description expanded; earlier portfolio's correct statistical limitations and release-gate language remain. The résumé's bare 28%/11% result requires context: the advantage was not robustly statistically established, 95% prediction intervals failed calibration and optimization assumptions are hypothetical |
| E-Commerce | Power BI dimensional model over reported 99K orders; DAX and an interactive browser lab | The model, hypothetical simulator and lab remain linked |
| Quality | Coverage, property testing, GitHub Actions and 300-plus combined portfolio tests | Modernized selected tool tags; did not claim independently verified live Lighthouse results or blanket WCAG compliance |
| Education | Capella University — B.S. Computer Science; no status or year stated, and no associate degree listed | Retained **in progress** from the owner's earlier résumé; removed old expected-2027 date and associate-degree listing from this latest public profile. Requires owner confirmation of status |
| Languages | English, Russian and Persian/Farsi | No change |
| Contact | Résumé includes phone, email, LinkedIn | No additional contact details or PDF published; GitHub remains the only public link |

## Website changes

- Revised hero and core skill descriptions, and the independent project recap.
- Reconciled the education title block, card and About copy to the newest résumé's degree listing without suggesting a completed bachelor's degree.
- Kept research uncertainty qualifications in ATLAS and the evidence-based framing of Projects 02–04.
- Fixed mobile experience card body padding to keep text and tags clear of the decorative 16px hatch at phone and tablet sizes.
- Updated offline, unit and browser checks to guard against outdated education text and verify mobile content inset.

## Privacy and owner decisions

**Not committed:** private résumé PDF, phone number, email address, LinkedIn URL, specific employer incident counts, patient data, internal system details or secrets.

**Confirm before merge:** (1) Capella B.S. is still in progress; (2) the prior A.S. is intentionally omitted from the new public presentation rather than deleted from the owner's academic record; (3) employment summaries can be displayed publicly. The professional record comes from the owner's résumé, not employer or registrar verification.

The latest résumé uses 96% branch coverage and Lighthouse scores, but this site update does not turn those claims into blanket certification: they should be checked against recorded build reports before being advertised outside their measured context.

## Validation

GitHub Actions should pass `npm test` (static integrity, syntax and unit suites) and the full Playwright browser suite. At a minimum, inspect the experience section at 320, 375 and 768px in both dark and light themes, including the company names, job titles, bullet text and tag chips. No site publication or screenshot verification is claimed solely from this document.

Merging into `main` may publish through GitHub Pages. This pull request deliberately does not merge or modify Pages settings.
