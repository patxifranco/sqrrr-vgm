/**
 * Leaderboard Module - Shared leaderboard UI for VGM and Typing games
 *
 * Handles:
 * - Opening/closing leaderboard modal
 * - Tab switching between VGM and Typing
 * - Rendering leaderboard lists
 */

import { escapeHtml } from '../core/index.js';

class LeaderboardUI {
  constructor() {
    // DOM elements (initialized in init())
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

    /** @type {Function|null} Socket emit function */
    this.emit = null;

    this._initialized = false;
  }

  /**
   * Initialize the leaderboard UI
   * @param {Object} options
   * @param {Function} options.emit - Socket emit function
   */
  init({ emit }) {
    if (this._initialized) return;

    this.emit = emit;

    // Get DOM elements
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

  /**
   * Setup event listeners
   */
  _setupEventListeners() {
    // Tab switching
    this.tabVgm?.addEventListener('click', () => this._switchTab('vgm'));
    this.tabTyping?.addEventListener('click', () => this._switchTab('typing'));
    this.tabGamba?.addEventListener('click', () => this._switchTab('gamba'));
    this.tabSqrrrdle?.addEventListener('click', () => this._switchTab('sqrrrdle'));

    // Close button
    this.closeBtn?.addEventListener('click', () => this.close());

    // Close on backdrop click
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });
  }

  /**
   * Switch between tabs
   */
  _switchTab(tab) {
    // Remove active from all tabs and content
    this.tabVgm?.classList.remove('active');
    this.tabTyping?.classList.remove('active');
    this.tabGamba?.classList.remove('active');
    this.tabSqrrrdle?.classList.remove('active');
    this.contentVgm?.classList.remove('active');
    this.contentTyping?.classList.remove('active');
    this.contentGamba?.classList.remove('active');
    this.contentSqrrrdle?.classList.remove('active');

    // Activate the selected tab
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

  /**
   * Open the leaderboard modal
   * @param {string} [tab='vgm'] - Which tab to open ('vgm' or 'typing')
   */
  open(tab = 'vgm') {
    if (!this.modal) return;

    this.modal.classList.add('active');
    this._switchTab(tab);

    // Request fresh data
    if (this.emit) {
      this.emit('getLeaderboards');
    }
  }

  /**
   * Close the leaderboard modal
   */
  close() {
    this.modal?.classList.remove('active');
  }

  /**
   * Render a standard leaderboard list
   * @param {HTMLElement} container
   * @param {Array} data - Array of {username, profilePicture, value}
   */
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

  /**
   * Render typing leaderboard with WPM/accuracy stats
   * @param {HTMLElement} container
   * @param {Array} data - Array of {username, profilePicture, wpm, accuracy, score}
   */
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

  /**
   * Render gamba leaderboard with coins/debt
   * @param {HTMLElement} container
   * @param {Array} data - Array of {username, profilePicture, coins, debt}
   * @param {string} valueField - 'coins' or 'debt'
   */
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
        // Show debt with paid loans count if any
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

  /**
   * Render SQRRRDLE leaderboard with words guessed and total tries
   * @param {HTMLElement} container
   * @param {Array} data - Array of {username, profilePicture, wordsGuessed, totalTries}
   */
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

  /**
   * Update all leaderboards with new data
   * @param {Object} data
   * @param {Array} data.vgmGuesses
   * @param {Array} data.vgmRecords
   * @param {Array} data.typingWpm
   * @param {Array} data.gambaCoins
   * @param {Array} data.gambaDebt
   * @param {Array} data.sqrrrdle
   */
  updateData({ vgmGuesses, vgmRecords, typingWpm, gambaCoins, gambaDebt, sqrrrdle }) {
    this.renderList(this.listVgmGuesses, vgmGuesses);
    this.renderList(this.listVgmRecords, vgmRecords);
    this.renderTypingList(this.listTypingWpm, typingWpm);
    this.renderGambaList(this.listGambaCoins, gambaCoins, 'coins');
    this.renderGambaList(this.listGambaDebt, gambaDebt, 'debt');
    this.renderSqrrrdleList(this.listSqrrrdle, sqrrrdle);
  }

  /**
   * Bind open button to leaderboard
   * @param {HTMLElement} button
   * @param {string} [tab='vgm']
   */
  bindOpenButton(button, tab = 'vgm') {
    button?.addEventListener('click', () => this.open(tab));
  }
}

// Singleton instance
export const leaderboardUI = new LeaderboardUI();
