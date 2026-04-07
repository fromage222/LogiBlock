---
phase: 14-random-mode-overhaul
plan: 01
subsystem: api
tags: [random-mode, game-events, socket.io, tdd, node-test]

# Dependency graph
requires:
  - phase: 09-random-mode
    provides: triggerRandomEvent, pickRandomEvent, setRandomMode, randomModeEnabled, randomMode:event socket emission pattern
provides:
  - double_turn event: sets extraTurns=1, no-stack cap, returns {type, description}
  - reverse_order event: reverses lobby.players in-place, resets activeTurnIndex to 0
  - blind_bank event: returns {type, description} without mutating lobby
  - pickRandomEvent Phase 14 weight table (7 events, cumulative thresholds 10/25/45/60/75/90/100)
  - extraTurns state machine: createLobby init=0, startGame reset=0, getPublicState exposure
  - socket.js game:move extraTurns gate: decrement-instead-of-advanceTurn when lobby.extraTurns > 0
affects: [14-02-client-ui, socket.js game:move handler, getPublicState public API]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - extraTurns gate in socket.js place-branch (check before advanceTurn, no random event during extra turn)
    - _forceEventType optional param for deterministic test overrides (established in Phase 9, extended here)
    - TDD Wave 0: failing tests committed before source changes, then source updated to GREEN

key-files:
  created:
    - server/src/game.test.js (Phase 14 test blocks appended)
    - server/src/socket.test.js (Phase 14 test block appended)
  modified:
    - server/src/game.js
    - server/src/socket.js

key-decisions:
  - "Phase 14 pickRandomEvent uses 7-event cumulative threshold table: rotate_piece 10%, skip_turn 15%, remove_piece 20%, shuffle_order 15%, double_turn 15%, reverse_order 15%, blind_bank 10% — weights sum to 100%"
  - "double_turn no-stack cap: if lobby.extraTurns > 0 at trigger time, return null (no doubling a double)"
  - "extraTurns gate in socket.js place-branch: if > 0, decrement and skip advanceTurn+random-event; else normal flow"
  - "reverse_order uses Array.prototype.reverse() in-place (same reference) and resets activeTurnIndex to 0"
  - "blind_bank is server-side signal only — no lobby state mutation; client will implement the 5s blind UI in Phase 14-02"

patterns-established:
  - "extraTurns gate pattern: check lobby.extraTurns > 0 before advanceTurn, consume turn without random event"
  - "no-stack cap: guard at top of event branch returning null if already active"

requirements-completed: [RAND-01, RAND-02, RAND-03]

# Metrics
duration: 20min
completed: 2026-04-07
---

# Phase 14 Plan 01: Random Mode Overhaul (Server) Summary

**Three new chaos events (double_turn, reverse_order, blind_bank) with rebalanced 7-event weight table and extraTurns state machine gating the socket.js place-branch**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-07T21:03:16Z
- **Completed:** 2026-04-07T21:30:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Added three new Phase 14 random events to `triggerRandomEvent`: `double_turn` (sets extraTurns=1, no-stack cap), `reverse_order` (reverses lobby.players in-place, resets index), `blind_bank` (signal-only, no mutation)
- Replaced Phase 9 weight table with 7-event Phase 14 distribution (cumulative thresholds 0.10/0.25/0.45/0.60/0.75/0.90/1.00)
- Implemented full extraTurns state machine: init in createLobby, reset in startGame, exposed in getPublicState
- Applied extraTurns gate in socket.js game:move place-branch: when > 0 decrement and skip advanceTurn + random event trigger
- 111 tests all passing (Wave 0 TDD: RED commit then GREEN commit)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing Wave 0 tests** - `3e45076` (test)
2. **Task 2: Implement server-side events, weights, extraTurns** - `835cc3d` (feat)

## Files Created/Modified
- `server/src/game.js` - Added double_turn/reverse_order/blind_bank branches to triggerRandomEvent; Phase 14 pickRandomEvent weight table; extraTurns: 0 in createLobby; lobby.extraTurns = 0 in startGame; extraTurns field in getPublicState
- `server/src/socket.js` - extraTurns gate in game:move place-branch (else block)
- `server/src/game.test.js` - Wave 0 tests: all 7 new describe blocks covering new events, extraTurns init/reset/exposure, weight table
- `server/src/socket.test.js` - Wave 0 test: double_turn extra-turn gate integration test (2 cases)

## Decisions Made
- Phase 14 pickRandomEvent uses 7-event cumulative threshold table with weights summing to 100%
- double_turn no-stack cap: return null when extraTurns > 0 (prevents stacking two doubles)
- extraTurns gate lives in socket.js (not game.js) — socket layer owns turn-flow policy, game.js owns event execution (consistent with Phase 9 30% gate decision)
- reverse_order uses Array.prototype.reverse() in-place — same reference, activeTurnIndex reset to 0
- blind_bank is a pure signal event — no server state mutation; client renders the 5s blind effect in Phase 14-02

## Deviations from Plan

None - plan executed exactly as written. All Edits A-F applied as specified. game.js already had most changes pre-applied from a partial prior execution; only socket.js Edit F (extraTurns gate) required application in this session.

## Issues Encountered
- game.js already contained Edits A-E from a prior partial execution (extraTurns: 0 in createLobby, startGame reset, getPublicState exposure, pickRandomEvent table, triggerRandomEvent branches) — only socket.js Edit F was missing, which caused the single failing test. Applied Edit F to complete the GREEN phase.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Server fully implements Phase 14 random events and extraTurns state machine
- Client Phase 14-02 can wire: `randomMode:event` type `double_turn` shows "extra turn" badge, `reverse_order` shows notification, `blind_bank` triggers 5s bank-hide effect
- `getPublicState.extraTurns` field available for client to display active extra-turn indicator

---
*Phase: 14-random-mode-overhaul*
*Completed: 2026-04-07*
