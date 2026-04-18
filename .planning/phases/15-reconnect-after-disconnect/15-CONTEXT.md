# Phase 15: Reconnect After Disconnect - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning (revised — simplified scope)

<domain>
## Phase Boundary

A player who reloads their browser mid-game can rejoin the same game and continue playing. The server keeps the slot alive for a short hold window (5–10s) — enough for a browser reload. During the hold, the game continues and their turn is skipped. All other Phase 15 complexity (30s timer, disconnect notifications, reconnecting overlay, host promotion) is removed.

</domain>

<decisions>
## Implementation Decisions

### Reconnect trigger mechanism
- On `connect`, client checks localStorage for room code + player name; if present, always emits `reconnectRoom` — no screen-state guard needed
- `pendingAutoRejoin` flag set only on start screen path (initial page load); not set on Socket.IO auto-reconnect (game screen)
- This handles both: page reload during game AND returning from start screen to a lobby/game

### Server hold window
- Hold window: 5–10 seconds (not 30s) — sufficient for a browser reload, no complex timer visualization
- `player.disconnected = true` + `player.disconnectedAt` set during hold; slot not immediately evicted
- On hold expiry: slot evicted normally (`lobby:playerLeft` broadcast, game continues)

### Player list during hold
- Disconnected slot stays dimmed in the player list — no "(reconnecting)" badge text, no notification to other players
- Other players see a briefly-grayed-out name; no banner or toast

### Turn skipping during hold
- `advanceTurn()` skips slots where `player.disconnected === true`
- Loop guard to avoid infinite loop if all players disconnect
- All-disconnect edge case: delete lobby if no connected players remain

### Reconnecting player's device
- No "Reconnecting..." overlay
- After reload: `connect` fires → `reconnectRoom` emitted → server re-associates socketId and responds with `game:stateUpdate` → client renders game screen directly
- No special animation or hold-state UI needed

### Session expiry (hold window exceeded)
- If player reloads after the hold window has expired and slot is evicted: server emits `room:error` (existing handler) → client shows error and drops to start screen
- No new event type needed; existing `room:error` handler covers this path

### Host mid-game disconnect
- Host treated identically to any player — 5–10s hold, turn skipped, no host promotion
- If host hold expires: existing player-left eviction logic applies (oldest player becomes host or lobby closes — Claude's discretion)

### Claude's Discretion
- Exact hold window duration (5s vs. 10s — pragmatic choice)
- Timer implementation (setTimeout per player on server)
- Exact CSS for dimmed slot (opacity or color desaturation)
- Host-eviction promotion logic if host's slot expires

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
- `socket.on('disconnecting', ...)` in `server/src/socket.js` — existing handler; modify to set hold instead of immediate evict in game phase
- `removePlayer(roomCode, socketId)` in `server/src/game.js` — currently immediate; defer to hold-expiry callback
- `advanceTurn()` in `server/src/game.js` — modify to skip `player.disconnected === true` slots
- `myRoomCode` and `myPlayerName` module-level vars in `client/main.js:24,26` — survive Socket.IO auto-reconnect; available for reconnectRoom emit
- `room:error` handler in `client/main.js:1025` — already shows inline error + returns to start screen; covers session-expired path
- `getPublicState()` in `game.js:196` — sole serialization path; add `disconnected: true` to player objects here for dimmed slot rendering

### Established Patterns
- `disconnecting` (not `disconnect`) event for cleanup — `socket.rooms` still populated; MUST preserve
- `socket.data.roomCode` is authoritative room reference on disconnect
- localStorage keys: `logiblock_roomCode`, `logiblock_playerName` — already written on join, used by reconnect handler

### Integration Points
- `connect` handler in `client/main.js` — already emits `reconnectRoom`; remove startScreen guard so it fires from any screen
- New `reconnectRoom` server handler — look up lobby by roomCode, find player by name, re-associate socketId, emit `game:stateUpdate`
- `lobby.players` array — extend player objects with `{ disconnected: boolean, disconnectedAt: number }` during hold
- `advanceTurn()` — add loop to skip disconnected slots (cycle guard needed)

</code_context>

<specifics>
## Specific Ideas

- The `connect` handler in `client/main.js` already emits `reconnectRoom` with localStorage credentials — the only change needed is removing the `startScreen.classList.contains('active')` guard so it also fires during Socket.IO auto-reconnect (game screen path)
- The existing comment at `client/main.js:200`: "check by name — socket.id may differ if reconnected" confirms this design was anticipated from the start

</specifics>

<deferred>
## Deferred Ideas

- 30-second hold window with "(reconnecting)" badge and "X disconnected" notifications — removed from scope; too complex for the Uni-Abgabe
- "Reconnecting..." client overlay — removed; direct rejoin is simpler and sufficient
- Host promotion on expired hold — deferred; existing lobby-close behavior is acceptable fallback

</deferred>

---

*Phase: 15-reconnect-after-disconnect*
*Context gathered: 2026-04-16 (revised — simplified to browser-reload recovery only)*
