# Requirements: LogiBlock

**Defined:** 2026-03-15
**Core Value:** Die Lösung liegt ausschließlich auf dem Server — jeder Zug wird serverseitig validiert, kein Client sieht die Lösung, kein Cheat ist möglich.

## v1.0 Requirements (Validated)

Alle v1.0 Requirements sind shipped und validiert. Siehe MILESTONES.md.

## v1.1 Requirements

Requirements für Milestone v1.1 — Grid & Pieces Redesign. Jedes Requirement wird auf Roadmap-Phasen gemappt.

### Grid (GRID)

- [x] **GRID-01**: Spieler spielt auf einem 5×9-Grid mit fehlenden unteren Ecken (43 aktive Felder) — das neue unregelm. Grid ersetzt das bisherige rechteckige Layout
- [x] **GRID-02**: Spieler kann ein Puzzle mit unregelm. Grid spielen — Server lädt `inactiveCells`-Feld aus Puzzle-JSON und markiert diese Zellen beim Spielstart mit `{ inactive: true }` Sentinel
- [x] **GRID-03**: Server lehnt Platzierung von Steinen auf inaktiven Zellen ab (automatisch via non-null Sentinel, kein zusätzlicher Code in `placePiece()` nötig)
- [x] **GRID-04**: Spieler gewinnt korrekt wenn alle 43 aktiven Felder belegt sind — `checkWin()` ignoriert inaktive Zellen bei der Gewinnprüfung
- [ ] **GRID-05**: Spieler sieht die Grid-Lücken als transparente Felder ohne Klick-Interaktion — Client rendert inaktive Zellen mit CSS `.grid-cell.inactive` (transparent, kein Border, kein Pointer-Event)
- [ ] **GRID-06**: Spieler erkennt nicht-klickbare Grid-Felder am Cursor-Feedback — `cursor: default` statt `cursor: pointer` auf inaktiven Zellen

### Steine (PIEC)

- [x] **PIEC-01**: Spieler kann das neue 5×9-Puzzle mit 10 eigenen Formen spielen — `puzzles/puzzle_v11.json` ist geladen und vom Server beim Start validiert
- [x] **PIEC-02**: Puzzle ist mathematisch lösbar — Server-Validator prüft beim Start dass Gesamt-Feldanzahl aller beweglichen Steine exakt der Anzahl aktiver Lösung-Zellen entspricht (43 Felder)
- [ ] **PIEC-03**: Spieler sieht 10 Steine mit 10 verschiedenen Farben im Bank-Panel — `PIECE_COLORS` ist auf 10 Einträge erweitert, kein Farb-Konflikt

### Interaktion (CTRL)

- [ ] **CTRL-01**: Spieler kann ausgewählten Stein durch Linksklick auf eine aktive Grid-Zelle rotieren — Rotation zyklisch 0°→90°→180°→270°; 200ms Debounce verhindert unbeabsichtigte Rotation bei Doppelklick
- [ ] **CTRL-02**: Spieler platziert ausgewählten Stein per Doppelklick auf die gewünschte Grid-Position — ersetzt den bisherigen Einfachklick zum Platzieren
- [ ] **CTRL-03**: Ghost-Preview zeigt sofort die neue Rotation nach einem Linksklick — cached letzte Hover-Zelle und re-rendert Preview nach Rotation
- [ ] **CTRL-04**: Bank-Mini-Grid reflektiert die aktuelle Rotation des ausgewählten Steins nach einem Grid-Klick — `updateBankSelection()` wird aus dem Click-Handler aufgerufen

## v2 Requirements

Deferred — kein Scope für v1.1.

### Animationen

- **ANIM-01**: Rotation-Animation bei Stein-Klick (CSS transition)
- **ANIM-02**: Platzierungs-Bestätigungs-Puls auf `.placed`-Zellen

### Weitere

- **EXT-01**: Tastenkürzel R für Rotation (alternativer Code-Pfad)
- **EXT-02**: Mehrere unregelm. Grid-Formen (verschiedene Puzzles mit verschiedenen Formen)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Accounts / Login | Nicht nötig für Uni-Abgabe |
| Persistente Rangliste | In-memory Session-Leaderboard reicht |
| Mobile-Optimierung | Desktop-Browser reicht für Abgabe |
| Puzzle-Editor in-game | Puzzles werden manuell als JSON erstellt |
| WebRTC / Peer-to-Peer | Würde Server-Authoritative-Validierung aushebeln |
| Drag & Drop | Bereits in v1.0 zugunsten Click-to-Place abgelehnt; Doppelklick-Modell inkompatibel |
| Rechtsklick-Rotation | Browser-Kontextmenü-Interferenz macht dies unzuverlässig |
| Bank-Klick setzt Rotation zurück | Bewusst ausgeschlossen — Rotation soll beim Wechsel zur Bank erhalten bleiben |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GRID-01 | Phase 4 | Complete |
| GRID-02 | Phase 4 | Complete |
| PIEC-01 | Phase 4 | Complete |
| PIEC-02 | Phase 4 | Complete |
| GRID-03 | Phase 5 | Complete |
| GRID-04 | Phase 5 | Complete |
| GRID-05 | Phase 6 | Pending |
| GRID-06 | Phase 6 | Pending |
| PIEC-03 | Phase 6 | Pending |
| CTRL-01 | Phase 7 | Pending |
| CTRL-02 | Phase 7 | Pending |
| CTRL-03 | Phase 7 | Pending |
| CTRL-04 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-16 — GRID-02 marked complete after 04-02-PLAN.md execution*
