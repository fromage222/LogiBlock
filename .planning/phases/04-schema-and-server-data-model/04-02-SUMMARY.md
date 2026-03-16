---
phase: 04-schema-and-server-data-model
plan: 02
subsystem: api
tags: [nodejs, game-logic, grid, sentinel, unit-tests]

# Dependency graph
requires:
  - phase: 04-schema-and-server-data-model
    provides: "puzzle_v11.json with inactiveCells field; validatePuzzleSchema() extended with inactiveCells validation"
provides:
  - "Sentinel-aware buildInitialGrid() that marks inactiveCells positions with { inactive: true }"
  - "Unit tests verifying sentinel placement, active-cell preservation, and backward compat"
  - "buildInitialGrid exported from game.js for direct testability"
affects:
  - 05-checkwin-sentinel
  - client-rendering

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-pass Array.from initialization with Set-based inactive-cell lookup"
    - "inactiveCells || [] default for backward-compatible puzzle field handling"
    - "{ inactive: true } sentinel reuses existing placePiece() !== null guard for free"

key-files:
  created: []
  modified:
    - server/src/game.js
    - server/src/game.test.js

key-decisions:
  - "Single Array.from pass replaces two-step fill(null) approach — cleaner and performant"
  - "inactiveSet uses string keys 'r-c' — avoids deep equality on coordinate arrays"
  - "checkWin() fix explicitly scoped to Phase 5 — documented with comment in game.js"

patterns-established:
  - "Set-based coordinate lookup: map([r,c]) => 'r-c' string key for O(1) membership tests"
  - "Phase 5 gap documented inline with // NOTE (Phase 5): comment above affected function"

requirements-completed: [GRID-02]

# Metrics
duration: 20min
completed: 2026-03-16
---

# Phase 4 Plan 02: Sentinel-Aware buildInitialGrid Summary

**Single-pass sentinel grid initialization using Set-based inactiveCells lookup, with 4 new unit tests and Phase 5 checkWin() gap documented inline**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-16T18:46Z
- **Completed:** 2026-03-16T19:51:06+01:00
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments

- Replaced `buildInitialGrid()` in `server/src/game.js` with a single-pass sentinel-aware implementation using `Array.from` and a `Set` of inactive coordinate keys
- Added 4 new unit tests in `server/src/game.test.js` covering sentinel placement, active-cell preservation, grid dimensions, and backward compatibility with anchor-only puzzles
- Exported `buildInitialGrid` and `getPuzzleById` from `game.js` for direct test imports
- Documented the known `checkWin()` gap (Phase 5 scope) with an inline comment above the updated function
- Human verifier confirmed server loads all 3 puzzles, all 52 tests pass, exit code 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace buildInitialGrid() with sentinel-aware single-pass implementation and add unit tests** - `1434558` (feat)
2. **Task 2: Human verification — approved** - (checkpoint, no code commit)

**Plan metadata:** *(pending — this summary commit)*

## Files Created/Modified

- `server/src/game.js` — `buildInitialGrid()` replaced: single `Array.from` pass initializes sentinels and nulls from inactiveSet; anchor placement loop unchanged; `buildInitialGrid` added to `module.exports`; Phase 5 `checkWin()` gap comment added
- `server/src/game.test.js` — `buildInitialGrid` and `getPuzzleById` added to require destructure; new `describe('buildInitialGrid — irregular grid with inactiveCells')` block with 4 tests

## Decisions Made

- **Single-pass Array.from over two-step fill(null):** Cleaner, single allocation, no need to overwrite inactive positions after the fact.
- **Set key format `'r-c'` string:** Avoids deep equality on coordinate arrays; O(1) membership test at initialization.
- **`puzzle.inactiveCells || []`:** Explicit fallback — backward compatible with puzzle_01 and puzzle_02 which have no `inactiveCells` field.
- **checkWin() gap scoped to Phase 5:** The existing `cell !== null` guard in `placePiece()` already rejects sentinels for free; `checkWin()` currently treats `{ inactive: true }` as an unexpected piece but puzzle_v11 cannot be completed until Phase 5 fixes it. This is intentional and documented inline.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The plan's RED→GREEN TDD cycle worked as specified. The existing `module.exports` block in `game.js` required adding `buildInitialGrid` and `getPuzzleById` — anticipated in the plan's action steps.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 4 server-side data model changes are complete: puzzle_v11.json authored, `validatePuzzleSchema()` extended, `buildInitialGrid()` updated with sentinel support.
- Phase 5 (`checkWin()` sentinel skip) can proceed: the only remaining gap is the `!cell.inactive` guard in `checkWin()`.
- Existing puzzles (puzzle_01, puzzle_02) are fully unaffected — all 48 prior tests continue to pass.

---
*Phase: 04-schema-and-server-data-model*
*Completed: 2026-03-16*
