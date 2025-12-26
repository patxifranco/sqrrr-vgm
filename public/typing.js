// SQRRR Tikitiki - Typing Game
// ==================== CORE MODULES ====================
import { timerManager, socketManager, audioManager, logger, escapeHtml } from './js/core/index.js';
import { createSlotPopupButton } from './js/ui/slot-popup.js';
import { showCoinAnimation } from './js/ui/coin-animation.js';

// Get shared socket connection
const socket = socketManager.socket;

// Alias for backward compatibility
const TypingTimerManager = timerManager;

// Create scoped logger
const log = logger.scope('Typing');

// Track player count for notify sound
let typingLastPlayerCount = 0;

// ==================== DOM ELEMENTS ====================
const typingMenuScreen = document.getElementById('typing-menu-screen');
const typingLobbyScreen = document.getElementById('typing-lobby-screen');
const typingGameScreen = document.getElementById('typing-game-screen');
const typingResultsScreen = document.getElementById('typing-results-screen');

// Menu elements
const typingBtn = document.getElementById('typing-btn');
const typingBackToHubBtn = document.getElementById('typing-back-to-hub-btn');
const typingSoloBtn = document.getElementById('typing-solo-btn');
const typingVsBtn = document.getElementById('typing-vs-btn');
const typingCoopBtn = document.getElementById('typing-coop-btn');
const typingUserAvatar = document.getElementById('typing-user-avatar');
const typingUserName = document.getElementById('typing-user-name');
const typingTildesOff = document.getElementById('typing-tildes-off');
const typingTildesOn = document.getElementById('typing-tildes-on');

// Lobby elements
const typingPlayersContainer = document.getElementById('typing-players-container');
const typingSpectatorsContainer = document.getElementById('typing-spectators-container');
const typingLobbyStatusText = document.getElementById('typing-lobby-status-text');
const typingLobbyTildesMode = document.getElementById('typing-lobby-tildes-mode');
const typingLeaveRoomBtn = document.getElementById('typing-leave-room-btn');
const typingStartBtn = document.getElementById('typing-start-btn');
const typingJoinNextBtn = document.getElementById('typing-join-next-btn');
const typingSpectateBtn = document.getElementById('typing-spectate-btn');

// Game elements
const typingTimer = document.getElementById('typing-timer');
const typingWpm = document.getElementById('typing-wpm');
const typingAccuracy = document.getElementById('typing-accuracy');
const typingGamePlayers = document.getElementById('typing-game-players');
const typingGameSpectators = document.getElementById('typing-game-spectators');

// Solo controls
const typingSoloControls = document.getElementById('typing-solo-controls');
const typingSoloStartBtn = document.getElementById('typing-solo-start-btn');
const typingSoloRestartBtn = document.getElementById('typing-solo-restart-btn');
const typingSoloMenuBtn = document.getElementById('typing-solo-menu-btn');

// Mobile keyboard support
const typingHiddenInput = document.getElementById('typing-hidden-input');
let lastInputValue = '';

// Interactive keyboard in menu
const typingKeyboard = document.getElementById('typing-keyboard');

// Results elements (removed typingStatus as status bar was removed)
const typingResultsVs = document.getElementById('typing-results-vs');
const typingResultsRanking = document.getElementById('typing-results-ranking');
const typingFinalWpm = document.getElementById('typing-final-wpm');
const typingFinalAccuracy = document.getElementById('typing-final-accuracy');
const typingFinalChars = document.getElementById('typing-final-chars');
const typingFinalErrors = document.getElementById('typing-final-errors');
const typingPlayAgainBtn = document.getElementById('typing-play-again-btn');
const typingBackToMenuBtn = document.getElementById('typing-back-to-menu-btn');
const typingSpectatorJoinBtn = document.getElementById('typing-spectator-join-btn');

// ==================== GAME STATE ====================
let typingWords = [];
let typingFullText = '';
let typingCharIndex = 0;
let typingCorrectChars = 0;
let typingTotalTyped = 0;
let typingErrors = 0;
let typingStartTime = null;
let typingDuration = 60000;
let typingTimeRemaining = 60;
let typingGameActive = false;
let typingIsMultiplayer = false;
let typingIsSpectator = false;
let typingRoomCode = null;
let typingCurrentUser = null;
let typingPlayers = [];
let typingSpectators = [];
let typingTildesMode = false; // false = sin tildes, true = con tildes
let typingMyTextElement = null;

// Co-op state
let typingIsCoop = false;
let typingCoopRoomCode = null;
let typingCoopCurrentTyper = null;
let typingCoopWordsPerTurn = 20;

const SCRAMBLE_CHARS = '%/·&$#@!?*+-=<>[]{}()';

// ==================== SCREEN NAVIGATION ====================
function showTypingScreen(screenId) {
  document.querySelectorAll('.screen-container').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// ==================== INITIALIZATION ====================
function initTypingGame() {
  // Hub -> Typing Menu
  if (typingBtn) {
    typingBtn.addEventListener('click', () => {
      if (window.currentUser) {
        typingCurrentUser = window.currentUser;
        typingUserAvatar.src = typingCurrentUser.profilePicture || 'profiles/default.svg';
        typingUserName.textContent = typingCurrentUser.username;
      }
      showTypingScreen('typing-menu-screen');
    });
  }

  // Back to Hub
  typingBackToHubBtn.addEventListener('click', () => {
    // Cleanup typing game resources
    TypingTimerManager.clearByPrefix('typing-');
    socketManager.cleanupScope('typing');
    log.info('Left Typing game, cleaned up');
    showTypingScreen('hub-screen');
  });

  // Tildes mode toggle
  if (typingTildesOff) {
    typingTildesOff.addEventListener('click', () => {
      typingTildesMode = false;
      typingTildesOff.classList.add('active');
      typingTildesOn.classList.remove('active');
    });
  }

  if (typingTildesOn) {
    typingTildesOn.addEventListener('click', () => {
      typingTildesMode = true;
      typingTildesOn.classList.add('active');
      typingTildesOff.classList.remove('active');
    });
  }

  // Solo mode
  typingSoloBtn.addEventListener('click', () => {
    typingIsMultiplayer = false;
    typingIsSpectator = false;
    startTypingSoloGame();
  });

  // Vs mode - auto matchmaking
  typingVsBtn.addEventListener('click', () => {
    typingIsMultiplayer = true;
    typingIsSpectator = false;
    typingIsCoop = false;
    socket.emit('typingJoinVs', { tildesMode: typingTildesMode });
  });

  // Co-op mode - auto matchmaking
  if (typingCoopBtn) {
    typingCoopBtn.addEventListener('click', () => {
      typingIsMultiplayer = true;
      typingIsSpectator = false;
      typingIsCoop = true;
      socket.emit('typingJoinCoop', { tildesMode: typingTildesMode });
    });
  }

  // Leave room
  typingLeaveRoomBtn.addEventListener('click', () => {
    if (typingIsCoop) {
      socket.emit('leaveTypingCoopRoom');
    } else {
      socket.emit('leaveTypingRoom');
    }
    typingIsCoop = false;
    showTypingScreen('typing-menu-screen');
  });

  // Start button (host only)
  if (typingStartBtn) {
    typingStartBtn.addEventListener('click', () => {
      if (typingIsCoop) {
        socket.emit('typingCoopStartGame');
      } else {
        socket.emit('typingStartGame');
      }
    });
  }

  // Spectate button - player wants to become spectator
  if (typingSpectateBtn) {
    typingSpectateBtn.addEventListener('click', () => {
      socket.emit('typingBecomeSpectator');
    });
  }

  // Join next match (for spectators)
  if (typingJoinNextBtn) {
    typingJoinNextBtn.addEventListener('click', () => {
      socket.emit('typingSpectatorJoinNext');
    });
  }

  // Play again
  typingPlayAgainBtn.addEventListener('click', () => {
    if (typingIsMultiplayer) {
      if (typingIsCoop) {
        socket.emit('typingJoinCoop', { tildesMode: typingTildesMode });
      } else {
        socket.emit('typingJoinVs', { tildesMode: typingTildesMode });
      }
    } else {
      startTypingSoloGame();
    }
  });

  // Back to menu
  typingBackToMenuBtn.addEventListener('click', () => {
    if (typingIsMultiplayer) {
      if (typingIsCoop) {
        socket.emit('leaveTypingCoopRoom');
      } else {
        socket.emit('leaveTypingRoom');
      }
    }
    typingIsCoop = false;
    showTypingScreen('typing-menu-screen');
  });

  // Spectator join button on results
  if (typingSpectatorJoinBtn) {
    typingSpectatorJoinBtn.addEventListener('click', () => {
      socket.emit('typingSpectatorJoinNext');
    });
  }

  // Solo control buttons
  if (typingSoloStartBtn) {
    typingSoloStartBtn.addEventListener('click', startSoloCountdown);
  }
  if (typingSoloRestartBtn) {
    typingSoloRestartBtn.addEventListener('click', () => {
      startTypingSoloGame();
    });
  }
  if (typingSoloMenuBtn) {
    typingSoloMenuBtn.addEventListener('click', () => {
      TypingTimerManager.clearByPrefix('typing-');
      typingGameActive = false;
      showTypingScreen('typing-menu-screen');
    });
  }

  // Global keyboard listener
  document.addEventListener('keydown', handleGlobalKeydown);

  // Mobile keyboard support - input event handler
  if (typingHiddenInput) {
    typingHiddenInput.addEventListener('input', handleMobileInput);

    // Prevent form submission on enter
    typingHiddenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.preventDefault();
    });
  }

  // Interactive keyboard in menu - visual effect only
  if (typingKeyboard) {
    document.addEventListener('keydown', (e) => {
      if (!typingMenuScreen.classList.contains('active')) return;
      const key = e.key.toUpperCase();
      const keyEl = typingKeyboard.querySelector(`[data-key="${key}"]`);
      if (keyEl) keyEl.classList.add('active');
      // Space key
      if (e.key === ' ') {
        const spaceEl = typingKeyboard.querySelector('[data-key=" "]');
        if (spaceEl) spaceEl.classList.add('active');
      }
    });
    document.addEventListener('keyup', (e) => {
      if (!typingMenuScreen.classList.contains('active')) return;
      const key = e.key.toUpperCase();
      const keyEl = typingKeyboard.querySelector(`[data-key="${key}"]`);
      if (keyEl) keyEl.classList.remove('active');
      // Space key
      if (e.key === ' ') {
        const spaceEl = typingKeyboard.querySelector('[data-key=" "]');
        if (spaceEl) spaceEl.classList.remove('active');
      }
    });
  }

  // Setup socket listeners
  setupTypingSocketListeners();
}

// Handle mobile keyboard input
function handleMobileInput(e) {
  if (!typingGameScreen.classList.contains('active')) return;
  if (typingIsSpectator) return;
  if (!typingGameActive) return;

  const newValue = e.target.value;

  // Compare with last value to detect what changed
  if (newValue.length > lastInputValue.length) {
    // Characters added - process each new character
    const addedChars = newValue.slice(lastInputValue.length);
    for (const char of addedChars) {
      processTypedCharacter(char);
    }
  } else if (newValue.length < lastInputValue.length) {
    // Characters deleted - handle backspace
    const deletedCount = lastInputValue.length - newValue.length;
    for (let i = 0; i < deletedCount; i++) {
      handleBackspace();
    }
  }

  lastInputValue = newValue;

  // Clear input periodically to prevent buffer overflow
  if (newValue.length > 50) {
    e.target.value = '';
    lastInputValue = '';
  }
}

// Focus hidden input for mobile keyboard
function focusTypingInput() {
  if (typingHiddenInput) {
    typingHiddenInput.value = '';
    lastInputValue = '';
    typingHiddenInput.focus();
  }
}

// Allow tapping anywhere on game screen to focus input (for mobile)
if (typingGameScreen) {
  typingGameScreen.addEventListener('click', (e) => {
    // Don't focus if clicking buttons
    if (e.target.tagName === 'BUTTON') return;
    // Only focus if game is active
    if (typingGameActive && !typingIsSpectator) {
      focusTypingInput();
    }
  });
}

// ==================== SOCKET LISTENERS ====================
function setupTypingSocketListeners() {
  // Joined Vs lobby as player
  socket.on('typingVsJoined', (data) => {
    typingRoomCode = data.roomCode;
    typingPlayers = data.players;
    typingSpectators = data.spectators || [];
    typingIsMultiplayer = true;
    typingIsSpectator = false;
    typingLastPlayerCount = data.players.length + (data.spectators?.length || 0); // Reset count

    // Update tildes mode indicator
    if (typingLobbyTildesMode) {
      typingLobbyTildesMode.textContent = data.tildesMode ? 'Modo: Con tildes' : 'Modo: Sin tildes';
    }

    renderLobbyPlayers(data.players, data.spectators || [], data.isHost);
    updateStartButtonState(data.players.length, data.isHost);
    typingLobbyStatusText.textContent = data.players.length < 2
      ? 'Esperando jugadores...'
      : 'Listo cohone';
    showTypingScreen('typing-lobby-screen');
  });

  // Joined as spectator (game in progress)
  socket.on('typingJoinedAsSpectator', (data) => {
    typingRoomCode = data.roomCode;
    typingPlayers = data.players;
    typingSpectators = data.spectators || [];
    typingIsMultiplayer = true;
    typingIsSpectator = true;
    typingWords = data.words;

    // Go directly to game screen as spectator
    showTypingScreen('typing-game-screen');
    renderGameAsSpectator(data.players, data.spectators);
  });

  // Moved from spectator to player
  socket.on('typingJoinedFromSpectator', (data) => {
    typingIsSpectator = false;
    typingPlayers = data.players;
    typingSpectators = data.spectators || [];
    renderLobbyPlayers(data.players, data.spectators, data.isHost);
    updateStartButtonState(data.players.length, data.isHost);
    typingLobbyStatusText.textContent = data.players.length < 2
      ? 'Esperando jugadores...'
      : 'Listo cohone';
    showTypingScreen('typing-lobby-screen');
  });

  // Player list update
  socket.on('typingPlayerList', (data) => {
    // Play notify sound when a new player joins
    const totalCount = data.players.length + (data.spectators?.length || 0);
    if (totalCount > typingLastPlayerCount && typingLastPlayerCount > 0) {
      playNotifySound();
    }
    typingLastPlayerCount = totalCount;

    typingPlayers = data.players;
    typingSpectators = data.spectators || [];
    renderLobbyPlayers(data.players, data.spectators || [], data.isHost);
    updateStartButtonState(data.players.length, data.isHost);
    typingLobbyStatusText.textContent = data.players.length < 2
      ? 'Esperando jugadores...'
      : 'Listo cohone';
  });

  // Spectator list update (for spectators watching)
  socket.on('typingSpectatorList', (data) => {
    // Play notify sound when a spectator joins
    const totalCount = (data.players?.length || typingPlayers.length) + (data.spectators?.length || 0);
    if (totalCount > typingLastPlayerCount && typingLastPlayerCount > 0) {
      playNotifySound();
    }
    typingLastPlayerCount = totalCount;

    typingPlayers = data.players || typingPlayers;
    typingSpectators = data.spectators || [];
    if (typingIsSpectator && typingGameScreen.classList.contains('active')) {
      updateSpectatorPanel(data.spectators);
    }
    // Also update lobby if visible
    if (typingLobbyScreen.classList.contains('active')) {
      renderLobbyPlayers(data.players || typingPlayers, data.spectators, false);
    }
  });

  // Player became spectator
  socket.on('typingNowSpectator', (data) => {
    typingIsSpectator = true;
    typingPlayers = data.players;
    typingSpectators = data.spectators;
    // Stay in lobby but hide start button, show as spectating
    renderLobbyPlayers(data.players, data.spectators, false);
    typingLobbyStatusText.textContent = 'Modo Espectador';
    if (typingSpectateBtn) typingSpectateBtn.style.display = 'none';
    if (typingStartBtn) typingStartBtn.style.display = 'none';
  });

  // Countdown
  socket.on('typingCountdown', (data) => {
    typingPlayers = data.players;
    typingSpectators = data.spectators || [];
    showGameWithCountdown(data.seconds, data.players, data.spectators, typingIsSpectator);
  });

  // Game start
  socket.on('typingStart', (data) => {
    typingPlayers = data.players;
    typingSpectators = data.spectators || [];
    if (typingIsSpectator) {
      startTypingGameAsSpectator(data.words, data.players, data.spectators);
    } else {
      startTypingGameMultiplayer(data.words, data.players, data.spectators);
    }
  });

  // Opponent progress
  socket.on('typingOpponentProgress', (data) => {
    updateOpponentProgress(data);
  });

  // Round end
  socket.on('typingRoundEnd', (data) => {
    endTypingGame(data);
  });

  // Spectator can join next
  socket.on('typingCanJoinNext', (data) => {
    typingPlayers = data.players;
    typingSpectators = data.spectators;
    // Enable join button if showing results
    if (typingSpectatorJoinBtn) {
      typingSpectatorJoinBtn.disabled = false;
      typingSpectatorJoinBtn.textContent = 'Unirse al Siguiente';
    }
  });

  // Error
  socket.on('typingError', (data) => {
    alert(data.message);
  });

  // Coins earned
  socket.on('coinsEarned', ({ amount, total }) => {
    showCoinAnimation(amount);
    log.info(`Earned ${amount} $qr, total: ${total}`);
  });

  // ==================== CO-OP SOCKET LISTENERS ====================

  // Joined Co-op lobby
  socket.on('typingCoopJoined', (data) => {
    typingCoopRoomCode = data.roomCode;
    typingPlayers = data.players;
    typingIsCoop = true;
    typingIsSpectator = false;
    typingLastPlayerCount = data.players.length; // Reset count

    // Update lobby title for Co-op
    const lobbyTitle = document.querySelector('#typing-lobby-screen .title-bar-text');
    if (lobbyTitle) lobbyTitle.textContent = 'SQRRR Tikitiki - Co-op';

    // Update tildes mode indicator
    if (typingLobbyTildesMode) {
      typingLobbyTildesMode.textContent = data.tildesMode ? 'Modo: Con tildes' : 'Modo: Sin tildes';
    }

    // Show spectate button in Co-op
    if (typingSpectateBtn) {
      typingSpectateBtn.style.display = '';
      typingSpectateBtn.onclick = () => socket.emit('typingCoopBecomeSpectator');
    }

    // Show join next button for spectators
    if (typingJoinNextBtn) {
      typingJoinNextBtn.style.display = 'none';
      typingJoinNextBtn.onclick = () => socket.emit('typingCoopSpectatorJoinNext');
    }

    renderLobbyPlayers(data.players, data.spectators || [], data.isHost);
    updateStartButtonState(data.players.length, data.isHost);
    typingLobbyStatusText.textContent = data.players.length < 2
      ? 'Esperando jugadores...'
      : 'Lesgo';
    showTypingScreen('typing-lobby-screen');
  });

  // Co-op player list update
  socket.on('typingCoopPlayerList', (data) => {
    // Play notify sound when a new player joins
    if (data.players.length > typingLastPlayerCount && typingLastPlayerCount > 0) {
      playNotifySound();
    }
    typingLastPlayerCount = data.players.length;

    typingPlayers = data.players;
    renderLobbyPlayers(data.players, [], data.isHost);
    updateStartButtonState(data.players.length, data.isHost);
    typingLobbyStatusText.textContent = data.players.length < 2
      ? 'Esperando jugadores...'
      : 'Lesgo';
  });

  // Co-op countdown
  socket.on('typingCoopCountdown', (data) => {
    typingPlayers = data.players;
    typingCoopCurrentTyper = data.currentTyper;
    showCoopGameWithCountdown(data.seconds, data.players, data.currentTyper);
  });

  // Co-op game start
  socket.on('typingCoopStart', (data) => {
    typingPlayers = data.players;
    typingCoopCurrentTyper = data.currentTyper;
    typingCoopWordsPerTurn = data.wordsPerTurn;
    startTypingCoopGame(data.words, data.fullText, data.players, data.currentTyper);
  });

  // Co-op progress update
  socket.on('typingCoopProgress', (data) => {
    updateCoopProgress(data);
  });

  // Co-op turn change
  socket.on('typingCoopTurnChange', (data) => {
    typingCoopCurrentTyper = data.currentTyper;
    typingPlayers = data.players;
    handleCoopTurnChange(data);
  });

  // Co-op round end
  socket.on('typingCoopRoundEnd', (data) => {
    endTypingCoopGame(data);
  });

  // Co-op: Joined as spectator (game in progress)
  socket.on('typingCoopJoinedAsSpectator', (data) => {
    typingCoopRoomCode = data.roomCode;
    typingPlayers = data.players;
    typingIsCoop = true;
    typingIsSpectator = true;
    typingWords = data.words;
    typingFullText = data.fullText;
    typingCharIndex = data.charIndex;
    typingCoopCurrentTyper = data.currentTyper;

    // Go directly to game screen as spectator
    showTypingScreen('typing-game-screen');
    renderCoopGameAsSpectator(data.players, data.charIndex, data.currentTyper);
  });

  // Co-op: Player became spectator
  socket.on('typingCoopNowSpectator', (data) => {
    typingIsSpectator = true;
    typingPlayers = data.players;
    // Stay in lobby but hide start button, show as spectating
    renderLobbyPlayers(data.players, data.spectators || [], false);
    typingLobbyStatusText.textContent = 'Modo Espectador';
    if (typingSpectateBtn) typingSpectateBtn.style.display = 'none';
    if (typingStartBtn) typingStartBtn.style.display = 'none';
  });

  // Co-op: Joined from spectator to player
  socket.on('typingCoopJoinedFromSpectator', (data) => {
    typingIsSpectator = false;
    typingPlayers = data.players;
    renderLobbyPlayers(data.players, data.spectators || [], data.isHost);
    updateStartButtonState(data.players.length, data.isHost);
    typingLobbyStatusText.textContent = data.players.length < 2
      ? 'Esperando jugadores...'
      : 'Lesgo';
    showTypingScreen('typing-lobby-screen');
  });

  // Co-op: Spectator list update
  socket.on('typingCoopSpectatorList', (data) => {
    // Update lobby display if visible
    if (typingLobbyScreen.classList.contains('active')) {
      const specContainer = document.getElementById('typing-spectators-container');
      if (specContainer && data.spectators && data.spectators.length > 0) {
        specContainer.innerHTML = `
          <div class="typing-spectators-header">Espectadores (${data.spectators.length})</div>
          <div class="typing-spectators-list">
            ${data.spectators.map(s => `<span class="typing-spectator-name">${s.name}</span>`).join(', ')}
          </div>
        `;
      } else if (specContainer) {
        specContainer.innerHTML = '';
      }
    }
  });

  // Co-op: Can join next (after game ends)
  socket.on('typingCoopCanJoinNext', (data) => {
    typingPlayers = data.players;
    // Enable join button if showing results
    if (typingSpectatorJoinBtn) {
      typingSpectatorJoinBtn.disabled = false;
      typingSpectatorJoinBtn.textContent = 'Unirse al Siguiente';
    }
  });
}

// ==================== START BUTTON STATE ====================
function updateStartButtonState(playerCount, isHost) {
  if (!typingStartBtn) return;

  if (isHost) {
    typingStartBtn.style.display = 'inline-block';
    typingStartBtn.disabled = playerCount < 2;
  } else {
    typingStartBtn.style.display = 'none';
  }
}

// ==================== LOBBY RENDERING ====================
function renderLobbyPlayers(players, spectators, isHost) {
  if (!typingPlayersContainer) return;
  typingPlayersContainer.innerHTML = '';

  players.forEach((player, index) => {
    const box = document.createElement('div');
    box.className = 'typing-lobby-player';
    if (player.id === socket.id) box.classList.add('is-self');

    box.innerHTML = `
      <img class="typing-lobby-avatar" src="${player.profilePicture || 'profiles/default.svg'}" alt="${player.name}">
      <span class="typing-lobby-name">${player.name}</span>
    `;
    typingPlayersContainer.appendChild(box);
  });

  // Render spectators
  if (typingSpectatorsContainer) {
    typingSpectatorsContainer.innerHTML = '';
    if (spectators && spectators.length > 0) {
      typingSpectatorsContainer.innerHTML = `
        <div class="typing-spectators-header">Espectadores (${spectators.length})</div>
        <div class="typing-spectators-list">
          ${spectators.map(s => `<span class="typing-spectator-name">${s.name}</span>`).join(', ')}
        </div>
      `;
    }
  }

  // Update start button
  updateStartButtonState(players.length, isHost);
}

// ==================== COUNTDOWN ====================
function showGameWithCountdown(seconds, players, spectators, isSpectator) {
  showTypingScreen('typing-game-screen');
  typingPlayers = players;
  typingSpectators = spectators || [];

  // Remove solo-mode class for multiplayer
  const gameWindow = document.querySelector('.typing-game-window');
  if (gameWindow) {
    gameWindow.classList.remove('solo-mode');
  }

  // Render player boxes with countdown
  renderGamePlayers(players, spectators, true, seconds, isSpectator);
}

function renderGamePlayers(players, spectators, isCountdown, countdownNum, isSpectator) {
  if (!typingGamePlayers) return;
  typingGamePlayers.innerHTML = '';

  // Calculate grid layout
  const playerCount = players.length;
  let columns = 1;
  if (playerCount >= 6) columns = 3;
  else if (playerCount >= 4) columns = 2;

  typingGamePlayers.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  typingGamePlayers.className = `typing-game-players cols-${columns}`;

  players.forEach((player, index) => {
    const box = document.createElement('div');
    box.className = 'typing-player-box';
    box.dataset.playerId = player.id;
    const isSelf = player.id === socket.id;
    if (isSelf) box.classList.add('is-self');

    const textDiv = document.createElement('div');
    textDiv.className = 'typing-player-text';
    textDiv.id = `typing-text-${player.id}`;

    if (isCountdown && countdownNum > 0) {
      // Show countdown numbers
      textDiv.innerHTML = `<div class="typing-countdown-text">${countdownNum}</div>`;
    } else if (isCountdown && countdownNum <= 0) {
      // Show GO
      textDiv.innerHTML = `<div class="typing-countdown-text">GO</div>`;
    } else if (typingWords && typingWords.length > 0) {
      // Show actual words (for spectators and pre-game)
      const text = typingWords.join(' ');
      textDiv.innerHTML = renderTypingText(text, false);
    } else {
      // Fallback - waiting for words
      textDiv.innerHTML = '<span style="color: #999;">Esperando...</span>';
    }

    box.innerHTML = `
      <div class="typing-player-info">
        <img class="typing-player-avatar" src="${player.profilePicture || 'profiles/default.svg'}" alt="${player.name}">
        <div class="typing-player-name">${player.name}</div>
        <div class="typing-player-wpm" id="wpm-${player.id}">0 WPM</div>
      </div>
    `;
    box.appendChild(textDiv);
    typingGamePlayers.appendChild(box);

    // Store reference to own text element
    if (isSelf && !isSpectator) {
      typingMyTextElement = textDiv;
    }
  });

  // Update spectator panel
  updateSpectatorPanel(spectators);
}

function updateSpectatorPanel(spectators) {
  if (!typingGameSpectators) return;

  if (spectators && spectators.length > 0) {
    const names = spectators.map(s => s.name).join(', ');
    typingGameSpectators.style.display = 'block';
    typingGameSpectators.innerHTML = `
      <div class="typing-spectators-panel">
        <span class="typing-spectators-icon">👁</span>
        <span class="typing-spectators-names">Espectando: ${names}</span>
      </div>
    `;
  } else {
    typingGameSpectators.style.display = 'none';
  }
}

function generateScrambledText(length) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += `<span class="typing-char scrambled">${SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]}</span>`;
    if (i < length - 1 && Math.random() > 0.7) {
      result += `<span class="typing-char scrambled"> </span>`;
    }
  }
  return result;
}

function renderScrambledText(text) {
  // Render the text as scrambled characters (for waiting state)
  return generateScrambledText(Math.min(text.length, 200));
}

// ==================== SPECTATOR MODE ====================
function renderGameAsSpectator(players, spectators) {
  renderGamePlayers(players, spectators, false, 0, true);
}

function startTypingGameAsSpectator(words, players, spectators) {
  typingWords = words;
  typingPlayers = players;
  typingSpectators = spectators;
  typingFullText = words.join(' ');
  typingTimeRemaining = 60;
  typingGameActive = true;

  // Update UI
  typingTimer.textContent = '60';

  // Render players
  renderGamePlayersForGame(players, spectators, true);

  // Start timer display
  startSpectatorTimer();
}

function startSpectatorTimer() {
  typingTimeRemaining = 60;
  TypingTimerManager.setInterval('typing-spectator-timer', () => {
    typingTimeRemaining--;
    typingTimer.textContent = typingTimeRemaining;
    if (typingTimeRemaining <= 0) {
      TypingTimerManager.clear('typing-spectator-timer');
    }
  }, 1000);
}

// ==================== SOLO GAME ====================
async function startTypingSoloGame() {
  try {
    // Load words based on tildes mode
    const wordFile = typingTildesMode ? '/words-es-con-tildes.json' : '/words-es-sin-tildes.json';
    const response = await fetch(wordFile);
    const data = await response.json();
    typingWords = shuffleArray([...data.words]).slice(0, 120);

    // Create solo player
    typingPlayers = [{
      id: 'solo',
      name: typingCurrentUser?.username || 'Player',
      profilePicture: typingCurrentUser?.profilePicture || 'profiles/default.svg'
    }];

    // Show waiting screen with Empezar button
    showSoloWaitingScreen(typingWords);
  } catch (error) {
    console.error('Error loading words:', error);
    alert('Error cargando palabras');
  }
}

function showSoloWaitingScreen(words) {
  // Clear any existing timer from previous game
  TypingTimerManager.clearByPrefix('typing-');

  typingFullText = words.join(' ');
  typingCharIndex = 0;
  typingCorrectChars = 0;
  typingTotalTyped = 0;
  typingErrors = 0;
  typingStartTime = null;
  typingTimeRemaining = 60;
  typingGameActive = false;

  // Reset UI
  typingTimer.textContent = '60';
  typingWpm.textContent = '0';
  typingAccuracy.textContent = '100%';

  // Add solo-mode class
  const gameWindow = document.querySelector('.typing-game-window');
  if (gameWindow) {
    gameWindow.classList.add('solo-mode');
    gameWindow.classList.remove('coop-mode');
  }

  // Show game screen
  showTypingScreen('typing-game-screen');

  // Show solo controls with Empezar button, hide Restart
  if (typingSoloControls) {
    typingSoloControls.style.display = 'flex';
    typingSoloStartBtn.style.display = '';
    typingSoloRestartBtn.style.display = 'none';
  }

  // Show back tab button for solo mode
  if (typingSoloMenuBtn) {
    typingSoloMenuBtn.style.display = '';
  }

  // Render player box with scrambled text (waiting state)
  renderSoloWaitingPlayer();
}

function renderSoloWaitingPlayer() {
  if (!typingGamePlayers) return;
  typingGamePlayers.innerHTML = '';
  typingGamePlayers.style.gridTemplateColumns = '1fr';
  typingGamePlayers.className = 'typing-game-players cols-1';

  const player = typingPlayers[0];
  const box = document.createElement('div');
  box.className = 'typing-player-box is-self';
  box.dataset.playerId = player.id;

  const textDiv = document.createElement('div');
  textDiv.className = 'typing-player-text';
  textDiv.id = `typing-text-${player.id}`;
  textDiv.tabIndex = 0;

  // Show waiting text
  textDiv.innerHTML = '<span style="color: #666; font-style: italic;">Esperando a comenzar...</span>';

  box.innerHTML = `
    <div class="typing-player-info">
      <img class="typing-player-avatar" src="${player.profilePicture || 'profiles/default.svg'}" alt="${player.name}">
      <div class="typing-player-name">${player.name}</div>
      <div class="typing-player-wpm" id="wpm-${player.id}">0 WPM</div>
    </div>
  `;
  box.appendChild(textDiv);
  typingGamePlayers.appendChild(box);
}

function startSoloCountdown() {
  // Hide Empezar button, show countdown
  if (typingSoloStartBtn) typingSoloStartBtn.style.display = 'none';

  let countdown = 3;
  const textDiv = document.getElementById('typing-text-solo');

  // Show countdown in the text area
  const showCountdown = () => {
    if (!textDiv) return;

    if (countdown > 0) {
      // Show just the number
      textDiv.innerHTML = `<div class="typing-countdown-display">${countdown}</div>`;
      countdown--;
      setTimeout(showCountdown, 1000);
    } else {
      // Start the actual game
      startSoloGameAfterCountdown();
    }
  };

  showCountdown();
}

function generateScrambledCountdown(num) {
  const chars = SCRAMBLE_CHARS;
  let result = '';
  for (let i = 0; i < 20; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result.slice(0, 10) + ` ${num} ` + result.slice(10);
}

function startSoloGameAfterCountdown() {
  // Show restart button
  if (typingSoloRestartBtn) typingSoloRestartBtn.style.display = '';

  // Render actual typing text
  renderGamePlayersForGame(typingPlayers, [], false);

  // Focus hidden input for mobile keyboard
  focusTypingInput();

  // Start game
  typingStartTime = Date.now();
  typingGameActive = true;
  startTypingTimer();
}

// ==================== START GAME ====================
function startTypingGameMultiplayer(words, players, spectators) {
  typingWords = words;
  typingPlayers = players;
  typingSpectators = spectators || [];
  startTypingGame(words);
}

function startTypingGame(words) {
  // Clear any existing timer from previous game
  TypingTimerManager.clearByPrefix('typing-');

  typingFullText = words.join(' ');
  typingCharIndex = 0;
  typingCorrectChars = 0;
  typingTotalTyped = 0;
  typingErrors = 0;
  typingStartTime = null;
  typingTimeRemaining = 60;
  typingGameActive = false;

  // Reset UI
  typingTimer.textContent = '60';
  typingWpm.textContent = '0';
  typingAccuracy.textContent = '100%';

  // Add/remove solo-mode class
  const gameWindow = document.querySelector('.typing-game-window');
  if (gameWindow) {
    if (!typingIsMultiplayer) {
      gameWindow.classList.add('solo-mode');
    } else {
      gameWindow.classList.remove('solo-mode');
    }
    gameWindow.classList.remove('coop-mode');
  }

  // Hide solo controls and back tab for multiplayer
  if (typingSoloControls) {
    typingSoloControls.style.display = typingIsMultiplayer ? 'none' : 'flex';
  }
  if (typingSoloMenuBtn) {
    typingSoloMenuBtn.style.display = typingIsMultiplayer ? 'none' : '';
  }

  // Show game screen
  showTypingScreen('typing-game-screen');

  // Render player boxes
  renderGamePlayersForGame(typingPlayers, typingSpectators, false);

  // Focus hidden input for mobile keyboard
  focusTypingInput();

  // Start immediately
  typingStartTime = Date.now();
  typingGameActive = true;
  startTypingTimer();
}

function renderGamePlayersForGame(players, spectators, isSpectator) {
  if (!typingGamePlayers) return;
  typingGamePlayers.innerHTML = '';

  // Calculate grid layout
  const playerCount = players.length;
  let columns = 1;
  if (playerCount >= 6) columns = 3;
  else if (playerCount >= 4) columns = 2;

  typingGamePlayers.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  typingGamePlayers.className = `typing-game-players cols-${columns}`;

  players.forEach((player, index) => {
    const box = document.createElement('div');
    box.className = 'typing-player-box';
    box.dataset.playerId = player.id;
    const isSelf = player.id === socket.id || player.id === 'solo';
    if (isSelf) box.classList.add('is-self');

    const textDiv = document.createElement('div');
    textDiv.className = 'typing-player-text';
    textDiv.id = `typing-text-${player.id}`;
    textDiv.tabIndex = 0;

    // Render text
    textDiv.innerHTML = renderTypingText(typingFullText, isSelf && !isSpectator);

    box.innerHTML = `
      <div class="typing-player-info">
        <img class="typing-player-avatar" src="${player.profilePicture || 'profiles/default.svg'}" alt="${player.name}">
        <div class="typing-player-name">${player.name}</div>
        <div class="typing-player-wpm" id="wpm-${player.id}">0 WPM</div>
      </div>
    `;
    box.appendChild(textDiv);
    typingGamePlayers.appendChild(box);

    // Store reference and focus
    if (isSelf && !isSpectator) {
      typingMyTextElement = textDiv;
      setTimeout(() => textDiv.focus(), 100);
    }
  });

  // Update spectator panel
  updateSpectatorPanel(spectators);
}

function renderTypingText(text, showCurrent) {
  let html = '';
  for (let i = 0; i < text.length; i++) {
    let classes = 'typing-char pending';
    if (text[i] === ' ') classes += ' space';
    if (showCurrent && i === 0) classes = 'typing-char current';
    html += `<span class="${classes}" data-index="${i}">${text[i]}</span>`;
  }
  return html;
}

// ==================== KEYBOARD HANDLING ====================
// handleGlobalKeydown is defined at end of file with Co-op support

// Delete entire word (Ctrl+Backspace / Ctrl+Delete behavior)
function handleDeleteWord() {
  if (typingCharIndex <= 0) return;

  // Keep deleting until we hit a space or reach the start
  // First, if we're right after a space, delete the space
  if (typingCharIndex > 0 && typingFullText[typingCharIndex - 1] === ' ') {
    handleBackspace();
  }

  // Now delete backwards until we hit a space or reach index 0
  while (typingCharIndex > 0 && typingFullText[typingCharIndex - 1] !== ' ') {
    handleBackspace();
  }
}

function handleBackspace() {
  if (typingCharIndex <= 0) return;

  // Move back
  typingCharIndex--;

  const charSpan = typingMyTextElement.querySelector(`[data-index="${typingCharIndex}"]`);
  if (!charSpan) return;

  // Check what state the character was in
  if (charSpan.classList.contains('correct')) {
    typingCorrectChars--;
  } else if (charSpan.classList.contains('incorrect')) {
    typingErrors--;
  }
  typingTotalTyped--;

  // Reset character state
  charSpan.classList.remove('correct', 'incorrect');
  charSpan.classList.add('current');

  // Remove current from next char
  const nextSpan = typingMyTextElement.querySelector(`[data-index="${typingCharIndex + 1}"]`);
  if (nextSpan) {
    nextSpan.classList.remove('current');
    nextSpan.classList.add('pending');
  }

  updateTypingStats();

  if (typingIsMultiplayer) {
    sendTypingProgress();
  }
}

function processTypedCharacter(typedChar) {
  if (typingCharIndex >= typingFullText.length) return;

  const expectedChar = typingFullText[typingCharIndex];
  const charSpan = typingMyTextElement.querySelector(`[data-index="${typingCharIndex}"]`);
  if (!charSpan) return;

  typingTotalTyped++;
  charSpan.classList.remove('current', 'pending');

  if (typedChar === expectedChar) {
    charSpan.classList.add('correct');
    typingCorrectChars++;
  } else {
    charSpan.classList.add('incorrect');
    typingErrors++;
  }

  typingCharIndex++;

  // Mark next character as current
  if (typingCharIndex < typingFullText.length) {
    const nextSpan = typingMyTextElement.querySelector(`[data-index="${typingCharIndex}"]`);
    if (nextSpan) {
      nextSpan.classList.add('current');
      nextSpan.classList.remove('pending');
      scrollToCurrentChar(nextSpan);
    }
  }

  updateTypingStats();

  if (typingIsMultiplayer) {
    sendTypingProgress();
  }

  // Check if finished
  if (typingCharIndex >= typingFullText.length) {
    finishTypingGame();
  }
}

function scrollToCurrentChar(charSpan, container) {
  if (!container) container = typingMyTextElement;
  if (!container || !charSpan) return;

  // Get the line height and scroll to put current char near the top
  const charTop = charSpan.offsetTop;
  const containerHeight = container.clientHeight;
  const lineHeight = charSpan.offsetHeight;

  // Scroll so current line is at the top with a small margin
  container.scrollTop = Math.max(0, charTop - lineHeight);
}

// ==================== TIMER ====================
function startTypingTimer() {
  typingTimeRemaining = 60;
  typingTimer.textContent = typingTimeRemaining;

  TypingTimerManager.setInterval('typing-game-timer', () => {
    typingTimeRemaining--;
    typingTimer.textContent = typingTimeRemaining;

    if (typingTimeRemaining <= 0) {
      finishTypingGame();
    }
  }, 1000);
}

// ==================== STATS ====================
function updateTypingStats() {
  // Don't update if game isn't active or hasn't started
  if (!typingGameActive || !typingStartTime) return;

  const elapsedMs = Date.now() - typingStartTime;
  const elapsedMinutes = elapsedMs / 60000;
  // WPM based only on correct characters (wrong letters don't count)
  const wpm = Math.round((typingCorrectChars / 5) / elapsedMinutes) || 0;
  const accuracy = typingTotalTyped > 0
    ? Math.round((typingCorrectChars / typingTotalTyped) * 100)
    : 100;

  typingWpm.textContent = wpm;
  typingAccuracy.textContent = accuracy + '%';

  // Update own WPM display
  const wpmEl = document.getElementById('wpm-solo') || document.getElementById(`wpm-${socket.id}`);
  if (wpmEl) wpmEl.textContent = wpm + ' WPM';
}

// ==================== MULTIPLAYER ====================
function sendTypingProgress() {
  if (TypingTimerManager._timers.has('typing-progress-throttle')) return;

  TypingTimerManager.setTimeout('typing-progress-throttle', () => {
    // Timer auto-clears after firing
  }, 200);

  const elapsedMs = Date.now() - typingStartTime;
  const elapsedMinutes = elapsedMs / 60000;
  // WPM based only on correct characters (wrong letters don't count)
  const wpm = Math.round((typingCorrectChars / 5) / elapsedMinutes) || 0;
  const accuracy = typingTotalTyped > 0
    ? Math.round((typingCorrectChars / typingTotalTyped) * 100)
    : 100;
  const progress = (typingCharIndex / typingFullText.length) * 100;

  socket.emit('typingProgress', {
    charIndex: typingCharIndex,
    wpm: wpm,
    accuracy: accuracy,
    progress: progress
  });
}

function updateOpponentProgress(data) {
  // Update opponent's WPM
  const wpmEl = document.getElementById(`wpm-${data.playerId}`);
  if (wpmEl) wpmEl.textContent = data.wpm + ' WPM';

  // Update opponent's text display (show progress)
  const textEl = document.getElementById(`typing-text-${data.playerId}`);
  if (textEl) {
    const chars = textEl.querySelectorAll('.typing-char');
    let currentCharSpan = null;
    chars.forEach((char, i) => {
      if (i < data.charIndex) {
        char.classList.remove('pending', 'current');
        char.classList.add('correct');
      } else if (i === data.charIndex) {
        char.classList.remove('pending', 'correct');
        char.classList.add('current');
        currentCharSpan = char;
      }
    });

    // Autoscroll opponent's text too
    if (currentCharSpan) {
      scrollToCurrentChar(currentCharSpan, textEl);
    }
  }
}

// ==================== FINISH GAME ====================
function finishTypingGame() {
  typingGameActive = false;
  TypingTimerManager.clearByPrefix('typing-');

  const elapsedMs = typingStartTime ? (Date.now() - typingStartTime) : 60000;
  const elapsedMinutes = elapsedMs / 60000;
  // WPM based only on correct characters (wrong letters don't count)
  const finalWpm = Math.round((typingCorrectChars / 5) / elapsedMinutes) || 0;
  const finalAccuracy = typingTotalTyped > 0
    ? Math.round((typingCorrectChars / typingTotalTyped) * 100)
    : 100;

  if (typingIsMultiplayer) {
    socket.emit('typingComplete', {
      wpm: finalWpm,
      accuracy: finalAccuracy,
      chars: typingCharIndex,
      errors: typingErrors
    });
  } else {
    // Report solo result to server for leaderboard
    socket.emit('typingSoloResult', {
      wpm: finalWpm,
      accuracy: finalAccuracy
    });

    showTypingResults({
      isMultiplayer: false,
      myResult: {
        wpm: finalWpm,
        accuracy: finalAccuracy,
        chars: typingCharIndex,
        errors: typingErrors
      }
    });
  }
}

function endTypingGame(data) {
  typingGameActive = false;
  TypingTimerManager.clearByPrefix('typing-');
  showTypingResults(data);
}

// ==================== RESULTS ====================
function showTypingResults(data) {
  // Show personal stats (if not spectator)
  if (data.myResult) {
    typingFinalWpm.textContent = data.myResult.wpm;
    typingFinalAccuracy.textContent = data.myResult.accuracy + '%';
    typingFinalChars.textContent = data.myResult.chars;
    typingFinalErrors.textContent = data.myResult.errors;
  }

  // Show ranking for multiplayer
  if (data.isMultiplayer && data.results && data.results.length > 0) {
    if (typingResultsRanking) {
      typingResultsRanking.style.display = 'block';
      typingResultsRanking.innerHTML = `
        <div class="typing-ranking-title">Clasificacion</div>
        ${data.results.map((r, i) => `
          <div class="typing-ranking-row ${r.id === socket.id ? 'is-self' : ''} ${i === 0 ? 'is-winner' : ''}">
            <span class="typing-ranking-pos">${i === 0 ? '👑' : (i + 1)}</span>
            <img class="typing-ranking-avatar" src="${r.profilePicture || 'profiles/default.svg'}" alt="${r.name}">
            <span class="typing-ranking-name">${r.name}</span>
            <span class="typing-ranking-wpm">${r.wpm} WPM</span>
          </div>
        `).join('')}
      `;
    }

    // Hide old VS display
    if (typingResultsVs) {
      typingResultsVs.style.display = 'none';
    }
  } else {
    if (typingResultsRanking) typingResultsRanking.style.display = 'none';
    if (typingResultsVs) typingResultsVs.style.display = 'none';
  }

  // Show/hide spectator join button
  if (typingSpectatorJoinBtn) {
    if (data.isSpectator) {
      typingSpectatorJoinBtn.style.display = 'inline-block';
      typingSpectatorJoinBtn.disabled = true;
      typingSpectatorJoinBtn.textContent = 'Esperando...';
    } else {
      typingSpectatorJoinBtn.style.display = 'none';
    }
  }

  // Hide play again if spectator
  if (typingPlayAgainBtn) {
    typingPlayAgainBtn.style.display = data.isSpectator ? 'none' : 'inline-block';
  }

  // Personal stats section
  const personalStatsSection = document.querySelector('.typing-final-stats')?.parentElement;
  if (personalStatsSection) {
    personalStatsSection.style.display = data.isSpectator ? 'none' : 'block';
  }

  showTypingScreen('typing-results-screen');
}

// ==================== UTILITIES ====================
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ==================== CO-OP MODE FUNCTIONS ====================

function showCoopGameWithCountdown(seconds, players, currentTyper) {
  showTypingScreen('typing-game-screen');
  typingPlayers = players;

  // Update game window title
  const gameTitle = document.querySelector('#typing-game-screen .title-bar-text');
  if (gameTitle) gameTitle.textContent = 'SQRRR Tikitiki - Co-op';

  // Remove solo-mode class
  const gameWindow = document.querySelector('.typing-game-window');
  if (gameWindow) {
    gameWindow.classList.remove('solo-mode');
    gameWindow.classList.add('coop-mode');
  }

  // Hide solo controls
  if (typingSoloControls) typingSoloControls.style.display = 'none';

  // Render single shared text box with countdown
  renderCoopGameCountdown(seconds, players, currentTyper);
}

function renderCoopGameCountdown(seconds, players, currentTyper) {
  if (!typingGamePlayers) return;
  typingGamePlayers.innerHTML = '';
  typingGamePlayers.style.gridTemplateColumns = '1fr';
  typingGamePlayers.className = 'typing-game-players cols-1 coop';

  // Create single shared text box
  const box = document.createElement('div');
  box.className = 'typing-player-box coop-shared';
  box.id = 'coop-shared-box';

  const textDiv = document.createElement('div');
  textDiv.className = 'typing-player-text';
  textDiv.id = 'typing-text-coop';
  textDiv.innerHTML = `<div class="typing-countdown-display">${seconds}</div>`;

  // Player status panel
  const statusPanel = document.createElement('div');
  statusPanel.className = 'coop-status-panel';
  statusPanel.innerHTML = renderCoopPlayerStatus(players, currentTyper);

  box.appendChild(textDiv);
  typingGamePlayers.appendChild(box);
  typingGamePlayers.appendChild(statusPanel);
}

function renderCoopPlayerStatus(players, currentTyper) {
  return `
    <div class="coop-turn-indicator">
      <span class="coop-turn-label">Turno de:</span>
      <span class="coop-turn-name">${players.find(p => p.id === currentTyper)?.name || '?'}</span>
    </div>
    <div class="coop-players-stats">
      ${players.map(p => `
        <div class="coop-player-stat ${p.id === currentTyper ? 'is-current' : ''} ${p.id === socket.id ? 'is-self' : ''}">
          <img class="coop-player-avatar" src="${p.profilePicture || 'profiles/default.svg'}" alt="${p.name}">
          <span class="coop-player-name">${p.name}</span>
          <span class="coop-player-words">${p.wordsTyped || 0} palabras</span>
        </div>
      `).join('')}
    </div>
  `;
}

function startTypingCoopGame(words, fullText, players, currentTyper) {
  // Clear any existing timer from previous game
  TypingTimerManager.clearByPrefix('typing-');

  typingWords = words;
  typingFullText = fullText;
  typingPlayers = players;
  typingCoopCurrentTyper = currentTyper;
  typingCharIndex = 0;
  typingCorrectChars = 0;
  typingTotalTyped = 0;
  typingErrors = 0;
  typingStartTime = Date.now();
  typingTimeRemaining = 120; // 2 minutes
  typingGameActive = true;

  // Reset UI
  typingTimer.textContent = '120';
  typingWpm.textContent = '0';
  typingAccuracy.textContent = '100%';

  // Render game
  renderCoopGame(players, currentTyper);

  // Focus input if it's our turn
  if (currentTyper === socket.id) {
    focusTypingInput();
  }

  // Start timer
  startCoopTimer();
}

function renderCoopGameAsSpectator(players, charIndex, currentTyper) {
  // Update game window
  const gameWindow = document.querySelector('.typing-game-window');
  if (gameWindow) {
    gameWindow.classList.remove('solo-mode');
    gameWindow.classList.add('coop-mode');
  }

  // Hide solo controls
  if (typingSoloControls) typingSoloControls.style.display = 'none';
  if (typingSoloMenuBtn) typingSoloMenuBtn.style.display = 'none';

  // Render the game view
  renderCoopGame(players, currentTyper);
}

function renderCoopGame(players, currentTyper) {
  if (!typingGamePlayers) return;
  typingGamePlayers.innerHTML = '';
  typingGamePlayers.style.gridTemplateColumns = '1fr';
  typingGamePlayers.className = 'typing-game-players cols-1 coop';

  // Create single shared text box
  const box = document.createElement('div');
  box.className = 'typing-player-box coop-shared';
  const isMyturn = currentTyper === socket.id;
  if (isMyturn) box.classList.add('is-my-turn');

  const textDiv = document.createElement('div');
  textDiv.className = 'typing-player-text';
  textDiv.id = 'typing-text-coop';
  textDiv.tabIndex = 0;

  // Calculate turn boundaries (word indices where turns change)
  // Turn order: player 0 starts, then rotates through all players
  const turnOrder = players.map(p => p.id);
  const wordsPerTurn = typingCoopWordsPerTurn;

  // Find word boundary positions (indices right after each space)
  const wordStartPositions = [0]; // First word starts at 0
  for (let i = 0; i < typingFullText.length; i++) {
    if (typingFullText[i] === ' ' && i + 1 < typingFullText.length) {
      wordStartPositions.push(i + 1);
    }
  }

  // Calculate which word index we're currently at based on charIndex
  let currentWordIndex = 0;
  for (let i = 0; i < wordStartPositions.length; i++) {
    if (typingCharIndex >= wordStartPositions[i]) {
      currentWordIndex = i;
    } else {
      break;
    }
  }

  // Render text with highlighting and turn markers
  let html = '';
  let wordCount = 0;

  for (let i = 0; i < typingFullText.length; i++) {
    const char = typingFullText[i];

    // Check if this is the start of a word where turn changes
    if (i > 0 && typingFullText[i - 1] === ' ') {
      wordCount++;

      // Every 20 words, a turn change happens
      if (wordCount > 0 && wordCount % wordsPerTurn === 0) {
        const turnIndex = Math.floor(wordCount / wordsPerTurn) % turnOrder.length;
        const nextTyper = players.find(p => p.id === turnOrder[turnIndex]);
        const isPassed = wordCount <= currentWordIndex;

        if (nextTyper) {
          html += `<span class="coop-turn-marker ${isPassed ? 'passed' : ''}" data-word="${wordCount}">`;
          html += `<span class="coop-turn-marker-arrow">→</span>`;
          html += `<span class="coop-turn-marker-name">${nextTyper.name}</span>`;
          html += `</span>`;
        }
      }
    }

    let classes = 'typing-char';
    if (i < typingCharIndex) {
      classes += ' correct';
    } else if (i === typingCharIndex) {
      classes += ' current';
    } else {
      classes += ' pending';
    }
    html += `<span class="${classes}" data-index="${i}">${char === ' ' ? '&nbsp;' : char}</span>`;
  }
  textDiv.innerHTML = html;

  // Save reference for typing
  typingMyTextElement = textDiv;

  // Player status panel
  const statusPanel = document.createElement('div');
  statusPanel.className = 'coop-status-panel';
  statusPanel.id = 'coop-status-panel';
  statusPanel.innerHTML = renderCoopPlayerStatus(players, currentTyper);

  box.appendChild(textDiv);
  typingGamePlayers.appendChild(box);
  typingGamePlayers.appendChild(statusPanel);

  // Scroll to current char
  const currentChar = textDiv.querySelector('.current');
  if (currentChar) scrollToCurrentChar(currentChar);
}

function startCoopTimer() {
  TypingTimerManager.setInterval('typing-coop-timer', () => {
    typingTimeRemaining--;
    typingTimer.textContent = typingTimeRemaining;

    if (typingTimeRemaining <= 0) {
      TypingTimerManager.clear('typing-coop-timer');
      // Server will end the game
    }
  }, 1000);
}

function updateCoopProgress(data) {
  const isMyTurn = data.currentTyper === socket.id;
  typingCoopCurrentTyper = data.currentTyper;
  typingPlayers = data.players;

  // Only update char display if it's not our turn (we handle our own display locally)
  if (!isMyTurn) {
    typingCharIndex = data.charIndex;
    const textEl = document.getElementById('typing-text-coop');
    if (textEl) {
      const chars = textEl.querySelectorAll('.typing-char');
      chars.forEach((char, i) => {
        char.classList.remove('correct', 'current', 'pending', 'incorrect');
        if (i < data.charIndex) {
          char.classList.add('correct');
        } else if (i === data.charIndex) {
          char.classList.add('current');
          scrollToCurrentChar(char, textEl);
        } else {
          char.classList.add('pending');
        }
      });
    }
  }

  // Update status panel
  const statusPanel = document.getElementById('coop-status-panel');
  if (statusPanel) {
    statusPanel.innerHTML = renderCoopPlayerStatus(data.players, data.currentTyper);
  }

  // Update box class for whose turn
  const box = document.querySelector('.coop-shared');
  if (box) {
    if (isMyTurn) {
      box.classList.add('is-my-turn');
    } else {
      box.classList.remove('is-my-turn');
    }
  }
}

function handleCoopTurnChange(data) {
  typingCoopCurrentTyper = data.currentTyper;
  typingCharIndex = data.charIndex || typingCharIndex;

  // Focus input if now our turn
  if (data.currentTyper === socket.id) {
    focusTypingInput();
  }

  // Update UI
  updateCoopProgress(data);

  // Flash indicator for turn change
  const statusPanel = document.getElementById('coop-status-panel');
  if (statusPanel) {
    statusPanel.classList.add('turn-flash');
    setTimeout(() => statusPanel.classList.remove('turn-flash'), 500);
  }
}

function handleGlobalKeydown(e) {
  if (!typingGameScreen.classList.contains('active')) return;
  if (typingIsSpectator) return;
  if (!typingGameActive) return;

  // For Co-op mode, only allow typing if it's our turn
  if (typingIsCoop && typingCoopCurrentTyper !== socket.id) {
    return;
  }

  // Ctrl+Backspace or Ctrl+Delete: delete entire word
  if ((e.ctrlKey || e.metaKey) && (e.key === 'Backspace' || e.key === 'Delete')) {
    e.preventDefault();
    if (!typingIsCoop) {
      handleDeleteWord();
    }
    return;
  }

  if (e.key === 'Backspace') {
    e.preventDefault();
    if (typingIsCoop) {
      handleCoopBackspace();
    } else {
      handleBackspace();
    }
    return;
  }

  // Ignore control keys
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.length > 1) return;

  e.preventDefault();

  if (typingIsCoop) {
    processCoopCharacter(e.key);
  } else {
    processTypedCharacter(e.key);
  }
}

function handleCoopBackspace() {
  // Find the current character span (should have 'incorrect' class if we can delete it)
  const currentSpan = typingMyTextElement.querySelector(`[data-index="${typingCharIndex}"]`);
  if (currentSpan && currentSpan.classList.contains('incorrect')) {
    // Clear the error from current position
    currentSpan.classList.remove('incorrect');
    currentSpan.classList.add('current');
    typingErrors--;
    typingTotalTyped--;
    updateTypingStats();
  }
}

function processCoopCharacter(typedChar) {
  if (typingCharIndex >= typingFullText.length) return;

  const expectedChar = typingFullText[typingCharIndex];
  const isCorrect = typedChar === expectedChar;

  // Update local display immediately
  const charSpan = typingMyTextElement.querySelector(`[data-index="${typingCharIndex}"]`);
  if (charSpan) {
    charSpan.classList.remove('current', 'pending');
    if (isCorrect) {
      charSpan.classList.add('correct');
      typingCorrectChars++;
      typingCharIndex++;

      // Mark next character as current
      const nextSpan = typingMyTextElement.querySelector(`[data-index="${typingCharIndex}"]`);
      if (nextSpan) {
        nextSpan.classList.add('current');
        nextSpan.classList.remove('pending');
        scrollToCurrentChar(nextSpan);
      }
    } else {
      charSpan.classList.add('incorrect');
      typingErrors++;
    }
  }

  typingTotalTyped++;
  updateTypingStats();

  // Send to server
  socket.emit('typingCoopChar', {
    char: typedChar,
    correct: isCorrect
  });
}

function endTypingCoopGame(data) {
  typingGameActive = false;
  TypingTimerManager.clearByPrefix('typing-');
  showCoopResults(data);
}

function showCoopResults(data) {
  // Show team stats in ranking area
  if (typingResultsRanking) {
    typingResultsRanking.style.display = 'block';
    typingResultsRanking.innerHTML = `
      <div class="typing-ranking-title">Resultados del Equipo</div>
      <div class="coop-team-stats">
        <div class="coop-team-stat">
          <span class="coop-team-stat-value">${data.teamStats.totalWords}</span>
          <span class="coop-team-stat-label">Palabras</span>
        </div>
        <div class="coop-team-stat">
          <span class="coop-team-stat-value">${data.teamStats.totalChars}</span>
          <span class="coop-team-stat-label">Caracteres</span>
        </div>
        <div class="coop-team-stat">
          <span class="coop-team-stat-value">${data.teamStats.totalTime}s</span>
          <span class="coop-team-stat-label">Tiempo</span>
        </div>
      </div>
      <div class="typing-ranking-title" style="margin-top: 15px;">Por Jugador</div>
      ${data.results.map((r, i) => `
        <div class="typing-ranking-row coop-result ${r.id === socket.id ? 'is-self' : ''}">
          <img class="typing-ranking-avatar" src="${r.profilePicture || 'profiles/default.svg'}" alt="${r.name}">
          <span class="typing-ranking-name">${r.name}</span>
          <span class="coop-result-words">${r.wordsTyped} palabras</span>
          <span class="coop-result-wpm">${r.wpm} WPM</span>
          <span class="coop-result-accuracy">${r.accuracy}%</span>
        </div>
      `).join('')}
    `;
  }

  // Hide old VS display
  if (typingResultsVs) {
    typingResultsVs.style.display = 'none';
  }

  // Find my result for personal stats
  const myResult = data.results.find(r => r.id === socket.id);
  if (myResult) {
    typingFinalWpm.textContent = myResult.wpm;
    typingFinalAccuracy.textContent = myResult.accuracy + '%';
    typingFinalChars.textContent = myResult.charsTyped;
    typingFinalErrors.textContent = myResult.errors;
  }

  // Hide spectator button for Co-op
  if (typingSpectatorJoinBtn) {
    typingSpectatorJoinBtn.style.display = 'none';
  }

  showTypingScreen('typing-results-screen');
}

// ==================== SLOT MACHINE POPUP ====================
// Add slot popup button to typing game screen stats bar
const typingStatsBar = document.querySelector('#typing-game-screen .typing-stats-bar');
if (typingStatsBar) {
  createSlotPopupButton(typingStatsBar, socket);
}

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', initTypingGame);
