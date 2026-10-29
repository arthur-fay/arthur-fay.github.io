# Continuous system model — 29 October 2026

The owner identified that the hero's build animation only ran when the page loaded and requested continuous motion and a more visual engineering experience.

The initial drawing still builds once. Afterward, the five layers float gently and four visible signals travel along the existing conduits continuously. The motion uses CSS animations, with a separate nested group so it does not replace pointer parallax. No JavaScript interval or per-frame animation loop is added.

The model now has five native layer buttons. Selecting one highlights its plate, explains the layer and links to related project evidence. Manual selections update a polite status region; the ongoing animation does not generate repeated screen-reader announcements. The illustration remains explicitly conceptual, not a live dashboard or operational-data feed.

## Visitor controls and fallbacks

- Pause/play freezes and resumes automatic motion. An explicit pause is remembered in the browser's optional local preference storage.
- Motion pauses when the figure is offscreen or the tab is hidden, and resumes when visible if the visitor has not paused it.
- A reduced-motion preference disables autoplay, shows the complete static drawing and keeps layer inspection available. Preference changes are handled without reloading.
- Without JavaScript, the interactive controls stay hidden and the complete five-layer static legend remains visible.
- The five layer controls use native keyboard behavior, visible focus, pressed states and a shared detail-region relationship. No hover-only action is required.

## Validation

`npm test` passes **222 unit tests**, including generated-SVG consistency, geometry and both themes' contrast checks. The SVG checks also cover the five independent floating groups and four decorative signal circles.

The browser suite adds checks for motion continuing after the entrance, pause/resume and remembered pause, keyboard layer inspection and related-work navigation, and automatic offscreen pausing/resuming. Existing reduced-motion and no-JavaScript checks now verify the new controls and static fallback. The associated pull request and main-branch Actions runs supply the final browser results.

The site remains dependency-free and uses the same strict CSP. Shared asset hashes are refreshed. No employment, education, contact, project-result or release-publication claims change.
