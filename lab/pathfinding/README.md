# Interactive Robotics & Pathfinding Lab

Project 03 of [arthur-fay.github.io](https://arthur-fay.github.io/). Live page (after merge and deployment): `https://arthur-fay.github.io/lab/pathfinding/`.

An interactive, dependency-free demonstration of grid pathfinding. You draw walls and weighted terrain on a 2D grid, place a start and a target, and run **breadth-first search**, **Dijkstra's algorithm** or **A\*** with animated exploration, pause/resume/step/stop controls, deterministic layout generation and results measured from the run that just happened in the browser.

> **Scope statement.** This is a grid-based *algorithm simulation*, not a validated real-world robotics navigation system. The "robot" is an abstract agent on discrete cells with exact, deterministic costs. There is no localisation, sensing, kinematics, uncertainty, dynamic obstacle handling or continuous-space planning.

## Contents

1. [Purpose and limitations](#purpose-and-limitations)
2. [Architecture](#architecture)
3. [The simulation model](#the-simulation-model)
4. [Algorithms](#algorithms)
5. [Complexity and trade-offs](#complexity-and-trade-offs)
6. [Correctness guarantees and assumptions](#correctness-guarantees-and-assumptions)
7. [Measurements shown in the UI](#measurements-shown-in-the-ui)
8. [Accessibility](#accessibility)
9. [Running locally](#running-locally)
10. [Reproducing the tests](#reproducing-the-tests)
11. [Extending the lab](#extending-the-lab)

## Purpose and limitations

**Purpose.** Show engineering competence in a verifiable way: correct, tested implementations of three classic graph searches; a clean separation between algorithm and presentation; an accessible, responsive interface; and honest measurement.

**What the lab does**

- Interactive grid with four preset sizes (21 × 13 up to 61 × 37 cells).
- Draw, erase and reset walls and weighted terrain by pointer (click/drag, touch) or keyboard.
- Move the start and target markers (drag them, or use the Start/Target tools).
- Run BFS, Dijkstra or A* with 4-directional or 8-directional movement.
- Animate the frontier, the expanded cells and the final route; pause, resume, step one expansion at a time, stop, and clear.
- Report path length (moves), path cost (weighted), expanded cells and the pure search time.
- Generate deterministic layouts from a seed: a perfect maze (recursive backtracker, lightly braided) or a random field of walls and terrain.
- Explain each algorithm, the rules of the simulation, what the numbers mean and what the lab does not claim.

**What it does not do**

- No real-world robotics: no sensors, odometry, kinematic or dynamic constraints, no continuous space, no replanning while moving.
- Weights are fixed (open = 1, terrain = 5); there is no per-cell custom weight editor.
- The grid is static during a search; moving obstacles are out of scope.
- Timings are observations on the visitor's device and browser, not benchmarks. They are never stored or transmitted.
- No persistence or sharing of hand-drawn maps (seeded layouts are reproducible by design).

## Architecture

```
lab/pathfinding/
├── index.html       page markup: shared header/footer, controls, grid container, explanations
├── lab.css          page styles built on the portfolio's design tokens (/styles.css)
├── app.js           UI module (ES module): rendering, input, run state machine, status/stats
├── pathfinding.js   pure algorithm module (ES module): no DOM, no side effects
└── README.md        this document

tests/
├── unit/pathfinding.test.js    Node built-in test runner; imports pathfinding.js directly
├── unit/contrast.test.js       WCAG contrast of the lab's colour tokens in both themes
├── browser/lab.test.js         Playwright (Chromium) tests at desktop and mobile viewports
└── browser/helpers/server.js   static server emulating GitHub Pages for the browser tests
```

Design decisions:

- **Dependency-free, like the rest of the portfolio.** Plain HTML/CSS/JS, ES modules loaded with `<script type="module">`, the same strict Content-Security-Policy as the home page (`default-src 'none'; script-src 'self'; style-src 'self'; …`). No inline styles or scripts, no fonts, analytics, trackers or third-party code. The only `package.json` fields are `"type": "module"` (so Node can import the ES modules in tests) and scripts; there are no dependencies.
- **Algorithms are generators.** Each search is a `function*` that yields one `{ type: 'expand', index, g, f, discovered }` event per expanded cell and *returns* the result object. `runSearch()` drains a generator into a trace while timing the pure computation. The UI replays the trace with `requestAnimationFrame`, so pause, resume, step and stop are operations on a cursor into an immutable array; nothing in the algorithm knows about animation.
- **The grid is never mutated by a search.** Searches read `grid.cells` (a `Uint8Array`) and allocate their own working arrays.
- **Deterministic everything.** Fixed neighbour order, heap ties broken by (f, h, insertion order), and a seeded PRNG (mulberry32) for layouts, so any run can be reproduced exactly in tests and across browsers.
- **Shared header behaviour.** `/script.js` (theme toggle, mobile navigation, reading progress) is reused unchanged in behaviour; it now guards each optional element so a page can omit any of them.

## The simulation model

| Element | Definition |
| --- | --- |
| Grid | `cols × rows` cells, row-major `Uint8Array`; `0` open, `1` wall, `2` terrain |
| Walls | Impassable. The start and target can never be walls. |
| Weights | Entering an open cell costs `1 × step length`; entering terrain costs `5 × step length` |
| 4-directional | N, E, S, W; step length 1 |
| 8-directional | adds NE, SE, SW, NW with step length √2; **no corner cutting**: a diagonal move is legal only when both orthogonal cells it passes between are not walls |
| Path cost | Sum of move costs. The start cell's own weight is never paid; the target's weight is paid on entry. |
| Path length | Number of moves |
| Termination | Every search stops when the target is *dequeued*, so expansion counts are comparable |

## Algorithms

All three are instances of best-first search on the same implicit graph; they differ in the queue discipline.

**Breadth-first search** — FIFO queue; each cell is enqueued at most once when discovered. Expands cells in non-decreasing order of depth (number of moves), so the first time the target is dequeued it has been reached with the fewest moves. BFS ignores edge costs entirely. The lab recomputes the *weighted* cost of the BFS route with `validatePath()` so its non-optimality on weighted or 8-directional maps is visible, and the UI says so explicitly.

**Dijkstra** — best-first on `g` (cost so far) with a binary min-heap and lazy deletion: when a better `g` is found for a cell, a new heap entry is pushed and stale entries are skipped on pop (`closed[i] || entry.g > g[i]`). With non-negative costs the first pop of a cell is final.

**A\*** — best-first on `f = g + h`. `h` is the Manhattan distance `|dx| + |dy|` for 4-directional movement and the octile distance `max(|dx|,|dy|) + (√2 − 1)·min(|dx|,|dy|)` for 8-directional movement. Ties on `f` are broken by smaller `h`, then by insertion order. Dijkstra and A* share one implementation (`bestFirst`) parameterised by the heuristic; Dijkstra is the `h = 0` case.

**Layout generators** (`generateMaze`, `generateRandomField`) use `mulberry32(seed)`. The maze is carved on the odd-coordinate lattice with an explicit stack (iterative recursive backtracker), giving one-cell corridors and one-cell walls with a solid border; a deterministic fraction of walls between corridors (`braid`, default 8 %) is reopened afterwards to create loops. The random field assigns each cell wall/terrain/open independently and keeps the start and target open; a route is deliberately not guaranteed so the "no route" outcome can be demonstrated.

## Complexity and trade-offs

With `V = cols × rows` cells and `E ≤ 4V` (4-dir) or `E ≤ 8V` (8-dir) edges:

| Algorithm | Time | Memory | Guarantee on this grid |
| --- | --- | --- | --- |
| BFS | O(V + E) | O(V) | Fewest moves. Lowest cost only when all moves cost the same (4-dir, no terrain). |
| Dijkstra | O((V + E) log V) with a binary heap (lazy deletion can hold up to O(E) entries) | O(V + E) worst case for the heap, O(V) otherwise | Lowest cost for any non-negative weights. |
| A* | O((V + E) log V) worst case; usually far fewer expansions than Dijkstra | as Dijkstra | Lowest cost, given an admissible and consistent heuristic. |

Trade-offs made here:

- A binary heap with lazy deletion instead of a decrease-key structure: simpler, fewer bugs, and `O(log V)` per operation is more than enough for ≤ 2,257 cells.
- Checking the goal when dequeued (not when discovered) for all three searches. BFS could legally stop earlier on discovery; the common rule keeps the "expanded cells" numbers comparable across algorithms.
- Closed cells are never reopened. This is correct because the heuristics are consistent (see below). A* with an inconsistent heuristic would need reopening to stay optimal.
- Floating-point costs (√2 for diagonals). Tests compare costs with a 1e-9 tolerance. Integer scaling (10/14) was rejected because it changes the metric the heuristics are defined on.

## Correctness guarantees and assumptions

- **Admissibility.** Under both movement modes every move costs at least its geometric step length (1 or √2) because the minimum cell weight is 1. The Manhattan distance is the length of the shortest 4-directional walk ignoring walls, and the octile distance is the length of the shortest 8-directional walk ignoring walls, so neither can exceed the true cost of any route. Hence `h ≤ h*` and A* is optimal.
- **Consistency.** For any legal move `u → v` with cost `c`, the heuristic decreases by at most the step length: Manhattan by at most 1 per orthogonal move, octile by at most 1 (orthogonal) or √2 (diagonal). Since `c ≥` step length, `h(u) ≤ c + h(v)`. The tests check this inequality on every edge of random weighted grids.
- **BFS correctness.** Each cell is discovered once via the FIFO queue, so the depth of the target when dequeued equals its shortest move distance (verified against an independent reference BFS in the tests).
- **Path validity.** Every path returned by any algorithm is re-validated move by move (`validatePath`): starts at the start, ends at the target, no repeated cells, every move legal under the movement rules including the no-corner-cutting constraint, and the recomputed cost equals the reported cost.
- **No-route detection.** When the target is unreachable, every algorithm expands exactly the set of cells reachable from the start (tests compare against a flood fill).
- **Assumptions.** Non-negative, finite weights; static grid during a search; start and target are not walls (the UI enforces this; the module throws otherwise); dimensions ≤ 400 per side (`MAX_DIMENSION`).

## Measurements shown in the UI

| Measurement | Meaning |
| --- | --- |
| Path length | Number of moves on the final route |
| Path cost | Sum of move costs along the route (for BFS: recomputed from the weighted grid, labelled "fewest moves, not lowest cost" when optimality is not guaranteed) |
| Expanded cells | Number of cells dequeued and processed (closed set), including the target. Cells shown as "frontier" were discovered but not expanded. |
| Search time | `performance.now()` around the pure JavaScript search, measured before animation starts. Includes the cost of recording the trace. Varies with device, browser, timer resolution and JIT warm-up; the first run is usually slower. It is an observation, not a benchmark, and is never stored or sent anywhere. |

## Accessibility

- The grid is an ARIA `grid` of `row`/`gridcell` elements with a roving tab stop: Tab reaches the active cell; arrow keys, Home/End, Ctrl+Home/End and PageUp/PageDown move; Enter/Space applies the selected tool; keys 1–5 switch tools.
- Every cell has an `aria-label` describing its position and state; the label is refreshed on focus and on change.
- Outcomes, pauses, steps, stops, resizes and layout generation are announced through a `role="status"` live region.
- Controls are native `<button>`, `<input type="radio">`, `<select>`, `<input type="range">` and `<input type="checkbox">` elements with visible labels and visible focus indicators (the portfolio's accent outline, inverted on dark cells).
- Colour is never the only signal: the start and target carry "S"/"T" glyphs, terrain is hatched, frontier cells have an inner outline and path cells a centred dot.
- `prefers-reduced-motion: reduce` turns animation off by default (the result appears immediately); the user can still opt in, and Step always works one expansion at a time.
- Touch: the grid uses `touch-action: pinch-zoom`, so dragging paints while pinch-zoom still works; the grid's height is capped so the page remains scrollable around it.

## Running locally

No build step and no installation. From the repository root:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/lab/pathfinding/
```

Any static server works (`npx serve`, `npx http-server`, …). Do not open the file with a `file://` URL: ES modules and absolute asset paths (`/styles.css`) require an HTTP origin, exactly as on GitHub Pages.

## Reproducing the tests

Requirements: Node.js 20 or newer and Python 3.

```bash
npm test               # static integrity checks + syntax checks + unit tests
npm run test:unit      # node --test tests/unit/*.test.js
```

The unit suite covers: grid helpers; neighbour generation, costs and the no-corner-cutting rule; heuristic values, consistency on every edge of random weighted grids and sampled admissibility; the binary heap; the empty grid; start equal to target; unreachable targets (expanded set equals the reachable component); weighted terrain (BFS vs Dijkstra/A*); dense random obstacles (40 layouts × 2 movement modes); perfect mazes (border, one-cell corridors, unique path returned identically by all algorithms and both movement modes); deterministic layouts and the PRNG; trace semantics (each cell expanded/discovered at most once, keys non-decreasing, BFS depths equal to a reference BFS); determinism of traces; cancellation part-way through a search; repeated input changes without grid mutation; a property check that A* and Dijkstra return equal optimal costs on 150 seeded layouts in both movement modes; path validation; and the largest preset grid.

Browser tests (Playwright, Chromium) run the page at desktop (1280 × 800), tablet (834 × 1112) and mobile (375 × 667) viewports and check: no console errors or failed requests; no horizontal overflow; every control (run, pause/resume, step, stop, clear, generate, seeds, size, movement, algorithm, speed, animate, tools); keyboard navigation and activation inside the grid; pointer painting and marker dragging; the unreachable-target message; deterministic layouts; reduced-motion behaviour; light/dark themes; accessible names on all controls; internal links on both pages; and that the portfolio page still filters three projects and opens its mobile navigation.

```bash
# one-off local setup outside the repository (no dependency is added to the site)
mkdir -p /tmp/playwright && cd /tmp/playwright && npm init -y && npm install playwright@1.56.1 && npx playwright install --with-deps chromium
cd -  # back to the repository
NODE_PATH=/tmp/playwright/node_modules npm run test:browser
```

Continuous integration (`.github/workflows/portfolio-ci.yml`) runs the static checks, syntax checks and unit tests on every pull request, then installs Playwright in the runner's temporary directory and runs the browser tests.

## Extending the lab

- **Add an algorithm** (for example greedy best-first or bidirectional BFS): implement a generator in `pathfinding.js` with the same event contract (`yield { type: 'expand', index, g, f, discovered }`, `return { found, path, steps, cost, expanded, discovered, maxFrontier }`), register it in `SEARCHES` and `ALGORITHMS`, add an `<option>` in `index.html` and a hint in `ALGORITHM_HINTS` in `app.js`, then extend `assertValidResult`-based tests. If the new algorithm is not optimal, set `costOptimalityGuaranteed` accordingly in `runSearch`.
- **Add a layout generator**: a function `(cols, rows, seed, options) → { grid, start, target }` using `mulberry32(seed)` for every random draw in a fixed order; register it in `LAYOUTS` and add an `<option>`; add a determinism test.
- **Add a heuristic**: export it, map it in `heuristicFor`, and add it to the consistency and admissibility tests. Weighted (inadmissible) heuristics such as `ε·h` would also require enabling node reopening in `bestFirst` or clearly labelling the result as bounded-suboptimal.
- **Custom weights**: store the weight per cell instead of a type code (`Uint8Array` → `Float32Array` or a lookup table), keep the minimum weight ≥ 1 or scale the heuristics by the minimum weight to preserve admissibility.
- **Another lab page**: create `lab/<name>/` with its own `index.html`, add it to `sitemap.xml`, to `REQUIRED` in `scripts/check_site.py` and as a card in `index.html`.
