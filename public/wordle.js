import { WordleGame } from './js/games/wordle/wordle-game.js';
import { socketManager } from './js/core/socket-manager.js';
import { leaderboardUI } from './js/ui/leaderboard.js';

let wordleGame = null;

function showScreen(screenId) {
  document.querySelectorAll('.screen-container').forEach(screen => {
    screen.classList.remove('active');
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
}

function updateCoinsDisplay(coins) {
  const coinsEl = document.getElementById('wordle-coins');
  if (coinsEl) {
    coinsEl.textContent = `${coins} $qr`;
  }
}

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

  if (wordleGame) {
    wordleGame.destroy();
  }

  wordleGame = new WordleGame({
    container,
    socket,
    onCoinsUpdate: updateCoinsDisplay
  });

  wordleGame.init();

  socket.emit('user:getCoins');

  showScreen('wordle-screen');
}

document.addEventListener('DOMContentLoaded', () => {
  const wordleBtn = document.getElementById('wordle-btn');
  if (wordleBtn) {
    wordleBtn.addEventListener('click', () => {
      initWordleGame();
    });
  }

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

  const leaderboardBtn = document.getElementById('wordle-leaderboard-btn');
  if (leaderboardBtn) {
    leaderboardBtn.addEventListener('click', () => {
      leaderboardUI.open('sqrrrdle');
    });
  }

  const statsClose = document.getElementById('wordle-stats-close');
  if (statsClose) {
    statsClose.addEventListener('click', () => {
      document.getElementById('wordle-stats-modal').classList.remove('active');
    });
  }

  const statsOk = document.getElementById('wordle-stats-ok');
  if (statsOk) {
    statsOk.addEventListener('click', () => {
      document.getElementById('wordle-stats-modal').classList.remove('active');
    });
  }

  const statsModal = document.getElementById('wordle-stats-modal');
  if (statsModal) {
    statsModal.addEventListener('click', (e) => {
      if (e.target === statsModal) {
        statsModal.classList.remove('active');
      }
    });
  }

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

window.initWordleGame = initWordleGame;
