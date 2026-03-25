# Phase 9: Random Mode - Research

**Researched:** 2026-03-24
**Domain:** Socket.IO server-authoritative event system, vanilla JS client notification pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Lobby toggle:**
- Host-only control (consistent with puzzle selection pattern — `lobby:selectPuzzle`)
- New socket event `lobby:randomMode` with host guard, like `lobby:selectPuzzle`
- `getPublicState()` exposes `randomMode: bool` so all clients see current state
- Non-host clients: toggle visible but disabled (read-only)
- Initial state: `false` when lobby is created

**Event trigger:**
- After each completed turn (place or return action that succeeds), 30% chance an event fires
- Trigger point: in the turn-completion handler in `socket.js`, after `advanceTurn()`
- Server picks the event and broadcasts result; no client involvement in selection

**Event pool (4 events):**
1. `remove_piece` — A random non-anchor placed piece is removed back to the bank
2. `rotate_piece` — The active player's currently selected piece is rotated 90° CW (server signals, client applies)
3. `skip_turn` — Active player's turn is skipped (`advanceTurn` called a second time)
4. `shuffle_order` — All players are randomly reshuffled in `lobby.players` array; `activeTurnIndex` set to 0

**Event weighting (heavier events rarer):**
- `rotate_piece`: 35%
- `skip_turn`: 35%
- `remove_piece`: 15%
- `shuffle_order`: 15%

**Edge cases:**
- `rotate_piece` with no piece selected by active player → event skipped, no fallback
- `remove_piece` with no movable pieces on grid → event skipped
- `skip_turn` with only 1 player → event skipped (would skip back to same player)

**Event feedback:**
- Server broadcasts `randomMode:event` to all players in room with: `{ type, description }`
- Client shows a short banner (similar to existing `#lobby-notification` pattern but during gameplay — new `#game-notification` element or reuse existing)
- German notification strings for all 4 event types

**rotate_piece implementation note:**
- Server cannot directly rotate the client's `selectedRotation` (that's client state)
- Server sends event type `rotate_piece` in `randomMode:event` broadcast
- Client listens, rotates `selectedRotation` by +90, re-renders ghost preview

### Claude's Discretion
- Exact banner positioning and CSS for in-game notifications
- Whether to add `#game-notification` element or reuse a toast pattern
- Duration the banner is visible (e.g. 3 seconds)
- Exact German notification strings (e.g. "Chaos! P04 wurde entfernt!")

### Deferred Ideas (OUT OF SCOPE)
- Variable difficulty/intensity slider (e.g. 10%–60% event chance) — Phase 9 uses fixed 30%
- More event types (e.g. freeze a player, swap two pieces) — future extension
- Event history log visible to players — deferred, not in scope
</user_constraints>

---

## Summary

Phase 9 adds a server-authoritative "Random Mode" chaos layer to an existing Socket.IO cooperative puzzle game. The implementation is entirely additive — no existing logic is modified, only extended. The CONTEXT.md contains complete, unambiguous decisions for every piece of this feature, making research primarily a code-pattern verification exercise rather than design exploration.

The codebase is vanilla Node.js + Socket.IO (no framework, no build tool), with a proven host-guard pattern (`lobby:selectPuzzle`) that becomes the exact template for the new `lobby:randomMode` event handler. All four random events reuse existing game.js primitives: `returnPiece()` for `remove_piece`, `advanceTurn()` for `skip_turn`, and direct `lobby.players` mutation for `shuffle_order`. Only `rotate_piece` requires new coordination — a server signal that the client acts on.

The client already has a `#game-notification` element created lazily via `ensureGameNotification()` in `main.js`, and a `.notification` CSS class with the correct styling. This infrastructure is reused for in-game chaos event banners. The lobby toggle is a new `<input type="range" min="0" max="1">` slider rendered in `#host-controls` (host) and a read-only display in the non-host section.

**Primary recommendation:** Model everything on the `lobby:selectPuzzle` pattern. No new architectural patterns are needed — every piece of Phase 9 is a targeted extension of existing code.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Socket.IO | ^4.8.3 | Real-time bidirectional events | Already in production — `randomMode:event` is a new event name |
| Node.js built-in test | node:test | Unit tests | Already used in game.test.js and socket.test.js |
| Vanilla JS | — | Client logic | No build tool — single `main.js` file |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:assert/strict | built-in | Test assertions | Already used across both test files |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS slider toggle | CSS checkbox `<input type="checkbox">` | Context specifies slider visual; checkbox looks different |
| Reuse `#game-notification` | Create new `#random-event-notification` | Existing `ensureGameNotification()` already creates `#game-notification` lazily — extend rather than duplicate |

**Installation:** No new packages required. All dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure

No new files required. All changes are extensions of existing files:

```
server/src/
├── game.js        # Add: randomModeEnabled field, setRandomMode(), triggerRandomEvent()
└── socket.js      # Add: lobby:randomMode handler; extend game:move handler
client/
├── index.html     # Add: slider toggle in #host-controls; read-only display for non-hosts
└── main.js        # Add: socket.on('randomMode:event', ...) handler; lobby toggle rendering
```

### Pattern 1: Host-Guard Event Handler (lobby:randomMode)

**What:** Exact mirror of `lobby:selectPuzzle`. Host emits `lobby:randomMode`, server validates host, updates state, broadcasts `lobby:update` to all.

**When to use:** Any host-only lobby control.

**Example (from existing socket.js lines 91-111):**
```javascript
// Source: server/src/socket.js — lobby:selectPuzzle handler (exact template)
socket.on('lobby:selectPuzzle', ({ puzzleId } = {}) => {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;

  const lobby = getLobby(roomCode);
  if (!lobby) return;
  if (lobby.hostId !== socket.id) {
    return socket.emit('room:error', 'Only the host can select a puzzle');
  }
  if (lobby.phase !== 'lobby') return;

  const updated = setSelectedPuzzle(roomCode, puzzleId);
  if (!updated) {
    return socket.emit('room:error', 'Invalid puzzle selection');
  }
  io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
});

// New handler follows exactly this shape:
socket.on('lobby:randomMode', ({ enabled } = {}) => {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;
  const lobby = getLobby(roomCode);
  if (!lobby) return;
  if (lobby.hostId !== socket.id) {
    return socket.emit('room:error', 'Only the host can change random mode');
  }
  if (lobby.phase !== 'lobby') return;

  lobby.randomModeEnabled = !!enabled;
  io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
});
```

### Pattern 2: Weighted Random Selection

**What:** Map cumulative probability thresholds to event types. No external library needed.

**When to use:** Any fixed-weight discrete probability selection.

```javascript
// Source: first-principles — standard weighted random pattern
function pickRandomEvent() {
  const r = Math.random();
  if (r < 0.35) return 'rotate_piece';   // 0.00–0.35
  if (r < 0.70) return 'skip_turn';      // 0.35–0.70
  if (r < 0.85) return 'remove_piece';   // 0.70–0.85
  return 'shuffle_order';                // 0.85–1.00
}
```

### Pattern 3: Post-Turn Random Event Trigger in socket.js

**What:** After a successful `place` action advances turn (not on win, not on return), check for 30% event fire.

**Trigger point:** After `advanceTurn(lobby)` call in the `place` branch, before `game:stateUpdate` broadcast.

```javascript
// Extended from socket.js lines 174-177
advanceTurn(lobby);

// Random Mode: 30% chance after each completed turn
if (lobby.randomModeEnabled && Math.random() < 0.30) {
  const event = triggerRandomEvent(lobby);  // defined in game.js
  if (event) {
    io.to(roomCode).emit('randomMode:event', event);
  }
}

io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode));
```

Key invariant: `randomMode:event` broadcast BEFORE `game:stateUpdate` so clients receive the event description then the updated state in order.

### Pattern 4: Random Event Implementation in game.js

**What:** Pure functions that mutate lobby state and return `{ type, description }` or `null` if skipped.

**remove_piece:** Collect all `{ movable: true }` cells, pick one by `shapeId`, call existing `returnPiece(lobby, shapeId)`.

**skip_turn:** Guard `lobby.players.length > 1`, then call `advanceTurn(lobby)` a second time.

**shuffle_order:** Fisher-Yates shuffle on `lobby.players`, reset `activeTurnIndex = 0`.

**rotate_piece:** Server cannot mutate client-side `selectedRotation`. Server signals only — client applies rotation in `socket.on('randomMode:event')` handler.

```javascript
// Source: first-principles — Fisher-Yates shuffle
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
```

### Pattern 5: Client randomMode:event Handler

**What:** Listen for server event, show timed banner, apply rotation if `rotate_piece`.

**When to use:** Only during game phase.

```javascript
// In main.js — new socket listener
socket.on('randomMode:event', ({ type, description }) => {
  showGameNotification(description);  // uses/extends ensureGameNotification()

  if (type === 'rotate_piece' && selectedShapeId) {
    selectedRotation = (selectedRotation + 90) % 360;
    updateBankSelection();
    if (lastHoveredRow !== null && lastHoveredCol !== null) {
      updateGhostPreview(lastHoveredRow, lastHoveredCol);
    }
  }
});
```

### Pattern 6: Lobby Toggle Rendering

**What:** Host sees an `<input type="range">` slider (0=off, 1=on) inside `#host-controls`. Non-host sees a read-only text display. Both driven from `getPublicState().randomMode`.

**HTML addition to index.html** inside `<section class="host-controls" id="host-controls">`:
```html
<div class="random-mode-control">
  <label for="random-mode-toggle">Chaos-Modus</label>
  <input id="random-mode-toggle" type="range" min="0" max="1" step="1" value="0">
</div>
```

**Non-host addition** in the non-host waiting section:
```html
<p id="random-mode-display" class="hint" style="display:none;"></p>
```

**JS in main.js** `renderLobbyUpdate` — add to host branch:
```javascript
const toggle = document.getElementById('random-mode-toggle');
if (toggle) toggle.value = state.randomMode ? 1 : 0;
```
Add to non-host branch:
```javascript
randomModeDisplay.textContent = state.randomMode ? 'Chaos-Modus: Aktiv' : '';
randomModeDisplay.style.display = state.randomMode ? 'block' : 'none';
```

**Emit on slider change** (host only):
```javascript
document.getElementById('random-mode-toggle')?.addEventListener('input', () => {
  if (!amIHost) return;
  const enabled = document.getElementById('random-mode-toggle').value === '1';
  socket.emit('lobby:randomMode', { enabled });
});
```

### Anti-Patterns to Avoid

- **Firing event on `return` action:** Context specifies trigger only after completed `place` turns. `return` does not advance turn and must not fire events.
- **Firing event on win:** The `result.win` branch already skips `advanceTurn`. The event check must also be skipped (it lives in the `!result.win` branch after `advanceTurn`).
- **Mutating client `selectedRotation` from server:** Impossible — it's module-level JS state. Server signals intent only via `rotate_piece` event type.
- **Using `shuffle_order` without resetting `activeTurnIndex`:** After shuffle, always reset to 0 to prevent out-of-bounds index.
- **Broadcasting `randomMode:event` AFTER `game:stateUpdate`:** Clients would render the new grid state before seeing the event description. Always emit event first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Remove piece from grid | Custom grid-clearing code | `returnPiece(lobby, shapeId)` in game.js (line 141) | Already handles found/not-found, null-clears all cells of that shape |
| Advance turn | Manual index math | `advanceTurn(lobby)` in game.js (line 167) | Already handles circular wrap and 0-length guard |
| Pick random placed piece | Custom grid scan | Scan grid for `cell.movable === true`, collect unique shapeIds, pick with `Math.random()` | One pass, deduplicate with Set |
| Shuffle array | Custom sort-based shuffle | Fisher-Yates (4 lines) | Sort-based shuffle has statistical bias |
| In-game notification | New DOM element | `ensureGameNotification()` already in main.js (line 544) | Creates `#game-notification` lazily; `.notification` CSS class already styled |

**Key insight:** The event implementations are almost entirely composition of existing primitives. `remove_piece` = scan grid + `returnPiece`. `skip_turn` = guard + `advanceTurn`. No new data structures, no new game logic patterns.

---

## Common Pitfalls

### Pitfall 1: rotate_piece with No Active Selection
**What goes wrong:** Server broadcasts `rotate_piece` but `selectedShapeId` is null (player has no piece selected). Client rotates `selectedRotation` from 0 to 90, but there is nothing selected — on next bank click the user is surprised their piece starts at 90°.
**Why it happens:** `selectedRotation` is a persistent module-level variable, not reset to 0 unless the bank selection explicitly resets it.
**How to avoid:** In the client handler, only update `selectedRotation` if `selectedShapeId !== null`. The context decision says server skips event if no piece selected — but the server has no knowledge of client selection state. The skip-if-null guard must be on the client side too.
**Warning signs:** Ghost preview appears rotated after random event with no piece in hand.

### Pitfall 2: Event Fires on Winning Move
**What goes wrong:** `triggerRandomEvent` fires after the winning placement, chaotically removing a piece that just won the game.
**Why it happens:** The event trigger is added after `advanceTurn()`, but the win branch returns early before `advanceTurn()` is called — so if the random event check is placed incorrectly (outside the `else` block), it will fire on wins too.
**How to avoid:** Place the random event check only inside the `else` branch (non-winning path). Current socket.js structure makes this explicit:
```
if (result.win) { ... game:win ... }
else { advanceTurn(); /* event check here */ game:stateUpdate }
```
**Warning signs:** `randomMode:event` received simultaneously with or after `game:win`.

### Pitfall 3: shuffle_order + activeTurnIndex Out of Bounds
**What goes wrong:** After shuffling `lobby.players`, the existing `activeTurnIndex` (e.g. 2 in a 3-player game) still points to index 2, but the player at index 2 is now someone different. Intent is "shuffle as a disruptive reset."
**Why it happens:** Shuffle mutates array order; index semantics are position-based not identity-based.
**How to avoid:** Always set `lobby.activeTurnIndex = 0` immediately after the shuffle. This is a locked decision in CONTEXT.md.
**Warning signs:** Wrong player shown as active after shuffle event.

### Pitfall 4: randomMode:event vs game:stateUpdate Ordering
**What goes wrong:** `game:stateUpdate` arrives before `randomMode:event`, so the client renders the new grid (piece removed, turn advanced) before displaying the notification explaining why.
**Why it happens:** Two separate `io.to(roomCode).emit()` calls — Socket.IO delivers them in order within a connection, but the order of the calls matters.
**How to avoid:** Always emit `randomMode:event` first, then `game:stateUpdate` in the same synchronous code block.
**Warning signs:** Banner appears briefly after grid has already updated, or not at all.

### Pitfall 5: remove_piece Picks Anchor Cells
**What goes wrong:** Grid scan includes `{ shapeId: 'A', movable: false }` anchor cells. Calling `returnPiece(lobby, 'A')` returns `{ ok: false, error: 'Invalid shape' }` — event silently fails.
**Why it happens:** Grid scan does not filter `movable` flag.
**How to avoid:** Filter to `cell.movable === true` when collecting candidate shapeIds for removal.
**Warning signs:** `remove_piece` event fires but nothing is removed.

### Pitfall 6: Slider Fires Multiple Input Events
**What goes wrong:** `input` event fires on every intermediate value during drag (0 → 0.3 → 0.7 → 1). For a range of 0-1 step 1 this is irrelevant (only two positions), but if not using `step="1"`, the server receives many rapid `lobby:randomMode` events.
**Why it happens:** `input` fires continuously during drag on range inputs.
**How to avoid:** Use `step="1"` on the range input so only discrete 0/1 values are emitted.

---

## Code Examples

Verified patterns from existing source:

### Existing: returnPiece signature and behavior
```javascript
// Source: server/src/game.js line 141
function returnPiece(lobby, shapeId) {
  // Returns { ok: true } on success, { ok: false, error } on failure
  // Clears ALL cells of shapeId where movable === true
  // Returns { ok: false, error: 'Shape not on grid' } if not placed
  // Returns { ok: false, error: 'Invalid shape' } for anchors
}
```

### Existing: advanceTurn signature
```javascript
// Source: server/src/game.js line 167
function advanceTurn(lobby) {
  // No-op if lobby.players.length === 0
  // Circular: (index + 1) % players.length
}
```

### Existing: getPublicState — where to add randomMode
```javascript
// Source: server/src/game.js line 175 — return block
return {
  roomCode: lobby.roomCode,
  phase: lobby.phase,
  players: lobby.players.map(p => ({ ... })),
  selectedPuzzleName: ...,
  // ... existing fields ...
  randomMode: lobby.randomModeEnabled ?? false,  // ADD THIS
};
```

### Existing: notification CSS (style.css lines 269-278)
```css
/* .notification class already covers the banner pattern */
.notification { font-size: 0.85rem; min-height: 1.4em; }
.notification:not(:empty) {
  font-weight: 600;
  padding: 0.45rem 0.75rem;
  background: var(--clr-warning-bg);
  border: 2px solid var(--clr-accent-dark);
  border-radius: var(--r-md);
  color: var(--clr-text);
  box-shadow: var(--sh-xs);
}
```

### Existing: ensureGameNotification pattern (main.js lines 544-558)
```javascript
// Source: client/main.js line 544
function ensureGameNotification() {
  if (!document.getElementById('game-notification')) {
    const el = document.createElement('p');
    el.id = 'game-notification';
    el.className = 'notification';
    el.setAttribute('aria-live', 'polite');
    document.getElementById('game-screen').appendChild(el);
  }
  return document.getElementById('game-notification');
}
function showGameError(message) {
  const el = ensureGameNotification();
  el.textContent = `Move rejected: ${message}`;
  setTimeout(() => { el.textContent = ''; }, 3500);
}
// New showGameNotification can follow this exact shape but without "Move rejected: " prefix
```

### German Notification Strings (recommended)
```javascript
// Claude's discretion — recommend concise, punchy strings matching "chaos" feel
const RANDOM_EVENT_MESSAGES = {
  remove_piece:  (shapeId) => `Chaos! ${shapeId} wurde vom Spielfeld entfernt!`,
  rotate_piece:  () => `Chaos! Dein Stein wurde rotiert!`,
  skip_turn:     (playerName) => `Chaos! ${playerName} verliert seinen Zug!`,
  shuffle_order: () => `Chaos! Die Spielerreihenfolge wurde durchgemischt!`,
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| N/A — new feature | Server-authoritative event selection | Phase 9 | Consistent with existing server-authority model |

**No deprecated patterns involved.** Phase 9 is purely additive.

---

## Open Questions

1. **`rotate_piece` — should it notify all players or only the affected player?**
   - What we know: Context says server broadcasts `randomMode:event` to ALL players in room.
   - What's unclear: The description string "Dein Stein wurde rotiert!" uses "Dein" (your) but goes to all clients.
   - Recommendation: Use third-person for all players: "Chaos! [PlayerName]'s Stein wurde rotiert!" — or make the client detect if it's the active player and adjust message locally. Simplest: use active player name in description (server knows `lobby.players[lobby.activeTurnIndex].name`).

2. **`rotate_piece` — what if `selectedShapeId` is null on the client?**
   - What we know: Context says server skips event if no piece selected (no fallback). But server cannot know client `selectedShapeId`.
   - What's unclear: Server has no way to check client selection. The "skip" decision in CONTEXT.md may mean: if the event fires and client has nothing selected, the rotation is a no-op (cosmetic skip).
   - Recommendation: Treat as client-side no-op when `selectedShapeId === null`. The event still shows the banner notification. This is consistent with CONTEXT.md's "event skipped, no fallback" — no state mutation needed on server.

3. **Slider vs toggle visual — CSS needed?**
   - What we know: Context specifies "slider (not a checkbox) — visual distinction".
   - What's unclear: The existing `style.css` has no `input[type=range]` styling.
   - Recommendation: Add minimal CSS for the range input — a few lines to give it the toy aesthetic (border, snap feel). This is Claude's discretion.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` |
| Config file | none — run with `node --test` |
| Quick run command | `cd server && node --test src/game.test.js` |
| Full suite command | `cd server && node --test src/game.test.js src/socket.test.js` |

### Phase Requirements → Test Map

Phase 9 has no formal requirement IDs in REQUIREMENTS.md (new feature outside v1.1 scope). Mapping by behavior:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| `setRandomMode()` updates `lobby.randomModeEnabled` | unit | `node --test src/game.test.js` | ❌ Wave 0 |
| `triggerRandomEvent()` returns correct event types | unit | `node --test src/game.test.js` | ❌ Wave 0 |
| `remove_piece` event calls `returnPiece` and returns correct shape | unit | `node --test src/game.test.js` | ❌ Wave 0 |
| `skip_turn` advances turn index a second time | unit | `node --test src/game.test.js` | ❌ Wave 0 |
| `shuffle_order` resets `activeTurnIndex = 0` | unit | `node --test src/game.test.js` | ❌ Wave 0 |
| `triggerRandomEvent` returns `null` for edge case skips | unit | `node --test src/game.test.js` | ❌ Wave 0 |
| `getPublicState` includes `randomMode` field | unit | `node --test src/game.test.js` | ❌ Wave 0 |
| `lobby:randomMode` socket handler — host guard | integration | `node --test src/socket.test.js` | ❌ Wave 0 |
| `lobby:randomMode` socket handler — broadcasts `lobby:update` | integration | `node --test src/socket.test.js` | ❌ Wave 0 |
| `game:move` place triggers `randomMode:event` broadcast at 100% prob | integration | `node --test src/socket.test.js` | ❌ Wave 0 |
| `game:move` place does NOT trigger event on win | integration | `node --test src/socket.test.js` | ❌ Wave 0 |
| `game:move` return does NOT trigger event | integration | `node --test src/socket.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd "/Users/louispoller/Library/Mobile Documents/com~apple~CloudDocs/02_Code_Projekte/Uni_Projekte/LogiBlock/server" && node --test src/game.test.js`
- **Per wave merge:** `cd "/Users/louispoller/Library/Mobile Documents/com~apple~CloudDocs/02_Code_Projekte/Uni_Projekte/LogiBlock/server" && node --test src/game.test.js src/socket.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

All new test cases need to be added to existing test files — no new files required:

- [ ] `src/game.test.js` — add `describe('triggerRandomEvent', ...)` block covering all 4 event types + 3 edge-case skips + `getPublicState` `randomMode` field
- [ ] `src/socket.test.js` — add `describe('lobby:randomMode handler', ...)` and extend `game:move handler` tests with `randomMode:event` broadcast assertions

*(Existing `before(() => loadPuzzles())` and `makeMocks()` infrastructure reused — no new fixtures needed)*

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `server/src/socket.js` — host guard pattern, event handler structure
- Direct code inspection: `server/src/game.js` — `returnPiece()`, `advanceTurn()`, `getPublicState()`, `createLobby()` signatures
- Direct code inspection: `client/main.js` — `ensureGameNotification()`, `selectedRotation` state, `renderLobbyUpdate()` structure
- Direct code inspection: `client/index.html` — existing DOM element IDs, `#host-controls` structure
- Direct code inspection: `client/style.css` — `.notification` CSS class definition
- Direct code inspection: `server/src/game.test.js` + `socket.test.js` — test infrastructure patterns

### Secondary (MEDIUM confidence)
- `09-CONTEXT.md` — Complete implementation decisions locked by user in context session

### Tertiary (LOW confidence)
- None required — all findings verified by direct code inspection

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Socket.IO and node:test already in use; no new packages needed
- Architecture: HIGH — All patterns directly verified from existing source files
- Pitfalls: HIGH — Derived from direct inspection of trigger points, data flow, and state invariants
- Test infrastructure: HIGH — Existing test harness (`makeMocks`, `makePlayingLobby`) directly applicable

**Research date:** 2026-03-24
**Valid until:** 2026-05-01 (stable — no moving dependencies)
