---
phase: 9
slug: random-mode
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` |
| **Config file** | none — run with `node --test` |
| **Quick run command** | `cd server && node --test src/game.test.js` |
| **Full suite command** | `cd server && node --test src/game.test.js src/socket.test.js` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd server && node --test src/game.test.js`
- **After every plan wave:** Run `cd server && node --test src/game.test.js src/socket.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 0 | game.js stubs | unit | `cd server && node --test src/game.test.js` | ❌ W0 | ⬜ pending |
| 9-01-02 | 01 | 0 | socket.test stubs | integration | `cd server && node --test src/socket.test.js` | ❌ W0 | ⬜ pending |
| 9-02-01 | 02 | 1 | setRandomMode + randomModeEnabled | unit | `cd server && node --test src/game.test.js` | ❌ W0 | ⬜ pending |
| 9-02-02 | 02 | 1 | triggerRandomEvent — 4 event types | unit | `cd server && node --test src/game.test.js` | ❌ W0 | ⬜ pending |
| 9-02-03 | 02 | 1 | triggerRandomEvent — edge-case skips (3) | unit | `cd server && node --test src/game.test.js` | ❌ W0 | ⬜ pending |
| 9-02-04 | 02 | 1 | getPublicState includes randomMode field | unit | `cd server && node --test src/game.test.js` | ❌ W0 | ⬜ pending |
| 9-03-01 | 03 | 1 | lobby:randomMode host guard | integration | `cd server && node --test src/socket.test.js` | ❌ W0 | ⬜ pending |
| 9-03-02 | 03 | 1 | lobby:randomMode broadcasts lobby:update | integration | `cd server && node --test src/socket.test.js` | ❌ W0 | ⬜ pending |
| 9-03-03 | 03 | 1 | game:move place triggers randomMode:event | integration | `cd server && node --test src/socket.test.js` | ❌ W0 | ⬜ pending |
| 9-03-04 | 03 | 1 | game:move place does NOT trigger on win | integration | `cd server && node --test src/socket.test.js` | ❌ W0 | ⬜ pending |
| 9-03-05 | 03 | 1 | game:move return does NOT trigger event | integration | `cd server && node --test src/socket.test.js` | ❌ W0 | ⬜ pending |
| 9-04-01 | 04 | 2 | Lobby toggle + client handler | manual | See manual verification table | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/game.test.js` — add `describe('triggerRandomEvent', ...)` block with stubs for all 4 event types, 3 edge-case skips, and `getPublicState.randomMode` field
- [ ] `server/src/socket.test.js` — add `describe('lobby:randomMode handler', ...)` stub and extend `game:move handler` describe with `randomMode:event` broadcast assertion stubs

*(Existing `before(() => loadPuzzles())`, `makeMocks()`, and `makePlayingLobby()` infrastructure reused — no new test files or fixtures needed)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Host slider toggles Chaos-Modus on/off; non-host sees read-only display update | Lobby toggle (locked) | DOM interaction + visual state | Open lobby, host slides toggle to 1; confirm non-host display shows "Chaos-Modus: Aktiv" |
| Random event banner appears in-game with German description | Event feedback (locked) | Visual notification timing | Play with Random Mode on; complete a turn; confirm banner appears then clears after ~3s |
| `rotate_piece` event: active player's ghost preview updates if piece selected | rotate_piece (locked) | Client-side selectedRotation state | Have piece selected; trigger rotate_piece event; confirm ghost preview shows new rotation |
| `rotate_piece` event with no piece selected: no ghost update, banner still shows | Edge case (locked) | Client-side selectedRotation state | Deselect piece; trigger rotate_piece event; confirm no visual change except banner |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
