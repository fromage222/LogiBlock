'use strict';

/**
 * Unit tests for the game:move socket handler in socket.js.
 *
 * Strategy: Mock io and socket objects to capture emitted events, then
 * call registerSocketHandlers and invoke event handlers directly.
 * This avoids needing socket.io-client while fully exercising handler logic.
 */

const { describe, it, before, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  lobbies,
  loadPuzzles,
  createLobby,
  addPlayer,
  startGame,
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
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0;
    setRandomMode(roomCode, true);

    // Stub Math.random: 0.05 is < 0.30 (event fires) and < 0.35 (picks rotate_piece)
    origRandom = Math.random;
    Math.random = () => 0.05;

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');
    // Track emission order
    const emitOrder = [];
    const origRoomEmit = emitted.room;

    // Intercept room emissions to track ordering — rebuild io with ordering tracking
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
    // Re-register with order-tracking io
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
    const registerSocketHandlers = require('./socket');
    registerSocketHandlers(ioWithOrder, socket2, new Map());

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
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0;
    setRandomMode(roomCode, true);

    // Stub Math.random so probability would fire if checked
    origRandom = Math.random;
    Math.random = () => 0.05;

    // Pre-place B so that placing C wins the game
    const { placePiece } = require('./game');
    placePiece(lobby, 'B', 0, 0, 1);
    lobby.activeTurnIndex = 0; // still Alice's turn

    const { socket, emitted } = makeMocks(roomCode, 'host-socket', 'Alice');

    // Place C to trigger win
    trigger(socket, 'game:move', { action: 'place', shapeId: 'C', rotation: 0, originRow: 1, originCol: 1 });

    assert.ok(emitted.room['game:win'], 'game:win should be emitted');
    assert.ok(!emitted.room['randomMode:event'], 'randomMode:event must NOT be emitted on winning move');
  });

  it('return action with randomModeEnabled=true does NOT emit randomMode:event', () => {
    const roomCode = 'SRM05';
    const lobby = makePlayingLobby(roomCode);
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
    const lobby = makePlayingLobby(roomCode);
    lobby.activeTurnIndex = 0;
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
