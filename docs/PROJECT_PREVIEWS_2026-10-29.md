# Animated project figures — 29 October 2026

The owner requested a sharper, professional presentation and continuous animation for the four project figures.

| Figure | Behavior |
| --- | --- |
| ATLAS | Animated connection lines and a guided highlight through the existing conceptual pipeline. Scientific warnings and the unpublished-dashboard label remain unchanged. |
| E-Commerce | Animated connections and a guided highlight through the documented SQL, Google Colab, DAX and Power BI toolchain. It is a schematic, not a running business-data pipeline. |
| Pathfinding | The existing local A* engine runs the documented 16 × 9, seed-11 field. The preview reveals its real expansion/frontier trace and then draws the resulting route. |
| Security | The existing local detection engine generates the seed-13 synthetic card dataset. Events and rule alerts appear at their recorded times. Alert spans are clipped at the playhead so they do not disclose future episode extent. |

Each figure has a preview header, stage readout, progress indicator and native Pause/Play and Replay controls. The readout is not an automatically repeating screen-reader announcement. Explicit pause preferences store only the four figure IDs locally; event or business data is not persisted or transmitted.

On desktop, the figure stays beside its project details while the reader scrolls. Smaller layouts keep the figure above the text. The original source/provenance caption remains directly attached to each figure.

## Performance and accessibility

- Updates run only while a figure intersects the viewport, its project is not filtered out, the tab is visible and motion is allowed. Offscreen and hidden-tab timers stop.
- Reduced-motion preferences retain the original static SVGs, disable automatic playback and leave all project/lab links usable.
- Without JavaScript, replay controls remain hidden and the original full diagrams and captions remain visible.
- The model and security diagrams keep their existing qualifications. No live API deployment, real operational feed, new forecast result or business-performance claim is introduced.
- The small replay module imports the existing two pure local engines. It adds no npm dependency or third-party runtime service and remains under the strict CSP. Its URL is content-versioned with the other changed assets.

## Verification

`npm test` passes **226 unit tests**, including independent static-preview provenance checks and new replay checks for the committed A* route, deterministic frames, security event positions and trigger-time/alert-window boundaries. The offline validator checks the new module and its local imports.

Browser coverage includes all four players, advancing/frozen progress, native keyboard replay, remembered pause, actual search-to-route progression, synthetic cursor movement, offscreen/filter pausing, reduced motion and no-JavaScript fallbacks. The associated pull-request and main-branch Actions runs supply final browser results. Dark/light layouts and preview controls are also reviewed in the browser before publication.
