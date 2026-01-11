/**
 * SQRRR Cards - Main Module
 *
 * Pokemon TCG-style card collection system:
 * - Buy packs for 2000 coins
 * - Free card every 24 hours
 * - Interactive 3D holographic album
 */

import { cardAlbumUI } from './js/ui/card-album.js';
import { shopUI } from './js/ui/shop.js';

// Wait for DOM and socket to be ready
document.addEventListener('DOMContentLoaded', () => {
  // Socket should already be available from game.js
  // We'll initialize when we detect the socket
  initWhenReady();
});

function initWhenReady() {
  // Check if socket exists (created by game.js)
  if (typeof io === 'undefined') {
    console.warn('Socket.io not loaded yet, retrying...');
    setTimeout(initWhenReady, 100);
    return;
  }

  // Get or create socket connection
  // The socket is usually already created by game.js
  const existingSocket = window._sqrrrSocket;

  if (existingSocket) {
    initCards(existingSocket);
  } else {
    // Create our own socket if needed
    const socket = io();
    window._sqrrrSocket = socket;
    initCards(socket);
  }
}

function initCards(socket) {
  // Initialize the card album and shop UI
  cardAlbumUI.init(socket);
  shopUI.init(socket);

  // Hub button to open album (directly to cards from hub)
  const cardsBtn = document.getElementById('cards-btn');
  if (cardsBtn) {
    cardsBtn.addEventListener('click', () => {
      // Check for due loans when opening cards
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

// Export for use by other modules (slots integration)
export { cardAlbumUI };
