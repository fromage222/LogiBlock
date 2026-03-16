---
phase: 03-timer-und-leaderboard
plan: 01
subsystem: api
tags: [socket.io, timer, leaderboard, game-state, node-test]

# Dependency graph
requires:
  - phase: 02-game-loop
    provides: placePiece, checkWin, advanceTurn, game:win event, socket handler infrastructure
provides:
  - lobby.startTime set by startGame() — authoritative timer anchor
  - startTime field in game:start payload — client anchors setInterval from this
  - elapsedMs in game:win payload — authoritative server-computed elapsed time
  - recordLeaderboardEntry() — stores sorted in-memory leaderboard entries
  - getLeaderboard() — returns ranked entries with pre-formatted MM:SS time strings
  - leaderboard:update broadcast to ALL sockets after each win
  - leaderboard:update emitted to each new socket on connection
affects: [03-02-client, future-leaderboard-persistence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spread getPublicState() then add extra fields — avoids modifying getPublicState() itself"
    - "Module-level leaderboard array — TIME-05: session-scoped, cleared on server restart"
    - "io.emit() (not io.to(room).emit()) for global leaderboard broadcasts"
    - "formatTime(elapsedMs) → MM:SS string pre-formatted for client consumption"

key-files:
  created: []
  modified:
    - server/src/game.js
    - server/src/socket.js
    - server/src/server.js
    - server/src/game.test.js
    - server/src/socket.test.js

key-decisions:
  - "startTime stored on lobby object (not returned in result) — socket.js reads it via getLobby() after startGame() returns"
  - "getPublicState() NOT modified — startTime and elapsedMs spread alongside it as extra fields"
  - "io.emit() used for leaderboard:update (all sockets) — TIME-04 spec explicitly requires global broadcast"
  - "playerNames stored as string array only in leaderboard — raw player objects never stored (GAME-06-adjacent pitfall)"
  - "elapsedMs raw value NOT exposed in getLeaderboard() response — only pre-formatted time string"

patterns-established:
  - "Payload enrichment pattern: { ...getPublicState(roomCode), extraField } — used for game:start and game:win"
  - "io.emit mock in socket.test.js captures global broadcasts for test assertions"

requirements-completed: [TIME-01, TIME-02, TIME-04, TIME-05]

# Metrics
duration: 8min
completed: 2026-03-10
---

# Phase 3 Plan 01: Timer und Leaderboard — Server-Side Summary

**Server-side timer anchor (startTime) and in-memory leaderboard: authoritative elapsed-time computation, sorted leaderboard with MM:SS formatting, global socket broadcasts on win and connection**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-10T00:00:00Z
- **Completed:** 2026-03-10
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `lobby.startTime = Date.now()` in `startGame()` — authoritative timer anchor for TIME-01
- Added module-level `leaderboard` array with `recordLeaderboardEntry()` and `getLeaderboard()` functions in game.js — TIME-04, TIME-05
- Enriched `game:start` payload to include `startTime` alongside existing `getPublicState()` fields — client can anchor `setInterval` from this
- Enriched `game:win` payload to include `elapsedMs` (server-computed authoritative elapsed time) — TIME-02, TIME-03
- Added `leaderboard:update` broadcast via `io.emit()` to ALL sockets after each win — TIME-04
- Added `leaderboard:update` emit to each new socket on connection in `server.js` — TIME-04
- Added 3 new leaderboard tests in `game.test.js` and `io.emit` mock in `socket.test.js`
- All 54 tests pass (40 in game.test.js, 14 in socket.test.js)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add startTime to game.js and leaderboard functions** - `28c985f` (feat)
2. **Task 2: Update socket.js and server.js — enrich payloads and emit on connection** - `e889b98` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `server/src/game.js` — Added `leaderboard` array, `formatTime()`, `recordLeaderboardEntry()`, `getLeaderboard()` functions; `lobby.startTime = Date.now()` in `startGame()`; updated LobbyState comment; exported new functions
- `server/src/socket.js` — Added `recordLeaderboardEntry`/`getLeaderboard` imports; enriched `game:start` payload with `startTime`; enriched `game:win` payload with `elapsedMs`; added `io.emit('leaderboard:update')` after each win
- `server/src/server.js` — Added `getLeaderboard` import; added `socket.emit('leaderboard:update', getLeaderboard())` before `registerSocketHandlers` in connection handler
- `server/src/game.test.js` — Added `leaderboard` describe block with 3 tests (startTime type check, name strings only, sorted ranking)
- `server/src/socket.test.js` — Added `io.emit` mock in `makeMocks()` to capture global leaderboard broadcasts

## Decisions Made

- `getPublicState()` was NOT modified — `startTime` and `elapsedMs` are spread alongside it. This preserves the GAME-06 invariant and keeps the serialization contract clean.
- `io.emit()` (global broadcast) used for `leaderboard:update` — spec explicitly requires all sockets receive it, not just the winning room.
- `getLeaderboard()` returns only pre-formatted `time` (MM:SS string), not raw `elapsedMs` — simplifies client consumption.
- `playerNames` in leaderboard entries stores only name strings, never raw player objects — avoids leaking socket IDs.

## Deviations from Plan

None — plan executed exactly as written. The implementation in game.js, socket.js, and server.js matched the plan's action blocks exactly. Test assertions were already updated per plan spec.

## Issues Encountered

None. All tests passed on first run. Server port 8000 was already in use (server running), which confirmed startup logic was correct.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Server-side timer and leaderboard contracts are fully established
- Plan 03-02 (client) can consume: `startTime` from `game:start`, `elapsedMs` from `game:win`, `leaderboard:update` event with ranked entries array
- Leaderboard entries format: `[{ rank, puzzleName, time, playerNames }]` — rank is 1-indexed, time is MM:SS string

---
*Phase: 03-timer-und-leaderboard*
*Completed: 2026-03-10*
