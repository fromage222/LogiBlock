---
phase: 8
slug: erstes-richtiges-level-bauen-design-und-implementierung-eines-finalen-puzzle-levels-als-echtes-spielerlebnis
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — project has no test runner |
| **Config file** | none |
| **Quick run command** | `node server/src/server.js` (check startup log) |
| **Full suite command** | Manual: start server, open browser, play through lobby |
| **Estimated runtime** | ~5 seconds (server startup smoke) |

---

## Sampling Rate

- **After every task commit:** Run `node server/src/server.js` and verify no `[PuzzleLoader] Skipping` errors
- **After every plan wave:** Full manual lobby walkthrough
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds (server startup log check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 1 | level_01.json created | smoke | `node server/src/server.js` | ❌ W0 | ⬜ pending |
| 8-01-02 | 01 | 1 | validatePuzzleSchema passes (43 cells) | automated (server) | `node server/src/server.js` | ✅ | ⬜ pending |
| 8-01-03 | 01 | 1 | getPuzzleListForClient() filters by difficulty | manual | n/a | ✅ | ⬜ pending |
| 8-01-04 | 01 | 1 | createLobby() defaults to level_01 | manual | n/a | ✅ | ⬜ pending |
| 8-01-05 | 01 | 1 | getPublicState() includes selectedPuzzleDifficulty | manual | n/a | ✅ | ⬜ pending |
| 8-01-06 | 01 | 1 | validatePuzzleSchema() accepts optional difficulty field | automated (server) | `node server/src/server.js` | ✅ | ⬜ pending |
| 8-02-01 | 02 | 2 | DIFFICULTY_LABELS constant added | manual | n/a | ✅ | ⬜ pending |
| 8-02-02 | 02 | 2 | puzzle:list dropdown shows "Name — Einfach" | manual | n/a | ✅ | ⬜ pending |
| 8-02-03 | 02 | 2 | Non-host sees difficulty in lobby | manual | n/a | ✅ | ⬜ pending |
| 8-02-04 | 02 | 2 | Anchor pieces pre-placed on game start | manual | n/a | ✅ | ⬜ pending |
| 8-02-05 | 02 | 2 | 7 movable pieces appear in bank | manual | n/a | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `puzzles/level_01.json` — create level file before any server code changes

*No test framework to install — validation is via server startup smoke test and manual lobby walkthrough.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dropdown shows only Level 1 (no test puzzles) | Locked decision — filter by difficulty | No test runner | Open lobby as host; verify dropdown shows "Level 1 — Einfach" only |
| createLobby() pre-selects Level 1 | Locked decision — default to first difficulty puzzle | No test runner | Create room; verify Level 1 is pre-selected in dropdown |
| Non-host sees "Level 1 — Einfach" in lobby | Locked decision — non-host display | No test runner | Join as second player; verify selected puzzle display text |
| Anchor pieces pre-placed, non-draggable | Core gameplay | No test runner | Start game; verify 3 anchors on grid and cannot be moved |
| 7 movable pieces in bank | Core gameplay | No test runner | Start game; count pieces in bank |
| Puzzle is solvable (valid solution exists) | Math constraint | Verified at design time | Manually verify solution matrix covers all 43 active cells |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
