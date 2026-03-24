# Phase 8: Erstes richtiges Level bauen - Research

**Researched:** 2026-03-24
**Domain:** JSON puzzle authoring, server-side puzzle filtering, client lobby difficulty display
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Grid shape:** Keep the current 5x9 grid with exactly 2 missing corner cells (`inactiveCells: [[4,0],[4,8]]`). No infrastructure changes to grid size or shape.
- **Piece design:** Keep the current 10 piece shapes (P01-P10) exactly as they are. Level 1 uses a new solution layout. 3 pieces are pre-placed as anchors (`"movable": false`, with `"position"` coordinates). 7 pieces remain movable (start in the bank).
- **Level file:** `puzzles/level_01.json`
- **Level name:** `"name": "Level 1"` (or similar short name)
- **Difficulty value:** `"difficulty": "easy"` in the JSON
- **German display in dropdown:** `"Level 1 — Einfach"`
- **Puzzle selection filtering:** Only puzzles with a `difficulty` field appear in the lobby dropdown. `getPuzzleListForClient()` filters to puzzles WHERE difficulty != null. `createLobby()` selects the first puzzle WITH a `difficulty` field as default.
- **Old test puzzles:** puzzle_01, puzzle_02, puzzle_v11 remain on disk but are hidden from players.
- **Puzzle selection UI:** Already largely built. Host sees `#puzzle-select` dropdown. Dropdown shows `"Name — Difficulty"` format. Non-hosts see `#selected-puzzle-display` text showing `selectedPuzzleName`.
- **Difficulty string values:** German display labels: `"easy"` -> "Einfach", `"medium"` -> "Mittel", `"hard"` -> "Schwer". Mapping lives in client (not server).
- **Schema changes:** `validatePuzzleSchema()` accepts optional `"difficulty"` field (string, if present). `getPuzzleListForClient()` returns `{ id, name, difficulty }`.

### Claude's Discretion
- Exact puzzle name (the flavor/thematic name for Level 1, based on layout)
- Whether `getPublicState()` passes difficulty via a new field or piggybacks on existing `selectedPuzzleName` (e.g., "Level 1 — Einfach" combined string)
- Internal difficulty label mapping location (constants object in client or inline switch)

### Deferred Ideas (OUT OF SCOPE)
- Puzzle-Editor in-game — bereits explizit als Out of Scope definiert (REQUIREMENTS.md)
- Weitere Levels (Level 2, Level 3, ...) — nachste Phase(n); Phase 8 liefert nur Level 1
- Difficulty-Anzeige wahrend des Spiels (z.B. Badge im Header) — deferred, kein Scope fur Phase 8
- Puzzle-Vorschau-Thumbnail in der Auswahl — deferred, "Nur Liste/Dropdown" ist die Entscheidung
</user_constraints>

---

## Summary

Phase 8 is a focused content and plumbing phase. The core deliverable is a single JSON file (`puzzles/level_01.json`) representing the first real playable puzzle, plus three small surgical code changes that activate the already-built puzzle selection system. No new UI screens, no new socket events, no new game mechanics.

The three code changes are: (1) extend `getPuzzleListForClient()` to filter by presence of `difficulty` and return `difficulty` in the output; (2) extend `getPublicState()` to surface difficulty so the lobby can display it; (3) update the client's `puzzle:list` handler to format dropdown option text as `"Name — Einfach"` and update the non-host display to show difficulty alongside the name. A fourth supporting change updates `createLobby()` to default-select the first puzzle that has a `difficulty` field rather than blindly picking the first map entry.

The puzzle JSON itself is the most substantial task. It must satisfy: 3 anchor pieces (movable: false, with position), 7 movable pieces, `inactiveCells: [[4,0],[4,8]]`, and a complete `solution` matrix where total cells across all shapes equals the 43 active cells in the 5x9 grid. The layout will be provided by the user; the researcher's job is to document the exact JSON structure and validation constraints so the planner can describe the authoring task precisely.

**Primary recommendation:** Author `puzzles/level_01.json` first (it is the anchor of all other work), then make the three surgical server/client code changes in a single plan or two small plans.

---

## Standard Stack

### Core
| Component | Version / Location | Purpose | Why Standard |
|-----------|-------------------|---------|--------------|
| Node.js `fs.readFileSync` | Built-in | Load puzzle JSON at server start | Already in use via `loadPuzzles()` |
| JSON puzzle file | `puzzles/level_01.json` | Level data (shapes, solution, anchors) | Established pattern from puzzle_01.json and puzzle_v11.json |
| `validatePuzzleSchema()` | `server/src/game.js:257` | Validate puzzle at load time | Already validates anchors, inactiveCells, cell counts |
| `buildInitialGrid()` | `server/src/game.js:226` | Pre-place anchor pieces at game start | Already reads `movable: false` + `position` field |
| `getPuzzleListForClient()` | `server/src/game.js:214` | Send filtered puzzle list to client | Already emitted on createRoom and joinRoom |
| `getPublicState()` | `server/src/game.js:174` | Broadcast lobby/game state | Already includes `selectedPuzzleName` |

### No New Dependencies
This phase requires zero new npm packages. All changes are within existing files.

---

## Architecture Patterns

### Puzzle JSON Schema (Current)
```json
{
  "id": "puzzle_v11",
  "name": "Corner Cut",
  "gridSize": { "rows": 5, "cols": 9 },
  "inactiveCells": [[4,0],[4,8]],
  "shapes": [
    { "id": "P01", "cells": [[0,0],[0,1],[0,2]], "movable": true },
    { "id": "P01", "cells": [[0,0]], "movable": false, "position": [2, 3] }
  ],
  "solution": [
    ["P01","P02","P03","P04","P05","P06","P07","P08","P09"],
    ...
    [null, "P02","P03","P04","P05","P06","P07","P08",null]
  ]
}
```

### Extended Schema for Level 1
The ONLY addition to the schema is the optional `"difficulty"` field:
```json
{
  "id": "level_01",
  "name": "Level 1",
  "difficulty": "easy",
  "gridSize": { "rows": 5, "cols": 9 },
  "inactiveCells": [[4,0],[4,8]],
  "shapes": [
    ...3 anchor shapes with movable:false and position...
    ...7 movable shapes without position...
  ],
  "solution": [
    [...9 entries per row, null for inactive cells...],
    [...],
    [...],
    [...],
    [null, ...7 entries..., null]
  ]
}
```

### Anchor Shape Pattern
```json
{
  "id": "P01",
  "cells": [[0,0],[0,1],[0,2]],
  "movable": false,
  "position": [0, 3]
}
```
- `cells` are relative offsets from `position` (same format as movable pieces)
- `position` is `[originRow, originCol]` — the top-left anchor point
- `buildInitialGrid()` reads this directly (no code change needed here)

### Movable Shape Pattern (unchanged)
```json
{
  "id": "P04",
  "cells": [[0,0],[0,1],[0,2],[1,1]],
  "movable": true
}
```
- No `position` field for movable pieces (they start in the bank)

### Mathematical Constraint
The puzzle is valid when:
```
sum(all shape cells) == active cells in grid
```
For 5x9 with `inactiveCells: [[4,0],[4,8]]`:
- Total cells: 5 * 9 = 45
- Inactive cells: 2
- Active cells: 43

Therefore: sum of ALL shape cells (anchors + movable) must equal 43.

This is validated by `validatePuzzleSchema()` Block 2 (line 292-298 in game.js):
```javascript
const totalShapeCells = puzzle.shapes.reduce((sum, s) => sum + s.cells.length, 0);
const activeSolutionCells = puzzle.solution.flat().filter(id => id !== null).length;
if (totalShapeCells !== activeSolutionCells) {
  throw new Error(`Shapes cover ${totalShapeCells} cells but solution has ${activeSolutionCells} active cells`);
}
```

**Critical:** This check is gated on `puzzle.inactiveCells !== undefined` — since level_01.json will include `inactiveCells`, the check WILL run. The puzzle JSON must be mathematically correct before the server can start.

### Solution Matrix Format
```
Row 0: 9 entries (all active)
Row 1: 9 entries (all active)
Row 2: 9 entries (all active)
Row 3: 9 entries (all active)
Row 4: 9 entries — position [4,0] and [4,8] must be null (inactive cells)
```
Each non-null entry is the shape ID of the piece that occupies that cell in the solution.

---

## Server Code Changes

### Change 1: `getPuzzleListForClient()` — filter + add difficulty

**Current (game.js:214-221):**
```javascript
function getPuzzleListForClient() {
  return Array.from(puzzleMap.values()).map(p => ({
    id: p.id,
    name: p.name,
  }));
}
```

**Required change:** Filter to puzzles with a `difficulty` field, add difficulty to output:
```javascript
function getPuzzleListForClient() {
  return Array.from(puzzleMap.values())
    .filter(p => p.difficulty != null)
    .map(p => ({
      id: p.id,
      name: p.name,
      difficulty: p.difficulty,
    }));
}
```
Confidence: HIGH — locked decision, trivial filter+map change.

### Change 2: `createLobby()` — default to first puzzle WITH difficulty

**Current (game.js:31):**
```javascript
const firstPuzzleId = puzzleMap.keys().next().value;
```

**Required change:** Skip test puzzles (no difficulty field):
```javascript
const firstPuzzleId = Array.from(puzzleMap.values()).find(p => p.difficulty != null)?.id
  ?? puzzleMap.keys().next().value;  // fallback: if no puzzle has difficulty, use first
```
Confidence: HIGH — locked decision. The fallback ensures the server doesn't crash if somehow no difficulty puzzles exist.

### Change 3: `getPublicState()` — add selectedPuzzleDifficulty

**Current (game.js:198-210):** Returns `selectedPuzzleName` but not difficulty.

**Required change:** Add `selectedPuzzleDifficulty` to the returned object:
```javascript
return {
  ...existingFields,
  selectedPuzzleName: puzzle ? puzzle.name : null,
  selectedPuzzleDifficulty: puzzle ? (puzzle.difficulty ?? null) : null,
  ...
};
```
Confidence: HIGH — locked decision.

### Change 4: `validatePuzzleSchema()` — accept optional difficulty field

The validator currently does not reject or accept `difficulty`. Since JSON objects silently carry extra fields in JavaScript and no explicit rejection occurs, this is effectively already compatible. However, for documentation clarity and future validation, a light check should be added:
```javascript
if (puzzle.difficulty !== undefined && typeof puzzle.difficulty !== 'string') {
  throw new Error('"difficulty" must be a string if present');
}
```
Confidence: HIGH — locked decision.

---

## Client Code Changes

### Change 5: `puzzle:list` handler — show difficulty in dropdown

**Current (main.js:553-561):**
```javascript
socket.on('puzzle:list', (puzzles) => {
  puzzleSelect.innerHTML = '';
  puzzles.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    puzzleSelect.appendChild(option);
  });
});
```

**Required change:** Format option text as `"Name — Einfach"`. The difficulty label mapping belongs in the client per locked decision:
```javascript
const DIFFICULTY_LABELS = {
  easy:   'Einfach',
  medium: 'Mittel',
  hard:   'Schwer',
};

socket.on('puzzle:list', (puzzles) => {
  puzzleSelect.innerHTML = '';
  puzzles.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    const label = p.difficulty ? DIFFICULTY_LABELS[p.difficulty] ?? p.difficulty : '';
    option.textContent = label ? `${p.name} — ${label}` : p.name;
    puzzleSelect.appendChild(option);
  });
});
```
Confidence: HIGH — locked decision.

### Change 6: `renderLobbyUpdate()` — non-host difficulty display

**Current (main.js:181-184):**
```javascript
if (state.selectedPuzzleName) {
  selectedPuzzleDisplay.textContent = `Selected puzzle: ${state.selectedPuzzleName}`;
  selectedPuzzleDisplay.style.display = 'block';
}
```

**Required change:** Include difficulty in the display. Two options per Claude's discretion:
- Option A: Use the new `selectedPuzzleDifficulty` field from `getPublicState()` and format in client.
- Option B: Piggyback on `selectedPuzzleName` by composing the combined string server-side.

**Recommendation (Option A — separate field):** Cleaner separation of concerns. Server sends raw values, client formats display. This is consistent with the locked decision that "mapping lives in client."

```javascript
if (state.selectedPuzzleName) {
  const diffLabel = state.selectedPuzzleDifficulty
    ? (DIFFICULTY_LABELS[state.selectedPuzzleDifficulty] ?? state.selectedPuzzleDifficulty)
    : '';
  const display = diffLabel
    ? `${state.selectedPuzzleName} — ${diffLabel}`
    : state.selectedPuzzleName;
  selectedPuzzleDisplay.textContent = `Ausgewahltes Puzzle: ${display}`;
  selectedPuzzleDisplay.style.display = 'block';
}
```
Confidence: HIGH — follows locked decision pattern.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Puzzle validation | Custom validator from scratch | Extend existing `validatePuzzleSchema()` | Already validates id, name, gridSize, shapes, solution, inactiveCells |
| Anchor pre-placement | New grid-init logic | Existing `buildInitialGrid()` | Already reads `movable: false` + `position` — zero changes needed |
| Cell count check | Manual counting | Existing Block 2 in `validatePuzzleSchema()` | Runs automatically when `inactiveCells` is present |
| Puzzle loading | New file loader | Existing `loadPuzzles()` | Picks up all `.json` files from `puzzles/` automatically |
| Filtering test puzzles from game play | Runtime filtering in socket handlers | Filter at `getPuzzleListForClient()` layer | Already the established pattern; test puzzles load but never appear in dropdown |

---

## Common Pitfalls

### Pitfall 1: Cell Count Mismatch in level_01.json
**What goes wrong:** The server crashes at startup with `Puzzle is unsolvable` if `totalShapeCells != 43`.
**Why it happens:** Every cell in every shape (anchor AND movable) counts toward the total. Easy to miscount when manually authoring JSON.
**How to avoid:** Before writing the final JSON, count: anchors cells + movable piece cells. Must sum to exactly 43.
**Warning signs:** Server exits immediately with `[PuzzleLoader] Skipping level_01.json: Shapes cover X cells but solution has 43 active cells`.

### Pitfall 2: Solution Matrix with Wrong null Positions
**What goes wrong:** `checkWin()` never triggers even when all pieces are placed, because the solution matrix has nulls in the wrong positions.
**Why it happens:** The grid has inactive cells at `[4,0]` and `[4,8]`. The solution row 4 must have `null` at columns 0 and 8. Any other null in the solution means that cell is intentionally empty — but with 43 active cells and 43 piece cells, there should be no other nulls.
**How to avoid:** Solution row 4 must be `[null, "PXX", "PXX", "PXX", "PXX", "PXX", "PXX", "PXX", null]`.

### Pitfall 3: Anchor Position Coordinates Are Origin, Not Center
**What goes wrong:** Anchor piece appears shifted on the grid.
**Why it happens:** `position` in the JSON is the `[originRow, originCol]` offset. The piece's `cells` array contains relative offsets FROM that origin. So if `position: [1, 2]` and `cells: [[0,0],[0,1]]`, the cells land at `[1,2]` and `[1,3]`.
**How to avoid:** Verify anchor placement visually: for each anchor, pick a corner cell of the piece at `[0,0]` in the cells array and set `position` to where that corner should appear on the grid.

### Pitfall 4: Movable Piece Cells in puzzleMap vs. Initial Grid
**What goes wrong:** A movable piece's canonical `cells` (from puzzleMap) do not match where the piece needs to go in the solution.
**Why it happens:** Movable pieces can be rotated at placement time. The `cells` in the JSON are always the 0-degree canonical form. The solution matrix records where each piece ID lands after rotation. `checkWin()` checks by shapeId, not by cell geometry — it trusts that `placePiece()` correctly wrote the shapeId into the grid cells.
**How to avoid:** When authoring the solution matrix, record which shapeId covers each cell. The rotation is handled at play time by the player — the puzzle author just needs to ensure a valid arrangement exists (i.e., one solution exists where all pieces fit).

### Pitfall 5: `createLobby()` Fallback If No Difficulty Puzzle Loaded
**What goes wrong:** If `level_01.json` fails to load (e.g., JSON syntax error), `createLobby()` with the updated logic might fall back to a test puzzle or crash.
**Why it happens:** The `find()` for difficulty returns `undefined` if no puzzle passes the filter.
**How to avoid:** The fallback `?? puzzleMap.keys().next().value` ensures at least one puzzle is selected. The server requires at least one valid puzzle to start (already enforced by `loadPuzzles()`).

### Pitfall 6: `puzzle:list` Dropdown Empty After Filter
**What goes wrong:** Host sees an empty dropdown — no puzzles to select.
**Why it happens:** `getPuzzleListForClient()` now filters to difficulty-only puzzles. If `level_01.json` didn't load (parse error, validation error), the filtered list is empty.
**How to avoid:** Test the server startup log: look for `[PuzzleLoader] Loaded "Level 1"`. If it says `Skipping level_01.json`, fix the JSON.

---

## Code Examples

### Complete level_01.json Template (structural skeleton)
```json
{
  "id": "level_01",
  "name": "Level 1",
  "difficulty": "easy",
  "gridSize": { "rows": 5, "cols": 9 },
  "inactiveCells": [[4,0],[4,8]],
  "shapes": [
    { "id": "P_ANCHOR_A", "cells": [...], "movable": false, "position": [r, c] },
    { "id": "P_ANCHOR_B", "cells": [...], "movable": false, "position": [r, c] },
    { "id": "P_ANCHOR_C", "cells": [...], "movable": false, "position": [r, c] },
    { "id": "P01", "cells": [...], "movable": true },
    { "id": "P02", "cells": [...], "movable": true },
    { "id": "P03", "cells": [...], "movable": true },
    { "id": "P04", "cells": [...], "movable": true },
    { "id": "P05", "cells": [...], "movable": true },
    { "id": "P06", "cells": [...], "movable": true },
    { "id": "P07", "cells": [...], "movable": true }
  ],
  "solution": [
    ["...", "...", "...", "...", "...", "...", "...", "...", "..."],
    ["...", "...", "...", "...", "...", "...", "...", "...", "..."],
    ["...", "...", "...", "...", "...", "...", "...", "...", "..."],
    ["...", "...", "...", "...", "...", "...", "...", "...", "..."],
    [null, "...", "...", "...", "...", "...", "...", "...", null]
  ]
}
```
Note: The 10 existing shapes (P01-P10 from puzzle_v11.json) are the canonical piece shapes. Level 1 uses 3 of them as anchors and 7 as movable — but the user may rename them within level_01.json. The `id` strings in the shapes array are local to each puzzle file; they need not match across puzzle files.

### Existing puzzle_01.json Anchor Pattern (reference)
```json
{
  "id": "A",
  "cells": [[0,0],[1,0],[2,0]],
  "movable": false,
  "position": [0, 0]
}
```
This places an L-tromino with its top cell at grid position [0,0].

### Recommended DIFFICULTY_LABELS Placement
```javascript
// client/main.js — near top of file with other constants
const DIFFICULTY_LABELS = {
  easy:   'Einfach',
  medium: 'Mittel',
  hard:   'Schwer',
};
```
This constant object is used in both `puzzle:list` handler and `renderLobbyUpdate()`. Place it once near the top-level constants, not inline in each handler.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — project has no test runner |
| Config file | None |
| Quick run command | Manual: `node server/src/game.js` or server start |
| Full suite command | Manual: start server, open browser, play through lobby |

### Phase Requirements -> Test Map
| Behavior | Test Type | How to Verify |
|----------|-----------|---------------|
| level_01.json loads without error | Smoke | Server startup log: `[PuzzleLoader] Loaded "Level 1"` |
| Dropdown shows only puzzles with difficulty | Manual | Host sees "Level 1 — Einfach", no test puzzles |
| createLobby() defaults to level_01 | Manual | On room create, dropdown pre-selects Level 1 |
| Non-host sees difficulty in lobby | Manual | Join as non-host, verify display text |
| Anchor pieces pre-placed on game start | Manual | Start game, verify 3 anchors visible and non-movable |
| 7 movable pieces in bank | Manual | Start game, verify bank shows 7 pieces |
| Puzzle is solvable (cell count = 43) | Automated (server validation) | Server startup: no validation error |

### Wave 0 Gaps
- No test infrastructure exists — all verification is manual or via server startup logs.
- The server's `validatePuzzleSchema()` acts as an automated gate: if level_01.json has wrong cell counts, the server will log an error and skip the file.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| All puzzles shown in dropdown | Only `difficulty`-tagged puzzles shown | Test puzzles hidden from players; clean UX |
| `firstPuzzleId = puzzleMap.keys().next().value` | First puzzle WITH difficulty field | Level 1 is the default; test puzzles don't hijack default |
| No difficulty in puzzle list | `{ id, name, difficulty }` returned | Dropdown can show formatted label |
| No difficulty in public state | `selectedPuzzleDifficulty` added | Non-host lobby display can show difficulty |

---

## Open Questions

1. **Exact Level 1 layout (piece positions and solution)**
   - What we know: User has the layout designed; it will be provided as screenshot/image before or during planning.
   - What's unclear: The specific cell coordinates for the 3 anchor pieces and the solution matrix — these cannot be derived without the image.
   - Recommendation: The planner should describe the JSON authoring task with a placeholder ("fill in from user-provided layout image") or the user provides the image before the first plan is written. The solution matrix must be manually derived from the visual layout.

2. **Anchor piece IDs: use P01-P10 naming or new IDs?**
   - What we know: puzzle_01.json uses single-letter IDs ("A", "B", "C"). puzzle_v11.json uses "P01"-"P10". Each puzzle file's IDs are local.
   - What's unclear: Whether the user wants the 3 anchors to be labeled as e.g. "A1", "A2", "A3" (anchor-style) or as "P01", "P02", "P03" (continuing the Pxx convention).
   - Recommendation: Use "A", "B", "C" for anchors (visually distinct from movable pieces, consistent with puzzle_01.json pattern) and "P01"-"P07" for movable pieces.

---

## Implementation Plan Summary

This phase has exactly 4 surgical changes plus 1 JSON file:

| Task | File | Change Size |
|------|------|-------------|
| Create `puzzles/level_01.json` | new file | ~50 lines |
| Update `getPuzzleListForClient()` | `server/src/game.js` | +3 lines |
| Update `createLobby()` | `server/src/game.js` | +2 lines |
| Update `getPublicState()` | `server/src/game.js` | +1 line |
| Update `validatePuzzleSchema()` | `server/src/game.js` | +3 lines |
| Update `puzzle:list` handler | `client/main.js` | +5 lines |
| Update `renderLobbyUpdate()` | `client/main.js` | +4 lines |
| Add `DIFFICULTY_LABELS` constant | `client/main.js` | +5 lines |

**Recommended plan split:**
- Plan 08-01: Create `level_01.json` + server changes (game.js)
- Plan 08-02: Client changes (main.js — dropdown format, non-host display, constant)

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `server/src/game.js` — all function signatures, logic, and line numbers verified
- Direct code inspection of `client/main.js` — all socket handlers and rendering functions verified
- Direct reading of `puzzles/puzzle_01.json` and `puzzles/puzzle_v11.json` — exact JSON schema confirmed
- `08-CONTEXT.md` — all locked decisions transcribed verbatim

### Secondary (MEDIUM confidence)
- `REQUIREMENTS.md` — v1.1 requirement traceability, Out of Scope table
- `STATE.md` — accumulated project decisions and context

### Tertiary (LOW confidence)
- None — all findings verified against source code directly.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified by reading actual source files
- Architecture patterns: HIGH — derived from working code in game.js
- JSON schema: HIGH — derived from existing puzzle JSON files
- Pitfalls: HIGH — derived from actual validator logic in game.js:292-298
- Client changes: HIGH — derived from actual handler code in main.js

**Research date:** 2026-03-24
**Valid until:** Until any of game.js, main.js, or the puzzle loader logic is changed (stable for 60+ days given project scope)
