# Desktop refinement 02 — First-screen hierarchy

**Review branch only. Not published.** Starts from the published `main` that includes PR #10. No changes to the four project implementations, three labs, résumé facts, or GitHub Pages settings.

## Why

In the existing 1280px desktop hero capture, the architectural headline is visually distinctive, but a recruiter's key question—*what kind of engineer is this?*—is answered relatively late inside an 80+ word paragraph, beneath the large headline. That leaves the first screen slower to scan than it needs to be.

## Changes

- Show a compact **Software Engineer** identity strap **before** the main editorial headline, alongside the résumé-supported core stack: Python, TypeScript/React, FastAPI, PostgreSQL.
- Preserve the original large architectural headline, diagram, project index, precise résumé title block and clear evidence links.
- Rewrite the opening paragraph into roughly 50 words without dropping the distinction between user-reported professional work and independently documented projects.
- Improve desktop typography and visual balance: modestly narrow the headline's upper size, adjust the hero columns and spacing, and shorten the distance to the project actions.
- Arrange the two primary recruiter actions on the first row and keep the two exploration links on a quieter second row at desktop widths. At <=980px the existing responsive flows apply; at 480px and below the identity strap reflows into clear stacked lines.
- Increase desktop header navigation hit area to 40px and slightly strengthen link weight without changing routes, labels or sticky-header behavior.
- Add unit and browser regression coverage for the résumé identity, first-screen action visibility at 1280px/1440px/1920px, link alignment, keyboard-friendly navigation targets, and clipping/overflow at 320px/375px/768px/1001px.

## Design and integrity constraints

- No new pages, projects, generated illustrations, external CSS/fonts/scripts, framework dependencies or marketing language.
- ATLAS remains research (the existing statistical uncertainty and publication restrictions stay intact); the Security Lab remains synthetic; the Pathfinding Lab is a browser-based simulation; E-Commerce maintains its reported vs hypothetical boundary.
- No private phone, personal email, LinkedIn URL, raw résumé or employer-confidential data.
- Preserve light/dark mode, strict CSP, reduced-motion behavior and all project links.

## Approval review

Review the hero visually at 1440px first, then 1280px and 1920px, dark and light, paying attention to (a) the role strap, (b) headline shape and text line breaks, (c) CTA visual alignment, (d) artwork balance, and (e) where the profile title block begins. The automated layout tests cannot certify visual aesthetics.

Recheck 320px/375px mobile and 768px tablet widths, including real-device font rendering if available. No independently reproduced Lighthouse, Firefox, Safari or screen-reader results are asserted here.

**Do not merge before the owner accepts the visual result.**
