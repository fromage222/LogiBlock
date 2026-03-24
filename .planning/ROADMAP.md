# Roadmap: LogiBlock

## Milestones

- ✅ **v1.0 LogiBlock MVP** — Phases 1-3 (shipped 2026-03-10)
- 🚧 **v1.1 Grid & Pieces Redesign** — Phases 4-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 LogiBlock MVP (Phases 1-3) — SHIPPED 2026-03-10</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2026-03-05
- [x] Phase 2: Game Loop (5/5 plans) — completed 2026-03-05 (human verified)
- [x] Phase 3: Timer und Leaderboard (3/3 plans) — completed 2026-03-10 (human verified)

Full archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Grid & Pieces Redesign (In Progress)

**Milestone Goal:** Irregular 5×9 grid (43 active cells, 4 missing corners), 10 custom pieces that tile it exactly, and a new click interaction model (single-click rotates, double-click places).

- [x] **Phase 4: Schema and Server Data Model** - Introduce the irregular grid sentinel and new puzzle JSON; lock the foundational data model all other phases depend on
- [x] **Phase 5: Server Logic Fixes** - Propagate the sentinel to win detection and placement rejection so the game plays correctly on the irregular grid
- [x] **Phase 6: Client Grid Rendering** - Render inactive cells as visual gaps and extend the color palette to 10 pieces (completed 2026-03-19)
- [ ] **Phase 7: New Interaction Model** - Replace click-to-place with single-click rotation and double-click placement

## Phase Details

### Phase 4: Schema and Server Data Model
**Goal**: The server can load, validate, and represent the new irregular 5×9 puzzle with 10 custom pieces; all existing tests still pass
**Depends on**: Phase 3 (v1.0 complete)
**Requirements**: GRID-01, GRID-02, PIEC-01, PIEC-02
**Success Criteria** (what must be TRUE):
  1. The server starts without errors when `puzzles/puzzle_v11.json` is present, loading the irregular 5×9 grid definition
  2. The server grid array contains `{ inactive: true }` sentinel objects at the 2 missing corner positions [4,7] and [4,8], and `null` at all 43 active positions
  3. The schema validator rejects a puzzle JSON whose total shape cells do not match the non-null solution cell count (when inactiveCells is declared)
  4. All existing tests pass without modification after the sentinel is introduced
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Author `puzzle_v11.json` (5×9, 43 active cells, 10 pieces) and extend `validatePuzzleSchema()` with `inactiveCells` field validation + cell-count cross-check
- [x] 04-02-PLAN.md — Replace `buildInitialGrid()` with sentinel-aware single-pass implementation; unit tests; human verification

### Phase 5: Server Logic Fixes
**Goal**: The server correctly rejects piece placement on inactive cells and fires the win condition when all 43 active cells are filled
**Depends on**: Phase 4
**Requirements**: GRID-03, GRID-04
**Success Criteria** (what must be TRUE):
  1. Attempting to place a piece on an inactive cell is rejected by the server (no code change to `placePiece()` needed — the existing non-null guard handles this automatically via the sentinel)
  2. The win condition fires exactly when all 43 active cells are filled, and does not fire when inactive sentinel cells remain untouched
  3. New server tests cover: inactive-cell rejection, win detection with 43-of-43 active cells filled, no-win when only inactive cells remain unfilled
**Plans**: 1 plan

Plans:
- [x] 05-01-PLAN.md — Fix `checkWin()` sentinel guard (GRID-04) and add TDD tests for win detection + inactive-cell rejection (GRID-03)

### Phase 6: Client Grid Rendering
**Goal**: The client renders the irregular 5×9 grid correctly — inactive cells appear as transparent gaps, and all 10 pieces display with distinct colors
**Depends on**: Phase 5
**Requirements**: GRID-05, GRID-06, PIEC-03
**Success Criteria** (what must be TRUE):
  1. Inactive grid cells are visually invisible (transparent background, no border) and do not respond to hover or click events
  2. The mouse cursor shows `cursor: default` over inactive cells and `cursor: pointer` over active empty cells
  3. All 10 pieces in the bank panel display with 10 distinct, non-colliding colors
  4. The ghost preview correctly treats inactive cells as invalid placement targets (no additional code needed — the sentinel flows through `getPublicState()` and the existing `=== null` guard in `updateGhostPreview()` handles this)
**Plans**: 1 plan

Plans:
- [x] 06-01-PLAN.md — Add inactive cell branch in `renderGrid()`, `.grid-cell.inactive` CSS rule, extend `PIECE_COLORS` to 10 entries, redesign bank panel to 2-column layout with 8px mini-cells

### Phase 7: New Interaction Model
**Goal**: Players rotate the selected piece with a single click and place it with a double-click; the ghost preview and bank mini-grid stay in sync with the current rotation
**Depends on**: Phase 6
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04
**Success Criteria** (what must be TRUE):
  1. A single left-click on any active grid cell rotates the selected piece 90 degrees clockwise (cycling 0°→90°→180°→270°→0°); the piece remains selected after rotation
  2. A double-click on any active grid cell places the selected piece at that position without applying an extra rotation
  3. After a single-click rotation, the ghost preview on the hovered cell immediately reflects the new orientation
  4. After a single-click rotation, the bank mini-grid for the selected piece immediately reflects the new orientation
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md — Implement click disambiguator, grid single-click rotate + double-click place/return, lastHoveredRow/Col tracking, bank select-or-deselect only
- [ ] 07-02-PLAN.md — Human verification of complete interaction model (7 scenarios)

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation | v1.0 | 3/3 | Complete | 2026-03-05 |
| 2. Game Loop | v1.0 | 5/5 | Complete — human verified | 2026-03-05 |
| 3. Timer und Leaderboard | v1.0 | 3/3 | Complete — human verified | 2026-03-10 |
| 4. Schema and Server Data Model | v1.1 | 2/2 | Complete — human verified | 2026-03-16 |
| 5. Server Logic Fixes | v1.1 | 1/1 | Complete | 2026-03-19 |
| 6. Client Grid Rendering | v1.1 | 1/1 | Complete — human verified | 2026-03-19 |
| 7. New Interaction Model | v1.1 | 0/2 | Not started | - |

### Phase 8: Erstes richtiges Level bauen — Design und Implementierung eines finalen Puzzle-Levels als echtes Spielerlebnis

**Goal:** Ship Level 1 — the first real playable puzzle (3 anchor pieces, 7 movable pieces, difficulty "easy") — and activate the puzzle-selection system in the lobby so only tagged puzzles appear in the dropdown
**Requirements**: LVL-01, LVL-02, LVL-03, LVL-04, LVL-05, LVL-06
**Depends on:** Phase 7
**Plans:** 1/3 plans executed

Plans:
- [ ] 08-01-PLAN.md — Create `puzzles/level_01.json` and make four surgical server edits (filter by difficulty, default lobby selection, expose difficulty in public state, validate difficulty type)
- [ ] 08-02-PLAN.md — Client changes: DIFFICULTY_LABELS constant, puzzle:list dropdown "Name — Einfach" format, non-host lobby display
- [ ] 08-03-PLAN.md — Human verification: lobby puzzle selection (5 scenarios) and gameplay end-to-end
