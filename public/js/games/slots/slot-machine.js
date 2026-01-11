/**
 * Slot Machine Component
 *
 * Reusable slot machine for standalone and popup modes.
 * Styled like classic "Slot Machine 98" cabinet.
 *
 * Controls:
 * - Press SPACE to start all reels spinning (smooth scroll down)
 * - Press SPACE again to stop reel 1
 * - Press SPACE again to stop reel 2
 * - Press SPACE again to stop reel 3
 */

import { showCoinAnimation } from '../../ui/coin-animation.js';

export class SlotMachine {
  constructor(options = {}) {
    this.container = options.container;
    this.socket = options.socket;
    this.onCoinsUpdate = options.onCoinsUpdate || (() => {});
    this.onLeaderboardClick = options.onLeaderboardClick || (() => {});
    this.onAlbumClick = options.onAlbumClick || (() => {});

    this.coins = 1000;
    this.debt = 0;
    this.numLines = 1;

    // Keyboard control - can be disabled when popup loses focus
    this.keyboardEnabled = true;

    // Spin state: 'idle' | 'spinning' | 'stopping'
    this.spinState = 'idle';
    this.reelsStopped = 0; // 0, 1, 2, 3
    this.pendingResult = null; // Store server result until all reels stop

    // Symbol definitions (must match server)
    this.symbols = ['cherry', 'lemon', 'orange', 'grape', 'bell', 'bar', 'seven'];

    // Symbol display (custom images from /gamba folder)
    this.symbolEmojis = {
      cherry: '<img src="gamba/omegalul.png" alt="cherry" class="slot-sym-img">',
      lemon: '<img src="gamba/cmonbluh.png" alt="lemon" class="slot-sym-img">',
      orange: '<img src="gamba/goblinus.png" alt="orange" class="slot-sym-img">',
      grape: '<img src="gamba/iose.png" alt="grape" class="slot-sym-img">',
      bell: '<img src="gamba/navarra.png" alt="bell" class="slot-sym-img">',
      bar: '<img src="gamba/ima.png" alt="bar" class="slot-sym-img">',
      seven: '<img src="gamba/thanos.gif" alt="seven" class="slot-sym-img">'
    };

    this.COST_PER_LINE = 10;
    this.SYMBOL_HEIGHT = 56;
    this.VISIBLE_ROWS = 3;
    this.STRIP_LENGTH = 30; // Long strip for smooth looping

    this.init();
  }

  init() {
    this.render();
    this.bindEvents();
    this.setupSocketListeners();
    this.socket.emit('slotsGetBalance');
  }

  getRandomSymbol() {
    return this.symbols[Math.floor(Math.random() * this.symbols.length)];
  }

  // Generate a long strip of random symbols
  generateSpinStrip() {
    const strip = [];
    for (let i = 0; i < this.STRIP_LENGTH; i++) {
      strip.push(this.getRandomSymbol());
    }
    return strip;
  }

  render() {
    const initialSymbols = [
      ['cherry', 'lemon', 'orange'],
      ['grape', 'bell', 'bar'],
      ['seven', 'cherry', 'lemon']
    ];

    // Only render the cabinet - window wrapper is provided externally
    this.container.innerHTML = `
      <div class="slot-cabinet">
        <div class="slot-top-bar">
          <span class="slot-title">SQRRR GAMBA</span>
          <span class="slot-credits"><span class="slot-coin-display">${this.coins}</span> $qr</span>
          <div class="slot-top-buttons">
            <button class="slot-leaderboard-btn" title="Leaderboards">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
              </svg>
            </button>
            <button class="slot-album-btn" title="Tienda">$</button>
          </div>
        </div>

        <div class="slot-body">
          <div class="slot-payout-panel">
            <div class="payout-title">PREMIOS</div>
            <div class="payout-item"><span class="payout-sym">${this.symbolEmojis.seven}${this.symbolEmojis.seven}${this.symbolEmojis.seven}</span><span class="payout-val">5000 $qr</span></div>
            <div class="payout-item"><span class="payout-sym">${this.symbolEmojis.bar}${this.symbolEmojis.bar}${this.symbolEmojis.bar}</span><span class="payout-val">1500 $qr</span></div>
            <div class="payout-item"><span class="payout-sym">${this.symbolEmojis.bell}${this.symbolEmojis.bell}${this.symbolEmojis.bell}</span><span class="payout-val">750 $qr</span></div>
            <div class="payout-item"><span class="payout-sym">${this.symbolEmojis.grape}${this.symbolEmojis.grape}${this.symbolEmojis.grape}</span><span class="payout-val">350 $qr</span></div>
            <div class="payout-item"><span class="payout-sym">${this.symbolEmojis.orange}${this.symbolEmojis.orange}${this.symbolEmojis.orange}</span><span class="payout-val">150 $qr</span></div>
            <div class="payout-item"><span class="payout-sym">${this.symbolEmojis.lemon}${this.symbolEmojis.lemon}${this.symbolEmojis.lemon}</span><span class="payout-val">60 $qr</span></div>
            <div class="payout-item"><span class="payout-sym">${this.symbolEmojis.cherry}${this.symbolEmojis.cherry}${this.symbolEmojis.cherry}</span><span class="payout-val">30 $qr</span></div>
          </div>

          <div class="slot-main">
            <div class="slot-reels-frame">
              <!-- Paylines behind reels -->
              <div class="slot-paylines">
                <div class="payline payline-top ${this.numLines >= 3 ? 'active' : ''}"></div>
                <div class="payline payline-mid active"></div>
                <div class="payline payline-bot ${this.numLines >= 3 ? 'active' : ''}"></div>
                <div class="payline payline-diag1 ${this.numLines >= 5 ? 'active' : ''}"></div>
                <div class="payline payline-diag2 ${this.numLines >= 5 ? 'active' : ''}"></div>
              </div>
              <div class="slot-reels">
                ${[0, 1, 2].map(reelIndex => `
                  <div class="slot-reel" data-reel="${reelIndex}">
                    <div class="slot-strip">
                      ${initialSymbols[reelIndex].map((sym, rowIndex) => `
                        <div class="slot-symbol" data-row="${rowIndex}">${this.symbolEmojis[sym]}</div>
                      `).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
              <div class="slot-line-markers">
                <div class="line-marker line-top ${this.numLines >= 3 ? 'active' : ''}"></div>
                <div class="line-marker line-mid active"></div>
                <div class="line-marker line-bot ${this.numLines >= 3 ? 'active' : ''}"></div>
              </div>
            </div>

            <div class="slot-lever-area">
              <button class="slot-lever" title="TIRAR">
                <div class="lever-knob"></div>
                <div class="lever-arm"></div>
              </button>
            </div>
          </div>
        </div>

        <div class="slot-controls">
          <div class="slot-bet-display">
            <span>Apuesta: <strong>${this.numLines * this.COST_PER_LINE}</strong> $qr</span>
          </div>
          <div class="slot-lines-select">
            <button class="line-btn ${this.numLines === 1 ? 'active' : ''}" data-lines="1">1L</button>
            <button class="line-btn ${this.numLines === 3 ? 'active' : ''}" data-lines="3">3L</button>
            <button class="line-btn ${this.numLines === 5 ? 'active' : ''}" data-lines="5">5L</button>
          </div>
          <button class="slot-spin-btn">TIRAR</button>
        </div>

        <div class="slot-footer">
          <span class="slot-debt-label">Deudas con Israel: <span class="slot-debt">${this.debt}</span></span>
          <span class="slot-hint">[ESPACIO]</span>
        </div>

        <div class="slot-loan-overlay" style="display: none;">
          <div class="loan-popup">
            <p>Broke ass ni</p>
            <button class="loan-btn">Pedir prestamo a Benjamin Netanyahu</button>
          </div>
        </div>

      </div>
    `;
  }

  bindEvents() {
    // Spin button
    const spinBtn = this.container.querySelector('.slot-spin-btn');
    spinBtn.addEventListener('click', () => this.handleAction());

    // Lever
    const lever = this.container.querySelector('.slot-lever');
    lever.addEventListener('click', () => this.handleAction());

    // Line buttons
    this.container.querySelectorAll('.line-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (this.spinState !== 'idle') return;

        this.numLines = parseInt(e.currentTarget.dataset.lines);
        this.container.querySelectorAll('.line-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.updateBetDisplay();
        this.updateLineMarkers();
      });
    });

    // Loan button
    const loanBtn = this.container.querySelector('.loan-btn');
    loanBtn.addEventListener('click', () => {
      this.socket.emit('slotsRequestLoan', { numLines: this.numLines });
    });

    // Leaderboard button
    const leaderboardBtn = this.container.querySelector('.slot-leaderboard-btn');
    leaderboardBtn.addEventListener('click', () => this.onLeaderboardClick());

    // Album button
    const albumBtn = this.container.querySelector('.slot-album-btn');
    albumBtn.addEventListener('click', () => this.onAlbumClick());

    // Space key handler - only responds when keyboard is enabled
    this.keyHandler = (e) => {
      if (e.code === 'Space' && this.keyboardEnabled && this.isVisible()) {
        e.preventDefault();
        this.handleAction();
      }
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  // Main action handler - called on space or click
  handleAction() {
    if (this.spinState === 'idle') {
      this.startSpin();
    } else if (this.spinState === 'spinning' || this.spinState === 'stopping') {
      this.stopNextReel();
    }
  }

  isVisible() {
    return this.container.offsetParent !== null;
  }

  setKeyboardEnabled(enabled) {
    this.keyboardEnabled = enabled;
  }

  updateBetDisplay() {
    const betDisplay = this.container.querySelector('.slot-bet-display strong');
    if (betDisplay) {
      betDisplay.textContent = this.numLines * this.COST_PER_LINE;
    }
  }

  updateLineMarkers() {
    // Update dot markers
    const markers = this.container.querySelectorAll('.line-marker');
    markers.forEach(m => m.classList.remove('active'));

    this.container.querySelector('.line-mid')?.classList.add('active');

    if (this.numLines >= 3) {
      this.container.querySelector('.line-top')?.classList.add('active');
      this.container.querySelector('.line-bot')?.classList.add('active');
    }

    // Update paylines
    const paylines = this.container.querySelectorAll('.payline');
    paylines.forEach(p => p.classList.remove('active'));

    this.container.querySelector('.payline-mid')?.classList.add('active');

    if (this.numLines >= 3) {
      this.container.querySelector('.payline-top')?.classList.add('active');
      this.container.querySelector('.payline-bot')?.classList.add('active');
    }

    if (this.numLines >= 5) {
      this.container.querySelector('.payline-diag1')?.classList.add('active');
      this.container.querySelector('.payline-diag2')?.classList.add('active');
    }
  }

  setupSocketListeners() {
    this.socket.on('slotsBalance', ({ coins, debt }) => {
      this.coins = coins;
      this.debt = debt;
      this.updateDisplay();
    });

    this.socket.on('slotsResult', ({ reels, winningLines, totalWin, coins, cost }) => {
      // Store result - will be used when player stops each reel
      this.pendingResult = { reels, winningLines, totalWin };
      this.coins = coins;
      this.updateDisplay();
      this.onCoinsUpdate(coins);
    });

    this.socket.on('slotsInsufficientFunds', ({ coins, required }) => {
      this.showLoanOverlay();
      this.spinState = 'idle';
    });

    this.socket.on('slotsLoanReceived', ({ coins, debt, amount }) => {
      this.coins = coins;
      this.debt = debt;
      this.hideLoanOverlay();
      this.updateDisplay();
      this.showWinAnimation(amount);
    });

    this.socket.on('slotsError', ({ message }) => {
      console.error('Slots error:', message);
      this.spinState = 'idle';
      this.reelsStopped = 0;
    });
  }

  startSpin() {
    const cost = this.numLines * this.COST_PER_LINE;
    if (this.coins < cost) {
      this.showLoanOverlay();
      return;
    }

    this.spinState = 'spinning';
    this.reelsStopped = 0;
    this.pendingResult = null;

    // Animate lever
    const lever = this.container.querySelector('.slot-lever');
    lever.classList.add('pulled');
    setTimeout(() => lever.classList.remove('pulled'), 300);

    // Start ALL reels spinning at the same time with scrolling strips
    this.container.querySelectorAll('.slot-reel').forEach((reel, index) => {
      const strip = reel.querySelector('.slot-strip');

      // Generate a long strip of symbols for smooth scrolling
      const stripSymbols = this.generateSpinStrip();

      // Build the strip HTML - symbols scroll from top to bottom
      strip.innerHTML = stripSymbols.map(sym => `
        <div class="slot-symbol">${this.symbolEmojis[sym]}</div>
      `).join('');

      // Position at top of strip
      const totalHeight = stripSymbols.length * this.SYMBOL_HEIGHT;
      const visibleHeight = this.VISIBLE_ROWS * this.SYMBOL_HEIGHT;
      strip.style.transform = `translateY(-${totalHeight - visibleHeight}px)`;

      // Force reflow
      strip.offsetHeight;

      // Add spinning class for CSS animation
      strip.classList.add('spinning');
    });

    // Send spin request to server
    this.socket.emit('slotsSpin', { numLines: this.numLines });
  }

  stopNextReel() {
    if (this.reelsStopped >= 3) return;
    if (!this.pendingResult) return; // Wait for server result

    const reelIndex = this.reelsStopped;
    const reel = this.container.querySelector(`.slot-reel[data-reel="${reelIndex}"]`);
    if (!reel) return;

    const strip = reel.querySelector('.slot-strip');

    // Stop the CSS animation
    strip.classList.remove('spinning');

    // Get final symbols for this reel from server result
    const finalSymbols = this.pendingResult.reels[reelIndex];

    // Rebuild strip with just the final 3 symbols
    strip.innerHTML = finalSymbols.map((sym, rowIndex) => `
      <div class="slot-symbol" data-row="${rowIndex}">${this.symbolEmojis[sym]}</div>
    `).join('');

    // Reset position and add push-down animation
    strip.style.transform = 'translateY(0)';
    strip.classList.add('stopping');

    setTimeout(() => {
      strip.classList.remove('stopping');
    }, 300);

    this.reelsStopped++;
    this.spinState = 'stopping';

    // Check if all reels stopped
    if (this.reelsStopped >= 3) {
      setTimeout(() => {
        this.finishSpin();
      }, 400);
    }
  }

  finishSpin() {
    this.spinState = 'idle';
    this.reelsStopped = 0;

    if (this.pendingResult) {
      const { winningLines, totalWin } = this.pendingResult;

      if (winningLines && winningLines.length > 0) {
        this.highlightWinningLines(winningLines);
        this.showWinAnimation(totalWin);
      }

      this.pendingResult = null;
    }
  }

  highlightWinningLines(winningLines) {
    winningLines.forEach(line => {
      if (line.pattern) {
        line.pattern.forEach((row, col) => {
          const reel = this.container.querySelector(`.slot-reel[data-reel="${col}"]`);
          const sym = reel?.querySelector(`.slot-symbol[data-row="${row}"]`);
          if (sym) {
            sym.classList.add('winning');
            setTimeout(() => sym.classList.remove('winning'), 1500);
          }
        });
      }
    });
  }

  showWinAnimation(amount) {
    if (amount <= 0) return;

    // Show popup in slot machine
    const anim = document.createElement('div');
    anim.className = 'slot-win-popup';
    anim.textContent = `+${amount} $qr`;
    this.container.querySelector('.slot-cabinet').appendChild(anim);

    setTimeout(() => anim.remove(), 1500);

    // Also show cursor-following coin animation
    showCoinAnimation(amount);
  }

  updateDisplay() {
    const coinDisplay = this.container.querySelector('.slot-coin-display');
    const debtDisplay = this.container.querySelector('.slot-debt');

    if (coinDisplay) coinDisplay.textContent = this.coins;
    if (debtDisplay) debtDisplay.textContent = this.debt;
  }

  showLoanOverlay() {
    const overlay = this.container.querySelector('.slot-loan-overlay');
    if (overlay) overlay.style.display = 'flex';
  }

  hideLoanOverlay() {
    const overlay = this.container.querySelector('.slot-loan-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  destroy() {
    if (this.keyHandler) {
      document.removeEventListener('keydown', this.keyHandler);
    }

    this.socket.off('slotsBalance');
    this.socket.off('slotsResult');
    this.socket.off('slotsInsufficientFunds');
    this.socket.off('slotsLoanReceived');
    this.socket.off('slotsError');
  }
}

export default SlotMachine;
