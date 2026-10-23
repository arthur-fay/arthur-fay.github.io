# Desktop refinement 01 — Project scanning and evidence paths

**Status:** Review branch, not published. **Scope:** Homepage project plates only; no project implementations, backend simulations, résumé claims, external tracking or deployment settings changed.

## Starting observation

The October 2026 desktop capture of the portfolio shows that every project has extensive source-backed information, but the first link to interact with or inspect the actual work is at the bottom of the specification, after long Architecture, Evidence and Limits passages. On desktop, the two-column specification also pairs short and long paragraphs, producing large empty cells and difficult reading lines.

## Changes in this refinement

- Place an obvious, keyboard-accessible **primary evidence entry point** below the summary **and below the limitations disclosure** on every plate, before the full technical facts.
- Respect project truthfulness:
  - ATLAS: **Inspect the documented API**, linking to its actual GitHub documentation, explicitly saying there is **no public live ATLAS deployment**.
  - E-Commerce: **Explore the analytics lab**, with reported versus hypothetical data called out.
  - Pathfinding: **Run the pathfinding lab**, labelled a browser-based grid simulation.
  - Security: **Explore the security investigation lab**, labelled synthetic events only.
- Preserve all original bottom-of-card evidence links, technical detail, caveats, diagram sources and project ordering.
- At widths **above 980px**, render Problem / Architecture / Evidence / Limits as a clean **single sequence of technical rows**, each with a consistent label column and wider readable text column.
- Retain the existing smaller-screen facts grid, and stack entry-point text vertically at **780px and below**.

## Test contract

Add Playwright coverage at 1280px, 1440px and 1920px for correct links, disclosure-before-action order, action-before-specification order, readable label and detail columns, and within-card alignment. At 320px, 375px and 768px, verify all four entry-point links remain within card boundaries with no horizontal overflow. The site integrity checker continues to enforce internal routes and safe GitHub outbound links.

## Constraints

No frameworks, runtime dependencies, third-party scripts, new assets, new projects, unsupported claims, or additional personal contact information. No ATLAS dashboard, data or forecast is published.

## Review checklist

Before approving publication, visually inspect the four project plates at **1440px first**, then 1280px and 1920px, in both themes; check keyboard focus visibility and the 320px/375px responsive presentation. Automated geometry checks are helpful but do **not** replace visual review on Windows, macOS, Firefox or Safari.

## Next refinement after approval

Review homepage typography, hero spacing, desktop section navigation and the experience card hierarchy as a separate scoped change. Avoid a full-site redesign.
