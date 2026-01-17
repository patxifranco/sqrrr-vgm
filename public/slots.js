/**
 * SQRRR Casino - Slot Machine Game
 *
 * Standalone slot machine game mode.
 */

import { SlotMachine } from './js/games/slots/slot-machine.js';
import { socketManager } from './js/core/socket-manager.js';
import { leaderboardUI } from './js/ui/leaderboard.js';
import { cardAlbumUI } from './js/ui/card-album.js';
import { shopUI } from './js/ui/shop.js';
import { gambaMenu } from './js/ui/gamba-menu.js';

// Slot machine instance
let slotMachine = null;

// Track if loan collection listener is set up
let loanListenerSetup = false;

// ==================== LOAN COLLECTION POPUP ====================

function setupLoanCollectionListener(socket) {
  if (loanListenerSetup) return;
  loanListenerSetup = true;

  const overlay = document.getElementById('loan-collection-overlay');
  const closeBtn = document.getElementById('loan-collection-close');
  const okBtn = document.getElementById('loan-collection-ok');

  if (!overlay) return;

  // Listen for loan collection notices
  socket.on('loanCollectionNotice', (data) => {
    console.log('[LOANS] Collection notice received:', data);
    showLoanCollectionPopup(data);
  });

  // Close handlers
  const closePopup = () => {
    overlay.classList.remove('active');
  };

  closeBtn?.addEventListener('click', closePopup);
  okBtn?.addEventListener('click', closePopup);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePopup();
  });
}

function showLoanCollectionPopup(data) {
  const overlay = document.getElementById('loan-collection-overlay');
  if (!overlay) return;

  const titleBar = overlay.querySelector('.title-bar-text');
  const messageEl = overlay.querySelector('.loan-collection-message');

  // Check if this is a penalty (exploit confiscation)
  if (data.isPenalty) {
    titleBar.textContent = 'Benjamin Netanyahu - Confiscación';
    messageEl.innerHTML = `${data.penaltyReason}<br><br>Se te han confiscado <strong>${data.actualDeduction}</strong> $qr.`;
  } else {
    // Normal loan collection
    titleBar.textContent = 'Benjamin Netanyahu - Cobro de Deudas';
    messageEl.innerHTML = `Israel ha deducido <span id="loan-total-due">${data.totalDue}</span>$ de tu cuenta con un 75%
      (<span id="loan-interest">${data.totalInterest}</span>$) de interes de tus <span id="loan-count">${data.loansCollected}</span> prestamos.`;
  }

  document.getElementById('loan-new-balance').textContent = data.newBalance;

  // Show popup
  overlay.classList.add('active');
}

function checkForDueLoans(socket) {
  if (socket && socket.connected) {
    socket.emit('checkDueLoans');
  }
}

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

  // Initialize card album and shop with socket
  cardAlbumUI.init(socket);
  shopUI.init(socket);

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
    },
    onAlbumClick: () => {
      shopUI.open();
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

// ==================== GAMBA MENU INITIALIZATION ====================

function initGambaMenu() {
  const socket = socketManager.socket;
  if (!socket) return;

  // Set up loan collection listener (only once)
  setupLoanCollectionListener(socket);

  // Check for due loans when entering gamba menu
  checkForDueLoans(socket);

  gambaMenu.init({
    socket,
    onSlotsClick: () => {
      initSlotMachine();
    },
    onStackingClick: () => {
      // Will be implemented in stacking.js
      if (window.initStackingGame) {
        window.initStackingGame();
      } else {
        console.log('Stacking game not yet implemented');
      }
    }
  });
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  // Hub button to enter gamba menu (instead of directly to slots)
  const slotsBtn = document.getElementById('slots-btn');
  if (slotsBtn) {
    slotsBtn.addEventListener('click', () => {
      initGambaMenu();
      gambaMenu.open();
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
window.setupLoanCollectionListener = setupLoanCollectionListener;
window.checkForDueLoans = checkForDueLoans;
