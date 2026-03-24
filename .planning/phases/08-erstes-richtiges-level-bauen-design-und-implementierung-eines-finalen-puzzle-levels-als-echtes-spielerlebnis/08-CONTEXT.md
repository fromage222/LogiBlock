# Phase 8: Erstes richtiges Level bauen - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Design and ship the first real playable puzzle level ("Level 1") and activate the already-built puzzle selection system in the lobby. Level 1 uses the existing 5×9 grid with 3 anchor pieces and 7 movable pieces. Only puzzles with a `difficulty` field appear in the host's selection dropdown — old test puzzles (puzzle_01, puzzle_02, puzzle_v11) stay in the repo but are hidden from the UI.

</domain>

<decisions>
## Implementation Decisions

### Grid shape
- Keep the current 5×9 grid with exactly 2 missing corner cells (`inactiveCells: [[4,0],[4,8]]`)
- No infrastructure changes to grid size or shape

### Piece design
- Keep the current 10 piece shapes (P01–P10) exactly as they are
- Level 1 uses a new solution layout (provided by user as screenshot/image)
- 3 pieces are pre-placed as anchors (`"movable": false`, with `"position"` coordinates)
- 7 pieces remain movable (start in the bank)

### Level difficulty and naming
- Level file: `puzzles/level_01.json`
- `"name": "Level 1"` (or similar short name — Claude can tune based on layout feel)
- `"difficulty": "easy"` in the JSON
- German display in dropdown: `"Level 1 — Einfach"`

### Puzzle selection filtering
- Only puzzles with a `difficulty` field appear in the lobby dropdown
- `getPuzzleListForClient()` filters to `puzzles WHERE difficulty != null`
- `createLobby()` selects the first puzzle WITH a `difficulty` field as default (not just first in map)
- Old test puzzles (puzzle_01, puzzle_02, puzzle_v11) remain on disk but are hidden from players

### Puzzle selection UI (already largely built)
- Host sees `#puzzle-select` dropdown (already inside `#host-controls`, already hidden for non-hosts)
- Dropdown shows `"Name — Difficulty"` format (e.g., "Level 1 — Einfach")
- Non-hosts see `#selected-puzzle-display` text (already implemented, shows `selectedPuzzleName`)
- `lobby:selectPuzzle` socket handler already exists with host-only guard
- `getPublicState()` already includes `selectedPuzzleName` — extend to also include `selectedPuzzleDifficulty`

### Difficulty string values
- German display labels: `"easy"` → "Einfach", `"medium"` → "Mittel", `"hard"` → "Schwer"
- Mapping lives in client (not server) — server stores the raw `difficulty` string from JSON

### Schema changes
- `validatePuzzleSchema()` accepts optional `"difficulty"` field (string, if present)
- `getPuzzleListForClient()` returns `{ id, name, difficulty }` (difficulty may be null/undefined for test puzzles — excluded from filtered list)

### Claude's Discretion
- Exact puzzle name (the flavor/thematic name for Level 1, based on layout)
- Whether `getPublicState()` passes difficulty via a new field or piggybacks on existing `selectedPuzzleName` (e.g., "Level 1 — Einfach" combined string)
- Internal difficulty label mapping location (constants object in client or inline switch)

</decisions>

<specifics>
## Specific Ideas

- User already has the complete Level 1 layout designed (piece positions and 3 anchor locations)
- Layout will be provided as screenshot/image before planning begins
- The puzzle must be mathematically valid: 3 anchor cells + 7 movable piece cells = 43 active cells total
- "Es gibt immer Anker" — anchors are a standard feature of all future levels, not just Level 1

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets (already fully built — minimal new code needed)
- `#puzzle-select` dropdown (`client/index.html:65`) — exists, wired to `lobby:selectPuzzle`
- `socket.on('puzzle:list', ...)` (`client/main.js:554-559`) — already populates dropdown; only needs `difficulty` added to option text
- `socket.emit('puzzle:list', getPuzzleListForClient())` (`server/src/socket.js:51,87`) — already emitted on create and join
- `socket.on('lobby:selectPuzzle', ...)` (`server/src/socket.js:95-110`) — complete with host guard
- `setSelectedPuzzle()` (`server/src/game.js:352`) — already works
- `getPuzzleListForClient()` (`server/src/game.js:214-221`) — exists; needs: filter by difficulty + add difficulty to output
- `getPublicState()` (`server/src/game.js:174`) — already includes `selectedPuzzleName`; extend for difficulty
- `buildInitialGrid()` (`server/src/game.js:235`) — already places anchor shapes from `position` field
- `validatePuzzleSchema()` (`server/src/game.js:257`) — already validates anchors; add optional `difficulty` field

### Established Patterns
- Anchor pieces: `{ "id": "X", "cells": [...], "movable": false, "position": [row, col] }` — see puzzle_01.json and puzzle_02.json
- Puzzle JSON schema: `id`, `name`, `gridSize`, `inactiveCells`, `shapes`, `solution`
- `movable: false` + `position` → `buildInitialGrid()` pre-places the piece at game start
- `createLobby()` sets `selectedPuzzleId` to `puzzleMap.keys().next().value` — must update to pick first WITH difficulty

### Integration Points
- `loadPuzzles()` loads all `.json` files from `puzzles/` — no change needed here; filtering is at the `getPuzzleListForClient()` layer
- `createLobby()` in game.js line 31 — update `firstPuzzleId` selection logic to skip test puzzles
- `getPublicState()` — add `selectedPuzzleDifficulty` to the returned object
- `renderLobbyUpdate()` in client (line ~157) — non-host display may need to show difficulty alongside puzzle name

</code_context>

<deferred>
## Deferred Ideas

- Puzzle-Editor in-game — bereits explizit als Out of Scope definiert (REQUIREMENTS.md)
- Weitere Levels (Level 2, Level 3, ...) — nächste Phase(n); Phase 8 liefert nur Level 1
- Difficulty-Anzeige während des Spiels (z.B. Badge im Header) — deferred, kein Scope für Phase 8
- Puzzle-Vorschau-Thumbnail in der Auswahl — deferred, "Nur Liste/Dropdown" ist die Entscheidung

</deferred>

---

*Phase: 08-erstes-richtiges-level-bauen-design-und-implementierung-eines-finalen-puzzle-levels-als-echtes-spielerlebnis*
*Context gathered: 2026-03-24*
