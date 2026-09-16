import { FishingGame } from './js/games/fishing/fishing-game.js';
import { socketManager } from './js/core/socket-manager.js';

let fishingGame = null;

function showScreen(screenId) {
  document.querySelectorAll('.screen-container').forEach(screen => {
    screen.classList.remove('active');
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
}

function initFishingGame() {
  const socket = socketManager.socket;

  if (!socket) {
    console.error('Socket not connected');
    return;
  }

  const container = document.getElementById('fishing-game-container');
  if (!container) {
    console.error('Fishing container not found');
    return;
  }

  if (fishingGame) {
    fishingGame.destroy();
  }

  fishingGame = new FishingGame({
    container,
    socket,
    onCoinsUpdate: (coins) => {
      document.querySelectorAll('.global-coins-display').forEach(el => {
        el.textContent = coins;
      });
    }
  });

  fishingGame.init();
  showScreen('fishing-screen');
}

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('fishing-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (fishingGame) {
        fishingGame.destroy();
        fishingGame = null;
      }
      showScreen('hub-screen');
    });
  }

  const fishingBtn = document.getElementById('fishing-btn');
  if (fishingBtn) {
    fishingBtn.addEventListener('click', () => {
      initFishingGame();
    });
  }
});

window.initFishingGame = initFishingGame;
window.showFishingScreen = showScreen;
