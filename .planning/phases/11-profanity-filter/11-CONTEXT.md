# Phase 11: Profanity Filter - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Server-side name validation in `createRoom` and `joinRoom` socket handlers. Player names containing profanity are rejected before the lobby operation executes; the existing `room:error` event carries the rejection message to the client. No client-side changes. No new socket events.

</domain>

<decisions>
## Implementation Decisions

### Package Selection
- Use `bad-words` npm package (not `leo-profanity`)
- Rationale: English-focused wordlist, MIT license, ~3M weekly downloads, well-maintained, CommonJS-compatible via `require('bad-words')`
- Install as server dependency: `npm install bad-words` in `server/`
- Instantiate once at module scope: `const BadWordsFilter = require('bad-words'); const profanityFilter = new BadWordsFilter()`

### Integration Points
- `createRoom` handler: add profanity check immediately after `const name = playerName.trim().slice(0, 20)` and before `createLobby()`
- `joinRoom` handler: add profanity check immediately after `const name = playerName.trim().slice(0, 20)` and before `addPlayer()`
- Both use existing `socket.emit('room:error', message)` to reject — no new error channel needed

### Error Message
- Reject message: `"Player name is not allowed"` (generic — does not expose what was blocked)
- Consistent with existing English error messages in socket.js (`'Player name is required'`, `'Room code is required'`, etc.)

### Test Strategy
- Tests go in `server/src/socket.test.js` (existing socket integration test file)
- Test cases needed:
  1. `createRoom` with a profane name → emits `room:error` with "Player name is not allowed"
  2. `createRoom` with a clean name → no `room:error`, proceeds normally
  3. `joinRoom` with a profane name → emits `room:error` with "Player name is not allowed"
  4. `joinRoom` with a clean name → no `room:error`, proceeds normally

### Claude's Discretion
- Specific test word choices (use a mild English word from the wordlist, e.g. "ass")
- Whether to mock `bad-words` or use the real package in tests (real package preferred — simpler, no mock drift)
- Filter instance location (module-scope in socket.js vs. required in socket.js from a shared module)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Integration points
- `server/src/socket.js` — `createRoom` (line ~41) and `joinRoom` (line ~63) handlers; exact trim/slice pattern and existing `room:error` emits
- `server/src/socket.test.js` — Existing test structure to follow when adding new profanity tests

### Feature requirements
- `.planning/research/FEATURES.md` §"Profanity Filter" — Package recommendation, integration point analysis, CommonJS compatibility note
- `.planning/ROADMAP.md` §"Phase 11: Profanity Filter" — Success criteria and plan spec

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `socket.emit('room:error', message)` — already used in both handlers for name/room validation; profanity rejection uses the same call
- `const name = playerName.trim().slice(0, 20)` — the exact insertion point for the filter check in both handlers

### Established Patterns
- Validation in handlers is synchronous: check condition → `return socket.emit('room:error', ...)` → guard clause style
- All existing error messages are English strings
- Tests in `socket.test.js` use real `game.js` logic; no heavy mocking needed

### Integration Points
- `server/src/socket.js`: two guard clauses, one per handler
- `server/package.json`: add `bad-words` to dependencies
- `server/src/socket.test.js`: 4 new test cases (2 per handler × 2 name types)

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard additive guard clause pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-profanity-filter*
*Context gathered: 2026-04-06*
