// main.js — LogiBlock client
// Vanilla JS + Socket.IO (no framework, no build tool)
// Socket.IO client loaded via <script src="/socket.io/socket.io.js"> in index.html

const socket = io();

// ─── Theme (dark / light mode) ────────────────────────────────────────────────
const themeToggleBtn = document.getElementById('theme-toggle');

function applyTheme(dark) {
  document.body.classList.toggle('dark-mode', dark);
  themeToggleBtn.textContent = dark ? '🌙' : '☀️';
}

applyTheme(localStorage.getItem('logiblock-theme') === 'dark');

themeToggleBtn.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark-mode');
  localStorage.setItem('logiblock-theme', isDark ? 'light' : 'dark');
  applyTheme(!isDark);
});

// ─── State ────────────────────────────────────────────────────────────────────
let myRoomCode = null;
let amIHost = false;
let myPlayerName = null;
let timerInterval = null;

// Phase 2: game interaction state
let selectedShapeId = null;   // currently selected piece in bank
let selectedRotation = 0;     // rotation of selected piece: 0|90|180|270
let pieceColors = {};         // Map<shapeId, colorString>
let currentGrid = null;       // cached grid data for ghost preview (null cells)
let currentGridSize = null;   // cached { rows, cols }
let currentBankShapes = [];   // cached bankShapes array for ghost lookup

// Phase 10: interaction state
let lastHoveredRow = null;  // cached from last mousemove — used to re-trigger ghost after rotation
let lastHoveredCol = null;

// Phase 10: touch interaction state
let touchDragging = false;
let longPressTimer = null;

// ─── Difficulty labels (Phase 8) ─────────────────────────────────────────────
const DIFFICULTY_LABELS = {
  easy:   'Einfach',
  medium: 'Mittel',
  hard:   'Schwer',
};

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
const PIECE_COLORS = [
  '#5c85d6',  // blue      (P01)
  '#e07b39',  // orange    (P02)
  '#6ab187',  // green     (P03)
  '#c05c7e',  // pink      (P04)
  '#9b6bb5',  // purple    (P05)
  '#c8b84a',  // yellow    (P06)
  '#3aada8',  // teal      (P07) — distinct from blue/green
  '#c0583a',  // rust-red  (P08) — distinct from orange/pink
  '#8a6a3e',  // brown-tan (P09) — distinct from yellow/purple
  '#7ab83a',  // lime      (P10) — distinct from teal/rust
];
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
    // Sync random mode toggle and wire input listener once
    const randomToggle = document.getElementById('random-mode-toggle');
    if (randomToggle) {
      randomToggle.value = state.randomMode ? 1 : 0;
      if (!randomToggle._randomModeWired) {
        randomToggle._randomModeWired = true;
        randomToggle.addEventListener('input', () => {
          if (!amIHost) return;
          socket.emit('lobby:randomMode', { enabled: randomToggle.value === '1' });
        });
      }
    }
  } else {
    hostControls.style.display = 'none';
    waitingMsg.style.display = 'block';
    // Show selected puzzle name to non-hosts (state always includes selectedPuzzleName)
    if (state.selectedPuzzleName) {
      const diffLabel = state.selectedPuzzleDifficulty
        ? (DIFFICULTY_LABELS[state.selectedPuzzleDifficulty] ?? state.selectedPuzzleDifficulty)
        : '';
      const displayName = diffLabel
        ? `${state.selectedPuzzleName} — ${diffLabel}`
        : state.selectedPuzzleName;
      selectedPuzzleDisplay.textContent = `Ausgewähltes Puzzle: ${displayName}`;
      selectedPuzzleDisplay.style.display = 'block';
    }
    // Show random mode status to non-hosts
    const randomDisplay = document.getElementById('random-mode-display');
    if (randomDisplay) {
      if (state.randomMode) {
        randomDisplay.textContent = 'Chaos-Modus: Aktiv';
        randomDisplay.style.display = 'block';
      } else {
        randomDisplay.textContent = '';
        randomDisplay.style.display = 'none';
      }
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
  gameGrid.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  gameGrid.style.gridTemplateRows    = `repeat(${rows}, var(--cell-size))`;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.classList.add('grid-cell');
      cell.setAttribute('data-row', r);
      cell.setAttribute('data-col', c);

      const content = state.grid[r][c];
      if (content?.inactive) {
        cell.classList.add('inactive');
        gameGrid.appendChild(cell);
        continue;  // skip mousemove + click listeners entirely
      } else if (content === null) {
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
      }

      // Mousemove: track position for ghost re-render after rotation + show ghost if piece selected
      cell.addEventListener('mousemove', () => {
        lastHoveredRow = r;
        lastHoveredCol = c;
        if (selectedShapeId) updateGhostPreview(r, c);
      });

      // Single click: place selected piece OR return placed movable piece
      cell.addEventListener('click', () => {
        if (selectedShapeId) {
          // Place the selected piece at this cell
          const shape = currentBankShapes.find(s => s.id === selectedShapeId);
          let originRow = r, originCol = c;
          if (shape) {
            const cells = rotateCells(shape.cells, selectedRotation);
            const [pivotDr, pivotDc] = getPivotOffset(cells);
            originRow = r - pivotDr;
            originCol = c - pivotDc;
          }
          socket.emit('game:move', {
            action: 'place',
            shapeId: selectedShapeId,
            rotation: selectedRotation,
            originRow,
            originCol,
          });
          selectedShapeId = null;
          selectedRotation = 0;
          clearGhostPreview();
          refreshCursorPiece();
          updateBankSelection();
          updateRotationButtons();
        } else if (content && content.movable !== false) {
          // Return placed movable piece to bank
          handleReturnClick(content.shapeId);
        }
      });

      // Touch: long-press return for placed movable pieces
      if (content && content.movable !== false && !content.inactive) {
        cell.addEventListener('touchstart', () => {
          if (selectedShapeId) return; // only long-press return when no piece selected
          clearTimeout(longPressTimer);
          longPressTimer = setTimeout(() => {
            handleReturnClick(content.shapeId);
            longPressTimer = null;
          }, 500);
        }, { passive: true });

        cell.addEventListener('touchend', () => {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        });

        cell.addEventListener('touchmove', () => {
          // Finger moved — cancel long press (it became a drag)
          clearTimeout(longPressTimer);
          longPressTimer = null;
        });
      }

      gameGrid.appendChild(cell);
    }
  }
}

// ─── Bank rendering (game screen) ────────────────────────────────────────────
function renderBank(state) {
  const bank = document.getElementById('piece-bank');
  bank.innerHTML = '';
  const amIActive = state.activePlayerName === myPlayerName;
  (state.bankShapes || []).forEach(shape => {
    const pieceEl = document.createElement('div');
    pieceEl.classList.add('bank-piece');
    pieceEl.dataset.shapeId = shape.id;
    pieceEl.draggable = amIActive; // controls CSS styling only; no dragstart listener
    if (!amIActive) pieceEl.style.pointerEvents = 'none';
    // Per-piece color
    const color = pieceColors[shape.id] || '#ccc';
    pieceEl.style.setProperty('--piece-color', color);
    // Mini CSS grid preview (canonical 0° cells only — never use selectedRotation here)
    pieceEl.appendChild(buildMiniGrid(shape.cells, color));
    // Label
    const label = document.createElement('span');
    label.textContent = shape.id;
    pieceEl.appendChild(label);
    // Selection: click to select (reset rotation to 0°); click same piece again to deselect
    pieceEl.addEventListener('click', () => {
      if (!amIActive) return;
      if (selectedShapeId === shape.id) {
        // Deselect
        selectedShapeId = null;
        selectedRotation = 0;
      } else {
        // Select — always reset rotation to 0 on bank selection
        selectedShapeId = shape.id;
        selectedRotation = 0;
      }
      updateBankSelection();
      updateRotationButtons();
    });

    // Touch: select piece and begin drag mode
    pieceEl.addEventListener('touchstart', (e) => {
      e.preventDefault(); // prevent scroll during piece selection
      if (!amIActive) return;
      if (selectedShapeId === shape.id) {
        // Deselect on second touch
        selectedShapeId = null;
        selectedRotation = 0;
      } else {
        selectedShapeId = shape.id;
        selectedRotation = 0;
      }
      updateBankSelection();
      updateRotationButtons();
      refreshCursorPiece();
    }, { passive: false });

    bank.appendChild(pieceEl);
  });
}

function buildMiniGrid(cells, color, cellSize = 8) {
  const maxR = Math.max(...cells.map(([r]) => r));
  const maxC = Math.max(...cells.map(([, c]) => c));
  const container = document.createElement('div');
  container.style.display = 'grid';
  container.style.gridTemplateColumns = `repeat(${maxC + 1}, ${cellSize}px)`;
  container.style.gridTemplateRows = `repeat(${maxR + 1}, ${cellSize}px)`;
  container.style.gap = '1px';
  container.style.pointerEvents = 'none';
  for (let r = 0; r <= maxR; r++) {
    for (let c = 0; c <= maxC; c++) {
      const cell = document.createElement('div');
      cell.style.width = `${cellSize}px`;
      cell.style.height = `${cellSize}px`;
      cell.style.borderRadius = '2px';
      cell.style.pointerEvents = 'none';
      const filled = cells.some(([dr, dc]) => dr === r && dc === c);
      cell.style.background = filled ? color : 'transparent';
      container.appendChild(cell);
    }
  }
  return container;
}

// ─── Cursor piece (floating piece that follows the mouse when selected) ────────
let _cursorEl = null;
function getCursorEl() {
  if (!_cursorEl) {
    _cursorEl = document.createElement('div');
    _cursorEl.style.cssText = [
      'position:fixed', 'pointer-events:none', 'z-index:1000',
      'display:none', 'transform:translate(-50%,-50%)',
      'background:rgba(255,255,255,0.93)', 'border:2px solid #4a6cf7',
      'border-radius:8px', 'padding:8px',
      'box-shadow:0 6px 18px rgba(0,0,0,0.25)',
    ].join(';');
    document.body.appendChild(_cursorEl);
  }
  return _cursorEl;
}
function refreshCursorPiece() {
  const el = getCursorEl();
  if (!selectedShapeId) { el.style.display = 'none'; return; }
  const shape = currentBankShapes.find(s => s.id === selectedShapeId);
  if (!shape) { el.style.display = 'none'; return; }
  const color = pieceColors[selectedShapeId] || '#ccc';
  el.innerHTML = '';
  el.appendChild(buildMiniGrid(rotateCells(shape.cells, selectedRotation), color, 22));
  el.style.display = 'block';
}
document.addEventListener('mousemove', (e) => {
  const el = getCursorEl();
  el.style.left = e.clientX + 'px';
  el.style.top = e.clientY + 'px';
  if (selectedShapeId) refreshCursorPiece();
});

function updateBankSelection() {
  document.querySelectorAll('.bank-piece').forEach(el => {
    const isSelected = el.dataset.shapeId === selectedShapeId;
    el.classList.toggle('selected', isSelected);
    if (isSelected) {
      // Rebuild mini grid to reflect current rotation
      const shape = currentBankShapes.find(s => s.id === el.dataset.shapeId);
      if (shape) {
        const rotatedCells = rotateCells(shape.cells, selectedRotation);
        const color = pieceColors[shape.id] || '#ccc';
        const oldMini = el.querySelector('div');
        if (oldMini) el.replaceChild(buildMiniGrid(rotatedCells, color), oldMini);
      }
    }
  });
  refreshCursorPiece();
}

// ─── Turn UI rendering ────────────────────────────────────────────────────────
function renderTurnUI(state) {
  const banner = document.getElementById('turn-banner');
  if (state.activePlayerName) {
    banner.textContent = state.activePlayerName === myPlayerName
      ? "It's your turn!"
      : `It's ${state.activePlayerName}'s turn`;
  } else {
    banner.textContent = '';
  }
  const badgesContainer = document.getElementById('player-badges');
  badgesContainer.innerHTML = '';
  (state.players || []).forEach(player => {
    const badge = document.createElement('div');
    badge.classList.add('player-badge');
    badge.textContent = player.name;
    if (player.name === state.activePlayerName) badge.classList.add('active');
    badgesContainer.appendChild(badge);
  });
}

// ─── Ghost preview helpers ────────────────────────────────────────────────────
function clearGhostPreview() {
  document.querySelectorAll('.ghost-valid, .ghost-invalid').forEach(el => {
    el.classList.remove('ghost-valid', 'ghost-invalid');
  });
}

// Returns the pivot offset so the piece's center cell sits under the cursor.
// Ghost and floating piece are both centered → they align regardless of rotation.
function getPivotOffset(cells) {
  const maxR = Math.max(...cells.map(([r]) => r));
  const maxC = Math.max(...cells.map(([, c]) => c));
  return [Math.floor(maxR / 2), Math.floor(maxC / 2)];
}

// hoverRow/Col = the grid cell the cursor is over (piece center target).
// Internally computes [0,0]-based origin via pivot offset.
function updateGhostPreview(hoverRow, hoverCol) {
  clearGhostPreview();
  if (!selectedShapeId || !currentGridSize) return;
  const shape = currentBankShapes.find(s => s.id === selectedShapeId);
  if (!shape) return;
  const cells = rotateCells(shape.cells, selectedRotation);
  const [pivotDr, pivotDc] = getPivotOffset(cells);
  const originRow = hoverRow - pivotDr;
  const originCol = hoverCol - pivotDc;
  const { rows, cols } = currentGridSize;
  const valid = cells.every(([dr, dc]) => {
    const r = originRow + dr, c = originCol + dc;
    return r >= 0 && r < rows && c >= 0 && c < cols &&
           currentGrid && currentGrid[r][c] === null;
  });
  cells.forEach(([dr, dc]) => {
    const r = originRow + dr, c = originCol + dc;
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const cellEl = document.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
    if (cellEl) cellEl.classList.add(valid ? 'ghost-valid' : 'ghost-invalid');
  });
}

// Clear ghost when cursor leaves the grid
gameGrid.addEventListener('mouseleave', () => {
  clearGhostPreview();
  lastHoveredRow = null;
  lastHoveredCol = null;
});

// Deselect piece when clicking outside the grid, bank, and rotation controls
document.addEventListener('click', (e) => {
  if (!selectedShapeId) return;
  if (!e.target.closest('#game-grid') && !e.target.closest('#piece-bank') && !e.target.closest('#rotation-controls')) {
    selectedShapeId = null;
    selectedRotation = 0;
    clearGhostPreview();
    refreshCursorPiece();
    updateBankSelection();
    updateRotationButtons();
  }
});

// ── Rotation button state ────────────────────────────────────────────────────
function updateRotationButtons() {
  const ccwBtn = document.getElementById('rotate-ccw-btn');
  const cwBtn = document.getElementById('rotate-cw-btn');
  if (ccwBtn) ccwBtn.disabled = !selectedShapeId;
  if (cwBtn) cwBtn.disabled = !selectedShapeId;
}

// ── Rotation button handlers (wired once) ────────────────────────────────────
document.getElementById('rotate-cw-btn').addEventListener('click', (e) => {
  e.stopPropagation(); // prevent document deselect handler
  if (!selectedShapeId) return;
  selectedRotation = (selectedRotation + 90) % 360;
  updateBankSelection();
  updateRotationButtons();
  if (lastHoveredRow !== null && lastHoveredCol !== null) {
    updateGhostPreview(lastHoveredRow, lastHoveredCol);
  }
});

document.getElementById('rotate-ccw-btn').addEventListener('click', (e) => {
  e.stopPropagation(); // prevent document deselect handler
  if (!selectedShapeId) return;
  selectedRotation = (selectedRotation + 270) % 360; // +270 = -90 mod 360
  updateBankSelection();
  updateRotationButtons();
  if (lastHoveredRow !== null && lastHoveredCol !== null) {
    updateGhostPreview(lastHoveredRow, lastHoveredCol);
  }
});

// ── R key rotation shortcut (EXT-01) ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key !== 'r' && e.key !== 'R') return;
  if (!selectedShapeId) return;
  if (!gameScreen.classList.contains('active')) return;
  selectedRotation = (selectedRotation + 90) % 360;
  updateBankSelection();
  updateRotationButtons();
  if (lastHoveredRow !== null && lastHoveredCol !== null) {
    updateGhostPreview(lastHoveredRow, lastHoveredCol);
  }
});

// ── Touch: drag-to-preview (document-level, wired once) ─────────────────────
document.addEventListener('touchmove', (e) => {
  if (!selectedShapeId) return;
  if (!gameScreen.classList.contains('active')) return;
  const touch = e.touches[0];
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (!el) return;

  // Hide cursor piece during touch drag (finger covers it)
  const cursorEl = getCursorEl();
  if (cursorEl) cursorEl.style.display = 'none';

  const row = parseInt(el.dataset.row);
  const col = parseInt(el.dataset.col);
  if (isNaN(row) || isNaN(col)) {
    // Finger moved off grid — clear ghost
    clearGhostPreview();
    touchDragging = false;
    return;
  }
  if (el.classList.contains('inactive')) return; // Pitfall 4: skip inactive cells
  touchDragging = true;
  lastHoveredRow = row;
  lastHoveredCol = col;
  updateGhostPreview(row, col);
}, { passive: true });

document.addEventListener('touchend', () => {
  if (!touchDragging) return;
  touchDragging = false;
  // Ghost stays in place — user taps ghost cell to confirm placement
  // The browser-synthesized click event on the ghost cell fires the existing
  // single-click-place handler from Plan 01. No extra code needed.
});

// ─── Return piece click handler ───────────────────────────────────────────────
function handleReturnClick(shapeId) {
  const banner = document.getElementById('turn-banner');
  const amIActive = banner && banner.textContent.startsWith("It's your turn");
  if (!amIActive) return;
  socket.emit('game:move', { action: 'return', shapeId });
}

// ─── Timer helpers ─────────────────────────────────────────────────────────
function formatTime(elapsedMs) {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function updateTimerDisplay(elapsedMs) {
  const el = document.getElementById('game-timer');
  if (el) el.textContent = formatTime(elapsedMs);
}

function startLiveTimer(startTime) {
  clearInterval(timerInterval);   // always clear before starting new interval
  timerInterval = null;
  updateTimerDisplay(Date.now() - startTime);
  timerInterval = setInterval(() => {
    updateTimerDisplay(Date.now() - startTime);
  }, 1000);
}

// ─── Win overlay ──────────────────────────────────────────────────────────────
function renderWin(state) {
  const overlay = document.getElementById('win-overlay');
  const timeEl = document.getElementById('win-time');
  const playersEl = document.getElementById('win-players');
  if (timeEl) timeEl.textContent = formatTime(state.elapsedMs || 0);
  if (playersEl) playersEl.textContent = (state.players || []).map(p => p.name).join(', ');
  overlay.style.display = 'flex';
}

// ─── Play Again ───────────────────────────────────────────────────────────
document.getElementById('play-again-btn').addEventListener('click', () => {
  clearInterval(timerInterval);   // clear interval if still running
  timerInterval = null;
  document.getElementById('win-overlay').style.display = 'none';
  showScreen('start-screen');
  myRoomCode = null;
  amIHost = false;
  // No game:leave event needed — socket.data.roomCode is overwritten on next createRoom/joinRoom
});

// ─── In-game error notification ───────────────────────────────────────────────
// Create in-game notification element once (idempotent)
function ensureGameNotification() {
  if (!document.getElementById('game-notification')) {
    const el = document.createElement('p');
    el.id = 'game-notification';
    el.className = 'notification';
    el.setAttribute('aria-live', 'polite');
    document.getElementById('game-screen').appendChild(el);
  }
  return document.getElementById('game-notification');
}
function showGameError(message) {
  const el = ensureGameNotification();
  el.textContent = `Move rejected: ${message}`;
  setTimeout(() => { el.textContent = ''; }, 3500);
}
function showGameNotification(message) {
  const el = ensureGameNotification();
  el.textContent = message;
  setTimeout(() => { el.textContent = ''; }, 3000);
}

// ─── Leaderboard render ────────────────────────────────────────────────────
function renderLeaderboard(entries) {
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;
  if (!entries || entries.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="leaderboard-empty">No games completed yet</td></tr>';
    return;
  }
  tbody.innerHTML = entries.map(e =>
    `<tr>
      <td>${e.rank}</td>
      <td>${e.puzzleName}</td>
      <td class="leaderboard-time">${e.time}</td>
      <td>${e.playerNames.join(', ')}</td>
    </tr>`
  ).join('');
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
    const diffLabel = p.difficulty ? (DIFFICULTY_LABELS[p.difficulty] ?? p.difficulty) : '';
    option.textContent = diffLabel ? `${p.name} — ${diffLabel}` : p.name;
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

// Game started — transition to game screen, initialise colors, render all UI
socket.on('game:start', (state) => {
  showScreen('game-screen');
  initPieceColors(state);
  renderGrid(state);
  renderBank(state);
  renderTurnUI(state);
  updateRotationButtons();
  startLiveTimer(state.startTime);   // TIME-01
});

// Game state update during play — reset selection, re-render all UI
socket.on('game:stateUpdate', (state) => {
  selectedShapeId = null;
  selectedRotation = 0;
  refreshCursorPiece();
  updateRotationButtons();
  renderGrid(state);
  renderBank(state);
  renderTurnUI(state);
});

socket.on('game:error', (message) => {
  showGameError(message);
});

socket.on('randomMode:event', ({ type, description } = {}) => {
  showGameNotification(description);

  if (type === 'rotate_piece') {
    setTimeout(() => {
      if (selectedShapeId !== null) {
        selectedRotation = (selectedRotation + 90) % 360;
        updateBankSelection();
        updateRotationButtons();
        if (lastHoveredRow !== null && lastHoveredCol !== null) {
          updateGhostPreview(lastHoveredRow, lastHoveredCol);
        }
      }
    }, 1200);
  }
});

// Game won — render final state and show win overlay
socket.on('game:win', (state) => {
  clearInterval(timerInterval);      // TIME-02: freeze timer
  timerInterval = null;
  renderGrid(state);
  renderBank(state);
  renderTurnUI(state);
  renderWin(state);                  // TIME-03: shows state.elapsedMs
});

// Inline error — show under the join input on start screen; or as notification in lobby
socket.on('room:error', (message) => {
  if (startScreen.classList.contains('active')) {
    showJoinError(message);
  } else {
    showLobbyNotification(`Error: ${message}`);
  }
});

// Leaderboard update — re-render leaderboard on start screen (TIME-04)
socket.on('leaderboard:update', (entries) => {
  renderLeaderboard(entries);
});
