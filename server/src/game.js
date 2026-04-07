const fs = require('fs');
const path = require('path');

// ─── In-memory store ────────────────────────────────────────────────────────
// lobbies: Map<roomCode, LobbyState>
// LobbyState shape:
//   { roomCode, hostId, selectedPuzzleId, phase, players, grid }
//   phase: 'lobby' | 'playing'
//   players: [{ socketId, name, isHost }]
//   grid: null in lobby phase; populated at game start (Phase 2)
//   startTime: null in lobby phase; Date.now() ms timestamp when game started
const lobbies = new Map();

// TIME-05: in-memory only — cleared on server restart
const leaderboard = [];

// puzzleMap: Map<puzzleId, puzzleObject> — includes solution (NEVER send to client)
let puzzleMap = new Map();

// ─── Room code generation ────────────────────────────────────────────────────
function generateRoomCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (lobbies.has(code));
  return code;
}

// ─── Lobby operations ────────────────────────────────────────────────────────
function createLobby(roomCode, hostSocketId, hostName) {
  const firstPuzzleId = Array.from(puzzleMap.values()).find(p => p.difficulty != null)?.id
    ?? puzzleMap.keys().next().value;
  lobbies.set(roomCode, {
    roomCode,
    hostId: hostSocketId,
    selectedPuzzleId: firstPuzzleId,
    phase: 'lobby',
    players: [{ socketId: hostSocketId, name: hostName, isHost: true }],
    grid: null,
    randomModeEnabled: false,
    extraTurns: 0,           // Phase 14: double_turn gate
  });
}

function getLobby(roomCode) {
  return lobbies.get(roomCode) || null;
}

function deleteLobby(roomCode) {
  lobbies.delete(roomCode);
}

function getPuzzleById(puzzleId) {
  return puzzleMap.get(puzzleId) || null;
}

// ─── Rotation helpers (PUZZ-03) ──────────────────────────────────────────────
// Rotate a single 90° CW: [dr, dc] → [dc, -dr]
function rotateCells90CW(cells) {
  const rotated = cells.map(([dr, dc]) => [dc, -dr]);
  const minR = Math.min(...rotated.map(([r]) => r));
  const minC = Math.min(...rotated.map(([, c]) => c));
  return rotated.map(([r, c]) => [r - minR, c - minC]);
}

// Rotate cells by a multiple of 90° (0, 90, 180, 270, 360, …), normalizing min to [0,0].
function rotateCells(cells, rotation) {
  const steps = ((Math.round(rotation / 90) % 4) + 4) % 4;
  let current = cells.map(([r, c]) => [r, c]); // shallow copy
  for (let i = 0; i < steps; i++) {
    current = rotateCells90CW(current);
  }
  // Normalize (min row = 0, min col = 0)
  const minR = Math.min(...current.map(([r]) => r));
  const minC = Math.min(...current.map(([, c]) => c));
  return current.map(([r, c]) => [r - minR, c - minC]);
}

// ─── Win detection (WIN-01, GAME-06) ─────────────────────────────────────────
// Internal only — puzzle.solution NEVER forwarded to client.
function checkWin(lobby, puzzle) {
  const { rows, cols } = puzzle.gridSize;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = lobby.grid[r][c];
      if (cell && cell.inactive) continue;   // skip inactive sentinel cells (GRID-04)
      const expectedId = puzzle.solution[r][c];
      if (expectedId === null) {
        if (cell !== null) return false;
      } else {
        if (!cell || cell.shapeId !== expectedId) return false;
      }
    }
  }
  return true;
}

// ─── Move operations (GAME-03, GAME-04, GAME-05) ─────────────────────────────

// Place a movable piece on the grid.
function placePiece(lobby, shapeId, rotation, originRow, originCol) {
  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);
  if (!puzzle) return { ok: false, error: 'Puzzle not found' };

  const shape = puzzle.shapes.find(s => s.id === shapeId);
  if (!shape || !shape.movable) return { ok: false, error: 'Invalid shape' };

  // Check shape not already on grid
  const { rows, cols } = puzzle.gridSize;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = lobby.grid[r][c];
      if (cell && cell.movable && cell.shapeId === shapeId) {
        return { ok: false, error: 'Shape already placed' };
      }
    }
  }

  const rotatedCells = rotateCells(shape.cells, rotation);

  // Validate bounds and emptiness
  for (const [dr, dc] of rotatedCells) {
    const r = originRow + dr;
    const c = originCol + dc;
    if (r < 0 || r >= rows || c < 0 || c >= cols) {
      return { ok: false, error: 'Piece out of bounds' };
    }
    if (lobby.grid[r][c] !== null) {
      return { ok: false, error: 'Cell occupied' };
    }
  }

  // Write cells
  for (const [dr, dc] of rotatedCells) {
    lobby.grid[originRow + dr][originCol + dc] = { shapeId, movable: true };
  }

  const win = checkWin(lobby, puzzle);
  return { ok: true, win };
}

// Return a placed movable piece to the bank.
function returnPiece(lobby, shapeId) {
  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);
  if (!puzzle) return { ok: false, error: 'Puzzle not found' };

  const shape = puzzle.shapes.find(s => s.id === shapeId);
  if (!shape || !shape.movable) return { ok: false, error: 'Invalid shape' };

  const { rows, cols } = puzzle.gridSize;
  let found = false;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = lobby.grid[r][c];
      if (cell && cell.movable && cell.shapeId === shapeId) {
        lobby.grid[r][c] = null;
        found = true;
      }
    }
  }

  if (!found) return { ok: false, error: 'Shape not on grid' };
  return { ok: true };
}

// ─── Turn helpers (GAME-07, GAME-08, GAME-09) ─────────────────────────────────

// Advance the active turn to the next player (circular).
function advanceTurn(lobby) {
  if (!lobby.players || lobby.players.length === 0) return;
  lobby.activeTurnIndex = (lobby.activeTurnIndex + 1) % lobby.players.length;
}

// ─── Safe serialization (GAME-06 invariant: solution NEVER leaves server) ────
// This is the ONLY function that may produce outbound state payloads.
// It MUST NOT include puzzle.solution or any field derived from it.
function getPublicState(roomCode) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return null;
  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);

  // Compute bankShapes: movable shapes not currently on grid
  let bankShapes = [];
  if (puzzle && lobby.grid) {
    const { rows, cols } = puzzle.gridSize;
    const placedShapeIds = new Set();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = lobby.grid[r][c];
        if (cell && cell.movable) placedShapeIds.add(cell.shapeId);
      }
    }
    bankShapes = puzzle.shapes
      .filter(s => s.movable && !placedShapeIds.has(s.id))
      .map(s => ({ id: s.id, cells: s.cells }));
  }

  const activeTurnIndex = lobby.activeTurnIndex ?? 0;
  const activePlayer = lobby.players[activeTurnIndex] || null;

  return {
    roomCode: lobby.roomCode,
    phase: lobby.phase,
    players: lobby.players.map(p => ({ name: p.name, isHost: p.isHost, socketId: p.socketId })),
    selectedPuzzleName: puzzle ? puzzle.name : null,
    selectedPuzzleDifficulty: puzzle ? (puzzle.difficulty ?? null) : null,
    selectedPuzzleId: lobby.selectedPuzzleId,
    grid: lobby.grid,         // null in lobby phase; 2D array in playing phase
    gridSize: puzzle ? puzzle.gridSize : null,
    activePlayerName: activePlayer ? activePlayer.name : null,
    activeTurnIndex,
    bankShapes,
    randomMode: lobby.randomModeEnabled ?? false,
    extraTurns: lobby.extraTurns ?? 0,  // Phase 14: client needs for ⚡ badge
    // solution: intentionally NEVER included — GAME-06 invariant
  };
}

// ─── Safe puzzle list for client dropdown ────────────────────────────────────
function getPuzzleListForClient() {
  return Array.from(puzzleMap.values())
    .filter(p => p.difficulty != null)
    .map(p => ({
      id: p.id,
      name: p.name,
      difficulty: p.difficulty,
      // solution NEVER included
    }));
}

// ─── Anchor shape pre-placement (PUZZ-02) ────────────────────────────────────
// Called at game start (Phase 2 will call this; defined here so grid shape is
// established in Phase 1 for getPublicState to reference the type correctly).
function buildInitialGrid(puzzle) {
  // Build a fast lookup Set from inactiveCells (if present)
  const inactiveSet = new Set(
    (puzzle.inactiveCells || []).map(([r, c]) => `${r}-${c}`)
  );

  // Single-pass initialization: sentinel for inactive, null for active
  const grid = Array.from({ length: puzzle.gridSize.rows }, (_, r) =>
    Array.from({ length: puzzle.gridSize.cols }, (_, c) =>
      inactiveSet.has(`${r}-${c}`) ? { inactive: true } : null
    )
  );

  // Place anchor shapes (unchanged logic from original)
  for (const shape of puzzle.shapes) {
    if (!shape.movable && Array.isArray(shape.position)) {
      const [originRow, originCol] = shape.position;
      for (const [dr, dc] of shape.cells) {
        const r = originRow + dr;
        const c = originCol + dc;
        if (r >= 0 && r < puzzle.gridSize.rows && c >= 0 && c < puzzle.gridSize.cols) {
          grid[r][c] = { shapeId: shape.id, movable: false };
        }
      }
    }
  }

  return grid;
}

// ─── Puzzle loading and schema validation (PUZZ-01) ──────────────────────────
function validatePuzzleSchema(puzzle) {
  if (!puzzle.id || typeof puzzle.id !== 'string')
    throw new Error('Missing or invalid "id"');
  if (!puzzle.name || typeof puzzle.name !== 'string')
    throw new Error('Missing or invalid "name"');
  if (!puzzle.gridSize || typeof puzzle.gridSize.rows !== 'number' || typeof puzzle.gridSize.cols !== 'number')
    throw new Error('Missing or invalid "gridSize" (needs rows and cols as numbers)');
  if (!Array.isArray(puzzle.shapes) || puzzle.shapes.length === 0)
    throw new Error('"shapes" must be a non-empty array');
  for (const shape of puzzle.shapes) {
    if (!shape.id || typeof shape.id !== 'string')
      throw new Error('Each shape must have a string "id"');
    if (!Array.isArray(shape.cells) || shape.cells.length === 0)
      throw new Error(`Shape "${shape.id}": "cells" must be a non-empty array`);
    if (typeof shape.movable !== 'boolean')
      throw new Error(`Shape "${shape.id}": "movable" must be a boolean`);
    if (!shape.movable && !Array.isArray(shape.position))
      throw new Error(`Anchor shape "${shape.id}": "position" array required when movable is false`);
  }
  if (!Array.isArray(puzzle.solution))
    throw new Error('Missing "solution" array');
  if (puzzle.difficulty !== undefined && typeof puzzle.difficulty !== 'string') {
    throw new Error('"difficulty" must be a string if present');
  }
  // ── Block 1: inactiveCells format validation (optional field) ──────────────
  if (puzzle.inactiveCells !== undefined) {
    if (!Array.isArray(puzzle.inactiveCells))
      throw new Error('"inactiveCells" must be an array');
    for (const entry of puzzle.inactiveCells) {
      if (!Array.isArray(entry) || entry.length !== 2 ||
          typeof entry[0] !== 'number' || typeof entry[1] !== 'number')
        throw new Error('Each "inactiveCells" entry must be a [row, col] number array');
      const [r, c] = entry;
      if (r < 0 || r >= puzzle.gridSize.rows || c < 0 || c >= puzzle.gridSize.cols)
        throw new Error(`inactiveCells entry [${r},${c}] is out of bounds for gridSize ${puzzle.gridSize.rows}x${puzzle.gridSize.cols}`);
    }

    // ── Block 2: cell-count cross-check (only when inactiveCells declared) ──
    const totalShapeCells = puzzle.shapes.reduce((sum, s) => sum + s.cells.length, 0);
    const activeSolutionCells = puzzle.solution.flat().filter(id => id !== null).length;
    if (totalShapeCells !== activeSolutionCells) {
      throw new Error(
        `Shapes cover ${totalShapeCells} cells but solution has ${activeSolutionCells} active cells — puzzle is unsolvable`
      );
    }
  }
}

function loadPuzzles() {
  const PUZZLES_DIR = path.join(__dirname, '../../puzzles');
  const loaded = new Map();

  let files;
  try {
    files = fs.readdirSync(PUZZLES_DIR).filter(f => f.endsWith('.json'));
  } catch (err) {
    console.error(`[PuzzleLoader] Cannot read puzzles directory: ${err.message}`);
    process.exit(1);
  }

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(PUZZLES_DIR, file), 'utf-8');
      const puzzle = JSON.parse(raw);
      validatePuzzleSchema(puzzle);
      loaded.set(puzzle.id, puzzle);
      console.log(`[PuzzleLoader] Loaded "${puzzle.name}" (${file})`);
    } catch (err) {
      console.error(`[PuzzleLoader] Skipping ${file}: ${err.message}`);
    }
  }

  if (loaded.size === 0) {
    console.error('No valid puzzles found in /puzzles — add at least one');
    process.exit(1);
  }

  console.log(`[PuzzleLoader] ${loaded.size} puzzle(s) ready`);
  puzzleMap = loaded;
  return loaded;
}

// ─── Lobby mutation helpers (used by socket.js) ──────────────────────────────

function addPlayer(roomCode, socketId, name) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return false;
  lobby.players.push({ socketId, name, isHost: false });
  return true;
}

function removePlayer(roomCode, socketId) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return false;
  lobby.players = lobby.players.filter(p => p.socketId !== socketId);
  return true;
}

function setSelectedPuzzle(roomCode, puzzleId) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return false;
  if (!puzzleMap.has(puzzleId)) return false;
  lobby.selectedPuzzleId = puzzleId;
  return true;
}

function setRandomMode(roomCode, enabled) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return false;
  lobby.randomModeEnabled = !!enabled;
  return true;
}

// ─── Random event helpers (private) ──────────────────────────────────────────

function pickRandomEvent() {
  const r = Math.random();
  if (r < 0.10) return 'rotate_piece';    // 10%
  if (r < 0.25) return 'skip_turn';       // 15%
  if (r < 0.45) return 'remove_piece';    // 20%
  if (r < 0.60) return 'shuffle_order';   // 15%
  if (r < 0.75) return 'double_turn';     // 15%
  if (r < 0.90) return 'reverse_order';   // 15%
  return 'blind_bank';                    // 10%
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// ─── Random event dispatcher (RAND-01) ───────────────────────────────────────
// _forceEventType is only for test overrides; production calls pass one arg.

function triggerRandomEvent(lobby, _forceEventType) {
  const eventType = _forceEventType ?? pickRandomEvent();
  const activePlayerName = lobby.players[lobby.activeTurnIndex]?.name ?? 'Unbekannt';

  if (eventType === 'rotate_piece') {
    return {
      type: 'rotate_piece',
      description: `Chaos! ${activePlayerName}'s Stein wurde rotiert!`,
    };
  }

  if (eventType === 'skip_turn') {
    if (lobby.players.length <= 1) return null;
    advanceTurn(lobby);
    return {
      type: 'skip_turn',
      description: `Chaos! ${activePlayerName} verliert seinen Zug!`,
    };
  }

  if (eventType === 'remove_piece') {
    const { rows, cols } = getPuzzleById(lobby.selectedPuzzleId)?.gridSize ?? { rows: 0, cols: 0 };
    const movableShapeIds = new Set();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = lobby.grid[r][c];
        if (cell && cell.movable === true) movableShapeIds.add(cell.shapeId);
      }
    }
    if (movableShapeIds.size === 0) return null;
    const ids = Array.from(movableShapeIds);
    const shapeId = ids[Math.floor(Math.random() * ids.length)];
    returnPiece(lobby, shapeId);
    return {
      type: 'remove_piece',
      description: `Chaos! ${shapeId} wurde vom Spielfeld entfernt!`,
    };
  }

  if (eventType === 'shuffle_order') {
    shuffleArray(lobby.players);
    lobby.activeTurnIndex = 0;
    return {
      type: 'shuffle_order',
      description: 'Chaos! Die Spielerreihenfolge wurde durchgemischt!',
    };
  }

  if (eventType === 'double_turn') {
    if (lobby.extraTurns > 0) return null; // no stacking cap
    lobby.extraTurns = 1;
    return {
      type: 'double_turn',
      description: `Chaos! ${activePlayerName} bekommt einen zweiten Zug!`,
    };
  }

  if (eventType === 'reverse_order') {
    lobby.players.reverse();
    lobby.activeTurnIndex = 0;
    return {
      type: 'reverse_order',
      description: 'Chaos! Die Reihenfolge wurde umgekehrt!',
    };
  }

  if (eventType === 'blind_bank') {
    return {
      type: 'blind_bank',
      description: 'Chaos! Alle sind blind für 5 Sekunden!',
    };
  }

  return null;
}

function startGame(roomCode) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return { ok: false, error: 'Room not found' };
  if (lobby.players.length < 2) return { ok: false, error: 'Need at least 2 players to start' };
  if (lobby.phase !== 'lobby') return { ok: false, error: 'Game already started' };

  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);
  if (!puzzle) return { ok: false, error: 'Selected puzzle not found' };

  lobby.phase = 'playing';
  lobby.grid = buildInitialGrid(puzzle);
  lobby.activeTurnIndex = 0;          // Phase 2 uses this; set here for consistency
  lobby.startTime = Date.now();       // TIME-01: authoritative start moment
  lobby.extraTurns = 0;              // Phase 14: reset on game restart (Pitfall 3)
  return { ok: true };
}

// ─── Leaderboard (TIME-04, TIME-05) ──────────────────────────────────────────

function formatTime(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function recordLeaderboardEntry(lobby, elapsedMs) {
  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);
  leaderboard.push({
    puzzleName: puzzle ? puzzle.name : 'Unknown',
    elapsedMs,
    playerNames: lobby.players.map(p => p.name),   // name strings only (Pitfall 5)
  });
  leaderboard.sort((a, b) => a.elapsedMs - b.elapsedMs);
}

function getLeaderboard() {
  return leaderboard.map((e, i) => ({
    rank: i + 1,
    puzzleName: e.puzzleName,
    time: formatTime(e.elapsedMs),   // pre-formatted MM:SS for client
    playerNames: e.playerNames,
  }));
}

// GAME-09: advance turn index when a player disconnects.
// Called BEFORE the player is removed from lobby.players.
function advanceTurnIfActive(lobby, socketId) {
  if (!lobby || lobby.phase !== 'playing') return;
  const disconnectingIndex = lobby.players.findIndex(p => p.socketId === socketId);
  if (disconnectingIndex === -1) return;

  const newLength = lobby.players.length - 1;

  if (disconnectingIndex === lobby.activeTurnIndex) {
    // Active player disconnecting
    if (newLength === 0) {
      lobby.activeTurnIndex = 0;
    } else {
      lobby.activeTurnIndex = lobby.activeTurnIndex % newLength;
    }
  } else if (disconnectingIndex < lobby.activeTurnIndex) {
    // Non-active player with index below active player — shift down
    lobby.activeTurnIndex = Math.max(0, lobby.activeTurnIndex - 1);
  }
  // Non-active player with index >= activeTurnIndex: no change
}

module.exports = {
  lobbies,
  generateRoomCode,
  createLobby,
  getLobby,
  deleteLobby,
  getPuzzleById,
  getPublicState,
  getPuzzleListForClient,
  buildInitialGrid,
  loadPuzzles,
  validatePuzzleSchema,
  addPlayer,
  removePlayer,
  setSelectedPuzzle,
  startGame,
  // Phase 2 exports:
  rotateCells,
  placePiece,
  returnPiece,
  checkWin,
  advanceTurn,
  advanceTurnIfActive,
  // Phase 3 exports:
  recordLeaderboardEntry,
  getLeaderboard,
  // Phase 9 exports (Random Mode):
  setRandomMode,
  triggerRandomEvent,
  // Phase 14 exports (Random Mode Overhaul):
  pickRandomEvent,
};
