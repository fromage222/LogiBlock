# Feature Landscape

**Domain:** Irregular grid puzzle games with custom piece shapes and click-based interaction
**Project:** LogiBlock v1.1 — Grid & Pieces Redesign
**Researched:** 2026-03-15
**Scope note:** This document covers ONLY the v1.1 additions. All v1.0 features (lobby, shared bank, server validation, timer, leaderboard) are already shipped and are not re-researched here.

---

## Context: What v1.1 Adds to an Already-Working Game

Three orthogonal changes to the existing codebase:

1. **Irregular grid shape** — Replace the rectangular active zone with a 5x9 bounding box that has its bottom-left and bottom-right corners removed (43 active cells out of 45). The grid is still stored as a full rows×cols 2D array; inactive cells contain a sentinel value rather than being absent.
2. **Custom piece shapes** — Replace the existing 2–3 shapes per puzzle with 10 custom polyomino-style shapes (3–5 cells each) that together exactly fill the 43 active cells. Defined in puzzle JSON exactly as today.
3. **New interaction model** — Replace "click bank piece to select, click grid cell to place" with "click grid cell to rotate selected piece, double-click grid cell to place."

These three changes affect: the puzzle JSON schema, server-side validation (bounds checking and win detection must skip inactive cells), and client-side rendering + event handling.

---

## Table Stakes

Features that must work correctly or the v1.1 game is broken or misleading. Absence = product fails.

| Feature | Why Required | Complexity | Notes |
|---------|-------------|------------|-------|
| Inactive cell sentinel in grid data | Without a way to distinguish "inactive hole" from "empty active cell", both server validation and client rendering are wrong. Must be decided before writing any new code. | Low | Recommend `false` or a distinct object `{ active: false }` as the sentinel. `null` currently means "active but empty"; that contract must be preserved or updated consistently. |
| Inactive cells visually inert | Players must immediately see which cells are part of the puzzle and which are structural holes. If holes look like empty cells, every hover and placement attempt fails in confusion. | Low | CSS: darker background, no border highlight on hover, `pointer-events: none` to suppress all mouse events, `cursor: default`. |
| Ghost preview skips inactive cells | Ghost preview must treat inactive cells as impassable boundaries, not as valid empty positions. A piece that overlaps an inactive cell must show `ghost-invalid`. | Medium | Existing `updateGhostPreview` checks `currentGrid[r][c] === null` — must also check that the cell is active. Need a helper `isActive(r, c)` usable from client without exposing grid internals. |
| Server validation skips inactive cells | `placePiece` must reject any placement where a piece cell lands on an inactive grid position. Win detection must only compare active cells (not inactive ones). | Medium | `checkWin` currently compares every `[r][c]` in `gridSize.rows × gridSize.cols` against `solution[r][c]`. When solution uses `null` for both "inactive" and "intentionally empty", the distinction collapses. The solution schema must encode inactive cells differently from active-but-empty cells, or `checkWin` uses a separate `activeCells` set. |
| Piece bank renders all 10 shapes correctly | 10 pieces means the bank UI must handle more items than before (was 2–3 in v1.0 puzzles). Overflow, spacing, and mini-grid sizing must accommodate 3–5 cell shapes of arbitrary shape. | Low | Existing `buildMiniGrid` is already generic — works for any cell array. Only CSS layout of the bank container needs review for 10 items. |
| Rotation updates ghost preview immediately | With the new model, single-click rotates. The ghost preview (already tied to the hovered cell) must re-render at the new rotation on every click. | Low | Current code already rebuilds ghost preview when `selectedRotation` changes via `updateGhostPreview(r, c)`. Must trigger ghost re-render on click, not just on mousemove. |
| Double-click places piece, single-click rotates | The defined interaction for v1.1. If both fire (because `dblclick` always follows two `click` events), the piece rotates twice before placing — which is a bug. Must separate single-click and double-click handling. | High | Browser event order: `click` → `click` → `dblclick`. If listening to both `click` and `dblclick` on the same cell, both handlers fire. Use `event.detail` on the `click` event (`detail === 1` = single, `detail === 2` = double-click's first sibling) or a timeout-based debounce. See Interaction section below. |
| Piece stays selected across rotations | Rotating (clicking) must not deselect the piece. The user must be able to rotate to desired orientation then double-click to place — without re-selecting from the bank. | Low | Current code deselects on grid click. Must change: grid single-click increments `selectedRotation` without clearing `selectedShapeId`. |
| Win detection works with 43-cell puzzle | `checkWin` must correctly identify a complete solve when all 43 active cells are filled in the correct configuration and all inactive cells are left as their sentinel value. | Medium | This is a correctness test, not a new feature. Add TDD coverage for the 5×9 irregular grid case specifically before touching `checkWin`. |
| Puzzle JSON schema supports inactive cells | The puzzle JSON must be able to express the 5×9 shape with corners removed. The schema must be unambiguous and validated at startup by `validatePuzzleSchema`. | Low | Two viable approaches: (A) add an `activeCells` array to the puzzle (list of `[r,c]` that are active); (B) encode inactive cells in the solution as a distinct value (e.g., `"#"` or `"X"` vs. `null`). Option A is additive and non-breaking. See Architecture recommendations. |

---

## Differentiators

Features not strictly required for correctness but which make the v1.1 experience significantly better. These are low-risk additions for a project at this maturity.

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Distinct visual treatment for inactive cells | `visibility: hidden` keeps grid cells in DOM (preserves CSS grid layout structure) but makes them invisible and non-interactive. Alternatively, a dark/muted fill with no hover state makes the L-shaped boundary legible. | Low | `visibility: hidden` is correct for preserving grid structure without empty-space collapse. `pointer-events: none` ensures no hover ghost bleeds onto inactive cells. Both can be combined. |
| Cursor feedback on active vs inactive cells | `cursor: pointer` over hoverable active cells, `cursor: default` over inactive holes, `cursor: not-allowed` over occupied cells when piece is selected. Communicates affordances without text. | Low | Pure CSS via class + cursor rule. No JS changes. |
| Bank piece mini-grid shows rotated preview | When user clicks to rotate, the bank mini-grid for the selected piece should update to show the new rotation, not just the canonical 0° form. | Low | Already implemented in v1.0 via `updateBankSelection()` + `buildMiniGrid(rotatedCells, color)`. No new work needed — just must not break with interaction model change. |
| Rotate animation on click | Brief CSS rotation transform on the cursor-following piece or the bank mini-grid when single-click rotates. Gives tactile feedback that the rotation happened. | Low | CSS `transition: transform 150ms ease`. Does not affect game state. |
| Tooltip showing inactive cell reason | On hover of inactive cells: "Not part of this puzzle." Clarifies why nothing happens. | Very Low | `title` attribute on the cell div. One line of code. |
| Placement confirmation animation | Short scale/pulse animation on cells when a piece is successfully placed. Distinguishes confirmed placement from ghost preview. | Low | CSS keyframe on `.placed` class, triggered by re-render. No JS changes. |

---

## Anti-Features

Things to explicitly NOT build in v1.1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Right-click to rotate | Browsers intercept right-click for context menu by default. Suppressing it (`preventDefault`) is fragile and confusing for users. | Use single left-click as defined in the spec. |
| Keyboard shortcut for rotation (R key) | Not in spec. Adds a separate code path to maintain, and keyboard shortcuts need accessibility consideration. | The click interaction is sufficient for a desktop demo. If added later, it is additive and low risk. |
| Drag-and-drop for piece placement | Already decided against in v1.0 (locked decision). Inconsistent with the new click-to-rotate/double-click-to-place model. HTML5 drag events fire before dblclick, creating interference. | Click-based placement as specified. |
| Rotation by clicking the bank piece | Currently used in v1.0. With the new model, grid clicks rotate. If bank clicks also rotate, two ways to rotate diverge in behavior and cause confusion. Decide: grid click is canonical for rotation in v1.1. | Keep bank click as selection-only. Single-click a bank piece selects it at rotation 0. |
| Timer-based single/double-click debounce | A setTimeout-based approach (wait 300ms to distinguish single from double click) adds artificial input latency. 300ms is noticeable and degrades feel. | Use `event.detail` to detect click count synchronously — no delay. `detail === 1` fires on single click, then `detail === 2` fires on the double-click's second click. Cancel the rotation if `detail === 2`. |
| Irregular grid via CSS grid-template-areas | `grid-template-areas` requires each named area to form a rectangle. Irregular shapes cannot be expressed this way — the declaration becomes invalid. | Keep the full `rows × cols` CSS grid. Mark inactive cells with a class (e.g., `.inactive`) and apply `visibility: hidden` + `pointer-events: none`. No CSS grid structural changes needed. |
| Displaying inactive cells as `display: none` | Removing cells from the DOM with `display: none` would cause CSS grid to collapse the space, breaking the visual grid structure entirely. | Use `visibility: hidden` to preserve grid layout while hiding inactive cells. |

---

## Feature Dependencies

```
Inactive cell sentinel (data model)
  └── Server validation skips inactive cells
      └── Win detection works with 43-cell puzzle
      └── Puzzle JSON schema supports inactive cells

Inactive cells visually inert (CSS class + pointer-events: none)
  └── Ghost preview skips inactive cells (JS guard in updateGhostPreview)
  └── Cursor feedback (CSS rule on .inactive)

New interaction model (single-click = rotate, double-click = place)
  └── Rotation updates ghost preview immediately
  └── Piece stays selected across rotations
      └── Bank mini-grid shows rotated preview (already works — verify only)

10 custom piece shapes in puzzle JSON
  └── Piece bank renders all 10 shapes correctly (CSS layout review)
  └── All 10 shapes fill exactly 43 active cells (puzzle authoring + server validation)
```

---

## Interaction Model: Click to Rotate + Double-Click to Place

This is the highest-complexity part of v1.1 because the browser's native event order creates a conflict.

### The Core Problem

The browser fires events in this order on a double-click:

```
mousedown → mouseup → click(detail=1) → mousedown → mouseup → click(detail=2) → dblclick
```

If listening to both `click` and `dblclick` on a grid cell:
- First `click` fires: rotate piece by 90° (correct)
- Second `click` fires: rotate piece by another 90° (wrong — this is the first click of the double-click)
- `dblclick` fires: place piece (correct, but now at the wrong rotation)

The piece rotates twice before placing. That is a bug.

### Recommended Solution: `event.detail` Guard (HIGH confidence)

Use the `detail` property on the `click` event — it equals the click count in the current rapid-click sequence. A standalone single-click has `detail === 1`. The first click of a double-click also has `detail === 1`, but the second click of a double-click has `detail === 2`.

The pattern: listen to `click` only (not `dblclick`), check `detail`:

```javascript
cell.addEventListener('click', (event) => {
  if (!selectedShapeId) return;

  if (event.detail === 1) {
    // Single click: rotate
    selectedRotation = (selectedRotation + 90) % 360;
    updateBankSelection();
    updateGhostPreview(r, c);
  } else if (event.detail === 2) {
    // Second click of a double-click: place
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

This approach:
- Requires no `setTimeout` (no artificial delay)
- Uses a natively available browser property (`UIEvent.detail` is Baseline Widely Available since 2015)
- Produces exactly one rotation on a single click
- Produces one rotation then immediate placement on a double-click (net result: piece placed at original rotation + 90°, which is the expected behavior when "click to preview rotation, double-click to confirm")

**Alternative interpretation:** If the design intent is "double-click places at current rotation without an extra rotation", then the `detail === 2` branch should not inherit the rotate from `detail === 1`. In that case, only `detail === 1` fires on single-click (rotates), and `detail === 2` fires on double-click second click (places, with the rotation already applied by the first click). The code above already reflects this correctly — the rotation happens on `detail === 1`, and `detail === 2` fires after that rotation has been applied. The net result is: one rotation applied during double-click, then placed.

If zero rotations on double-click is desired (place at current rotation), use a cancel flag:

```javascript
let pendingRotateTimeout = null;

cell.addEventListener('click', (event) => {
  if (!selectedShapeId) return;
  if (event.detail === 1) {
    selectedRotation = (selectedRotation + 90) % 360;
    updateBankSelection();
    updateGhostPreview(r, c);
  } else if (event.detail >= 2) {
    // Double-click: undo the rotation that just fired on detail===1
    selectedRotation = (selectedRotation - 90 + 360) % 360;
    // Then place
    socket.emit('game:move', { ... });
    ...
  }
});
```

**Recommendation:** Accept the natural behavior (one rotation + place on double-click). It is simpler and matches user intuition: "I clicked once to see the rotation, then clicked again quickly to confirm it." Document the behavior in the UI.

### What Happens to Bank Click

With the new model, clicking a bank piece should select it (at rotation 0) but no longer rotate it. The rotation is now exclusively done by clicking on the grid. This simplifies the bank: one behavior (select), not two (select-or-rotate).

### Ghost Preview Must Update on Rotation

The current ghost preview only updates on `mousemove`. After a single-click rotates the piece, the ghost preview at the currently-hovered cell must redraw at the new rotation. Trigger `updateGhostPreview(lastHoveredRow, lastHoveredCol)` after every rotation. Cache the last hovered cell in a module-level variable.

---

## MVP Priority for v1.1

**Must ship (table stakes — v1.1 goal fails without these):**

1. Inactive cell sentinel in grid data model (server + client)
2. Inactive cells visually inert (CSS + `pointer-events: none`)
3. Server validation rejects placement onto inactive cells
4. Win detection skips inactive cells correctly
5. Ghost preview treats inactive cells as invalid
6. `event.detail` guard: single-click rotates, second click of double-click places
7. Piece stays selected across rotations (no auto-deselect on grid click)
8. Ghost preview updates after rotation (cache last-hovered cell)
9. Puzzle JSON for the 5×9 irregular grid with 10 shapes authored and validated
10. Piece bank UI handles 10 pieces without overflow

**Should have (elevates demo quality):**

1. Cursor feedback (`cursor: pointer` vs `cursor: default` on inactive vs active cells)
2. Rotation visual feedback on bank mini-grid (already works — verify not broken)
3. `visibility: hidden` for inactive cells (vs. dimmed background — pick one approach consistently)
4. Tooltip on inactive cells (`title` attribute)

**Defer or cut:**

- Rotation animation (CSS transform) — nice polish, zero risk, but not required for correctness
- Placement confirmation animation — same category
- Bank click rotation removal — must change bank click behavior from v1.0; easy change but needs explicit decision

---

## Complexity Summary

| Change Area | Files Affected | Estimated Complexity |
|-------------|---------------|---------------------|
| Inactive cell sentinel + schema | `puzzles/puzzle_*.json`, `game.js` (validatePuzzleSchema, buildInitialGrid, checkWin, placePiece) | Medium — touches core validation logic; needs TDD first |
| Client inactive cell rendering | `main.js` (renderGrid), `style.css` | Low — class + CSS rules |
| Ghost preview inactive cell guard | `main.js` (updateGhostPreview, isActive helper) | Low — one guard condition |
| event.detail interaction model | `main.js` (grid cell click listener, bank click listener) | Medium — replaces existing click handler; subtle event.detail logic |
| Ghost preview on rotation | `main.js` (add last-hovered cache, trigger on rotate) | Low — two new lines |
| Bank piece de-duplication (10 pieces) | `style.css` (bank container layout) | Low — CSS flex-wrap or grid |
| New puzzle JSON authoring | `puzzles/puzzle_03.json` (or similar) | Low-Medium — content authoring, schema already defined |

---

## Sources

### HIGH confidence (official documentation, verified)
- MDN — UIEvent.detail: `detail` property is Baseline Widely Available; values 1, 2, etc. confirmed for click events. Directly addresses the click/dblclick separation problem.
- MDN — Element dblclick event: Browser event firing order (`click → click → dblclick`) confirmed. No known browser compatibility issues.
- MDN — CSS visibility: `visibility: hidden` preserves grid layout space while hiding element. Confirmed correct for irregular grid holes vs. `display: none` (which collapses space).
- MDN — CSS pointer-events: `pointer-events: none` confirmed to suppress all mouse events on targeted elements.
- MDN — CSS grid-template-areas: Named areas must form rectangles. Irregular grid shapes cannot be expressed via `grid-template-areas`. Confirmed approach of using CSS class + `visibility: hidden` instead.
- MDN — CSS cursor: `cursor: default`, `cursor: pointer`, `cursor: not-allowed` all confirmed for use cases described.
- MDN — ARIA grid role: `aria-disabled="true"` + `tabindex="-1"` pattern confirmed for inactive/non-interactive grid cells.

### MEDIUM confidence (inferred from code + domain knowledge)
- Existing `main.js` and `game.js` code analysis: Direct reading of the codebase provides HIGH confidence on which functions need to change and how. The `updateGhostPreview`, `rotateCells`, `placePiece`, `checkWin`, `buildInitialGrid` function signatures and logic are read directly.
- `event.detail` as debounce alternative: Documented behavior of `detail` values. The "no-timeout" approach is verified against MDN. The "net rotation on double-click" behavior is reasoned from the event order, not experimentally tested — treat as MEDIUM.

### LOW confidence (reasoned from patterns, not verified against live code)
- 10-piece bank layout overflow: Assumed that 10 pieces may need CSS flex-wrap or a scrollable bank container. Not verified against current CSS. Should be confirmed visually during implementation.
- "Zero rotation on double-click" approach using `selectedRotation - 90`: Logically sound but not tested. If the desired UX is "place at current rotation with no extra rotation", the undo-rotation approach works — but verify against `selectedRotation = 0` edge case (would wrap to 270 incorrectly at the `- 90` boundary without the `+ 360`) — the modulo `(selectedRotation - 90 + 360) % 360` handles this correctly.

---
*Research completed: 2026-03-15*
*Covers: v1.1 additions only — irregular grid, custom pieces, click-to-rotate interaction*
*Ready for roadmap: yes*
