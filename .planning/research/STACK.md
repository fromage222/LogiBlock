# Technology Stack

**Project:** LogiBlock — v1.1 Grid & Pieces Redesign
**Researched:** 2026-03-15
**Scope:** Additive research for irregular grid support, custom piece shapes, and new click interaction. The v1.0 stack (Node.js + Express + Socket.IO + Vanilla JS + CSS) is already validated and is not re-evaluated here.

---

## v1.1 Stack Decision: No New Dependencies

**Recommendation: Add zero new npm packages or client-side libraries.**

All three v1.1 features (irregular grid, custom piece shapes, new interaction model) are solved entirely within the existing stack using:
- JSON schema extensions to puzzle files
- Two new CSS classes
- Native DOM `dblclick` event + a `setTimeout` click disambiguator in Vanilla JS

Evidence: The existing code already has `buildMiniGrid()` (arbitrary cell arrays), `rotateCells()` (pure geometry), `renderGrid()` (CSS Grid on a 2D array), and `updateGhostPreview()` (cell-level DOM query). All three features extend these patterns — they do not require new abstractions.

---

## Recommended Stack (Existing — Unchanged)

### Core Framework — Server

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Node.js | 20 LTS | Runtime | Unchanged |
| Express.js | ^4.18 | HTTP + static file serving | Unchanged |
| Socket.IO | ^4.7 | Real-time events, room management | Unchanged |

### Core Framework — Client

| Technology | Version | Purpose | Status |
|------------|---------|---------|--------|
| Vanilla JavaScript (ES2022+) | — | Game UI, event handling, DOM | Unchanged |
| HTML5 | — | Markup | Unchanged |
| CSS3 | — | Styling, layout | Unchanged |
| socket.io-client | ^4.7 | Client socket | Unchanged |

---

## Feature-Specific Patterns (v1.1 Additions)

### Feature 1: Irregular Grid — Cell Mask in Puzzle JSON

**Decision: Use a `cellMask` 2D boolean array in the puzzle JSON.**

The current puzzle JSON schema has a `solution` array (2D, `rows × cols`). The `buildInitialGrid()` function and `checkWin()` both iterate full `rows × cols` loops against the solution. Adding a parallel `cellMask` array is zero-friction — every existing loop gains one guard check.

**Why `cellMask` over an `activeCells` coordinate list:**

The `solution` array is already a full 2D rectangle. A mask array mirrors that shape directly, making the two arrays index-compatible. An `activeCells: [[r,c], ...]` list requires a `Set` lookup (`activeCells.has(\`${r},${c}\`)`) in every hot path (win check, placement validation, ghost preview, rendering). A `cellMask[r][c]` lookup is O(1) direct array access with no conversion.

**Proposed JSON schema extension:**

```json
{
  "id": "puzzle_03",
  "name": "Corner-Cut 5x9",
  "gridSize": { "rows": 5, "cols": 9 },
  "cellMask": [
    [true,  true,  true,  true,  true,  true,  true,  true,  true],
    [true,  true,  true,  true,  true,  true,  true,  true,  true],
    [true,  true,  true,  true,  true,  true,  true,  true,  true],
    [true,  true,  true,  true,  true,  true,  true,  false, false],
    [true,  true,  true,  true,  true,  true,  true,  false, false]
  ],
  "shapes": [ ... ],
  "solution": [
    ["A","A","B","B","C","C","D","D","E"],
    ...
  ]
}
```

`true` = active cell (placeable, part of the puzzle). `false` = inactive/dead cell (rendered as blank, unreachable by game logic).

**Backward compatibility:** `cellMask` is optional. When absent, all cells are treated as active (matches v1.0 behavior). `validatePuzzleSchema` gains one optional check: if `cellMask` is present, verify it is a 2D array of `rows` × `cols` booleans, and that every `false` cell has `null` in `solution`.

**Server-side guard additions:**

```javascript
// In placePiece() — after bounds check:
if (puzzle.cellMask && !puzzle.cellMask[r][c]) {
  return { ok: false, error: 'Cell is not part of this puzzle' };
}

// In checkWin() — skip inactive cells:
const mask = puzzle.cellMask;
if (mask && !mask[r][c]) continue; // inactive cell — not part of win condition
```

**Confidence: HIGH** — This is a direct extension of the existing pattern in `game.js`. No API or library involved.

---

### Feature 2: Custom Piece Shapes

**Decision: No schema change needed. Existing `cells: [[r,c], ...]` format already handles arbitrary shapes.**

The current piece schema is:
```json
{ "id": "A", "cells": [[0,0],[1,0],[2,0]], "movable": true }
```

`cells` is an arbitrary list of `[deltaRow, deltaCol]` offsets from an origin. This already supports any connected shape of 3–5 cells. The constraint "not standard tetrominos" is a puzzle design constraint, not a code constraint.

`buildMiniGrid()` on the client renders any `cells` array into a bounding-box grid. `rotateCells()` (both server and client copies) transforms any cell array geometrically. No code changes are needed for arbitrary custom shapes.

The 10 new pieces simply need to be authored in the puzzle JSON with correct `cells` arrays. The only implementation work is designing and encoding the 10 shapes so they tile exactly 43 active cells.

**Confidence: HIGH** — `buildMiniGrid()` and `rotateCells()` are already shape-agnostic. Verified directly in `client/main.js` lines 274–293 and `server/src/game.js` lines 56–74.

---

### Feature 3: New Click Interaction (Single-click = rotate, Double-click = place)

**Decision: Use native `dblclick` DOM event + `setTimeout` single-click guard in Vanilla JS. No library.**

**The disambiguation problem:**

When the user double-clicks a grid cell, the browser fires: `click` → `click` → `dblclick` (in that order). Without disambiguation, the first `click` would trigger rotation, and the `dblclick` would trigger placement — but the second `click` would also trigger another rotation. This produces: rotate, rotate, place (instead of: rotate, place).

**Standard Vanilla JS pattern — delayed single-click:**

```javascript
let clickTimer = null;
const CLICK_DELAY = 220; // ms — below typical dblclick threshold (~300ms)

cell.addEventListener('click', () => {
  if (clickTimer) return; // first click of a double — let dblclick handle it
  clickTimer = setTimeout(() => {
    clickTimer = null;
    // handle single-click: rotate selected piece
    if (selectedShapeId) {
      selectedRotation = (selectedRotation + 90) % 360;
      updateBankSelection();
    }
  }, CLICK_DELAY);
});

cell.addEventListener('dblclick', () => {
  clearTimeout(clickTimer);
  clickTimer = null;
  // handle double-click: place selected piece
  if (selectedShapeId) {
    socket.emit('game:move', {
      action: 'place',
      shapeId: selectedShapeId,
      rotation: selectedRotation,
      originRow: r,
      originCol: c,
    });
    selectedShapeId = null;
    selectedRotation = 0;
    clearGhostPreview();
    refreshCursorPiece();
    updateBankSelection();
  }
});
```

**Why this pattern is correct:**

- `dblclick` always fires after the two `click` events in the same browser tick batch. `clearTimeout` inside `dblclick` cancels the first `click`'s pending callback before it executes — so rotation does not fire on double-click.
- The 220ms delay keeps single-click feeling responsive (under human perception threshold for feedback) while being safely below the browser's dblclick detection window (~300–500ms depending on OS settings).
- `clickTimer` is a module-level variable (like `selectedShapeId`), not per-cell — the grid is rebuilt on every `game:stateUpdate`, so per-cell closure state would be destroyed anyway.

**Why not use a library:**

Hammer.js and similar gesture libraries solve touch-gesture ambiguity. This project targets desktop-only (per PROJECT.md "Out of Scope: Mobile-Optimierung"). The `dblclick` event is a W3C standard DOM event, available in all desktop browsers since IE9. It requires zero dependencies and five lines of code.

**Interaction model change for non-selected state:**

When no piece is selected: single-click on a placed movable cell currently returns it to bank (v1.0 behavior). In v1.1, this action should remain a single-click (no disambiguation needed — double-click on a placed piece with nothing selected can be ignored or treated identically). Only the "piece selected + grid cell clicked" path needs the disambiguator.

**Confidence: HIGH** — `dblclick` is a native DOM event (MDN specification). The `setTimeout` cancel pattern is a well-established Vanilla JS technique requiring no external verification.

---

### Feature 4: Ghost Preview with Inactive Cells

**Decision: Add `cellMask` check to `updateGhostPreview()` on the client.**

Current logic in `main.js` lines 380–392:
```javascript
const valid = cells.every(([dr, dc]) => {
  const r = originRow + dr, c = originCol + dc;
  return r >= 0 && r < rows && c >= 0 && c < cols &&
         currentGrid && currentGrid[r][c] === null;
});
```

With irregular grid, a cell can be in-bounds (`r < rows, c < cols`) but inactive. The ghost must also check that the target cell is active. The server will send `gridMask` in the public state (a new field alongside `grid` and `gridSize`). Client caches it as `currentGridMask` and adds one guard:

```javascript
return r >= 0 && r < rows && c >= 0 && c < cols &&
       currentGrid[r][c] === null &&
       (!currentGridMask || currentGridMask[r][c]); // active cell check
```

This is a one-line change per guard. No new API, no library.

**Confidence: HIGH** — Direct extension of existing pattern in `main.js`.

---

## CSS Additions for Inactive Cells

**Decision: Add a single `.grid-cell.inactive` CSS rule.**

Current cell states in `style.css`: `.empty`, `.anchor`, `.placed`, `.ghost-valid`, `.ghost-invalid`.

Add:
```css
.grid-cell.inactive {
  background: transparent;
  border: none;
  pointer-events: none;
  cursor: default;
}
```

`background: transparent` makes the cell invisible against the page background. `pointer-events: none` prevents mousemove ghost-preview events from firing on inactive cells (important: the existing `mousemove` listener on each cell would otherwise still trigger ghost preview). `border: none` removes the 2px grid gap effect from the `.grid` background color showing through.

In `renderGrid()`, inactive cells receive class `inactive` instead of `empty` and get no event listeners. The condition is:
```javascript
if (cellMask && !cellMask[r][c]) {
  cell.classList.add('inactive');
  gameGrid.appendChild(cell);
  continue; // skip all event listener attachment
}
```

**Why not `visibility: hidden`:** `visibility: hidden` preserves the element's space (correct) but still receives `pointer-events` by default in some browsers unless explicitly disabled. Using `background: transparent` + `pointer-events: none` is unambiguous and has the same visual result.

**Why not `display: none`:** `display: none` removes the cell from the CSS Grid flow, collapsing that grid track. The irregular shape would no longer render correctly — active cells in the same column would shift position.

**Confidence: HIGH** — CSS Grid behavior for transparent/hidden cells is well-established spec behavior.

---

## What NOT to Add

| Category | Avoid | Reason |
|----------|-------|--------|
| Gesture library | Hammer.js, interact.js | Project is desktop-only. `dblclick` is a native DOM event. Zero need. |
| Canvas rendering | `<canvas>` element | CSS Grid already renders the puzzle grid correctly. Canvas requires imperative hit-testing to replace working declarative DOM event handling. Pure regression. |
| JSON Schema validator | `ajv`, `zod`, `joi` | `validatePuzzleSchema()` in `game.js` is already a custom validator with clear error messages. Adding `cellMask` requires ~6 lines to that function. An npm package for this is over-engineering a uni project. |
| SVG grid rendering | SVG `<polygon>` / `<path>` | Necessary only for non-rectangular cell shapes (hexagons, triangles). All cells here are squares — CSS Grid handles rectangles natively. |
| State management library | Redux, Zustand, XState | Client state is 5 module-level variables (`selectedShapeId`, `selectedRotation`, `currentGrid`, `currentGridSize`, `currentBankShapes`). Adding a state library to manage 5 variables is architectural overkill. |
| Click delay library | `jquery.dblclick-fix` etc. | The `setTimeout` + `clearTimeout` pattern is 5 lines of idiomatic Vanilla JS. |

---

## Summary of Code Changes Required (No New Dependencies)

| Area | File | Change | Size |
|------|------|--------|------|
| JSON schema | `puzzles/puzzle_03.json` | Add `cellMask` 2D boolean array | Schema addition |
| Schema validation | `server/src/game.js` `validatePuzzleSchema()` | Validate `cellMask` shape if present | ~6 lines |
| Grid initialization | `server/src/game.js` `buildInitialGrid()` | No change — mask is separate from grid state |
| Win check | `server/src/game.js` `checkWin()` | Skip inactive cells via `cellMask` | +2 lines |
| Placement validation | `server/src/game.js` `placePiece()` | Reject placement on inactive cells | +3 lines |
| Public state | `server/src/game.js` `getPublicState()` | Include `gridMask` from puzzle | +1 line |
| Grid rendering | `client/main.js` `renderGrid()` | Add `.inactive` path, cache `currentGridMask` | ~8 lines |
| Ghost preview | `client/main.js` `updateGhostPreview()` | Add `cellMask` guard | +2 lines |
| Click interaction | `client/main.js` grid cell listeners | Replace `click` with `dblclick` + `setTimeout` single-click | ~20 lines |
| CSS | `client/style.css` | Add `.grid-cell.inactive` rule | 5 lines |

---

## Confidence Assessment

| Claim | Confidence | Basis |
|-------|------------|-------|
| `cellMask` 2D boolean array is the right irregular grid format | HIGH | Direct inspection of `game.js` loops; mirrors `solution` shape exactly |
| Existing `cells: [[r,c]]` format supports arbitrary custom shapes | HIGH | `buildMiniGrid()` and `rotateCells()` are already shape-agnostic; read in `main.js` |
| `dblclick` + `setTimeout` disambiguates single vs double click | HIGH | Standard DOM specification behavior; `dblclick` fires after both `click` events |
| `pointer-events: none` on `.inactive` prevents ghost preview leakage | HIGH | CSS specification; verified against existing `mousemove` listener pattern |
| No new npm packages needed | HIGH | Every mechanism maps to existing code patterns in the codebase |
| 220ms `CLICK_DELAY` is below browser dblclick threshold | MEDIUM | Typical OS dblclick timeout is 300–500ms; 220ms is conservative but not verified against all OS settings |
