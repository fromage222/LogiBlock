---
phase: 14
slug: random-mode-overhaul
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-07
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in `node:test` (Node 20+ built-in) |
| **Config file** | None — tests run directly with `node --test` |
| **Quick run command** | `node --test server/src/game.test.js` |
| **Full suite command** | `node --test server/src/game.test.js server/src/socket.test.js` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test server/src/game.test.js`
- **After every plan wave:** Run `node --test server/src/game.test.js server/src/socket.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | RAND-01 | unit | `node --test server/src/game.test.js` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | RAND-01 | unit | `node --test server/src/game.test.js` | ❌ W0 | ⬜ pending |
| 14-01-03 | 01 | 1 | RAND-01 | unit | `node --test server/src/game.test.js` | ❌ W0 | ⬜ pending |
| 14-01-04 | 01 | 1 | RAND-01 | unit | `node --test server/src/game.test.js` | ❌ W0 | ⬜ pending |
| 14-01-05 | 01 | 1 | RAND-01 | unit | `node --test server/src/socket.test.js` | ❌ W0 | ⬜ pending |
| 14-01-06 | 01 | 1 | RAND-02 | unit | `node --test server/src/game.test.js` | ❌ W0 | ⬜ pending |
| 14-01-07 | 01 | 1 | RAND-03 | unit | `node --test server/src/game.test.js` | ❌ W0 | ⬜ pending |
| 14-01-08 | 01 | 1 | ALL | unit | `node --test server/src/game.test.js` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | RAND-03 | manual | Human verification — browser | N/A | ⬜ pending |
| 14-02-02 | 02 | 2 | RAND-01 | manual | Human verification — browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/game.test.js` — new `describe('triggerRandomEvent - double_turn', ...)` block with stacking prevention tests
- [ ] `server/src/game.test.js` — new `describe('triggerRandomEvent - reverse_order', ...)` block
- [ ] `server/src/game.test.js` — new `describe('triggerRandomEvent - blind_bank', ...)` block
- [ ] `server/src/game.test.js` — new `describe('createLobby extraTurns init', ...)` block verifying `extraTurns: 0`
- [ ] `server/src/game.test.js` — new `describe('getPublicState includes extraTurns', ...)` block
- [ ] `server/src/socket.test.js` — new `describe('game:move double_turn extra turn skips advanceTurn', ...)` block
- [ ] Framework install: none needed — `node:test` is built-in

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `.blind` CSS class hides `#piece-bank` for all players | RAND-03 | Client DOM/CSS behavior — no browser in test environment | Open game in 2+ browsers; trigger `blind_bank` via test override; verify bank is visually obscured for 5s with countdown, then reveals |
| `double_turn` ⚡ badge appears on active player's name badge | RAND-01 | Client DOM rendering — requires browser | Trigger `double_turn`; verify active player badge shows ⚡; verify it disappears after second placement |
| Notification banner displays prominently above grid | ALL | CSS visual position — requires browser | Trigger any event; verify banner appears above grid, is readable, auto-dismisses after 2–3s |
| `rotate_piece` delayed trap fires 2s after piece selection | ALL | Client timer behavior — requires browser | Trigger `rotate_piece`; select a piece; verify rotation fires after ~2s; verify it does NOT fire on deselect |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
