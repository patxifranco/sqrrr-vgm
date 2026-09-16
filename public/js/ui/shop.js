import { cardAlbumUI } from './card-album.js';
import { showPopup } from './popup.js';

class ShopUI {
  constructor() {
    this.modal = null;
    this.socket = null;
    this._initialized = false;
    this._handlersSetup = false;
  }

  init(socket) {
    if (this._initialized) return;
    this.socket = socket;
    this._initialized = true;
  }

  open() {
    this.modal = document.getElementById('shop-modal');
    if (!this.modal) return;

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
        showPopup('No tienes suficientes monedas');
      });

      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    this.modal.classList.add('active');
  }

  close() {
    this.modal?.classList.remove('active');
  }
}

export const shopUI = new ShopUI();
export default shopUI;
