# Phase 3: Timer und Leaderboard - Research

**Researched:** 2026-03-10
**Domain:** Real-time timer synchronization, in-memory leaderboard, Socket.IO event coordination, vanilla JS UI
**Confidence:** HIGH

## Summary

Phase 3 is an additive, low-risk phase. No new frameworks or libraries are needed — all required capabilities exist in the current stack (Socket.IO 4.x, vanilla JS, Node.js built-ins). The technical domain breaks into three independent problems: (1) timer lifecycle tied to socket events, (2) in-memory leaderboard with sorted insertion, and (3) UI restructuring of the win card and start screen.

The architecture is fully decided by the CONTEXT.md. The server stores `startTime = Date.now()` on the lobby object when `startGame()` is called, broadcasts it in `game:start`. The client runs a `setInterval` locally — no server-tick events needed. When `game:win` fires, the server computes `elapsedMs = Date.now() - lobby.startTime`, inserts the entry into a module-level leaderboard array, and emits `leaderboard:update` to all. Every new socket connection gets the current leaderboard on `connection`.

There are no external packages to install. All work is contained in `server/src/game.js`, `server/src/socket.js`, `client/index.html`, `client/main.js`, and `client/style.css`. The five requirements (TIME-01 through TIME-05) map cleanly to three server tasks and two client tasks.

**Primary recommendation:** Implement in server-first order — store `startTime` in `startGame()`, compute `elapsedMs` and record leaderboard entry in the `game:win` branch of `game:move`, then add client-side timer and UI last.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Live Timer**
- Timer is visible to all players during the game (not hidden until win)
- Displayed near the turn banner on the game screen
- Server includes `startTime` (Date.now()) in the `game:start` payload
- Client runs `setInterval` to update the display independently — no timer tick events from server
- When `game:win` is received, client clears the interval and freezes the display at the final time

**Time Format**
- MM:SS format throughout (e.g. `01:23`)
- Server stores time as milliseconds (`Date.now()` precision)
- Client formats ms → MM:SS for display (live timer and leaderboard)

**Leaderboard**
- Columns per entry: Rank | Puzzle Name | Time | Player Names
- Sorted: fastest time first
- Empty state: show the leaderboard section with placeholder text ("No games completed yet") — not hidden
- All entries shown (no cap)
- Placement: below the existing join card on the start screen
- Delivery: server emits `leaderboard:update` (full sorted list) to the newly connected socket on `connection`, and broadcasts to all after each `game:win`

**Win Screen Restructure**
- Win card layout: Title ("Puzzle Solved!") → large time display (MM:SS) → player names → "Play Again" button
- Server includes `elapsedMs` in the `game:win` payload (authoritative final time)
- "Play Again" button returns all players to the start screen (client-side: hide overlay, show start screen)
- No server-side lobby reset needed — players create/join a new room after returning to start

### Claude's Discretion
- Timer label styling (e.g. "⏱ 01:23" vs plain "01:23" — Claude picks based on existing style)
- Exact CSS for the large time display in the win card
- Socket cleanup on "Play Again" (whether to emit a leave event before showing start screen)
- Whether `elapsedMs` is added to `getPublicState()` or sent separately in the `game:win` emission

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TIME-01 | Ein Timer startet exakt wenn das Spiel beginnt (Host drückt Start) | `startGame()` in game.js:322 is the precise moment; store `lobby.startTime = Date.now()` there; include in `game:start` payload from socket.js:131 |
| TIME-02 | Der Timer stoppt exakt wenn das Puzzle korrekt gelöst wurde | `game:win` branch in socket.js:156-159 is the authoritative win detection point; compute `elapsedMs = Date.now() - lobby.startTime` before emitting; client clears `setInterval` on `game:win` |
| TIME-03 | Die Lösungszeit wird dem Team auf dem Win-Screen angezeigt | `elapsedMs` in `game:win` payload → `renderWin()` in main.js:417 restructured to show MM:SS hero element |
| TIME-04 | Auf dem Start-Screen sind alle bisherigen Team-Zeiten der aktuellen Server-Session als Rangliste sichtbar | Module-level `leaderboard` array in game.js or socket.js; emitted as `leaderboard:update` on connection and after each win; rendered below the join card in index.html |
| TIME-05 | Zeiten werden in-memory gehalten — bei Server-Neustart sind alle Zeiten weg (kein Persistence nötig) | A plain JS array (module-level) in server code; no DB, no file I/O |
</phase_requirements>

---

## Standard Stack

### Core (no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Socket.IO | 4.8.3 (already installed) | Real-time event delivery for `leaderboard:update`, `game:start` with `startTime`, `game:win` with `elapsedMs` | Already the project's transport layer |
| Node.js built-in `Date.now()` | Node.js (any) | Millisecond-precision timestamps for start/end | No extra dependency; sufficient precision for MM:SS display |
| Vanilla JS `setInterval` / `clearInterval` | Browser built-in | Client-side live timer display | Consistent with project's no-framework constraint |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | — | — | No additional packages needed for this phase |

**Installation:**
```bash
# No new packages — all capabilities exist in current stack
```

---

## Architecture Patterns

### Recommended Project Structure

No new files needed. All changes are additive to existing files:

```
server/src/
├── game.js          # Add: startTime to LobbyState; leaderboard array; recordLeaderboardEntry()
├── socket.js        # Add: startTime in game:start payload; elapsedMs in game:win payload;
│                    #      leaderboard:update on connection + after win
client/
├── index.html       # Add: #game-timer element near turn-banner; leaderboard section on start screen;
│                    #      restructure win-card; add Play Again button
├── main.js          # Add: timer interval logic; renderLeaderboard(); updated renderWin(); Play Again handler
└── style.css        # Add: .win-time hero styles; .leaderboard table/list styles; #game-timer styles
```

### Pattern 1: startTime stored at startGame(), broadcast with game:start

**What:** The server-authoritative start moment is when `startGame()` mutates `lobby.phase = 'playing'`. Store `lobby.startTime = Date.now()` at that exact line. Include `startTime` in the `game:start` emission payload (not via `getPublicState()` — see Claude's Discretion).

**When to use:** The CONTEXT.md locks this: server sets `startTime`, client receives it in `game:start`, client starts its `setInterval` from that moment.

**Example:**
```javascript
// In game.js startGame():
lobby.phase = 'playing';
lobby.grid = buildInitialGrid(puzzle);
lobby.activeTurnIndex = 0;
lobby.startTime = Date.now();          // TIME-01: authoritative start moment
return { ok: true };

// In socket.js startGame handler (line 131):
const result = startGame(roomCode);
if (!result.ok) { return socket.emit('room:error', result.error); }
const state = getPublicState(roomCode);
const lobby = getLobby(roomCode);
io.to(roomCode).emit('game:start', { ...state, startTime: lobby.startTime });
// (or add startTime to getPublicState — see Architecture note below)
```

### Pattern 2: elapsedMs computed at win moment, leaderboard entry recorded

**What:** The `game:win` branch in socket.js is the only place a winning move is confirmed. Compute `elapsedMs = Date.now() - lobby.startTime` there, record the entry, broadcast the leaderboard update, and include `elapsedMs` in the `game:win` payload.

**Example:**
```javascript
// In socket.js game:move handler, win branch:
if (result.win) {
  const elapsedMs = Date.now() - lobby.startTime;
  recordLeaderboardEntry(lobby, elapsedMs);   // inserts sorted into module-level array
  io.to(roomCode).emit('game:win', { ...getPublicState(roomCode), elapsedMs });
  io.emit('leaderboard:update', getLeaderboard());  // broadcast to ALL connected sockets
}
```

### Pattern 3: Client setInterval for live timer display

**What:** On `game:start`, the client receives `startTime` and starts a `setInterval(fn, 1000)`. Each tick computes `elapsed = Date.now() - startTime` and updates the timer display. On `game:win`, the client clears the interval and displays the authoritative `elapsedMs` from the payload.

**Example:**
```javascript
// In main.js — global timer state:
let timerInterval = null;

// In game:start handler:
socket.on('game:start', (state) => {
  showScreen('game-screen');
  initPieceColors(state);
  renderGrid(state);
  renderBank(state);
  renderTurnUI(state);
  // TIME-01: start live timer
  startLiveTimer(state.startTime);
});

function startLiveTimer(startTime) {
  clearInterval(timerInterval);
  updateTimerDisplay(Date.now() - startTime);
  timerInterval = setInterval(() => {
    updateTimerDisplay(Date.now() - startTime);
  }, 1000);
}

function updateTimerDisplay(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  document.getElementById('game-timer').textContent = `${mm}:${ss}`;
}

// In game:win handler:
socket.on('game:win', (state) => {
  clearInterval(timerInterval);                          // TIME-02: freeze timer
  timerInterval = null;
  renderGrid(state);
  renderBank(state);
  renderTurnUI(state);
  renderWin(state);                                      // TIME-03: show elapsedMs on win card
});
```

### Pattern 4: Module-level leaderboard array in server

**What:** A plain array at module scope in game.js (or socket.js). Each entry: `{ rank, puzzleName, elapsedMs, playerNames }`. The array is kept sorted ascending by `elapsedMs` at insertion time using `Array.prototype.splice` or `push` + `sort`. Ranks are re-numbered sequentially.

**Example:**
```javascript
// In game.js — module-level:
const leaderboard = [];   // TIME-05: in-memory only, cleared on server restart

function recordLeaderboardEntry(lobby, elapsedMs) {
  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);
  const entry = {
    puzzleName: puzzle ? puzzle.name : 'Unknown',
    elapsedMs,
    playerNames: lobby.players.map(p => p.name),
  };
  leaderboard.push(entry);
  leaderboard.sort((a, b) => a.elapsedMs - b.elapsedMs);
  // Return ranked list (rank is 1-indexed position in sorted array)
}

function getLeaderboard() {
  return leaderboard.map((e, i) => ({ rank: i + 1, ...e }));
}
```

### Pattern 5: leaderboard:update on connection

**What:** In `server.js` inside `io.on('connection', ...)`, emit the current leaderboard immediately to the newly connected socket. This ensures the start screen shows up-to-date data for every page load/reconnect.

**Example:**
```javascript
// In server.js:
io.on('connection', (socket) => {
  socket.emit('leaderboard:update', getLeaderboard());   // greet new socket with current leaderboard
  registerSocketHandlers(io, socket, puzzleMap);
});
```

### Pattern 6: Play Again navigation

**What:** "Play Again" is client-only. Hide the win overlay, show the start screen. The existing `showScreen('start-screen')` covers the UI transition. Whether to emit a socket leave event is Claude's discretion (see Open Questions).

**Example:**
```javascript
// In main.js:
document.getElementById('play-again-btn').addEventListener('click', () => {
  document.getElementById('win-overlay').style.display = 'none';
  showScreen('start-screen');
  // myRoomCode and amIHost retain stale values — reset them:
  myRoomCode = null;
  amIHost = false;
  // (optionally emit a leave event — see Open Questions)
});
```

### Anti-Patterns to Avoid

- **Server-sent timer tick events:** Do NOT emit a `timer:tick` event every second. This creates unnecessary message volume for all connected clients. The client computes elapsed time locally from the `startTime` anchor.
- **Storing elapsedMs in getPublicState():** `getPublicState()` is called for every state update during the game (including stateUpdate, lobbyUpdate). Including `elapsedMs` there is premature — it only makes sense at win time. Add `startTime` to the public state (since clients need it at game start) but compute and send `elapsedMs` separately in the win payload.
- **Re-numbering ranks on every leaderboard read:** Sort once at insertion time, compute rank from array index. Avoid re-sorting on every `getLeaderboard()` call.
- **Using Date.now() on the client as the start reference:** The client's clock may drift or differ from the server. The server provides `startTime` (its own `Date.now()`); the client uses that anchor to compute displayed elapsed time locally. The authoritative `elapsedMs` for records comes from the server at win time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Time formatting | Custom regex-based parser | Simple arithmetic: `Math.floor(ms / 60000)` for minutes, `Math.floor((ms % 60000) / 1000)` for seconds, `padStart(2, '0')` | Three lines of math; no edge cases beyond what padStart handles |
| Sorted insertion into leaderboard | Binary search insertion | `push()` + `sort()` | Leaderboard is tiny (session-long, bounded by number of games played); O(n log n) is fine |
| Persistence | File I/O or DB writes | None — module-level array only | TIME-05 explicitly requires no persistence |
| Clock synchronization | NTP-style protocol | Server sends `startTime`; client uses it as anchor | Good enough for MM:SS precision; sub-second drift is invisible at this resolution |

---

## Common Pitfalls

### Pitfall 1: setInterval not cleared when game ends or player navigates away

**What goes wrong:** `timerInterval` keeps running after the win overlay appears or after returning to the start screen via "Play Again". If the same client starts another game, a second interval stacks on top.

**Why it happens:** `clearInterval` is only called in the `game:win` handler, but "Play Again" may cause a state transition without that event being fired again in the new game cycle.

**How to avoid:** Always call `clearInterval(timerInterval); timerInterval = null;` at the top of `startLiveTimer()` before setting a new interval, AND in the "Play Again" click handler.

**Warning signs:** Timer increments by 2 seconds per second after a second game is started.

### Pitfall 2: startTime missing from game:start payload when existing event handlers are updated

**What goes wrong:** The `game:start` handler in socket.js currently emits `getPublicState(roomCode)` directly. If `startTime` is not added to that payload (either via `getPublicState` or via spread), the client receives `undefined` for `startTime` and the timer never starts.

**Why it happens:** The developer adds `lobby.startTime` in `startGame()` but forgets to include it in the outbound `game:start` emission.

**How to avoid:** The `game:start` handler in socket.js at line 131 must be updated. Either (a) add `startTime` to `getPublicState()` return value, or (b) spread it alongside: `{ ...getPublicState(roomCode), startTime: lobby.startTime }`.

**Warning signs:** `state.startTime` is `undefined` in the client's `game:start` handler; `NaN:NaN` displays on the timer.

### Pitfall 3: leaderboard:update not emitted to newly connecting sockets

**What goes wrong:** Players who load the page after the first game has been won see an empty leaderboard even though entries exist.

**Why it happens:** `leaderboard:update` is broadcast on win, but new sockets connecting after that point miss the broadcast. Socket.IO broadcasts go to sockets connected at that moment only — they don't replay to late joiners.

**How to avoid:** Emit `leaderboard:update` to every new socket in `io.on('connection', ...)` in server.js, before calling `registerSocketHandlers`.

**Warning signs:** Refreshing the page always shows "No games completed yet" even mid-session.

### Pitfall 4: Win card restructuring breaks existing #win-message element

**What goes wrong:** `renderWin(state)` currently writes to `document.getElementById('win-message')`. If the HTML restructure removes or renames that element, the JS throws or silently fails.

**Why it happens:** HTML-first changes are not coordinated with JS references.

**How to avoid:** When restructuring the win card in index.html, update the element IDs first, then update `renderWin()` in main.js to reference the new element IDs. Do not remove `#win-message` until JS no longer references it.

**Warning signs:** Console error `Cannot set properties of null` on `game:win`.

### Pitfall 5: Leaderboard data sent to client includes internal server fields

**What goes wrong:** The leaderboard entry sent via `leaderboard:update` accidentally includes `socketId` or other internal player fields.

**Why it happens:** `lobby.players` is copied directly into the entry.

**How to avoid:** In `recordLeaderboardEntry()`, map player names explicitly: `lobby.players.map(p => p.name)`. Never spread the raw player objects.

---

## Code Examples

Verified patterns from project codebase:

### MM:SS formatter (no library needed)

```javascript
// Pure arithmetic — no import needed
function formatTime(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
// Examples: formatTime(83000) → "01:23", formatTime(3600000) → "60:00"
```

### In-memory leaderboard module pattern

```javascript
// In game.js — module scope
const leaderboard = [];

function recordLeaderboardEntry(lobby, elapsedMs) {
  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);
  leaderboard.push({
    puzzleName: puzzle ? puzzle.name : 'Unknown',
    elapsedMs,
    playerNames: lobby.players.map(p => p.name),
  });
  leaderboard.sort((a, b) => a.elapsedMs - b.elapsedMs);
}

function getLeaderboard() {
  return leaderboard.map((e, i) => ({
    rank: i + 1,
    puzzleName: e.puzzleName,
    time: formatTime(e.elapsedMs),   // pre-format for client
    playerNames: e.playerNames,
  }));
}

module.exports = { ..., recordLeaderboardEntry, getLeaderboard };
```

### Leaderboard table render (vanilla JS, no library)

```javascript
// In main.js
function renderLeaderboard(entries) {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  if (!entries || entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="leaderboard-empty">No games completed yet</td></tr>';
    return;
  }
  tbody.innerHTML = entries.map(e =>
    `<tr>
      <td>${e.rank}</td>
      <td>${e.puzzleName}</td>
      <td class="leaderboard-time">${e.time}</td>
      <td>${e.playerNames.join(', ')}</td>
    </tr>`
  ).join('');
}
```

### startTime delivery options

Option A — via spread in socket.js (Claude's discretion: simpler, avoids changing getPublicState):
```javascript
// socket.js startGame handler:
io.to(roomCode).emit('game:start', {
  ...getPublicState(roomCode),
  startTime: getLobby(roomCode).startTime,
});
```

Option B — add to getPublicState() return (cleaner if startTime needs to be in stateUpdate too):
```javascript
// game.js getPublicState():
return {
  // ... existing fields ...
  startTime: lobby.startTime ?? null,   // null in lobby phase
};
```

**Recommendation:** Use Option A (spread in socket.js). `startTime` is only relevant at game start — it doesn't need to be in every `game:stateUpdate`. Keeps `getPublicState()` focused on game state, not lifecycle timestamps.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Server-broadcast timer ticks | Client-local setInterval anchored to server startTime | Standard practice (avoids N sockets × 1 msg/sec) | No new server load from timer; client drift is sub-second, invisible at MM:SS resolution |
| DB-backed leaderboard | In-memory array with server restart reset | Explicit requirement (TIME-05) | Zero infrastructure cost; appropriate for session-scoped game |

---

## Open Questions

1. **Should "Play Again" emit a socket leave/disconnect event before returning to start screen?**
   - What we know: The existing `disconnecting` handler in socket.js already handles cleanup when a socket disconnects. The `showScreen('start-screen')` transition does NOT disconnect the socket — it just changes the UI.
   - What's unclear: If a player clicks "Play Again" and then immediately creates/joins a new room without disconnecting, their socket still has `socket.data.roomCode` pointing to the old room. Future `game:move` events on the new room would fail because `socket.data.roomCode` would be the old value.
   - Recommendation: In the "Play Again" handler, emit `socket.emit('game:leave', {})` (or similar), OR simply reset `socket.data.roomCode` is not accessible from client. Safest approach: the client resets `myRoomCode = null` locally; the server resets `socket.data.roomCode` only when the socket sends `createRoom` or `joinRoom`. This naturally resets state on the next room action. No special `game:leave` event needed — the socket keeps its connection, and `socket.data.roomCode` is overwritten when the user creates/joins a new room. The old lobby is cleaned up by the `disconnecting` handler only if the socket disconnects.
   - **Conclusion:** No `game:leave` event needed. Reset `myRoomCode = null` and `amIHost = false` in the client "Play Again" handler. The old lobby remains in memory (not a problem since it is already in `phase: 'playing'` and won't accept joins). This is acceptable given GAME-10 cleans up empty lobbies on disconnect.

2. **Where to place the leaderboard data structure — game.js or socket.js?**
   - What we know: All existing module-level state (lobbies, puzzleMap) lives in game.js. socket.js imports from game.js but adds no state of its own.
   - Recommendation: Add `leaderboard`, `recordLeaderboardEntry()`, and `getLeaderboard()` to game.js. This keeps all server-side state in one place and makes it unit-testable without needing socket mocks.

3. **Timer display element placement relative to #turn-banner**
   - What we know: `#turn-banner` is a `<p>` inside `#game-screen` (line 65 of index.html). The game area flex layout contains player-badges, game-grid, and piece-bank.
   - Recommendation: Place `#game-timer` as a sibling `<p>` immediately after `#turn-banner`, above `.game-area`. Style it inline with the banner for visual cohesion. Claude's discretion on label ("01:23" or a text prefix).

---

## Existing Code Integration Points (Verified)

These are the exact lines to touch — verified against current codebase:

| File | Line | Current State | Phase 3 Change |
|------|------|---------------|----------------|
| `server/src/game.js` | 7-11 | LobbyState comment | Add `startTime` to shape comment |
| `server/src/game.js` | 330-334 | `startGame()` return `{ ok: true }` | Add `lobby.startTime = Date.now()` before return |
| `server/src/game.js` | ~360 (module.exports) | Exports list | Add `recordLeaderboardEntry`, `getLeaderboard` |
| `server/src/socket.js` | 131 | `io.to(roomCode).emit('game:start', getPublicState(roomCode))` | Spread `startTime` into payload |
| `server/src/socket.js` | 156-159 | `io.to(roomCode).emit('game:win', getPublicState(roomCode))` | Compute elapsedMs, record leaderboard, include elapsedMs in payload, emit leaderboard:update |
| `server/src/server.js` | 21-23 | `io.on('connection', socket => { registerSocketHandlers(...) })` | Add `socket.emit('leaderboard:update', getLeaderboard())` before registerSocketHandlers |
| `client/index.html` | 12-31 | Start screen with .card | Add leaderboard section below .card |
| `client/index.html` | 63-71 | Game screen | Add `#game-timer` near `#turn-banner` |
| `client/index.html` | 74-79 | Win overlay with `#win-message` | Restructure win card; add time hero, player list, Play Again button |
| `client/main.js` | 417-422 | `renderWin(state)` function | Rewrite to show elapsedMs as MM:SS hero, player names, wire Play Again |
| `client/main.js` | 489-495 | `game:start` handler | Add `startLiveTimer(state.startTime)` |
| `client/main.js` | 511-517 | `game:win` handler | Add `clearInterval(timerInterval)` + call updated `renderWin` |
| `client/main.js` | ~442+ (socket listeners) | Socket event block | Add `socket.on('leaderboard:update', renderLeaderboard)` |
| `client/style.css` | 244-270 | Win overlay styles | Add `.win-time` hero styles, `.leaderboard` table styles, `#game-timer` styles |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `server/src/game.js`, `server/src/socket.js`, `server/src/server.js` — verified current state of all integration points
- Direct codebase read: `client/main.js`, `client/index.html`, `client/style.css` — verified existing DOM structure and JS patterns
- Direct codebase read: `server/src/socket.test.js`, `server/src/game.test.js` — verified test infrastructure (Node.js built-in test runner, `node:test` module)
- `.planning/phases/03-timer-und-leaderboard/03-CONTEXT.md` — locked user decisions

### Secondary (MEDIUM confidence)
- Socket.IO 4.x documentation behavior: `io.on('connection')` fires for every new socket — confirmed by project's existing `server.js` pattern at line 21

### Tertiary (LOW confidence)
- None — all claims in this research are backed by direct code inspection or official-behavior Socket.IO patterns already in use by the project.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — No new packages. All capabilities verified in existing installed dependencies.
- Architecture patterns: HIGH — All integration points verified against current source files with exact line numbers.
- Pitfalls: HIGH — Derived from direct code analysis of existing patterns, not hypothesis.

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable — no external dependencies changing)
