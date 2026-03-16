# Architecture Patterns

**Domain:** Irregular-grid puzzle game — v1.1 integration into existing LogiBlock codebase
**Researched:** 2026-03-15
**Confidence:** HIGH — based on full source read of all production files (game.js 419 LOC, socket.js 237 LOC, main.js 589 LOC, style.css 362 LOC, both puzzle JSONs)

---

## Integration Overview

This document answers: what changes, what stays the same, and in what order to build v1.1. Three features are being integrated into the existing v1.0 codebase:

1. Irregular 5x9 grid with inactive corner cells (43 active cells out of 45 total)
2. 10 custom pieces covering exactly 43 cells
3. New interaction: left-click on grid rotates, double-click places

The existing infrastructure — Socket.IO events, turn logic, win detection, leaderboard, disconnect handling, server/client screen flow — is **not touched**. All three features are isolated changes within four boundaries: puzzle JSON schema, `game.js` validation, `renderGrid()` in the client, and grid cell event handlers in the client.

---

## System Architecture (Unchanged)

```
Browser (Vanilla JS SPA)                Node.js Server
────────────────────────                ──────────────────────────────
main.js                                 server.js
  renderGrid()      ←─── game:start ─── io.emit('game:start', state)
  renderBank()      ←─── stateUpdate ── io.emit('game:stateUpdate', state)
  click/dblclick    ──── game:move ───► socket.on('game:move', ...)
  handlers                                game.js: placePiece()
                                          game.js: checkWin()
                                          game.js: advanceTurn()
                                        socket.js: registerSocketHandlers()
                                        puzzles/*.json → loadPuzzles()
```

Socket events stay unchanged. `game:move` payload shape `{ action, shapeId, rotation, originRow, originCol }` is unchanged. `game:start`, `game:stateUpdate`, `game:win` event names and structures are unchanged.

---

## Component Boundaries

| Component | Responsibility | What Changes in v1.1 |
|-----------|---------------|----------------------|
| `puzzles/*.json` | Declare grid shape, pieces, solution | Add `inactiveCells` array; new 5x9 puzzle file with 10 pieces |
| `game.js: validatePuzzleSchema()` | Validate puzzle JSON at startup | Accept optional `inactiveCells`, validate format when present |
| `game.js: buildInitialGrid()` | Create 2D grid array, place anchors | Mark inactive cells with `{ inactive: true }` sentinel |
| `game.js: placePiece()` | Validate and write piece to grid | No code change — existing `!== null` guard already blocks sentinel |
| `game.js: checkWin()` | Compare grid to solution | Add `!cell.inactive` guard in the null-check branch (1 line) |
| `game.js: getPublicState()` | Serialize grid for client | No change — grid flows through as-is |
| `client/main.js: renderGrid()` | Render grid cells | Detect `content.inactive`, render `.inactive` cell, skip listeners |
| `client/main.js: cell click handler` | Place piece on click | Change to: rotate on single `click` (with timeout), place on `dblclick` |
| `client/main.js: bank click handler` | Select/rotate via bank | Remove rotation from bank; bank click only selects |
| `client/main.js: updateGhostPreview()` | Ghost on mousemove | No change — `currentGrid[r][c] === null` already blocks inactive |
| `client/style.css` | Visual styles | Add `.grid-cell.inactive` rule; extend color palette |
| `server/src/socket.js` | Socket event routing | No changes |
| `server/src/server.js` | Express + Socket.IO setup | No changes |

---

## Feature 1: Irregular Grid

### Puzzle JSON Schema Change

Add an optional `inactiveCells` field listing `[row, col]` pairs that are outside the playable area. When absent, all cells within `gridSize` are active (backward-compatible with existing puzzles).

Using `inactiveCells` (exceptions) rather than `activeCells` (inclusions): for a 5x9=45-cell grid with only 4 removed corner cells, listing 4 is far less verbose than listing 43.

```json
{
  "id": "puzzle_v11",
  "name": "Corner Cut",
  "gridSize": { "rows": 5, "cols": 9 },
  "inactiveCells": [[3,7],[3,8],[4,7],[4,8]],
  "shapes": [ ... ],
  "solution": [
    [...],
    [...],
    [...],
    ["P1","P1","P2","P2","P3","P4","P4", null, null],
    ["P5","P5","P6","P6","P7","P8","P9", null, null]
  ]
}
```

Note: `solution` uses `null` at inactive positions — consistent with how the current puzzles use `null` for intentionally-empty cells.

### Server: `buildInitialGrid()` Change

Currently fills the grid with `null`. After the change, inactive cells get a sentinel value so the server and client can distinguish "empty + valid" from "not a cell":

```javascript
// Current behavior
grid[r][c] = null;  // all cells start empty

// After: inactive cells use sentinel
// Derive inactive set from puzzle.inactiveCells (if present)
const inactiveSet = new Set(
  (puzzle.inactiveCells || []).map(([r, c]) => `${r}-${c}`)
);

for (let r = 0; r < puzzle.gridSize.rows; r++) {
  for (let c = 0; c < puzzle.gridSize.cols; c++) {
    grid[r][c] = inactiveSet.has(`${r}-${c}`) ? { inactive: true } : null;
  }
}
```

The sentinel `{ inactive: true }` flows through `getPublicState()` to the client unchanged — no change needed in that function.

### Server: `placePiece()` — Zero Code Changes Needed

The current validation in `placePiece()`:

```javascript
if (lobby.grid[r][c] !== null) {
  return { ok: false, error: 'Cell occupied' };
}
```

The sentinel `{ inactive: true }` is not `null`, so this guard already rejects placement into inactive cells. No new error message is needed. No code change required.

### Server: `checkWin()` — One-Line Fix

Current code:

```javascript
if (expectedId === null) {
  if (cell !== null) return false;  // BUG: inactive sentinel is not null
```

After fix:

```javascript
if (expectedId === null) {
  if (cell !== null && !cell.inactive) return false;  // skip inactive sentinels
```

This is the only functional code change on the server.

### Server: `validatePuzzleSchema()` Change

Add optional validation block:

```javascript
if (puzzle.inactiveCells !== undefined) {
  if (!Array.isArray(puzzle.inactiveCells))
    throw new Error('"inactiveCells" must be an array');
  for (const entry of puzzle.inactiveCells) {
    if (!Array.isArray(entry) || entry.length !== 2 ||
        typeof entry[0] !== 'number' || typeof entry[1] !== 'number')
      throw new Error('Each "inactiveCells" entry must be [row, col] numbers');
  }
}
```

Existing puzzles without `inactiveCells` pass unchanged.

### Client: `renderGrid()` Change

Add inactive branch before the existing `empty`/`anchor`/`placed` logic:

```javascript
const content = state.grid[r][c];

// NEW: inactive cell — render as visual gap, no interaction
if (content && content.inactive) {
  cell.classList.add('inactive');
  gameGrid.appendChild(cell);
  continue;  // skip all event listeners
}

// Existing logic unchanged:
if (content === null) {
  cell.classList.add('empty');
} else if (content.movable === false) {
  cell.classList.add('anchor');
  // ...
} else {
  cell.classList.add('placed');
  // ...
}
```

### CSS: New `.grid-cell.inactive` Rule

```css
.grid-cell.inactive {
  background: transparent;
  border: none;
  cursor: default;
  pointer-events: none;
}
```

This makes inactive cells visually absent while the CSS Grid container remains rectangular for alignment. The grid appears irregular because inactive cells are invisible, but the underlying DOM structure stays a complete grid.

### Client: `updateGhostPreview()` — No Change Needed

The ghost validity check:

```javascript
currentGrid && currentGrid[r][c] === null
```

The sentinel `{ inactive: true }` is not `null`, so inactive cells are already excluded from valid ghost placement. No change needed.

---

## Feature 2: Custom Pieces

### What Changes

The puzzle JSON `shapes` array already supports arbitrary cell arrays of any size. Ten pieces with 3–5 cells is a **pure data change**. The server handles pieces of any shape through `rotateCells()` and the iteration loops in `placePiece()`. The client renders them through `buildMiniGrid()` which already handles arbitrary bounding boxes.

No code changes are needed for custom pieces. The feature is entirely in the new puzzle JSON file.

### Color Palette Expansion

The current palette has 6 colors, cycling with `i++ % PIECE_COLORS.length`. With 10 pieces, colors 1–4 would repeat, causing two pieces to share a color. Extend `PIECE_COLORS` in `main.js`:

```javascript
// Current (6 colors)
const PIECE_COLORS = ['#5c85d6', '#e07b39', '#6ab187', '#c05c7e', '#9b6bb5', '#c8b84a'];

// Recommended (10 distinct colors)
const PIECE_COLORS = [
  '#5c85d6', '#e07b39', '#6ab187', '#c05c7e', '#9b6bb5',
  '#c8b84a', '#4db6ac', '#ef5350', '#7e57c2', '#26a69a'
];
```

### Bank Scroll

The bank panel already has `max-height: 500px; overflow-y: auto`. With 10 pieces instead of 2–3, the bank scrolls. This is already handled. No CSS change needed.

---

## Feature 3: New Interaction Model

### Behavioral Change

| Trigger | Current Behavior | New Behavior |
|---------|-----------------|--------------|
| Click bank piece (not selected) | Select piece, rotation = 0 | Select piece, rotation = 0 (same) |
| Click bank piece (already selected) | Rotate +90° | Select piece, reset rotation to 0 (changed) |
| Click grid cell (piece selected) | Place piece | Rotate selected piece +90° (changed) |
| Double-click grid cell (piece selected) | (not handled) | Place piece (new) |
| Click grid cell (no piece, placed movable) | Return piece | Return piece (same) |

### Client: Bank Click Handler Change

Remove rotation from bank re-click. Bank clicks now only select:

```javascript
// Current
pieceEl.addEventListener('click', () => {
  if (!amIActive) return;
  if (selectedShapeId === shape.id) {
    selectedRotation = (selectedRotation + 90) % 360;  // REMOVE THIS
  } else {
    selectedShapeId = shape.id;
    selectedRotation = 0;
  }
  updateBankSelection();
});

// After
pieceEl.addEventListener('click', () => {
  if (!amIActive) return;
  selectedShapeId = shape.id;
  selectedRotation = 0;
  updateBankSelection();
});
```

### Client: Grid Cell Event Handler Change

**The double-click problem:** Browser fires `click → click → dblclick` for a double-click action. If the `click` handler rotates, the piece rotates twice (net 180°) before `dblclick` fires the place. This must be handled.

**Solution:** Defer single-click rotation using `setTimeout`. If `dblclick` fires, cancel the deferred rotation:

```javascript
let clickTimer = null;

// Single click on active cell
cell.addEventListener('click', (e) => {
  if (selectedShapeId) {
    // Defer rotation — cancel if dblclick fires first
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => {
      selectedRotation = (selectedRotation + 90) % 360;
      updateBankSelection();
      refreshCursorPiece();
      updateGhostPreview(r, c);
    }, 200);
    return;
  }
  // No piece selected: return placed piece if applicable
  if (content && content.movable !== false) {
    handleReturnClick(content.shapeId);
  }
});

// Double-click on active cell
cell.addEventListener('dblclick', () => {
  if (!selectedShapeId) return;
  clearTimeout(clickTimer);  // cancel any pending rotation
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
});
```

The 200ms delay is well below typical OS double-click threshold (400–500ms default) and is imperceptible to users for single-click rotation.

**Important:** The `clickTimer` variable must be declared in the outer scope of `renderGrid()`, not inside the per-cell loop, so it is shared across all cells. A double-click that spans two adjacent cells (click cell A, click cell B) still cancels the rotation from the first click.

The ghost preview (`mousemove` handler) is unchanged. The `mouseleave` cleanup is unchanged. The deselect-on-outside-click listener is unchanged.

---

## Data Flow

```
Puzzle JSON (inactiveCells: [[3,7],[3,8],[4,7],[4,8]])
    ↓
buildInitialGrid()
    → inactive cells → { inactive: true } in grid[r][c]
    → active empty cells → null in grid[r][c]
    → anchor shapes → { shapeId, movable: false } in grid[r][c]
    ↓
getPublicState() → grid serialized and sent to client (unchanged function)
    ↓
renderGrid() (client)
    → content.inactive === true → .inactive CSS class, no event listeners
    → content === null          → .empty, mousemove + click + dblclick listeners
    → content.movable === false → .anchor, no interaction
    → content.movable === true  → .placed, dblclick return handler
    ↓
User single-clicks empty cell (piece selected)
    → setTimeout(rotate, 200) — deferred
    → if dblclick fires within 200ms: clearTimeout, place instead

User double-clicks empty cell (piece selected)
    → clearTimeout (cancel deferred rotation)
    → socket.emit('game:move', { action:'place', rotation, originRow, originCol })
    → server: placePiece() validates — inactive sentinel blocks placement for free
    → server: checkWin() — skips inactive cells correctly
    → server: advanceTurn() if no win
    → io.to(room).emit('game:stateUpdate') OR game:win
    ↓
renderGrid() re-runs with new state
```

---

## Patterns to Follow

### Pattern 1: Sentinel for Inactive Cells (not null, not a separate structure)

Use `{ inactive: true }` directly in the grid 2D array. This keeps the grid as a single source of truth, flows through `getPublicState()` without any changes to that function, and lets the existing `!== null` guard in `placePiece()` block inactive cells for free. No parallel data structure needed.

### Pattern 2: Backward-Compatible Schema Extension

`inactiveCells` is optional. Existing puzzle files have no such key and pass `validatePuzzleSchema()` unchanged. The new puzzle adds the key. No migration of existing files, no server startup regression.

### Pattern 3: Deferred Single-Click for Double-Click Disambiguation

`setTimeout(fn, 200)` on `click` + `clearTimeout` on `dblclick`. Standard browser pattern for distinguishing single vs double click in vanilla JS. 200ms is safe — below human double-click speed and imperceptible as a rotation delay.

### Pattern 4: Server Payload Shape Preserved

The `game:move` socket message shape does not change. The client still sends `{ action, shapeId, rotation, originRow, originCol }`. The only change is which user gesture triggers the emit (dblclick instead of click). Server-side validation, socket.js routing, and all tests that assert on this payload remain valid.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Separate `activeCells` Set Alongside Grid

**What it is:** Maintaining a `Set<string>` of active cell keys in the lobby or puzzle object, checked separately from the grid during validation.

**Why bad:** Doubles state, requires synchronization with the grid. The `getPublicState()` function would need a new field. Client rendering would need to read from two places.

**Instead:** Embed `{ inactive: true }` directly in `grid[r][c]`. Single source of truth.

### Anti-Pattern 2: Client-Side Rotation as Server Input

**What it is:** Client sending pre-rotated cell coordinates to the server instead of `rotation` degree + origin.

**Why bad:** Breaks server-authoritative validation. The server's `rotateCells()` must re-derive shape for validation. The current `game:move` contract already sends `rotation` as a degree number — this must not change.

**Instead:** Keep `{ action, shapeId, rotation, originRow, originCol }` as-is. Server rotates independently.

### Anti-Pattern 3: dblclick Only (No Timeout Disambiguation)

**What it is:** Binding a `dblclick` handler for placement without handling the two preceding `click` events.

**Why bad:** The two `click` events fire before `dblclick` in the browser event sequence. Each fires the rotation handler, causing a net 180° rotation before the place emits.

**Instead:** Use the deferred `setTimeout` / `clearTimeout` pattern described above.

### Anti-Pattern 4: Changing Socket Event Payload or Names

**What it is:** Adding a new socket event for "rotate" or changing `game:move` payload structure because the interaction model changed.

**Why bad:** Breaks `socket.js` handler, breaks the 14 socket handler tests, requires coordinated server+client change, violates the no-breaking-changes constraint.

**Instead:** The interaction change is entirely in the client. The server receives the same `game:move` payload — just triggered by `dblclick` now instead of `click`.

### Anti-Pattern 5: Per-Cell `clickTimer` Variable

**What it is:** Declaring `let clickTimer = null` inside the `for` loop that creates grid cells.

**Why bad:** Each cell gets its own timer variable. A double-click where the first click lands on cell A and the second on cell B would not cancel cell A's timer — the rotation fires anyway.

**Instead:** Declare `clickTimer` once in `renderGrid()` scope, shared across all cells.

---

## What Is NOT Changing

The following are explicitly unchanged in v1.1:

| Component | Why Unchanged |
|-----------|---------------|
| `socket.js` | No new socket events. `game:move` payload unchanged. |
| `server.js` | No new routes or connection handling. |
| `game.js: advanceTurn()` | Turn logic independent of grid shape. |
| `game.js: advanceTurnIfActive()` | Disconnect handling unaffected. |
| `game.js: returnPiece()` | Scans for `cell.shapeId` — inactive sentinels have no `shapeId`, already ignored. |
| `game.js: placePiece()` | Existing `!== null` guard blocks sentinel for free. No code change. |
| `game.js: startGame()` | Calls `buildInitialGrid()`, which is the changed function. `startGame()` itself unchanged. |
| `game.js: recordLeaderboardEntry()` | Timer and leaderboard logic unchanged. |
| `game.js: getPublicState()` | Serializes grid as-is; sentinel flows through unchanged. |
| `main.js: renderBank()` | Unchanged except: (a) more colors in `PIECE_COLORS`, (b) bank click no longer rotates. |
| `main.js: renderTurnUI()` | Unchanged. |
| `main.js: renderWin()` | Unchanged. |
| `main.js: renderLeaderboard()` | Unchanged. |
| `main.js: startLiveTimer()` | Unchanged. |
| `main.js: updateGhostPreview()` | Unchanged — `=== null` check already blocks inactive cells. |
| All socket event listeners | `game:start`, `game:stateUpdate`, `game:win`, `game:error` handlers unchanged. |
| `index.html` | No new elements needed. |
| Lobby flow | Entirely unchanged. |
| 68 existing tests | Must continue to pass. New tests needed for inactive-cell validation and new interaction. |

---

## Build Order

Dependencies determine order. Each step is independently testable before the next begins.

**Step 1: Schema + Validation (server, zero regression risk)**
- Add `inactiveCells` to new puzzle JSON
- Update `validatePuzzleSchema()` to accept it as optional
- Write new tests: valid puzzle with `inactiveCells` passes; malformed format throws
- Existing puzzles continue to load and validate

**Step 2: `buildInitialGrid()` Sentinel (server)**
- Derive inactive set from `puzzle.inactiveCells`; populate those cells with `{ inactive: true }`
- Existing behavior for no `inactiveCells` is unchanged (all cells null)
- Write tests: sentinel appears at correct positions; active cells remain null

**Step 3: `checkWin()` Fix (server)**
- Add `&& !cell.inactive` guard in the null-comparison branch
- Write tests: grid with sentinel cells does not fail win check prematurely; full correct fill returns true
- Verify `placePiece()` needs no change (test that placing into inactive cell returns `'Cell occupied'` error)

**Step 4: Client Grid Rendering (client)**
- Add inactive branch in `renderGrid()` before existing null/anchor/placed logic
- Add `.grid-cell.inactive` CSS rule
- Manual test: inactive cells are visually absent, no mouse response

**Step 5: New Interaction — Click/Double-Click (client, highest complexity)**
- Declare shared `clickTimer` in `renderGrid()` scope
- Replace grid cell `click` handler with deferred-rotation version
- Add `dblclick` handler for placement
- Update bank click to remove rotation behavior
- Manual test: single click rotates, double-click places, return still works, outside-click deselects

**Step 6: Color Palette Expansion (client, trivial)**
- Extend `PIECE_COLORS` to 10 entries in `main.js`
- Manual test: all 10 pieces in bank have visually distinct colors

**Step 7: New Puzzle Data (data authoring)**
- Create `puzzles/puzzle_v11.json` with 10 pieces, `inactiveCells`, full `solution`
- Server loads and validates at startup
- Manual test: puzzle appears in dropdown, all 10 pieces render in bank

---

## Scalability Considerations

| Concern | v1.0 (4x4, 3 pieces) | v1.1 (5x9, 10 pieces) | Notes |
|---------|----------------------|------------------------|-------|
| Grid iteration in `placePiece()` | 16 cells scanned | 45 cells scanned | Same O(n) — negligible |
| Win check | 16 cell comparisons | 45 cell comparisons | Negligible |
| `getPublicState()` serialization | 16 cells | 45 cells | Negligible |
| Client DOM nodes | 16 grid cell elements | 45 elements (41 active + 4 inactive) | Negligible |
| Bank rendering | 2–3 pieces | 10 pieces | Already scrollable via existing CSS |
| Color palette | 6 colors (cycling) | 10 colors (distinct) | One-line fix |

No architectural concerns at this scale.

---

## Sources

- Full source read: `server/src/game.js` (419 LOC) — HIGH confidence
- Full source read: `server/src/socket.js` (237 LOC) — HIGH confidence
- Full source read: `client/main.js` (589 LOC) — HIGH confidence
- Full source read: `client/style.css` (362 LOC) — HIGH confidence
- Full source read: `puzzles/puzzle_01.json`, `puzzles/puzzle_02.json` — HIGH confidence
- Browser `click → click → dblclick` event sequence: well-established DOM spec (MEDIUM confidence — training data, consistent across all modern browsers)
- 200ms click disambiguation threshold: standard community pattern (MEDIUM confidence — widely used convention, not from W3C spec)
