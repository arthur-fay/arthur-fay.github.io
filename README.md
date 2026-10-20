# Arthur Fay — Personal Engineering Portfolio

A responsive, accessible, dependency-free portfolio website prepared for the GitHub Pages user site **`arthur-fay.github.io`**.

**Status:** Prepared on a review branch, not merged into `main`. GitHub Pages is already enabled for this new repository and an initial `main` build succeeded before the portfolio files were added. Merging the portfolio PR can automatically publish the site if Pages continues deploying `main`. The owner controls whether and when to approve that merge.

## Featured work

**01 · ATLAS — Decision Intelligence & Optimization Engine** ([source](https://github.com/arthur-fay/demand-forecasting-model)). Research software for historical NYC 311 demand forecasting, scientific evaluation, uncertainty analysis, and HYPOTHETICAL mathematical optimization. The site does **not** host ATLAS's static dashboard, datasets, projections, or NYC-derived charts. Its forecasting advantage is not robustly established and its prediction intervals have FAILED_CALIBRATION. The MIT license for original ATLAS source code is separate from NYC Open Data terms.

**02 · E-Commerce Executive Analytics Dashboard** ([source](https://github.com/arthur-fay/customer-revenue-analytics)). Real public SQL, Python/Colab, Power BI and DAX analytics project. Actual project files and screenshots remain in the source repository. The site uses generic decorative charts only, not republished source data.

No professional employment history, degrees, LinkedIn URL, email address, or awards are asserted or fabricated. Add them after verifying details and obtaining consent to publish contact information.

## Architecture

- Plain semantic HTML + CSS + a small, dependency-free JavaScript enhancement file.
- Deliberately no React/Vite build step in this first version: **ready to publish and test with no Node/npm or paid infrastructure**. Can be migrated to React/TypeScript later if desired.
- Two real-project cards, working category filters, mobile navigation, theme toggle with user preference, accessible landmarks, skip link, reduced-motion support, custom 404 page and SEO metadata.
- No third-party scripts, analytics, forms, trackers, fonts, API credentials, or paid services.
- No remote resources are requested to render the site; outgoing links only go to GitHub.

## Preview locally

From the extracted directory, run:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`. Avoid opening `file://` URLs when evaluating deployment paths.

## Publishing later (OWNER APPROVAL REQUIRED)

1. Use the existing **public** `arthur-fay/arthur-fay.github.io` repository. Review the portfolio pull request before approving it. Check **Settings → Pages**: Pages is already enabled, although its exact configuration should be confirmed by the owner.
2. After review and explicit owner approval, merge the portfolio pull request. All site files must be **at the repository root**, including `.nojekyll`; leave the ATLAS repository untouched.
3. **Before merging**, decide whether the portfolio should go live immediately. Since Pages is already enabled and successfully ran against the initial `main`, a merge may deploy automatically. If you want to prevent that, disable Pages in **Settings → Pages** before merging. When you are ready to publish, use **Deploy from a branch → main → /(root)** if that is the selected source.
4. After the portfolio merge and successful Pages deployment, verify `https://arthur-fay.github.io/` opens and displays the new portfolio. The site's current response has not yet been independently checked; do not confuse the initial README build with the portfolio being live.
5. Check both desktop and mobile, navigation, theme switch, filter buttons, the 404 page, and all external GitHub links.

**No ATLAS release tag, dashboard publication flag, NYC data terms gate, or VPS is affected by this separate portfolio.**

## Edits to make next

- Provide a real LinkedIn URL to add a verified link.
- Choose whether to publish a professional email address or a safe contact form managed by a service you explicitly authorize.
- Supply an optional portrait, resume, and actual project screenshots (ensure rights to use them).
- Add future projects only after they have real source links and verifiable descriptions.
- Consider custom domain only if useful; it's optional and may cost money.

## Ownership & rights

Copyright © 2026 Arthur Fay for original portfolio text/design, to the extent owned. No open-source license for this **separate portfolio** is granted by this README. Each linked external repository or dataset retains its own licensing, terms and notices.