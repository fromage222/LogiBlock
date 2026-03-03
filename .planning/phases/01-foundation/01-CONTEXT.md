# Phase 1: Foundation - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Server infrastructure, Lobby lifecycle, and Puzzle loading. Players can create/join lobbies via room code, puzzles are securely loaded on the server, and disconnects are handled cleanly. This is the base for all gameplay — no game mechanics are in scope here.

</domain>

<decisions>
## Implementation Decisions

### Puzzle JSON schema
- Shapes are defined as coordinate lists: arrays of `[row, col]` offsets relative to an origin cell
- Solution stored as a 2D grid-cell mapping where each cell contains the shape ID that occupies it (empty = null)
- Anchor shapes are NOT a separate type — they are regular shapes that happen to be pre-placed in the grid and marked as immovable (`movable: false`)
- Top-level structure: flat shapes array
  ```json
  {
    "id": "puzzle_01",
    "name": "...",
    "gridSize": { "rows": N, "cols": M },
    "shapes": [
      { "id": "A", "cells": [[0,0],[1,0],[2,0]], "movable": false, "position": [2,3] },
      { "id": "B", "cells": [[0,0],[0,1],[1,0]], "movable": true }
    ],
    "solution": [["A","A",null],["B","B","A"]]
  }
  ```

### Player identification
- Players enter a name before joining or creating a lobby
- Name input is on the same screen as the join/create flow (one unified start screen)
- Name validation: non-empty, max 20 characters, no character type restrictions
- Duplicate names within the same lobby are blocked — server rejects join with an error message

### Puzzle selection
- Host picks a puzzle via a `<select>` dropdown before starting
- Dropdown shows puzzle name only (no grid size or other metadata)
- When host changes selection, all lobby members see the updated puzzle name in real time

### Lobby UI layout
- Lobby screen shows: room code (prominently), live player list, puzzle dropdown (host only), Start button (host only)
- Room code displayed prominently with a copy-to-clipboard button
- Player list shows each player's name + a host indicator (e.g. "(Host)" label) for the room creator
- Start button is enabled only when ≥2 players are connected

### Disconnect behavior
- Turn advances immediately on disconnect — no grace period
- Remaining players see a brief notification: "[Name] left the game", then player is removed from the list
- If host disconnects while in the lobby (game not started): lobby is destroyed, other players see "Host left — lobby closed" and return to start screen
- If only 1 player remains after others disconnect during a game: game continues, the solo player can keep playing until they win or leave

### Room code format
- 6-digit numeric (e.g. "483921") — easy to type, easy to read aloud
- Invalid or non-existent room codes show an inline error under the input field (no popup)

### Server validation at startup
- Invalid puzzle JSON files: log error and skip (server starts normally with remaining valid puzzles)
- If zero valid puzzles are loaded: server exits with a clear error message ("No valid puzzles found in /puzzles — add at least one")

### Claude's Discretion
- Exact visual styling (colors, fonts, spacing) — standard, clean CSS
- Grid coordinate system internals (0-indexed, row-major assumed)
- Socket event naming conventions
- How partial-name collision detection is implemented server-side
- Rotation matrix logic for shapes (used in Phase 2 but schema should accommodate it)

</decisions>

<specifics>
## Specific Ideas

- No specific references mentioned — open to standard clean web UI
- The Uni demo context means: functional and clear over polished

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — all source files are empty stubs. Building from scratch.

### Established Patterns
- Stack is locked: Node.js + Express + Socket.IO (server), Vanilla JS + HTML + CSS (client)
- No framework — all DOM manipulation is vanilla JS
- Puzzle definitions live in `/puzzles/*.json` — server loads them at startup

### Integration Points
- `server/src/server.js` — Express + Socket.IO setup, puzzle loading on startup
- `server/src/game.js` — Lobby state, room management, disconnect handling
- `server/src/socket.js` — Socket event handlers
- `client/index.html` + `client/main.js` — All client UI and socket communication
- `puzzles/` — JSON puzzle definitions (schema defined in this phase)

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-03-03*
