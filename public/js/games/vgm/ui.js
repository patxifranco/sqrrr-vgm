import { timerManager, socketManager, escapeHtml } from '../../core/index.js';

let elements = null;
let state = null;
let log = null;
let cleanupCallback = null;

function init(config) {
  elements = config.elements;
  state = config.state;
  log = config.log;
  cleanupCallback = config.cleanupDocumentListeners;
}

function showScreen(screenName) {
  const previousScreen = state.currentScreen;

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

  Object.values(elements.screens).forEach(screen => {
    if (screen) screen.classList.remove('active');
  });

  if (elements.screens[screenName]) {
    elements.screens[screenName].classList.add('active');
    state.currentScreen = screenName;
  }
}

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

function resetRoundState() {
  state.guessedGame = false;
  state.usedHintThisRound = false;
  state.roundActive = false;
  state.hasVotedExtend = false;
  state.fadeOutStarted = false;
  state.isExtended = false;
  state.fullAudioDuration = null;

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

function setRoomCode(code) {
  if (elements.roomCodeDisplay) elements.roomCodeDisplay.textContent = code;
  if (elements.gameRoomCode) elements.gameRoomCode.textContent = code;
}

function setRoundNumber(num) {
  if (elements.roundNumber) elements.roundNumber.textContent = num;
}

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

function focusGuessInput() {
  if (elements.guessInput) elements.guessInput.focus();
}

function showGameGuessed() {
  if (elements.gameStatus) elements.gameStatus.classList.add('guessed');
  if (elements.gameStatusValue) elements.gameStatusValue.textContent = 'Correcto';
  if (elements.gameStatusText) elements.gameStatusText.textContent = '';
  if (elements.guessInput) {
    elements.guessInput.classList.add('pulse');
    setTimeout(() => elements.guessInput.classList.remove('pulse'), 500);
  }
}

function shakeInput() {
  if (elements.guessInput) {
    elements.guessInput.classList.add('shake');
    setTimeout(() => elements.guessInput.classList.remove('shake'), 500);
  }
}

function disableHint() {
  if (elements.hintBtn) elements.hintBtn.disabled = true;
  if (elements.hintDisplay) elements.hintDisplay.classList.remove('active');
}

function setStartButtonEnabled(enabled) {
  if (elements.startRoundBtnGame) elements.startRoundBtnGame.disabled = !enabled;
}

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

function shakeScreen() {
  const gameScreen = elements.screens?.game;
  if (gameScreen) {
    gameScreen.classList.add('msn-shake');
    setTimeout(() => gameScreen.classList.remove('msn-shake'), 500);
  }
}

function updateExtendVotes(votes, needed) {
  if (elements.extendVotesDisplay) {
    elements.extendVotesDisplay.textContent = `${votes}/${needed}`;
  }
}

function disableExtendVote() {
  if (elements.voteExtendBtn) {
    elements.voteExtendBtn.disabled = true;
    elements.voteExtendBtn.style.opacity = '0.5';
  }
}

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
