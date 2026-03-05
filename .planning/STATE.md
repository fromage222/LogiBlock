# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-01)

**Core value:** Die Lösung liegt ausschließlich auf dem Server — jeder Zug wird serverseitig validiert, kein Client sieht die Lösung, kein Cheat ist möglich.
**Current focus:** Phase 2 — Game Loop

## Current Position

Phase: 2 of 3 (Game Loop)
Plan: 4 of 5 in current phase
Status: Active — 02-04 complete, proceeding to 02-05
Last activity: 2026-03-05 — Completed 02-04 (Client Game Loop)

Progress: [███████░░░] 63%

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (02-04 complete)
- Average duration: 5 min
- Total execution time: 0.57 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 3 | 20 min | 6.7 min |
| 02-game-loop | 4 | 20 min | 5 min |

**Recent Trend:**
- Last 5 plans: 01-03 (3 min), 02-01 (3 min), 02-02 (5 min), 02-03 (4 min), 02-04 (8 min)
- Trend: Stable

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Lösung nur server-seitig: `getPublicState()` ist der einzige Serialisierungspfad — muss in Phase 1 als Tag-1-Invariante implementiert werden.
- Vanilla JS (kein Framework): Kein Build-Tooling; Socket.IO-Client kommt per CDN.
- Puzzles als JSON-Dateien: PuzzleLoader validiert Schema beim Start; Lösung nie an Client übertragen.
- Socket.IO für Echtzeit: Room-Name = Lobby-Code; kein custom Room-Abstraktionslayer nötig.
- **CommonJS (require) über ESM** (01-01): Kein Build-Tooling; einfacheres `__dirname`; kein `fileURLToPath`-Workaround nötig.
- **`getPublicState()` als einziger Serialisierungspfad** (01-01): GAME-06 Invariante von Tag 1 umgesetzt — `solution` wird nie im Outbound-Payload mitgeschickt.
- **`process.exit(1)` bei null validen Puzzles** (01-01): Server startet nicht in kaputtem Zustand.
- **`'disconnecting'` statt `'disconnect'`** (01-02): socket.rooms noch befüllt beim disconnecting-Event — zuverlässige Room-Identifikation ohne Extra-State.
- **Host-Disconnect zerstört Lobby** (01-02): Kein Host-Transfer in Phase 1; `lobby:hostLeft` an verbleibende Spieler; kein Re-Join möglich.
- **`room:error` als einziger Fehler-Event** (01-02): Konsistentes Client-seitiges Error-Handling; kein separater Popup-Event.
- **`amIHost` via Namensvergleich** (01-03): socket.id ändert sich bei Reconnect — playerName als stabile Identität im Client-State.
- **`lobby:update` steuert Start→Lobby-Transition für Joiner** (01-03): Kein separater Event nötig; einfachere Event-Oberfläche.
- **CSS `.screen`/`.screen.active` Pattern** (01-03): `display:none` via CSS statt JS — showScreen() nur für Klassentoggle.
- **Anchor-Erkennung via `movable===false`** (01-03): Passt exakt zur `getPublicState()`-Ausgabe-Form — kein zusätzliches Feld nötig.
- **`advanceTurnIfActive` vor `removePlayer` aufrufen** (02-01): Reihenfolge entscheidend — disconnectingIndex muss noch gültig sein wenn die Index-Anpassungslogik läuft.
- **`checkWin` exportiert aber nur intern aufgerufen** (02-01): Testbarkeit ohne Sicherheitsrisiko — solution-Objekt verlässt nie den Server.
- **`before()` Hook für `loadPuzzles()` in Tests** (02-01): Kein module-level side-effect; saubere Trennung zwischen Test-Setup und Code-Modulinitalisierung.
- **Win overlay außerhalb #game-screen** (02-02): display:none-Vererbung vom .screen-Pattern vermieden — JS kann overlay unabhängig vom Screen-Status ein-/ausblenden.
- **#game-screen max-width auf 900px** (02-02): Phase-2-Override appended am Ende von style.css — Bank-Panel passt ohne Overflow.
- **HTML-Contract-First Pattern** (02-02): Element-IDs in HTML definiert bevor main.js (Plan 04) sie abfragt — vermeidet "scavenger hunt"-Antipattern.
- **Mock-based socket tests** (02-03): makeMocks() fakt io/socket-Objekte — kein socket.io-client nötig; trigger() ruft Handler direkt auf.
- **Unknown action silently ignored** (02-03): Kein game:error für unbekannte Action-Strings — konsistent mit Phase-Guard und roomCode-Guard.
- **game:error gefiltert auf 'Not your turn'** (02-04): Placement-Errors lautlos — Server sendet game:stateUpdate der das Piece zurückschnappt; nur Turn-Violations inline anzeigen.
- **game-notification Element dynamisch per JS** (02-04): ensureGameNotification() ist idempotent — kein DOM-Contract-Coupling mit index.html nötig.
- **Bank-Preview immer canonical 0°** (02-04): buildMiniGrid zeigt immer unrotierte Cells — selectedRotation ist reiner Drag-State, nicht Preview-State.

### Pending Todos

None.

### Blockers/Concerns

- socket.id Reconnect: Akzeptierte Limitation für diesen Scope; in README dokumentieren.

## Session Continuity

Last session: 2026-03-05
Stopped at: Completed 02-04-PLAN.md (Client Game Loop)
Resume file: .planning/phases/02-game-loop/02-04-SUMMARY.md
