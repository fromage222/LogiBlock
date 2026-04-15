---
phase: 15-reconnect-after-disconnect
plan: 01
subsystem: api
tags: [socket.io, reconnect, disconnect, timer, game-state]

# Dependency graph
requires:
  - phase: 09-random-mode
    provides: advanceTurn used in skip logic
  - phase: 14-random-mode-overhaul
    provides: game.js/socket.js baseline for modification
provides:
  - reservePlayerSlot: marks player disconnected, starts 30s expiry timer
  - reconnectPlayer: re-associates new socket ID, clears timer, updates hostId
  - advanceTurn skip logic: skips disconnected slots with cycle guard
  - getPublicState disconnected flag: client can render disconnected badge
  - socket.js game-phase hold: disconnecting handler branches on phase
  - reconnectRoom socket event: re-associates socket ID on reconnect
affects:
  - 15-02: client reconnect UI (reads game:playerDisconnected, game:playerReconnected, game:stateUpdate)
  - 15-03: integration tests for full reconnect round-trip

# Tech tracking
tech-stack:
  added: []
  patterns:
    - reservePlayerSlot/reconnectPlayer: stateful slot reservation via setTimeout + player.disconnected flag
    - disconnecting handler phase-branching: game-phase hold vs. lobby-phase evict
    - timer stored on player object: disconnectTimer cleared on reconnect or expiry

key-files:
  created: []
  modified:
    - server/src/game.js
    - server/src/socket.js

key-decisions:
  - "advanceTurn uses a for-loop with cycle guard (max iterations = player count) to skip disconnected slots without infinite loop"
  - "reservePlayerSlot stores timer on player.disconnectTimer field — single source of truth, cleared on reconnect"
  - "reconnectPlayer updates lobby.hostId when reconnecting player is host (Pitfall 1 prevention)"
  - "disconnecting handler returns early after reservePlayerSlot in game phase — lobby-phase path unchanged"
  - "reconnectRoom handler emits room:error with result.error (not hardcoded string) for accurate Session expired vs. Room not found messages"

patterns-established:
  - "Phase branching in disconnecting handler: wasInGame gate at top, return early — lobby path falls through unchanged"
  - "onExpiry callback pattern: timer callback in game.js calls back into socket.js via closure for broadcast — avoids circular dependency"

requirements-completed: [RECON-01, RECON-02]

# Metrics
duration: 2min
completed: 2026-04-09
---

# Phase 15 Plan 01: Reconnect After Disconnect (Server Infrastructure) Summary

**30-second player slot reservation with advanceTurn skip logic, reservePlayerSlot/reconnectPlayer exports, and game-phase hold in the disconnecting handler**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-09T09:30:27Z
- **Completed:** 2026-04-09T09:32:43Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Modified advanceTurn to skip disconnected slots using a loop with cycle guard — prevents infinite loop if all players disconnect
- Added reservePlayerSlot and reconnectPlayer to game.js with correct hostId update (Pitfall 1), timer management, and host promotion on 30s expiry
- Rewrote disconnecting handler to branch on game phase: game phase holds slot 30s via reservePlayerSlot; lobby phase evicts immediately (unchanged behavior)
- Added reconnectRoom socket event handler that re-associates socket ID, joins room, broadcasts game:stateUpdate, emits game:playerReconnected
- getPublicState now includes disconnected flag on all player objects for client badge rendering
- All 111 existing tests pass (85 game + 26 socket) with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Add reconnect functions to game.js + modify advanceTurn + update getPublicState** - `0e2c219` (feat)
2. **Task 2: Modify socket.js disconnecting handler and add reconnectRoom event** - `3ba224d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `server/src/game.js` - advanceTurn skip logic; reservePlayerSlot and reconnectPlayer functions; getPublicState disconnected flag; addPlayer/createLobby disconnected field initialization
- `server/src/socket.js` - game-phase/lobby-phase branch in disconnecting handler; new reconnectRoom event handler; reservePlayerSlot/reconnectPlayer imports

## Decisions Made
- advanceTurn uses a for-loop with cycle guard (max iterations = player count) to skip disconnected slots without infinite loop when all players disconnect
- reservePlayerSlot stores timer on `player.disconnectTimer` field — cleared on reconnect, avoids external Map tracking
- reconnectPlayer updates `lobby.hostId` when reconnecting player is host (Pitfall 1 prevention)
- disconnecting handler returns early after reservePlayerSlot in game phase — lobby-phase path falls through unchanged, preserving all existing behavior
- reconnectRoom handler emits `room:error` with `result.error` (dynamic) for accurate "Session expired" vs. "Room not found" messages

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all changes applied cleanly, all existing tests passed immediately.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Server reconnect infrastructure is complete and ready for Phase 15 Plan 02 (client-side reconnect UI):
- game:playerDisconnected event emitted when player disconnects during game
- game:playerReconnected event emitted when player successfully reconnects
- game:stateUpdate includes disconnected flag on player objects for badge rendering
- room:error "Session expired" emitted on failed reconnect — existing room:error handler in client handles this path
- reconnectRoom event handler accepts { roomCode, playerName } from client on socket reconnect

## Self-Check: PASSED

- server/src/game.js: FOUND
- server/src/socket.js: FOUND
- .planning/phases/15-reconnect-after-disconnect/15-01-SUMMARY.md: FOUND
- commit 0e2c219: FOUND
- commit 3ba224d: FOUND

---
*Phase: 15-reconnect-after-disconnect*
*Completed: 2026-04-09*
