# Domain Pitfalls

**Domain:** Cooperative server-authoritative web puzzle game — v1.1 additions
**Project:** LogiBlock
**Researched:** 2026-03-15
**Scope:** Adding irregular grid (cell mask), 10 custom piece shapes, and click-to-rotate / double-click-to-place to an existing working system

---

## How to Read This File

Pitfalls are ordered by severity within each tier. Each entry states which v1.1 feature area it belongs to and which implementation phase should handle it.

Feature tags:
- **[GRID]** — Irregular 5×9 grid with inactive cells
- **[PIEC]** — 10 custom piece shapes (3–5 cells)
- **[CTRL]** — Click = rotate, double-click = place
- **[INTG]** — Integration pitfall spanning multiple features

---

## Critical Pitfalls

Mistakes that cause silent wrong behavior, rewrites, or game-breaking bugs.

---

### Pitfall 1: `click` fires before `dblclick` — rotate fires once on every place

**Feature:** [CTRL]
**Phase:** CTRL implementation (client)

**What goes wrong:**
The browser always fires `click` before `dblclick`. The event sequence for a double-click is:
```
mousedown → mouseup → click → mousedown → mouseup → click → dblclick
```
If the `click` listener rotates the piece, the player experiences an unwanted +90° rotation every time they place. On each double-click, the piece rotates once, then places — the rotation the player sees before double-clicking is never the rotation that lands on the grid.

**Why it happens:**
The DOM does not suppress `click` when `dblclick` is about to follow. The browser does not know a second click is coming until after the double-click timeout (~300-500 ms, browser-defined). This is not configurable.

**Current code risk:** `main.js` uses `addEventListener('click', ...)` on every grid cell (line 215). Adding `addEventListener('dblclick', ...)` to the same cells will hit this problem immediately.

**Consequences:**
- Piece placed at wrong rotation on every double-click
- Ghost preview shows correct orientation but placed piece is always 90° ahead
- Bug is intermittent on slow double-clicks (the two clicks land on different cells), making it hard to reproduce consistently in testing

**Prevention:**
Use a delayed-click pattern — defer the `click` handler by a short timeout and cancel it if `dblclick` fires first:

```javascript
let clickTimer = null;
const DBLCLICK_DELAY = 280; // ms — stays under typical 300ms dblclick threshold

cellEl.addEventListener('click', () => {
  clickTimer = setTimeout(() => {
    // confirmed single click — rotate
    handleRotate();
    clickTimer = null;
  }, DBLCLICK_DELAY);
});

cellEl.addEventListener('dblclick', () => {
  clearTimeout(clickTimer);  // cancel the pending rotate
  clickTimer = null;
  handlePlace(r, c);
});
```

The delay must be shorter than the browser's dblclick detection window (typically 300-500 ms). 250-280 ms is a safe choice that feels responsive on most hardware.

**Detection:** Test by double-clicking quickly: the placed piece should match the last rotation shown in the ghost. If it has rotated once extra, the pitfall is active.

**Alternative:** Attach the `dblclick` listener only (no `click` on the grid), and move rotation to the bank piece click. This removes the timing problem entirely. The current v1.0 bank already rotates on repeated bank clicks (`main.js` line 262-264). Consider whether rotating on grid click is worth the click/dblclick complexity.

---

### Pitfall 2: Inactive cells treated as valid placement targets — server and client disagree

**Feature:** [GRID]
**Phase:** GRID server validation + client ghost preview

**What goes wrong:**
The current `placePiece()` in `game.js` (lines 118-127) only checks:
1. Row/column bounds against `puzzle.gridSize.rows` and `puzzle.gridSize.cols`
2. Whether `lobby.grid[r][c] !== null`

Inactive cells (corners cut from the 5×9) are not represented in the current schema. When the irregular grid is added, inactive cells must be stored in a way that makes them `!== null` so the server's existing `null` check catches them — OR a separate inactive-cell lookup must be added to every boundary check.

If the server marks inactive cells as `null` (using existing empty-cell convention), then:
- `placePiece()` will accept pieces placed on inactive cells
- The win check (`checkWin()` at `game.js` lines 78-91) iterates over all rows/cols and compares against `puzzle.solution[r][c]` — if solution marks inactive cells as `null`, a piece placed there would fail the win check, but the server would have accepted the move and emitted a valid state

This creates a state where a piece is "placed" on the grid at an inactive cell, the state update goes out to all clients, but the win condition is never reachable.

**Why it happens:**
Existing code conflates "empty valid cell" with `null`. Inactive cells need a third state.

**Current code risk:** `buildInitialGrid()` at line 226 fills all cells with `null` by default. If inactive cells are not pre-filled with a sentinel value, they are indistinguishable from valid empty cells at runtime.

**Consequences:**
- Pieces can be placed into inactive cell positions
- Game can never be won if a piece occupies an inactive cell (win check fails)
- Ghost preview shows valid placement on inactive cells
- Multiplayer desync if clients filter inactive cells differently from server

**Prevention:**
Two valid approaches — choose one and apply it consistently everywhere:

Option A (recommended): Pre-fill inactive cells in `buildInitialGrid()` with a sentinel object such as `{ inactive: true }`. Then update every check site:
```javascript
// In placePiece() validation loop:
if (lobby.grid[r][c] !== null) return { ok: false, error: 'Cell occupied' };
// becomes:
const cell = lobby.grid[r][c];
if (cell !== null) return { ok: false, error: 'Cell occupied or inactive' };
// Works automatically since inactive cells are non-null
```
Update `getPublicState()` to pass inactive cells through to the client (client needs to render them as inert / visually absent).
Update `checkWin()` to skip inactive cells in the solution (they should already be `null` in `puzzle.solution`).

Option B: Add a `puzzle.inactiveCells` set (e.g. `Set<"row-col">`) and check membership explicitly in every validation path. More explicit but requires touching more code paths.

**Detection:** Place a piece in a corner cell that should be inactive. Server should reject with an error. If no error arrives and the piece appears on the grid, the pitfall is active.

---

### Pitfall 3: Rotation pivot normalization loses relative position — piece "jumps" on rotate

**Feature:** [PIEC], [CTRL]
**Phase:** CTRL implementation (client side)

**What goes wrong:**
The existing `rotateCells()` always normalizes the result so that `minRow = 0, minCol = 0` (game.js lines 70-73, client main.js lines 26-33). This is correct for placing pieces but causes a visual discontinuity during interactive rotation.

When the player clicks to rotate while hovering over a grid cell, the ghost preview re-renders using the newly rotated + normalized cells anchored at the hovered cell as origin. For symmetric pieces (2×2, I-shape) the visual jump is small. For asymmetric 5-cell shapes with an off-center bounding box, the piece visually "teleports" to a different area of the grid after rotation.

**Why it happens:**
Normalization anchors the top-left corner of the bounding box to the origin cell. A 5-cell L-shape that spans rows [0–3] and cols [0–1] after rotation spans rows [0–1] and cols [0–3]. The bounding box shifts orientation, so the piece appears to jump relative to the hovered cell.

**Specific risk:** The new 5-cell custom shapes are described in PROJECT.md as "3–5 fields" with no constraint on symmetry. Highly asymmetric shapes with cells extending 4 units in one direction will produce the most extreme jumps.

**Consequences:**
- Confusing UX: rotate makes it look like the piece moved when the player's intent was only to change orientation
- Player may click to rotate once and think they need to move the cursor to find the piece again
- Not game-breaking, but "the most noticeable UX rough edge"

**Prevention:**
Instead of anchoring at hovered cell origin after rotation, compute a stable "pivot cell" — the cell within the shape that was closest to the cursor before rotation — and keep that cell pinned to the hovered grid position:

```javascript
// After rotating, find which offset in the new rotated cells corresponds to
// the previously hovered offset [hoverDR, hoverDC], then compute corrected origin
function rotatedOrigin(prevCells, nextCells, hoverDR, hoverDC, originRow, originCol) {
  // Find the index of the cell in prevCells closest to [hoverDR, hoverDC]
  // Map that index to nextCells and adjust origin so that index stays at [originRow, originCol]
}
```

For a simpler fix with good results: always treat offset [0,0] (top-left of bounding box) as the anchor. This is already what the code does — but ensure the cursor preview immediately re-queries the grid position on rotation rather than reusing the stale origin.

**Trade-off:** Full pivot tracking requires keeping per-rotation offset mapping. For a Uni submission, the simpler approach of just re-centering the ghost at the current cursor cell on rotate is acceptable and reduces implementation complexity.

---

### Pitfall 4: `checkWin()` still uses 2D array traversal — broken by irregular grid

**Feature:** [GRID], [INTG]
**Phase:** GRID server changes

**What goes wrong:**
`checkWin()` in `game.js` (lines 78-91) iterates every `[r][c]` of the full `puzzle.gridSize` bounding box and compares against `puzzle.solution[r][c]`. For the current rectangular puzzles, this works.

For the 5×9 irregular grid with inactive cells, `puzzle.solution` will need to represent inactive cells somehow (likely `null` as today). The problem: both inactive cells and valid-but-empty cells are `null` in the solution. If `puzzle.solution[r][c] === null` and `lobby.grid[r][c] === null`, the check passes — this is currently the case for empty valid cells too, but the win check returns `false` whenever any valid cell is unfilled.

The subtle failure: if inactive cells in `lobby.grid` are stored as `{ inactive: true }` (the sentinel from Pitfall 2), but `puzzle.solution[r][c] === null` for those cells, then `checkWin()` will hit the branch:
```javascript
if (expectedId === null) {
  if (cell !== null) return false; // inactive cell is not null → returns false!
}
```
The win condition will never be true, even when the puzzle is correctly solved, because inactive cells register as "unexpected pieces".

**Why it happens:**
The sentinel introduced to fix Pitfall 2 breaks the existing win check logic.

**Prevention:**
Update `checkWin()` to skip inactive cells explicitly:
```javascript
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const cell = lobby.grid[r][c];
    if (cell && cell.inactive) continue; // skip inactive cells
    const expectedId = puzzle.solution[r][c];
    // ... rest of existing logic
  }
}
```
The `puzzle.solution` can keep using `null` for inactive cells since they are skipped before comparison. Write a test that places all movable pieces correctly on an irregular grid and asserts `checkWin()` returns `true`.

---

### Pitfall 5: Puzzle JSON schema change breaks existing puzzle files silently

**Feature:** [GRID], [PIEC], [INTG]
**Phase:** GRID schema definition (Phase 1 of v1.1)

**What goes wrong:**
The new v1.1 puzzle needs:
- A cell mask or inactive-cells definition (new field)
- 10 custom shapes instead of 2-3 tetrominos
- A solution that covers exactly 43 active cells (not the full 5×9 = 45 bounding box)

The existing `validatePuzzleSchema()` in `game.js` (lines 245-266) does not validate:
- Whether solution dimensions match `gridSize`
- Whether all movable shapes together cover exactly the number of active cells
- Whether the `inactiveCells` field (or equivalent) is present or correctly formatted

If the new puzzle JSON omits the inactive-cell definition, `validatePuzzleSchema()` will pass silently. The server will `loadPuzzles()` without error, `buildInitialGrid()` will build a full 5×9 rectangle (all active), and the game will run with the wrong grid shape.

**Why it happens:**
`validatePuzzleSchema()` only checks for presence of required fields, not semantic correctness. Adding new required fields without updating the validator means new puzzles can be malformed and loaded without error.

**Consequences:**
- Wrong grid shape rendered (full rectangle instead of irregular)
- No crash, no error — silent wrong behavior
- Discoverable only by visually inspecting the game screen

**Prevention:**
Extend `validatePuzzleSchema()` when the schema changes. Specifically add:

1. Verify `puzzle.solution.length === puzzle.gridSize.rows` and `puzzle.solution[i].length === puzzle.gridSize.cols` for all rows
2. If using `inactiveCells` array: verify each entry is a valid `[r, c]` within gridSize bounds
3. Count active cells in solution and verify it equals the total cells of all movable shapes combined
4. Add a server-startup integration test: load the new puzzle, verify `validatePuzzleSchema()` throws for intentionally malformed fixtures

Old puzzles (puzzle_01.json, puzzle_02.json) should continue loading correctly. The new validator must be backward-compatible — do not add required fields that break existing files unless those fields have defaults.

---

### Pitfall 6: Ghost preview marks inactive cells as valid — visual mismatch with server

**Feature:** [GRID], [CTRL], [INTG]
**Phase:** Client ghost preview update

**What goes wrong:**
`updateGhostPreview()` in `main.js` (lines 374-392) checks:
```javascript
return r >= 0 && r < rows && c >= 0 && c < cols &&
       currentGrid && currentGrid[r][c] === null;
```
It checks bounds and that the cell is `null`. Inactive cells, if represented on the client as `{ inactive: true }`, are `!== null` and the ghost will mark those cells as `ghost-invalid`. This is correct behavior for the ghost-invalid styling — but only if the inactive sentinel is passed through `getPublicState()` to the client.

The failure case: if `getPublicState()` is updated to strip inactive cells (e.g. converting them back to `null` for client payload size), then `currentGrid[r][c] === null` becomes true for inactive cells, and the ghost preview shows them as valid placement targets — the opposite of the server's behavior.

**Prevention:**
Choose one consistent representation for inactive cells in client state and apply it to both the ghost check and the rendering logic. The safest approach: pass `{ inactive: true }` through `getPublicState()` unchanged. Update `renderGrid()` to add a CSS class `inactive` for these cells (rendered as visually absent or grayed out). Update `updateGhostPreview()` to also reject cells where `cell && cell.inactive`:
```javascript
const cell = currentGrid && currentGrid[r][c];
const isBlocked = cell !== null; // covers occupied AND inactive
return r >= 0 && r < rows && c >= 0 && c < cols && !isBlocked;
```

---

## Moderate Pitfalls

---

### Pitfall 7: Bank piece mini-grid preview does not update rotation on click

**Feature:** [PIEC], [CTRL]
**Phase:** CTRL client changes

**What goes wrong:**
In v1.1, left-clicking a grid cell rotates the selected piece. The bank piece preview (the small mini-grid inside each bank card) currently only updates when the piece is selected from the bank (via bank click). If rotation is moved to grid click, the bank display may stay at the pre-rotation orientation while the cursor piece and ghost preview show the current rotation.

**Current code risk:** `updateBankSelection()` in `main.js` (lines 329-344) rebuilds the mini-grid for the selected piece using `rotateCells(shape.cells, selectedRotation)`. It is called from the bank click listener. If grid-click rotation is added, `updateBankSelection()` must also be called from the grid click handler.

**Prevention:** After incrementing `selectedRotation` in the grid click handler, call `updateBankSelection()` immediately. This is a one-line fix but easy to forget when adding a new code path.

---

### Pitfall 8: `deselect on outside click` listener interferes with double-click

**Feature:** [CTRL]
**Phase:** CTRL client changes

**What goes wrong:**
`main.js` lines 398-407 attach a `document`-level `click` listener that deselects the piece when the user clicks outside the grid and bank. When the user double-clicks a grid cell to place a piece, the sequence is:
1. First click → triggers grid cell `click` → rotate (if using delayed pattern from Pitfall 1)
2. `dblclick` fires → place piece → server emits `game:stateUpdate` → `selectedShapeId = null`
3. Document-level `click` fires again (second click of the dblclick) — by this time `selectedShapeId` is already `null`, so no harm done

However, if the dblclick target is outside the grid (e.g. the piece bank area) and the player accidentally double-clicks in dead space, the document click handler deselects first — then `dblclick` fires with no piece selected and does nothing. This is acceptable behavior but may confuse players who try to place by double-clicking non-cell areas.

**Prevention:** No code change needed for correctness — document this as expected behavior. The dblclick listener should be attached only to grid cells, not the document.

---

### Pitfall 9: Rotation normalization mismatch between client and server for asymmetric shapes

**Feature:** [PIEC]
**Phase:** PIEC shape authoring + CTRL implementation

**What goes wrong:**
Both server (`game.js`) and client (`main.js`) implement `rotateCells()` independently (documented in main.js line 21 as "duplicated per no-build-tools constraint"). For symmetric shapes, both implementations produce identical results. For asymmetric 5-cell shapes, any difference in the normalization step will cause the server to reject moves the client considered valid.

The current normalization in both files is:
```javascript
const minR = Math.min(...rotated.map(([r]) => r));
const minC = Math.min(...rotated.map(([, c]) => c));
return rotated.map(([r, c]) => [r - minR, c - minC]);
```
This is identical and correct. The risk is if the client-side copy is modified during development without updating the server, or vice versa.

**Prevention:**
Run a manual cross-verification test for each of the 10 new piece shapes across all 4 rotations: log `rotateCells(cells, rotation)` on both server and client with the same input and assert outputs match. Add this as a sanity check in the test suite — pass the canonical shape definitions through `rotateCells` at 0/90/180/270 and verify the outputs are identical to manually computed expected values. This catches divergence before it reaches production.

Do not modify one copy without updating the other.

---

### Pitfall 10: `placePiece()` "shape already placed" check uses full grid scan — O(rows*cols) per move

**Feature:** [GRID], [PIEC]
**Phase:** GRID server changes

**What goes wrong:**
`placePiece()` in `game.js` (lines 105-113) scans the entire grid to check if a shape is already placed. For a 4×4 grid this is 16 cells — negligible. For a 5×9 grid with 45 bounding-box cells, it is still fast. This is not a performance problem for the Uni scope.

The moderate risk: if the new puzzle has more than 6 colors for `PIECE_COLORS` (currently `main.js` line 36 has 6 colors), and the 10 custom shapes are assigned colors by index, shapes 7-10 will cycle back to the same colors as shapes 0-3. With 10 pieces this means color collisions — two different pieces look identical on the grid.

**Prevention:**
Expand `PIECE_COLORS` to at least 10 entries before defining the custom shapes. Generate the extra colors to be perceptually distinct from the existing 6. Assign colors once at `initPieceColors()` time and they persist for the session.

---

### Pitfall 11: Server `validatePuzzleSchema()` does not verify total cell count

**Feature:** [PIEC], [GRID]
**Phase:** Schema validation extension

**What goes wrong:**
The project constraint is that 10 movable shapes must together cover exactly 43 active cells (matching the irregular 5×9 grid's active area). `validatePuzzleSchema()` currently has no check for this. A typo in a shape definition (e.g. a 5-cell piece defined with 4 cells) will pass validation, load successfully, and produce a puzzle that is mathematically unsolvable — there are not enough cells to fill the grid.

**Why it happens:**
The current validator checks structural validity (IDs, types, boolean fields) but not semantic validity (counts, coverage).

**Prevention:**
Add to `validatePuzzleSchema()`:
```javascript
// Count total movable cells and active cells
const movableCellCount = puzzle.shapes
  .filter(s => s.movable)
  .reduce((sum, s) => sum + s.cells.length, 0);
const activeCellCount = /* count non-null cells in puzzle.solution */
  puzzle.solution.flat().filter(id => id !== null).length;
if (movableCellCount !== activeCellCount) {
  throw new Error(
    `Movable shapes cover ${movableCellCount} cells but solution has ${activeCellCount} active cells`
  );
}
```
This catches off-by-one errors in shape definitions at startup.

---

### Pitfall 12: Client renders inactive cells as empty — players try to click them

**Feature:** [GRID]
**Phase:** Client grid rendering

**What goes wrong:**
If inactive cells are rendered identically to valid empty cells (both dark background, both have mousemove listeners), players will attempt to place pieces on them. The ghost preview will show `ghost-invalid` (once Pitfall 6 is fixed), the click will be sent to the server, and the server will reject it with an error. This creates a confusing UX loop.

**Prevention:**
In `renderGrid()`, add a CSS class for inactive cells that makes them visually distinct from valid empty cells. A common approach: make inactive cells a darker color with no hover effect, or hide them entirely (transparent/display:none). Do not attach `mousemove` or `click` listeners to inactive cells — use `pointer-events: none` CSS on inactive cells so they do not interfere with ghost preview or click handling.

---

## Minor Pitfalls

---

### Pitfall 13: `getPublicState()` sends raw 2D grid including inactive sentinels — payload size

**Feature:** [GRID], [INTG]
**Phase:** Server state serialization

**What goes wrong:**
`getPublicState()` passes `lobby.grid` directly (line 203: `grid: lobby.grid`). For a 5×9 = 45-cell grid, this is a flat 2D array of 45 entries. With inactive sentinels each entry adds `{ inactive: true }` objects. For a Uni demo with 2-4 players, this is negligible, but the JSON payload grows.

More importantly, the client's `renderGrid()` currently iterates using `state.grid[r][c]` as a flat 2D array. If the grid format changes to a sparse representation (e.g. a `Map<"r-c", cellObject>`), both `renderGrid()`, `updateGhostPreview()`, and `initPieceColors()` all need updating.

**Prevention:**
Keep the 2D array format for the grid. Do not switch to a sparse Map representation mid-milestone — the 2D array is simpler to iterate and the existing code is already consistent. The key decision is documented in PROJECT.md (`Grid stored as flat object keyed by "row-col" strings` — note: current code uses a 2D array, not a flat object; the PROJECT.md description is slightly inaccurate about the current grid representation).

Stick with 2D array. Pass inactive sentinel objects through unchanged. Update client rendering only.

---

### Pitfall 14: `selectedShapeId` not cleared after piece is placed via double-click

**Feature:** [CTRL]
**Phase:** CTRL client changes

**What goes wrong:**
In the current v1.0 code, `selectedShapeId` is cleared immediately in the `click` handler after emitting the place move (main.js line 222: `selectedShapeId = null`). In v1.1, the place action moves to the `dblclick` handler. If the `dblclick` handler forgets to clear `selectedShapeId`, the cursor piece keeps following the mouse after placement, and a subsequent click on any grid cell rotates a piece that is no longer in the bank (it was placed).

**Prevention:**
Mirror the existing `click` handler cleanup in the new `dblclick` handler:
```javascript
cellEl.addEventListener('dblclick', () => {
  clearTimeout(clickTimer);
  clickTimer = null;
  if (!selectedShapeId) return;
  socket.emit('game:move', { action: 'place', ... });
  selectedShapeId = null;      // clear immediately, before server ack
  selectedRotation = 0;
  clearGhostPreview();
  refreshCursorPiece();
  updateBankSelection();
});
```
The `game:stateUpdate` handler already clears selection (main.js lines 554-556), so this is a belt-and-suspenders measure, but it removes the visible lag between place and cursor disappearing.

---

### Pitfall 15: Test coverage gap — `placePiece()` does not test inactive cell rejection

**Feature:** [GRID], [INTG]
**Phase:** Any phase that modifies `placePiece()`

**What goes wrong:**
The 68 existing tests cover `placePiece()` for valid placements, out-of-bounds, occupied cells, and wrong-turn scenarios. None of them test placing a piece on an inactive cell because inactive cells do not exist in v1.0.

After adding inactive cell support, if the test suite is not extended, it is possible to ship a `placePiece()` implementation that fails the inactive-cell check only in certain cell configurations, while all 68 existing tests still pass.

**Prevention:**
For each new behavior added to `game.js`, add at least one test before or alongside the implementation. Minimum new tests needed:
- `placePiece()` rejects placement on inactive cell → error response
- `buildInitialGrid()` marks inactive cells correctly
- `checkWin()` returns `true` when all active cells are correctly filled (inactive cells non-null but marked inactive)
- `validatePuzzleSchema()` throws when movable cell count !== active solution cell count

---

### Pitfall 16: Rotating a 180°-symmetric piece looks like a no-op — UX confusion

**Feature:** [PIEC], [CTRL]
**Phase:** PIEC shape authoring

**What goes wrong:**
Some shapes (straight I-piece, S/Z-piece) have 2-fold rotational symmetry — rotating by 180° produces the same visual shape. Rotating a 4-step symmetric piece gives 4 identical states. Players clicking to rotate will see no visual change and think the rotation broke.

**Prevention:**
When designing the 10 custom shapes, avoid more than one 2-fold symmetric shape. If any symmetric shape is included, add a visual rotation indicator (e.g. an arrow or highlighted "front cell") to the ghost preview so the player can see orientation has changed even when the shape looks the same.

---

## Phase-Specific Warnings

| Phase Topic | Pitfall | Severity | Mitigation |
|-------------|---------|----------|------------|
| GRID server schema | Pitfall 5: new fields not validated | Critical | Extend `validatePuzzleSchema()` before writing grid logic |
| GRID server validation | Pitfall 2: inactive cells accepted as empty | Critical | Use non-null sentinel; update all check sites together |
| GRID server win check | Pitfall 4: sentinel breaks `checkWin()` | Critical | Update `checkWin()` in same commit as sentinel change |
| GRID client rendering | Pitfall 6: ghost accepts inactive cells | Critical | Pass sentinel through `getPublicState()`; update ghost check |
| GRID client rendering | Pitfall 12: inactive cells look clickable | Moderate | CSS `pointer-events:none` + distinct style |
| PIEC shape authoring | Pitfall 11: cell count mismatch | Moderate | Add validator count check before loading puzzle |
| PIEC shape authoring | Pitfall 16: symmetric shapes confuse rotation | Minor | Design shapes with asymmetry; add rotation indicator |
| PIEC color assignment | Pitfall 10: >6 shapes causes color collision | Moderate | Expand `PIECE_COLORS` to 10+ entries |
| CTRL click/dblclick | Pitfall 1: click fires before dblclick | Critical | Delayed-click timer pattern; test with fast double-click |
| CTRL rotation | Pitfall 3: piece "jumps" on rotate | Critical (UX) | Accept top-left anchor; re-query cursor position on rotate |
| CTRL bank update | Pitfall 7: bank mini-grid stale after grid-click rotate | Moderate | Call `updateBankSelection()` from grid click handler |
| CTRL deselect | Pitfall 8: document click vs dblclick | Moderate | Document expected behavior; no code change needed |
| CTRL cleanup | Pitfall 14: selectedShapeId not cleared on dblclick | Minor | Mirror existing click handler cleanup in dblclick |
| INTG rotation math | Pitfall 9: client/server rotateCells diverge | Moderate | Cross-verify all 10 shapes × 4 rotations in tests |
| INTG test coverage | Pitfall 15: no tests for inactive cell rejection | Minor | Write tests alongside each new `game.js` behavior |
| INTG serialization | Pitfall 13: grid payload format assumptions | Minor | Keep 2D array format; no sparse representation |

---

## Sources

- Code analysis of `/server/src/game.js` (LogiBlock v1.0, 2026-03-15)
- Code analysis of `/client/main.js` (LogiBlock v1.0, 2026-03-15)
- Code analysis of `/server/src/socket.js` (LogiBlock v1.0, 2026-03-15)
- MDN Web Docs — browser click/dblclick event ordering (established browser behavior, HIGH confidence)
- MDN Web Docs — MouseEvent dblclick timing (~300ms threshold is not configurable per spec, HIGH confidence)
- Existing test suite analysis: `game.test.js` 68 tests, no inactive-cell coverage
- Puzzle schema analysis: `puzzle_01.json`, `puzzle_02.json`
- Confidence: HIGH for all pitfalls derived from code analysis; MEDIUM for UX pitfalls (rotation jump) derived from established DOM/canvas game patterns
