# System panel theme colours — 30 October 2026

The hero's interactive system box now follows the page theme. Light mode uses a white sheet, blue-tinted plate faces, dark readable labels and a softer shadow. Dark mode retains the navy sheet, brighter layer edges and light labels. The five layer colours retain the same meaning in both palettes; controls, component labels, viewport, focus states and reset action use the panel's current tokens.

All theme changes are CSS-only. Switching themes preserves the selected layer, camera, paused-motion preference and keyboard focus. Zoom, direct surface clicks, touch controls and reduced-motion behavior continue to work as before.

Contrast checks now read the panel's actual scoped theme tokens. They require at least 7:1 for its three reading inks, 4.5:1 for accent labels and 3:1 between every layer edge and its plate face. The dark block tops are slightly darker so their outlines also meet the existing 4.5:1 check. Checks for plate shading, cut faces and background separation now use the actual panel palettes rather than the page's general tokens.

The browser suite verifies repeated light and dark palette changes on desktop and mobile while a layer is focused, including the panel, viewport, drawing and controls. Existing tests cover all five zoomed layers, touch, keyboard navigation and no-JavaScript fallback. Desktop and phone previews are visually checked in both themes. Shared CSS URLs are refreshed from the file's content hash.
