# Feature Research

**Domain:** Browser-based cooperative multiplayer puzzle game (v1.2 additions)
**Project:** LogiBlock v1.2 — Spielqualitat & Features
**Researched:** 2026-04-06
**Confidence:** HIGH
**Scope note:** This document covers ONLY v1.2 additions. All prior features (lobby, grid, pieces, interaction model, random mode v1, touch support) are already shipped and are not re-researched here.

---

## Context: What v1.2 Adds to an Already-Working Game

Five orthogonal features, none of which changes existing game mechanics:

1. **Random mode overhaul** — Extend the existing 4 chaos events with new types; rebalance weights for "wilder" feel
2. **Controls modal** — Info button on game screen opens a modal explaining keyboard and touch controls
3. **Per-level leaderboard** — Separate ranked list per puzzle (vs. today's single global list)
4. **Reconnect after disconnect** — 30-second window to reconnect and resume the same game session
5. **Profanity filter** — Server-side name validation using an npm package

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that must work correctly for v1.2 to feel complete. Missing any of these = product feels broken or unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Profanity filter blocks offensive names | Any public-facing game with user-entered names is expected to prevent slurs in room-visible player lists. Absence is embarrassing in a Uni demo context. | LOW | One `npm install bad-words` (or `leo-profanity`) + one guard in `joinRoom` and `createRoom` handlers. No client changes. Server returns `room:error` on blocked names — existing error display handles it. |
| Controls modal is closable | A modal that cannot be dismissed is a hard block. Users expect Escape key, X button, and click-outside-to-close as minimum. | LOW | Pure client-side: `<dialog>` element or manual `display:none` toggle. No server involvement. Escape already works natively on `<dialog>`. |
| Controls modal is accurate | If the modal describes old controls (e.g. double-click to place) it creates confusion. Must reflect Phase 10 reality: single-click places, rotation buttons, R key, touch drag. | LOW | Content authoring task — no code complexity. Must audit Phase 10 final control set before writing copy. |
| Per-level leaderboard is filtered correctly | If puzzle A's times appear under puzzle B's list, the leaderboard is broken. The `puzzleName` field is already stored in each leaderboard entry (`game.js` line 473). | LOW | Filter `leaderboard` array by `puzzleName` (or add `puzzleId` to entry). The server already stores `puzzleName` — use it as partition key or add `puzzleId`. |

### Differentiators (Competitive Advantage)

Features that make LogiBlock's chaos mode genuinely fun and the UX polished above baseline.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Random events that affect the game state visibly | Events that players can SEE (removed piece, reshuffled order) create shared "oh no!" moments. Events that are invisible (rotate a piece the client doesn't see) feel broken. Current `rotate_piece` only affects the active player's ghost — all others see nothing. | MEDIUM | New visual events should show tangible grid changes. Best candidates: `double_piece` (place two pieces this turn), `freeze_bank` (active player cannot take from bank this turn), `reverse_order` (turn direction flips). Avoid events that only affect one client invisibly. |
| Events that feel "funny" not "punishing" | The line between chaos-fun and chaos-frustrating is: does the event create a funny moment for EVERYONE, or does it silently punish one person? `skip_turn` punishes one player. `shuffle_order` creates a moment for all. New events should favor shared-experience chaos over individual punishment. | LOW (design) | See event taxonomy below. "Funny" events: things everyone can see and react to. "Punishing" events: things that subtract progress without visible drama. Lean toward funny. |
| Reconnect window visible to other players | If a player disconnects, the remaining players should see "Alex disconnected — waiting 30s" rather than just watching the game pause silently. The UX expectation in co-op games is a visible countdown for the reconnect window. | MEDIUM | Requires server-side timer (`setTimeout`), new socket event `player:reconnecting`, and client-side notification in the game screen. The tricky part: what happens if the 30s expires vs. the player reconnects. |
| Per-level leaderboard shows puzzle context | Filtering by puzzle should show the puzzle name as a header/tab. Users playing "Level 01 — Einfach" expect to see only those times. | LOW | Client-side rendering only. Server already sends `puzzleName` in leaderboard entries. |
| Controls modal triggered via info button | An info button (i or ? icon) positioned near the game title gives players a discoverable way to open help during gameplay without interrupting the server state. | LOW | No server involvement. Pure DOM + CSS. Position near `#game-title` or near the rotation controls. |

### Anti-Features (Commonly Requested, Often Problematic)

Features to explicitly NOT build for v1.2.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Pause on disconnect | Seems fair — game should wait for disconnected player | Requires all remaining players to agree/wait; creates griefing vector (intentional disconnect to stall); complicates turn index management | 30-second reconnect window with automatic turn skip if window expires — game continues normally |
| Reconnect into an active game mid-turn | "I want to pick up exactly where I left off" | If another player is now active, restoring the disconnected player as active creates a conflict. The lobby state is authoritative but the active turn may have advanced. | Reconnect restores the player to the lobby state (they see the current grid, their name in the player list) but turn ownership follows current `activeTurnIndex` — they just wait for their turn |
| Client-side profanity filter (regex) | "Just block bad words on the client" | Client-side filtering is trivially bypassed (modify JS, send raw socket message). For a Uni demo the embarrassment risk is real if someone bypasses it. | Server-side only — `bad-words` or `leo-profanity` npm package in `socket.js` `createRoom`/`joinRoom` handlers |
| Event intensity slider (lobby setting) | More control over chaos frequency | Adds a new lobby config field, socket event, server storage, and client UI for every combination of intensity × event type. Not worth it for the 5 feature types we have. | Fixed 30% trigger probability per turn (already decided in v1.1); more/wilder events at fixed probability is enough "dialing up" |
| Persistent leaderboard (database) | "I want to see times from previous sessions" | Out of scope (PROJECT.md explicitly: "no persistent database"). Adds SQLite/file I/O that changes the server architecture. | In-memory per session — clears on server restart. This is a stated constraint, not a bug. |
| Reconnect across server restart | "Even if the server restarts" | Server restart clears all in-memory state (lobbies Map, leaderboard array). Reconnect is impossible after server restart by design — no session persistence. | Document the 30-second window clearly. Out-of-scope reconnect is server-restart tolerance, not in v1.2. |

---

## Feature Deep Dives

### Random Mode: Event Taxonomy (Crazy vs. Annoying)

The key design insight from studying chaos modes in games like Mario Kart items, Jackbox Party games, and casual co-op games: **events that create shared visible drama are fun; events that silently penalize one person are frustrating.**

Current 4 events analyzed:

| Event | Visible to All? | Drama Level | Verdict |
|-------|----------------|-------------|---------|
| `rotate_piece` | No — only active player's ghost rotates | Low | Annoying (invisible, subtle) |
| `skip_turn` | Yes — turn banner changes | Medium | Borderline (punishes one player) |
| `remove_piece` | Yes — piece disappears from grid | High | Fun (everyone sees it happen) |
| `shuffle_order` | Yes — all badges reorder | High | Fun (shared chaos moment) |

**Recommended new event types for "crazy not annoying":**

| Proposed Event | What Happens | Why Crazy-Not-Annoying | Implementation Hook |
|----------------|-------------|------------------------|---------------------|
| `double_turn` | Active player gets TWO placements this turn (turn advances after second place) | Team gets a surprise bonus — positive chaos creates goodwill | Counter in lobby state: `lobby.extraTurns = 1`; skip `advanceTurn` first placement |
| `reverse_order` | Turn order reverses (not just shuffled — predictably reversed) | Funnier than shuffle because players can predict who goes next; creates strategy disruption | Reverse `lobby.players` array, reset `activeTurnIndex = 0` |
| `blind_bank` | Bank is hidden for one turn (names/shapes grayed out) | CSS-only chaos — no state change needed; creates comedic scrambling | Server sends `{ type: 'blind_bank' }` event; client adds `.blind` class to `#piece-bank` for 1 turn |
| `swap_piece` | Two random placed pieces on the grid swap their shapeIds | Creates visual chaos; may accidentally complete a section or break one | Scan grid for 2 random movable pieces, swap their `shapeId` values; re-broadcast state |
| `free_place` | Active player can place without rotation restriction (any rotation counts as valid) | Positive chaos — feels like a power-up; only useful if player has a piece that almost fits | Server sets `lobby.freePlace = true`; `placePiece()` respects this flag |

**Recommended weight rebalancing for v1.2:**

Current weights create roughly 30% mild (rotate_piece) + 30% mild punishment (skip_turn) + 15% visible (remove_piece) + 15% visible (shuffle_order) = 60% mild / 40% visible.

Recommended: skew toward visible/dramatic events.

```
rotate_piece:   10%  (was 30%) — less frequent because invisible
skip_turn:      15%  (was 35%) — less frequent because individual punishment
remove_piece:   20%  (keep)   — good visible drama
shuffle_order:  15%  (keep)   — good shared chaos
double_turn:    15%  (NEW)    — positive chaos
reverse_order:  15%  (NEW)    — predictable disruption
blind_bank:     10%  (NEW)    — low-cost implementation, funny
```

Note: `swap_piece` and `free_place` are higher complexity and should be deferred unless implementation time allows.

**Complexity note:** `double_turn` requires new state (`lobby.extraTurns`) and branching in `socket.js` place handler. All others are simpler. `blind_bank` is client-only with zero server state.

### Controls Modal: What Good Looks Like

Pattern derived from established browser game conventions (confirmed by codebase audit of existing infrastructure):

**Structure:** A centered overlay `<dialog>` or `<div role="dialog">` with:
- Close button (X) in top-right corner
- Escape key closes (native `<dialog>` behavior, or manual `keydown` listener)
- Click-outside-backdrop closes (click on overlay, not content card)
- Headings grouping: "Desktop", "Touch" (and optionally "Chaos Modus events list")

**Content for LogiBlock Phase 10 controls (verified from `main.js` and `index.html`):**

Desktop controls:
- Click piece in bank: Select piece
- Click grid cell: Place selected piece at that position
- Click bank piece again: Deselect
- Click grid cell with piece selected (rotation buttons): Rotate CW/CCW
- R key: Rotate selected piece 90 CW
- Click outside grid/bank: Deselect

Touch controls:
- Tap bank piece: Select piece
- Drag to grid: Shows ghost preview while dragging
- Lift finger over grid cell: Places piece (ghost-confirm)
- Long-press on placed piece: Returns piece to bank

**Implementation fit with existing codebase:**
- No modal infrastructure exists yet — must be added to `index.html` and `main.js`
- A `<dialog>` element is the cleanest approach: browser native focus trap, Escape key, no JS needed for keyboard handling
- The info button should be in `#game-screen` (not lobby or start screen) since controls only apply during play
- One new DOM element in `index.html`, one button in game screen HTML, ~20 lines of JS to wire open/close
- No server involvement

**Anti-pattern to avoid:** Opening the modal should NOT pause the game server-side or emit any socket events. It is purely a client-side UI overlay.

### Per-Level Leaderboard

Current state (verified from `game.js` lines 472-489):
- `leaderboard` is a flat sorted array of `{ puzzleName, elapsedMs, playerNames }`
- `getLeaderboard()` returns `{ rank, puzzleName, time, playerNames }`
- `leaderboard:update` broadcasts the full flat list to ALL sockets after each win
- The start screen renders it as a single table with a "Puzzle" column

v1.2 requirement: **separate ranked list per puzzle** — meaning rank #1 for "Level 01" is distinct from rank #1 for "Level 02".

Two implementation approaches:

**Option A — Client-side filtering (simpler, recommended):**
Server continues to broadcast the full flat list. Client filters by `puzzleName` when rendering. Add a tab/button UI to switch between puzzles. Server changes: none. Client changes: tab rendering + filter logic.

**Option B — Server-side per-puzzle lists:**
Replace `leaderboard` array with `Map<puzzleId, Entry[]>`. Server sends per-puzzle data. More server changes, but cleaner if the list grows large.

**Recommendation:** Option A. No server changes needed. The `puzzleName` field is already in every entry. Client adds a tab selector, filters the array, and re-renders. Implementation: ~30 lines of JS + minimal CSS for tab styling.

**Dependency:** Per-level leaderboard needs the leaderboard to have data from multiple puzzles to be testable. Level 01 and Level 02 puzzle files already exist (`level_01.json`, `level_02.json`). The feature is testable from day one.

### Reconnect After Disconnect

This is the highest-complexity feature in v1.2. Full analysis:

**Current disconnect behavior (verified from `socket.js` lines 222-262):**
- `disconnecting` event fires
- `advanceTurnIfActive()` called before `removePlayer()` — turn advances cleanly
- `removePlayer()` removes the player from `lobby.players`
- If host disconnects in lobby: lobby is deleted, others notified via `lobby:hostLeft`
- If player disconnects mid-game: others notified via `lobby:playerLeft`, state rebroadcast

After `removePlayer()`, the socket ID is gone from the lobby. The player is fully evicted.

**What reconnect requires:**

1. **Identity preservation:** The player must have an identity that survives socket reconnection. Socket.IO auto-reconnects but assigns a NEW socket ID. The player must be matched by name (already how `renderLobbyUpdate` identifies the local player: `state.players.find(p => p.name === myPlayerName)`) or by a session token.

2. **Pending player slot:** Instead of immediately calling `removePlayer()` on disconnect, mark the player as `{ socketId: null, name, isHost, disconnected: true, disconnectedAt: Date.now() }`. Hold the slot for 30 seconds.

3. **Timer management:** `setTimeout(() => { if still disconnected: actually removePlayer })` on the server. Must store the timeout handle to clear it on reconnect.

4. **Reconnect path:** Client sends `reconnectRoom` (or overload `joinRoom`) with their name + room code. Server finds the matching pending slot, updates `socketId`, clears the timeout, re-adds the socket to the room, emits `game:start` or `lobby:update` with current state.

5. **Turn skip:** While a player is disconnected, should their turns be skipped? Simplest approach: yes — use existing `skip_turn` logic or `advanceTurnIfActive` on disconnect, then give the slot back on reconnect. The player returns as a participant but does not get the skipped turns back.

**Key invariant tension:** The current host-disconnect-in-lobby logic deletes the entire lobby. This must be preserved — reconnect only applies to mid-game disconnect, not lobby-phase disconnect. If host disconnects during lobby, lobby still closes.

**Scope boundary for v1.2:** Reconnect only for playing-phase disconnects. Lobby phase disconnects continue to evict immediately (host = lobby close, non-host = lobby update).

**Implementation complexity:** MEDIUM-HIGH. Requires:
- New `disconnecting` logic that conditionally holds vs. evicts
- `setTimeout` per disconnecting player (stored in lobby or player slot)
- New socket event `reconnectRoom` in `socket.js`
- Client: detect reconnect vs. fresh join (check `myRoomCode` in `socket.data`)
- Client: show a "Reconnecting..." state during Socket.IO's auto-reconnect

**Edge cases to handle:**
- Player reconnects but game has ended (win) — redirect to win screen
- Two players have the same name in the same room (already blocked by `joinRoom` guard) — reconnect by name is safe
- Host disconnects mid-game — the `hostId` field must be re-associated with new socket ID on reconnect
- Player disconnects, 30s expires, they try to reconnect — receive `room:error` "Session expired"
- All players disconnect simultaneously — lobby is deleted when `players.length === 0` after last player is fully evicted (30s timers all expire)

### Profanity Filter

**Package selection:**
- `bad-words` (npm) — English-only wordlist, MIT license, well-maintained, ~85KB. API: `new BadWordsFilter().isProfane(name)`. ~3M weekly downloads (HIGH confidence: widely used in game projects).
- `leo-profanity` — Multilingual (includes some German), smaller bundle. API: `leoProfanity.check(name)`. Less maintained.

**Recommendation:** `bad-words` for the English word list; acceptable for a Uni demo. The project's text is German but player names typed in free text are likely to be English slurs. If German profanity is a concern, `leo-profanity` is the alternative.

**Integration point (verified from `socket.js`):**
- `createRoom` handler (line 41): `name = playerName.trim().slice(0, 20)` — add profanity check after trim, before `createLobby()`
- `joinRoom` handler (line 63): same position before `addPlayer()`
- Server returns existing `room:error` event — no new error channel needed
- Client already displays `room:error` via `joinError` element

**One concern:** `bad-words` is a server dependency. It must be `require()`d in `socket.js` (or `game.js`). Verify CommonJS compatibility — `bad-words` exports a class, `require('bad-words')` works in CommonJS.

---

## Feature Dependencies

```
Profanity filter
    (standalone — no dependencies, no dependents)

Controls modal
    (standalone — client-only, no server dependencies)
    └──content requires──> Phase 10 controls reference (already complete)

Per-level leaderboard (client-side filter approach)
    └──requires──> existing leaderboard:update event (already ships puzzleName)
    └──display requires──> multiple puzzle entries in leaderboard (testable: play 2 different puzzles)

Random mode overhaul
    └──requires──> existing triggerRandomEvent() + pickRandomEvent() in game.js
    └──new events may require──> new lobby state fields (double_turn: lobby.extraTurns)
    └──enhances──> randomMode:event client handler (already exists)

Reconnect after disconnect
    └──requires──> existing disconnecting handler in socket.js (modify, not replace)
    └──requires──> existing player slot structure { socketId, name, isHost }
    └──requires──> existing advanceTurnIfActive() for skip-on-disconnect
    └──conflicts with──> immediate lobby deletion when host disconnects (must scope to playing phase only)
```

### Dependency Notes

- **Per-level leaderboard has no blocking dependencies:** The `puzzleName` field is already in every entry. This is the lowest-risk feature to build first.
- **Profanity filter has no dependencies:** Pure addition to two existing handlers. Build anytime.
- **Controls modal has no dependencies:** Fully client-side. Build anytime. Content authoring requires Phase 10 to be understood (already complete and documented).
- **Random mode overhaul depends on existing event infrastructure:** The `triggerRandomEvent()`, `pickRandomEvent()`, and `randomMode:event` socket path all exist. New events are additions to existing switch/if logic.
- **Reconnect is the only feature with blocking architectural concerns:** The `disconnecting` handler currently always evicts. The 30-second hold logic must be introduced carefully to avoid breaking the existing evict-on-disconnect behavior for lobby phase.

---

## MVP Definition

This is a subsequent milestone, not a greenfield MVP. All 5 features are confirmed scope. The ordering below is by implementation risk and independence.

### Build in This Order (v1.2)

- [x] Profanity filter — zero risk, 1 npm package, 2 guards, tests in socket.test.js
- [x] Controls modal — zero server risk, pure client, observable in browser immediately
- [x] Per-level leaderboard (client-side filter) — zero server risk, extends existing UI
- [x] Random mode overhaul — moderate risk (new server state for `double_turn`), but well-scaffolded
- [x] Reconnect after disconnect — highest complexity, should be last

**Rationale for ordering:** Start with no-risk additions to build confidence and deliver visible value. Reconnect last because it requires the most surgical changes to existing disconnect logic and has the most edge cases.

### Defer to v1.3+

- Swap-piece and free-place random events (high complexity, low urgency)
- Reconnect across server restart (out of scope by PROJECT.md constraint)
- German profanity dictionary (acceptable gap for Uni demo)
- Pause-on-disconnect (anti-feature per analysis above)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Profanity filter | MEDIUM (safety/polish) | LOW | P1 |
| Controls modal | HIGH (discoverability, reduces confusion) | LOW | P1 |
| Per-level leaderboard | MEDIUM (motivation, replayability) | LOW | P1 |
| Random mode overhaul (rebalance + 2 new events) | HIGH (core chaos feel) | MEDIUM | P1 |
| Random mode overhaul (add `double_turn`, `reverse_order`) | HIGH (crazy not annoying) | MEDIUM | P1 |
| Reconnect after disconnect | HIGH (reliability, reduces frustration) | HIGH | P2 |
| Random mode overhaul (add `blind_bank` CSS-only) | MEDIUM (low-cost chaos) | LOW | P2 |
| Random mode overhaul (add `swap_piece`) | MEDIUM | HIGH | P3 |

---

## Complexity Summary by Feature

| Feature | Files Affected | Key Risk | Estimated Plans |
|---------|----------------|----------|-----------------|
| Profanity filter | `server/src/socket.js`, `server/package.json` | None — additive | 1 |
| Controls modal | `client/index.html`, `client/main.js`, `client/style.css` | None — additive | 1 |
| Per-level leaderboard | `client/main.js`, `client/index.html` | None — client-only | 1 |
| Random mode overhaul | `server/src/game.js` (new events + weights), client `main.js` if new visual effects | `double_turn` requires new lobby state + socket.js branch | 2 |
| Reconnect | `server/src/game.js` (player slot mutation), `server/src/socket.js` (new handler + modified disconnect), `client/main.js` (reconnect attempt) | Surgical changes to `disconnecting` handler; 30s timer lifecycle | 3 |

---

## Sources

### HIGH confidence (verified directly from codebase)
- Direct inspection: `server/src/game.js` — `triggerRandomEvent()`, `pickRandomEvent()`, `leaderboard`, `recordLeaderboardEntry()`, `getLeaderboard()` — confirms current event set, weights, and leaderboard schema
- Direct inspection: `server/src/socket.js` — `disconnecting` handler (lines 222-262), `joinRoom`/`createRoom` handlers — confirms current disconnect behavior and profanity integration point
- Direct inspection: `client/index.html` — no modal or dialog element exists; no info button; confirms zero modal infrastructure
- Direct inspection: `client/main.js` — `renderLobbyUpdate()`, `showGameNotification()`, `ensureGameNotification()` — confirms notification infrastructure, no modal code
- Direct inspection: `server/node_modules/` — `bad-words` not installed; must be added. `leo-profanity` not installed either.
- Direct inspection: `server/package.json` — current dependencies: Express, Socket.IO, cors, dotenv only
- Direct inspection: `.planning/STATE.md` — Phase 10 controls list confirmed as: single-click place, rotation buttons CW/CCW, R key, touch drag-to-preview, ghost-confirm, long-press return

### MEDIUM confidence (domain knowledge, established conventions)
- Controls modal pattern (Escape key, click-outside-close, X button): standard web modal conventions confirmed as the expected baseline in any browser game; no deviations expected for a Vanilla JS + HTML project
- Reconnect 30s window UX: co-op game standard (Among Us, Jackbox, Among Us all use visible countdown or status message); specific socket ID reassignment behavior confirmed from Socket.IO documentation training knowledge — Socket.IO client auto-reconnects with new socket ID, not the old one (HIGH confidence on this specific point)
- `bad-words` CommonJS compatibility: confirmed by npm package documentation pattern — the package uses `module.exports` and has been used in Express/Node.js projects widely; `require('bad-words')` pattern is standard

### LOW confidence (design opinions, not verified against external benchmarks)
- Event taxonomy "crazy vs. annoying" classification — this is design reasoning from game design principles, not empirical data. The distinction between visible/shared drama and invisible/individual-punishing events is well-established in party game design but not independently verified against LogiBlock user feedback.
- `double_turn` as a positive chaos event — untested as a mechanic; may feel confusing if not communicated clearly in the event banner

---

*Feature research for: LogiBlock v1.2 — Spielqualitat & Features*
*Researched: 2026-04-06*
*Covers: Random mode overhaul, controls modal, per-level leaderboard, reconnect, profanity filter*
*Ready for roadmap: yes*
