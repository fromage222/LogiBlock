---
phase: 01-foundation
plan: 02
subsystem: api
tags: [socket.io, nodejs, commonjs, realtime, lobby]

# Dependency graph
requires:
  - phase: 01-01
    provides: game.js with lobbies Map, createLobby, getLobby, deleteLobby, getPublicState, getPuzzleListForClient, buildInitialGrid, generateRoomCode

provides:
  - Full Socket.IO event handling for lobby lifecycle (createRoom, joinRoom, lobby:selectPuzzle, startGame, disconnecting)
  - game.js mutation helpers: addPlayer, removePlayer, setSelectedPuzzle, startGame, advanceTurnIfActive
  - Complete server-side lobby state machine from creation to game start
  - Disconnect handling for host-left, player-left, last-player-silent-destroy, GAME-09 turn stub

affects:
  - 01-03 (client plan — connects to these events for UI)
  - phase 2 (game mechanics — activeTurnIndex, advanceTurnIfActive stub ready)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "socket.data.roomCode as authoritative room reference per socket — set on createRoom/joinRoom"
    - "'disconnecting' event (not 'disconnect') for lobby cleanup — socket.rooms still populated"
    - "getPublicState() as the single serialization path — solution never in outbound payload"
    - "room:error as the single inline error event — no popup events"
    - "Host-only guards via lobby.hostId === socket.id comparison"

key-files:
  created:
    - server/src/socket.js
  modified:
    - server/src/game.js

key-decisions:
  - "'disconnecting' event over 'disconnect' for cleanup: socket.rooms still populated, allows reliable room identification without extra state lookup"
  - "Host disconnect in lobby phase destroys the room entirely and emits lobby:hostLeft — no host transfer in Phase 1"
  - "room:error as the single error event name for all inline failures — consistent client-side error handling"
  - "puzzleMap passed to registerSocketHandlers but not destructured in socket.js — game.js helpers are the single source of truth for puzzle data"
  - "lobbies import removed from socket.js — unused (socket.js interacts via helper functions only)"

patterns-established:
  - "Pattern: All socket events guard with early return if roomCode/lobby missing — no implicit state assumptions"
  - "Pattern: Name trimming and 20-char slice on both createRoom and joinRoom — consistent normalization"
  - "Pattern: advanceTurnIfActive called BEFORE removePlayer — turn index valid while player still in array"

requirements-completed: [LOBB-01, LOBB-02, LOBB-03, LOBB-04, LOBB-05, GAME-09, GAME-10]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 1 Plan 2: Socket.IO Lobby Event Handlers Summary

**Full Socket.IO lobby lifecycle in socket.js with game.js mutation helpers — room creation, join, puzzle select, game start, and disconnect with host/player/last-player handling**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-03T19:53:40Z
- **Completed:** 2026-03-03T19:55:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- All 4 client-to-server events handled: createRoom, joinRoom, lobby:selectPuzzle, startGame
- Disconnect lifecycle fully covered: GAME-10 silent destroy, host-left room destroy + notify, player-left notify + state update, GAME-09 turn advance stub
- game.js extended with 5 mutation helpers (addPlayer, removePlayer, setSelectedPuzzle, startGame, advanceTurnIfActive) all exported and verified
- Server starts cleanly with both puzzles loaded and socket handlers registered

## Socket Event Contract

| Client emits | Payload | Server responds |
|---|---|---|
| `createRoom` | `{ playerName }` | `room:created { roomCode }` (creator), `puzzle:list [{ id, name }]` (creator), `lobby:update state` (all) |
| `joinRoom` | `{ roomCode, playerName }` | `lobby:update state` (all) OR `room:error message` (caller) |
| `lobby:selectPuzzle` | `{ puzzleId }` | `lobby:update state` (all) OR `room:error message` (caller) |
| `startGame` | `{}` | `game:start state` (all) OR `room:error message` (caller) |
| _(disconnect)_ | — | `lobby:hostLeft { message }` (all) OR `lobby:playerLeft { playerName }` + `lobby:update`/`game:stateUpdate` (remaining) |

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend game.js with lobby mutation helpers** - `fde1954` (feat)
2. **Task 2: Implement socket.js — all lobby Socket.IO event handlers** - `b091052` (feat)

## Files Created/Modified

- `server/src/socket.js` — Full Socket.IO event handler module: createRoom, joinRoom, lobby:selectPuzzle, startGame, disconnecting
- `server/src/game.js` — Extended with addPlayer, removePlayer, setSelectedPuzzle, startGame, advanceTurnIfActive; module.exports updated

## Decisions Made

- Used `'disconnecting'` event (not `'disconnect'`) for lobby cleanup: socket.rooms is still populated at this point, making room identification reliable without extra state
- Host disconnect in lobby phase destroys the room entirely and emits `lobby:hostLeft` — no host transfer implemented in Phase 1
- `room:error` is the single error event name for all inline failures — consistent client-side error handling pattern
- Removed unused `lobbies` import from socket.js (Rule 1 auto-fix) — socket.js interacts with state exclusively via game.js helper functions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused `lobbies` import from socket.js**
- **Found during:** Task 2 (after writing socket.js)
- **Issue:** `lobbies` was imported but never read in socket.js — TypeScript/IDE flagged as unused declaration
- **Fix:** Removed `lobbies` from the destructured require('./game') import
- **Files modified:** server/src/socket.js
- **Verification:** IDE hint resolved; socket.js still passes all verification checks
- **Committed in:** b091052 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - unused import cleanup)
**Impact on plan:** Minor cleanup, no functional change. All plan requirements met exactly as specified.

## Issues Encountered

None — plan executed cleanly. `timeout` command not available in the zsh environment so server startup test used background process with sleep/kill instead; server output confirmed correct.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 03 (client) can now connect to these Socket.IO events: createRoom, joinRoom, lobby:selectPuzzle, startGame
- All event names and payload shapes are fixed and documented in the contract table above
- Server verified to start on port 3000 with 2 puzzles loaded
- Phase 2 game mechanics can use activeTurnIndex and advanceTurnIfActive (stub ready for real implementation)

---
*Phase: 01-foundation*
*Completed: 2026-03-03*

## Self-Check: PASSED

- FOUND: server/src/socket.js
- FOUND: server/src/game.js
- FOUND: .planning/phases/01-foundation/01-02-SUMMARY.md
- FOUND commit fde1954: feat(01-02): extend game.js with lobby mutation helpers
- FOUND commit b091052: feat(01-02): implement socket.js with all lobby Socket.IO event handlers
