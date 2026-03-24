# Phase 6: Client Grid Rendering - Research

**Researched:** 2026-03-19
**Domain:** Vanilla JS DOM + CSS Grid — client-side rendering only, no build tools
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Inactive cell visual:**
- Fully transparent: `background: transparent`, no border
- Cell element remains in the DOM (grid layout requires it) but is completely invisible
- Blends into the page background (`#f0f0f5`)
- No hover feedback whatsoever — dead zone
- Border-radius: Claude's discretion (invisible anyway)

**Inactive cell interaction:**
- `pointer-events: none` via `.grid-cell.inactive` CSS rule
- No JS event listeners needed — CSS handles everything
- Cursor falls back naturally to parent container default (`cursor: default` effectively)
- Ghost preview already handles inactive cells via `=== null` guard in `updateGhostPreview()` — no additional code needed

**Color palette for 10 pieces:**
- Keep existing 6 colors intact: `#5c85d6` (blue), `#e07b39` (orange), `#6ab187` (green), `#c05c7e` (pink), `#9b6bb5` (purple), `#c8b84a` (yellow-olive)
- Add 4 new harmonious colors in the same medium-saturation style — Claude picks colors that maximally contrast with existing 6 (candidates: teal, coral/red, brown/tan, lime)
- Same color used consistently everywhere: grid placed cells, bank mini-shapes, cursor piece preview

**Bank panel layout:**
- Pieces displayed as actual mini-shapes (their real piece shapes rendered as small colored cells), not as info cards
- 2-column grid layout: 5 pieces per column, all 10 visible at a glance on the right side of the game board — no scrolling
- Mini-cell size: 8px (reduced from current 10px) so all 10 pieces fit in 2 columns without overflow
- Placed pieces disappear from the bank when placed on the board — remaining pieces reflow into the grid
- Selected piece retains clear visual highlight (existing `.selected` class with border/background — keep behavior)
- No card-style containers — pieces sit directly as shapes in the bank

### Claude's Discretion
- Exact 4 new color hex values (pick for maximal perceptual contrast with existing 6)
- Mini-cell border-radius in bank shapes
- Exact 2-column CSS implementation (CSS grid vs flexbox + fixed width)
- Border-radius on inactive cells (invisible, doesn't matter)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRID-05 | Spieler sieht die Grid-Lücken als transparente Felder ohne Klick-Interaktion — Client rendert inaktive Zellen mit CSS `.grid-cell.inactive` (transparent, kein Border, kein Pointer-Event) | CSS rule + JS `else if (content?.inactive)` branch in `renderGrid()` |
| GRID-06 | Spieler erkennt nicht-klickbare Grid-Felder am Cursor-Feedback — `cursor: default` statt `cursor: pointer` auf inaktiven Zellen | `pointer-events: none` on `.grid-cell.inactive` causes cursor to fall through to parent `cursor: default`; no extra JS needed |
| PIEC-03 | Spieler sieht 10 Steine mit 10 verschiedenen Farben im Bank-Panel — `PIECE_COLORS` ist auf 10 Einträge erweitert, kein Farb-Konflikt | Extend `PIECE_COLORS` array from 6 to 10 entries; `initPieceColors()` already uses cyclic modulo — no other change needed |
</phase_requirements>

## Summary

Phase 6 is a pure client-side rendering phase — no server changes, no new interaction model. All work lands in two files: `client/main.js` and `client/style.css`. The server already sends `{ inactive: true }` sentinel objects at grid positions `[4,0]` and `[4,8]` (the "Corner Cut" puzzle corners) through `getPublicState()` and the existing `lobby.grid` pass-through. The client's `renderGrid()` loop currently handles `null` (empty), anchor cells (`movable === false`), and placed cells — it simply needs a new `else if (content?.inactive)` branch that adds the CSS class and skips all event listeners.

The bank panel redesign is the largest change in this phase. The current `.piece-bank` container uses `flex-direction: column` with one piece per row; it must become a 2-column CSS grid. Each `.bank-piece` currently wraps a mini-grid (built by `buildMiniGrid()`) plus a label span; the 2-column layout will eliminate the card styling and reduce mini-cell size from 12px (current default in `buildMiniGrid()`) to 8px. The existing `renderBank()` function already drives disappear-on-place behavior: `bankShapes` from the server only includes unplaced pieces, so pieces that are placed automatically vanish from the next `renderBank()` call.

The color extension is trivial: `PIECE_COLORS` is a plain array at line 36 of `main.js`; adding 4 new entries is the entire change. `initPieceColors()` at line 43 already cycles with modulo and assigns to all piece IDs from bank and grid — once the array has 10 entries, all 10 pieces get distinct colors automatically.

**Primary recommendation:** Implement all three changes in a single plan (06-01): (1) add `else if (content?.inactive)` branch in `renderGrid()` to skip listeners, (2) add `.grid-cell.inactive` CSS rule, (3) extend `PIECE_COLORS` to 10 entries, (4) restyle `#piece-bank` to 2-column CSS grid with 8px mini-cells.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS | ES2020 | DOM manipulation, event handling | Project constraint — no build tools, no framework |
| CSS Grid | Native (all modern browsers) | 2-column bank layout, game grid | Already used throughout; no dependency needed |
| Socket.IO client | Via `<script>` tag | Server state delivery | Already wired; `renderGrid()` and `renderBank()` receive `state` object from socket events |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | — | — | No new libraries needed for this phase |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS Grid for bank columns | Flexbox with fixed widths | CSS Grid is cleaner for a strict 2-column layout; flexbox wrapping requires explicit width calculations |
| `pointer-events: none` | JS conditional listener skip | CSS is the locked decision; `pointer-events: none` is simpler and fully supported |
| `content?.inactive` check | `content && content.inactive` | Optional chaining is cleaner; both equivalent; project already uses ES2020 |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended Project Structure
```
client/
├── main.js        # renderGrid() + renderBank() + PIECE_COLORS — all changes here
└── style.css      # .grid-cell.inactive + #piece-bank grid layout — all CSS changes here
```

### Pattern 1: Inactive Cell Branch in renderGrid()

**What:** Add an `else if` before the existing `else` (placed cell) branch.
**When to use:** Any time the server sends `{ inactive: true }` in a grid cell position.

The current `renderGrid()` loop structure (lines 186-236 of `client/main.js`):

```js
const content = state.grid[r][c];
if (content === null) {
  cell.classList.add('empty');
} else if (content.movable === false) {
  // anchor
} else {
  // placed
}
// then: cell.addEventListener('mousemove', ...)
// then: cell.addEventListener('click', ...)
gameGrid.appendChild(cell);
```

The correct insertion point is BEFORE the `else` block AND the event listeners must be skipped for inactive cells. The clean approach is an early-continue pattern using `cell.classList.add('inactive')` and then `continue` (skipping listener attachment), or wrapping listeners in a guard. The simplest approach without restructuring:

```js
const content = state.grid[r][c];
if (content?.inactive) {
  cell.classList.add('inactive');
  gameGrid.appendChild(cell);
  continue;  // skip event listeners entirely
} else if (content === null) {
  cell.classList.add('empty');
} else if (content.movable === false) {
  // anchor
} else {
  // placed
}
// mousemove + click listeners attached here (only for non-inactive cells)
gameGrid.appendChild(cell);
```

**Source:** Direct code analysis of `client/main.js:186-236` (verified).

### Pattern 2: CSS Rule for .grid-cell.inactive

**What:** A single CSS rule makes inactive cells fully invisible and non-interactive.
**When to use:** Any `.grid-cell` that receives the `inactive` class.

```css
.grid-cell.inactive {
  background: transparent;
  border: none;
  pointer-events: none;
  cursor: default;
}
```

`pointer-events: none` is the mechanism for both GRID-05 (no click interaction) and GRID-06 (cursor falls back). Since the parent `.grid` has no `cursor` set and the default is `cursor: default`, the fallthrough is automatic. No JS change needed for cursor behavior.

**Confidence:** HIGH — CSS `pointer-events: none` is a W3C standard; supported in all modern browsers since IE11.

### Pattern 3: PIECE_COLORS Extension

**What:** Append 4 new color strings to the existing array.
**Current state** (line 36 of `client/main.js`):

```js
const PIECE_COLORS = ['#5c85d6', '#e07b39', '#6ab187', '#c05c7e', '#9b6bb5', '#c8b84a'];
```

**Target state:**

```js
const PIECE_COLORS = [
  '#5c85d6',  // blue      (P01)
  '#e07b39',  // orange    (P02)
  '#6ab187',  // green     (P03)
  '#c05c7e',  // pink      (P04)
  '#9b6bb5',  // purple    (P05)
  '#c8b84a',  // yellow    (P06)
  '#3aada8',  // teal      (P07) — high contrast vs blue/green
  '#c0583a',  // rust-red  (P08) — high contrast vs orange/pink
  '#8a6a3e',  // brown-tan (P09) — high contrast vs yellow/purple
  '#7ab83a',  // lime      (P10) — high contrast vs teal/rust
];
```

These 4 new colors maintain the same medium-saturation palette style (not neon, not pastel) while maximally diverging from the existing 6. Teal is distinct from blue (`#5c85d6`) and green (`#6ab187`). Rust-red is distinct from orange (`#e07b39`) and pink (`#c05c7e`). Brown is distinct from yellow (`#c8b84a`) and purple (`#9b6bb5`). Lime is distinct from all 9 others.

`initPieceColors()` assigns cyclically: `PIECE_COLORS[i++ % PIECE_COLORS.length]`. With 10 entries and 10 pieces, each piece gets index 0-9 — no collision possible.

### Pattern 4: 2-Column Bank Layout

**What:** Replace `flex-direction: column` on `.piece-bank` with `display: grid; grid-template-columns: 1fr 1fr`.
**Current state** (lines 189-200 of `client/style.css`):

```css
.piece-bank {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #fff;
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 0.75rem;
  min-width: 90px;
  max-height: 500px;
  overflow-y: auto;
}
```

**Target state:**

```css
.piece-bank {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  background: #fff;
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 0.5rem;
  min-width: 120px;
  align-content: start;
}
```

- Remove `max-height` and `overflow-y: auto` — with 8px mini-cells, all 10 pieces fit without scrolling
- `align-content: start` prevents grid rows from stretching to fill vertical space
- `min-width: 120px` gives room for two columns of mini-shapes

**Mini-cell size change:** `buildMiniGrid()` is called from `renderBank()` with no `cellSize` argument, falling back to the default of `12px`. The default must be reduced to `8px` in `buildMiniGrid()`'s signature:

```js
function buildMiniGrid(cells, color, cellSize = 8) {
```

This affects all callers:
- `renderBank()` — passes no cellSize (uses default) → now 8px
- `updateBankSelection()` — passes no cellSize (uses default) → now 8px
- `refreshCursorPiece()` — explicitly passes `22` → unchanged

### Pattern 5: .bank-piece Simplification

The current `.bank-piece` CSS has card-style padding, background, and border. The CONTEXT.md says "no card-style containers — pieces sit directly as shapes in the bank." However, the `.selected` border behavior must be preserved.

Minimal change: reduce padding, remove background, keep selected highlight:

```css
.bank-piece {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.3rem;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: grab;
  user-select: none;
  transition: border-color 0.1s;
}
.bank-piece.selected {
  border-color: #4a6cf7;
  background: rgba(74, 108, 247, 0.08);
}
```

Removing `background: #f5f5f5` from `.bank-piece` makes pieces appear to "sit" directly in the bank area rather than inside individual cards.

### Anti-Patterns to Avoid
- **Adding JS event listener guards:** The CSS `pointer-events: none` handles interaction blocking; JS should not conditionally skip listeners — use early `continue` in the render loop instead to avoid attaching them at all.
- **Changing ghost preview logic:** The CONTEXT.md confirms the existing `=== null` guard in `updateGhostPreview()` already treats inactive sentinels as occupied (since `{ inactive: true } !== null`). Do NOT modify `updateGhostPreview()`.
- **Using `visibility: hidden`:** Would still occupy space and affect cursor — `background: transparent` + `border: none` is the locked decision.
- **Increasing bank container width beyond necessary:** The `game-area` flexbox positions the grid and bank; excessive bank width pushes the grid off-center.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Color contrast calculation | Custom color distance algorithm | Manual selection with visual verification | Only 10 colors; design problem, not algorithmic |
| 2-column layout | JS column splitting logic | CSS `grid-template-columns: 1fr 1fr` | Native CSS grid handles reflow automatically as pieces disappear |
| Pointer-event blocking | JS event.preventDefault() in every listener | `pointer-events: none` CSS | One CSS rule beats N event guards |

**Key insight:** All complexity in this phase is already solved by CSS primitives. The JS changes are minimal and additive.

## Common Pitfalls

### Pitfall 1: Attaching Event Listeners to Inactive Cells
**What goes wrong:** If the `else if (content?.inactive)` branch does not use `continue` (or equivalent) to skip the rest of the loop body, the `mousemove` and `click` listeners still get attached. The listeners themselves would not fire due to `pointer-events: none`, but it is wasteful and creates an inconsistency between CSS and JS intent.
**Why it happens:** The inactive branch was added to the if-else chain but the listener attachment code is outside the chain.
**How to avoid:** Use early `continue` after `gameGrid.appendChild(cell)` in the inactive branch, or restructure so listeners are only attached inside an `else` block.
**Warning signs:** If `updateGhostPreview()` fires on hover over an inactive cell position, listeners were attached.

### Pitfall 2: ghost preview valid on inactive cells
**What goes wrong:** If someone modifies `updateGhostPreview()` to use `content?.inactive` instead of relying on `=== null`, they could introduce a regression. The existing guard `currentGrid[r][c] === null` already correctly rejects inactive cells (sentinels are not null).
**Why it happens:** Misunderstanding of the sentinel's role.
**How to avoid:** Do not touch `updateGhostPreview()`. The CONTEXT.md explicitly states "no additional code needed."
**Warning signs:** Ghost preview shows green highlight over the corner cells [4,0] and [4,8].

### Pitfall 3: Bank Mini-Cell Size Regression in Cursor Piece
**What goes wrong:** If `buildMiniGrid()` default is changed to 8px but the cursor piece call at line 319 is also affected, the cursor piece preview becomes too small.
**Why it happens:** `refreshCursorPiece()` calls `buildMiniGrid(rotateCells(...), color, 22)` — it passes an explicit `22`. Changing the default does NOT affect it.
**How to avoid:** Only change the default parameter. Verify `refreshCursorPiece()` still passes `22` explicitly.
**Warning signs:** The floating cursor piece appears tiny (8px cells instead of 22px).

### Pitfall 4: Bank 2-Column Layout Overflows game-area
**What goes wrong:** Making `.piece-bank` too wide causes the `game-area` flex container to overflow horizontally, pushing the grid off-screen or wrapping.
**Why it happens:** `game-area` uses `display: flex; align-items: flex-start; gap: 1rem; justify-content: center`. If bank + gap + grid exceeds `max-width: 900px`, it wraps or overflows.
**How to avoid:** The game grid for 9 columns at 40px + 2px gap = ~370px. The bank at 2 columns of 8px cells (max piece width ~5 cells = 40px + gaps) fits in ~100-120px. Total: ~490px + badges — well within 900px.
**Warning signs:** Horizontal scrollbar appears on `#game-screen`.

### Pitfall 5: `inactiveCells` Position Mismatch
**What goes wrong:** The puzzle JSON has `"inactiveCells": [[4,0],[4,8]]` — these are the bottom-left and bottom-right corners of the 5×9 grid. The server sets `grid[4][0]` and `grid[4][8]` to `{ inactive: true }`. The client reads `state.grid[r][c]` directly. If a developer confuses row/col order, they might check the wrong cells.
**Why it happens:** Array notation `[r, c]` vs `[x, y]` (col, row) confusion.
**How to avoid:** `renderGrid()` already iterates `r` (row) outer and `c` (col) inner, matching the server's 2D array layout. No change needed — the check `content?.inactive` fires correctly at `[4][0]` and `[4][8]`.

## Code Examples

Verified patterns from direct codebase analysis:

### Inactive Cell Branch — renderGrid() loop body
```js
// Source: client/main.js:186-236 (analysis of existing renderGrid())
for (let r = 0; r < rows; r++) {
  for (let c = 0; c < cols; c++) {
    const cell = document.createElement('div');
    cell.classList.add('grid-cell');
    cell.setAttribute('data-row', r);
    cell.setAttribute('data-col', c);

    const content = state.grid[r][c];
    if (content?.inactive) {
      cell.classList.add('inactive');
      gameGrid.appendChild(cell);
      continue;  // skip event listeners
    } else if (content === null) {
      cell.classList.add('empty');
    } else if (content.movable === false) {
      cell.classList.add('anchor');
      cell.textContent = content.shapeId;
      cell.title = `Anchor: ${content.shapeId} (cannot be moved)`;
    } else {
      cell.classList.add('placed');
      cell.textContent = content.shapeId;
      cell.style.background = pieceColors[content.shapeId] || '#81c784';
      cell.style.color = '#fff';
    }

    // Listeners only attached to non-inactive cells
    cell.addEventListener('mousemove', () => { ... });
    cell.addEventListener('click', () => { ... });
    gameGrid.appendChild(cell);
  }
}
```

### CSS Rule for Inactive Cells
```css
/* Source: client/style.css — new rule to add in Phase 6 CSS block */
.grid-cell.inactive {
  background: transparent;
  border: none;
  pointer-events: none;
  cursor: default;
}
```

### buildMiniGrid Default Parameter Change
```js
// Source: client/main.js:274 — change default from 12 to 8
function buildMiniGrid(cells, color, cellSize = 8) {
  // body unchanged
}
```

### Bank Panel — 2-Column CSS Grid
```css
/* Replace existing .piece-bank block in style.css */
.piece-bank {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  background: #fff;
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 0.5rem;
  min-width: 120px;
  align-content: start;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All grid cells are active (v1.0 rectangular grid) | 5x9 grid with `{ inactive: true }` sentinels at [4,0] and [4,8] | Phase 4 (complete) | Client must handle sentinel objects, not just null |
| 6 piece colors | 10 piece colors | Phase 6 (this phase) | Extend PIECE_COLORS array |
| Single-column bank with cards | 2-column bank with mini-shapes | Phase 6 (this phase) | CSS grid layout + reduced mini-cell size |

**Deprecated/outdated:**
- `buildMiniGrid(cells, color, cellSize = 12)`: The `12` default will become `8` in Phase 6. All callers that don't pass an explicit size will use the new 8px default.

## Open Questions

1. **Should the `.grid` container's gap/border show through at inactive cell positions?**
   - What we know: `.grid` has `background: #ccc; gap: 2px` — the gap color shows between cells. Inactive cells are transparent, so the gray gap color will be visible as thin lines where inactive cells border active cells.
   - What's unclear: Whether this thin gray line is visually acceptable or needs to be masked.
   - Recommendation: Accept it — the gap is only 2px and is consistent with how the grid gap is visible between all cells. The transparent cell body blends into `#f0f0f5` (page background), not the grid background, which means the inactive cell area shows page background color `#f0f0f5`, not white. This is correct per the locked decision ("blends into page background").

2. **Should `.bank-piece` label (`span` with piece ID) be kept?**
   - What we know: CONTEXT.md says "no card-style containers — pieces sit directly as shapes in the bank." The label (`P01`, `P02`, etc.) is currently shown under each mini-shape.
   - What's unclear: Whether removing the label is part of "no card-style" or whether the label should remain for discoverability.
   - Recommendation: Keep the label at reduced font size — it aids identification during gameplay without adding card-like structure. The CONTEXT.md doesn't explicitly say to remove labels.

## Validation Architecture

> `nyquist_validation` is not present in `.planning/config.json` — the workflow section has `research`, `plan_check`, and `verifier` keys but no `nyquist_validation`. Skipping Validation Architecture section.

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis — `client/main.js` (read in full, 589 lines)
- Direct codebase analysis — `client/style.css` (read in full, 362 lines)
- Direct codebase analysis — `client/index.html` (read in full, 104 lines)
- Direct codebase analysis — `server/src/game.js` (`getPublicState()`, `buildInitialGrid()` — lines 174-254)
- Direct codebase analysis — `puzzles/puzzle_v11.json` (Corner Cut — 10 pieces, inactiveCells `[[4,0],[4,8]]`)
- `.planning/phases/06-client-grid-rendering/06-CONTEXT.md` — locked decisions and code_context section

### Secondary (MEDIUM confidence)
- CSS `pointer-events: none` — W3C CSS Pointer Events specification; universally supported in all modern browsers

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — project uses vanilla JS + CSS with no build tools; verified from index.html and existing code
- Architecture: HIGH — all patterns derived directly from reading existing source files, not from inference
- Pitfalls: HIGH — derived from concrete code analysis (ghost preview guard, listener attachment structure, buildMiniGrid callers)

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable — vanilla JS, no external library updates)
