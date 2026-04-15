# Phase 14: Random Mode Overhaul - Research

**Researched:** 2026-04-07
**Domain:** Socket.IO multiplayer game state — server-side event dispatch, client-side CSS effects, timer-based UI
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **double_turn:** `extraTurns = 1` cap (no stacking); decrement on successful placement if `> 0`; skip `advanceTurn()` during extra turn; return action during extra turn does NOT consume it; all clients see ⚡ badge via `getPublicState().extraTurns`
- **reverse_order:** `lobby.players.reverse()` in-place; `activeTurnIndex = 0`; propagated via next `game:stateUpdate`
- **blind_bank:** Affects ALL players; server emits `{ type: 'blind_bank', description: '...' }` in `randomMode:event`; client adds `.blind` class to `#piece-bank`; 5-second duration with visible countdown; `setTimeout(5000)` clears `.blind`; 1s interval updates countdown text
- **rotate_piece fix:** Delayed-trap entirely on the client. Client receives event → sets `pendingRotate = true` → on next piece selection (selectedShapeId changes from null to value) → 2-second timer → apply rotation, re-render; server is unchanged
- **Weight table (all 7 events):** rotate_piece 10%, skip_turn 15%, remove_piece 20%, shuffle_order 15%, double_turn 15%, reverse_order 15%, blind_bank 10%
- **Notification banner upgrade:** Replace existing small `#game-notification` text element with a prominent overlay banner above the grid; large text, semi-transparent dark background, auto-dismisses 2–3 seconds; applies to all 7 events
- **Trigger point for double_turn:** `advanceTurn()` is skipped in `socket.js` place-branch when `lobby.extraTurns > 0`

### Claude's Discretion

- Exact CSS for `.blind` class (opacity 0? blur? dark overlay?)
- Exact CSS for new notification banner (colors, font size, animation)
- Exact countdown display implementation (text above bank vs. inside bank)
- German strings for all event descriptions
- Whether to use `transform: rotateY` or plain opacity for the blind effect

### Deferred Ideas (OUT OF SCOPE)

- Variable event probability slider (10%–60%)
- Event history log visible to players
- rotate_piece affecting ALL players' held pieces
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RAND-01 | `double_turn` event: active player gets a second placement this turn; `lobby.extraTurns` counter gates extra turn; `advanceTurn` skipped on first placement | `triggerRandomEvent()` branch + `socket.js` place-branch restructuring; `createLobby()` initializes `extraTurns = 0`; `getPublicState()` exposes `extraTurns` |
| RAND-02 | `reverse_order` event: `lobby.players` reversed in-place; `activeTurnIndex` reset to 0; all clients see reordered badges | `triggerRandomEvent()` branch mirrors `shuffle_order` pattern but uses `Array.prototype.reverse()` instead of `shuffleArray()` |
| RAND-03 | `blind_bank` event: server emits `{ type: 'blind_bank' }` in `randomMode:event`; client adds `.blind` class to `#piece-bank` for one turn | Client `randomMode:event` handler; new CSS `.blind` rule; `setTimeout` + 1s interval countdown |
</phase_requirements>

---

## Summary

Phase 14 extends the existing random mode system (Phase 9) by adding three new chaos events and rebalancing all seven event weights. The existing infrastructure is solid and the extension points are explicit: `pickRandomEvent()` needs its weight table replaced, `triggerRandomEvent()` needs three new `if (eventType === ...)` branches, `createLobby()` needs `extraTurns: 0` initialized, `getPublicState()` needs `extraTurns` exposed, and `socket.js`'s place-branch needs a `lobby.extraTurns > 0` check before calling `advanceTurn()`.

The client side has two independent work items: (1) a CSS `.blind` rule on `#piece-bank` with a countdown timer driven by `setTimeout`/`setInterval`, and (2) a visual upgrade to `showGameNotification()` from the current simple text element (`<p id="game-notification">`) to a prominent overlay banner. The `rotate_piece` fix is a pure client change — a `pendingRotate` flag that fires a delayed rotation when the player next picks a piece.

No third-party libraries or new npm packages are needed. All patterns follow the established codebase conventions: server-authoritative state, `getPublicState()` as the only serialization path, `io.to(roomCode).emit('randomMode:event', event)` before `game:stateUpdate`, Node.js built-in test runner with `node:test`/`node:assert/strict`.

**Primary recommendation:** Implement in two plans — 14-01 (server: game.js + socket.js + game.test.js) and 14-02 (client: main.js + style.css + human verification). This mirrors the existing Phase 9 split.

---

## Standard Stack

### Core (no new packages)

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| Node.js built-in `node:test` | Node 20+ built-in | Unit tests for game.js and socket.js | Already used by `game.test.js` and `socket.test.js` |
| `node:assert/strict` | Built-in | Assertions in tests | Already used throughout test suite |
| Socket.IO 4.8.x | `^4.8.3` (existing) | Real-time event broadcast | Already in server/package.json |
| Vanilla JS + `setTimeout`/`setInterval` | Browser built-in | Countdown timer for blind_bank | No-build-tools constraint; consistent with existing patterns |

### No New Installs

All work is extension of existing code. No `npm install` required.

**Version verification:** Server uses `socket.io@^4.8.3` per `server/package.json`. No changes.

---

## Architecture Patterns

### Existing Random Mode Flow (HIGH confidence — verified in source)

```
socket.js game:move place-branch
  → placePiece() → { ok: true, win: false }
  → advanceTurn(lobby)           ← Phase 14: skip this when extraTurns > 0
  → if randomModeEnabled && Math.random() < 0.30:
      event = triggerRandomEvent(lobby)
      io.to(room).emit('randomMode:event', event)   ← before stateUpdate
  → io.to(room).emit('game:stateUpdate', getPublicState(room))
```

### Phase 14 Modified Flow for double_turn

```
socket.js game:move place-branch (after Phase 14)
  → placePiece() → { ok: true, win: false }
  → if lobby.extraTurns > 0:
      lobby.extraTurns--
      // skip advanceTurn — same player goes again
  → else:
      advanceTurn(lobby)
      if randomModeEnabled && Math.random() < 0.30:
        event = triggerRandomEvent(lobby)
        if event: io.to(room).emit('randomMode:event', event)
  → io.to(room).emit('game:stateUpdate', getPublicState(room))
```

**Key design constraint:** Random events only trigger when `advanceTurn` is called (i.e. NOT during the extra turn). This prevents a double_turn event from triggering another double_turn mid-extra-turn sequence.

### Recommended Project Structure

No structural changes. All changes are in-place extensions:

```
server/src/
├── game.js          # pickRandomEvent(), triggerRandomEvent(), createLobby(), getPublicState()
├── game.test.js     # new describe() blocks for 3 new events + extraTurns state
└── socket.js        # place-branch: extraTurns check before advanceTurn

client/
├── main.js          # randomMode:event handler, showGameNotification(), renderTurnUI()
└── style.css        # .blind rule, .event-banner styles
```

### Pattern: pickRandomEvent() Weight Table Replacement

**Current (4 events, Phase 9):**
```javascript
// server/src/game.js
function pickRandomEvent() {
  const r = Math.random();
  if (r < 0.30) return 'rotate_piece';
  if (r < 0.60) return 'skip_turn';
  if (r < 0.80) return 'remove_piece';
  return 'shuffle_order';
}
```

**Phase 14 (7 events, cumulative thresholds):**
```javascript
function pickRandomEvent() {
  const r = Math.random();
  if (r < 0.10) return 'rotate_piece';    // 10%
  if (r < 0.25) return 'skip_turn';       // 15%
  if (r < 0.45) return 'remove_piece';    // 20%
  if (r < 0.60) return 'shuffle_order';   // 15%
  if (r < 0.75) return 'double_turn';     // 15%
  if (r < 0.90) return 'reverse_order';   // 15%
  return 'blind_bank';                    // 10%
}
```

### Pattern: triggerRandomEvent() Extension

The existing function uses `if (eventType === 'X') { ... return { type, description }; }` guards. New events follow the exact same pattern appended before the final `return null`:

```javascript
// Source: server/src/game.js (verified in source)
if (eventType === 'double_turn') {
  if (lobby.extraTurns > 0) return null; // no stacking — cap at 1
  lobby.extraTurns = 1;
  return {
    type: 'double_turn',
    description: `Chaos! ${activePlayerName} bekommt einen zweiten Zug!`,
  };
}

if (eventType === 'reverse_order') {
  lobby.players.reverse();
  lobby.activeTurnIndex = 0;
  return {
    type: 'reverse_order',
    description: 'Chaos! Die Reihenfolge wurde umgekehrt!',
  };
}

if (eventType === 'blind_bank') {
  return {
    type: 'blind_bank',
    description: 'Chaos! Alle sind blind für 5 Sekunden!',
  };
}
```

### Pattern: createLobby() extraTurns Initialization

```javascript
// server/src/game.js — add extraTurns: 0 alongside randomModeEnabled: false
lobbies.set(roomCode, {
  roomCode,
  hostId: hostSocketId,
  selectedPuzzleId: firstPuzzleId,
  phase: 'lobby',
  players: [{ socketId: hostSocketId, name: hostName, isHost: true }],
  grid: null,
  randomModeEnabled: false,
  extraTurns: 0,           // NEW: Phase 14 double_turn gate
});
```

### Pattern: getPublicState() extraTurns Exposure

```javascript
// server/src/game.js — add to return object
return {
  // ...existing fields...
  randomMode: lobby.randomModeEnabled ?? false,
  extraTurns: lobby.extraTurns ?? 0,   // NEW: client needs this for ⚡ badge
};
```

### Pattern: socket.js Place-Branch Restructuring

The current `else` block (non-win path) calls `advanceTurn(lobby)` unconditionally. Phase 14 adds a guard:

```javascript
// server/src/socket.js — game:move place-branch, non-win path
} else {
  // double_turn gate: if extra turn is pending, consume it and skip advanceTurn
  if (lobby.extraTurns > 0) {
    lobby.extraTurns--;
    // No advanceTurn — same player goes again; no random event trigger either
  } else {
    advanceTurn(lobby);
    // Random Mode: 30% chance of chaos event after each successful place
    if (lobby.randomModeEnabled && Math.random() < 0.30) {
      const event = triggerRandomEvent(lobby);
      if (event) {
        io.to(roomCode).emit('randomMode:event', event);
      }
    }
  }
  io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode));
}
```

### Pattern: Client blind_bank Handler

```javascript
// client/main.js — inside socket.on('randomMode:event', ...)
if (type === 'blind_bank') {
  const bank = document.getElementById('piece-bank');
  bank.classList.add('blind');

  let remaining = 5;
  // Show countdown above the bank (or inside it)
  const countdownEl = document.createElement('div');
  countdownEl.id = 'blind-countdown';
  countdownEl.textContent = `Blind! ${remaining}s`;
  bank.parentElement.insertBefore(countdownEl, bank);

  const countInterval = setInterval(() => {
    remaining--;
    countdownEl.textContent = `Blind! ${remaining}s`;
    if (remaining <= 0) clearInterval(countInterval);
  }, 1000);

  setTimeout(() => {
    bank.classList.remove('blind');
    countdownEl.remove();
    clearInterval(countInterval); // safety cleanup
  }, 5000);
}
```

### Pattern: Client rotate_piece Delayed Trap

```javascript
// client/main.js — module-level state
let pendingRotate = false;

// In socket.on('randomMode:event', ...) — replace the existing rotate_piece handler:
if (type === 'rotate_piece') {
  pendingRotate = true;
  // Rotation fires when player next selects a piece (selectedShapeId changes)
}

// In renderBank() piece click handler — after selectedShapeId is set to a new value:
if (pendingRotate && selectedShapeId !== null) {
  pendingRotate = false;
  setTimeout(() => {
    selectedRotation = (selectedRotation + 90) % 360;
    updateBankSelection();
    updateRotationButtons();
    if (lastHoveredRow !== null && lastHoveredCol !== null) {
      updateGhostPreview(lastHoveredRow, lastHoveredCol);
    }
  }, 2000);
}
```

**Important:** The current `randomMode:event` rotate_piece handler fires immediately with a 1200ms delay and checks `selectedShapeId !== null` at the time of the event. The new delayed-trap fires on NEXT piece selection (not at event time), which avoids the Phase 9 bug where the event fires after `advanceTurn()` when the new active player has no piece selected.

**Trap for deselect case:** If `pendingRotate = true` and the player clicks the same piece to deselect (selectedShapeId goes null → null), the trap must NOT fire. Trigger condition: `pendingRotate && selectedShapeId !== null` (only when selection goes null → value).

### Pattern: renderTurnUI() ⚡ Badge

```javascript
// client/main.js — renderTurnUI() addition
(state.players || []).forEach(player => {
  const badge = document.createElement('div');
  badge.classList.add('player-badge');
  const isActive = player.name === state.activePlayerName;
  // Show ⚡ when this player is active AND has extraTurns pending
  const showBolt = isActive && (state.extraTurns ?? 0) > 0;
  badge.textContent = player.name + (showBolt ? ' ⚡' : '');
  if (isActive) badge.classList.add('active');
  badgesContainer.appendChild(badge);
});
```

### Pattern: showGameNotification() Banner Upgrade

Current implementation appends a `<p>` element to `#game-screen` and sets its `textContent`. Replace with a positioned overlay div:

```javascript
function showGameNotification(message) {
  // Remove any existing banner
  const existing = document.getElementById('event-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'event-banner';
  banner.className = 'event-banner';
  banner.textContent = message;
  document.getElementById('game-screen').appendChild(banner);

  setTimeout(() => {
    banner.remove();
  }, 2500);
}
```

CSS `.event-banner` is positioned absolutely above the grid, centered, with large text and semi-transparent dark background.

### Anti-Patterns to Avoid

- **Triggering random events during the extra turn:** The random event block MUST be inside the `else` branch (normal turn path), not after `io.to(room).emit('game:stateUpdate')` unconditionally.
- **Stacking double_turn:** The `triggerRandomEvent` double_turn branch returns `null` if `lobby.extraTurns > 0` already. This prevents a second event from granting a third placement.
- **extraTurns surviving across game restarts:** `startGame()` does not reset `lobby.extraTurns` because `createLobby()` initializes it to 0 and the game starts from there. If the game can be restarted without creating a new lobby, `startGame()` must also reset `extraTurns = 0`. (See Pitfall 3.)
- **blind_bank affecting the wrong element:** The `#piece-bank` div is the correct target. Using `.piece-bank` class selector could accidentally match other elements if the class is reused. Use `document.getElementById('piece-bank')` (consistent with existing `renderBank()`).
- **Multiple blind_bank timers stacking:** If `blind_bank` fires again while the 5s timer is still running, the `bank.classList.add('blind')` is idempotent, but there will be two `setTimeout` callbacks trying to remove `.blind`. Fix: clear any existing blind timer before starting a new one (use a module-level `let blindTimer = null`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Weighted random event selection | Custom binary search or lookup table | Cumulative `if (r < threshold)` chain | Already established in `pickRandomEvent()` — extend in place |
| Countdown timer | CSS animation only | `setInterval` 1s + `setTimeout` clear | Need DOM text updates + precise class removal |
| Array reversal | Custom loop | `Array.prototype.reverse()` in-place | Deterministic, built-in, sufficient per CONTEXT.md |
| Event broadcasting | Manual socket loops | `io.to(roomCode).emit()` | Established pattern; broadcast to room handles all clients |

**Key insight:** Every new event type is a simple mutation of `lobby` state followed by returning a `{ type, description }` object. There is no infrastructure to build.

---

## Common Pitfalls

### Pitfall 1: double_turn random event trigger timing
**What goes wrong:** If the random event block runs unconditionally after the `extraTurns--` path, a `double_turn` event could fire during an extra turn, giving the player a third placement.
**Why it happens:** Moving the event trigger block outside the `if/else` on `extraTurns`.
**How to avoid:** Keep the random event trigger exclusively in the `else` branch (normal turn path, after `advanceTurn()`).
**Warning signs:** A player gets more than 2 placements in a row.

### Pitfall 2: rotate_piece pendingRotate fires on deselect
**What goes wrong:** Player clicks the currently selected piece to deselect it. `selectedShapeId` goes from `'P01'` to `null`. The pendingRotate trap fires on any click event in the bank, including deselect.
**Why it happens:** Trigger condition checks for bank click without verifying the direction of the transition (null → value vs. value → null).
**How to avoid:** Only fire the `setTimeout` when `selectedShapeId !== null` after the click (i.e. a new piece was selected, not deselected). Check: `if (pendingRotate && selectedShapeId !== null)`.
**Warning signs:** Rotation fires when player deselects a piece.

### Pitfall 3: extraTurns not reset on game restart
**What goes wrong:** If the host starts a new game within the same lobby (code path exists via `startGame()` being callable again after a win), `extraTurns` carries over from the previous game.
**Why it happens:** `startGame()` in `game.js` does not touch `extraTurns`; only `createLobby()` initializes it.
**How to avoid:** Add `lobby.extraTurns = 0;` inside `startGame()` alongside the `lobby.phase = 'playing'` reset. Verify in test.
**Warning signs:** First placement of a new game does not advance the turn.

### Pitfall 4: Multiple blind timers on rapid-fire events
**What goes wrong:** Two `blind_bank` events fire in quick succession (possible since events fire on every placement at 30% rate). The second `setTimeout` fires after 5s and removes `.blind` early.
**Why it happens:** Each event creates an independent `setTimeout`; no reference to cancel the first one.
**How to avoid:** Keep a module-level `let blindTimer = null`. Before setting a new timer, `clearTimeout(blindTimer)` and clear the interval too. Re-start both fresh.
**Warning signs:** Bank reveals itself after 5 seconds even when it should still be blind.

### Pitfall 5: reverse_order with `activeTurnIndex` pointing to wrong player
**What goes wrong:** After `lobby.players.reverse()`, the player who was at index `N` is now at index `length-1-N`. If `activeTurnIndex` is not reset to 0, it still points to the original index which now holds a different player.
**Why it happens:** Forgetting to reset `activeTurnIndex = 0` after the reverse.
**How to avoid:** Always set `lobby.activeTurnIndex = 0` immediately after `lobby.players.reverse()`. This is locked in CONTEXT.md.
**Warning signs:** The wrong player gets the turn after reverse_order fires.

### Pitfall 6: blind_bank countdown text placement collision
**What goes wrong:** Inserting the countdown element as a sibling of `#piece-bank` inside `.game-area` (flex container) shifts the layout, pushing the bank down or right.
**Why it happens:** Inserting into `.game-area` flex row adds a new flex item.
**How to avoid:** Position the countdown element absolutely relative to `#piece-bank` (add `position: relative` to `.piece-bank` if not already present) or inject it inside the bank container rather than as a sibling in the flex row.
**Warning signs:** Layout shifts when blind_bank fires.

---

## Code Examples

All examples verified against actual source files.

### Existing randomMode:event handler (client/main.js:939)
```javascript
// Source: client/main.js line 939 (verified)
socket.on('randomMode:event', ({ type, description } = {}) => {
  showGameNotification(description);

  if (type === 'rotate_piece') {
    setTimeout(() => {
      if (selectedShapeId !== null) {
        selectedRotation = (selectedRotation + 90) % 360;
        updateBankSelection();
        updateRotationButtons();
        if (lastHoveredRow !== null && lastHoveredCol !== null) {
          updateGhostPreview(lastHoveredRow, lastHoveredCol);
        }
      }
    }, 1200);
  }
});
```
Phase 14 replaces this handler body with the new delayed-trap pattern and adds branches for `blind_bank`.

### Existing triggerRandomEvent structure (server/src/game.js:396)
```javascript
// Source: server/src/game.js line 396 (verified)
function triggerRandomEvent(lobby, _forceEventType) {
  const eventType = _forceEventType ?? pickRandomEvent();
  const activePlayerName = lobby.players[lobby.activeTurnIndex]?.name ?? 'Unbekannt';

  if (eventType === 'shuffle_order') {
    shuffleArray(lobby.players);
    lobby.activeTurnIndex = 0;
    return { type: 'shuffle_order', description: '...' };
  }
  // ... other events ...
  return null;
}
```
New events (`double_turn`, `reverse_order`, `blind_bank`) follow this exact guard + return pattern.

### Test helper pattern (server/src/game.test.js)
```javascript
// Source: server/src/game.test.js (verified)
describe('triggerRandomEvent - double_turn', () => {
  it('sets extraTurns to 1 and returns event object', () => {
    const lobby = makeLobbyV11('TRE-DT01');
    lobby.extraTurns = 0;
    const result = triggerRandomEvent(lobby, 'double_turn');
    assert.ok(result !== null);
    assert.strictEqual(result.type, 'double_turn');
    assert.strictEqual(lobby.extraTurns, 1);
  });

  it('returns null when extraTurns is already > 0 (no stacking)', () => {
    const lobby = makeLobbyV11('TRE-DT02');
    lobby.extraTurns = 1;
    const result = triggerRandomEvent(lobby, 'double_turn');
    assert.strictEqual(result, null);
  });
});
```

### CSS blind effect (recommended)
```css
/* client/style.css */
/* Blind bank: dark overlay via pointer-events + visual obscuring */
.piece-bank.blind {
  position: relative;
}
.piece-bank.blind::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(20, 20, 20, 0.85);
  border-radius: var(--r-lg);
  z-index: 10;
  pointer-events: none;
}
```
This uses a CSS pseudo-element overlay so the bank's children remain in the DOM (no structural changes), and `pointer-events: none` means the hidden pieces are still click-through — they just can't be seen. An alternative is `filter: blur(8px)` on the `.piece-bank.blind` itself, which is more dramatic but preserves clickability (pieces can be selected by memory).

### CSS event banner (recommended)
```css
/* client/style.css */
.event-banner {
  position: absolute;
  top: -3rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(20, 20, 20, 0.88);
  color: #fff;
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 700;
  padding: 0.6rem 1.4rem;
  border-radius: var(--r-md);
  white-space: nowrap;
  z-index: 100;
  pointer-events: none;
  animation: bannerFadeIn 0.2s ease-out;
}
@keyframes bannerFadeIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
```
`#game-screen` already has `position: relative` (verified in `style.css`). The banner is positioned at `top: -3rem` relative to `#game-screen`, which places it above the grid header area.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 4 events (Phase 9 weights) | 7 events with new weights | Phase 14 | `pickRandomEvent()` fully replaced |
| rotate_piece fires immediately (broken timing) | Delayed trap on next piece selection | Phase 14 | Eliminates silent-fail bug |
| Small text notification banner | Prominent overlay banner above grid | Phase 14 | Hard to miss for all players |
| No extra-turn state | `lobby.extraTurns` counter | Phase 14 | Enables double_turn without turn order corruption |

**Deprecated/outdated after Phase 14:**
- Old `rotate_piece` client handler (immediate setTimeout with selectedShapeId guard): replaced by pendingRotate trap
- Old `pickRandomEvent()` 4-event weight table: fully replaced
- Old `showGameNotification()` text element approach: replaced by overlay banner

---

## Open Questions

1. **blind_bank + active player's own bank**
   - What we know: `.blind` is added to `#piece-bank` on ALL clients (including non-active players who can't place anyway)
   - What's unclear: The active player during blind_bank cannot see their own pieces — is this intentional? (Yes — per CONTEXT.md "Affects ALL players")
   - Recommendation: Implement as specified; if it feels too harsh in human verification, CSS can be tuned during 14-02.

2. **extraTurns reset in startGame()**
   - What we know: `createLobby()` initializes `extraTurns: 0`; `startGame()` currently does not reset it
   - What's unclear: Can a lobby be "restarted" without destroying and recreating it?
   - Recommendation: Add `lobby.extraTurns = 0;` inside `startGame()` as a safety measure. Low cost, prevents carry-over bug (Pitfall 3).

3. **rotate_piece pendingRotate and bank reconstruction**
   - What we know: `renderBank()` is called on every `game:stateUpdate`; it rebuilds the DOM entirely; piece click handlers are re-wired each time
   - What's unclear: If `pendingRotate = true` and a `game:stateUpdate` fires (from another player's move), does the new bank's click handlers correctly check `pendingRotate`?
   - Recommendation: `pendingRotate` is module-level, not per-DOM-element. The re-wired click handlers in `renderBank()` will read the current `pendingRotate` value at click time. This is safe — no special handling needed.

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (no version — built-in since Node 18) |
| Config file | None — tests run directly with `node --test` |
| Quick run command | `node --test server/src/game.test.js` |
| Full suite command | `node --test server/src/game.test.js server/src/socket.test.js` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RAND-01 | `double_turn` sets `extraTurns=1`, returns event object | unit | `node --test server/src/game.test.js` | ❌ Wave 0 |
| RAND-01 | `double_turn` returns null when `extraTurns > 0` (no stacking) | unit | `node --test server/src/game.test.js` | ❌ Wave 0 |
| RAND-01 | `socket.js` place-branch skips `advanceTurn` when `extraTurns > 0` | unit | `node --test server/src/socket.test.js` | ❌ Wave 0 |
| RAND-01 | `createLobby()` initializes `extraTurns: 0` | unit | `node --test server/src/game.test.js` | ❌ Wave 0 |
| RAND-01 | `getPublicState()` includes `extraTurns` field | unit | `node --test server/src/game.test.js` | ❌ Wave 0 |
| RAND-02 | `reverse_order` reverses `lobby.players` and resets `activeTurnIndex` to 0 | unit | `node --test server/src/game.test.js` | ❌ Wave 0 |
| RAND-03 | `blind_bank` returns `{ type: 'blind_bank', description: string }` | unit | `node --test server/src/game.test.js` | ❌ Wave 0 |
| RAND-03 | Client `.blind` class behavior | manual | Human verification (14-02) | N/A — client |
| ALL | Weight table totals 100% (10+15+20+15+15+15+10) | unit | `node --test server/src/game.test.js` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test server/src/game.test.js`
- **Per wave merge:** `node --test server/src/game.test.js server/src/socket.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] New `describe('triggerRandomEvent - double_turn', ...)` block in `server/src/game.test.js`
- [ ] New `describe('triggerRandomEvent - reverse_order', ...)` block in `server/src/game.test.js`
- [ ] New `describe('triggerRandomEvent - blind_bank', ...)` block in `server/src/game.test.js`
- [ ] New `describe('createLobby + extraTurns init', ...)` block in `server/src/game.test.js`
- [ ] New `describe('getPublicState includes extraTurns', ...)` block in `server/src/game.test.js`
- [ ] New `describe('game:move double_turn extra turn skips advanceTurn', ...)` block in `server/src/socket.test.js`
- [ ] Framework install: none needed — `node:test` is built-in

---

## Sources

### Primary (HIGH confidence)

- `server/src/game.js` — full source read; `pickRandomEvent()` line 378, `triggerRandomEvent()` line 396, `createLobby()` line 30, `getPublicState()` line 176, `advanceTurn()` line 168
- `server/src/socket.js` — full source read; `game:move` place-branch lines 189–215; `lobby:randomMode` handler line 130
- `client/main.js` — source read; `randomMode:event` handler line 939, `showGameNotification()` line 798, `renderTurnUI()` line 511, `renderBank()` line 361
- `client/style.css` — source read; `.piece-bank` line 497, `.player-badge` line 408, `.turn-banner` line 364, CSS tokens confirmed
- `client/index.html` — full source read; `#piece-bank` line 94, `#game-screen position: relative` confirmed
- `server/src/game.test.js` — full source read; existing test patterns for `triggerRandomEvent`, `makeLobbyV11`, `node:test` patterns
- `server/src/socket.test.js` — source read; `lobby:randomMode` tests, `game:move randomMode:event trigger` tests, `makeMocks`/`trigger` helper pattern
- `.planning/phases/14-random-mode-overhaul/14-CONTEXT.md` — all decisions locked/discretion items
- `.planning/phases/09-random-mode/09-CONTEXT.md` — Phase 9 baseline decisions (locked per CONTEXT.md)
- `server/package.json` — confirmed no new packages needed

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` §Phase 14 — success criteria, 2-plan split confirmed
- `.planning/STATE.md` — accumulated decisions table; Phase 9 patterns confirmed

### Tertiary (LOW confidence)

- None. All findings are from primary source code.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all code read directly; no new packages required
- Architecture patterns: HIGH — exact line numbers cited; patterns verified against source
- Pitfalls: HIGH — derived from direct code analysis; confirmed against existing test edge cases
- CSS recommendations: MEDIUM — Claude's discretion per CONTEXT.md; specific values are recommendations

**Research date:** 2026-04-07
**Valid until:** 2026-05-07 (stable codebase; no external dependencies changing)
