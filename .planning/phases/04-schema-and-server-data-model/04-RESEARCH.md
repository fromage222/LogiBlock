# Phase 4: Schema and Server Data Model - Research

**Researched:** 2026-03-15
**Domain:** JSON puzzle schema extension + Node.js server data model (game.js)
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRID-01 | Player plays on a 5×9 grid with missing lower corners (43 active cells) — the new irregular grid replaces the old rectangular layout | `inactiveCells: [[3,7],[3,8],[4,7],[4,8]]` in puzzle JSON + `buildInitialGrid()` sentinel population |
| GRID-02 | Server loads `inactiveCells` from puzzle JSON and marks those cells with `{ inactive: true }` sentinel at game start | `buildInitialGrid()` must read `puzzle.inactiveCells` and write sentinel objects; existing `getPublicState()` passes grid through unchanged |
| PIEC-01 | Player can play the new 5×9 puzzle with 10 custom shapes — `puzzles/puzzle_v11.json` is loaded and validated at server start | New JSON file + `validatePuzzleSchema()` extended to accept `inactiveCells`; existing `cells: [[r,c]]` format already supports arbitrary shapes |
| PIEC-02 | Puzzle is mathematically solvable — validator checks that total movable piece cells equals exactly the number of active solution cells (43) | Add cell-count cross-check to `validatePuzzleSchema()` using `puzzle.solution.flat().filter(id => id !== null).length` |
</phase_requirements>

---

## Summary

Phase 4 is a pure server-side data-model phase. Its entire scope is two things: (1) author `puzzles/puzzle_v11.json` with the new irregular 5×9 grid and 10 custom piece shapes, and (2) extend `server/src/game.js` to load, validate, and represent that puzzle correctly. No client code changes, no socket event changes, no new dependencies.

The key architectural decision was made in prior research and is locked: inactive cells are represented as a sentinel object `{ inactive: true }` placed directly in the `lobby.grid` 2D array. This flows through `getPublicState()` to the client without any change to that function. The existing `placePiece()` guard `if (lobby.grid[r][c] !== null)` already rejects placement on sentinel cells for free — no change needed to that function in this phase. The `checkWin()` fix (adding `!cell.inactive` guard) is scoped to Phase 5, not Phase 4.

The critical constraint for this phase is backward compatibility: existing `puzzle_01.json` and `puzzle_02.json` must continue loading without errors, and all currently-passing tests must remain green. The `inactiveCells` field is optional in the schema — absent means all cells are active, preserving v1.0 behavior exactly.

**Primary recommendation:** Implement Plan 04-01 (schema + validation) before 04-02 (grid initialization) — the sentinel logic in `buildInitialGrid()` has no effect until a puzzle with `inactiveCells` exists to trigger it.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `fs` | 20 LTS | Read puzzle JSON files from disk | Already used in `loadPuzzles()` |
| Node.js built-in `path` | 20 LTS | Resolve `puzzles/` directory path | Already used via `path.join(__dirname, ../../puzzles)` |
| Node.js built-in `node:test` | 20 LTS | Test runner for new unit tests | Already used in `game.test.js` and `socket.test.js` |
| Node.js built-in `node:assert/strict` | 20 LTS | Assertions in tests | Already used across both test files |

### Supporting

No new dependencies. Zero npm installs needed for this phase.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `validatePuzzleSchema()` | `ajv`, `zod`, or `joi` | Project explicitly rejects npm schema validators (STACK.md: "over-engineering a uni project"). The existing custom validator is ~20 lines and is the only validation path. |
| `inactiveCells: [[r,c]]` array | `cellMask: bool[][]` 2D array | Prior research evaluated both. `inactiveCells` wins for the 5×9 case (4 inactive cells listed vs 43 active). `cellMask` is better for dense irregular shapes. Decision is locked to `inactiveCells`. |
| `{ inactive: true }` sentinel | `null` with separate `activeCells` Set | Separate state structure doubles complexity. Sentinel in the grid array is the single source of truth. Decision locked. |

**Installation:**
```bash
# No installation needed — zero new dependencies
```

---

## Architecture Patterns

### Recommended Project Structure

```
server/
├── src/
│   ├── game.js              # Extended: validatePuzzleSchema(), buildInitialGrid()
│   ├── game.test.js         # Extended: new tests for inactiveCells validation + sentinel
│   ├── socket.js            # UNCHANGED
│   └── server.js            # UNCHANGED
puzzles/
├── puzzle_01.json            # UNCHANGED — backward compat verified
├── puzzle_02.json            # UNCHANGED — backward compat verified
└── puzzle_v11.json           # NEW — 5×9, inactiveCells, 10 shapes, solution
```

### Pattern 1: Backward-Compatible Optional Field in Schema Validator

**What:** Add `inactiveCells` as an optional field to `validatePuzzleSchema()`. When absent, the validator passes unchanged. When present, it is validated as an array of `[row, col]` number pairs, each within `gridSize` bounds.

**When to use:** Any time a new puzzle field is added that should not break existing puzzle files.

**Example:**
```javascript
// In validatePuzzleSchema() — append after existing checks
if (puzzle.inactiveCells !== undefined) {
  if (!Array.isArray(puzzle.inactiveCells))
    throw new Error('"inactiveCells" must be an array');
  for (const entry of puzzle.inactiveCells) {
    if (!Array.isArray(entry) || entry.length !== 2 ||
        typeof entry[0] !== 'number' || typeof entry[1] !== 'number')
      throw new Error('Each "inactiveCells" entry must be [row, col] numbers');
    const [r, c] = entry;
    if (r < 0 || r >= puzzle.gridSize.rows || c < 0 || c >= puzzle.gridSize.cols)
      throw new Error(`inactiveCells entry [${r},${c}] is outside gridSize bounds`);
  }
}
```

### Pattern 2: Cell-Count Cross-Check in Validator

**What:** Count the total cells in all movable shapes and compare to the count of non-null cells in `puzzle.solution`. Throw if they differ.

**When to use:** PIEC-02 requirement. Catches typos in shape definitions at server startup before any player can start the puzzle.

**Example:**
```javascript
// Count movable shape cells
const movableCellCount = puzzle.shapes
  .filter(s => s.movable)
  .reduce((sum, s) => sum + s.cells.length, 0);

// Count active solution cells (non-null entries)
const activeCellCount = puzzle.solution.flat().filter(id => id !== null).length;

if (movableCellCount !== activeCellCount) {
  throw new Error(
    `Movable shapes cover ${movableCellCount} cells but solution has ${activeCellCount} active cells — puzzle is unsolvable`
  );
}
```

Note: This cross-check applies to all puzzles that go through `validatePuzzleSchema()`. For existing puzzles (`puzzle_01.json`, `puzzle_02.json`), the movable shape cells must already match the active solution cells. Verify before adding this check that the existing puzzles satisfy it.

### Pattern 3: Sentinel Initialization in `buildInitialGrid()`

**What:** Build a `Set<string>` from `puzzle.inactiveCells` (if present) and use it as a lookup during grid initialization. Inactive positions get `{ inactive: true }`; active positions get `null` as before.

**When to use:** Called once at game start via `startGame()`. Output flows unchanged through `getPublicState()` to all clients.

**Example:**
```javascript
function buildInitialGrid(puzzle) {
  // Build inactive position lookup
  const inactiveSet = new Set(
    (puzzle.inactiveCells || []).map(([r, c]) => `${r}-${c}`)
  );

  const grid = Array.from({ length: puzzle.gridSize.rows }, (_, r) =>
    Array.from({ length: puzzle.gridSize.cols }, (_, c) =>
      inactiveSet.has(`${r}-${c}`) ? { inactive: true } : null
    )
  );

  // Place anchor shapes (existing logic, unchanged)
  for (const shape of puzzle.shapes) {
    if (!shape.movable && Array.isArray(shape.position)) {
      const [originRow, originCol] = shape.position;
      for (const [dr, dc] of shape.cells) {
        const r = originRow + dr;
        const c = originCol + dc;
        if (r >= 0 && r < puzzle.gridSize.rows && c >= 0 && c < puzzle.gridSize.cols) {
          grid[r][c] = { shapeId: shape.id, movable: false };
        }
      }
    }
  }
  return grid;
}
```

Key detail: the `Array.from` initialization replaces the current two-step pattern (`Array.from(...).fill(null)` + loop to set anchors) while adding the inactive sentinel in one pass. The anchor placement loop below it remains unchanged.

### Pattern 4: `puzzle_v11.json` Structure

**What:** The new puzzle file follows the existing schema plus one new optional field.

**Example (structure — actual piece shapes must tile 43 cells exactly):**
```json
{
  "id": "puzzle_v11",
  "name": "Corner Cut",
  "gridSize": { "rows": 5, "cols": 9 },
  "inactiveCells": [[3,7],[3,8],[4,7],[4,8]],
  "shapes": [
    { "id": "P01", "cells": [[0,0],[0,1],[1,0],[1,1],[2,0]], "movable": true },
    { "id": "P02", "cells": [[0,0],[0,1],[0,2],[1,2],[2,2]], "movable": true },
    ...10 shapes total, movable: true, cells summing to 43...
  ],
  "solution": [
    ["P01","P01","P02","P02","P03","P03","P04","P04","P05"],
    ["P01","P06","P02","P07","P03","P08","P04","P09","P05"],
    ["P01","P06","P10","P07","P10","P08","P09","P09","P05"],
    ["P06","P06","P10","P07","P10","P08","P09",null,null],
    ["P07","P07","P10","P10","P08","P08","P05",null,null]
  ]
}
```

Design constraint: the four missing corners are positions `[3,7]`, `[3,8]`, `[4,7]`, `[4,8]`. These must be `null` in every row of the solution array. The 10 shapes together must cover exactly 43 cells. The puzzle must be actually solvable (manually verified before authoring the JSON).

### Anti-Patterns to Avoid

- **Adding `inactiveCells` as a required field:** Breaks existing `puzzle_01.json` and `puzzle_02.json` at startup. Must be optional.
- **Storing inactive cell info in a parallel structure alongside `lobby.grid`:** Creates two sources of truth. The sentinel in the grid array is the only representation.
- **Calling `puzzle.solution.flat()` without first verifying solution is a valid 2D array:** If the solution has rows with different lengths, `.flat()` still works but the count is misleading. The existing check should verify `puzzle.solution.length === puzzle.gridSize.rows` and each row's length.
- **Adding the cell-count cross-check without verifying existing puzzles satisfy it:** `puzzle_01.json` has movable shapes B (3 cells) + C (3 cells) = 6 movable cells; solution non-null entries should match. Verify before deploying the cross-check.
- **Anchoring the sentinel introduction and `checkWin()` fix in the same phase:** Phase 4 introduces the sentinel; Phase 5 fixes `checkWin()`. The existing tests do not use irregular grids, so `checkWin()` is not broken by Phase 4 alone — the 4 inactive cells will only appear in `puzzle_v11.json` which is not tested by existing tests.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Active cell counting | Custom iteration with nested loops | `puzzle.solution.flat().filter(id => id !== null).length` | Array `.flat()` is a built-in that handles the 2D-to-1D conversion in one call |
| Inactive cell lookup | Linear scan of `inactiveCells` array for every cell | `Set<string>` with `"r-c"` keys | O(1) lookup during grid initialization instead of O(n) per cell |
| JSON file parsing | Manual string parsing | `JSON.parse(fs.readFileSync(..., 'utf-8'))` | Already used in `loadPuzzles()`; JSON.parse throws naturally on malformed input |

**Key insight:** All necessary mechanisms already exist in `game.js`. This phase is additive, not structural.

---

## Common Pitfalls

### Pitfall 1: Cell-Count Cross-Check Breaks Existing Puzzles

**What goes wrong:** Adding `movableCellCount !== activeCellCount` validation to `validatePuzzleSchema()` could cause `puzzle_01.json` or `puzzle_02.json` to fail at server startup if their current counts do not match.

**Why it happens:** The validator is called for all puzzle files, including existing ones. If an existing puzzle has intentionally-empty null cells in the solution (cells not covered by any shape), the count will not match.

**How to avoid:** Before implementing the cross-check, manually verify existing puzzles:
- `puzzle_01.json`: B (3 cells) + C (3 cells) = 6 movable cells. Count non-null solution cells.
- `puzzle_02.json`: Y (3 cells) + Z (3 cells) = 6 movable cells. Count non-null solution cells.
- If existing puzzles have null cells in solution not covered by movable shapes, the cross-check needs a guard: only apply when `puzzle.inactiveCells` is defined, OR apply universally and fix the existing puzzles.

**Warning signs:** Server exits at startup with `"Movable shapes cover X cells but solution has Y active cells"` on the existing puzzle files.

### Pitfall 2: Sentinel Introduction Breaks `checkWin()` for the New Puzzle

**What goes wrong:** The sentinel `{ inactive: true }` in `grid[r][c]` causes the existing `checkWin()` branch `if (expectedId === null) { if (cell !== null) return false; }` to return `false` for inactive cells, making the puzzle unwinnable.

**Why it happens:** The sentinel is not `null`, so the win check treats it as an unexpected piece.

**How to avoid:** Phase 5 owns the `checkWin()` fix. Phase 4 only introduces the sentinel and the new puzzle file. Since no test currently exercises `checkWin()` against an irregular grid, this bug is dormant until Phase 5. However, document it clearly in plan 04-02 so Phase 5's planner knows to address it.

**Warning signs:** After Phase 5 work, a game on `puzzle_v11` never reaches the win state even when all 43 active cells are filled.

### Pitfall 3: `puzzle_v11.json` is Mathematically Unsolvable

**What goes wrong:** The 10 custom shapes do not tile the 5×9 grid (minus 4 corners) exactly. Either the total cell count is wrong (not 43), or the shapes cannot be arranged to fill the grid (e.g., due to parity constraints or shape geometry).

**Why it happens:** Puzzle design is a combinatorial problem. Not all sets of 10 shapes sum to 43 cells, and not all shape sets that sum to 43 can actually tile the specific irregular grid.

**How to avoid:** Design the puzzle solution first (draw it out), then derive the piece shapes from the solution. This guarantees solvability. The `validatePuzzleSchema()` cell-count check catches wrong totals but cannot verify actual tileability — that requires manual design verification.

**Warning signs:** The cell-count validator throws on `puzzle_v11.json` at startup (detects count mismatch immediately). Geometric unsolvability is only detectable by attempting to solve the puzzle manually.

### Pitfall 4: Backward Compatibility Regression

**What goes wrong:** Changes to `validatePuzzleSchema()` or `buildInitialGrid()` cause `puzzle_01.json` or `puzzle_02.json` to fail, which in turn causes existing tests (which call `loadPuzzles()` in `before()`) to error out, breaking all 54 currently-passing tests.

**Why it happens:** Both test files call `loadPuzzles()` in a `before()` hook. If any puzzle fails validation during `loadPuzzles()`, the module-level `puzzleMap` is empty (or `process.exit(1)` is called), and every test that creates a lobby and starts a game will fail.

**How to avoid:** Run `node --test` from `server/` after every change and before committing. Verify all 54 tests still pass.

**Warning signs:** Any test failure in `game.test.js` or `socket.test.js` after touching `validatePuzzleSchema()` or `buildInitialGrid()`.

---

## Code Examples

Verified patterns from direct source inspection of `server/src/game.js`:

### Current `validatePuzzleSchema()` (lines 245-266) — append new blocks after this

```javascript
function validatePuzzleSchema(puzzle) {
  if (!puzzle.id || typeof puzzle.id !== 'string')
    throw new Error('Missing or invalid "id"');
  if (!puzzle.name || typeof puzzle.name !== 'string')
    throw new Error('Missing or invalid "name"');
  if (!puzzle.gridSize || typeof puzzle.gridSize.rows !== 'number' || typeof puzzle.gridSize.cols !== 'number')
    throw new Error('Missing or invalid "gridSize" (needs rows and cols as numbers)');
  if (!Array.isArray(puzzle.shapes) || puzzle.shapes.length === 0)
    throw new Error('"shapes" must be a non-empty array');
  for (const shape of puzzle.shapes) {
    if (!shape.id || typeof shape.id !== 'string')
      throw new Error('Each shape must have a string "id"');
    if (!Array.isArray(shape.cells) || shape.cells.length === 0)
      throw new Error(`Shape "${shape.id}": "cells" must be a non-empty array`);
    if (typeof shape.movable !== 'boolean')
      throw new Error(`Shape "${shape.id}": "movable" must be a boolean`);
    if (!shape.movable && !Array.isArray(shape.position))
      throw new Error(`Anchor shape "${shape.id}": "position" array required when movable is false`);
  }
  if (!Array.isArray(puzzle.solution))
    throw new Error('Missing "solution" array');
  // NEW BLOCKS GO BELOW THIS LINE ↓
}
```

### Current `buildInitialGrid()` (lines 225-242) — replace with sentinel-aware version

```javascript
// Current implementation to be replaced:
function buildInitialGrid(puzzle) {
  const grid = Array.from({ length: puzzle.gridSize.rows }, () =>
    Array(puzzle.gridSize.cols).fill(null)
  );
  for (const shape of puzzle.shapes) {
    if (!shape.movable && Array.isArray(shape.position)) {
      const [originRow, originCol] = shape.position;
      for (const [dr, dc] of shape.cells) {
        const r = originRow + dr;
        const c = originCol + dc;
        if (r >= 0 && r < puzzle.gridSize.rows && c >= 0 && c < puzzle.gridSize.cols) {
          grid[r][c] = { shapeId: shape.id, movable: false };
        }
      }
    }
  }
  return grid;
}
```

### Key guard in `placePiece()` that already handles sentinels (lines 118-127) — NO CHANGE NEEDED

```javascript
// This existing check rejects { inactive: true } for free (it is !== null)
if (lobby.grid[r][c] !== null) {
  return { ok: false, error: 'Cell occupied' };
}
```

### Test infrastructure — how tests are run

```bash
# From server/ directory:
node --test                          # run all *.test.js files (currently: 54 pass)
node --test src/game.test.js         # run game logic tests only (40 tests)
node --test src/socket.test.js       # run socket handler tests only (14 tests)
```

Test files use CommonJS (`require`) and Node.js built-in `node:test` + `node:assert/strict`. No separate test runner installed. No `jest`, no `mocha`, no `vitest`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| All cells `null` in grid | Active cells `null`, inactive cells `{ inactive: true }` | Phase 4 (this phase) | `placePiece()` rejects sentinels for free; `checkWin()` needs one-line fix in Phase 5 |
| No `inactiveCells` field | Optional `inactiveCells: [[r,c], ...]` in puzzle JSON | Phase 4 (this phase) | Backward compatible — existing puzzles unaffected |
| No cell-count validation | `movableCells === activeSolutionCells` check in validator | Phase 4 (this phase) | Catches unsolvable puzzles at server startup |

**Deprecated/outdated:**
- Current `buildInitialGrid()` two-step pattern (`fill(null)` then anchor loop): replaced by single-pass `Array.from` with sentinel + anchor loop.

---

## Open Questions

1. **Do existing puzzles pass the cell-count cross-check?**
   - What we know: `puzzle_01.json` has shapes B (3 cells) + C (3 cells). The solution is a 4×4 grid. Counting non-null solution cells: row0=[A,B,B,null]=3, row1=[A,C,B,null]=3, row2=[A,C,C,null]=3, row3=[null,null,null,null]=0. Total: 9 non-null. But movable cells = 6 (B=3, C=3) and anchor A = 3 cells. Total placed = 9 = total non-null. Movable only = 6. Cross-check must compare movable cells (6) to active cells NOT covered by anchors, or to ALL non-null cells (9)?
   - What's unclear: The cross-check intent from PIEC-02 is that movable piece cells = active cells total = 43. But anchor shapes also occupy cells. The solution array includes anchor cell IDs. So `puzzle.solution.flat().filter(id => id !== null).length` counts both anchor and movable cells together.
   - Recommendation: The cross-check should be: `(movable cell count) + (anchor cell count) === (non-null solution cells)`. Or more simply: validate that `totalMovableCells === activeCellCount - anchorCellCount`. Alternatively, if existing puzzles are designed such that ALL non-null solution cells are covered by some shape (anchor or movable), then the check is just: `total shape cells === non-null solution cells`. Verify this against `puzzle_01.json` before implementation.

2. **What are the exact 10 piece shapes?**
   - What we know: They must cover 43 cells total, must be 3-5 cells each, and must be designed to actually tile the 5×9 grid minus 4 corners.
   - What's unclear: The shapes are not yet authored. This is a design task that must happen in Plan 04-01.
   - Recommendation: Design the solution layout first (assign shapes to cells), then extract shape definitions from the layout. This guarantees solvability. Avoid shapes with 180° rotational symmetry (same shape at 0° and 180°) to prevent player confusion in Phase 7.

---

## Validation Architecture

> Note: `workflow.nyquist_validation` is not set in `.planning/config.json` — this section documents the test infrastructure for reference but is not formally required by the workflow config.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (no version — ships with Node 20 LTS) |
| Config file | none — test runner discovers `*.test.js` files automatically |
| Quick run command | `node --test src/game.test.js` (from `server/`) |
| Full suite command | `node --test` (from `server/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File |
|--------|----------|-----------|------|
| GRID-01 | `puzzle_v11.json` loads without error; gridSize is 5×9 | unit | `game.test.js` — new test in `loadPuzzles` or `validatePuzzleSchema` describe block |
| GRID-02 | `buildInitialGrid()` populates `[3,7]`, `[3,8]`, `[4,7]`, `[4,8]` with `{ inactive: true }` | unit | `game.test.js` — new describe block `buildInitialGrid with inactiveCells` |
| GRID-02 | Active positions remain `null` after sentinel introduction | unit | same block |
| PIEC-01 | Server starts and loads `puzzle_v11.json` successfully | unit | `game.test.js` — verify `getPuzzleById('puzzle_v11')` returns non-null after `loadPuzzles()` |
| PIEC-02 | Validator throws when movable cells !== active cell count | unit | `game.test.js` — direct call to `validatePuzzleSchema()` with crafted fixture |
| PIEC-02 | Validator passes for valid puzzle with correct cell count | unit | same block |
| COMPAT | All 54 currently-passing tests continue to pass | regression | `node --test` — full suite |

### Wave 0 Gaps (tests that do not exist yet and must be written in this phase)

- [ ] `game.test.js` — `describe('validatePuzzleSchema — inactiveCells')`: valid `inactiveCells` passes; non-array throws; non-`[r,c]` entry throws; out-of-bounds entry throws
- [ ] `game.test.js` — `describe('validatePuzzleSchema — cell count cross-check')`: matching counts pass; mismatched counts throw with descriptive message
- [ ] `game.test.js` — `describe('buildInitialGrid — irregular grid')`: inactive positions have `{ inactive: true }`; active positions are `null`; anchor shapes still placed correctly

---

## Sources

### Primary (HIGH confidence)

- Direct source read: `server/src/game.js` (419 LOC, 2026-03-15) — `validatePuzzleSchema()`, `buildInitialGrid()`, `placePiece()`, `checkWin()`, `loadPuzzles()`
- Direct source read: `server/src/game.test.js` (484 LOC, 2026-03-15) — test structure, `before()` hook, 40 existing tests
- Direct source read: `server/src/socket.test.js` (320 LOC, 2026-03-15) — 14 existing tests
- Direct source read: `puzzles/puzzle_01.json`, `puzzles/puzzle_02.json` — existing puzzle schema
- Direct source read: `.planning/research/ARCHITECTURE.md` — locked decisions: sentinel choice, `inactiveCells` format, backward-compat strategy
- Direct source read: `.planning/research/PITFALLS.md` — Pitfalls 2, 4, 5, 11, 15 directly relevant to Phase 4
- Direct source read: `.planning/research/STACK.md` — confirms zero new dependencies
- Verified test run: `node --test` from `server/` → 54 tests pass (40 game + 14 socket)

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — locked decisions: `{ inactive: true }` sentinel, `inactiveCells` field name
- `.planning/REQUIREMENTS.md` — GRID-01, GRID-02, PIEC-01, PIEC-02 definitions

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; direct verification of existing code
- Architecture patterns: HIGH — all patterns derived from direct source reads of production code
- Pitfalls: HIGH — derived from code analysis and prior research documents; Pitfall 3 (unsolvable puzzle design) is inherent to puzzle-design process, not implementation

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (stable — no external libraries, all findings based on project's own code)
