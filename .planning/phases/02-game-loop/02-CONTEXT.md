# Phase 2: Game Loop - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Complete the interactive game loop: movable pieces can be dragged from the shared bank onto the grid, rotated before placement, validated server-side against the hidden solution, and returned to the bank. All players see the same grid state in real-time. Turn order is circular and clearly visible. When the grid matches the solution, all players see a win screen.

Timer and leaderboard are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Piece interaction model
- **Drag-and-drop** from bank to grid (not click-to-place)
- Invalid drop (occupied cells, out of bounds) → piece **snaps back to bank** silently (no error message)
- Return piece to bank → **click a .placed cell** on the grid (the active player returns their own placed piece)
- Non-active players: **fully locked** — draggable attribute disabled, click interactions disabled; pieces are visible but not interactive
- Server is authoritative: placement is confirmed by `game:stateUpdate`; if server rejects, piece is not on grid

### Bank layout & shape display
- Bank position: **side panel to the right of the grid** (flex row layout; extends `#game-screen` from max-width 700px)
- Piece rendering: **mini CSS grid preview** showing the piece's actual cell shape (relative coords from puzzle JSON, rendered as small grid)
- Coloring: **each piece gets a unique color** — consistent across bank and placed cells on grid; replaces the single `.placed` green
- When a piece is placed on the grid, it **disappears from the bank** immediately (only unplaced pieces shown)

### Drag ghost preview
- During drag, **ghost cells highlight the grid positions** where the piece would land (client-side only, before server validation)
- Ghost is **green** when all target cells are empty and in-bounds; **red** when any cell is occupied or out of bounds
- Ghost preview **reflects the current rotation** of the piece — what you see is exactly what lands

### Rotation
- Interaction flow: **click once to select** (piece lifts — CSS `transform: scale` + shadow), **click again to cycle rotation** 90° CW, **drag to place**
- Each subsequent click rotates +90° (cycles through 0° → 90° → 180° → 270° → 0°)
- Bank mini-preview does **not** update to show rotation — rotation is only reflected in the drag ghost on the grid
- Selected piece (awaiting drag): visually indicated by **CSS lift effect** (`transform: scale(1.08)` + stronger `box-shadow`)

### Turn indicator
- **Both**: a banner above the grid ("It's [Name]'s turn") + player badge highlight
- Players displayed as **name badges positioned around the grid container** (soft seating layout — badges on each side of the grid box, up to 4 players)
- Active player badge: **glowing border + highlighted background** (e.g., `#4a6cf7` blue, matching existing button/focus color)
- Inactive badges: grey/neutral

### Win condition
- When the server confirms the grid matches the solution, emit a `game:win` event (or encode in `game:stateUpdate`)
- All players see a **win screen** (Claude's discretion on implementation: overlay or screen transition)

### Claude's Discretion
- Win screen design and content (modal overlay vs screen transition)
- Exact color palette for per-piece unique colors (Claude assigns a set of distinct colors)
- Exact CSS values for selected-piece lift effect
- Error handling for unexpected socket disconnect during an active drag (snap back + notify)
- How to handle the case where there is only 1 player left in-game after disconnect (server emits `game:stateUpdate` advancing turn; client just renders it)

</decisions>

<specifics>
## Specific Ideas

- The "players seated around the board" layout should feel like a physical board game table — player name badges on each side of the grid container
- Rotation cycles on repeated click (not a button), with the rotation state visible only in the drag ghost
- The ghost preview green/red feedback is the primary validation signal for the active player

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderGrid(state)` in `main.js` — rebuilds the grid from `state.grid` 2D array; Phase 2 extends this with piece colors and drag event handlers
- `showScreen(screenId)` — `.screen/.screen.active` CSS toggle; `game:start` already transitions to `game-screen`
- `showLobbyNotification()` — inline transient notification pattern; reuse or adapt for in-game error messages
- `.grid-cell.placed { cursor: pointer }` in `style.css` — already set up for click interaction
- `advanceTurnIfActive(lobby, socketId)` in `game.js` — stub ready to be filled with full turn advancement logic
- `activeTurnIndex` on lobby state — set to `0` by `startGame()`, used in `getPublicState()` output

### Established Patterns
- `getPublicState()` is the **sole outbound serializer** — Phase 2 must add `activePlayerName` (or index) to its output without ever including `solution`
- CommonJS (`require`) throughout server code
- Inline errors / transient notifications only — no modal dialogs except for win state (TBD)
- Socket events follow `namespace:action` naming convention (`game:stateUpdate`, `game:start`, `room:error`)
- `'disconnecting'` event (not `'disconnect'`) used in socket.js for reliable room identification on disconnect

### Integration Points
- Phase 2 adds new socket events: `game:move` (client → server: place or return piece), `game:win` (server → client: game over)
- `game:stateUpdate` already wired in `main.js` at `socket.on('game:stateUpdate', (state) => { renderGrid(state); })` — Phase 2 extends `renderGrid` to also update bank, turn indicator, and player badges
- Puzzle JSON shape format: `cells` are relative `[dr, dc]` offsets from `[0,0]`; no `position` on movable shapes; rotation is a 90° CW transform on the cells array
- `solution` is a 2D array of shape IDs (or null): `[["A","B","B",null],...]` — server validates by comparing grid shapeIds to solution

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 2 scope.

</deferred>

---

*Phase: 02-game-loop*
*Context gathered: 2026-03-04*
