/**
 * Gamba Menu UI Module
 *
 * Game selection menu for gambling games.
 * Opens when "SQRRR Gamba" is clicked.
 */

class GambaMenu {
  constructor() {
    this.modal = null;
    this.socket = null;
    this._initialized = false;
    this._handlersSetup = false;
    this.onSlotsClick = null;
    this.onStackingClick = null;
  }

  /**
   * Initialize the gamba menu
   * @param {Object} options - Configuration options
   * @param {Object} options.socket - Socket.IO instance
   * @param {Function} options.onSlotsClick - Callback when slots is selected
   * @param {Function} options.onStackingClick - Callback when stacking is selected
   */
  init(options = {}) {
    if (this._initialized) return;

    this.socket = options.socket;
    this.onSlotsClick = options.onSlotsClick;
    this.onStackingClick = options.onStackingClick;
    this._initialized = true;
  }

  /**
   * Open the gamba menu modal
   */
  open() {
    this.modal = document.getElementById('gamba-menu-modal');
    if (!this.modal) return;

    // Setup button handlers ONLY ONCE
    if (!this._handlersSetup) {
      this._handlersSetup = true;

      const closeBtn = document.getElementById('gamba-menu-close');
      const slotsBtn = document.getElementById('gamba-slots-btn');
      const stackingBtn = document.getElementById('gamba-stacking-btn');

      closeBtn?.addEventListener('click', () => this.close());

      slotsBtn?.addEventListener('click', () => {
        this.close();
        if (this.onSlotsClick) this.onSlotsClick();
      });

      stackingBtn?.addEventListener('click', () => {
        this.close();
        if (this.onStackingClick) this.onStackingClick();
      });

      // Close on backdrop click
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });
    }

    this.modal.classList.add('active');
  }

  /**
   * Close the gamba menu modal
   */
  close() {
    this.modal?.classList.remove('active');
  }
}

// Singleton instance
export const gambaMenu = new GambaMenu();
export default gambaMenu;
