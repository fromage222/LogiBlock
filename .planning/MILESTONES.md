# Milestones

## v1.0 LogiBlock MVP (Shipped: 2026-03-15)

**Phases completed:** 3 phases (01-foundation, 02-game-loop, 03-timer-und-leaderboard)
**Plans:** 11 | **Timeline:** 2026-03-01 → 2026-03-10 (9 days)
**Code:** ~2,543 LOC (1,275 JS source + 803 JS tests + 104 HTML + 361 CSS)
**Tests:** 68/68 pass

**Key accomplishments:**
1. Express + Socket.IO server with in-memory LobbyManager, schema-validated puzzle loading, and GAME-06 solution-isolation invariant enforced from day one
2. Full Socket.IO lobby lifecycle — room create/join, puzzle select, game start, host-left and player-left disconnect handling with empty-lobby auto-destruction
3. Vanilla JS three-screen SPA (start/lobby/game) with all 11 socket events handled and anchor cell grid rendering
4. Server game logic TDD suite — placePiece, returnPiece, checkWin, advanceTurn, rotateCells (37 tests); game:move socket handler (14 tests)
5. Click-to-place multiplayer game loop with mousemove ghost preview, rotation cycles (0°/90°/180°/270°), bank management, and Win-Screen overlay
6. Server-side authoritative timer + in-memory session leaderboard sorted fastest-first; live client MM:SS timer; restructured win card with time hero element

**Integration:** 25/25 requirements wired, 3/3 E2E flows complete, 0 broken paths

### Known Gaps

The following requirements were marked as "orphaned" in the milestone audit (present in REQUIREMENTS.md and SUMMARY.md frontmatter but absent from all VERIFICATION.md files). This is a **documentation gap only** — all are implemented and confirmed wired by the integration checker.

Root cause: Phase 01 was never given a formal `01-VERIFICATION.md`.

- **LOBB-01**: Player can create room, gets unique Room-Code
- **LOBB-02**: Player can join room by Room-Code
- **LOBB-03**: All players see live which teammates are connected in lobby
- **LOBB-04**: Host can start game (only when ≥2 players connected)
- **LOBB-05**: Host can select puzzle before game start
- **PUZZ-01**: Server loads all puzzle JSONs at startup, validates schema
- **PUZZ-02**: Anchor shapes pre-placed at game start, immovable
- **GAME-10**: Empty lobbies automatically destroyed

Remediation: Create `.planning/phases/01-foundation/01-VERIFICATION.md` (backfill only — no code changes needed).

---

