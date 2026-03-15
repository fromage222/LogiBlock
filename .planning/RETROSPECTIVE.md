# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

---

## Milestone: v1.0 — LogiBlock MVP

**Shipped:** 2026-03-10 (archived 2026-03-15)
**Phases:** 3 | **Plans:** 11 | **Timeline:** 9 days (2026-03-01 → 2026-03-10)

### What Was Built

- Full-stack multiplayer puzzle game: Node.js + Socket.IO server with in-memory LobbyManager, Vanilla JS SPA client
- Server-authoritative game loop: placePiece, returnPiece, checkWin, rotateCells — GAME-06 invariant (solution never leaves server) enforced from day one
- Real-time sync: 11 socket events wired across all 3 phases with 0 orphaned events
- Timer + in-memory leaderboard: server-side `startTime`/`elapsedMs`, live MM:SS client timer, session-scoped sorted leaderboard
- TDD foundation: 68 tests passing (37 game logic + 14 socket handler + 17 other), all written before implementation

### What Worked

- **GAME-06 invariant from day one.** Establishing `getPublicState()` as the sole serialization gate in Phase 1 meant all Phase 2/3 work naturally respected it. No retrofitting needed.
- **TDD before implementation.** Writing failing tests first in Phase 2 (game.js and socket.js) caught edge cases early. advanceTurnIfActive had 5 tests covering all disconnect scenarios before the function was written.
- **Human verification checkpoints.** Plans 02-05 and 03-03 were pure verification phases — no code, just test. These caught the UX behavior changes (drag-drop → click-to-place) and confirmed the full E2E flow worked before moving on.
- **Socket event naming established in Phase 1.** Defining all event names upfront (`lobby:update`, `game:stateUpdate`, `game:win`, etc.) in Phase 1 RESEARCH prevented naming conflicts in Phases 2 and 3.
- **3-phase decomposition was clean.** Each phase had exactly one architectural boundary: Phase 1 = lobby infrastructure, Phase 2 = game loop, Phase 3 = timer + leaderboard. No phase bled into another's concerns.
- **`disconnecting` (not `disconnect`) for cleanup.** Getting this right in Phase 1 meant disconnect handling worked correctly throughout. `socket.rooms` is still populated at `disconnecting`, enabling reliable room lookup.

### What Was Inefficient

- **Phase 01 never got a VERIFICATION.md.** The phase executed cleanly but no formal verification document was created. This caused 8 requirements to be flagged as "orphaned" in the milestone audit, requiring a manual "proceed anyway" decision. A 10-minute backfill would have closed this.
- **Phase 2 VERIFICATION ended as `human_needed` (not `passed`).** The working tree had uncommitted UX improvements at verification time, making the verification file note 4 items for human confirmation. While the human sign-off happened (Plan 02-05), the VERIFICATION.md status was never updated to `passed`.
- **Task count not tracked in SUMMARY.md.** The `gsd-tools milestone complete` command extracted 0 tasks because task data wasn't in SUMMARY.md frontmatter. Minor — doesn't affect quality but affects statistics.

### Patterns Established

- **`getPublicState()` as sole outbound serialization gate** — never serialize raw lobby/puzzle objects directly to socket events.
- **`disconnecting` event for all socket cleanup** — `socket.rooms` is still populated, making room identification reliable.
- **`advanceTurnIfActive` before `removePlayer`** — turn index is valid while the player is still in the array.
- **Test-first for server game logic** — write failing tests, then implement. Works well for pure functions with deterministic outputs.
- **Screen switching via `.screen` / `.screen.active` CSS classes** — `showScreen(screenId)` toggles classes, CSS controls `display:none/block`.
- **Human verification as a named plan** — treating the E2E playtest as a formal checkpoint (with its own plan and summary) ensures it doesn't get skipped.

### Key Lessons

1. **Create VERIFICATION.md immediately after phase execution.** Even a quick verification with `status: passed` and the evidence from SUMMARY.md prevents "orphaned requirement" flags in the milestone audit.
2. **Update VERIFICATION.md status after human sign-off.** When a `human_needed` checkpoint resolves, update the status field to `passed` so the audit doesn't need to cross-reference the ROADMAP.
3. **The GAME-06 invariant (solution isolation) is best enforced as a day-1 contract.** Design the data access layer before writing any game event handlers. Retrofitting is far harder.
4. **Socket event naming is a contract, not an implementation detail.** Lock event names in RESEARCH before writing any handlers. Mismatches between client and server event names cause silent failures.
5. **Click-to-place is simpler than HTML5 drag-and-drop for grid placement.** mousemove ghost preview + click-to-place is more reliable cross-platform and gives users better visual feedback than native drag events.

### Cost Observations

- Model mix: ~100% sonnet (claude-sonnet-4-6)
- Sessions: multiple across 9 development days
- Notable: TDD approach meant less debugging time — game logic was correct before wiring. Human verification checkpoints caught UX issues that couldn't be caught programmatically.

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Phases | Plans | Key Observation |
|-----------|--------|-------|-----------------|
| v1.0 | 3 | 11 | First milestone — patterns established. TDD + human verification checkpoints proved effective. |

### Cumulative Quality

| Milestone | Tests | Notes |
|-----------|-------|-------|
| v1.0 | 68 | 37 game logic + 14 socket handler + 17 other. 100% pass rate at ship. |

### Top Lessons (Verified This Milestone)

1. Create VERIFICATION.md immediately after each phase — don't leave it for the audit.
2. GAME-06 (solution never leaves server) is best as a day-1 architectural invariant, not a feature to add later.
3. Human verification checkpoints should be named phases — they catch what automated tests can't.
