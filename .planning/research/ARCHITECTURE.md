# Architecture Research

**Domain:** Multiplayer real-time puzzle game — Socket.IO + Express (Node.js), Vanilla JS SPA
**Researched:** 2026-04-06
**Confidence:** HIGH (direct code inspection of all source files: game.js, socket.js, server.js, main.js, index.html)

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Vanilla JS SPA)                           │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │  start-screen   │  │  lobby-screen    │  │       game-screen        │  │
│  │  (leaderboard)  │  │  (host controls) │  │  grid, bank, timer, HUD  │  │
│  └───────┬─────────┘  └────────┬─────────┘  └─────────────┬────────────┘  │
│          │                    │                           │               │
│  ┌───────┴────────────────────┴───────────────────────────┴────────────┐  │
│  │                         main.js                                      │  │
│  │  Socket listeners · Render functions · Interaction state             │  │
│  └──────────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────────┼────────────────────────────────┘
                                          │ Socket.IO WebSocket
┌─────────────────────────────────────────┼────────────────────────────────┐
│                          SERVER (Node.js)                                  │
│  ┌──────────────────────────────────────┴──────────────────────────────┐  │
│  │  server.js — entry point                                             │  │
│  │  Express static + Socket.IO init + puzzle load + connection greeting  │  │
│  └──────────┬──────────────────────────────────────────┬───────────────┘  │
│             │                                          │                  │
│  ┌──────────┴────────────────────────────┐  ┌──────────┴──────────────┐   │
│  │  socket.js                             │  │  game.js               │   │
│  │  registerSocketHandlers(io, socket)    │  │  lobbies Map (all state)│   │
│  │  All event listeners + auth guards     │  │  leaderboard (Map v1.2) │   │
│  │  State broadcast via getPublicState()  │  │  puzzleMap (boot-loaded)│   │
│  └────────────────────────────────────────┘  └─────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  puzzles/*.json — static data loaded once at startup                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | v1.2 Status |
|-----------|----------------|-------------|
| `server.js` | HTTP + Socket.IO init, puzzle loading, connection greeting | Unchanged |
| `game.js` | All in-memory state (lobbies Map, leaderboard, puzzleMap). Pure logic, no I/O. | Primary mutation target |
| `socket.js` | Bridges socket events to game.js. Auth guards (turn, host). Broadcasts state. | Secondary target — new events |
| `client/index.html` | Static screen structure, DOM scaffolding | Add screens + elements |
| `client/main.js` | Socket listeners, render functions, interaction state | Add listeners + render fns |
| `client/style.css` | Visual presentation | Add modal + screen styles |
| `puzzles/*.json` | Puzzle definitions + solution (server-only) | Unchanged |

---

## Feature Integration Analysis

### Feature 1: Controls Modal (HLP-*)

**Integration point:** Client only. Zero server changes.

**What changes:**

`client/index.html` — Two additions only:
```html
<!-- Info button inside game-screen, near the h2/timer -->
<button id="controls-info-btn" aria-label="Steuerung anzeigen">?</button>

<!-- Modal outside all .screen divs (follows win-overlay pattern) -->
<div id="controls-modal" class="modal-overlay" style="display:none;">
  <div class="modal-card">
    <h3>Steuerung</h3>
    <!-- Controls table content -->
    <button id="controls-close-btn">Schließen</button>
  </div>
</div>
```

`client/main.js` — Two event listeners wired once at module load:
```javascript
document.getElementById('controls-info-btn').addEventListener('click', () => {
  document.getElementById('controls-modal').style.display = 'flex';
});
document.getElementById('controls-close-btn').addEventListener('click', () => {
  document.getElementById('controls-modal').style.display = 'none';
});
```

`client/style.css` — Modal overlay + card styles. Reuse the `.win-overlay` / `.win-card` visual pattern already present.

**Files changed:** index.html, main.js, style.css
**Files unchanged:** All server files

---

### Feature 2: Profanity Filter (PROF-*)

**Integration point:** `socket.js` createRoom + joinRoom handlers only. Validation fires before any game.js call.

**What changes:**

`server/package.json` — Add dependency:
```bash
npm install bad-words
```

`socket.js` — Require filter once at top of file, apply in two handlers:
```javascript
const Filter = require('bad-words');
const filter = new Filter();

// In createRoom handler, after name.trim().slice(0, 20):
if (filter.isProfane(name)) {
  return socket.emit('room:error', 'Please choose a different name');
}

// In joinRoom handler, same guard (same position: after trim, before createLobby/addPlayer)
```

`game.js` — Unchanged. The name reaches game.js only after socket.js validation. This preserves the separation: socket.js owns validation, game.js owns state.

`client/` — Unchanged. The existing `room:error` socket event already displays errors. No new client code needed.

**Files changed:** server/package.json, socket.js
**Files unchanged:** game.js, all client files

---

### Feature 3: Random Mode Overhaul (RAND-*)

**Integration point:** `game.js` triggerRandomEvent() and pickRandomEvent() + `client/main.js` randomMode:event handler.

**What changes:**

`game.js` — `pickRandomEvent()`: probability table expands with ≥4 new event type strings. Current distribution uses 4 buckets summing to 100%. New types are added by inserting new probability thresholds.

`game.js` — `triggerRandomEvent()`: New `if (eventType === 'X')` branches added. Each branch:
- Optionally mutates `lobby` state (players array, grid, activeTurnIndex)
- Returns `{ type: string, description: string }` — same shape as existing events
- Returns `null` if event cannot apply (e.g., no placed pieces available)

The existing broadcast path in `socket.js` requires no changes:
```javascript
// socket.js — already handles all new event types correctly:
const event = triggerRandomEvent(lobby);
if (event) io.to(roomCode).emit('randomMode:event', event);
io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode));
```
The `stateUpdate` that follows carries the full new state, covering any server-side mutation made by new events.

`client/main.js` — `socket.on('randomMode:event', ...)` handler: existing switch is on `type`. New event types that need client-side visual effects add new `if (type === 'X')` branches. New event types that are purely server-side (all state delivered via stateUpdate) need no client handler at all.

**Key constraint:** The `_forceEventType` second parameter in `triggerRandomEvent()` enables test injection without production impact. All new event branches must follow this pattern to remain unit-testable.

**Files changed:** game.js, main.js
**Files unchanged:** socket.js, server.js, index.html, style.css

---

### Feature 4: Per-Level Leaderboard (LDR-*)

**Integration point:** `game.js` leaderboard store + `socket.js` new event + `client/` new screen + `client/` new render function.

**What changes:**

`game.js` — Leaderboard data structure changes:
```javascript
// Before (v1.1):
const leaderboard = [];
// shape: [{ puzzleName, elapsedMs, playerNames }]

// After (v1.2):
const leaderboard = new Map();
// shape: Map<puzzleId, [{ puzzleName, elapsedMs, playerNames }]>
```

`game.js` — `recordLeaderboardEntry()` updated to write to Map:
```javascript
function recordLeaderboardEntry(lobby, elapsedMs) {
  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);
  const puzzleId = lobby.selectedPuzzleId;
  if (!leaderboard.has(puzzleId)) leaderboard.set(puzzleId, []);
  const bucket = leaderboard.get(puzzleId);
  bucket.push({
    puzzleName: puzzle?.name ?? 'Unknown',
    elapsedMs,
    playerNames: lobby.players.map(p => p.name),
  });
  bucket.sort((a, b) => a.elapsedMs - b.elapsedMs);
}
```

`game.js` — `getLeaderboard()` gains optional `puzzleId` parameter:
```javascript
function getLeaderboard(puzzleId) {
  if (puzzleId) {
    const bucket = leaderboard.get(puzzleId) || [];
    return bucket.map((e, i) => ({
      rank: i + 1, puzzleName: e.puzzleName,
      time: formatTime(e.elapsedMs), playerNames: e.playerNames,
    }));
  }
  // No puzzleId: return flat global list (backward-compatible for start screen)
  const all = [];
  for (const [, bucket] of leaderboard) all.push(...bucket);
  all.sort((a, b) => a.elapsedMs - b.elapsedMs);
  return all.map((e, i) => ({
    rank: i + 1, puzzleName: e.puzzleName,
    time: formatTime(e.elapsedMs), playerNames: e.playerNames,
  }));
}
```

`server.js` — Unchanged. The connection greeting `socket.emit('leaderboard:update', getLeaderboard())` still works (no puzzleId argument = global list).

`socket.js` — New event handler added:
```javascript
socket.on('leaderboard:get', ({ puzzleId } = {}) => {
  socket.emit('leaderboard:data', getLeaderboard(puzzleId || undefined));
});
```

`client/index.html` — New fourth screen:
```html
<div id="leaderboard-screen" class="screen">
  <h2>Bestenliste</h2>
  <div class="leaderboard-filter">
    <label for="leaderboard-puzzle-select">Puzzle</label>
    <select id="leaderboard-puzzle-select">
      <option value="">Alle Puzzles</option>
    </select>
  </div>
  <table class="leaderboard-table">
    <thead>
      <tr><th>#</th><th>Puzzle</th><th>Zeit</th><th>Spieler</th></tr>
    </thead>
    <tbody id="leaderboard-per-puzzle-body"></tbody>
  </table>
  <button id="leaderboard-back-btn">Zurück</button>
</div>
```

Navigation button added to start screen.

`client/main.js` — New additions:
- `showScreen('leaderboard-screen')` call on button click
- Populate `#leaderboard-puzzle-select` when `puzzle:list` arrives (already fires on connect)
- `socket.on('leaderboard:data', entries => renderPerPuzzleLeaderboard(entries))`
- New `renderPerPuzzleLeaderboard()` function (mirrors existing `renderLeaderboard()`)
- On puzzle dropdown change: emit `leaderboard:get { puzzleId }`
- Back button: `showScreen('start-screen')`

**Data flow:**
```
[User clicks "Bestenliste" on start screen]
    ↓
showScreen('leaderboard-screen')
emit leaderboard:get { puzzleId: selectedPuzzleId || undefined }
    ↓
socket.on('leaderboard:get') → socket.emit('leaderboard:data', getLeaderboard(puzzleId))
    ↓
socket.on('leaderboard:data') → renderPerPuzzleLeaderboard(entries)
```

**Files changed:** game.js, socket.js, index.html, main.js, style.css
**Files unchanged:** server.js

---

### Feature 5: Reconnect (RECON-*)

**Integration point:** `game.js` player model + `socket.js` disconnecting handler + new reconnect event + `client/main.js` reconnect logic.

**What changes:**

`game.js` — Player object in `lobby.players` gains two fields:
```javascript
// Before:
{ socketId, name, isHost }

// After:
{ socketId, name, isHost, disconnected: false, disconnectTimer: null }
```

`game.js` — New exported function `reservePlayerSlot(roomCode, socketId)`:
- Finds player by socketId
- Sets `player.disconnected = true`
- Starts a 30s setTimeout; on expiry: calls `advanceTurnIfActive()` + `removePlayer()` + broadcasts stateUpdate via callback
- Stores timer reference on `player.disconnectTimer`
- Returns `{ ok, playerName }` so socket.js can log and broadcast notification

`game.js` — New exported function `reconnectPlayer(roomCode, playerName, newSocketId)`:
- Finds player where `p.name === playerName && p.disconnected === true`
- Clears `player.disconnectTimer` and cancels the setTimeout
- Replaces `player.socketId` with `newSocketId`
- Sets `player.disconnected = false`
- If player was host: may need to update `lobby.hostId`
- Returns `{ ok, lobby }`

`socket.js` — `disconnecting` handler changes for playing phase:

```javascript
// Current:
advanceTurnIfActive(lobby, socket.id);
removePlayer(roomCode, socket.id);

// New (playing phase only):
const reservation = reservePlayerSlot(roomCode, socket.id, (finalRoomCode) => {
  // This callback fires after 30s if no reconnect
  const finalLobby = getLobby(finalRoomCode);
  if (finalLobby) {
    io.to(finalRoomCode).emit('game:stateUpdate', getPublicState(finalRoomCode));
  }
});
// Lobby-phase disconnect still calls removePlayer() immediately (no reconnect window)
```

`socket.js` — New `reconnect:attempt` event handler:
```javascript
socket.on('reconnect:attempt', ({ playerName, roomCode } = {}) => {
  if (!playerName || !roomCode) return;

  const result = reconnectPlayer(roomCode, playerName, socket.id);
  if (!result.ok) {
    return socket.emit('reconnect:failed', { reason: result.error });
  }
  socket.data.roomCode = roomCode;
  socket.data.playerName = playerName;
  socket.join(roomCode);
  // Send current state so client can re-render
  socket.emit('reconnect:success', getPublicState(roomCode));
  io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode));
});
```

`client/main.js` — Socket.IO transport-level reconnect fires the `connect` event automatically. The client stores `myPlayerName` and `myRoomCode` in module-level variables (already done in v1.1). On reconnect:
```javascript
socket.on('connect', () => {
  // Socket.IO fires 'connect' both on first connect and on every reconnect
  if (myRoomCode && myPlayerName) {
    socket.emit('reconnect:attempt', { playerName: myPlayerName, roomCode: myRoomCode });
  }
});

socket.on('reconnect:success', (state) => {
  // Re-render game screen with current state
  showScreen('game-screen');
  renderGrid(state);
  renderBank(state);
  renderTurnUI(state);
});

socket.on('reconnect:failed', ({ reason }) => {
  // Reconnect window expired or lobby gone — send to start screen
  myRoomCode = null;
  showScreen('start-screen');
  showJoinError(reason || 'Reconnect fehlgeschlagen');
});
```

**Key constraint:** Player identified by name only (no auth). `reconnectPlayer()` lookup is `p.name === playerName && p.disconnected`. The existing name-uniqueness check in `joinRoom` already prevents name collisions. Reconnect bypasses the normal join flow entirely.

**Key constraint:** The timer callback in `reservePlayerSlot` needs access to the `io` object to broadcast the stateUpdate after the slot expires. Pass `io` as a parameter to the function, or pass a broadcast callback. The callback pattern avoids importing socket.io into game.js (preserving the separation of concerns).

**Data flow:**
```
[Player transport drops]
    ↓
socket.on('disconnecting') → reservePlayerSlot() → setTimeout(30s callback)
    ↓
[Case A: reconnects within 30s]
    Socket.IO fires 'connect' on client
    client emits 'reconnect:attempt' { playerName, roomCode }
    socket.on('reconnect:attempt') → reconnectPlayer() → clearTimeout
    → socket.emit('reconnect:success', state) + io.to(room).emit('stateUpdate')

[Case B: 30s expires]
    timer callback → advanceTurnIfActive() + removePlayer()
    → io.to(room).emit('game:stateUpdate', getPublicState())
```

**Files changed:** game.js, socket.js, main.js
**Files unchanged:** server.js, index.html (no new HTML elements needed for reconnect), style.css

---

## Files Changed Summary

| File | Change Type | Features |
|------|-------------|---------|
| `server/src/game.js` | Add: reconnect player functions, new random event branches, leaderboard Map | RAND, LDR, RECON |
| `server/src/socket.js` | Add: profanity guard, leaderboard:get event, reconnect:attempt event, disconnect handler change | PROF, LDR, RECON |
| `server/package.json` | Add: `bad-words` dependency | PROF |
| `client/index.html` | Add: controls modal, info button, leaderboard screen | HLP, LDR |
| `client/main.js` | Add: modal listeners, leaderboard screen logic, reconnect logic, new randomMode:event cases | HLP, LDR, RAND, RECON |
| `client/style.css` | Add: modal styles, leaderboard screen styles | HLP, LDR |

## Files Unchanged

| File | Why Stable |
|------|------------|
| `server/src/server.js` | No new startup logic required for any v1.2 feature |
| `puzzles/*.json` | No puzzle format changes in v1.2 |

---

## Key Data Structure Changes

### Player Object in `lobby.players`

```javascript
// v1.1:
{ socketId: string, name: string, isHost: boolean }

// v1.2 (RECON-*):
{ socketId: string, name: string, isHost: boolean, disconnected: boolean, disconnectTimer: ReturnType<typeof setTimeout> | null }
```

### Leaderboard Store in `game.js`

```javascript
// v1.1:
const leaderboard = [];
// [{ puzzleName, elapsedMs, playerNames }]

// v1.2 (LDR-*):
const leaderboard = new Map();
// Map<puzzleId, [{ puzzleName, elapsedMs, playerNames }]>
```

### Socket Events: New in v1.2

| Event | Direction | Feature |
|-------|-----------|---------|
| `leaderboard:get` | client → server | LDR |
| `leaderboard:data` | server → client | LDR |
| `reconnect:attempt` | client → server | RECON |
| `reconnect:success` | server → client | RECON |
| `reconnect:failed` | server → client | RECON |

### Socket Events: Unchanged (existing events handle new cases)

| Event | How v1.2 uses it |
|-------|-----------------|
| `room:error` | PROF reuses this — no new client handling needed |
| `randomMode:event` | RAND adds new `type` values; payload shape `{type, description}` unchanged |
| `game:stateUpdate` | All server-side mutations in RAND/RECON broadcast via existing stateUpdate |

---

## Recommended Build Order

### Order: HLP → PROF → RAND → LDR → RECON

| Step | Feature | Rationale |
|------|---------|-----------|
| 1 | Controls Modal (HLP) | Zero risk, zero server, zero dependencies. Quick win. Validates the modal overlay pattern before it's used again conceptually for the leaderboard screen. |
| 2 | Profanity Filter (PROF) | Server-only (2 lines in socket.js + npm install). Isolated. Closes a gap before further socket.js work in later steps. |
| 3 | Random Mode Overhaul (RAND) | Pure expansion inside triggerRandomEvent(). No schema changes, no new events, no client screen. game.js is the only meaningful target. Build while game.js is clean before LDR restructures the leaderboard. |
| 4 | Per-Level Leaderboard (LDR) | Changes game.js leaderboard structure and adds a new HTML screen. Independent of RECON. Build before RECON so all other game.js changes are stable before the more complex reconnect state is added. |
| 5 | Reconnect (RECON) | Most complex: new player state, timer-based cleanup, two new socket events, client reconnect handler. Build last against a fully stable codebase. |

### Dependency Map

```
HLP   ─── no deps (client-only)
PROF  ─── no deps (socket.js only)
RAND  ─── no deps (game.js only, existing socket path)
LDR   ─── game.js stable (build after RAND which also touches game.js)
RECON ─── all other features stable (touches socket.js disconnect handler)
```

---

## Architectural Patterns

### Pattern 1: Pure Mutation in game.js, Broadcast in socket.js

**What:** game.js functions mutate lobby state and return `{ ok, ... }`. socket.js calls `getPublicState()` and emits the result. game.js has no import of socket.io.
**When to use:** Every v1.2 feature. All new game logic functions (reconnectPlayer, reservePlayerSlot, new random event handlers) follow this pattern.
**Trade-offs:** Enables unit testing of game logic without mocking Socket.IO.

**The single serialization invariant:** `getPublicState()` is the only function that produces outbound state payloads. `puzzle.solution` never appears in its output. New features must not bypass this function.

### Pattern 2: socket.data for Per-Socket Identity

**What:** `socket.data.roomCode` and `socket.data.playerName` are set on createRoom/joinRoom. Every subsequent handler reads from `socket.data` to find the lobby.
**When to use:** RECON must set `socket.data` on `reconnect:attempt` success exactly as createRoom/joinRoom do, so all subsequent handlers work without modification.
**Trade-offs:** `socket.data` persists across transport-level reconnects within a session. A full page reload creates a new socket with empty `socket.data` — client module-level vars (`myRoomCode`, `myPlayerName`) are the fallback.

### Pattern 3: Name as Identity (No Auth)

**What:** Players are identified by `name` within a room. The renderLobbyUpdate() function already uses `p.name === myPlayerName` (not socketId) to determine if the current player is host.
**When to use:** RECON reconnect lookup: `lobby.players.find(p => p.name === playerName && p.disconnected)`. This is the correct approach given the no-auth constraint.
**Trade-offs:** Name squatting is possible but acceptable at Uni scope. PROF filter reduces abuse.

### Pattern 4: showScreen() for Client Navigation

**What:** `showScreen(id)` removes `.active` from all `.screen` divs, adds it to target. Single function, used everywhere.
**When to use:** New leaderboard screen. Call `showScreen('leaderboard-screen')`. The screen div must have `class="screen"`.
**Trade-offs:** No routing, no URL changes. Simple and consistent with all existing navigation.

### Pattern 5: win-overlay Pattern for Modals

**What:** Modal elements placed outside `.screen` divs in index.html, shown/hidden via `style.display`. The `win-overlay` is the existing example.
**When to use:** Controls modal (HLP). Place `<div id="controls-modal">` after `win-overlay`.
**Trade-offs:** Modals stack above screens automatically because they appear later in DOM. No z-index conflicts with the screen structure.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Calling removePlayer() Immediately on Disconnect During Playing Phase

**What people do:** Keep existing `disconnecting` handler unchanged, call `removePlayer()` immediately.
**Why it's wrong:** The player slot disappears before the 30s reconnect window ends. `reconnectPlayer()` finds no slot to fill.
**Do this instead:** Call `reservePlayerSlot()` during playing phase. `removePlayer()` is called only from the timer callback after 30s. Lobby-phase disconnect still calls `removePlayer()` immediately — there is nothing to reconnect to during lobby phase.

### Anti-Pattern 2: Broadcasting Full Per-Puzzle Data on Every game:win

**What people do:** Change `leaderboard:update` to carry a puzzleId-keyed object, broadcast on every win.
**Why it's wrong:** All connected clients receive all puzzle data on every win event. The per-puzzle screen only needs one puzzle's data on demand.
**Do this instead:** Keep `leaderboard:update` broadcasting the flat global list (backward compatible with start screen). Add `leaderboard:get` / `leaderboard:data` as a separate request-response pattern for the per-puzzle screen.

### Anti-Pattern 3: Profanity Filter in game.js

**What people do:** Add profanity check inside `createLobby()` or `addPlayer()`.
**Why it's wrong:** game.js is pure state logic. Adding I/O validation there blurs the boundary and requires game.js to return error strings that socket.js interprets.
**Do this instead:** Validate in socket.js, before the game.js call. socket.js already has all other validation guards at this layer (name trimming, room existence, phase checks).

### Anti-Pattern 4: Storing the Reconnect Timer on socket.data

**What people do:** Track the 30s timer on the disconnecting socket's `socket.data`.
**Why it's wrong:** `socket.data` is destroyed with the socket. The timer reference is lost and can never be cleared on reconnect.
**Do this instead:** Store the timer on the player object inside `lobby.players`. The player object lives in the `lobbies` Map and persists independently of socket connections.

### Anti-Pattern 5: New Leaderboard as a Modal Overlay

**What people do:** Show the per-puzzle leaderboard as an overlay on the start screen.
**Why it's wrong:** Inconsistent with the established screen-switching pattern. Harder to test, harder to navigate back from, and requires additional z-index management.
**Do this instead:** Add a fourth `<div id="leaderboard-screen" class="screen">` element in index.html and use `showScreen()`.

### Anti-Pattern 6: Emitting reconnect:attempt on Every connect Event Unconditionally

**What people do:** Always emit `reconnect:attempt` in the `socket.on('connect')` handler.
**Why it's wrong:** The `connect` event also fires on the very first connection when `myRoomCode` is null. An unconditional emit sends garbage data.
**Do this instead:** Guard with `if (myRoomCode && myPlayerName)` before emitting. Only attempt reconnect when the client has a known room context.

---

## Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| socket.js → game.js | Direct require() imports | socket.js imports game.js. game.js has no knowledge of socket.js. |
| server.js → socket.js | `registerSocketHandlers(io, socket, puzzleMap)` per connection | io passed by reference so socket.js can broadcast to rooms |
| server.js → game.js | `loadPuzzles()`, `getLeaderboard()` at startup | Startup coupling only |
| client/main.js → server | Socket.IO events only | No HTTP requests from client post-connection |
| RECON timer callback → socket.js | Callback function passed to `reservePlayerSlot()` | Avoids game.js depending on socket.io; keeps I/O in socket.js |

---

## Scalability Considerations

This is a Uni demo. In-memory, single process. No scaling concerns at target scope.

| Scale | Status |
|-------|--------|
| 2-4 players, 1-5 concurrent lobbies (demo) | Correct — in-memory Map handles this trivially |
| Persistence | Explicitly out of scope (PROJECT.md) |
| Multiple servers | Out of scope — would require Redis adapter for Socket.IO rooms |

---

## Sources

- Direct code inspection of `server/src/server.js`, `server/src/game.js`, `server/src/socket.js`, `client/main.js`, `client/index.html`, `server/package.json` (2026-04-06)
- `.planning/PROJECT.md` — project constraints, key decisions, active requirements
- Socket.IO v4 behavior: `connect` event fires on initial connection and on every transport reconnect, `socket.data` persists within a session (HIGH confidence — Socket.IO v4 documentation, consistent with known behavior)
- `bad-words` npm package: CommonJS compatible, no transitive dependencies (MEDIUM confidence — matches known ecosystem state as of training data)

---
*Architecture research for: LogiBlock v1.2 — Spielqualität & Features*
*Researched: 2026-04-06*
