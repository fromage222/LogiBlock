# Technology Stack

**Project:** LogiBlock — Cooperative Multiplayer Puzzle Game
**Researched:** 2026-03-01
**Confidence note:** Verify current versions with `npm view <package> version` before installing.

---

## Recommended Stack

### Core Framework — Server

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js | 20 LTS (min 18 LTS) | Runtime | LTS line is stable; v20 "Iron" is current LTS. Avoid v22 (odd-numbered, not LTS) for a uni submission. |
| Express.js | ^4.18 | HTTP server, static file serving | v4 is still the production standard. Express v5 entered RC in 2024 but is not yet stable. Stick to v4. |
| Socket.IO | ^4.7 | Real-time bidirectional events | v4 is the current major. Built-in room support, auto-reconnection, fallback to long-polling. Do NOT use raw `ws` — Socket.IO rooms alone justify the dependency. |
| dotenv | ^16 | Environment variable loading | Standard pattern for PORT / config values. v16 supports ESM and CJS. |
| cors | ^2.8 | CORS headers for HTTP endpoints | Required when client is served from a different origin during development. |
| uuid | ^9 | Generating room codes | Cryptographically random, collision-safe room IDs. Alternatively, `crypto.randomBytes(3).toString('hex')` is zero-dependency. |

### Core Framework — Client

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vanilla JavaScript (ES2022+) | — | Game UI, event handling, DOM | Project constraint. Modern JS fully supported in target browsers. No transpilation needed. |
| HTML5 | — | Markup, grid rendering | Use CSS Grid for the game board — maps 1:1 to a 2D puzzle grid. No canvas overhead needed for turn-based game. |
| CSS3 | — | Styling, layout, animations | CSS Grid for game board, Flexbox for lobby UI, CSS custom properties for theming. |
| socket.io-client | ^4.7 (CDN) | Client-side Socket.IO | Must match server major version. Load from CDN or serve from Express static. Do NOT npm-install on the client — no bundler. |

### Development Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| nodemon | ^3 | Auto-restart server on file change | Standard DX for Node.js development. v3 supports Node 18+. |
| Node.js built-in `crypto` | — | Room code generation | `crypto.randomBytes(3).toString('hex')` gives a 6-char hex code. Zero dependencies. |

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Node.js built-in `node:test` | — | Unit tests for game logic | Available since Node 18. Zero dependencies. Sufficient for testing pure functions (move validation, win condition, turn rotation). |

---

## What NOT to Use

| Category | Avoid | Reason |
|----------|-------|--------|
| Frontend framework | React, Vue, Svelte, Angular | Project constraint (Vanilla JS). For a turn-based grid game, a framework adds zero value. |
| Build tools | Vite, Webpack, esbuild, Parcel | No bundler needed. Client is a single `index.html` + `main.js`. |
| Express.js v5 | `express@5` | Still RC as of 2025. API changes break tutorials and middleware. |
| ORM / Database | Prisma, Sequelize, MongoDB | State is ephemeral (in-memory per session). No persistence needed. |
| Redis | `ioredis`, `redis` | Standard for multi-instance scaling. With single-process server and max 7 lobbies, Redis is pure overhead. |
| TypeScript | `typescript`, `ts-node` | Not in project constraint. Adding it requires restructuring the entire dev setup. |
| Game engine | Phaser, Babylon.js, Three.js | Turn-based 2D grid game. CSS Grid + DOM is the right tool. Massive overkill. |
| `ws` (raw WebSocket) | `ws` package | Socket.IO already uses `ws` internally. Using raw `ws` means implementing rooms, reconnection, and event routing from scratch. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Real-time transport | Socket.IO 4 | Raw WebSockets (`ws`) | No built-in rooms, no auto-reconnect, no namespaces, no fallback. More code, same capability. |
| Real-time transport | Socket.IO 4 | Server-Sent Events (SSE) | SSE is one-directional (server → client). Player moves still need HTTP POST. Unnecessarily complex for bidirectional game events. |
| Room ID generation | `crypto.randomBytes` | `uuid` npm package | Both work. `crypto` is built-in — zero dependencies for 7 lobbies. |
| CSS layout | CSS Grid | HTML Canvas | Canvas requires imperative pixel drawing and hit testing. CSS Grid gives declarative layout with DOM event handling built-in. |

---

## Installation

```bash
# In server/
npm init -y

# Production dependencies
npm install express socket.io dotenv cors

# Development dependencies
npm install -D nodemon

# Add to package.json scripts:
# "start": "node src/server.js",
# "dev": "nodemon src/server.js"
```

```html
<!-- In client/index.html — load Socket.IO from CDN (no build step) -->
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
<!-- Verify latest version at: https://cdn.socket.io/ -->
```

---

## Architecture Notes (Stack-Relevant)

### In-Memory State

All game state (lobbies, grids, turn order, player list) lives in a JavaScript `Map` on the server process:

```javascript
// server/src/game.js
const lobbies = new Map(); // lobbyCode -> gameState object
```

This is correct for this scale: 7 lobbies × 4 players = 28 active connections at peak. No external state store needed.

### Socket.IO Rooms for Lobby Management

Each lobby code is a Socket.IO room name — do NOT build a custom room abstraction on top:

```javascript
socket.join(lobbyCode);
io.to(lobbyCode).emit('stateUpdate', gameState);  // broadcast to all in lobby
socket.emit('moveError', { reason: 'Not your turn' }); // only to requester
```

### Server Authority Pattern

The solution is never sent to the client. Enforce at a single point:

```javascript
function getClientState(gameState) {
  const { solution, ...clientSafe } = gameState;
  return clientSafe;
}
// All stateUpdate emits must use: io.to(code).emit('stateUpdate', getClientState(gameState))
```

### Turn-Based Validation

Check `gameState.activePlayer === socket.id` before processing any move. Reject with `moveError` otherwise. No external rate limiting library needed.

---

## Confidence Assessment

| Claim | Confidence | Verify With |
|-------|------------|-------------|
| Express v4.18 is current stable | MEDIUM | `npm view express version` |
| Socket.IO v4.7 is current | MEDIUM | `npm view socket.io version` |
| nodemon v3 supports Node 18+ | HIGH | `npm view nodemon version` |
| CSS Grid for game board | HIGH | — (CSS spec, no version concern) |
| Socket.IO rooms replace custom lobby code | HIGH | Socket.IO v4 official docs |
| In-memory state sufficient for 7 lobbies | HIGH | — (trivially fits in RAM) |
| `node:test` available since Node v18 | HIGH | Node.js release notes |
