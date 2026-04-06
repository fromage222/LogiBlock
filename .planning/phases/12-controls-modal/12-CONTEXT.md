# Phase 12: Controls Modal - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Add an info button to `#game-screen` that opens a closable `<dialog>` modal listing all Phase 10 controls (desktop + touch). Pure client-side — no socket events, no game state changes. Closing the modal returns the player to the game exactly as it was.

</domain>

<decisions>
## Implementation Decisions

### Info Button
- **Symbol:** `?` (question mark character in a circle-button style)
- **Position:** Fixed overlay at the **top-right corner of `#game-screen`** (`position: absolute` within `#game-screen`)
- **Must not overlap** with the global theme toggle button (`position: fixed; top: sp-md; right: sp-md; z-index: 999`) — position info button slightly below or offset so both are reachable

### Modal Content Structure
- **Two sections:** "Tastatur & Maus" (Desktop) and "Touch" — separate blocks, not a flat list
- **Language:** German throughout — consistent with all other game UI strings
- **Detail level:** Long entries — each control gets a full description with context, e.g.:
  - "Klick auf eine freie Zelle: Platziert den ausgewählten Stein an dieser Position."
  - "Klick auf einen platzierten Stein (kein Stein ausgewählt): Gibt den Stein zurück in die Bank."
  - "Langer Druck (~500ms) auf platzierten Stein: Gibt Stein zurück in die Bank (Touch-Äquivalent)."

### Controls to Document (Phase 10 complete set)
**Desktop section:**
- Klick auf Stein in der Bank → Stein auswählen
- Klick auf freie Zelle → Stein platzieren
- Klick auf platzierten Stein (ohne Auswahl) → Stein zurück in Bank
- Taste R / Rotation-Buttons ↺ ↻ → Stein drehen

**Touch section:**
- Tippen auf Stein in der Bank → Stein auswählen
- Finger auf Bank-Stein halten + über Grid ziehen → Ghost-Vorschau folgt dem Finger
- Finger heben → Ghost bleibt stehen (Stein noch nicht platziert)
- Tippen auf Ghost-Zelle → Stein platzieren
- Langer Druck (~500ms) auf platzierten Stein → Stein zurück in Bank
- Finger vom Grid ziehen → Stein abwählen

### Close Behavior
- X-Button im Modal → schließt Modal
- Escape-Taste → schließt Modal (handled via `keydown` listener or native `<dialog>` behavior)
- Klick auf den Backdrop (außerhalb des Modal-Inhalts) → schließt Modal
- Opening/closing emits **no socket events** and does **not affect game state**
- Timer continues running while modal is open — purely informational overlay

### Visual Style
- Use `var(--clr-surface)`, `var(--clr-text)`, `var(--clr-border)` for all modal colors → automatically works in both light and dark mode
- Subtle dim backdrop: `rgba(0, 0, 0, 0.2)` — light overlay, game content still vaguely visible behind
- Modal card style should match existing `.card` / `.win-card` patterns (border, box-shadow, border-radius from design tokens)

### Claude's Discretion
- Exact CSS sizing of the modal (width, max-height, overflow scroll)
- Visual style of the `?` button (size, hover/active states — consistent with rotation buttons)
- Whether to use native `<dialog>.showModal()` / `.close()` API or manually toggle visibility
- Exact `z-index` layering (ensure modal is above `#game-screen` content but below or equal to theme toggle)
- Exact section header styling (e.g. `<h3>`, bold `<p>`, or `<strong>`)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 10 controls (source of modal content)
- `.planning/phases/10-steuerung-berarbeiten-und-tablet-integration/10-CONTEXT.md` — Defines all Phase 10 controls: single-click-to-place, rotation buttons, R key, touch drag-to-preview, ghost-confirm, long-press return — the complete list the modal must document

### Existing HTML structure
- `client/index.html` — Current `#game-screen` structure (h2#game-title, .turn-banner, .game-timer, .game-area) — info button placement target

### Roadmap plan spec
- `.planning/ROADMAP.md` §"Phase 12: Controls Modal" — Success criteria and plan spec

No external design specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `.win-card` (index.html / style.css) — existing modal-like card style with border/shadow; same visual language for the controls dialog
- `.theme-toggle` button (style.css:776) — existing circle-button pattern with hover/active states; `?` button should match this style
- Existing `keydown` listener in main.js (line ~620) — already handles `R` key; add `Escape` → `dialog.close()` here when game screen is active
- `body.dark-mode` CSS variable overrides (style.css:747) — using `var(--clr-surface)`, `var(--clr-text)`, `var(--clr-border)` in modal CSS ensures automatic dark/light compatibility

### Established Patterns
- Theme toggle: `position: fixed; top: var(--sp-md); right: var(--sp-md); z-index: 999` — info button must not overlap; use `position: absolute` within `#game-screen` or offset below theme toggle
- Overlays (win-overlay, portrait-overlay) use `position: fixed` with `z-index` stacking — `<dialog>` element has built-in backdrop pseudo-element (`::backdrop`) for the dim
- German UI strings — all player-facing text in German

### Integration Points
- `client/index.html` — add `<dialog id="controls-modal">` and `<button id="controls-info-btn">` to `#game-screen`
- `client/main.js` — wire open (info button click) and close (X button, Escape, backdrop click) handlers
- `client/style.css` — add `#controls-modal`, `::backdrop`, and `#controls-info-btn` styles using CSS variables

</code_context>

<specifics>
## Specific Ideas

- "Man muss es im dark und white modus sehen können" — modal MUST be visible and readable in both dark and light mode → use CSS variables exclusively, no hardcoded colors

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 12-controls-modal*
*Context gathered: 2026-04-06*
