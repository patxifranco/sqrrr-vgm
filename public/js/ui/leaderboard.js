import { escapeHtml } from '../core/index.js';

class LeaderboardUI {
  constructor() {
    this.modal = null;
    this.closeBtn = null;
    this.tabVgm = null;
    this.tabTyping = null;
    this.tabGamba = null;
    this.tabSqrrrdle = null;
    this.contentVgm = null;
    this.contentTyping = null;
    this.contentGamba = null;
    this.contentSqrrrdle = null;
    this.listVgmGuesses = null;
    this.listVgmRecords = null;
    this.listTypingWpm = null;
    this.listGambaCoins = null;
    this.listGambaDebt = null;
    this.listSqrrrdle = null;

    this.emit = null;

    this._initialized = false;
  }

  init({ emit }) {
    if (this._initialized) return;

    this.emit = emit;

    this.modal = document.getElementById('leaderboard-modal');
    this.closeBtn = document.getElementById('leaderboard-close');
    this.tabVgm = document.getElementById('leaderboard-tab-vgm');
    this.tabTyping = document.getElementById('leaderboard-tab-typing');
    this.tabGamba = document.getElementById('leaderboard-tab-gamba');
    this.tabSqrrrdle = document.getElementById('leaderboard-tab-sqrrrdle');
    this.contentVgm = document.getElementById('leaderboard-vgm');
    this.contentTyping = document.getElementById('leaderboard-typing');
    this.contentGamba = document.getElementById('leaderboard-gamba');
    this.contentSqrrrdle = document.getElementById('leaderboard-sqrrrdle');
    this.listVgmGuesses = document.getElementById('leaderboard-vgm-guesses');
    this.listVgmRecords = document.getElementById('leaderboard-vgm-records');
    this.listTypingWpm = document.getElementById('leaderboard-typing-wpm');
    this.listGambaCoins = document.getElementById('leaderboard-gamba-coins');
    this.listGambaDebt = document.getElementById('leaderboard-gamba-debt');
    this.listSqrrrdle = document.getElementById('leaderboard-sqrrrdle-words');

    this._setupEventListeners();
    this._initialized = true;
  }

  _setupEventListeners() {
    this.tabVgm?.addEventListener('click', () => this._switchTab('vgm'));
    this.tabTyping?.addEventListener('click', () => this._switchTab('typing'));
    this.tabGamba?.addEventListener('click', () => this._switchTab('gamba'));
    this.tabSqrrrdle?.addEventListener('click', () => this._switchTab('sqrrrdle'));

    this.closeBtn?.addEventListener('click', () => this.close());

    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }

  _switchTab(tab) {
    this.tabVgm?.classList.remove('active');
    this.tabTyping?.classList.remove('active');
    this.tabGamba?.classList.remove('active');
    this.tabSqrrrdle?.classList.remove('active');
    this.contentVgm?.classList.remove('active');
    this.contentTyping?.classList.remove('active');
    this.contentGamba?.classList.remove('active');
    this.contentSqrrrdle?.classList.remove('active');

    if (tab === 'typing') {
      this.tabTyping?.classList.add('active');
      this.contentTyping?.classList.add('active');
    } else if (tab === 'gamba') {
      this.tabGamba?.classList.add('active');
      this.contentGamba?.classList.add('active');
    } else if (tab === 'sqrrrdle') {
      this.tabSqrrrdle?.classList.add('active');
      this.contentSqrrrdle?.classList.add('active');
    } else {
      this.tabVgm?.classList.add('active');
      this.contentVgm?.classList.add('active');
    }
  }

  open(tab = 'vgm') {
    if (!this.modal) return;

    this.modal.classList.add('active');
    this._switchTab(tab);

    if (this.emit) {
      this.emit('getLeaderboards');
    }
  }

  close() {
    this.modal?.classList.remove('active');
  }

  renderList(container, data) {
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="leaderboard-empty">No hay datos todavía</div>';
      return;
    }

    container.innerHTML = data.map((item, index) => {
      const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

      return `
        <div class="leaderboard-item">
          <span class="leaderboard-rank ${rankClass}">#${index + 1}</span>
          <img class="leaderboard-avatar" src="${item.profilePicture || 'profiles/default.svg'}" alt="">
          <span class="leaderboard-name">${escapeHtml(item.username)}</span>
          <span class="leaderboard-value">${item.value}</span>
        </div>
      `;
    }).join('');
  }

  renderTypingList(container, data) {
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="leaderboard-empty">No hay datos todavía</div>';
      return;
    }

    container.innerHTML = data.map((item, index) => {
      const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

      return `
        <div class="leaderboard-item">
          <span class="leaderboard-rank ${rankClass}">#${index + 1}</span>
          <img class="leaderboard-avatar" src="${item.profilePicture || 'profiles/default.svg'}" alt="">
          <span class="leaderboard-name">${escapeHtml(item.username)}</span>
          <div class="leaderboard-typing-stats">
            <span class="leaderboard-wpm">${item.wpm} WPM</span>
            <span class="leaderboard-accuracy">${item.accuracy}%</span>
            <span class="leaderboard-score">(${item.score})</span>
          </div>
        </div>
      `;
    }).join('');
  }

  renderGambaList(container, data, valueField) {
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="leaderboard-empty">No hay datos todavía</div>';
      return;
    }

    container.innerHTML = data.map((item, index) => {
      const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
      let value;
      if (valueField === 'coins') {
        value = `${item.coins} $qr`;
      } else {
        const paidText = item.paidLoansCount > 0 ? ` <span class="paid-loans">(${item.paidLoansCount} pagadas)</span>` : '';
        value = `${item.debt} prestamos${paidText}`;
      }

      return `
        <div class="leaderboard-item">
          <span class="leaderboard-rank ${rankClass}">#${index + 1}</span>
          <img class="leaderboard-avatar" src="${item.profilePicture || 'profiles/default.svg'}" alt="">
          <span class="leaderboard-name">${escapeHtml(item.username)}</span>
          <span class="leaderboard-value">${value}</span>
        </div>
      `;
    }).join('');
  }

  renderSqrrrdleList(container, data) {
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="leaderboard-empty">No hay datos todavía</div>';
      return;
    }

    container.innerHTML = data.map((item, index) => {
      const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

      return `
        <div class="leaderboard-item">
          <span class="leaderboard-rank ${rankClass}">#${index + 1}</span>
          <img class="leaderboard-avatar" src="${item.profilePicture || 'profiles/default.svg'}" alt="">
          <span class="leaderboard-name">${escapeHtml(item.username)}</span>
          <div class="leaderboard-sqrrrdle-stats">
            <span class="leaderboard-words">${item.wordsGuessed} palabras</span>
            <span class="leaderboard-tries">(${item.totalTries} intentos)</span>
          </div>
        </div>
      `;
    }).join('');
  }

  updateData({ vgmGuesses, vgmRecords, typingWpm, gambaCoins, gambaDebt, sqrrrdle }) {
    this.renderList(this.listVgmGuesses, vgmGuesses);
    this.renderList(this.listVgmRecords, vgmRecords);
    this.renderTypingList(this.listTypingWpm, typingWpm);
    this.renderGambaList(this.listGambaCoins, gambaCoins, 'coins');
    this.renderGambaList(this.listGambaDebt, gambaDebt, 'debt');
    this.renderSqrrrdleList(this.listSqrrrdle, sqrrrdle);
  }

  bindOpenButton(button, tab = 'vgm') {
    button?.addEventListener('click', () => this.open(tab));
  }
}

export const leaderboardUI = new LeaderboardUI();
