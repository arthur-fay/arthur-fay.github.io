# Phase 7 — GitHub profile publication record

## Scope

The owner approved publishing the prepared public GitHub profile on 27 October 2026. This package contains the approved introduction and a clearer entry point for the portfolio repository. Profile creation is pending GitHub browser sign-in because the connected GitHub app can write files but does not expose repository creation. No public contact address, phone, private résumé or employer material is added.

The publish-ready text is [docs/github-profile/README.md](github-profile/README.md). Its staging note has been removed, and it now links to the live role guide published through portfolio PRs #17 and #18.

## Publication steps — owner approval recorded

GitHub automatically shows the root `README.md` from a **public repository with the same name as the account** (`arthur-fay/arthur-fay`) on the user's GitHub profile. The username-matching repository was not found through the connected account during this preparation. The authorized publication should:

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

**Publication status: prepared, not yet confirmed live.** Verify the root README on the GitHub user profile before marking publication complete. The owner's approval covers the public profile repository and the prepared introduction; adding personal contact information and changing unrelated repositories remain separate decisions.
