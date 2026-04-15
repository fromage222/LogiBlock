# Stack Research

**Project:** LogiBlock v1.2 — Spielqualität & Features
**Researched:** 2026-04-06
**Scope:** Additive research for 5 new features. Existing validated stack (Node.js + Express + Socket.IO 4.8.3 + Vanilla JS) is not re-evaluated.
**Confidence:** HIGH for Socket.IO reconnect (verified in installed source), MEDIUM for profanity package (npm registry not accessible; training data + API surface comparison)

---

## v1.2 Stack Decision: One New Dependency

**Recommendation: Add exactly one npm package — `leo-profanity` for profanity filtering. All other features (reconnect, random mode, leaderboard, controls modal) are implemented with zero new dependencies.**

---

## New Dependency: Profanity Filter

### Recommendation: `leo-profanity` over `bad-words`

| Package | Version | Weekly DL (approx) | Last Release | API | CJS support |
|---------|---------|-------------------|--------------|-----|-------------|
| `leo-profanity` | ~1.7.x | ~200K | Active (2023+) | `check(str)`, `clean(str)`, `add([words])` | Yes |
| `bad-words` | ~3.0.4 | ~800K | ~2019 (unmaintained) | `filter.isProfane(str)`, `filter.clean(str)` | Yes |

**Use `leo-profanity` because:**

1. **Active maintenance.** `bad-words` has not had a release since approximately 2019. Stale packages introduce risk over time (unpatched vulnerabilities, breaking Node versions). `leo-profanity` has recent releases and an open maintainer.
2. **Better API for word-list extension.** `leoProfanity.add(['wort1', 'wort2'])` lets us append German slurs at server startup — directly relevant since player names may be entered in German (the game UI is German). `bad-words` requires constructing a new `Filter` instance with options.
3. **Comparable bundle size.** Both are small (< 50KB installed). Neither adds measurable startup overhead.
4. **CommonJS.** The server uses CommonJS (`require()`). Both packages support `require()` directly. No ESM interop issues.

**Integration point — `server/src/socket.js`, inside `createRoom` and `joinRoom` handlers:**

```javascript
const leoProfanity = require('leo-profanity');

// At module top — add German profanity if needed
// leoProfanity.add(['word1', 'word2']);

// Inside createRoom / joinRoom, after trimming name:
if (leoProfanity.check(name)) {
  return socket.emit('room:error', 'Spielername enthält unerlaubte Wörter');
}
```

`leoProfanity.check(str)` returns `true` if the string contains any blocked word. Case-insensitive by default.

**Confidence: MEDIUM** — Package version and "active maintenance" claim based on training data; npm registry was not accessible to verify exact current version. Verify with `npm info leo-profanity version` before installing.

---

## Socket.IO Reconnect: Use Built-In `connectionStateRecovery`

**No new dependency needed.** Socket.IO 4.8.3 (already installed) has native connection state recovery. Verified directly in the installed source at `server/node_modules/socket.io/dist/`.

### How it works (verified in source)

When `connectionStateRecovery` is enabled on the server, Socket.IO:

1. Assigns each socket a `pid` (persistent ID, separate from `socket.id`) via `base64id`
2. On disconnect due to a **recoverable reason** — `transport error`, `transport close`, `forced close`, `ping timeout` — the adapter calls `persistSession()`, storing `{ sid, pid, rooms, data, disconnectedAt }`
3. On reconnect, the client sends its `pid` and last packet `offset` in `socket.auth`
4. Server calls `restoreSession(pid, offset)`, checks `disconnectedAt + maxDisconnectionDuration < now`
5. If valid: restores `socket.id` (same as before), `socket.data` (including `roomCode` and `playerName`), and re-joins rooms. Sets `socket.recovered = true`
6. If expired or unrecoverable: new `socket.id` is issued, `socket.recovered = false` → manual rejoin fallback required

**Critical insight for LogiBlock:** The LobbyManager stores players by `socketId`. On successful recovery, `socket.id` is the **same** as the disconnected socket — so `lobby.players[i].socketId` still matches. No LobbyManager changes needed for the happy path.

### Server configuration

```javascript
const io = new Server(httpServer, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 30 * 1000, // 30 seconds — matches RECON requirement
    skipMiddlewares: true,               // default: true
  }
});
```

### Handler changes required

The `disconnecting` handler currently calls `advanceTurnIfActive()` and `removePlayer()` immediately. This must be gated: **do not remove the player if recovery might still happen.**

```javascript
// In 'disconnecting' handler — check if reason is recoverable:
const RECOVERABLE = new Set(['transport error', 'transport close', 'forced close', 'ping timeout']);
const isRecoverable = RECOVERABLE.has(reason);

if (isRecoverable) {
  // Mark player as disconnected, reserve slot for 30s
  // Do NOT call removePlayer() yet
  // Start a 30s timer: if no reconnect, then removePlayer()
} else {
  // Immediate cleanup (same as current behavior)
  advanceTurnIfActive(lobby, socket.id);
  removePlayer(roomCode, socket.id);
  ...
}
```

In the `connection` handler, check `socket.recovered`:

```javascript
io.on('connection', (socket) => {
  if (socket.recovered) {
    // socket.data.roomCode and socket.data.playerName are restored
    // socket.id is the same as before — no LobbyManager update needed
    // Update socketId in lobby.players to confirm still connected
    socket.emit('reconnect:ok', getPublicState(socket.data.roomCode));
  } else {
    // Normal new connection — register handlers as now
    registerSocketHandlers(io, socket, puzzleMap);
  }
});
```

### Fallback: manual rejoin when recovery fails

When `socket.recovered === false` but the player was mid-game, the client must re-submit `{ roomCode, playerName }` to a new `rejoinRoom` event. Server finds the reserved slot by name, updates `socketId`, and restores state.

```javascript
socket.on('rejoinRoom', ({ roomCode, playerName }) => {
  const lobby = getLobby(roomCode);
  if (!lobby) return socket.emit('room:error', 'Room not found or expired');
  const player = lobby.players.find(p => p.name === playerName && p.disconnected);
  if (!player) return socket.emit('room:error', 'No reserved slot found');
  player.socketId = socket.id;
  player.disconnected = false;
  socket.data.roomCode = roomCode;
  socket.data.playerName = playerName;
  socket.join(roomCode);
  socket.emit('reconnect:ok', getPublicState(roomCode));
  io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode));
});
```

**Confidence: HIGH** — `connectionStateRecovery` behavior verified directly in installed Socket.IO 4.8.3 source (`dist/socket.js` lines 96–107, `dist/index.js` lines 106–111, `dist/socket.io-adapter/dist/in-memory-adapter.js`).

---

## Leaderboard Per-Puzzle Data Structure

**No new dependency needed.** Replace the existing flat `leaderboard[]` array with a `Map<puzzleId, entries[]>`.

### Current structure (v1.1)

```javascript
const leaderboard = []; // flat, global, sorted by elapsedMs
// Entry: { puzzleName, elapsedMs, playerNames }
```

`getLeaderboard()` returns all entries globally, broadcast to all sockets via `io.emit('leaderboard:update', ...)`.

### v1.2 structure: per-puzzle Map

```javascript
const leaderboardByPuzzle = new Map();
// Map<puzzleId, Array<{ rank, time, playerNames, elapsedMs }>>
// Each array is sorted ascending by elapsedMs, capped at N entries (e.g. top 10)
```

**`recordLeaderboardEntry()` change:**

```javascript
function recordLeaderboardEntry(lobby, elapsedMs) {
  const puzzleId = lobby.selectedPuzzleId;
  const puzzle = puzzleMap.get(puzzleId);
  if (!puzzleId) return;

  if (!leaderboardByPuzzle.has(puzzleId)) {
    leaderboardByPuzzle.set(puzzleId, []);
  }
  const entries = leaderboardByPuzzle.get(puzzleId);
  entries.push({
    puzzleName: puzzle ? puzzle.name : 'Unknown',
    elapsedMs,
    playerNames: lobby.players.map(p => p.name),
  });
  entries.sort((a, b) => a.elapsedMs - b.elapsedMs);
}
```

**`getLeaderboard()` change — emit per-puzzle structure:**

```javascript
function getLeaderboard() {
  const result = {};
  for (const [puzzleId, entries] of leaderboardByPuzzle) {
    result[puzzleId] = entries.slice(0, 10).map((e, i) => ({
      rank: i + 1,
      puzzleName: e.puzzleName,
      time: formatTime(e.elapsedMs),
      playerNames: e.playerNames,
    }));
  }
  return result;
}
```

**Client receives:** `{ [puzzleId]: [{rank, puzzleName, time, playerNames}] }` — the leaderboard screen renders the section for the just-played puzzle (from `selectedPuzzleId` in the game state) or shows tabs/sections per puzzle.

**Why `Map` over nested object:** In-memory, `Map` has faster keyed access. For serialization over Socket.IO (which calls `JSON.stringify`), we convert to a plain object at `getLeaderboard()` boundary — same as now. The Map stays private to `game.js`.

**Why cap at 10 entries per puzzle:** The UI is a leaderboard screen, not a scroll. 10 entries is the de-facto standard for in-game leaderboards. Cap prevents unbounded memory growth in long demo sessions.

**Backward compatibility note:** The `leaderboard:update` socket event payload shape changes from `Array` to `Object`. The client-side handler for this event (`socket.on('leaderboard:update', ...)`) must be updated to handle the new shape.

**Confidence: HIGH** — This is a pure data structure decision with no external dependencies. The existing `recordLeaderboardEntry` and `getLeaderboard` functions are fully under our control.

---

## Features Requiring Zero Stack Changes

### Random Mode Overhaul (RAND-*)
All new event types are server-side mutations of `lobby.players`, `lobby.grid`, and `lobby.activeTurnIndex` — the same objects the existing 4 event types already mutate. No new functions, no new events. Extend `pickRandomEvent()` weights and `triggerRandomEvent()` switch.

### Controls Explanation Modal (HLP-*)
Pure HTML/CSS/JS. An `<div id="controls-modal">` with `display: none` toggled to `display: flex` by a button `onclick`. No library, no build step, no Socket.IO event.

---

## Installation

```bash
# From server/ directory:
npm install leo-profanity
```

No other packages needed.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| `leo-profanity` | `bad-words` | Unmaintained since ~2019. Same API surface. No reason to prefer it over an active package. |
| `leo-profanity` | Custom wordlist (no package) | Would require curating and maintaining a German+English profanity list manually. The requirement (PROF-*) asks for a server-side filter — using an existing package is the correct level of effort for a Uni project. |
| `connectionStateRecovery` (built-in) | Custom token via `socket.auth` | Token approach requires: (a) generating UUID on first join, (b) persisting it client-side (`localStorage`), (c) verifying on reconnect in a middleware. That is ~60 lines of custom code vs. ~5 lines enabling built-in recovery. Built-in recovery also handles packet replay (client sees no missed events). Use built-in. |
| `connectionStateRecovery` (built-in) | Relying on `socket.id` directly | `socket.id` changes on every new connection. Browser refresh = new socket.id = lobby reference broken. `connectionStateRecovery` preserves the old socket.id on successful recovery. |
| `Map<puzzleId, entries[]>` leaderboard | Single global `Array` | Global array (v1.1) requires client-side filtering by puzzle to show per-puzzle rankings. Server-side Map is cleaner, more efficient, and the client receives only the data it needs. |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `uuid` npm package | Generating reconnect tokens if going custom-token route | Use built-in `connectionStateRecovery` — no token needed |
| `express-session` | Session middleware for reconnect | Socket.IO's built-in recovery covers the exact use case |
| `socket.io-redis` adapter | Persistent session storage | In-memory `SessionAwareAdapter` (built into socket.io-adapter) handles the 30s slot; persistence is Out of Scope per PROJECT.md |
| `helmet`, `express-rate-limit` | Security hardening | Out of Scope for Uni demo |
| Any CSS framework | Controls modal styling | The project is 361 lines of CSS that already has a design language; adding Bootstrap for a single modal introduces far more than it solves |
| `i18next` | German/English text management | All strings are hardcoded German in socket events and will stay that way for this Uni project |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `leo-profanity@~1.7` | Node.js 20 LTS | CommonJS module, no peer dependencies |
| `socket.io@4.8.3` | `socket.io-adapter@2.5.2` | `SessionAwareAdapter` ships inside `socket.io-adapter` — already present, no separate install |
| `connectionStateRecovery` option | `socket.io@4.4.0+` | Feature was introduced in 4.4.0; 4.8.3 is safe |

---

## Sources

- `server/node_modules/socket.io/dist/socket.js` lines 63–120 — `connectionStateRecovery` socket constructor, `socket.recovered`, `socket.data` restore, `RECOVERABLE_DISCONNECT_REASONS` set (HIGH confidence — direct source inspection)
- `server/node_modules/socket.io/dist/index.js` lines 106–111 — `maxDisconnectionDuration` default (2 min), `skipMiddlewares` default (true) (HIGH confidence — direct source inspection)
- `server/node_modules/socket.io-adapter/dist/in-memory-adapter.js` lines 297–391 — `SessionAwareAdapter`, `persistSession`, `restoreSession`, expiry logic (HIGH confidence — direct source inspection)
- `server/node_modules/socket.io/dist/index.d.ts` lines 43–61 — TypeScript type definitions for `connectionStateRecovery` option (HIGH confidence — direct source inspection)
- `server/src/socket.js` — existing `disconnecting` handler, `socket.data.roomCode` / `socket.data.playerName` usage (HIGH confidence — direct source inspection)
- `server/src/game.js` — existing `leaderboard[]` structure, `recordLeaderboardEntry()`, `getLeaderboard()` (HIGH confidence — direct source inspection)
- `leo-profanity` vs `bad-words` API comparison — training data, not npm-registry-verified (MEDIUM confidence — verify current version with `npm info leo-profanity` before install)

---

*Stack research for: LogiBlock v1.2 feature additions*
*Researched: 2026-04-06*
