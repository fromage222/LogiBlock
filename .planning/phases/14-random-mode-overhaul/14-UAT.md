---
status: diagnosed
phase: 14-random-mode-overhaul
source: [14-01-SUMMARY.md, 14-02-SUMMARY.md]
started: 2026-04-08T00:00:00Z
updated: 2026-04-08T00:00:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Start the application from scratch (both server and client). Server boots without errors, and a browser connecting to the game lobby loads successfully without console errors.
result: pass

### 2. Event Banner Display
expected: In a random-mode game, trigger any chaos event (play a few turns — events fire at ~30% chance per turn). When an event fires, a prominent overlay banner appears above the game screen with the event name/description in bold white text on a dark semi-transparent background. The banner fades out and disappears automatically after ~2.5 seconds.
result: pass

### 3. blind_bank Visual Overlay
expected: When a blind_bank event fires (banner shows "Blind Bank!" or similar), the piece bank panel gets a dark overlay covering it (you can no longer clearly see the pieces). A "Blind! 5s" countdown element appears and ticks down each second (5s → 4s → 3s → 2s → 1s → 0s), then both the overlay and countdown clear automatically after 5 seconds.
result: issue
reported: "erhöhe die wahrscheinlichkeit noch nie erreicht"
severity: major

### 4. rotate_piece Delayed Trap
expected: When a rotate_piece event fires (banner shows "Rotate Piece!" or similar), nothing happens immediately. The next time you click to select a piece in the bank, that piece gets rotated +90° after a ~2-second delay (not instantly). The trap is single-use — only the first piece selection after the event triggers it.
result: issue
reported: "klappt nicht er sagt zwar das piece wurde gedreht aber erst nachdem man es schon gesetzt hat"
severity: major

### 5. double_turn Extra-Turn Badge
expected: When a double_turn event fires (banner shows "Double Turn!" or similar), the active player's turn badge gains a ⚡ symbol (e.g., "Player 1 ⚡"). That player gets to place another piece before the turn advances to the next player. After their second placement, the ⚡ is gone and the turn moves normally.
result: pass

### 6. double_turn No-Stack Cap
expected: If double_turn fires while a player already has an active ⚡ (extraTurns > 0), no second extra turn is granted. The banner may still appear, but the ⚡ count does not increment — the player still only gets one bonus turn total.
result: pass

### 7. reverse_order Turn Reversal
expected: When a reverse_order event fires (banner shows "Reverse Order!" or similar), the turn order is immediately reversed. The player who was last in the queue is now next, and the sequence continues in reverse from the current active player. The turn indicator reflects the new order.
result: issue
reported: "never happened"
severity: major

### 8. All 7 Event Types Accessible
expected: After several rounds in random mode (15–20 turns), you have seen at least a few different event types from the full set: rotate_piece, skip_turn, remove_piece, shuffle_order, double_turn, reverse_order, blind_bank. No single event dominates exclusively — the distribution feels varied.
result: issue
reported: "mostly double turn"
severity: major

## Summary

total: 8
passed: 4
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "When blind_bank fires, piece bank shows dark overlay with 5s countdown"
  status: failed
  reason: "User reported: erhöhe die wahrscheinlichkeit noch nie erreicht (event never fired during testing — probability too low to observe)"
  severity: major
  test: 3
  root_cause: "blind_bank has 10% weight among events, and events only fire at 30% per turn. Effective rate = 3% per turn. In 15–20 turns, expected ~0.45–0.6 occurrences — statistically normal to see 0. Combined with null-event skipping (some events return null and socket.js silently skips, wasting the trigger slot), actual observability is even lower."
  artifacts:
    - path: "server/src/game.js"
      issue: "pickRandomEvent(): blind_bank weight (10%) combined with 30% per-turn gate yields 3% effective rate — too low to observe in short sessions"
    - path: "server/src/socket.js"
      issue: "When triggerRandomEvent() returns null, the event slot is silently wasted (no retry) — further reduces effective diversity"
  missing:
    - "Increase base event rate from 30% to 50% in socket.js game:move place-branch"
    - "When triggerRandomEvent() returns null, retry once with a different event type instead of silently skipping"

- truth: "rotate_piece trap fires +90° rotation on selected piece before it is placed"
  status: failed
  reason: "User reported: klappt nicht er sagt zwar das piece wurde gedreht aber erst nachdem man es schon gesetzt hat (piece rotation message appears only after the piece is already placed — too late)"
  severity: major
  test: 4
  root_cause: "The bank click handler sets pendingRotate=true and immediately assigns selectedShapeId, then starts a setTimeout(2000). If the player places the piece within 2 seconds (clicks a grid cell), game:move is emitted, selectedShapeId is cleared, and the server responds with game:stateUpdate which re-renders everything. The setTimeout then fires on stale state — incrementing selectedRotation and calling updateBankSelection() AFTER re-render. The notification 'piece rotated' appears (server-side, correctly), but the visual rotation effect on the client applies too late, after placement already occurred."
  artifacts:
    - path: "client/main.js"
      issue: "renderBank click handler lines ~397–408: setTimeout(2000) delay allows placement before rotation fires — rotation should apply synchronously on piece selection, not 2 seconds later"
  missing:
    - "Apply the +90° rotation immediately (synchronously) when pendingRotate=true and a piece is selected, removing the 2-second setTimeout"
    - "The 'trap' effect is preserved (player gets an unexpected rotation) but it must apply BEFORE they can place the piece"

- truth: "reverse_order event fires and reverses turn order visibly"
  status: failed
  reason: "User reported: never happened (event never fired during testing — probability too low to observe)"
  severity: major
  test: 7
  root_cause: "Same root cause as blind_bank: reverse_order has 15% weight × 30% per-turn rate = 4.5% effective rate. In 15–20 turns, expected 0.67–0.9 occurrences — statistically common to get 0. Additionally, reverse_order resets activeTurnIndex to 0, which may feel invisible to players who don't track the full turn queue."
  artifacts:
    - path: "server/src/game.js"
      issue: "pickRandomEvent(): reverse_order at 15% weight × 30% gate = 4.5% effective rate per turn — too low for reliable observability in short test sessions"
    - path: "server/src/socket.js"
      issue: "No retry on null event — wasted trigger slots reduce effective event diversity further"
  missing:
    - "Increase base event rate from 30% to 50% in socket.js"
    - "Retry on null result in socket.js event trigger block"

- truth: "All 7 event types appear with roughly equal distribution after 15-20 turns"
  status: failed
  reason: "User reported: mostly double turn (weight distribution skewed — double_turn dominates, rare events like blind_bank and reverse_order never appear)"
  severity: major
  test: 8
  root_cause: "Three compounding factors: (1) Low sampling — at 30% event rate, only ~4–6 events fire in 15–20 turns; with 7 event types at 10–20% each, it is statistically normal to see 0 of the rarest types. (2) Null-event waste — remove_piece returns null when no pieces are on the grid (early game), and double_turn returns null when extraTurns>0; socket.js silently skips nulls instead of retrying, so some trigger slots produce no observable event. (3) Visibility bias — double_turn is the most visually prominent event (⚡ badge + extra placement) so it feels dominant even if other events fire with similar frequency."
  artifacts:
    - path: "server/src/socket.js"
      issue: "Random event rate is 30% (Math.random() < 0.30). With 7 event types, session too short to observe all events. Null returns from triggerRandomEvent silently wasted — no retry."
    - path: "server/src/game.js"
      issue: "triggerRandomEvent() returns null for: remove_piece (no grid pieces), double_turn (extraTurns>0), skip_turn (1 player) — these wasted slots reduce effective distribution diversity"
  missing:
    - "Increase event rate from 30% to 50% in socket.js"
    - "Retry triggerRandomEvent() once on null return, picking a different event type, to guarantee every trigger slot produces an observable event"
