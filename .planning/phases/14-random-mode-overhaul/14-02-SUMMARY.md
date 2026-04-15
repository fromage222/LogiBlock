---
phase: 14-random-mode-overhaul
plan: 02
subsystem: ui
tags: [random-mode, chaos-events, css-animation, client-js, socket-io]

# Dependency graph
requires:
  - phase: 14-01
    provides: server-side double_turn/reverse_order/blind_bank events, extraTurns gate in socket.js, rebalanced pickRandomEvent weights

provides:
  - Prominent overlay event banner (#event-banner) auto-dismissing after 2.5s for all 7 chaos event types
  - blind_bank visual: .blind class on #piece-bank with dark overlay, 5-second countdown element, stacking-safe timer management
  - rotate_piece delayed trap: pendingRotate flag + 2-second deferred rotation on null→value selectedShapeId transition
  - renderTurnUI extra-turn ⚡ badge: appends ' ⚡' to active player badge when state.extraTurns > 0
  - CSS rules for .piece-bank.blind overlay, .blind-countdown, .event-banner with bannerFadeIn animation

affects: [future-client-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [module-level timer guards (blindTimer/blindInterval cleared before re-arm to prevent stacking), delayed-trap pattern for pendingRotate (set flag on event, fire on next user interaction)]

key-files:
  created: []
  modified:
    - client/main.js
    - client/style.css

key-decisions:
  - "pendingRotate guard uses selectedShapeId !== null to prevent deselect click from triggering rotation — consistent with Phase 9 CONTEXT.md locked decision"
  - "blindTimer and blindInterval are module-level (not per-event) so rapid blind_bank events clear previous timers before re-arming — no stacking"
  - "showGameNotification uses getElementById('event-banner').remove() then appends fresh div to game-screen — avoids stale element issues"
  - "ensureGameNotification / old #game-notification element left intact for showGameError — only showGameNotification upgraded to new banner"

patterns-established:
  - "Timer guard pattern: clearTimeout/clearInterval + null before re-arm — prevents stacking on repeated rapid events"
  - "Delayed-trap pattern: pendingRotate flag set on socket event, consumed on next user interaction transition, single-use (flag cleared before setTimeout)"

requirements-completed: [RAND-01, RAND-02, RAND-03]

# Metrics
duration: 2min
completed: 2026-04-07
---

# Phase 14 Plan 02: Client Overhaul Summary

**Client-side Phase 14 overhaul: blind_bank 5s countdown overlay, rotate_piece delayed-trap, ⚡ extra-turn badge in renderTurnUI, and prominent overlay event banner replacing old small notification**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-07T21:43:46Z
- **Completed:** 2026-04-07T21:45:00Z
- **Tasks:** 2 of 3 (Task 3 is human-verify checkpoint — pending)
- **Files modified:** 2

## Accomplishments
- Replaced old small `#game-notification` paragraph with prominent `#event-banner` div overlay: absolute-positioned above game-screen, 1.4rem bold white text, dark semi-transparent background, bannerFadeIn animation, auto-dismisses after 2.5s, pointer-events:none
- Implemented `blind_bank` event handler: adds `.blind` class to `#piece-bank`, shows `.blind-countdown` element counting from "Blind! 5s" to "Blind! 0s", clears both after 5s; rapid events cancel previous timers before re-arming (no stacking)
- Implemented `rotate_piece` delayed-trap: sets `pendingRotate = true` on event, fires +90° rotation 2 seconds after player next selects a piece (null→value transition only), single-use flag cleared on fire
- Added ⚡ extra-turn badge in `renderTurnUI`: active player badge text gets ' ⚡' suffix when `state.extraTurns > 0`
- All 111 server tests remain passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Client logic — blind_bank handler, rotate_piece delayed trap, extra-turn badge, overlay banner** - `2226312` (feat)
2. **Task 2: Client CSS — .piece-bank.blind overlay, .blind-countdown, .event-banner** - `db6e63e` (style)
3. **Task 3: Human verification** - pending checkpoint

## Files Created/Modified
- `client/main.js` - Added pendingRotate/blindTimer/blindInterval flags; replaced showGameNotification with overlay banner; new randomMode:event handler with blind_bank and rotate_piece; pendingRotate trigger in renderBank click handler; ⚡ badge in renderTurnUI
- `client/style.css` - Added .piece-bank.blind, .piece-bank.blind::after, .blind-countdown, .event-banner, @keyframes bannerFadeIn

## Decisions Made
- `pendingRotate` guard uses `selectedShapeId !== null` to prevent deselect from triggering rotation (consistent with Phase 9 locked decision, now for delayed-trap pattern)
- Module-level `blindTimer` and `blindInterval` both cleared before each `blind_bank` event to prevent stacking — satisfies Pitfall 4 from research
- Old `ensureGameNotification` / `#game-notification` element left intact for `showGameError` — only `showGameNotification` upgraded to new banner style
- `rotate_piece` handler now sets `pendingRotate = true` and returns immediately (no more in-handler `setTimeout`) — trap fires on user interaction

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Human verification (Task 3) required: test all 7 chaos event scenarios in a live browser with 2 clients
- After approval, Phase 14 is complete: all RAND-01/02/03 criteria met end-to-end

---
*Phase: 14-random-mode-overhaul*
*Completed: 2026-04-07*
