---
phase: 08-erstes-richtiges-level-bauen
plan: "03"
subsystem: puzzle

tags: [human-verify, lobby, gameplay, anchor, end-to-end, ghost-preview, level-design]

# Dependency graph
requires:
  - phase: 08-erstes-richtiges-level-bauen
    plan: "01"
    provides: "level_01.json, server difficulty filtering, selectedPuzzleDifficulty in public state"
  - phase: 08-erstes-richtiges-level-bauen
    plan: "02"
    provides: "DIFFICULTY_LABELS, host dropdown and non-host lobby display with German labels"
provides:
  - "End-to-end human approval of Level 1: lobby selection, anchor pre-placement, 7-piece bank, ghost preview, win condition"
  - "Ghost preview pivot-offset centering fix: floating piece and ghost both centered at cursor"
  - "Anchor cell pointer-events fix: hover and ghost work over anchors"
  - "puzzle_v11.json difficulty field added: Corner Cut now appears in lobby dropdown"
affects:
  - any future puzzle levels (ghost preview, anchor hover behavior)
  - lobby filtering (puzzle_v11.json now included if desired)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ghost preview centering: use pivot-offset to keep piece centered under cursor, not top-left aligned"
    - "Anchor cells must NOT have pointer-events: none — hover/ghost requires events to pass through"

key-files:
  created:
    - .planning/phases/08-erstes-richtiges-level-bauen-design-und-implementierung-eines-finalen-puzzle-levels-als-echtes-spielerlebnis/08-03-SUMMARY.md
  modified:
    - client/main.js
    - client/style.css
    - puzzles/puzzle_v11.json

key-decisions:
  - "Ghost preview uses pivot-offset centering so the visual piece tracks the cursor center, not its top-left corner"
  - "Anchor cells must not block pointer events — removing pointer-events: none from CSS allows ghost to render over anchors"
  - "puzzle_v11.json gets difficulty: medium so Corner Cut becomes available in lobby; consistent with filtering convention from 08-01"

patterns-established:
  - "Human verification checkpoint is the gating step for phase completion — approval triggers summary and state update"
  - "Post-verification bug fixes are documented as deviations in the approval-plan SUMMARY, not in a new plan"

requirements-completed: [LVL-06]

# Metrics
duration: ~30min (manual verification + post-verification fixes)
completed: 2026-03-24
---

# Phase 8 Plan 03: Human Verification of Level 1 End-to-End Summary

**Level 1 approved end-to-end by human tester; three post-verification bugs fixed (ghost centering, anchor pointer-events, puzzle_v11 difficulty field)**

## Performance

- **Duration:** ~30 min (manual verification across 5 scenarios + post-verification fixes)
- **Started:** 2026-03-24T08:56:00Z
- **Completed:** 2026-03-24
- **Tasks:** 1 (checkpoint:human-verify)
- **Files modified:** 3 (post-verification fixes)

## Accomplishments

- Human verified all 5 scenarios: lobby puzzle dropdown (host), non-host difficulty display, anchor pre-placement on game start, 7-piece bank, win condition
- Approved with "approved" signal — no scenario failed the minimum bar (Scenarios 1-4 required)
- Three post-verification defects identified and fixed before phase close

## Task Commits

Checkpoint task has no dedicated commit (human verification only). Post-verification fixes were applied to:

- `client/main.js` — ghost preview pivot-offset centering
- `client/style.css` — removed `pointer-events: none` from anchor cells
- `puzzles/puzzle_v11.json` — added `difficulty: "medium"`

Prior plan commits (foundation for this verification):

1. **08-01 Task 1: Create puzzles/level_01.json** - `4037739` (feat)
2. **08-01 Task 2: Four surgical edits to server/src/game.js** - `5a3b0c9` (feat)
3. **08-01 fix: correct level_01.json layout from reference images** - `bc269df` (fix)
4. **08-02 Task 1: Add DIFFICULTY_LABELS and update lobby puzzle display** - `801aad1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `client/main.js` - Ghost preview centering fixed using pivot offset so floating piece and ghost track cursor center
- `client/style.css` - Removed `pointer-events: none` from anchor cell CSS rule; hover and ghost preview now work over pre-placed anchor pieces
- `puzzles/puzzle_v11.json` - Added `difficulty: "medium"` so Corner Cut puzzle appears in lobby dropdown (consistent with 08-01 filtering convention)

## Decisions Made

- Ghost preview centering uses pivot-offset: the ghost and floating piece are both offset by their pivot cell position so the cursor sits at the center of the piece, not its top-left corner. This matches natural drag-and-drop UX.
- Anchor cells must not suppress pointer events: `pointer-events: none` was on anchor cells in CSS, which prevented ghost preview from rendering when hovering over those cells. Removed.
- puzzle_v11.json gets `difficulty: "medium"` to be included in lobby filtering — this is optional but consistent with the convention. If Corner Cut should remain an internal test puzzle, remove the field.

## Deviations from Plan

### Post-Verification Fixes (applied before phase close)

**1. [Rule 1 - Bug] Ghost preview not centered at cursor**
- **Found during:** Task 1 — human testing (Scenario 4: bank piece hover/ghost)
- **Issue:** Ghost piece was top-left aligned instead of centered under cursor, making placement feel off
- **Fix:** Applied pivot-offset centering in `client/main.js` ghost preview rendering logic
- **Files modified:** `client/main.js`
- **Verification:** Tested: floating piece and ghost both track cursor center during bank piece hover

**2. [Rule 1 - Bug] Ghost preview does not render over anchor cells**
- **Found during:** Task 1 — human testing (Scenario 4 / Scenario 3 interaction)
- **Issue:** `pointer-events: none` on anchor cells in CSS blocked mouse events, so hovering over an anchor cell did not trigger the ghost preview
- **Fix:** Removed `pointer-events: none` from `.grid-cell.anchor` (or equivalent) rule in `client/style.css`
- **Files modified:** `client/style.css`
- **Verification:** Ghost preview now renders correctly when cursor passes over anchor cells

**3. [Rule 2 - Missing Critical] puzzle_v11.json missing difficulty field**
- **Found during:** Task 1 — human testing (Scenario 1: lobby dropdown)
- **Issue:** puzzle_v11.json ("Corner Cut") had no difficulty field, so it was excluded from the lobby dropdown per 08-01 filtering. This was the intended behavior for test puzzles but became confusing during live testing because Corner Cut was expected to appear.
- **Fix:** Added `difficulty: "medium"` to puzzles/puzzle_v11.json
- **Files modified:** `puzzles/puzzle_v11.json`
- **Verification:** Server's getPuzzleListForClient now includes Corner Cut; lobby dropdown shows "Corner Cut — Mittel"

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical config)
**Impact on plan:** All fixes corrected usability and completeness defects discovered during live human testing. No scope creep — all changes are within Level 1 gameplay correctness.

## Issues Encountered

None beyond the three post-verification bugs documented above. All 5 scenarios passed after fixes were applied.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 8 complete: Level 1 is fully playable from lobby selection through win condition
- Ghost preview, anchor rendering, and difficulty filtering are all working correctly
- Any additional puzzle levels need only a `difficulty` field in JSON to appear in lobby
- No blockers for future phases

---
*Phase: 08-erstes-richtiges-level-bauen*
*Completed: 2026-03-24*
