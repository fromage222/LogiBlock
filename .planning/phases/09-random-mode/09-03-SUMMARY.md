---
phase: 09-random-mode
plan: "03"
subsystem: api
tags: [socket.io, random-mode, tdd, node-test, game-events]

# Dependency graph
requires:
  - phase: 09-random-mode
    plan: "01"
    provides: "setRandomMode and triggerRandomEvent exported from game.js"
provides:
  - "lobby:randomMode socket handler: host guard, setRandomMode call, lobby:update broadcast"
  - "game:move place non-winning branch: 30% randomMode:event emission before game:stateUpdate"
  - "Integration tests covering host guard, state broadcast, event trigger/no-trigger scenarios"
affects:
  - "09-04-PLAN.md (client-side randomMode:event handling)"
  - "socket.js consumers"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED-GREEN: failing tests committed first, then implementation brings all new tests to green"
    - "Math.random stubbing with afterEach restore for deterministic probability tests"
    - "puzzle_01 (no difficulty field) used in socket tests to avoid conflict with default lobby puzzle"

key-files:
  created: []
  modified:
    - "server/src/socket.js"
    - "server/src/socket.test.js"

key-decisions:
  - "makeRandomModeLobby helper uses puzzle_01 (A/B/C shapes) because default lobby puzzle is level_01 (P01-P10 shapes) — test isolation without changing lobby creation logic"
  - "randomMode:event emitted BEFORE game:stateUpdate in else branch — ordering invariant ensures clients receive event description before grid state changes"
  - "30% Math.random check lives in socket.js (not game.js) — socket layer owns the probability gate, game.js owns the event execution"

patterns-established:
  - "Socket handler pattern: guard roomCode, guard lobby existence, guard host, guard phase, mutate, broadcast"
  - "Event ordering: chaos event before state update — established in socket.js else branch"

requirements-completed: []

# Metrics
duration: 15min
completed: 2026-03-24
---

# Phase 09 Plan 03: Socket Layer — lobby:randomMode Handler and game:move Event Trigger Summary

**lobby:randomMode handler and 30%-probability randomMode:event trigger wired into socket.js with TDD integration tests covering host guard, state broadcast, and event trigger/no-trigger scenarios**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-24T20:58:30Z
- **Completed:** 2026-03-24T21:13:30Z
- **Tasks:** 2 (TDD: RED commit + GREEN commit)
- **Files modified:** 2

## Accomplishments

- Added `setRandomMode` and `triggerRandomEvent` imports to socket.js
- Implemented `lobby:randomMode` handler: host guard, phase guard, calls `setRandomMode`, broadcasts `lobby:update`
- Extended `game:move` place non-winning branch: 30% probability randomMode:event emitted before game:stateUpdate when `randomModeEnabled` is true
- All 6 new integration tests pass (GREEN): host guard, non-host error, event on non-winning place, no event on win, no event on return, no event when disabled

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing socket integration tests (RED)** - `706adaf` (test)
2. **Task 2: Implement handler and event trigger in socket.js (GREEN)** - `939bb6e` (feat)

_Note: TDD tasks have two commits (test RED → feat GREEN). GREEN commit also updates socket.test.js to fix test helper (makeRandomModeLobby)._

## Files Created/Modified

- `server/src/socket.js` - Added setRandomMode/triggerRandomEvent imports; lobby:randomMode handler; game:move randomMode:event trigger
- `server/src/socket.test.js` - Added 6 integration tests for lobby:randomMode and randomMode:event trigger; makeRandomModeLobby helper

## Decisions Made

- **Test puzzle isolation:** New randomMode tests use `makeRandomModeLobby` which forces `puzzle_01` (shapes A/B/C). The default lobby puzzle is `level_01` (shapes P01-P10), causing shape-not-found failures when using `shapeId: 'B'` via the standard `makePlayingLobby`. Using `setSelectedPuzzle` before `startGame` is the correct approach — no changes to production code required.
- **Ordering invariant preserved:** `randomMode:event` is emitted before `game:stateUpdate` inside the `else` branch — matching the CONTEXT.md locked decision from the research phase.
- **30% gate in socket.js:** The probability check (`Math.random() < 0.30`) lives in the socket layer. `triggerRandomEvent` in game.js is a pure side-effectful function that executes the chosen event. This keeps socket.js responsible for the timing/probability policy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test puzzle incompatibility in randomMode:event tests**
- **Found during:** Task 2 (GREEN phase verification)
- **Issue:** New tests used `makePlayingLobby` which selects `level_01` as the default puzzle. `level_01` has shapes `P01`-`P10`, not `A`/`B`/`C`. `placePiece(lobby, 'B', ...)` returned `{ ok: false, error: 'Invalid shape' }` causing tests to fail for the wrong reason (not because the handler was missing).
- **Fix:** Added `makeRandomModeLobby` helper that calls `setSelectedPuzzle(roomCode, 'puzzle_01')` before `startGame`. `puzzle_01` has shapes A (anchor), B (movable), C (movable) — matching the test scenario exactly.
- **Files modified:** server/src/socket.test.js
- **Verification:** All 6 new tests pass green after fix
- **Committed in:** `939bb6e` (Task 2 GREEN commit, bundled with implementation)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test bug: wrong puzzle for shape IDs)
**Impact on plan:** Fix was necessary for tests to exercise the correct code path. No production code affected. No scope creep.

## Issues Encountered

- Pre-existing socket test failures (5 tests, using `shapeId: 'B'` against `level_01` puzzle) were present before this plan and remain unchanged. These are out-of-scope for plan 09-03. Logged for awareness only.

## Next Phase Readiness

- Server is fully wired: `lobby:randomMode` handler live, `randomMode:event` emission on 30% non-winning place live
- Phase 09 is complete — all socket and client layers for Random Mode are implemented
- Random Mode feature is ready for end-to-end verification

---
*Phase: 09-random-mode*
*Completed: 2026-03-24*
