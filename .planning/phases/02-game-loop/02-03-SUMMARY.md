---
phase: 02-game-loop
plan: "03"
subsystem: game
tags: [node, commonjs, tdd, socket.io, game-logic, websocket]

# Dependency graph
requires:
  - phase: 02-game-loop
    plan: "01"
    provides: placePiece, returnPiece, advanceTurn, advanceTurnIfActive exported from game.js
  - phase: 01-foundation
    plan: "02"
    provides: registerSocketHandlers pattern, getLobby, getPublicState, socket.data.roomCode convention

provides:
  - game:move socket handler in socket.js (action 'place' and action 'return')
  - game:error point-to-point error routing (socket.emit, not broadcast)
  - game:win broadcast to all room members on solution completion
  - game:stateUpdate broadcast after valid place (with turn advance) and after return
  - socket.test.js — 14-test TDD suite (node --test) for game:move handler

affects:
  - 02-04 (client main.js listens for game:stateUpdate, game:win, emits game:move)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Mock-based Socket.IO unit tests: fake io/socket objects capture emits without socket.io-client
    - Active-player guard before any game mutation (lobby.players[activeTurnIndex].socketId === socket.id)
    - Phase guard (lobby.phase !== 'playing') returns early silently — no error emitted
    - Point-to-point errors via socket.emit('game:error') vs. broadcasts via io.to(room).emit()

key-files:
  created:
    - server/src/socket.test.js
  modified:
    - server/src/socket.js

key-decisions:
  - "Mock-based socket tests: makeMocks() fakes io and socket rather than spinning a real Socket.IO server — avoids socket.io-client dependency while fully exercising handler logic"
  - "Unknown action silently ignored — no game:error emitted for unrecognised action strings"
  - "Phase guard returns silently (no error) — consistent with lobby:selectPuzzle and other handlers"

patterns-established:
  - "socket.test.js pattern: registerSocketHandlers(io, socket, Map) then trigger(socket, 'event', payload) — portable across any new handler tests"

requirements-completed: [GAME-02, GAME-07, GAME-08]

# Metrics
duration: 4min
completed: 2026-03-04
---

# Phase 2 Plan 03: Socket game:move Handler Summary

**game:move Socket.IO handler wiring placePiece/returnPiece/advanceTurn into the real-time layer, with point-to-point game:error and broadcast game:win/game:stateUpdate — 14 TDD tests, all passing.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-04T14:54:01Z
- **Completed:** 2026-03-04T14:57:18Z
- **Tasks:** 1 (TDD: RED + GREEN — REFACTOR skipped, code clean as written)
- **Files modified:** 2

## Accomplishments

- game:move handler added to socket.js between startGame and disconnecting handlers
- placePiece, returnPiece, advanceTurn imported and wired; all existing handlers untouched
- 14 tests cover: non-active player rejection, phase guard, missing roomCode guard, cell occupied, out of bounds, valid place (stateUpdate + turn advance), winning place (game:win, no stateUpdate, no advanceTurn), valid return (stateUpdate, no turn advance), return of unplaced piece (game:error), unknown action (silent), and point-to-point vs. broadcast error routing
- Server boots cleanly; 37 game.test.js tests unaffected

## Task Commits

TDD plan — 2 commits (no refactor needed):

1. **RED: failing tests** - `f9e3cb5` (test)
2. **GREEN: game:move handler implementation** - `245d8f5` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `server/src/socket.js` — Added placePiece/returnPiece/advanceTurn imports; added game:move handler (44 lines)
- `server/src/socket.test.js` — 14 node:test unit tests using mock io/socket objects

## Decisions Made

- **Mock-based tests instead of socket.io-client integration tests:** socket.io-client is not installed and not needed — a `makeMocks()` helper creates fake `io.to().emit` and `socket.emit` capture objects. `registerSocketHandlers` registers handlers via `socket.on()`; `trigger()` invokes them directly. Covers all behaviour without network overhead.
- **Unknown action silently ignored:** No game:error for unrecognised action strings — consistent with phase guard and roomCode guard (both silent returns).

## Deviations from Plan

None — plan executed exactly as written. The game:move handler code was taken verbatim from the plan's `<action>` block; all test behaviours listed in `<behavior>` are covered by the 14-test suite.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- game:move handler is live and verified — Plan 02-04 (client main.js) can implement game:move emission and game:stateUpdate/game:win reception immediately
- Event contract (payload shapes, event names) matches Plan 04's interface spec exactly
- No blockers

---
*Phase: 02-game-loop*
*Completed: 2026-03-04*
