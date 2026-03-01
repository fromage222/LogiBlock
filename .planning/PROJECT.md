# LogiBlock

## What This Is

LogiBlock ist ein kooperatives Multiplayer-Puzzlespiel, bei dem Spieler gemeinsam Tetromino-Formen in ein geteiltes Grid legen, bis es lückenlos gefüllt ist. Das Spiel ist rundenbasiert — jeder Spieler macht genau einen Zug pro Runde. Das Projekt ist eine Uni-Abgabe.

## Core Value

Die Lösung liegt ausschließlich auf dem Server — jeder Zug wird serverseitig validiert, kein Client sieht die Lösung, kein Cheat ist möglich.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Spieler können per Room-Code einem Spiel beitreten (max. 4 pro Lobby)
- [ ] Server verwaltet mind. 7 gleichzeitige Lobbys
- [ ] Grid wird mit 1–2 fixen Anker-Formen initialisiert
- [ ] Restliche Formen liegen in einer geteilten Bank
- [ ] Rundenlogik: klare Zugreihenfolge, aktiver Spieler sichtbar markiert
- [ ] Pro Zug genau eine Aktion: Form aus Bank ins Grid legen ODER Form aus Grid zurück in Bank
- [ ] Alle Züge werden serverseitig gegen die hinterlegte Lösung validiert
- [ ] Gewinnbedingung: Grid vollständig korrekt gefüllt → Sieg
- [ ] Puzzles sind als JSON-Dateien vordesignt

### Out of Scope

- Accounts / Login — nicht nötig für Uni-Abgabe
- Ranglisten / Statistiken — kein persistentes Scoring vorgesehen
- Mobile-Optimierung — Desktop-Browser reicht für Abgabe
- Puzzle-Editor in-game — Puzzles werden manuell als JSON erstellt

## Context

- Bestehende Code-Struktur: `client/`, `server/`, `puzzles/`, `docs/`
- Puzzle-Definitionen als JSON in `puzzles/` — Shapes, Grid-Größe, Anker-Positionen, Lösung
- Lösung wird nur auf dem Server gehalten, nie an den Client übertragen
- Echtzeit-Kommunikation via Socket.IO (Spielzüge, Zugreihenfolge, Grid-State)

## Constraints

- **Tech Stack**: Node.js + Express.js + Socket.IO (Server), Vanilla JS + HTML + CSS (Client) — kein Framework
- **Scale**: Max. 4 Spieler pro Lobby, mind. 7 gleichzeitige Lobbys
- **Scope**: Uni-Abgabe — Kernmechanik muss funktionieren, kein Production-Grade nötig

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Lösung nur server-seitig | Anti-Cheat, Kernkonzept des Projekts | — Pending |
| Vanilla JS (kein Framework) | Uni-Anforderung / bewusste Entscheidung | — Pending |
| Puzzles als JSON-Dateien | Einfach zu erstellen, klar strukturiert | — Pending |
| Socket.IO für Echtzeit | Passt zu Node.js-Stack, einfaches Room-Management | — Pending |

---
*Last updated: 2026-03-01 after initialization*
