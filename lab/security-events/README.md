# Security Event Detection & Investigation Lab

Project 04 of [arthur-fay.github.io](https://arthur-fay.github.io/). Live page (after merge and deployment): `https://arthur-fay.github.io/lab/security-events/`.

A defensive, educational, dependency-free simulator for security monitoring. It generates a day of **synthetic** authentication events, runs three **explainable detection rules** with configurable thresholds over them, replays the timeline with play/pause/step/reset controls, opens an **investigation view** for every alert, and scores the rules against the planted scenarios with **precision and recall**. Everything runs in the visitor's browser; nothing is pre-computed, stored or transmitted.

> **Scope statement.** This is an educational simulator on synthetic data. It is not a production SIEM, not a threat-intelligence feed and not a certified security product. It never connects to real systems, never harvests credentials, never scans anything and never executes attacks. Scores on the synthetic scenarios **do not establish real-world detection accuracy**.

## Contents

1. [Purpose and limitations](#purpose-and-limitations)
2. [Architecture](#architecture)
3. [The event model](#the-event-model)
4. [Detection rules](#detection-rules)
5. [Window semantics and determinism](#window-semantics-and-determinism)
6. [Synthetic scenarios and ground truth](#synthetic-scenarios-and-ground-truth)
7. [Evaluation metrics](#evaluation-metrics)
8. [The interface](#the-interface)
9. [Safe data handling and local import](#safe-data-handling-and-local-import)
10. [Accessibility](#accessibility)
11. [Running locally](#running-locally)
12. [Reproducing the tests](#reproducing-the-tests)
13. [Card preview provenance](#card-preview-provenance)
14. [Extending the lab](#extending-the-lab)

## Purpose and limitations

**Purpose.** Demonstrate, in a verifiable way, the engineering behind a small detection pipeline: a reproducible event generator, correct sliding-window algorithms, explainable alerts, honest measurement, a usable investigation interface and strict handling of untrusted input.

**What the lab does**

- Generates reproducible synthetic datasets from a seed and a preset (mixed, quiet, noisy, stealthy, large).
- Runs three rules: repeated failures from one source (R1), password spraying (R2) and success following repeated failures (R3), each with explicit definitions and configurable thresholds.
- Replays the sorted events with Play, Pause, Resume, Step, Reset and Show all; alerts appear exactly when their trigger event arrives.
- Shows alerts grouped by rule and by affected source or account, with a plain-language explanation of what the rule saw, why that is suspicious and what it does not prove.
- Offers a filterable, paginated event table and an investigation view listing the evidence events of an alert.
- Scores the rules against the synthetic ground truth (precision, recall, strict recall, false positives, false negatives) with explicit handling of undefined values, and compares two threshold sets side by side.
- Optionally validates and loads local JSON events under a strict schema, entirely in the browser.

**What it does not do**

- No collection, parsing, retention, enrichment, correlation across log sources, case management or alert routing: it is not a SIEM.
- No real data: accounts are pseudonymous strings, sources are documentation addresses, timestamps are synthetic. It cannot say anything about real attacks or real user behaviour.
- No validation against real-world attacks. The scenarios were written with the rules in mind; the scores show that the implementation matches its definitions on data shaped like the scenarios, nothing more.
- The three rules are deliberately simple illustrations, not a detection catalogue.

## Architecture

```
lab/security-events/
├── index.html      page markup: shared header/footer, controls, timeline, alerts, investigation, table, scores, import, method
├── lab.css         page styles built on the portfolio's design tokens (/styles.css)
├── app.js          UI module (ES module): rendering, playback cursor, filters, thresholds, comparison, import/export
├── detection.js    pure engine (ES module): generator, schema validation, sorting, rules, evaluation, explanations
└── README.md       this document

tests/
├── unit/detection.test.js          rules, streaming, configuration, evaluation, helpers, O(n²) reference agreement, scale
├── unit/synthetic.test.js          generator, ground truth versus detection across seeds, strict import validation
├── unit/security-contrast.test.js  WCAG contrast of the lab's colour tokens in both themes
├── unit/security-preview.test.js   the portfolio card artwork is exactly a real engine run on a seeded dataset
├── unit/helpers/css-colour.js      colour arithmetic shared with the pathfinding contrast test
├── browser/security.test.js        Playwright (Chromium) tests at desktop, tablet, mobile and narrow viewports
└── browser/helpers/server.js       static server emulating GitHub Pages (shared with the pathfinding tests)
```

Design decisions:

- **Dependency-free, like the rest of the portfolio.** Plain HTML/CSS/JS, ES modules, the same strict Content-Security-Policy (`default-src 'none'; script-src 'self'; style-src 'self'; …`), no inline code, no fonts, no analytics, no third-party code, no network access from the page.
- **Engine apart from rendering.** `detection.js` has no DOM access and no side effects, so the unit tests exercise exactly the code the page runs. `app.js` owns the DOM and renders from the engine's output only; every text node is written with `textContent`.
- **Compute everything, then replay.** The UI runs the engine over the whole dataset whenever the data or the thresholds change and keeps a cursor into the sorted events. Playback is a cursor operation, so the screen can never disagree with the engine.
- **Streaming rules.** Each rule is a state machine with amortised O(1) work per event (one FIFO per source or account, plus a per-account counter for the spray rule). Batch detection is sort + stream; the streaming detector is exported so the equivalence is tested.
- **Deterministic everything.** A seeded PRNG (mulberry32, as in the pathfinding lab) drives every random draw in a fixed order; events are sorted by `(ts, seq)`; alerts are numbered in trigger order.

## The event model

| Field | Meaning |
| --- | --- |
| `id` | Unique string id (`e-00001` when generated, `imp-00001` when imported without ids) |
| `ts` | Synthetic epoch milliseconds, UTC |
| `outcome` | `success` or `failure` |
| `account` | Pseudonymous identifier such as `u-3f9c` or `svc-9a21` |
| `source` | IPv4 in 192.0.2.0/24, 198.51.100.0/24 or 203.0.113.0/24 (RFC 5737), or IPv6 in 2001:db8::/32 (RFC 3849) |
| `reason` | Short text for failures (`bad_password`, `unknown_account`, `expired_credential`, …), `''` for successes |
| `scenario`, `verdict` | Ground-truth labels (`benign` or `suspicious`). The detector never reads them |
| `seq` | Position in the input; the tie-break for equal timestamps |
| `index` | Position after sorting; what the table shows as `#` |

## Detection rules

| Rule | Subject | Definition | Defaults |
| --- | --- | --- | --- |
| **R1 Repeated failures from one source** | source | ≥ T failures from one source within any sliding window of W seconds (inclusive). One alert per episode: the alert is created when the sliding count first reaches T and absorbs every further failure from the source that arrives within W seconds of the previous one; a longer pause closes it. | T = 5, W = 60 s |
| **R2 Password spraying** | source | Failures from one source against ≥ A distinct accounts within any sliding window of W seconds (inclusive). Distinct accounts are counted exactly with a per-account counter that is decremented as events leave the window. Episodes as in R1. | A = 5, W = 120 s |
| **R3 Success following repeated failures** | account (and the source of the success) | A success preceded, earlier in order and within the previous W seconds (inclusive), by ≥ F failures for the same account. Scope `account` counts failures from any source; scope `source` only failures from the source of the success. One alert per qualifying success; failures are never consumed. | F = 3, W = 600 s, scope `account` |

Every alert carries the rule, the subject, the trigger event, the triggering window (`windowStart`, `windowEnd`), the whole evidence list (event ids and sorted indices), and metrics such as the count at trigger time, the peak sliding count, the episode total and the accounts or sources involved. `explainAlert(alert)` turns these into four texts: a headline, what the rule saw (with the thresholds and timestamps), why it is suspicious and what it does not prove, and what an analyst would check next. R3's text says explicitly that a success after failures is ambiguous (a guessed password and a forgetful user look the same) and does not prove compromise.

Thresholds are validated: counts are whole numbers from 1 to 1,000, windows whole seconds from 1 to 86,400, the scope is `account` or `source`, and unknown settings are rejected with the field named. Missing settings fall back to the defaults.

## Window semantics and determinism

- Events are sorted by timestamp, then by their position in the input. Equal timestamps therefore have a defined order; the same input yields the same alerts whether it arrives sorted, reversed or shuffled (tested).
- For an event at time `t` the window is `[t − W, t]`: an event exactly W seconds earlier counts, one a millisecond older does not (tested at the boundary for every rule).
- For R3, "preceding" means earlier in sorted order; a failure with the same timestamp as the success counts only when it comes first in the input.
- Duplicate ids are rejected before anything runs. Identical records with different ids are two events.
- Alert ids follow trigger order, then rule order (R1, R2, R3) for alerts triggered by the same event. `alertKey()` identifies an alert across threshold sets (rule + source, or rule + account + success event), which is what comparison mode uses.
- Cost: O(n log n) to sort plus O(n) to stream. The large preset (about fifteen thousand events) is detected in tens of milliseconds; the unit tests bound the time for 20,000 tightly packed failures.

The streaming detector refuses events pushed out of order (`createDetector().push()` throws), and the unit tests check that streaming one event at a time gives exactly the batch result.

## Synthetic scenarios and ground truth

Each preset plants scenarios on top of routine sign-ins. Every event carries its scenario id and the scenario's verdict:

| Kind | Verdict | Shape | Rules expected at the defaults |
| --- | --- | --- | --- |
| Routine sign-ins (baseline) | benign | Each account signs in from its own source; about 5% of sessions start with a mistyped password, rarely two, then succeed | none |
| Forgetful user | benign | 3–5 failures 8–45 s apart from the usual source, then a success | R3 (expected false positive) |
| Shared office gateway | benign | 12–20 accounts share one source with a slightly higher failure rate | none at the defaults; R2 at low thresholds |
| Misconfigured service client | benign | A service account retries an expired credential every 10–25 s for 20–90 min | R1 (expected false positive) |
| Brute force | suspicious | 25–80 failures 0.3–4 s apart from one source against one account, optionally ending in a success | R1, and R3 when it succeeds |
| Password spray | suspicious | One source, 15–40 accounts plus 3–6 non-existent ones, mostly one guess each, 15–45 s apart | R2 |
| Low-and-slow spray | suspicious | A spray paced 150–420 s apart | none at the defaults; R2 with a window of about 30 min |
| Distributed failures, then a success | suspicious | 6–12 sources fail 1–3 times each against one account, then a success from a fresh source | R3 in account scope only |

The generator emits events in scenario order, not time order, so the engine's sort path is always exercised. The labels are ground truth for scoring only: a unit test checks that stripping or inverting them changes no alert. The expectations in the last column are hypotheses about the synthetic data that the tests check across many seeds; they are not statements about real attacks.

## Evaluation metrics

Definitions (also stated on the page):

- An alert is a **true positive** when at least one of its evidence events is labelled suspicious, otherwise a **false positive**.
- **Precision** = true-positive alerts ÷ all alerts; `null` (shown as "n/a", never 0% or 100%) when no alert was raised.
- A suspicious scenario is **detected** when any alert's evidence includes one of its events; **recall** = detected ÷ suspicious scenarios; `null` when the data holds no suspicious scenario. This definition is lenient, so a **strict recall** is reported as well: the scenario must contain the trigger event of some alert.
- **Missed scenarios** are the false negatives. **Benign flagged** counts benign scenarios cited by a false-positive alert; a benign scenario cited only by true-positive alerts (for example the victim's routine login that completes a brute-force sequence) is not counted against the rules.
- Scores are available only when every event carries a verdict (imported data may be unlabelled, in which case the page says so).

Comparison mode runs a second threshold set B on the same events and shows alert counts per rule, true/false positives, precision, recall, strict recall, missed and flagged scenarios side by side, plus the alerts present only under A, only under B, or under both.

## The interface

- **Summary**: events, successes, failures, accounts, sources, alerts by rule, all computed from the data.
- **Timeline** (SVG): one lane per source (the 16 busiest, with alert subjects first; the rest aggregated), successes as short marks and failures as tall marks, alert spans coloured and numbered by rule, a dashed replay cursor. Above 3,000 events the lanes switch to stacked bars with the failure share hatched. Pointer users can select an alert by clicking its span; keyboard and screen-reader users use the alerts list and the text summary under the drawing.
- **Playback**: Play, Pause/Resume, Step, Reset, Show all, and a speed slider from 1 to 1,000 events per second. Alerts appear exactly when their trigger event is replayed.
- **Alerts**: grouped by rule, then by affected source or account; each alert is a button with its headline and span.
- **Investigation**: headline, chips (rule, subject, window, evidence count, trigger), the three explanation texts, the synthetic ground truth for the alert (true or false positive and the scenarios it touches), the first 25 evidence events, and a button that filters the table to the alert's evidence.
- **Event table**: processing order, UTC timestamps with milliseconds, filters by outcome, account, source, label and citation, 50 rows per page.
- **Evaluation**: the metric tiles, a per-scenario table and, in comparison mode, the A-versus-B table.
- **States**: an empty dataset, no alerts, no events replayed yet, invalid thresholds (the last valid set stays in force and the invalid field is marked), invalid seeds, unavailable scores and import errors all have explicit messages.

## Safe data handling and local import

- The page has no backend, no telemetry, no analytics, no tracking, no storage of event data and no network access: the CSP allows no connections and no inline code, and the offline integrity script fails on any `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `eval`, `innerHTML`, `localStorage`, `sessionStorage` or `indexedDB` usage in the lab's JavaScript.
- Generated sources come only from the RFC 5737 documentation ranges; imported sources must be inside those ranges or inside 2001:db8::/32, so a real routable address is rejected by design.
- **Import** accepts pasted JSON or a local `.json` file (2 MB, 20,000 events). The schema is strict: only the known fields; `id` optional but all-or-none and unique; `time` as ISO 8601 with a zone or `ts` as integer milliseconds, years 2000–2099, with calendar fields that must round-trip (30 February and 24:00 are rejected rather than rolled over); `outcome` in `{success, failure}`; `account` up to 64 characters of `A–Z a–z 0–9 . _ @ -`; `reason` and `scenario` up to 64 printable ASCII characters; `verdict` in `{benign, suspicious}`, all-or-none, consistent per scenario. Errors name the record and the field; the first 25 are listed.
- Imported text is parsed with `JSON.parse` only (data, never code) and rendered through `textContent` only, so markup-looking strings stay inert; the browser tests check that `<img onerror=…>` in a field never creates an element.
- The import warning asks visitors not to paste sensitive real-world production logs into a browser tool. Reloading the page discards an import.

## Accessibility

- Native controls with visible labels and focus rings; alerts are real buttons with `aria-pressed`; the investigation card is focusable and receives focus when an alert is activated from the keyboard.
- `role="status"` live regions for the playback status, the table status, configuration errors and import results.
- Tables with captions and column headers; the timeline is `role="img"` with a text summary that is also visible under the drawing.
- Outcome and rule information never relies on colour alone: successes are short marks and failures tall ones, binned failures are hatched, rule spans carry their alert ids and the legend carries rule digits, and verdict and outcome pills carry words. Token contrast is tested in both themes.
- No motion unless a playback button is pressed, so a reduced-motion preference changes nothing about what the page does by itself; CSS transitions are disabled under `prefers-reduced-motion`.
- Touch targets of the primary controls are at least 40 px tall; on narrow screens the timeline scrolls inside its own frame so the page never overflows.

## Running locally

No build step and no installation. From the repository root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/lab/security-events/
```

Any static server works. Do not open the file with a `file://` URL: ES modules and absolute asset paths require an HTTP origin, exactly as on GitHub Pages.

## Reproducing the tests

Requirements: Node.js 20 or newer and Python 3.

```bash
npm test               # static integrity checks + syntax checks + unit tests (both labs)
npm run test:unit      # node --test tests/unit/*.test.js
```

The unit suites cover: sorting and tie-breaking; inclusive window boundaries and threshold boundaries for every rule; episodes; independence of sources and accounts; identical timestamps; out-of-order input; disabled rules; the per-account counter of the spray rule; R3 scopes and ordering of same-timestamp events; no events and zero alerts; configuration validation; the streaming detector (created/updated alerts, order enforcement, equivalence with batch detection); labels never influencing detection; evaluation metrics with hand-computed fixtures and zero denominators; grouping and comparison helpers; explanations; formatting; agreement with independent O(n²) reference implementations of all three rules on synthetic presets and on dense random traffic with ties and both scopes; the large preset and 20,000 tightly packed failures within a time budget; generator determinism, validity and limits across seeds; ground truth versus detection across 20 seeds (which rules catch which scenarios, the low-and-slow spray missed at the defaults and caught with a wider window, source scope hiding the distributed attack); strict import validation (fields, ids, timestamps, sources, labels, limits, error caps, JSON parsing); export/import round trips; WCAG contrast of the colour tokens; and the provenance of the portfolio card artwork.

Browser tests (Playwright, Chromium) run the page at desktop (1280 × 800), tablet (834 × 1112), mobile (375 × 667) and narrow (320 × 568) viewports and check: no console errors, failed requests or non-same-origin requests; no horizontal overflow; no duplicate ids; accessible names on every control; the CSP blocking injected inline scripts and styles; numbers on the page equal to the engine's output in Node (summary, alerts, scores, comparison, filters); reproducibility on reload; the investigation view; keyboard operation and focus management; playback (reset, step, play, pause, resume, show all, alerts appearing at their trigger event, focus when a control is disabled); reduced motion; threshold validation and reset; comparison mode; presets, seeds, the large preset's binned timeline and pagination; the JSON export; table filters; import validation, inert markup, file reading, size limits and the empty dataset's states; mobile touch; theme switching; internal and outbound links; and that the portfolio page lists four projects with the Security filter.

```bash
# one-off local setup outside the repository (no dependency is added to the site)
mkdir -p /tmp/playwright && cd /tmp/playwright && npm init -y && npm install playwright@1.56.1 && npx playwright install --with-deps chromium
cd -  # back to the repository
NODE_PATH=/tmp/playwright/node_modules npm run test:browser
```

Continuous integration (`.github/workflows/portfolio-ci.yml`) runs the static checks, syntax checks and unit tests on every pull request, then installs Playwright in the runner's temporary directory and runs the browser tests for both labs.

## Card preview provenance

The artwork on the Project 04 card in `index.html` is not an illustration: it is the engine's run on `generateDataset({ seed: 13, preset: 'card' })` at the default thresholds, drawn as one lane per source with short success marks, tall failure marks, the alert spans of the three rules, the events still to be replayed dimmed and the replay cursor at 72% of the events. `tests/unit/security-preview.test.js` regenerates it from the module and fails if the markup drifts from the real run.

## Extending the lab

- **Add a rule**: implement it inside `createDetector()` as a state machine fed by `push()`, give it an entry in `RULES` (id, code, order, subject, trigger, definition, parameters) and `DEFAULT_CONFIG`, add its explanation to `explainAlert()`, its inputs to `index.html` and `CONFIG_INPUTS` in `app.js`, and add fixture tests plus an O(n²) reference in `tests/unit/detection.test.js`.
- **Add a scenario kind**: describe it in `SCENARIO_KINDS` (verdict, title, description, likely rules), write a builder in `generateDataset()` that draws every random number from the shared PRNG in a fixed order, add it to a preset, and extend the ground-truth tests.
- **Add a preset**: add it to `PRESETS` and to the `<select>` in `index.html`; the tests iterate over every preset.
- **Change the schema**: update `EVENT_KEYS`, `validateEvents()`, `serialiseEvents()`, the schema text on the page and the validation tests together.
