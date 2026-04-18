const {
  generateRoomCode,
  createLobby,
  getLobby,
  deleteLobby,
  addPlayer,
  removePlayer,
  replacePlayerSocket,
  setSelectedPuzzle,
  startGame,
  advanceTurnIfActive,
  getPublicState,
  getPuzzleListForClient,
  // NEW from Plan 02-01:
  placePiece,
  returnPiece,
  advanceTurn,
  // NEW from Plan 03-01:
  recordLeaderboardEntry,
  getLeaderboard,
  // NEW from Plan 09-03 (Random Mode socket layer):
  setRandomMode,
  triggerRandomEvent,
} = require('./game');

const BadWordsFilter = require('bad-words');
const profanityFilter = new BadWordsFilter();

const customBadWords = [
  "arsch", "4rsch", "@rsch", "ar5ch", "arsh",
  "arschloch", "4rschl0ch", "a_rschloch", "4rsh",
  "wichser", "wich5er", "wixxer", "wixxer", "w1chser",
  "hure", "hur3", "huere", "h0re",
  "hurensohn", "hurens0hn", "h0rensohn", "h-sohn", "hitler",
  "penner", "p3nner", "penn3r", "p3nn3r",
  "idiot", "1diot", "id1ot", "id10t",
  "ficker", "f1cker", "fick", "f1ck", "fck",
  "schlampe", "5chlampe", "5chlamp3", "schl4mpe",
  "miststück", "miststueck", "m1ststueck",
  "bastard", "b4stard", "b45tard",
  "depp", "d3pp", "d3p",
  "pimmel", "p1mmel", "p1mm3l",
  "schwanz", "5chwanz", "shwanz",
  "vagina", "v4gina", "fotze", "f0tze", "f0tz3"
];
profanityFilter.addWords(...customBadWords);

// Grace-period timers: player stays in lobby/game for 5s after disconnect
// so a browser reload can reconnect before the slot is freed.
// key: `${roomCode}:${playerName}`, value: timeout handle
const disconnectTimers = new Map();
const DISCONNECT_GRACE_MS = 5000;

/**
 * Registers all Socket.IO event handlers for one connected socket.
 * Called from server.js inside io.on('connection', ...).
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {Map} puzzleMap  — passed from server.js for reference (read-only here)
 */
function registerSocketHandlers(io, socket, puzzleMap) {

  // ── createRoom ─────────────────────────────────────────────────────────────
  // Client emits: { playerName: string }
  // Server responds:
  //   socket.emit('room:created', { roomCode })        — to creator
  //   socket.emit('puzzle:list', [{ id, name }])       — to creator (host needs dropdown)
  //   io.to(roomCode).emit('lobby:update', state)      — to all (including creator)
  socket.on('createRoom', ({ playerName } = {}) => {
    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
      return socket.emit('room:error', 'Player name is required');
    }
    const name = playerName.trim().slice(0, 20);
    if (profanityFilter.isProfane(name)) {
      return socket.emit('room:error', 'Player name is not allowed');
    }
    const roomCode = generateRoomCode();

    createLobby(roomCode, socket.id, name);
    socket.data.roomCode = roomCode;
    socket.data.playerName = name;
    socket.join(roomCode);

    socket.emit('room:created', { roomCode });
    socket.emit('puzzle:list', getPuzzleListForClient());
    io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
  });

  // ── joinRoom ───────────────────────────────────────────────────────────────
  // Client emits: { roomCode: string, playerName: string }
  // Server responds:
  //   socket.emit('room:error', message)               — if invalid (inline error)
  //   io.to(roomCode).emit('lobby:update', state)      — to all on success
  socket.on('joinRoom', ({ roomCode, playerName } = {}) => {
    if (!roomCode || typeof roomCode !== 'string') {
      return socket.emit('room:error', 'Room code is required');
    }
    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') {
      return socket.emit('room:error', 'Player name is required');
    }

    const name = playerName.trim().slice(0, 20);
    if (profanityFilter.isProfane(name)) {
      return socket.emit('room:error', 'Player name is not allowed');
    }
    const lobby = getLobby(roomCode);

    if (!lobby) {
      return socket.emit('room:error', `Room "${roomCode}" not found`);
    }
    if (lobby.phase !== 'lobby') {
      return socket.emit('room:error', 'Game has already started');
    }
    const existingPlayer = lobby.players.find(p => p.name === name);
    if (existingPlayer) {
      // Allow rejoin if old socket is dead or in grace-period disconnect.
      const timerKey = `${roomCode}:${name}`;
      const hasPendingDisconnect = disconnectTimers.has(timerKey);
      if (!hasPendingDisconnect && io.sockets.sockets.has(existingPlayer.socketId)) {
        return socket.emit('room:error', `Name "${name}" is already taken in this room`);
      }
      if (hasPendingDisconnect) {
        clearTimeout(disconnectTimers.get(timerKey));
        disconnectTimers.delete(timerKey);
      }
      replacePlayerSocket(roomCode, name, socket.id);
      socket.data.roomCode = roomCode;
      socket.data.playerName = name;
      socket.join(roomCode);
      socket.emit('puzzle:list', getPuzzleListForClient());
      io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
      return;
    }

    addPlayer(roomCode, socket.id, name);
    socket.data.roomCode = roomCode;
    socket.data.playerName = name;
    socket.join(roomCode);

    // Send puzzle list to the new joiner (they can see the selected puzzle name)
    socket.emit('puzzle:list', getPuzzleListForClient());
    io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
  });

  // ── lobby:selectPuzzle ─────────────────────────────────────────────────────
  // Client emits: { puzzleId: string }  (host only)
  // Server responds:
  //   io.to(roomCode).emit('lobby:update', state)      — real-time update for all
  socket.on('lobby:selectPuzzle', ({ puzzleId } = {}) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const lobby = getLobby(roomCode);
    if (!lobby) return;
    if (lobby.hostId !== socket.id) {
      return socket.emit('room:error', 'Only the host can select a puzzle');
    }
    if (lobby.phase !== 'lobby') return;

    const updated = setSelectedPuzzle(roomCode, puzzleId);
    if (!updated) {
      return socket.emit('room:error', 'Invalid puzzle selection');
    }
    io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
  });

  // ── lobby:randomMode ───────────────────────────────────────────────────────
  // Client emits: { enabled: bool }  (host only)
  // Server responds:
  //   socket.emit('room:error', message)               — if not host
  //   io.to(roomCode).emit('lobby:update', state)      — to all on success
  socket.on('lobby:randomMode', ({ enabled } = {}) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;
    const lobby = getLobby(roomCode);
    if (!lobby) return;
    if (lobby.hostId !== socket.id) {
      return socket.emit('room:error', 'Only the host can change random mode');
    }
    if (lobby.phase !== 'lobby') return;
    setRandomMode(roomCode, !!enabled);
    io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
  });

  // ── startGame ──────────────────────────────────────────────────────────────
  // Client emits: {}  (host only; requires >=2 players)
  // Server responds:
  //   socket.emit('room:error', message)               — if not allowed
  //   io.to(roomCode).emit('game:start', state)        — to all on success
  socket.on('startGame', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const lobby = getLobby(roomCode);
    if (!lobby) return;
    if (lobby.hostId !== socket.id) {
      return socket.emit('room:error', 'Only the host can start the game');
    }

    const result = startGame(roomCode);
    if (!result.ok) {
      return socket.emit('room:error', result.error);
    }

    // getPublicState now returns grid with anchor shapes pre-placed (PUZZ-02)
    // TIME-01: include startTime so client can anchor the live timer
    // lobby.startTime is set by startGame() — re-read via same reference (lobby is the same Map value)
    io.to(roomCode).emit('game:start', {
      ...getPublicState(roomCode),
      startTime: lobby.startTime,
    });
  });

  // ── game:move ──────────────────────────────────────────────────────────────
  // Client emits: { action, shapeId, rotation?, originRow?, originCol? }
  // action 'place': validates, places piece, advances turn or emits game:win
  // action 'return': validates, returns piece to bank, does NOT advance turn
  socket.on('game:move', ({ action, shapeId, rotation, originRow, originCol } = {}) => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const lobby = getLobby(roomCode);
    if (!lobby || lobby.phase !== 'playing') return;

    // Guard: only active player may move
    const activePlayer = lobby.players[lobby.activeTurnIndex];
    if (!activePlayer || activePlayer.socketId !== socket.id) {
      return socket.emit('game:error', 'Not your turn');
    }

    if (action === 'place') {
      const result = placePiece(lobby, shapeId, rotation ?? 0, originRow ?? 0, originCol ?? 0);
      if (!result.ok) {
        return socket.emit('game:error', result.error);
      }
      if (result.win) {
        // WIN-01 + WIN-02: emit game:win to all; do NOT advance turn; do NOT emit stateUpdate
        // TIME-02: authoritative elapsed time computed server-side
        const elapsedMs = Date.now() - lobby.startTime;
        recordLeaderboardEntry(lobby, elapsedMs);
        io.to(roomCode).emit('game:win', {
          ...getPublicState(roomCode),
          elapsedMs,                                      // TIME-03: client shows final time
        });
        io.emit('leaderboard:update', getLeaderboard()); // TIME-04: broadcast to ALL sockets
      } else {
        // Phase 14 double_turn gate: consume extra turn instead of advancing
        if (lobby.extraTurns > 0) {
          lobby.extraTurns--;
          // same player goes again; NO random event trigger during extra turn
        } else {
          advanceTurn(lobby);
          if (lobby.randomModeEnabled && Math.random() < 0.50) {
            // Retry once if null (e.g. remove_piece on empty grid, double_turn at cap)
            let event = triggerRandomEvent(lobby);
            if (!event) event = triggerRandomEvent(lobby);
            if (event) {
              io.to(roomCode).emit('randomMode:event', event);
            }
          }
        }
        io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode));
      }
    } else if (action === 'return') {
      const result = returnPiece(lobby, shapeId);
      if (!result.ok) {
        return socket.emit('game:error', result.error);
      }
      // Return does NOT advance turn — same player continues (per CONTEXT.md locked decision)
      io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode));
    }
    // Unknown action: silently ignore
  });

  // ── reconnectRoom ─────────────────────────────────────────────────────────
  // Client emits: { roomCode: string, playerName: string }
  // Called on page reload when the player already has credentials in localStorage.
  // Works for both 'lobby' and 'playing' phases.
  // Server responds:
  //   socket.emit('room:error', message)               — if room/player not found
  //   puzzle:list + lobby:update                       — if phase is 'lobby'
  //   socket.emit('game:reconnect', state)             — if phase is 'playing'
  socket.on('reconnectRoom', ({ roomCode, playerName } = {}) => {
    if (!roomCode || typeof roomCode !== 'string') return;
    if (!playerName || typeof playerName !== 'string' || playerName.trim() === '') return;

    const name = playerName.trim().slice(0, 20);
    const lobby = getLobby(roomCode);

    if (!lobby) {
      return socket.emit('room:error', `Room "${roomCode}" not found`);
    }

    const existingPlayer = lobby.players.find(p => p.name === name);
    if (!existingPlayer) {
      return socket.emit('room:error', 'You are not part of this room');
    }

    // Cancel any pending grace-period removal for this player.
    const timerKey = `${roomCode}:${name}`;
    if (disconnectTimers.has(timerKey)) {
      clearTimeout(disconnectTimers.get(timerKey));
      disconnectTimers.delete(timerKey);
    }

    // Race condition fix: browser reload may create the new socket and emit
    // reconnectRoom BEFORE the old socket's 'disconnecting' event fires.
    // We do NOT force-disconnect the old socket here because calling
    // oldSock.disconnect(true) triggers Socket.IO's synchronous cleanup pipeline
    // which corrupts in-flight room state.
    // Instead, just proceed: replacePlayerSocket updates the player's socketId to
    // the new socket. When the old socket eventually fires 'disconnecting' (and the
    // 5-second timer fires), the timer callback checks player.socketId !== oldSocketId
    // and returns early — so the player is never removed.

    replacePlayerSocket(roomCode, name, socket.id);
    socket.data.roomCode = roomCode;
    socket.data.playerName = name;
    socket.join(roomCode);

    if (lobby.phase === 'lobby') {
      socket.emit('puzzle:list', getPuzzleListForClient());
      io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
    } else {
      // Playing phase — send full current state so client can restore the game screen.
      socket.emit('game:reconnect', {
        ...getPublicState(roomCode),
        startTime: lobby.startTime,
      });
    }
  });

  // ── leaveRoom ──────────────────────────────────────────────────────────────
  // Client emits: {}  (lobby phase only — the in-game exit button is not exposed)
  // Intentional voluntary leave: no grace period, immediate cleanup.
  // Socket leaves the Socket.IO room before notifying others so the leaving
  // player does not receive lobby:hostLeft or lobby:update for themselves.
  socket.on('leaveRoom', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const lobby = getLobby(roomCode);
    if (!lobby) return;

    const playerName = socket.data.playerName;
    const socketId = socket.id;
    const timerKey = `${roomCode}:${playerName}`;

    // Cancel any pending grace timer — this is intentional, not a reload.
    if (disconnectTimers.has(timerKey)) {
      clearTimeout(disconnectTimers.get(timerKey));
      disconnectTimers.delete(timerKey);
    }

    // Clear socket state so the subsequent 'disconnecting' event skips cleanup.
    socket.data.roomCode = null;
    socket.data.playerName = null;
    socket.leave(roomCode);

    performLeave(io, roomCode, playerName, socketId);
  });

  // ── disconnecting ──────────────────────────────────────────────────────────
  // CRITICAL: Use 'disconnecting' (not 'disconnect') — socket.rooms is still
  // populated here. socket.data.roomCode is the authoritative room reference.
  // Anti-pattern avoided: NEVER use 'disconnect' for lobby cleanup (see RESEARCH.md Pitfall 2).
  //
  // Grace period: actual removal is deferred by DISCONNECT_GRACE_MS so that a
  // browser reload has time to emit reconnectRoom and reclaim the slot without
  // losing their place. If no reconnect arrives, the timer fires and cleans up.
  socket.on('disconnecting', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const lobby = getLobby(roomCode);
    if (!lobby) return;

    // Capture values now — socket may be GC'd by the time the timer fires.
    const playerName = socket.data.playerName || 'Unknown';
    const oldSocketId = socket.id;
    const key = `${roomCode}:${playerName}`;

    // Cancel any existing timer for this player (e.g., rapid consecutive reloads).
    if (disconnectTimers.has(key)) {
      clearTimeout(disconnectTimers.get(key));
    }

    const timer = setTimeout(() => {
      disconnectTimers.delete(key);

      const currentLobby = getLobby(roomCode);
      if (!currentLobby) return; // lobby already gone

      // If the player reconnected their socketId changed — leave them alone.
      const player = currentLobby.players.find(p => p.name === playerName);
      if (!player || player.socketId !== oldSocketId) return;

      performLeave(io, roomCode, playerName, oldSocketId);
    }, DISCONNECT_GRACE_MS);

    disconnectTimers.set(key, timer);
  });

}

// ── performLeave ─────────────────────────────────────────────────────────────
// Shared removal logic used by both leaveRoom (immediate) and the disconnecting
// grace-period timer. Guards against stale socketId before removing.
// Handles both 'lobby' and 'playing' phases correctly.
function performLeave(io, roomCode, playerName, socketId) {
  const lobby = getLobby(roomCode);
  if (!lobby) return;

  const player = lobby.players.find(p => p.name === playerName);
  if (!player || player.socketId !== socketId) return;

  const isHost = lobby.hostId === socketId;
  const inGame = lobby.phase === 'playing';

  // Adjust turn index BEFORE removal so the next player inherits the correct slot.
  if (inGame) advanceTurnIfActive(lobby, socketId);

  removePlayer(roomCode, socketId);

  if (lobby.players.length === 0) {
    deleteLobby(roomCode);
    return;
  }

  if (isHost) {
    deleteLobby(roomCode);
    io.to(roomCode).emit('lobby:hostLeft', { message: 'Host left — lobby closed' });
    return;
  }

  io.to(roomCode).emit('lobby:playerLeft', { playerName });
  io.to(roomCode).emit(inGame ? 'game:stateUpdate' : 'lobby:update', getPublicState(roomCode));
}

module.exports = registerSocketHandlers;
