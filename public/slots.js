/**
 * SQRRR Casino - Slot Machine Game
 *
 * Standalone slot machine game mode.
 */

import { SlotMachine } from './js/games/slots/slot-machine.js';
import { socketManager } from './js/core/socket-manager.js';
import { leaderboardUI } from './js/ui/leaderboard.js';

// Slot machine instance
let slotMachine = null;

// ==================== SCREEN NAVIGATION ====================

function showSlotsScreen(screenId) {
  // Hide all screens
  document.querySelectorAll('.screen-container').forEach(screen => {
    screen.classList.remove('active');
  });

  // Show target screen
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
}

// ==================== SLOT MACHINE INITIALIZATION ====================

function initSlotMachine() {
  // Use the shared socket from socketManager (already authenticated)
  const socket = socketManager.socket;

  if (!socket) {
    console.error('Socket not connected');
    return;
  }

  const container = document.getElementById('slots-game-container');
  if (!container) {
    console.error('Slots container not found');
    return;
  }

  // Destroy existing instance if any
  if (slotMachine) {
    slotMachine.destroy();
  }

  // Create new slot machine
  slotMachine = new SlotMachine({
    container,
    socket,
    onCoinsUpdate: (coins) => {
      // Update any global coin displays if needed
      updateGlobalCoinDisplay(coins);
    },
    onLeaderboardClick: () => {
      leaderboardUI.open('gamba');
    }
  });

  showSlotsScreen('slots-screen');
}

function updateGlobalCoinDisplay(coins) {
  // Update any global coin displays on the page
  document.querySelectorAll('.global-coins-display').forEach(el => {
    el.textContent = coins;
  });
}

// ==================== FACTO QUOTES ====================

const factoQuotes = [
  'Facto: Al apostar puedes ganar hasta 2000% y solo perder el 100%',
  'Facto: el 90% de los jugadores deja de apostar justo antes de ganar',
  'No hay facto pero imagina el meme de picando diamante'
];

function setupFactoQuotes(container) {
  const textEl = container.querySelector('.slots-facto-text');
  const arrowBtn = container.querySelector('.slots-facto-arrow');

  if (!textEl || !arrowBtn) return;

  let currentIndex = 0;

  arrowBtn.addEventListener('click', () => {
    currentIndex = (currentIndex + 1) % factoQuotes.length;
    textEl.textContent = factoQuotes[currentIndex];
  });
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  // Hub button to enter slots
  const slotsBtn = document.getElementById('slots-btn');
  if (slotsBtn) {
    slotsBtn.addEventListener('click', () => {
      initSlotMachine();
    });
  }

  // Back to hub button
  const backBtn = document.getElementById('slots-back-btn');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (slotMachine) {
        slotMachine.destroy();
        slotMachine = null;
      }
      showSlotsScreen('hub-screen');
    });
  }

  // Setup facto quotes for standalone mode
  const slotsScreen = document.getElementById('slots-screen');
  if (slotsScreen) {
    setupFactoQuotes(slotsScreen);
  }
});

// Export for potential use by other modules
window.initSlotMachine = initSlotMachine;
window.showSlotsScreen = showSlotsScreen;
