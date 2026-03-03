const {
  generateRoomCode,
  createLobby,
  getLobby,
  deleteLobby,
  addPlayer,
  removePlayer,
  setSelectedPuzzle,
  startGame,
  advanceTurnIfActive,
  getPublicState,
  getPuzzleListForClient,
} = require('./game');

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
    const lobby = getLobby(roomCode);

    if (!lobby) {
      return socket.emit('room:error', `Room "${roomCode}" not found`);
    }
    if (lobby.phase !== 'lobby') {
      return socket.emit('room:error', 'Game has already started');
    }
    if (lobby.players.some(p => p.name === name)) {
      return socket.emit('room:error', `Name "${name}" is already taken in this room`);
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
    io.to(roomCode).emit('game:start', getPublicState(roomCode));
  });

  // ── disconnecting ──────────────────────────────────────────────────────────
  // CRITICAL: Use 'disconnecting' (not 'disconnect') — socket.rooms is still
  // populated here. socket.data.roomCode is the authoritative room reference.
  // Anti-pattern avoided: NEVER use 'disconnect' for lobby cleanup (see RESEARCH.md Pitfall 2).
  socket.on('disconnecting', () => {
    const roomCode = socket.data.roomCode;
    if (!roomCode) return;

    const lobby = getLobby(roomCode);
    if (!lobby) return;

    const wasHost = lobby.hostId === socket.id;
    const playerName = socket.data.playerName || 'Unknown';
    const wasInGame = lobby.phase === 'playing';

    // GAME-09: advance turn before removing player (if they were active)
    if (wasInGame) {
      advanceTurnIfActive(lobby, socket.id);
    }

    removePlayer(roomCode, socket.id);

    // GAME-10: destroy lobby if empty
    if (lobby.players.length === 0) {
      deleteLobby(roomCode);
      return;
    }

    // Host left during lobby phase -> destroy and notify remaining players
    if (wasHost && !wasInGame) {
      deleteLobby(roomCode);
      socket.to(roomCode).emit('lobby:hostLeft', { message: 'Host left — lobby closed' });
      return;
    }

    // Notify remaining players of departure
    socket.to(roomCode).emit('lobby:playerLeft', { playerName });

    // Broadcast updated state
    if (wasInGame) {
      io.to(roomCode).emit('game:stateUpdate', getPublicState(roomCode));
    } else {
      io.to(roomCode).emit('lobby:update', getPublicState(roomCode));
    }
  });
}

module.exports = registerSocketHandlers;
