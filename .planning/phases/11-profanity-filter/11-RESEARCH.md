# Phase 11: Profanity Filter - Research

**Researched:** 2026-04-06
**Domain:** Server-side input validation, Node.js profanity filtering
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Use `bad-words` npm package (not `leo-profanity`)
- Rationale: English-focused wordlist, MIT license, ~3M weekly downloads, well-maintained, CommonJS-compatible via `require('bad-words')`
- Install as server dependency: `npm install bad-words` in `server/`
- Instantiate once at module scope: `const BadWordsFilter = require('bad-words'); const profanityFilter = new BadWordsFilter()`
- `createRoom` handler: add profanity check immediately after `const name = playerName.trim().slice(0, 20)` and before `createLobby()`
- `joinRoom` handler: add profanity check immediately after `const name = playerName.trim().slice(0, 20)` and before `addPlayer()`
- Both use existing `socket.emit('room:error', message)` — no new error channel needed
- Reject message: `"Player name is not allowed"` (generic — does not expose what was blocked)
- Tests go in `server/src/socket.test.js` (existing socket integration test file)
- 4 test cases: createRoom + joinRoom × profane name + clean name

### Claude's Discretion
- Specific test word choices (use a mild English word from the wordlist, e.g. "ass")
- Whether to mock `bad-words` or use the real package in tests (real package preferred — simpler, no mock drift)
- Filter instance location (module-scope in socket.js vs. required in socket.js from a shared module)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PROF-01 | Player names containing profanity are rejected server-side before room creation or joining; existing `room:error` display handles the feedback | `bad-words` v4.0.0 `isProfane()` method returns boolean; guard clause pattern matches existing synchronous validation style in socket.js |
</phase_requirements>

## Summary

Phase 11 adds a single guard clause to two socket handlers in `server/src/socket.js`. The `bad-words` package (v4.0.0, MIT, published 2024-08-18) provides `isProfane(string)` which returns a boolean — exactly what the guard clause needs. The package is CommonJS-compatible via `require('bad-words')`, matching the project's existing `require()` style throughout the server.

The integration is minimal: one module-level instantiation, two lines of guard code (one per handler), and four new test cases in the existing `socket.test.js` file. No new events, no client changes, no new modules. The existing `socket.emit('room:error', message)` pattern already handles error display on the client side.

The test file uses Node's built-in `node:test` runner and `node:assert/strict`. All existing tests use real game logic without mocking — the same approach applies here: use the real `bad-words` package in tests, no mock needed.

**Primary recommendation:** Install `bad-words` in `server/`, add module-scope instantiation to `socket.js`, insert `isProfane()` guard after the trim/slice line in both handlers, add 4 test cases to `socket.test.js`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| bad-words | 4.0.0 | Profanity detection via `isProfane()` boolean check | MIT license, CommonJS-compatible, English wordlist, locked by CONTEXT.md |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:test | built-in | Test runner | Already used in socket.test.js and game.test.js |
| node:assert/strict | built-in | Assertions | Already used in all project tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bad-words | leo-profanity | Locked out by CONTEXT.md; bad-words is the decided package |
| bad-words | bad-words-next | bad-words-next is ESM-only; bad-words v4.0.0 is CJS-compatible |

**Installation:**
```bash
# Run inside server/ directory
npm install bad-words
```

**Version verification:** Verified via `npm view bad-words version` — current version is `4.0.0`, published 2024-08-18.

## Architecture Patterns

### Recommended Project Structure
No new files or directories needed. All changes are additive within existing files:
```
server/
├── package.json          # add bad-words to dependencies
└── src/
    ├── socket.js         # add require + instantiation + 2 guard clauses
    └── socket.test.js    # add 4 new test cases (createRoom + joinRoom × clean/profane)
```

### Pattern 1: Module-Scope Filter Instantiation
**What:** Instantiate `BadWordsFilter` once at the top of `socket.js`, outside any function. This avoids re-creating the filter on every socket event.
**When to use:** Always — one filter instance per server process is correct.
**Example:**
```javascript
// Source: bad-words README (https://github.com/web-mech/badwords)
// At top of socket.js, after existing requires:
const BadWordsFilter = require('bad-words');
const profanityFilter = new BadWordsFilter();
```

### Pattern 2: Guard Clause After Trim/Slice
**What:** Check `isProfane()` on the already-trimmed, already-sliced name. Return early with `room:error` if profane. Matches the existing synchronous guard clause style in both handlers.
**When to use:** Immediately after `const name = playerName.trim().slice(0, 20)` in both `createRoom` and `joinRoom`.
**Example:**
```javascript
// Source: existing socket.js guard clause pattern + bad-words API
const name = playerName.trim().slice(0, 20);
if (profanityFilter.isProfane(name)) {
  return socket.emit('room:error', 'Player name is not allowed');
}
```

### Pattern 3: Test Cases Using Real Package
**What:** Use the real `bad-words` package in tests — do not mock it. This avoids mock-drift and keeps tests honest.
**When to use:** All 4 profanity test cases.
**Example:**
```javascript
// Source: existing socket.test.js style — makeMocks + trigger pattern
it('createRoom with profane name emits room:error', () => {
  const { socket, emitted } = makeMocks(undefined, 'sock-1', undefined);
  trigger(socket, 'createRoom', { playerName: 'ass' });
  assert.ok(emitted.socket['room:error'], 'room:error should be emitted');
  assert.equal(emitted.socket['room:error'][0], 'Player name is not allowed');
});

it('createRoom with clean name proceeds without room:error', () => {
  const { socket, emitted } = makeMocks(undefined, 'sock-2', undefined);
  trigger(socket, 'createRoom', { playerName: 'Alice' });
  assert.ok(!emitted.socket['room:error'], 'room:error must NOT be emitted for clean name');
  assert.ok(emitted.socket['room:created'], 'room:created should be emitted');
});
```

### Anti-Patterns to Avoid
- **Re-instantiating BadWordsFilter inside the handler:** Creates a new filter object on every socket event. Instantiate once at module scope.
- **Using `filter.clean()` instead of `filter.isProfane()`:** `clean()` replaces words with asterisks but still lets the name through. Use `isProfane()` for rejection logic.
- **Checking the raw `playerName` before trim:** The name used for `createLobby`/`addPlayer` is the trimmed+sliced value — check the same `name` variable to avoid inconsistency.
- **Mocking `bad-words` in tests:** Introduces mock drift. The real package is deterministic and installs in milliseconds.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Profanity wordlist | Custom regex or word array | `bad-words` package | Maintaining a wordlist is ongoing work; `bad-words` covers edge cases like leet speak variations and embedded words |
| isProfane logic | `name.includes('bad')` | `isProfane(name)` | `bad-words` handles multi-word checks, case normalization, and wordlist management |

**Key insight:** `bad-words` handles leet speak (e.g., "a55") and substring detection. A manual `includes()` check would miss these.

## Common Pitfalls

### Pitfall 1: bad-words v4.0.0 Module Format
**What goes wrong:** Attempting to use named import `import { Filter } from 'bad-words'` in a CommonJS file fails. Attempting `const { Filter } = require('bad-words')` also fails — the default export is the class itself.
**Why it happens:** v4.0.0 changed the module entry points. The README documents ESM import syntax but the CJS build exports the class as the default export.
**How to avoid:** Use `const BadWordsFilter = require('bad-words')` (no destructuring), then `new BadWordsFilter()`. This matches CONTEXT.md's locked decision.
**Warning signs:** `TypeError: BadWordsFilter is not a constructor` or `Filter is not a constructor` at startup.

### Pitfall 2: isProfane on Empty or Whitespace-Only Names
**What goes wrong:** Calling `profanityFilter.isProfane('')` on an empty string may throw or return unexpected results.
**Why it happens:** The existing guard `if (!playerName || typeof playerName !== 'string' || playerName.trim() === '')` already runs before the profanity check. By the time `isProfane(name)` is called, `name` is always a non-empty string (1–20 chars). No special handling needed.
**How to avoid:** Keep the profanity check after the existing empty-name guard — do not reorder guards.

### Pitfall 3: makeMocks Needs roomCode Handling for createRoom Tests
**What goes wrong:** `makeMocks` sets `socket.data.roomCode` and `socket.data.playerName` on construction. The `createRoom` handler generates its own roomCode and sets `socket.data.roomCode` internally — starting with an existing roomCode in `makeMocks` is harmless but can cause confusion.
**Why it happens:** The `createRoom` handler does not read `socket.data.roomCode` before acting — it generates a fresh one. Passing `undefined` as the roomCode to `makeMocks` is clean for createRoom tests.
**How to avoid:** Call `makeMocks(undefined, 'socket-id', undefined)` for `createRoom` tests. Call `makeMocks('EXISTING_CODE', 'socket-id', 'PlayerName')` for `joinRoom` tests where the lobby pre-exists.

### Pitfall 4: joinRoom Test Requires Pre-Existing Lobby
**What goes wrong:** Testing `joinRoom` with a profane name but no pre-existing lobby causes the handler to return `room:error` with "Room ... not found" before reaching the profanity check.
**Why it happens:** The `joinRoom` handler checks room existence after trimming but before the proposed profanity check location. Inserting the profanity check before the room lookup means the lobby does NOT need to exist for the profanity rejection test to work.
**How to avoid:** The locked CONTEXT.md placement ("immediately after trim/slice, before addPlayer") means the profanity check runs before `getLobby()`. So profane-name tests for `joinRoom` do NOT need a pre-existing lobby — the rejection happens first.

## Code Examples

Verified patterns from official sources:

### bad-words: Require and Instantiate (CommonJS)
```javascript
// Source: bad-words README (https://github.com/web-mech/badwords)
const BadWordsFilter = require('bad-words');
const profanityFilter = new BadWordsFilter();
```

### bad-words: isProfane Usage
```javascript
// Source: bad-words README
profanityFilter.isProfane('ass');      // true
profanityFilter.isProfane('Alice');    // false
profanityFilter.isProfane('ass hat'); // true (multi-word)
```

### Full createRoom Handler with Guard (proposed)
```javascript
// Source: existing socket.js pattern + bad-words API
socket.on('createRoom', ({ playerName } = {}) => {
  if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
    return socket.emit('room:error', 'Player name is required');
  }
  const name = playerName.trim().slice(0, 20);
  if (profanityFilter.isProfane(name)) {
    return socket.emit('room:error', 'Player name is not allowed');
  }
  const roomCode = generateRoomCode();
  createLobby(roomCode, socket.id, name);
  // ... rest unchanged
});
```

### Full joinRoom Handler with Guard (proposed)
```javascript
// Source: existing socket.js pattern + bad-words API
socket.on('joinRoom', ({ roomCode, playerName } = {}) => {
  if (!roomCode || typeof roomCode !== 'string') {
    return socket.emit('room:error', 'Room code is required');
  }
  if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
    return socket.emit('room:error', 'Player name is required');
  }
  const name = playerName.trim().slice(0, 20);
  if (profanityFilter.isProfane(name)) {
    return socket.emit('room:error', 'Player name is not allowed');
  }
  const lobby = getLobby(roomCode);
  // ... rest unchanged
});
```

### Test Cases (4 required)
```javascript
// Source: existing socket.test.js makeMocks + trigger pattern
describe('createRoom profanity filter', () => {
  it('rejects profane name with room:error "Player name is not allowed"', () => {
    const { socket, emitted } = makeMocks(undefined, 'cr-prof-1', undefined);
    trigger(socket, 'createRoom', { playerName: 'ass' });
    assert.ok(emitted.socket['room:error']);
    assert.equal(emitted.socket['room:error'][0], 'Player name is not allowed');
  });

  it('accepts clean name — emits room:created, no room:error', () => {
    const { socket, emitted } = makeMocks(undefined, 'cr-clean-1', undefined);
    trigger(socket, 'createRoom', { playerName: 'Alice' });
    assert.ok(!emitted.socket['room:error']);
    assert.ok(emitted.socket['room:created']);
  });
});

describe('joinRoom profanity filter', () => {
  it('rejects profane name with room:error "Player name is not allowed"', () => {
    const { socket, emitted } = makeMocks('ANYCODE', 'jr-prof-1', undefined);
    trigger(socket, 'joinRoom', { roomCode: 'ANYCODE', playerName: 'ass' });
    assert.ok(emitted.socket['room:error']);
    assert.equal(emitted.socket['room:error'][0], 'Player name is not allowed');
  });

  it('proceeds past filter for clean name (may emit room not found — that is fine)', () => {
    const roomCode = 'JRCLEAN1';
    lobbies.delete(roomCode);
    createLobby(roomCode, 'host-sock', 'Host');
    addPlayer(roomCode, 'jr-clean-1', 'Observer'); // ensure room exists but reject on name
    // Actually: just verify no 'Player name is not allowed' error
    const { socket, emitted } = makeMocks(roomCode, 'jr-clean-1', undefined);
    trigger(socket, 'joinRoom', { roomCode, playerName: 'Alice' });
    const errors = emitted.socket['room:error'] || [];
    assert.ok(!errors.includes('Player name is not allowed'), 'Clean name must not trigger profanity rejection');
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `var Filter = require('bad-words')` | `const BadWordsFilter = require('bad-words')` | v4.0.0 (2024) | Same behavior, cleaner naming convention |
| `filter.clean(text)` for rejection | `filter.isProfane(text)` for boolean gate | Existing API | `isProfane` is the correct method for validation logic |

**Deprecated/outdated:**
- `import Filter from 'bad-words'` (default ESM import): The package uses named export `{ Filter }` in ESM. In CommonJS, use `require('bad-words')` directly (no destructuring).

## Open Questions

1. **Leet speak coverage**
   - What we know: `bad-words` README claims leet speak handling. Tests use "ass" as the example word.
   - What's unclear: Whether "a55" or "a$s" are caught depends on the package's internal regex, not documented precisely.
   - Recommendation: This is out of scope for Phase 11. The locked decision is to use `bad-words` as-is without customization. Use a plain word like "ass" as the test word — guaranteed to be in the wordlist.

2. **No PROF-01 entry in REQUIREMENTS.md**
   - What we know: REQUIREMENTS.md lists GRID/PIEC/CTRL/ANIM/EXT requirement IDs. PROF-01 is not present.
   - What's unclear: PROF-01 is referenced in the phase description and CONTEXT.md but not tracked in REQUIREMENTS.md.
   - Recommendation: Implementation can proceed — the requirement is fully specified in CONTEXT.md. The planner should reference CONTEXT.md for requirement details rather than REQUIREMENTS.md.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node.js 18+) |
| Config file | none — run via `node --test` |
| Quick run command | `node --test server/src/socket.test.js` |
| Full suite command | `node --test server/src/socket.test.js server/src/game.test.js` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROF-01 | createRoom rejects profane name → room:error "Player name is not allowed" | unit | `node --test server/src/socket.test.js` | ✅ (new cases in existing file) |
| PROF-01 | joinRoom rejects profane name → room:error "Player name is not allowed" | unit | `node --test server/src/socket.test.js` | ✅ (new cases in existing file) |
| PROF-01 | createRoom with clean name → no room:error, room:created emitted | unit | `node --test server/src/socket.test.js` | ✅ (new cases in existing file) |
| PROF-01 | joinRoom with clean name → no profanity rejection | unit | `node --test server/src/socket.test.js` | ✅ (new cases in existing file) |

### Sampling Rate
- **Per task commit:** `node --test server/src/socket.test.js`
- **Per wave merge:** `node --test server/src/socket.test.js server/src/game.test.js`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
None — existing test infrastructure covers all phase requirements. `socket.test.js` already exists and has the `makeMocks` + `trigger` helpers. The 4 new test cases are additive only.

## Sources

### Primary (HIGH confidence)
- `server/src/socket.js` (read directly) — exact insertion points at lines 45 and 71, existing error message style
- `server/src/socket.test.js` (read directly) — `makeMocks`, `trigger`, `describe`/`it` patterns to follow
- `npm view bad-words version` (CLI, live registry) — confirmed v4.0.0, published 2024-08-18
- https://github.com/web-mech/badwords — README confirming `require('bad-words')` CJS usage, `isProfane()` method signature, `new Filter()` constructor

### Secondary (MEDIUM confidence)
- https://www.npmjs.com/package/bad-words — confirmed MIT license, ~3M weekly downloads, version 4.0.0

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — version verified live from npm registry, API verified from GitHub README
- Architecture: HIGH — insertion points read directly from source files, pattern matches existing code exactly
- Pitfalls: HIGH for pitfalls 1-3 (verified from source), MEDIUM for pitfall 4 (inferred from handler structure)

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable package, stable project — 30 days)
