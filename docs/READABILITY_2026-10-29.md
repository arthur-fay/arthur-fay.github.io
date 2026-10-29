# Desktop and mobile text readability

The reading scale now uses 17px body copy, 17–18px lead copy, 15px supporting
copy and 13px labels at the browser's default 16px root size. Relative units
let the reading text follow a visitor's font preference. Paragraph leading is
1.75, with a 68-character maximum measure on detailed project prose.

The primary, secondary and fine reading inks exceed 7:1 against each of the
four plain page/panel backgrounds in both themes. This is a scoped contrast
check; it is not a claim that every chart mark or every element meets AAA.
Colour-coded project identities and the established serif display headings
are retained. Profile facts and contact destinations use the body font.

All reading sections are visible and stationary immediately. The former
scroll fades and section-cut text entrances are removed. The hero model and
the four project replays retain their existing pause, visibility and
reduced-motion behavior. The long opening About paragraph is separated into
employment, independent work and education paragraphs using the same text.

The three labs inherit larger labels, captions and explanations. Typed
fields and selects use at least 16px text and 48px height, and the local JSON
textarea remains a large multiline field. Buttons keep touch targets of at
least 44px. No viewport setting restricts visitor zoom.

## Verification

- Offline integrity checks, JavaScript syntax and all 232 unit tests.
- Contrast tests read the actual stylesheet tokens in both themes.
- Browser checks cover reading sizes, line spacing, visible content, touch
  targets and clipping at 320, 375, 768 and 1280px in both themes.
- Paragraphs are checked with increased letter/word spacing at 320 and
  1280px. The existing layout suite also covers 1100 and 1920px.
- Each lab checks both themes at 320/375px, field sizes and actual typing,
  alongside the existing algorithm and interaction regression suite.
- Cloud-browser visual review of the homepage, project copy and controls.

This change adds no runtime dependencies, remote fonts or network requests.
The simulation engines, project claims, contact details and ATLAS publication
boundaries are unchanged. Shared CSS/JavaScript URLs are content-versioned.
