---
phase: 10
slug: steuerung-berarbeiten-und-tablet-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — project has no test framework (vanilla JS, no build tools) |
| **Config file** | none |
| **Quick run command** | Manual browser testing |
| **Full suite command** | Manual browser testing |
| **Estimated runtime** | ~5 minutes manual walkthrough |

---

## Sampling Rate

- **After every task commit:** Manual smoke test the changed behavior in browser
- **After every plan wave:** Full manual walkthrough of all behaviors in the wave
- **Before `/gsd:verify-work`:** Full suite must be green (all behaviors pass manually)
- **Max feedback latency:** ~5 minutes per wave

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | CTRL-single-click | manual smoke | none — open browser, click empty cell with piece selected | ✅ client/main.js | ⬜ pending |
| 10-01-02 | 01 | 1 | CTRL-return-click | manual smoke | none — open browser, click placed piece with no selection | ✅ client/main.js | ⬜ pending |
| 10-01-03 | 01 | 1 | CTRL-rotation-buttons | manual smoke | none — select piece, click ↺/↻ buttons | ✅ client/main.js | ⬜ pending |
| 10-01-04 | 01 | 1 | EXT-01-R-key | manual smoke | none — select piece, press R | ✅ client/main.js | ⬜ pending |
| 10-02-01 | 02 | 2 | TOUCH-drag-preview | manual touch device | none — finger down on bank, drag to grid | ✅ client/main.js | ⬜ pending |
| 10-02-02 | 02 | 2 | TOUCH-ghost-confirm | manual touch device | none — touchend leaves ghost, tap confirms | ✅ client/main.js | ⬜ pending |
| 10-02-03 | 02 | 2 | TOUCH-long-press | manual touch device | none — 500ms hold on placed piece | ✅ client/main.js | ⬜ pending |
| 10-03-01 | 03 | 3 | CSS-auto-scale | manual | none — resize browser window, cells scale | ✅ client/style.css | ⬜ pending |
| 10-03-02 | 03 | 3 | CSS-portrait-overlay | manual | none — rotate device/narrow window | ✅ client/style.css | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] No test framework exists in this project — this is expected per project conventions (vanilla JS, no build tools, no test runner)
- [ ] All verification is manual browser testing — no Wave 0 installs required

*Existing infrastructure covers all phase requirements. No framework install is possible or required — project constraint: no build tools, no dependencies beyond Socket.IO.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Single click on empty cell places selected piece | CTRL-single-click | No test framework | Select piece from bank, click empty grid cell, verify piece appears |
| Single click on placed movable piece returns it | CTRL-return-click | No test framework | Place piece, deselect, click placed piece, verify it returns to bank |
| Rotation buttons rotate ghost and bank mini-grid | CTRL-rotation-buttons | No test framework | Select piece, hover over grid, click ↺/↻, verify ghost and bank mini-grid update |
| R key rotates selected piece 90° CW | EXT-01-R-key | No test framework | Select piece, press R key, verify bank mini-grid rotates |
| No 150ms delay on single click | CTRL-no-delay | No test framework | Click cell — placement should be instant, no perceptible lag |
| Rotation button click does NOT deselect piece | CTRL-deselect-fix | No test framework | Select piece, click rotation button, verify piece is still selected after rotation |
| Touch drag from bank to grid shows ghost | TOUCH-drag-preview | Requires touch device | Touch bank piece, drag finger to grid, verify ghost appears under finger |
| Ghost stays after touchend | TOUCH-ghost-persist | Requires touch device | Lift finger from grid, verify ghost cells remain highlighted |
| Tap ghost cell confirms placement | TOUCH-ghost-confirm | Requires touch device | Tap a ghost-highlighted cell, verify piece is placed |
| Long press returns placed piece | TOUCH-long-press | Requires touch device | Hold finger on placed movable piece for 500ms, verify it returns to bank |
| Grid auto-scales on window resize | CSS-auto-scale | Visual verification | Resize browser window from narrow to wide, cells should scale fluidly |
| Portrait overlay appears | CSS-portrait-overlay | Requires device rotation | Rotate device to portrait (or narrow window), verify German overlay message appears |
| Portrait overlay hides on landscape | CSS-portrait-hide | Requires device rotation | Rotate device back to landscape, verify overlay disappears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
