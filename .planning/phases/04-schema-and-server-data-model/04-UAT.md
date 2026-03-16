---
status: complete
phase: 04-schema-and-server-data-model
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md
started: 2026-03-16T20:00:00Z
updated: 2026-03-16T20:10:00Z
---

## Current Test

[testing complete]

## Tests

### 1. All unit tests pass
expected: From server/ dir, run `node --test src/game.test.js`. All tests pass (~52), 0 failures, exit code 0.
result: issue
reported: "Das Grid und die Steine sind falsch"
severity: major

### 2. "Corner Cut" puzzle loads
expected: From project root, run `node -e "const g = require('./server/src/game'); const ps = g.loadPuzzles(); console.log(ps.map(p => p.name));"`. Output shows 3 puzzle names including "Corner Cut".
result: issue
reported: "Das Grid lässt in der unteren Reihe nicht kannst rechts und links das feld weg. Auch sind die meisten steine falsch"
severity: major

### 3. Server starts with all 3 puzzles
expected: Run `node server/src/server.js`. Server starts cleanly, logs that 3 puzzles are loaded (including "Corner Cut"), no errors or crashes.
result: pass

### 4. Inactive cells marked in grid
expected: From server/, run `node -e "const {buildInitialGrid, getPuzzleById} = require('./src/game'); const p = getPuzzleById('puzzle_v11'); const g = buildInitialGrid(p); console.log(g[4][7], g[4][8]);"`. Output shows `{ inactive: true } { inactive: true }` for the two corner cells.
result: issue
reported: "die ecken sind nicht inactive. bzw. sie sollen gar nicht gezeigt werden"
severity: major

## Summary

total: 4
passed: 1
issues: 3
pending: 0
skipped: 0

## Gaps

- truth: "All unit tests pass with correct grid and piece definitions"
  status: failed
  reason: "User reported: Das Grid und die Steine sind falsch"
  severity: major
  test: 1
  artifacts: []
  missing: []

- truth: "puzzle_v11.json has correct inactive cell cutout (bottom-right two cells) and correct piece definitions"
  status: failed
  reason: "User reported: Das Grid lässt in der unteren Reihe nicht kannst rechts und links das feld weg. Auch sind die meisten steine falsch"
  severity: major
  test: 2
  artifacts: []
  missing: []

- truth: "buildInitialGrid marks inactiveCells positions with { inactive: true } so client can hide them"
  status: failed
  reason: "User reported: die ecken sind nicht inactive. bzw. sie sollen gar nicht gezeigt werden"
  severity: major
  test: 4
  artifacts: []
  missing: []
