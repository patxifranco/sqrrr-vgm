// ==================== CORE MODULES ====================
import { timerManager, socketManager, audioManager, logger, escapeHtml } from './js/core/index.js';
import { vgmChat } from './js/games/vgm/chat.js';
import { vgmTimer } from './js/games/vgm/timer.js';
import { windowControls } from './js/games/vgm/window-controls.js';
import { leaderboardUI } from './js/ui/leaderboard.js';
import { createSlotPopupButton } from './js/ui/slot-popup.js';
import { showCoinAnimation } from './js/ui/coin-animation.js';
import { shopUI } from './js/ui/shop.js';
import { cardAlbumUI } from './js/ui/card-album.js';

// Initialize socket connection
const socket = socketManager.connect();

// Expose socket globally for other modules (cards.js, etc.)
window._sqrrrSocket = socket;


// Create scoped logger for VGM game
const log = logger.scope('VGM');

// ==================== SOUND EFFECTS ====================
// Preload sound effects using audioManager
audioManager.preload('notify', 'windows_xp_notify.mp3');
audioManager.preload('logon', 'windows_xp_logon.mp3');
audioManager.preload('logoff', 'windows_xp_logoff.mp3');
audioManager.preload('supersonic', 'supersonic.mp3');
audioManager.preload('nudge', 'msn_nudge_sound.mp3');
audioManager.preload('correct', 'correct.mp3');
audioManager.preload('close', 'close.mp3');

function playNotifySound() {
  audioManager.play('notify', { volume: 0.6 });
}

function playLogonSound() {
  audioManager.play('logon', { volume: 0.2 });
}

function playLogoffSound() {
  audioManager.play('logoff', { volume: 0.2 });
}

// Utility: Setup modal close handlers (close button + outside click)
function setupModalClose(modal, closeBtn) {
  closeBtn.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('active');
  });
}

let currentUser = null;
let usersList = [];
let lastPlayerCount = 0; // Track player count for notify sound

const screens = {
  login: document.getElementById('login-screen'),
  hub: document.getElementById('hub-screen'),
  menu: document.getElementById('menu-screen'),
  lobby: document.getElementById('lobby-screen'),
  game: document.getElementById('game-screen'),
  roundEnd: document.getElementById('round-end-screen'),
  // Drawing game screens
  drawingLobby: document.getElementById('drawing-lobby-screen'),
  drawingGame: document.getElementById('drawing-game-screen'),
  drawingResults: document.getElementById('drawing-results-screen')
};

const userSelect = document.getElementById('user-select');
const loginPassword = document.getElementById('login-password');
const loginAvatar = document.getElementById('login-avatar');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const rememberMe = document.getElementById('remember-me');

const hubAvatar = document.getElementById('hub-avatar');
const hubUsername = document.getElementById('hub-username');
const hubUserInfo = document.getElementById('hub-user-info');
const hubLogoutBtn = document.getElementById('hub-logout-btn');
const hubAdminIndicator = document.getElementById('hub-admin-indicator');
const vgmBtn = document.getElementById('vgm-btn');

const userAvatar = document.getElementById('user-avatar');
const userDisplayName = document.getElementById('user-display-name');
const userInfoBtn = document.getElementById('user-info-btn');
const backToHubBtn = document.getElementById('back-to-hub-btn');
const adminIndicator = document.getElementById('admin-indicator');
const createLobbyBtn = document.getElementById('create-lobby-btn');
const roomCodeInput = document.getElementById('room-code-input');
const joinLobbyBtn = document.getElementById('join-lobby-btn');

const profileModal = document.getElementById('profile-modal');
const profileClose = document.getElementById('profile-close');
const profileAvatar = document.getElementById('profile-avatar');
const profileUsername = document.getElementById('profile-username');
const statGamesPlayed = document.getElementById('stat-games-played');
const statGamesGuessed = document.getElementById('stat-games-guessed');
const statSongsGuessed = document.getElementById('stat-songs-guessed');
const statSuperSonics = document.getElementById('stat-super-sonics');
const statTotalPoints = document.getElementById('stat-total-points');
const statHintsUsed = document.getElementById('stat-hints-used');
const mostGuessedGame = document.getElementById('most-guessed-game');
const currentPasswordInput = document.getElementById('current-password');
const newPasswordInput = document.getElementById('new-password');
const confirmPasswordInput = document.getElementById('confirm-password');
const passwordError = document.getElementById('password-error');
const passwordSuccess = document.getElementById('password-success');
const changePasswordBtn = document.getElementById('change-password-btn');

const adminSection = document.getElementById('admin-section');
const adminUserSelect = document.getElementById('admin-user-select');
const adminNewPassword = document.getElementById('admin-new-password');
const adminError = document.getElementById('admin-error');
const adminSuccess = document.getElementById('admin-success');
const adminResetBtn = document.getElementById('admin-reset-btn');

const playerProfilePopup = document.getElementById('player-profile-popup');
const popupProfileClose = document.getElementById('popup-profile-close');
const popupProfileAvatar = document.getElementById('popup-profile-avatar');
const popupProfileUsername = document.getElementById('popup-profile-username');
const popupStatGamesPlayed = document.getElementById('popup-stat-games-played');
const popupStatGamesGuessed = document.getElementById('popup-stat-games-guessed');
const popupStatSongsGuessed = document.getElementById('popup-stat-songs-guessed');
const popupStatSuperSonics = document.getElementById('popup-stat-super-sonics');
const popupStatTotalPoints = document.getElementById('popup-stat-total-points');
const popupStatHintsUsed = document.getElementById('popup-stat-hints-used');
const popupStatRecordsHeld = document.getElementById('popup-stat-records-held');
const popupMostGuessed = document.getElementById('popup-most-guessed');

const roomCodeDisplay = document.getElementById('room-code-display');
const playerList = document.getElementById('player-list');
const startGameBtn = document.getElementById('start-game-btn');
const chatMessages = document.getElementById('chat-messages');

const startRoundBtnGame = document.getElementById('start-round-btn-game');
const backToHubGame = document.getElementById('back-to-hub-game');

const gameRoomCode = document.getElementById('game-room-code');
const roundNumber = document.getElementById('round-number');
const timerFill = document.getElementById('timer-fill');
const timerText = document.getElementById('timer-text');
const gameStatus = document.getElementById('game-status');
const gameStatusValue = document.getElementById('game-status-value');
const songStatus = document.getElementById('song-status');
const songStatusValue = document.getElementById('song-status-value');
const guessInput = document.getElementById('guess-input');
const guessBtn = document.getElementById('guess-btn');
const hintBtn = document.getElementById('hint-btn');
const hintFill = document.getElementById('hint-fill');
const hintPointsText = document.getElementById('hint-points-text');
const hintDisplay = document.getElementById('hint-display');
const gamePlayerList = document.getElementById('game-player-list');
const gameMessages = document.getElementById('game-messages');
const audioPlayer = document.getElementById('audio-player');
const volumeSlider = document.getElementById('volume-slider');
const voteExtendBtn = document.getElementById('vote-extend-btn');
const extendVotesDisplay = document.getElementById('extend-votes');
const nudgeBtn = document.getElementById('nudge-btn');

// Nudge cooldown tracking (2 minutes = 120000ms)
const NUDGE_COOLDOWN_MS = 2 * 60 * 1000;
let nudgeCooldownUntil = 0;

// Initialize audioManager with main player
audioManager.setMainPlayer(audioPlayer);

// Initialize VGM chat module
vgmChat.init({
  container: gameMessages,
  emit: (event, data) => socket.emit(event, data),
  playSound: (name, opts) => audioManager.play(name, opts)
});

// Initialize VGM timer module
vgmTimer.init({
  timerFill,
  timerText,
  audioPlayer,
  volumeSlider,
  voteExtendBtn,
  onProgressUpdate: (percent) => updateProgressSegments(percent)
});

// Audio error handling (audioManager handles most cases, but keep custom message)
audioPlayer.addEventListener('error', (e) => {
  // Ignore errors when src is empty (happens when leaving game intentionally)
  if (!audioPlayer.src || audioPlayer.src === '' || audioPlayer.src === window.location.href) {
    return;
  }
  addMsnMessage('SQRRR', `Error de audio: ${audioPlayer.error?.message || 'desconocido'}`, false);
});

const gameUserAvatar = document.getElementById('game-user-avatar');
const gameUserName = document.getElementById('game-user-name');
const gameStatusText = document.getElementById('game-status-text');

const revealFull = document.getElementById('reveal-full');
const finalPlayerList = document.getElementById('final-player-list');
const nextRoundBtn = document.getElementById('next-round-btn');
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');

let currentRoom = null;
let roundStartTime = null;
let roundDuration = 25000;
let fullAudioDuration = null;
let guessedGame = false;
let hintPoints = 4;
let usedHintThisRound = false;
let roundActive = false;
let hasVotedExtend = false;
let fadeOutStarted = false;
let isExtended = false;
let countdownMessages = {};

let messageHistory = [];
let messageHistoryIndex = -1;
const MAX_MESSAGE_HISTORY = 20;

let userFontSize = localStorage.getItem('chatFontSize') || '13';
let userFontColor = localStorage.getItem('chatFontColor') || '#000000';
let userNameColor = localStorage.getItem('chatNameColor') || '#0000ff';
let userTextEffect = localStorage.getItem('chatTextEffect') || 'none';
let currentCorrectGame = null;
let currentCorrectSong = null;
let originalVolume = 1;

// ==================== DOCUMENT EVENT LISTENER CLEANUP ====================
// Store references to document/window listeners for cleanup when leaving game
const documentListeners = {
  clickToPlay: null,
  fontPopupClose: null,
  emoticonPopupClose: null,
  dragMove: null,
  dragEnd: null,
  resizeMove: null,
  resizeEnd: null,
  windowFocus: null,
  visibilityChange: null
};

function cleanupDocumentListeners() {
  if (documentListeners.clickToPlay) {
    document.removeEventListener('click', documentListeners.clickToPlay);
    documentListeners.clickToPlay = null;
  }
  if (documentListeners.fontPopupClose) {
    document.removeEventListener('click', documentListeners.fontPopupClose);
    documentListeners.fontPopupClose = null;
  }
  if (documentListeners.emoticonPopupClose) {
    document.removeEventListener('click', documentListeners.emoticonPopupClose);
    documentListeners.emoticonPopupClose = null;
  }
  if (documentListeners.dragMove) {
    document.removeEventListener('mousemove', documentListeners.dragMove);
    documentListeners.dragMove = null;
  }
  if (documentListeners.dragEnd) {
    document.removeEventListener('mouseup', documentListeners.dragEnd);
    documentListeners.dragEnd = null;
  }
  if (documentListeners.resizeMove) {
    document.removeEventListener('mousemove', documentListeners.resizeMove);
    documentListeners.resizeMove = null;
  }
  if (documentListeners.resizeEnd) {
    document.removeEventListener('mouseup', documentListeners.resizeEnd);
    documentListeners.resizeEnd = null;
  }
  if (documentListeners.windowFocus) {
    window.removeEventListener('focus', documentListeners.windowFocus);
    documentListeners.windowFocus = null;
  }
  if (documentListeners.visibilityChange) {
    document.removeEventListener('visibilitychange', documentListeners.visibilityChange);
    documentListeners.visibilityChange = null;
  }
  log.info('Cleaned up document event listeners');
}

// Format game/song name for file display: "game-name - song-name.mp3"
function formatFileName(game, song) {
  const formatPart = (str) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `${formatPart(game)} - ${formatPart(song)}.mp3`;
}

// Show a specific screen
let currentScreen = null;

function showScreen(screenName) {
  const previousScreen = currentScreen;

  // Cleanup when leaving game screens
  if (previousScreen === 'game' && screenName !== 'game') {
    // Leaving the VGM game screen
    timerManager.clearByPrefix('vgm-');
    socketManager.cleanupScope('vgm');
    cleanupDocumentListeners();
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer.src = '';
    }
    log.info('Left VGM game, cleaned up timers, socket listeners, and document listeners');
  }

  if (previousScreen === 'roundEnd' && screenName !== 'roundEnd') {
    timerManager.clear('vgm-reveal');
  }

  // Hide all screens
  Object.values(screens).forEach(screen => {
    if (screen) screen.classList.remove('active');
  });

  // Show the requested screen
  if (screens[screenName]) {
    screens[screenName].classList.add('active');
    currentScreen = screenName;
  }
}

// Update player list display
// Player list state for DOM diffing
const playerListCache = new WeakMap();

function updatePlayerList(players, listElement) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  // Get or create cache for this list element
  let cache = playerListCache.get(listElement);
  if (!cache) {
    cache = { elements: new Map(), order: [] };
    playerListCache.set(listElement, cache);
  }

  const currentIds = new Set(sortedPlayers.map(p => p.id || p.username));

  // Remove players no longer in list
  for (const [id, li] of cache.elements) {
    if (!currentIds.has(id)) {
      li.remove();
      cache.elements.delete(id);
    }
  }

  // Update or create player elements
  sortedPlayers.forEach((player, index) => {
    const playerId = player.id || player.username;
    let li = cache.elements.get(playerId);

    if (!li) {
      // Create new element
      li = document.createElement('li');
      li.style.cursor = 'pointer';
      li.addEventListener('click', () => {
        socket.emit('getPlayerProfile', { username: player.username || player.name });
      });
      cache.elements.set(playerId, li);
    }

    // Update content if changed
    const avatarSrc = player.profilePicture || 'profiles/default.svg';
    const hasStreak = player.streak > 0;
    const streakHtml = hasStreak ? `<span class="player-streak">Racha: ${player.streak}</span>` : '';

    const newContent = `
      <img src="${avatarSrc}" class="player-avatar-small" alt="">
      <span class="player-name">${escapeHtml(player.name)}</span>
      <span class="player-score">${player.score} pts</span>
      ${streakHtml}
    `;

    // Only update innerHTML if content changed
    if (li.dataset.content !== newContent) {
      li.innerHTML = newContent;
      li.dataset.content = newContent;
    }

    // Update border style based on guess state
    const newBorder = player.guessedSong ? '3px solid #f39c12' :
                      player.guessedGame ? '3px solid #2ecc71' : '';
    if (li.style.borderLeft !== newBorder) {
      li.style.borderLeft = newBorder;
    }

    // Ensure correct position in DOM
    const currentChild = listElement.children[index];
    if (currentChild !== li) {
      if (currentChild) {
        listElement.insertBefore(li, currentChild);
      } else {
        listElement.appendChild(li);
      }
    }
  });
}

// Expose showScreen globally for drawing.js and typing.js
window.showScreen = showScreen;

// Add chat/game message (legacy - for lobby chat)
function addMessage(container, message, className = '') {
  const p = document.createElement('p');
  p.className = className;
  p.textContent = message;
  container.appendChild(p);
  container.scrollTop = container.scrollHeight;
}

// ==================== CHAT FUNCTIONS (delegated to vgmChat module) ====================
// These functions maintain backward compatibility while delegating to the modular chat system

function addMsnMessage(sender, message, isSystem = false, options = {}) {
  vgmChat.addMsnMessage(sender, message, isSystem, options);
}

function addStartVGMButton() {
  vgmChat.addStartButton();
}

function addFileTransfer(initialProgress = 0) {
  vgmChat.addFileTransfer(initialProgress);
}

function updateProgressSegments(percent) {
  vgmChat.updateProgress(percent);
}

function addCorrectGuessMessage(playerName, timeInSeconds, isGame, sonicType = null) {
  vgmChat.addCorrectGuess(playerName, timeInSeconds, isGame, sonicType);
}

function addSonicBonusMessage(playerName, sonicType) {
  vgmChat.addSonicBonus(playerName, sonicType);
}

// Sync font settings to chat module
function syncFontSettings() {
  vgmChat.setFontSettings({
    size: parseInt(userFontSize),
    color: userFontColor,
    nameColor: userNameColor,
    effect: userTextEffect
  });
}

// Initialize font settings from localStorage
syncFontSettings();

// Timer functions delegated to vgmTimer module
function startTimer(duration) {
  roundStartTime = Date.now();
  roundDuration = duration;
  fadeOutStarted = false;
  vgmTimer.start(duration);
}

function restoreVolume() {
  vgmTimer.restoreVolume();
}

// Update hint display
function updateHintDisplay() {
  const percent = (hintPoints / 8) * 100;
  hintFill.style.width = percent + '%';
  hintPointsText.textContent = `${hintPoints}/4`;

  if (hintPoints >= 4 && !usedHintThisRound && !guessedGame) {
    hintBtn.disabled = false;
  } else {
    hintBtn.disabled = true;
  }
}

function resetRoundState() {
  guessedGame = false;
  usedHintThisRound = false;
  roundActive = false;
  hasVotedExtend = false;
  fadeOutStarted = false;
  isExtended = false;
  fullAudioDuration = null;
  vgmTimer.reset();
  restoreVolume();
  if (gameStatus) gameStatus.classList.remove('guessed');
  if (gameStatusValue) gameStatusValue.textContent = 'Sin adivinar';
  if (gameStatusText) gameStatusText.textContent = '';
  guessInput.value = '';
  guessInput.disabled = false;
  guessBtn.disabled = false;
  if (voteExtendBtn) {
    voteExtendBtn.disabled = false;
    voteExtendBtn.style.opacity = '1';
  }
  if (extendVotesDisplay) extendVotesDisplay.textContent = '0/0';
  if (hintDisplay) {
    hintDisplay.textContent = '';
    hintDisplay.style.display = 'none';
    hintDisplay.classList.remove('active');
  }
  updateHintDisplay();
}

function clearPasswordFields() {
  if (currentPasswordInput) currentPasswordInput.value = '';
  if (newPasswordInput) newPasswordInput.value = '';
  if (confirmPasswordInput) confirmPasswordInput.value = '';
  if (passwordError) passwordError.textContent = '';
  if (passwordSuccess) passwordSuccess.textContent = '';
  if (adminNewPassword) adminNewPassword.value = '';
  if (adminError) adminError.textContent = '';
  if (adminSuccess) adminSuccess.textContent = '';
}

// Update login avatar and load saved password based on selection
function updateLoginAvatar() {
  const selectedUser = userSelect.value;
  if (selectedUser && usersList[selectedUser]) {
    loginAvatar.src = usersList[selectedUser].profilePicture || 'profiles/default.svg';
    // Load saved password for this user
    const savedPasswords = JSON.parse(localStorage.getItem('savedPasswords') || '{}');
    if (savedPasswords[selectedUser]) {
      loginPassword.value = savedPasswords[selectedUser];
    } else {
      loginPassword.value = '';
    }
  } else {
    loginAvatar.src = 'profiles/default.svg';
    loginPassword.value = '';
  }
}

socket.emit('getUserList');

socket.on('userList', (users) => {
  usersList = users;
  userSelect.innerHTML = '<option value="">Selecciona tu cuenta pringao</option>';

  const sortedUsers = Object.keys(users).sort((a, b) => a.localeCompare(b));
  for (const username of sortedUsers) {
    const option = document.createElement('option');
    option.value = username;
    option.textContent = username;
    userSelect.appendChild(option);
  }

  const lastUser = localStorage.getItem('lastUser');
  if (lastUser && users[lastUser]) {
    userSelect.value = lastUser;
    updateLoginAvatar();
  }
});

userSelect.addEventListener('change', () => {
  updateLoginAvatar();
});

loginBtn.addEventListener('click', () => {
  const selectedUser = userSelect.value;
  const password = loginPassword.value;

  if (!selectedUser) {
    loginError.textContent = 'Selecciona tu cuenta';
    return;
  }

  if (!password) {
    loginError.textContent = 'Introduce tu contraseña';
    return;
  }

  loginError.textContent = '';

  // Save selection and password if remember me is checked
  if (rememberMe.checked) {
    localStorage.setItem('lastUser', selectedUser);
    const savedPasswords = JSON.parse(localStorage.getItem('savedPasswords') || '{}');
    savedPasswords[selectedUser] = password;
    localStorage.setItem('savedPasswords', JSON.stringify(savedPasswords));
  }

  socket.emit('login', { username: selectedUser, password: password });
});

// Login result
socket.on('loginResult', ({ success, user, error }) => {
  if (success) {
    currentUser = user;
    window.currentUser = user; // Expose for typing.js
    window.currentUsername = user.username; // Expose for drawing.js
    window.currentProfilePicture = user.profilePicture || 'profiles/default.svg'; // Expose for drawing.js

    // Update chat module with current user
    vgmChat.setCurrentUser(user);

    // Play logon sound
    playLogonSound();

    // Update hub screen
    hubAvatar.src = user.profilePicture || 'profiles/default.svg';
    hubUsername.textContent = user.username;

    // Update VGM menu screen
    userAvatar.src = user.profilePicture || 'profiles/default.svg';
    userDisplayName.textContent = user.username;

    if (user.isAdmin) {
      if (hubAdminIndicator) hubAdminIndicator.textContent = '[Admin]';
      if (adminIndicator) adminIndicator.textContent = '[Admin]';
    } else {
      if (hubAdminIndicator) hubAdminIndicator.textContent = '';
      if (adminIndicator) adminIndicator.textContent = '';
    }

    showScreen('hub');
  } else {
    loginError.textContent = error;
  }
});

// Kicked (logged in from elsewhere)
socket.on('kicked', ({ reason }) => {
  alert(reason);
  currentUser = null;
  showScreen('login');
});

// ==================== HUB NAVIGATION ====================

// VGM button - go to VGM menu
vgmBtn.addEventListener('click', () => {
  // Join the single global VGM lobby directly
  socket.emit('joinVGM');
});

// Back to hub button
backToHubBtn.addEventListener('click', () => {
  showScreen('hub');
});

// Hub logout
hubLogoutBtn.addEventListener('click', () => {
  playLogoffSound();
  socket.emit('logout');
  currentUser = null;
  currentRoom = null;
  showScreen('login');
});

// ==================== PROFILE MODAL ====================

// Open profile popup from hub (same as in game)
hubUserInfo.addEventListener('click', () => {
  if (currentUser) {
    socket.emit('getPlayerProfile', { username: currentUser.username });
  }
});

// Open profile modal from VGM menu
userInfoBtn.addEventListener('click', () => {
  socket.emit('getProfile');
  profileModal.classList.add('active');
  clearPasswordFields();
});

// Setup modal close handlers
setupModalClose(profileModal, profileClose);

// ==================== PLAYER PROFILE POPUP ====================
setupModalClose(playerProfilePopup, popupProfileClose);

socket.on('playerProfileData', ({ user, recordsHeld }) => {
  if (!user) return;

  popupProfileAvatar.src = user.profilePicture || 'profiles/default.svg';
  popupProfileUsername.textContent = user.username;

  const stats = user.stats || {};
  popupStatGamesPlayed.textContent = stats.gamesPlayed || 0;
  popupStatGamesGuessed.textContent = stats.gamesGuessed || 0;
  popupStatSongsGuessed.textContent = stats.songsGuessed || 0;
  popupStatSuperSonics.textContent = stats.superSonics || 0;
  popupStatTotalPoints.textContent = stats.totalPoints || 0;
  popupStatHintsUsed.textContent = stats.hintsUsed || 0;
  if (popupStatRecordsHeld) popupStatRecordsHeld.textContent = recordsHeld || 0;

  const gameHistory = stats.gameHistory || {};
  const entries = Object.entries(gameHistory);
  if (entries.length > 0) {
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    popupMostGuessed.textContent = `${sorted[0][0]} (${sorted[0][1]}x)`;
  } else {
    popupMostGuessed.textContent = 'Ninguno todavia';
  }

  playerProfilePopup.classList.add('active');
});

// Profile data received
socket.on('profileData', ({ user, users }) => {
  profileAvatar.src = user.profilePicture || 'profiles/default.svg';
  profileUsername.textContent = user.username;

  const stats = user.stats || {};
  statGamesPlayed.textContent = stats.gamesPlayed || 0;
  statGamesGuessed.textContent = stats.gamesGuessed || 0;
  statSongsGuessed.textContent = stats.songsGuessed || 0;
  statSuperSonics.textContent = stats.superSonics || 0;
  statTotalPoints.textContent = stats.totalPoints || 0;
  statHintsUsed.textContent = stats.hintsUsed || 0;

  // Most guessed game
  const gameHistory = stats.gameHistory || {};
  let maxGame = null;
  let maxCount = 0;
  for (const [game, count] of Object.entries(gameHistory)) {
    if (count > maxCount) {
      maxCount = count;
      maxGame = game;
    }
  }

  if (maxGame) {
    mostGuessedGame.textContent = `${maxGame} (${maxCount} times)`;
  } else {
    mostGuessedGame.textContent = 'No games guessed yet';
  }

  // Admin section
  if (user.isAdmin && users) {
    adminSection.style.display = 'block';
    adminUserSelect.innerHTML = '<option value="">Select user...</option>';
    users.forEach(u => {
      if (u !== user.username) {
        const option = document.createElement('option');
        option.value = u;
        option.textContent = u;
        adminUserSelect.appendChild(option);
      }
    });
  } else {
    adminSection.style.display = 'none';
  }
});

changePasswordBtn.addEventListener('click', () => {
  const current = currentPasswordInput.value;
  const newPwd = newPasswordInput.value;
  const confirm = confirmPasswordInput.value;

  passwordError.textContent = '';
  passwordSuccess.textContent = '';

  if (!current || !newPwd || !confirm) {
    passwordError.textContent = 'Please fill in all fields';
    return;
  }

  if (newPwd !== confirm) {
    passwordError.textContent = 'New passwords do not match';
    return;
  }

  if (newPwd.length < 4) {
    passwordError.textContent = 'Password must be at least 4 characters';
    return;
  }

  socket.emit('changePassword', { currentPassword: current, newPassword: newPwd });
});

socket.on('passwordChangeResult', ({ success, error }) => {
  if (success) {
    passwordSuccess.textContent = 'Password changed successfully';
    currentPasswordInput.value = '';
    newPasswordInput.value = '';
    confirmPasswordInput.value = '';
  } else {
    passwordError.textContent = error;
  }
});

// Admin reset password
adminResetBtn.addEventListener('click', () => {
  const targetUser = adminUserSelect.value;
  const newPwd = adminNewPassword.value;

  adminError.textContent = '';
  adminSuccess.textContent = '';

  if (!targetUser) {
    adminError.textContent = 'Please select a user';
    return;
  }

  if (!newPwd || newPwd.length < 4) {
    adminError.textContent = 'Password must be at least 4 characters';
    return;
  }

  socket.emit('adminResetPassword', { targetUsername: targetUser, newPassword: newPwd });
});

// Admin reset result
socket.on('adminResetResult', ({ success, error }) => {
  if (success) {
    adminSuccess.textContent = 'Password reset successfully';
    adminNewPassword.value = '';
    adminUserSelect.value = '';
  } else {
    adminError.textContent = error;
  }
});

// ==================== VGM LOBBY EVENT LISTENERS ====================

// Create lobby
createLobbyBtn.addEventListener('click', () => {
  if (!currentUser) {
    alert('Please log in first');
    return;
  }
  socket.emit('createLobby', currentUser.username);
});

// Join lobby
joinLobbyBtn.addEventListener('click', () => {
  if (!currentUser) {
    alert('Please log in first');
    return;
  }

  const roomCode = roomCodeInput.value.trim().toUpperCase();

  if (roomCode.length !== 4) {
    alert('Please enter a 4-letter room code');
    return;
  }

  socket.emit('joinLobby', { roomCode, name: currentUser.username });
});

// Allow Enter key to join
roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') joinLobbyBtn.click();
});

// Start round
startGameBtn.addEventListener('click', () => {
  socket.emit('startRound');
});

// Start round from game screen toolbar
if (startRoundBtnGame) {
  startRoundBtnGame.addEventListener('click', () => {
    socket.emit('startRound');
  });
}

// Back to menu from game screen
if (backToHubGame) {
  backToHubGame.addEventListener('click', () => {
    // Stop audio and reset game state
    audioPlayer.pause();
    audioPlayer.currentTime = 0;
    audioPlayer.src = '';
    timerManager.clearByPrefix('vgm-'); // Clear all VGM timers
    roundActive = false;
    gameMessages.innerHTML = ''; // Clear chat

    socket.emit('leaveRoom');
    currentRoom = null;
    showScreen('hub');
  });
}

// Request hint
function requestHint() {
  socket.emit('requestHint');
}

// Submit guess
function submitGuess() {
  const guess = guessInput.value.trim();
  if (guess) {
    if (guess === '?') {
      guessInput.value = '';
      requestHint();
      return;
    }

    // Add to message history
    if (messageHistory.length === 0 || messageHistory[0] !== guess) {
      messageHistory.unshift(guess);
      if (messageHistory.length > MAX_MESSAGE_HISTORY) {
        messageHistory.pop();
      }
    }
    messageHistoryIndex = -1; // Reset history index

    // Don't show locally - server broadcasts to all including sender
    socket.emit('guess', guess);
    guessInput.value = '';
  }
}

guessBtn.addEventListener('click', submitGuess);
guessInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitGuess();
  }
  // UP arrow or TAB to cycle through message history
  else if ((e.key === 'ArrowUp' || e.key === 'Tab') && messageHistory.length > 0) {
    e.preventDefault();
    if (messageHistoryIndex < messageHistory.length - 1) {
      messageHistoryIndex++;
      guessInput.value = messageHistory[messageHistoryIndex];
      // Move cursor to end
      guessInput.setSelectionRange(guessInput.value.length, guessInput.value.length);
    }
  }
  // DOWN arrow to go back in history
  else if (e.key === 'ArrowDown' && messageHistory.length > 0) {
    e.preventDefault();
    if (messageHistoryIndex > 0) {
      messageHistoryIndex--;
      guessInput.value = messageHistory[messageHistoryIndex];
      guessInput.setSelectionRange(guessInput.value.length, guessInput.value.length);
    } else if (messageHistoryIndex === 0) {
      messageHistoryIndex = -1;
      guessInput.value = '';
    }
  }
});

hintBtn.addEventListener('click', requestHint);

if (voteExtendBtn) {
  voteExtendBtn.addEventListener('click', () => {
    if (!hasVotedExtend && !vgmTimer.isFading() && roundActive) {
      socket.emit('voteExtend');
      hasVotedExtend = true;
      voteExtendBtn.disabled = true;
      voteExtendBtn.style.opacity = '0.5';
    }
  });
}

if (volumeSlider) {
  volumeSlider.addEventListener('input', () => {
    audioPlayer.volume = volumeSlider.value / 100;
    originalVolume = audioPlayer.volume;
    vgmTimer.setOriginalVolume(audioPlayer.volume);
  });
}

// Nudge button with 2-minute cooldown
if (nudgeBtn) {
  nudgeBtn.addEventListener('click', () => {
    const now = Date.now();
    if (now < nudgeCooldownUntil) {
      return;
    }
    socket.emit('sendNudge');
    nudgeCooldownUntil = now + NUDGE_COOLDOWN_MS;
    nudgeBtn.disabled = true;
    // Re-enable after cooldown
    setTimeout(() => {
      nudgeBtn.disabled = false;
    }, NUDGE_COOLDOWN_MS);
  });
}

// Next round
nextRoundBtn.addEventListener('click', () => {
  resetRoundState();
  showScreen('game');
  socket.emit('startRound');
});

// Back to lobby
backToLobbyBtn.addEventListener('click', () => {
  resetRoundState();
  showScreen('lobby');
});

// ==================== SOCKET EVENTS ====================

// Lobby created
socketManager.on('lobbyCreated', ({ roomCode, playerName }) => {
  currentRoom = roomCode;
  roomCodeDisplay.textContent = roomCode;
  gameRoomCode.textContent = roomCode;
  showScreen('lobby');
}, 'vgm');

// Lobby joined
socketManager.on('lobbyJoined', ({ roomCode, playerName }) => {
  currentRoom = roomCode;
  roomCodeDisplay.textContent = roomCode;
  gameRoomCode.textContent = roomCode;
  showScreen('lobby');
}, 'vgm');

// VGM joined - go straight to game screen (single global lobby)
socketManager.on('vgmJoined', ({ roomCode, playerName, roundActive: isRoundActive, autoPlayActive: isAutoPlayActive, roundNumber: currentRoundNum, currentAudioToken, roundStartTime: serverRoundStartTime, roundDuration: serverRoundDuration }) => {
  currentRoom = roomCode;
  gameRoomCode.textContent = 'VGM';
  lastPlayerCount = 0; // Reset so we don't trigger notify on first update

  // Update user info on game screen
  if (currentUser) {
    gameUserAvatar.src = currentUser.profilePicture || 'profiles/default.svg';
    gameUserName.textContent = currentUser.username;
  }

  // Reset state for new join
  resetRoundState();

  // Go straight to game screen
  showScreen('game');

  // If round is active, sync with it
  if (isRoundActive && currentAudioToken) {
    roundActive = true;
    roundNumber.textContent = currentRoundNum;

    // Calculate elapsed time and remaining duration
    const elapsed = Date.now() - serverRoundStartTime;
    const remaining = serverRoundDuration - elapsed;

    if (remaining > 0) {
      // Calculate initial progress percentage for file transfer bar
      const initialProgress = (elapsed / serverRoundDuration) * 100;

      // Start playing the current song from the right position
      addFileTransfer(initialProgress);
      audioPlayer.src = `/audio-stream/${currentAudioToken}`;
      audioPlayer.currentTime = elapsed / 1000; // Sync to current position
      audioPlayer.play().catch(() => {});

      // Start timer with remaining time
      roundStartTime = serverRoundStartTime;
      roundDuration = serverRoundDuration;
      startTimer(serverRoundDuration);

      addMsnMessage('SQRRR', 'Te has unido a una ronda en progreso', false);
    }
  } else if (isAutoPlayActive) {
    // Game is in progress but between rounds - don't show start button
    addMsnMessage('SQRRR', 'Bienvenido a SQRRR VGM. Esperando siguiente ronda...', false);
  } else {
    // Game hasn't started - show welcome message and start button after chat history loads
    addMsnMessage('SQRRR', 'Bienvenido a SQRRR VGM', false);
    // Set flag to show start button after chat history
    window.showStartButtonAfterHistory = true;
  }
}, 'vgm');

// Player list update
socketManager.on('playerList', (players) => {
  // Play notify sound when a new player joins (count increased)
  if (players.length > lastPlayerCount && lastPlayerCount > 0) {
    playNotifySound();
  }
  lastPlayerCount = players.length;

  updatePlayerList(players, playerList);
  updatePlayerList(players, gamePlayerList);

  const me = players.find(p => p.id === socket.id);
  if (me && me.hintPoints !== undefined) {
    hintPoints = me.hintPoints;
    updateHintDisplay();
  }
}, 'vgm');

// Chat message
socketManager.on('chatMessage', ({ system, message }) => {
  addMessage(chatMessages, message, system ? 'system-message' : '');
}, 'vgm');

// Round start
socketManager.on('roundStart', ({ roundNumber: num, audioToken, duration }) => {
  log.info(`Round ${num} starting`);
  resetRoundState();
  roundActive = true; // Mark round as active
  roundNumber.textContent = num;
  showScreen('game');

  // Disable start button during round
  if (startRoundBtnGame) startRoundBtnGame.disabled = true;

  // Update MSN chat user info
  if (currentUser) {
    gameUserAvatar.src = currentUser.profilePicture || 'profiles/default.svg';
    gameUserName.textContent = currentUser.username;
  }

  // Don't clear chat - keep history! Just add file transfer
  addFileTransfer();

  audioPlayer.src = `/audio-stream/${audioToken}`;
  audioPlayer.currentTime = 0;

  // When audio metadata loads, send the actual file duration to server
  audioPlayer.onloadedmetadata = () => {
    const audioDurationMs = audioPlayer.duration * 1000;
    socket.emit('reportAudioDuration', { duration: audioDurationMs });
  };

  audioManager.resume(); // Use audioManager for better error handling

  startTimer(duration);
  guessInput.focus();
}, 'vgm');

// Click to play audio - only during active rounds
documentListeners.clickToPlay = (e) => {
  // Only allow click-to-play during active round and not when clicking buttons/inputs
  if (roundActive && audioPlayer.paused && audioPlayer.src &&
      !e.target.closest('button') && !e.target.closest('input') && !e.target.closest('textarea')) {
    audioPlayer.play().catch(() => {});
  }
};
document.addEventListener('click', documentListeners.clickToPlay);

// Guess result
socketManager.on('guessResult', ({ correct, type, sonicType, timeElapsed }) => {
  if (correct) {
    const time = timeElapsed || ((Date.now() - roundStartTime) / 1000);

    if (type === 'game') {
      guessedGame = true;
      if (gameStatus) gameStatus.classList.add('guessed');
      if (gameStatusValue) gameStatusValue.textContent = 'Correcto';
      if (gameStatusText) gameStatusText.textContent = '';
      guessInput.classList.add('pulse');
      hintBtn.disabled = true;
      if (hintDisplay) hintDisplay.classList.remove('active');

      addCorrectGuessMessage(currentUser.username, time, true, sonicType);

      if (sonicType) {
        addSonicBonusMessage(currentUser.username, sonicType);
      } else {
        // Play correct sound only when NOT in sonic time window
        audioManager.play('correct', { volume: 0.8 });
      }
    }
  } else {
    guessInput.classList.add('shake');
  }

  setTimeout(() => {
    guessInput.classList.remove('pulse', 'shake');
  }, 500);
}, 'vgm');

// Round complete - everyone guessed, but keep input enabled for chat
socketManager.on('roundComplete', () => {
  // Don't disable input - players should always be able to chat
  // guessInput.disabled = true;
  // guessBtn.disabled = true;
}, 'vgm');

// Someone guessed correctly
socketManager.on('correctGuess', ({ playerName, type, sonicType, timeElapsed }) => {
  // Only show if it's not the current user (they already see their own message)
  if (currentUser && playerName !== currentUser.username) {
    const time = timeElapsed || ((Date.now() - roundStartTime) / 1000);
    addCorrectGuessMessage(playerName, time, type === 'game', sonicType);

    if (sonicType) {
      addSonicBonusMessage(playerName, sonicType);
    }
  }
}, 'vgm');

// Hint result - show only as SQRRR chat message, not popup
socketManager.on('hintResult', ({ success, hint, hintPoints: newPoints, reason }) => {
  if (success) {
    hintPoints = newPoints;
    usedHintThisRound = true;
    updateHintDisplay();
    // Only show hint in chat as SQRRR message, no popup
    addMsnMessage('SQRRR', `Pista: ${hint}`, false);
  } else {
    addMsnMessage('SQRRR', reason, false);
  }
}, 'vgm');

// Someone used a hint
socketManager.on('playerUsedHint', ({ playerName }) => {
  if (currentUser && playerName !== currentUser.username) {
    addMsnMessage('', `${playerName} used a hint`, true);
  }
}, 'vgm');

// Round end - stay on game screen, sqrrr will send messages
socketManager.on('roundEnd', ({ correctGame, correctSong, players }) => {
  log.info('Round ended', { correctGame, correctSong });
  vgmTimer.stop();
  roundActive = false; // Mark round as inactive
  audioManager.pause();

  // Fill progress bar to 100% when round ends
  updateProgressSegments(100);

  // Store correct game/song for file name reveal
  currentCorrectGame = correctGame;
  currentCorrectSong = correctSong;
  vgmChat.setCorrectAnswer(correctGame, correctSong);

  // Don't show round end screen anymore - stay on game screen
  // sqrrr will send messages via sqrrrMessage event
  updatePlayerList(players, gamePlayerList);

  // Input stays enabled - players can always chat
  // Just disable guessing-specific buttons
  hintBtn.disabled = true;
  if (gameStatusText) gameStatusText.textContent = '';

  // Re-enable start button so players can start next round
  if (startRoundBtnGame) startRoundBtnGame.disabled = false;
}, 'vgm');

// Handle SQRRR messages (auto-play countdown)
socketManager.on('sqrrrMessage', ({ message, isBold, isRecord }) => {
  if (isRecord) {
    // Gold scrolling effect for records
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="msg-sender sqrrr-msg">SQRRR dice:</span><br><span class="msg-text record-text">${message}</span>`;
    gameMessages.appendChild(div);
    gameMessages.scrollTop = gameMessages.scrollHeight;
  } else {
    addMsnMessage('SQRRR', message, false, { isBold: isBold });
  }

  if (message.includes('La canción era')) {
    vgmChat.revealFileName();
  }
}, 'vgm');

// Handle coins earned (from correct guesses)
socketManager.on('coinsEarned', ({ amount, total }) => {
  showCoinAnimation(amount);
  log.info(`Earned ${amount} $qr, total: ${total}`);
}, 'vgm');

// Handle edit-based countdown
socketManager.on('sqrrrCountdown', ({ id, message }) => {
  let countdownDiv = countdownMessages[id];

  if (!countdownDiv) {
    countdownDiv = document.createElement('div');
    countdownDiv.className = 'chat-msg countdown-msg';
    countdownDiv.innerHTML = `<span class="msg-sender sqrrr-msg">SQRRR dice:</span><br><span class="msg-text countdown-text">${message}</span>`;
    gameMessages.appendChild(countdownDiv);
    countdownMessages[id] = countdownDiv;
  } else {
    countdownDiv.querySelector('.countdown-text').innerHTML = message;
  }

  gameMessages.scrollTop = gameMessages.scrollHeight;
}, 'vgm');

// Handle chat messages from all players (including self - server broadcasts to all)
socketManager.on('gameChatMessage', ({ sender, message, profilePicture, fontSettings }) => {
  // Pass sender's font settings so everyone sees their chosen style
  addMsnMessage(sender, message, false, { senderFontSettings: fontSettings });
}, 'vgm');

// Handle nudge received - shake screen and play sound
socketManager.on('nudgeReceived', () => {
  audioManager.play('nudge', { volume: 0.1 });
  const gameScreen = document.getElementById('game-screen');
  if (gameScreen) {
    gameScreen.classList.add('msn-shake');
    setTimeout(() => {
      gameScreen.classList.remove('msn-shake');
    }, 500);
  }
}, 'vgm');

// Handle close guess (private message to user with percentage)
socketManager.on('closeGuess', ({ guess, type, percentage }) => {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="msg-sender sqrrr-msg">SQRRR dice:</span><br><span class="msg-system">'${escapeHtml(guess)}' está ${percentage}% cerca</span>`;
  gameMessages.appendChild(div);
  gameMessages.scrollTop = gameMessages.scrollHeight;

  // Play close guess sound
  audioManager.play('close', { volume: 0.8 });
}, 'vgm');

// Handle easter eggs
socketManager.on('easterEgg', ({ type, message }) => {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.innerHTML = `<span class="msg-sender sqrrr-msg">SQRRR dice:</span><br><span class="msg-system">${escapeHtml(message)}</span>`;
  gameMessages.appendChild(div);
  gameMessages.scrollTop = gameMessages.scrollHeight;
}, 'vgm');

// Handle new record - play supersonic sound
socketManager.on('newRecord', ({ player, time, previousPlayer, previousTime }) => {
  audioManager.play('supersonic', { volume: 0.8 });
}, 'vgm');

socketManager.on('audioDurationUpdate', ({ duration }) => {
  fullAudioDuration = duration;
}, 'vgm');

socketManager.on('extendVotesUpdate', ({ votes, needed, totalPlayers }) => {
  if (extendVotesDisplay) {
    extendVotesDisplay.textContent = `${votes}/${needed}`;
  }
}, 'vgm');

socketManager.on('roundExtended', ({ newDuration }) => {
  isExtended = true;
  roundDuration = newDuration;
  vgmTimer.setDuration(newDuration);
  vgmTimer.restoreVolume();
  if (voteExtendBtn) {
    voteExtendBtn.disabled = true;
    voteExtendBtn.style.opacity = '0.5';
  }
  addMsnMessage('SQRRR', 'La ronda se ha extendido hasta el final de la canción', false);
}, 'vgm');

socketManager.on('chatHistory', (history) => {
  history.forEach(msg => {
    if (msg.type === 'guess') {
      addMsnMessage(msg.sender, msg.message, false);
    } else if (msg.type === 'system') {
      addMsnMessage(msg.sender, msg.message, false, { isBold: true });
    }
  });

  // Show start button after chat history loads (if flag was set)
  if (window.showStartButtonAfterHistory) {
    window.showStartButtonAfterHistory = false;
    addStartVGMButton();
  }
}, 'vgm');

// Error (global - stays with socket.on)
socket.on('error', (message) => {
  alert(message);
});

// Connection status
socket.on('connect', () => {
  log.info('Connected to server');
  // Request user list on reconnect
  socket.emit('getUserList');
});

socket.on('disconnect', () => {
  log.warn('Disconnected from server');
  alert('Conexión perdida con el servidor');
  currentUser = null;
  showScreen('login');
});

// ==================== FONT CUSTOMIZATION ====================

const fontBtn = document.getElementById('font-btn');
const fontPopup = document.getElementById('font-popup');
const fontSizeSelect = document.getElementById('font-size-select');
const fontColorInput = document.getElementById('font-color-input');
const nameColorInput = document.getElementById('name-color-input');
const fontEffectSelect = document.getElementById('font-effect-select');
const fontSaveBtn = document.getElementById('font-save-btn');

// Load saved preferences
if (fontSizeSelect) fontSizeSelect.value = userFontSize;
if (fontColorInput) fontColorInput.value = userFontColor;
if (nameColorInput) nameColorInput.value = userNameColor;
if (fontEffectSelect) fontEffectSelect.value = userTextEffect;

// Toggle font popup
if (fontBtn) {
  fontBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (fontPopup) {
      fontPopup.style.display = fontPopup.style.display === 'none' ? 'block' : 'none';
    }
  });
}

// Save font settings
if (fontSaveBtn) {
  fontSaveBtn.addEventListener('click', () => {
    userFontSize = fontSizeSelect.value;
    userFontColor = fontColorInput.value;
    userNameColor = nameColorInput.value;
    userTextEffect = fontEffectSelect.value;

    localStorage.setItem('chatFontSize', userFontSize);
    localStorage.setItem('chatFontColor', userFontColor);
    localStorage.setItem('chatNameColor', userNameColor);
    localStorage.setItem('chatTextEffect', userTextEffect);

    // Sync to chat module
    syncFontSettings();

    // Send font settings to server so others see our style
    socket.emit('updateFontSettings', {
      size: userFontSize,
      color: userFontColor,
      nameColor: userNameColor,
      effect: userTextEffect
    });

    if (fontPopup) fontPopup.style.display = 'none';
  });
}

// Close popup when clicking outside
documentListeners.fontPopupClose = (e) => {
  if (fontPopup && !fontPopup.contains(e.target) && e.target !== fontBtn) {
    fontPopup.style.display = 'none';
  }
};
document.addEventListener('click', documentListeners.fontPopupClose);

// ==================== EMOTICONS ====================
const emoticonBtn = document.getElementById('emoticon-btn');
const emoticonPopup = document.getElementById('emoticon-popup');

// Toggle emoticon popup
if (emoticonBtn) {
  emoticonBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (emoticonPopup) {
      emoticonPopup.style.display = emoticonPopup.style.display === 'none' ? 'block' : 'none';
      // Close font popup if open
      if (fontPopup) fontPopup.style.display = 'none';
    }
  });
}

// Handle emoticon clicks - insert code into input
if (emoticonPopup) {
  emoticonPopup.addEventListener('click', (e) => {
    if (e.target.tagName === 'IMG' && e.target.dataset.code) {
      const code = e.target.dataset.code;
      if (guessInput) {
        const start = guessInput.selectionStart;
        const end = guessInput.selectionEnd;
        const text = guessInput.value;
        guessInput.value = text.substring(0, start) + code + text.substring(end);
        guessInput.focus();
        guessInput.setSelectionRange(start + code.length, start + code.length);
      }
      emoticonPopup.style.display = 'none';
    }
  });
}

// Close emoticon popup when clicking outside
documentListeners.emoticonPopupClose = (e) => {
  if (emoticonPopup && !emoticonPopup.contains(e.target) && !emoticonBtn?.contains(e.target)) {
    emoticonPopup.style.display = 'none';
  }
};
document.addEventListener('click', documentListeners.emoticonPopupClose);

// ==================== WINDOW CONTROLS (drag and resize) ====================
// Delegated to windowControls module
const chatScreen = document.getElementById('game-screen');
const gameWindow = chatScreen ? chatScreen.querySelector('.game-window') : null;
const titlebar = gameWindow ? gameWindow.querySelector('.title-bar') : null;
const resizeHandles = gameWindow ? Array.from(gameWindow.querySelectorAll('.resize-handle')) : [];

windowControls.init({
  gameWindow,
  titlebar,
  resizeHandles,
  guessInput
}, documentListeners);

// ==================== TYPING INDICATOR ====================
const typingIndicator = document.getElementById('typing-indicator');
const typingIndicatorText = document.getElementById('typing-indicator-text');
let typingTimeout = null;
let isTyping = false;

// Debounced typing detection
guessInput.addEventListener('input', () => {
  if (!isTyping) {
    isTyping = true;
    socket.emit('startTyping');
  }

  // Reset timeout
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit('stopTyping');
  }, 1500);
});

// Listen for typing updates from server
socketManager.on('typingUpdate', ({ typing }) => {
  // Filter out own name
  const othersTyping = typing.filter(name => name !== currentUser?.username);

  if (othersTyping.length === 0) {
    typingIndicator.style.display = 'none';
  } else if (othersTyping.length === 1) {
    typingIndicatorText.textContent = `${othersTyping[0]} está escribiendo...`;
    typingIndicator.style.display = 'block';
  } else if (othersTyping.length === 2) {
    typingIndicatorText.textContent = `${othersTyping[0]} y ${othersTyping[1]} están escribiendo...`;
    typingIndicator.style.display = 'block';
  } else {
    const lastPerson = othersTyping.pop();
    typingIndicatorText.textContent = `${othersTyping.join(', ')} y ${lastPerson} están escribiendo...`;
    typingIndicator.style.display = 'block';
  }
}, 'vgm');

// ==================== LEADERBOARD (delegated to leaderboardUI module) ====================
leaderboardUI.init({ emit: (event, data) => socket.emit(event, data) });

// Bind open buttons
leaderboardUI.bindOpenButton(document.getElementById('hub-leaderboard-btn'), 'vgm');
leaderboardUI.bindOpenButton(document.getElementById('game-leaderboard-btn'), 'vgm');
leaderboardUI.bindOpenButton(document.getElementById('typing-leaderboard-btn'), 'typing');

// Receive leaderboard data
socket.on('leaderboardData', (data) => leaderboardUI.updateData(data));

// ==================== SLOT MACHINE POPUP ====================
// Add Tienda and slot popup buttons to the game screen toolbar
const gameToolbar = document.querySelector('#game-screen .game-toolbar');
if (gameToolbar) {
  // Tienda button (opens shop directly)
  const tiendaBtn = document.createElement('button');
  tiendaBtn.className = 'slot-popup-btn tienda-btn';
  tiendaBtn.title = 'Tienda';
  tiendaBtn.innerHTML = '\u{1F4B2}'; // Dollar sign emoji
  tiendaBtn.style.marginLeft = 'auto';
  gameToolbar.appendChild(tiendaBtn);

  // Initialize shop
  shopUI.init(socket);
  cardAlbumUI.init(socket);

  // Tienda button opens shop
  tiendaBtn.addEventListener('click', () => shopUI.open());

  // Slot popup button (opens gamba menu)
  const slotPopup = createSlotPopupButton(gameToolbar, socket, { position: 'right-no-margin' });
}
