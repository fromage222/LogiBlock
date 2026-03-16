# Project Research Summary

**Project:** LogiBlock v1.1 — Grid & Pieces Redesign
**Domain:** Cooperative server-authoritative web puzzle game with irregular grid and custom polyomino pieces
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

LogiBlock v1.1 is a targeted, additive upgrade to a working multiplayer puzzle game. Three orthogonal changes land on top of a stable v1.0 system: an irregular 5x9 grid with four inactive corner cells (43 active cells out of 45), ten custom polyomino-style pieces that tile those 43 cells exactly, and a new click interaction model (single-click rotates the selected piece, double-click places it). All research confirms that zero new npm packages or client-side libraries are required. Every mechanism maps directly onto existing patterns in `game.js` and `main.js`, and all changes are confined to four boundaries: the puzzle JSON schema, server-side validation logic, client rendering, and client event handling.

The recommended approach is to build strictly in dependency order: establish the data model first (the `{ inactive: true }` sentinel in `buildInitialGrid()` plus `inactiveCells` in puzzle JSON), then propagate that decision to server validation and win detection, then to client rendering, and finally to the interaction model. The interaction model change is the highest complexity item because the browser event sequence `click -> click -> dblclick` requires a `setTimeout`/`clearTimeout` disambiguation pattern — without it, every double-click (place) also applies an unwanted 90-degree rotation. All other changes are low-complexity, with the server-side `checkWin()` fix being a single line.

The primary risk is that the inactive cell sentinel decision is interdependent across five locations: `buildInitialGrid()`, `placePiece()`, `checkWin()`, `getPublicState()`, `renderGrid()`, and `updateGhostPreview()`. If any one site is updated without the others, the game enters a state where pieces land on inactive cells, the win condition never fires, or ghost preview disagrees with server validation — all silently. The mitigation is to treat the sentinel introduction as a single atomic commit that touches all affected sites, validated by a new test for each behavior added.

---

## Key Findings

### Recommended Stack

The v1.0 stack (Node.js 20 LTS, Express 4.x, Socket.IO 4.7, Vanilla JS ES2022+, HTML5, CSS3) is fully sufficient for v1.1. Research confirmed zero new dependencies needed. The `inactiveCells` extension is a JSON schema addition requiring no new runtime behavior. The `dblclick` event is a W3C standard DOM event; the `setTimeout`/`clearTimeout` disambiguation is five lines of idiomatic Vanilla JS. CSS Grid handles the irregular visual correctly via `pointer-events: none` and `background: transparent` on inactive cells — no Canvas, SVG, or gesture library is warranted.

**Core technologies (unchanged from v1.0):**
- **Node.js 20 LTS + Express 4.x**: Runtime and HTTP server — already validated and running
- **Socket.IO 4.7**: Real-time turn events — no new socket events needed; `game:move` payload is unchanged
- **Vanilla JS ES2022+**: All three feature areas implemented with native DOM APIs only
- **CSS3 / CSS Grid**: Inactive cell rendering via one new `.grid-cell.inactive` rule

**New additions (data and configuration only — no new dependencies):**
- `inactiveCells: [[r,c], ...]` optional field in puzzle JSON — backward-compatible
- `{ inactive: true }` sentinel object in the server grid 2D array
- `.grid-cell.inactive` CSS rule (5 lines)
- `PIECE_COLORS` array extended from 6 to 10 entries in `main.js`

### Expected Features

**Must have (table stakes — v1.1 is broken or misleading without these):**
- Inactive cell sentinel (`{ inactive: true }`) in the 2D grid array, passed unchanged through `getPublicState()` to the client
- Inactive cells visually inert: `background: transparent`, `border: none`, `pointer-events: none`, `cursor: default`
- Server rejects placement on inactive cells — handled automatically if sentinel is non-null, since `placePiece()` already guards `!== null`
- `checkWin()` skips inactive cells (one-line fix: `if (cell && cell.inactive) continue`)
- Ghost preview correctly treats inactive cells as invalid — handled automatically if sentinel flows through, since `updateGhostPreview()` already blocks non-null cells
- Click disambiguation: single-click rotates the selected piece (deferred ~200ms), double-click places
- Piece stays selected across rotations (grid single-click must not deselect `selectedShapeId`)
- Ghost preview re-renders after rotation (cache last-hovered cell; call `updateGhostPreview` from the click handler)
- New puzzle JSON for the 5x9 irregular grid with 10 pieces authored, validated at startup
- Piece bank handles 10 pieces without overflow (already handled by existing `max-height: 500px; overflow-y: auto`)
- 10 distinct piece colors (extend `PIECE_COLORS` from 6 to 10 entries to avoid color collisions)

**Should have (elevates demo quality):**
- Cursor feedback: `cursor: pointer` on active empty cells, `cursor: default` on inactive cells (pure CSS, no JS)
- Bank mini-grid shows rotated orientation immediately after grid-click rotation (call `updateBankSelection()` from the new click handler — one line, easy to miss)
- Tooltip on inactive cells via `title` attribute: "Not part of this puzzle" (one line of code)

**Defer to v2+:**
- CSS rotation animation on piece click
- Placement confirmation pulse animation on `.placed` cells
- Keyboard shortcut for rotation (R key) — not in spec, separate code path to maintain
- Mobile/touch support — explicitly out of scope per PROJECT.md
- Right-click to rotate — browser context menu interference makes this fragile

### Architecture Approach

The system architecture is entirely unchanged: Browser SPA communicates with the Node.js server exclusively via Socket.IO events. The server is authoritative for all game state. The v1.1 changes are confined to five locations — `puzzles/puzzle_v11.json` (new file), `server/src/game.js` (~15 lines modified across 4 functions), `client/main.js` (~30 lines modified across `renderGrid()` and click handlers), and `client/style.css` (5 lines added). Socket event names, payload shapes, lobby flow, timer, leaderboard, disconnect handling, and all 14 socket handler functions are explicitly unchanged.

**Component change surface for v1.1:**
1. **Puzzle JSON schema** — Add optional `inactiveCells: [[r,c],...]`; backward-compatible; existing puzzles unaffected
2. **`game.js: buildInitialGrid()`** — Populate inactive positions with `{ inactive: true }` sentinel; active cells remain `null`
3. **`game.js: checkWin()`** — One-line guard: `if (cell && cell.inactive) continue` before the solution comparison
4. **`game.js: validatePuzzleSchema()`** — Accept and validate optional `inactiveCells`; add movable-cell-count vs. active-solution-cell-count cross-check
5. **`client/main.js: renderGrid()`** — Detect `content.inactive`, apply `.inactive` CSS class, skip all event listener attachment for that cell
6. **`client/main.js: grid cell click handlers`** — Replace `click`-to-place with deferred `click`-to-rotate (200ms `setTimeout`) plus `dblclick`-to-place; shared `clickTimer` at `renderGrid()` scope
7. **`client/main.js: bank click handler`** — Remove rotation from re-click; bank click selects at rotation 0 only
8. **`client/style.css`** — Add `.grid-cell.inactive` rule; extend `PIECE_COLORS` array to 10 entries

**Unchanged components (explicitly):** `socket.js`, `server.js`, `advanceTurn()`, `returnPiece()`, `placePiece()` logic, `getPublicState()` function body, `renderBank()`, `renderTurnUI()`, `renderWin()`, `renderLeaderboard()`, `startLiveTimer()`, `updateGhostPreview()`, all socket event listeners, `index.html`, lobby flow.

### Critical Pitfalls

1. **`click` fires before `dblclick` — rotation applied on every place action.** Browser event order is `click -> click -> dblclick` for a double-click. Without disambiguation, each double-click unintentionally rotates the piece 90 degrees before placing it, so the placed rotation never matches what the player saw in the ghost preview. Prevention: use `setTimeout(rotate, 200)` in the `click` handler and `clearTimeout` in the `dblclick` handler. The `clickTimer` variable must be declared at `renderGrid()` scope — not inside the per-cell loop — so a double-click spanning two adjacent cells still cancels the pending rotation from the first click.

2. **`checkWin()` returns false forever once the sentinel is introduced.** The existing win check branch `if (cell !== null) return false` fires on inactive `{ inactive: true }` sentinels, making every solved puzzle register as unsolved. Prevention: add `if (cell && cell.inactive) continue` before the comparison. This fix must land in the same commit as the sentinel introduction in `buildInitialGrid()`.

3. **Inactive cells accepted as valid placement targets if the sentinel is null.** If inactive cells are stored as `null` in the grid, `placePiece()`'s existing `!== null` guard does not block them. Prevention: always use a non-null sentinel object `{ inactive: true }`. The existing guard then rejects inactive cell placements for free with zero code change to `placePiece()`.

4. **Ghost preview or `getPublicState()` strips the sentinel, causing client-server mismatch.** If `getPublicState()` were to convert inactive sentinels back to `null` for payload compactness, `updateGhostPreview()`'s `=== null` check would treat inactive cells as valid placement targets — the exact opposite of server behavior. Prevention: pass `{ inactive: true }` through `getPublicState()` unchanged. The `=== null` guard in `updateGhostPreview()` already blocks non-null cells, so no change is needed there.

5. **Puzzle loads silently with mismatched piece coverage.** If the 10 movable shapes total fewer or more than 43 active cells (e.g. due to a typo in a shape definition), `validatePuzzleSchema()` currently has no check for this. The server loads the puzzle without error; the game is mathematically unsolvable. Prevention: add a movable-cell-count vs. active-solution-cell-count cross-check in the validator at startup.

---

## Implications for Roadmap

Based on the dependency graph across all four research files, v1.1 naturally divides into four sequential phases. Each phase is independently testable before the next begins.

### Phase 1: Schema and Server Data Model

**Rationale:** The sentinel choice (`{ inactive: true }` in `grid[r][c]`) is the foundational decision that every other change depends on. It must be locked, implemented, and tested before any client work begins. Errors here cause silent wrong behavior — no runtime exceptions, just incorrect game state.

**Delivers:** New puzzle JSON with `inactiveCells`, updated `validatePuzzleSchema()` (with cell-count cross-check), updated `buildInitialGrid()` with sentinel, all 68 existing tests still passing, new tests for sentinel placement and schema validation.

**Addresses:** Table stakes — inactive cell sentinel, puzzle JSON schema, cell-count validation

**Avoids:** Pitfall 2 (inactive cells accepted as empty), Pitfall 5 (schema change breaks validation silently), Pitfall 11 (cell count mismatch leading to unsolvable puzzle)

### Phase 2: Server Logic Fixes

**Rationale:** With the sentinel established, `checkWin()` must be updated in the same commit window. The win check and the sentinel are tightly coupled — shipping the sentinel without the `checkWin()` fix creates a game that can never be won. `placePiece()` requires no change (already works).

**Delivers:** Correct win detection for the irregular 5x9 grid. Server correctly rejects placement on inactive cells (automatic via sentinel). New tests: inactive-cell rejection, win detection with an irregular grid, correct behavior when all 43 active cells are filled.

**Addresses:** Table stakes — server validation, win detection

**Avoids:** Pitfall 4 (`checkWin()` broken by sentinel), Pitfall 15 (test coverage gap for inactive cell behavior)

### Phase 3: Client Grid Rendering

**Rationale:** Once the server emits `{ inactive: true }` in the grid payload, the client must render it correctly. This phase is pure rendering — no interaction changes. It can be manually tested by visually inspecting the irregular puzzle in the browser before any click behavior is modified.

**Delivers:** Inactive cells rendered as visual gaps (transparent background, no border, no pointer events). `.grid-cell.inactive` CSS rule added. `renderGrid()` updated with inactive branch that skips event listener attachment. `PIECE_COLORS` extended to 10 distinct entries. Ghost preview remains automatically correct because the sentinel blocks the existing `=== null` check.

**Addresses:** Table stakes — visual inertness of inactive cells, ghost preview correctness, piece bank with 10 pieces without overflow

**Avoids:** Pitfall 6 (ghost marks inactive cells as valid), Pitfall 10 (color collision with 10 pieces), Pitfall 12 (inactive cells look clickable and receive mouse events)

### Phase 4: New Interaction Model

**Rationale:** The click/dblclick interaction change is the highest complexity item and must come last because it modifies the same `renderGrid()` function that was stabilized in Phase 3. The deferred `clickTimer` must live at `renderGrid()` scope, and the bank click handler must lose its rotation behavior simultaneously to avoid two conflicting rotation code paths existing at once.

**Delivers:** Single-click on a grid cell rotates the selected piece (deferred 200ms so dblclick can cancel it). Double-click on a grid cell places the selected piece. Bank click selects a piece at rotation 0 only (no more bank rotation). Ghost preview updates immediately after rotation via cached last-hovered cell. `selectedShapeId` cleared on dblclick placement. `updateBankSelection()` called from the grid click handler so the bank mini-grid reflects the current rotation.

**Addresses:** Table stakes — click disambiguation, rotation persistence, ghost update after rotation

**Avoids:** Pitfall 1 (click fires before dblclick causing unwanted rotation), Pitfall 3 (piece jumps on rotate due to bounding-box shift), Pitfall 7 (bank mini-grid stale after grid-click rotation), Pitfall 8 (document-level click listener interference with dblclick), Pitfall 14 (`selectedShapeId` not cleared on dblclick)

### Phase Ordering Rationale

- Phases 1 and 2 are pure server changes with zero client impact — safe to ship and independently test before any visual work begins
- Phase 3 depends on the sentinel flowing through `getPublicState()` (established in Phase 1) so it can be detected in `renderGrid()`
- Phase 4 depends on Phase 3's `renderGrid()` being stable, since Phase 4 adds new code paths within the same function
- The 68 existing tests provide a regression floor at every phase boundary
- New tests for inactive-cell behavior should be added in Phases 1 and 2 (alongside server logic) before any client code is written

### Research Flags

Phases with well-documented patterns (no additional research needed):
- **Phase 1 (Schema):** Backward-compatible optional JSON field — standard additive schema pattern, fully specified in STACK.md and ARCHITECTURE.md
- **Phase 2 (Server Logic):** `checkWin()` fix is one line; `placePiece()` requires no change; both documented with exact line references in ARCHITECTURE.md
- **Phase 3 (Client Rendering):** CSS Grid + `pointer-events: none` is W3C spec behavior; `renderGrid()` change is fully specified in ARCHITECTURE.md

Phases requiring a design decision before execution (not a research gap — the options are fully documented):
- **Phase 4 (Interaction Model):** Two valid disambiguation approaches are documented. FEATURES.md recommends `event.detail` (no artificial delay, but naturally produces one rotation per double-click). STACK.md and ARCHITECTURE.md recommend `setTimeout(200ms)` + `clearTimeout` (200ms latency on single-click, but cleanly separates the two actions and is resilient to OS-level dblclick timing variations). The team must pick one before writing code. See Gaps section for the recommendation.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All decisions verified against direct source code inspection; zero new dependencies confirmed by mapping each feature to existing code patterns |
| Features | HIGH | Table stakes derived from code analysis and MDN DOM spec; `event.detail` and `dblclick` event ordering verified against official documentation |
| Architecture | HIGH | Full source read of all production files (`game.js` 419 LOC, `socket.js` 237 LOC, `main.js` 589 LOC, `style.css` 362 LOC); change surface precisely quantified to ~50 lines across 4 files |
| Pitfalls | HIGH | All critical pitfalls derived from direct code analysis with exact line references; browser event order confirmed against MDN; MEDIUM only for UX judgment calls (rotation jump feel, 200ms delay perception) |

**Overall confidence:** HIGH

### Gaps to Address

- **Click disambiguation approach — pick one before Phase 4.** Two valid implementations are fully documented in FEATURES.md (event.detail) and STACK.md / ARCHITECTURE.md (setTimeout/clearTimeout). Recommendation: use `setTimeout(200ms)` + `clearTimeout` from ARCHITECTURE.md. It is more resilient across OS-level dblclick timing variations (300–500ms depending on OS settings), it cleanly separates the two event types regardless of `detail` value edge cases, and the 200ms delay is imperceptible for single-click rotation.

- **Inactive cell visual treatment — pick one before Phase 3.** Both `background: transparent` (STACK.md / ARCHITECTURE.md) and `visibility: hidden` (FEATURES.md) are valid. Recommendation: use `background: transparent` + `border: none` + `pointer-events: none` per ARCHITECTURE.md. It is explicit, unambiguous across all browsers for this use case, and avoids the `visibility: hidden` subtlety where some browsers may still fire pointer events.

- **Click delay constant value.** STACK.md uses 220ms, ARCHITECTURE.md uses 200ms, PITFALLS.md uses 280ms. All are within the safe range below the browser's dblclick threshold (~300–500ms). Recommendation: use 200ms as a named constant `DBLCLICK_DELAY = 200` — it is the most common convention and leaves comfortable margin below 300ms.

- **Puzzle JSON authoring (10 pieces).** Designing 10 custom polyomino shapes that tile exactly 43 cells is a content authoring task, not a code task. The validator (Phase 1) catches total-cell mismatches at startup. This is execution work, not a research gap. The shape-agnosticism of `buildMiniGrid()` and `rotateCells()` is confirmed — any `cells: [[r,c],...]` array works.

---

## Sources

### Primary (HIGH confidence — direct source code analysis)
- `server/src/game.js` (419 LOC) — full source read; all validation, placement, win-check, and state serialization logic inspected
- `server/src/socket.js` (237 LOC) — full source read; socket event routing and handler structure
- `client/main.js` (589 LOC) — full source read; rendering, event handling, ghost preview, state variables
- `client/style.css` (362 LOC) — full source read; existing cell states, layout rules, color palette
- `puzzles/puzzle_01.json`, `puzzles/puzzle_02.json` — full read; existing JSON schema structure confirmed

### Primary (HIGH confidence — official documentation)
- MDN — UIEvent.detail: `detail` property is Baseline Widely Available; values 1 and 2 confirmed for click events in double-click sequence
- MDN — Element dblclick event: browser event firing order `click -> click -> dblclick` confirmed; no known compatibility issues
- MDN — CSS visibility: `visibility: hidden` preserves CSS Grid layout space; confirmed for irregular grid holes vs. `display: none` which collapses tracks
- MDN — CSS pointer-events: `pointer-events: none` suppresses all mouse events on targeted elements; confirmed
- MDN — CSS grid-template-areas: named areas must form rectangles; irregular shapes cannot be expressed this way; confirmed approach of CSS class + transparent styling instead
- MDN — CSS cursor: `default`, `pointer`, `not-allowed` values confirmed for described use cases

### Secondary (MEDIUM confidence — established conventions)
- 200–280ms click disambiguation timeout: widely-used community convention for `setTimeout`/`clearTimeout` dblclick disambiguation; not specified in W3C DOM spec
- Rotation bounding-box jump / pivot normalization UX: established pattern from browser-based grid and puzzle game development; subjective threshold for "acceptable" jump is judgment

---
*Research completed: 2026-03-15*
*Covers: v1.1 additions only — irregular grid, 10 custom pieces, click-to-rotate / double-click-to-place interaction*
*Ready for roadmap: yes*
