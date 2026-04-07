# Phase 14: Random Mode Overhaul - Context

**Gathered:** 2026-04-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend the existing 4 chaos events with 3 new ones (`double_turn`, `reverse_order`, `blind_bank`) and rebalance all 7 event weights. Fix the `rotate_piece` event so it reliably fires. Upgrade the event notification from a small text banner to a prominent overlay banner above the grid. All event logic remains server-side; `blind_bank` and the new notification system are the main client changes.

</domain>

<decisions>
## Implementation Decisions

### New event: double_turn
- Active player gets a second placement this turn
- Gated by `lobby.extraTurns` counter (initialized to 0 in `createLobby`)
- On double_turn event: `extraTurns = 1` (capped — no stacking; second double_turn while one is pending is ignored)
- On successful placement by active player: if `extraTurns > 0`, decrement `extraTurns` and skip `advanceTurn()` (player goes again)
- Return action during extra turn does NOT consume the extra turn — player can return and still has their bonus placement
- All clients see the double turn: notification banner fires + active player badge shows ⚡ symbol while `extraTurns > 0`
- `getPublicState()` must expose `extraTurns` so the client can render the ⚡ badge

### New event: reverse_order
- `lobby.players` array is reversed in-place
- `lobby.activeTurnIndex` reset to 0
- All clients see reordered name badges via the next `game:stateUpdate`
- German notification: "Chaos! Die Reihenfolge wurde umgekehrt!"

### New event: blind_bank
- Affects ALL players (not just the active player)
- Server emits `{ type: 'blind_bank', description: '...' }` in `randomMode:event`
- Client adds `.blind` class to `#piece-bank` for ALL clients in the room
- Duration: 5 seconds with a visible countdown displayed above the piece-bank panel
- Implementation: `setTimeout(5000)` clears `.blind`; a separate 1s interval updates the countdown text
- German notification: "Chaos! Alle sind blind für 5 Sekunden!"

### rotate_piece fix (rework of existing event)
- Problem: event fires AFTER `advanceTurn()`, so the new active player has no piece selected → rotation silently fails
- Fix: delayed-trap mechanism entirely on the client
  - Client receives `randomMode:event { type: 'rotate_piece' }`
  - Client sets `pendingRotate = true`
  - When the player next selects a piece from the bank (selectedShapeId changes from null to a value), a 2-second timer starts
  - After 2 seconds: apply rotation (+90°), re-render ghost preview and bank mini-grid
  - `pendingRotate` is cleared after the rotation fires (single-use trap)
- Server-side: no change needed — `rotate_piece` stays as a valid event type in the weight table

### Event weight rebalance (all 7 events)
- `rotate_piece`: 10%
- `skip_turn`: 15%
- `remove_piece`: 20%
- `shuffle_order`: 15%
- `double_turn`: 15%
- `reverse_order`: 15%
- `blind_bank`: 10%
- Total: 100%

### Notification banner upgrade (all 7 events)
- Replace the existing small `#game-notification` text element with a prominent overlay banner
- Position: centered above the grid (not the whole screen)
- Style: large text, semi-transparent dark background, auto-dismisses after 2–3 seconds
- Applies to ALL 7 chaos events (both existing and new) — unified presentation
- `showGameNotification()` is updated to render this new banner style

### German notification strings (all events)
- Follow existing "Chaos! [name/action]!" pattern
- Exact strings are Claude's discretion within the established pattern

### Claude's Discretion
- Exact CSS for `.blind` class on `#piece-bank` (opacity 0? blur? dark overlay?)
- Exact CSS for the new notification banner (colors, font size, animation)
- Exact countdown display implementation (text above the bank vs. inside the bank)
- German strings for all event descriptions
- Whether to use `transform: rotateY` or plain opacity for the blind effect

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Random Mode implementation
- `server/src/game.js` — `pickRandomEvent()` (line ~378), `triggerRandomEvent()` (line ~396), `shuffleArray()` — extend these for new events
- `server/src/socket.js` — `lobby:randomMode` handler (line ~130), `game:move` place-branch with 30% trigger (line ~207) — `double_turn` requires restructuring the advanceTurn call here
- `client/main.js` — `randomMode:event` handler (line ~939), `showGameNotification()` (line ~798), `ensureGameNotification()` (line ~783) — extend and upgrade

### Phase 9 decisions (locked)
- `.planning/phases/09-random-mode/09-CONTEXT.md` — Original event design decisions; 30% trigger rate is locked; `rotate_piece` client-side pattern is the baseline being reworked

### Phase 14 success criteria
- `.planning/ROADMAP.md` §Phase 14 — exact success criteria for double_turn, reverse_order, blind_bank, weight table

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pickRandomEvent()` in `game.js` — replace weight table in-place; keep same structure
- `triggerRandomEvent()` in `game.js` — add `double_turn`, `reverse_order`, `blind_bank` branches
- `shuffleArray()` in `game.js` — already exists; `reverse_order` uses `Array.prototype.reverse()` (deterministic, not random)
- `advanceTurn()` in `game.js` — called from socket.js; `double_turn` branches AROUND this call
- `returnPiece()` in `game.js` — used by `remove_piece`; return action during extra turn uses same fn
- `showGameNotification()` in `main.js:798` — upgrade this function for new banner style
- `#piece-bank` element in `index.html` — receives `.blind` class

### Established Patterns
- All client-facing strings are German
- `getPublicState()` is the single serialization path — add `extraTurns` field here
- `io.to(roomCode).emit('randomMode:event', event)` broadcast before `game:stateUpdate` — keep this order
- `_forceEventType` param in `triggerRandomEvent()` for test overrides — preserve for new events

### Integration Points
- `socket.js` `game:move` place-branch: needs a `lobby.extraTurns > 0` check before calling `advanceTurn()`
- `createLobby()` in `game.js`: initialize `lobby.extraTurns = 0`
- `renderTurnUI()` in `main.js`: add ⚡ badge when `state.extraTurns > 0` and it's current player's turn
- `client/style.css`: add `.blind` rule and new `.event-banner` notification styles

</code_context>

<specifics>
## Specific Ideas

- `blind_bank` should be dramatic — a 5-second countdown visible above the bank makes it feel like a ticking clock
- The new notification banner should be hard to miss — "kurz über dem grid für alle events" (briefly above the grid)
- `rotate_piece` "delayed trap" mechanic: player selects a piece and 2 seconds later it rotates — creates tension and unpredictability without the selection-timing bug

</specifics>

<deferred>
## Deferred Ideas

- Variable event probability slider (e.g. 10%–60%) — deferred from Phase 9, still out of scope
- Event history log visible to players — out of scope
- rotate_piece affecting ALL players' held pieces — not selected; only active player affected via delayed trap

</deferred>

---

*Phase: 14-random-mode-overhaul*
*Context gathered: 2026-04-07*
