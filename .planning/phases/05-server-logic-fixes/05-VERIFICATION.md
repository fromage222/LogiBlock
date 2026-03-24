---
phase: 05-server-logic-fixes
verified: 2026-03-19T12:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 5: Server Logic Fixes Verification Report

**Phase Goal:** The server correctly rejects piece placement on inactive cells and fires the win condition when all 43 active cells are filled
**Verified:** 2026-03-19
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                         | Status     | Evidence                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| 1   | placePiece() returns { ok: false, error: 'Cell occupied' } when any piece cell lands on an inactive sentinel                  | VERIFIED | game.test.js line 676: `assert.deepEqual(result, { ok: false, error: 'Cell occupied' })` — test passes |
| 2   | Inactive sentinel cells are unchanged after a rejected placePiece() call                                                     | VERIFIED | game.test.js line 682: `assert.deepEqual(lobby.grid[4][0], { inactive: true })` — test passes        |
| 3   | checkWin() returns true when all 43 active cells of puzzle_v11 are filled and sentinel cells remain at [4][0] and [4][8]     | VERIFIED | game.test.js lines 623-641 and 643-665 — two tests, both pass; game.js line 83: guard in place       |
| 4   | checkWin() returns false on a fresh puzzle_v11 grid (no pieces placed)                                                       | VERIFIED | game.test.js line 617-621: `assert.strictEqual(checkWin(lobby, puzzle), false)` — test passes        |
| 5   | All 52 pre-existing tests continue to pass — the fix is a no-op for puzzle_01 grids                                          | VERIFIED | Full test run: 57 pass / 0 fail / 0 skip (52 pre-existing + 5 new)                                   |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                      | Expected                                  | Status     | Details                                                                                               |
| ----------------------------- | ----------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `server/src/game.js`          | checkWin() with sentinel skip guard       | VERIFIED | Line 83: `if (cell && cell.inactive) continue;   // skip inactive sentinel cells (GRID-04)`          |
| `server/src/game.js`          | placePiece() grid[r][c] !== null guard    | VERIFIED | Line 125: `if (lobby.grid[r][c] !== null) { return { ok: false, error: 'Cell occupied' }; }`         |
| `server/src/game.test.js`     | TDD tests for GRID-03 and GRID-04         | VERIFIED | Lines 616-684: two describe blocks, 5 tests total, all passing                                        |
| `server/src/game.test.js`     | setSelectedPuzzle in require() destructure| VERIFIED | Line 22: `setSelectedPuzzle,` in the require('./game') destructure                                    |
| `server/src/game.test.js`     | makeLobbyV11() module-level helper        | VERIFIED | Lines 41-49: module-level function using setSelectedPuzzle + startGame                                |

### Key Link Verification

| From                                   | To                                  | Via                                              | Status     | Details                                                        |
| -------------------------------------- | ----------------------------------- | ------------------------------------------------ | ---------- | -------------------------------------------------------------- |
| game.js checkWin() inner loop          | puzzle_v11 inactive sentinel cells  | `if (cell && cell.inactive) continue`            | VERIFIED | game.js line 83 — guard is first statement inside inner loop, before expectedId lookup |
| game.js placePiece() bounds loop       | puzzle_v11 inactive sentinel cells  | `if (lobby.grid[r][c] !== null)` guard           | VERIFIED | game.js line 125 — existing guard correctly returns Cell occupied for `{ inactive: true }` |
| game.test.js makeLobbyV11()            | setSelectedPuzzle export            | `setSelectedPuzzle(roomCode, 'puzzle_v11')`      | VERIFIED | setSelectedPuzzle imported at line 22, called at line 45       |

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                     | Status     | Evidence                                                                               |
| ----------- | ----------- | ----------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| GRID-03     | 05-01-PLAN  | Server rejects placement on inactive cells (via non-null sentinel, no placePiece() code change) | SATISFIED | game.js line 125 guard confirmed; test at game.test.js line 671-683 passes             |
| GRID-04     | 05-01-PLAN  | Player wins correctly when all 43 active cells filled — checkWin() ignores inactive sentinels   | SATISFIED | game.js line 83 guard confirmed; tests at game.test.js lines 616-665 all pass          |

REQUIREMENTS.md traceability table maps both GRID-03 and GRID-04 to Phase 5 with status "Complete". Both are fully satisfied. No orphaned requirements found for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| —    | —    | None    | —        | —      |

No TODO, FIXME, placeholder, or stale comment anti-patterns found in either modified file. The `// NOTE (Phase 5):` comment block has been removed from `buildInitialGrid()` as planned (grep confirms zero matches).

### Human Verification Required

None. All behaviors are exercised by the automated test suite (`node --test src/game.test.js`). The server logic is purely deterministic and fully covered by unit tests.

### Gaps Summary

No gaps. All 5 must-have truths are verified, both artifacts are substantive and wired, both key links are confirmed in source, both requirement IDs are satisfied, and the full test suite passes with 57/57 tests.

---

## Supporting Evidence

### Test Run Output (final 10 lines)

```
ℹ tests 57
ℹ suites 13
ℹ pass 57
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 45.30225
```

### Commit Verification

Both commits documented in SUMMARY.md exist in git history:
- `5c902c4` — `test(05-01): add failing tests for GRID-03 and GRID-04 (RED)`
- `e6c96ad` — `feat(05-01): fix checkWin() to skip inactive sentinel cells (GRID-04)`

### Key Code Verified

`server/src/game.js` lines 78-93 — fixed checkWin():
```javascript
function checkWin(lobby, puzzle) {
  const { rows, cols } = puzzle.gridSize;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = lobby.grid[r][c];
      if (cell && cell.inactive) continue;   // skip inactive sentinel cells (GRID-04)
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

`server/src/game.js` lines 119-127 — placePiece() guard (GRID-03, unchanged):
```javascript
for (const [dr, dc] of rotatedCells) {
  const r = originRow + dr;
  const c = originCol + dc;
  if (r < 0 || r >= rows || c < 0 || c >= cols) {
    return { ok: false, error: 'Piece out of bounds' };
  }
  if (lobby.grid[r][c] !== null) {
    return { ok: false, error: 'Cell occupied' };
  }
}
```

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
