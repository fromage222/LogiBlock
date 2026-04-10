# LogiBlock

## Current Milestone: v1.2 Spielqualität & Features

**Goal:** Spielerfahrung verbessern: Random-Mode verrückter machen, Steuerungserklärung, Level-spezifische Ranglisten, Reconnect nach Disconnect und Profanity-Filter.

**Target features:**
- Random-Mode Overhaul: mehr Event-Typen, besseres Balancing, wildere Effekte
- Steuerungserklärung: Info-Button im Game-Screen öffnet Modal
- Level-Ranglisten: eigener Leaderboard-Screen mit Bestenliste pro Puzzle
- Reconnect: Spieler können bei Verbindungsabbruch (30s) zur Lobby zurückkehren
- Profanity-Filter: npm-Paket blockiert unerwünschte Spielernamen

## What This Is

LogiBlock ist ein kooperatives Multiplayer-Puzzlespiel, bei dem Spieler gemeinsam eigens definierte Formen aus einer geteilten Bank in ein Grid legen, bis es lückenlos gefüllt ist. Das Spiel ist rundenbasiert — jeder Spieler macht genau einen Zug pro Runde. Ein Live-Timer misst die Teamlösungszeit; eine Session-Rangliste zeigt alle bisherigen Bestzeiten. Das Projekt ist eine Uni-Abgabe.

## Core Value

Die Lösung liegt ausschließlich auf dem Server — jeder Zug wird serverseitig validiert, kein Client sieht die Lösung, kein Cheat ist möglich.

## Requirements

### Validated (v1.0)

- ✓ Spieler können per Room-Code einem Spiel beitreten — v1.0 (LOBB-01, LOBB-02)
- ✓ Server unterstützt gleichzeitige Lobbys (in-memory Map, unbegrenzt) — v1.0 (GAME-09, GAME-10)
- ✓ Grid wird mit 1–2 fixen Anker-Formen initialisiert — v1.0 (PUZZ-01, PUZZ-02)
- ✓ Restliche Formen liegen in einer geteilten Bank — v1.0 (GAME-03, GAME-04)
- ✓ Rundenlogik: klare Zugreihenfolge, aktiver Spieler sichtbar markiert — v1.0 (GAME-01, GAME-02)
- ✓ Pro Zug genau eine Aktion: Form legen ODER Form zurück in Bank — v1.0 (GAME-03, GAME-04)
- ✓ Alle Züge werden serverseitig gegen die hinterlegte Lösung validiert — v1.0 (GAME-05, GAME-06)
- ✓ Gewinnbedingung: Grid vollständig korrekt gefüllt → Win-Screen für alle — v1.0 (WIN-01, WIN-02)
- ✓ Puzzles sind als JSON-Dateien vordesignt und werden beim Serverstart validiert — v1.0 (PUZZ-01)
- ✓ Live-Timer misst Teamlösungszeit (startet bei Spielstart, stoppt bei Sieg) — v1.0 (TIME-01, TIME-02, TIME-03)
- ✓ Session-Rangliste auf dem Start-Screen zeigt alle Bestzeiten; leer nach Server-Neustart — v1.0 (TIME-04, TIME-05)

### Validated (v1.1)

- ✓ Unregelm. Grid-Form (5×9, untere Ecken fehlen) serverseitig und clientseitig unterstützt — v1.1 (GRID-*)
- ✓ 10 eigene Steine mit 3–5 Feldern in Puzzle-JSON definiert und validiert — v1.1 (PIEC-*)
- ✓ Single-Click platziert, Rotation per Buttons/R-Taste, Ghost-Preview — v1.1 (CTRL-*)
- ✓ Random-Mode: Chaos-Events während des Spiels (Stein rotieren, Zug überspringen, etc.) — v1.1 (RND-*)
- ✓ CSS Auto-Scaling + Portrait-Overlay für responsive Layout — v1.1 (CSS-*)
- ✓ Touch/Tablet-Support: Drag-Preview, Ghost-Confirm, Long-Press Return — v1.1 (TOUCH-*)

### Active

- [ ] Random-Mode erhält ≥4 neue Event-Typen und überarbeitetes Balancing — v1.2 (RAND-*)
- [x] Steuerungserklärung per Info-Button im Game-Screen abrufbar — v1.2 (HLP-*) — Validated in Phase 12: controls-modal
- [x] Leaderboard-Screen mit je einer Bestenliste pro Puzzle — v1.2 (LDR-*) — Validated in Phase 13: per-level-leaderboard
- [x] Spieler können nach Verbindungsabbruch (30s Fenster) zur Lobby zurückkehren — v1.2 (RECON-*) — Validated in Phase 15: reconnect-after-disconnect
- [x] Spielernamen werden server-seitig auf Profanity geprüft — v1.2 (PROF-*) — Validated in Phase 11: profanity-filter

### Out of Scope

- Accounts / Login — nicht nötig für Uni-Abgabe
- Persistente Datenbank / Rangliste — in-memory Session-Leaderboard reicht; kein Persistenz-Requirement
- Puzzle-Editor in-game — Puzzles werden manuell als JSON erstellt
- WebRTC / Peer-to-Peer — würde Server-Authoritative-Validierung aushebeln (Kernkonzept)

## Context

**Shipped:** v1.0 (2026-03-15) — 3 phases, 11 plans, 9 days
**Code:** ~2,543 LOC (1,275 JS source + 803 JS tests + 104 HTML + 361 CSS)
**Tests:** 68/68 pass (37 game logic + 14 socket handler + 17 other)
**Tech stack:** Node.js + Express + Socket.IO (Server), Vanilla JS + HTML/CSS SPA (Client)
**Files:** `server/src/` (server.js, game.js, socket.js, *.test.js), `client/` (index.html, main.js, style.css), `puzzles/*.json`

## Constraints

- **Tech Stack**: Node.js + Express.js + Socket.IO (Server), Vanilla JS + HTML + CSS (Client) — kein Framework
- **Scale**: Kleine Lobbys (2–4 Spieler), in-memory reicht für Uni-Demo
- **Scope**: Uni-Abgabe — Kernmechanik muss funktionieren, kein Production-Grade nötig

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Lösung nur server-seitig (GAME-06) | Anti-Cheat, Kernkonzept | ✓ Gut — `getPublicState()` als einziger Serialisierungspfad; TDD-Test bestätigt kein "solution"-Key im Output |
| Vanilla JS (kein Framework) | Uni-Anforderung / bewusste Entscheidung | ✓ Gut — saubere SPA mit Screen-Switching-Pattern, keine Build-Tooling nötig |
| Puzzles als JSON-Dateien | Einfach zu erstellen, klar strukturiert | ✓ Gut — Schema-Validierung beim Start, 2 Puzzles inklusive |
| Socket.IO für Echtzeit | Passt zu Node.js-Stack, einfaches Room-Management | ✓ Gut — Rooms = Lobby-Codes, kein zusätzliches Abstractions-Layer nötig |
| CommonJS (require) statt ESM | Kein `fileURLToPath`-Workaround, kein Build-Tooling | ✓ Gut — `require()` einfacher und ausreichend |
| `disconnecting` statt `disconnect` für Cleanup | `socket.rooms` noch befüllt beim `disconnecting`-Event | ✓ Gut — zuverlässige Room-Identifikation ohne extra State-Lookup |
| Click-to-Place statt HTML5 Drag-and-Drop | Mousemove-Ghost-Preview funktioniert besser, plattformübergreifend zuverlässiger | ✓ Gut — nach Human-Verification bestätigt (Phase 2 Checkpoint) |
| In-memory Leaderboard (kein Persistence) | Uni-Requirement: kein persistentes Scoring | ✓ Gut — `const leaderboard = []` im Modul-Scope, bei Server-Neustart leer |
| advanceTurnIfActive vor removePlayer | Turn-Index ist noch valide solange Player noch im Array | ✓ Gut — 5 TDD-Tests bestätigen alle Disconnect-Szenarien |

---
*Last updated: 2026-04-10 after Phase 15 complete — reconnect after disconnect shipped*
