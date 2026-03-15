# Architecture Patterns

**Domain:** Turn-based cooperative multiplayer browser puzzle game
**Project:** LogiBlock
**Researched:** 2026-03-01
**Confidence:** HIGH

---

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                     SERVER (Node.js)                │
│                                                     │
│  ┌──────────────┐   ┌──────────────────────────┐   │
│  │  Express.js  │   │       GameManager        │   │
│  │  (HTTP /     │   │  (in-memory Map of       │   │
│  │   static)    │   │   Room instances)        │   │
│  └──────────────┘   └────────────┬─────────────┘   │
│                                  │                  │
│  ┌───────────────────────────────▼─────────────┐   │
│  │             Socket.IO Server                │   │
│  │   (event routing, room joins, broadcasts)   │   │
│  └───────────────────────────────┬─────────────┘   │
│                                  │                  │
│  ┌───────────────────────────────▼─────────────┐   │
│  │              Room (per lobby)               │   │
│  │  - roomCode: string                         │   │
│  │  - players: Player[]  (max 4)               │   │
│  │  - puzzle: PuzzleDefinition (solution       │   │
│  │            NEVER sent to client)            │   │
│  │  - gridState: Cell[][]                      │   │
│  │  - bank: Shape[]                            │   │
│  │  - turnIndex: number                        │   │
│  │  - status: 'waiting'|'playing'|'won'        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │           Puzzle Loader (startup)           │   │
│  │  Reads /puzzles/*.json → PuzzleDefinition[] │   │
│  │  Keeps solution in memory, never serializes │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
             ▲ Socket.IO (WebSocket)
             │
┌────────────┴─────────────────────────────────────────┐
│                  CLIENT (Vanilla JS)                 │
│                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌──────────┐ │
│  │  LobbyView    │  │   GameView    │  │ WinView  │ │
│  │  (join/create │  │  (grid +      │  │          │ │
│  │   room)       │  │   bank +      │  │          │ │
│  └───────────────┘  │   turn UI)    │  └──────────┘ │
│                     └───────────────┘                │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │              SocketClient wrapper            │   │
│  │  (single socket.io-client instance)          │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │             Client State (plain JS obj)      │   │
│  │  - roomCode, myPlayerId, isMyTurn            │   │
│  │  - gridState (mirror of server)              │   │
│  │  - bank (mirror of server)                   │   │
│  │  - playerList + activePlayerIndex            │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## Component Boundaries

### Server Components

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `server.js` | Express setup, HTTP server creation, Socket.IO attachment, static file serving | `socket.js` (passes io instance) |
| `socket.js` | Socket.IO event handler registration — maps socket events to GameManager actions, broadcasts results | `game.js`, Socket.IO rooms |
| `game.js` (GameManager) | Creates/destroys Room instances, generates room codes, enforces max concurrent rooms | `Room` class, `PuzzleLoader` |
| `Room` class | All game logic: turn rotation, move validation against solution, grid/bank mutation, win detection | `PuzzleDefinition` (read-only) |
| `PuzzleLoader` | Reads `puzzles/*.json` at startup, validates schema, holds definitions in memory | Filesystem (startup only), `GameManager` |

### Client Components

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `SocketClient` | Wraps `io()` connection, emits events, registers listeners | Socket.IO server, view modules |
| `LobbyView` | Renders create/join form, validates room code input before emitting | `SocketClient` |
| `GameView` | Renders grid, bank, turn indicator; handles click selection for moves | `SocketClient`, `ClientState` |
| `ClientState` | Single plain JS object holding all UI-relevant state; updated only on server events | `GameView` (read), `SocketClient` (writes) |
| `WinView` | Renders win screen after `game:won` event | `ClientState` |

---

## Data Flow

### Room Creation / Join

```
Client                          Server
  │                               │
  ├─ emit('room:create', {name})  │
  │                               ├─ GameManager.createRoom()
  │                               │   generate room code
  │                               │   socket.join(roomCode)
  │ ◄── emit('room:created', ...) │
  │                               │
  ├─ emit('room:join',            │
  │        {roomCode, name})      │
  │                               ├─ validate room exists + not full
  │                               │   socket.join(roomCode)
  │ ◄── emit('room:joined', ...)  │
  │ ◄── io.to(room).emit(         │ ← broadcast to all in room
  │       'room:playerJoined')    │
```

### Move Flow

```
Active Client          Server                   Other Clients
  │                      │                           │
  ├─ emit('game:move',   │                           │
  │    {action, shapeId, │                           │
  │     position,        │                           │
  │     rotation})       │                           │
  │                      ├─ 1. Is this socket's turn?│
  │                      ├─ 2. shapeId in bank?      │
  │                      ├─ 3. Cells within bounds?  │
  │                      ├─ 4. Target cells empty?   │
  │                      ├─ 5. Matches solution?     │
  │                      │    (server only)          │
  │                      │                           │
  │ ◄── 'move:rejected'  │ (if invalid)              │
  │                      │                           │
  │                      ├─ mutate gridState         │
  │                      ├─ remove shape from bank   │
  │                      ├─ advance turnIndex        │
  │                      ├─ check win condition      │
  │                      │                           │
  │ ◄──────────────────  │ io.to(room).emit ──────►  │
  │    'game:stateUpdate' │    (broadcast to all)    │
  │                      │                           │
  │ ◄──────────────────  │ 'game:won' (if solved) ►  │
```

### Disconnect Handling

```
Client disconnects        Server
  │                          │
  ├─ [TCP close]             ├─ Room.removePlayer(socketId)
  │                          ├─ if room empty: destroyRoom()
  │                          ├─ if active turn: advance turn
  │                          ├─ io.to(room).emit('room:playerLeft')
```

---

## Game State Schema

### Server-Side (never fully serialized to client)

```javascript
{
  roomCode: "ABCD",
  status: "waiting",        // 'waiting' | 'playing' | 'won'
  players: [
    { id: "socket-id", name: "Alice", connected: true }
  ],
  turnIndex: 0,
  puzzle: {
    id: "puzzle_01",
    gridWidth: 8,
    gridHeight: 8,
    solution: [...],        // NEVER sent to client
    anchors: [...]
  },
  gridState: [
    { row: 0, col: 0, occupiedBy: "shape-1" | null }
  ],
  bank: [
    { id: "shape-3", cells: [[0,0],[0,1],[1,0]] }
  ]
}
```

### Client-Received State (safe subset only)

```javascript
// Emitted in 'game:started' and 'game:stateUpdate'
{
  gridState: [...],
  bank: [...],
  players: [{ id, name }],
  activePlayerIndex: 0,
  lastMove: null | { actorName, action, shapeId }
}
```

---

## Key Patterns

### Pattern 1: Authoritative Server State

Server is the single source of truth. Clients hold a mirror copy. All mutations go through server validation. The client never has enough information to validate moves (it doesn't have the solution).

```javascript
// The ONLY serialization path from server to client
getPublicState() {
  const { solution, ...safeState } = this.puzzle;
  return { gridState: this.gridState, bank: this.bank,
           players: this.players.map(p => ({ id: p.id, name: p.name })),
           activePlayerIndex: this.turnIndex, status: this.status };
}
```

### Pattern 2: Full State Broadcast After Mutation

Never send partial field patches. Broadcast complete new public state after every successful mutation. Prevents client drift, handles reconnects naturally.

### Pattern 3: Socket.IO Room = Game Room

The room code IS the Socket.IO room name. `io.to(roomCode).emit(...)` targets exactly the right players with no extra bookkeeping.

```javascript
socket.join(roomCode);                            // on join
io.to(roomCode).emit('game:stateUpdate', state);  // broadcast to all
```

### Pattern 4: Turn Guard on Every Move Handler

```javascript
socket.on('game:move', (data) => {
  const room = gameManager.getRoomBySocket(socket.id);
  if (room.players[room.turnIndex].id !== socket.id) {
    socket.emit('move:rejected', { reason: 'not_your_turn' });
    return;
  }
  // ... process move synchronously
});
```

### Pattern 5: Synchronous Move Handlers (No Async)

Keep all game state mutation synchronous. Node.js is single-threaded — synchronous handlers are naturally atomic, preventing race conditions where two players pass the turn check simultaneously.

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Instead |
|-------------|---------|---------|
| Sending `puzzle.solution` to client | Violates core anti-cheat requirement | Only emit via `getPublicState()` — never emit raw puzzle |
| Client-side validation as source of truth | Client cannot know the solution | Server validates everything |
| Global state in `socket.js` | Mixes routing with game state; untestable | `GameManager` class owns all `Room` instances |
| Storing socket objects in game state | Stale references after disconnect | Store `socket.id` (string) only; use `io.to(roomCode)` for broadcasts |
| `fs.readFileSync` in event handler | Blocks Node.js event loop | Load all puzzles at startup |

---

## Build Order

Build in this order for a working vertical slice at each step:

```
1. PuzzleLoader + puzzle JSON schema
   No dependencies. Unit-testable file loading.

2. Room class (pure game logic, no Socket.IO)
   Depends on: PuzzleDefinition.
   Unit test: move validation, turn rotation, win detection.

3. GameManager (room lifecycle)
   Depends on: Room class.
   Handles: create, join, destroy, room code generation.

4. server.js + socket.js (event wiring)
   Depends on: GameManager.
   Maps socket events → GameManager → broadcasts results.

5. LobbyView (client)
   Depends on: socket event protocol from step 4.
   Create/join room, see player list.

6. GameView — Grid rendering
   Depends on: game:started event shape.
   Render gridState as CSS Grid.

7. GameView — Bank + move interaction
   Depends on: Grid rendering.
   Select shape, place on grid, emit game:move.

8. Turn indicator + move rejection feedback

9. WinView
   Depends on: game:won event.
```

---

## Socket.IO Event Reference

| Direction | Event | Payload |
|-----------|-------|---------|
| C→S | `room:create` | `{ name }` |
| C→S | `room:join` | `{ roomCode, name }` |
| C→S | `game:start` | `{}` |
| C→S | `game:move` | `{ action, shapeId, position, rotation }` |
| S→C | `room:created` | `{ roomCode, players }` |
| S→C | `room:joined` | `{ roomCode, players }` |
| S→C | `room:playerJoined` | `{ players }` — broadcast |
| S→C | `room:playerLeft` | `{ players, activePlayerIndex }` — broadcast |
| S→C | `game:started` | `{ gridState, bank, players, activePlayerIndex }` — broadcast |
| S→C | `game:stateUpdate` | `{ gridState, bank, players, activePlayerIndex, lastMove }` — broadcast |
| S→C | `move:rejected` | `{ reason }` — requesting socket only |
| S→C | `game:won` | `{ players }` — broadcast |
| S→C | `room:error` | `{ code, message }` — requesting socket only |

---

## Puzzle JSON Schema

```json
{
  "id": "puzzle_01",
  "gridWidth": 8,
  "gridHeight": 8,
  "anchors": [
    {
      "shapeId": "shape-1",
      "cells": [[0,0],[0,1],[1,0],[1,1]],
      "position": { "row": 0, "col": 0 }
    }
  ],
  "shapes": [
    { "id": "shape-2", "cells": [[0,0],[0,1],[0,2]] },
    { "id": "shape-3", "cells": [[0,0],[1,0],[1,1]] }
  ],
  "solution": [
    { "shapeId": "shape-2", "position": { "row": 0, "col": 2 }, "rotation": 0 },
    { "shapeId": "shape-3", "position": { "row": 1, "col": 2 }, "rotation": 0 }
  ]
}
```

`solution` is authoritative — server validates each move against it. `anchors` are pre-placed at game start. `shapes` go into the bank. Solution never leaves the server.

---

## Scalability at Target Scale

| Concern | At 4 players / 7 rooms | Notes |
|---------|----------------------|-------|
| Memory | ~1-2 MB total | In-memory Map is correct choice |
| CPU | Negligible | Turn-based = very low event frequency |
| Connections | 28 max | Node.js handles thousands |
| Room cleanup | On empty | Add TTL timer for abandoned rooms if needed |
