---
phase: 11-profanity-filter
plan: 01
subsystem: api
tags: [bad-words, profanity-filter, socket-io, input-validation, node-test]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: socket.js registerSocketHandlers, createRoom/joinRoom handlers, room:error event pattern
  - phase: 02-game-loop
    provides: socket.test.js with makeMocks/trigger test helpers

provides:
  - bad-words v3.0.4 installed as server dependency
  - profanityFilter.isProfane() guard in createRoom handler (after trim/slice, before generateRoomCode)
  - profanityFilter.isProfane() guard in joinRoom handler (after trim/slice, before getLobby)
  - 4 profanity filter test cases in socket.test.js (createRoom x2, joinRoom x2)
  - socket.join stub in makeMocks helper (fixes previously untested success paths)

affects: [12-next-phase, any phase touching createRoom/joinRoom handlers]

# Tech tracking
tech-stack:
  added:
    - bad-words@3.0.4 (CJS profanity filter; v3.x chosen over v4.0.0 due to Node 24 ESM/CJS incompatibility)
  patterns:
    - Module-scope filter instantiation: const BadWordsFilter = require('bad-words'); const profanityFilter = new BadWordsFilter()
    - Guard clause after trim/slice: if (profanityFilter.isProfane(name)) return socket.emit('room:error', 'Player name is not allowed')
    - Profanity check before room lookup in joinRoom — profane names rejected even if room does not exist

key-files:
  created: []
  modified:
    - server/package.json
    - server/package-lock.json
    - server/src/socket.js
    - server/src/socket.test.js

key-decisions:
  - "bad-words@3.0.4 installed instead of v4.0.0: v4.0.0 sets type:module in package.json which breaks require() under Node 24; v3.0.4 is pure CJS"
  - "joinRoom profanity check placed before getLobby() — profane names rejected before room existence is checked (prevents room enumeration side effect)"
  - "socket.join stub added to makeMocks — createRoom/joinRoom success paths call socket.join; mock was missing this stub"

patterns-established:
  - "Pattern: Guard clauses in socket handlers run in order: type check -> empty check -> profanity check -> business logic"

requirements-completed: [PROF-01]

# Metrics
duration: 3min
completed: 2026-04-06
---

# Phase 11 Plan 01: Profanity Filter Summary

**bad-words@3.0.4 profanity guard added to createRoom and joinRoom socket handlers with 4 passing test cases**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-06T16:57:54Z
- **Completed:** 2026-04-06T17:01:01Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Installed bad-words@3.0.4 as server dependency (CJS-compatible with Node 24)
- Added profanityFilter.isProfane(name) guard to both createRoom and joinRoom handlers — profane names emit room:error "Player name is not allowed"
- Added 4 test cases: createRoom rejects profane/accepts clean, joinRoom rejects profane/accepts clean — all pass
- Fixed missing socket.join stub in makeMocks test helper (Rule 1 auto-fix)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install bad-words and add profanity guard clauses to socket.js** - `d385593` (feat)
2. **Task 2: Add 4 profanity filter test cases to socket.test.js** - `ad778e2` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `server/package.json` - Added bad-words@^3.0.4 to dependencies
- `server/package-lock.json` - Lock file updated with bad-words and badwords-list
- `server/src/socket.js` - Added BadWordsFilter require + instantiation at module scope; isProfane guard in createRoom and joinRoom
- `server/src/socket.test.js` - Added 4 profanity filter test cases; added socket.join stub to makeMocks helper

## Decisions Made
- **bad-words@3.0.4 over v4.0.0:** v4.0.0 has `"type": "module"` in its package.json which causes Node 24 to treat the CJS dist files as ESM, breaking `require()`. v3.0.4 is pure CJS with no `type` field — confirmed working via `node -e`.
- **joinRoom check before getLobby:** Per CONTEXT.md locked decision — profanity check fires before room lookup so profane names are rejected regardless of room existence.
- **socket.join stub added to makeMocks:** The mock socket object lacked a join() stub. createRoom and joinRoom both call socket.join() on success path. Added `join: () => {}` to makeMocks (Rule 1 auto-fix — bug in test infrastructure).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed bad-words@3.0.4 instead of v4.0.0**
- **Found during:** Task 1 (Install bad-words)
- **Issue:** bad-words v4.0.0 has `"type": "module"` in package.json which causes Node 24 to fail CJS require() with "Cannot find module './badwords.js'"
- **Fix:** Uninstalled v4.0.0, installed v3.0.4 which is pure CJS; verified via `node -e "const F = require('bad-words'); const f = new F(); console.log(f.isProfane('ass'))"`
- **Files modified:** server/package.json, server/package-lock.json
- **Verification:** `node -e` outputs `true` — PASS
- **Committed in:** d385593 (Task 1 commit)

**2. [Rule 1 - Bug] Added socket.join stub to makeMocks test helper**
- **Found during:** Task 2 (Add profanity tests)
- **Issue:** Clean-name tests for createRoom and joinRoom failed with "TypeError: socket.join is not a function" — the mock socket object was missing a join() stub
- **Fix:** Added `join: () => {}` to the socket mock inside makeMocks function
- **Files modified:** server/src/socket.test.js
- **Verification:** All 24 socket tests pass after fix
- **Committed in:** ad778e2 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes required for correct operation. No scope creep. The socket.join fix also benefits any future test that exercises createRoom/joinRoom success paths.

## Issues Encountered
- bad-words v4.0.0 ESM/CJS conflict on Node 24 — resolved by using v3.0.4 (pure CJS, same API surface)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Profanity filter complete and tested. Phase 11 has only 1 plan — phase is done.
- All 24 socket tests + 69 game tests pass. No regressions.
- Phase 12 can proceed.

---
*Phase: 11-profanity-filter*
*Completed: 2026-04-06*

## Self-Check: PASSED

- FOUND: .planning/phases/11-profanity-filter/11-01-SUMMARY.md
- FOUND: server/src/socket.js (contains 2x isProfane)
- FOUND: server/src/socket.test.js (contains profanity test cases)
- FOUND: server/package.json (contains bad-words)
- FOUND: commit d385593 (Task 1)
- FOUND: commit ad778e2 (Task 2)
