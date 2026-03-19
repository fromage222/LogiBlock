# Phase 7: New Interaction Model - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current click-to-place model with a two-gesture model: single-click on an active grid cell rotates the selected piece 90° CW; double-click on an active grid cell places the selected piece. The ghost preview and bank mini-grid must immediately reflect the current rotation after each rotate action. Returning a placed piece to the bank is also part of this phase. No new UI panels or server changes are in scope.

</domain>

<decisions>
## Implementation Decisions

### Grid single-click behavior
- Single-click on any active grid cell rotates the selected piece 90° CW (0→90→180→270→0)
- The piece remains selected after rotation
- If no piece is selected, single-click on an empty cell does nothing (silently ignored)
- The first click of a double-click must NOT trigger rotation — use `setTimeout`/`clearTimeout` disambiguation (300ms window)

### Grid double-click behavior
- Double-click on any active grid cell = action:
  - If a piece is selected: place it at that cell (no extra rotation applied)
  - If no piece is selected AND the cell has a movable piece: return that piece to the bank
  - If neither condition: do nothing

### Bank piece click behavior
- Clicking a bank piece selects it (resets rotation to 0°)
- Clicking the same already-selected bank piece deselects it
- Bank clicks do NOT rotate — rotation only happens via grid single-click
- (Replaces current behavior where second bank click rotated +90°)

### Return-piece mechanic
- Double-click on a placed (movable) piece returns it to the bank
- This replaces the old single-click-to-return behavior, which conflicts with the new rotation gesture

### No-piece-selected clicks
- Single or double click on an empty cell with no piece selected: silently ignored

### Click disambiguation timing
- 300ms `setTimeout` window for distinguishing single-click (rotate) from double-click (place/return)
- First click of a double-click sequence must not fire the rotate action

### Claude's Discretion
- Exact structure of the disambiguator (per-cell timer vs shared timer)
- Whether to use native `dblclick` event + prevent default or pure `setTimeout` approach
- Visual feedback during the 300ms disambiguation window (if any)

</decisions>

<specifics>
## Specific Ideas

- The cursor piece and ghost preview already update correctly when `selectedRotation` changes — the rotate action just needs to increment `selectedRotation` and call `updateBankSelection()` + `updateGhostPreview(lastHoveredRow, lastHoveredCol)`
- The cursor piece mini-grid already has `pointer-events: none`, so click events pass through it correctly (fixed in Phase 6)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `rotateCells(cells, rotation)` ([client/main.js:28-33](../../client/main.js#L28-L33)): rotation math already correct, used by ghost + cursor
- `updateBankSelection()` ([client/main.js:346-362](../../client/main.js#L346-L362)): rebuilds mini-grid for selected piece at current rotation — call this after rotate
- `updateGhostPreview(r, c)` ([client/main.js:391-409](../../client/main.js#L391-L409)): redraws ghost at current rotation — call this after rotate
- `refreshCursorPiece()` ([client/main.js:329-338](../../client/main.js#L329-L338)): rebuilds cursor preview at current rotation — already called by `updateBankSelection()`
- `handleReturnClick(shapeId)` ([client/main.js:427-432](../../client/main.js#L427-L432)): emits `game:move` with `action: 'return'` — reuse for double-click return

### Established Patterns
- `selectedShapeId` / `selectedRotation` are module-level state — all renderers read from these directly
- Click listeners are attached per-cell inside `renderGrid()` (lines 225–251) — this is where the new disambiguation logic goes
- Bank click listener is in `renderBank()` (lines 275–284) — update this to select-only behavior

### Integration Points
- `renderGrid()` ([client/main.js:183](../../client/main.js#L183)): attach new single-click (rotate) and double-click (place/return) handlers here
- `renderBank()` ([client/main.js:255](../../client/main.js#L255)): simplify click handler to select-only
- A module-level `lastHoveredCell` variable needs tracking so ghost can redraw at the correct position after rotation (mousemove already calls `updateGhostPreview` but a rotation without mouse movement needs to re-trigger it)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-new-interaction-model*
*Context gathered: 2026-03-19*
