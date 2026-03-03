// main.js — LogiBlock client
// Vanilla JS + Socket.IO (no framework, no build tool)
// Socket.IO client loaded via <script src="/socket.io/socket.io.js"> in index.html

const socket = io();

// ─── State ────────────────────────────────────────────────────────────────────
let myRoomCode = null;
let amIHost = false;
let myPlayerName = null;

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
const copyCodeBtn      = document.getElementById('copy-code-btn');
const playerList       = document.getElementById('player-list');
const hostControls     = document.getElementById('host-controls');
const waitingMsg       = document.getElementById('waiting-msg');
const puzzleSelect     = document.getElementById('puzzle-select');
const startGameBtn     = document.getElementById('start-game-btn');
const lobbyNotification = document.getElementById('lobby-notification');

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

// ─── Copy room code to clipboard ──────────────────────────────────────────────
copyCodeBtn.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(roomCodeText.textContent);
    copyCodeBtn.textContent = 'Copied!';
    setTimeout(() => { copyCodeBtn.textContent = 'Copy'; }, 2000);
  } catch (err) {
    // Fallback for non-HTTPS contexts (shouldn't happen on localhost)
    console.warn('Clipboard write failed:', err);
  }
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
    // Enable start button only when >= 2 players (LOBB-04)
    startGameBtn.disabled = state.players.length < 2;
  } else {
    hostControls.style.display = 'none';
    waitingMsg.style.display = 'block';
  }

  // Sync puzzle dropdown to currently selected puzzle (for non-host: read-only)
  if (state.selectedPuzzleId && puzzleSelect.options.length > 0) {
    puzzleSelect.value = state.selectedPuzzleId;
  }
}

// ─── Grid rendering (game screen) ────────────────────────────────────────────
function renderGrid(state) {
  gameGrid.innerHTML = '';

  if (!state.grid || !state.gridSize) return;

  const { rows, cols } = state.gridSize;
  gameGrid.style.gridTemplateColumns = `repeat(${cols}, 40px)`;
  gameGrid.style.gridTemplateRows    = `repeat(${rows}, 40px)`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.classList.add('grid-cell');

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
      }

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
  alert(message || 'Host left — lobby closed');
  myRoomCode = null;
  amIHost = false;
  showScreen('start-screen');
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
