/**
 * Card Album UI Module
 *
 * Handles:
 * - Album modal display
 * - Card grid rendering
 * - Pack opening animation
 * - Card inspection
 */

import { initCard3D, destroyCard3D } from './card-3d.js';
import { showPopup } from './popup.js';

// Cards with holographic effects
const HOLO_CARDS = [2, 3, 6, 8, 14, 19, 23, 26, 29, 41, 42, 45, 46, 47, 48, 49];

// Card data - extracted from filenames
const CARD_DATA = [
  { id: 1, name: 'Imanol' },
  { id: 2, name: 'Imanol' },
  { id: 3, name: 'El Ima y el puto Xokas' },
  { id: 4, name: 'Imanol beber' },
  { id: 5, name: 'Foto graciosa de Jackie Chan' },
  { id: 6, name: 'Genicio calvo Genicio calvo' },
  { id: 7, name: 'Gus' },
  { id: 8, name: 'Gus morsa' },
  { id: 9, name: 'Víctor' },
  { id: 10, name: 'Pls porn' },
  { id: 11, name: 'Malas' },
  { id: 12, name: 'Este puto gif de Homer' },
  { id: 13, name: 'Hamachi' },
  { id: 14, name: 'Lo coge o lo deja' },
  { id: 15, name: 'Esta puta salvada del Kinus' },
  { id: 16, name: 'Ezra botón' },
  { id: 17, name: 'Anfitrión' },
  { id: 18, name: 'Chocu raid' },
  { id: 19, name: 'Aitor' },
  { id: 20, name: 'Aitor DS' },
  { id: 21, name: 'Crío de Imanol' },
  { id: 22, name: 'Boff foto durísima solo-chicos' },
  { id: 23, name: 'El Víctor y Markel' },
  { id: 24, name: 'Welinton quiw' },
  { id: 25, name: 'Primo Lucas' },
  { id: 26, name: 'Kinus' },
  { id: 27, name: 'Sale Rust' },
  { id: 28, name: 'Navarra' },
  { id: 29, name: 'Ioseba bombardero' },
  { id: 30, name: 'Broly culo' },
  { id: 31, name: 'El Reason y el Kinus' },
  { id: 32, name: 'What a fucking N' },
  { id: 33, name: 'Kirbote' },
  { id: 34, name: 'Kim Jong Un Navarra' },
  { id: 35, name: 'Garsi impostor' },
  { id: 36, name: 'Víctor matajudíos' },
  { id: 37, name: 'Aitor roscón' },
  { id: 38, name: 'Una polla como' },
  { id: 39, name: 'Gente' },
  { id: 40, name: 'Pedro Sánchez' },
  { id: 41, name: 'Layson' },
  { id: 42, name: 'Minmin' },
  { id: 43, name: 'Días sin que Min pida algo' },
  { id: 44, name: 'Kinus musulmán' },
  { id: 45, name: 'Ioseba' },
  { id: 46, name: 'Kelmi' },
  { id: 47, name: 'Jesús' },
  { id: 48, name: 'Guille' },
  { id: 49, name: 'Cilveti' }
];

// Map card ID to filename
const CARD_FILES = {
  1: '1_Imanol.png',
  2: '2_Imanol.png',
  3: '3_El_Ima_y_el_puto_Xokas.png',
  4: '4_Imanol_beber.png',
  5: '5_Foto_graciosa_de_jackie_chan.png',
  6: '6_Genicio_calvo_Genicio_calvo.png',
  7: '7_gus.png',
  8: '8_gus_morsa.png',
  9: '9_victor.png',
  10: '10_pls_porn.png',
  11: '11_malas.png',
  12: '12_este_puto_gif_de_homer.png',
  13: '13_hamachi.png',
  14: '14_lo_coje_o_lo_deja.png',
  15: '15_esta_puta_salvada_del_kinus.png',
  16: '16_ezra_boton.png',
  17: '17_anfitrion.png',
  18: '18_chocu_raid.png',
  19: '19_aitor.png',
  20: '20_aitor_ds.png',
  21: '21_crio_de_imanol.png',
  22: '22_boff_foto_durisima_solo-chicos.png',
  23: '23_el_victor_y_markel.png',
  24: '24_welinton_quiw.png',
  25: '25_primo_lucas.png',
  26: '26_kinus.png',
  27: '27_sale_rust.png',
  28: '28_navarra.png',
  29: '29_ioseba_bombardero.png',
  30: '30_broly_culo.png',
  31: '31_el_reason_y_el_kinus.png',
  32: '32_what_a_fucking_n.png',
  33: '33_kirbote.png',
  34: '34_kim_jong_un_navarra.png',
  35: '35_garsi_impostor.png',
  36: '36_victor_matajudios.png',
  37: '37_aitor_roscon.png',
  38: '38_una_polla_como.png',
  39: '39_gente.png',
  40: '40_pedro_sanchez.png',
  41: '41_layson.png',
  42: '42_minmin.png',
  43: '43_dias_sin_que_min_pida_algo.png',
  44: '44_kinus_musulman.png',
  45: '45_ioseba.png',
  46: '46_kelmi.png',
  47: '47_jesus.png',
  48: '48_guille.png',
  49: '49_cilveti.png'
};

class CardAlbumUI {
  constructor() {
    this.modal = null;
    this.inspectModal = null;
    this.packOverlay = null;
    this.grid = null;
    this.countDisplay = null;
    this.coinsDisplay = null;
    this.buyBtn = null;
    this.freeBtn = null;

    this.socket = null;
    this.cards = {};
    this.coins = 0;
    this.freeCardCooldown = 0;
    this.totalCards = 49;

    this._cooldownInterval = null;
    this._initialized = false;
    this._handlersSetup = false;
    this._claimingFree = false;  // Prevent double-clicks
    this._claimingTimeout = null;  // Timeout to reset _claimingFree on network failure
  }

  /**
   * Initialize the album UI
   * @param {Object} socket - Socket.IO instance
   */
  init(socket) {
    if (this._initialized) return;

    this.socket = socket;
    this._setupSocketListeners();
    this._initialized = true;
  }

  /**
   * Setup socket event listeners
   */
  _setupSocketListeners() {
    // Collection data received
    this.socket.on('cardsCollection', (data) => {
      this.cards = data.cards || {};
      this.coins = data.coins || 0;
      this.freeCardCooldown = data.freeCardCooldown || 0;
      this.totalCards = data.totalCards || 49;
      this._updateDisplay();
    });

    // Pack purchased successfully
    this.socket.on('cardsPackOpened', (data) => {
      this.cards[data.cardId] = data.count;
      this.coins = data.coins;
      this._showPackOpening(data.cardId, data.isNew, data.count);
      this._updateDisplay();
    });

    // Free card claimed successfully
    this.socket.on('cardsFreeOpened', (data) => {
      this._clearClaimingTimeout();
      this._claimingFree = false;
      this.cards[data.cardId] = data.count;
      this.freeCardCooldown = data.freeCardCooldown;
      this._showPackOpening(data.cardId, data.isNew, data.count);
      this._updateDisplay();
      this._startCooldownTimer();
    });

    // Not enough coins
    this.socket.on('cardsInsufficientFunds', () => {
      showPopup('No tienes suficientes monedas');
    });

    // Free card on cooldown
    this.socket.on('cardsFreeNotReady', (data) => {
      this._clearClaimingTimeout();
      this._claimingFree = false;
      this.freeCardCooldown = data.cooldown;
      this._updateFreeButton();
      this._startCooldownTimer();
    });

    // Error
    this.socket.on('cardsError', (data) => {
      this._clearClaimingTimeout();
      this._claimingFree = false;
      console.error('Cards error:', data.message);
    });
  }

  /**
   * Open the album modal
   */
  open() {
    this.modal = document.getElementById('card-album-modal');
    this.inspectModal = document.getElementById('card-inspect-modal');
    this.grid = document.getElementById('card-album-grid');
    this.countDisplay = document.getElementById('card-album-count');
    this.coinsDisplay = document.getElementById('card-album-coins');
    this.buyBtn = document.getElementById('card-buy-pack-btn');
    this.freeBtn = document.getElementById('card-free-btn');

    if (!this.modal) return;

    // Disable free button until we get server response (prevents race condition)
    if (this.freeBtn) {
      this.freeBtn.disabled = true;
    }

    // Request fresh data
    this.socket.emit('cardsGetCollection');

    // Setup button handlers ONLY ONCE
    if (!this._handlersSetup) {
      this._handlersSetup = true;

      this.buyBtn?.addEventListener('click', () => this._buyPack());
      this.freeBtn?.addEventListener('click', () => this._claimFree());

      // Back button
      document.getElementById('card-album-back-btn')?.addEventListener('click', () => this.close());

      // Close handlers
      document.getElementById('card-album-close')?.addEventListener('click', () => this.close());
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });

      // Event delegation for grid card clicks (prevents listener accumulation)
      this.grid?.addEventListener('click', (e) => {
        const slot = e.target.closest('.card-slot:not(.empty)');
        if (slot) {
          const cardId = parseInt(slot.dataset.cardId);
          const cardName = slot.dataset.cardName;
          this._openInspect(cardId, cardName);
        }
      });
    }

    this.modal.classList.add('active');
    this._startCooldownTimer();
  }

  /**
   * Close the album modal
   */
  close() {
    // Also close inspect modal to cleanup keyboard handlers
    this._closeInspect();
    this.modal?.classList.remove('active');
    this._stopCooldownTimer();
  }

  /**
   * Update the entire display
   */
  _updateDisplay() {
    this._renderGrid();
    this._updateCount();
    this._updateCoins();
    this._updateFreeButton();
  }

  /**
   * Render the card grid
   */
  _renderGrid() {
    if (!this.grid) return;

    this.grid.innerHTML = CARD_DATA.map(card => {
      const count = this.cards[card.id] || 0;
      const owned = count > 0;
      const file = CARD_FILES[card.id];

      if (owned) {
        return `
          <div class="card-slot" data-card-id="${card.id}" data-card-name="${card.name}">
            <img src="cartas/${file}" alt="${card.name}" loading="lazy">
            <span class="card-number">#${card.id}</span>
            ${count > 1 ? `<span class="card-count-badge">x${count}</span>` : ''}
          </div>
        `;
      } else {
        return `
          <div class="card-slot empty" data-card-id="${card.id}">
            <span class="card-number">#${card.id}</span>
          </div>
        `;
      }
    }).join('');
    // Click handlers use event delegation (setup in open())
  }

  /**
   * Update card count display
   */
  _updateCount() {
    if (!this.countDisplay) return;
    const uniqueCount = Object.keys(this.cards).length;
    this.countDisplay.textContent = `${uniqueCount}/${this.totalCards} cartas`;
  }

  /**
   * Update coins display
   */
  _updateCoins() {
    if (!this.coinsDisplay) return;
    this.coinsDisplay.textContent = `${this.coins} $qr`;
  }

  /**
   * Update free button state
   */
  _updateFreeButton() {
    if (!this.freeBtn) return;

    if (this.freeCardCooldown > 0) {
      this.freeBtn.classList.add('on-cooldown');
      this.freeBtn.disabled = true;
      this._updateCooldownText();
    } else {
      this.freeBtn.classList.remove('on-cooldown');
      this.freeBtn.disabled = false;
      this.freeBtn.innerHTML = 'Carta Gratis';
    }
  }

  /**
   * Update cooldown text
   */
  _updateCooldownText() {
    if (!this.freeBtn || this.freeCardCooldown <= 0) return;

    const hours = Math.floor(this.freeCardCooldown / (1000 * 60 * 60));
    const minutes = Math.floor((this.freeCardCooldown % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((this.freeCardCooldown % (1000 * 60)) / 1000);

    let timeStr;
    if (hours > 0) {
      timeStr = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      timeStr = `${minutes}m ${seconds}s`;
    } else {
      timeStr = `${seconds}s`;
    }

    this.freeBtn.innerHTML = `Carta Gratis<span class="card-free-cooldown">${timeStr}</span>`;
  }

  /**
   * Start cooldown timer
   */
  _startCooldownTimer() {
    this._stopCooldownTimer();

    if (this.freeCardCooldown <= 0) return;

    this._cooldownInterval = setInterval(() => {
      this.freeCardCooldown -= 1000;
      if (this.freeCardCooldown <= 0) {
        this.freeCardCooldown = 0;
        this._updateFreeButton();
        this._stopCooldownTimer();
      } else {
        this._updateCooldownText();
      }
    }, 1000);
  }

  /**
   * Stop cooldown timer
   */
  _stopCooldownTimer() {
    if (this._cooldownInterval) {
      clearInterval(this._cooldownInterval);
      this._cooldownInterval = null;
    }
  }

  /**
   * Buy a card pack
   */
  _buyPack() {
    this.socket.emit('cardsBuyPack');
  }

  /**
   * Claim free card
   */
  _claimFree() {
    // Prevent if on cooldown or already processing
    if (this.freeCardCooldown > 0 || this._claimingFree) return;
    this._claimingFree = true;

    // Timeout to reset flag if server doesn't respond (network failure)
    this._claimingTimeout = setTimeout(() => {
      this._claimingFree = false;
      this._claimingTimeout = null;
    }, 10000);

    this.socket.emit('cardsClaimFree');
  }

  /**
   * Clear claiming timeout (called when server responds)
   */
  _clearClaimingTimeout() {
    if (this._claimingTimeout) {
      clearTimeout(this._claimingTimeout);
      this._claimingTimeout = null;
    }
  }

  /**
   * Get sorted list of owned card IDs
   */
  _getOwnedCardIds() {
    return Object.keys(this.cards)
      .map(id => parseInt(id))
      .sort((a, b) => a - b);
  }

  /**
   * Open card inspect modal
   */
  _openInspect(cardId, cardName) {
    if (!this.inspectModal) return;

    // Cleanup any existing handlers first (prevents accumulation)
    if (this._inspectKeyHandler) {
      document.removeEventListener('keydown', this._inspectKeyHandler);
    }
    if (this._inspectBackdropHandler) {
      this.inspectModal.removeEventListener('click', this._inspectBackdropHandler);
    }

    this._currentInspectId = cardId;
    this._renderInspectCard(cardId);

    this.inspectModal.classList.add('active');

    // Keyboard navigation
    this._inspectKeyHandler = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this._navigateCard(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this._navigateCard(1);
      } else if (e.key === 'Escape') {
        this._closeInspect();
      }
    };
    document.addEventListener('keydown', this._inspectKeyHandler);

    // Close on backdrop click
    this._inspectBackdropHandler = (e) => {
      if (e.target === this.inspectModal) {
        this._closeInspect();
      }
    };
    this.inspectModal.addEventListener('click', this._inspectBackdropHandler);
  }

  /**
   * Render the inspect card content
   */
  _renderInspectCard(cardId) {
    const file = CARD_FILES[cardId];
    const card = CARD_DATA.find(c => c.id === cardId);
    const cardName = card?.name || '';
    const container = this.inspectModal.querySelector('.card-inspect-container');

    if (!container) return;

    // Destroy previous 3D effect
    const oldCard = container.querySelector('#card-inspect-3d');
    if (oldCard) {
      destroyCard3D(oldCard);
    }

    const isHolo = HOLO_CARDS.includes(cardId);
    const holoClasses = isHolo ? 'card-holo card-shine' : '';

    // Check if prev/next cards exist
    const ownedIds = this._getOwnedCardIds();
    const currentIndex = ownedIds.indexOf(cardId);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < ownedIds.length - 1;

    container.innerHTML = `
      <button class="card-inspect-close">&times;</button>
      <div class="card-3d ${holoClasses}" id="card-inspect-3d">
        <img src="cartas/${file}" alt="${cardName}">
        ${isHolo ? '<div class="card-shine-overlay"></div>' : ''}
      </div>
      <div class="card-inspect-nav">
        <button class="card-inspect-nav-btn prev" id="card-nav-prev" ${!hasPrev ? 'disabled' : ''}>&#x25C0;</button>
        <button class="card-inspect-nav-btn next" id="card-nav-next" ${!hasNext ? 'disabled' : ''}>&#x25B6;</button>
      </div>
    `;

    // Initialize 3D effect
    const card3d = container.querySelector('#card-inspect-3d');
    if (card3d) {
      initCard3D(card3d, { animate: true });
    }

    // Close button
    container.querySelector('.card-inspect-close')?.addEventListener('click', () => {
      this._closeInspect();
    });

    // Navigation buttons
    container.querySelector('#card-nav-prev')?.addEventListener('click', () => {
      this._navigateCard(-1);
    });
    container.querySelector('#card-nav-next')?.addEventListener('click', () => {
      this._navigateCard(1);
    });
  }

  /**
   * Navigate to previous or next card
   */
  _navigateCard(direction) {
    const ownedIds = this._getOwnedCardIds();
    const currentIndex = ownedIds.indexOf(this._currentInspectId);
    const newIndex = currentIndex + direction;

    if (newIndex >= 0 && newIndex < ownedIds.length) {
      this._currentInspectId = ownedIds[newIndex];
      this._renderInspectCard(this._currentInspectId);
    }
  }

  /**
   * Close card inspect modal
   */
  _closeInspect() {
    if (!this.inspectModal) return;

    const card3d = this.inspectModal.querySelector('#card-inspect-3d');
    if (card3d) {
      destroyCard3D(card3d);
    }

    // Remove event listeners
    if (this._inspectKeyHandler) {
      document.removeEventListener('keydown', this._inspectKeyHandler);
      this._inspectKeyHandler = null;
    }
    if (this._inspectBackdropHandler) {
      this.inspectModal.removeEventListener('click', this._inspectBackdropHandler);
      this._inspectBackdropHandler = null;
    }

    this._currentInspectId = null;
    this.inspectModal.classList.remove('active');
  }

  /**
   * Show pack opening animation with rip effect
   */
  _showPackOpening(cardId, isNew, count) {
    // Create overlay if it doesn't exist
    let overlay = document.querySelector('.pack-opening-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'pack-opening-overlay';
      document.body.appendChild(overlay);
    }

    const card = CARD_DATA.find(c => c.id === cardId);
    const file = CARD_FILES[cardId];
    const isHolo = HOLO_CARDS.includes(cardId);

    const holoClasses = isHolo ? 'card-holo card-shine' : '';

    overlay.innerHTML = `
      <div class="pack-container">
        <!-- The card inside (with 3D effect) -->
        <div class="pack-card-inside card-3d ${holoClasses}" id="pack-card-3d">
          ${isNew ? '<div class="pack-card-new">NUEVA</div>' : ''}
          <img src="cartas/${file}" alt="${card?.name || 'Card'}">
          ${isHolo ? '<div class="card-shine-overlay"></div>' : ''}
        </div>

        <!-- Pack wrapper that rips open -->
        <div class="pack-wrapper">
          <div class="pack-wrapper-top pack-wrapper-holo">
            <img src="cartas/0_backofcard.png" alt="Pack">
          </div>
          <div class="pack-wrapper-bottom pack-wrapper-holo">
            <img src="cartas/0_backofcard.png" alt="Pack">
          </div>
          <div class="pack-tear-edge"></div>
        </div>

        <div class="pack-click-hint">Click para abrir</div>
      </div>
      <button class="pack-close-btn">Continuar</button>
    `;

    overlay.classList.add('active');

    const packContainer = overlay.querySelector('.pack-container');
    const closeBtn = overlay.querySelector('.pack-close-btn');
    const card3d = overlay.querySelector('#pack-card-3d');

    // Click to open pack
    const openPack = () => {
      if (packContainer.classList.contains('opened')) return;
      packContainer.classList.add('opened');

      // Initialize 3D effect on card after pack opens (wait for animation to complete)
      setTimeout(() => {
        if (card3d) {
          initCard3D(card3d);
        }
      }, 650);
    };

    packContainer.addEventListener('click', openPack);

    // Close and cleanup
    const closeOverlay = () => {
      // Cleanup 3D effect
      if (card3d) {
        destroyCard3D(card3d);
      }
      overlay.classList.remove('active');
      // Remove overlay completely to prevent listener accumulation
      setTimeout(() => {
        overlay.remove();
      }, 300);
    };

    // Close button
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeOverlay();
    });

    // Close on backdrop click (only after opened)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && packContainer.classList.contains('opened')) {
        closeOverlay();
      }
    });
  }
}

// Singleton instance
export const cardAlbumUI = new CardAlbumUI();
export { CARD_DATA, CARD_FILES };
