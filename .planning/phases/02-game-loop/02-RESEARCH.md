# Phase 2: Game Loop - Research

**Researched:** 2026-03-04
**Domain:** Vanilla JS Drag-and-Drop, Socket.IO real-time sync, server-side game state validation
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Piece interaction model
- **Drag-and-drop** from bank to grid (not click-to-place)
- Invalid drop (occupied cells, out of bounds) → piece **snaps back to bank** silently (no error message)
- Return piece to bank → **click a .placed cell** on the grid (the active player returns their own placed piece)
- Non-active players: **fully locked** — draggable attribute disabled, click interactions disabled; pieces are visible but not interactive
- Server is authoritative: placement is confirmed by `game:stateUpdate`; if server rejects, piece is not on grid

#### Bank layout & shape display
- Bank position: **side panel to the right of the grid** (flex row layout; extends `#game-screen` from max-width 700px)
- Piece rendering: **mini CSS grid preview** showing the piece's actual cell shape (relative coords from puzzle JSON, rendered as small grid)
- Coloring: **each piece gets a unique color** — consistent across bank and placed cells on grid; replaces the single `.placed` green
- When a piece is placed on the grid, it **disappears from the bank** immediately (only unplaced pieces shown)

#### Drag ghost preview
- During drag, **ghost cells highlight the grid positions** where the piece would land (client-side only, before server validation)
- Ghost is **green** when all target cells are empty and in-bounds; **red** when any cell is occupied or out of bounds
- Ghost preview **reflects the current rotation** of the piece — what you see is exactly what lands

#### Rotation
- Interaction flow: **click once to select** (piece lifts — CSS `transform: scale` + shadow), **click again to cycle rotation** 90° CW, **drag to place**
- Each subsequent click rotates +90° (cycles through 0° → 90° → 180° → 270° → 0°)
- Bank mini-preview does **not** update to show rotation — rotation is only reflected in the drag ghost on the grid
- Selected piece (awaiting drag): visually indicated by **CSS lift effect** (`transform: scale(1.08)` + stronger `box-shadow`)

#### Turn indicator
- **Both**: a banner above the grid ("It's [Name]'s turn") + player badge highlight
- Players displayed as **name badges positioned around the grid container** (soft seating layout — badges on each side of the grid box, up to 4 players)
- Active player badge: **glowing border + highlighted background** (e.g., `#4a6cf7` blue, matching existing button/focus color)
- Inactive badges: grey/neutral

#### Win condition
- When the server confirms the grid matches the solution, emit a `game:win` event (or encode in `game:stateUpdate`)
- All players see a **win screen** (Claude's discretion on implementation: overlay or screen transition)

### Claude's Discretion
- Win screen design and content (modal overlay vs screen transition)
- Exact color palette for per-piece unique colors (Claude assigns a set of distinct colors)
- Exact CSS values for selected-piece lift effect
- Error handling for unexpected socket disconnect during an active drag (snap back + notify)
- How to handle the case where there is only 1 player left in-game after disconnect (server emits `game:stateUpdate` advancing turn; client just renders it)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 2 scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PUZZ-03 | Formen können vom aktiven Spieler rotiert werden (0°, 90°, 180°, 270°) | 90° CW rotation matrix: `[dr, dc] → [dc, -dr]`; normalize offsets to start at [0,0] after transform |
| GAME-01 | Der aktive Spieler ist für alle Teilnehmer klar markiert sichtbar | `activeTurnIndex` already on lobby state; `getPublicState()` must expose `activePlayerName`; client renders banner + badge glow |
| GAME-02 | Die Zugreihenfolge ist zirkulär, server-kontrolliert, und für alle sichtbar | Server increments `activeTurnIndex` modulo player count after each accepted move; sent in every `game:stateUpdate` |
| GAME-03 | Aktiver Spieler kann eine Form aus der Bank ins Grid legen (Position + Rotation) | `game:move` event: `{ action: 'place', shapeId, rotation, originRow, originCol }`; server validates cells free then writes grid |
| GAME-04 | Aktiver Spieler kann eine falsch platzierte Form aus dem Grid zurück in die Bank legen | `game:move` event: `{ action: 'return', shapeId }`; server clears cells with that shapeId from grid, adds to bank |
| GAME-05 | Jeder Zug wird serverseitig gegen die hinterlegte Lösung validiert bevor er akzeptiert wird | Placement validation: all target cells empty + in-bounds. Win check (WIN-01) runs after each accepted place |
| GAME-06 | Die Lösung verlässt niemals den Server — `getPublicState()` ist der einzige Serialisierungspfad | Already enforced: `solution` field omitted from `getPublicState()`. Phase 2 must not change this |
| GAME-07 | Bei ungültigem Zug erhält nur der aktive Spieler eine Fehlermeldung mit Grund | `socket.emit('game:error', message)` — point-to-point to the requesting socket only, not `io.to(room)` |
| GAME-08 | Nach jedem akzeptierten Zug erhalten alle Spieler sofort den neuen Grid-State (Echtzeit-Sync) | `io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode))` — already the established pattern |
| WIN-01 | Gewinnbedingung wird erkannt wenn das Grid vollständig und korrekt gefüllt ist (Server-Prüfung) | Compare each `grid[r][c].shapeId` to `solution[r][c]`; null cells in solution must be null in grid |
| WIN-02 | Alle Spieler sehen einen Win-Screen wenn das Puzzle gelöst wurde | Server emits `game:win` (or flag in `game:stateUpdate`); client renders win overlay or transitions to win screen |
</phase_requirements>

---

## Summary

Phase 2 is a pure feature phase on an already-working foundation. The server (Node.js + Socket.IO 4.8.3 + Express 4.18.2, CommonJS) and client (Vanilla JS, no build tools, Socket.IO via CDN) are fully established. No new libraries are needed — everything is implemented with the existing stack.

The two main technical domains are: (1) **Vanilla JS HTML5 Drag and Drop API** for piece interaction (drag from bank, ghost preview, drop onto grid, snap-back on invalid drop), and (2) **server-side game state mutation and validation** (accept/reject moves, advance turns, detect win). The client's `renderGrid(state)` function already exists and will be extended to also render the bank panel, turn banner, and player badges. The `getPublicState()` serializer is the only outbound path and must be extended with `activePlayerName` and `bankShapes` without ever including `solution`.

The most subtle implementation challenge is the **ghost preview during drag**: the client must compute which grid cells would be occupied by the dragged piece (at its current rotation) based on where the cursor is hovering, and style those cells green or red — all before any server round-trip. The server remains authoritative; the ghost is purely cosmetic client-side feedback.

**Primary recommendation:** Implement the `game:move` socket handler server-side first, then wire the drag-and-drop interaction client-side. Keep the ghost preview purely client-side and do not send speculative moves to the server.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Socket.IO Server | 4.8.3 (already installed) | Real-time bidirectional events | Already in use; `game:stateUpdate` pattern established |
| Socket.IO Client | 4.x (CDN, auto-served) | Client event emit/on | Already in use via `/socket.io/socket.io.js` |
| Express | 4.18.2 (already installed) | Static file serving | Already in use |
| HTML5 Drag and Drop API | Native browser API | Bank → Grid piece dragging | No library needed; sufficient for desktop-only scope |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| CSS custom properties | Native | Per-piece unique colors | Assign `--piece-color` via inline style on each piece element |
| CSS Grid | Native | Mini piece preview in bank | Render piece shape as small grid cells |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTML5 DnD API | interact.js or SortableJS | Library gives smoother mobile UX but project is desktop-only; adds dependency with no build tooling |
| HTML5 DnD API | Pointer Events API | More control over drag ghost, but significantly more code for no extra benefit here |
| `game:win` separate event | Flag in `game:stateUpdate` | Separate event is cleaner; client handles it once without polling state.win flag on every update |

**Installation:** No new packages needed. All required libraries are already installed or native.

---

## Architecture Patterns

### Recommended Project Structure

No new files/directories needed beyond extending existing ones:

```
server/src/
├── game.js        # Add: placePiece(), returnPiece(), checkWin(), advanceTurn(); extend getPublicState()
├── socket.js      # Add: game:move handler; extend disconnecting handler
└── server.js      # No changes

client/
├── index.html     # Add: bank panel HTML, turn banner, player badges, win overlay
├── main.js        # Add: drag-and-drop logic, ghost preview, renderBank(), renderTurnUI(), renderWin()
└── style.css      # Add: bank styles, badge styles, ghost styles, win overlay styles
```

### Pattern 1: Server-Side Move Validation

**What:** The server is the only source of truth. The client emits `game:move`; the server validates, mutates grid state, checks win, advances turn, then broadcasts `game:stateUpdate` (or `game:win`) to all. Client NEVER updates its local grid speculatively.

**When to use:** Every place and return action.

```javascript
// server/src/socket.js — new handler (CommonJS, matching existing style)
socket.on('game:move', ({ action, shapeId, rotation, originRow, originCol } = {}) => {
  const roomCode = socket.data.roomCode;
  const lobby = getLobby(roomCode);
  if (!lobby || lobby.phase !== 'playing') return;

  // Guard: only active player may move
  const activePlayer = lobby.players[lobby.activeTurnIndex];
  if (!activePlayer || activePlayer.socketId !== socket.id) {
    return socket.emit('game:error', 'Not your turn');
  }

  if (action === 'place') {
    const result = placePiece(lobby, shapeId, rotation, originRow, originCol);
    if (!result.ok) return socket.emit('game:error', result.error);

    if (result.win) {
      io.to(roomCode).emit('game:win', getPublicState(roomCode));
    } else {
      advanceTurn(lobby);
      io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode));
    }
  } else if (action === 'return') {
    const result = returnPiece(lobby, shapeId);
    if (!result.ok) return socket.emit('game:error', result.error);
    // Return does NOT advance turn — same player continues
    io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode));
  }
});
```

### Pattern 2: 90° CW Rotation of Relative Cell Offsets

**What:** Shape cells are stored as relative `[dr, dc]` offsets from `[0,0]`. A 90° clockwise rotation transforms `[dr, dc]` to `[dc, -dr]`. After rotation, normalize by shifting so the minimum row and column are both 0.

**When to use:** Server-side validation (`placePiece`) must rotate cells before computing absolute positions. Client-side uses the same function for ghost preview.

```javascript
// Shared logic (can be duplicated server + client — no build tooling)
function rotateCells90CW(cells) {
  const rotated = cells.map(([dr, dc]) => [dc, -dr]);
  // Normalize: shift so min dr=0, min dc=0
  const minR = Math.min(...rotated.map(([r]) => r));
  const minC = Math.min(...rotated.map(([, c]) => c));
  return rotated.map(([r, c]) => [r - minR, c - minC]);
}

function rotateCells(cells, rotation) {
  // rotation: 0 | 90 | 180 | 270
  let result = cells;
  const times = (rotation / 90) % 4;
  for (let i = 0; i < times; i++) result = rotateCells90CW(result);
  return result;
}
```

Confidence: HIGH — standard rotation matrix math, verified manually against puzzle_01.json shapes.

### Pattern 3: HTML5 Drag and Drop for Bank → Grid

**What:** Bank pieces are `draggable="true"` divs. Grid cells listen for `dragover` and `drop`. During `dragenter`/`dragover`, compute ghost cells and style them. On `drop`, emit `game:move`. On `dragend` (fired even on cancelled drags), remove ghost styling.

**When to use:** Active player only — non-active players have `draggable="false"` and pointer-events disabled.

```javascript
// client/main.js — simplified pattern
let selectedShapeId = null;
let selectedRotation = 0;

// On bank piece click: select + cycle rotation
pieceEl.addEventListener('click', () => {
  if (selectedShapeId === pieceEl.dataset.shapeId) {
    selectedRotation = (selectedRotation + 90) % 360;
  } else {
    selectedShapeId = pieceEl.dataset.shapeId;
    selectedRotation = 0;
  }
  updateBankSelection();
});

// Drag start: store shapeId and current rotation in dataTransfer
pieceEl.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('shapeId', pieceEl.dataset.shapeId);
  e.dataTransfer.setData('rotation', selectedRotation);
  e.dataTransfer.effectAllowed = 'move';
});

// Grid cell dragover: compute target cells, show ghost
gridCell.addEventListener('dragover', (e) => {
  e.preventDefault(); // allow drop
  const originRow = parseInt(gridCell.dataset.row);
  const originCol = parseInt(gridCell.dataset.col);
  updateGhostPreview(originRow, originCol, selectedShapeId, selectedRotation);
});

// Grid cell drop: emit move, clear ghost
gridCell.addEventListener('drop', (e) => {
  e.preventDefault();
  clearGhostPreview();
  const originRow = parseInt(gridCell.dataset.row);
  const originCol = parseInt(gridCell.dataset.col);
  socket.emit('game:move', {
    action: 'place',
    shapeId: selectedShapeId,
    rotation: selectedRotation,
    originRow,
    originCol,
  });
  selectedShapeId = null;
  selectedRotation = 0;
});

// Dragend: always clear ghost (covers cancel/escape)
document.addEventListener('dragend', clearGhostPreview);
```

### Pattern 4: Ghost Preview (Client-Side Only)

**What:** During dragover, compute the absolute grid cells the piece would occupy at `[originRow, originCol]` with its current rotation. Mark those cells `.ghost-valid` (green) or `.ghost-invalid` (red) based on whether all cells are empty and in-bounds. Clear all ghost classes on `dragleave` from grid or `dragend`.

```javascript
function updateGhostPreview(originRow, originCol, shapeId, rotation) {
  clearGhostPreview();
  const shape = bankShapes.find(s => s.id === shapeId);
  if (!shape) return;
  const cells = rotateCells(shape.cells, rotation);
  const { rows, cols } = currentGridSize;
  const valid = cells.every(([dr, dc]) => {
    const r = originRow + dr;
    const c = originCol + dc;
    return r >= 0 && r < rows && c >= 0 && c < cols && currentGrid[r][c] === null;
  });
  cells.forEach(([dr, dc]) => {
    const r = originRow + dr;
    const c = originCol + dc;
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const cellEl = document.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
    if (cellEl) cellEl.classList.add(valid ? 'ghost-valid' : 'ghost-invalid');
  });
}
```

### Pattern 5: Per-Piece Unique Color Assignment

**What:** On `game:start` and `game:stateUpdate`, extract the set of movable shape IDs from bank + grid. Assign each a color from a fixed palette. Store the map in client state (`pieceColors`). Apply as background color when rendering bank pieces and placed grid cells.

**Suggested palette (6 distinct colors, sufficient for all current puzzles):**

```javascript
const PIECE_COLORS = [
  '#5c85d6', // blue
  '#e07b39', // orange
  '#6ab187', // green
  '#c05c7e', // rose
  '#9b6bb5', // purple
  '#c8b84a', // gold
];

function assignPieceColors(shapeIds) {
  const map = {};
  shapeIds.forEach((id, i) => {
    map[id] = PIECE_COLORS[i % PIECE_COLORS.length];
  });
  return map;
}
```

### Pattern 6: `getPublicState()` Extension

**What:** Phase 2 must add `activePlayerName` and `bankShapes` to `getPublicState()` output. `bankShapes` = movable shapes whose IDs are not present anywhere in the current grid. This allows client to render the bank without knowing the full puzzle definition.

```javascript
// server/src/game.js — extend getPublicState()
function getPublicState(roomCode) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return null;
  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);

  // Compute which movable shapes are currently on the grid
  const placedShapeIds = new Set();
  if (lobby.grid) {
    for (const row of lobby.grid) {
      for (const cell of row) {
        if (cell && cell.movable !== false) placedShapeIds.add(cell.shapeId);
      }
    }
  }

  // Bank = movable shapes not currently placed
  const bankShapes = puzzle
    ? puzzle.shapes
        .filter(s => s.movable && !placedShapeIds.has(s.id))
        .map(s => ({ id: s.id, cells: s.cells })) // cells needed for mini-preview
    : [];

  const activePlayer = lobby.players[lobby.activeTurnIndex ?? 0];

  return {
    roomCode: lobby.roomCode,
    phase: lobby.phase,
    players: lobby.players.map(p => ({ name: p.name, isHost: p.isHost, socketId: p.socketId })),
    selectedPuzzleName: puzzle ? puzzle.name : null,
    selectedPuzzleId: lobby.selectedPuzzleId,
    grid: lobby.grid,
    gridSize: puzzle ? puzzle.gridSize : null,
    activePlayerName: activePlayer ? activePlayer.name : null,
    activeTurnIndex: lobby.activeTurnIndex ?? 0,
    bankShapes,
    // solution: intentionally omitted — NEVER include (GAME-06)
  };
}
```

### Pattern 7: Win Detection

**What:** After each accepted `place` action, compare every cell of `lobby.grid` to `puzzle.solution`. All non-null solution cells must match the placed shapeId; null solution cells must remain null in the grid.

```javascript
// server/src/game.js
function checkWin(lobby, puzzle) {
  const { rows, cols } = puzzle.gridSize;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const expected = puzzle.solution[r][c]; // string shapeId or null
      const actual = lobby.grid[r][c];        // { shapeId, movable } or null
      if (expected === null) {
        if (actual !== null) return false; // grid has something where solution is empty
      } else {
        if (!actual || actual.shapeId !== expected) return false;
      }
    }
  }
  return true;
}
```

### Anti-Patterns to Avoid

- **Optimistic client-side grid updates:** Never update `currentGrid` before receiving `game:stateUpdate` from server. Ghost preview only affects CSS classes, never the data model.
- **Sending solution to client:** `getPublicState()` must never include `solution`, `puzzle.solution`, or any derived field that reveals the answer. This is a hard invariant (GAME-06).
- **Using `io.to(room).emit('game:error', ...)` for move rejections:** Error messages for invalid moves go only to the requesting socket (`socket.emit`), not the room.
- **Advancing turn on `return` action:** A return puts a piece back in the bank. The same player still has their turn. Only a successful `place` advances the turn.
- **Forgetting `dragend` cleanup:** If the user presses Escape during drag, `drop` is not fired but `dragend` is. Always clear ghost state in `dragend`.
- **Using `draggable="true"` on non-active players' bank pieces:** Non-active players must have `draggable="false"` (and pointer-events disabled via CSS). Setting the attribute after render is fine since `renderBank()` is called on every `game:stateUpdate`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag image / drag ghost | Custom drag image element via `setDragImage` | CSS `.ghost-valid` / `.ghost-invalid` on grid cells | Grid cell highlighting is simpler and more readable than a floating clone; setDragImage only controls the browser's drag cursor image, not grid highlighting |
| Real-time broadcast | Custom WebSocket pub/sub | Socket.IO rooms (`io.to(roomCode).emit(...)`) | Already established; handles reconnect, rooms, namespaces |
| Rotation math | Look-up table of pre-rotated shapes | `rotateCells()` function above | The function is 6 lines and handles all 4 rotations correctly for any shape |
| Color assignment | Per-player colors (v2 idea) | Per-piece colors (locked decision) | The locked decision is per-piece (shape), not per-player. Do not confuse with the v2 UI-01 requirement |

---

## Common Pitfalls

### Pitfall 1: `dragover` Must Call `e.preventDefault()`
**What goes wrong:** Drop events never fire; pieces cannot be dropped on grid cells.
**Why it happens:** Browser default for `dragover` is to disallow drops. Calling `e.preventDefault()` signals the drop zone is valid.
**How to avoid:** Always add `e.preventDefault()` inside every `dragover` handler on grid cells.
**Warning signs:** `drop` event listener never triggers despite correct setup.

### Pitfall 2: Ghost Cells Not Cleared on Drag Cancel
**What goes wrong:** Red/green ghost highlights remain on the grid after drag is cancelled (Escape key or drag outside window).
**Why it happens:** `drop` is not fired when drag is cancelled; `dragleave` may not fire for every entered cell.
**How to avoid:** Listen for `dragend` on `document` (not just the piece element) and call `clearGhostPreview()` there.

### Pitfall 3: `activeTurnIndex` Out-of-Bounds After Disconnect
**What goes wrong:** `lobby.players[lobby.activeTurnIndex]` is undefined after a player disconnects and reduces the array length.
**Why it happens:** `advanceTurnIfActive` stub in Phase 1 only adjusts the index if the disconnecting player is active, but doesn't handle the case where the index now points past the end of the reduced array.
**How to avoid:** In the full `advanceTurn` implementation, always do `lobby.activeTurnIndex = newIndex % lobby.players.length` after removing a player. Defensive check: if `lobby.players.length === 0`, set to 0.

### Pitfall 4: Rotation Not Normalized After Each 90° Step
**What goes wrong:** After rotation, cells like `[0,-1]` appear, causing off-by-one placement errors on the grid (server rejects valid-looking placements).
**Why it happens:** Each 90° CW rotation of `[dr, dc]` → `[dc, -dr]` produces negative offsets. Without normalization, `originRow + dr` can land in wrong cells.
**How to avoid:** After each rotation step, shift all cells so `minRow = 0` and `minCol = 0`. The `rotateCells90CW` function in the Code Examples section above handles this correctly.

### Pitfall 5: Bank Pieces Showing Rotation State
**What goes wrong:** Bank mini-preview updates to show the rotated shape instead of always showing the canonical (0°) shape.
**Why it happens:** Rendering bank pieces using `selectedRotation` instead of always using `shape.cells` (the 0° canonical form).
**How to avoid:** Bank renders always use `shape.cells` directly. Only the drag ghost uses `rotateCells(shape.cells, selectedRotation)`.

### Pitfall 6: `getPublicState()` Leaking Puzzle Shape Data
**What goes wrong:** Sending `shape.cells` in `bankShapes` is intentional (needed for mini-preview), but accidentally including `shape.position` or the full puzzle object would expose anchor positions that hint at the solution.
**Why it happens:** Lazy spread of the shape object instead of explicit field selection.
**How to avoid:** Always explicitly map: `s => ({ id: s.id, cells: s.cells })`. Never spread the shape object.

### Pitfall 7: Win Check After `return` Action
**What goes wrong:** Win condition falsely triggers when a piece is returned (grid has gaps that match nulls in solution).
**Why it happens:** Running `checkWin()` after every grid mutation including returns.
**How to avoid:** Only call `checkWin()` after a successful `place` action, never after `return`.

---

## Code Examples

Verified patterns from codebase analysis and standard browser API behavior:

### Rotation Function (Server + Client)
```javascript
// Source: Standard rotation matrix math; verified against puzzle_01.json shapes manually
function rotateCells90CW(cells) {
  const rotated = cells.map(([dr, dc]) => [dc, -dr]);
  const minR = Math.min(...rotated.map(([r]) => r));
  const minC = Math.min(...rotated.map(([, c]) => c));
  return rotated.map(([r, c]) => [r - minR, c - minC]);
}

function rotateCells(cells, rotation) {
  let result = cells.slice(); // copy
  const times = ((rotation / 90) % 4 + 4) % 4;
  for (let i = 0; i < times; i++) result = rotateCells90CW(result);
  return result;
}
```

Verification against puzzle_01.json shape B (`[[0,0],[0,1],[1,1]]`) at 90°:
- Input: `[0,0],[0,1],[1,1]`
- After 90° CW: `[0,0],[1,0],[1,-1]` → normalize: `[0,1],[1,1],[1,0]`
- Visually: original is top-left L; rotated is bottom-left L — correct.

### `placePiece` Server Function
```javascript
// server/src/game.js
function placePiece(lobby, shapeId, rotation, originRow, originCol) {
  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);
  if (!puzzle) return { ok: false, error: 'Puzzle not found' };

  // Shape must be movable and currently in bank (not on grid)
  const shape = puzzle.shapes.find(s => s.id === shapeId && s.movable);
  if (!shape) return { ok: false, error: 'Invalid shape' };

  // Check shape is not already placed
  const alreadyPlaced = lobby.grid.some(row =>
    row.some(cell => cell && cell.shapeId === shapeId && cell.movable !== false)
  );
  if (alreadyPlaced) return { ok: false, error: 'Shape already placed' };

  const rotatedCells = rotateCells(shape.cells, rotation);
  const { rows, cols } = puzzle.gridSize;

  // Validate all target cells in bounds and empty
  for (const [dr, dc] of rotatedCells) {
    const r = originRow + dr;
    const c = originCol + dc;
    if (r < 0 || r >= rows || c < 0 || c >= cols)
      return { ok: false, error: 'Piece out of bounds' };
    if (lobby.grid[r][c] !== null)
      return { ok: false, error: 'Cell occupied' };
  }

  // Write to grid
  for (const [dr, dc] of rotatedCells) {
    lobby.grid[originRow + dr][originCol + dc] = { shapeId, movable: true };
  }

  const win = checkWin(lobby, puzzle);
  return { ok: true, win };
}
```

### `returnPiece` Server Function
```javascript
// server/src/game.js
function returnPiece(lobby, shapeId) {
  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);
  if (!puzzle) return { ok: false, error: 'Puzzle not found' };

  const shape = puzzle.shapes.find(s => s.id === shapeId && s.movable);
  if (!shape) return { ok: false, error: 'Invalid shape' };

  // Check shape is actually on the grid
  const isPlaced = lobby.grid.some(row =>
    row.some(cell => cell && cell.shapeId === shapeId && cell.movable !== false)
  );
  if (!isPlaced) return { ok: false, error: 'Shape not on grid' };

  // Remove from grid
  for (let r = 0; r < lobby.grid.length; r++) {
    for (let c = 0; c < lobby.grid[r].length; c++) {
      const cell = lobby.grid[r][c];
      if (cell && cell.shapeId === shapeId && cell.movable !== false) {
        lobby.grid[r][c] = null;
      }
    }
  }
  return { ok: true };
}
```

### `advanceTurn` Server Function
```javascript
// server/src/game.js
function advanceTurn(lobby) {
  if (lobby.players.length === 0) return;
  lobby.activeTurnIndex = (lobby.activeTurnIndex + 1) % lobby.players.length;
}
```

### Updated `advanceTurnIfActive` (Disconnect Handling)
```javascript
// server/src/game.js — replaces the Phase 1 stub
function advanceTurnIfActive(lobby, socketId) {
  if (!lobby || lobby.phase !== 'playing') return;
  const activePlayer = lobby.players[lobby.activeTurnIndex];
  if (activePlayer && activePlayer.socketId === socketId) {
    // Will be called before removePlayer, so length is still current
    // After removePlayer, length decreases by 1 — compute index carefully
    const newLength = lobby.players.length - 1;
    if (newLength === 0) {
      lobby.activeTurnIndex = 0;
    } else {
      lobby.activeTurnIndex = lobby.activeTurnIndex % newLength;
    }
  } else {
    // Non-active player disconnects; if their index was before activeTurnIndex,
    // adjust to keep pointing at the same player
    const disconnectingIndex = lobby.players.findIndex(p => p.socketId === socketId);
    if (disconnectingIndex !== -1 && disconnectingIndex < lobby.activeTurnIndex) {
      lobby.activeTurnIndex = Math.max(0, lobby.activeTurnIndex - 1);
    }
  }
}
```

### Client: Rendering the Bank Panel
```javascript
// client/main.js — called from within updated renderGrid(state) or separately
function renderBank(state) {
  const bank = document.getElementById('piece-bank');
  bank.innerHTML = '';

  const amIActive = state.activePlayerName === myPlayerName;

  (state.bankShapes || []).forEach(shape => {
    const pieceEl = document.createElement('div');
    pieceEl.classList.add('bank-piece');
    pieceEl.dataset.shapeId = shape.id;
    pieceEl.draggable = amIActive; // non-active: false
    if (!amIActive) pieceEl.style.pointerEvents = 'none';

    // Color
    const color = pieceColors[shape.id] || '#ccc';
    pieceEl.style.setProperty('--piece-color', color);

    // Mini CSS grid preview
    const miniGrid = buildMiniGrid(shape.cells, color);
    pieceEl.appendChild(miniGrid);

    // Label
    const label = document.createElement('span');
    label.textContent = shape.id;
    pieceEl.appendChild(label);

    bank.appendChild(pieceEl);
  });
}

function buildMiniGrid(cells, color) {
  const maxR = Math.max(...cells.map(([r]) => r));
  const maxC = Math.max(...cells.map(([, c]) => c));
  const container = document.createElement('div');
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${maxC + 1}, 12px)`;
  container.style.gridTemplateRows = `repeat(${maxR + 1}, 12px)`;
  container.style.gap = '1px';
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const cell = document.createElement('div');
      cell.style.width = '12px';
      cell.style.height = '12px';
      cell.style.borderRadius = '2px';
      const filled = cells.some(([dr, dc]) => dr === r && dc === c);
      cell.style.background = filled ? color : 'transparent';
      container.appendChild(cell);
    }
  }
  return container;
}
```

### Client: Turn Banner and Player Badges
```javascript
// client/main.js
function renderTurnUI(state) {
  // Turn banner
  const banner = document.getElementById('turn-banner');
  if (state.activePlayerName) {
    banner.textContent = state.activePlayerName === myPlayerName
      ? "It's your turn!"
      : `It's ${state.activePlayerName}'s turn`;
  }

  // Player badges — regenerate each time (simple, correct)
  const badgesContainer = document.getElementById('player-badges');
  badgesContainer.innerHTML = '';
  (state.players || []).forEach(player => {
    const badge = document.createElement('div');
    badge.classList.add('player-badge');
    badge.textContent = player.name;
    if (player.name === state.activePlayerName) {
      badge.classList.add('active');
    }
    badgesContainer.appendChild(badge);
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `.placed` green color for all movable pieces | Per-piece unique color map | Phase 2 | CSS `background` on each cell/bank piece uses `pieceColors[shapeId]` |
| `activeTurnIndex` stored but not sent to client | `activePlayerName` + `activeTurnIndex` in `getPublicState()` | Phase 2 | Client can render turn UI without knowing player array index |
| `game:stateUpdate` only called on disconnect | `game:stateUpdate` called after every accepted move | Phase 2 | Full real-time sync |
| `advanceTurnIfActive` is a stub | Full disconnect-aware turn advancement | Phase 2 | Handles both active and non-active player disconnects correctly |

**Deprecated/outdated:**
- `.placed { background: #81c784 }` in style.css: Will be superseded by per-piece dynamic `background` colors. The CSS class `.placed` remains but background is overridden by inline style.
- `<p class="hint">Anchor pieces are fixed...</p>` in index.html game screen: Remove/replace with actual turn banner and bank panel HTML.

---

## Open Questions

1. **How should `game:win` interact with `game:stateUpdate`?**
   - What we know: Server can either emit a separate `game:win` event or include a `win: true` flag in the final `game:stateUpdate`.
   - What's unclear: Whether to use a separate event (cleaner client-side handling) or embed in stateUpdate (fewer event types).
   - Recommendation: Use a **separate `game:win` event** emitting the final `getPublicState()`. This lets the client handle win distinctly from normal updates without checking a flag on every `game:stateUpdate`. The CONTEXT.md mentions this as "encode in `game:stateUpdate`" as an option but leaves it as Claude's discretion.

2. **Should the `return` action advance the turn?**
   - What we know: CONTEXT.md specifies return = "active player returns their own placed piece". Turn indicator shows them still active.
   - What's unclear: Whether returning a piece should count as a "move" for turn-advancing purposes or allow the player to then place again.
   - Recommendation: **Return does NOT advance turn.** The player returns the piece to their bank and can immediately place another piece or the same piece in a new position. This matches the success criterion "Der aktive Spieler kann eine falsch platzierte Form aus dem Grid zurück in die Bank legen" — it's an undo action, not a turn action.

3. **Win overlay vs. screen transition?**
   - What we know: Left as Claude's discretion. `showScreen()` exists.
   - What's unclear: Whether to reuse `showScreen('win-screen')` (need new screen div) or add overlay on top of game screen.
   - Recommendation: **CSS overlay on top of `#game-screen`** (`position: fixed`, full viewport, high z-index). This avoids adding a new screen div, keeps the game grid visible underneath, and is simpler to implement. On win, add `.win-overlay` div to body, show it.

---

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `/server/src/game.js`, `/server/src/socket.js`, `/client/main.js`, `/client/style.css`, `/client/index.html`, `/puzzles/puzzle_01.json`, `/puzzles/puzzle_02.json` — full read; all patterns extracted directly from existing code
- Standard rotation matrix math: `[dr, dc] → [dc, -dr]` for 90° CW — verified manually against puzzle shapes
- HTML5 Drag and Drop API: Browser native, desktop-only scope confirmed by REQUIREMENTS.md Out of Scope ("Mobile / Touch-Optimierung")

### Secondary (MEDIUM confidence)
- Socket.IO 4.8.3 `socket.emit` vs `io.to().emit` distinction for targeted vs broadcast messages — consistent with existing socket.js patterns in codebase

### Tertiary (LOW confidence)
- None — all findings are grounded in direct codebase evidence or standard browser APIs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; everything is existing project dependencies or native browser APIs
- Architecture: HIGH — patterns derived directly from existing codebase conventions (CommonJS, event naming, serialization boundary)
- Pitfalls: HIGH for DnD and rotation math (well-known); MEDIUM for `advanceTurnIfActive` edge case (derived from code analysis of stub)

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable stack — Socket.IO, vanilla JS; no fast-moving dependencies)
