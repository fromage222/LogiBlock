---
phase: 02-game-loop
plan: "01"
subsystem: game
tags: [node, commonjs, tdd, game-logic, rotation, win-detection]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: game.js with lobbies, getPublicState, buildInitialGrid, startGame, advanceTurnIfActive stub

provides:
  - rotateCells(cells, rotation) — 90°-CW rotation with normalization, exported
  - placePiece(lobby, shapeId, rotation, row, col) — server-validated piece placement with win detection
  - returnPiece(lobby, shapeId) — piece removal back to bank
  - checkWin(lobby, puzzle) — internal solution comparison (GAME-06 safe)
  - advanceTurn(lobby) — circular turn advancement
  - advanceTurnIfActive(lobby, socketId) — disconnect-aware index adjustment (replaces stub)
  - getPublicState() extended with activePlayerName, activeTurnIndex, bankShapes
  - game.test.js — 37-test TDD suite (node --test)

affects:
  - 02-03 (socket event wiring will call placePiece, returnPiece, advanceTurn)
  - 02-04 (client UI receives bankShapes, activePlayerName from getPublicState)

# Tech tracking
tech-stack:
  added: [node:test built-in test runner]
  patterns:
    - TDD RED-GREEN cycle with node --test
    - before() hook for loadPuzzles() test setup
    - checkWin internal only — solution never leaves server

key-files:
  created:
    - server/src/game.test.js
  modified:
    - server/src/game.js

key-decisions:
  - "rotateCells90CW normalizes immediately; rotateCells re-normalizes after 0-step path — correct and harmless"
  - "advanceTurnIfActive called BEFORE player removal so disconnectingIndex is still valid"
  - "checkWin exported for test access; called only internally in placePiece — solution never forwarded to client"
  - "loadPuzzles() called via before() hook in test file — not a module-level side effect"

patterns-established:
  - "TDD with node --test: before() loads external state (puzzles), each test gets fresh lobby via makeLobby()"
  - "Game mutation functions receive lobby object directly (not roomCode) to keep them pure-ish and testable"

requirements-completed: [PUZZ-03, GAME-03, GAME-04, GAME-05, GAME-06, WIN-01]

# Metrics
duration: 3min
completed: 2026-03-04
---

# Phase 2 Plan 01: Server Game Logic Summary

**TDD-verified server game engine: rotation math, place/return moves, win detection, disconnect-aware turn advancement, and getPublicState extension with bankShapes — all GAME-06 invariants maintained.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-04T14:43:03Z
- **Completed:** 2026-03-04T14:46:23Z
- **Tasks:** 2 (RED, GREEN) — REFACTOR skipped (code clean as written)
- **Files modified:** 2

## Accomplishments

- 37 tests written and passing for all six new/replaced functions
- rotateCells correctly applies 90° CW rotation with min-row/col normalization; 4× returns to original
- placePiece validates shape validity, occupancy, bounds, and calls checkWin; returns `{ ok, win }`
- returnPiece finds and nulls all movable cells for a given shapeId
- advanceTurnIfActive stub fully replaced: handles active-player disconnect, lower-index non-active disconnect, and no-op cases
- getPublicState extended: activePlayerName, activeTurnIndex, bankShapes — solution key never present

## Task Commits

TDD plan — 2 commits (no refactor needed):

1. **RED: failing tests** - `3526692` (test)
2. **GREEN: implementation + exports + test setup fix** - `a995bd2` (feat)

**Plan metadata:** (docs commit follows)

_Note: GREEN commit includes both game.js changes and the `before()` loadPuzzles() fix in game.test.js (Rule 3 deviation — see below)._

## Files Created/Modified

- `server/src/game.test.js` — 37 node:test tests across 7 describe blocks covering all new functions
- `server/src/game.js` — Added rotateCells, rotateCells90CW, checkWin, placePiece, returnPiece, advanceTurn; replaced advanceTurnIfActive stub; extended getPublicState; updated exports

## Decisions Made

- `advanceTurnIfActive` is called BEFORE `removePlayer` — this keeps `disconnectingIndex` valid during the index calculation
- `checkWin` is exported for test access but is only called internally from `placePiece` — solution object never reaches client
- `rotateCells` applies normalization after the rotation loop (0-step path skips `rotateCells90CW` but still normalizes via the trailing pass — correct behavior)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `before(() => loadPuzzles())` to test setup**
- **Found during:** GREEN phase (first test run)
- **Issue:** `makeLobby()` calls `createLobby()` which reads from `puzzleMap`, but `puzzleMap` is empty until `loadPuzzles()` is called. All 31 non-rotation tests failed with "startGame failed: Selected puzzle not found"
- **Fix:** Added `before()` hook at top of test file to call `loadPuzzles()` once before any test runs
- **Files modified:** server/src/game.test.js
- **Verification:** All 37 tests pass after fix
- **Committed in:** a995bd2 (GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking missing test setup)
**Impact on plan:** Necessary for test correctness. No scope creep.

## Issues Encountered

None beyond the test setup deviation documented above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All server game logic functions are implemented, tested, and exported
- `placePiece`, `returnPiece`, `advanceTurn`, `advanceTurnIfActive` are ready to be wired to socket events in Plan 02-03
- `getPublicState()` now emits `bankShapes` and `activePlayerName` — Plan 02-04 client can consume these immediately
- No blockers

---
*Phase: 02-game-loop*
*Completed: 2026-03-04*
