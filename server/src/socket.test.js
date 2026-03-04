'use strict';

/**
 * Unit tests for the game:move socket handler in socket.js.
 *
 * Strategy: Mock io and socket objects to capture emitted events, then
 * call registerSocketHandlers and invoke event handlers directly.
 * This avoids needing socket.io-client while fully exercising handler logic.
 */

const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  lobbies,
  loadPuzzles,
  createLobby,
  addPlayer,
  startGame,
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
