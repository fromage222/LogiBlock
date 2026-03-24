---
phase: 08-erstes-richtiges-level-bauen
plan: "02"
subsystem: ui

tags: [lobby, difficulty, client, puzzle-display, german-ui]

# Dependency graph
requires:
  - phase: 08-erstes-richtiges-level-bauen
    plan: "01"
    provides: "getPuzzleListForClient returns {id, name, difficulty}, getPublicState exposes selectedPuzzleDifficulty"
provides:
  - "DIFFICULTY_LABELS constant: easy/medium/hard mapped to Einfach/Mittel/Schwer"
  - "puzzle:list handler formats host dropdown as 'Level 1 — Einfach'"
  - "renderLobbyUpdate non-host branch shows 'Ausgewähltes Puzzle: Level 1 — Einfach'"
affects:
  - lobby host dropdown display
  - lobby non-host selected puzzle display

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DIFFICULTY_LABELS constant defined once at top-level (not inline in handlers) — shared between puzzle:list and renderLobbyUpdate"
    - "Fallback: DIFFICULTY_LABELS[key] ?? key — unknown difficulty keys pass through as-is"
    - "Conditional format: diffLabel ? 'Name — Label' : 'Name' — graceful when difficulty missing"

key-files:
  created: []
  modified:
    - client/main.js

key-decisions:
  - "DIFFICULTY_LABELS constant placed after Phase 7 click disambiguation state block and before rotation helpers — single definition, no duplication"
  - "Fallback to raw difficulty string (DIFFICULTY_LABELS[key] ?? key) so unknown future keys surface rather than silently disappear"
  - "Label changed from English 'Selected puzzle:' to German 'Ausgewähltes Puzzle:' to match game UI convention"

patterns-established:
  - "Difficulty display pattern: const diffLabel = key ? (DIFFICULTY_LABELS[key] ?? key) : ''; then conditional concat"

requirements-completed: [LVL-04, LVL-05]

# Metrics
duration: 1min
completed: 2026-03-24
---

# Phase 8 Plan 02: Client Difficulty Display in Lobby Summary

**DIFFICULTY_LABELS constant added to client/main.js; host dropdown shows "Level 1 — Einfach" and non-host display shows "Ausgewähltes Puzzle: Level 1 — Einfach"**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-24T08:53:37Z
- **Completed:** 2026-03-24T08:54:50Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added `DIFFICULTY_LABELS` constant near top of client/main.js (after Phase 7 state block, before rotation helpers) mapping easy/medium/hard to Einfach/Mittel/Schwer
- Updated `puzzle:list` socket handler: dropdown option text becomes "Level 1 — Einfach" when difficulty is present, falls back to name-only for puzzles without difficulty
- Updated `renderLobbyUpdate` non-host branch: displays "Ausgewähltes Puzzle: Level 1 — Einfach" using `state.selectedPuzzleDifficulty` from getPublicState (added in plan 08-01), switched from English to German label

## Task Commits

Each task was committed atomically:

1. **Task 1: Add DIFFICULTY_LABELS and update lobby puzzle display** - `801aad1` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `client/main.js` - Three targeted edits: DIFFICULTY_LABELS constant (6 lines), puzzle:list handler diffLabel logic (2 lines), renderLobbyUpdate non-host difficulty display (6 lines)

## Decisions Made

- DIFFICULTY_LABELS constant defined once at top level rather than inline in each handler — single source of truth for language strings, consistent with existing constant patterns (DBLCLICK_DELAY, PIECE_COLORS)
- Fallback `DIFFICULTY_LABELS[p.difficulty] ?? p.difficulty` ensures unknown difficulty keys (future levels) pass through as raw strings rather than silently disappearing from the display
- German label "Ausgewähltes Puzzle:" replaces English "Selected puzzle:" to match the game's German UI convention documented in CONTEXT.md

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Lobby now fully displays difficulty: host sees "Level 1 — Einfach" in dropdown, non-host sees "Ausgewähltes Puzzle: Level 1 — Einfach"
- Phase 8 plans complete: Level 1 puzzle created (08-01), difficulty surfaced in lobby UI (08-02)
- Any additional puzzle levels just need a `difficulty` field in their JSON to appear in lobby with correct label

## Self-Check

- [x] client/main.js modified: confirmed (7/7 automated checks pass)
- [x] DIFFICULTY_LABELS defined exactly once: confirmed (count check passes)
- [x] Commit 801aad1 exists: confirmed

## Self-Check: PASSED

---
*Phase: 08-erstes-richtiges-level-bauen*
*Completed: 2026-03-24*
