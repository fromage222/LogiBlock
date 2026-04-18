---
status: awaiting_human_verify
trigger: "host-reload-ends-game"
created: 2026-04-17T00:00:00Z
updated: 2026-04-17T01:30:00Z
symptoms_prefilled: true
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: CONFIRMED AND FIXED (two bugs)
test: 36 socket tests pass (32 existing + 4 new regression tests)
expecting: Human to verify host can reload and continue playing
next_action: Human verification

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Game continues running after host reloads (host should reconnect seamlessly)
actual: After 2-5 seconds, game ends for ALL players and they are redirected to the start screen
errors: "Host left - lobby closed" (visible in browser console / UI)
reproduction: Host is in active game, host reloads browser tab, game ends for everyone after ~2-5s
started: Unknown - likely always been this way

## Eliminated
<!-- APPEND only - prevents re-investigating -->

- hypothesis: replacePlayerSocket fails to update hostId on reconnect
  evidence: replacePlayerSocket (game.js:382) explicitly updates lobby.hostId = newSocketId when player was host. Timer guard player.socketId !== oldSocketId would return early for successful reconnects.
  timestamp: 2026-04-17T00:01:00Z

- hypothesis: reconnectRoom is not emitted by client on reload
  evidence: client connect handler (main.js:1082) always emits reconnectRoom when localStorage has savedRoom+savedName. localStorage is preserved during playing phase (line 956 comment confirms).
  timestamp: 2026-04-17T00:01:00Z

- hypothesis: timer is not properly cancelled when reconnectRoom arrives before disconnecting
  evidence: If reconnect arrives before disconnecting fires, there is no timer to cancel. But when disconnecting then fires, the NEW timer has oldSocketId; the timer guard checks player.socketId !== oldSocketId which is TRUE (replacePlayerSocket already updated it), so it returns early safely.
  timestamp: 2026-04-17T00:01:00Z

- hypothesis: Phase guard fix resolves all host reconnect issues
  evidence: Human verification shows host still cannot play AND gets removed from lobby. Two new bugs found: (A) stale-socket disconnected flag is set after reconnect, (B) player removed from lobby after timer expiry prevents reconnectRoom from working.
  timestamp: 2026-04-17T01:00:00Z

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-04-17T00:01:00Z
  checked: socket.js lines 381-422 (timer callback)
  found: isNowHost branch at line 414 fires lobby:hostLeft regardless of currentLobby.phase
  implication: When host's reconnect takes >5s (slow reload, slow network), timer fires, and isNowHost=true path emits lobby:hostLeft even during playing phase, destroying the game for all players

- timestamp: 2026-04-17T00:01:00Z
  checked: client/main.js lines 943-952 (lobby:hostLeft handler)
  found: lobby:hostLeft handler unconditionally calls showScreen('start-screen') and clears localStorage regardless of which screen is currently active
  implication: If lobby:hostLeft fires during game, ALL clients including reconnected host are sent to start screen with "Host left - lobby closed"

- timestamp: 2026-04-17T00:01:00Z
  checked: server/src/socket.js DISCONNECT_GRACE_MS = 5000
  found: Grace period is exactly 5000ms. Report says "2-5 seconds". These match, confirming the timer IS the trigger.
  implication: On a slow network or slow browser, the reconnect simply doesn't complete within the 5s window, causing the timer to fire and destroy the game.

- timestamp: 2026-04-17T00:01:00Z
  checked: host-specific checks in game:move handler and playing-phase logic
  found: No host-specific checks in playing phase. hostId is only checked in lobby:selectPuzzle, lobby:randomMode, startGame (all lobby-phase).
  implication: The host has no special role during playing phase; removing them and continuing the game is safe.

- timestamp: 2026-04-17T00:01:00Z
  checked: socket.js lines 414-418 vs lobby phase behavior
  found: Original isNowHost branch was designed for lobby phase (destroying room before game starts). When Phase 15 added game-phase reconnect support, the phase guard was NOT added to this branch.
  implication: The bug exists because lobby:hostLeft was designed for lobby-phase but is incorrectly emitted in playing-phase too.

- timestamp: 2026-04-17T00:02:00Z
  checked: Fix applied and 32 tests run (29 existing + 3 new)
  found: All 32 tests pass. New tests verify: no lobby:hostLeft in playing phase, game:stateUpdate emitted instead, lobby:hostLeft still works in lobby phase.
  implication: Phase guard fix resolved the "all players sent to start screen" symptom. But two deeper bugs remain.

- timestamp: 2026-04-17T01:00:00Z
  checked: socket.js lines 359-374 (disconnecting handler playing-phase block) vs reconnectRoom handler timing
  found: BUG A — When reconnect-before-disconnect ordering occurs (new socket connects + emits reconnectRoom BEFORE old socket fires 'disconnecting'), the disconnecting handler at line 363-373 unconditionally sets pendingPlayer.disconnected=true and calls advanceTurn. The check is `if (pendingPlayer)` — it does NOT verify that pendingPlayer.socketId === socket.id (oldSocketId). After replacePlayerSocket, pendingPlayer.socketId is already the NEW socket id. So the handler finds the player by name and marks them disconnected even though they already reconnected. This sets disconnected=true on a live player, causing advanceTurn to skip them permanently.
  implication: Host reconnects, sees game screen, but can never take a turn because advanceTurn always skips them (disconnected=true). Explains "host cannot play".

- timestamp: 2026-04-17T01:00:00Z
  checked: socket.js lines 381-392 (timer callback guard and removePlayer) — case where disconnect fires before reconnect
  found: BUG B — When disconnect-before-reconnect ordering occurs AND reconnect arrives after the 5s timer fires, the timer guard at line 389 `player.socketId !== oldSocketId` is FALSE (socketId hasn't changed yet when timer fires). So removePlayer(oldSocketId) executes at line 392 and removes the host from lobby.players. Then when reconnectRoom arrives for the new socket, `lobby.players.find(p => p.name === name)` returns undefined and the server responds with "You are not part of this room". Host is stuck on start screen.
  implication: Host page load takes >5s (slow browser/network) → host removed from lobby → reconnect fails. Explains "host gets removed from lobby entirely".

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: Two bugs in server/src/socket.js disconnecting/reconnect flow for playing phase:
  BUG A (reconnect-before-disconnect ordering): The disconnecting handler's playing-phase block (lines 362-373) marks pendingPlayer.disconnected=true without checking whether pendingPlayer.socketId === socket.id (oldSocketId). When reconnect has already happened, pendingPlayer.socketId is the NEW socket id. The handler still finds the player by name and marks them disconnected, permanently skipping them from turns.
  BUG B (disconnect-before-reconnect, slow reload): When the 5s grace timer fires before reconnectRoom arrives, the timer removes the player from lobby.players via removePlayer(oldSocketId). Subsequent reconnectRoom can't find the player and fails with "You are not part of this room". The host can never rejoin.

fix:
  FIX A: In the disconnecting handler's playing-phase block, add guard: only mark disconnected if pendingPlayer.socketId === socket.id (the OLD socket). If the player has already reconnected their socketId changed, so this block is skipped entirely.
  FIX B: In the timer callback, when currentLobby.phase === 'playing', skip the removePlayer call. The player should remain in lobby.players as a disconnected slot so reconnectRoom can still find and reactivate them. Use the existing guard (player.socketId !== oldSocketId) to skip the removal if they reconnected. If they truly never reconnect, they stay as a permanent disconnected slot — advanceTurn already skips them, and allDisconnected cleanup handles the case where everyone is gone.

verification: 36 socket tests pass (32 existing + 4 new). New tests cover: (1) old socket disconnecting does not mark player disconnected when socketId already changed, (2) old socket disconnecting does not advance turn when player already reconnected, (3) host stays in lobby.players after timer fires in playing phase, (4) reconnectRoom succeeds even after grace timer has fired.
files_changed: [server/src/socket.js, server/src/socket.test.js]
