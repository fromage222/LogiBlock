# Requirements: LogiBlock

**Defined:** 2026-03-01
**Core Value:** Die Lösung liegt ausschließlich auf dem Server — jeder Zug wird serverseitig validiert, kein Client sieht die Lösung, kein Cheat ist möglich.

---

## v1 Requirements

### Lobby

- [ ] **LOBB-01**: Spieler kann einen neuen Raum erstellen und erhält einen einzigartigen Room-Code
- [ ] **LOBB-02**: Spieler kann einem bestehenden Raum per Room-Code beitreten
- [ ] **LOBB-03**: Alle Spieler sehen live welche Mitspieler in der Lobby verbunden sind
- [ ] **LOBB-04**: Host kann das Spiel starten (erst wenn ≥2 Spieler verbunden sind)
- [ ] **LOBB-05**: Host kann vor Spielstart aus den verfügbaren Puzzles auswählen

### Puzzle

- [ ] **PUZZ-01**: Server lädt alle Puzzle-JSON-Dateien beim Start und validiert ihr Schema
- [ ] **PUZZ-02**: Anker-Formen sind beim Spielstart an ihrer fixen Position vorplatziert und unveränderlich
- [ ] **PUZZ-03**: Formen können vom aktiven Spieler rotiert werden (0°, 90°, 180°, 270°)

### Game Loop

- [ ] **GAME-01**: Der aktive Spieler ist für alle Teilnehmer klar markiert sichtbar
- [ ] **GAME-02**: Die Zugreihenfolge ist zirkulär, server-kontrolliert, und für alle sichtbar
- [ ] **GAME-03**: Aktiver Spieler kann eine Form aus der Bank ins Grid legen (Position + Rotation)
- [ ] **GAME-04**: Aktiver Spieler kann eine falsch platzierte Form aus dem Grid zurück in die Bank legen
- [ ] **GAME-05**: Jeder Zug wird serverseitig gegen die hinterlegte Lösung validiert bevor er akzeptiert wird
- [ ] **GAME-06**: Die Lösung verlässt niemals den Server — `getPublicState()` ist der einzige Serialisierungspfad
- [ ] **GAME-07**: Bei ungültigem Zug erhält nur der aktive Spieler eine Fehlermeldung mit Grund
- [ ] **GAME-08**: Nach jedem akzeptierten Zug erhalten alle Spieler sofort den neuen Grid-State (Echtzeit-Sync)
- [ ] **GAME-09**: Wenn der aktive Spieler disconnected wird sein Zug automatisch übersprungen und der nächste Spieler ist dran
- [ ] **GAME-10**: Leere Lobbys (alle Spieler disconnected) werden automatisch zerstört

### Gewinn & Timer

- [ ] **WIN-01**: Gewinnbedingung wird erkannt wenn das Grid vollständig und korrekt gefüllt ist (Server-Prüfung)
- [ ] **WIN-02**: Alle Spieler sehen einen Win-Screen wenn das Puzzle gelöst wurde
- [ ] **TIME-01**: Ein Timer startet exakt wenn das Spiel beginnt (Host drückt Start)
- [ ] **TIME-02**: Der Timer stoppt exakt wenn das Puzzle korrekt gelöst wurde
- [ ] **TIME-03**: Die Lösungszeit wird dem Team auf dem Win-Screen angezeigt
- [ ] **TIME-04**: Auf dem Start-Screen sind alle bisherigen Team-Zeiten der aktuellen Server-Session als Rangliste sichtbar
- [ ] **TIME-05**: Zeiten werden in-memory gehalten — bei Server-Neustart sind alle Zeiten weg (kein Persistence nötig)

---

## v2 Requirements

### UI Polish

- **UI-01**: Spielerfarben — jeder Spieler hat eine Farbe, platzierte Formen werden entsprechend eingefärbt
- **UI-02**: Ghost/Preview — Hover zeigt wo die gewählte Form landen würde, vor dem Bestätigen
- **UI-03**: Move-History Log — Sidebar zeigt laufend wer welche Aktion durchgeführt hat

### Gameplay Extensions

- **GAME-11**: Turn-Timer — Zeitlimit pro Zug; bei Ablauf wird der Zug automatisch übersprungen
- **GAME-12**: Reconnect-Unterstützung — Spieler kann nach Disconnect in selben Raum zurückkehren

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| User Accounts / Login | Nicht nötig für Uni-Abgabe; würde OAuth, Sessions, Passwörter erfordern |
| Persistente Datenbank | In-memory reicht; kein Uni-Requirement für Persistenz |
| Mobile / Touch-Optimierung | Desktop-Browser ist Zielplattform |
| In-Game Puzzle-Editor | Separates Sub-Projekt; Puzzles werden manuell als JSON erstellt |
| Chat-System | Move-History (v2) reicht für Koordination |
| AI-Spieler | Kein Requirement; kein Multiplayer-Demo-Wert |
| WebRTC / Peer-to-Peer | Würde Server-Authoritative-Validierung aushebeln — Kernkonzept |
| Permanente Highscore-Speicherung | Explizit ausgeschlossen — Zeiten nur in-memory |

---

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LOBB-01 | — | Pending |
| LOBB-02 | — | Pending |
| LOBB-03 | — | Pending |
| LOBB-04 | — | Pending |
| LOBB-05 | — | Pending |
| PUZZ-01 | — | Pending |
| PUZZ-02 | — | Pending |
| PUZZ-03 | — | Pending |
| GAME-01 | — | Pending |
| GAME-02 | — | Pending |
| GAME-03 | — | Pending |
| GAME-04 | — | Pending |
| GAME-05 | — | Pending |
| GAME-06 | — | Pending |
| GAME-07 | — | Pending |
| GAME-08 | — | Pending |
| GAME-09 | — | Pending |
| GAME-10 | — | Pending |
| WIN-01 | — | Pending |
| WIN-02 | — | Pending |
| TIME-01 | — | Pending |
| TIME-02 | — | Pending |
| TIME-03 | — | Pending |
| TIME-04 | — | Pending |
| TIME-05 | — | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 0
- Unmapped: 25 ⚠️

---
*Requirements defined: 2026-03-01*
*Last updated: 2026-03-01 after initial definition*
