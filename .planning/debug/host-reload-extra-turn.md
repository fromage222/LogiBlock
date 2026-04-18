---
status: awaiting_human_verify
trigger: "After host refreshes the browser during an active game, the host is able to make an additional turn even though it was already their turn before the reload. If the host takes this extra turn, the other player becomes permanently unable to make any moves."
created: 2026-04-17T00:00:00Z
updated: 2026-04-17T02:30:00Z
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED — comprehensive fix implemented and all tests pass (42 socket + 90 game).

Root cause (two-part):
(1) Fast-reload (reconnectRoom fires before disconnecting): BUG A socketId guard correctly skips disconnecting's game-phase block, but this also skips advanceTurn AND the game:stateUpdate broadcast. activeTurnIndex stays on Alice. No client is told the turn changed.
(2) Slow-reload (disconnecting fires before reconnectRoom): disconnecting correctly advances the turn and broadcasts stateUpdate. But reconnectRoom clears Alice.disconnected=false without re-broadcasting — leaving all clients showing Alice as still disconnected.

Fix: in reconnectRoom's playing-phase path — (a) advance turn if reconnecting player IS the active player, then (b) ALWAYS broadcast game:stateUpdate to the room, then (c) send game:reconnect to the reconnecting socket only.

test: node --test server/src/socket.test.js → 42/42; node --test server/src/game.test.js → 90/90
expecting: human verification that Alice cannot make an extra move after reloading, Bob is unblocked
next_action: await human verification in real browser

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: After host reloads browser during their turn, the game continues with the next player's turn (the host should not be able to move again — the turn should have advanced or stayed consistent)
actual: Host reconnects after reload and can execute a move even though it was already their turn. After they do so, the other player cannot make any moves at all.
errors: No visible errors reported — the game silently breaks
reproduction: 1. Start a 2-player game. 2. Wait until it is the host's turn. 3. Host refreshes the browser tab. 4. Host reconnects and the game screen shows. 5. Host can now make a move (double-turn). 6. After host makes the extra move, the other player is stuck and cannot move.
started: Discovered after fixing a prior bug (host reload causing game to end for all players). The prior fix is already in place. This is a newly discovered regression or related bug in the reconnect/turn-state logic.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: Bob.disconnected=true causing advanceTurn to always cycle back to Alice
  evidence: Bob never disconnects in the scenario; addPlayer sets disconnected=false; nothing sets it true for Bob
  timestamp: 2026-04-17T00:09:00Z

- hypothesis: First fix (advanceTurn only, no stateUpdate) was complete
  evidence: Human verified it did not change behavior; bugtest_comprehensive.js confirmed Bob never receives game:stateUpdate in fast-reload path; Alice's bank correctly goes non-interactive but Bob's stays stuck (no stateUpdate reaches Bob)
  timestamp: 2026-04-17T02:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-17T00:05:00Z
  checked: socket.js reconnectRoom handler and disconnecting handler
  found: reconnectRoom does NOT check whether it is the reconnecting player's turn before clearing disconnected=false
  implication: In fast-reload, no guard prevented Alice from retaining her turn

- timestamp: 2026-04-17T00:08:00Z
  checked: fast-reload scenario — reconnectRoom fires BEFORE disconnecting
  found: BUG A guard in disconnecting skips game-phase block entirely (socketId changed). advanceTurn NOT called. activeTurnIndex stays 0 (Alice). No game:stateUpdate broadcast. Alice appears active to server AND Bob's client.
  implication: Alice can place a piece (server allows, socketId matches active player). Bob's bank stays pointerEvents=none (never told turn changed).

- timestamp: 2026-04-17T00:20:00Z
  checked: all 36 existing tests
  found: all pass
  implication: fast-reload scenario not covered by tests

- timestamp: 2026-04-17T01:00:00Z
  checked: first fix — advanceTurn in reconnectRoom when reconnectingIndex === activeTurnIndex
  found: 39/39 tests pass; fast-reload activeTurnIndex correctly advances to Bob; game:reconnect shows Bob as active
  implication: Fix is correct for fast-reload turn correction but INCOMPLETE: no game:stateUpdate broadcast means Bob's client is never updated

- timestamp: 2026-04-17T02:00:00Z
  checked: bugtest_comprehensive.js — traced both reload paths explicitly with server code
  found: Fast-reload: Bob gets NO game:stateUpdate at any point (disconnecting guard skips it, reconnectRoom only emits to Alice). Slow-reload: stateUpdate broadcast by disconnecting (shows Alice disconnected). reconnectRoom clears Alice.disconnected but no second stateUpdate sent. slow-reload Alice correctly blocked from moving (activeTurnIndex=1, "Not your turn"). Fast-reload with fix: Alice also correctly blocked (activeTurnIndex=1 after advanceTurn). But in BOTH paths, Bob needs a stateUpdate from reconnectRoom.
  implication: Missing io.to(roomCode).emit('game:stateUpdate') in reconnectRoom's playing-phase path

- timestamp: 2026-04-17T02:30:00Z
  checked: comprehensive fix — advanceTurn + io.to(roomCode).emit('game:stateUpdate') in reconnectRoom playing-phase; 3 new tests (FIX-C04, FIX-C05, FIX-C06)
  found: 42/42 socket tests pass, 90/90 game tests pass. Fast-reload: stateUpdate broadcast to room (Bob sees his turn). Slow-reload: stateUpdate broadcast to room (clients see Alice reconnected). Alice blocked from moving server-side. game:reconnect sent last (correct final render for Alice's client).
  implication: Fix is complete and verified

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Two-part root cause. (1) Fast-reload: the BUG A fix (socketId guard in disconnecting) correctly protects live player state, but its side effect is that no advanceTurn and no game:stateUpdate are ever broadcast when the active player reloads quickly. Alice retains her turn (activeTurnIndex=0), makes an "extra" move, and Bob's client is never updated to show his turn — Bob is stuck. (2) Slow-reload: disconnecting correctly advances turn and broadcasts stateUpdate, but reconnectRoom clears Alice.disconnected without re-broadcasting — clients continue showing Alice as disconnected.

fix: In reconnectRoom's playing-phase path: (a) if reconnecting player is the currently active player (reconnectingIndex === activeTurnIndex), call advanceTurn — handles fast-reload where disconnecting's advanceTurn was skipped; does not double-advance in slow-reload since activeTurnIndex already moved. Then (b) ALWAYS broadcast io.to(roomCode).emit('game:stateUpdate') — notifies ALL clients (Bob gets updated turn, all clients see Alice reconnected). Then (c) socket.emit('game:reconnect') — restores full game screen for the reconnecting player.

verification: 42/42 socket tests pass (including 6 Fix C regression tests), 90/90 game tests pass. Tests cover: activeTurnIndex advance in fast-reload, no double-advance in slow-reload, game:stateUpdate broadcast in both paths, Alice blocked from moving server-side after reconnect.

files_changed: [server/src/socket.js, server/src/socket.test.js]
