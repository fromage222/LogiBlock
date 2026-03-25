---
plan: 09-04
phase: 09-random-mode
status: complete
completed: 2026-03-25
---

# Summary: Human Verification — Random Mode

## What was verified

Random Mode feature verified end-to-end by human tester across all 7 scenarios.

## Scenarios passed

1. **Lobby toggle (host)** — "Chaos-Modus" slider visible in host controls, slides to ON
2. **Lobby toggle (non-host)** — "Chaos-Modus: Aktiv" appears when host enables, disappears when disabled
3. **In-game events** — German chaos banner fires after piece placements, auto-dismisses after 3 seconds
4. **rotate_piece** — Ghost preview rotates 90° after 1.2s delay (adjusted during verification)
5. **remove_piece** — Piece removed from grid and returned to bank
6. **No events without Chaos-Modus** — No banner fires when mode is OFF
7. **No event on win** — Win screen appears cleanly without chaos banner

## Adjustments made during verification

- `rotate_piece` delay: added 1200ms setTimeout so rotation applies after player has picked a new piece
- Event probabilities rebalanced: rotate 30%, skip 30%, remove 20%, shuffle 20% (was 35/35/15/15)

## Key files

- `client/main.js` — rotate_piece delayed handler
- `server/src/game.js` — updated pickRandomEvent() weights
