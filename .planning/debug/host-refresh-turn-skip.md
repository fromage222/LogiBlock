---
status: awaiting_human_verify
trigger: "When the host refreshes the browser, they can immediately place a block. Once this happens, no other players can place blocks anymore."
created: 2026-04-18T00:00:00Z
updated: 2026-04-18T05:10:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED AND FIXED. Root cause: the hasOtherActive guard in Fix C was itself the bug — it caused Fix C to skip entirely when the other player was in grace-period disconnect, leaving the reconnecting player (host) as the active player.

Fix applied: Replaced `hasOtherActive ? advanceTurn(lobby) : skip` with direct index assignment `lobby.activeTurnIndex = (reconnectingIndex + 1) % lobby.players.length`. This always advances past the reconnecting player regardless of the next player's disconnected status. A grace-period player will pick up the turn when they reconnect via their own reconnectRoom event.

test: 48/48 tests pass (including FIX-C-GUARD01 which now tests the new correct behavior)
expecting: host can no longer place immediately after reload; other player gets the turn
next_action: human verification on live server

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

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: The hasOtherActive guard added in the previous iteration was itself the bug. When the host (player "2") reloads the page faster than player "1"'s disconnect event propagates, player "1" is in grace-period (disconnected=true) at the moment reconnectRoom fires. The guard `hasOtherActive = lobby.players.some((p,i) => i !== reconnectingIndex && !p.disconnected)` returns false → Fix C is skipped entirely → activeTurnIndex stays on player "2" → server broadcasts activePlayerName="2" → host bank stays interactive and host can place a piece.

The underlying problem: advanceTurn() skips disconnected players, which would loop back to the reconnecting player when all others are in grace-period. The previous fix solved this by skipping Fix C — but that's wrong. The correct fix is to advance the turn unconditionally using direct index arithmetic, bypassing advanceTurn's skip-disconnected logic. A grace-period player will receive the turn when their own reconnectRoom fires.

fix: Replaced the `hasOtherActive` conditional block with a direct index assignment:
  `lobby.activeTurnIndex = (reconnectingIndex + 1) % lobby.players.length;`
This always advances past the reconnecting player. Grace-period players are expected to reconnect; permanently-gone players are handled by the grace-timer cleanup path.

Regression test FIX-C-GUARD01 updated to assert the new correct behavior (Alice's turn advances to Bob even when Bob is in grace-period).

verification: 48/48 server tests pass. Awaiting human verification on live server.
files_changed: [server/src/socket.js, server/src/socket.test.js]
