---
phase: 15-reconnect-after-disconnect
plan: 01
subsystem: api
tags: [socket.io, game-state, disconnect-recovery, turn-management]

# Dependency graph
requires:
  - phase: 14-random-mode-overhaul
    provides: advanceTurn, getPublicState, game:stateUpdate broadcast pattern
provides:
  - disconnected flag on player objects (game.js)
  - advanceTurn cycle-guard that skips disconnected slots
  - getPublicState exposes disconnected field to clients
  - socket.js disconnecting handler marks player.disconnected=true and broadcasts game:stateUpdate
  - reconnectRoom clears disconnected flag before re-associating socket
  - all-disconnect lobby cleanup in hold-timer callback
affects: [15-reconnect-after-disconnect, client dimmed badge rendering]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synchronous player mutation before timer arm: mark player.disconnected=true in disconnecting handler before setTimeout to ensure state is consistent during hold window"
    - "Cycle-guard for-loop in advanceTurn: iterate max player-count times to skip disconnected slots without infinite loop when all players disconnect"
    - "=== true coercion guard in getPublicState: p.disconnected === true protects against undefined on pre-existing player objects"

key-files:
  created: []
  modified:
    - server/src/game.js
    - server/src/socket.js

key-decisions:
  - "advanceTurn uses for-loop with cycle guard (max iterations = player count) to skip disconnected slots without infinite loop when all players disconnect"
  - "Synchronous disconnect marking: player.disconnected=true set before setTimeout so hold window reflects accurate state immediately"
  - "advanceTurn remains pure — no deleteLobby call; all-disconnect cleanup delegated to socket.js hold-timer callback"
  - "=== true coercion in getPublicState guards against undefined on player objects created before Phase 15"

patterns-established:
  - "Player mutation via lobby.players.find() before broadcasting — consistent with existing socket.js patterns"
  - "game:stateUpdate broadcast on disconnect — same event as game:move broadcasts, no new event type needed"

requirements-completed: [RECON-01]

# Metrics
duration: 2min
completed: 2026-04-17
---

# Phase 15 Plan 01: Server-Side Disconnect Foundation Summary

**Player disconnect hold with turn-skipping: disconnected flag on player objects, advanceTurn cycle guard, getPublicState exposure, and immediate game:stateUpdate broadcast to other players**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-17T12:13:36Z
- **Completed:** 2026-04-17T12:15:20Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `createLobby` and `addPlayer` now initialize `disconnected: false` on each player object
- `advanceTurn` replaced with a cycle-guarded for-loop that skips disconnected slots, terminating safely when all players are disconnected
- `getPublicState` exposes `disconnected: p.disconnected === true` on every player entry so clients receive the flag
- `disconnecting` handler in socket.js marks `player.disconnected = true` + `disconnectedAt` synchronously before the hold timer, advances the turn if the active player disconnects, and broadcasts `game:stateUpdate` so other players immediately see the dimmed badge
- `reconnectRoom` clears `existingPlayer.disconnected = false` and deletes `disconnectedAt` before re-associating the socket
- Hold-timer callback deletes the lobby when every remaining player has `disconnected === true` (all-disconnect cleanup)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add disconnected flag, advanceTurn skip logic, getPublicState exposure in game.js** - `cef16e8` (feat)
2. **Task 2: Set/clear disconnected flag in socket.js; broadcast game:stateUpdate on disconnect; delete lobby when all disconnected** - `e74bd6d` (feat)

## Files Created/Modified
- `server/src/game.js` - disconnected: false in createLobby/addPlayer; advanceTurn cycle-guard; getPublicState exposes disconnected field
- `server/src/socket.js` - disconnecting handler sets flag and broadcasts; reconnectRoom clears flag; all-disconnect lobby cleanup

## Decisions Made
- `advanceTurn` stays pure (no `deleteLobby` call) — all-disconnect cleanup belongs in the socket.js hold-timer callback where IO is available
- Cycle guard uses `len` iterations (not `len - 1`) to handle the edge case where the current slot is the only non-disconnected player before the call
- `=== true` coercion in `getPublicState` guards against `undefined` on legacy player objects

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server-side disconnect foundation is complete
- Plan 15-02 can implement the client-side `reconnectRoom` emit guard and dimmed badge rendering
- Plan 15-03 can add integration tests for the full reconnect flow

## Self-Check: PASSED

- FOUND: server/src/game.js
- FOUND: server/src/socket.js
- FOUND: .planning/phases/15-reconnect-after-disconnect/15-01-SUMMARY.md
- FOUND commit: cef16e8 (feat(15-01): game.js changes)
- FOUND commit: e74bd6d (feat(15-01): socket.js changes)

---
*Phase: 15-reconnect-after-disconnect*
*Completed: 2026-04-17*
