class GambaMenu {
  constructor() {
    this.modal = null;
    this.socket = null;
    this._initialized = false;
    this._handlersSetup = false;
    this.onSlotsClick = null;
    this.onStackingClick = null;
  }

  init(options = {}) {
    if (this._initialized) return;

    this.socket = options.socket;
    this.onSlotsClick = options.onSlotsClick;
    this.onStackingClick = options.onStackingClick;
    this._initialized = true;
  }

  open() {
    this.modal = document.getElementById('gamba-menu-modal');
    if (!this.modal) return;

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

export const gambaMenu = new GambaMenu();
export default gambaMenu;
