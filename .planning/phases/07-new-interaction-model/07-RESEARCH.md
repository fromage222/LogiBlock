# Phase 7: New Interaction Model - Research

**Researched:** 2026-03-19
**Domain:** Vanilla JS click event disambiguation, client-side interaction model
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- Single-click on any active grid cell rotates the selected piece 90° CW (0→90→180→270→0)
- The piece remains selected after rotation
- If no piece is selected, single-click on an empty cell does nothing (silently ignored)
- The first click of a double-click must NOT trigger rotation — use `setTimeout`/`clearTimeout` disambiguation (300ms window)
- Double-click on any active grid cell = action:
  - If a piece is selected: place it at that cell (no extra rotation applied)
  - If no piece is selected AND the cell has a movable piece: return that piece to the bank
  - If neither condition: do nothing
- Clicking a bank piece selects it (resets rotation to 0°)
- Clicking the same already-selected bank piece deselects it
- Bank clicks do NOT rotate — rotation only happens via grid single-click
- Double-click on a placed (movable) piece returns it to the bank
- This replaces the old single-click-to-return behavior, which conflicts with the new rotation gesture
- Single or double click on an empty cell with no piece selected: silently ignored
- 300ms `setTimeout` window for distinguishing single-click (rotate) from double-click (place/return)
- First click of a double-click sequence must not fire the rotate action

### Claude's Discretion

- Exact structure of the disambiguator (per-cell timer vs shared timer)
- Whether to use native `dblclick` event + prevent default or pure `setTimeout` approach
- Visual feedback during the 300ms disambiguation window (if any)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CTRL-01 | Spieler kann ausgewählten Stein durch Linksklick auf eine aktive Grid-Zelle rotieren — Rotation zyklisch 0°→90°→180°→270°; 200ms Debounce verhindert unbeabsichtigte Rotation bei Doppelklick | Disambiguator pattern: shared module-level `clickTimer` with `setTimeout(300)` / `clearTimeout` — increment `selectedRotation`, call `updateBankSelection()` + `updateGhostPreview(lastHoveredRow, lastHoveredCol)` |
| CTRL-02 | Spieler platziert ausgewählten Stein per Doppelklick auf die gewünschte Grid-Position — ersetzt den bisherigen Einfachklick zum Platzieren | Replace current `click` handler in `renderGrid()` with `dblclick` handler; `clearTimeout(clickTimer)` at top of dblclick handler to cancel pending rotation |
| CTRL-03 | Ghost-Preview zeigt sofort die neue Rotation nach einem Linksklick — cached letzte Hover-Zelle und re-rendert Preview nach Rotation | Add module-level `lastHoveredRow`/`lastHoveredCol` variables; update in `mousemove` listener; call `updateGhostPreview(lastHoveredRow, lastHoveredCol)` after rotation (guard: both non-null) |
| CTRL-04 | Bank-Mini-Grid reflektiert die aktuelle Rotation des ausgewählten Steins nach einem Grid-Klick — `updateBankSelection()` wird aus dem Click-Handler aufgerufen | Already satisfied by calling `updateBankSelection()` in the rotate action — `updateBankSelection()` already rebuilds the mini-grid at `selectedRotation` |

</phase_requirements>

## Summary

Phase 7 is a pure client-side interaction refactor in a single file (`client/main.js`). No new libraries, no server changes, no new DOM structure. The existing codebase already has all the building blocks: `rotateCells()`, `updateBankSelection()`, `updateGhostPreview()`, `refreshCursorPiece()`, and `handleReturnClick()` — the work is rewiring how click events call these functions.

The central technical challenge is click disambiguation: a single-click on a grid cell should rotate the selected piece, but the first click of a double-click sequence must not fire the rotation. The locked solution is a `setTimeout`/`clearTimeout` pattern at module level — one shared timer for the whole grid, not one per cell. The `dblclick` event fires after `click` in all browsers, so the sequence is: click fires → start a 300ms timer → dblclick fires → `clearTimeout` cancels the timer → rotation never fires.

The bank click handler needs simplification: remove the "click again to rotate" behavior (line 277-278 in current `renderBank()`), replace with select-or-deselect-only logic, and reset rotation to 0 on selection. The `game:stateUpdate` event already resets `selectedShapeId` and `selectedRotation` to null/0 on each server update, which means rotation state is always cleared when another player makes a move — this is the correct behavior.

**Primary recommendation:** Use a single module-level `clickTimer` variable; attach both `click` and `dblclick` listeners per active cell in `renderGrid()`; add `lastHoveredRow`/`lastHoveredCol` module-level variables updated in the existing `mousemove` listener.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2020 (browser native) | All interaction logic | Project constraint: no framework, no build tool |
| Native DOM Events | Browser native | `click`, `dblclick`, `mousemove` | Already used throughout `main.js` |

No new dependencies needed. This is a pure code-behavior change.

**Installation:**
```bash
# No new packages required
```

## Architecture Patterns

### Recommended Project Structure

```
client/
└── main.js        # All changes land here — no new files
```

### Pattern 1: Shared Module-Level Click Disambiguator

**What:** One `let clickTimer = null` variable at module scope, shared across all cell listeners. Each cell's `click` handler sets `clickTimer = setTimeout(rotateAction, 300)`. Each cell's `dblclick` handler calls `clearTimeout(clickTimer)` first, then executes the place/return action.

**When to use:** When distinguishing single-click from double-click on dynamically-created elements where per-element timer state would be GC'd on re-render.

**Why shared vs. per-cell:** `renderGrid()` tears down and rebuilds all cells on every `game:stateUpdate`. Per-cell timers stored in closure variables are safe within a single render cycle, but a shared module-level timer is simpler and avoids potential stale-closure edge cases when the grid re-renders mid-timer.

**Example:**
```javascript
// Source: adapted from MDN dblclick disambiguation pattern
// Module-level state
let clickTimer = null;
let lastHoveredRow = null;
let lastHoveredCol = null;

// Inside renderGrid(), per active cell:
cell.addEventListener('click', () => {
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    // Single-click: rotate
    if (!selectedShapeId) return;
    selectedRotation = (selectedRotation + 90) % 360;
    updateBankSelection();
    if (lastHoveredRow !== null && lastHoveredCol !== null) {
      updateGhostPreview(lastHoveredRow, lastHoveredCol);
    }
  }, 300);
});

cell.addEventListener('dblclick', () => {
  clearTimeout(clickTimer);
  // Double-click: place or return
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
  } else if (content && content.movable !== false) {
    handleReturnClick(content.shapeId);
  }
});
```

### Pattern 2: Bank Click — Select-or-Deselect Only

**What:** Replace the current `renderBank()` click handler (which rotates on second click) with a handler that only selects or deselects, always resetting rotation to 0 on selection.

**Example:**
```javascript
// Inside renderBank(), replace existing listener:
pieceEl.addEventListener('click', () => {
  if (!amIActive) return;
  if (selectedShapeId === shape.id) {
    // Deselect
    selectedShapeId = null;
    selectedRotation = 0;
  } else {
    // Select — reset rotation to 0
    selectedShapeId = shape.id;
    selectedRotation = 0;
  }
  updateBankSelection();
});
```

### Pattern 3: lastHoveredRow/Col Tracking

**What:** Add `lastHoveredRow` and `lastHoveredCol` as module-level variables. Update them inside the existing `mousemove` listener in `renderGrid()`. After a rotation, call `updateGhostPreview(lastHoveredRow, lastHoveredCol)` if both are non-null.

**Why:** `updateGhostPreview()` is currently only called from `mousemove`. After a rotation with no mouse movement, the ghost stays at old rotation. Caching last hovered position allows re-triggering the ghost at the correct cell after rotation.

**Example:**
```javascript
// Update existing mousemove listener in renderGrid():
cell.addEventListener('mousemove', () => {
  lastHoveredRow = r;
  lastHoveredCol = c;
  if (selectedShapeId) updateGhostPreview(r, c);
});

// Also add mouseleave to clear tracked position:
// (gameGrid.addEventListener('mouseleave') already calls clearGhostPreview() — add null reset there)
```

### Anti-Patterns to Avoid

- **Using `event.detail` to detect double-click:** `event.detail` equals `2` on the second click of a double-click, but the click event still fires before `dblclick`. This approach requires blocking the first click with `event.detail === 1` checks, which are fragile with OS-level dblclick timing differences. The `setTimeout`/`clearTimeout` approach is more robust. (Confidence: HIGH — CONTEXT.md explicitly locks `setTimeout`/`clearTimeout`.)
- **Per-cell timer stored in closure:** Works within a render cycle but adds complexity. Simpler: one shared module-level `clickTimer`.
- **Attaching listeners to `gameGrid` via event delegation instead of per-cell:** Works, but inconsistent with current codebase pattern which attaches per-cell. Changing the event delegation approach would require refactoring the row/col lookup, which is out of scope.
- **Calling `renderGrid()` inside the click handler:** Do not re-render the grid after rotation — only update state variables and call `updateBankSelection()` + `updateGhostPreview()`. The grid re-renders only on `game:stateUpdate` from the server.
- **Forgetting `clearTimeout(clickTimer)` in dblclick handler:** The `dblclick` event fires after two `click` events. If `clearTimeout` is not called at the top of the `dblclick` handler, the rotation fires anyway. This is the most common bug with this pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Click/dblclick disambiguation | Custom event state machine | `setTimeout(300)` + `clearTimeout` | Native pattern, zero deps, handles all OS timing variations |
| Rotation math | New rotation function | Existing `rotateCells(cells, rotation)` | Already correct, used by ghost + cursor, duplicates server math |
| Bank mini-grid rebuild | New rendering function | Existing `buildMiniGrid(rotatedCells, color)` | Already handles rotated cells correctly when called from `updateBankSelection()` |
| Ghost re-render after rotate | New ghost function | Existing `updateGhostPreview(r, c)` | Already reads `selectedRotation` — just needs to be called with cached coords |

**Key insight:** The hard work is already done. `updateBankSelection()` already rebuilds the mini-grid at `selectedRotation`. `updateGhostPreview()` already reads `selectedRotation`. Rotating is just incrementing `selectedRotation` and calling these two functions. The only new code is the disambiguator wiring and the `lastHoveredRow`/`lastHoveredCol` tracking.

## Common Pitfalls

### Pitfall 1: Double-Click Fires Two Click Events Before dblclick

**What goes wrong:** User double-clicks a cell. Browser fires: `click` → `click` → `dblclick`. Without `clearTimeout`, the first click starts a 300ms timer. If the second click fires within 300ms (it will — a real double-click is typically 100-200ms), the timer is still pending when `dblclick` fires. The rotation fires 300ms after the double-click, even though the user intended to place.

**Why it happens:** `dblclick` fires after both click events, not instead of them. The `setTimeout` timer needs to be cancelled explicitly.

**How to avoid:** Always call `clearTimeout(clickTimer)` as the FIRST line of the `dblclick` handler, before any conditional logic.

**Warning signs:** Piece rotates when you try to place it via double-click.

### Pitfall 2: Ghost Preview Stale After Rotation

**What goes wrong:** User selects a piece, hovers over a cell, single-clicks to rotate. Mouse hasn't moved. Ghost still shows old rotation orientation.

**Why it happens:** `updateGhostPreview()` is only called from `mousemove`. After rotation with no mouse movement, nothing triggers a ghost redraw.

**How to avoid:** Cache `lastHoveredRow`/`lastHoveredCol` in `mousemove`, and call `updateGhostPreview(lastHoveredRow, lastHoveredCol)` after incrementing `selectedRotation` in the rotate action (guard with null check).

**Warning signs:** Ghost preview doesn't update rotation until mouse moves.

### Pitfall 3: Bank Click Still Rotates (Old Behavior Not Removed)

**What goes wrong:** `renderBank()` currently has: `if (selectedShapeId === shape.id) { selectedRotation = (selectedRotation + 90) % 360; }` (lines 277-278). If this is not replaced, clicking the same bank piece still rotates it.

**Why it happens:** Forgetting to update `renderBank()` when only focusing on `renderGrid()`.

**How to avoid:** The bank click handler MUST be replaced entirely. New behavior: select-only (reset to 0°) or deselect-only. No rotation on bank click.

**Warning signs:** Clicking same bank piece twice rotates instead of deselecting.

### Pitfall 4: Global Click Deselect Handler Fires for Grid Clicks

**What goes wrong:** The existing global `document.addEventListener('click', ...)` handler deselects the piece when clicking outside grid/bank. A grid cell click propagates up to `document` — if the grid click handler sets `selectedShapeId = null`, the rotation state is lost.

**Why it happens:** The global handler checks `e.target.closest('#game-grid')` before deselecting, so grid cells are correctly excluded. This is already handled. BUT: the rotate action (in `setTimeout`) runs asynchronously, AFTER the synchronous event propagation. So the global click handler fires first (correctly does nothing for grid clicks), and then the `setTimeout` fires 300ms later. This is safe.

**How to avoid:** No special handling needed — the existing guard `!e.target.closest('#game-grid')` already excludes grid cells from deselection.

**Warning signs:** Would manifest as piece deselecting on every grid click, which is an obvious bug.

### Pitfall 5: `mouseleave` Not Clearing lastHoveredRow/Col

**What goes wrong:** User hovers over cell [2,3], then moves mouse off the grid entirely, then single-clicks elsewhere. The stale `lastHoveredRow=2, lastHoveredCol=3` causes `updateGhostPreview(2, 3)` to fire, showing a ghost at a cell the cursor isn't near.

**Why it happens:** `lastHoveredRow`/`lastHoveredCol` are only updated in `mousemove` inside cells.

**How to avoid:** In the existing `gameGrid.addEventListener('mouseleave', ...)` handler, add `lastHoveredRow = null; lastHoveredCol = null;` alongside the existing `clearGhostPreview()` call.

**Warning signs:** Ghost appears at wrong cell after rotating when mouse is off grid.

### Pitfall 6: Rotation Fires When No Piece Is Selected

**What goes wrong:** User clicks empty grid cell with no piece selected — rotation logic fires but increments `selectedRotation` when `selectedShapeId` is null.

**Why it happens:** Missing guard in the rotate action inside `setTimeout`.

**How to avoid:** First line of the rotate action inside `setTimeout`: `if (!selectedShapeId) return;`

**Warning signs:** `selectedRotation` becomes non-zero with no selected piece, causing mismatched rotation on next selection.

## Code Examples

### Complete Disambiguator Pattern for renderGrid()

```javascript
// Source: MDN "dblclick" event + setTimeout disambiguation pattern
// (verified: all browsers fire click before dblclick — HIGH confidence)

// Module-level additions (add near other state variables at top of file):
let clickTimer = null;
let lastHoveredRow = null;
let lastHoveredCol = null;

// Inside renderGrid(), replace existing mousemove + click listeners:
cell.addEventListener('mousemove', () => {
  lastHoveredRow = r;
  lastHoveredCol = c;
  if (selectedShapeId) updateGhostPreview(r, c);
});

cell.addEventListener('click', () => {
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    // Single-click: rotate selected piece
    if (!selectedShapeId) return;
    selectedRotation = (selectedRotation + 90) % 360;
    updateBankSelection();
    if (lastHoveredRow !== null && lastHoveredCol !== null) {
      updateGhostPreview(lastHoveredRow, lastHoveredCol);
    }
  }, 300);
});

cell.addEventListener('dblclick', () => {
  clearTimeout(clickTimer);  // MUST be first — cancels pending rotate
  if (selectedShapeId) {
    // Place selected piece
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
  } else if (content && content.movable !== false) {
    // Return placed piece
    handleReturnClick(content.shapeId);
  }
});
```

### Updated mouseleave Handler

```javascript
// Update existing handler to also clear hovered-cell cache:
gameGrid.addEventListener('mouseleave', () => {
  clearGhostPreview();
  lastHoveredRow = null;
  lastHoveredCol = null;
});
```

### Updated Bank Click Handler (renderBank)

```javascript
// Replace existing click listener in renderBank():
pieceEl.addEventListener('click', () => {
  if (!amIActive) return;
  if (selectedShapeId === shape.id) {
    selectedShapeId = null;
    selectedRotation = 0;
  } else {
    selectedShapeId = shape.id;
    selectedRotation = 0;
  }
  updateBankSelection();
});
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Single `click` handler for place + return | `click` (rotate) + `dblclick` (place/return) with 300ms disambiguator | Adds 300ms latency to place action — acceptable UX tradeoff for rotation gesture |
| Bank click rotates on second click | Bank click select-or-deselect only | Simpler bank UX, rotation exclusively via grid |
| Return via single click on placed piece | Return via double-click on placed piece | Consistent with new single-click=rotate model |

**Note on 300ms latency:** The REQUIREMENTS.md mentions "200ms Debounce" for CTRL-01, but CONTEXT.md locks the window at 300ms. Use 300ms as specified in CONTEXT.md (the more recent decision overrides). Consider naming it `const DBLCLICK_DELAY = 300` consistent with the project pattern of named constants (STATE.md: "DBLCLICK_DELAY = 200 (named constant, not inline magic number)"). The value is 300ms per CONTEXT.md, the naming pattern is established.

## Open Questions

1. **Timer variable naming: `clickTimer` vs `DBLCLICK_DELAY` constant**
   - What we know: STATE.md documents the decision to use a named constant `DBLCLICK_DELAY = 200`. CONTEXT.md locks the value at 300ms.
   - What's unclear: Should the constant be 200 or 300? REQUIREMENTS.md says "200ms Debounce"; CONTEXT.md (more recent, from user discussion) says "300ms window". The constant name and timer variable name are both at Claude's discretion.
   - Recommendation: Use `const DBLCLICK_DELAY = 300` (honor CONTEXT.md as the most recent decision), name the timer `let clickTimer = null`. Document the 300ms choice in a comment referencing the interaction model discussion.

2. **Visual feedback during 300ms window**
   - What we know: Claude's Discretion — no user requirement for feedback.
   - What's unclear: Whether a subtle cursor change or opacity flash during the 300ms window would improve UX.
   - Recommendation: No visual feedback in Phase 7. Adding visual feedback would complicate the plan and is not in requirements. Keep it clean.

## Sources

### Primary (HIGH confidence)

- MDN Web Docs: `dblclick` event — confirms browser fires `click` → `click` → `dblclick` sequence; `clearTimeout` in `dblclick` handler is the canonical disambiguation approach
- `client/main.js` (lines 183-251) — `renderGrid()` current click + mousemove implementation, confirmed by direct code read
- `client/main.js` (lines 255-287) — `renderBank()` current click implementation including rotation behavior to be removed
- `client/main.js` (lines 346-362) — `updateBankSelection()` already handles rotation display at `selectedRotation`
- `client/main.js` (lines 391-409) — `updateGhostPreview()` already reads `selectedRotation`
- `.planning/phases/07-new-interaction-model/07-CONTEXT.md` — locked user decisions

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — `DBLCLICK_DELAY = 200` named-constant decision; confirmed naming convention

### Tertiary (LOW confidence)

- None — all key findings are grounded in direct code inspection or locked user decisions.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all tools are existing browser APIs and in-codebase functions
- Architecture: HIGH — code read directly; existing functions verified to work with rotation state
- Pitfalls: HIGH — derived from direct code analysis and known browser event sequencing behavior

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable vanilla JS domain; no external dependencies to track)
