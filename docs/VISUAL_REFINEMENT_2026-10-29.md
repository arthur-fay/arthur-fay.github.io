# Engineering portfolio visual refinement — 29 October 2026

The owner requested more colour and a sharper, professional software engineering presentation. This refinement keeps The Architect Lab's monogram, system drawing, architectural plates and existing project evidence.

## Visual system

| Element | Treatment |
| --- | --- |
| Dark theme | Midnight navy, cool white text and blue primary actions. |
| Light theme | Cool white surfaces, ink-blue text and a deeper blue for accessible links and buttons. |
| ATLAS / backend | Blue. |
| E-Commerce / frontend review path | Violet. |
| Pathfinding / data review path | Cyan. |
| Security / testing review path | Amber. |
| Hero | Filled headline, a restrained blue/cyan background wash, stronger role label and coloured profile-block rules. |
| Project review | Tinted role cards, matching project-tab and plate accents, clearer top rules and lightly rounded controls. |
| Brand assets | Blue monogram favicon and a matching 1200 × 630 social card generated from the site's own HTML/CSS/drawing. |

Project names, plate numbers, semantic labels, glyphs and patterns remain visible. Colour provides an additional cue. Disclosures use their explicit wording and information symbol; project colour is not a risk or validation status.

## Accessibility and validation

- Existing colour tests cover text, controls and drawing states across the portfolio and all three labs. Two additional checks verify all four project inks and supporting copy on their actual tinted surfaces in both themes.
- The pathfinding grid uses a lighter blue path in dark mode and a deeper blue path in light mode. Explored-cell tones were adjusted so open cells, explored cells and the final path each retain the existing 3:1 graphical contrast requirements. Start/target glyphs and the two-tone keyboard focus ring remain in place.
- `npm test`: **222 passing unit tests**, including colour contrast and offline privacy/CSP/asset checks.
- Content-derived CSS/JS URLs are refreshed. The pathfinding stylesheet now also receives a content-derived URL, checked by the same strict asset validator, so an older cached grid palette cannot conflict with the new shared colours.
- The existing browser suite covers mobile and desktop widths, light/dark mode, menus, keyboard navigation, filters, section-cut tabs, reduced motion, no-JavaScript content and the three interactive labs. Its pull-request and deployment runs supply the final revision's results.

The social card is exported from the code-generated card page through the review browser, using the card element's measured 1200 × 630 bounds, then encoded as a palette-reduced PNG. Its editable source remains `scripts/social-card.js` and the shared tokens.

No project results, employment dates, degrees, contact destinations, release approvals or publication boundaries change. The browser labs remain dependency-free; no fonts, tracking scripts or third-party runtime services are added.
