/**
 * SQRRR Stacking Game
 *
 * Arcade stacker gambling game entry point.
 */

import { BlockStackingGame } from './js/games/stacking/block-stacking.js';
import { socketManager } from './js/core/socket-manager.js';

// Stacking game instance
let stackingGame = null;

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

// ==================== STACKING GAME INITIALIZATION ====================

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

  // Destroy existing instance if any
  if (stackingGame) {
    stackingGame.destroy();
  }

  // Create new stacking game
  stackingGame = new BlockStackingGame({
    container,
    socket,
    onCoinsUpdate: (coins) => {
      // Update any global coin displays if needed
      document.querySelectorAll('.global-coins-display').forEach(el => {
        el.textContent = coins;
      });
    }
  });

  stackingGame.init();
  showScreen('stacking-screen');
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  // Back to hub button
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

// Export for use by slots.js gamba menu
window.initStackingGame = initStackingGame;
window.showStackingScreen = showScreen;
