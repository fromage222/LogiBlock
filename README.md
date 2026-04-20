# LogiBlock

Ein rundenbasiertes, kooperatives Puzzle-Spiel für mehrere Spieler im Browser.  
Entwickelt im Rahmen des Moduls **WWI_24AMA – Fortgeschrittene Systementwicklung** an der DHBW Mannheim.

---

## Spielprinzip

Alle Spieler sehen dasselbe Grid. Zu Beginn liegen 1–2 geometrische Formen als feste Anker im Grid — der Rest liegt in der gemeinsamen Bank. Pro Runde macht jeder Spieler **genau einen Zug**:

- Form aus der Bank ins Grid legen
- Form aus dem Grid zurück in die Bank legen

Ziel ist es, das Grid gemeinsam **vollständig und lückenlos** zu füllen. Jedes Puzzle hat genau eine richtige Lösung.

### Random Mode

Der optionale Random Mode aktiviert Chaos-Events: Nach jeder erfolgreichen Platzierung wird mit 50 % Wahrscheinlichkeit ein zufälliges Ereignis ausgelöst.

| Event | Wahrscheinlichkeit | Effekt |
|---|---|---|
| `rotate_piece` | 10 % | Nächster Stein wird automatisch gedreht |
| `skip_turn` | 15 % | Zug des nächsten Spielers wird übersprungen |
| `remove_piece` | 20 % | Ein zufällig platzierter Stein wird entfernt |
| `shuffle_order` | 15 % | Reihenfolge aller Spieler wird neu gemischt |
| `double_turn` | 15 % | Aktueller Spieler bekommt einen Extrazug |
| `reverse_order` | 15 % | Spielerreihenfolge wird umgekehrt |
| `blind_bank` | 10 % | Bank wird für 5 Sekunden ausgeblendet |

---

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Server | Node.js (v18+), Express.js, Socket.IO |
| Client | Vanilla JavaScript, HTML5, CSS3 |
| Sicherheit | Node.js `crypto` (built-in), `bad-words` |
| Konfiguration | `dotenv` |
| Puzzles | JSON-Dateien (serverseitig validiert) |
| Datenbank | keine — State liegt vollständig im Arbeitsspeicher |

---

## Projektstruktur

```
LogiBlock/
├── server/
│   ├── src/
│   │   ├── server.js        ← Express + Socket.IO Setup, Puzzle-Loader
│   │   ├── socket.js        ← Socket.IO Event Handler (alle Events)
│   │   ├── game.js          ← Game Logic (State, Validierung, Win-Check)
│   │   ├── game.test.js     ← Unit-Tests Game Logic
│   │   └── socket.test.js   ← Integrationstests Socket Events
│   └── package.json
├── client/
│   ├── index.html           ← Single-Page App
│   ├── main.js              ← Client-Logik, Socket-Handler, UI
│   └── style.css            ← Design-System, Dark Mode, Responsive Layout
├── puzzles/
│   ├── level_01.json        ← Puzzle-Definitionen (level_01 – level_09)
│   └── ...
├── docs/
│   └── api.md               ← Socket Event Dokumentation
├── .env.example
└── README.md
```

---

## Setup & Installation

### Voraussetzungen

- **Node.js** v18 oder höher
- **npm** (wird mit Node.js mitgeliefert)
- Git

### Installation

```bash
# Repository klonen
git clone https://github.com/fromage222/LogiBlock.git
cd LogiBlock

# Umgebungsvariablen einrichten
cp .env.example .env
# Optional: PORT in .env anpassen (Standard: 8000)

# Server-Abhängigkeiten installieren
cd server
npm install
```

### Entwicklungsmodus (mit Auto-Reload)

```bash
cd server
npm run dev
```

### Produktionsmodus

```bash
cd server
npm start
```

Der Server startet auf `http://localhost:8000`. Der Client wird automatisch vom Express-Server aus dem Verzeichnis `/client` ausgeliefert — **kein separater Client-Server nötig**.

### Tests ausführen

```bash
cd server
npm test
```

### Umgebungsvariablen

| Variable | Standard | Beschreibung |
|---|---|---|
| `PORT` | `8000` | Port des HTTP/WebSocket-Servers |

---

## Deployment (Uni-Server)

Der Server läuft auf dem Ubuntu-Server der DHBW unter `http://141.72.176.152:8000`.  
Der Client wird direkt vom Express-Server ausgeliefert — kein separates Hosting nötig.

### Erstmalig einrichten

```bash
ssh -l logiblock 141.72.176.152
git clone https://github.com/fromage222/LogiBlock.git
cd LogiBlock
cp .env.example .env
cd server
npm install
```

### Server starten

```bash
ssh -l logiblock 141.72.176.152
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
ssh -l logiblock 141.72.176.152
cd LogiBlock
git config pull.rebase false   # einmalig nötig
git pull origin dev
pkill -f "node src/server.js"
cd server
node src/server.js
```

---

## Cheat Prevention

LogiBlock implementiert mehrere Schutzmechanismen, die serverseitig erzwungen werden. Der Client hat zu keinem Zeitpunkt die Möglichkeit, den Spielzustand direkt zu manipulieren.

### Server Authority

Die gesamte Spiellogik liegt auf dem Server. Der Client sendet nur **Absichtserklärungen** (z. B. "ich möchte Form P03 an Position [2,4] platzieren"). Jede Aktion wird vor Ausführung serverseitig validiert; ungültige Züge werden mit `game:error` abgelehnt ohne den State zu verändern.

### Zugberechtigung (Turn Authority)

Jede Lobby speichert `activeTurnSocketId` — die Socket.IO-ID des Spielers, der aktuell dran ist. Bei jedem eingehenden `game:move`-Event prüft der Server:

```
lobby.activeTurnSocketId !== socket.id  →  sofortige Ablehnung
```

Da Socket.IO-IDs serverseitig vergeben werden, kann kein Client eine fremde ID vortäuschen.

### Versteckte Puzzle-Lösung (GAME-06-Invariante)

Die JSON-Lösung eines Puzzles (`solution`-Array) wird **niemals** an den Client übertragen. Die einzige Funktion, die ausgehende State-Payloads erzeugt, ist `getPublicState()` in `game.js`. Diese Funktion enthält ausdrücklich keinen `solution`-Eintrag:

```js
// solution: intentionally NEVER included — GAME-06 invariant
```

Die Win-Erkennung (`checkWin`) läuft ausschließlich auf dem Server und vergleicht den Grid-State gegen die serverseitig gespeicherte Lösung.

### Disconnect-Verhalten

Ein Refresh oder Tab-Schließen während eines laufenden Spiels führt direkt zum Hauptmenü — kein automatischer Reconnect. Serverseitig startet bei einem Verbindungsabbruch ein 5-Sekunden-Timer, nach dessen Ablauf der Spieler entfernt und der Zug ggf. weitergerückt wird.

### Profanity Filter

Spielernamen werden vor dem Beitreten gefiltert. Neben dem englischen Standardwörterbuch der `bad-words`-Bibliothek sind 30+ deutsche Schimpfwörter inkl. gängiger Leetspeak-Varianten (z. B. `4rsch`, `w1chser`, `h0re`) hinterlegt. Namen werden auf 20 Zeichen begrenzt.

### Host-Only-Kontrollen

Puzzle-Auswahl, Spielstart und Random-Mode-Toggle sind durch eine explizite `hostId`-Prüfung gesichert. Nicht-Host-Spieler erhalten bei entsprechenden Versuchen eine `room:error`-Antwort. Verlässt der Host die Lobby, wird diese sofort geschlossen.

### Einschränkungen

- Der State liegt vollständig im Arbeitsspeicher — ein Server-Neustart leert alle Lobbys und das Leaderboard.
- CORS ist auf `origin: '*'` gesetzt (ausreichend für das DHBW-Netzwerk, nicht für öffentliche Deployments geeignet).
- Es gibt keine HTTPS-Erzwingung; diese obliegt dem vorgelagerten Server/Proxy.

---

## Socket Event API

### Überblick

Die gesamte Kommunikation läuft über Socket.IO WebSockets. HTTP wird nur für die initiale Verbindung und die Auslieferung der statischen Client-Dateien genutzt.

### PublicState-Payload

Viele Server→Client-Events enthalten den vollständigen öffentlichen Lobby-/Spiel-State:

```ts
PublicState {
  roomCode:                string
  phase:                   'lobby' | 'playing'
  players:                 Array<{ name: string, isHost: boolean, disconnected: boolean }>
  selectedPuzzleId:        string | null
  selectedPuzzleName:      string | null
  selectedPuzzleDifficulty: string | null
  grid:                    GridCell[][] | null   // null in der Lobby-Phase
  gridSize:                { rows: number, cols: number } | null
  activePlayerName:        string | null
  activeSocketId:          string | null
  activeTurnIndex:         number
  bankShapes:              Array<{ id: string, cells: [number, number][] }>
  randomMode:              boolean
  extraTurns:              number
}

// GridCell-Typen:
null                               // leere Zelle
{ inactive: true }                 // blockierte Zelle (nicht bespielbar)
{ shapeId: string, movable: false } // Anker-Shape (fest)
{ shapeId: string, movable: true }  // platzierbarer Shape (beweglich)
```

---

### Client → Server

#### `createRoom`

Erstellt eine neue Lobby. Der Sender wird automatisch zum Host.

**Payload:**
```json
{ "playerName": "Alice" }
```

**Antwort-Events:** `room:created`, `puzzle:list`, `lobby:update` (an alle im Raum)  
**Fehler:** `room:error` (leerer Name, Profanity, Server voll)

---

#### `joinRoom`

Tritt einer bestehenden Lobby bei. Nur in der Lobby-Phase möglich.

**Payload:**
```json
{ "roomCode": "123456", "playerName": "Bob" }
```

**Antwort-Events:** `room:joined`, `puzzle:list`, `lobby:update` (an alle)  
**Fehler:** `room:error` (Raum nicht gefunden, Spiel läuft bereits, Name vergeben, Raum voll, Profanity)

---

#### `lobby:selectPuzzle`

Wählt ein Puzzle für die nächste Partie aus. Nur für den Host.

**Payload:**
```json
{ "puzzleId": "level_03" }
```

**Antwort-Events:** `lobby:update` (an alle)  
**Fehler:** `room:error` (kein Host, ungültige Puzzle-ID)

---

#### `lobby:randomMode`

Aktiviert oder deaktiviert den Random Mode. Nur für den Host.

**Payload:**
```json
{ "enabled": true }
```

**Antwort-Events:** `lobby:update` (an alle)  
**Fehler:** `room:error` (kein Host)

---

#### `startGame`

Startet das Spiel. Nur für den Host, erfordert mindestens 2 Spieler.

**Payload:** *(kein Payload)*

**Antwort-Events:** `game:start` (an alle)  
**Fehler:** `room:error` (kein Host, zu wenig Spieler, Spiel läuft bereits)

---

#### `game:move`

Führt einen Spielzug aus. Nur für den Spieler, dessen `activeSocketId` mit der eigenen Socket-ID übereinstimmt.

**Payload – Form platzieren:**
```json
{
  "action": "place",
  "shapeId": "P03",
  "rotation": 90,
  "originRow": 2,
  "originCol": 4
}
```

| Feld | Typ | Beschreibung |
|---|---|---|
| `action` | `"place"` | Platzierungs-Aktion |
| `shapeId` | `string` | ID der Form aus der Bank |
| `rotation` | `number` | Drehung in Grad: `0`, `90`, `180`, `270` |
| `originRow` | `number` | Zeilen-Ursprung im Grid (0-basiert) |
| `originCol` | `number` | Spalten-Ursprung im Grid (0-basiert) |

**Payload – Form zurücklegen:**
```json
{
  "action": "return",
  "shapeId": "P03"
}
```

**Antwort (Platzieren, kein Sieg):** `game:stateUpdate` (an alle); bei aktivem Random Mode ggf. `randomMode:event`  
**Antwort (Platzieren, Sieg):** `game:win` (an alle), `leaderboard:update` (an alle verbundenen Sockets)  
**Antwort (Zurücklegen):** `game:stateUpdate` (an alle) — Zug wird **nicht** weitergerückt  
**Fehler:** `game:error` (nicht dran, Form ungültig, bereits platziert, außerhalb der Grenzen, Zelle belegt)

---

#### `game:restart`

Stimme für "Play Again" ab. Erst wenn alle verbundenen Spieler abgestimmt haben, kehrt die Lobby in die Lobby-Phase zurück.

**Payload:** *(kein Payload)*

**Antwort (noch nicht alle):** `game:playAgainVote` (an alle)  
**Antwort (alle abgestimmt):** `puzzle:list` (nur Host), `lobby:update` (an alle)

---

#### `leaveRoom`

Freiwilliges Verlassen der Lobby (nur in der Lobby-Phase). Kein Grace-Period — sofortige Bereinigung.

**Payload:** *(kein Payload)*

**Antwort:** `lobby:playerLeft` + `lobby:update` (an verbleibende Spieler); bei Host-Austritt: `lobby:hostLeft` (an alle)

---

### Server → Client

#### `room:created`

Bestätigung nach `createRoom`. Enthält den Raumcode.

```json
{ "roomCode": "123456" }
```

---

#### `room:error`

Fehlermeldung auf ein fehlgeschlagenes Client-Event.

```json
"Room \"999999\" not found"
```

---

#### `puzzle:list`

Liste der verfügbaren Puzzles für das Host-Dropdown. Wird nach `createRoom`, `joinRoom` und `reconnectRoom` gesendet.

```json
[
  { "id": "level_01", "name": "Level 1", "difficulty": "easy" },
  { "id": "level_02", "name": "Level 2", "difficulty": "medium" }
]
```

---

#### `lobby:update`

Vollständiger PublicState der Lobby. Wird bei jeder Lobby-Änderung an alle Teilnehmer gesendet.

**Payload:** `PublicState` (mit `phase: 'lobby'`, `grid: null`)

---

#### `lobby:playerLeft`

Ein Spieler hat die Lobby verlassen (kein Host).

```json
{ "playerName": "Bob" }
```

---

#### `lobby:hostLeft`

Der Host hat die Lobby verlassen — der Raum wird geschlossen.

```json
{ "message": "Host left — lobby closed" }
```

---

#### `game:start`

Das Spiel startet. Enthält den initialen Spielzustand mit vorplatzierten Anker-Shapes und den Server-Zeitstempel für den Timer.

**Payload:** `PublicState` + `{ "startTime": 1713612000000 }`

---

#### `game:stateUpdate`

Vollständiger Spielzustand nach jedem Zug (Platzieren, Zurücklegen, Spieler-Disconnect).

**Payload:** `PublicState` (mit `phase: 'playing'`)

---

#### `game:error`

Ein Zug wurde abgelehnt (nur an den sendenden Spieler).

```json
"Not your turn"
```

---

#### `game:win`

Das Puzzle wurde gelöst. Enthält den finalen Spielzustand und die serverseitig berechnete Spielzeit.

**Payload:** `PublicState` + `{ "elapsedMs": 142500 }`

---

#### `game:playAgainVote`

Zwischenstand der Play-Again-Abstimmung.

```json
{ "votes": 2, "total": 3 }
```

---

#### `randomMode:event`

Ein Chaos-Event wurde ausgelöst (nur wenn Random Mode aktiv).

```json
{
  "type": "skip_turn",
  "description": "Chaos! Alice überspringt den Zug von Bob!"
}
```

Mögliche `type`-Werte: `rotate_piece`, `skip_turn`, `remove_piece`, `shuffle_order`, `double_turn`, `reverse_order`, `blind_bank`

---

#### `leaderboard:update`

Aktualisiertes Leaderboard nach jedem gewonnenen Spiel. Wird an **alle** verbundenen Sockets gesendet (nicht nur an den aktuellen Raum).

```json
[
  {
    "rank": 1,
    "puzzleName": "Level 3",
    "time": "02:17",
    "playerNames": ["Alice", "Bob"]
  }
]
```

---

## Puzzle-Format

Puzzles liegen als JSON-Dateien im Verzeichnis `/puzzles/`. Der Server validiert alle Dateien beim Start und überspringt ungültige Puzzles.

```json
{
  "id": "level_01",
  "name": "Level 1",
  "difficulty": "easy",
  "gridSize": { "rows": 5, "cols": 9 },
  "inactiveCells": [[4, 0], [4, 8]],
  "shapes": [
    {
      "id": "P01",
      "cells": [[0, 0], [0, 1], [0, 2]],
      "movable": false,
      "position": [2, 3]
    },
    {
      "id": "P02",
      "cells": [[0, 0], [0, 1], [1, 0]],
      "movable": true
    }
  ],
  "solution": [
    ["P04", "P04", "P08", "P01", "P01", "P01", "P06", "P06", "P06"],
    ...
  ]
}
```

| Feld | Pflicht | Beschreibung |
|---|---|---|
| `id` | ja | Eindeutiger Bezeichner |
| `name` | ja | Anzeigename im Dropdown |
| `difficulty` | empfohlen | `"easy"`, `"medium"`, `"hard"` — Puzzles ohne `difficulty` werden nicht im Client-Dropdown angezeigt |
| `gridSize` | ja | `{ rows, cols }` als Zahlen |
| `inactiveCells` | nein | Liste von `[row, col]`-Paaren für blockierte Zellen |
| `shapes` | ja | Array aller Shapes (Anker + beweglich) |
| `shapes[].id` | ja | Eindeutig innerhalb des Puzzles |
| `shapes[].cells` | ja | Relative `[dr, dc]`-Offsets der Zellen |
| `shapes[].movable` | ja | `false` = Anker (fest), `true` = beweglich |
| `shapes[].position` | wenn `movable: false` | `[originRow, originCol]` im Grid |
| `solution` | ja | 2D-Array der Größe `rows × cols`: Shape-ID oder `null` |

---

## Branch-Strategie

```
main        ← nur funktionierender, getesteter Code
dev         ← Arbeits-Branch
feature/xxx ← für größere Features
```

**Niemals direkt auf `main` pushen.**
