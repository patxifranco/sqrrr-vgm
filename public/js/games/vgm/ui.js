/**
 * VGM UI Module - User interface helper functions
 *
 * Handles:
 * - Screen management
 * - Player list updates
 * - Hint display
 * - Round state reset
 * - Various UI updates
 */

import { timerManager, socketManager, escapeHtml } from '../../core/index.js';

// DOM references
let elements = null;
let state = null;
let log = null;
let cleanupCallback = null;

/**
 * Initialize UI module with DOM elements and state
 * @param {Object} config - Configuration object
 */
function init(config) {
  elements = config.elements;
  state = config.state;
  log = config.log;
  cleanupCallback = config.cleanupDocumentListeners;
}

/**
 * Show a specific screen
 * @param {string} screenName - Screen to show
 */
function showScreen(screenName) {
  const previousScreen = state.currentScreen;

  // Cleanup when leaving game screens
  if (previousScreen === 'game' && screenName !== 'game') {
    timerManager.clearByPrefix('vgm-');
    socketManager.cleanupScope('vgm');
    if (cleanupCallback) cleanupCallback();
    if (elements.audioPlayer) {
      elements.audioPlayer.pause();
      elements.audioPlayer.src = '';
    }
    if (log) log.info('Left VGM game, cleaned up timers, socket listeners, and document listeners');
  }

  if (previousScreen === 'roundEnd' && screenName !== 'roundEnd') {
    timerManager.clear('vgm-reveal');
  }

  // Hide all screens
  Object.values(elements.screens).forEach(screen => {
    if (screen) screen.classList.remove('active');
  });

  // Show the requested screen
  if (elements.screens[screenName]) {
    elements.screens[screenName].classList.add('active');
    state.currentScreen = screenName;
  }
}

/**
 * Update player list display
 * @param {Array} players - Array of player objects
 */
function updatePlayerList(players) {
  const updateList = (listElement) => {
    if (!listElement) return;

    listElement.innerHTML = '';
    players
      .sort((a, b) => b.score - a.score)
      .forEach(player => {
        const li = document.createElement('li');
        const avatarSrc = player.profilePicture || 'profiles/default.svg';
        const hasStreak = player.streak > 0;

        const streakHtml = hasStreak
          ? `<span class="player-streak">Racha: ${player.streak}</span>`
          : '';

        li.innerHTML = `
          <img src="${avatarSrc}" class="player-avatar-small" alt="">
          <span class="player-name">${escapeHtml(player.name)}</span>
          <span class="player-score">${player.score} pts</span>
          ${streakHtml}
        `;
        if (player.guessedGame) {
          li.style.borderLeft = '3px solid #2ecc71';
        }
        if (player.guessedSong) {
          li.style.borderLeft = '3px solid #f39c12';
        }
        li.style.cursor = 'pointer';
        li.addEventListener('click', () => {
          if (state.socket) {
            state.socket.emit('getPlayerProfile', { username: player.username || player.name });
          }
        });
        listElement.appendChild(li);
      });
  };

  updateList(elements.playerList);
  updateList(elements.gamePlayerList);
}

/**
 * Update hint display
 */
function updateHintDisplay() {
  const { hintFill, hintPointsText, hintBtn } = elements;
  const hintPoints = state.hintPoints;
  const usedHintThisRound = state.usedHintThisRound;
  const guessedGame = state.guessedGame;

  const percent = (hintPoints / 8) * 100;
  if (hintFill) hintFill.style.width = percent + '%';
  if (hintPointsText) hintPointsText.textContent = `${hintPoints}/4`;

  if (hintBtn) {
    hintBtn.disabled = !(hintPoints >= 4 && !usedHintThisRound && !guessedGame);
  }
}

/**
 * Reset round state
 */
function resetRoundState() {
  state.guessedGame = false;
  state.usedHintThisRound = false;
  state.roundActive = false;
  state.hasVotedExtend = false;
  state.fadeOutStarted = false;
  state.isExtended = false;
  state.fullAudioDuration = null;

  // Restore volume if timer module is available
  if (state.restoreVolume) state.restoreVolume();

  const { gameStatus, gameStatusValue, gameStatusText, guessInput, guessBtn, voteExtendBtn, extendVotesDisplay, hintDisplay } = elements;

  if (gameStatus) gameStatus.classList.remove('guessed');
  if (gameStatusValue) gameStatusValue.textContent = 'Sin adivinar';
  if (gameStatusText) gameStatusText.textContent = '';
  if (guessInput) {
    guessInput.value = '';
    guessInput.disabled = false;
  }
  if (guessBtn) guessBtn.disabled = false;
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

/**
 * Set room code display
 * @param {string} code - Room code to display
 */
function setRoomCode(code) {
  if (elements.roomCodeDisplay) elements.roomCodeDisplay.textContent = code;
  if (elements.gameRoomCode) elements.gameRoomCode.textContent = code;
}

/**
 * Set round number display
 * @param {number} num - Round number
 */
function setRoundNumber(num) {
  if (elements.roundNumber) elements.roundNumber.textContent = num;
}

/**
 * Update game user info display
 */
function updateGameUserInfo() {
  if (state.currentUser) {
    if (elements.gameUserAvatar) {
      elements.gameUserAvatar.src = state.currentUser.profilePicture || 'profiles/default.svg';
    }
    if (elements.gameUserName) {
      elements.gameUserName.textContent = state.currentUser.username;
    }
  }
}

/**
 * Focus the guess input
 */
function focusGuessInput() {
  if (elements.guessInput) elements.guessInput.focus();
}

/**
 * Show game guessed state
 */
function showGameGuessed() {
  if (elements.gameStatus) elements.gameStatus.classList.add('guessed');
  if (elements.gameStatusValue) elements.gameStatusValue.textContent = 'Correcto';
  if (elements.gameStatusText) elements.gameStatusText.textContent = '';
  if (elements.guessInput) {
    elements.guessInput.classList.add('pulse');
    setTimeout(() => elements.guessInput.classList.remove('pulse'), 500);
  }
}

/**
 * Shake the input (wrong guess)
 */
function shakeInput() {
  if (elements.guessInput) {
    elements.guessInput.classList.add('shake');
    setTimeout(() => elements.guessInput.classList.remove('shake'), 500);
  }
}

/**
 * Disable hint button
 */
function disableHint() {
  if (elements.hintBtn) elements.hintBtn.disabled = true;
  if (elements.hintDisplay) elements.hintDisplay.classList.remove('active');
}

/**
 * Set start button enabled state
 * @param {boolean} enabled
 */
function setStartButtonEnabled(enabled) {
  if (elements.startRoundBtnGame) elements.startRoundBtnGame.disabled = !enabled;
}

/**
 * Play audio from URL
 * @param {string} src - Audio source URL
 * @param {number} startTime - Start time in seconds
 * @param {Function} onMetadataLoaded - Callback with duration in ms
 */
function playAudio(src, startTime = 0, onMetadataLoaded = null) {
  if (!elements.audioPlayer) return;

  elements.audioPlayer.src = src;
  elements.audioPlayer.currentTime = startTime;

  if (onMetadataLoaded) {
    elements.audioPlayer.onloadedmetadata = () => {
      onMetadataLoaded(elements.audioPlayer.duration * 1000);
    };
  }

  elements.audioPlayer.play().catch(() => {});
}

/**
 * Shake the game screen (nudge effect)
 */
function shakeScreen() {
  const gameScreen = elements.screens?.game;
  if (gameScreen) {
    gameScreen.classList.add('msn-shake');
    setTimeout(() => gameScreen.classList.remove('msn-shake'), 500);
  }
}

/**
 * Update extend votes display
 * @param {number} votes - Current votes
 * @param {number} needed - Votes needed
 */
function updateExtendVotes(votes, needed) {
  if (elements.extendVotesDisplay) {
    elements.extendVotesDisplay.textContent = `${votes}/${needed}`;
  }
}

/**
 * Disable extend vote button
 */
function disableExtendVote() {
  if (elements.voteExtendBtn) {
    elements.voteExtendBtn.disabled = true;
    elements.voteExtendBtn.style.opacity = '0.5';
  }
}

/**
 * Update typing indicator
 * @param {Array} othersTyping - Array of usernames currently typing
 */
function updateTypingIndicator(othersTyping) {
  const { typingIndicator, typingIndicatorText } = elements;
  if (!typingIndicator || !typingIndicatorText) return;

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
}

/**
 * Add message to lobby chat
 * @param {string} message - Message text
 * @param {boolean} isSystem - Is system message
 */
function addLobbyChatMessage(message, isSystem = false) {
  if (!elements.chatMessages) return;

  const p = document.createElement('p');
  p.className = isSystem ? 'system-message' : '';
  p.textContent = message;
  elements.chatMessages.appendChild(p);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

export const vgmUI = {
  init,
  showScreen,
  updatePlayerList,
  updateHintDisplay,
  resetRoundState,
  setRoomCode,
  setRoundNumber,
  updateGameUserInfo,
  focusGuessInput,
  showGameGuessed,
  shakeInput,
  disableHint,
  setStartButtonEnabled,
  playAudio,
  shakeScreen,
  updateExtendVotes,
  disableExtendVote,
  updateTypingIndicator,
  addLobbyChatMessage
};
