# Contact panel theme colours — 30 October 2026

The contact title block now follows the page theme. Light mode uses a white, pale-blue and pale-teal gradient with dark text and a blue primary action. Dark mode retains the navy gradient, light text and pale-blue action. The labels, role chips, separators, button borders, hover states, focus rings and shadow all use contact-specific theme tokens.

The existing contact destinations, public profile facts, responsive layout and type sizes are unchanged. The update is CSS-only; selecting a theme also updates the contact panel without reloading.

Contrast tests use the actual scoped contact palettes. Main text, supporting copy and labels exceed 7:1 at all three gradient stops; primary-action text exceeds 7:1 in its normal and hover states. Role chips and secondary controls keep readable text and at least 3:1 border contrast, and focus rings remain distinct from the gradient.

The existing desktop and mobile theme-switch browser checks now cover both the system and contact panels, including the contact gradient, labels and primary action. They compare settled colors after CSS transitions. Existing checks continue to verify contact URLs, privacy, keyboard access, responsive layout and readable text. Desktop and narrow-phone previews are also reviewed in both themes. The shared stylesheet URLs are refreshed from their content hash.
