---
phase: 08-erstes-richtiges-level-bauen
plan: "01"
subsystem: puzzle

tags: [level-design, puzzle, json, game-server, filtering]

# Dependency graph
requires:
  - phase: 04-schema-and-server-data-model
    provides: validatePuzzleSchema, inactiveCells support, puzzle loading infrastructure
  - phase: 06-client-grid-rendering
    provides: grid rendering with inactive cells and anchor placement via buildInitialGrid
provides:
  - "puzzles/level_01.json: complete Level 1 puzzle (3 anchors, 7 movables, 43 cells, difficulty easy)"
  - "getPuzzleListForClient() filters to only real levels (difficulty != null)"
  - "createLobby() defaults to first puzzle with difficulty field"
  - "getPublicState() exposes selectedPuzzleDifficulty to client"
  - "validatePuzzleSchema() type-checks optional difficulty field"
affects:
  - client lobby UI (receives difficulty in puzzle list and public state)
  - future puzzle levels (difficulty field enables lobby filtering)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Puzzle filtering by difficulty field: puzzles without difficulty are treated as internal test puzzles excluded from client"
    - "Default lobby puzzle selection: find first puzzle with difficulty != null instead of first map entry"
    - "Optional schema fields: difficulty validated as string if present, backward-compatible"

key-files:
  created:
    - puzzles/level_01.json
    - .planning/phases/08-erstes-richtiges-level-bauen-design-und-implementierung-eines-finalen-puzzle-levels-als-echtes-spielerlebnis/08-01-SUMMARY.md
  modified:
    - server/src/game.js

key-decisions:
  - "difficulty field as the filter criterion: puzzles without difficulty are internal test puzzles, not shown to players"
  - "createLobby defaults via find(p => p.difficulty != null) with fallback to first map entry for safety"
  - "selectedPuzzleDifficulty added to getPublicState for client lobby display"

patterns-established:
  - "Real levels must have difficulty field; test/development puzzles omit it to be excluded from client"

requirements-completed: [LVL-01, LVL-02, LVL-03]

# Metrics
duration: 2min
completed: 2026-03-24
---

# Phase 8 Plan 01: Level 1 Puzzle Creation and Server Filtering Summary

**Level 1 puzzle (43-cell, 5x9 grid, 3 anchors + 7 movables) created and server puzzle-selection infrastructure activated with difficulty-based filtering**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-24T08:50:03Z
- **Completed:** 2026-03-24T08:51:38Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created puzzles/level_01.json: complete Level 1 puzzle with difficulty "easy", 3 anchor pieces (P07, P08, P09) pre-placed, 7 movable pieces (P01-P06, P10) in bank, 43 shape cells = 43 active solution cells, inactiveCells [[4,0],[4,8]]
- Four surgical edits to server/src/game.js: createLobby defaults to first difficulty-bearing puzzle, getPublicState exposes selectedPuzzleDifficulty, getPuzzleListForClient filters by difficulty and returns it, validatePuzzleSchema type-checks optional difficulty field
- Server verified: logs "[PuzzleLoader] Loaded "Level 1" (level_01.json)", no skip message; getPuzzleListForClient returns only level_01 (other 3 test puzzles lack difficulty field)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create puzzles/level_01.json** - `4037739` (feat)
2. **Task 2: Four surgical edits to server/src/game.js** - `5a3b0c9` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `puzzles/level_01.json` - Level 1 puzzle: 5x9 grid, 3 anchors (P07 at [2,3], P08 at [0,3], P09 at [2,4]), 7 movables (P01-P06, P10), difficulty "easy", 43-cell valid solution
- `server/src/game.js` - 4 targeted function edits: createLobby (difficulty-first selection), getPublicState (selectedPuzzleDifficulty), getPuzzleListForClient (filter + include difficulty), validatePuzzleSchema (difficulty type check)

## Decisions Made

- difficulty field is the discriminator: puzzles without it are treated as internal test/development puzzles and excluded from the client puzzle list — no separate flag needed
- createLobby uses find() with a ?? fallback to the original first-entry behavior — safe against an empty real-puzzle set
- selectedPuzzleDifficulty uses `puzzle.difficulty ?? null` (not just `puzzle.difficulty`) to correctly handle missing field as null rather than undefined in JSON serialization

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The `timeout` shell command was unavailable on macOS, so the server was started as a background process with a 3-second sleep instead. Server output confirmed correct behavior (port 8000 was already in use from a running instance, which is expected in development; puzzle loading preceded the listen error).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Level 1 is playable: server will pre-place anchors and put movable pieces in the bank when a game starts
- Lobby will default to Level 1 (the only puzzle with a difficulty field) and display "easy" difficulty to players
- Client puzzle dropdown will show only Level 1 (test puzzles filtered out)
- Ready for any client-side difficulty display polish if desired

---
*Phase: 08-erstes-richtiges-level-bauen*
*Completed: 2026-03-24*
