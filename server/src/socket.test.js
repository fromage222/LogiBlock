'use strict';

/**
 * Unit tests for the game:move socket handler in socket.js.
 *
 * Strategy: Mock io and socket objects to capture emitted events, then
 * call registerSocketHandlers and invoke event handlers directly.
 * This avoids needing socket.io-client while fully exercising handler logic.
 */

const { describe, it, before, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

const {
  lobbies,
  loadPuzzles,
  createLobby,
  addPlayer,
  startGame,
  setSelectedPuzzle,
  setRandomMode,
  getLobby,
} = require('./game');

const registerSocketHandlers = require('./socket');

// ─── One-time setup ───────────────────────────────────────────────────────────
before(() => {
  loadPuzzles();
});

// ─── Test helpers ─────────────────────────────────────────────────────────────

/**
 * Create a playing lobby with host (Alice) and one more player (Bob).
 * Returns the lobby object.
 */
function makePlayingLobby(roomCode = 'STEST01') {
  lobbies.delete(roomCode);
  createLobby(roomCode, 'host-socket', 'Alice');
  addPlayer(roomCode, 'p2-socket', 'Bob');
  setSelectedPuzzle(roomCode, 'puzzle_01');
  const result = startGame(roomCode);
  if (!result.ok) throw new Error('startGame failed: ' + result.error);
  return lobbies.get(roomCode);
}

/**
 * Build mock io and socket objects.
 * Captures emitted events in `emitted.room[event]` and `emitted.socket[event]`.
 */
function makeMocks(roomCode, socketId, playerName) {
  const emitted = { room: {}, socket: {} };

  const io = {
    to: (code) => ({
      emit: (event, payload) => {
        if (!emitted.room[event]) emitted.room[event] = [];
        emitted.room[event].push({ code, payload });
      },
    }),
    // io.emit() for broadcasting to ALL sockets (e.g. leaderboard:update)
    emit: (event, payload) => {
      if (!emitted.room[event]) emitted.room[event] = [];
      emitted.room[event].push({ code: '*', payload });
    },
  };

  const socket = {
    id: socketId,
    data: { roomCode, playerName },
    rooms: new Set([socketId, roomCode]),
    emit: (event, payload) => {
      if (!emitted.socket[event]) emitted.socket[event] = [];
      emitted.socket[event].push(payload);
    },
    on: (event, handler) => {
      socket._handlers = socket._handlers || {};
      socket._handlers[event] = handler;
    },
    join: () => {},
    _handlers: {},
    to: () => ({ emit: () => {} }),
  };

  // Register all socket handlers
  registerSocketHandlers(io, socket, new Map());

  return { io, socket, emitted };
}

/**
 * Trigger a handler registered via socket.on(event, handler).
 */
function trigger(socket, event, payload) {
  const handler = socket._handlers[event];
  if (!handler) throw new Error(`No handler registered for event: ${event}`);
  handler(payload);
}

// ─── game:move handler tests ──────────────────────────────────────────────────

describe('game:move handler', () => {

  describe('non-active player is rejected', () => {
    it('emits game:error "Not your turn" when non-active player sends game:move', () => {
      const roomCode = 'SM01';
      const lobby = makePlayingLobby(roomCode);
      // activeTurnIndex = 0 → Alice is active; use Bob's socket
      lobby.activeTurnIndex = 0;
      const { socket, emitted } = makeMocks(roomCode, 'p2-socket', 'Bob');

      trigger(socket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

      assert.ok(emitted.socket['game:error'], 'game:error should be emitted');
      assert.equal(emitted.socket['game:error'][0], 'Not your turn');
      assert.ok(!emitted.room['game:stateUpdate'], 'game:stateUpdate must NOT be emitted');
    });
  });

  describe('phase guard', () => {
    it('silently ignores game:move when lobby.phase is not "playing"', () => {
      const roomCode = 'SM02';
      makePlayingLobby(roomCode);
      const lobby = lobbies.get(roomCode);
      lobby.phase = 'lobby'; // force non-playing phase

      const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

      trigger(socket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

      assert.ok(!emitted.socket['game:error'], 'No game:error should be emitted');
      assert.ok(!emitted.room['game:stateUpdate'], 'No game:stateUpdate should be emitted');
    });

    it('silently ignores game:move when socket.data.roomCode is missing', () => {
      const { socket, emitted } = makeMocks(undefined, 'orphan-socket', 'Ghost');

      trigger(socket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

      assert.ok(!emitted.socket['game:error'], 'No game:error should be emitted');
    });
  });

  describe('action: place — invalid moves', () => {
    it('emits game:error "Cell occupied" when target cell is occupied', () => {
      const roomCode = 'SM03';
      const lobby = makePlayingLobby(roomCode);
      lobby.activeTurnIndex = 0; // Alice is active

      // Pre-place B manually so the cell is occupied
      const { placePiece } = require('./game');
      placePiece(lobby, 'B', 0, 0, 1); // B at (0,1),(0,2),(1,2)

      // Alice tries to place C at same origin — overlapping B
      const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');
      lobby.activeTurnIndex = 0; // still Alice

      trigger(socket, 'game:move', { action: 'place', shapeId: 'C', rotation: 0, originRow: 0, originCol: 1 });

      assert.ok(emitted.socket['game:error'], 'game:error should be emitted');
      assert.ok(!emitted.room['game:stateUpdate'], 'stateUpdate must NOT be emitted on error');
    });

    it('emits game:error "Piece out of bounds" when piece goes outside grid', () => {
      const roomCode = 'SM04';
      const lobby = makePlayingLobby(roomCode);
      lobby.activeTurnIndex = 0;

      const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

      // B shape at (3,3) in 4×4 grid → out of bounds
      trigger(socket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 3, originCol: 3 });

      assert.ok(emitted.socket['game:error'], 'game:error should be emitted');
      assert.equal(emitted.socket['game:error'][0], 'Piece out of bounds');
    });
  });

  describe('action: place — valid move', () => {
    it('broadcasts game:stateUpdate to room after valid place', () => {
      const roomCode = 'SM05';
      const lobby = makePlayingLobby(roomCode);
      lobby.activeTurnIndex = 0;

      const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

      trigger(socket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

      assert.ok(!emitted.socket['game:error'], 'No game:error should be emitted');
      assert.ok(emitted.room['game:stateUpdate'], 'game:stateUpdate should be broadcast to room');
    });

    it('advances activeTurnIndex after valid place (non-winning)', () => {
      const roomCode = 'SM06';
      const lobby = makePlayingLobby(roomCode);
      lobby.activeTurnIndex = 0;

      const { socket } = makeMocks(roomCode, 'host-socket', 'Alice');

      trigger(socket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

      assert.equal(lobby.activeTurnIndex, 1, 'activeTurnIndex should advance to 1');
    });

    it('does NOT emit game:stateUpdate for winning move', () => {
      // Puzzle solution: A(anchor), B at (0,1), C at (1,1) = win
      const roomCode = 'SM07';
      const lobby = makePlayingLobby(roomCode);
      lobby.activeTurnIndex = 0;

      // Pre-place B
      const { placePiece } = require('./game');
      placePiece(lobby, 'B', 0, 0, 1);
      lobby.activeTurnIndex = 0; // still Alice's turn for C

      const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

      // Place C to complete the solution
      trigger(socket, 'game:move', { action: 'place', shapeId: 'C', rotation: 0, originRow: 1, originCol: 1 });

      assert.ok(emitted.room['game:win'], 'game:win should be broadcast to room');
      assert.ok(!emitted.room['game:stateUpdate'], 'game:stateUpdate must NOT be emitted on win');
    });

    it('does NOT advance activeTurnIndex on winning move', () => {
      const roomCode = 'SM08';
      const lobby = makePlayingLobby(roomCode);
      lobby.activeTurnIndex = 0;

      const { placePiece } = require('./game');
      placePiece(lobby, 'B', 0, 0, 1);
      lobby.activeTurnIndex = 0;

      const { socket } = makeMocks(roomCode, 'host-socket', 'Alice');

      trigger(socket, 'game:move', { action: 'place', shapeId: 'C', rotation: 0, originRow: 1, originCol: 1 });

      assert.equal(lobby.activeTurnIndex, 0, 'activeTurnIndex must NOT advance on win');
    });
  });

  describe('action: return', () => {
    it('broadcasts game:stateUpdate after successful return', () => {
      const roomCode = 'SM09';
      const lobby = makePlayingLobby(roomCode);
      lobby.activeTurnIndex = 0;

      // Pre-place B so it can be returned
      const { placePiece } = require('./game');
      placePiece(lobby, 'B', 0, 0, 1);
      lobby.activeTurnIndex = 0;

      const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

      trigger(socket, 'game:move', { action: 'return', shapeId: 'B' });

      assert.ok(!emitted.socket['game:error'], 'No game:error should be emitted');
      assert.ok(emitted.room['game:stateUpdate'], 'game:stateUpdate should be broadcast to room');
    });

    it('does NOT advance activeTurnIndex after return', () => {
      const roomCode = 'SM10';
      const lobby = makePlayingLobby(roomCode);
      lobby.activeTurnIndex = 0;

      const { placePiece } = require('./game');
      placePiece(lobby, 'B', 0, 0, 1);
      lobby.activeTurnIndex = 0;

      const { socket } = makeMocks(roomCode, 'host-socket', 'Alice');

      trigger(socket, 'game:move', { action: 'return', shapeId: 'B' });

      assert.equal(lobby.activeTurnIndex, 0, 'activeTurnIndex must remain 0 after return');
    });

    it('emits game:error when trying to return a piece not on grid', () => {
      const roomCode = 'SM11';
      const lobby = makePlayingLobby(roomCode);
      lobby.activeTurnIndex = 0;

      const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

      // B is not placed — returnPiece should fail
      trigger(socket, 'game:move', { action: 'return', shapeId: 'B' });

      assert.ok(emitted.socket['game:error'], 'game:error should be emitted');
      assert.ok(!emitted.room['game:stateUpdate'], 'stateUpdate must NOT be emitted on error');
    });
  });

  describe('unknown action', () => {
    it('silently ignores unknown action strings', () => {
      const roomCode = 'SM12';
      const lobby = makePlayingLobby(roomCode);
      lobby.activeTurnIndex = 0;

      const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

      trigger(socket, 'game:move', { action: 'explode', shapeId: 'B' });

      assert.ok(!emitted.socket['game:error'], 'No game:error for unknown action');
      assert.ok(!emitted.room['game:stateUpdate'], 'No stateUpdate for unknown action');
    });
  });

  describe('error routing', () => {
    it('game:error uses socket.emit (point-to-point), not io.to().emit', () => {
      // Verified by checking emitted.socket['game:error'] above (not emitted.room['game:error'])
      const roomCode = 'SM13';
      const lobby = makePlayingLobby(roomCode);
      lobby.activeTurnIndex = 0;

      const { socket, emitted } = makeMocks(roomCode, 'p2-socket', 'Bob');

      trigger(socket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

      // Error emitted only to the requesting socket, not the room
      assert.ok(emitted.socket['game:error'], 'game:error emitted to socket');
      assert.ok(!emitted.room['game:error'], 'game:error NOT broadcast to room');
    });
  });
});

// ─── lobby:randomMode handler tests ──────────────────────────────────────────

describe('lobby:randomMode handler', () => {

  it('host can enable randomMode — lobby:update broadcasts with randomMode: true', () => {
    const roomCode = 'SRM01';
    lobbies.delete(roomCode);
    createLobby(roomCode, 'host-socket', 'Alice');
    addPlayer(roomCode, 'p2-socket', 'Bob');

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

    trigger(socket, 'lobby:randomMode', { enabled: true });

    assert.ok(emitted.room['lobby:update'], 'lobby:update should be broadcast to room');
    const lastUpdate = emitted.room['lobby:update'].at(-1).payload;
    assert.equal(lastUpdate.randomMode, true, 'randomMode should be true in lobby:update payload');
    assert.ok(!emitted.socket['room:error'], 'No room:error should be emitted to host');
  });

  it('non-host gets room:error and state is NOT updated', () => {
    const roomCode = 'SRM02';
    lobbies.delete(roomCode);
    createLobby(roomCode, 'host-socket', 'Alice');
    addPlayer(roomCode, 'p2-socket', 'Bob');

    // Bob is non-host
    const { socket, emitted } = makeMocks(roomCode, 'p2-socket', 'Bob');

    trigger(socket, 'lobby:randomMode', { enabled: true });

    assert.ok(emitted.socket['room:error'], 'room:error should be emitted to non-host socket');
    assert.equal(
      emitted.socket['room:error'][0],
      'Only the host can change random mode',
      'Error message must match expected string'
    );
    assert.ok(!emitted.room['lobby:update'], 'lobby:update must NOT be broadcast when non-host tries');
    // Verify state was not mutated
    const lobby = getLobby(roomCode);
    assert.equal(lobby.randomModeEnabled, false, 'randomModeEnabled must remain false');
  });

});

// ─── game:move randomMode:event trigger tests ─────────────────────────────────
//
// Uses puzzle_01 (L-Maze: shapes A anchor, B movable, C movable, 4x4 grid)
// because it has a simple win scenario and predictable shape IDs.
// makePlayingLobby uses the default puzzle (level_01 with difficulty), so we
// build a dedicated helper that forces puzzle_01 for these integration tests.

/**
 * Create a playing lobby using puzzle_01 (L-Maze) which has shapes A, B, C.
 * Puzzle_01 has no difficulty so it won't conflict with the default lobby puzzle.
 * Solution: A at position, B at (0,1), C at (1,1).
 */
function makeRandomModeLobby(roomCode) {
  const { setSelectedPuzzle } = require('./game');
  lobbies.delete(roomCode);
  createLobby(roomCode, 'host-socket', 'Alice');
  addPlayer(roomCode, 'p2-socket', 'Bob');
  // Override puzzle to puzzle_01 before starting (host can change puzzle)
  setSelectedPuzzle(roomCode, 'puzzle_01');
  const result = startGame(roomCode);
  if (!result.ok) throw new Error('startGame failed in makeRandomModeLobby: ' + result.error);
  return lobbies.get(roomCode);
}

describe('game:move randomMode:event trigger', () => {
  let origRandom;

  afterEach(() => {
    // Always restore Math.random after each test in this block
    if (origRandom) {
      Math.random = origRandom;
      origRandom = undefined;
    }
  });

  it('non-winning place with randomModeEnabled=true emits randomMode:event before game:stateUpdate', () => {
    const roomCode = 'SRM03';
    makeRandomModeLobby(roomCode);
    setRandomMode(roomCode, true);

    // Stub Math.random: 0.05 is < 0.30 (event fires) and < 0.35 (picks rotate_piece)
    origRandom = Math.random;
    Math.random = () => 0.05;

    // Track emission order via a custom io wrapper
    const emitted = { room: {}, socket: {} };
    const emitOrder = [];

    const ioWithOrder = {
      to: (code) => ({
        emit: (event, payload) => {
          emitOrder.push(event);
          if (!emitted.room[event]) emitted.room[event] = [];
          emitted.room[event].push({ code, payload });
        },
      }),
      emit: (event, payload) => {
        emitOrder.push(event);
        if (!emitted.room[event]) emitted.room[event] = [];
        emitted.room[event].push({ code: '*', payload });
      },
    };

    const socket2 = {
      id: 'host-socket',
      data: { roomCode, playerName: 'Alice' },
      rooms: new Set(['host-socket', roomCode]),
      emit: (event, payload) => {
        if (!emitted.socket[event]) emitted.socket[event] = [];
        emitted.socket[event].push(payload);
      },
      on: (event, handler) => {
        socket2._handlers = socket2._handlers || {};
        socket2._handlers[event] = handler;
      },
      _handlers: {},
      to: () => ({ emit: () => {} }),
    };
    registerSocketHandlers(ioWithOrder, socket2, new Map());

    // B cells: [[0,0],[0,1],[1,1]] — place at originRow=0, originCol=1
    // This fills (0,1),(0,2),(1,2) — valid non-winning placement in puzzle_01
    trigger(socket2, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

    assert.ok(emitted.room['randomMode:event'], 'randomMode:event should be emitted');
    assert.ok(emitted.room['game:stateUpdate'], 'game:stateUpdate should be emitted');

    const randomModeIdx = emitOrder.indexOf('randomMode:event');
    const stateUpdateIdx = emitOrder.indexOf('game:stateUpdate');
    assert.ok(randomModeIdx !== -1, 'randomMode:event must appear in emit order');
    assert.ok(stateUpdateIdx !== -1, 'game:stateUpdate must appear in emit order');
    assert.ok(
      randomModeIdx < stateUpdateIdx,
      `randomMode:event (${randomModeIdx}) must be emitted BEFORE game:stateUpdate (${stateUpdateIdx})`
    );
  });

  it('winning move with randomModeEnabled=true does NOT emit randomMode:event', () => {
    const roomCode = 'SRM04';
    const lobby = makeRandomModeLobby(roomCode);
    lobby.activeTurnIndex = 0;
    setRandomMode(roomCode, true);

    // Stub Math.random so probability would fire if checked
    origRandom = Math.random;
    Math.random = () => 0.05;

    // Pre-place B so that placing C wins the game
    // puzzle_01 solution: A at anchor, B at (0,1), C at (1,1)
    const { placePiece } = require('./game');
    placePiece(lobby, 'B', 0, 0, 1);
    lobby.activeTurnIndex = 0; // still Alice's turn

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

    // Place C to trigger win (C cells [[0,0],[1,0],[1,1]] at originRow=1, originCol=1)
    trigger(socket, 'game:move', { action: 'place', shapeId: 'C', rotation: 0, originRow: 1, originCol: 1 });

    assert.ok(emitted.room['game:win'], 'game:win should be emitted');
    assert.ok(!emitted.room['randomMode:event'], 'randomMode:event must NOT be emitted on winning move');
  });

  it('return action with randomModeEnabled=true does NOT emit randomMode:event', () => {
    const roomCode = 'SRM05';
    const lobby = makeRandomModeLobby(roomCode);
    lobby.activeTurnIndex = 0;
    setRandomMode(roomCode, true);

    // Stub Math.random so probability would fire if checked
    origRandom = Math.random;
    Math.random = () => 0.05;

    // Pre-place B so it can be returned
    const { placePiece } = require('./game');
    placePiece(lobby, 'B', 0, 0, 1);
    lobby.activeTurnIndex = 0;

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

    trigger(socket, 'game:move', { action: 'return', shapeId: 'B' });

    assert.ok(emitted.room['game:stateUpdate'], 'game:stateUpdate should be emitted after return');
    assert.ok(!emitted.room['randomMode:event'], 'randomMode:event must NOT be emitted on return action');
  });

  it('non-winning place with randomModeEnabled=false does NOT emit randomMode:event', () => {
    const roomCode = 'SRM06';
    makeRandomModeLobby(roomCode);
    // randomModeEnabled defaults to false — do not set it

    // Stub Math.random so probability would fire if checked
    origRandom = Math.random;
    Math.random = () => 0.05;

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

    trigger(socket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

    assert.ok(emitted.room['game:stateUpdate'], 'game:stateUpdate should be emitted');
    assert.ok(!emitted.room['randomMode:event'], 'randomMode:event must NOT be emitted when randomModeEnabled=false');
  });

});

// ── Profanity filter tests ──────────────────────────────────────────────────

describe('createRoom profanity filter', () => {
  it('rejects profane name with room:error "Player name is not allowed"', () => {
    const { socket, emitted } = makeMocks(undefined, 'cr-prof-1', undefined);
    trigger(socket, 'createRoom', { playerName: 'ass' });
    assert.ok(emitted.socket['room:error'], 'room:error should be emitted');
    assert.equal(emitted.socket['room:error'][0], 'Player name is not allowed');
    assert.ok(!emitted.socket['room:created'], 'room:created must NOT be emitted for profane name');
  });

  it('accepts clean name — emits room:created, no room:error', () => {
    const { socket, emitted } = makeMocks(undefined, 'cr-clean-1', undefined);
    trigger(socket, 'createRoom', { playerName: 'Alice' });
    assert.ok(!emitted.socket['room:error'], 'room:error must NOT be emitted for clean name');
    assert.ok(emitted.socket['room:created'], 'room:created should be emitted');
  });
});

describe('joinRoom profanity filter', () => {
  it('rejects profane name with room:error "Player name is not allowed"', () => {
    const { socket, emitted } = makeMocks('ANYCODE', 'jr-prof-1', undefined);
    trigger(socket, 'joinRoom', { roomCode: 'ANYCODE', playerName: 'ass' });
    assert.ok(emitted.socket['room:error'], 'room:error should be emitted');
    assert.equal(emitted.socket['room:error'][0], 'Player name is not allowed');
  });

  it('accepts clean name past profanity filter (room may or may not exist)', () => {
    const roomCode = 'JRCLEAN1';
    lobbies.delete(roomCode);
    createLobby(roomCode, 'host-sock', 'Host');
    addPlayer(roomCode, 'jr-clean-extra', 'Extra');

    const { socket, emitted } = makeMocks(roomCode, 'jr-clean-1', undefined);
    trigger(socket, 'joinRoom', { roomCode, playerName: 'Alice' });

    const errors = emitted.socket['room:error'] || [];
    const hasProfanityError = errors.some(e => e === 'Player name is not allowed');
    assert.ok(!hasProfanityError, 'Clean name must not trigger profanity rejection');
  });
});

// ─── game:move - double_turn extra-turn gate (Phase 14) ───────────────────────

describe('game:move - double_turn extra-turn gate', () => {
  it('when lobby.extraTurns > 0, a successful placement decrements extraTurns and does NOT call advanceTurn', () => {
    const roomCode = 'DT-GATE01';
    const lobby = makePlayingLobby(roomCode);
    // Force puzzle_01 since makePlayingLobby might use a different puzzle
    setSelectedPuzzle(roomCode, 'puzzle_01');
    // Restart game with puzzle_01
    lobbies.delete(roomCode);
    createLobby(roomCode, 'host-socket', 'Alice');
    addPlayer(roomCode, 'p2-socket', 'Bob');
    setSelectedPuzzle(roomCode, 'puzzle_01');
    const result = startGame(roomCode);
    if (!result.ok) throw new Error('startGame failed: ' + result.error);
    const freshLobby = lobbies.get(roomCode);
    freshLobby.activeTurnIndex = 0;
    freshLobby.extraTurns = 1; // simulate double_turn grant

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

    // Place shape B at valid position — non-winning
    trigger(socket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

    assert.ok(!emitted.socket['game:error'], 'No game:error should be emitted');
    assert.strictEqual(freshLobby.extraTurns, 0, 'extraTurns must be decremented to 0');
    // Turn must NOT advance — same player (index 0) should still be active
    assert.strictEqual(freshLobby.activeTurnIndex, 0, 'activeTurnIndex must remain 0 (same player goes again)');
    // No randomMode:event should fire during extra turn
    assert.ok(!emitted.room['randomMode:event'], 'randomMode:event must NOT be emitted during extra turn');
    // stateUpdate should still be broadcast
    assert.ok(emitted.room['game:stateUpdate'], 'game:stateUpdate must still be broadcast');
  });

  it('when lobby.extraTurns === 0, a successful placement calls advanceTurn as before', () => {
    const roomCode = 'DT-GATE02';
    lobbies.delete(roomCode);
    createLobby(roomCode, 'host-socket', 'Alice');
    addPlayer(roomCode, 'p2-socket', 'Bob');
    setSelectedPuzzle(roomCode, 'puzzle_01');
    const result = startGame(roomCode);
    if (!result.ok) throw new Error('startGame failed: ' + result.error);
    const freshLobby = lobbies.get(roomCode);
    freshLobby.activeTurnIndex = 0;
    freshLobby.extraTurns = 0; // normal turn

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

    trigger(socket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

    assert.ok(!emitted.socket['game:error'], 'No game:error should be emitted');
    // Turn MUST advance
    assert.strictEqual(freshLobby.activeTurnIndex, 1, 'activeTurnIndex must advance to 1 when extraTurns === 0');
  });
});

// -- Phase 15: disconnect hold tests --------------------------------------

describe('disconnecting handler - game phase hold', () => {
  afterEach(() => {
    // Cancel any pending disconnect timers to prevent test runner from hanging.
    // We do this by triggering reconnectRoom which clears the timer via socket.js internal logic,
    // or by deleting lobbies so the timer callback exits early.
    // Deleting lobbies is the simplest approach since all test lobbies are isolated.
    lobbies.delete('DC-HOLD01');
    lobbies.delete('DC-HOLD02');
  });

  it('sets player.disconnected = true and broadcasts game:stateUpdate when game-phase player disconnects', () => {
    const roomCode = 'DC-HOLD01';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 1; // Bob is active, Alice disconnects

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(socket, 'disconnecting');

    // Check the flag was set on Alice
    const alice = lobby.players.find(p => p.name === 'Alice');
    assert.strictEqual(alice.disconnected, true, 'Alice should be marked disconnected');
    assert.strictEqual(typeof alice.disconnectedAt, 'number', 'disconnectedAt should be set');

    // Check game:stateUpdate was broadcast
    assert.ok(emitted.room['game:stateUpdate'], 'game:stateUpdate should be broadcast');
  });

  it('advances turn when the disconnecting player was the active player', () => {
    const roomCode = 'DC-HOLD02';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is active and disconnects

    const { socket } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(socket, 'disconnecting');

    // After Alice disconnects and is marked disconnected, advanceTurn should
    // have been called, moving active turn to Bob (index 1)
    assert.strictEqual(lobby.activeTurnIndex, 1, 'activeTurnIndex should advance to Bob');
  });
});

describe('reconnectRoom handler - clears disconnected flag', () => {
  afterEach(() => {
    lobbies.delete('DC-RECON01');
  });

  it('clears player.disconnected on successful reconnect', () => {
    const roomCode = 'DC-RECON01';
    const lobby = makePlayingLobby(roomCode);

    // Simulate Alice having disconnected (flag set by disconnecting handler)
    const alice = lobby.players.find(p => p.name === 'Alice');
    alice.disconnected = true;
    alice.disconnectedAt = Date.now();

    // Create a new socket for Alice reconnecting
    const { socket } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(socket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    // Verify flag is cleared
    assert.strictEqual(alice.disconnected, false, 'disconnected flag should be cleared');
    assert.strictEqual(alice.disconnectedAt, undefined, 'disconnectedAt should be deleted');
  });
});

// -- host disconnect timer fires in playing phase — must NOT emit lobby:hostLeft -------

describe('disconnecting timer — playing phase host', () => {
  afterEach(() => {
    mock.timers.reset();
    lobbies.delete('HC-PLAY01');
    lobbies.delete('HC-PLAY02');
    lobbies.delete('HC-LOBBY01');
  });

  it('does NOT emit lobby:hostLeft when host grace timer fires during playing phase', () => {
    mock.timers.enable({ apis: ['setTimeout'] });

    const roomCode = 'HC-PLAY01';
    makePlayingLobby(roomCode);

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(socket, 'disconnecting');

    // Advance fake timers past the 5 s grace period.
    mock.timers.tick(6000);

    assert.ok(!emitted.room['lobby:hostLeft'],
      'lobby:hostLeft must NOT be emitted when host disconnects during playing phase');
  });

  it('emits game:stateUpdate (not lobby:hostLeft) when host grace timer fires during playing phase', () => {
    mock.timers.enable({ apis: ['setTimeout'] });

    const roomCode = 'HC-PLAY02';
    makePlayingLobby(roomCode);

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(socket, 'disconnecting');

    // Clear the stateUpdate emitted by the immediate disconnecting handler so
    // we can detect only the timer-fired emission.
    delete emitted.room['game:stateUpdate'];

    mock.timers.tick(6000);

    assert.ok(emitted.room['game:stateUpdate'],
      'game:stateUpdate should be emitted when host timer fires in playing phase');
  });

  it('STILL emits lobby:hostLeft when host grace timer fires during lobby phase', () => {
    mock.timers.enable({ apis: ['setTimeout'] });

    const roomCode = 'HC-LOBBY01';
    // Create a lobby but do NOT start the game — phase stays 'lobby'.
    lobbies.delete(roomCode);
    const { createLobby: cl, addPlayer: ap } = require('./game');
    cl(roomCode, 'host-socket', 'Alice');
    ap(roomCode, 'p2-socket', 'Bob');

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');
    // In lobby phase, disconnecting handler skips the game-phase block.
    trigger(socket, 'disconnecting');

    mock.timers.tick(6000);

    assert.ok(emitted.room['lobby:hostLeft'],
      'lobby:hostLeft should still be emitted when host disconnects in lobby phase');
  });
});

// -- reconnect-before-disconnect race condition (Fix A) ---------------------------
// When the new socket connects and emits reconnectRoom BEFORE the old socket's
// 'disconnecting' event fires, replacePlayerSocket updates player.socketId to the
// new socket id. The old socket's disconnecting handler must NOT mark the player
// disconnected or advance the turn in this case.

describe('disconnecting handler - skips hold when player already reconnected', () => {
  afterEach(() => {
    lobbies.delete('FIX-A01');
    lobbies.delete('FIX-A02');
  });

  it('does NOT set disconnected=true when player socketId already changed (reconnect-before-disconnect)', () => {
    const roomCode = 'FIX-A01';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 1; // Bob is active; Alice is NOT active

    // Simulate reconnect already happened: Alice's socketId is now 'new-alice-socket'
    const alice = lobby.players.find(p => p.name === 'Alice');
    alice.socketId = 'new-alice-socket';
    // Also update hostId so replacePlayerSocket result is consistent
    lobby.hostId = 'new-alice-socket';

    // Old socket fires 'disconnecting' with the OLD socket id
    const { socket } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(socket, 'disconnecting');

    // Alice's disconnected flag must remain false — her old socket disconnecting
    // must not clobber the live player's state
    assert.strictEqual(alice.disconnected, false,
      'disconnected must NOT be set when player already reconnected with new socket');
    assert.strictEqual(alice.disconnectedAt, undefined,
      'disconnectedAt must NOT be set when player already reconnected');
  });

  it('does NOT advance the turn when disconnecting socket is stale (player already reconnected)', () => {
    const roomCode = 'FIX-A02';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is active

    // Simulate reconnect already happened: Alice's socketId is now 'new-alice-socket'
    const alice = lobby.players.find(p => p.name === 'Alice');
    alice.socketId = 'new-alice-socket';
    lobby.hostId = 'new-alice-socket';

    const { socket } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(socket, 'disconnecting');

    // activeTurnIndex must NOT have advanced — Alice is still live and active
    assert.strictEqual(lobby.activeTurnIndex, 0,
      'activeTurnIndex must NOT advance when old socket disconnects after player already reconnected');
  });
});

// -- player stays in lobby after grace timer expires in playing phase (Fix B) -----
// When the grace timer fires without a reconnect, the player must remain in
// lobby.players as a disconnected slot (not be removed). This allows a late
// reconnectRoom (page load slower than 5s) to still find and reactivate them.

describe('disconnecting timer — player kept in lobby after timer expires in playing phase', () => {
  afterEach(() => {
    mock.timers.reset();
    lobbies.delete('FIX-B01');
    lobbies.delete('FIX-B02');
  });

  it('keeps the host in lobby.players after the grace timer fires in playing phase', () => {
    mock.timers.enable({ apis: ['setTimeout'] });

    const roomCode = 'FIX-B01';
    const lobby = makePlayingLobby(roomCode);

    const { socket } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(socket, 'disconnecting');

    // Before timer: Alice is still there
    assert.ok(lobby.players.find(p => p.name === 'Alice'),
      'Alice should be in lobby.players before timer fires');

    mock.timers.tick(6000); // grace period expires

    // After timer: Alice must STILL be in lobby.players (not removed)
    const alice = lobby.players.find(p => p.name === 'Alice');
    assert.ok(alice,
      'Alice must remain in lobby.players after grace timer fires in playing phase');
    assert.strictEqual(alice.disconnected, true,
      'Alice should remain marked disconnected after timer fires');
  });

  it('allows reconnectRoom to succeed even after the grace timer has fired', () => {
    mock.timers.enable({ apis: ['setTimeout'] });

    const roomCode = 'FIX-B02';
    const lobby = makePlayingLobby(roomCode);

    // Old socket disconnects
    const { socket } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(socket, 'disconnecting');

    // Grace timer fires — old path would have removed Alice, blocking reconnect
    mock.timers.tick(6000);

    // Now Alice reconnects with a new socket (late — after the grace window)
    const { socket: newSocket, emitted: newEmitted } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(newSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    // reconnectRoom must NOT emit room:error — player should be found in lobby
    assert.ok(!newEmitted.socket['room:error'],
      'room:error must NOT be emitted — Alice must still be findable after timer fires');

    // game:reconnect must be emitted to restore her game screen
    assert.ok(newEmitted.socket['game:reconnect'],
      'game:reconnect must be emitted so Alice can restore the game screen');

    // Alice should no longer be marked disconnected
    const alice = lobby.players.find(p => p.name === 'Alice');
    assert.strictEqual(alice.disconnected, false,
      'disconnected flag must be cleared after successful late reconnect');
  });
});

// -- host-refresh-turn-skip: after host reloads, Bob must be able to place ---------------
// This covers the full scenario: Alice reloads, Bob becomes active, BOB CAN PLACE.
// Tests both fast-reload and slow-reload paths end-to-end.

describe('host-refresh-turn-skip — Bob can place after Alice reconnects (fast-reload)', () => {
  afterEach(() => {
    lobbies.delete('HRT-FAST01');
    lobbies.delete('HRT-FAST02');
  });

  it('fast-reload: after Alice reconnects (was active), Bob can place a piece', () => {
    // Scenario: activeTurnIndex=0 (Alice), Alice fast-reloads.
    // After reconnect, activeTurnIndex=1 (Bob). Bob must be able to place.
    const roomCode = 'HRT-FAST01';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is active

    // Fast-reload: Alice's new socket emits reconnectRoom (before disconnecting)
    const { socket: reconnectSocket } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(reconnectSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    // Verify activeTurnIndex advanced to Bob
    assert.strictEqual(lobby.activeTurnIndex, 1,
      'activeTurnIndex must be 1 (Bob) after Alice fast-reloads');

    // Now Bob tries to place a piece — must succeed
    const { socket: bobSocket, emitted: bobEmitted } = makeMocks(roomCode, 'p2-socket', 'Bob');
    trigger(bobSocket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

    assert.ok(!bobEmitted.socket['game:error'],
      'Bob must NOT receive game:error — it is Bob\'s turn after Alice fast-reloads');
    assert.ok(bobEmitted.room['game:stateUpdate'],
      'game:stateUpdate must be broadcast after Bob\'s valid placement');
  });

  it('fast-reload: game:reconnect broadcast shows Bob as active so his client renders bank interactive', () => {
    const roomCode = 'HRT-FAST02';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is active

    const { socket: reconnectSocket, emitted } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(reconnectSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    // The room broadcast (game:stateUpdate) must show Bob as active so Bob's client
    // renders his bank as interactive
    assert.ok(emitted.room['game:stateUpdate'],
      'game:stateUpdate must be broadcast to room');
    const roomPayload = emitted.room['game:stateUpdate'][0].payload;
    assert.strictEqual(roomPayload.activePlayerName, 'Bob',
      'room game:stateUpdate must show Bob as active (his bank renders interactive)');
    assert.strictEqual(roomPayload.activeTurnIndex, 1,
      'room game:stateUpdate activeTurnIndex must be 1 (Bob)');
  });
});

describe('host-refresh-turn-skip — Bob can place after Alice reconnects (slow-reload)', () => {
  afterEach(() => {
    lobbies.delete('HRT-SLOW01');
    lobbies.delete('HRT-SLOW02');
  });

  it('slow-reload: after Alice disconnects+reconnects (was active), Bob can place a piece', () => {
    // Scenario: activeTurnIndex=0 (Alice), Alice slow-reloads (disconnecting fires first).
    // After reconnect, activeTurnIndex=1 (Bob). Bob must be able to place.
    const roomCode = 'HRT-SLOW01';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is active

    // Step 1: Slow-reload — old socket disconnects first
    const { socket: oldSocket } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(oldSocket, 'disconnecting');

    // After disconnecting: turn should have advanced to Bob (Alice was active)
    assert.strictEqual(lobby.activeTurnIndex, 1,
      'activeTurnIndex must advance to 1 (Bob) when Alice disconnects from active state');

    // Step 2: Alice reconnects with new socket
    const { socket: newSocket } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(newSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    // activeTurnIndex must still be 1 (no double-advance)
    assert.strictEqual(lobby.activeTurnIndex, 1,
      'activeTurnIndex must remain 1 (Bob) after slow-reload reconnect');

    // Step 3: Bob tries to place — must succeed
    const { socket: bobSocket, emitted: bobEmitted } = makeMocks(roomCode, 'p2-socket', 'Bob');
    trigger(bobSocket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

    assert.ok(!bobEmitted.socket['game:error'],
      'Bob must NOT receive game:error — it is Bob\'s turn after Alice slow-reloads');
    assert.ok(bobEmitted.room['game:stateUpdate'],
      'game:stateUpdate must be broadcast after Bob\'s valid placement');
  });

  it('slow-reload: game:stateUpdate from reconnectRoom shows Bob active so his bank renders interactive', () => {
    const roomCode = 'HRT-SLOW02';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is active

    const { socket: oldSocket } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(oldSocket, 'disconnecting');

    const { socket: newSocket, emitted } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(newSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    // The room broadcast from reconnectRoom must show Bob as active
    assert.ok(emitted.room['game:stateUpdate'],
      'game:stateUpdate must be broadcast to room on reconnect');
    const roomPayload = emitted.room['game:stateUpdate'][0].payload;
    assert.strictEqual(roomPayload.activePlayerName, 'Bob',
      'room game:stateUpdate must show Bob as active so his bank renders interactive');
    assert.strictEqual(roomPayload.activeTurnIndex, 1,
      'room game:stateUpdate activeTurnIndex must be 1 (Bob)');
  });
});

// -- Fix C: fast-reload must not grant active player an extra turn (host-reload-extra-turn) --
// When reconnectRoom fires BEFORE the old socket's disconnecting event (fast reload),
// the disconnecting guard (socketId check) prevents advanceTurn from being called —
// leaving activeTurnIndex pointing at the reconnecting player. Without the fix, the
// reconnecting player could take an "extra" turn and the other player's client would
// never receive a game:stateUpdate telling it the turn changed, leaving Bob's bank
// non-interactive until Alice moved.
// Fix: reconnectRoom advances the turn when the reconnecting player is the active player,
// AND broadcasts game:stateUpdate to the room so all clients (including Bob) get updated.

describe('reconnectRoom handler - fast-reload must not grant active player extra turn (Fix C)', () => {
  afterEach(() => {
    lobbies.delete('FIX-C01');
    lobbies.delete('FIX-C02');
    lobbies.delete('FIX-C03');
    lobbies.delete('FIX-C04');
    lobbies.delete('FIX-C05');
    lobbies.delete('FIX-C06');
  });

  it('advances activeTurnIndex to Bob when Alice (active) reconnects before her old socket disconnects', () => {
    const roomCode = 'FIX-C01';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is the active player

    // Fast-reload: new socket emits reconnectRoom BEFORE old socket fires disconnecting.
    // At this point player.socketId is still 'host-socket' (reconnectRoom will update it).
    const { socket: newSocket } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(newSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    // After reconnectRoom, activeTurnIndex must have advanced to Bob (index 1)
    assert.strictEqual(lobby.activeTurnIndex, 1,
      'activeTurnIndex must advance to Bob (1) when active player reconnects via fast-reload');
  });

  it('game:reconnect payload shows Bob as active player after Alice fast-reloads', () => {
    const roomCode = 'FIX-C02';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is the active player

    const { socket: newSocket, emitted } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(newSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    assert.ok(emitted.socket['game:reconnect'], 'game:reconnect must be emitted');
    const reconnectPayload = emitted.socket['game:reconnect'][0];
    assert.strictEqual(reconnectPayload.activePlayerName, 'Bob',
      'game:reconnect must show Bob as active player after Alice fast-reloads');
    assert.strictEqual(reconnectPayload.activeTurnIndex, 1,
      'game:reconnect activeTurnIndex must be 1 (Bob) after Alice fast-reloads');
  });

  it('does NOT double-advance turn when Alice reconnects via slow-reload (disconnect fires first)', () => {
    // Slow-reload: disconnecting fires first, advanceTurn → Bob. Then reconnectRoom.
    // reconnectRoom must NOT call advanceTurn again (that would skip Bob and go back to Alice).
    const roomCode = 'FIX-C03';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is the active player

    // Step 1: Old socket disconnects first (slow-reload ordering)
    const { socket: oldSocket } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(oldSocket, 'disconnecting');

    // After disconnecting: advanceTurn should have moved turn to Bob (1)
    assert.strictEqual(lobby.activeTurnIndex, 1,
      'After disconnecting, activeTurnIndex should be 1 (Bob)');

    // Step 2: Alice reconnects with new socket
    const { socket: newSocket } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(newSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    // activeTurnIndex must still be 1 (Bob) — must NOT have double-advanced back to Alice
    assert.strictEqual(lobby.activeTurnIndex, 1,
      'activeTurnIndex must remain 1 (Bob) after slow-reload reconnect — no double-advance');
  });

  it('broadcasts game:stateUpdate to room in fast-reload so Bob knows it is his turn', () => {
    // In fast-reload, disconnecting's game-phase block is SKIPPED (socketId guard fails),
    // so no game:stateUpdate is broadcast by disconnecting. reconnectRoom must broadcast
    // game:stateUpdate itself so Bob's client gets the updated turn state.
    const roomCode = 'FIX-C04';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is active

    const { socket: newSocket, emitted } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(newSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    assert.ok(emitted.room['game:stateUpdate'],
      'game:stateUpdate must be broadcast to room in fast-reload reconnect');
    const su = emitted.room['game:stateUpdate'][0].payload;
    assert.strictEqual(su.activeTurnIndex, 1,
      'broadcast game:stateUpdate must show Bob (1) as active player');
    assert.strictEqual(su.activePlayerName, 'Bob',
      'broadcast game:stateUpdate must name Bob as active player');
  });

  it('broadcasts game:stateUpdate to room in slow-reload so clients see Alice is no longer disconnected', () => {
    // In slow-reload, disconnecting broadcasts stateUpdate (Alice disconnected, Bob active).
    // Then reconnectRoom clears Alice.disconnected. reconnectRoom must broadcast another
    // stateUpdate so all clients see Alice is back (not showing disconnected badge).
    const roomCode = 'FIX-C05';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is active

    // Step 1: Old socket disconnects first
    const { socket: oldSocket } = makeMocks(roomCode, 'host-socket', 'Alice');
    trigger(oldSocket, 'disconnecting');

    // Verify stateUpdate from disconnecting shows Alice disconnected
    // (captured on oldSocket's emitted - it's the io.to broadcast)
    // We won't check oldSocket's emitted here, just verify the reconnect does its own

    // Step 2: Alice reconnects
    const { socket: newSocket, emitted } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(newSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    assert.ok(emitted.room['game:stateUpdate'],
      'game:stateUpdate must be broadcast to room in slow-reload reconnect');
    const su = emitted.room['game:stateUpdate'][0].payload;
    // Alice should NOT be showing as disconnected in the broadcast
    const aliceInPayload = su.players.find(p => p.name === 'Alice');
    assert.strictEqual(aliceInPayload.disconnected, false,
      'Alice must NOT be shown as disconnected in the stateUpdate after reconnect');
    // Bob must still be the active player
    assert.strictEqual(su.activePlayerName, 'Bob',
      'Bob must still be active player in slow-reload stateUpdate');
  });

  it('server blocks Alice from moving after fast-reload (activeTurnIndex has advanced to Bob)', () => {
    // Even if Alice somehow tries to emit game:move after reconnecting, the server
    // must reject it because activeTurnIndex now points to Bob.
    const roomCode = 'FIX-C06';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is active

    // Fast-reload: reconnectRoom fires first
    const { socket: reconnectSocket } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(reconnectSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    // Now Alice tries to make a move with her new socket
    const { socket: moveSocket, emitted: moveEmitted } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(moveSocket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });

    assert.ok(moveEmitted.socket['game:error'],
      'server must reject Alice\'s move with game:error after her turn was advanced');
    assert.strictEqual(moveEmitted.socket['game:error'][0], 'Not your turn',
      'error must be "Not your turn" because activeTurnIndex is now Bob\'s');
  });
});

describe('Fix-C: advance turn past reconnecting player even when other players are in grace-period', () => {
  afterEach(() => {
    lobbies.delete('FIX-C-GUARD01');
    lobbies.delete('FIX-C-GUARD02');
  });

  it('Fix-C advances turn to Bob (grace-period) — Alice loses her active turn on fast reload', () => {
    // Scenario: Alice is active (index 0), Bob is in grace-period (disconnected=true).
    // Alice fast-reloads. Fix C must still advance to Bob (index 1) even though Bob is
    // currently marked disconnected. Bob will pick up his turn when he reconnects.
    // Previously a hasOtherActive guard skipped Fix-C in this case, leaving Alice active
    // after her own reload — that was the reported bug.
    const roomCode = 'FIX-C-GUARD01';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is active

    // Put Bob in grace-period: mark disconnected (as disconnecting handler does)
    const bob = lobby.players.find(p => p.name === 'Bob');
    bob.disconnected = true;
    bob.disconnectedAt = Date.now();

    // Alice fast-reloads: new socket emits reconnectRoom
    const { socket: reconnectSocket, emitted } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(reconnectSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    // activeTurnIndex must advance to 1 (Bob) — Fix-C fired despite Bob being in grace-period
    assert.strictEqual(lobby.activeTurnIndex, 1,
      'activeTurnIndex must advance to 1 (Bob) even when Bob is in grace-period disconnect');

    // The game:reconnect sent to Alice must show Bob as active
    assert.ok(emitted.socket['game:reconnect'],
      'game:reconnect must be sent to Alice');
    const reconnectPayload = emitted.socket['game:reconnect'][0];
    assert.strictEqual(reconnectPayload.activePlayerName, 'Bob',
      'game:reconnect must show Bob as active — Alice must not get a free extra turn');

    // Alice must NOT be able to place — it is now Bob's turn
    const { socket: aliceSocket, emitted: aliceEmitted } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(aliceSocket, 'game:move', { action: 'place', shapeId: 'B', rotation: 0, originRow: 0, originCol: 1 });
    assert.ok(aliceEmitted.socket['game:error'],
      'Alice must get game:error — it is now Bob\'s turn, not Alice\'s');
    assert.strictEqual(aliceEmitted.socket['game:error'][0], 'Not your turn',
      'error must be "Not your turn"');
  });

  it('Fix-C DOES advance turn to Bob when Bob is NOT disconnected', () => {
    // Sanity check: normal case still works
    const roomCode = 'FIX-C-GUARD02';
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0; // Alice is active
    // Bob is NOT disconnected (default state)

    const { socket: reconnectSocket, emitted } = makeMocks(roomCode, 'new-alice-socket', 'Alice');
    trigger(reconnectSocket, 'reconnectRoom', { roomCode, playerName: 'Alice' });

    // activeTurnIndex must advance to 1 (Bob)
    assert.strictEqual(lobby.activeTurnIndex, 1,
      'activeTurnIndex must advance to 1 (Bob) when Fix-C fires and Bob is connected');

    const reconnectPayload = emitted.socket['game:reconnect'][0];
    assert.strictEqual(reconnectPayload.activePlayerName, 'Bob',
      'game:reconnect must show Bob as active');
  });
});
