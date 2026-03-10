# Roadmap: LogiBlock

## Overview

LogiBlock wird in drei Phasen gebaut, die den architektonischen Abhängigkeiten des Projekts folgen. Phase 1 legt das Server-Fundament — Lobby-Lifecycle, Puzzle-Loading und die Sicherheitsinvariante (Lösung verlässt nie den Server) — ohne die keine Spielmechanik möglich ist. Phase 2 implementiert den vollständigen Game Loop auf diesem Fundament: Züge, Validierung gegen die versteckte Lösung, Echtzeit-Sync und Gewinnbedingung. Phase 3 fügt Timer und Session-Leaderboard hinzu, die ein abgeschlossenes Spielerlebnis mit messbarem Ergebnis schaffen.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Server-Infrastruktur, Lobby-Lifecycle und Puzzle-Loading
- [ ] **Phase 2: Game Loop** - Züge, Validierung, Echtzeit-Sync und Gewinnbedingung
- [ ] **Phase 3: Timer und Leaderboard** - Spielzeit-Messung und Session-Rangliste

## Phase Details

### Phase 1: Foundation
**Goal**: Spieler können Lobbys erstellen und beitreten, Puzzles werden sicher geladen, Disconnects werden sauber behandelt — die Basis für alles Weitere steht.
**Depends on**: Nothing (first phase)
**Requirements**: LOBB-01, LOBB-02, LOBB-03, LOBB-04, LOBB-05, PUZZ-01, PUZZ-02, GAME-09, GAME-10
**Success Criteria** (what must be TRUE):
  1. Ein Spieler kann einen Raum erstellen und erhält einen 6-stelligen Room-Code, den er an andere weitergeben kann.
  2. Ein zweiter Spieler kann per Room-Code beitreten und sieht sofort alle bereits verbundenen Mitspieler in der Lobby-Ansicht.
  3. Der Host sieht einen aktiven Start-Button sobald mindestens 2 Spieler verbunden sind, und kann vor dem Start ein Puzzle auswählen.
  4. Nach dem Spielstart sind die Anker-Formen an ihren fixen Positionen im Grid sichtbar und können nicht bewegt werden.
  5. Wenn der aktive Spieler die Verbindung verliert, friert das Spiel nicht ein — der nächste Spieler ist automatisch dran; leere Lobbys verschwinden ohne manuellen Eingriff.
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Server bootstrap, puzzle loading, game.js LobbyManager + getPublicState()
- [x] 01-02-PLAN.md — Socket.IO lobby event handlers + disconnect handling (socket.js)
- [x] 01-03-PLAN.md — Client SPA: start screen, lobby screen, game screen with anchor cells (checkpoint: awaiting human verify)

### Phase 2: Game Loop
**Goal**: Das Spiel ist vollständig spielbar — Züge werden serverseitig gegen die versteckte Lösung validiert, alle Spieler sehen den gleichen Spielstand in Echtzeit, und das Spiel endet mit einem Win-Screen.
**Depends on**: Phase 1
**Requirements**: PUZZ-03, GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06, GAME-07, GAME-08, WIN-01, WIN-02
**Success Criteria** (what must be TRUE):
  1. Der aktive Spieler ist für alle Teilnehmer visuell hervorgehoben; die Zugreihenfolge ist zirkulär und für alle sichtbar.
  2. Der aktive Spieler kann eine Form aus der Bank auswählen, sie rotieren (0°/90°/180°/270°) und ins Grid legen — der Zug wird serverseitig validiert.
  3. Eine falsch platzierte Form kann der aktive Spieler aus dem Grid zurück in die Bank legen.
  4. Nach jedem akzeptierten Zug sehen alle Spieler sofort den aktualisierten Grid-Zustand ohne Seitenreload.
  5. Bei einem ungültigen Zug sieht nur der aktive Spieler eine Fehlermeldung; bei vollständig korrektem Grid erscheint für alle der Win-Screen.
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md — Server game logic TDD (rotateCells, placePiece, returnPiece, checkWin, advanceTurn, getPublicState extension)
- [x] 02-02-PLAN.md — Client HTML + CSS (bank panel, turn banner, player badges, win overlay structure and styles)
- [x] 02-03-PLAN.md — Server socket handler (game:move with game:error point-to-point and game:win broadcast)
- [x] 02-04-PLAN.md — Client game loop JS (renderBank, drag-and-drop, ghost preview, renderTurnUI, renderWin, extended renderGrid)
- [x] 02-05-PLAN.md — Human verification checkpoint (end-to-end game loop playable)

### Phase 3: Timer und Leaderboard
**Goal**: Das Spielerlebnis ist vollständig — die Lösungszeit wird gemessen und auf dem Win-Screen angezeigt; die Rangliste aller gelösten Puzzles der aktuellen Server-Session ist auf dem Start-Screen sichtbar.
**Depends on**: Phase 2
**Requirements**: TIME-01, TIME-02, TIME-03, TIME-04, TIME-05
**Success Criteria** (what must be TRUE):
  1. Ein Timer startet exakt in dem Moment, in dem der Host das Spiel startet, und ist für alle Spieler sichtbar.
  2. Der Timer stoppt exakt wenn das Puzzle korrekt gelöst wurde — die gemessene Zeit ist präzise.
  3. Der Win-Screen zeigt die Lösungszeit des Teams an.
  4. Auf dem Start-Screen ist eine Rangliste aller bisherigen Team-Zeiten der aktuellen Server-Session sichtbar; nach einem Server-Neustart ist sie leer.
**Plans**: 3 plans

Plans:
- [ ] 03-01-PLAN.md — Server: startTime in game.js + enriched game:start/game:win payloads + leaderboard functions
- [ ] 03-02-PLAN.md — Client: live timer, win card restructure, Play Again, leaderboard render
- [ ] 03-03-PLAN.md — Human verification checkpoint (end-to-end timer + leaderboard)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 3/3 | Complete | 2026-03-05 |
| 2. Game Loop | 5/5 | Complete — human verified | 2026-03-05 |
| 3. Timer und Leaderboard | 1/3 | In Progress|  |
