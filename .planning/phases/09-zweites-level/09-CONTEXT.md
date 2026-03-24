# Phase 9: zweites level - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Design and ship Level 2 — the second real playable puzzle. Level 2 uses the same 5×9 grid with the same 3 anchor pieces (P07, P08, P09) as Level 1, but placed in different positions and rotated orientations, making it significantly harder. All server and client infrastructure from Phase 8 is already operational — Level 2 auto-appears in the lobby dropdown as soon as `level_02.json` is created with a `difficulty` field. This phase is a single-file delivery.

</domain>

<decisions>
## Implementation Decisions

### Level file
- File: `puzzles/level_02.json`
- `"id": "level_02"`, `"name": "Level 2"`, `"difficulty": "hard"`
- Displayed in lobby dropdown: `"Level 2 — Schwer"` (DIFFICULTY_LABELS already maps `"hard"` → `"Schwer"`)

### Grid shape
- Same 5×9 grid with `inactiveCells: [[4,0],[4,8]]` — no infrastructure changes

### Anchor pieces (movable: false)
Same 3 anchor pieces as Level 1, but at different positions and in rotated orientations.
The `cells` field in the JSON must reflect the final placed orientation (pre-rotated), not the base orientation:

- **P09** (base orientation, no rotation needed):
  `cells: [[0,0],[0,1],[1,1],[1,2]]`, `position: [0,4]`
  → occupies [0,4],[0,5],[1,5],[1,6]

- **P08** (rotated 90° CW from base `[[0,0],[1,0],[1,1],[1,2]]`):
  `cells: [[0,0],[0,1],[1,0],[2,0]]`, `position: [1,3]`
  → occupies [1,3],[1,4],[2,3],[3,3]

- **P07** (rotated 90° CW from base `[[0,0],[1,0],[1,1],[2,0],[2,1]]`):
  `cells: [[0,0],[0,1],[0,2],[1,0],[1,1]]`, `position: [2,4]`
  → occupies [2,4],[2,5],[2,6],[3,4],[3,5]

### Movable pieces
All 7 movable pieces (P01, P02, P03, P04, P05, P06, P10) keep their **original `cells` definition** from level_01.json — the bank shows them in their base orientation, players rotate during gameplay.

### Full solution grid (provided by user as screenshot)
```
Row 0: ["P01","P04","P04","P04","P09","P09","P03","P03","P03"]
Row 1: ["P01","P02","P04","P08","P08","P09","P09","P10","P03"]
Row 2: ["P01","P02","P02","P08","P07","P07","P07","P10","P03"]
Row 3: ["P06","P06","P02","P08","P07","P07","P05","P10","P10"]
Row 4: [null, "P06","P02","P05","P05","P05","P05","P10", null ]
```
43 active cells verified ✓ (3+5+5+4+5+3+5+4+4+5 = 43)

### Infrastructure changes
None — Phase 8 delivered all necessary infrastructure:
- `getPuzzleListForClient()` already filters by `difficulty != null`
- `DIFFICULTY_LABELS` already includes `"hard": "Schwer"`
- `createLobby()` already defaults to first puzzle with a difficulty field
- `buildInitialGrid()` already handles pre-rotated anchor cells + position
- `loadPuzzles()` auto-loads all `.json` files from `puzzles/` on server start

### Claude's Discretion
- Exact JSON whitespace formatting (align with level_01.json for consistency)

</decisions>

<specifics>
## Specific Ideas

- Full solution provided directly as screenshot — piece positions transcribed above
- P07 and P08 anchors are pre-rotated: their `cells` in the JSON already reflect the placed orientation (not the base shape). This is intentional — `buildInitialGrid()` uses cells+position directly
- Difficulty "hard": the center anchor cluster (P07/P08/P09 interlocked) constrains all 7 movable pieces more tightly than Level 1's 3 dispersed anchors

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- All Phase 8 infrastructure requires zero changes — this phase delivers one file
- `loadPuzzles()` (`server/src/game.js`) auto-loads from `puzzles/` on startup
- `validatePuzzleSchema()` already validates `difficulty` field + anchor cells+position consistency
- `buildInitialGrid()` places anchors using `cells` offsets relative to `position` — pre-rotated cells work correctly

### Established Patterns
- Puzzle JSON schema: `id`, `name`, `difficulty`, `gridSize`, `inactiveCells`, `shapes`, `solution`
- Anchor shape entry: `{ "id": "PXX", "cells": [...], "movable": false, "position": [row, col] }`
- Movable shape entry: `{ "id": "PXX", "cells": [...], "movable": true }`
- Solution array: 2D array with piece IDs; `null` at inactive cell positions

### Integration Points
- Drop `level_02.json` into `puzzles/` → server auto-loads on next start
- No server, socket, or client changes required

</code_context>

<deferred>
## Deferred Ideas

- Level 3 and beyond — future phases
- Progressive anchor count variation (e.g., fewer anchors for harder levels) — future design consideration
- Puzzle thumbnail/preview in lobby — already deferred from Phase 8

</deferred>

---

*Phase: 09-zweites-level*
*Context gathered: 2026-03-24*
