import { socketManager } from './js/core/socket-manager.js';

let minigolfIframe = null;
let currentUser = null;

function showScreen(screenId) {
  document.querySelectorAll('.screen-container').forEach(screen => {
    screen.classList.remove('active');
  });

  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
  }
}

function initMinigolf() {
  const usernameEl = document.getElementById('hub-username');
  const avatarEl = document.getElementById('hub-avatar');

  const username = usernameEl ? usernameEl.textContent : 'Guest';
  const profile = avatarEl ? avatarEl.src.replace(window.location.origin, '').replace(/^\//, '') : 'profiles/default.svg';

  currentUser = { username, profile };

  const gameContainer = document.getElementById('minigolf-game');
  if (!gameContainer) {
    console.error('Minigolf game container not found');
    return;
  }

  const lobbyEl = document.getElementById('minigolf-lobby');
  if (lobbyEl) {
    lobbyEl.style.display = 'none';
  }

  gameContainer.style.display = 'block';

  if (!minigolfIframe) {
    minigolfIframe = document.createElement('iframe');
    minigolfIframe.id = 'minigolf-iframe';
    minigolfIframe.style.cssText = 'width:100%;height:100%;border:none;';
    minigolfIframe.allow = 'autoplay; fullscreen';

    const params = new URLSearchParams({
      username: username,
      profile: profile
    });
    minigolfIframe.src = `/minigolf-godot/minigolf.html?${params.toString()}`;

    gameContainer.innerHTML = '';
    gameContainer.appendChild(minigolfIframe);
  }

  showScreen('minigolf-screen');
}

function destroyMinigolf() {
  if (minigolfIframe) {
    minigolfIframe.remove();
    minigolfIframe = null;
  }

  const lobbyEl = document.getElementById('minigolf-lobby');
  if (lobbyEl) {
    lobbyEl.style.display = 'flex';
  }

  const gameContainer = document.getElementById('minigolf-game');
  if (gameContainer) {
    gameContainer.style.display = 'none';
    gameContainer.innerHTML = '';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const minigolfBtn = document.getElementById('minigolf-btn');
  if (minigolfBtn) {
    minigolfBtn.addEventListener('click', () => {
      initMinigolf();
    });
  }

  const closeBtn = document.getElementById('minigolf-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      destroyMinigolf();
      showScreen('hub-screen');
    });
  }

  window.addEventListener('message', (event) => {
    if (event.data.type === 'minigolfBack') {
      destroyMinigolf();
      showScreen('hub-screen');
    }
  });

  document.addEventListener('keydown', (event) => {
    const hubScreen = document.getElementById('hub-screen');
    const isOnHub = hubScreen && hubScreen.classList.contains('active');
    const isTyping = event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA';

    if (isOnHub && !isTyping && (event.key === 'g' || event.key === 'G')) {
      initMinigolf();
    }
  });
});

window.initMinigolf = initMinigolf;
window.destroyMinigolf = destroyMinigolf;
