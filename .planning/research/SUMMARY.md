# Project Research Summary

**Project:** LogiBlock — Cooperative Multiplayer Puzzle Game
**Domain:** Browser-based, turn-based cooperative multiplayer puzzle game (tetromino placement, shared grid)
**Researched:** 2026-03-01
**Confidence:** HIGH

## Executive Summary

LogiBlock is a cooperative multiplayer puzzle game where 2–4 players collaboratively place tetromino-shaped pieces onto a shared grid, solving a puzzle that only the server knows. The genre is well-understood: browser-based multiplayer games of this type follow a server-authoritative model where all game state lives on the server, clients act only as dumb rendering terminals, and the solution to the puzzle is never transmitted to any client. The established implementation approach for this scale (7 concurrent lobbies, 4 players each) is a Node.js + Socket.IO server with Vanilla JS clients — no framework, no database, no external state store. Every design decision in the research converges on simplicity: in-memory state, synchronous event handlers, CSS Grid for layout, and Socket.IO rooms as the lobby primitive.

The recommended approach is a 3-phase build: (1) establish the server foundation — lobby lifecycle, puzzle loading, solution security, and disconnect safety — before any game logic is written; (2) implement the full game loop — turn management, piece placement with server-side validation against the hidden solution, return-piece action, win detection, and real-time state broadcast; (3) polish the client UI — responsive grid rendering, bank interaction, turn indicators, and move feedback. This ordering is dictated by architecture dependencies: the `Room` class and `GameManager` must exist before any socket wiring, which must exist before any client work begins. Deviating from this order produces untestable dead-ends.

The dominant risk in this project is not complexity — the tech stack is minimal — but a cluster of correctness traps: solution data leaking through state broadcasts, frozen games after player disconnect, race conditions from optimistic client updates, and turn validation that trusts the client. All four are preventable with day-one invariants (see Critical Pitfalls). The secondary risk is scope creep into anti-features (accounts, database, mobile touch, WebRTC) that add no demonstration value and consume significant time.

---

## Key Findings

### Recommended Stack

The stack is deliberately minimal and matches the university project constraint of Vanilla JS on the client with no build tooling. Server dependencies are: `express` (v4.18, HTTP + static file serving), `socket.io` (v4.7, real-time bidirectional events with built-in room support), `dotenv` (environment config), and `cors` (development CORS). The development dependency is `nodemon` (v3). The client loads `socket.io-client` from CDN — no npm install, no bundler.

Express v5 and Socket.IO v5 are explicitly excluded (unstable RC). TypeScript, React, Vite, databases (Prisma, MongoDB), Redis, game engines (Phaser), and raw WebSockets are all excluded for documented reasons. The rationale for each exclusion is that the tools provide zero value at this scale or violate the project constraint. CSS Grid is the correct layout primitive for the game board; HTML Canvas is not.

**Core technologies:**
- Node.js 20 LTS: stable runtime with `node:test` built in for unit testing game logic
- Express 4.18: HTTP server and static file serving; no need for v5
- Socket.IO 4.7: real-time events, built-in rooms eliminate custom lobby bookkeeping; must match client version
- Vanilla JS (ES2022+): project constraint; a grid-based turn game needs no framework
- CSS Grid + Flexbox: declarative layout with native DOM event handling; canvas is overkill
- `crypto.randomBytes`: zero-dependency room code generation, sufficient for 7 lobbies

### Expected Features

The full feature dependency tree is documented in FEATURES.md. The MVP list is clear and non-negotiable: without every item in Table Stakes, the project either does not function or fails its requirements.

**Must have (table stakes):**
- Room creation + join by code (6-char) — multiplayer cannot exist without this
- Lobby with player list and host-controlled start — prevents mid-join race conditions
- Puzzle loading from JSON with anchor pieces pre-placed — defines the game object
- Shared grid and piece bank display (server as single source of truth) — core game UI
- Active player indicator + circular turn progression — fundamental turn-based contract
- Place piece action with server-side validation against hidden solution — the defining technical requirement
- Return piece (grid to bank) — required per spec for collaborative correction
- Real-time state broadcast after every action — all clients stay synchronized
- Win condition detection and win screen — game must have an end state
- Disconnect handling (advance turn if active player disconnects) — prevents permanent freeze
- Invalid move feedback to acting player — minimum UX requirement

**Should have (elevates grade):**
- Player color coding (low effort, high visual impact — each player's pieces in their color)
- Multiple puzzle selection (shows the JSON system is generic and reusable)
- Ghost/preview on hover (client-side only, no server involvement — polished UX)
- Move history log (makes event streaming visible; excellent for graders)

**Defer (v2+ or cut entirely):**
- Turn timer — medium complexity, add only if time permits
- Piece rotation — decide based on whether puzzle JSONs actually require it
- Reconnect support — high complexity, not required for demo; `socket.id` changes on reconnect, document as known limitation
- All anti-features: accounts, database, leaderboards, mobile touch, spectator mode, chat, AI player, WebRTC

### Architecture Approach

The architecture follows a strict server-authoritative pattern: all game state lives in a `Map<roomCode, Room>` on the server; clients hold a mirror copy of the public (solution-stripped) state and re-render on every `game:stateUpdate` broadcast. The server has five components (`server.js`, `socket.js`, `GameManager`, `Room`, `PuzzleLoader`) with clear single responsibilities. The client has four components (`SocketClient`, `LobbyView`, `GameView`, `WinView`) plus a plain JS `ClientState` object. The Socket.IO room name IS the game lobby code — no custom room abstraction is needed. Move handlers are kept synchronous to exploit Node.js's single-threaded event loop as a natural mutex against race conditions.

**Major components:**
1. `Room` class — all game logic: turn rotation, move validation against solution, grid/bank mutation, win detection; no Socket.IO dependency; fully unit-testable
2. `GameManager` — room lifecycle (create, join, destroy), room code generation with collision check, max-room enforcement
3. `socket.js` — thin event router: maps socket events to `GameManager` actions, broadcasts results via `io.to(roomCode).emit()`; contains zero game logic
4. `PuzzleLoader` — reads and validates all `puzzles/*.json` at startup; holds solutions in memory; never serializes solution fields
5. `GameView` (client) — renders CSS Grid from server state; handles click-select interaction; emits `game:move`; re-renders fully on each `game:stateUpdate`

### Critical Pitfalls

The pitfalls research identified 6 critical, 5 moderate, and 3 minor issues. The critical ones must be addressed in Phase 1 architecture decisions — they cannot be retrofitted.

1. **Solution leaking in state broadcast** — Implement `getPublicState()` on day 1 and use it as the ONLY serialization path from server to client. Never emit the raw game state object. This is an architectural invariant, not a fix.
2. **Async `socket.join()` race** — `socket.join()` is async in some Socket.IO configurations. Always `await socket.join(roomCode)` before emitting to the room, or emit initial state directly to the joining socket separately.
3. **Disconnect freezes active turn** — The `disconnect` handler must check if the leaving player held the active turn and call `advanceTurn()` before broadcasting the updated state.
4. **Async race condition in move handlers** — Keep all game state mutation synchronous. No `await` in the move handler critical path. Synchronous handlers are naturally atomic in Node.js's single-threaded model.
5. **Turn validation missing** — Every move handler's first line must check `room.activePlayerId === socket.id`. Trusting the client to send moves only on their turn is a correctness bug, not a security concern.
6. **Optimistic client updates** — Do not update the client grid before server confirmation. Lock the UI on submission, wait for `stateUpdate` ack. For a turn-based game on LAN/localhost, the latency is imperceptible.

---

## Implications for Roadmap

Based on the architecture's build order and the feature dependency tree, a 3-phase structure is strongly recommended. Each phase produces a working vertical slice.

### Phase 1: Foundation — Server, Lobby, and Security Invariants

**Rationale:** The `Room` class and `GameManager` must exist before any socket wiring. Solution security and disconnect handling are architectural decisions that, if deferred, require invasive refactoring. Building these first means every subsequent phase builds on a correct foundation.
**Delivers:** Working multiplayer lobby — players can create rooms, join by code, see the player list, and the host can start the game. Server loads and validates puzzles at startup. Solution never leaves the server from day one.
**Addresses features from FEATURES.md:** Room creation + join, lobby + player list, host concept, disconnect handling, in-memory game state, puzzle loading with anchor pre-placement.
**Avoids pitfalls:** Solution leaking (getPublicState invariant), async join race, disconnect-freezes-turn, room cleanup, room code collision, puzzle JSON validation.
**Architecture components built:** `PuzzleLoader`, `Room` (data schema only, no move logic yet), `GameManager`, `server.js`, `socket.js` (lobby events only), `LobbyView` (client).

### Phase 2: Game Loop — Turn Management, Validation, and Win Detection

**Rationale:** Once the lobby foundation is solid, the game logic can be implemented in strict dependency order: `Room` move validation first (pure function, unit-testable), then socket wiring for moves, then win detection. This is the highest-complexity phase and must not begin until Phase 1 is tested.
**Delivers:** A fully playable game — active player indicator, piece placement with server-side solution validation, piece return action, real-time state broadcast after every action, win detection and win screen, invalid move feedback.
**Uses from STACK.md:** Socket.IO `io.to(roomCode).emit()` for state broadcast; `node:test` for unit tests on `Room.validateMove()`, `Room.checkWin()`, `Room.advanceTurn()`.
**Implements:** `Room` game logic methods, `socket.js` move event handlers (`game:move`), `GameView` (grid rendering + bank + turn indicator), `WinView`.
**Avoids pitfalls:** Turn validation missing (first-line guard), async race in move handlers (synchronous only), no optimistic updates, rotation included in move payload, cell-by-cell win comparison (not JSON.stringify).

### Phase 3: Polish — Client UI and Differentiators

**Rationale:** All table stakes are complete after Phase 2. Phase 3 adds the differentiating features that elevate the grade with low risk of breaking existing behavior, since all additions are either client-only or additive server features.
**Delivers:** Player color coding on the grid, multiple puzzle selection in the lobby, ghost/preview on hover (client-only), move history log (sidebar), move acknowledgment timeout safety net, duplicate listener prevention on reconnect.
**Addresses features from FEATURES.md:** All "should have" differentiators.
**Avoids pitfalls:** Duplicate event listeners on reconnect (register handlers once at module load), UI permanently locked (5-second client-side timeout safety net).

### Phase Ordering Rationale

- Phase 1 before Phase 2 because `Room`, `GameManager`, and `socket.js` must exist before game moves can be processed. Solution security must be an architectural invariant from the start.
- Phase 2 before Phase 3 because differentiating features (color coding, ghost preview, history log) depend on the game loop being functional. Adding polish to a broken game is wasted effort.
- The ARCHITECTURE.md build order (PuzzleLoader → Room → GameManager → socket.js → LobbyView → GameView grid → GameView bank/interaction → turn/feedback → WinView) maps cleanly onto Phases 1–2–3.
- Anti-features (accounts, database, mobile touch, WebRTC) are explicitly excluded from all phases. Scope creep into these areas is the primary schedule risk.

### Research Flags

Phases with standard, well-documented patterns (skip `research-phase`):
- **Phase 1:** Socket.IO room lifecycle and Node.js server setup are exhaustively documented. In-memory state at this scale is trivially correct.
- **Phase 2:** Server-authoritative game loop is a standard pattern in multiplayer game development. Move validation logic is pure function design. No external API integration.
- **Phase 3:** CSS animations and client-side DOM manipulation are standard web development. No novel technology.

No phases require deeper research. The entire stack is well-documented and the patterns are established.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Technology choices are minimal and proven. Express v4 and Socket.IO v4 are the current stable majors. Exact patch versions should be verified with `npm view <pkg> version` before install. |
| Features | HIGH | Table stakes derived from project specification and domain analysis. Differentiator list is conservative and scoped to low-complexity items. |
| Architecture | HIGH | Server-authoritative pattern is the canonical approach for this problem. Component boundaries are clean, testable, and consistent across all research files. |
| Pitfalls | HIGH | All critical pitfalls have concrete code-level prevention strategies. Most arise from well-known Socket.IO and Node.js event-loop characteristics. |

**Overall confidence:** HIGH

### Gaps to Address

- **Puzzle JSON content:** The research defines the puzzle schema and validation approach, but does not provide pre-built puzzle files. At least 2–3 puzzle JSONs must be authored before Phase 2 testing is possible. The schema is well-defined; authoring is a content task, not a research task.
- **Piece rotation in puzzles:** Whether piece rotation is used in puzzle solutions determines whether the rotation UI (medium complexity) is required or can be deferred. This decision should be made when authoring the first puzzle JSON, before Phase 2 begins.
- **`socket.id` reconnect limitation:** Accepted as a known limitation for this scope. If the grader explicitly tests reconnect behavior, additional work is needed. Document clearly in README.

---

## Sources

### Primary (HIGH confidence)
- Socket.IO v4 official documentation — room API, `socket.join()` async behavior, event routing
- Node.js v20 LTS release notes — `node:test` availability, `crypto.randomBytes` API
- Express 4.18 official documentation — HTTP server setup, static file serving
- CSS Grid specification — grid layout for game board rendering

### Secondary (MEDIUM confidence)
- npm registry metadata — Express v4 vs v5 RC status, Socket.IO v4.7 as current stable, nodemon v3
- Multiplayer game architecture community patterns — server-authoritative model, full state broadcast over partial patches, synchronous move handlers
- Browser-based multiplayer game conventions — 6-char room codes (Jackbox, skribbl.io pattern), lobby host model

### Tertiary (LOW confidence)
- Specific version numbers for Express and Socket.IO — verify with `npm view express version` and `npm view socket.io version` before installation; research used last known stable versions

---
*Research completed: 2026-03-01*
*Ready for roadmap: yes*
