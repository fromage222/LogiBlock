# Common Pitfalls

**Project:** LogiBlock — Cooperative Multiplayer Puzzle Game
**Researched:** 2026-03-01

---

## Critical Pitfalls

### 1. Async `socket.join()` — emitting before socket is in room

**What goes wrong:** Calling `socket.join(lobbyCode)` and immediately emitting to the room causes the joining socket to miss the emit — `socket.join()` is async in some Socket.IO configurations.

**Warning signs:** New player sees empty/stale grid on join, or doesn't receive initial state.

**Prevention:**
```javascript
// WRONG
socket.join(lobbyCode);
io.to(lobbyCode).emit('stateUpdate', state); // new player may miss this

// CORRECT
await socket.join(lobbyCode);
io.to(lobbyCode).emit('stateUpdate', getClientState(state));
// OR: emit initial state directly to the joining socket first
socket.emit('stateUpdate', getClientState(state));
```

**Phase:** Phase 1 (Lobby & Connection)

---

### 2. Turn order not validated server-side

**What goes wrong:** Trusting the client to only send moves on their turn. Any player can send a `makeMove` event out of turn and it will be processed.

**Warning signs:** Players can move out of turn, game state becomes inconsistent.

**Prevention:** First line of every move handler must check turn ownership:
```javascript
socket.on('makeMove', (data) => {
  const lobby = lobbies.get(data.lobbyCode);
  if (!lobby || lobby.activePlayerId !== socket.id) {
    socket.emit('moveError', { reason: 'Not your turn' });
    return;
  }
  // ... process move
});
```

**Phase:** Phase 2 (Turn & Move Logic)

---

### 3. Optimistic updates conflicting with server-authoritative model

**What goes wrong:** Updating the client grid immediately on click (before server confirmation) then reconciling — causes visual flicker, state divergence, and makes the "solution only on server" invariant harder to enforce.

**Warning signs:** Grid shows different states for different players momentarily.

**Prevention:** For this project — no optimistic updates. Lock the UI on move submission, wait for server `stateUpdate` ack before re-enabling. Acceptable latency for a turn-based game on LAN/localhost.

**Phase:** Phase 2 (Turn & Move Logic)

---

### 4. Player disconnect leaves turn frozen forever

**What goes wrong:** The active player disconnects. No disconnect handler advances the turn. Game is permanently stuck.

**Warning signs:** Game stops responding after any player closes their tab.

**Prevention:**
```javascript
socket.on('disconnect', () => {
  const lobby = findLobbyBySocket(socket.id);
  if (!lobby) return;
  removePlayerFromLobby(lobby, socket.id);
  if (lobby.activePlayerId === socket.id) {
    advanceTurn(lobby); // give turn to next player
  }
  io.to(lobby.code).emit('stateUpdate', getClientState(lobby));
  io.to(lobby.code).emit('playerLeft', { playerId: socket.id });
});
```

**Phase:** Phase 1 (Lobby & Connection)

---

### 5. Solution leaking in game state broadcast

**What goes wrong:** Broadcasting the full `gameState` object (including `solution`) to all clients. The solution is visible in browser DevTools network tab.

**Warning signs:** Any client can open DevTools → Network → WS and read the solution.

**Prevention:** Implement `getClientState()` on day 1 and use it for every single emit:
```javascript
function getClientState(gameState) {
  const { solution, ...clientSafe } = gameState;
  return clientSafe;
}
// INVARIANT: io.to(code).emit() ALWAYS uses getClientState()
// Never emit raw gameState
```

**Phase:** Phase 1 (architecture invariant, never break this)

---

### 6. Race condition: two players pass turn check before either writes

**What goes wrong:** Using `async/await` inside move handlers — two events arrive in the same event loop tick, both pass `activePlayerId === socket.id`, both process moves.

**Warning signs:** Duplicate moves, grid goes into invalid state.

**Prevention:** Keep all game state mutation synchronous. No `await` in the move handler critical path. Node.js is single-threaded — synchronous handlers are naturally atomic:
```javascript
// CORRECT — synchronous, no race
socket.on('makeMove', (data) => {
  if (lobby.activePlayerId !== socket.id) return;
  applyMove(lobby, data); // synchronous
  advanceTurn(lobby);     // synchronous
  io.to(lobby.code).emit('stateUpdate', getClientState(lobby));
});
```

**Phase:** Phase 2 (Turn & Move Logic)

---

## Moderate Pitfalls

### 7. Room code collision on generation

**What goes wrong:** `crypto.randomBytes(3).toString('hex')` has 16 million possibilities — collision is astronomically unlikely with 7 lobbies, but not impossible.

**Prevention:**
```javascript
function generateUniqueCode() {
  let code;
  do { code = crypto.randomBytes(3).toString('hex'); }
  while (lobbies.has(code));
  return code;
}
```

**Phase:** Phase 1

---

### 8. Vanilla JS duplicate event listeners on reconnect

**What goes wrong:** Socket reconnects, client re-registers all `socket.on()` listeners — now every event fires twice (or N times after N reconnects).

**Warning signs:** Moves applied multiple times, UI updates twice per event.

**Prevention:** Register all `socket.on()` handlers once at module load, not inside connect/reconnect callbacks. Use `socket.off()` before re-registering if dynamic registration is unavoidable.

**Phase:** Phase 3 (Client UI)

---

### 9. Puzzle JSON not validated at server startup

**What goes wrong:** A malformed puzzle JSON (overlapping anchors, grid size mismatch, solution doesn't fill the grid) causes runtime errors mid-game.

**Prevention:** Write a `validatePuzzle(puzzle)` function and call it at server startup for all puzzles in `/puzzles/`. Fail fast with a clear error message rather than crashing mid-game:
```javascript
// server startup
const puzzles = loadAllPuzzles('./puzzles/');
puzzles.forEach(p => {
  const errors = validatePuzzle(p);
  if (errors.length > 0) throw new Error(`Invalid puzzle ${p.id}: ${errors.join(', ')}`);
});
```

**Phase:** Phase 1 (Puzzle Loading)

---

### 10. No timeout on move acknowledgment — UI permanently locked

**What goes wrong:** Client disables UI after submitting a move, waits for server `stateUpdate` to re-enable. Server error or network hiccup — UI stays locked forever.

**Prevention:** Add a client-side timeout:
```javascript
let moveTimeout;
function submitMove(move) {
  setUILocked(true);
  socket.emit('makeMove', move);
  moveTimeout = setTimeout(() => setUILocked(false), 5000); // 5s safety net
}
socket.on('stateUpdate', (state) => {
  clearTimeout(moveTimeout);
  renderState(state);
  setUILocked(false);
});
```

**Phase:** Phase 3 (Client UI)

---

### 11. Rotation state omitted from move payload

**What goes wrong:** Client sends `{ shapeId, targetCell }` but not the current rotation. Server can't know how the piece is oriented.

**Prevention:** Always include rotation in move payload:
```javascript
socket.emit('makeMove', {
  lobbyCode,
  action: 'place',
  shapeId: selectedShape.id,
  targetCell: { row, col },
  rotation: selectedShape.currentRotation // 0, 90, 180, 270
});
```

**Phase:** Phase 2 (Move Logic)

---

## Minor Pitfalls

### 12. `socket.id` used as permanent player identifier

**What goes wrong:** `socket.id` changes on every reconnect. If a player's browser refreshes, they get a new identity — the server treats them as a new player.

**Prevention:** For this project scope (no accounts), accept this limitation. Document it clearly. On reconnect: player rejoins via room code and gets a new slot. Attempting to track reconnects without accounts adds significant complexity for marginal benefit.

**Phase:** Accepted limitation — document in README

---

### 13. Room not cleaned up after game ends or all players leave

**What goes wrong:** `lobbies` Map grows indefinitely. After 7+ games, stale lobby objects accumulate in memory.

**Prevention:**
```javascript
socket.on('disconnect', () => {
  const lobby = findLobbyBySocket(socket.id);
  if (!lobby) return;
  removePlayer(lobby, socket.id);
  if (lobby.players.length === 0) {
    lobbies.delete(lobby.code); // cleanup empty lobby
  }
});
```

**Phase:** Phase 1

---

### 14. Win condition using `JSON.stringify` comparison

**What goes wrong:** `JSON.stringify(currentGrid) === JSON.stringify(solution)` is fragile — key order must match, whitespace must match.

**Prevention:** Compare cell-by-cell or use a checksum:
```javascript
function isGridSolved(grid, solution) {
  return grid.every((row, r) =>
    row.every((cell, c) => cell.shapeId === solution[r][c].shapeId && cell.rotation === solution[r][c].rotation)
  );
}
```

**Phase:** Phase 2

---

## Pitfall Phase Map

| Pitfall | Severity | Phase |
|---------|----------|-------|
| Async join + emit race | Critical | Phase 1 |
| Disconnect freezes turn | Critical | Phase 1 |
| Solution leaking | Critical | Phase 1 |
| Room cleanup | Minor | Phase 1 |
| Puzzle JSON validation | Moderate | Phase 1 |
| Turn validation missing | Critical | Phase 2 |
| Optimistic update conflict | Critical | Phase 2 |
| Async race condition | Critical | Phase 2 |
| Rotation omitted from payload | Moderate | Phase 2 |
| Win condition comparison | Minor | Phase 2 |
| Room code collision | Moderate | Phase 1 |
| Duplicate event listeners | Moderate | Phase 3 |
| UI permanently locked | Moderate | Phase 3 |
| socket.id as permanent ID | Minor | Accepted limitation |
