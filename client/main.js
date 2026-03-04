// main.js — LogiBlock client
// Vanilla JS + Socket.IO (no framework, no build tool)
// Socket.IO client loaded via <script src="/socket.io/socket.io.js"> in index.html

const socket = io();

// ─── State ────────────────────────────────────────────────────────────────────
let myRoomCode = null;
let amIHost = false;
let myPlayerName = null;

// Phase 2: game interaction state
let selectedShapeId = null;   // currently selected piece in bank
let selectedRotation = 0;     // rotation of selected piece: 0|90|180|270
let pieceColors = {};         // Map<shapeId, colorString>
let currentGrid = null;       // cached grid data for ghost preview (null cells)
let currentGridSize = null;   // cached { rows, cols }
let currentBankShapes = [];   // cached bankShapes array for ghost lookup

// ─── Rotation helpers (same math as server — duplicated per no-build-tools constraint) ───
function rotateCells90CW(cells) {
  const rotated = cells.map(([dr, dc]) => [dc, -dr]);
  const minR = Math.min(...rotated.map(([r]) => r));
  const minC = Math.min(...rotated.map(([, c]) => c));
  return rotated.map(([r, c]) => [r - minR, c - minC]);
}
function rotateCells(cells, rotation) {
  let result = cells.slice();
  const times = ((rotation / 90) % 4 + 4) % 4;
  for (let i = 0; i < times; i++) result = rotateCells90CW(result);
  return result;
}

// ─── Piece color assignment ───────────────────────────────────────────────────
const PIECE_COLORS = ['#5c85d6', '#e07b39', '#6ab187', '#c05c7e', '#9b6bb5', '#c8b84a'];
function initPieceColors(state) {
  // Collect all movable shape IDs from bank + grid
  const ids = new Set();
  (state.bankShapes || []).forEach(s => ids.add(s.id));
  if (state.grid) {
    state.grid.forEach(row => row.forEach(cell => {
      if (cell && cell.movable !== false) ids.add(cell.shapeId);
    }));
  }
  let i = 0;
  ids.forEach(id => { pieceColors[id] = PIECE_COLORS[i++ % PIECE_COLORS.length]; });
}

// ─── DOM references ───────────────────────────────────────────────────────────
const startScreen   = document.getElementById('start-screen');
const lobbyScreen   = document.getElementById('lobby-screen');
const gameScreen    = document.getElementById('game-screen');

const playerNameInput  = document.getElementById('player-name-input');
const createRoomBtn    = document.getElementById('create-room-btn');
const roomCodeInput    = document.getElementById('room-code-input');
const joinRoomBtn      = document.getElementById('join-room-btn');
const joinError        = document.getElementById('join-error');

const roomCodeText     = document.getElementById('room-code-text');
const playerList       = document.getElementById('player-list');
const hostControls     = document.getElementById('host-controls');
const waitingMsg       = document.getElementById('waiting-msg');
const puzzleSelect     = document.getElementById('puzzle-select');
const startGameBtn     = document.getElementById('start-game-btn');
const lobbyNotification = document.getElementById('lobby-notification');
const selectedPuzzleDisplay = document.getElementById('selected-puzzle-display');

const gameGrid         = document.getElementById('game-grid');

// ─── Screen switching ─────────────────────────────────────────────────────────
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ─── Inline error display ─────────────────────────────────────────────────────
function showJoinError(message) {
  joinError.textContent = message;
  joinError.style.display = 'block';
}

function clearJoinError() {
  joinError.textContent = '';
  joinError.style.display = 'none';
}

function showLobbyNotification(message) {
  lobbyNotification.textContent = message;
  setTimeout(() => { lobbyNotification.textContent = ''; }, 4000);
}

// ─── Start screen actions ─────────────────────────────────────────────────────
createRoomBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (!name) {
    showJoinError('Please enter your name');
    return;
  }
  clearJoinError();
  myPlayerName = name;
  socket.emit('createRoom', { playerName: name });
});

joinRoomBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  const code = roomCodeInput.value.trim();
  if (!name) {
    showJoinError('Please enter your name');
    return;
  }
  if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
    showJoinError('Please enter a valid 6-digit room code');
    return;
  }
  clearJoinError();
  myPlayerName = name;
  socket.emit('joinRoom', { roomCode: code, playerName: name });
});

// ─── Puzzle selection (host only) ─────────────────────────────────────────────
puzzleSelect.addEventListener('change', () => {
  if (!amIHost) return;
  socket.emit('lobby:selectPuzzle', { puzzleId: puzzleSelect.value });
});

// ─── Start game (host only) ───────────────────────────────────────────────────
startGameBtn.addEventListener('click', () => {
  if (!amIHost) return;
  socket.emit('startGame');
});

// ─── Lobby state rendering ────────────────────────────────────────────────────
function renderLobbyUpdate(state) {
  // Player list
  playerList.innerHTML = '';
  state.players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = player.name + (player.isHost ? ' (Host)' : '');
    if (player.name === myPlayerName) li.classList.add('me');
    playerList.appendChild(li);
  });

  // Determine if I am host (check by name — socket.id may differ if reconnected)
  const me = state.players.find(p => p.name === myPlayerName);
  amIHost = me ? me.isHost : false;

  // Host controls visibility
  if (amIHost) {
    hostControls.style.display = 'block';
    waitingMsg.style.display = 'none';
    selectedPuzzleDisplay.style.display = 'none';
    // Enable start button only when >= 2 players (LOBB-04)
    startGameBtn.disabled = state.players.length < 2;
    // Sync host dropdown to selected puzzle
    if (state.selectedPuzzleId && puzzleSelect.options.length > 0) {
      puzzleSelect.value = state.selectedPuzzleId;
    }
  } else {
    hostControls.style.display = 'none';
    waitingMsg.style.display = 'block';
    // Show selected puzzle name to non-hosts (state always includes selectedPuzzleName)
    if (state.selectedPuzzleName) {
      selectedPuzzleDisplay.textContent = `Selected puzzle: ${state.selectedPuzzleName}`;
      selectedPuzzleDisplay.style.display = 'block';
    }
  }
}

// ─── Grid rendering (game screen) ────────────────────────────────────────────
function renderGrid(state) {
  gameGrid.innerHTML = '';

  if (!state.grid || !state.gridSize) return;

  // Cache grid data for ghost preview
  currentGrid = state.grid;
  currentGridSize = state.gridSize;
  currentBankShapes = state.bankShapes || [];

  const { rows, cols } = state.gridSize;
  gameGrid.style.gridTemplateColumns = `repeat(${cols}, 40px)`;
  gameGrid.style.gridTemplateRows    = `repeat(${rows}, 40px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.classList.add('grid-cell');
      cell.setAttribute('data-row', r);
      cell.setAttribute('data-col', c);

      const content = state.grid[r][c];
      if (content === null) {
        cell.classList.add('empty');
      } else if (content.movable === false) {
        // Anchor cell — pre-placed, non-interactive (PUZZ-02)
        cell.classList.add('anchor');
        cell.textContent = content.shapeId;
        cell.title = `Anchor: ${content.shapeId} (cannot be moved)`;
      } else {
        cell.classList.add('placed');
        cell.textContent = content.shapeId;
        // Per-piece color override (replaces CSS .placed green)
        cell.style.background = pieceColors[content.shapeId] || '#81c784';
        cell.style.color = '#fff';
        // Click to return piece to bank
        cell.addEventListener('click', () => handleReturnClick(content.shapeId));
      }

      // Drag event listeners on ALL cells (empty + placed) for ghost preview and drop
      cell.addEventListener('dragover', (e) => handleDragOver(e, r, c));
      cell.addEventListener('dragleave', () => {}); // no-op — ghost cleared on dragend
      cell.addEventListener('drop', (e) => handleDrop(e, r, c));

      gameGrid.appendChild(cell);
    }
  }
}

// ─── Socket event listeners ───────────────────────────────────────────────────

// Room created (only received by the creator)
socket.on('room:created', ({ roomCode }) => {
  myRoomCode = roomCode;
  roomCodeText.textContent = roomCode;
  showScreen('lobby-screen');
});

// Puzzle list received (on create or join)
socket.on('puzzle:list', (puzzles) => {
  puzzleSelect.innerHTML = '';
  puzzles.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    puzzleSelect.appendChild(option);
  });
});

// Lobby state update (any player join/leave/puzzle change)
socket.on('lobby:update', (state) => {
  myRoomCode = state.roomCode;
  roomCodeText.textContent = state.roomCode;
  // Transition to lobby screen if still on start screen (joiner flow)
  if (startScreen.classList.contains('active')) {
    showScreen('lobby-screen');
  }
  renderLobbyUpdate(state);
});

// Player left notification (brief message, then lobby:update follows from server)
socket.on('lobby:playerLeft', ({ playerName }) => {
  showLobbyNotification(`${playerName} left the game`);
});

// Host left during lobby — destroy UI, return to start
socket.on('lobby:hostLeft', ({ message }) => {
  myRoomCode = null;
  amIHost = false;
  showScreen('start-screen');
  // Use inline error (not alert — browsers silently block repeated alert() calls)
  showJoinError(message || 'Host left — lobby closed');
  setTimeout(clearJoinError, 4000);
});

// Game started — transition to game screen, render initial grid
socket.on('game:start', (state) => {
  showScreen('game-screen');
  renderGrid(state);
});

// Game state update during play (e.g., on disconnect — Phase 2 will also use this)
socket.on('game:stateUpdate', (state) => {
  renderGrid(state);
});

// Inline error — show under the join input on start screen; or as notification in lobby
socket.on('room:error', (message) => {
  if (startScreen.classList.contains('active')) {
    showJoinError(message);
  } else {
    showLobbyNotification(`Error: ${message}`);
  }
});
