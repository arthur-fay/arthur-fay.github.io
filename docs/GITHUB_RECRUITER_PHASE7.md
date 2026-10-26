# Phase 7 — GitHub recruiter presentation / owner-approval guide

## Scope

This package stages a future GitHub profile and a clearer starting point for the existing portfolio repository. It deliberately does **not** create a public GitHub profile, change repository settings, merge, deploy, disclose personal contact information, or interact with a pending ATLAS release.

The draft to publish after approval is [docs/github-profile/README.md](github-profile/README.md). Its final paragraph describes the staging process; **remove that staging note before using it as the public profile README**.

## Publication gate — owner approval required

GitHub automatically shows the root `README.md` from a **public repository with the same name as the account** (`arthur-fay/arthur-fay`) on the user's GitHub profile. The username-matching repository does **not** currently exist. A future owner-approved publishing action should:

1. Create a public repository at `arthur-fay/arthur-fay` with a root `README.md` (or stage it privately first).
2. Copy the approved text from the staged profile README, without its final staging note.
3. Confirm GitHub displays the text at `https://github.com/arthur-fay` on both desktop and mobile.
4. Verify all hyperlinks to the portfolio, ATLAS docs, Power BI source, and three labs.
5. Inspect privacy: no email, phone, LinkedIn URL, résumé PDF or unpublished employer information appears.
6. Keep the profile biography and repository descriptions consistent with **Software Engineer**, not a specialized AI title lacking public evidence.

## Current repository landing-page review

**Portfolio** `arthur-fay/arthur-fay.github.io`: a concise recruiter quick tour is staged at the beginning of `README.md`, linking to live work, source evidence and experience.

**E-Commerce** `arthur-fay/customer-revenue-analytics`: a separate PR stages a top-of-page dashboard preview / Power BI file / source DAX / browser lab navigation table. It clarifies the original rounded KPIs versus separately hypothetical lab simulations.

**ATLAS** `arthur-fay/demand-forecasting-model`: a separate PR stages a research-documentation map that foregrounds non-significance, interval-calibration failure, hypothetical optimization and release/publication restrictions. **ATLAS's existing release-candidate PR remains separate**; do not combine or bypass its release gates.

## Manual GitHub profile and metadata recommendations (not changed)

- Update the portfolio repository description from *Software Engineering, Data Science & AI Portfolio* to something like *Software engineer's portfolio: tested web labs, APIs, forecasting research and analytics — with documented limits*. This is a repository setting, not a normal file edit and needs owner approval.
- Pin the existing public repositories in a useful order: **ATLAS**, **The Architect Lab**, **E-Commerce Analytics**. These are the three public repositories currently accessible, so avoid inventing additional pinned projects.
- Consider a separately approved professional contact channel for recruiters discovering the profile directly. GitHub repository issues are **public** and should not be described as a private inbox. Do not publish a personal email or phone without explicit permission.
- Employer roles and degrees are self-reported résumé data; the code repositories demonstrate independent project engineering, not access to employer systems.

## Review requirements

Read the profile like a recruiter encountering it for the first time. Check direct paths to projects and technical evidence, credibility of statistical statements, readability without third-party badge generators or tracking, and privacy. Review all pull-request diffs and green CI before approving any merge or public profile creation.

**Nothing in this staged package authorizes automated merging or public publication.**
