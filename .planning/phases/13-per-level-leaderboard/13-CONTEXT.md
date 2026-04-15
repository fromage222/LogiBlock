# Phase 13: Per-Level Leaderboard - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Add per-puzzle tab filtering to the existing start-screen leaderboard. The server already emits all entries with a `puzzleName` field — the client derives tabs from that and filters the table view client-side. No server changes, no new socket events, no new socket handlers.

</domain>

<decisions>
## Implementation Decisions

### Tab Visual Style
- Underline tab bar above the leaderboard table — active tab has a colored bottom border using `var(--clr-primary)`
- Tab labels: puzzle name only (what the server already stores in `puzzleName`, e.g. "Level 1 — Einfach")
- No "Alle" tab — strictly per-puzzle tabs only

### Puzzle Name Column in Filtered View
- Hide the "Puzzle Name" column when any tab is active (every row shows the same puzzle — column is redundant)
- Table in filtered view becomes: **# | Zeit | Spieler** (3 columns)
- The `colspan` on the empty-state `<td>` must update accordingly (3 instead of 4)

### Default Tab
- Default tab = puzzle with the most recent entry (per roadmap SC #3); alphabetically first if tied
- Tabs are ordered by their first/most-recent entry, or alphabetically — Claude's discretion on exact ordering logic

### Empty State (no entries yet)
- Keep existing behavior: table structure visible, `#leaderboard-body` shows "No games completed yet" placeholder row
- No tabs shown when there are no entries

### Language
- All tab labels and UI strings in German — consistent with existing game UI

### Claude's Discretion
- Exact tab CSS (sizing, spacing, font weight, hover/active/selected states)
- Whether tabs are rendered in `#leaderboard-section` HTML or injected by `renderLeaderboard()`
- How the active tab state is tracked (module-level variable vs. data attribute)
- Exact ordering of tabs when multiple puzzles exist

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing leaderboard structure
- `client/index.html` §`#leaderboard-section` — current table HTML with `#leaderboard-body`, 4 columns (#, Puzzle, Zeit, Spieler)
- `client/main.js` §`renderLeaderboard` (line ~805) — function to modify; receives full sorted entry array from server
- `client/style.css` §LEADERBOARD (line ~680) — `.leaderboard-section`, `.leaderboard-table`, `.leaderboard-time`, `.leaderboard-empty` — existing styles to extend

### Roadmap spec
- `.planning/ROADMAP.md` §"Phase 13: Per-Level Leaderboard" — Success criteria and plan spec (4 criteria)

No external design specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `renderLeaderboard(entries)` (`main.js:805`) — receives `[{ rank, puzzleName, time, playerNames }]`; this is the only function to modify
- `.leaderboard-table` CSS (style.css:695) — existing table styles; tab bar sits above this, no table structure changes needed for tabs themselves
- `var(--clr-primary)`, `var(--clr-surface-alt)`, `var(--clr-border)` — design tokens available for tab active/hover states

### Established Patterns
- German UI strings throughout — all player-facing labels in German
- CSS variables only for colors — `var(--clr-*)` tokens ensure automatic dark/light mode support
- Vanilla JS, no framework — tab state managed with plain JS (click handlers, class toggling)
- `leaderboard:update` socket event delivers full unsorted-by-puzzle array; client derives tabs from unique `puzzleName` values

### Integration Points
- `socket.on('leaderboard:update', (entries) => renderLeaderboard(entries))` (`main.js:931`) — only call site; no change needed here
- `#leaderboard-section` in `index.html` — tab bar DOM injected by `renderLeaderboard()` (or added statically if preferred)
- Server: `getLeaderboard()` already pre-formats `time` as MM:SS and includes `puzzleName`; structure unchanged

</code_context>

<specifics>
## Specific Ideas

No specific references — open to standard approaches for the tab bar UI.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 13-per-level-leaderboard*
*Context gathered: 2026-04-06*
