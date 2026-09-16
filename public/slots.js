import { SlotMachine } from './js/games/slots/slot-machine.js';
import { socketManager } from './js/core/socket-manager.js';
import { leaderboardUI } from './js/ui/leaderboard.js';
import { cardAlbumUI } from './js/ui/card-album.js';
import { shopUI } from './js/ui/shop.js';
import { gambaMenu } from './js/ui/gamba-menu.js';

let slotMachine = null;

let loanListenerSetup = false;

function setupLoanCollectionListener(socket) {
  if (loanListenerSetup) return;
  loanListenerSetup = true;

  const overlay = document.getElementById('loan-collection-overlay');
  const closeBtn = document.getElementById('loan-collection-close');
  const okBtn = document.getElementById('loan-collection-ok');

  if (!overlay) return;

  socket.on('loanCollectionNotice', (data) => {
    console.log('[LOANS] Collection notice received:', data);
    showLoanCollectionPopup(data);
  });

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

  if (data.isPenalty) {
    titleBar.textContent = 'Benjamin Netanyahu - Confiscación';
    messageEl.innerHTML = `${data.penaltyReason}<br><br>Se te han confiscado <strong>${data.actualDeduction}</strong> $qr.`;
  } else {
    titleBar.textContent = 'Benjamin Netanyahu - Cobro de Deudas';
    messageEl.innerHTML = `Israel ha deducido <span id="loan-total-due">${data.totalDue}</span>$ de tu cuenta con un 75%
      (<span id="loan-interest">${data.totalInterest}</span>$) de interes de tus <span id="loan-count">${data.loansCollected}</span> prestamos.`;
  }

  document.getElementById('loan-new-balance').textContent = data.newBalance;

  overlay.classList.add('active');
}

function checkForDueLoans(socket) {
  if (socket && socket.connected) {
    socket.emit('checkDueLoans');
  }
}

function showSlotsScreen(screenId) {
  document.querySelectorAll('.screen-container').forEach(screen => {
    screen.classList.remove('active');
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
}

function initSlotMachine() {
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

  if (slotMachine) {
    slotMachine.destroy();
  }

  cardAlbumUI.init(socket);
  shopUI.init(socket);

  slotMachine = new SlotMachine({
    container,
    socket,
    onCoinsUpdate: (coins) => {
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
  document.querySelectorAll('.global-coins-display').forEach(el => {
    el.textContent = coins;
  });
}

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

function initGambaMenu() {
  const socket = socketManager.socket;
  if (!socket) return;

  setupLoanCollectionListener(socket);

  checkForDueLoans(socket);

  gambaMenu.init({
    socket,
    onSlotsClick: () => {
      initSlotMachine();
    },
    onStackingClick: () => {
      if (window.initStackingGame) {
        window.initStackingGame();
      } else {
        console.log('Stacking game not yet implemented');
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const slotsBtn = document.getElementById('slots-btn');
  if (slotsBtn) {
    slotsBtn.addEventListener('click', () => {
      initGambaMenu();
      gambaMenu.open();
    });
  }

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

  const slotsScreen = document.getElementById('slots-screen');
  if (slotsScreen) {
    setupFactoQuotes(slotsScreen);
  }
});

window.initSlotMachine = initSlotMachine;
window.showSlotsScreen = showSlotsScreen;
window.setupLoanCollectionListener = setupLoanCollectionListener;
window.checkForDueLoans = checkForDueLoans;
