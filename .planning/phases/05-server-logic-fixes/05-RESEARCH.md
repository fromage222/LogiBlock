# Phase 5: Server Logic Fixes - Research

**Researched:** 2026-03-19
**Domain:** Node.js server game logic — `checkWin()` sentinel guard + TDD with `node:test`
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GRID-03 | Server rejects piece placement on inactive cells (automatically via non-null sentinel guard in `placePiece()` — no code change needed) | Confirmed: `placePiece()` at line 124 already has `if (lobby.grid[r][c] !== null)` which rejects `{ inactive: true }`. Zero code change required; new test must verify this behavior. |
| GRID-04 | Player wins correctly when all 43 active cells are filled — `checkWin()` ignores inactive sentinel cells | Confirmed bug: `checkWin()` at lines 78–92 has `if (expectedId === null) { if (cell !== null) return false; }` — this returns `false` for `{ inactive: true }` cells even when solution has `null` there. Fix: add `if (cell && cell.inactive) continue;` (or skip in both branches) before the null-check. |
</phase_requirements>

---

## Summary

Phase 5 has a tightly defined scope: one bug to fix and a set of TDD tests to write. The entire implementation is a surgical one-liner change to `checkWin()` in `server/src/game.js`, plus new test coverage for irregular-grid win/no-win scenarios.

The core bug: `checkWin()` iterates every cell in the grid (rows × cols). For each cell it compares against `puzzle.solution[r][c]`. Inactive positions have `solution[r][c] === null` and `grid[r][c] === { inactive: true }`. The existing guard `if (cell !== null) return false` treats the sentinel as an unexpected occupant and returns false — making `puzzle_v11` permanently unwinnable. The fix is to add a sentinel skip at the top of the inner loop body: if `cell && cell.inactive`, treat the cell as "correctly empty" and continue.

The `placePiece()` function already works correctly by accident: the guard `if (lobby.grid[r][c] !== null)` rejects placement on `{ inactive: true }` cells with `"Cell occupied"`. GRID-03 requires a test to document and verify this behavior, but zero production code change.

Current test count: **52 tests pass, 0 fail** (verified 2026-03-19 via `node --test src/game.test.js`). Phase 5 will add new tests; the target is all pre-existing tests continue to pass.

**Primary recommendation:** Write the new tests first (TDD RED), then apply the one-line fix to `checkWin()` (GREEN). No new dependencies, no new files.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `node:test` | ships with Node 24.13.1 (project) | Test runner for all new unit tests | Already used throughout `game.test.js` and `socket.test.js`; no install needed |
| Node.js built-in `node:assert/strict` | same | Assertions | Already used throughout the test files |

### Supporting

No new dependencies. Zero npm installs.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:test` built-in | Jest, Mocha, Vitest | Project explicitly uses no test runner npm package — `server/package.json` has no test script and no dev dependencies. Adding a test framework would over-engineer a uni project. |

**Installation:**
```bash
# No installation needed
```

---

## Architecture Patterns

### Recommended Project Structure

```
server/
└── src/
    ├── game.js           # Modified: checkWin() gets 1-line sentinel guard
    └── game.test.js      # Extended: new describe block for irregular-grid win scenarios
```

No new files. No new exports.

### Pattern 1: Sentinel Skip in checkWin()

**What:** At the start of the inner loop body in `checkWin()`, skip (continue) the cell if it is an inactive sentinel. This makes inactive cells invisible to win detection — they are neither required to be filled nor forbidden from being occupied.

**When to use:** Any grid iteration that should treat inactive sentinels as non-participants.

**Current broken code (lines 78–92 of game.js):**
```javascript
function checkWin(lobby, puzzle) {
  const { rows, cols } = puzzle.gridSize;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const expectedId = puzzle.solution[r][c];
      const cell = lobby.grid[r][c];
      if (expectedId === null) {
        if (cell !== null) return false;      // BUG: { inactive: true } !== null → returns false
      } else {
        if (!cell || cell.shapeId !== expectedId) return false;
      }
    }
  }
  return true;
}
```

**Fixed code:**
```javascript
function checkWin(lobby, puzzle) {
  const { rows, cols } = puzzle.gridSize;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = lobby.grid[r][c];
      if (cell && cell.inactive) continue;   // FIX: skip inactive sentinel cells
      const expectedId = puzzle.solution[r][c];
      if (expectedId === null) {
        if (cell !== null) return false;
      } else {
        if (!cell || cell.shapeId !== expectedId) return false;
      }
    }
  }
  return true;
}
```

**Source:** Direct inspection of `server/src/game.js` lines 78–92 (2026-03-19). Bug confirmed by running the logic manually: `puzzle_v11.solution[4][0] === null`, `grid[4][0] === { inactive: true }`, and `{ inactive: true } !== null` triggers false return.

### Pattern 2: Building a Win-State Grid for puzzle_v11 in Tests

**What:** To test that `checkWin()` returns `true` when all 43 active cells are filled, a test must construct a grid where:
- All 43 active positions contain `{ shapeId: <correct_id>, movable: true }`
- Both inactive positions (`[4][0]` and `[4][8]`) contain `{ inactive: true }` (as set by `buildInitialGrid()`)

**Key insight:** `puzzle_v11` has NO anchor shapes (all 10 shapes are movable). The existing `checkWin()` test at `CWTEST2` builds a winning grid by iterating `puzzle.solution[r][c]` and writing `{ shapeId: sid, movable: sid !== 'A' }`. This pattern fails for `puzzle_v11` because `solution[4][0] === null` — the test would write `null` at the inactive cell, but the actual grid starts with `{ inactive: true }` there.

**Correct pattern for puzzle_v11 win-state grid:**
```javascript
// In a test:
const puzzle = getPuzzleById('puzzle_v11');
const { rows, cols } = puzzle.gridSize;
// Build an inactiveSet for fast lookup
const inactiveSet = new Set(
  (puzzle.inactiveCells || []).map(([r, c]) => `${r}-${c}`)
);
const grid = [];
for (let r = 0; r < rows; r++) {
  grid.push([]);
  for (let c = 0; c < cols; c++) {
    if (inactiveSet.has(`${r}-${c}`)) {
      grid[r].push({ inactive: true });      // preserve sentinel
    } else {
      const sid = puzzle.solution[r][c];
      grid[r].push(sid ? { shapeId: sid, movable: true } : null);
    }
  }
}
lobby.grid = grid;
assert.equal(checkWin(lobby, puzzle), true);
```

### Pattern 3: Using setSelectedPuzzle() in Test Helper

**What:** The `makeLobby()` helper in `game.test.js` always selects `puzzle_01` (first key in `puzzleMap`, which is determined by file load order). Tests for `puzzle_v11` must explicitly switch to it using `setSelectedPuzzle()`.

**How:**
```javascript
function makeLobbyV11(roomCode) {
  lobbies.delete(roomCode);
  createLobby(roomCode, 'host-socket', 'Alice');
  addPlayer(roomCode, 'p2-socket', 'Bob');
  setSelectedPuzzle(roomCode, 'puzzle_v11');
  const result = startGame(roomCode);
  if (!result.ok) throw new Error('startGame failed: ' + result.error);
  return lobbies.get(roomCode);
}
```

**Alternative:** Reuse the existing `makeLobby()` helper and manually override `lobby.selectedPuzzleId` + `lobby.grid` after the fact. This is acceptable for `checkWin()` tests since `checkWin()` takes the puzzle as a parameter and doesn't read `lobby.selectedPuzzleId` itself. However, using `setSelectedPuzzle()` + `startGame()` produces a correctly-structured lobby (with `{ inactive: true }` at `[4][0]` and `[4][8]`) that tests the real codepath.

**Exports needed:** `setSelectedPuzzle` is already exported from `game.js` (line 442). No change needed.

### Pattern 4: Testing GRID-03 (Inactive Cell Rejection)

**What:** `placePiece()` rejects inactive cells via `if (lobby.grid[r][c] !== null)` returning `{ ok: false, error: 'Cell occupied' }`. The test must attempt to place a piece with a rotation and origin that would land on an inactive cell.

**For puzzle_v11:** Inactive cells are at `[4][0]` and `[4][8]`. A single-cell shape (or carefully chosen origin) that covers one of these positions would trigger the guard.

**Simpler approach:** Since `puzzle_v11` has no single-cell shapes, the test can directly set up a lobby with `puzzle_v11`, manually patch the grid so a known piece's footprint lands on `[4][0]`, or use a synthetic approach:

```javascript
it('rejects placement attempt on inactive sentinel cell', () => {
  const lobby = makeLobbyV11('GRID03-TEST');
  // Verify sentinel is in place
  assert.deepEqual(lobby.grid[4][0], { inactive: true });
  // P01 = [[0,0],[0,1],[0,2]] — placing at origin (4,0) with rotation 0
  // covers [4,0] which is inactive → rejected
  const result = placePiece(lobby, 'P01', 0, 4, 0);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'Cell occupied');
});
```

**Note:** `puzzle_v11.inactiveCells = [[4,0],[4,8]]`. Placing P01 (`[[0,0],[0,1],[0,2]]`) at origin `(4, 0)` lands on `[4,0]` (inactive), `[4,1]` (active, null), and `[4,2]` (active, null). The loop in `placePiece()` validates all cells in order — since `[4,0]` is first and is not null, it returns `'Cell occupied'` immediately.

### Anti-Patterns to Avoid

- **Changing `placePiece()` for GRID-03:** No code change is needed. The existing `!== null` guard already handles it. Only a test is needed.
- **Checking `cell.inactive` in `placePiece()`:** Would be redundant and misleading — the `!== null` guard already covers it. Adding a specific inactive check would suggest the null guard is insufficient, which is false.
- **Using `puzzle_01` fixture for win-condition tests of `puzzle_v11`:** puzzle_01 has no inactive cells, so it can't test the inactive-skip behavior of the fixed `checkWin()`.
- **Forgetting that `puzzle_v11` has no anchor shapes:** All 10 shapes are movable. Building a winning grid for `puzzle_v11` means only movable cells — no `movable: false` entries needed (unlike the existing CWTEST2 test which has anchor `A`).
- **Testing checkWin() with a plain null at inactive positions:** A lobby started via `startGame()` correctly has `{ inactive: true }` at inactive positions. If a test bypasses `startGame()` and puts `null` at `[4][0]` instead of the sentinel, it won't test the real scenario. Use the sentinel in test grids.
- **Breaking existing tests:** The existing `checkWin()` tests use `puzzle_01` which has no inactive cells. The fix (`if (cell && cell.inactive) continue`) is a no-op for `puzzle_01` grids — all existing tests remain valid and should still pass.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Win state detection | Custom comparison function | Fixed `checkWin()` with sentinel guard | `checkWin()` already handles all cases correctly for rectangular grids; the sentinel guard is the minimal surgical fix |
| Inactive cell tracking in tests | Parallel data structure alongside grid | `{ inactive: true }` sentinel from `buildInitialGrid()` | Already present in the grid after `startGame()` — just use the existing lobby grid |
| Test runner | Custom test harness | `node:test` built-in | Already used everywhere in the project |

**Key insight:** This phase requires zero new dependencies, zero new files, and zero new exports. The fix is a 1-line addition to `checkWin()` plus a new `describe` block in `game.test.js`.

---

## Common Pitfalls

### Pitfall 1: Fixing the Wrong Branch in checkWin()

**What goes wrong:** Developer adds the guard only in the `expectedId === null` branch (to skip the `cell !== null` check) but forgets that `cell && cell.inactive` would also fail the `expectedId !== null` branch if a sentinel somehow appears at a solution-covered cell.

**Why it happens:** The inactive cells always have `solution[r][c] === null` by design (they're explicitly `null` in the puzzle JSON). So technically only the `null`-expected branch is affected. However, placing the guard at the top of the loop (before the branch split) is cleaner and guards both branches defensively.

**How to avoid:** Place `if (cell && cell.inactive) continue;` as the first statement inside the `for (let c = 0; c < cols; c++)` loop — before `const expectedId = ...`. This is both correct and forward-defensive.

**Warning signs:** After the fix, `checkWin()` still returns false for a correctly-filled `puzzle_v11` board. This would mean the guard is in the wrong place.

### Pitfall 2: Win-State Test Uses Wrong Puzzle

**What goes wrong:** Test uses `makeLobby()` (which defaults to `puzzle_01`) to test the `puzzle_v11` win scenario.

**Why it happens:** `makeLobby()` is the existing convenience helper. Forgetting to select `puzzle_v11` means the lobby has a `puzzle_01` grid (4×4, no inactive cells) and `checkWin()` is called with the wrong puzzle reference.

**How to avoid:** Use `setSelectedPuzzle(roomCode, 'puzzle_v11')` before `startGame()`, or define a dedicated `makeLobbyV11()` helper.

**Warning signs:** Test passes even without the `checkWin()` fix, because `puzzle_01` never had inactive cells.

### Pitfall 3: Sentinel Not Present in Test Grid

**What goes wrong:** Test constructs the winning grid manually without placing `{ inactive: true }` at `[4][0]` and `[4][8]`, so it tests a scenario that can't occur in production (where `startGame()` always calls `buildInitialGrid()`).

**Why it happens:** When manually building a 5×9 grid for a winning scenario, it's easy to fill inactive positions with `null` (the "correct" value for empty active cells) rather than the sentinel.

**How to avoid:** Build the test grid using `buildInitialGrid()` as the base, then overwrite active cells with their solution shape IDs. Or use `startGame()` to get a correctly-initialized lobby, then patch the grid.

**Warning signs:** Test passes before the fix is applied (because `null` at an inactive position satisfies the current `cell === null` check trivially).

### Pitfall 4: "No-Win When Inactive Cells Unfilled" Test is Trivially True

**What goes wrong:** A test that "verifies no win when only inactive cells remain" is essentially testing that `checkWin()` returns `false` when the board is not fully filled — which is already covered by the existing CWTEST1 test.

**Why it happens:** Confusing "inactive cells don't prevent win" with "inactive cells themselves cause a false win."

**How to avoid:** The meaningful test is: "returns `true` when all 43 active cells match the solution AND the 2 inactive cells still contain `{ inactive: true }`." This is the new behavior Phase 5 needs to verify. The "partial board → false" case is already covered and doesn't need a new test.

**Warning signs:** New tests don't add coverage beyond what already exists.

---

## Code Examples

### The Single-Line Fix to checkWin()

```javascript
// Source: direct analysis of server/src/game.js lines 78–92 (2026-03-19)
// BEFORE (broken for puzzle_v11):
function checkWin(lobby, puzzle) {
  const { rows, cols } = puzzle.gridSize;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const expectedId = puzzle.solution[r][c];
      const cell = lobby.grid[r][c];
      if (expectedId === null) {
        if (cell !== null) return false;   // { inactive: true } triggers false
      } else {
        if (!cell || cell.shapeId !== expectedId) return false;
      }
    }
  }
  return true;
}

// AFTER (fixed):
function checkWin(lobby, puzzle) {
  const { rows, cols } = puzzle.gridSize;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = lobby.grid[r][c];
      if (cell && cell.inactive) continue;   // skip inactive sentinel cells
      const expectedId = puzzle.solution[r][c];
      if (expectedId === null) {
        if (cell !== null) return false;
      } else {
        if (!cell || cell.shapeId !== expectedId) return false;
      }
    }
  }
  return true;
}
```

### New Test Block Structure

```javascript
// Source: pattern derived from existing game.test.js describe blocks
// Add to server/src/game.test.js — after existing checkWin describe block

describe('checkWin — irregular grid (puzzle_v11)', () => {
  // Helper for this block: lobby with puzzle_v11 selected
  function makeLobbyV11(roomCode) {
    lobbies.delete(roomCode);
    createLobby(roomCode, 'host-socket', 'Alice');
    addPlayer(roomCode, 'p2-socket', 'Bob');
    setSelectedPuzzle(roomCode, 'puzzle_v11');
    const result = startGame(roomCode);
    if (!result.ok) throw new Error('startGame failed: ' + result.error);
    return lobbies.get(roomCode);
  }

  it('returns false on fresh puzzle_v11 grid (no pieces placed)', () => {
    const lobby = makeLobbyV11('CWV11-01');
    const puzzle = getPuzzleById('puzzle_v11');
    assert.equal(checkWin(lobby, puzzle), false);
  });

  it('returns true when all 43 active cells filled and sentinels remain at inactive positions', () => {
    const lobby = makeLobbyV11('CWV11-02');
    const puzzle = getPuzzleById('puzzle_v11');
    const { rows, cols } = puzzle.gridSize;
    const inactiveSet = new Set(
      (puzzle.inactiveCells || []).map(([r, c]) => `${r}-${c}`)
    );
    const grid = [];
    for (let r = 0; r < rows; r++) {
      grid.push([]);
      for (let c = 0; c < cols; c++) {
        if (inactiveSet.has(`${r}-${c}`)) {
          grid[r].push({ inactive: true });
        } else {
          const sid = puzzle.solution[r][c];
          grid[r].push(sid ? { shapeId: sid, movable: true } : null);
        }
      }
    }
    lobby.grid = grid;
    assert.equal(checkWin(lobby, puzzle), true);
  });

  it('inactive cells at [4][0] and [4][8] do not prevent win when other cells filled', () => {
    // Same as above — verifies specifically that sentinels are skipped, not just "grid is complete"
    // This is the same test body; keep as explicit documentation of requirement
    const lobby = makeLobbyV11('CWV11-03');
    const puzzle = getPuzzleById('puzzle_v11');
    // Confirm sentinels present after startGame()
    assert.deepEqual(lobby.grid[4][0], { inactive: true });
    assert.deepEqual(lobby.grid[4][8], { inactive: true });
    // Build complete grid
    const inactiveSet = new Set((puzzle.inactiveCells || []).map(([r, c]) => `${r}-${c}`));
    const grid = [];
    for (let r = 0; r < puzzle.gridSize.rows; r++) {
      grid.push([]);
      for (let c = 0; c < puzzle.gridSize.cols; c++) {
        if (inactiveSet.has(`${r}-${c}`)) {
          grid[r].push({ inactive: true });
        } else {
          const sid = puzzle.solution[r][c];
          grid[r].push(sid ? { shapeId: sid, movable: true } : null);
        }
      }
    }
    lobby.grid = grid;
    assert.equal(checkWin(lobby, puzzle), true);
  });
});

describe('placePiece — inactive cell rejection (puzzle_v11)', () => {
  function makeLobbyV11(roomCode) {
    lobbies.delete(roomCode);
    createLobby(roomCode, 'host-socket', 'Alice');
    addPlayer(roomCode, 'p2-socket', 'Bob');
    setSelectedPuzzle(roomCode, 'puzzle_v11');
    const result = startGame(roomCode);
    if (!result.ok) throw new Error('startGame failed: ' + result.error);
    return lobbies.get(roomCode);
  }

  it('rejects placement when any piece cell lands on an inactive sentinel', () => {
    const lobby = makeLobbyV11('GRID03-01');
    // P01 = [[0,0],[0,1],[0,2]] at origin (4,0) → covers [4,0] (inactive), [4,1], [4,2]
    const result = placePiece(lobby, 'P01', 0, 4, 0);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Cell occupied');
  });

  it('sentinel cells remain intact after rejected placement', () => {
    const lobby = makeLobbyV11('GRID03-02');
    placePiece(lobby, 'P01', 0, 4, 0);  // rejected
    assert.deepEqual(lobby.grid[4][0], { inactive: true });
  });
});
```

### Imports Needed in game.test.js

```javascript
// Add to existing require() destructure at top of game.test.js:
const {
  // ... existing imports ...
  setSelectedPuzzle,  // needed for makeLobbyV11 helper
} = require('./game');
```

`setSelectedPuzzle` is already exported from `game.js` (line 363 definition, line 441 in `module.exports`). No change to `game.js` exports needed beyond the `checkWin()` fix itself.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `checkWin()` iterates all cells including inactive | `checkWin()` skips inactive sentinels | Phase 5 (this phase) | `puzzle_v11` becomes winnable |
| Inactive-cell rejection relied on `null` semantics | Inactive-cell rejection works via sentinel `!== null` | Phase 4 (already complete) | No code change needed in Phase 5 for GRID-03 |

**Deprecated/outdated:**
- The inline comment `// NOTE (Phase 5): checkWin() currently treats { inactive: true } as an unexpected piece` in `buildInitialGrid()` (game.js around line 229): this comment should be removed when Phase 5 applies the fix, since it will no longer be accurate.

---

## Open Questions

1. **Should the sentinel comment in `buildInitialGrid()` be removed in Phase 5?**
   - What we know: A `// NOTE (Phase 5):` comment was added above `buildInitialGrid()` in plan 04-02 to document the gap. It reads: "Phase 5 will add the `!cell.inactive` guard."
   - What's unclear: The comment is inside `buildInitialGrid()` (lines 229–230 area), not inside `checkWin()`. It documents why the bug exists, not where the fix goes. Once the fix is applied, the comment is stale.
   - Recommendation: Remove the `// NOTE (Phase 5):` comment block from `buildInitialGrid()` as part of the Phase 5 plan's cleanup step.

2. **Should the `makeLobbyV11` helper be defined inside the describe block or as a module-level helper?**
   - What we know: The existing `makeLobby()` is module-level and reused across many describe blocks. A `makeLobbyV11()` helper would follow the same pattern.
   - What's unclear: Whether this helper will be needed beyond Phase 5 (likely yes — Phase 6 may add more server tests).
   - Recommendation: Define `makeLobbyV11` as a module-level helper in `game.test.js` alongside `makeLobby()`. This keeps it available for future tests without duplication.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (Node v24.13.1 on this machine) |
| Config file | none — `node --test` auto-discovers `*.test.js` files |
| Quick run command | `node --test src/game.test.js` (from `server/`) |
| Full suite command | `node --test` (from `server/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRID-03 | `placePiece()` rejects placement on `{ inactive: true }` cell with `"Cell occupied"` error | unit | `node --test src/game.test.js` | New tests in Wave 0 |
| GRID-03 | Sentinel cell is unchanged after rejected placement | unit | same | New tests in Wave 0 |
| GRID-04 | `checkWin()` returns `true` when all 43 active cells filled + sentinels at inactive positions | unit | `node --test src/game.test.js` | New tests in Wave 0 |
| GRID-04 | `checkWin()` returns `false` on fresh puzzle_v11 grid (no pieces placed) | unit | same | New tests in Wave 0 |
| GRID-04 | Existing `checkWin()` tests for rectangular grids still pass (backward compat) | regression | `node --test src/game.test.js` | Exists (CWTEST1–4) |

### Wave 0 Gaps

- [ ] `server/src/game.test.js` — `describe('checkWin — irregular grid (puzzle_v11)')` block: fresh grid → false; all 43 filled + sentinels → true; sentinel positions confirmed intact
- [ ] `server/src/game.test.js` — `describe('placePiece — inactive cell rejection (puzzle_v11)')` block: placement on inactive position → `{ ok: false, error: 'Cell occupied' }`; sentinel unchanged after rejection
- [ ] `server/src/game.test.js` — `setSelectedPuzzle` added to require() destructure (needed for `makeLobbyV11` helper)

---

## Sources

### Primary (HIGH confidence)

- Direct source read: `server/src/game.js` (458 LOC, 2026-03-19) — `checkWin()` lines 78–92; `placePiece()` lines 97–136; `buildInitialGrid()` lines 230–258; `module.exports` lines 431–457
- Direct source read: `server/src/game.test.js` (601 LOC, 2026-03-19) — existing `checkWin` describe block; `makeLobby()` helper; `before()` hook pattern
- Direct source read: `puzzles/puzzle_v11.json` — `inactiveCells: [[4,0],[4,8]]`; all 10 shapes movable; solution confirms `null` at inactive positions
- Direct source read: `puzzles/puzzle_01.json` — confirms no `inactiveCells`; anchor shape A at [0,0]
- Live test run: `node --test src/game.test.js` from `server/` → 52 tests pass, 0 fail (2026-03-19)
- Live bug confirmation: Node.js REPL — `{ inactive: true } !== null` → `true` → `checkWin()` returns `false` for inactive positions
- Direct source read: `.planning/phases/04-schema-and-server-data-model/04-02-SUMMARY.md` — confirms Phase 5 gap: "checkWin() fix explicitly scoped to Phase 5"
- Direct source read: `.planning/STATE.md` — "only remaining gap is `checkWin()` needing `!cell.inactive` guard"

### Secondary (MEDIUM confidence)

- `.planning/REQUIREMENTS.md` — GRID-03, GRID-04 definitions
- `.planning/ROADMAP.md` — Phase 5 success criteria verbatim
- `.planning/phases/04-schema-and-server-data-model/04-RESEARCH.md` — Pitfall 2 confirms exact bug mechanism

### Tertiary (LOW confidence)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; test framework confirmed running on Node v24.13.1
- Architecture: HIGH — fix derived from direct source analysis; bug confirmed by running logic manually
- Pitfalls: HIGH — derived from code analysis and direct test execution; no external sources needed

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable — no external libraries; findings based entirely on project's own code)
