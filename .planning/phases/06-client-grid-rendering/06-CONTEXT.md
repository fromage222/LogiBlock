# Phase 6: Client Grid Rendering - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

The client renders the irregular 5×9 grid correctly — inactive corner cells appear as transparent visual gaps, and all 10 pieces display with distinct colors in a redesigned bank panel. No server changes. No new interaction model (that's Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Inactive cell visual
- Fully transparent: `background: transparent`, no border
- Cell element remains in the DOM (grid layout requires it) but is completely invisible
- Blends into the page background (`#f0f0f5`)
- No hover feedback whatsoever — dead zone
- Border-radius: Claude's discretion (invisible anyway)

### Inactive cell interaction
- `pointer-events: none` via `.grid-cell.inactive` CSS rule
- No JS event listeners needed — CSS handles everything
- Cursor falls back naturally to parent container default (`cursor: default` effectively)
- Ghost preview already handles inactive cells via `=== null` guard in `updateGhostPreview()` — no additional code needed

### Color palette for 10 pieces
- Keep existing 6 colors intact: `#5c85d6` (blue), `#e07b39` (orange), `#6ab187` (green), `#c05c7e` (pink), `#9b6bb5` (purple), `#c8b84a` (yellow-olive)
- Add 4 new harmonious colors in the same medium-saturation style — Claude picks colors that maximally contrast with existing 6 (candidates: teal, coral/red, brown/tan, lime)
- Same color used consistently everywhere: grid placed cells, bank mini-shapes, cursor piece preview

### Bank panel layout (Aussehen der Bank)
- Pieces displayed as actual mini-shapes (their real piece shapes rendered as small colored cells), not as info cards
- **2-column grid layout**: 5 pieces per column, all 10 visible at a glance on the right side of the game board — no scrolling
- Mini-cell size: **8px** (reduced from current 10px) so all 10 pieces fit in 2 columns without overflow
- Placed pieces **disappear** from the bank when placed on the board — remaining pieces reflow into the grid
- Selected piece retains clear visual highlight (existing `.selected` class with border/background — keep behavior)
- No card-style containers — pieces sit directly as shapes in the bank

### Claude's Discretion
- Exact 4 new color hex values (pick for maximal perceptual contrast with existing 6)
- Mini-cell border-radius in bank shapes
- Exact 2-column CSS implementation (CSS grid vs flexbox + fixed width)
- Border-radius on inactive cells (invisible, doesn't matter)

</decisions>

<specifics>
## Specific Ideas

- "Alle Teile sollen verteilt aber auf einem Blick sichtbar rechts neben dem Spielfeld liegen" — all pieces visible at a glance, no scrolling required
- "Es soll keine Karte sein sondern die Teile sollen da liegen wie auf dem Grid später auch aber kleiner" — pieces should look like they do on the board, just smaller (mini-shapes, not cards)
- Bank should feel like a holding area showing the actual piece shapes, not an abstract list

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderGrid()` in `client/main.js:172` — existing render loop; add `inactive` branch alongside `null` and `placed` checks
- `PIECE_COLORS` array at `client/main.js:36` — extend from 6 to 10 entries
- `initPieceColors()` at `client/main.js:43` — already assigns colors from PIECE_COLORS cyclically; no change needed once array is extended
- `pieceColors` map — already drives grid, bank, and cursor piece coloring; consistent color everywhere already works
- `.grid-cell`, `.grid-cell.empty`, `.grid-cell.placed`, `.grid-cell.anchor` CSS classes — add `.grid-cell.inactive` as new variant
- Bank rendering in `renderBank()` — currently uses `.bank-piece` with mini-grid cells at 10px; needs 2-column layout and 8px cells

### Established Patterns
- `content === null` check in `renderGrid()` → inactive cells are `{ inactive: true }` objects (from Phase 4 sentinels), not null — new `else if (content?.inactive)` branch needed
- Per-piece color via `cell.style.background = pieceColors[content.shapeId]` — same pattern reused in bank mini-grid
- `pointer-events: none` not currently used in CSS — new pattern for inactive cells
- Ghost preview already guards `=== null` — inactive sentinel objects naturally fall through as non-null, so ghost preview already treats them as occupied (invalid target) — confirmed no additional code needed

### Integration Points
- `getPublicState()` on server sends `{ inactive: true }` in grid cells at inactive positions (set up in Phase 4)
- Client reads `state.grid[r][c]` — the new `content?.inactive` check in `renderGrid()` connects to this
- Bank 2-column layout change affects `#piece-bank` CSS selector in `client/style.css`

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-client-grid-rendering*
*Context gathered: 2026-03-19*
