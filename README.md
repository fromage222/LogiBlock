# LogiBlock

Ein rundenbasiertes, kooperatives Puzzle-Spiel für mehrere Spieler im Browser.  
Entwickelt im Rahmen des Moduls **W3WI_AM302 – Fortgeschrittene Systementwicklung** an der DHBW Mannheim.

---

## Spielprinzip

Alle Spieler sehen dasselbe Grid. Zu Beginn liegen 1–2 geometrische Formen als feste Anker im Grid — der Rest liegt in der gemeinsamen Bank. Pro Runde macht jeder Spieler **genau einen Zug**:

- Form aus der Bank ins Grid legen
- Form im Grid drehen oder verschieben
- Form aus dem Grid zurück in die Bank legen

Ziel ist es, das Grid gemeinsam **vollständig und lückenlos** zu füllen. Jedes Puzzle hat genau eine richtige Lösung.

---

## Tech-Stack

| Bereich | Technologie |
|--------|-------------|
| Server | Node.js, Express.js, Socket.IO |
| Client | Vanilla JavaScript, HTML, CSS |
| Puzzles | JSON-Dateien |

---

## Projektstruktur

```
LogiBlock/
├── server/
│   ├── src/
│   │   ├── server.js      ← Express + Socket.IO Setup
│   │   ├── socket.js      ← Socket.IO Event Handler
│   │   └── game.js        ← Game Logic (State, Validierung, Win-Check)
│   └── package.json
├── client/
│   ├── index.html
│   ├── main.js
│   └── style.css
├── puzzles/
│   └── puzzle_01.json     ← Puzzle-Definitionen
├── docs/
│   └── api.md             ← Socket Event Dokumentation
├── .env.example
└── README.md
```

---

## Setup & Installation

### Voraussetzungen

- Node.js (v18 oder höher)
- npm

### Server starten

```bash
cd server
npm install
node src/server.js
```

Der Server läuft dann auf `http://localhost:8000`

### Client öffnen

```bash
cd client
npx serve .
```

Oder `client/index.html` direkt im Browser öffnen.

### Umgebungsvariablen

`.env.example` in `.env` umbenennen und anpassen:

```
PORT=8000
```

---

## Deployment (Uni-Server)

Der Server läuft auf dem Ubuntu-Server der DHBW unter `http://141.72.176.152:8000`.
Der Client wird direkt vom Express-Server ausgeliefert — kein separates Hosting nötig.

### Erstmalig einrichten

```bash
ssh <username>@141.72.176.152
git clone https://github.com/fromage222/LogiBlock.git
cd LogiBlock/server
npm install
```

### Server starten

```bash
ssh <username>@141.72.176.152
cd LogiBlock/server
node src/server.js
```

Server stoppen: `Ctrl+C`
Oder falls die SSH-Verbindung bereits geschlossen ist:
```bash
pkill -f "node src/server.js"
```

### Repository aktualisieren & neu starten

```bash
ssh <username>@141.72.176.152
cd LogiBlock
git config pull.rebase false   # einmalig nötig
git pull origin dev
pkill -f "node src/server.js"
cd server
node src/server.js
```

---

## Cheat Prevention

- Die gesamte Spiellogik liegt auf dem Server (**Server Authority**)
- Jeder Zug wird serverseitig validiert — der Client kann nichts manipulieren
- Die Puzzle-Lösung wird **niemals** an den Client gesendet
- Rate Limiting: max. 1 Zug pro Turn pro Spieler

---

## Socket Events

Vollständige Dokumentation unter `/docs/api.md`.

| Event | Richtung | Beschreibung |
|-------|----------|--------------|
| `join` | Client → Server | Spieler tritt bei |
| `startGame` | Server → Client | Spiel startet, initialer State |
| `makeMove` | Client → Server | Spieler macht einen Zug |
| `stateUpdate` | Server → Client | Neuer State nach Zug |
| `moveError` | Server → Client | Ungültiger Zug |
| `gameWon` | Server → Client | Spiel gewonnen |

---

## Team

| Person | Bereich |
|--------|---------|
| Person A | Backend, Game Logic, Socket.IO |
| Person B | Grid UI, Spielmechanik Frontend |
| Person C | Layout, Bank UI, Puzzle Editor |

---

## Branch-Strategie

```
main        ← nur funktionierender, getesteter Code
dev         ← Arbeits-Branch
feature/xxx ← für größere Features
```

**Niemals direkt auf `main` pushen.**