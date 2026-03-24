# Phase 9: Random Mode - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a "Random Mode" toggle to the lobby (host-controlled). When active, after each completed turn there is a 30% chance that a random disruptive event fires. Four possible events: remove a placed piece, rotate the active player's held piece, skip the active player's turn, or shuffle the turn order. All event logic is server-side. Non-host players see the toggle state but cannot change it.

</domain>

<decisions>
## Implementation Decisions

### Lobby toggle
- Host-only control (consistent with puzzle selection pattern — `lobby:selectPuzzle`)
- New socket event `lobby:randomMode` with host guard, like `lobby:selectPuzzle`
- `getPublicState()` exposes `randomMode: bool` so all clients see current state
- Non-host clients: toggle visible but disabled (read-only)
- Initial state: `false` when lobby is created

### Event trigger
- After each completed turn (place or return action that succeeds), 30% chance an event fires
- Trigger point: in the turn-completion handler in `socket.js`, after `advanceTurn()`
- Server picks the event and broadcasts result; no client involvement in selection

### Event pool (4 events)
1. **remove_piece** — A random non-anchor placed piece is removed back to the bank
2. **rotate_piece** — The active player's currently selected piece is rotated 90° CW (server signals, client applies)
3. **skip_turn** — Active player's turn is skipped (advanceTurn called a second time)
4. **shuffle_order** — All players are randomly reshuffled in `lobby.players` array; `activeTurnIndex` set to 0

### Event weighting (heavier events rarer)
- `rotate_piece`: 35%
- `skip_turn`: 35%
- `remove_piece`: 15%
- `shuffle_order`: 15%

### Edge cases
- `rotate_piece` with no piece selected by active player → event skipped, no fallback event (slot wasted; players can protect by deselecting)
- `remove_piece` with no movable pieces on grid → event skipped
- `skip_turn` with only 1 player → event skipped (would skip back to same player)

### Event feedback
- Server broadcasts `randomMode:event` to all players in room with: `{ type, description }` (e.g. `{ type: 'remove_piece', description: 'P04 wurde entfernt!' }`)
- Client shows a short banner (similar to existing `#lobby-notification` pattern but during gameplay — new `#game-notification` element or reuse existing)
- German notification strings for all 4 event types

### rotate_piece implementation note
- Server cannot directly rotate the client's `selectedRotation` (that's client state)
- Server sends event type `rotate_piece` in `randomMode:event` broadcast
- Client listens, rotates `selectedRotation` by +90, re-renders ghost preview

### Claude's Discretion
- Exact banner positioning and CSS for in-game notifications
- Whether to add `#game-notification` element or reuse a toast pattern
- Duration the banner is visible (e.g. 3 seconds)
- Exact German notification strings (e.g. "Chaos! P04 wurde entfernt!")

</decisions>

<specifics>
## Specific Ideas

- Toggle appears in lobby as a slider (not a checkbox) — visual distinction from other controls
- Events feel like "chaos" — the mode is intentionally disruptive to the cooperative puzzle

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lobby:selectPuzzle` handler (`server/src/socket.js`) — exact pattern for `lobby:randomMode` (host guard, update state, broadcast public state)
- `returnPiece()` (`server/src/game.js:141`) — handles removing a piece from grid back to bank; reuse for `remove_piece` event
- `advanceTurn()` (`server/src/game.js:167`) — call twice for `skip_turn` event
- `lobby.players` array — shuffle in-place for `shuffle_order` event, reset `activeTurnIndex = 0`
- `#lobby-notification` (`client/index.html`) — existing notification banner pattern to follow for game-screen equivalent

### Established Patterns
- Host-guard pattern: `if (!isHost) return socket.emit('error', ...)` — already in `lobby:selectPuzzle`
- Public state broadcast: `io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode))` — used after every mutation
- German UI labels: all player-facing strings are German (see `DIFFICULTY_LABELS`)

### Integration Points
- `socket.js` turn-completion handler (after `placePiece` or `returnPiece` succeeds and `advanceTurn` is called) — add 30% random event check here
- `getPublicState()` (`server/src/game.js:175`) — add `randomMode` field (from `lobby.randomModeEnabled`)
- `createLobby()` (`server/src/game.js:30`) — initialize `randomModeEnabled: false`
- `client/main.js` — add `socket.on('randomMode:event', ...)` handler; add lobby toggle rendering

</code_context>

<deferred>
## Deferred Ideas

- Variable difficulty/intensity slider (e.g. 10%–60% event chance) — Phase 9 uses fixed 30%
- More event types (e.g. freeze a player, swap two pieces) — future extension
- Event history log visible to players — deferred, not in scope

</deferred>

---

*Phase: 09-random-mode*
*Context gathered: 2026-03-24*
