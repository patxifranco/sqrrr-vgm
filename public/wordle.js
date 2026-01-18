/**
 * SQRRRDLE - Daily Word Game
 *
 * Gaming-themed daily word guessing game entry point.
 * Guess the 5-letter gaming word in 6 tries!
 */

import { WordleGame } from './js/games/wordle/wordle-game.js';
import { socketManager } from './js/core/socket-manager.js';
import { leaderboardUI } from './js/ui/leaderboard.js';

// Wordle game instance
let wordleGame = null;

// ==================== SCREEN NAVIGATION ====================

function showScreen(screenId) {
  document.querySelectorAll('.screen-container').forEach(screen => {
    screen.classList.remove('active');
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
}

// Update coin display
function updateCoinsDisplay(coins) {
  const coinsEl = document.getElementById('wordle-coins');
  if (coinsEl) {
    coinsEl.textContent = `${coins} $qr`;
  }
}

// ==================== WORDLE GAME INITIALIZATION ====================

function initWordleGame() {
  const socket = socketManager.socket;

  if (!socket) {
    console.error('Socket not connected');
    return;
  }

  const container = document.getElementById('wordle-game-container');
  if (!container) {
    console.error('Wordle container not found');
    return;
  }

  // Destroy existing instance if any
  if (wordleGame) {
    wordleGame.destroy();
  }

  // Create new wordle game
  wordleGame = new WordleGame({
    container,
    socket,
    onCoinsUpdate: updateCoinsDisplay
  });

  wordleGame.init();

  // Fetch current coins (the sqrrrdle:getState will also return coins)
  socket.emit('user:getCoins');

  showScreen('wordle-screen');
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  // Hub wordle button
  const wordleBtn = document.getElementById('wordle-btn');
  if (wordleBtn) {
    wordleBtn.addEventListener('click', () => {
      initWordleGame();
    });
  }

  // Back to hub button
  const backBtn = document.getElementById('wordle-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (wordleGame) {
        wordleGame.destroy();
        wordleGame = null;
      }
      showScreen('hub-screen');
    });
  }

  // Leaderboard button
  const leaderboardBtn = document.getElementById('wordle-leaderboard-btn');
  if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
      leaderboardUI.open('sqrrrdle');
    });
  }

  // Stats modal close button
  const statsClose = document.getElementById('wordle-stats-close');
  if (statsClose) {
    statsClose.addEventListener('click', () => {
      document.getElementById('wordle-stats-modal').classList.remove('active');
    });
  }

  // Stats modal OK button
  const statsOk = document.getElementById('wordle-stats-ok');
  if (statsOk) {
    statsOk.addEventListener('click', () => {
      document.getElementById('wordle-stats-modal').classList.remove('active');
    });
  }

  // Close modal on overlay click
  const statsModal = document.getElementById('wordle-stats-modal');
  if (statsModal) {
    statsModal.addEventListener('click', (e) => {
      if (e.target === statsModal) {
        statsModal.classList.remove('active');
      }
    });
  }

  // Listen for coin updates
  const socket = socketManager.socket;
  if (socket) {
    socket.on('user:coins', (data) => {
      const coinsEl = document.getElementById('wordle-coins');
      if (coinsEl) {
        coinsEl.textContent = `${data.coins} $qr`;
      }
    });
  }
});

// Export for use by hub
window.initWordleGame = initWordleGame;
