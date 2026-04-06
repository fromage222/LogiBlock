---
phase: 11
slug: profanity-filter
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in, Node.js 18+) |
| **Config file** | none — run via `node --test` |
| **Quick run command** | `node --test server/src/socket.test.js` |
| **Full suite command** | `node --test server/src/socket.test.js server/src/game.test.js` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test server/src/socket.test.js`
- **After every plan wave:** Run `node --test server/src/socket.test.js server/src/game.test.js`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | PROF-01 | unit | `node --test server/src/socket.test.js` | ✅ | ⬜ pending |
| 11-01-02 | 01 | 1 | PROF-01 | unit | `node --test server/src/socket.test.js` | ✅ | ⬜ pending |
| 11-01-03 | 01 | 1 | PROF-01 | unit | `node --test server/src/socket.test.js` | ✅ | ⬜ pending |
| 11-01-04 | 01 | 1 | PROF-01 | unit | `node --test server/src/socket.test.js` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. `server/src/socket.test.js` already exists with `makeMocks` + `trigger` helpers. The 4 new test cases are additive only.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
