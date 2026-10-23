# Desktop refinement 03 — Experience, education and skills hierarchy

**Review branch:** `feat/desktop-record-refinement-v3`. The live site is unchanged until the owner merges the pull request.

## Visual problem and design decision

Reviewing the latest saved desktop capture of the Experience & Education section showed narrow reading columns on the employment side, despite substantial descriptive text. The adjacent Core Stack section used bordered chips for every technology, creating a visually heavy block that competes with the more relevant professional work.

The intent of this scoped refinement is to improve **recruiter scan speed**, not add more information or invent achievements.

## Changed

- Tightened the introduction to highlight experience, education, and the separation of public independent projects from employer work.
- At desktop widths **1181px and up**, allocate roughly 64% of the record panel to the work history and 36% to the education/skills rail, separated by a 24px gutter. Compact the date column from 200px to 148px; this meaningfully widens the actual role-description text.
- Refine desktop headings, entry spacing, and bullet line-height for a calmer vertical rhythm.
- In the right rail, keep all original skill terms and categories but display them as a **lightweight technical index**, with small accent markers instead of dozens of bordered pills. Keep distinct, labeled groups for programming, backend/data, frontend, quality, infrastructure and practices.
- Preserve the **original experience-chip design** below each role, distinguishing role-specific technology labels from the wider résumé technology index.
- **Widths 1180px and below are unchanged by the new style rules**, so desktop improvements do not compromise tablet and phone layouts.

## Facts preserved

The two résumé-level job titles and dates, independently developed projects, all four case-study links, Capella expected January 2027 (degree in progress), BMCC August 2024, and every current skill name remain unchanged.

Existing scientific caveats, non-production deployment statements, site security policy, privacy restrictions and the distinction between employment claims and public project evidence are unchanged.

## Verification

Automated browser assertions at desktop **1280px / 1440px / 1920px**, in dark and light modes, check relative column widths, real reading width, dates/content gutter, complete skill list, lack of chip borders, both education entries, four independent project links and no overflow. Additional checks at 320px, 375px, 768px, 980px, 1001px, and 1180px confirm that the source facts and responsive presentation survive.

All existing site-integrity checks, unit tests and Playwright suites remain mandatory.

**Visual approval:** Inspect the actual Experience & Education area at 1440px in both themes before merging, then 1280px and 1920px. Browser geometry cannot substitute for judging typography and spacing, and Firefox/Safari/real-device rendering have not yet been independently reproduced.
