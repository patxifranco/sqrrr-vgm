/**
 * Shop UI Module
 *
 * Simple shop modal with access to:
 * - SQRRR Cartas (card album)
 * - Discord channel purchase
 */

import { cardAlbumUI } from './card-album.js';
import { showPopup } from './popup.js';

class ShopUI {
  constructor() {
    this.modal = null;
    this.socket = null;
    this._initialized = false;
    this._handlersSetup = false;
  }

  /**
   * Initialize the shop UI
   * @param {Object} socket - Socket.IO instance
   */
  init(socket) {
    if (this._initialized) return;
    this.socket = socket;
    this._initialized = true;
  }

  /**
   * Open the shop modal
   */
  open() {
    this.modal = document.getElementById('shop-modal');
    if (!this.modal) return;

    // Setup button handlers ONLY ONCE
    if (!this._handlersSetup) {
      this._handlersSetup = true;

      const closeBtn = document.getElementById('shop-close');
      const cardsBtn = document.getElementById('shop-cards-btn');
      const discordBtn = document.getElementById('shop-discord-btn');

      closeBtn?.addEventListener('click', () => this.close());

      cardsBtn?.addEventListener('click', () => {
        this.close();
        cardAlbumUI.open();
      });

      discordBtn?.addEventListener('click', () => {
        // TODO: Implement discord channel purchase
        showPopup('No tienes suficientes monedas');
      });

      // Close on backdrop click
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    this.modal.classList.add('active');
  }

  /**
   * Close the shop modal
   */
  close() {
    this.modal?.classList.remove('active');
  }
}

// Singleton instance
export const shopUI = new ShopUI();
export default shopUI;
