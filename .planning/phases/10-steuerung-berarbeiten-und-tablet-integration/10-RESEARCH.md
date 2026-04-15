# Phase 10: Steuerung überarbeiten und Tablet Integration - Research

**Researched:** 2026-04-01
**Domain:** Vanilla JS touch events, CSS responsive layout, interaction model refactor
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Unified Interaction Model (Desktop + Touch)**
- Single click / tap on an empty grid cell = place the selected piece (replaces the old double-click-to-place model)
- The `setTimeout`/`clearTimeout` click disambiguation is removed entirely — no 150ms delay
- Single click on a placed movable piece (with no piece selected) = return it to bank
- Rotation is exclusively via dedicated rotation buttons (↺ / ↻) placed near the bank panel
- Rotation buttons are always visible on all devices (no pointer-coarse detection needed)
- R keyboard shortcut (EXT-01) is added — R key rotates the selected piece 90° CW

**Touch Drag-to-Preview Model (Tablet)**
- `touchstart` on a bank piece → selects the piece and begins drag
- `touchmove` on the grid → ghost preview follows the finger (reuses `updateGhostPreview(r, c)`)
- `touchend` on the grid → ghost stays at last position (piece is positioned but not yet placed)
- A subsequent tap on the ghost-highlighted cell → confirms placement
- Dragging the finger back off the grid / onto the bank → deselects (same behavior as desktop `document.addEventListener('click', deselect)`)

**Long-Press Return (Touch only)**
- Long-press (~500ms) on a placed movable piece = return it to bank (touch equivalent of desktop single-click return)
- Uses `setTimeout` on `touchstart`, cancelled by `touchend` within 500ms if it's a drag not a press

**Ghost Preview on Desktop (unchanged)**
- Desktop ghost preview stays mousemove-based (no change needed)
- Rotation buttons trigger `updateGhostPreview(lastHoveredRow, lastHoveredCol)` after updating `selectedRotation` — same as current behavior

**Responsive Layout — Auto-Scaling Grid**
- Grid cells: auto-scale via CSS to fill available space on both desktop and tablet
  - Current fixed 40px replaced with a CSS variable (e.g. `--cell-size`) calculated from viewport width
  - Layout stays side-by-side (grid left, bank+controls right) at all sizes
- Target breakpoint: landscape tablet >= 1024px wide
- Game screen `max-width: 960px` can be relaxed or removed for larger viewports
- Rotation buttons scale with the bank panel (no separate sizing needed)

**Portrait Mode**
- On portrait orientation (or viewport width < ~768px in landscape logic), show a fullscreen overlay: "Bitte Querformat verwenden" (German, consistent with UI convention)
- Implemented via CSS `@media (orientation: portrait)` or a JS `resize`/`orientationchange` listener

### Claude's Discretion
- Exact CSS formula for `--cell-size` auto-scaling (e.g. `min(calc((100vw - 200px) / 9), 60px)` or similar)
- Visual style of the rotation buttons (size, icon choice, hover/active states)
- Exact long-press duration (suggested: 500ms)
- Whether to implement portrait overlay as pure CSS or JS-driven
- Touch deselect implementation detail (touchstart on document vs existing click listener)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 10 is a pure client-side refactor with no server changes. The work divides into three separable areas: (1) rewriting the click/interaction model in `renderGrid()` and adding rotation buttons to `index.html`, (2) adding touch event handlers for tablet drag-to-preview and long-press return, and (3) replacing the hard-coded 40px grid cell size with a CSS custom property that scales to viewport width, plus a portrait-mode overlay.

The codebase is vanilla JS + vanilla CSS with no build tools or framework — all changes happen in three files: `client/main.js`, `client/style.css`, and `client/index.html`. The existing helper functions (`updateGhostPreview`, `refreshCursorPiece`, `updateBankSelection`, `handleReturnClick`, `rotateCells`) are designed to be called from any event handler and require no modification — only the event wiring changes. The current disambiguation `setTimeout`/`clearTimeout` pattern (introduced in Phase 7) is fully removed; the new model is simpler.

Touch event handling on a vanilla JS grid is well-understood territory. The primary technical risk is `touchmove` coordinate translation — browser `TouchEvent.touches` gives viewport coordinates, not element-relative coordinates, so `elementFromPoint` or `getBoundingClientRect` must be used to identify the target grid cell. This is a known, well-documented pattern.

**Primary recommendation:** Implement in three focused plans — (1) desktop interaction refactor + rotation buttons + R key, (2) touch events (drag-to-preview + long-press), (3) responsive CSS auto-scaling + portrait overlay.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS (no library) | ES2022 | Touch/mouse event handling | Project constraint — no build tools, no frameworks |
| Vanilla CSS | CSS3 | Responsive layout via custom properties | Project constraint — no preprocessors |
| Socket.IO client | Already installed | Server communication | Existing project dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | — | No new dependencies introduced this phase |

**Installation:** No new packages. This phase is a pure refactor of existing files.

---

## Architecture Patterns

### Recommended Project Structure

No structural changes to the project. All changes are in:

```
client/
├── index.html   — add rotation buttons HTML near bank panel
├── main.js      — refactor renderGrid(), renderBank(); add touch handlers, R key
└── style.css    — replace fixed cell sizes with --cell-size; add portrait overlay rule
```

### Pattern 1: Single-Click Place (Desktop)

**What:** Replace the `click`+`dblclick` disambiguation block in `renderGrid()` with a single direct `click` handler.

**When to use:** Every active, non-inactive grid cell.

**Replaces (remove these lines):**
```javascript
// REMOVE: client/main.js lines 38-39
const DBLCLICK_DELAY = 150;
let clickTimer = null;

// REMOVE: client/main.js lines 290-330 (click timer + dblclick handler)
cell.addEventListener('click', () => {
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => { ... }, DBLCLICK_DELAY);
});
cell.addEventListener('dblclick', () => { ... });
```

**Replace with:**
```javascript
// Single click on empty cell = place selected piece
// Single click on placed movable piece (no piece selected) = return to bank
cell.addEventListener('click', () => {
  if (selectedShapeId) {
    // Place
    const shape = currentBankShapes.find(s => s.id === selectedShapeId);
    let originRow = r, originCol = c;
    if (shape) {
      const cells = rotateCells(shape.cells, selectedRotation);
      const [pivotDr, pivotDc] = getPivotOffset(cells);
      originRow = r - pivotDr;
      originCol = c - pivotDc;
    }
    socket.emit('game:move', {
      action: 'place',
      shapeId: selectedShapeId,
      rotation: selectedRotation,
      originRow,
      originCol,
    });
    selectedShapeId = null;
    selectedRotation = 0;
    clearGhostPreview();
    refreshCursorPiece();
    updateBankSelection();
  } else if (content && content.movable !== false) {
    // Return placed movable piece
    handleReturnClick(content.shapeId);
  }
});
```

### Pattern 2: Rotation Buttons

**What:** Two `<button>` elements placed in `index.html` adjacent to the bank panel. They mutate `selectedRotation` and call `updateBankSelection()` + `updateGhostPreview()`.

**HTML placement** (inside `.game-area` div, adjacent to `#piece-bank`):
```html
<div id="rotation-controls" class="rotation-controls">
  <button id="rotate-ccw-btn" aria-label="Drehen gegen Uhrzeigersinn">↺</button>
  <button id="rotate-cw-btn" aria-label="Drehen im Uhrzeigersinn">↻</button>
</div>
```

**JS wiring** (after DOM is ready, outside renderGrid — wire once):
```javascript
document.getElementById('rotate-cw-btn').addEventListener('click', () => {
  if (!selectedShapeId) return;
  selectedRotation = (selectedRotation + 90) % 360;
  updateBankSelection();
  if (lastHoveredRow !== null && lastHoveredCol !== null) {
    updateGhostPreview(lastHoveredRow, lastHoveredCol);
  }
});
document.getElementById('rotate-ccw-btn').addEventListener('click', () => {
  if (!selectedShapeId) return;
  selectedRotation = (selectedRotation + 270) % 360; // +270 = -90 mod 360
  updateBankSelection();
  if (lastHoveredRow !== null && lastHoveredCol !== null) {
    updateGhostPreview(lastHoveredRow, lastHoveredCol);
  }
});
```

### Pattern 3: R Keyboard Shortcut (EXT-01)

**What:** Global `keydown` listener rotates selected piece 90° CW when R is pressed during an active game turn.

```javascript
document.addEventListener('keydown', (e) => {
  if (e.key !== 'r' && e.key !== 'R') return;
  if (!selectedShapeId) return;
  // Guard: only active during game screen
  if (!gameScreen.classList.contains('active')) return;
  selectedRotation = (selectedRotation + 90) % 360;
  updateBankSelection();
  if (lastHoveredRow !== null && lastHoveredCol !== null) {
    updateGhostPreview(lastHoveredRow, lastHoveredCol);
  }
});
```

### Pattern 4: Touch Drag-to-Preview

**What:** `touchstart` on a bank piece selects it. `touchmove` anywhere over the grid triggers ghost preview at the cell under the finger. `touchend` on the grid leaves ghost in place — the next tap on that highlighted cell confirms placement.

**Key technical detail:** `touchmove` fires on the element where the touch *started*, not where the finger currently is. To find the grid cell under the finger, use `document.elementFromPoint(touch.clientX, touch.clientY)`.

```javascript
// In renderBank() — add touchstart to each bank piece element
pieceEl.addEventListener('touchstart', (e) => {
  e.preventDefault(); // prevent scroll during piece selection
  if (!amIActive) return;
  selectedShapeId = shape.id;
  selectedRotation = 0;
  updateBankSelection();
}, { passive: false });

// In renderGrid() — add touchmove and touchend per grid cell
// NOTE: touchmove fires on the element where touch started (bank piece),
//       so we listen at the document level for grid tracking.
```

**Better approach — document-level touch tracking** (wire once, outside renderGrid):
```javascript
let touchDragging = false;

document.addEventListener('touchmove', (e) => {
  if (!selectedShapeId) return;
  const touch = e.touches[0];
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (!el) return;
  const row = parseInt(el.dataset.row);
  const col = parseInt(el.dataset.col);
  if (isNaN(row) || isNaN(col)) return; // finger not over grid cell
  touchDragging = true;
  lastHoveredRow = row;
  lastHoveredCol = col;
  updateGhostPreview(row, col);
}, { passive: true });

document.addEventListener('touchend', (e) => {
  if (!touchDragging) return;
  touchDragging = false;
  // Ghost stays — user must tap ghost cell to confirm
  // The existing click handler on the ghost-highlighted cell fires on touchend->click
});
```

**Ghost-to-placement confirmation:** After `touchend`, the ghost cells remain highlighted. The user taps one of the highlighted cells, which fires the normal `click` handler (browsers synthesize a `click` event after `touchend`). The existing single-click place handler confirms the placement — no extra code needed.

**Touch deselect:** When the finger moves off the grid entirely, the `touchmove` handler won't find a grid cell (`isNaN(row)`) — call `clearGhostPreview()` in that branch. For full deselect (finger moves to bank area), the existing document-level `click` deselect handler fires after `touchend` if the target is not inside `#game-grid` or `#piece-bank`.

### Pattern 5: Long-Press Return (Touch Only)

**What:** `touchstart` on a placed movable grid cell starts a 500ms timer. If `touchend` fires before 500ms, it's a tap (handled by click handler). If the timer fires, it's a long-press — call `handleReturnClick`.

```javascript
// In renderGrid() — for placed (movable) cells only:
let longPressTimer = null;

cell.addEventListener('touchstart', (e) => {
  if (content && content.movable !== false && !selectedShapeId) {
    longPressTimer = setTimeout(() => {
      handleReturnClick(content.shapeId);
    }, 500);
  }
}, { passive: true });

cell.addEventListener('touchend', () => {
  clearTimeout(longPressTimer);
  longPressTimer = null;
});

cell.addEventListener('touchmove', () => {
  // Finger moved — cancel long press (it became a drag)
  clearTimeout(longPressTimer);
  longPressTimer = null;
});
```

**Note:** `longPressTimer` should be a single module-level variable, not per-cell, to avoid stale timer leaks on re-render.

### Pattern 6: CSS Auto-Scaling Grid

**What:** Replace `.grid-cell { width: 40px; height: 40px }` with a CSS custom property computed to fit the viewport.

**CSS approach (recommended — pure CSS, no JS resize listener):**

```css
:root {
  /* Grid is 9 columns + padding. Cap at 60px (desktop) so it doesn't grow too large. */
  /* 200px reserved for bank panel + gap */
  --cell-size: min(calc((100vw - 240px) / 9), 60px);
}

.grid-cell {
  width: var(--cell-size);
  height: var(--cell-size);
  /* font-size also scales with cell */
  font-size: calc(var(--cell-size) * 0.22);
}

/* Relax game screen width constraint for large viewports */
#game-screen {
  max-width: min(100vw - 2rem, 1200px);
  text-align: center;
}
```

**Also update renderGrid() JS** to use `var(--cell-size)` instead of hard-coded `40px`:
```javascript
// client/main.js renderGrid()
gameGrid.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
gameGrid.style.gridTemplateRows    = `repeat(${rows}, var(--cell-size))`;
```

### Pattern 7: Portrait Mode Overlay

**What:** Fullscreen overlay shown on portrait orientation. Pure CSS is the preferred approach — no JS resize listener needed.

```css
@media (orientation: portrait) {
  .portrait-overlay {
    display: flex;
  }
}

.portrait-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--clr-bg);
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: var(--sp-lg);
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 600;
  text-align: center;
  padding: var(--sp-xl);
}
```

**HTML** (add before closing `</body>`):
```html
<div class="portrait-overlay">
  <span style="font-size: 3rem;">📱</span>
  <p>Bitte Querformat verwenden</p>
</div>
```

### Anti-Patterns to Avoid

- **Attaching touch listeners inside renderGrid() as new per-cell handlers:** `renderGrid()` is called on every `game:stateUpdate`. Document-level touch handlers (wired once) avoid accumulating duplicate listeners on every re-render.
- **Using `touchstart`/`touchend` target for grid cell lookup:** Touch events fire on the element where the touch started. Use `document.elementFromPoint(touch.clientX, touch.clientY)` to find the actual grid cell under the finger.
- **`passive: false` on touchmove globally:** Only set `passive: false` if you need `preventDefault()`. Document-level `touchmove` tracking does not need to prevent scrolling — use `passive: true`. Bank piece `touchstart` does need `passive: false` to prevent scroll during selection.
- **Using `vh` for grid height scaling:** The bank panel height is constrained by piece count, not viewport height. Use `vw`-based `--cell-size` formula with a pixel cap.
- **Adding rotation button click handlers inside renderGrid():** renderGrid() rerenders on every state update. Rotation button handlers must be wired once at module level (or inside `game:start` handler).
- **Forgetting to clear `longPressTimer` on re-render:** On `game:stateUpdate`, renderGrid() rebuilds the DOM. If `longPressTimer` is a per-cell variable from the old render, it leaks. Use a single module-level variable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding grid cell under touch finger | Custom coordinate math | `document.elementFromPoint(touch.clientX, touch.clientY)` + `dataset.row/col` | Browser API designed for this; handles all viewport transforms, scroll, zoom |
| Responsive cell size calculation | JS `ResizeObserver` loop | CSS `min(calc(...), Npx)` with `--cell-size` custom property | CSS repaints automatically on resize; no JS needed; zero event listener overhead |
| Touch event cross-browser shim | Custom touch polyfill | Native `TouchEvent` | All modern tablets (iPad Safari, Android Chrome) support `TouchEvent` natively |
| Portrait detection | `window.innerWidth < window.innerHeight` JS check | CSS `@media (orientation: portrait)` | CSS handles resize/rotation events automatically; simpler |

**Key insight:** All touch-to-coordinates translation happens via `elementFromPoint` — it's the only reliable way to find what's under a finger mid-drag when the touch started on a different element.

---

## Common Pitfalls

### Pitfall 1: Double-firing click after touchend

**What goes wrong:** On mobile browsers, `touchend` is followed by a synthesized `click` event ~300ms later. If both touch and click handlers are wired, placement fires twice.

**Why it happens:** The 300ms synthetic click is the browser's tap-to-click compatibility layer.

**How to avoid:** In this phase, placement is handled exclusively by the `click` handler (both desktop and touch). Touch handlers only handle drag-tracking (`touchmove`) and long-press. The `click` event fires from both mouse and tap — a single handler handles both. Do NOT add a separate `touchend` placement path.

**Warning signs:** Placement emitting two `game:move` events per tap; server rejecting the second with "already occupied".

### Pitfall 2: touchmove fires on originating element, not element under finger

**What goes wrong:** Adding `touchmove` listener on grid cells — the listener only fires if the touch started on that cell.

**Why it happens:** Touch events are sticky — `touchmove` and `touchend` always fire on the element where `touchstart` occurred, regardless of where the finger moves.

**How to avoid:** Wire `touchmove` at the `document` level and use `elementFromPoint` to identify the current grid cell. This is the pattern documented in all MDN touch event guides.

**Warning signs:** Ghost preview only appears if you start and stay on the same cell; drag from bank never triggers ghost.

### Pitfall 3: Rotation button clicks triggering deselect

**What goes wrong:** The rotation button is outside `#game-grid` and `#piece-bank`. The document-level `click` deselect handler (`document.addEventListener('click', deselect)`) fires after the rotation button click and deselects the piece.

**Why it happens:** The deselect handler checks `e.target.closest('#game-grid') && e.target.closest('#piece-bank')`. Rotation buttons are neither.

**How to avoid:** Add `#rotation-controls` to the deselect exclusion check:
```javascript
if (!e.target.closest('#game-grid') && !e.target.closest('#piece-bank') && !e.target.closest('#rotation-controls')) {
  // deselect
}
```

**Warning signs:** Clicking a rotation button immediately deselects the piece before rotating it.

### Pitfall 4: Inactive cells receiving touch events

**What goes wrong:** `.grid-cell.inactive` cells have `pointer-events: none` in CSS, which works for mouse events but `elementFromPoint` still returns elements with `pointer-events: none`.

**Why it happens:** `elementFromPoint` ignores CSS `pointer-events` only in some browser versions / implementations. Behavior can be inconsistent.

**How to avoid:** After calling `elementFromPoint`, check `el.classList.contains('inactive')` before calling `updateGhostPreview`. The existing ghost preview logic already guards against inactive cells (the `currentGrid[r][c] === null` check naturally rejects `{ inactive: true }` objects), so ghost rendering is already safe — but explicitly skipping inactive cells in the touch handler prevents unnecessary re-renders.

**Warning signs:** Ghost occasionally flickers on corner cut cells.

### Pitfall 5: Hard-coded 40px remaining in JS after CSS change

**What goes wrong:** `renderGrid()` sets `gameGrid.style.gridTemplateColumns = \`repeat(${cols}, 40px)\`` — this JS-set inline style overrides the CSS `var(--cell-size)` rule because inline styles have higher specificity.

**Why it happens:** The current code hard-codes `40px` inline via JS in `renderGrid()` (lines 252-253). CSS custom property change alone doesn't fix this.

**How to avoid:** Update `renderGrid()` to use `var(--cell-size)` in the grid template strings, or set the template via CSS class and remove the inline style from JS entirely.

**Warning signs:** Grid cells remain 40px even after CSS change; auto-scaling appears to have no effect.

### Pitfall 6: `preventDefault()` blocking scroll on non-game screens

**What goes wrong:** `touchstart` with `passive: false` + `preventDefault()` on bank pieces blocks page scrolling globally on all screens including start/lobby.

**Why it happens:** Event listeners added in `renderBank()` are only present during the game screen, but a global document listener for touchmove could interfere.

**How to avoid:** Guard all touch handlers with a game-screen-active check, or add/remove document-level listeners on `game:start` / `game:stateUpdate` (add on start, remove on return to lobby).

---

## Code Examples

Verified patterns from codebase inspection:

### elementFromPoint for touch coordinate mapping

```javascript
// Source: MDN Web Docs — TouchEvent / Document.elementFromPoint
document.addEventListener('touchmove', (e) => {
  if (!selectedShapeId) return;
  const touch = e.touches[0];
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (!el || !el.dataset.row) return;
  const row = parseInt(el.dataset.row);
  const col = parseInt(el.dataset.col);
  if (isNaN(row) || isNaN(col)) return;
  if (el.classList.contains('inactive')) return; // Pitfall 4 guard
  lastHoveredRow = row;
  lastHoveredCol = col;
  updateGhostPreview(row, col);
}, { passive: true });
```

### CSS --cell-size auto-scaling formula

```css
/* Source: CSS Values Level 4 spec — min() function */
:root {
  /* 9 columns, ~200px for bank+controls, 2rem for body padding, cap at 60px */
  --cell-size: min(calc((100vw - 240px) / 9), 60px);
}

.grid-cell {
  width: var(--cell-size);
  height: var(--cell-size);
  font-size: calc(var(--cell-size) * 0.22);
}
```

### Rotation button deselect exclusion (existing deselect handler update)

```javascript
// Source: client/main.js line 519 — existing handler, updated
document.addEventListener('click', (e) => {
  if (!selectedShapeId) return;
  if (
    !e.target.closest('#game-grid') &&
    !e.target.closest('#piece-bank') &&
    !e.target.closest('#rotation-controls')  // NEW: exclude rotation buttons
  ) {
    selectedShapeId = null;
    selectedRotation = 0;
    clearGhostPreview();
    refreshCursorPiece();
    updateBankSelection();
  }
});
```

### Exact lines to remove from main.js

```javascript
// client/main.js — REMOVE these:
// Line 38: const DBLCLICK_DELAY = 150;
// Line 39: let clickTimer = null;
// Lines 290-301: cell.addEventListener('click', () => { clearTimeout(clickTimer); clickTimer = setTimeout(...) })
// Lines 304-330: cell.addEventListener('dblclick', () => { ... })
```

### Exact CSS lines to change in style.css

```css
/* client/style.css — CHANGE line 441 from: */
.grid-cell {
  width: 40px;
  height: 40px;
  /* ... */
}

/* TO: */
.grid-cell {
  width: var(--cell-size);
  height: var(--cell-size);
  font-size: calc(var(--cell-size) * 0.22);
  /* ... rest unchanged */
}

/* client/style.css — CHANGE line 152 from: */
#game-screen { max-width: 960px; text-align: center; }

/* TO: */
#game-screen { max-width: min(calc(100vw - 2rem), 1200px); text-align: center; }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-click rotate + double-click place | Single-click place + rotation buttons | This phase (Phase 10) | Eliminates 150ms delay; unified model for desktop + touch |
| Fixed 40px grid cells | CSS `var(--cell-size)` auto-scaling | This phase (Phase 10) | Grid fills available space on any device |
| No touch support | Touch drag-to-preview + long-press return | This phase (Phase 10) | Tablet players can play without keyboard/mouse |
| No portrait handling | "Bitte Querformat verwenden" overlay | This phase (Phase 10) | Graceful degradation on portrait mobile/tablet |
| Double-click-to-place model (Phase 7) | Superseded by single-click model | Phase 10 | CTRL-01 through CTRL-04 requirements replaced |

**Deprecated/outdated after this phase:**
- `DBLCLICK_DELAY` constant: removed
- `clickTimer` module-level variable: removed
- `dblclick` event handler in `renderGrid()`: removed
- `click`+`setTimeout` disambiguation in `renderGrid()`: removed
- CTRL-01, CTRL-02 requirements (old rotation-via-click, double-click-to-place): replaced by new unified model
- CTRL-03, CTRL-04 remain valid — ghost/bank mini-grid rotation reflection still applies, now triggered by rotation buttons

---

## Open Questions

1. **Cursor piece on touch devices**
   - What we know: The floating cursor piece (`_cursorEl`) follows `mousemove` events. Touch devices do not fire `mousemove`.
   - What's unclear: Should the cursor piece be shown on touch? It may be distracting on tablet (finger covers it). Or should it be hidden on touch and the ghost preview serve as the sole visual feedback?
   - Recommendation: Hide cursor piece when `touchDragging === true`. Set `_cursorEl.style.display = 'none'` at the start of touchmove, restore on touchend. This is a small quality-of-life decision — Claude's discretion per CONTEXT.md.

2. **Active-player guard for touch handlers**
   - What we know: `renderBank()` already guards `if (!amIActive) pieceEl.style.pointerEvents = 'none'` on bank pieces. But the document-level `touchmove` handler doesn't check `amIActive`.
   - What's unclear: If a non-active player accidentally selects a piece (bank pointer-events should prevent this), the touchmove handler would still fire ghost preview.
   - Recommendation: The bank `touchstart` handler should check `amIActive` explicitly (like the bank `click` handler does). The document `touchmove` handler is safe as long as `selectedShapeId` is only set when `amIActive`.

3. **grid-cell size in JS-set gridTemplateColumns**
   - What we know: `renderGrid()` currently uses inline style `gameGrid.style.gridTemplateColumns = \`repeat(${cols}, 40px)\``. This overrides CSS.
   - What's unclear: Whether to (a) change the inline style to `var(--cell-size)` or (b) remove the inline style and let CSS drive it via a `.grid` rule using `grid-template-columns: repeat(9, var(--cell-size))`.
   - Recommendation: Option (b) — remove the inline gridTemplateColumns/Rows from JS and move them to CSS on the `.grid` class for a fixed 9×5 puzzle. However, if future puzzles have different grid sizes, option (a) is safer. Given the project uses a single puzzle format, option (a) (`var(--cell-size)` in the JS template string) is the minimal safe change.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None — project has no test framework |
| Config file | None |
| Quick run command | Manual browser testing |
| Full suite command | Manual browser testing |

### Phase Requirements → Test Map

No formal requirement IDs are assigned to Phase 10. The behaviors to verify are:

| Behavior | Test Type | Verification Method |
|----------|-----------|---------------------|
| Single click on empty cell places selected piece | manual smoke | Click bank piece, click grid cell, piece appears on grid |
| Single click on placed piece (no selection) returns it | manual smoke | Double-click place, then click same cell with no piece selected |
| Rotation buttons rotate ghost and bank mini-grid | manual smoke | Select piece, hover over grid, click ↺/↻, ghost and bank update |
| R key rotates piece 90° CW | manual smoke | Select piece, press R, bank mini-grid updates |
| No 150ms delay on single click | manual smoke | Click cell — placement is instant, no perceptible lag |
| Touch drag from bank to grid shows ghost | manual touch device | Finger down on bank piece, drag to grid, ghost appears |
| Ghost stays after touchend | manual touch device | Lift finger from grid, ghost cells remain highlighted |
| Tap ghost cell confirms placement | manual touch device | Tap a ghost-highlighted cell, piece is placed |
| Long press returns piece | manual touch device | 500ms hold on placed piece, piece returns to bank |
| Grid auto-scales on resize | manual | Resize browser window, cells scale fluidly |
| Portrait overlay appears on portrait mode | manual | Rotate device / narrow window, overlay shown |
| Portrait overlay hides on landscape | manual | Rotate back to landscape, overlay gone |

### Wave 0 Gaps
- [ ] No test framework exists in this project — this is expected per project conventions (vanilla JS, no build tools, no test runner). All verification is manual browser testing.

*(No framework install is possible or required — project constraint: no build tools, no dependencies beyond Socket.IO)*

---

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — `client/main.js` (732 lines), `client/style.css` (727 lines), `client/index.html` (113 lines)
- `10-CONTEXT.md` — user decisions, locked choices, existing code map with line numbers
- `07-CONTEXT.md` — Phase 7 click model decisions (now superseded by Phase 10)
- `06-CONTEXT.md` — pointer-events: none on inactive cells (must be preserved)

### Secondary (MEDIUM confidence)
- MDN Web Docs pattern: `document.elementFromPoint(touch.clientX, touch.clientY)` for touch coordinate resolution — well-established, cross-browser pattern documented at https://developer.mozilla.org/en-US/docs/Web/API/Document/elementFromPoint
- CSS `min()` function for responsive sizing — CSS Values Level 4, supported in all modern browsers (Chrome 79+, Firefox 75+, Safari 11.1+) — https://developer.mozilla.org/en-US/docs/Web/CSS/min

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all patterns from existing codebase and web platform APIs
- Architecture: HIGH — all changes are local to three files with well-understood touch/CSS patterns
- Pitfalls: HIGH — all pitfalls are observable from codebase inspection (not theoretical)

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable DOM APIs; no fast-moving dependencies)
