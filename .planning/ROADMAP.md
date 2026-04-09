# Roadmap: LogiBlock

## Milestones

- ✅ **v1.0 LogiBlock MVP** — Phases 1-3 (shipped 2009-03-10)
- ✅ **v1.1 Grid & Pieces Redesign** — Phases 4-10 (shipped 2026-04-06)
- 🚧 **v1.2 Spielqualität & Features** — Phases 11-15 (in progress)

## Phases

<details>
<summary>✅ v1.0 LogiBlock MVP (Phases 1-3) — SHIPPED 2009-03-10</summary>

- [x] Phase 1: Foundation (3/3 plans) — completed 2009-03-05
- [x] Phase 2: Game Loop (5/5 plans) — completed 2009-03-05 (human verified)
- [x] Phase 3: Timer und Leaderboard (3/3 plans) — completed 2009-03-10 (human verified)

Full archive: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Grid & Pieces Redesign (In Progress)

**Milestone Goal:** Irregular 5×9 grid (43 active cells, 4 missing corners), 10 custom pieces that tile it exactly, and a new click interaction model (single-click rotates, double-click places).

- [x] **Phase 4: Schema and Server Data Model** - Introduce the irregular grid sentinel and new puzzle JSON; lock the foundational data model all other phases depend on
- [x] **Phase 5: Server Logic Fixes** - Propagate the sentinel to win detection and placement rejection so the game plays correctly on the irregular grid
- [x] **Phase 6: Client Grid Rendering** - Render inactive cells as visual gaps and extend the color palette to 10 pieces (completed 2009-03-19)
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
  1. A single left-click on any active grid cell rotates the selected piece 90 degrees clockwise (cycling 0->90->180->270->0); the piece remains selected after rotation
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
| 1. Foundation | v1.0 | 3/3 | Complete | 2009-03-05 |
| 2. Game Loop | v1.0 | 5/5 | Complete — human verified | 2009-03-05 |
| 3. Timer und Leaderboard | v1.0 | 3/3 | Complete — human verified | 2009-03-10 |
| 4. Schema and Server Data Model | v1.1 | 2/2 | Complete — human verified | 2009-03-16 |
| 5. Server Logic Fixes | v1.1 | 1/1 | Complete | 2009-03-19 |
| 6. Client Grid Rendering | v1.1 | 1/1 | Complete — human verified | 2009-03-19 |
| 7. New Interaction Model | v1.1 | 0/2 | Not started | - |
| 8. Erstes richtiges Level bauen | v1.1 | 3/3 | Complete — human verified | 2026-03-xx |
| 9. Random Mode | v1.1 | 3/3 | Complete | 2026-04-xx |
| 10. Steuerung und Tablet Integration | v1.1 | 3/3 | Complete — human verified | 2026-04-06 |
| 11. Profanity Filter | 1/1 | Complete    | 2026-04-06 | - |
| 12. Controls Modal | 1/1 | Complete    | 2026-04-06 | - |
| 13. Per-Level Leaderboard | 1/1 | Complete    | 2026-04-06 | - |
| 14. Random Mode Overhaul | 2/2 | Complete   | 2026-04-07 | - |
| 15. Reconnect After Disconnect | 2/3 | In Progress|  | - |

### Phase 8: Erstes richtiges Level bauen — Design und Implementierung eines finalen Puzzle-Levels als echtes Spielerlebnis

**Goal:** Ship Level 1 — the first real playable puzzle (3 anchor pieces, 7 movable pieces, difficulty "easy") — and activate the puzzle-selection system in the lobby so only tagged puzzles appear in the dropdown
**Requirements**: LVL-01, LVL-02, LVL-03, LVL-04, LVL-05, LVL-06
**Depends on:** Phase 7
**Plans:** 3/3 plans complete

Plans:
- [ ] 08-01-PLAN.md — Create `puzzles/level_01.json` and make four surgical server edits (filter by difficulty, default lobby selection, expose difficulty in public state, validate difficulty type)
- [ ] 08-02-PLAN.md — Client changes: DIFFICULTY_LABELS constant, puzzle:list dropdown "Name — Einfach" format, non-host lobby display
- [ ] 08-03-PLAN.md — Human verification: lobby puzzle selection (5 scenarios) and gameplay end-to-end

### Phase 9: Random Mode

**Goal:** Add a host-controlled "Chaos-Modus" lobby toggle; after each successful piece placement (30% chance), a random disruptive event fires: remove a placed piece, rotate the active player's held piece, skip the active player's turn, or shuffle turn order. All event logic is server-side.
**Requirements**: TBD (new feature outside v1.1 scope)
**Depends on:** Phase 8
**Plans:** 3/4 plans executed

Plans:
- [ ] 09-01-PLAN.md — TDD: extend game.js with setRandomMode, triggerRandomEvent (4 event types + edge cases), createLobby/getPublicState extensions
- [ ] 09-02-PLAN.md — Client: lobby slider toggle in index.html + style.css; randomMode:event handler + showGameNotification in main.js
- [ ] 09-03-PLAN.md — TDD: socket.js lobby:randomMode handler + game:move place branch event trigger; socket integration tests
- [ ] 09-04-PLAN.md — Human verification: lobby toggle (2 scenarios), in-game events (5 scenarios)

### Phase 10: Steuerung überarbeiten und Tablet Integration

**Goal:** Rework the control model for both desktop and tablet: replace double-click-to-place with single-click-to-place + rotation buttons, add touch drag-to-preview for tablet gameplay, and make the grid auto-scale to available screen space. Landscape tablet (1024x768+) is the tablet target.
**Requirements**: CTRL-single-click-place, CTRL-return-click, CTRL-rotation-buttons, EXT-01-R-key, TOUCH-drag-preview, TOUCH-ghost-confirm, TOUCH-long-press, CSS-auto-scale, CSS-portrait-overlay
**Depends on:** Phase 9
**Plans:** 3/3 plans complete

Plans:
- [x] 10-01-PLAN.md — Desktop interaction refactor + rotation buttons + R key + responsive CSS auto-scaling + portrait overlay
- [x] 10-02-PLAN.md — Touch event support: bank drag-to-preview, ghost-stays-on-touchend, long-press return
- [x] 10-03-PLAN.md — Human verification of complete interaction model (23 scenarios)

### 🚧 v1.2 Spielqualität & Features (In Progress)

**Milestone Goal:** Spielerfahrung verbessern durch 5 orthogonale Erweiterungen auf dem stabilen v1.1-Spiel: Profanity-Filter, Steuerungsmodal, Level-Rangliste, Random-Mode-Overhaul, Reconnect nach Disconnect.

- [x] **Phase 11: Profanity Filter** - Server-side name validation in createRoom/joinRoom handlers via npm package (completed 2026-04-06)
- [x] **Phase 12: Controls Modal** - Client-side info button and `<dialog>` modal with desktop/touch control reference (completed 2026-04-06)
- [x] **Phase 13: Per-Level Leaderboard** - Client-side tab UI filtering leaderboard entries by puzzleName (completed 2026-04-06)
- [x] **Phase 14: Random Mode Overhaul** - Add double_turn + reverse_order + blind_bank events; rebalance trigger weights (completed 2026-04-07)
- [ ] **Phase 15: Reconnect After Disconnect** - 30-second reconnect window for mid-game disconnects with socket ID re-association

### Phase 11: Profanity Filter
**Goal**: Player names containing profanity are rejected server-side before room creation or joining; existing `room:error` display handles the feedback
**Depends on**: Phase 10 (v1.1 complete)
**Requirements**: PROF-01
**Success Criteria** (what must be TRUE):
  1. `createRoom` rejects names that fail the profanity check and emits `room:error` with a descriptive message
  2. `joinRoom` rejects names that fail the profanity check and emits `room:error` with a descriptive message
  3. Clean names continue to work without any change in behavior
  4. `bad-words` npm package is listed in `server/package.json` dependencies
**Plans**: 1 plan

Plans:
- [ ] 11-01-PLAN.md — Install `bad-words`, add guard in `createRoom` and `joinRoom` handlers in socket.js, add TDD tests for blocked/clean names

### Phase 12: Controls Modal
**Goal**: An info button in the game screen opens a closable modal explaining all keyboard and touch controls introduced in Phase 10
**Depends on**: Phase 11
**Requirements**: HLP-01
**Success Criteria** (what must be TRUE):
  1. An info/help button (ℹ or ?) is visible in `#game-screen` and does not obscure game content
  2. Clicking the button opens a modal with accurate Phase 10 control descriptions (desktop + touch sections)
  3. Modal closes on: X button click, Escape key, click-outside-backdrop
  4. Opening/closing the modal emits no socket events and does not affect game state
**Plans**: 1 plan

Plans:
- [ ] 12-01-PLAN.md — Add `<dialog>` to index.html, info button near game title, open/close JS in main.js, modal CSS in style.css

### Phase 13: Per-Level Leaderboard
**Goal**: The leaderboard on the start screen shows a separate ranked list per puzzle; players can switch between puzzle tabs to see times
**Depends on**: Phase 12
**Requirements**: LDR-01
**Success Criteria** (what must be TRUE):
  1. The leaderboard UI shows one tab per puzzle that has entries (derived from `puzzleName` field already in every entry)
  2. Selecting a tab filters the table to show only entries for that puzzle, ranked 1st–Nth
  3. The default tab is the puzzle with the most recent entry (or first alphabetically if tied)
  4. Server code is unchanged — no new socket events, no server-side filtering
**Plans**: 1 plan

Plans:
- [ ] 13-01-PLAN.md — Add tab rendering + filter logic in `renderLeaderboard()` in main.js; tab CSS in style.css

### Phase 14: Random Mode Overhaul
**Goal**: The existing 4 chaos events are rebalanced for "crazy not annoying" and 3 new visible events (double_turn, reverse_order, blind_bank) are added
**Depends on**: Phase 13
**Requirements**: RAND-01, RAND-02, RAND-03
**Success Criteria** (what must be TRUE):
  1. `double_turn` event: active player gets a second placement this turn; `lobby.extraTurns` counter gates the extra turn; `advanceTurn` is skipped on the first placement
  2. `reverse_order` event: `lobby.players` array is reversed and `activeTurnIndex` reset to 0; all clients see the reordered name badges
  3. `blind_bank` event: server emits `{ type: 'blind_bank' }` in `randomMode:event`; client adds `.blind` class to `#piece-bank` for one turn
  4. Event weights rebalanced: rotate_piece 10%, skip_turn 15%, remove_piece 20%, shuffle_order 15%, double_turn 15%, reverse_order 15%, blind_bank 10%
**Plans**: 2 plans

Plans:
- [ ] 14-01-PLAN.md — Server: new event types in `triggerRandomEvent()` + `pickRandomEvent()` weight table + `lobby.extraTurns` state + socket.js place-branch for double_turn
- [ ] 14-02-PLAN.md — Client: blind_bank `.blind` CSS class + bank opacity handler; human verification: all 7 event types fire correctly

### Phase 15: Reconnect After Disconnect
**Goal**: A player who disconnects mid-game has a 30-second window to reconnect and resume their slot; the game continues with their turns skipped during the window
**Depends on**: Phase 14
**Requirements**: RECON-01, RECON-02, RECON-03
**Success Criteria** (what must be TRUE):
  1. On disconnect mid-game: player slot is marked `{ disconnected: true, disconnectedAt }` for 30s instead of being immediately removed; turn advances past them
  2. Remaining players see a notification "X disconnected — reconnecting..." for the 30-second window
  3. Player reconnects (same name + room code) within 30s: slot is re-associated with new socket ID, player rejoins the game at current state
  4. 30s expires without reconnect: slot is fully evicted, `lobby:playerLeft` broadcast, game continues
  5. Lobby-phase disconnects are unchanged: host disconnect still closes lobby, non-host still evicted immediately
**Plans**: 3 plans

Plans:
- [ ] 15-01-PLAN.md — Server: modify `disconnecting` handler for game-phase hold vs. lobby-phase evict; add 30s setTimeout per disconnecting player; new `reconnectRoom` socket handler
- [ ] 15-02-PLAN.md — Client: `reconnectRoom` emit on Socket.IO auto-reconnect; "Reconnecting..." UI state; handle `room:error "Session expired"` path
- [ ] 15-03-PLAN.md — TDD: disconnect-hold, 30s-expiry, successful reconnect, host-reconnect, all-disconnect edge cases; human verification
