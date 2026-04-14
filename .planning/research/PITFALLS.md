# Pitfalls Research

**Domain:** Cooperative server-authoritative web puzzle game — v1.2 feature additions
**Project:** LogiBlock
**Researched:** 2026-04-06
**Confidence:** HIGH — all findings from direct code inspection of v1.1 codebase
**Scope:** Adding reconnect, profanity filter, per-level leaderboard, random mode overhaul, and controls modal to an existing working system.

---

## How to Read This File

Each pitfall is tagged with the feature area it belongs to and which implementation phase should prevent it.

Feature tags:
- **[RECON]** — Reconnect after disconnect (30s slot reservation)
- **[PROF]** — Profanity filter (bad-words npm package)
- **[LDR]** — Per-level leaderboard (Map by puzzleId)
- **[RAND]** — Random mode overhaul (new event types)
- **[HLP]** — Controls modal (client-only HTML/CSS overlay)
- **[INTG]** — Integration pitfall spanning multiple features

---

## Critical Pitfalls

Mistakes that cause silent wrong behavior, rewrites, or game-breaking bugs.

---

### Pitfall 1: Reconnect Restores Player by Name — But `socket.id` Is Used as Identity Everywhere

**Feature:** [RECON]
**Phase:** Reconnect server logic

**What goes wrong:**
The current codebase stores players as `{ socketId, name, isHost }` in `lobby.players`. Every guard that checks "is this the active player?" or "is this the host?" compares `socket.id`:

```javascript
// socket.js line 145: host guard
if (lobby.hostId !== socket.id) { ... }

// socket.js line 175: active-player guard
const activePlayer = lobby.players[lobby.activeTurnIndex];
if (!activePlayer || activePlayer.socketId !== socket.id) { ... }

// socket.js line 229: was-host check
const wasHost = lobby.hostId === socket.id;
```

On reconnect, Socket.IO issues a **new** `socket.id`. If the reconnect handler simply finds the player by name and updates `socketId`, but forgets to update `lobby.hostId`, then the host reconnects but can no longer start the game, select a puzzle, or perform any host-only action — they are permanently demoted.

**Why it happens:**
`lobby.hostId` is set once at `createLobby()` (game.js line 36: `hostId: hostSocketId`). Nothing in the current disconnect path changes it. A naive reconnect implementation updates `player.socketId` in the array but leaves `lobby.hostId` pointing at the old dead socket.

**Consequences:**
- Host reconnects — appears in player list, can send messages — but all host-only events silently fail with `'Only the host can...'` errors.
- `advanceTurnIfActive` in the disconnect handler used the old socket.id to find the player before removing. On reconnect, the same matching logic must use name, not id.

**How to avoid:**
When processing a reconnect, update BOTH `player.socketId` in the array AND `lobby.hostId` if the reconnecting player is the host:

```javascript
// Pseudocode for reconnect handler
const player = lobby.players.find(p => p.name === reconnectName);
player.socketId = socket.id;                         // update array entry
if (player.isHost) lobby.hostId = socket.id;         // update hostId too
```

Write a TDD test: reconnect host, then emit `startGame` from new socket id, assert it succeeds.

**Warning signs:**
Host reconnects and lobby:update shows them as host, but clicking Start Game produces "Only the host can start the game" error.

**Phase to address:**
Reconnect server logic (Phase covering RECON-*)

---

### Pitfall 2: Reconnect Slot Check Allows Name Collision From a Different Socket — Duplicate Players

**Feature:** [RECON]
**Phase:** Reconnect server logic

**What goes wrong:**
The current `joinRoom` handler (socket.js line 80) rejects duplicate names:
```javascript
if (lobby.players.some(p => p.name === name)) {
  return socket.emit('room:error', `Name "${name}" is already taken in this room`);
}
```
This guard protects against a fresh join. But the reconnect path must NOT hit this guard — a reconnecting player's slot IS occupied (by their name) and that is exactly what makes them eligible to reconnect.

The risk: a different player with the same name could attempt to "reconnect" into someone else's slot during the 30-second window. Since there is no auth token (PROJECT.md: "Accounts / Login — nicht nötig"), the name alone is the identity. Any player who knows the room code and another player's exact name can steal that slot.

**Why it happens:**
No auth token, name-only identity, Uni scope. This is a known design constraint, not an oversight.

**Consequences:**
- Slot hijacking is possible but low-risk in a Uni demo context.
- More dangerous: two separate reconnect attempts for the same name in rapid succession — the second one overwrites `socketId` and the first reconnected client is now silently disconnected from the game.

**How to avoid:**
For Uni scope: document the limitation, accept it. Add a comment to the reconnect handler explaining the attack surface. The 30-second timer already limits the window.

If hardening is desired later: add a server-side reconnect token (random string) generated at join, stored on `player`, and sent to client via `socket.data`. On reconnect, require the token. This is out of scope for v1.2.

**Warning signs:**
Two separate players named "Alice" in the same room during a reconnect window.

**Phase to address:**
Reconnect server logic — document limitation, no code change needed for Uni scope.

---

### Pitfall 3: `disconnecting` Destroys the Lobby — Reconnect Has Nothing to Return To

**Feature:** [RECON], [INTG]
**Phase:** Reconnect server logic + disconnect handler modification

**What goes wrong:**
The current `disconnecting` handler (socket.js lines 222-262) unconditionally destroys the lobby if the last player left (`lobby.players.length === 0`), or if the host left during lobby phase. It calls `removePlayer()` immediately.

The reconnect feature requires keeping the player's slot alive for 30 seconds. This conflicts directly with the current "remove on disconnect" approach:

```javascript
// socket.js line 238: removes immediately
removePlayer(roomCode, socket.id);

// socket.js line 241: destroys if empty
if (lobby.players.length === 0) {
  deleteLobby(roomCode);
  return;
}
```

If `removePlayer` is called immediately and the lobby is deleted, there is nothing for the reconnect handler to restore.

**Why it happens:**
The v1.1 disconnect path was designed for a world without reconnect. It is correct for that world. v1.2 changes the semantics: "disconnect" must become "mark as disconnected" not "remove immediately."

**Consequences:**
- Reconnect returns "Room not found" because the lobby was deleted.
- If the lobby persists (player count > 1), the removed player's slot is gone from the array — their turn position is lost, their name is freed up for anyone to take.

**How to avoid:**
Change the player model to add a `disconnected` boolean and a `disconnectTimer` reference:
```javascript
// Player shape becomes:
{ socketId, name, isHost, disconnected: false, disconnectTimer: null }
```

In `disconnecting`: instead of `removePlayer`, set `player.disconnected = true` and start a 30-second `setTimeout`. In the timer callback: actually call `removePlayer` and broadcast the slot expiry. Cancel the timer if the player reconnects in time.

The lobby-deletion logic (`players.length === 0`) must be updated to count only non-disconnected players.

**Warning signs:**
Server log shows lobby deleted 0ms after disconnect (no timer delay).

**Phase to address:**
Reconnect server logic — this is the core structural change, must be addressed before any reconnect UI work.

---

### Pitfall 4: Rejoining a Game in Progress — Client Has No `game:start` Event to Initialize State

**Feature:** [RECON]
**Phase:** Reconnect client + server

**What goes wrong:**
The client renders the game screen by reacting to `game:start` (socket.js line 157, main.js line 851):
```javascript
socket.on('game:start', (state) => {
  showScreen('game-screen');
  initPieceColors(state);   // assigns piece colors for the session
  renderGrid(state);
  renderBank(state);
  renderTurnUI(state);
  startLiveTimer(state.startTime);
});
```

A reconnecting client never receives `game:start` — the game already started. If the server only sends `game:stateUpdate` on reconnect, `initPieceColors()` is never called. All pieces render with the fallback color `'#ccc'` instead of their assigned colors. The timer never starts because `startLiveTimer` requires the original `startTime` from `game:start`.

**Why it happens:**
`initPieceColors` is called once at game start and populates `pieceColors = {}` (main.js line 30). `game:stateUpdate` does not call `initPieceColors` — it assumes colors were already assigned.

**Consequences:**
- All pieces appear gray after reconnect.
- Timer stuck at 00:00 (no `startLiveTimer` call).
- Ghost preview may malfunction if `currentGridSize` / `currentBankShapes` were not populated.

**How to avoid:**
Create a dedicated reconnect payload event (e.g. `game:rejoin`) that includes all fields from `game:start` (`startTime`, full grid, bankShapes, players, etc.). In the client, handle `game:rejoin` identically to `game:start`:

```javascript
socket.on('game:rejoin', (state) => {
  showScreen('game-screen');
  initPieceColors(state);
  renderGrid(state);
  renderBank(state);
  renderTurnUI(state);
  startLiveTimer(state.startTime);
});
```

Alternatively, reuse `game:start` but that conflates two different flows (initial start vs. rejoin). A named event is clearer.

**Warning signs:**
Gray pieces on game screen after reconnect; timer shows 00:00.

**Phase to address:**
Reconnect — client handler, after server reconnect logic is in place.

---

### Pitfall 5: `bad-words` Is an ESM-Only Package in Recent Versions — Breaks CommonJS Server

**Feature:** [PROF]
**Phase:** Profanity filter implementation

**What goes wrong:**
The LogiBlock server uses CommonJS (`require()`) throughout — this is a documented decision in PROJECT.md ("CommonJS (require) statt ESM — kein `fileURLToPath`-Workaround"). The `bad-words` npm package (the most commonly recommended profanity filter for Node.js) migrated to ESM-only starting from version 4.x. Attempting to `require('bad-words')` with v4+ results in:

```
Error [ERR_REQUIRE_ESM]: require() of ES Module .../bad-words/index.mjs not supported.
```

**Why it happens:**
npm install without a version pin will install the latest version (currently 4.x+), which is ESM-only. The server has no transpilation step and no `"type": "module"` in package.json.

**Consequences:**
- Server crashes on startup at the `require('bad-words')` line.
- No fallback — the crash is immediate and unrecoverable.

**How to avoid:**
Pin `bad-words` to the last CommonJS-compatible version (3.x):
```bash
npm install bad-words@3
```

Verify with `require('bad-words')` in the REPL before integrating. Add the version constraint to package.json as a reminder:
```json
"bad-words": "^3.0.4"
```

Alternatively, use a different package that maintains CommonJS support, or inline a minimal word-list check (acceptable for Uni scope).

**Warning signs:**
`ERR_REQUIRE_ESM` in server startup log. The crash happens before any HTTP or Socket.IO listeners are registered.

**Phase to address:**
Profanity filter — first step, before writing any filter logic.

---

### Pitfall 6: Profanity Filter Applied in `createRoom` But Not `joinRoom` — Asymmetric Validation

**Feature:** [PROF]
**Phase:** Profanity filter implementation

**What goes wrong:**
There are two entry points for player names in socket.js:
1. `createRoom` handler (line 41) — creates the host
2. `joinRoom` handler (line 63) — adds joining players

It is easy to add the filter call to `createRoom` and forget `joinRoom`, or vice versa. The result: one path accepts profane names while the other blocks them. If only `joinRoom` is filtered, the host can set any name. If only `createRoom` is filtered, joiners can use profane names.

**Why it happens:**
Two separate handlers, both with similar name-validation code already, but the filter must be added to both independently.

**Consequences:**
- Asymmetric enforcement — confusing and inconsistent.
- Players discover the bypass by switching between create and join.

**How to avoid:**
Extract name validation into a shared helper called from both handlers:

```javascript
// In socket.js (or a small validate.js module)
function validatePlayerName(name, filter) {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return { ok: false, error: 'Player name is required' };
  }
  const trimmed = name.trim().slice(0, 20);
  if (filter.isProfane(trimmed)) {
    return { ok: false, error: 'Player name contains inappropriate content' };
  }
  return { ok: true, name: trimmed };
}
```

Both `createRoom` and `joinRoom` call this helper. The filter runs in one place. Tests cover both paths.

**Warning signs:**
"Host has profane name" while "joiner is blocked from profane name" — or reverse.

**Phase to address:**
Profanity filter — extract shared validator before wiring either handler.

---

### Pitfall 7: Per-Level Leaderboard Breaks Existing `leaderboard:update` Consumers — Shape Change

**Feature:** [LDR], [INTG]
**Phase:** Per-level leaderboard server implementation

**What goes wrong:**
The current leaderboard is a flat array sorted by `elapsedMs`:
```javascript
// game.js line 15
const leaderboard = [];
```

`getLeaderboard()` (game.js line 482) returns entries shaped as:
```javascript
{ rank: i+1, puzzleName: e.puzzleName, time: formatTime(e.elapsedMs), playerNames: e.playerNames }
```

The client `renderLeaderboard()` (main.js line 786) and the `leaderboard-body` `<tbody>` in index.html (line 42) consume this shape with 4 columns: `#`, `Puzzle`, `Time`, `Players`.

A per-level leaderboard requires a different data structure (e.g. `Map<puzzleId, sortedArray>`). The critical risk: if `getLeaderboard()` is changed to return per-puzzle entries without updating the client consumer and the HTML table, the client renders broken output — or renders nothing at all if the shape is completely wrong.

**Why it happens:**
The shape contract between server and client is implicit — there is no typed interface. Changing the server return shape silently breaks the client renderer.

**Consequences:**
- `leaderboard:update` is broadcast to ALL sockets (`io.emit`, not `io.to(roomCode).emit`) — so every client on the server receives the broken shape simultaneously.
- Existing start-screen leaderboard table breaks for all users.

**How to avoid:**
Decide the new shape before writing any server code. Two approaches:

**Option A (backward-compatible):** Keep the flat `leaderboard:update` event for the start-screen (all puzzles mixed), add a new event `leaderboard:puzzle` that sends per-puzzle entries when a player views the leaderboard screen.

**Option B (clean break):** Change `getLeaderboard()` to return `{ byPuzzle: Map<id, entries[]>, all: entries[] }` and update client + HTML together in one atomic commit.

Option A is safer for a working system. Option B requires touching more files but results in a cleaner design.

Update the HTML table structure and `renderLeaderboard()` together with any shape change. Never change the server shape without immediately updating the client consumer in the same commit.

**Warning signs:**
Start-screen leaderboard shows empty rows or JavaScript errors in browser console after shape change.

**Phase to address:**
Per-level leaderboard — server shape decision must be made first, client update in same commit.

---

### Pitfall 8: `shuffle_order` Random Event Leaves Turn Index Pointing at Wrong Player After Expansion

**Feature:** [RAND], [INTG]
**Phase:** Random mode overhaul — new event types

**What goes wrong:**
The existing `shuffle_order` implementation in game.js (lines 435-441):
```javascript
if (eventType === 'shuffle_order') {
  shuffleArray(lobby.players);
  lobby.activeTurnIndex = 0;
  return { type: 'shuffle_order', description: '...' };
}
```

This resets `activeTurnIndex = 0` correctly. New event types added in the overhaul may also mutate `lobby.players` (reordering, inserting markers, skipping) but forget to update `activeTurnIndex`. The pattern: any event that changes player array length OR order must also update `activeTurnIndex` or risk pointing at the wrong player (or out of bounds).

Specific danger with a new "freeze_player" type that temporarily removes a player from the array: after the freeze, the array is shorter, and the old `activeTurnIndex` may point out of bounds (array length n-1, index was n-1 → now 0-based maximum is n-2 → crash at `lobby.players[lobby.activeTurnIndex]` returning `undefined`).

**Why it happens:**
`activeTurnIndex` is a position-based index, not an identity-based pointer. Any structural mutation of `lobby.players` invalidates it.

**Consequences:**
- `undefined` active player → `activePlayer.socketId` throws TypeError on server.
- `game:stateUpdate` sent with `activePlayerName: null` → client shows no active player, game appears frozen.
- If `advanceTurn` is called when `players` is empty, `lobby.activeTurnIndex = (0 + 1) % 0` produces `NaN` (division by zero in modulo). The guard in `advanceTurn()` at game.js line 169 catches this case for the zero-length array, but not for index drift.

**How to avoid:**
For every new event type that mutates `lobby.players`:
1. If array is reordered: reset `activeTurnIndex = 0` (same as `shuffle_order`).
2. If array is shortened: clamp `activeTurnIndex = Math.min(activeTurnIndex, players.length - 1)` AFTER removal, then apply modulo.
3. Write a unit test for each new event type that asserts the post-event `activeTurnIndex` is within `[0, players.length - 1]`.

**Warning signs:**
`lobby.players[lobby.activeTurnIndex]` returns `undefined`. `activePlayerName: null` in state update. Server TypeError in game:move handler on the turn after the event fires.

**Phase to address:**
Random mode overhaul — add invariant test for each new event type before merging.

---

### Pitfall 9: New Random Events Fire on the First Turn After Game Start — Bad UX Timing

**Feature:** [RAND]
**Phase:** Random mode overhaul — event balancing

**What goes wrong:**
The random event trigger fires at 30% after every successful `place` action (socket.js line 198):
```javascript
if (lobby.randomModeEnabled && Math.random() < 0.30) {
  const event = triggerRandomEvent(lobby);
  ...
}
```

With ≥4 new event types, some of the new events may be highly disruptive (e.g. "remove all placed pieces" or "reset grid"). If these fire on the very first move, players have barely started — the disruption is frustrating, not fun. Similarly, events that fire when only 1 or 2 pieces are on the grid have much less visible impact than events during a filled-grid state.

**Why it happens:**
The trigger has no game-state awareness — it fires identically on move 1 and move 20. New event types that were designed for "late game" chaos arrive equally in "early game."

**Consequences:**
- Extremely disruptive events (grid reset, remove many pieces) feel punishing in early game.
- Players disable random mode after one bad experience.
- Testers may not notice the problem because they run short tests with few pieces placed.

**How to avoid:**
Add a minimum-pieces-placed guard for highly disruptive new events. Check how many movable pieces are on the grid before triggering the event type. Example:

```javascript
// Only trigger "remove_all_placed" if at least 4 pieces are on grid
const placedCount = getPlacedMovableCount(lobby);
if (eventType === 'remove_all_placed' && placedCount < 4) return null;
```

For the overhaul, design each new event type with a stated "minimum game progress" threshold. Document this in the event's implementation comment.

**Warning signs:**
Playtests where random mode feels unfair on the first 3 moves. Player feedback: "it broke before we even started."

**Phase to address:**
Random mode overhaul — event design and balancing, before implementing new event types.

---

### Pitfall 10: Controls Modal `z-index` Conflicts with Win Overlay and Cursor Piece

**Feature:** [HLP]
**Phase:** Controls modal client implementation

**What goes wrong:**
The existing `z-index` stack in `style.css`:
- `.portrait-overlay`: `z-index: 9999` (highest — must always be on top)
- `.win-overlay`: `z-index: 1000`
- Cursor piece (inline style, main.js line 450): `z-index: 1000`
- `.theme-toggle`: `z-index: 999`

A new controls modal added as a fixed overlay needs a `z-index` that places it:
- Above the game content and theme toggle
- Below the portrait overlay (9999 must remain highest)
- In correct relation to the win overlay (1000)

If the controls modal is assigned `z-index: 1000` (same as win overlay and cursor piece), stacking order becomes undefined — which one appears on top depends on DOM order, not intent. If assigned `z-index: 999`, it appears behind the win overlay — you can't see the controls on the win screen, which is fine, but if the player opens controls during the win overlay, both will fight.

The more subtle conflict: the cursor piece div is appended to `document.body` with inline `z-index: 1000` (getCursorEl, main.js line 447-458). If the controls modal is opened while a piece is selected, the cursor piece (floating mini-grid following the mouse) will render on top of the controls modal content.

**Why it happens:**
The cursor piece was given `z-index: 1000` to appear above all game content. It was never designed to account for a modal at the same level.

**Consequences:**
- Cursor piece floats over the controls modal text — visually broken.
- If the controls modal is also `z-index: 1000`, the modal may appear behind the cursor piece.
- If portrait overlay triggers while the controls modal is open (user rotates tablet), both overlays are visible simultaneously if not z-indexed correctly.

**How to avoid:**
Assign the controls modal `z-index: 1100` — above win overlay (1000) and cursor piece (1000), but below portrait overlay (9999). Add a CSS class for the modal rather than inline styles:

```css
.controls-modal {
  position: fixed;
  inset: 0;
  z-index: 1100;
  /* ... */
}
```

When the controls modal opens, deselect any selected piece (`selectedShapeId = null; refreshCursorPiece()`). This hides the cursor piece before the modal appears, eliminating the overlap entirely without needing z-index gymnastics.

**Warning signs:**
Floating piece mini-grid appears inside the open controls modal. Win overlay appears behind the controls modal when player wins with modal open.

**Phase to address:**
Controls modal — CSS z-index assignment + deselect-on-open behavior in the same plan.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Name-only reconnect identity (no token) | Zero auth infrastructure | Slot hijacking possible; two players with same name cause desync | Uni scope — acceptable, document the limitation |
| `bad-words@3` version pin | Avoids ESM migration | Stuck on older word list; no updates | Uni scope — acceptable |
| `leaderboard:update` broadcast to ALL sockets | Simple — one call covers all screens | Every player receives every game's leaderboard update regardless of screen | Uni scope — acceptable; would need per-connection subscription at scale |
| Reconnect without cleanup of stale `disconnectTimer` refs | Simple implementation | Memory leak if timers accumulate (many connects/disconnects) | Uni scope with small lobbies — acceptable |
| Controls modal HTML in index.html (not dynamically created) | No JS DOM creation needed | index.html grows; modal always in DOM even when not shown | Never a real problem at this scale |

---

## Integration Gotchas

Common mistakes when connecting the five new features to the existing system.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Reconnect + `disconnecting` handler | Adding reconnect without modifying disconnect — so disconnect still calls `removePlayer` immediately | Modify `disconnecting` first to set `player.disconnected = true` and start timer; reconnect handler cancels timer |
| Profanity filter + `socket.data.playerName` | Filtering after `socket.data.playerName = name` is set — so rejected names are still stored on the socket | Filter before assigning to `socket.data`; assign only on validation pass |
| Per-level leaderboard + `io.emit('leaderboard:update')` | Changing the payload shape without updating client `renderLeaderboard()` and HTML table | Always update server shape and client consumer in one atomic commit |
| Random mode overhaul + `triggerRandomEvent` | Adding new event types to `pickRandomEvent()` probabilities without adjusting weights for existing types | Ensure all weights in `pickRandomEvent()` still sum to 1.0 after adding new branches |
| Controls modal + cursor piece | Modal opens while piece is selected — cursor piece floats over modal | Deselect piece on modal open; re-enable on modal close |
| Reconnect + leaderboard | Reconnecting player receives stale leaderboard — no `leaderboard:update` sent on rejoin | Emit current leaderboard to the reconnecting socket as part of the rejoin payload |

---

## Performance Traps

Patterns that work at small scale but break as usage grows. (LogiBlock targets 2-4 players per lobby — all traps rated for this scale.)

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `setTimeout` for reconnect timer, never cleared | Memory leak: stale timers accumulate if server runs for hours with many rooms | Always clear timer on successful reconnect or explicit lobby delete | ~1000 disconnects/hour on a long-running server — irrelevant for Uni demo |
| `io.emit('leaderboard:update')` to ALL sockets for every game win | Every socket gets every update regardless of screen | Acceptable at Uni scale; at scale, use room-scoped emission | 500+ concurrent users |
| Full grid scan in `remove_piece` random event (O(rows*cols)) | Negligible on 5x9 grid | No change needed | 100x100 grid would be noticeable |
| Linear search for player by name in reconnect | `lobby.players.find(p => p.name === name)` is O(n) where n = 4 max | No change needed | O(n) with n=4 is 4 comparisons |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Client-side profanity check only | Client bypass via socket message without using the UI | Filter only on server in `createRoom` and `joinRoom` handlers; never trust client |
| Allowing reconnect with any name that matches a slot, no rate limiting | Slot hijacking by brute-force name guessing | For Uni scope: accept limitation; at production: add reconnect tokens |
| New random events that expose game state (e.g. "reveal solution hint") | Violates GAME-06 invariant — solution never leaves server | All new events must go through `getPublicState()` which explicitly excludes solution |
| Random event description strings built with raw player name from lobby | XSS if names contain HTML (`<script>`) | Names are displayed as `textContent` (not `innerHTML`) in `showGameNotification` — safe as implemented; keep it this way |

---

## UX Pitfalls

Common user experience mistakes specific to these features.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Reconnect timer counts down silently — player doesn't know they have 30 seconds | Player closes tab, doesn't retry in time, slot expires | Show a countdown UI on the start screen: "Your slot is reserved for X seconds — rejoin now" |
| Profanity filter blocks legitimate names ("classic", "assassin") — false positives | Player frustrated, can't join with their name | Use `bad-words` with default list; inform player the specific name is blocked without explaining why; don't expose the word list |
| Controls modal opened during an active turn — player misses their turn while reading | Turn timer (if added) elapses; other players wait | Modal opens/closes without affecting turn state; clearly label it "non-modal" — game continues behind it |
| Random event fires with no visual context — player confused why their piece rotated | Player thinks there is a bug | Show event notification BEFORE state update (already enforced by socket.js emit order — preserve this invariant for new events) |
| Per-level leaderboard screen navigated to mid-game — player misses their turn | Same as controls modal risk | Leaderboard screen is start-screen only; no mid-game navigation to it |
| Controls modal shows keyboard controls on touch-only device | Confusing — keyboard instructions irrelevant | Show touch instructions when `'ontouchstart' in window`, keyboard instructions otherwise; or show both |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Reconnect:** `lobby.hostId` updated to new `socket.id` on host reconnect — verify by emitting `startGame` from new socket after reconnect, assert it does not return "Only the host can..."
- [ ] **Reconnect:** `disconnectTimer` is cancelled when player reconnects successfully — verify no "slot expired" message fires 30 seconds after a successful reconnect
- [ ] **Reconnect:** Client receives all state needed to resume game (colors, grid, timer, turn) — verify `initPieceColors` is called and `startLiveTimer` receives correct `startTime`
- [ ] **Profanity filter:** Both `createRoom` AND `joinRoom` handlers filter names — verify by emitting `joinRoom` with a profane name directly via socket client, not through UI
- [ ] **Profanity filter:** Server starts successfully with `bad-words@3` (not v4+) — verify `node src/server.js` boots without `ERR_REQUIRE_ESM`
- [ ] **Per-level leaderboard:** Old flat leaderboard display on start screen still works after shape change — verify by completing a game and checking the start-screen table
- [ ] **Per-level leaderboard:** Correct puzzle's entries are shown when rejoining a game — verify the puzzle-filter logic uses `puzzleId`, not `puzzleName`
- [ ] **Random mode overhaul:** `pickRandomEvent()` weights still sum to 1.0 after adding new event branches — count the probability cutoffs
- [ ] **Random mode overhaul:** New event types return `null` (not crash) when their preconditions are not met — unit test each edge case
- [ ] **Controls modal:** Cursor piece is hidden when modal opens — verify by selecting a piece, opening modal, checking that floating mini-grid is gone
- [ ] **Controls modal:** Modal is closeable while portrait overlay is active (or portrait overlay on top of modal) — verify on actual mobile device in portrait

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| `lobby.hostId` not updated on reconnect — host locked out | LOW | Add `if (player.isHost) lobby.hostId = socket.id` to reconnect handler; re-test |
| `bad-words@4` installed instead of `@3` | LOW | `npm install bad-words@3`; server restart |
| Leaderboard shape change broke client render | MEDIUM | Rollback server shape change; update client render first; re-apply server change |
| New random event causes `undefined` player crash | MEDIUM | Add bounds check `activeTurnIndex = Math.min(activeTurnIndex, players.length - 1)`; patch + redeploy |
| Controls modal z-index conflict with cursor piece | LOW | Add `selectedShapeId = null; refreshCursorPiece()` to modal open handler |
| Disconnect timer fires after successful reconnect | LOW | Add `clearTimeout(player.disconnectTimer)` at start of reconnect handler |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Pitfall 1: hostId not updated on reconnect | Reconnect server logic | TDD test: host reconnects, emits startGame from new id, asserts success |
| Pitfall 2: name-only identity — slot hijacking | Reconnect server logic | Accept limitation; add comment; no automated test needed |
| Pitfall 3: disconnect destroys lobby before timer | Reconnect server logic — modify disconnecting handler first | Unit test: disconnect fires, lobby still exists after 0ms, deleted after 30s |
| Pitfall 4: rejoin client missing game:start state | Reconnect client handler | Manual test: disconnect mid-game, rejoin, verify colors + timer correct |
| Pitfall 5: bad-words v4 ESM crash | Profanity filter — package install step | `node -e "require('bad-words')"` succeeds without ERR_REQUIRE_ESM |
| Pitfall 6: filter in createRoom but not joinRoom | Profanity filter — shared validator | Socket test: emit joinRoom with profane name, assert room:error |
| Pitfall 7: leaderboard shape change breaks client | Per-level leaderboard — server shape decision | Verify start-screen table after first game win |
| Pitfall 8: new events corrupt activeTurnIndex | Random mode overhaul — per-event unit tests | Unit test: each new event, assert activeTurnIndex in [0, players.length-1] |
| Pitfall 9: disruptive events fire in early game | Random mode overhaul — event design | Playtest: 3 consecutive games with random mode, count first-move events |
| Pitfall 10: controls modal z-index conflicts | Controls modal — CSS + deselect-on-open | Manual test: select piece, open modal — cursor piece must not appear over modal |

---

## Sources

- Direct code inspection: `server/src/socket.js` — all handler patterns, hostId usage, disconnect flow (v1.1, 2026-04-06)
- Direct code inspection: `server/src/game.js` — lobby data model, player array structure, triggerRandomEvent, leaderboard (v1.1, 2026-04-06)
- Direct code inspection: `client/main.js` — initPieceColors, startLiveTimer, getCursorEl z-index, game:start handler (v1.1, 2026-04-06)
- Direct code inspection: `client/index.html` — existing DOM structure, win-overlay, portrait-overlay (v1.1, 2026-04-06)
- Direct code inspection: `client/style.css` — z-index values: portrait 9999, win 1000, cursor 1000 inline, theme-toggle 999 (v1.1, 2026-04-06)
- Direct code inspection: `server/package.json` — no bad-words in dependencies (2026-04-06)
- Socket.IO documentation (HIGH confidence): new socket.id issued on every reconnect — fundamental Socket.IO behavior, unchanged since v2
- npm bad-words package history (MEDIUM confidence): v4.x migrated to ESM, v3.x is last CommonJS release — verified by package inspection pattern; pin to @3

---
*Pitfalls research for: LogiBlock v1.2 — Reconnect, Profanity Filter, Per-Level Leaderboard, Random Mode Overhaul, Controls Modal*
*Researched: 2026-04-06*
