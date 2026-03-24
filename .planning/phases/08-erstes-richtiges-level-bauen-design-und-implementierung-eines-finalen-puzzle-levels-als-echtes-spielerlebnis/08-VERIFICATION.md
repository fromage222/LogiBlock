---
phase: 08-erstes-richtiges-level-bauen
verified: 2026-03-24T12:00:00Z
status: human_needed
score: 12/12 automated must-haves verified
human_verification:
  - test: "Host sees only 'Level 1 — Einfach' and 'Corner Cut — Mittel' in the puzzle dropdown (no puzzle_01, no puzzle_02)"
    expected: "Dropdown contains exactly the two difficulty-tagged puzzles: Level 1 (easy) and Corner Cut (medium). Test puzzles puzzle_01 and puzzle_02 are absent."
    why_human: "UI rendering of <select> dropdown cannot be verified without a running browser session"
  - test: "Non-host player sees 'Ausgewähltes Puzzle: Level 1 — Einfach' in lobby"
    expected: "The selected-puzzle-display element shows the German-language string with difficulty label when a non-host joins"
    why_human: "Socket.IO lobby:update rendering requires a live browser session with two connected tabs"
  - test: "3 anchor pieces are visible and locked on the grid at game start (P07, P08, P09)"
    expected: "Three pre-placed anchor cells appear at their designed positions; clicking them has no effect (cursor: default, not movable)"
    why_human: "Visual rendering and interactivity of anchor pieces requires a live game session"
  - test: "7 movable pieces appear in the bank panel at game start"
    expected: "Bank shows exactly 7 pieces (P01-P06, P10); selecting one and hovering the grid shows the ghost preview centered on cursor"
    why_human: "Bank panel rendering and ghost preview centering require a live browser session"
  - test: "The puzzle is playable end-to-end through win condition"
    expected: "After placing all 7 movable pieces correctly, the win screen fires; game loop completes without errors"
    why_human: "End-to-end multiplayer game flow requires a live session with 2 players"
---

# Phase 8: Erstes richtiges Level bauen — Verification Report

**Phase Goal:** Ship Level 1 — the first real playable puzzle (3 anchor pieces, 7 movable pieces, difficulty "easy") — and activate the puzzle-selection system in the lobby so only tagged puzzles appear in the dropdown.
**Verified:** 2026-03-24T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `puzzles/level_01.json` exists with valid structure: 43 cells, 3 anchors, 7 movables, difficulty "easy" | VERIFIED | Node verify script: shapeCells=43, solCells=43, anchors=3, movable=7, difficulty=easy — PASS |
| 2 | Server starts and logs `[PuzzleLoader] Loaded "Level 1" (level_01.json)` without skipping | VERIFIED | Server output confirmed: "Loaded "Level 1" (level_01.json)" — no skip message |
| 3 | `getPuzzleListForClient()` filters to only difficulty-tagged puzzles | VERIFIED | Returns only level_01 (easy) and puzzle_v11 (medium); puzzle_01 and puzzle_02 excluded |
| 4 | `createLobby()` defaults to `level_01` (first puzzle with difficulty field) | VERIFIED | Simulation: `find(p => p.difficulty != null)?.id` returns "level_01" |
| 5 | `getPublicState()` includes `selectedPuzzleDifficulty` field | VERIFIED | game.js line 204: `selectedPuzzleDifficulty: puzzle ? (puzzle.difficulty ?? null) : null` |
| 6 | `validatePuzzleSchema()` type-checks optional difficulty field | VERIFIED | game.js lines 282-284: throws if difficulty is not a string when present |
| 7 | `DIFFICULTY_LABELS` constant exists once in client/main.js | VERIFIED | Defined at line 28; count check confirms exactly 1 definition |
| 8 | `puzzle:list` handler formats dropdown as "Name — Einfach" | VERIFIED | client/main.js line 594: `diffLabel ? \`${p.name} — ${diffLabel}\` : p.name` |
| 9 | Non-host lobby display uses `state.selectedPuzzleDifficulty` with German label | VERIFIED | client/main.js lines 189-195: "Ausgewähltes Puzzle: {name} — {label}" |
| 10 | Ghost preview uses pivot-offset centering (post-verification fix) | VERIFIED | `getPivotOffset()` function at line 441; used in `updateGhostPreview()` at lines 455-457 |
| 11 | Anchor cells do NOT have `pointer-events: none` in CSS | VERIFIED | `.grid-cell.anchor` rule (lines 458-463) has no pointer-events override; only `.grid-cell.inactive` has it |
| 12 | `puzzle_v11.json` has `difficulty: "medium"` (post-verification fix) | VERIFIED | node check: puzzle_v11 difficulty = "medium" |

**Score:** 12/12 automated truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `puzzles/level_01.json` | Complete Level 1 puzzle (3 anchors, 7 movables, 43 cells, difficulty "easy") | VERIFIED | 26 lines, valid JSON, all schema fields present, math passes |
| `server/src/game.js` | 4 surgical edits: createLobby, getPublicState, getPuzzleListForClient, validatePuzzleSchema | VERIFIED | All 4 patterns confirmed in source; all 4 functions exported |
| `client/main.js` | DIFFICULTY_LABELS constant, updated puzzle:list handler, updated renderLobbyUpdate non-host branch | VERIFIED | All 8 client checks pass; constant defined once at line 28 |
| `client/style.css` | Anchor cells not blocking pointer events | VERIFIED | `.grid-cell.anchor` has no pointer-events declaration |
| `puzzles/puzzle_v11.json` | difficulty field added for lobby inclusion | VERIFIED | `difficulty: "medium"` confirmed |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `game.js:validatePuzzleSchema` | `puzzles/level_01.json` | `loadPuzzles()` reads and validates every `.json` in `puzzles/` | WIRED | Server startup log confirms "Loaded 'Level 1'" — schema passed |
| `game.js:createLobby` | `puzzleMap` | `find(p => p.difficulty != null)` to skip test puzzles | WIRED | Pattern `find(p => p.difficulty != null)` confirmed at line 31 |
| `game.js:getPublicState` | client `lobby:update` handler | `selectedPuzzleDifficulty` in returned object | WIRED | `selectedPuzzleDifficulty` in game.js return object; `state.selectedPuzzleDifficulty` read in client/main.js line 189 |
| `client/main.js:DIFFICULTY_LABELS` | `puzzle:list` handler + `renderLobbyUpdate` | Shared constant used in both handlers | WIRED | DIFFICULTY_LABELS referenced at lines 190 and 593 in main.js |
| `server getPublicState selectedPuzzleDifficulty` | client `renderLobbyUpdate` | `lobby:update` event `state.selectedPuzzleDifficulty` | WIRED | Pattern `state\.selectedPuzzleDifficulty` confirmed at line 189 |

---

## Requirements Coverage

| Requirement | Source Plan | Description (derived from ROADMAP/CONTEXT) | Status | Evidence |
|-------------|------------|----------------------------------------------|--------|----------|
| LVL-01 | 08-01-PLAN.md | `puzzles/level_01.json` exists with valid puzzle data (3 anchors, 7 movables, 43 cells, difficulty "easy") | SATISFIED | File exists, math passes (43=43), schema valid, server loads it |
| LVL-02 | 08-01-PLAN.md | Server filters puzzle list — only difficulty-tagged puzzles sent to client | SATISFIED | `getPuzzleListForClient()` filter pattern confirmed in game.js |
| LVL-03 | 08-01-PLAN.md | `createLobby()` defaults to first puzzle with difficulty field; `getPublicState()` exposes `selectedPuzzleDifficulty` | SATISFIED | Both patterns confirmed in game.js lines 31-32 and 204 |
| LVL-04 | 08-02-PLAN.md | Client host dropdown shows "Level 1 — Einfach" format | SATISFIED (automated); needs human | Pattern confirmed in client; visual rendering requires human |
| LVL-05 | 08-02-PLAN.md | Non-host lobby display shows "Ausgewähltes Puzzle: Level 1 — Einfach" | SATISFIED (automated); needs human | Pattern confirmed in client; live rendering requires human |
| LVL-06 | 08-03-PLAN.md | End-to-end human verification: lobby selection, anchor pre-placement, 7-piece bank, ghost preview, win condition | SATISFIED per SUMMARY | 08-03-SUMMARY.md documents "approved" signal and 5-scenario pass; needs re-confirm |

### Orphaned Requirements Note

LVL-01 through LVL-06 are referenced in ROADMAP.md (Phase 8 Requirements field) and all three plan frontmatter files, but **none of these IDs appear in `.planning/REQUIREMENTS.md`**. The REQUIREMENTS.md file was last updated 2026-03-16 and covers only GRID, PIEC, and CTRL requirement families. The LVL-xx IDs are defined implicitly through the ROADMAP phase goal and CONTEXT decisions, not as explicit numbered requirements. This is a documentation gap — the requirement definitions exist in behavior/design documents but are not formally registered in REQUIREMENTS.md. This does not block the phase goal, but future phases should add LVL-xx entries to REQUIREMENTS.md for traceability.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | No stubs, placeholder returns, or TODO/FIXME blockers in modified files |

All modified files were scanned: `puzzles/level_01.json`, `server/src/game.js`, `client/main.js`, `client/style.css`, `puzzles/puzzle_v11.json`. No placeholder implementations, empty handlers, or console-log-only stubs detected.

---

## Human Verification Required

All 5 scenarios from plan 08-03 were reportedly approved by the human tester per the SUMMARY. These are documented below for re-confirmation if needed.

### 1. Host Puzzle Dropdown Content

**Test:** Open http://localhost:3000, enter a name, click "Create Room", inspect the puzzle-select dropdown.
**Expected:** Dropdown shows "Level 1 — Einfach" and "Corner Cut — Mittel" — no "puzzle_01", no "puzzle_02", no bare "Level 1" without difficulty label.
**Why human:** HTML select rendering and option text require a live browser session.

### 2. Non-Host Difficulty Display

**Test:** Open a second browser tab, join the room created above, inspect the selected-puzzle-display element.
**Expected:** Text reads "Ausgewähltes Puzzle: Level 1 — Einfach" (German label, not English "Selected puzzle:").
**Why human:** Socket.IO lobby:update rendering with two connected clients requires a live session.

### 3. Anchor Pre-Placement at Game Start

**Test:** With 2 players in lobby, host clicks "Start Game", inspect the game grid.
**Expected:** 3 pieces visible and locked on grid (P07 at row 2-4/col 3-4, P08 at row 0-1/col 3-5, P09 at row 2-3/col 4-6); clicking anchors has no effect.
**Why human:** Visual grid rendering and click-interactivity require a live game session.

### 4. 7-Piece Bank and Ghost Preview

**Test:** After game start, inspect the bank panel and select a piece, hover over the grid.
**Expected:** Bank shows exactly 7 pieces (P01-P06, P10); ghost preview renders centered under cursor (not top-left aligned), including over anchor cells.
**Why human:** Bank panel rendering and ghost pivot-offset centering require live browser interaction.

### 5. Win Condition

**Test:** Place all 7 movable pieces in their correct solution positions.
**Expected:** Win screen or win message fires after the last correct placement.
**Why human:** Full game-loop completion through multiplayer requires a live session.

---

## Verification Summary

All 12 automated must-haves pass. The automated evidence is strong:

- `puzzles/level_01.json` is mathematically correct (43 shape cells = 43 solution cells, 3 anchors, 7 movables).
- Server loads all 4 puzzle files including Level 1 with no skip errors.
- All four `server/src/game.js` surgical edits are present and exported correctly.
- `client/main.js` has all three Phase 8 additions: `DIFFICULTY_LABELS`, updated `puzzle:list` handler, updated `renderLobbyUpdate` non-host branch.
- Post-verification bug fixes are in place: ghost pivot centering, anchor pointer-events, puzzle_v11 difficulty field.
- All 5 commits from the summaries (4037739, 5a3b0c9, 801aad1, 2cbf3e9, plus bc269df fix) exist in git history.

The phase goal is **achieved in code**. The only remaining items are human-only confirmations of the visual/interactive experience, which the summaries document as already approved during the 08-03 checkpoint. A quick smoke run of the dev server is sufficient to close the phase formally.

**Requirement ID gap (non-blocking):** LVL-01 through LVL-06 are not registered in REQUIREMENTS.md. The IDs exist only in ROADMAP and plan frontmatter. This should be addressed in a future documentation pass.

---

_Verified: 2026-03-24T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
