/**
 * SQRRR Golf - Minigolf Game
 *
 * Loads the Godot-based minigolf game in an iframe.
 * Multiplayer via Socket.io with server relay.
 */

import { socketManager } from './js/core/socket-manager.js';

// ==================== STATE ====================
let minigolfIframe = null;
let currentUser = null;

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

// ==================== MINIGOLF INITIALIZATION ====================

function initMinigolf() {
  // Get current user info
  const usernameEl = document.getElementById('hub-username');
  const avatarEl = document.getElementById('hub-avatar');

  const username = usernameEl ? usernameEl.textContent : 'Guest';
  const profile = avatarEl ? avatarEl.src.replace(window.location.origin, '').replace(/^\//, '') : 'profiles/default.svg';

  currentUser = { username, profile };

  // Get or create the game container
  const gameContainer = document.getElementById('minigolf-game');
  if (!gameContainer) {
    console.error('Minigolf game container not found');
    return;
  }

  // Hide the lobby UI
  const lobbyEl = document.getElementById('minigolf-lobby');
  if (lobbyEl) {
    lobbyEl.style.display = 'none';
  }

  // Show the game container
  gameContainer.style.display = 'block';

  // Create iframe if not exists
  if (!minigolfIframe) {
    minigolfIframe = document.createElement('iframe');
    minigolfIframe.id = 'minigolf-iframe';
    minigolfIframe.style.cssText = 'width:100%;height:100%;border:none;';
    minigolfIframe.allow = 'autoplay; fullscreen';

    // Build URL with user params
    const params = new URLSearchParams({
      username: username,
      profile: profile
    });
    minigolfIframe.src = `/minigolf-godot/minigolf.html?${params.toString()}`;

    // Clear container and add iframe
    gameContainer.innerHTML = '';
    gameContainer.appendChild(minigolfIframe);
  }

  // Show minigolf screen
  showScreen('minigolf-screen');
}

function destroyMinigolf() {
  if (minigolfIframe) {
    minigolfIframe.remove();
    minigolfIframe = null;
  }

  // Show the lobby UI again
  const lobbyEl = document.getElementById('minigolf-lobby');
  if (lobbyEl) {
    lobbyEl.style.display = 'flex';
  }

  // Hide the game container
  const gameContainer = document.getElementById('minigolf-game');
  if (gameContainer) {
    gameContainer.style.display = 'none';
    gameContainer.innerHTML = '';
  }
}

// ==================== EVENT LISTENERS ====================

document.addEventListener('DOMContentLoaded', () => {
  // Hub minigolf button
  const minigolfBtn = document.getElementById('minigolf-btn');
  if (minigolfBtn) {
    minigolfBtn.addEventListener('click', () => {
      initMinigolf();
    });
  }

  // Close button in title bar
  const closeBtn = document.getElementById('minigolf-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      destroyMinigolf();
      showScreen('hub-screen');
    });
  }

  // Listen for messages from iframe
  window.addEventListener('message', (event) => {
    if (event.data.type === 'minigolfBack') {
      destroyMinigolf();
      showScreen('hub-screen');
    }
  });

  // Secret 'G' key to open minigolf (only on hub screen)
  document.addEventListener('keydown', (event) => {
    // Only trigger on hub screen and not when typing in an input
    const hubScreen = document.getElementById('hub-screen');
    const isOnHub = hubScreen && hubScreen.classList.contains('active');
    const isTyping = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';

    if (isOnHub && !isTyping && (event.key === 'g' || event.key === 'G')) {
      initMinigolf();
    }
  });
});

// Export for use by hub
window.initMinigolf = initMinigolf;
window.destroyMinigolf = destroyMinigolf;
