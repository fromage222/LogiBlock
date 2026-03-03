# Phase 1: Foundation - Research

**Researched:** 2026-03-03
**Domain:** Socket.IO Lobby Management, Node.js Puzzle Loading, Vanilla JS Client
**Confidence:** HIGH (core stack locked and verified against official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Puzzle JSON schema**
- Shapes are defined as coordinate lists: arrays of `[row, col]` offsets relative to an origin cell
- Solution stored as a 2D grid-cell mapping where each cell contains the shape ID that occupies it (empty = null)
- Anchor shapes are NOT a separate type — they are regular shapes marked `movable: false` with a pre-set `position`
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

**Player identification**
- Players enter a name before joining or creating a lobby
- Name input is on the same screen as the join/create flow (one unified start screen)
- Name validation: non-empty, max 20 characters, no character type restrictions
- Duplicate names within the same lobby are blocked — server rejects join with an error message

**Puzzle selection**
- Host picks a puzzle via a `<select>` dropdown before starting
- Dropdown shows puzzle name only (no grid size or other metadata)
- When host changes selection, all lobby members see the updated puzzle name in real time

**Lobby UI layout**
- Lobby screen shows: room code (prominently), live player list, puzzle dropdown (host only), Start button (host only)
- Room code displayed prominently with a copy-to-clipboard button
- Player list shows each player's name + a host indicator (e.g. "(Host)" label) for the room creator
- Start button is enabled only when ≥2 players are connected

**Disconnect behavior**
- Turn advances immediately on disconnect — no grace period
- Remaining players see a brief notification: "[Name] left the game", then player is removed from the list
- If host disconnects while in the lobby (game not started): lobby is destroyed, other players see "Host left — lobby closed" and return to start screen
- If only 1 player remains after others disconnect during a game: game continues, the solo player can keep playing until they win or leave

**Room code format**
- 6-digit numeric (e.g. "483921") — easy to type, easy to read aloud
- Invalid or non-existent room codes show an inline error under the input field (no popup)

**Server validation at startup**
- Invalid puzzle JSON files: log error and skip (server starts normally with remaining valid puzzles)
- If zero valid puzzles are loaded: server exits with a clear error message ("No valid puzzles found in /puzzles — add at least one")

### Claude's Discretion
- Exact visual styling (colors, fonts, spacing) — standard, clean CSS
- Grid coordinate system internals (0-indexed, row-major assumed)
- Socket event naming conventions
- How partial-name collision detection is implemented server-side
- Rotation matrix logic for shapes (used in Phase 2 but schema should accommodate it)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOBB-01 | Spieler kann einen neuen Raum erstellen und erhält einen einzigartigen Room-Code | Room code generation pattern (6-digit, collision loop), `socket.join(roomCode)` on server |
| LOBB-02 | Spieler kann einem bestehenden Raum per Room-Code beitreten | `socket.join()` after validating room exists and is in lobby state; inline error if invalid |
| LOBB-03 | Alle Spieler sehen live welche Mitspieler in der Lobby verbunden sind | `io.to(roomCode).emit('lobby:update', playersArray)` after every join/leave event |
| LOBB-04 | Host kann das Spiel starten (erst wenn ≥2 Spieler verbunden sind) | Server validates player count before accepting `startGame` event; broadcasts `game:start` |
| LOBB-05 | Host kann vor Spielstart aus den verfügbaren Puzzles auswählen | Host emits `lobby:selectPuzzle`; server broadcasts selection name to room in real time |
| PUZZ-01 | Server lädt alle Puzzle-JSON-Dateien beim Start und validiert ihr Schema | `fs.readdirSync` + `JSON.parse` + manual field validation at startup; Map keyed by puzzle ID |
| PUZZ-02 | Anker-Formen sind beim Spielstart an ihrer fixen Position vorplatziert und unveränderlich | `getPublicState()` pre-populates grid cells for `movable: false` shapes; client marks them non-interactive |
| GAME-09 | Wenn der aktive Spieler disconnected wird sein Zug automatisch übersprungen und der nächste Spieler ist dran | `socket.on('disconnecting')` reads `socket.rooms`, triggers turn-advance logic, broadcasts `game:stateUpdate` |
| GAME-10 | Leere Lobbys (alle Spieler disconnected) werden automatisch zerstört | On last player disconnect, server deletes lobby from in-memory Map; no scheduled cleanup needed |
</phase_requirements>

---

## Summary

Phase 1 is a pure server-authoritative multiplayer lobby implemented with Node.js + Express + Socket.IO on the back end and Vanilla JS + HTML + CSS on the front end — all choices locked by the project. The domain splits into three sub-problems: (1) lobby lifecycle (create/join/update/destroy), (2) puzzle loading and schema validation at startup, and (3) disconnect handling that keeps the game alive without freezing.

Socket.IO 4.8.3 (latest, December 2025) covers all three sub-problems with built-in primitives: rooms for lobby grouping, `socket.data` for per-socket player metadata, `socket.on('disconnecting')` for turn advancement before rooms are cleared, and `io.to(room).emit()` for real-time updates. No third-party lobby abstraction or external queue is needed.

The only non-trivial design decision is the `getPublicState()` serialization pattern: the solution array must be stripped from every server→client payload from day one. This is a project invariant (GAME-06 locks it for Phase 2, but the data shape is defined here) and must be baked in during puzzle loading — the server stores puzzles including the `solution` field, `getPublicState()` returns everything except it.

**Primary recommendation:** Build the lobby as an in-memory `Map<roomCode, LobbyState>` on the server. Use Socket.IO rooms (room name = room code) for broadcasting. Use `socket.data` to attach player metadata. Handle all disconnect edge cases in the `disconnecting` event, not the `disconnect` event.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socket.io | 4.8.3 | Real-time bidirectional events, room management | Official latest; rooms, fetchSockets(), socket.data all built-in |
| express | ^4.x | HTTP server, static file serving | Locked by project; wraps Node http.Server for Socket.IO attachment |
| dotenv | ^16.x | Load `.env` into `process.env` | Already in `.env.example`; standard Node config pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fs (Node built-in) | — | Read puzzle JSON files at startup | No npm install needed; `fs.readdirSync` + `JSON.parse` |
| path (Node built-in) | — | Resolve `puzzles/` directory path portably | `path.join(__dirname, '../../puzzles')` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| manual JSON validation | Ajv (JSON Schema) | Ajv is more robust but adds a dependency; for a small fixed schema, manual field checks are fine and keep the project lean |
| Math.random() room codes | uuid | uuid is collision-proof but longer; 6-digit numeric codes with a collision-detection loop are sufficient for a Uni demo |
| io.to(room).fetchSockets() | io.of('/').adapter.rooms | Both work on single-server setups; `fetchSockets()` is the modern v4+ API and returns full socket objects including `socket.data` |

**Installation:**
```bash
cd server
npm install socket.io express dotenv
```

The Socket.IO client is served automatically by the server at `/socket.io/socket.io.js` — no CDN required for development. For the HTML:
```html
<script src="/socket.io/socket.io.js"></script>
```

---

## Architecture Patterns

### Recommended Project Structure
```
server/src/
├── server.js       # Express + http.Server + Socket.IO init, puzzle loading at startup
├── socket.js       # All socket event handlers (createRoom, joinRoom, startGame, selectPuzzle, disconnect)
├── game.js         # LobbyManager class — in-memory Map of lobby states; getPublicState()
puzzles/
├── puzzle_01.json  # Must exist with valid schema before Phase 2 testing
client/
├── index.html      # Single-page app — start screen + lobby screen + game screen (hidden by class)
├── main.js         # Socket.IO client, screen switching, DOM updates
└── style.css       # Layout, lobby, grid styles
```

### Pattern 1: Socket.IO + Express Setup (Correct Order)
**What:** Socket.IO must attach to a Node.js `http.Server`, not directly to the Express `app`. `app.listen()` creates an internal server Socket.IO cannot access.
**When to use:** Always — this is the mandatory initialization order.
**Example:**
```javascript
// Source: https://socket.io/docs/v4/server-initialization/
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

io.on('connection', (socket) => { /* ... */ });

httpServer.listen(process.env.PORT || 3000);
```

### Pattern 2: In-Memory Lobby Map
**What:** A single `Map<roomCode, LobbyState>` holds all active lobbies. Each entry contains player list, selected puzzle ID, game phase, and host socket ID.
**When to use:** Single-server, no persistence needed (project requirement).
**Example:**
```javascript
// game.js — LobbyState structure
const lobbies = new Map(); // roomCode -> LobbyState

function createLobby(roomCode, hostSocketId, hostName, puzzleId) {
  lobbies.set(roomCode, {
    roomCode,
    hostId: hostSocketId,
    selectedPuzzleId: puzzleId,
    phase: 'lobby',        // 'lobby' | 'playing'
    players: [
      { socketId: hostSocketId, name: hostName, isHost: true }
    ]
  });
}

function getPublicState(roomCode) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return null;
  // NEVER include puzzle.solution in the returned object
  return {
    roomCode: lobby.roomCode,
    phase: lobby.phase,
    players: lobby.players,
    selectedPuzzleName: getPuzzleById(lobby.selectedPuzzleId)?.name ?? null,
    // grid state added in Phase 2
  };
}
```

### Pattern 3: 6-Digit Room Code with Collision Loop
**What:** Generate a random 6-digit numeric string; retry if already in use.
**When to use:** On every `createRoom` event.
**Example:**
```javascript
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (lobbies.has(code));
  return code;
}
```

### Pattern 4: Socket.IO Room = Lobby Code
**What:** Use the room code as the Socket.IO room name. Joining the Socket.IO room and joining the lobby are the same operation.
**When to use:** Always — keeps broadcast logic trivial.
**Example:**
```javascript
// socket.js
socket.on('createRoom', ({ playerName }) => {
  const roomCode = generateRoomCode();
  createLobby(roomCode, socket.id, playerName, firstPuzzleId);
  socket.data.roomCode = roomCode;
  socket.data.playerName = playerName;
  socket.join(roomCode);                          // Socket.IO room
  socket.emit('room:created', { roomCode });
  io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
});

socket.on('joinRoom', ({ roomCode, playerName }) => {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return socket.emit('room:error', 'Room not found');
  if (lobby.phase !== 'lobby') return socket.emit('room:error', 'Game already started');
  if (lobby.players.some(p => p.name === playerName))
    return socket.emit('room:error', 'Name already taken in this room');

  lobby.players.push({ socketId: socket.id, name: playerName, isHost: false });
  socket.data.roomCode = roomCode;
  socket.data.playerName = playerName;
  socket.join(roomCode);
  io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
});
```

### Pattern 5: Disconnect Handling with `disconnecting` Event
**What:** `disconnecting` fires before the socket leaves its rooms — `socket.rooms` still contains the room code. This is the correct hook for lobby/game cleanup.
**When to use:** All player removal logic goes here, not in `disconnect`.
**Example:**
```javascript
// Source: https://socket.io/docs/v4/server-socket-instance/
socket.on('disconnecting', () => {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;

  const lobby = lobbies.get(roomCode);
  if (!lobby) return;

  const wasHost = lobby.hostId === socket.id;
  lobby.players = lobby.players.filter(p => p.socketId !== socket.id);

  if (lobby.players.length === 0) {
    // GAME-10: destroy empty lobby
    lobbies.delete(roomCode);
    return;
  }

  if (wasHost && lobby.phase === 'lobby') {
    // Host left before game started: destroy lobby, notify all
    lobbies.delete(roomCode);
    socket.to(roomCode).emit('lobby:hostLeft');
    return;
  }

  // Notify remaining players
  socket.to(roomCode).emit('lobby:playerLeft', { playerName: socket.data.playerName });

  if (lobby.phase === 'playing') {
    // GAME-09: advance turn if disconnected player was active
    // (turn index management implemented in Phase 2; stub hook here)
    advanceTurnIfActive(lobby, socket.id);
    io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode));
  } else {
    io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
  }
});
```

### Pattern 6: Puzzle Loading at Startup
**What:** Read all `.json` files from `/puzzles`, parse and validate each one. Invalid files are skipped with a log. Zero valid puzzles = fatal exit.
**When to use:** Synchronous at startup before `httpServer.listen()`.
**Example:**
```javascript
// server.js — puzzle loading
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUZZLES_DIR = path.join(__dirname, '../../puzzles');

function loadPuzzles() {
  const puzzleMap = new Map(); // puzzleId -> puzzle object (includes solution)
  const files = fs.readdirSync(PUZZLES_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(PUZZLES_DIR, file), 'utf-8');
      const puzzle = JSON.parse(raw);
      validatePuzzleSchema(puzzle); // throws if invalid
      puzzleMap.set(puzzle.id, puzzle);
    } catch (err) {
      console.error(`[PuzzleLoader] Skipping ${file}: ${err.message}`);
    }
  }

  if (puzzleMap.size === 0) {
    console.error('No valid puzzles found in /puzzles — add at least one');
    process.exit(1);
  }

  console.log(`[PuzzleLoader] Loaded ${puzzleMap.size} puzzle(s)`);
  return puzzleMap;
}

function validatePuzzleSchema(puzzle) {
  if (!puzzle.id || typeof puzzle.id !== 'string') throw new Error('Missing or invalid "id"');
  if (!puzzle.name || typeof puzzle.name !== 'string') throw new Error('Missing or invalid "name"');
  if (!puzzle.gridSize || typeof puzzle.gridSize.rows !== 'number' || typeof puzzle.gridSize.cols !== 'number')
    throw new Error('Missing or invalid "gridSize"');
  if (!Array.isArray(puzzle.shapes) || puzzle.shapes.length === 0)
    throw new Error('"shapes" must be a non-empty array');
  for (const shape of puzzle.shapes) {
    if (!shape.id || !Array.isArray(shape.cells)) throw new Error(`Shape missing id or cells`);
    if (typeof shape.movable !== 'boolean') throw new Error(`Shape "${shape.id}" missing "movable"`);
    if (!shape.movable && !Array.isArray(shape.position)) throw new Error(`Anchor shape "${shape.id}" missing "position"`);
  }
  if (!Array.isArray(puzzle.solution)) throw new Error('Missing "solution" array');
}
```

### Pattern 7: Vanilla JS Screen Switching (Single HTML)
**What:** One `index.html` with multiple screen `<div>`s. Show/hide with CSS class or `display` style. No router.
**When to use:** No build tool, no framework — standard vanilla SPA pattern.
**Example:**
```javascript
// main.js
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// Usage
showScreen('start-screen');   // on load
showScreen('lobby-screen');   // after createRoom / joinRoom success
```

### Pattern 8: Copy-to-Clipboard for Room Code
**What:** `navigator.clipboard.writeText()` is async and requires a secure context (HTTPS or localhost).
**When to use:** Copy button next to room code display.
**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API
copyBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(roomCodeDisplay.textContent);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2000);
  } catch (err) {
    console.warn('Clipboard write failed:', err);
  }
});
```

### Anti-Patterns to Avoid
- **Using `app.listen()` instead of `httpServer.listen()`:** Socket.IO cannot attach to the internal server created by `app.listen()`. Always use `createServer(app)` explicitly.
- **Handling cleanup in `disconnect` instead of `disconnecting`:** By the time `disconnect` fires, `socket.rooms` is already cleared. You cannot read which room the player was in. Always use `disconnecting` for lobby/game cleanup.
- **Sending the solution to the client:** The `solution` field from the puzzle JSON must never appear in any `socket.emit()` payload. Enforce this by only ever calling `getPublicState()` for outbound data — never serializing the raw puzzle object.
- **Storing player data in the socket instead of the lobby:** `socket.data` is fine for convenience (quick access to `roomCode` and `playerName`), but the authoritative player list lives in the lobby's `players` array in the in-memory Map.
- **Blocking the event loop with synchronous puzzle validation inside event handlers:** Do all validation at startup synchronously (`readdirSync`, `readFileSync`). After that, puzzles are in memory and lookups are O(1) Map gets.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time room broadcast | Custom WebSocket routing | `io.to(roomCode).emit()` | Socket.IO handles message fan-out, reconnection buffering, transport negotiation |
| Room member tracking | Custom socket→room mapping | `socket.join()` / `io.in(room).fetchSockets()` | Socket.IO adapter maintains bidirectional socket↔room maps; race conditions are handled |
| Per-socket metadata storage | Custom Map<socketId, data> | `socket.data` | Survives across event handlers, available to `io.in(room).fetchSockets()` results |
| Graceful disconnect before room leave | `disconnect` event with stale room info | `disconnecting` event (rooms still populated) | Order of events matters; `disconnecting` is the only safe hook |

**Key insight:** Socket.IO rooms ARE the lobby abstraction. Don't build a parallel system.

---

## Common Pitfalls

### Pitfall 1: Wrong Express + Socket.IO Initialization Order
**What goes wrong:** `app.listen(3000)` is called; `new Server(app)` is passed the Express app not the http.Server. Socket.IO silently fails to attach WebSocket upgrades in some configurations.
**Why it happens:** The Express docs show `app.listen()` everywhere, but Socket.IO needs the underlying `http.Server` instance.
**How to avoid:** Always: `const httpServer = createServer(app); const io = new Server(httpServer); httpServer.listen(3000);`
**Warning signs:** Socket.IO connects via long-polling but never upgrades to WebSocket; works in dev, breaks in production.

### Pitfall 2: Using `disconnect` Instead of `disconnecting` for Cleanup
**What goes wrong:** `socket.rooms` is already empty in `disconnect`. You cannot tell which room the player was in.
**Why it happens:** Intuition says `disconnect` = "player just left", but the room cleanup happens between `disconnecting` and `disconnect`.
**How to avoid:** All lobby/game state cleanup goes in `socket.on('disconnecting', ...)`. The `socket.data.roomCode` fallback works in both events if you store it there, but `socket.rooms` only works in `disconnecting`.
**Warning signs:** "Player left" logic runs but lobby state is never updated; phantom players in lobby list.

### Pitfall 3: Puzzle Solution Leaking to Client
**What goes wrong:** The raw puzzle object is serialized and emitted to clients, including the `solution` field.
**Why it happens:** Convenience — it's easy to emit the whole puzzle object.
**How to avoid:** Define `getPublicState()` on day one. It is the ONLY serialization path. Validate with a code review rule: grep for direct puzzle object emission.
**Warning signs:** In browser devtools Network tab, the `startGame` or `lobby:update` event payload contains `"solution"`.

### Pitfall 4: Room Code Collision (Rare but Real)
**What goes wrong:** Two concurrent `createRoom` calls generate the same 6-digit code; second lobby overwrites first.
**Why it happens:** Single-threaded but async — if two creates happen in the same tick, both could generate the same code before either inserts.
**How to avoid:** The collision loop `while (lobbies.has(code))` prevents this for single-server Node.js (event loop is single-threaded; no true concurrency). The loop is O(1) in practice with a 6-digit space and ≤ few hundred concurrent rooms.
**Warning signs:** Only relevant at scale (thousands of concurrent rooms). Not an issue for a Uni demo.

### Pitfall 5: Host Disconnect While in Lobby Not Handled Separately
**What goes wrong:** Host disconnects in lobby phase. Lobby stays alive in memory with no host. Remaining players are stuck in lobby with no start button.
**Why it happens:** Disconnect handler treats all disconnects the same way.
**How to avoid:** In `disconnecting`, check `wasHost && lobby.phase === 'lobby'` → destroy lobby and emit `lobby:hostLeft` to remaining clients.
**Warning signs:** Lobby UI shows no host, start button missing for everyone, lobby never destroyed.

### Pitfall 6: `fs.readFileSync` Path Resolution with ES Modules
**What goes wrong:** `__dirname` is not defined in ES module scope (`"type": "module"` in package.json).
**Why it happens:** `__dirname` is a CommonJS global, not available in ESM.
**How to avoid:** Use `import.meta.url` to reconstruct it:
```javascript
import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
```
Or keep `server/package.json` without `"type": "module"` and use CommonJS `require()` — simpler for a project with no build tooling.
**Warning signs:** `ReferenceError: __dirname is not defined` at server startup.

---

## Code Examples

Verified patterns from official sources:

### Socket.IO Room Broadcast
```javascript
// Source: https://socket.io/docs/v4/rooms/
// Emit to ALL sockets in a room (including sender)
io.to(roomCode).emit('lobby:update', payload);

// Emit to all sockets in room EXCEPT sender
socket.to(roomCode).emit('lobby:playerLeft', { playerName });
```

### Socket.IO Disconnecting Event (Official Pattern)
```javascript
// Source: https://socket.io/docs/v4/server-socket-instance/
socket.on('disconnecting', (reason) => {
  for (const room of socket.rooms) {
    if (room !== socket.id) {
      socket.to(room).emit('user has left', socket.id);
    }
  }
});
```

### fetchSockets — Get Players in Room
```javascript
// Source: https://socket.io/docs/v4/server-instance/
// Works on single-server setup (no Redis adapter needed)
const sockets = await io.in(roomCode).fetchSockets();
const playerNames = sockets.map(s => s.data.playerName);
```

### socket.data — Per-Socket Metadata
```javascript
// Source: https://socket.io/docs/v4/server-instance/
io.on('connection', (socket) => {
  socket.data.roomCode = null;
  socket.data.playerName = null;
});
```

### Puzzle List for Client (Safe — No Solution)
```javascript
// Safe puzzle list sent to client for dropdown population
function getPuzzleListForClient(puzzleMap) {
  return Array.from(puzzleMap.values()).map(p => ({
    id: p.id,
    name: p.name
    // gridSize intentionally omitted per locked decision (name only in dropdown)
    // solution NEVER included
  }));
}
```

### Anchor Shape Pre-Placement (getPublicState Preview)
```javascript
// Anchor shapes are pre-placed in the grid at game start
function buildInitialGrid(puzzle) {
  const grid = Array.from({ length: puzzle.gridSize.rows }, () =>
    Array(puzzle.gridSize.cols).fill(null)
  );
  for (const shape of puzzle.shapes) {
    if (!shape.movable && shape.position) {
      const [originRow, originCol] = shape.position;
      for (const [dr, dc] of shape.cells) {
        grid[originRow + dr][originCol + dc] = { shapeId: shape.id, movable: false };
      }
    }
  }
  return grid;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `socket.on('disconnect')` for cleanup | `socket.on('disconnecting')` for cleanup | Socket.IO v2+ | `disconnecting` is the only event where `socket.rooms` is still populated |
| `io.sockets.adapter.rooms` direct access | `io.in(room).fetchSockets()` | Socket.IO v4.0.0 | `fetchSockets()` returns full Socket objects with `.data`; works correctly with cluster adapters |
| `app.listen()` for Socket.IO | `createServer(app)` + `io = new Server(httpServer)` | Always required | `app.listen()` creates an inaccessible internal server |

**Deprecated/outdated:**
- `socket.rooms` in `disconnect` handler: returns empty Set since Socket.IO v2. Use `disconnecting` instead.
- `io.sockets.clients(room, callback)`: removed in Socket.IO v3. Use `io.in(room).fetchSockets()`.

---

## Open Questions

1. **CommonJS vs ESM for server code**
   - What we know: The `server/package.json` is an empty stub — `"type"` field not yet set.
   - What's unclear: Whether to use `require()` (CommonJS, no `__dirname` issue) or `import` (ESM, needs `fileURLToPath` workaround).
   - Recommendation: Use CommonJS (`require`) for the server. No build tool, simpler path resolution, matches the Node.js LTS baseline. Client uses plain `<script>` tags anyway.

2. **Puzzle JSON files — content before Phase 2**
   - What we know: `puzzles/puzzle_01.json` is an empty stub. Phase 2 testing requires valid puzzles.
   - What's unclear: Who creates the puzzle content (a team member task, not automated).
   - Recommendation: Create 2–3 sample puzzles as part of Phase 1 Wave 0. The schema is fully defined. Minimum: 1 anchor shape + 2 movable shapes on a 4×4 grid.

3. **`socket.data` vs lobby Map as source of truth**
   - What we know: `socket.data` is convenient for quick lookups; the lobby Map is authoritative.
   - What's unclear: Whether `socket.data` should be used at all or everything should go through the Map.
   - Recommendation: Use `socket.data.roomCode` and `socket.data.playerName` as a read-only index for fast disconnect handling. The lobby Map (`lobbies`) is always the source of truth and is the only place state is mutated.

---

## Sources

### Primary (HIGH confidence)
- [Socket.IO Official Docs — Rooms v4](https://socket.io/docs/v4/rooms/) — room join/leave/broadcast API, `disconnecting` event, adapter internals
- [Socket.IO Official Docs — Server Socket Instance v4](https://socket.io/docs/v4/server-socket-instance/) — `socket.data`, `socket.rooms`, `disconnect` vs `disconnecting` events, event reasons
- [Socket.IO Official Docs — Server Initialization v4](https://socket.io/docs/v4/server-initialization/) — Express + `createServer` integration pattern
- [Socket.IO Official Docs — Server Instance v4](https://socket.io/docs/v4/server-instance/) — `fetchSockets()` API
- [Socket.IO Official Docs — Client Installation v4](https://socket.io/docs/v4/client-installation/) — CDN URL, server auto-serves `/socket.io/socket.io.js`
- [Socket.IO v4.8.3 Changelog](https://socket.io/docs/v4/changelog/4.8.3) — confirmed latest version December 2025
- [MDN — Clipboard API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) — `navigator.clipboard.writeText()` browser support and usage

### Secondary (MEDIUM confidence)
- [VideoSDK — Socket.IO Rooms 2025](https://www.videosdk.live/developer-hub/socketio/socketio-rooms) — Room code generation collision pattern, lobby management patterns

### Tertiary (LOW confidence)
- Community examples for 6-digit room code generation loop — pattern matches Socket.IO official docs behavior; not from official source directly

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — locked by project decisions; Socket.IO 4.8.3 verified via official changelog
- Architecture patterns: HIGH — all patterns verified against Socket.IO official docs
- Puzzle schema: HIGH — fully defined in CONTEXT.md locked decisions, no ambiguity
- Disconnect handling: HIGH — `disconnecting` event behavior verified in official Socket.IO server-socket-instance docs
- Pitfalls: HIGH — derived from official API documentation, not community speculation

**Research date:** 2026-03-03
**Valid until:** 2026-06-03 (stable stack; Socket.IO v4 API is mature)
