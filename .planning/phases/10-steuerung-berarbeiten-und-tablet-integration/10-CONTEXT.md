# Phase 10: Steuerung überarbeiten und Tablet Integration - Context

**Gathered:** 2026-04-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Rework the control model for both desktop and tablet, unifying it under a single-click-to-place + rotation-button paradigm. Add touch event support so tablet players can drag a piece from the bank to position it on the grid. Make the grid auto-scale to available screen space on all devices. Landscape tablet (1024×768+) is the tablet target. No new game mechanics in scope.

</domain>

<decisions>
## Implementation Decisions

### Unified Interaction Model (Desktop + Touch)
- **Single click / tap on an empty grid cell = place the selected piece** (replaces the old double-click-to-place model)
- The `setTimeout`/`clearTimeout` click disambiguation is **removed entirely** — no 150ms delay
- Single click on a placed movable piece (with no piece selected) = **return it to bank**
- Rotation is exclusively via **dedicated rotation buttons** (↺ / ↻) placed near the bank panel
- Rotation buttons are **always visible on all devices** (no pointer-coarse detection needed)
- R keyboard shortcut (EXT-01) is **added** — R key rotates the selected piece 90° CW

### Touch Drag-to-Preview Model (Tablet)
- `touchstart` on a **bank piece** → selects the piece and begins drag
- `touchmove` on the grid → **ghost preview follows the finger** (reuses `updateGhostPreview(r, c)`)
- `touchend` on the grid → **ghost stays at last position** (piece is positioned but not yet placed)
- A subsequent **tap on the ghost-highlighted cell** → confirms placement
- Dragging the finger back off the grid / onto the bank → **deselects** (same behavior as desktop `document.addEventListener('click', deselect)`)

### Long-Press Return (Touch only)
- Long-press (~500ms) on a placed movable piece = **return it to bank** (touch equivalent of desktop single-click return)
- Uses `setTimeout` on `touchstart`, cancelled by `touchend` within 500ms if it's a drag not a press

### Ghost Preview on Desktop (unchanged)
- Desktop ghost preview stays mousemove-based (no change needed)
- Rotation buttons trigger `updateGhostPreview(lastHoveredRow, lastHoveredCol)` after updating `selectedRotation` — same as current behavior

### Responsive Layout — Auto-Scaling Grid
- Grid cells: **auto-scale via CSS** to fill available space on both desktop and tablet
  - Current fixed 40px replaced with a CSS variable (e.g. `--cell-size`) calculated from viewport width
  - Layout stays side-by-side (grid left, bank+controls right) at all sizes
- Target breakpoint: landscape tablet ≥ 1024px wide
- Game screen `max-width: 960px` can be relaxed or removed for larger viewports
- Rotation buttons scale with the bank panel (no separate sizing needed)

### Portrait Mode
- On portrait orientation (or viewport width < ~768px in landscape logic), show a fullscreen overlay: **"Bitte Querformat verwenden"** (German, consistent with UI convention)
- Implemented via CSS `@media (orientation: portrait)` or a JS `resize`/`orientationchange` listener

### Claude's Discretion
- Exact CSS formula for `--cell-size` auto-scaling (e.g. `min(calc((100vw - 200px) / 9), 60px)` or similar)
- Visual style of the rotation buttons (size, icon choice, hover/active states)
- Exact long-press duration (suggested: 500ms)
- Whether to implement portrait overlay as pure CSS or JS-driven
- Touch deselect implementation detail (touchstart on document vs existing click listener)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Interaction requirements
- `REQUIREMENTS.md` §CTRL — CTRL-01–CTRL-04 define the original interaction model; this phase replaces/extends them for unified model
- `REQUIREMENTS.md` §Out of Scope — Drag & Drop (HTML5) explicitly excluded; touch drag-to-preview is different and in scope

### Prior context (prior phase decisions that interact with this phase)
- `.planning/phases/07-new-interaction-model/07-CONTEXT.md` — Original click model decisions; Phase 10 supersedes the single-click-rotate / double-click-place split
- `.planning/phases/06-client-grid-rendering/06-CONTEXT.md` — Inactive cell CSS (`pointer-events: none`) — must be preserved when adding touch listeners

No external design specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `updateGhostPreview(r, c)` ([client/main.js:391](../../client/main.js#L391)) — already works from row/col input; reuse for touchmove ghost
- `refreshCursorPiece()` ([client/main.js:329](../../client/main.js#L329)) — floating piece display; already used after place/deselect
- `updateBankSelection()` ([client/main.js:346](../../client/main.js#L346)) — rebuilds bank mini-grid at current rotation; call after rotation button clicks
- `handleReturnClick(shapeId)` ([client/main.js:427](../../client/main.js#L427)) — emits `game:move` with `action: 'return'`; reuse for long-press return
- `rotateCells(cells, rotation)` ([client/main.js:57](../../client/main.js#L57)) — rotation math; already used by ghost and cursor
- `document.addEventListener('click', deselect)` ([client/main.js:519](../../client/main.js#L519)) — existing deselect-on-outside-click; touch drag-off-grid should reuse same deselect logic

### Code to Remove / Replace
- `DBLCLICK_DELAY = 150` constant ([client/main.js:38](../../client/main.js#L38)) — remove
- `clickTimer` module-level variable ([client/main.js:39](../../client/main.js#L39)) — remove
- `click` listener with `setTimeout`/`clearTimeout` inside `renderGrid()` ([client/main.js:290–301](../../client/main.js#L290-L301)) — replace with direct place handler
- `dblclick` listener inside `renderGrid()` ([client/main.js:304–330](../../client/main.js#L304-L330)) — remove (logic moves to single click)

### Established Patterns
- `selectedShapeId` / `selectedRotation` — module-level state; all renderers read from these directly; rotation buttons mutate `selectedRotation`
- German UI labels: all player-facing strings are German (use "Bitte Querformat verwenden", button labels e.g. "Drehen ↺")
- Click listeners attached per-cell inside `renderGrid()` — touch listeners follow the same pattern
- Bank piece click in `renderBank()` ([client/main.js:358](../../client/main.js#L358)) — add `touchstart` handler here for drag initiation

### Integration Points
- `renderGrid()` — add `touchmove`, `touchend`, and long-press (`touchstart` + `setTimeout`) handlers per cell
- `renderBank()` — add `touchstart` handler on each bank piece to initiate drag (select + start ghost tracking)
- CSS `.grid-cell` width/height (currently 40px fixed at [style.css:441](../../style.css#L441)) — replace with `--cell-size` CSS variable
- `#game-screen { max-width: 960px }` ([style.css:152](../../style.css#L152)) — relax for auto-scaling
- Add `@media (orientation: portrait)` CSS rule for portrait overlay
- Add rotation buttons HTML to `index.html` near the bank panel

</code_context>

<specifics>
## Specific Ideas

- "Ein Klick platzieren und drehen auch über einen button wie bei tablet" — unified model, no gesture split between devices
- The ghost drag model: finger down on bank piece → drag to grid position → lift finger = ghost stays → tap = confirm
- Auto-scaling grid should work on desktop too (not just tablet) — responsive cell sizing across the board

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-steuerung-berarbeiten-und-tablet-integration*
*Context gathered: 2026-04-01*
