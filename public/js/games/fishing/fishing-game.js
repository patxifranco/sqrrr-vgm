const GAME_COST = 100;
const HOOK_SPEED = 150;

export class FishingGame {
  constructor(options) {
    this.container = options.container;
    this.socket = options.socket;
    this.onCoinsUpdate = options.onCoinsUpdate || (() => {});

    this.gameState = 'idle';
    this.coins = 0;
    this.gameData = null;
    this.entities = [];

    this.hookX = 0;
    this.hookY = 0;
    this.hookDropping = false;

    this.mouseX = 200;
    this.mouseY = 30;

    this.isCharging = false;
    this.chargeStartTime = 0;
    this.chargeLevel = 0;
    this.descentSpeed = 1;

    this.caughtEntity = null;
    this.caughtPayout = 0;
    this.resultTimeout = null;

    this.animationFrame = null;
    this.lastTime = 0;

    this.canvas = null;
    this.ctx = null;
    this.playBtn = null;
    this.loanOverlay = null;

    this.images = {};
    this.imagesLoaded = false;

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

    this.socket.emit('fishingGetBalance');
  }

  destroy() {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
    }

    this.socket.off('fishingBalance');
    this.socket.off('fishingStarted');
    this.socket.off('fishingInsufficientFunds');
    this.socket.off('fishingResult');
    this.socket.off('fishingError');
    this.socket.off('slotsLoanReceived');

    if (this.canvas) {
      this.canvas.removeEventListener('click', this._handleCanvasClick);
      this.canvas.removeEventListener('mousemove', this._handleMouseMove);
      this.canvas.removeEventListener('mousedown', this._handleMouseDown);
      this.canvas.removeEventListener('mouseup', this._handleMouseUp);
      this.canvas.removeEventListener('touchstart', this._handleTouchStart);
      this.canvas.removeEventListener('touchmove', this._handleTouchMove);
      this.canvas.removeEventListener('touchend', this._handleTouchEnd);
    }

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
        this.caughtEntity = data.caught;
        this.caughtPayout = data.payout;
      } else {
        this.caughtEntity = null;
        this.caughtPayout = 0;
        this._showMessage(data.message || 'Nada atrapado', 'fail');
      }

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

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this.canvas && this.gameState === 'ready') {
        if (this.isCharging) {
          this._castRod();
        }
      }
    });
  }

  _handleMouseMove(e) {
    if (this.gameState !== 'ready') return;

    if (document.pointerLockElement === this.canvas) {
      this.mouseX += e.movementX;
      this.mouseX = Math.max(30, Math.min(this.canvas.width - 30, this.mouseX));
    } else {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      this.mouseX = (e.clientX - rect.left) * scaleX;
      this.mouseX = Math.max(30, Math.min(this.canvas.width - 30, this.mouseX));
    }
  }

  _handleMouseDown(e) {
    if (this.gameState !== 'ready') return;
    e.preventDefault();

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
    const chargeTime = (Date.now() - this.chargeStartTime) / 1000;
    this.descentSpeed = Math.min(3, 1 + chargeTime);
    this.isCharging = false;
    this.chargeLevel = 0;

    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }

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
    if (this.gameState === 'result' && this.caughtEntity) {
      this._dismissResult();
      return;
    }

    if (this.gameState !== 'ready') return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const scaleX = this.canvas.width / rect.width;

    this.hookX = x * scaleX;
    this.hookY = 60;
    this.hookDropping = true;
    this.gameState = 'dropping';

    this.playBtn.style.display = 'none';
  }

  _dismissResult() {
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

    this.mouseX = this.canvas.width / 2;

    this.canvas.requestPointerLock();

    this.canvas.style.cursor = 'none';

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
    for (const entity of this.entities) {
      if (entity.speed > 0) {
        entity.x += entity.speed * entity.direction * dt;

        if (entity.x <= 30) {
          entity.x = 30;
          entity.direction = 1;
        } else if (entity.x >= this.canvas.width - 30) {
          entity.x = this.canvas.width - 30;
          entity.direction = -1;
        }
      }
    }

    if (this.isCharging) {
      const chargeTime = (Date.now() - this.chargeStartTime) / 1000;
      this.chargeLevel = Math.min(1, chargeTime / 2);
    }

    if (this.hookDropping) {
      this.hookY += HOOK_SPEED * this.descentSpeed * dt;

      for (let i = 0; i < this.entities.length; i++) {
        const entity = this.entities[i];
        const dist = Math.hypot(this.hookX - entity.x, this.hookY - entity.y);

        if (dist < entity.size / 2 + 8) {
          this.hookDropping = false;
          this.gameState = 'result';

          this.socket.emit('fishingCatch', {
            entityIndex: i,
            hookX: this.hookX,
            hookY: this.hookY,
            timestamp: Date.now()
          });

          return;
        }
      }

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

    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, w, 60);

    const waterGradient = ctx.createLinearGradient(0, 60, 0, h);
    waterGradient.addColorStop(0, '#1E90FF');
    waterGradient.addColorStop(0.5, '#0066CC');
    waterGradient.addColorStop(1, '#003366');
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, 60, w, h - 60);

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

    for (const entity of this.entities) {
      if (entity.type === 'fish') {
        this._drawFish(entity);
      } else {
        this._drawObstacle(entity);
      }
    }

    if (this.gameState === 'dropping' || this.gameState === 'result') {
      this._drawHook();
    }

    if (this.gameState === 'ready') {
      this._drawRodCursor();
    }

    if (this.gameState === 'result' && this.caughtEntity) {
      this._drawCaughtFish();
    }
  }

  _drawCaughtFish() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const entity = this.caughtEntity;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 60, w, h - 60);

    const bigSize = 120;
    const img = this.images[entity.image];

    if (img && img.complete) {
      ctx.drawImage(img, w / 2 - bigSize / 2, h / 2 - bigSize / 2 - 20, bigSize, bigSize);
    }

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${this.caughtPayout} $qr`, w / 2, h / 2 + bigSize / 2 + 10);
  }

  _drawRodCursor() {
    const ctx = this.ctx;
    const x = this.mouseX;

    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 50);
    ctx.stroke();

    ctx.strokeStyle = '#5D3A1A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 45);
    ctx.lineTo(x, 55);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 50);
    ctx.lineTo(x, 75);
    ctx.stroke();

    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.arc(x, 75, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#808080';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, 78, 4, 0, Math.PI);
    ctx.stroke();

    if (this.isCharging || this.chargeLevel > 0) {
      const barX = x + 15;
      const barY = 10;
      const barWidth = 8;
      const barHeight = 50;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

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
      const size = entity.size;
      ctx.save();
      ctx.translate(entity.x, entity.y);

      if (entity.direction < 0) {
        ctx.scale(-1, 1);
      }

      ctx.drawImage(img, -size / 2, -size / 2, size, size);
      ctx.restore();
    } else {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(entity.x, entity.y, entity.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${entity.coins}`, entity.x, entity.y + entity.size / 2 + 15);
  }

  _drawObstacle(entity) {
    const ctx = this.ctx;

    ctx.font = `${entity.size}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(entity.emoji, entity.x, entity.y);
  }

  _drawHook() {
    const ctx = this.ctx;

    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.hookX, 60);
    ctx.lineTo(this.hookX, this.hookY);
    ctx.stroke();

    ctx.fillStyle = '#C0C0C0';
    ctx.beginPath();
    ctx.arc(this.hookX, this.hookY, 8, 0, Math.PI * 2);
    ctx.fill();

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

    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, 0, w, 60);

    const waterGradient = ctx.createLinearGradient(0, 60, 0, h);
    waterGradient.addColorStop(0, '#1E90FF');
    waterGradient.addColorStop(0.5, '#0066CC');
    waterGradient.addColorStop(1, '#003366');
    ctx.fillStyle = waterGradient;
    ctx.fillRect(0, 60, w, h - 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SQRRR GLUGLU', w / 2, h / 2 - 40);

    ctx.font = '40px Arial';
    ctx.fillText('\u{1F41F}', w / 2 - 60, h / 2 + 40);
    ctx.fillText('\u{1F420}', w / 2, h / 2 + 40);
    ctx.fillText('\u{1F421}', w / 2 + 60, h / 2 + 40);
  }

  _updateCoinsDisplay() {
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
