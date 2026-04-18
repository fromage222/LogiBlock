// main.js — LogiBlock client (v3 — no piece labels, larger layout, confetti)
const socket = io();

// ─── Theme ────────────────────────────────────────────────────────────────────
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

// ─── Confetti system ──────────────────────────────────────────────────────────
function launchConfetti(durationMs = 3000) {
  const canvas = document.createElement('canvas');
  canvas.id = 'confetti-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  const COLORS = ['#ff5533','#f5c842','#2ab5a5','#5c85d6','#e07b39','#6ab187','#c05c7e','#9b6bb5','#7ab83a'];
  const particles = [];
  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height * -0.5 - 20,
      vx: (Math.random() - 0.5) * 6, vy: Math.random() * 3 + 2,
      w: Math.random() * 10 + 5, h: Math.random() * 6 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 12, opacity: 1,
    });
  }
  const start = performance.now();
  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const fadeStart = durationMs - 800;
    const globalAlpha = elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / 800) : 1;
    for (const p of particles) {
      p.vy += 0.12; p.x += p.vx; p.y += p.vy; p.rotation += p.rotSpeed;
      if (p.x < -20) p.x = canvas.width + 20;
      if (p.x > canvas.width + 20) p.x = -20;
      if (p.y > canvas.height + 30) { p.y = -20; p.vy = Math.random() * 3 + 1; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = globalAlpha * p.opacity;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (elapsed < durationMs) requestAnimationFrame(frame);
    else { canvas.remove(); window.removeEventListener('resize', resize); }
  }
  requestAnimationFrame(frame);
}

// ─── State ────────────────────────────────────────────────────────────────────
let myRoomCode = null;
let amIHost = false;
let myPlayerName = null;
let timerInterval = null;
let selectedShapeId = null;
let selectedRotation = 0;
let pieceColors = {};
let currentGrid = null;
let currentGridSize = null;
let currentBankShapes = [];
let lastHoveredRow = null;
let lastHoveredCol = null;
let pendingRotate = false;
let blindTimer = null;
let blindInterval = null;
let touchDragging = false;
let longPressTimer = null;
let lastTouchTime = 0;
let suppressNextGridClick = false;
let touchStartX = 0;
let touchStartY = 0;
const TOUCH_DRAG_THRESHOLD = 12;

const DIFFICULTY_LABELS = { easy: 'Einfach', medium: 'Mittel', hard: 'Schwer' };

// ─── Rotation helpers ─────────────────────────────────────────────────────────
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
  '#5c85d6','#e07b39','#6ab187','#c05c7e','#9b6bb5',
  '#c8b84a','#3aada8','#c0583a','#8a6a3e','#7ab83a',
];
function initPieceColors(state) {
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
const startScreen = document.getElementById('start-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen  = document.getElementById('game-screen');
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
const controlsInfoBtn  = document.getElementById('controls-info-btn');
const controlsModal    = document.getElementById('controls-modal');
const controlsModalClose = document.getElementById('controls-modal-close');

// ─── Screen switching ─────────────────────────────────────────────────────────
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(screenId);
  target.classList.add('active');
  target.style.animation = 'none';
  target.offsetHeight;
  target.style.animation = '';
}

// ─── Error display ────────────────────────────────────────────────────────────
function showJoinError(message) {
  joinError.textContent = message;
  joinError.style.display = 'block';
  joinError.style.animation = 'none';
  joinError.offsetHeight;
  joinError.style.animation = '';
}
function clearJoinError() { joinError.textContent = ''; joinError.style.display = 'none'; }
function showLobbyNotification(message) {
  lobbyNotification.textContent = message;
  setTimeout(() => { lobbyNotification.textContent = ''; }, 4000);
}

// ─── Start screen actions ─────────────────────────────────────────────────────
createRoomBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (!name) { showJoinError('Please enter your name'); return; }
  clearJoinError(); myPlayerName = name;
  socket.emit('createRoom', { playerName: name });
});
joinRoomBtn.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  const code = roomCodeInput.value.trim();
  if (!name) { showJoinError('Please enter your name'); return; }
  if (!code || code.length !== 6 || !/^\d+$/.test(code)) { showJoinError('Please enter a valid 6-digit room code'); return; }
  clearJoinError(); myPlayerName = name;
  socket.emit('joinRoom', { roomCode: code, playerName: name });
});
puzzleSelect.addEventListener('change', () => { if (amIHost) socket.emit('lobby:selectPuzzle', { puzzleId: puzzleSelect.value }); });
startGameBtn.addEventListener('click', () => { if (amIHost) socket.emit('startGame'); });

// ─── Lobby rendering ──────────────────────────────────────────────────────────
function renderLobbyUpdate(state) {
  playerList.innerHTML = '';
  state.players.forEach(player => {
    const li = document.createElement('li');
    li.textContent = player.name + (player.isHost ? ' (Host)' : '');
    if (player.name === myPlayerName) li.classList.add('me');
    if (player.disconnected === true) li.classList.add('disconnected');
    playerList.appendChild(li);
  });
  const me = state.players.find(p => p.name === myPlayerName);
  amIHost = me ? me.isHost : false;
  if (amIHost) {
    hostControls.style.display = 'block'; waitingMsg.style.display = 'none'; selectedPuzzleDisplay.style.display = 'none';
    startGameBtn.disabled = state.players.length < 2;
    if (state.selectedPuzzleId && puzzleSelect.options.length > 0) puzzleSelect.value = state.selectedPuzzleId;
    const randomToggle = document.getElementById('random-mode-toggle');
    if (randomToggle) {
      randomToggle.value = state.randomMode ? 1 : 0;
      if (!randomToggle._randomModeWired) {
        randomToggle._randomModeWired = true;
        randomToggle.addEventListener('input', () => { if (amIHost) socket.emit('lobby:randomMode', { enabled: randomToggle.value === '1' }); });
      }
    }
  } else {
    hostControls.style.display = 'none'; waitingMsg.style.display = 'block';
    if (state.selectedPuzzleName) {
      const diffLabel = state.selectedPuzzleDifficulty ? (DIFFICULTY_LABELS[state.selectedPuzzleDifficulty] ?? state.selectedPuzzleDifficulty) : '';
      selectedPuzzleDisplay.textContent = `Ausgewähltes Puzzle: ${diffLabel ? `${state.selectedPuzzleName} — ${diffLabel}` : state.selectedPuzzleName}`;
      selectedPuzzleDisplay.style.display = 'block';
    }
    const randomDisplay = document.getElementById('random-mode-display');
    if (randomDisplay) {
      if (state.randomMode) { randomDisplay.textContent = 'Chaos-Modus: Aktiv'; randomDisplay.style.display = 'block'; }
      else { randomDisplay.textContent = ''; randomDisplay.style.display = 'none'; }
    }
  }
}

// ─── Grid rendering — NO text on cells ───────────────────────────────────────
function renderGrid(state) {
  gameGrid.innerHTML = '';
  if (!state.grid || !state.gridSize) return;
  currentGrid = state.grid; currentGridSize = state.gridSize; currentBankShapes = state.bankShapes || [];
  const { rows, cols } = state.gridSize;
  gameGrid.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;
  gameGrid.style.gridTemplateRows    = `repeat(${rows}, var(--cell-size))`;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.classList.add('grid-cell');
      cell.setAttribute('data-row', r); cell.setAttribute('data-col', c);
      const content = state.grid[r][c];
      if (content?.inactive) { cell.classList.add('inactive'); gameGrid.appendChild(cell); continue; }
      else if (content === null) { cell.classList.add('empty'); }
      else if (content.movable === false) {
        cell.classList.add('anchor');
        // NO textContent — just visual styling via CSS
      } else {
        cell.classList.add('placed');
        // NO textContent — color-only identification
        cell.style.background = pieceColors[content.shapeId] || '#81c784';
      }
      cell.addEventListener('mousemove', () => {
        lastHoveredRow = r; lastHoveredCol = c;
        if (selectedShapeId) updateGhostPreview(r, c);
      });
      cell.addEventListener('click', () => {
        if (suppressNextGridClick) { suppressNextGridClick = false; return; }
        if (selectedShapeId) {
          const shape = currentBankShapes.find(s => s.id === selectedShapeId);
          let originRow = r, originCol = c;
          if (shape) {
            const cells = rotateCells(shape.cells, selectedRotation);
            const [pivotDr, pivotDc] = getPivotOffset(cells);
            originRow = r - pivotDr; originCol = c - pivotDc;
          }
          console.log('[DEBUG grid:place] shapeId=', selectedShapeId, 'myPlayerName=', myPlayerName);
          socket.emit('game:move', { action: 'place', shapeId: selectedShapeId, rotation: selectedRotation, originRow, originCol });
          selectedShapeId = null; selectedRotation = 0;
          clearGhostPreview(); refreshCursorPiece(); updateBankSelection(); updateRotationButtons();
        } else if (content && content.movable !== false) {
          handleReturnClick(content.shapeId);
        }
      });
      if (content && content.movable !== false && !content.inactive) {
        cell.addEventListener('touchstart', () => {
          if (selectedShapeId) return;
          clearTimeout(longPressTimer);
          longPressTimer = setTimeout(() => { handleReturnClick(content.shapeId); longPressTimer = null; }, 500);
        }, { passive: true });
        cell.addEventListener('touchend', () => { clearTimeout(longPressTimer); longPressTimer = null; });
        cell.addEventListener('touchmove', () => { clearTimeout(longPressTimer); longPressTimer = null; });
      }
      gameGrid.appendChild(cell);
    }
  }
}

// ─── Bank rendering — NO label text ──────────────────────────────────────────
function renderBank(state) {
  const bank = document.getElementById('piece-bank');
  const existingCountdown = document.getElementById('blind-countdown');
  bank.innerHTML = '';
  if (existingCountdown) bank.appendChild(existingCountdown);
  const amIActive = state.activePlayerName === myPlayerName;
  console.log('[DEBUG renderBank] activePlayerName=', state.activePlayerName, 'myPlayerName=', myPlayerName, 'amIActive=', amIActive);
  (state.bankShapes || []).forEach((shape, idx) => {
    const pieceEl = document.createElement('div');
    pieceEl.classList.add('bank-piece');
    pieceEl.dataset.shapeId = shape.id;
    pieceEl.draggable = amIActive;
    if (!amIActive) pieceEl.style.pointerEvents = 'none';
    pieceEl.style.animation = `cardPop 0.3s ${idx * 0.04}s ease-out both`;
    const color = pieceColors[shape.id] || '#ccc';
    pieceEl.style.setProperty('--piece-color', color);
    pieceEl.appendChild(buildMiniGrid(shape.cells, color));
    // NO label span — pieces are identified by color only
    pieceEl.addEventListener('click', () => {
      console.log('[DEBUG bank click] shapeId=', shape.id, 'amIActive=', amIActive, 'pointerEvents=', pieceEl.style.pointerEvents);
      if (!amIActive) return;
      if (selectedShapeId === shape.id) { selectedShapeId = null; selectedRotation = 0; }
      else {
        selectedShapeId = shape.id; selectedRotation = 0;
        if (pendingRotate && selectedShapeId !== null) { selectedRotation = (selectedRotation + 90) % 360; pendingRotate = false; showGameNotification('Piece rotated!'); }
      }
      updateBankSelection(); updateRotationButtons();
      if (lastHoveredRow !== null && lastHoveredCol !== null) updateGhostPreview(lastHoveredRow, lastHoveredCol);
    });
    pieceEl.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!amIActive) return;
      if (selectedShapeId === shape.id) { selectedShapeId = null; selectedRotation = 0; }
      else { selectedShapeId = shape.id; selectedRotation = 0; }
      updateBankSelection(); updateRotationButtons(); refreshCursorPiece();
      if (selectedShapeId) {
        const rect = pieceEl.getBoundingClientRect();
        const cursorEl = getCursorEl();
        cursorEl.style.left = (rect.left + rect.width / 2) + 'px';
        cursorEl.style.top  = (rect.top  - 10) + 'px';
      }
    }, { passive: false });
    bank.appendChild(pieceEl);
  });
}

function buildMiniGrid(cells, color, cellSize = 10) {
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
      cell.style.width = `${cellSize}px`; cell.style.height = `${cellSize}px`;
      cell.style.borderRadius = '2px'; cell.style.pointerEvents = 'none';
      cell.style.background = cells.some(([dr, dc]) => dr === r && dc === c) ? color : 'transparent';
      container.appendChild(cell);
    }
  }
  return container;
}

// ─── Cursor piece ─────────────────────────────────────────────────────────────
let _cursorEl = null;
function getCursorEl() {
  if (!_cursorEl) {
    _cursorEl = document.createElement('div');
    _cursorEl.style.cssText = 'position:fixed;pointer-events:none;z-index:1000;display:none;transform:translate(-50%,-50%);background:rgba(255,255,255,0.93);border:2px solid #ff5533;border-radius:12px;padding:8px;box-shadow:0 6px 18px rgba(0,0,0,0.25);transition:transform 0.1s ease';
    document.body.appendChild(_cursorEl);
  }
  return _cursorEl;
}
function refreshCursorPiece() {
  const el = getCursorEl();
  if (!selectedShapeId) { el.style.display = 'none'; return; }
  const shape = currentBankShapes.find(s => s.id === selectedShapeId);
  if (!shape) { el.style.display = 'none'; return; }
  el.innerHTML = '';
  el.appendChild(buildMiniGrid(rotateCells(shape.cells, selectedRotation), pieceColors[selectedShapeId] || '#ccc', 22));
  el.style.display = 'block';
}
document.addEventListener('touchstart', (e) => {
  lastTouchTime = Date.now();
  if (e.touches[0]) { touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }
}, { passive: true });
document.addEventListener('mousemove', (e) => {
  if (Date.now() - lastTouchTime < 500) return;
  const el = getCursorEl(); el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px';
  if (selectedShapeId) refreshCursorPiece();
});
function updateBankSelection() {
  document.querySelectorAll('.bank-piece').forEach(el => {
    const isSelected = el.dataset.shapeId === selectedShapeId;
    el.classList.toggle('selected', isSelected);
    if (isSelected) {
      const shape = currentBankShapes.find(s => s.id === el.dataset.shapeId);
      if (shape) {
        const oldMini = el.querySelector('div');
        if (oldMini) el.replaceChild(buildMiniGrid(rotateCells(shape.cells, selectedRotation), pieceColors[shape.id] || '#ccc'), oldMini);
      }
    }
  });
  refreshCursorPiece();
}

// ─── Turn UI ──────────────────────────────────────────────────────────────────
function renderTurnUI(state) {
  const banner = document.getElementById('turn-banner');
  if (state.activePlayerName) {
    const isMyTurn = state.activePlayerName === myPlayerName;
    banner.textContent = isMyTurn ? "It's your turn!" : `It's ${state.activePlayerName}'s turn`;
    banner.style.color = isMyTurn ? 'var(--clr-primary)' : '';
  } else { banner.textContent = ''; }
  const badgesContainer = document.getElementById('player-badges');
  badgesContainer.innerHTML = '';
  (state.players || []).forEach(player => {
    const badge = document.createElement('div');
    badge.classList.add('player-badge');
    const isActive = player.name === state.activePlayerName;
    const showBolt = isActive && (state.extraTurns ?? 0) > 0;
    badge.textContent = player.name + (showBolt ? ' ⚡' : '');
    if (isActive) badge.classList.add('active');
    if (player.disconnected === true) badge.classList.add('disconnected');
    badgesContainer.appendChild(badge);
  });
}

// ─── Ghost preview ────────────────────────────────────────────────────────────
function clearGhostPreview() { document.querySelectorAll('.ghost-valid, .ghost-invalid').forEach(el => el.classList.remove('ghost-valid', 'ghost-invalid')); }
function getPivotOffset(cells) {
  return [Math.floor(Math.max(...cells.map(([r]) => r)) / 2), Math.floor(Math.max(...cells.map(([, c]) => c)) / 2)];
}
function updateGhostPreview(hoverRow, hoverCol) {
  clearGhostPreview();
  if (!selectedShapeId || !currentGridSize) return;
  const shape = currentBankShapes.find(s => s.id === selectedShapeId);
  if (!shape) return;
  const cells = rotateCells(shape.cells, selectedRotation);
  const [pivotDr, pivotDc] = getPivotOffset(cells);
  const originRow = hoverRow - pivotDr, originCol = hoverCol - pivotDc;
  const { rows, cols } = currentGridSize;
  const valid = cells.every(([dr, dc]) => {
    const r = originRow + dr, c = originCol + dc;
    return r >= 0 && r < rows && c >= 0 && c < cols && currentGrid && currentGrid[r][c] === null;
  });
  cells.forEach(([dr, dc]) => {
    const r = originRow + dr, c = originCol + dc;
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const cellEl = document.querySelector(`.grid-cell[data-row="${r}"][data-col="${c}"]`);
    if (cellEl) cellEl.classList.add(valid ? 'ghost-valid' : 'ghost-invalid');
  });
}
gameGrid.addEventListener('mouseleave', () => { clearGhostPreview(); lastHoveredRow = null; lastHoveredCol = null; });
document.addEventListener('click', (e) => {
  if (!selectedShapeId) return;
  if (!e.target.closest('#game-grid') && !e.target.closest('#piece-bank') && !e.target.closest('#rotation-controls')) {
    selectedShapeId = null; selectedRotation = 0;
    clearGhostPreview(); refreshCursorPiece(); updateBankSelection(); updateRotationButtons();
  }
});

// ─── Rotation buttons ─────────────────────────────────────────────────────────
function updateRotationButtons() {
  const ccw = document.getElementById('rotate-ccw-btn'), cw = document.getElementById('rotate-cw-btn');
  if (ccw) ccw.disabled = !selectedShapeId;
  if (cw) cw.disabled = !selectedShapeId;
}
document.getElementById('rotate-cw-btn').addEventListener('click', (e) => {
  e.stopPropagation(); if (!selectedShapeId) return;
  selectedRotation = (selectedRotation + 90) % 360;
  updateBankSelection(); updateRotationButtons();
  if (lastHoveredRow !== null && lastHoveredCol !== null) updateGhostPreview(lastHoveredRow, lastHoveredCol);
});
document.getElementById('rotate-ccw-btn').addEventListener('click', (e) => {
  e.stopPropagation(); if (!selectedShapeId) return;
  selectedRotation = (selectedRotation + 270) % 360;
  updateBankSelection(); updateRotationButtons();
  if (lastHoveredRow !== null && lastHoveredCol !== null) updateGhostPreview(lastHoveredRow, lastHoveredCol);
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'r' && e.key !== 'R') return;
  if (!selectedShapeId || !gameScreen.classList.contains('active')) return;
  selectedRotation = (selectedRotation + 90) % 360;
  updateBankSelection(); updateRotationButtons();
  if (lastHoveredRow !== null && lastHoveredCol !== null) updateGhostPreview(lastHoveredRow, lastHoveredCol);
});

// ─── Controls Modal ───────────────────────────────────────────────────────────
controlsInfoBtn.addEventListener('click', () => { controlsModal.showModal(); });
controlsModalClose.addEventListener('click', () => { controlsModal.close(); });
controlsModal.addEventListener('click', (e) => { if (e.target === controlsModal) controlsModal.close(); });

// ─── Touch drag-to-preview ───────────────────────────────────────────────────
document.addEventListener('touchmove', (e) => {
  if (!selectedShapeId || !gameScreen.classList.contains('active')) return;
  e.preventDefault();
  const touch = e.touches[0];
  const cursorEl = getCursorEl();
  if (cursorEl) { cursorEl.style.left = touch.clientX + 'px'; cursorEl.style.top = (touch.clientY - 70) + 'px'; refreshCursorPiece(); }
  const dx = touch.clientX - touchStartX, dy = touch.clientY - touchStartY;
  if (Math.sqrt(dx*dx+dy*dy) <= TOUCH_DRAG_THRESHOLD) return;
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (!el) { if (touchDragging) { clearGhostPreview(); touchDragging = false; } return; }
  const row = parseInt(el.dataset.row), col = parseInt(el.dataset.col);
  if (isNaN(row) || isNaN(col)) { if (touchDragging) { clearGhostPreview(); touchDragging = false; } return; }
  if (el.classList.contains('inactive')) return;
  touchDragging = true; lastHoveredRow = row; lastHoveredCol = col;
  updateGhostPreview(row, col);
}, { passive: false });
document.addEventListener('touchend', (e) => {
  if (!selectedShapeId) return;
  if (touchDragging) { touchDragging = false; suppressNextGridClick = true; setTimeout(() => { suppressNextGridClick = false; }, 350); return; }
  if (lastHoveredRow === null || lastHoveredCol === null) return;
  const touch = e.changedTouches[0]; if (!touch) return;
  const el = document.elementFromPoint(touch.clientX, touch.clientY);
  if (!el || isNaN(parseInt(el.dataset.row)) || isNaN(parseInt(el.dataset.col))) return;
  if (el.classList.contains('inactive')) return;
  const shape = currentBankShapes.find(s => s.id === selectedShapeId);
  let originRow = lastHoveredRow, originCol = lastHoveredCol;
  if (shape) { const cells = rotateCells(shape.cells, selectedRotation); const [pdr,pdc] = getPivotOffset(cells); originRow = lastHoveredRow - pdr; originCol = lastHoveredCol - pdc; }
  socket.emit('game:move', { action: 'place', shapeId: selectedShapeId, rotation: selectedRotation, originRow, originCol });
  selectedShapeId = null; selectedRotation = 0; clearGhostPreview(); refreshCursorPiece(); updateBankSelection(); updateRotationButtons();
  lastHoveredRow = null; lastHoveredCol = null;
});

// ─── Return piece ─────────────────────────────────────────────────────────────
function handleReturnClick(shapeId) {
  const banner = document.getElementById('turn-banner');
  if (banner && banner.textContent.startsWith("It's your turn")) socket.emit('game:move', { action: 'return', shapeId });
}

// ─── Timer ────────────────────────────────────────────────────────────────────
function formatTime(elapsedMs) {
  const s = Math.floor(elapsedMs / 1000);
  return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
}
function updateTimerDisplay(ms) { const el = document.getElementById('game-timer'); if (el) el.textContent = formatTime(ms); }
function startLiveTimer(startTime) {
  clearInterval(timerInterval); timerInterval = null;
  updateTimerDisplay(Date.now() - startTime);
  timerInterval = setInterval(() => updateTimerDisplay(Date.now() - startTime), 1000);
}

// ─── Win overlay ──────────────────────────────────────────────────────────────
function renderWin(state) {
  const overlay = document.getElementById('win-overlay');
  const timeEl = document.getElementById('win-time');
  const playersEl = document.getElementById('win-players');
  if (timeEl) timeEl.textContent = formatTime(state.elapsedMs || 0);
  if (playersEl) playersEl.textContent = (state.players || []).map(p => p.name).join(', ');
  overlay.style.display = 'flex';
  const winCard = overlay.querySelector('.win-card');
  if (winCard) { winCard.style.animation = 'none'; winCard.offsetHeight; winCard.style.animation = ''; }
  launchConfetti(4000);
}
document.getElementById('play-again-btn').addEventListener('click', () => {
  clearInterval(timerInterval); timerInterval = null;
  document.getElementById('win-overlay').style.display = 'none';
  showScreen('start-screen'); myRoomCode = null; amIHost = false;
  localStorage.removeItem('logiblock_roomCode'); localStorage.removeItem('logiblock_playerName');
});

// ─── Game notifications ───────────────────────────────────────────────────────
function ensureGameNotification() {
  if (!document.getElementById('game-notification')) {
    const el = document.createElement('p'); el.id = 'game-notification'; el.className = 'notification'; el.setAttribute('aria-live','polite');
    document.getElementById('game-screen').appendChild(el);
  }
  return document.getElementById('game-notification');
}
function showGameError(msg) { const el = ensureGameNotification(); el.textContent = `Move rejected: ${msg}`; setTimeout(() => { el.textContent = ''; }, 3500); }
function showGameNotification(msg) {
  const existing = document.getElementById('event-banner'); if (existing) existing.remove();
  const banner = document.createElement('div'); banner.id = 'event-banner'; banner.className = 'event-banner'; banner.textContent = msg;
  document.getElementById('game-screen').appendChild(banner);
  setTimeout(() => { if (banner.isConnected) banner.remove(); }, 2500);
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
let activeLeaderboardTab = null;
function renderLeaderboard(entries) {
  const tbody = document.getElementById('leaderboard-body');
  const tabsContainer = document.getElementById('leaderboard-tabs');
  const thead = document.querySelector('.leaderboard-table thead tr');
  if (!tbody) return;
  if (!entries || entries.length === 0) {
    if (tabsContainer) tabsContainer.innerHTML = '';
    if (thead) thead.innerHTML = '<th>#</th><th>Puzzle</th><th>Zeit</th><th>Spieler</th>';
    tbody.innerHTML = '<tr><td colspan="4" class="leaderboard-empty">Noch keine Spiele abgeschlossen</td></tr>';
    activeLeaderboardTab = null; return;
  }
  const puzzleNames = [...new Set(entries.map(e => e.puzzleName))];
  if (!activeLeaderboardTab || !puzzleNames.includes(activeLeaderboardTab)) activeLeaderboardTab = entries[0].puzzleName;
  if (tabsContainer) {
    tabsContainer.innerHTML = puzzleNames.map(name => `<button class="leaderboard-tab${name===activeLeaderboardTab?' active':''}" data-puzzle="${name}">${name}</button>`).join('');
    tabsContainer.onclick = (e) => { const btn = e.target.closest('.leaderboard-tab'); if (!btn) return; activeLeaderboardTab = btn.dataset.puzzle; renderLeaderboard(entries); };
  }
  const filtered = entries.filter(e => e.puzzleName === activeLeaderboardTab).map((e, i) => ({ ...e, rank: i+1 }));
  if (thead) thead.innerHTML = '<th>#</th><th>Zeit</th><th>Spieler</th>';
  tbody.innerHTML = filtered.length === 0
    ? '<tr><td colspan="3" class="leaderboard-empty">Keine Eintraege</td></tr>'
    : filtered.map(e => `<tr><td>${e.rank}</td><td class="leaderboard-time">${e.time}</td><td>${e.playerNames.join(', ')}</td></tr>`).join('');
}

// ─── Socket events ────────────────────────────────────────────────────────────
socket.on('room:created', ({ roomCode }) => {
  myRoomCode = roomCode; roomCodeText.textContent = roomCode;
  localStorage.setItem('logiblock_roomCode', roomCode); localStorage.setItem('logiblock_playerName', myPlayerName);
  showScreen('lobby-screen');
});
socket.on('puzzle:list', (puzzles) => {
  puzzleSelect.innerHTML = '';
  puzzles.forEach(p => {
    const option = document.createElement('option'); option.value = p.id;
    const diffLabel = p.difficulty ? (DIFFICULTY_LABELS[p.difficulty] ?? p.difficulty) : '';
    option.textContent = diffLabel ? `${p.name} — ${diffLabel}` : p.name;
    puzzleSelect.appendChild(option);
  });
});
socket.on('lobby:update', (state) => {
  myRoomCode = state.roomCode; roomCodeText.textContent = state.roomCode; pendingAutoRejoin = false;
  localStorage.setItem('logiblock_roomCode', state.roomCode); localStorage.setItem('logiblock_playerName', myPlayerName);
  if (startScreen.classList.contains('active')) showScreen('lobby-screen');
  renderLobbyUpdate(state);
});
socket.on('lobby:playerLeft', ({ playerName }) => showLobbyNotification(`${playerName} left the game`));
socket.on('lobby:hostLeft', ({ message }) => {
  myRoomCode = null; amIHost = false;
  localStorage.removeItem('logiblock_roomCode'); localStorage.removeItem('logiblock_playerName');
  showScreen('start-screen'); showJoinError(message || 'Host left — lobby closed'); setTimeout(clearJoinError, 4000);
});
socket.on('game:start', (state) => {
  console.log('[DEBUG game:start] activePlayerName=', state.activePlayerName, 'myPlayerName=', myPlayerName);
  showScreen('game-screen'); initPieceColors(state); renderGrid(state); renderBank(state); renderTurnUI(state); updateRotationButtons(); startLiveTimer(state.startTime);
});
socket.on('game:reconnect', (state) => {
  console.log('[DEBUG game:reconnect] activePlayerName=', state.activePlayerName, 'myPlayerName=', myPlayerName, 'selectedShapeId_before=', selectedShapeId);
  pendingAutoRejoin = false; myRoomCode = state.roomCode;
  selectedShapeId = null; selectedRotation = 0;
  showScreen('game-screen'); initPieceColors(state); renderGrid(state); renderBank(state); renderTurnUI(state); updateRotationButtons(); startLiveTimer(state.startTime);
});
socket.on('game:stateUpdate', (state) => {
  console.log('[DEBUG game:stateUpdate] activePlayerName=', state.activePlayerName, 'myPlayerName=', myPlayerName);
  selectedShapeId = null; selectedRotation = 0; refreshCursorPiece(); updateRotationButtons(); renderGrid(state); renderBank(state); renderTurnUI(state);
});
socket.on('game:error', (msg) => showGameError(msg));
socket.on('randomMode:event', ({ type, description } = {}) => {
  showGameNotification(description);
  if (type === 'rotate_piece') { pendingRotate = true; return; }
  if (type === 'blind_bank') {
    const bank = document.getElementById('piece-bank'); if (!bank) return;
    if (blindTimer) { clearTimeout(blindTimer); blindTimer = null; }
    if (blindInterval) { clearInterval(blindInterval); blindInterval = null; }
    const old = document.getElementById('blind-countdown'); if (old) old.remove();
    bank.classList.add('blind');
    let remaining = 5;
    const countdownEl = document.createElement('div'); countdownEl.id = 'blind-countdown'; countdownEl.className = 'blind-countdown';
    countdownEl.textContent = `Blind! ${remaining}s`; bank.appendChild(countdownEl);
    blindInterval = setInterval(() => { remaining--; countdownEl.textContent = `Blind! ${remaining}s`; if (remaining<=0) { clearInterval(blindInterval); blindInterval=null; } }, 1000);
    blindTimer = setTimeout(() => { bank.classList.remove('blind'); if (countdownEl.isConnected) countdownEl.remove(); if (blindInterval){clearInterval(blindInterval);blindInterval=null;} blindTimer=null; }, 5000);
  }
});
socket.on('game:win', (state) => { clearInterval(timerInterval); timerInterval = null; renderGrid(state); renderBank(state); renderTurnUI(state); renderWin(state); });
socket.on('room:error', (message) => {
  if (startScreen.classList.contains('active')) {
    // Start screen: auto-rejoin failed or join/create error
    if (pendingAutoRejoin) {
      pendingAutoRejoin = false;
      localStorage.removeItem('logiblock_roomCode');
      localStorage.removeItem('logiblock_playerName');
      myPlayerName = null;
    }
    showJoinError(message);
  } else if (gameScreen.classList.contains('active')) {
    // Game screen: session expired after hold window -- drop to start screen
    clearInterval(timerInterval);
    timerInterval = null;
    myRoomCode = null;
    amIHost = false;
    localStorage.removeItem('logiblock_roomCode');
    localStorage.removeItem('logiblock_playerName');
    showScreen('start-screen');
    showJoinError(message);
    setTimeout(clearJoinError, 4000);
  } else {
    // Lobby screen: show as notification
    showLobbyNotification(`Error: ${message}`);
  }
});
let pendingAutoRejoin = false;
socket.on('connect', () => {
  const savedRoom = localStorage.getItem('logiblock_roomCode');
  const savedName = localStorage.getItem('logiblock_playerName');
  console.log('[DEBUG connect] savedRoom=', savedRoom, 'savedName=', savedName, 'activeScreen=', document.querySelector('.screen.active')?.id);
  if (savedRoom && savedName) {
    myPlayerName = savedName;
    // pendingAutoRejoin only on initial page load (start screen); not on Socket.IO auto-reconnect
    if (startScreen.classList.contains('active')) pendingAutoRejoin = true;
    socket.emit('reconnectRoom', { roomCode: savedRoom, playerName: savedName });
  }
});

// Leaderboard update — re-render leaderboard on start screen (TIME-04)
socket.on('leaderboard:update', (entries) => {
  renderLeaderboard(entries);
});
socket.on('leaderboard:update', (entries) => renderLeaderboard(entries)); 