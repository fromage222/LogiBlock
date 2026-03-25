---
phase: 09-random-mode
plan: 01
subsystem: api
tags: [game-logic, random-mode, tdd, node-test]

# Dependency graph
requires:
  - phase: 08-erstes-richtiges-level-bauen
    provides: "puzzle_v11 with anchor pre-placement, game.js with placePiece/returnPiece/advanceTurn"
provides:
  - "setRandomMode(roomCode, enabled): sets lobby.randomModeEnabled flag, returns bool"
  - "triggerRandomEvent(lobby, _forceEventType): dispatches remove_piece/skip_turn/shuffle_order/rotate_piece events"
  - "createLobby now initializes randomModeEnabled: false"
  - "getPublicState now includes randomMode boolean field"
affects: [09-random-mode-plan-02, 09-random-mode-plan-03, socket.js]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional _forceEventType param for deterministic test overrides without stubbing Math.random"
    - "Weighted event picker with cumulative probability thresholds (pickRandomEvent)"
    - "Fisher-Yates in-place shuffle (shuffleArray)"

key-files:
  created: []
  modified:
    - server/src/game.js
    - server/src/game.test.js

key-decisions:
  - "triggerRandomEvent takes optional _forceEventType param for test overrides — avoids Math.random stubbing"
  - "rotate_piece is never skipped server-side — client handles no-piece-selected case"
  - "skip_turn guards players.length > 1 (not >= 2) to be explicit about 1-player edge case"
  - "remove_piece scans grid for movable===true cells only — anchor cells (movable: false) are immune"
  - "shuffle_order always fires (no skip condition) — Fisher-Yates on players array in-place"

patterns-established:
  - "Test-only optional params: _forceEventType convention for deterministic testing"
  - "German chaos strings: Chaos! {subject} {action}! format"

requirements-completed: []

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 9 Plan 01: Random Mode Server Logic Summary

**setRandomMode and triggerRandomEvent added to game.js with TDD — 4 event types (remove_piece, skip_turn, shuffle_order, rotate_piece), 3 edge-case null-returns, and full test coverage via _forceEventType override param**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T20:48:58Z
- **Completed:** 2026-03-24T20:51:50Z
- **Tasks:** 2 (RED + GREEN)
- **Files modified:** 2

## Accomplishments
- Extended `createLobby()` to initialize `randomModeEnabled: false` on every new lobby
- Extended `getPublicState()` return block with `randomMode: lobby.randomModeEnabled ?? false`
- Implemented `setRandomMode(roomCode, enabled)` — finds lobby, sets flag, returns bool
- Implemented `triggerRandomEvent(lobby, _forceEventType)` with weighted random picker and all 4 event dispatchers
- 12 new tests all pass (GREEN); 10 pre-existing unrelated failures unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for setRandomMode, triggerRandomEvent, and getPublicState.randomMode** - `1b0cc00` (test)
2. **Task 2: Implement setRandomMode and triggerRandomEvent in game.js** - `b316c8c` (feat)

_Note: TDD tasks — test commit (RED) followed by implementation commit (GREEN)_

## Files Created/Modified
- `server/src/game.js` - Added `randomModeEnabled: false` to createLobby, `randomMode` to getPublicState, `setRandomMode`, `pickRandomEvent`, `shuffleArray`, `triggerRandomEvent` functions; exports updated
- `server/src/game.test.js` - Added 12 new tests across 7 describe blocks covering all behaviors and edge cases

## Decisions Made
- Used optional `_forceEventType` param on `triggerRandomEvent(lobby, _forceEventType)` for deterministic test control without Math.random stubbing — only used in tests; production always calls with one arg
- `rotate_piece` never returns null server-side — the server cannot know if client has a piece selected; client handles that edge case silently
- `skip_turn` guards `players.length <= 1` (returns null for single player)
- `remove_piece` returns null if no movable pieces on grid (only movable===true cells count)
- `shuffle_order` always fires — no skip condition, Fisher-Yates is always valid

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

10 pre-existing `placePiece`/`returnPiece`/`bankShapes` test failures exist in the repo before this plan. These were confirmed pre-existing via `git stash` and are out of scope. Logged for reference — not caused by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `setRandomMode` and `triggerRandomEvent` are exported and ready for socket.js integration (Plan 03)
- All Random Mode server logic for Plan 01 is complete and tested
- Plan 02 (client toggle UI) and Plan 03 (socket.js wiring) can now proceed independently

## Self-Check: PASSED

- server/src/game.js: FOUND
- server/src/game.test.js: FOUND
- .planning/phases/09-random-mode/09-01-SUMMARY.md: FOUND
- Commit 1b0cc00 (test RED): FOUND
- Commit b316c8c (feat GREEN): FOUND
- Commit 88f7f94 (docs metadata): FOUND

---
*Phase: 09-random-mode*
*Completed: 2026-03-24*
