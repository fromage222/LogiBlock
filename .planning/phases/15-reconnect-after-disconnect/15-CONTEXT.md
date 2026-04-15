# Phase 15: Reconnect After Disconnect - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

A player who disconnects mid-game has a 30-second hold window to reconnect and resume their slot. During the window, turns are skipped over the disconnected slot and the game keeps running. After 30s without reconnect, the slot is evicted and the game continues. Lobby-phase disconnect behavior is unchanged.

</domain>

<decisions>
## Implementation Decisions

### Reconnect trigger mechanism
- Auto-reconnect only — no page-reload recovery
- Socket.IO auto-reconnect fires a `connect` event on the client; if `gameScreen` is currently active, emit `reconnectRoom` with `{ roomCode: myRoomCode, playerName: myPlayerName }`
- Guard by screen state (game screen active) — not a flag — to avoid spurious emit on initial page load
- Page refresh / tab close: player lands on start screen normally; slot expires after 30s

### Player list during hold window
- Disconnected slot remains in the player list, visually dimmed with a "(reconnecting)" badge
- Turn list and badges reflect `{ disconnected: true }` from server public state
- Remaining players also see a transient notification: "X disconnected — reconnecting..."

### Reconnect notifications
- On successful reconnect: emit `game:stateUpdate` to all players; show "X reconnected!" via `showGameNotification` to remaining players
- On failed reconnect (slot already evicted): server emits `room:error "Session expired"` on the reconnect attempt; client catches it with existing `room:error` handler, shows message, drops to start screen

### Reconnecting player's device UI
- On socket disconnect while game screen is active: show "Reconnecting..." overlay (semi-transparent, with spinner text) covering the game screen
- Overlay dismisses automatically when `game:stateUpdate` arrives after successful reconnect
- If session expired (room:error): overlay replaced by error message → start screen

### Host mid-game disconnect
- During game phase, host is treated identically to any other player — gets 30s hold, turns skip over them, others keep playing
- Only lobby-phase host disconnect is unchanged (lobby closes immediately)
- If host's 30s expires without reconnect: oldest remaining player is promoted to host (`lobby.hostId` updated), slot evicted, game continues
- Promotion is silent — no notification needed (host powers aren't used during an active game)

### Turn skipping during hold
- `advanceTurn()` skips slots where `player.disconnected === true`
- `advanceTurn` must loop until it lands on a connected player (cycle guard to avoid infinite loop if all disconnect)
- All-disconnect edge case: if no connected players remain after hold-slot cleanup, delete lobby

### Claude's Discretion
- Exact spinner/overlay CSS design
- Reconnecting badge styling (color, text)
- Timer implementation for the 30s setTimeout (module-level vs. Map keyed by socketId — researcher can decide)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external specs — requirements fully captured in decisions above and the roadmap success criteria.

### Phase requirements
- `.planning/ROADMAP.md` §Phase 15 — 5 success criteria and 3 plan outlines
- `.planning/REQUIREMENTS.md` §RECON-01, RECON-02, RECON-03

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `socket.on('disconnecting', ...)` in `server/src/socket.js:237` — existing handler to be modified for game-phase hold vs. lobby-phase evict
- `advanceTurnIfActive(lobby, socket.id)` in `server/src/game.js` — already called before removePlayer; needs to account for held disconnected slot
- `removePlayer(roomCode, socketId)` in `server/src/game.js:356` — currently immediate; Phase 15 defers this to the 30s timeout callback
- `myRoomCode` and `myPlayerName` module-level vars in `client/main.js:24,26` — survive Socket.IO auto-reconnect; already available for reconnectRoom emit
- `showGameNotification()` in `client/main.js` — existing notification system; reuse for "X disconnected", "X reconnected!" banners
- `showScreen()` in `client/main.js:128` — for dropping to start-screen on session expiry
- `room:error` handler in `client/main.js:1025` — already shows inline error + returns to start screen; `"Session expired"` fits this path

### Established Patterns
- `disconnecting` (not `disconnect`) event used for cleanup — `socket.rooms` still populated; MUST preserve this
- `socket.data.roomCode` is authoritative room reference on disconnect
- `getPublicState()` in `game.js:196` is the sole serialization path — add `disconnected: true` to player objects here so client can render badge
- Transient notifications: `showGameNotification(msg)` used for random mode events in Phase 14; same pattern for reconnect events
- Guard pattern for wiring listeners: `_randomModeWired` flag pattern (Phase 9) — consider similar guard if socket `connect` listener needs to be wired once

### Integration Points
- New `reconnectRoom` socket event handler in `socket.js` — server looks up lobby by roomCode, finds player by name, re-associates socketId
- `connect` event in `client/main.js` — add handler that checks `gameScreen.classList.contains('active')` and emits `reconnectRoom`
- `lobby.players` array — extend player objects with `{ disconnected: boolean, disconnectedAt: number }` during hold period
- `advanceTurn()` in `game.js:169` — modify to skip `disconnected: true` slots in a loop

</code_context>

<specifics>
## Specific Ideas

- Existing comment at `client/main.js:200`: "check by name — socket.id may differ if reconnected" — the codebase already anticipated this scenario; socketId re-association is the right approach
- The "Session expired" path reuses `room:error` — no new event type needed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-reconnect-after-disconnect*
*Context gathered: 2026-04-09*
