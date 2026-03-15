# Phase 3: Timer und Leaderboard - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Timer starts exactly when the game starts (host presses Start) and stops when the puzzle is solved. The win screen shows the final time. The start screen shows a session leaderboard of all completed games, sorted by fastest time. Times are in-memory only — no persistence.

</domain>

<decisions>
## Implementation Decisions

### Live Timer
- Timer is visible to all players during the game (not hidden until win)
- Displayed near the turn banner on the game screen
- Server includes `startTime` (Date.now()) in the `game:start` payload
- Client runs `setInterval` to update the display independently — no timer tick events from server
- When `game:win` is received, client clears the interval and freezes the display at the final time

### Time Format
- MM:SS format throughout (e.g. `01:23`)
- Server stores time as milliseconds (`Date.now()` precision)
- Client formats ms → MM:SS for display (live timer and leaderboard)

### Leaderboard
- Columns per entry: Rank | Puzzle Name | Time | Player Names
- Sorted: fastest time first
- Empty state: show the leaderboard section with placeholder text ("No games completed yet") — not hidden
- All entries shown (no cap)
- Placement: below the existing join card on the start screen
- Delivery: server emits `leaderboard:update` (full sorted list) to the newly connected socket on `connection`, and broadcasts to all after each `game:win`

### Win Screen Restructure
- Win card layout: Title ("Puzzle Solved!") → large time display (MM:SS) → player names → "Play Again" button
- Server includes `elapsedMs` in the `game:win` payload (authoritative final time)
- "Play Again" button returns all players to the start screen (client-side: hide overlay, show start screen)
- No server-side lobby reset needed — players create/join a new room after returning to start

### Claude's Discretion
- Timer label styling (e.g. "⏱ 01:23" vs plain "01:23" — Claude picks based on existing style)
- Exact CSS for the large time display in the win card
- Socket cleanup on "Play Again" (whether to emit a leave event before showing start screen)
- Whether `elapsedMs` is added to `getPublicState()` or sent separately in the `game:win` emission

</decisions>

<specifics>
## Specific Ideas

- Win card time should be the **hero element** — visually prominent, not just another line
- The win card redesign takes precedence over keeping the existing structure minimal

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderWin(state)` in `client/main.js:417` — existing function to update; restructure win card here
- `showScreen(screenId)` in `client/main.js:72` — reuse for "Play Again" navigation
- `win-overlay` + `win-card` in `index.html:74` — restructure this DOM, add time and button
- `turn-banner` (`#turn-banner`) in `index.html:65` — timer display goes near here

### Established Patterns
- Server state: all outbound data goes through `getPublicState()` in `game.js:169` — add `startTime` / `elapsedMs` here or alongside it
- Socket events: server emits to room with `io.to(roomCode).emit(...)` — `leaderboard:update` follows this pattern
- Client socket listeners: all in the bottom block of `main.js` starting at line 442 — add `leaderboard:update` and timer-related logic here
- No build tools — vanilla JS, no imports, keep it in `main.js`

### Integration Points
- `startGame()` in `game.js:322` — store `lobby.startTime = Date.now()` here
- `socket.on('startGame', ...)` in `socket.js:115` — include `startTime` in `game:start` payload
- `game:win` emission in `socket.js:158` — compute `elapsedMs` and add to payload; also record leaderboard entry and broadcast `leaderboard:update`
- `socket.on('connection', ...)` in `server.js` or `socket.js` — emit initial `leaderboard:update` to new socket
- `index.html` start screen — add leaderboard section below the existing `.card`
- `LobbyState` shape in `game.js:7` — add `startTime` field

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-timer-und-leaderboard*
*Context gathered: 2026-03-10*
