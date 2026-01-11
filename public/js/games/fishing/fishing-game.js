/**
 * Fishing Game
 *
 * Skill-based fishing game using canvas.
 * - Fish swim horizontally in layers
 * - Player clicks to drop hook
 * - Catch fish = win coins, hit obstacle = get nothing
 */

const GAME_COST = 100;
const HOOK_SPEED = 150; // pixels per second

export class FishingGame {
  constructor(options) {
    this.container = options.container;
    this.socket = options.socket;
    this.onCoinsUpdate = options.onCoinsUpdate || (() => {});

    // Game state
    this.gameState = 'idle'; // 'idle' | 'ready' | 'dropping' | 'result'
    this.coins = 0;
    this.gameData = null;
    this.entities = [];

    // Hook state
    this.hookX = 0;
    this.hookY = 0;
    this.hookDropping = false;

    // Mouse/touch tracking for surface cursor
    this.mouseX = 200;
    this.mouseY = 30;

    // Charge system - hold before casting
    this.isCharging = false;
    this.chargeStartTime = 0;
    this.chargeLevel = 0; // 0 to 1
    this.descentSpeed = 1; // Multiplier set when released

    // Caught fish display
    this.caughtEntity = null;
    this.caughtPayout = 0;
    this.resultTimeout = null;

    // Animation
    this.animationFrame = null;
    this.lastTime = 0;

    // DOM elements
    this.canvas = null;
    this.ctx = null;
    this.playBtn = null;
    this.loanOverlay = null;

    // Images cache
    this.images = {};
    this.imagesLoaded = false;

    // Bound handlers
    this._handleCanvasClick = this._handleCanvasClick.bind(this);
    this._handleMouseMove = this._handleMouseMove.bind(this);
    this._handleMouseDown = this._handleMouseDown.bind(this);
    this._handleMouseUp = this._handleMouseUp.bind(this);
    this._handleTouchStart = this._handleTouchStart.bind(this);
    this._handleTouchMove = this._handleTouchMove.bind(this);
    this._handleTouchEnd = this._handleTouchEnd.bind(this);
    this._gameLoop = this._gameLoop.bind(this);
  }

  init() {
    this._setupSocketHandlers();
    this._render();
    this._setupEventListeners();
    this._preloadImages();

    // Request initial balance
    this.socket.emit('fishingGetBalance');
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    // Remove socket listeners
    this.socket.off('fishingBalance');
    this.socket.off('fishingStarted');
    this.socket.off('fishingInsufficientFunds');
    this.socket.off('fishingResult');
    this.socket.off('fishingError');
    this.socket.off('slotsLoanReceived');

    // Remove event listeners
    if (this.canvas) {
      this.canvas.removeEventListener('click', this._handleCanvasClick);
      this.canvas.removeEventListener('mousemove', this._handleMouseMove);
      this.canvas.removeEventListener('mousedown', this._handleMouseDown);
      this.canvas.removeEventListener('mouseup', this._handleMouseUp);
      this.canvas.removeEventListener('touchstart', this._handleTouchStart);
      this.canvas.removeEventListener('touchmove', this._handleTouchMove);
      this.canvas.removeEventListener('touchend', this._handleTouchEnd);
    }

    // Exit pointer lock if active
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  _preloadImages() {
    const fishImages = [
      'gamba/omegalul.png',
      'gamba/cmonbluh.png',
      'gamba/goblinus.png',
      'gamba/iose.png',
      'gamba/navarra.png',
      'gamba/ima.png',
      'gamba/thanos.gif'
    ];

    let loaded = 0;
    const total = fishImages.length;

    fishImages.forEach(src => {
      const img = new Image();
      img.onload = () => {
        loaded++;
        if (loaded === total) {
          this.imagesLoaded = true;
        }
      };
      img.onerror = () => {
        loaded++;
        console.warn('Failed to load image:', src);
      };
      img.src = src;
      this.images[src] = img;
    });
  }

  _setupSocketHandlers() {
    this.socket.on('fishingBalance', (data) => {
      this.coins = data.coins;
      this._updateCoinsDisplay();
    });

    this.socket.on('fishingStarted', (data) => {
      this.coins = data.coins;
      this.gameData = data.gameState;
      this.entities = data.gameState.entities.map(e => ({ ...e }));
      this._updateCoinsDisplay();
      this._startGame();
    });

    this.socket.on('fishingInsufficientFunds', (data) => {
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

    this.socket.on('fishingResult', (data) => {
      this.coins = data.coins;
      this._updateCoinsDisplay();
      this.onCoinsUpdate(data.coins);

      if (data.success && data.caught) {
        // Store caught fish for big display
        this.caughtEntity = data.caught;
        this.caughtPayout = data.payout;
      } else {
        this.caughtEntity = null;
        this.caughtPayout = 0;
        this._showMessage(data.message || 'Nada atrapado', 'fail');
      }

      // Auto-dismiss after 2 seconds (can be cancelled by click)
      this.resultTimeout = setTimeout(() => {
        this._dismissResult();
      }, 2000);
    });

    this.socket.on('fishingError', (data) => {
      console.error('Fishing error:', data.message);
      this._showMessage('Error: ' + data.message, 'error');
      this.gameState = 'idle';
      this._updatePlayButton();
    });
  }

  _render() {
    this.container.innerHTML = `
      <div class="fishing-game-area">
        <canvas id="fishing-canvas" width="400" height="500"></canvas>
        <div class="fishing-message" id="fishing-message"></div>
        <button class="fishing-play-btn" id="fishing-play-btn">PESCAR - 100 $qr</button>
        <div class="fishing-loan-overlay">
          <div class="loan-popup">
            <p>No tienes suficientes monedas</p>
            <button class="loan-btn">Pedir prestamo a Benjamin Netanyahu</button>
          </div>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#fishing-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.playBtn = this.container.querySelector('#fishing-play-btn');
    this.messageEl = this.container.querySelector('#fishing-message');
    this.loanOverlay = this.container.querySelector('.fishing-loan-overlay');

    // Loan button handler
    const loanBtn = this.container.querySelector('.loan-btn');
    loanBtn.addEventListener('click', () => {
      this.socket.emit('slotsRequestLoan', { requiredAmount: GAME_COST });
    });

    this._drawIdleState();
  }

  _setupEventListeners() {
    this.playBtn.addEventListener('click', () => {
      if (this.gameState === 'idle') {
        this._requestStart();
      }
    });

    this.canvas.addEventListener('click', this._handleCanvasClick);
    this.canvas.addEventListener('mousemove', this._handleMouseMove);
    this.canvas.addEventListener('mousedown', this._handleMouseDown);
    this.canvas.addEventListener('mouseup', this._handleMouseUp);
    this.canvas.addEventListener('touchstart', this._handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this._handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this._handleTouchEnd);

    // Handle pointer lock change (user pressed Escape)
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas && this.gameState === 'ready') {
        // Pointer lock was released while in ready state - cast the rod
        if (this.isCharging) {
          this._castRod();
        }
      }
    });
  }

  _handleMouseMove(e) {
    if (this.gameState !== 'ready') return;

    // When pointer is locked, use relative movement
    if (document.pointerLockElement === this.canvas) {
      this.mouseX += e.movementX;
      // Clamp to canvas bounds
      this.mouseX = Math.max(30, Math.min(this.canvas.width - 30, this.mouseX));
    } else {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      this.mouseX = (e.clientX - rect.left) * scaleX;
      // Clamp to canvas bounds
      this.mouseX = Math.max(30, Math.min(this.canvas.width - 30, this.mouseX));
    }
  }

  _handleMouseDown(e) {
    if (this.gameState !== 'ready') return;
    e.preventDefault();

    // Start charging (hookX will be set on release based on current mouseX)
    this.isCharging = true;
    this.chargeStartTime = Date.now();
    this.chargeLevel = 0;
  }

  _handleMouseUp(e) {
    if (!this.isCharging || this.gameState !== 'ready') {
      this.isCharging = false;
      return;
    }
    this._castRod();
  }

  _castRod() {
    // Release - cast from current mouse position with charged speed
    const chargeTime = (Date.now() - this.chargeStartTime) / 1000;
    this.descentSpeed = Math.min(3, 1 + chargeTime); // 1x to 3x over 2 seconds
    this.isCharging = false;
    this.chargeLevel = 0;

    // Exit pointer lock
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }

    // Cast from current rod position
    this.hookX = this.mouseX;
    this.hookY = 60;
    this.hookDropping = true;
    this.gameState = 'dropping';
    this.playBtn.style.display = 'none';
  }

  _handleTouchStart(e) {
    if (this.gameState !== 'ready') return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouseX = (touch.clientX - rect.left) * scaleX;
    this.mouseY = (touch.clientY - rect.top) * scaleY;

    // Start charging (hookX will be set on release based on current mouseX)
    this.isCharging = true;
    this.chargeStartTime = Date.now();
    this.chargeLevel = 0;
  }

  _handleTouchMove(e) {
    if (this.gameState !== 'ready') return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.mouseX = (touch.clientX - rect.left) * scaleX;
    this.mouseY = (touch.clientY - rect.top) * scaleY;
  }

  _handleTouchEnd(e) {
    // Tap to dismiss caught fish display on mobile
    if (this.gameState === 'result' && this.caughtEntity) {
      this._dismissResult();
      return;
    }

    if (!this.isCharging || this.gameState !== 'ready') {
      this.isCharging = false;
      return;
    }
    this._castRod();
  }

  _handleCanvasClick(e) {
    // Click to dismiss caught fish display
    if (this.gameState === 'result' && this.caughtEntity) {
      this._dismissResult();
      return;
    }

    if (this.gameState !== 'ready') return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scaleX = this.canvas.width / rect.width;

    this.hookX = x * scaleX;
    this.hookY = 60; // Start at water surface
    this.hookDropping = true;
    this.gameState = 'dropping';

    // Hide play button during drop
    this.playBtn.style.display = 'none';
  }

  _dismissResult() {
    // Clear auto-dismiss timeout if user clicked early
    if (this.resultTimeout) {
      clearTimeout(this.resultTimeout);
      this.resultTimeout = null;
    }
    this.gameState = 'idle';
    this.caughtEntity = null;
    this.caughtPayout = 0;
    this._updatePlayButton();
    this._drawIdleState();
    this.canvas.style.cursor = 'default';
  }

  _requestStart() {
    this.gameState = 'loading';
    this._updatePlayButton();
    this.socket.emit('fishingStart');
  }

  _startGame() {
    this.gameState = 'ready';
    this.hookDropping = false;
    this.hookX = 0;
    this.hookY = 0;
    this.descentSpeed = 1;
    this.isCharging = false;
    this.chargeLevel = 0;
    this._updatePlayButton();

    // Set initial rod position to center
    this.mouseX = this.canvas.width / 2;

    // Request pointer lock to keep cursor inside canvas
    this.canvas.requestPointerLock();

    // Hide cursor when game is ready (fallback if pointer lock fails)
    this.canvas.style.cursor = 'none';

    // Start game loop
    this.lastTime = performance.now();
    this._gameLoop();
  }

  _gameLoop(timestamp = performance.now()) {
    if (this.gameState === 'idle') return;

    const deltaTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    this._update(deltaTime);
    this._draw();

    this.animationFrame = requestAnimationFrame(this._gameLoop);
  }

  _update(dt) {
    // Update entity positions (fish and moving obstacles like debris)
    for (const entity of this.entities) {
      if (entity.speed > 0) {
        entity.x += entity.speed * entity.direction * dt;

        // Bounce off walls
        if (entity.x <= 30) {
          entity.x = 30;
          entity.direction = 1;
        } else if (entity.x >= this.canvas.width - 30) {
          entity.x = this.canvas.width - 30;
          entity.direction = -1;
        }
      }
    }

    // Update charge level while charging
    if (this.isCharging) {
      const chargeTime = (Date.now() - this.chargeStartTime) / 1000;
      this.chargeLevel = Math.min(1, chargeTime / 2); // 0 to 1 over 2 seconds
    }

    // Update hook position with pre-set descent speed
    if (this.hookDropping) {
      this.hookY += HOOK_SPEED * this.descentSpeed * dt;

      // Check for collisions
      for (let i = 0; i < this.entities.length; i++) {
        const entity = this.entities[i];
        const dist = Math.hypot(this.hookX - entity.x, this.hookY - entity.y);

        if (dist < entity.size / 2 + 8) {
          // Collision!
          this.hookDropping = false;
          this.gameState = 'result';

          // Report catch to server
          this.socket.emit('fishingCatch', {
            entityIndex: i,
            hookX: this.hookX,
            hookY: this.hookY,
            timestamp: Date.now()
          });

          return;
        }
      }

      // Check if hook reached bottom
      if (this.hookY >= this.canvas.height - 20) {
        this.hookDropping = false;
        this.gameState = 'result';
        this.socket.emit('fishingMiss');
      }
    }
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // Draw sky
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, w, 60);

    // Draw water gradient
    const waterGradient = ctx.createLinearGradient(0, 60, 0, h);
    waterGradient.addColorStop(0, '#1E90FF');
    waterGradient.addColorStop(0.5, '#0066CC');
    waterGradient.addColorStop(1, '#003366');
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, 60, w, h - 60);

    // Draw water surface waves
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < w; x += 20) {
      const waveY = 60 + Math.sin((x + Date.now() / 200) * 0.1) * 3;
      if (x === 0) {
        ctx.moveTo(x, waveY);
      } else {
        ctx.lineTo(x, waveY);
      }
    }
    ctx.stroke();

    // Draw layer indicators (subtle lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const layerHeight = (h - 60) / 6;
    for (let i = 1; i < 6; i++) {
      const y = 60 + i * layerHeight;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Draw entities (fish and obstacles)
    for (const entity of this.entities) {
      if (entity.type === 'fish') {
        this._drawFish(entity);
      } else {
        this._drawObstacle(entity);
      }
    }

    // Draw hook if dropping or ready
    if (this.gameState === 'dropping' || this.gameState === 'result') {
      this._drawHook();
    }

    // Draw rod/hook cursor at mouse position if game is ready
    if (this.gameState === 'ready') {
      this._drawRodCursor();
    }

    // Draw caught fish big in center during result
    if (this.gameState === 'result' && this.caughtEntity) {
      this._drawCaughtFish();
    }
  }

  _drawCaughtFish() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const entity = this.caughtEntity;

    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 60, w, h - 60);

    // Draw big fish image in center
    const bigSize = 120;
    const img = this.images[entity.image];

    if (img && img.complete) {
      ctx.drawImage(img, w / 2 - bigSize / 2, h / 2 - bigSize / 2 - 20, bigSize, bigSize);
    }

    // Draw payout text
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${this.caughtPayout} $qr`, w / 2, h / 2 + bigSize / 2 + 10);
  }

  _drawRodCursor() {
    const ctx = this.ctx;
    const x = this.mouseX;

    // Draw rod (brown stick from top)
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 50);
    ctx.stroke();

    // Draw rod tip detail
    ctx.strokeStyle = '#5D3A1A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 45);
    ctx.lineTo(x, 55);
    ctx.stroke();

    // Draw fishing line from rod to just below surface
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 50);
    ctx.lineTo(x, 75);
    ctx.stroke();

    // Draw hook at the end
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.arc(x, 75, 5, 0, Math.PI * 2);
    ctx.fill();

    // Hook curve detail
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, 78, 4, 0, Math.PI);
    ctx.stroke();

    // Draw charge bar next to rod when charging
    if (this.isCharging || this.chargeLevel > 0) {
      const barX = x + 15;
      const barY = 10;
      const barWidth = 8;
      const barHeight = 50;

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Border
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

      // Fill based on charge level (bottom to top, green to red)
      const fillHeight = barHeight * this.chargeLevel;
      const gradient = ctx.createLinearGradient(0, barY + barHeight, 0, barY);
      gradient.addColorStop(0, '#00FF00');
      gradient.addColorStop(0.5, '#FFFF00');
      gradient.addColorStop(1, '#FF0000');
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, barY + barHeight - fillHeight, barWidth, fillHeight);
    }
  }

  _drawFish(entity) {
    const ctx = this.ctx;
    const img = this.images[entity.image];

    if (img && img.complete) {
      // Draw fish image
      const size = entity.size;
      ctx.save();
      ctx.translate(entity.x, entity.y);

      // Flip fish based on direction
      if (entity.direction < 0) {
        ctx.scale(-1, 1);
      }

      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      // Fallback: draw colored circle
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, entity.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw coin value below fish
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${entity.coins}`, entity.x, entity.y + entity.size / 2 + 15);
  }

  _drawObstacle(entity) {
    const ctx = this.ctx;

    // Draw obstacle emoji
    ctx.font = `${entity.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.emoji, entity.x, entity.y);
  }

  _drawHook() {
    const ctx = this.ctx;

    // Draw fishing line
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.hookX, 60);
    ctx.lineTo(this.hookX, this.hookY);
    ctx.stroke();

    // Draw hook
    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.arc(this.hookX, this.hookY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Hook detail
    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.hookX, this.hookY + 5, 6, 0, Math.PI);
    ctx.stroke();
  }

  _drawIdleState() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Draw sky
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, w, 60);

    // Draw water
    const waterGradient = ctx.createLinearGradient(0, 60, 0, h);
    waterGradient.addColorStop(0, '#1E90FF');
    waterGradient.addColorStop(0.5, '#0066CC');
    waterGradient.addColorStop(1, '#003366');
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, 60, w, h - 60);

    // Draw title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SQRRR GLUGLU', w / 2, h / 2 - 40);

    // Draw sample fish
    ctx.font = '40px Arial';
    ctx.fillText('\u{1F41F}', w / 2 - 60, h / 2 + 40);
    ctx.fillText('\u{1F420}', w / 2, h / 2 + 40);
    ctx.fillText('\u{1F421}', w / 2 + 60, h / 2 + 40);
  }

  _updateCoinsDisplay() {
    // Update the external coins display in the fishing screen header
    const coinsEl = document.getElementById('fishing-coins');
    if (coinsEl) {
      coinsEl.textContent = `${this.coins} $qr`;
    }
  }

  _updatePlayButton() {
    if (!this.playBtn) return;

    switch (this.gameState) {
      case 'idle':
        this.playBtn.textContent = 'PESCAR - 100 $qr';
        this.playBtn.disabled = false;
        this.playBtn.style.display = 'block';
        this.playBtn.style.fontSize = '';
        break;
      case 'loading':
        this.playBtn.textContent = 'Cargando...';
        this.playBtn.disabled = true;
        this.playBtn.style.display = 'block';
        break;
      case 'ready':
        this.playBtn.textContent = 'Pulsa o mantiene';
        this.playBtn.disabled = true;
        this.playBtn.style.display = 'block';
        this.playBtn.style.fontSize = '14px';
        break;
      case 'dropping':
      case 'result':
        this.playBtn.style.display = 'none';
        break;
    }
  }

  _showMessage(text, type = 'info') {
    if (!this.messageEl) return;

    this.messageEl.textContent = text;
    this.messageEl.className = 'fishing-message ' + type;
    this.messageEl.style.display = 'block';

    // Hide after 3 seconds
    setTimeout(() => {
      this.messageEl.style.display = 'none';
    }, 3000);
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
}
