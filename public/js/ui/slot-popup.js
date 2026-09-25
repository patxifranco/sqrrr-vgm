import { SlotMachine } from '../games/slots/slot-machine.js';
import { BlockStackingGame } from '../games/stacking/block-stacking.js';
import { leaderboardUI } from './leaderboard.js';
import { cardAlbumUI } from './card-album.js';
import { shopUI } from './shop.js';
import { makeDraggable } from './drag.js';

const FACTO_QUOTES = [
  'Facto: Al apostar puedes ganar hasta 2000% y solo perder el 100%',
  'Facto: el 90% de los jugadores deja de apostar justo antes de ganar',
  'No hay facto pero imagina el meme de picando diamante'
];

export class SlotPopup {
  constructor(socket) {
    this.socket = socket;
    this.isOpen = false;
    this.isFocused = false;
    this.slotMachine = null;
    this.stackingGame = null;
    this.popup = null;
    this.factoIndex = 0;
    this.currentGame = null;
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  open() {
    if (this.isOpen) return;

    this.popup = document.createElement('div');
    this.popup.className = 'slot-popup-window window';

    document.body.appendChild(this.popup);

    this.popup.style.position = 'fixed';
    this.popup.style.top = '50%';
    this.popup.style.left = '50%';
    this.popup.style.transform = 'translate(-50%, -50%)';
    this.popup.style.zIndex = '10000';

    cardAlbumUI.init(this.socket);
    shopUI.init(this.socket);

    this._showMenu();

    this.setupDrag();

    this.setupFocus();

    this.setFocused(true);

    this.isOpen = true;
  }

  _showMenu() {
    this.currentGame = 'menu';
    this._destroyCurrentGame();

    this.popup.innerHTML = `
      <div class="title-bar slot-popup-titlebar">
        <div class="title-bar-text">SQRRR Gamba</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize"></button>
          <button aria-label="Maximize"></button>
          <button aria-label="Close" class="slot-popup-x-close"></button>
        </div>
      </div>
      <div class="window-body gamba-menu-body">
        <div class="gamba-menu-content">
          <h2>Elige tu veneno</h2>
          <div class="gamba-menu-options">
            <button class="gamba-menu-option" data-game="slots">
              <span class="gamba-menu-icon">🎰</span>
              <span class="gamba-menu-label">Tragaperras</span>
            </button>
            <button class="gamba-menu-option" data-game="stacking">
              <span class="gamba-menu-icon">🧱</span>
              <span class="gamba-menu-label">Bloques</span>
            </button>
          </div>
        </div>
      </div>
    `;

    this.popup.querySelector('.slot-popup-x-close').addEventListener('click', () => this.close());

    this.popup.querySelectorAll('.gamba-menu-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const game = btn.dataset.game;
        if (game === 'slots') {
          this._showSlots();
        } else if (game === 'stacking') {
          this._showStacking();
        }
      });
    });
  }

  _showSlots() {
    this.currentGame = 'slots';

    this.popup.innerHTML = `
      <div class="title-bar slot-popup-titlebar">
        <div class="title-bar-text">SQRRR Gamba - Tragaperras</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize"></button>
          <button aria-label="Maximize"></button>
          <button aria-label="Close" class="slot-popup-x-close"></button>
        </div>
      </div>
      <div class="window-body">
        <div class="slots-header">
          <button class="slots-back-btn gamba-back-btn">Volver</button>
          <div class="slots-facto-container">
            <span class="slots-facto-text">Facto: Al apostar puedes ganar hasta 2000% y solo perder el 100%</span>
            <button class="slots-facto-arrow" title="Siguiente facto">▶</button>
          </div>
        </div>
        <div class="slot-popup-container slots-game-container">
          <!-- Slot machine will be rendered here -->
        </div>
      </div>
    `;

    const container = this.popup.querySelector('.slot-popup-container');
    this.slotMachine = new SlotMachine({
      container,
      socket: this.socket,
      onCoinsUpdate: (coins) => {},
      onLeaderboardClick: () => leaderboardUI.open('gamba'),
      onAlbumClick: () => shopUI.open()
    });

    this.popup.querySelector('.gamba-back-btn').addEventListener('click', () => this._showMenu());
    this.popup.querySelector('.slot-popup-x-close').addEventListener('click', () => this.close());

    const factoText = this.popup.querySelector('.slots-facto-text');
    const factoArrow = this.popup.querySelector('.slots-facto-arrow');
    if (factoText && factoArrow) {
      factoArrow.addEventListener('click', () => {
        this.factoIndex = (this.factoIndex + 1) % FACTO_QUOTES.length;
        factoText.textContent = FACTO_QUOTES[this.factoIndex];
      });
    }
  }

  _showStacking() {
    this.currentGame = 'stacking';

    this.popup.innerHTML = `
      <div class="title-bar slot-popup-titlebar">
        <div class="title-bar-text">SQRRR Gamba - Bloques</div>
        <div class="title-bar-controls">
          <button aria-label="Minimize"></button>
          <button aria-label="Maximize"></button>
          <button aria-label="Close" class="slot-popup-x-close"></button>
        </div>
      </div>
      <div class="window-body stacking-popup-body">
        <div class="stacking-header">
          <button class="stacking-back-btn gamba-back-btn">Volver</button>
          <span id="stacking-coins" class="stacking-coins">0 $qr</span>
        </div>
        <div class="stacking-game-container stacking-popup-container">
          <!-- Stacking game will be rendered here -->
        </div>
      </div>
    `;

    const container = this.popup.querySelector('.stacking-popup-container');
    this.stackingGame = new BlockStackingGame({
      container,
      socket: this.socket,
      onCoinsUpdate: (coins) => {}
    });
    this.stackingGame.init();

    this.popup.querySelector('.gamba-back-btn').addEventListener('click', () => {
      this._destroyCurrentGame();
      this._showMenu();
    });
    this.popup.querySelector('.slot-popup-x-close').addEventListener('click', () => this.close());
  }

  _destroyCurrentGame() {
    if (this.slotMachine) {
      this.slotMachine.destroy();
      this.slotMachine = null;
    }
    if (this.stackingGame) {
      this.stackingGame.destroy();
      this.stackingGame = null;
    }
  }

  close() {
    if (!this.isOpen) return;

    this._destroyCurrentGame();

    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }

    if (this._dragCleanup) {
      this._dragCleanup();
      this._dragCleanup = null;
    }

    if (this._focusCleanup) {
      this._focusCleanup();
      this._focusCleanup = null;
    }

    this.isOpen = false;
    this.isFocused = false;
    this.currentGame = null;
  }

  setFocused(focused) {
    this.isFocused = focused;
    if (this.popup) {
      if (focused) {
        this.popup.style.opacity = '1';
        this.popup.classList.add('focused');
      } else {
        this.popup.style.opacity = '0.7';
        this.popup.classList.remove('focused');
      }
    }
    if (this.slotMachine) {
      this.slotMachine.setKeyboardEnabled(focused);
    }
    if (this.stackingGame) {
      this.stackingGame.setKeyboardEnabled?.(focused);
    }
  }

  setupFocus() {
    const onPopupClick = (e) => {
      this.setFocused(true);
      e.stopPropagation();
    };

    const onDocumentClick = (e) => {
      if (this.popup && !this.popup.contains(e.target)) {
        this.setFocused(false);
      }
    };

    this.popup.addEventListener('mousedown', onPopupClick);
    document.addEventListener('mousedown', onDocumentClick);

    this._focusCleanup = () => {
      this.popup?.removeEventListener('mousedown', onPopupClick);
      document.removeEventListener('mousedown', onDocumentClick);
    };
  }

  setupDrag() {
    this._dragCleanup = makeDraggable(this.popup, '.slot-popup-titlebar');
  }

  destroy() {
    this.close();
  }
}

export function createSlotPopupButton(container, socket, options = {}) {
  const popup = new SlotPopup(socket);

  const button = document.createElement('button');
  button.className = 'slot-popup-btn';
  button.title = 'SQRRR Gamba';
  button.innerHTML = '\u{1F3B0}';
  button.addEventListener('click', () => popup.toggle());

  if (options.position !== 'left' && options.position !== 'right-no-margin') {
    button.style.marginLeft = 'auto';
  }

  container.appendChild(button);

  return popup;
}

export default SlotPopup;
