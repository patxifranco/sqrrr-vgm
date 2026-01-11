/**
 * SQRRR Pesca - Fishing Game
 *
 * Skill-based fishing game entry point.
 * Drop your hook and catch fish while avoiding obstacles!
 */

import { FishingGame } from './js/games/fishing/fishing-game.js';
import { socketManager } from './js/core/socket-manager.js';

// Fishing game instance
let fishingGame = null;

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

// ==================== FISHING GAME INITIALIZATION ====================

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

  // Destroy existing instance if any
  if (fishingGame) {
    fishingGame.destroy();
  }

  // Create new fishing game
  fishingGame = new FishingGame({
    container,
    socket,
    onCoinsUpdate: (coins) => {
      // Update any global coin displays if needed
      document.querySelectorAll('.global-coins-display').forEach(el => {
        el.textContent = coins;
      });
    }
  });

  fishingGame.init();
  showScreen('fishing-screen');
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  // Back to hub button
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

  // Hub fishing button
  const fishingBtn = document.getElementById('fishing-btn');
  if (fishingBtn) {
    fishingBtn.addEventListener('click', () => {
      initFishingGame();
    });
  }
});

// Export for use by hub
window.initFishingGame = initFishingGame;
window.showFishingScreen = showScreen;
