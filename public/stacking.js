import { BlockStackingGame } from './js/games/stacking/block-stacking.js';
import { socketManager } from './js/core/socket-manager.js';

let stackingGame = null;

function showScreen(screenId) {
  document.querySelectorAll('.screen-container').forEach(screen => {
    screen.classList.remove('active');
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
}

function initStackingGame() {
  const socket = socketManager.socket;

  if (!socket) {
    console.error('Socket not connected');
    return;
  }

  const container = document.getElementById('stacking-game-container');
  if (!container) {
    console.error('Stacking container not found');
    return;
  }

  if (stackingGame) {
    stackingGame.destroy();
  }

  stackingGame = new BlockStackingGame({
    container,
    socket,
    onCoinsUpdate: (coins) => {
      document.querySelectorAll('.global-coins-display').forEach(el => {
        el.textContent = coins;
      });
    }
  });

  stackingGame.init();
  showScreen('stacking-screen');
}

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('stacking-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (stackingGame) {
        stackingGame.destroy();
        stackingGame = null;
      }
      showScreen('hub-screen');
    });
  }
});

window.initStackingGame = initStackingGame;
window.showStackingScreen = showScreen;
