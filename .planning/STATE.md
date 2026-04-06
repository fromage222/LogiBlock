---
gsd_state_version: 1.0
milestone: v1.2
milestone_name: Spielqualität & Features
status: unknown
stopped_at: Phase 12 context gathered
last_updated: "2026-04-06T17:13:38.617Z"
progress:
  total_phases: 12
  completed_phases: 8
  total_plans: 17
  completed_plans: 17
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-06)

**Core value:** Die Lösung liegt ausschließlich auf dem Server — jeder Zug wird serverseitig validiert, kein Client sieht die Lösung, kein Cheat ist möglich.
**Current focus:** Phase 11 — profanity-filter

## Current Position

Phase: 11 (profanity-filter) — EXECUTING
Plan: 1 of 1

## Performance Metrics

**Velocity (v1.0 baseline):**

- Total plans completed: 11 (v1.0)
- v1.0 timeline: 9 days, 3 phases

**By Phase (v1.0):**

| Phase | Plans | Notes |
|-------|-------|-------|
| 1. Foundation | 3 | - |
| 2. Game Loop | 5 | - |
| 3. Timer und Leaderboard | 3 | - |

*v1.1 metrics will accumulate from Phase 4 onward*
| Phase 04-schema-and-server-data-model P01 | 3min | 2 tasks | 3 files |
| Phase 04-schema-and-server-data-model P02 | 20min | 2 tasks | 2 files |
| Phase 05-server-logic-fixes P01 | 2min | 2 tasks | 2 files |
| Phase 06-client-grid-rendering P01 | 15 | 2 tasks | 2 files |
| Phase 08-erstes-richtiges-level-bauen P01 | 2 | 2 tasks | 2 files |
| Phase 08-erstes-richtiges-level-bauen P02 | 1min | 1 tasks | 1 files |
| Phase 08-erstes-richtiges-level-bauen P03 | ~30min | 1 tasks | 3 files |
| Phase 09-random-mode P01 | 2min | 2 tasks | 2 files |
| Phase 09-random-mode P02 | 2min | 2 tasks | 3 files |
| Phase 09-random-mode P03 | 10min | 2 tasks | 2 files |
| Phase 10 P01 | 15min | 2 tasks | 3 files |
| Phase 10 P02 | 40min | 1 tasks | 1 files |
| Phase 10 P03 | ~5min | 1 tasks | 0 files |
| Phase 11-profanity-filter P01 | 3min | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

v1.1 decisions locked by research:

- Click disambiguation: `setTimeout(200ms)` + `clearTimeout` (not `event.detail`) — resilient to OS dblclick timing
- Inactive cell visual: `background: transparent` + `border: none` + `pointer-events: none` (not `visibility: hidden`)
- Delay constant: `DBLCLICK_DELAY = 200` (named constant, not inline magic number)
- Sentinel representation: `{ inactive: true }` object (not `null`) — existing `placePiece()` guard rejects it for free
- [Phase 04-schema-and-server-data-model]: inactiveCells cross-check gated on field presence — backward-compatible with existing puzzles
- [Phase 04-schema-and-server-data-model]: puzzle_v11.json Corner Cut: 10 pieces (P01-P07 tetrominoes, P08-P10 pentominoes), 43 active cells in 5x9 grid with inactiveCells [[4,7],[4,8]]
- [04-02]: Single-pass Array.from with Set-based 'r-c' key lookup for inactiveCells — O(1) per cell, single allocation
- [05-01]: Sentinel guard as first statement in checkWin() inner loop — before expectedId lookup — to short-circuit all downstream comparisons
- [05-01]: Stale NOTE (Phase 5) comment removed from buildInitialGrid() after fix was applied
- [Phase 06-client-grid-rendering]: pointer-events: none on .grid-cell.inactive satisfies GRID-05 and GRID-06 in a single CSS property without JS event handler changes
- [Phase 06-client-grid-rendering]: buildMiniGrid pointer-events: none added to container and cells — cursor piece was intercepting bank clicks (auto-fix)
- [Phase 08-erstes-richtiges-level-bauen]: difficulty field as discriminator: puzzles without difficulty are internal test puzzles, excluded from client puzzle list
- [Phase 08-erstes-richtiges-level-bauen]: createLobby defaults via find(p => p.difficulty != null) with fallback to first map entry — safe against empty real-puzzle set
- [Phase 08-erstes-richtiges-level-bauen]: DIFFICULTY_LABELS constant defined once at top-level shared between puzzle:list handler and renderLobbyUpdate non-host branch
- [Phase 08-erstes-richtiges-level-bauen]: Lobby non-host display switched from English 'Selected puzzle:' to German 'Ausgewähltes Puzzle:' to match game UI convention
- [08-03]: Ghost preview uses pivot-offset centering so floating piece and ghost both track cursor center, not top-left corner
- [08-03]: Anchor cells must not have pointer-events: none — hover/ghost requires events to pass through to grid handlers
- [08-03]: puzzle_v11.json gets difficulty: medium so Corner Cut appears in lobby; consistent with 08-01 filtering convention
- [Phase 09-random-mode]: triggerRandomEvent _forceEventType optional param for test overrides — avoids Math.random stubbing; rotate_piece never returns null server-side; skip_turn null for 1 player; remove_piece null if no movable pieces; shuffle_order always fires
- [Phase 09-random-mode]: Toggle wired once via _randomModeWired property on DOM element — prevents duplicate listeners on repeated lobby:update events
- [Phase 09-random-mode]: randomMode:event rotate_piece guard requires selectedShapeId !== null — prevents rotation state drift when no piece selected (RESEARCH.md Pitfall 1)
- [Phase 09-random-mode]: makeRandomModeLobby helper uses puzzle_01 (A/B/C shapes) because default lobby puzzle is level_01 (P01-P10 shapes) — test isolation without changing lobby creation logic
- [Phase 09-random-mode]: 30% Math.random gate lives in socket.js (not game.js) — socket layer owns the probability policy, game.js owns the event execution logic
- [Phase 10]: Rotation buttons wired once outside renderGrid to prevent duplicate listeners on re-render; e.stopPropagation() prevents deselect cascade
- [Phase 10]: Single click handler in renderGrid directly emits game:move (no setTimeout); dblclick/DBLCLICK_DELAY/clickTimer interaction model fully removed
- [Phase 10]: --cell-size uses min(calc((100vw - 240px) / 9), 60px) so grid fills viewport minus bank width, capped at 60px; #game-screen max-width relaxed to 1200px
- [Phase 10]: Touch placement confirmation uses synthesized click (not touchend handler) — avoids double-fire and reuses existing click handler for both desktop and touch
- [Phase 10]: Document-level touchmove wired once outside renderGrid; elementFromPoint for reliable grid cell lookup under finger (Pitfall 2 avoidance)
- [Phase 10]: longPressTimer is module-level (not per-cell) — renderGrid rebuilds DOM on every game:stateUpdate; per-cell variable would leak stale timers
- [Phase 11-profanity-filter]: bad-words@3.0.4 over v4.0.0: v4 type:module breaks require() on Node 24; v3.0.4 is pure CJS
- [Phase 11-profanity-filter]: joinRoom profanity check placed before getLobby — profane names rejected before room lookup per CONTEXT.md locked decision

### Roadmap Evolution

- Phase 8 added: Erstes richtiges Level bauen — Design und Implementierung eines finalen Puzzle-Levels als echtes Spielerlebnis
- Phase 9 added: Random Mode
- Phase 10 added: Steuerung überarbeiten und Tablet integration

### Pending Todos

None.

### Blockers/Concerns

None — Phase 10 complete and human-verified. All 23 interaction scenarios passed: desktop single-click-place, rotation buttons (CW/CCW), R key, touch drag-to-preview, ghost-confirm tap, long-press return, responsive CSS auto-scale, portrait overlay, and regression checks.

## Session Continuity

Last session: 2026-04-06T17:13:38.614Z
Stopped at: Phase 12 context gathered
Resume file: .planning/phases/12-controls-modal/12-CONTEXT.md
