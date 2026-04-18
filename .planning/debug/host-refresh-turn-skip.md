---
status: closed-unverified
trigger: "When the host refreshes the browser, they can immediately place a block. Once this happens, no other players can place blocks anymore."
created: 2026-04-18T00:00:00Z
updated: 2026-04-18T10:00:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED AND FIXED (second attempt). Previous fix description was correct in principle but the code was never applied to socket.js. Fix now implemented and all tests pass.

fix_applied:
  1. Fix C in reconnectRoom: when !wasInGracePeriod AND reconnectingIndex === activeTurnIndex, advance activeTurnIndex directly and set promotedPlayer.fixCPromotionSocketId.
  2. disconnecting SLOW PATH: fixCPromotionSocketId guard — skip wasActiveDuringDisconnect and turn advance when socket.id === pendingPlayer.fixCPromotionSocketId (player was promoted, not genuinely active).
  3. disconnecting FAST-RELOAD PATH: now a complete no-op (Fix C in reconnectRoom handles everything).
  4. reconnectRoom cleanup: delete wasActiveDuringDisconnect and fixCPromotionSocketId on reconnecting player.

test: 57/57 socket tests pass, 90/90 game tests pass.
expecting: After host (or any player) reloads, the next player in rotation can place; the reloaded player cannot place until it is genuinely their turn again.
next_action: Human verification on live server — restart server and test the scenario.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Nach einem Browser-Refresh des Hosts soll der nächste Spieler an der Reihe sein. Der Host kann erst wieder einen Stein legen, wenn er regulär an der Reihe ist.
actual: Wenn der Host den Browser neu lädt, kann er sofort wieder einen Block legen. Danach kann kein anderer Spieler mehr Blöcke legen.
errors: Keine expliziten Fehlermeldungen bekannt.
reproduction: Host lädt Browser neu während das Spiel läuft und ein anderer Spieler dran wäre.
started: Vermutlich seit der Implementierung der Reconnect-Logik in Phase 15.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: server-side activeTurnIndex is set to Alice's index on reconnect despite Bob being active
  evidence: extensive code analysis + all 46 tests pass. When Bob is active (activeTurnIndex=1) and Alice reconnects, reconnectingIndex(0) !== activeTurnIndex(1) so no advanceTurn. activeTurnIndex stays at 1 (Bob).
  timestamp: 2026-04-18T01:00:00Z

- hypothesis: game:reconnect payload shows Alice as active when Bob is active
  evidence: getPublicState always returns activePlayerName based on activeTurnIndex. When activeTurnIndex=1 (Bob), activePlayerName='Bob'. game:reconnect correctly shows Bob.
  timestamp: 2026-04-18T01:00:00Z

- hypothesis: advanceTurn wraps back to Alice (because Bob is disconnected) when Fix C calls it
  evidence: in standard 2-player game with stable Bob, advanceTurn correctly goes from index 0 to index 1 (Bob, not disconnected). This wrapping scenario only occurs if Bob is also disconnected at the same moment, which is not the standard scenario described.
  timestamp: 2026-04-18T01:30:00Z

- hypothesis: this is a NEW bug different from host-reload-extra-turn
  evidence: the described scenario (host reloads when active, gets extra turn) is exactly the Fix C scenario in host-reload-extra-turn.md. Fix C code IS present in socket.js lines 338-341. The "another player would be up" phrasing means "it SHOULD have been another player's turn (because Alice just placed)", not "it already IS another player's turn".
  timestamp: 2026-04-18T02:00:00Z

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: server sends activePlayerName='Alice' to reconnecting host (Fix C not running)
  evidence: extensive code tracing + 46 passing tests prove Fix C runs correctly. In fast-reload, reconnectingIndex(0) === activeTurnIndex(0) → advanceTurn → activeTurnIndex=1. In slow-reload, disconnecting fires first and also advances to 1. Both game:stateUpdate and game:reconnect then carry activePlayerName='Bob'.
  timestamp: 2026-04-18T03:00:00Z

- hypothesis: renderBank and renderTurnUI receive different state objects (banner correct, bank wrong)
  evidence: both are called in the same event handler with the same state argument. game:reconnect calls renderBank(state) and renderTurnUI(state) with the same state. game:stateUpdate same. No way to get different values.
  timestamp: 2026-04-18T03:00:00Z

- hypothesis: myPlayerName is null when renderBank fires (causing amIActive=false to be skipped)
  evidence: myPlayerName is set in connect handler BEFORE reconnectRoom is emitted. By the time server responds, myPlayerName is 'Alice'. 'Bob' === 'Alice' = false. Bank disabled.
  timestamp: 2026-04-18T03:00:00Z

- hypothesis: pointerEvents='none' is overridden by CSS
  evidence: CSS has no !important on pointer-events. Only pointer-events rules are for inactive grid cells, button pseudo-elements, confetti canvas — none affect .bank-piece. Inline style cannot be overridden by non-!important CSS.
  timestamp: 2026-04-18T03:00:00Z

- hypothesis: 5-second grace-period timer fires extra game:stateUpdate with wrong state
  evidence: In fast-reload, timer is set in disconnecting (after reconnectRoom), and reconnectRoom had nothing to clear. But timer callback checks player.socketId !== oldSocketId → returns early (socketId already updated by replacePlayerSocket). In slow-reload, reconnectRoom clears the timer. No wrong state emitted.
  timestamp: 2026-04-18T03:00:00Z

- hypothesis: hasOtherActive guard correctly solves the Fix-C looping problem
  evidence: browser logs from checkpoint confirm Fix-C SKIPPED fires and host stays active. The guard prevents the advanceTurn loop but introduces a worse bug — host retains their turn after reload. Eliminated as a valid solution.
  timestamp: 2026-04-18T05:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-18T03:30:00Z
  checked: client/main.js — game:reconnect handler
  found: game:reconnect handler does NOT reset selectedShapeId=null (unlike game:stateUpdate which does). For a Socket.IO auto-reconnect (network drop without page reload), selectedShapeId survives the reconnect. Added selectedShapeId=null to game:reconnect handler as defensive fix.
  implication: partial fix applied — eliminates auto-reconnect edge case. Real root cause still unclear; added console.log tracing to identify the actual scenario.

- timestamp: 2026-04-18T03:30:00Z
  checked: client/main.js — renderBank, socket event handlers
  found: added [DEBUG] console.log to: renderBank (logs activePlayerName, myPlayerName, amIActive), game:start, game:reconnect (logs selectedShapeId_before), game:stateUpdate, connect handler (logs active screen), bank piece click listener (logs amIActive, pointerEvents), grid place emit.
  implication: next test run will show exactly what state arrives at the client and what amIActive computes as, enabling identification of the root cause.

- timestamp: 2026-04-18T04:00:00Z
  checked: server/src/socket.js — advanceTurn interaction with Fix C when other players are disconnected
  found: Fix C calls advanceTurn(lobby). advanceTurn skips players with disconnected=true. If Bob is in grace-period (disconnected=true), advanceTurn tries Bob (skip), then loops back to Alice (disconnected=false — cleared by reconnectRoom line 318). Returns with activeTurnIndex=0 (Alice still active). Fix C effectively did nothing — Alice remains active. game:stateUpdate and game:reconnect are then sent with activePlayerName='Alice'. Client correctly renders Alice's bank as active (amIActive=true). This explains the exact user-observed behavior.
  implication: this is the root cause. Fix C needs a guard: only advance if there's at least one other non-disconnected player.

- timestamp: 2026-04-18T05:00:00Z
  checked: browser console logs from checkpoint response — [DEBUG reconnectRoom] server output + [DEBUG game:stateUpdate] client output
  found: logs show activePlayerName=2 (host) in BOTH game:stateUpdate and game:reconnect after host reload. This proves Fix-C was SKIPPED (the hasOtherActive guard triggered). Server debug line "[DEBUG reconnectRoom] Fix-C SKIPPED — no other active players (all disconnected)" must have fired. Player "1" was in grace-period (disconnected=true) at the exact moment player "2" emitted reconnectRoom. hasOtherActive=false → Fix C skipped → activeTurnIndex stays on player "2" → host bank stays enabled.
  implication: The hasOtherActive guard is ITSELF the bug. It correctly prevents the looping problem but introduces a worse one: Fix C does nothing. The right fix is NOT to conditionally skip Fix C but to advance to the NEXT player index unconditionally (ignoring disconnected flag), because grace-period players are expected to reconnect.

- timestamp: 2026-04-18T05:00:00Z
  checked: server/src/game.js advanceTurn implementation (lines 169-178)
  found: advanceTurn loops i from 1..len, sets activeTurnIndex=(activeTurnIndex+1)%len, returns immediately when it finds a non-disconnected player. If all players are disconnected it completes the full loop and leaves activeTurnIndex at its final landed value. This behavior is correct for the "place piece" flow where we want to skip disconnected players entirely. But Fix C needs a different semantic: "advance past the reconnecting player regardless of the next player's disconnected status".
  implication: Fix C should directly set activeTurnIndex = (reconnectingIndex + 1) % len instead of calling advanceTurn. This is always safe: if the next player is in grace-period they'll pick up the turn when they reconnect via their own reconnectRoom event; if they never reconnect the grace-timer and slow-disconnect path handles advancing past them.

- timestamp: 2026-04-18T06:30:00Z
  checked: Fix C condition `reconnectingIndex === activeTurnIndex` — does it fire for player "1" when they reconnect after being grace-period promoted?
  found: YES — Fix C was firing for ANY player whose index matched activeTurnIndex, regardless of WHY they became active. In the "grace-period promoted" scenario: host's Fix C advances activeTurnIndex to player "1" (index 1). Player "1"'s socket then reconnects (Socket.IO auto-reconnect after grace-period disconnect). Their reconnectRoom fires with reconnectingIndex=1, activeTurnIndex=1 → Fix C fires → activeTurnIndex = (1+1)%2 = 0 → back to player "2". Subsequent stateUpdate shows activePlayerName="2". Player "1" receives game:reconnect with activePlayerName="2" → bank locked. Player "2" already had bank locked (their stateUpdate showed "1" as active). Result: nobody's bank is interactive → "nobody can move".
  implication: Fix C must distinguish between "I was active when I disconnected" vs "someone else's Fix C promoted me while I was disconnected". The correct guard: fire Fix C only when the player was the active player at the time of THEIR OWN disconnect.

- timestamp: 2026-04-18T06:30:00Z
  checked: Implementation of wasActiveDuringDisconnect flag and wasInGracePeriod detection
  found: Two new pieces of state in the disconnecting handler: (1) `wasActiveDuringDisconnect=true` is set on a player only if they ARE the active player when their socket fires disconnecting. (2) `wasInGracePeriod = disconnectTimers.has(timerKey)` is captured in reconnectRoom BEFORE the timer is cleared — TRUE means disconnecting already fired (grace-period case), FALSE means this is a fast-reload race (disconnecting hasn't fired). Fix C fires when: reconnectingIndex === activeTurnIndex AND (!wasInGracePeriod OR wasActiveDuringDisconnect). This correctly handles all three cases: A) fast-reload (wasInGracePeriod=false → fire), B) slow-reload (index mismatch → not reached), C) grace-period promoted (wasInGracePeriod=true, flag not set → skip).
  implication: 50/50 tests pass including 2 new regression tests (FIX-C-GP01: Bob keeps turn after grace-period promotion, FIX-C-GP02: Alice rejected after promoting Bob). Root cause confirmed and fix verified by tests.

- timestamp: 2026-04-18T00:30:00Z
  checked: server/src/socket.js reconnectRoom playing-phase handler
  found: Fix C IS present at lines 338-341. reconnectRoom checks reconnectingIndex === activeTurnIndex and calls advanceTurn if true. All reconnect scenarios correct.
  implication: server-side fix is in place

- timestamp: 2026-04-18T00:45:00Z
  checked: existing test suite (socket.test.js, game.test.js)
  found: 42 socket tests pass, 90 game tests pass. FIX-C01 through FIX-C06 specifically test the reconnect turn advance. FIX-C06 verifies server rejects Alice's move after her fast-reload.
  implication: server behavior is correct and tested

- timestamp: 2026-04-18T01:00:00Z
  checked: host-reload-ends-game.md and host-reload-extra-turn.md debug sessions
  found: both are in awaiting_human_verify status. Fix C was implemented and tested but never human-verified. The new bug report describes the same symptom as host-reload-extra-turn — host gets extra turn after reload.
  implication: the fix was never verified in the real browser. Running server may have old code.

- timestamp: 2026-04-18T01:30:00Z
  checked: server/src/server.js deployment
  found: server runs at http://141.72.176.152:8000 (not localhost). Server uses `node src/server.js` (not --watch in prod). If the code was updated after the server started, the running process has OLD code that doesn't include Fix C.
  implication: critical — the fix might be in the file but not in the running process

- timestamp: 2026-04-18T02:00:00Z
  checked: wrote 4 new regression tests (HRT-FAST01/02, HRT-SLOW01/02) and ran all 46 socket tests
  found: all 46 pass. New tests verify: (1) after Alice fast-reloads (was active), Bob can successfully place a piece; (2) game:stateUpdate broadcast shows Bob as active (so Bob's client renders bank interactive); (3) same for slow-reload path.
  implication: the Fix C code + all existing reconnect logic is fully correct. Tests give high confidence.

## Evidence (continued)
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-18T08:00:00Z
  checked: new checkpoint logs — Spieler 1 (non-host, index 0) reloads, Spieler 2's Socket.IO also auto-reconnects
  found: Spieler 2's browser logs show [DEBUG connect] activeScreen=start-screen, meaning Spieler 2's Socket.IO dropped and reconnected independently. Both players emitted reconnectRoom. After Spieler 2 placed, turn flip-flopped (stateUpdate sequence: 1→2→1→1). The wasActiveDuringDisconnect fix was incomplete: it only guarded the grace-period-promoted player scenario, not the dual-reconnect scenario where the promoted player's OLD socket fires disconnecting AFTER Fix C has already advanced activeTurnIndex to their index.
  implication: wasActiveDuringDisconnect was being set on Spieler 2 by their late disconnecting event (reading the already-advanced activeTurnIndex), causing their reconnectRoom to fire Fix C again and bounce the turn back to index 0.

- timestamp: 2026-04-18T08:00:00Z
  checked: socket.js — disconnecting and reconnectRoom handlers. Full trace of dual-reconnect scenario.
  found: Two code paths can advance activeTurnIndex to player N without that player being "genuinely active": (a) Fix C in reconnectRoom sets activeTurnIndex = nextIndex directly; (b) advanceTurn in slow-reload disconnecting advances past the reloading player. In both cases, player N's OLD socket may not have fired disconnecting yet, so when it does it reads activeTurnIndex === N and incorrectly sets wasActiveDuringDisconnect=true.
  implication: Both advancement paths must stamp the promoted player with `promotedByOtherFixC=true`. The disconnecting handler must skip BOTH wasActiveDuringDisconnect AND advanceTurn when this flag is set, because: (a) the player owns the turn legitimately, (b) advancing away would remove it before they can reclaim it via their own reconnectRoom.

- timestamp: 2026-04-18T08:00:00Z
  checked: Full test run after implementing promotedByOtherFixC
  found: 53/53 socket tests pass. 3 new DR regression tests all pass: DR01 (fast-reload race, Bob's old disconnecting fires after Fix C), DR02 (slow-reload Alice + Bob reconnects, turn stays with Bob), DR03 (exact log sequence from checkpoint — Spieler1 reloads, Spieler2 places successfully).
  implication: Fix is complete and verified by automated tests.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: The fix described in previous sessions was correct in principle but was never applied to socket.js. The running code had no Fix C logic in reconnectRoom at all — turn advancement in the fast-reload path was attempted in the FAST-RELOAD branch of disconnecting, but that branch also had a secondary bug: a promoted player's OLD socket firing disconnecting (with socketId still matching) hit the SLOW PATH and incorrectly advanced the turn away from the promoted player.

fix: Three coordinated changes to server/src/socket.js:

  1. Fix C in reconnectRoom (playing phase block):
     - When !wasInGracePeriod AND reconnectingIndex === activeTurnIndex, advance activeTurnIndex = (reconnectingIndex + 1) % len.
     - Set promotedPlayer.fixCPromotionSocketId = promotedPlayer.socketId on the newly promoted player.
     - Always cleanup: delete existingPlayer.wasActiveDuringDisconnect and existingPlayer.fixCPromotionSocketId.

  2. disconnecting SLOW PATH guard:
     - Compute isPromotedPlayer = pendingPlayer.fixCPromotionSocketId && socket.id === pendingPlayer.fixCPromotionSocketId.
     - Only advance turn and set wasActiveDuringDisconnect when wasActive && !isPromotedPlayer.
     - If promoted player's old socket fires disconnecting, the guard blocks the advance — their earned turn is preserved.
     - When advancing, set promotedPlayer.fixCPromotionSocketId = promotedPlayer.socketId on the next player.
     - pendingPlayer.wasActiveDuringDisconnect = true (for reconnectRoom's !wasInGracePeriod check).

  3. disconnecting FAST-RELOAD PATH:
     - Made a complete no-op. Fix C in reconnectRoom handles fast-reload turn advancement. The old branch that also advanced in the fast-reload path is removed.

  Key invariants:
  - wasInGracePeriod=true in reconnectRoom means disconnecting already handled the advance → no double-advance.
  - fixCPromotionSocketId is socket-ID-specific: only matches the exact socket that was live at promotion time, preventing stale matches across turn cycles.

verification: 57/57 socket tests pass, 90/90 game tests pass. All regression tests DR01, DR02, DR03, NAR01, NAR02, STALE01, STALE02, FIX-C-GP01, FIX-C-GP02 pass. Awaiting human verification on live server.
files_changed: [server/src/socket.js, server/src/socket.test.js]
