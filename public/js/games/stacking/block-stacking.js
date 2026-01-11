/**
 * Block Stacking Game
 *
 * Arcade stacker gambling game.
 * - 7 columns x 10 rows grid
 * - Blocks scroll horizontally, player clicks/SPACE to place
 * - Blocks must align with row below or they're lost
 * - Prize rows at top: Bronze (row 8), Silver (row 9), Gold (row 10)
 */

const COLS = 7;
const ROWS = 10;
const GAME_COST = 100;

const PRIZES = {
  bronze: { row: 7, amount: 250 },  // Row 8 (0-indexed = 7)
  silver: { row: 8, amount: 500 },  // Row 9
  gold: { row: 9, amount: 1000 }    // Row 10
};

// Speed progression (ms per move) - smooth curve
const SPEEDS = [
  105,            // Row 0
  95,             // Row 1
  84,             // Row 2
  74,             // Row 3
  64,             // Row 4
  56,             // Row 5
  49,             // Row 6
  43,             // Row 7 (Bronce)
  39,             // Row 8 (Plata)
  36              // Row 9 (Oro)
];

export class BlockStackingGame {
  constructor(options) {
    this.container = options.container;
    this.socket = options.socket;
    this.onCoinsUpdate = options.onCoinsUpdate || (() => {});

    // Game state
    this.grid = [];           // 7x10 array (placed blocks)
    this.currentRow = 0;      // Current row being placed
    this.currentBlocks = [];  // Current scrolling block positions (column indices)
    this.blockWidth = 3;      // Current block line width
    this.scrollPos = 0;       // Current X position (leftmost block)
    this.scrollDir = 1;       // 1 = right, -1 = left
    this.gameState = 'idle';  // 'idle' | 'playing' | 'paused' | 'gameover'
    this.coins = 0;
    this.tickInterval = null;
    this.popupSelection = 0;  // 0 = continue, 1 = cash out

    // DOM elements
    this.gridEl = null;
    this.playBtn = null;
    this.cells = [];
    this.popupOverlay = null;

    // Bound handlers
    this._handleKeyDown = this._handleKeyDown.bind(this);
    this._handleClick = this._handleClick.bind(this);
    this._handleTouchStart = this._handleTouchStart.bind(this);
    this._handleTouchEnd = this._handleTouchEnd.bind(this);

    // Keyboard enabled state (for popup focus)
    this.keyboardEnabled = true;

    // Touch state: prevent placing multiple blocks while holding
    this._touchActive = false;  // True while finger is down
    this._lastTouchTime = 0;    // Timestamp of last touch (for blocking delayed clicks)

    // Placement cooldown: prevents ALL rapid spam (touch, click, keyboard)
    this._lastPlaceTime = 0;
  }

  setKeyboardEnabled(enabled) {
    this.keyboardEnabled = enabled;
  }

  init() {
    this._setupSocketHandlers();
    this._render();
    this._setupEventListeners();

    // Request initial balance
    this.socket.emit('stackingGetBalance');
  }

  _setupSocketHandlers() {
    this.socket.on('stackingBalance', (data) => {
      this.coins = data.coins;
      this._updateCoinsDisplay();
    });

    this.socket.on('stackingStarted', (data) => {
      this.coins = data.coins;
      this._updateCoinsDisplay();
      this._startGameLoop();
    });

    this.socket.on('stackingInsufficientFunds', (data) => {
      this._showLoanPopup();
      this.gameState = 'idle';
      this._updatePlayButton();
    });

    // Loan received (shared with slots)
    this.socket.on('slotsLoanReceived', (data) => {
      this.coins = data.coins;
      this._updateCoinsDisplay();
      this._hideLoanPopup();
    });

    this.socket.on('stackingWon', (data) => {
      this.coins = data.coins;
      this._updateCoinsDisplay();
      this.onCoinsUpdate(data.coins);
    });

    this.socket.on('stackingLost', (data) => {
      this.coins = data.coins;
      this._updateCoinsDisplay();
    });

    this.socket.on('stackingError', (data) => {
      console.error('Stacking error:', data.message);
      this.gameState = 'idle';
      this._updatePlayButton();
    });
  }

  _render() {
    this.container.innerHTML = `
      <div class="stacking-game-area">
        <div class="stacking-spacer"></div>
        <div class="stacking-grid"></div>
        <div class="stacking-prize-markers">
          <div class="stacking-prize-marker gold"><span class="marker-arrow">&#9664;</span><span class="marker-value">1000</span></div>
          <div class="stacking-prize-marker silver"><span class="marker-arrow">&#9664;</span><span class="marker-value">500</span></div>
          <div class="stacking-prize-marker bronze"><span class="marker-arrow">&#9664;</span><span class="marker-value">250</span></div>
        </div>
      </div>
      <button class="stacking-play-btn">JUGAR - 100 $qr</button>
      <div class="stacking-instructions">ESPACIO o CLICK para colocar bloques</div>
      <div class="stacking-popup-overlay">
        <div class="stacking-popup">
          <h3 class="popup-title">Has llegado a PLATA</h3>
          <p class="prize-amount">500 $qr</p>
          <div class="stacking-popup-options">
            <div class="stacking-popup-option selected" data-action="continue">Continuar</div>
            <div class="stacking-popup-option" data-action="cashout">Plantarse con <span class="cashout-amount">500</span> $qr</div>
          </div>
          <p class="stacking-popup-hint">W/S o Flechas para mover, ESPACIO para confirmar</p>
        </div>
      </div>
      <div class="stacking-loan-overlay">
        <div class="loan-popup">
          <p>No tienes suficientes monedas</p>
          <button class="loan-btn">Pedir prestamo a Benjamin Netanyahu</button>
        </div>
      </div>
    `;

    this.gridEl = this.container.querySelector('.stacking-grid');
    this.playBtn = this.container.querySelector('.stacking-play-btn');
    this.popupOverlay = this.container.querySelector('.stacking-popup-overlay');
    this.loanOverlay = this.container.querySelector('.stacking-loan-overlay');

    // Loan button handler
    const loanBtn = this.container.querySelector('.loan-btn');
    loanBtn.addEventListener('click', () => {
      this.socket.emit('slotsRequestLoan', { requiredAmount: GAME_COST });
    });

    // Create grid cells (bottom to top for visual, but stored top to bottom in array)
    this.cells = [];
    for (let row = ROWS - 1; row >= 0; row--) {
      for (let col = 0; col < COLS; col++) {
        const cell = document.createElement('div');
        cell.className = 'stacking-cell';
        cell.dataset.row = row;
        cell.dataset.col = col;

        // Add prize row classes
        if (row === PRIZES.bronze.row) cell.classList.add('bronze-row');
        if (row === PRIZES.silver.row) cell.classList.add('silver-row');
        if (row === PRIZES.gold.row) cell.classList.add('gold-row');

        this.gridEl.appendChild(cell);

        if (!this.cells[row]) this.cells[row] = [];
        this.cells[row][col] = cell;
      }
    }
  }

  _setupEventListeners() {
    this.playBtn.addEventListener('click', () => this._startGame());
    document.addEventListener('keydown', this._handleKeyDown);
    this.container.addEventListener('click', this._handleClick);
    // Touch start for instant response on mobile (fires before click)
    this.container.addEventListener('touchstart', this._handleTouchStart, { passive: true });
    // Touch end to reset touch state (allows next touch to place)
    this.container.addEventListener('touchend', this._handleTouchEnd, { passive: true });
  }

  _handleKeyDown(e) {
    // Ignore keyboard if disabled (popup unfocused)
    if (!this.keyboardEnabled) return;

    if (e.code === 'Space') {
      e.preventDefault();
      // Check if loan popup is visible
      if (this.loanOverlay && this.loanOverlay.style.display === 'flex') {
        this.socket.emit('slotsRequestLoan', { requiredAmount: GAME_COST });
        return;
      }
      if (this.gameState === 'idle') {
        // Start game with SPACE
        this._startGame();
      } else if (this.gameState === 'playing') {
        // Place blocks with SPACE
        this._placeBlocks();
      } else if (this.gameState === 'paused') {
        // Confirm popup selection with SPACE
        this._confirmPopupSelection();
      } else if (this.gameState === 'gameover') {
        // Dismiss game over with SPACE
        this._dismissGameOver();
      }
    } else if (this.gameState === 'paused') {
      // Popup navigation
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this._movePopupSelection(-1);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        this._movePopupSelection(1);
      }
    }
  }

  _handleTouchStart(e) {
    // Record touch time for blocking delayed click events
    this._lastTouchTime = Date.now();

    // Handle touch immediately for instant mobile response
    if (this.gameState === 'playing') {
      if (!e.target.closest('.stacking-play-btn')) {
        // Only place if not already touching (prevents spam while holding)
        if (!this._touchActive) {
          this._touchActive = true;
          this._placeBlocks();
        }
      }
    } else if (this.gameState === 'paused') {
      const option = e.target.closest('.stacking-popup-option');
      if (option) {
        const action = option.dataset.action;
        if (action === 'continue') {
          this.popupSelection = 0;
        } else if (action === 'cashout') {
          this.popupSelection = 1;
        }
        this._updatePopupSelection();
        this._confirmPopupSelection();
      }
    } else if (this.gameState === 'gameover') {
      if (!e.target.closest('.stacking-play-btn')) {
        this._dismissGameOver();
      }
    }
  }

  _handleTouchEnd(e) {
    // Reset touch active state when finger is lifted
    // This allows the next touch to place a block
    this._touchActive = false;
  }

  _handleClick(e) {
    // Skip if touch was recent (prevents double action on mobile)
    // Click events can fire up to 500ms after touch on some devices
    if (Date.now() - this._lastTouchTime < 500) return;

    if (this.gameState === 'playing') {
      // Click anywhere (except play button) to place blocks
      if (!e.target.closest('.stacking-play-btn')) {
        this._placeBlocks();
      }
    } else if (this.gameState === 'paused') {
      // Click on popup options
      const option = e.target.closest('.stacking-popup-option');
      if (option) {
        const action = option.dataset.action;
        if (action === 'continue') {
          this.popupSelection = 0;
        } else if (action === 'cashout') {
          this.popupSelection = 1;
        }
        this._updatePopupSelection();
        this._confirmPopupSelection();
      }
    } else if (this.gameState === 'gameover') {
      // Click anywhere to dismiss game over
      if (!e.target.closest('.stacking-play-btn')) {
        this._dismissGameOver();
      }
    }
  }

  _startGame() {
    if (this.gameState !== 'idle') return;

    this.gameState = 'starting';
    this._updatePlayButton();

    // Request server to start game (deduct coins)
    this.socket.emit('stackingStart');
  }

  _startGameLoop() {
    // Reset game state
    this.grid = [];
    for (let row = 0; row < ROWS; row++) {
      this.grid[row] = [];
    }
    this.currentRow = 0;
    this.blockWidth = 3;
    this.scrollPos = 0;
    this.scrollDir = 1;
    this.gameState = 'playing';
    this._touchActive = false;  // Reset touch state for new game

    this._clearGrid();
    this._updatePlayButton();
    this._spawnBlocks();
    this._tick();
  }

  _spawnBlocks() {
    // Spawn blocks at current row
    this.currentBlocks = [];
    for (let i = 0; i < this.blockWidth; i++) {
      this.currentBlocks.push(this.scrollPos + i);
    }
  }

  _tick() {
    if (this.gameState !== 'playing') return;

    // Check if next move would go out of bounds - if so, reverse direction FIRST
    const nextPos = this.scrollPos + this.scrollDir;
    if (nextPos < 0 || nextPos + this.blockWidth > COLS) {
      this.scrollDir *= -1;
    }

    // Now move
    this.scrollPos += this.scrollDir;

    // Update current block positions
    this.currentBlocks = [];
    for (let i = 0; i < this.blockWidth; i++) {
      const col = this.scrollPos + i;
      if (col >= 0 && col < COLS) {
        this.currentBlocks.push(col);
      }
    }

    this._renderGrid();

    // Schedule next tick
    const speed = SPEEDS[Math.min(this.currentRow, SPEEDS.length - 1)];
    this.tickInterval = setTimeout(() => this._tick(), speed);
  }

  _placeBlocks() {
    if (this.gameState !== 'playing') return;

    // Cooldown: minimum 120ms between placements (prevents accidental spam)
    const now = Date.now();
    if (now - this._lastPlaceTime < 120) return;
    this._lastPlaceTime = now;

    // Stop the tick
    clearTimeout(this.tickInterval);

    // Clear active blocks first
    for (const col of this.currentBlocks) {
      if (col >= 0 && col < COLS) {
        this.cells[this.currentRow][col].classList.remove('active');
      }
    }

    if (this.currentRow === 0) {
      // First row - just place wherever
      this.grid[0] = [...this.currentBlocks];
      // Mark as placed
      for (const col of this.currentBlocks) {
        this.cells[0][col].classList.add('placed');
      }
    } else {
      // Check overlap with row below
      const below = this.grid[this.currentRow - 1];
      const overlap = this.currentBlocks.filter(col => below.includes(col));

      if (overlap.length === 0) {
        // Total miss - game over!
        this._gameOver(false);
        return;
      }

      // Only keep overlapping blocks
      this.grid[this.currentRow] = overlap;
      this.blockWidth = overlap.length;

      // Mark overlapping blocks as placed
      for (const col of overlap) {
        this.cells[this.currentRow][col].classList.add('placed');
      }
    }

    // Clear tracking for next row
    this._prevActiveRow = undefined;
    this._prevActiveBlocks = null;

    // Check if reached prize row
    if (this.currentRow >= PRIZES.bronze.row) {
      this._checkPrize();
    } else {
      this._moveToNextRow();
    }
  }

  _moveToNextRow() {
    this.currentRow++;

    if (this.currentRow >= ROWS) {
      // Should not happen (gold is at row 9)
      this._gameOver(true, 'gold');
      return;
    }

    // Random start position - prevents spam clicking exploit
    this.scrollDir = Math.random() < 0.5 ? 1 : -1;
    this.scrollPos = Math.floor(Math.random() * (COLS - this.blockWidth + 1));

    this._spawnBlocks();
    this._tick();
  }

  _checkPrize() {
    let prizeLevel = null;
    let prizeAmount = 0;

    if (this.currentRow === PRIZES.gold.row) {
      // Gold = max prize, instant win!
      this._gameOver(true, 'gold');
      return;
    } else if (this.currentRow === PRIZES.silver.row) {
      prizeLevel = 'silver';
      prizeAmount = PRIZES.silver.amount;
    } else if (this.currentRow === PRIZES.bronze.row) {
      prizeLevel = 'bronze';
      prizeAmount = PRIZES.bronze.amount;
    }

    if (prizeLevel) {
      // Show continue/quit popup for bronze/silver
      this._showPopup(prizeLevel, prizeAmount);
    }
  }

  _showPopup(prizeLevel, prizeAmount) {
    this.gameState = 'paused';
    this.popupSelection = 0;

    const titleMap = {
      bronze: 'Has llegado a BRONCE',
      silver: 'Has llegado a PLATA',
      gold: 'Has llegado a ORO'
    };

    this.popupOverlay.querySelector('.popup-title').textContent = titleMap[prizeLevel];
    this.popupOverlay.querySelector('.prize-amount').textContent = `${prizeAmount} $qr`;
    this.popupOverlay.querySelector('.cashout-amount').textContent = prizeAmount;

    // Hide continue option for gold (already at top)
    const continueOption = this.popupOverlay.querySelector('[data-action="continue"]');
    if (prizeLevel === 'gold') {
      continueOption.style.display = 'none';
      this.popupSelection = 0; // Select the only visible option (cashout is now index 0)
    } else {
      continueOption.style.display = 'block';
      this.popupSelection = 0; // Default to continue
    }

    this._updatePopupSelection();
    this.popupOverlay.classList.add('active');

    // Store current prize info
    this._currentPrize = { level: prizeLevel, amount: prizeAmount };
  }

  _hidePopup() {
    this.popupOverlay.classList.remove('active');
  }

  _showLoanPopup() {
    if (this.loanOverlay) {
      this.loanOverlay.style.display = 'flex';
    }
  }

  _hideLoanPopup() {
    if (this.loanOverlay) {
      this.loanOverlay.style.display = 'none';
    }
  }

  _movePopupSelection(delta) {
    const options = this.popupOverlay.querySelectorAll('.stacking-popup-option:not([style*="display: none"])');
    const maxIndex = options.length - 1;
    this.popupSelection = Math.max(0, Math.min(maxIndex, this.popupSelection + delta));
    this._updatePopupSelection();
  }

  _updatePopupSelection() {
    // Only consider visible options
    const options = this.popupOverlay.querySelectorAll('.stacking-popup-option:not([style*="display: none"])');
    options.forEach((opt, idx) => {
      opt.classList.toggle('selected', idx === this.popupSelection);
    });
  }

  _confirmPopupSelection() {
    const options = this.popupOverlay.querySelectorAll('.stacking-popup-option:not([style*="display: none"])');
    const selectedOption = options[this.popupSelection];

    if (!selectedOption) return;

    const action = selectedOption.dataset.action;
    this._hidePopup();

    if (action === 'continue') {
      this.gameState = 'playing';
      this._moveToNextRow();
    } else if (action === 'cashout') {
      this._gameOver(true, this._currentPrize.level);
    }
  }

  _gameOver(won, prizeLevel = null) {
    this.gameState = 'gameover';
    clearTimeout(this.tickInterval);

    if (won && prizeLevel) {
      // Request server to award prize
      this.socket.emit('stackingWin', { prizeLevel });
      const isGold = prizeLevel === 'gold';
      this._showGameOverMessage(true, PRIZES[prizeLevel].amount, isGold);
    } else {
      // Notify server of loss
      this.socket.emit('stackingLose');
      this._showGameOverMessage(false, 0);
    }
  }

  _showGameOverMessage(won, amount, isGold = false) {
    const existing = this.container.querySelector('.stacking-game-over');
    if (existing) existing.remove();

    const msgEl = document.createElement('div');
    msgEl.className = `stacking-game-over ${won ? 'win' : ''} ${isGold ? 'gold-win' : ''}`;

    if (isGold) {
      msgEl.innerHTML = `<h2>GOD GAMER</h2><p>Has ganado ${amount} $qr</p><button class="stacking-continue-btn">Continuar</button>`;
    } else if (won) {
      msgEl.innerHTML = `<h2>PUSSY</h2><p>+${amount} $qr</p>`;
    } else {
      msgEl.innerHTML = `<h2>GAME OVER</h2><p>Eso te pasa por avaricioso</p>`;
    }

    this.container.appendChild(msgEl);

    // Add click handler for gold continue button
    if (isGold) {
      const continueBtn = msgEl.querySelector('.stacking-continue-btn');
      continueBtn?.addEventListener('click', () => this._dismissGameOver());
    }
  }

  _dismissGameOver() {
    if (this.gameState !== 'gameover') return;
    this._clearGameOverMessage();
    this.gameState = 'idle';
    this._updatePlayButton();
    this._clearGrid();
  }

  _clearGameOverMessage() {
    const existing = this.container.querySelector('.stacking-game-over');
    if (existing) existing.remove();
  }

  _renderGrid() {
    // Optimized: Only update cells that changed since last render

    // Clear previous active blocks (if any)
    if (this._prevActiveRow !== undefined && this._prevActiveBlocks) {
      for (const col of this._prevActiveBlocks) {
        if (col >= 0 && col < COLS && this.cells[this._prevActiveRow]) {
          this.cells[this._prevActiveRow][col].classList.remove('active');
        }
      }
    }

    // Render current scrolling blocks
    if (this.gameState === 'playing') {
      for (const col of this.currentBlocks) {
        if (col >= 0 && col < COLS) {
          this.cells[this.currentRow][col].classList.add('active');
        }
      }
      // Store for next render
      this._prevActiveRow = this.currentRow;
      this._prevActiveBlocks = [...this.currentBlocks];
    } else {
      this._prevActiveRow = undefined;
      this._prevActiveBlocks = null;
    }
  }

  // Called when a row is placed - updates placed blocks
  _renderPlacedBlocks() {
    for (let row = 0; row < ROWS; row++) {
      if (this.grid[row]) {
        for (const col of this.grid[row]) {
          this.cells[row][col].classList.add('placed');
        }
      }
    }
  }

  _clearGrid() {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        this.cells[row][col].classList.remove('active', 'placed');
      }
    }
    // Reset tracking
    this._prevActiveRow = undefined;
    this._prevActiveBlocks = null;
  }

  _updatePlayButton() {
    if (this.gameState === 'idle') {
      this.playBtn.disabled = false;
      this.playBtn.textContent = `JUGAR - ${GAME_COST} $qr`;
    } else if (this.gameState === 'gameover') {
      this.playBtn.disabled = true;
      this.playBtn.textContent = 'ESPACIO para continuar';
    } else {
      this.playBtn.disabled = true;
      this.playBtn.textContent = 'JUGANDO...';
    }
  }

  _updateCoinsDisplay() {
    // Look for coins display in popup window first (VGM mode), then globally (standalone)
    const popupWindow = this.container.closest('.slot-popup-window');
    const coinsEl = popupWindow
      ? popupWindow.querySelector('#stacking-coins')
      : document.getElementById('stacking-coins');
    if (coinsEl) {
      coinsEl.textContent = `${this.coins} $qr`;
    }
  }

  destroy() {
    clearTimeout(this.tickInterval);
    document.removeEventListener('keydown', this._handleKeyDown);
    this.container.removeEventListener('click', this._handleClick);
    this.container.removeEventListener('touchstart', this._handleTouchStart);
    this.container.removeEventListener('touchend', this._handleTouchEnd);

    // Remove socket listeners
    this.socket.off('stackingBalance');
    this.socket.off('stackingStarted');
    this.socket.off('stackingInsufficientFunds');
    this.socket.off('stackingWon');
    this.socket.off('stackingLost');
    this.socket.off('stackingError');
    this.socket.off('slotsLoanReceived');

    this.container.innerHTML = '';
  }
}

export default BlockStackingGame;
