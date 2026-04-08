---
status: complete
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
  artifacts: []
  missing: []

- truth: "rotate_piece trap fires +90° rotation on selected piece before it is placed"
  status: failed
  reason: "User reported: klappt nicht er sagt zwar das piece wurde gedreht aber erst nachdem man es schon gesetzt hat (piece rotation message appears only after the piece is already placed — too late)"
  severity: major
  test: 4
  artifacts: []
  missing: []

- truth: "reverse_order event fires and reverses turn order visibly"
  status: failed
  reason: "User reported: never happened (event never fired during testing — probability too low to observe)"
  severity: major
  test: 7
  artifacts: []
  missing: []

- truth: "All 7 event types appear with roughly equal distribution after 15-20 turns"
  status: failed
  reason: "User reported: mostly double turn (weight distribution skewed — double_turn dominates, rare events like blind_bank and reverse_order never appear)"
  severity: major
  test: 8
  artifacts: []
  missing: []
