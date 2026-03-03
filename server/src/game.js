const fs = require('fs');
const path = require('path');

// ─── In-memory store ────────────────────────────────────────────────────────
// lobbies: Map<roomCode, LobbyState>
// LobbyState shape:
//   { roomCode, hostId, selectedPuzzleId, phase, players, grid }
//   phase: 'lobby' | 'playing'
//   players: [{ socketId, name, isHost }]
//   grid: null in lobby phase; populated at game start (Phase 2)
const lobbies = new Map();

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
  const firstPuzzleId = puzzleMap.keys().next().value;
  lobbies.set(roomCode, {
    roomCode,
    hostId: hostSocketId,
    selectedPuzzleId: firstPuzzleId,
    phase: 'lobby',
    players: [{ socketId: hostSocketId, name: hostName, isHost: true }],
    grid: null,
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

// ─── Safe serialization (GAME-06 invariant: solution NEVER leaves server) ────
// This is the ONLY function that may produce outbound state payloads.
// It MUST NOT include puzzle.solution or any field derived from it.
function getPublicState(roomCode) {
  const lobby = lobbies.get(roomCode);
  if (!lobby) return null;
  const puzzle = puzzleMap.get(lobby.selectedPuzzleId);
  return {
    roomCode: lobby.roomCode,
    phase: lobby.phase,
    players: lobby.players.map(p => ({ name: p.name, isHost: p.isHost, socketId: p.socketId })),
    selectedPuzzleName: puzzle ? puzzle.name : null,
    selectedPuzzleId: lobby.selectedPuzzleId,
    grid: lobby.grid,         // null in lobby phase; 2D array in playing phase
    gridSize: puzzle ? puzzle.gridSize : null,
    // solution: intentionally omitted — NEVER include
  };
}

// ─── Safe puzzle list for client dropdown ────────────────────────────────────
function getPuzzleListForClient() {
  return Array.from(puzzleMap.values()).map(p => ({
    id: p.id,
    name: p.name,
    // gridSize intentionally omitted (name only in dropdown per locked decision)
    // solution NEVER included
  }));
}

// ─── Anchor shape pre-placement (PUZZ-02) ────────────────────────────────────
// Called at game start (Phase 2 will call this; defined here so grid shape is
// established in Phase 1 for getPublicState to reference the type correctly).
function buildInitialGrid(puzzle) {
  const grid = Array.from({ length: puzzle.gridSize.rows }, () =>
    Array(puzzle.gridSize.cols).fill(null)
  );
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
};
