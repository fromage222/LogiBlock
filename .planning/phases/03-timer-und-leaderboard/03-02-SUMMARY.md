---
phase: 03-timer-und-leaderboard
plan: 02
subsystem: client
tags: [timer, leaderboard, win-card, vanilla-js, css]
dependency_graph:
  requires: [03-01]
  provides: [TIME-01, TIME-02, TIME-03, TIME-04]
  affects: [client/index.html, client/main.js, client/style.css]
tech_stack:
  added: []
  patterns: [setInterval live timer, innerHTML table render, socket.on leaderboard update]
key_files:
  created: []
  modified:
    - client/index.html
    - client/main.js
    - client/style.css
decisions:
  - "Play Again uses clearInterval + showScreen without emitting socket event — socket.data.roomCode overwritten on next create/join"
  - "Added .btn-primary CSS class since generic button selector covers behavior but class was referenced in win-card; Play Again button already uses both"
  - "renderLeaderboard placed before socket listener block for logical grouping near other render functions"
metrics:
  duration_min: 4
  completed_date: "2026-03-10"
  tasks_completed: 3
  files_modified: 3
---

# Phase 3 Plan 02: Client Timer, Win Card, and Leaderboard Summary

Client-side live timer with setInterval anchored to server startTime, restructured win card showing authoritative elapsedMs as 3.5rem hero text, Play Again navigation, and real-time session leaderboard on start screen.

## What Was Built

### DOM Additions (client/index.html)

- `#game-timer` (`<p class="game-timer">`) inserted between `#turn-banner` and `.game-area` in game screen — displays live MM:SS during play
- Win card restructured: `#win-message` replaced with `#win-time` (hero time display), `#win-players` (player names), `#play-again-btn` button
- `#leaderboard-section` with `#leaderboard-body` added below `.card` on start screen — renders rank/puzzle/time/players table

### New JS Functions (client/main.js)

| Function | Purpose |
|---|---|
| `formatTime(elapsedMs)` | Converts ms to MM:SS string |
| `updateTimerDisplay(elapsedMs)` | Updates `#game-timer` textContent |
| `startLiveTimer(startTime)` | Clears any existing interval, starts new 1s setInterval anchored to server startTime |
| `renderLeaderboard(entries)` | Renders leaderboard table rows from entries array; shows empty state if no entries |

### Modified JS Logic (client/main.js)

- `timerInterval` declared in global state block
- `renderWin(state)` rewritten: uses `#win-time` and `#win-players` (not `#win-message`); formats `state.elapsedMs` via `formatTime()`
- `game:start` handler: calls `startLiveTimer(state.startTime)` after `renderTurnUI`
- `game:win` handler: calls `clearInterval(timerInterval)` before `renderWin`
- `play-again-btn` click handler: clears interval, hides win overlay, calls `showScreen('start-screen')`, resets `myRoomCode` and `amIHost`
- `socket.on('leaderboard:update')` listener: calls `renderLeaderboard(entries)`

### New CSS Classes (client/style.css)

- `.game-timer`: center-aligned, 1.1rem, bold blue (#4a6cf7) timer
- `.win-time`: 3.5rem/700wt hero time display on win card
- `.win-players`: subdued player list display
- `.btn-primary`: explicit class matching generic button style (needed for win-card button)
- `.leaderboard-section`, `.leaderboard-table`, `.leaderboard-time`, `.leaderboard-empty`: full leaderboard table styling

## Commits

| Task | Commit | Description |
|---|---|---|
| 1 | 7fb5e49 | feat(03-02): update index.html — game-timer, restructured win card, leaderboard section |
| 2 | 48f314e | feat(03-02): update main.js — live timer, renderLeaderboard, updated renderWin, Play Again |
| 3 | 6f78f6e | feat(03-02): add Phase 3 CSS — game-timer, win-time hero, leaderboard table styles |

## Verification Results

- HTML: all 6 required IDs present (game-timer, win-time, win-players, play-again-btn, leaderboard-body, leaderboard-section)
- JS: all required patterns present; no `#win-message` references remain; no syntax errors (ReferenceError for `io` is expected browser-only behavior)
- CSS: all Phase 3 sections present (.game-timer, .win-time, .leaderboard-table, .leaderboard-empty)
- Server tests: 40/40 pass (no regressions)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added .btn-primary CSS class definition**
- **Found during:** Task 3
- **Issue:** Plan's win card HTML uses `class="btn-primary"` but no `.btn-primary` rule existed in style.css — the generic `button` selector covered behavior but `.win-card .btn-primary` rule would target nothing without the class definition
- **Fix:** Added `.btn-primary` as an explicit class in Phase 3 CSS section mirroring the generic `button` style; also added `.btn-primary:hover` variant
- **Files modified:** client/style.css
- **Commit:** 6f78f6e (included in Task 3 commit)

## Self-Check: PASSED

All 4 files exist. All 3 commits (7fb5e49, 48f314e, 6f78f6e) verified in git log. Server tests 40/40 pass.
