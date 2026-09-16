import { cardAlbumUI } from './js/ui/card-album.js';
import { shopUI } from './js/ui/shop.js';

document.addEventListener('DOMContentLoaded', () => {
  initWhenReady();
});

function initWhenReady() {
  if (typeof io === 'undefined') {
    console.warn('Socket.io not loaded yet, retrying...');
    setTimeout(initWhenReady, 100);
    return;
  }

  const existingSocket = window._sqrrrSocket;

  if (existingSocket) {
    initCards(existingSocket);
  } else {
    const socket = io();
    window._sqrrrSocket = socket;
    initCards(socket);
  }
}

function initCards(socket) {
  cardAlbumUI.init(socket);
  shopUI.init(socket);

  const cardsBtn = document.getElementById('cards-btn');
  if (cardsBtn) {
    cardsBtn.addEventListener('click', () => {
      if (window.setupLoanCollectionListener) {
        window.setupLoanCollectionListener(socket);
      }
      if (window.checkForDueLoans) {
        window.checkForDueLoans(socket);
      }
      cardAlbumUI.open();
    });
  }

  console.log('SQRRR Cards initialized');
}

export { cardAlbumUI };
