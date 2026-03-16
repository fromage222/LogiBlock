---
phase: 04-schema-and-server-data-model
plan: 01
subsystem: database
tags: [json, puzzle, schema, validation, tdd, node-test]

# Dependency graph
requires: []
provides:
  - puzzles/puzzle_v11.json: 5x9 irregular puzzle "Corner Cut" with 10 movable pieces covering 43 active cells
  - validatePuzzleSchema() extended with inactiveCells format validation and cell-count cross-check
  - Unit tests for both new validation rules (8 new tests, 62 total)
affects: [05-server-game-logic, 06-client-rendering, 07-ui-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "inactiveCells field is optional — both validation blocks guarded by `if (puzzle.inactiveCells !== undefined)` for backward compatibility"
    - "Cell-count cross-check nested inside inactiveCells guard — existing puzzles with null-padded solutions are unaffected"
    - "TDD: RED (failing tests) committed before GREEN (implementation)"

key-files:
  created:
    - puzzles/puzzle_v11.json
    - (test blocks added inline to game.test.js)
  modified:
    - server/src/game.js
    - server/src/game.test.js

key-decisions:
  - "inactiveCells format: [[4,7],[4,8]] — two [row,col] pairs marking bottom-right corner of 5x9 grid"
  - "Cell-count cross-check is conditional on inactiveCells presence — no behavioral change for puzzle_01.json and puzzle_02.json"
  - "Error messages use plain English: 'must be an array', '[row, col] number array', 'out of bounds', 'unsolvable'"
  - "P01-P07 are 4-cell I-tetrominoes (horizontal or vertical); P08-P10 are 5-cell pentominoes (L, S, P shapes)"
  - "Active cell count: 43 = 45 total (5x9) - 2 inactive cells"

patterns-established:
  - "Puzzle JSON schema: id, name, gridSize, inactiveCells (optional), shapes, solution"
  - "validatePuzzleSchema() is the single validation entry point for all puzzle JSON files"
  - "Cross-check guard pattern: wrap new validation inside presence check to preserve backward compatibility"

requirements-completed: [GRID-01, PIEC-01, PIEC-02]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 4 Plan 01: Schema and Server Data Model Summary

**5x9 irregular puzzle "Corner Cut" with 10 movable pieces and extended validatePuzzleSchema() validating inactiveCells format and cell-count solvability guarantee**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-16T18:42:27Z
- **Completed:** 2026-03-16T18:44:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Authored `puzzles/puzzle_v11.json` — 5x9 grid, 10 movable pieces (7 tetrominoes + 3 pentominoes), 43 active cells, solution verified solvable
- Extended `validatePuzzleSchema()` with Block 1 (inactiveCells format) and Block 2 (cell-count cross-check), both backward-compatible
- Added 8 new unit tests covering all inactiveCells validation paths; all 62 tests (54 existing + 8 new) pass
- Server loads all 3 puzzles at startup including "Corner Cut" without errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Author puzzle_v11.json with 10 pieces tiling a 5x9 grid (43 active cells)** - `01d65ac` (feat)
2. **Task 2: Extend validatePuzzleSchema() with inactiveCells validation and cell-count cross-check** - `cddf61e` (feat)

_Note: Task 2 followed TDD — tests written first (RED: 4 failures), then implementation (GREEN: all 62 pass)_

## Files Created/Modified
- `puzzles/puzzle_v11.json` - New 5x9 puzzle "Corner Cut", 10 movable pieces, inactiveCells [[4,7],[4,8]], verified 43-cell solution
- `server/src/game.js` - validatePuzzleSchema() extended with two conditional validation blocks (lines 266-288)
- `server/src/game.test.js` - validatePuzzleSchema imported; 2 new describe blocks (8 tests) added for inactiveCells and cross-check

## Decisions Made
- **Cross-check gated on inactiveCells presence:** Wrapping both new blocks inside `if (puzzle.inactiveCells !== undefined)` preserves exact behavior for puzzle_01.json and puzzle_02.json — no null-padded solution cross-check triggers unless the puzzle opts in via inactiveCells
- **Error messages:** Plain, descriptive strings matching test regex patterns exactly on first run — no regex adjustments needed
- **Piece composition:** P01–P07 are identical horizontal I-tetrominoes placed in rows 0–2 and one vertical piece (P03 at col 8); P08–P10 are pentominoes filling the irregular bottom-left area, verified placement-first against grid layout

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- None. Verification inline script used escaped `!==` which caused a node syntax error; rewrote as multi-line script. No impact on implementation.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `puzzle_v11.json` is fully loaded by the server and passes schema validation
- `validatePuzzleSchema()` now enforces solvability for any puzzle that declares inactiveCells
- Phase 5 (server game logic) can build game-start initialization and move validation against the stable 5x9 grid data model
- Phase 6 (client rendering) has a verified solution layout to drive grid rendering

## Self-Check: PASSED

- puzzles/puzzle_v11.json: FOUND
- server/src/game.js: FOUND
- server/src/game.test.js: FOUND
- .planning/phases/04-schema-and-server-data-model/04-01-SUMMARY.md: FOUND
- Commit 01d65ac: FOUND
- Commit cddf61e: FOUND

---
*Phase: 04-schema-and-server-data-model*
*Completed: 2026-03-16*
