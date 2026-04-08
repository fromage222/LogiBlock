'use strict';

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');

const {
  lobbies,
  loadPuzzles,
  validatePuzzleSchema,
  createLobby,
  startGame,
  addPlayer,
  getPublicState,
  rotateCells,
  placePiece,
  returnPiece,
  checkWin,
  advanceTurn,
  advanceTurnIfActive,
  buildInitialGrid,
  getPuzzleById,
  setSelectedPuzzle,
  setRandomMode,
  triggerRandomEvent,
} = require('./game');

// ─── One-time setup: load puzzles before any test runs ────────────────────────
before(() => {
  loadPuzzles();
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeLobby(roomCode = 'TEST01') {
  lobbies.delete(roomCode);
  createLobby(roomCode, 'host-socket', 'Alice');
  addPlayer(roomCode, 'p2-socket', 'Bob');
  setSelectedPuzzle(roomCode, 'puzzle_01');
  const result = startGame(roomCode);
  if (!result.ok) throw new Error('startGame failed: ' + result.error);
  return lobbies.get(roomCode);
}

function makeLobbyV11(roomCode) {
  lobbies.delete(roomCode);
  createLobby(roomCode, 'host-socket', 'Alice');
  addPlayer(roomCode, 'p2-socket', 'Bob');
  setSelectedPuzzle(roomCode, 'puzzle_v11');
  const result = startGame(roomCode);
  if (!result.ok) throw new Error('startGame failed: ' + result.error);
  return lobbies.get(roomCode);
}

// ─── rotateCells ─────────────────────────────────────────────────────────────

describe('rotateCells', () => {
  it('rotation 0 returns original cells (unchanged)', () => {
    const cells = [[0,0],[0,1],[1,0]];
    const result = rotateCells(cells, 0);
    // Order may differ — compare as sorted sets
    const sorted = (arr) => [...arr].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    assert.deepEqual(sorted(result), sorted(cells));
  });

  it('rotation 90 CW: [dr,dc] → [dc,-dr] normalized', () => {
    // L-shape: [0,0],[0,1],[1,0]
    // 90 CW: each [dr,dc] → [dc,-dr]
    //   [0,0] → [0,0]
    //   [0,1] → [1,0]
    //   [1,0] → [0,-1] → normalized to [0,0] shift: minR=0,minC=-1 → add 1 to all cols
    //   final: [0,1],[1,1],[0,0] → sorted: [0,0],[0,1],[1,1]
    const cells = [[0,0],[0,1],[1,0]];
    const result = rotateCells(cells, 90);
    const sorted = (arr) => [...arr].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    assert.deepEqual(sorted(result), sorted([[0,0],[0,1],[1,1]]));
  });

  it('rotation 180 returns shape rotated 180 degrees, normalized', () => {
    const cells = [[0,0],[0,1],[1,1]];
    const at0   = rotateCells(cells, 0);
    const at180 = rotateCells(cells, 180);
    // 180 should differ from 0 for asymmetric shapes
    assert.notDeepEqual(at0, at180);
    // All values must be >= 0 (normalized)
    for (const [r, c] of at180) {
      assert.ok(r >= 0, `row ${r} is negative`);
      assert.ok(c >= 0, `col ${c} is negative`);
    }
  });

  it('4 × 90° CW returns to original shape', () => {
    const cells = [[0,0],[0,1],[1,1]];
    const sorted = (arr) => [...arr].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const at0   = sorted(rotateCells(cells, 0));
    const at360 = sorted(rotateCells(cells, 360));
    assert.deepEqual(at360, at0);
  });

  it('rotation 270: output never contains negative values (normalized)', () => {
    const cells = [[0,0],[0,1],[1,0],[1,1]];
    const result = rotateCells(cells, 270);
    for (const [r, c] of result) {
      assert.ok(r >= 0, `row ${r} is negative`);
      assert.ok(c >= 0, `col ${c} is negative`);
    }
  });

  it('min row and min col of result are always 0 (normalized)', () => {
    const cells = [[0,0],[0,1],[0,2],[1,2]];
    for (const deg of [0, 90, 180, 270]) {
      const result = rotateCells(cells, deg);
      const minR = Math.min(...result.map(([r]) => r));
      const minC = Math.min(...result.map(([, c]) => c));
      assert.equal(minR, 0, `minR for ${deg}° should be 0`);
      assert.equal(minC, 0, `minC for ${deg}° should be 0`);
    }
  });
});

// ─── checkWin ─────────────────────────────────────────────────────────────────

describe('checkWin', () => {
  it('returns false when grid has null where solution expects a shapeId', () => {
    const lobby = makeLobby('CWTEST1');
    // Grid is freshly started — movable shapes not placed yet
    const puzzle = require('./game').getPuzzleById(lobby.selectedPuzzleId);
    assert.equal(checkWin(lobby, puzzle), false);
  });

  it('returns true when every cell matches puzzle solution exactly', () => {
    const lobby = makeLobby('CWTEST2');
    const puzzle = require('./game').getPuzzleById(lobby.selectedPuzzleId);
    // Build a grid that exactly matches solution
    const { rows, cols } = puzzle.gridSize;
    const grid = [];
    for (let r = 0; r < rows; r++) {
      grid.push([]);
      for (let c = 0; c < cols; c++) {
        const sid = puzzle.solution[r][c];
        grid[r].push(sid ? { shapeId: sid, movable: sid !== 'A' } : null);
      }
    }
    lobby.grid = grid;
    assert.equal(checkWin(lobby, puzzle), true);
  });

  it('returns false when a non-null solution cell has a wrong shapeId in grid', () => {
    const lobby = makeLobby('CWTEST3');
    const puzzle = require('./game').getPuzzleById(lobby.selectedPuzzleId);
    // Build matching grid then corrupt one cell
    const { rows, cols } = puzzle.gridSize;
    const grid = [];
    for (let r = 0; r < rows; r++) {
      grid.push([]);
      for (let c = 0; c < cols; c++) {
        const sid = puzzle.solution[r][c];
        grid[r].push(sid ? { shapeId: sid, movable: sid !== 'A' } : null);
      }
    }
    // Overwrite a movable cell with a wrong shapeId
    outer:
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (puzzle.solution[r][c] !== null && grid[r][c] && grid[r][c].movable) {
          grid[r][c] = { shapeId: 'WRONG', movable: true };
          break outer;
        }
      }
    }
    lobby.grid = grid;
    assert.equal(checkWin(lobby, puzzle), false);
  });

  it('returns false when a null solution cell has something in grid', () => {
    const lobby = makeLobby('CWTEST4');
    const puzzle = require('./game').getPuzzleById(lobby.selectedPuzzleId);
    const { rows, cols } = puzzle.gridSize;
    const grid = [];
    for (let r = 0; r < rows; r++) {
      grid.push([]);
      for (let c = 0; c < cols; c++) {
        const sid = puzzle.solution[r][c];
        grid[r].push(sid ? { shapeId: sid, movable: sid !== 'A' } : null);
      }
    }
    // Put something in a null solution cell
    outer:
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (puzzle.solution[r][c] === null) {
          grid[r][c] = { shapeId: 'X', movable: true };
          break outer;
        }
      }
    }
    lobby.grid = grid;
    assert.equal(checkWin(lobby, puzzle), false);
  });
});

// ─── placePiece ───────────────────────────────────────────────────────────────

describe('placePiece', () => {
  // puzzle_01: shape B = [[0,0],[0,1],[1,1]] at 0° → fits at origin (1,1) in 4×4 grid
  // shape C = [[0,0],[1,0],[1,1]]

  it('returns { ok: true, win: false } for valid placement', () => {
    const lobby = makeLobby('PP01');
    // Place shape B at row 0, col 1 with 0° rotation
    const result = placePiece(lobby, 'B', 0, 0, 1);
    assert.equal(result.ok, true);
    assert.equal(result.win, false);
  });

  it('writes cells as { shapeId, movable: true } after successful placement', () => {
    const lobby = makeLobby('PP02');
    placePiece(lobby, 'B', 0, 0, 1);
    // B at (0,1): cells [0,0],[0,1],[1,1] → absolute (0,1),(0,2),(1,2)
    assert.deepEqual(lobby.grid[0][1], { shapeId: 'B', movable: true });
    assert.deepEqual(lobby.grid[0][2], { shapeId: 'B', movable: true });
    assert.deepEqual(lobby.grid[1][2], { shapeId: 'B', movable: true });
  });

  it('returns { ok: false, error: "Cell occupied" } when target cell is already filled', () => {
    const lobby = makeLobby('PP03');
    placePiece(lobby, 'B', 0, 0, 1); // place B at (0,1)
    // Try placing C at (0,1) where B already occupies (0,1)
    const result = placePiece(lobby, 'C', 0, 0, 1);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Cell occupied');
  });

  it('returns { ok: false, error: "Piece out of bounds" } when any cell is outside grid', () => {
    const lobby = makeLobby('PP04');
    // B shape [[0,0],[0,1],[1,1]] at origin (3,3) in 4×4 grid → (3,4) out of bounds
    const result = placePiece(lobby, 'B', 0, 3, 3);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Piece out of bounds');
  });

  it('returns { ok: false, error: "Shape already placed" } when shape is already on grid', () => {
    const lobby = makeLobby('PP05');
    placePiece(lobby, 'B', 0, 0, 1);
    const result = placePiece(lobby, 'B', 0, 2, 0);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Shape already placed');
  });

  it('returns { ok: false, error: "Invalid shape" } for unknown shapeId', () => {
    const lobby = makeLobby('PP06');
    const result = placePiece(lobby, 'UNKNOWN', 0, 0, 0);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Invalid shape');
  });

  it('returns { ok: false, error: "Invalid shape" } for anchor shape (non-movable)', () => {
    const lobby = makeLobby('PP07');
    // Shape A is anchor (movable: false)
    const result = placePiece(lobby, 'A', 0, 0, 0);
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Invalid shape');
  });

  it('returns { ok: true, win: true } when placement completes the solution', () => {
    // puzzle_01 solution:
    // row0: A B B null
    // row1: A C B null
    // row2: A C C null
    // row3: null null null null
    // A is anchor at (0,0): covers (0,0),(1,0),(2,0)
    // B shape [[0,0],[0,1],[1,1]] at 0° → place at origin (0,1): covers (0,1),(0,2),(1,2) ✓
    // C shape [[0,0],[1,0],[1,1]] at 0° → place at origin (1,1): covers (1,1),(2,1),(2,2) ✓
    const lobby = makeLobby('PP08');
    placePiece(lobby, 'B', 0, 0, 1);
    const result = placePiece(lobby, 'C', 0, 1, 1);
    assert.equal(result.ok, true);
    assert.equal(result.win, true);
  });
});

// ─── returnPiece ──────────────────────────────────────────────────────────────

describe('returnPiece', () => {
  it('returns { ok: true } and clears movable cells for a placed shape', () => {
    const lobby = makeLobby('RP01');
    placePiece(lobby, 'B', 0, 0, 1);
    const result = returnPiece(lobby, 'B');
    assert.equal(result.ok, true);
    // B cells: (0,1),(0,2),(1,2) should all be null now
    assert.equal(lobby.grid[0][1], null);
    assert.equal(lobby.grid[0][2], null);
    assert.equal(lobby.grid[1][2], null);
  });

  it('returns { ok: false, error: "Shape not on grid" } when shape is not placed', () => {
    const lobby = makeLobby('RP02');
    const result = returnPiece(lobby, 'B');
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Shape not on grid');
  });

  it('returns { ok: false, error: "Invalid shape" } for unknown shapeId', () => {
    const lobby = makeLobby('RP03');
    const result = returnPiece(lobby, 'UNKNOWN');
    assert.equal(result.ok, false);
    assert.equal(result.error, 'Invalid shape');
  });

  it('does not clear non-movable anchor cells', () => {
    const lobby = makeLobby('RP04');
    // Anchor A is at (0,0),(1,0),(2,0) — returnPiece should reject since A is not movable
    const result = returnPiece(lobby, 'A');
    assert.equal(result.ok, false);
    // Anchor cells should remain intact
    assert.deepEqual(lobby.grid[0][0], { shapeId: 'A', movable: false });
  });
});

// ─── advanceTurn ──────────────────────────────────────────────────────────────

describe('advanceTurn', () => {
  it('increments activeTurnIndex by 1', () => {
    const lobby = makeLobby('AT01');
    lobby.activeTurnIndex = 0;
    advanceTurn(lobby);
    assert.equal(lobby.activeTurnIndex, 1);
  });

  it('wraps around modulo players.length', () => {
    const lobby = makeLobby('AT02');
    // lobby has 2 players (Alice + Bob)
    lobby.activeTurnIndex = 1;
    advanceTurn(lobby);
    assert.equal(lobby.activeTurnIndex, 0);
  });

  it('is a no-op when players.length === 0', () => {
    const lobby = makeLobby('AT03');
    lobby.players = [];
    lobby.activeTurnIndex = 0;
    advanceTurn(lobby);
    assert.equal(lobby.activeTurnIndex, 0);
  });
});

// ─── advanceTurnIfActive ──────────────────────────────────────────────────────

describe('advanceTurnIfActive', () => {
  it('adjusts activeTurnIndex when active player disconnects (newLength > 0)', () => {
    const lobby = makeLobby('ATIA01');
    // 2 players: Alice (index 0) is active
    lobby.activeTurnIndex = 0;
    const aliceId = lobby.players[0].socketId;
    // Bob's index is 1 >= activeTurnIndex after Alice removed
    advanceTurnIfActive(lobby, aliceId);
    // newLength = 1; activeTurnIndex = 0 % 1 = 0
    assert.equal(lobby.activeTurnIndex, 0);
  });

  it('sets activeTurnIndex = 0 when active player disconnects and no players remain', () => {
    const lobby = makeLobby('ATIA02');
    lobby.players = [{ socketId: 'only', name: 'Solo', isHost: true }];
    lobby.activeTurnIndex = 0;
    advanceTurnIfActive(lobby, 'only');
    assert.equal(lobby.activeTurnIndex, 0);
  });

  it('decrements activeTurnIndex when non-active lower-index player disconnects', () => {
    // 3 players: index 0=Alice, 1=Bob, 2=Carol; active is index 2
    const lobby = makeLobby('ATIA03');
    lobby.players = [
      { socketId: 'alice', name: 'Alice', isHost: true },
      { socketId: 'bob',   name: 'Bob',   isHost: false },
      { socketId: 'carol', name: 'Carol', isHost: false },
    ];
    lobby.activeTurnIndex = 2;
    // Bob (index 1) disconnects — index 1 < activeTurnIndex 2
    advanceTurnIfActive(lobby, 'bob');
    assert.equal(lobby.activeTurnIndex, 1);
  });

  it('leaves activeTurnIndex unchanged when non-active higher-index player disconnects', () => {
    // 3 players: active is index 0; Carol (index 2) disconnects
    const lobby = makeLobby('ATIA04');
    lobby.players = [
      { socketId: 'alice', name: 'Alice', isHost: true },
      { socketId: 'bob',   name: 'Bob',   isHost: false },
      { socketId: 'carol', name: 'Carol', isHost: false },
    ];
    lobby.activeTurnIndex = 0;
    advanceTurnIfActive(lobby, 'carol');
    assert.equal(lobby.activeTurnIndex, 0);
  });

  it('does nothing if lobby is not in playing phase', () => {
    const lobby = makeLobby('ATIA05');
    lobby.phase = 'lobby';
    lobby.activeTurnIndex = 0;
    const aliceId = lobby.players[0].socketId;
    advanceTurnIfActive(lobby, aliceId);
    assert.equal(lobby.activeTurnIndex, 0);
  });
});

// ─── getPublicState extension ─────────────────────────────────────────────────

describe('getPublicState Phase 2 extension', () => {
  it('includes activePlayerName (name of current turn player)', () => {
    const lobby = makeLobby('GPS01');
    lobby.activeTurnIndex = 0;
    const state = getPublicState('GPS01');
    assert.equal(state.activePlayerName, lobby.players[0].name);
  });

  it('includes activeTurnIndex', () => {
    const lobby = makeLobby('GPS02');
    lobby.activeTurnIndex = 1;
    const state = getPublicState('GPS02');
    assert.equal(state.activeTurnIndex, 1);
  });

  it('includes bankShapes: movable shapes not yet placed on grid', () => {
    const lobby = makeLobby('GPS03');
    const state = getPublicState('GPS03');
    // Initially no movable shapes placed — all movable shapes should be in bank
    const puzzle = require('./game').getPuzzleById(lobby.selectedPuzzleId);
    const movableCount = puzzle.shapes.filter(s => s.movable).length;
    assert.equal(state.bankShapes.length, movableCount);
  });

  it('bankShapes shrinks after placing a piece', () => {
    const lobby = makeLobby('GPS04');
    const stateBefore = getPublicState('GPS04');
    placePiece(lobby, 'B', 0, 0, 1);
    const stateAfter = getPublicState('GPS04');
    assert.equal(stateAfter.bankShapes.length, stateBefore.bankShapes.length - 1);
  });

  it('bankShapes items have { id, cells } shape', () => {
    const lobby = makeLobby('GPS05');
    const state = getPublicState('GPS05');
    for (const shape of state.bankShapes) {
      assert.ok(typeof shape.id === 'string', 'bankShape.id must be string');
      assert.ok(Array.isArray(shape.cells), 'bankShape.cells must be array');
    }
  });

  it('NEVER includes "solution" key in output (GAME-06 invariant)', () => {
    const lobby = makeLobby('GPS06');
    const state = getPublicState('GPS06');
    const json = JSON.stringify(state);
    assert.ok(!json.includes('"solution"'), 'solution key found in public state — GAME-06 VIOLATED');
  });

  it('activePlayerName is null when no players exist', () => {
    const lobby = makeLobby('GPS07');
    lobby.players = [];
    lobby.activeTurnIndex = 0;
    const state = getPublicState('GPS07');
    assert.equal(state.activePlayerName, null);
  });
});

// ─── validatePuzzleSchema — inactiveCells validation ─────────────────────────

describe('validatePuzzleSchema — inactiveCells validation', () => {
  const baseSchema = () => ({
    id: 'test', name: 'Test', gridSize: { rows: 3, cols: 3 },
    shapes: [{ id: 'A', cells: [[0,0]], movable: true }],
    solution: [['A',null,null],[null,null,null],[null,null,null]]
  });

  it('passes when inactiveCells is absent', () => {
    assert.doesNotThrow(() => validatePuzzleSchema(baseSchema()));
  });

  it('passes when inactiveCells is a valid array of [r,c] pairs within bounds', () => {
    const p = baseSchema();
    p.inactiveCells = [[2,1],[2,2]];
    assert.doesNotThrow(() => validatePuzzleSchema(p));
  });

  it('throws when inactiveCells is not an array', () => {
    const p = baseSchema();
    p.inactiveCells = 'bad';
    assert.throws(() => validatePuzzleSchema(p), /inactiveCells.*array/i);
  });

  it('throws when an inactiveCells entry is not a 2-element number array', () => {
    const p = baseSchema();
    p.inactiveCells = [[0]]; // only 1 element
    assert.throws(() => validatePuzzleSchema(p), /inactiveCells.*\[row, col\]/i);
  });

  it('throws when an inactiveCells entry is out of gridSize bounds', () => {
    const p = baseSchema();
    p.inactiveCells = [[5, 5]]; // beyond 3x3
    assert.throws(() => validatePuzzleSchema(p), /out of bounds/i);
  });
});

// ─── validatePuzzleSchema — cell-count cross-check ───────────────────────────

describe('validatePuzzleSchema — cell-count cross-check', () => {
  const makeFixture = (shapeCells, solutionNonNull, withInactive = true) => {
    // Build minimal valid fixture
    const cells = Array.from({ length: shapeCells }, (_, i) => [0, i]);
    const solRow = Array.from({ length: solutionNonNull }, () => 'A')
      .concat(Array(Math.max(0, 5 - solutionNonNull)).fill(null));
    return {
      id: 'fix', name: 'Fix',
      gridSize: { rows: 1, cols: Math.max(shapeCells, solutionNonNull, 5) },
      inactiveCells: withInactive ? [[0, 4]] : undefined,
      shapes: [{ id: 'A', cells, movable: true }],
      solution: [solRow]
    };
  };

  it('passes when shape cell count equals non-null solution cell count', () => {
    const p = makeFixture(3, 3);
    assert.doesNotThrow(() => validatePuzzleSchema(p));
  });

  it('throws when shape cell count does not match non-null solution cell count', () => {
    const p = makeFixture(3, 4);
    assert.throws(() => validatePuzzleSchema(p), /cells.*solution|unsolvable/i);
  });

  it('skips cross-check when inactiveCells is absent (existing puzzles unaffected)', () => {
    const p = makeFixture(3, 4, false); // mismatched but no inactiveCells
    assert.doesNotThrow(() => validatePuzzleSchema(p));
  });
});

// ─── buildInitialGrid — irregular grid with inactiveCells ────────────────────

describe('buildInitialGrid — irregular grid with inactiveCells', () => {
  // Uses puzzle_v11 which is loaded in the before() hook via loadPuzzles()
  // puzzle_v11 has inactiveCells: [[4,0],[4,8]]

  it('marks inactive positions with { inactive: true } sentinel', () => {
    const puzzle = getPuzzleById('puzzle_v11');
    assert.ok(puzzle, 'puzzle_v11 must be loaded');
    const grid = buildInitialGrid(puzzle);
    assert.deepEqual(grid[4][0], { inactive: true });
    assert.deepEqual(grid[4][8], { inactive: true });
  });

  it('leaves active positions as null', () => {
    const puzzle = getPuzzleById('puzzle_v11');
    const grid = buildInitialGrid(puzzle);
    // Sample of active cells — should all be null at init
    assert.strictEqual(grid[0][0], null);
    assert.strictEqual(grid[4][1], null);
    assert.strictEqual(grid[4][7], null); // last active cell in row 4
  });

  it('produces a 5x9 grid', () => {
    const puzzle = getPuzzleById('puzzle_v11');
    const grid = buildInitialGrid(puzzle);
    assert.strictEqual(grid.length, 5);
    assert.strictEqual(grid[0].length, 9);
  });

  it('does not affect puzzles without inactiveCells (backward compat)', () => {
    const puzzle = getPuzzleById('puzzle_01');
    assert.ok(puzzle, 'puzzle_01 must be loaded');
    const grid = buildInitialGrid(puzzle);
    // puzzle_01 has anchor A at position [0,0] occupying rows 0-2, col 0
    assert.deepEqual(grid[0][0], { shapeId: 'A', movable: false });
    assert.deepEqual(grid[1][0], { shapeId: 'A', movable: false });
    assert.deepEqual(grid[2][0], { shapeId: 'A', movable: false });
    // Non-anchor cells are null
    assert.strictEqual(grid[0][1], null);
  });
});

// ─── leaderboard ──────────────────────────────────────────────────────────────

describe('leaderboard', () => {
  it('startGame sets lobby.startTime to a number', () => {
    const lobby = makeLobby('LB-TEST');
    assert.strictEqual(typeof lobby.startTime, 'number');
    assert.ok(lobby.startTime > 0);
  });

  it('recordLeaderboardEntry stores entry with name strings only', () => {
    const { recordLeaderboardEntry, getLeaderboard } = require('./game');
    const lobby = makeLobby('LB-TEST2');
    recordLeaderboardEntry(lobby, 5000);
    const entries = getLeaderboard();
    const entry = entries.find(e => e.playerNames.includes('Alice'));
    assert.ok(entry, 'entry must exist');
    assert.strictEqual(entry.elapsedMs, undefined);   // raw ms not exposed
    assert.strictEqual(typeof entry.time, 'string');  // pre-formatted
    assert.ok(entry.playerNames.every(n => typeof n === 'string'), 'playerNames must be strings');
  });

  it('getLeaderboard returns entries sorted fastest first with rank starting at 1', () => {
    const { recordLeaderboardEntry, getLeaderboard } = require('./game');
    const lb1 = makeLobby('LB-SORT1');
    const lb2 = makeLobby('LB-SORT2');
    recordLeaderboardEntry(lb1, 90000);   // 1:30
    recordLeaderboardEntry(lb2, 30000);   // 0:30  — should rank lower than 1:30
    const entries = getLeaderboard();
    // Leaderboard is module-level and shared — find our two added entries by time
    const entry90 = entries.find(e => e.time === '01:30');
    const entry30 = entries.find(e => e.time === '00:30');
    assert.ok(entry90, 'entry for 1:30 must exist');
    assert.ok(entry30, 'entry for 0:30 must exist');
    assert.ok(entry30.rank < entry90.rank, '0:30 must rank higher (lower number) than 1:30');
    // Ranks must be 1-indexed
    assert.ok(entries[0].rank === 1, 'first entry must have rank 1');
  });
});

// ─── checkWin — irregular grid (puzzle_v11) ───────────────────────────────────

describe('checkWin — irregular grid (puzzle_v11)', () => {
  it('returns false on fresh puzzle_v11 grid (no pieces placed)', () => {
    const lobby = makeLobbyV11('V11-WIN-FRESH');
    const puzzle = getPuzzleById('puzzle_v11');
    assert.strictEqual(checkWin(lobby, puzzle), false);
  });

  it('returns true when all 43 active cells filled and sentinels remain at inactive positions', () => {
    const lobby = makeLobbyV11('V11-WIN-COMPLETE');
    const puzzle = getPuzzleById('puzzle_v11');
    const inactiveSet = new Set((puzzle.inactiveCells || []).map(([r, c]) => `${r}-${c}`));
    const grid = [];
    for (let r = 0; r < puzzle.gridSize.rows; r++) {
      grid.push([]);
      for (let c = 0; c < puzzle.gridSize.cols; c++) {
        if (inactiveSet.has(`${r}-${c}`)) {
          grid[r].push({ inactive: true });
        } else {
          const sid = puzzle.solution[r][c];
          grid[r].push(sid ? { shapeId: sid, movable: true } : null);
        }
      }
    }
    lobby.grid = grid;
    assert.strictEqual(checkWin(lobby, puzzle), true);
  });

  it('inactive cells at [4][0] and [4][8] do not prevent win when other cells filled', () => {
    const lobby = makeLobbyV11('V11-WIN-SENTINELS');
    const puzzle = getPuzzleById('puzzle_v11');
    // Verify sentinels are present after startGame
    assert.deepEqual(lobby.grid[4][0], { inactive: true });
    assert.deepEqual(lobby.grid[4][8], { inactive: true });
    // Build complete win-state grid
    const inactiveSet = new Set((puzzle.inactiveCells || []).map(([r, c]) => `${r}-${c}`));
    const grid = [];
    for (let r = 0; r < puzzle.gridSize.rows; r++) {
      grid.push([]);
      for (let c = 0; c < puzzle.gridSize.cols; c++) {
        if (inactiveSet.has(`${r}-${c}`)) {
          grid[r].push({ inactive: true });
        } else {
          const sid = puzzle.solution[r][c];
          grid[r].push(sid ? { shapeId: sid, movable: true } : null);
        }
      }
    }
    lobby.grid = grid;
    assert.strictEqual(checkWin(lobby, puzzle), true);
  });
});

// ─── placePiece — inactive cell rejection (puzzle_v11) ────────────────────────

describe('placePiece — inactive cell rejection (puzzle_v11)', () => {
  it('rejects placement when any piece cell lands on an inactive sentinel', () => {
    // P01 at rotation 0 has cells [[0,0],[0,1],[0,2]] — placing at origin (4,0)
    // covers [4,0] which is an inactive sentinel
    const lobby = makeLobbyV11('V11-PLACE-REJECT');
    const result = placePiece(lobby, 'P01', 0, 4, 0);
    assert.deepEqual(result, { ok: false, error: 'Cell occupied' });
  });

  it('sentinel cells remain intact after rejected placement', () => {
    const lobby = makeLobbyV11('V11-PLACE-INTACT');
    placePiece(lobby, 'P01', 0, 4, 0);
    assert.deepEqual(lobby.grid[4][0], { inactive: true });
  });
});

// ─── setRandomMode and triggerRandomEvent ─────────────────────────────────────

describe('createLobby + randomModeEnabled init', () => {
  it('createLobby initializes randomModeEnabled: false', () => {
    lobbies.delete('RTEST');
    createLobby('RTEST', 'host-socket', 'Alice');
    const lobby = lobbies.get('RTEST');
    assert.strictEqual(lobby.randomModeEnabled, false);
  });
});

describe('setRandomMode', () => {
  it('sets randomModeEnabled to true', () => {
    lobbies.delete('RM01');
    createLobby('RM01', 'host-socket', 'Alice');
    const result = setRandomMode('RM01', true);
    assert.strictEqual(result, true);
    assert.strictEqual(lobbies.get('RM01').randomModeEnabled, true);
  });

  it('sets randomModeEnabled to false', () => {
    lobbies.delete('RM02');
    createLobby('RM02', 'host-socket', 'Alice');
    setRandomMode('RM02', true);
    const result = setRandomMode('RM02', false);
    assert.strictEqual(result, true);
    assert.strictEqual(lobbies.get('RM02').randomModeEnabled, false);
  });

  it('returns false for unknown room', () => {
    const result = setRandomMode('NONEXISTENT_ROOM_CODE', true);
    assert.strictEqual(result, false);
  });
});

describe('getPublicState includes randomMode', () => {
  it('randomMode is false by default', () => {
    lobbies.delete('GPS-RM01');
    createLobby('GPS-RM01', 'host-socket', 'Alice');
    const state = getPublicState('GPS-RM01');
    assert.strictEqual(state.randomMode, false);
  });

  it('randomMode is true after setRandomMode(true)', () => {
    lobbies.delete('GPS-RM02');
    createLobby('GPS-RM02', 'host-socket', 'Alice');
    setRandomMode('GPS-RM02', true);
    const state = getPublicState('GPS-RM02');
    assert.strictEqual(state.randomMode, true);
  });
});

describe('triggerRandomEvent - remove_piece', () => {
  it('returns { type: "remove_piece", description: string } and removes piece from grid', () => {
    const lobby = makeLobbyV11('TRE-RP01');
    // Place a movable piece (P01) on the grid
    const placeResult = placePiece(lobby, 'P01', 0, 0, 0);
    assert.strictEqual(placeResult.ok, true, 'placePiece should succeed');
    // Confirm P01 is on the grid (movable)
    const hasP01Before = lobby.grid.some(row => row.some(cell => cell && cell.movable && cell.shapeId === 'P01'));
    assert.strictEqual(hasP01Before, true, 'P01 should be on grid before trigger');
    // Trigger remove_piece event
    const result = triggerRandomEvent(lobby, 'remove_piece');
    assert.ok(result !== null, 'should not return null when movable pieces exist');
    assert.strictEqual(result.type, 'remove_piece');
    assert.strictEqual(typeof result.description, 'string');
    assert.ok(result.description.length > 0);
    // Piece should be gone from grid
    const hasP01After = lobby.grid.some(row => row.some(cell => cell && cell.movable && cell.shapeId === 'P01'));
    assert.strictEqual(hasP01After, false, 'P01 should be removed from grid after event');
  });

  it('returns null when no movable pieces are placed on the grid', () => {
    const lobby = makeLobbyV11('TRE-RP02');
    // No movable pieces placed — only anchor pieces exist (not movable)
    const result = triggerRandomEvent(lobby, 'remove_piece');
    assert.strictEqual(result, null);
  });
});

describe('triggerRandomEvent - skip_turn', () => {
  it('returns { type: "skip_turn", description: string } and advances turn index extra step', () => {
    const lobby = makeLobbyV11('TRE-ST01');
    // lobby has 2 players; activeTurnIndex starts at 0
    const beforeIndex = lobby.activeTurnIndex;
    const result = triggerRandomEvent(lobby, 'skip_turn');
    assert.ok(result !== null, 'should not return null with 2 players');
    assert.strictEqual(result.type, 'skip_turn');
    assert.strictEqual(typeof result.description, 'string');
    assert.ok(result.description.length > 0);
    // triggerRandomEvent(skip_turn) calls advanceTurn once extra inside
    // so after the event, index should be 1 step further than beforeIndex+1
    // Actually: advanceTurn is called inside triggerRandomEvent, so index = (beforeIndex + 1) % 2 = 1
    assert.strictEqual(lobby.activeTurnIndex, (beforeIndex + 1) % lobby.players.length);
  });

  it('returns null when only 1 player', () => {
    lobbies.delete('TRE-ST02');
    createLobby('TRE-ST02', 'host-socket', 'SoloAlice');
    addPlayer('TRE-ST02', 'p2-socket', 'Bob');
    setSelectedPuzzle('TRE-ST02', 'puzzle_v11');
    const startResult = startGame('TRE-ST02');
    assert.strictEqual(startResult.ok, true);
    const lobby = lobbies.get('TRE-ST02');
    // Reduce to 1 player for the test
    lobby.players = [lobby.players[0]];
    const result = triggerRandomEvent(lobby, 'skip_turn');
    assert.strictEqual(result, null);
  });
});

describe('triggerRandomEvent - shuffle_order', () => {
  it('returns { type: "shuffle_order", description: string } and resets activeTurnIndex to 0', () => {
    const lobby = makeLobbyV11('TRE-SO01');
    // Set activeTurnIndex to something non-zero to verify reset
    lobby.activeTurnIndex = 1;
    const result = triggerRandomEvent(lobby, 'shuffle_order');
    assert.ok(result !== null, 'shuffle_order should never return null');
    assert.strictEqual(result.type, 'shuffle_order');
    assert.strictEqual(typeof result.description, 'string');
    assert.ok(result.description.length > 0);
    assert.strictEqual(lobby.activeTurnIndex, 0, 'activeTurnIndex must be reset to 0 after shuffle');
  });
});

describe('triggerRandomEvent - rotate_piece', () => {
  it('returns { type: "rotate_piece", description: string } without mutating state', () => {
    const lobby = makeLobbyV11('TRE-ROT01');
    const indexBefore = lobby.activeTurnIndex;
    const playersBefore = JSON.stringify(lobby.players);
    const result = triggerRandomEvent(lobby, 'rotate_piece');
    assert.ok(result !== null, 'rotate_piece should never return null');
    assert.strictEqual(result.type, 'rotate_piece');
    assert.strictEqual(typeof result.description, 'string');
    assert.ok(result.description.length > 0);
    // State must not change
    assert.strictEqual(lobby.activeTurnIndex, indexBefore, 'activeTurnIndex must not change');
    assert.strictEqual(JSON.stringify(lobby.players), playersBefore, 'players must not change');
  });
});

// ─── Phase 14: new event tests (Wave 0 — failing until source updated) ─────────

describe('triggerRandomEvent - double_turn', () => {
  it('sets lobby.extraTurns to 1 and returns { type: "double_turn", description: string } when extraTurns starts at 0', () => {
    const lobby = makeLobbyV11('TRE-DT01');
    lobby.extraTurns = 0;
    const result = triggerRandomEvent(lobby, 'double_turn');
    assert.ok(result !== null, 'double_turn should not return null when extraTurns === 0');
    assert.strictEqual(result.type, 'double_turn');
    assert.strictEqual(typeof result.description, 'string');
    assert.ok(result.description.length > 0);
    assert.strictEqual(lobby.extraTurns, 1, 'extraTurns must be set to 1');
  });

  it('returns null and does not modify extraTurns when extraTurns is already > 0 (no stacking)', () => {
    const lobby = makeLobbyV11('TRE-DT02');
    lobby.extraTurns = 1;
    const result = triggerRandomEvent(lobby, 'double_turn');
    assert.strictEqual(result, null, 'double_turn must return null when extraTurns > 0');
    assert.strictEqual(lobby.extraTurns, 1, 'extraTurns must remain 1 (no stacking)');
  });
});

describe('triggerRandomEvent - reverse_order', () => {
  it('reverses lobby.players in place and resets activeTurnIndex to 0', () => {
    const lobby = makeLobbyV11('TRE-RO01');
    lobby.players = [
      { socketId: 'a', name: 'A', isHost: true },
      { socketId: 'b', name: 'B', isHost: false },
      { socketId: 'c', name: 'C', isHost: false },
    ];
    lobby.activeTurnIndex = 2;
    triggerRandomEvent(lobby, 'reverse_order');
    assert.deepEqual(
      lobby.players.map(p => p.name),
      ['C', 'B', 'A'],
      'players must be reversed in place'
    );
    assert.strictEqual(lobby.activeTurnIndex, 0, 'activeTurnIndex must be reset to 0');
  });

  it('returns { type: "reverse_order", description: string }', () => {
    const lobby = makeLobbyV11('TRE-RO02');
    const result = triggerRandomEvent(lobby, 'reverse_order');
    assert.ok(result !== null, 'reverse_order should not return null');
    assert.strictEqual(result.type, 'reverse_order');
    assert.strictEqual(typeof result.description, 'string');
    assert.ok(result.description.length > 0);
  });
});

describe('triggerRandomEvent - blind_bank', () => {
  it('returns { type: "blind_bank", description: string } without mutating lobby', () => {
    const lobby = makeLobbyV11('TRE-BB01');
    const playersBefore = JSON.stringify(lobby.players);
    const indexBefore = lobby.activeTurnIndex;
    const extraTurnsBefore = lobby.extraTurns;
    const result = triggerRandomEvent(lobby, 'blind_bank');
    assert.ok(result !== null, 'blind_bank should not return null');
    assert.strictEqual(result.type, 'blind_bank');
    assert.strictEqual(typeof result.description, 'string');
    assert.ok(result.description.length > 0);
    // No mutation
    assert.strictEqual(JSON.stringify(lobby.players), playersBefore, 'players must not change');
    assert.strictEqual(lobby.activeTurnIndex, indexBefore, 'activeTurnIndex must not change');
    assert.strictEqual(lobby.extraTurns, extraTurnsBefore, 'extraTurns must not change');
  });
});

describe('createLobby - extraTurns init', () => {
  it('initializes extraTurns to 0', () => {
    lobbies.delete('ET-INIT01');
    createLobby('ET-INIT01', 'host-socket', 'Host');
    const lobby = lobbies.get('ET-INIT01');
    assert.strictEqual(lobby.extraTurns, 0, 'extraTurns must be initialized to 0');
  });
});

describe('startGame - extraTurns reset', () => {
  it('resets extraTurns to 0 on startGame even if previously > 0', () => {
    lobbies.delete('ET-RESET01');
    createLobby('ET-RESET01', 'host-socket', 'Alice');
    addPlayer('ET-RESET01', 'p2-socket', 'Bob');
    setSelectedPuzzle('ET-RESET01', 'puzzle_v11');
    const lobby = lobbies.get('ET-RESET01');
    lobby.extraTurns = 1; // simulate carry-over from previous game
    const result = startGame('ET-RESET01');
    assert.strictEqual(result.ok, true, 'startGame must succeed');
    assert.strictEqual(lobby.extraTurns, 0, 'extraTurns must be reset to 0 by startGame');
  });
});

describe('getPublicState - extraTurns field', () => {
  it('includes extraTurns in the returned public state (default 0)', () => {
    lobbies.delete('ET-GPS01');
    createLobby('ET-GPS01', 'host-socket', 'Alice');
    const state = getPublicState('ET-GPS01');
    assert.strictEqual(state.extraTurns, 0, 'extraTurns must be 0 in public state by default');
  });

  it('reflects the current lobby.extraTurns value', () => {
    lobbies.delete('ET-GPS02');
    createLobby('ET-GPS02', 'host-socket', 'Alice');
    const lobby = lobbies.get('ET-GPS02');
    lobby.extraTurns = 1;
    const state = getPublicState('ET-GPS02');
    assert.strictEqual(state.extraTurns, 1, 'extraTurns in public state must match lobby.extraTurns');
  });
});

describe('pickRandomEvent - Phase 14 weight table', () => {
  it('returns rotate_piece for r < 0.10', () => {
    const origRandom = Math.random;
    Math.random = () => 0.05;
    try {
      const { pickRandomEvent } = require('./game');
      assert.strictEqual(pickRandomEvent(), 'rotate_piece');
    } finally { Math.random = origRandom; }
  });

  it('returns skip_turn for 0.10 <= r < 0.25', () => {
    const origRandom = Math.random;
    Math.random = () => 0.20;
    try {
      const { pickRandomEvent } = require('./game');
      assert.strictEqual(pickRandomEvent(), 'skip_turn');
    } finally { Math.random = origRandom; }
  });

  it('returns remove_piece for 0.25 <= r < 0.45', () => {
    const origRandom = Math.random;
    Math.random = () => 0.40;
    try {
      const { pickRandomEvent } = require('./game');
      assert.strictEqual(pickRandomEvent(), 'remove_piece');
    } finally { Math.random = origRandom; }
  });

  it('returns shuffle_order for 0.45 <= r < 0.60', () => {
    const origRandom = Math.random;
    Math.random = () => 0.55;
    try {
      const { pickRandomEvent } = require('./game');
      assert.strictEqual(pickRandomEvent(), 'shuffle_order');
    } finally { Math.random = origRandom; }
  });

  it('returns double_turn for 0.60 <= r < 0.75', () => {
    const origRandom = Math.random;
    Math.random = () => 0.70;
    try {
      const { pickRandomEvent } = require('./game');
      assert.strictEqual(pickRandomEvent(), 'double_turn');
    } finally { Math.random = origRandom; }
  });

  it('returns reverse_order for 0.75 <= r < 0.90', () => {
    const origRandom = Math.random;
    Math.random = () => 0.85;
    try {
      const { pickRandomEvent } = require('./game');
      assert.strictEqual(pickRandomEvent(), 'reverse_order');
    } finally { Math.random = origRandom; }
  });

  it('returns blind_bank for r >= 0.90', () => {
    const origRandom = Math.random;
    Math.random = () => 0.95;
    try {
      const { pickRandomEvent } = require('./game');
      assert.strictEqual(pickRandomEvent(), 'blind_bank');
    } finally { Math.random = origRandom; }
  });
});
