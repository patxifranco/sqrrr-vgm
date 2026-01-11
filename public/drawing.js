// SQRRRILLO - Drawing Game Client
// Windows XP Paint style multiplayer drawing game

// ==================== CORE MODULES ====================
import { timerManager, socketManager, logger, escapeHtml } from './js/core/index.js';
import { createSlotPopupButton } from './js/ui/slot-popup.js';
import { showCoinAnimation } from './js/ui/coin-animation.js';

// Alias for backward compatibility
const DrawingTimerManager = timerManager;

// Create scoped logger
const log = logger.scope('Drawing');

  // Brush sizes
  const BRUSH_SIZES = [2, 4, 6, 10];

  // Game state
  let socket = null;
  let currentUser = null;
  let isHost = false;
  let isSpectator = false;
  let isDrawer = false;
  let gameState = 'waiting';
  let players = [];
  let spectators = [];

  // Canvas state
  let canvas = null;
  let ctx = null;
  let isDrawing = false;
  let wasDrawingBeforeLeave = false; // Track if we were drawing when mouse left canvas
  let currentTool = 'brush';
  let currentColor = '#000000';
  let currentSize = 6;
  let lastX = 0;
  let lastY = 0;
  let shapeStartX = 0;
  let shapeStartY = 0;
  let tempCanvas = null;
  let tempCtx = null;

  // Word display state - drawer's word stored separately
  let drawerWord = null;

  // Undo history (stores up to 5 canvas states)
  let undoHistory = [];
  const MAX_UNDO_STATES = 5;

  // Timer state
  let turnEndTime = null;

  // DOM Elements (cached on init)
  let elements = {};

  // Initialize when DOM is ready
  function init() {
    cacheElements();
    setupEventListeners();
    setupColorPalette();
    setupSizeButtons();
    initCanvas();

    // Add slot popup button to drawing game menu bar
    const drawingMenuBar = document.querySelector('#drawing-game-screen .xp-menubar');
    if (drawingMenuBar && socket) {
      createSlotPopupButton(drawingMenuBar, socket);
    }
  }

  function cacheElements() {
    elements = {
      // Screens
      lobbyScreen: document.getElementById('drawing-lobby-screen'),
      gameScreen: document.getElementById('drawing-game-screen'),
      resultsScreen: document.getElementById('drawing-results-screen'),

      // Lobby
      lobbyPlayerList: document.getElementById('drawing-players-container'),
      lobbySpectatorList: document.getElementById('drawing-spectators-list'),
      lobbySpectatorsContainer: document.getElementById('drawing-spectators-container'),
      startGameBtn: document.getElementById('drawing-start-btn'),
      becomeSpectatorBtn: document.getElementById('drawing-spectate-btn'),
      lobbyLeaveBtn: document.getElementById('drawing-leave-btn'),
      playerCountSpan: document.getElementById('drawing-player-count'),

      // Game - Updated for new HTML structure
      canvas: document.getElementById('drawing-canvas'),
      wordDisplay: document.getElementById('drawing-word-display'),
      timerDisplay: document.getElementById('drawing-timer'),
      turnPlayerDisplay: document.getElementById('drawing-turn-player'),
      roundNumber: document.getElementById('drawing-round-number'),
      totalRounds: document.getElementById('drawing-total-rounds'),
      playersList: document.getElementById('drawing-players-list'),
      chatMessages: document.getElementById('drawing-chat-messages'),
      chatInput: document.getElementById('drawing-chat-input'),
      fgColor: document.getElementById('drawing-fg-color'),
      bgColor: document.getElementById('drawing-bg-color'),

      // Word selection overlay
      wordSelectionOverlay: document.getElementById('drawing-word-selection'),
      wordOptions: document.getElementById('drawing-word-options'),
      wordSelectionTimer: document.getElementById('drawing-word-timer'),

      // Turn end overlay
      turnEndOverlay: document.getElementById('drawing-turn-end'),
      revealedWord: document.getElementById('drawing-revealed-word'),

      // Results
      resultsRankings: document.getElementById('drawing-results-ranking'),
      resultsPlayAgainBtn: document.getElementById('drawing-play-again-btn'),
      resultsBackBtn: document.getElementById('drawing-results-back-btn'),

      // Toolbar - Updated selectors for new HTML
      toolButtons: document.querySelectorAll('.xp-tool-btn:not(.disabled)'),
      sizeButtons: document.querySelectorAll('.xp-size-btn'),
      paletteColors: document.querySelectorAll('.xp-color')
    };
  }

  function setupEventListeners() {
    // Hub button - go directly to lobby
    const hubDrawingBtn = document.getElementById('drawing-btn');
    if (hubDrawingBtn) {
      hubDrawingBtn.addEventListener('click', joinDrawingLobby);
    }

    // Lobby buttons
    if (elements.startGameBtn) {
      elements.startGameBtn.addEventListener('click', startGame);
    }
    if (elements.becomeSpectatorBtn) {
      elements.becomeSpectatorBtn.addEventListener('click', becomeSpectator);
    }
    if (elements.lobbyLeaveBtn) {
      elements.lobbyLeaveBtn.addEventListener('click', leaveLobby);
    }

    // Chat input
    if (elements.chatInput) {
      elements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
      });
    }

    // Results buttons
    if (elements.resultsPlayAgainBtn) {
      elements.resultsPlayAgainBtn.addEventListener('click', () => {
        showDrawingScreen('lobby');
      });
    }
    if (elements.resultsBackBtn) {
      elements.resultsBackBtn.addEventListener('click', leaveLobby);
    }

    // Tool buttons - only for enabled tools
    elements.toolButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool && !btn.classList.contains('disabled')) {
          selectTool(tool);
        }
      });
    });

    // Size buttons
    elements.sizeButtons.forEach(btn => {
      btn.addEventListener('click', () => selectSize(parseInt(btn.dataset.size)));
    });

    // Keyboard shortcuts (Ctrl+Z for undo)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'z' && isDrawer) {
        e.preventDefault();
        undo();
      }
    });
  }

  function setupColorPalette() {
    // Colors are already in the HTML, just add click handlers
    elements.paletteColors.forEach(btn => {
      btn.addEventListener('click', () => {
        selectColor(btn.dataset.color);
      });
    });
  }

  function setupSizeButtons() {
    // Sizes are already in the HTML with the active class set
    elements.sizeButtons.forEach(btn => {
      if (btn.classList.contains('active')) {
        currentSize = parseInt(btn.dataset.size) || 6;
      }
    });
  }

  function initCanvas() {
    canvas = elements.canvas;
    if (!canvas) return;

    ctx = canvas.getContext('2d');

    // Set canvas size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create temp canvas for shape previews
    tempCanvas = document.createElement('canvas');
    tempCtx = tempCanvas.getContext('2d');

    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    canvas.addEventListener('mouseenter', handleMouseEnter);
    // Also listen for mouseup on document in case user releases outside canvas
    document.addEventListener('mouseup', handleGlobalMouseUp);

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
  }

  function resizeCanvas() {
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    // Don't resize if container has no dimensions (hidden)
    const containerWidth = container.clientWidth - 8; // Account for borders/padding
    const containerHeight = container.clientHeight - 8;
    if (containerWidth <= 0 || containerHeight <= 0) return;

    // Save current canvas content only if canvas has dimensions
    let imageData = null;
    if (ctx && canvas.width > 0 && canvas.height > 0) {
      try {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      } catch (e) {
        // Ignore errors
      }
    }

    // Resize to fill container
    canvas.width = containerWidth;
    canvas.height = containerHeight;

    // Also resize temp canvas
    if (tempCanvas) {
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
    }

    // Clear and fill with white
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Restore content if we had any (basic restore, may distort on resize)
      if (imageData && imageData.width > 0 && imageData.height > 0) {
        ctx.putImageData(imageData, 0, 0);
      }
    }
  }

  // Socket connection
  function connectSocket() {
    socket = socketManager.connect();

    // Drawing game events - use scoped listeners to prevent duplicates
    socketManager.on('drawingJoined', handleJoined, 'drawing');
    socketManager.on('drawingPlayerList', handlePlayerList, 'drawing');
    socketManager.on('drawingChatMessage', handleChatMessage, 'drawing');
    socketManager.on('drawingError', handleError, 'drawing');
    socketManager.on('drawingBecameSpectator', handleBecameSpectator, 'drawing');
    socketManager.on('drawingJoinedFromSpectator', handleJoinedFromSpectator, 'drawing');
    socketManager.on('drawingHostStatus', handleHostStatus, 'drawing');
    socketManager.on('drawingGameStart', handleGameStart, 'drawing');
    socketManager.on('drawingWordOptions', handleWordOptions, 'drawing');
    socketManager.on('drawingWordSelection', handleWordSelection, 'drawing');
    socketManager.on('drawingYourWord', handleYourWord, 'drawing');
    socketManager.on('drawingWordSelected', handleWordSelected, 'drawing');
    socketManager.on('drawingTurnStart', handleTurnStart, 'drawing');
    socketManager.on('drawingHintReveal', handleHintReveal, 'drawing');
    socketManager.on('drawingCorrectGuess', handleCorrectGuess, 'drawing');
    socketManager.on('drawingCloseGuess', handleCloseGuess, 'drawing');
    socketManager.on('drawingTurnEnd', handleTurnEnd, 'drawing');
    socketManager.on('drawingGameEnd', handleGameEnd, 'drawing');
    socketManager.on('drawingLobbyReset', handleLobbyReset, 'drawing');

    // Canvas sync events
    socketManager.on('drawingStrokeReceive', handleStrokeReceive, 'drawing');
    socketManager.on('drawingSprayReceive', handleSprayReceive, 'drawing');
    socketManager.on('drawingFillReceive', handleFillReceive, 'drawing');
    socketManager.on('drawingShapeReceive', handleShapeReceive, 'drawing');
    socketManager.on('drawingClearReceive', handleClearReceive, 'drawing');
    socketManager.on('drawingUndoReceive', handleUndoReceive, 'drawing');

    // Coins earned
    socketManager.on('coinsEarned', ({ amount, total }) => {
      showCoinAnimation(amount);
      log.info(`Earned ${amount} $qr, total: ${total}`);
    }, 'drawing');
  }

  // Screen management - use global showScreen from game.js
  function showDrawingScreen(screenName) {
    const screenMap = {
      'lobby': 'drawingLobby',
      'game': 'drawingGame',
      'results': 'drawingResults',
      'hub': 'hub'
    };
    const globalScreenName = screenMap[screenName] || screenName;
    if (typeof window.showScreen === 'function') {
      window.showScreen(globalScreenName);
    }
  }

  // Lobby management
  function joinDrawingLobby() {
    // Reset 'left' state so we can receive join events
    gameState = 'waiting';

    connectSocket();

    // Get current user info from the page
    currentUser = {
      username: window.currentUsername || 'Guest',
      profilePicture: window.currentProfilePicture || 'profiles/default.svg'
    };

    socket.emit('drawingJoin', {
      username: currentUser.username,
      profilePicture: currentUser.profilePicture
    });
  }

  function leaveLobby() {
    // Set gameState to 'left' BEFORE anything else to prevent event handlers from navigating back
    gameState = 'left';
    if (socket) {
      socket.emit('drawingLeave');
    }
    // Cleanup drawing game resources
    DrawingTimerManager.clearByPrefix('drawing-');
    socketManager.cleanupScope('drawing');
    log.info('Left Drawing game, cleaned up');
    resetLocalState(true); // Preserve 'left' state to prevent race conditions
    showDrawingScreen('hub');
  }

  function becomeSpectator() {
    if (socket) {
      socket.emit('drawingBecomeSpectator');
    }
  }

  function startGame() {
    if (socket && isHost) {
      socket.emit('drawingStartGame');
    }
  }

  // Socket event handlers
  function handleJoined(data) {
    // Ignore if we've left the lobby (prevents race condition with leave)
    if (gameState === 'left') return;

    players = data.players || [];
    spectators = data.spectators || [];
    isHost = data.isHost;
    isSpectator = data.isSpectator;
    gameState = data.gameState || 'waiting';

    if (gameState === 'waiting') {
      showDrawingScreen('lobby');
      updateLobbyUI();
    } else {
      // Game in progress - show game screen
      showDrawingScreen('game');
      updateGameUI();

      // Replay canvas history if provided
      if (data.canvasHistory && data.canvasHistory.length > 0) {
        replayCanvasHistory(data.canvasHistory);
      }

      // Update word blanks
      if (data.wordBlanks) {
        updateWordDisplay(data.wordBlanks);
      }
    }
  }

  function handlePlayerList(data) {
    const previousPlayerCount = players.length;
    const newPlayers = data.players || [];

    // Play notify sound if a new player joined (and we're already in the lobby/game)
    if (previousPlayerCount > 0 && newPlayers.length > previousPlayerCount) {
      const notifySound = new Audio('windows_xp_notify.mp3');
      notifySound.volume = 0.5;
      notifySound.play().catch(() => {});
    }

    players = newPlayers;
    spectators = data.spectators || [];
    updateLobbyUI();
    updateGamePlayerList();
  }

  function handleHostStatus(data) {
    isHost = data.isHost;
    updateLobbyUI();
  }

  function handleBecameSpectator(data) {
    isSpectator = true;
    isDrawer = false;
    players = data.players || [];
    spectators = data.spectators || [];
    updateLobbyUI();
  }

  function handleJoinedFromSpectator(data) {
    isSpectator = false;
    isHost = data.isHost;
    players = data.players || [];
    spectators = data.spectators || [];
    updateLobbyUI();
  }

  function handleChatMessage(data) {
    addChatMessage(data);
  }

  function handleError(data) {
    alert(data.message || 'Error');
  }

  function handleGameStart(data) {
    gameState = 'playing';
    players = data.players || [];
    showDrawingScreen('game');

    // Re-cache elements now that screen is visible
    elements.wordSelectionOverlay = document.getElementById('drawing-word-selection');
    elements.wordOptions = document.getElementById('drawing-word-options');
    elements.wordSelectionTimer = document.getElementById('drawing-word-timer');
    elements.turnEndOverlay = document.getElementById('drawing-turn-end');
    elements.revealedWord = document.getElementById('drawing-revealed-word');
    elements.playersList = document.getElementById('drawing-players-list');
    elements.chatMessages = document.getElementById('drawing-chat-messages');
    elements.chatInput = document.getElementById('drawing-chat-input');

    // Resize canvas after screen is visible
    setTimeout(() => {
      resizeCanvas();
      clearCanvasLocal();
    }, 100);

    clearChat();
    updateGameUI();

    // Update round info
    if (elements.totalRounds) {
      elements.totalRounds.textContent = data.totalTurns || players.length;
    }

    addChatMessage({
      system: true,
      message: 'El juego ha comenzado'
    });
  }

  function handleWordOptions(data) {
    // Show word selection overlay (drawer only)
    console.log('Received word options:', data);
    isDrawer = true;
    updateCanvasInteraction();
    showWordSelection(data.words);
  }

  function handleWordSelection(data) {
    // If we're the drawer, we received word options - ignore this event
    if (isDrawer) return;

    // Someone else is the drawer - show waiting message
    hideWordSelection();
    updateWordDisplay('');
    addChatMessage({
      system: true,
      message: `${data.drawer} esta eligiendo una palabra...`
    });
  }

  function handleYourWord(data) {
    // Drawer received their word - store it permanently for this turn
    drawerWord = data.word;
    hideWordSelection();
    updateWordDisplay(data.word, true);
    addChatMessage({
      system: true,
      message: `Tu palabra es: ${data.word}`
    });
  }

  function handleWordSelected(data) {
    // If we're the drawer, we already have our word - ignore blanks
    if (isDrawer || drawerWord) return;

    // Others received the blanks
    hideWordSelection();
    updateWordDisplay(data.blanks);
  }

  function handleTurnStart(data) {
    gameState = 'drawing';

    // Only set isDrawer if we don't already know (from word options)
    // This prevents overwriting correct state
    const shouldBeDrawer = socket && socket.id === data.drawerId;
    if (!isDrawer && shouldBeDrawer) {
      isDrawer = true;
    } else if (!shouldBeDrawer) {
      isDrawer = false;
      drawerWord = null; // Clear drawer word for non-drawers
    }

    // Update round info
    if (elements.roundNumber) {
      elements.roundNumber.textContent = data.turnIndex + 1;
    }
    if (elements.totalRounds) {
      elements.totalRounds.textContent = data.totalTurns;
    }

    // Update turn player display
    if (elements.turnPlayerDisplay) {
      elements.turnPlayerDisplay.textContent = data.drawer;
    }

    // Start timer
    startTimer(data.duration);

    // Clear canvas for new turn
    clearCanvasLocal();
    undoHistory = []; // Clear undo history for new turn

    // Enable/disable canvas based on drawer status
    updateCanvasInteraction();
    updateGamePlayerList();
  }

  function handleHintReveal(data) {
    // Drawer keeps seeing full word, others see updated blanks
    if (isDrawer && drawerWord) {
      // Don't update word display for drawer - they see full word
    } else {
      updateWordDisplay(data.blanks);
    }
    addChatMessage({
      system: true,
      message: `Pista revelada`
    });
  }

  function handleCorrectGuess(data) {
    players = data.players || players;
    updateGamePlayerList();

    // Play correct sound effect for everyone on correct guess
    const correctSound = new Audio('correct.mp3');
    correctSound.volume = 0.8;
    correctSound.play().catch(() => {});
  }

  function handleCloseGuess(data) {
    // Show "Casi" only locally to the player who made the close guess
    // This message is not sent to other players
    addChatMessage({
      closeGuess: true,
      message: data.message
    });

    // Play close sound effect
    const closeSound = new Audio('close.mp3');
    closeSound.volume = 0.7;
    closeSound.play().catch(() => {});
  }

  function handleTurnEnd(data) {
    gameState = 'turn_end';
    stopTimer();
    isDrawer = false;
    drawerWord = null;
    showTurnEndOverlay(data);
  }

  function handleGameEnd(data) {
    gameState = 'results';
    stopTimer();
    isDrawer = false;
    drawerWord = null;
    showResults(data.rankings);
  }

  function handleLobbyReset(data) {
    // Ignore if we've left the lobby (prevents race condition with leave)
    if (gameState === 'left') return;

    gameState = 'waiting';
    players = data.players || [];
    spectators = data.spectators || [];
    isSpectator = false;
    isDrawer = false;
    drawerWord = null;
    showDrawingScreen('lobby');
    updateLobbyUI();
  }

  // Canvas sync handlers
  function handleStrokeReceive(data) {
    drawStroke(data);
  }

  function handleSprayReceive(data) {
    drawSprayDots(data);
  }

  function handleFillReceive(data) {
    floodFill(data.x, data.y, data.color, false);
  }

  function handleShapeReceive(data) {
    drawShape(data.x1, data.y1, data.x2, data.y2, data.tool, data.color, data.size, false);
  }

  function handleClearReceive() {
    clearCanvasLocal();
  }

  // UI update functions
  function updateLobbyUI() {
    // Update player list
    if (elements.lobbyPlayerList) {
      elements.lobbyPlayerList.innerHTML = players.map(p => `
        <div class="drawing-lobby-player ${p.isHost ? 'host' : ''}">
          <img src="${p.profilePicture}" alt="${p.name}" onerror="this.src='profiles/default.svg'">
          <span class="player-name">${escapeHtml(p.name)}</span>
          ${p.isHost ? '<span class="host-badge">HOST</span>' : ''}
        </div>
      `).join('');
    }

    // Update spectator list
    if (elements.lobbySpectatorList && elements.lobbySpectatorsContainer) {
      if (spectators.length > 0) {
        elements.lobbySpectatorList.innerHTML = spectators.map(s => `
          <div class="drawing-lobby-spectator">
            <img src="${s.profilePicture}" alt="${s.name}" onerror="this.src='profiles/default.svg'">
            <span>${escapeHtml(s.name)}</span>
          </div>
        `).join('');
        elements.lobbySpectatorsContainer.style.display = 'block';
      } else {
        elements.lobbySpectatorsContainer.style.display = 'none';
      }
    }

    // Update player count
    if (elements.playerCountSpan) {
      elements.playerCountSpan.textContent = `${players.length}/3 jugadores (minimo 3)`;
    }

    // Update buttons
    if (elements.startGameBtn) {
      elements.startGameBtn.disabled = !isHost || players.length < 3;
      elements.startGameBtn.textContent = players.length < 3 ?
        `Esperando (${players.length}/3)` : 'Empezar';
    }

    if (elements.becomeSpectatorBtn) {
      elements.becomeSpectatorBtn.style.display = isSpectator ? 'none' : 'inline-block';
    }
  }

  function updateGameUI() {
    updateGamePlayerList();
    updateCanvasInteraction();
  }

  function updateGamePlayerList() {
    if (!elements.playersList) return;

    // VGM-style player list rendering
    elements.playersList.innerHTML = players.map((p, index) => `
      <li class="player-item ${p.guessedThisTurn ? 'guessed' : ''} ${p.isDrawer ? 'drawing' : ''}">
        <span class="player-rank">${index + 1}</span>
        <img src="${p.profilePicture}" alt="${p.name}" class="player-avatar" onerror="this.src='profiles/default.svg'">
        <span class="player-name">${escapeHtml(p.name)}</span>
        <span class="player-score">${p.score || 0}</span>
        ${p.guessedThisTurn ? '<span class="player-guessed">&#10003;</span>' : ''}
        ${p.isDrawer ? '<span class="player-drawing">&#9998;</span>' : ''}
      </li>
    `).join('');
  }

  function updateWordDisplay(text, isFullWord = false) {
    if (!elements.wordDisplay) return;

    if (isFullWord) {
      elements.wordDisplay.textContent = text;
      elements.wordDisplay.classList.add('full-word');
    } else {
      // Convert word to blanks with spaces
      elements.wordDisplay.textContent = text || '_ _ _ _ _';
      elements.wordDisplay.classList.remove('full-word');
    }
  }

  function updateCanvasInteraction() {
    if (!canvas) return;
    canvas.style.pointerEvents = isDrawer ? 'auto' : 'none';
    canvas.style.cursor = isDrawer ? getToolCursor(currentTool) : 'not-allowed';

    // Enable/disable toolbar
    const toolbox = document.querySelector('.xp-toolbox');
    if (toolbox) {
      toolbox.classList.toggle('disabled', !isDrawer);
    }
  }

  // Get cursor style for current tool (defined early for use in updateCanvasInteraction)
  function getToolCursor(tool) {
    const cursors = {
      brush: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#FFD700" stroke="#000" d="M4 20 L6 16 L16 4 L20 8 L8 18 Z"/><path fill="#000" d="M4 20 L6 18 L6 20 Z"/></svg>'),
      eraser: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="4" y="12" width="16" height="8" fill="#FFC0CB" stroke="#000"/><rect x="4" y="6" width="16" height="6" fill="#4169E1" stroke="#000"/></svg>'),
      fill: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#333" d="M7 18 L12 6 L17 18 Z"/><path fill="#FFD700" d="M5 20 L19 20 L19 23 L5 23 Z"/></svg>'),
      spray: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="6" cy="4" r="1.5" fill="#333"/><circle cx="10" cy="3" r="1.5" fill="#333"/><circle cx="7" cy="8" r="1.5" fill="#333"/><circle cx="11" cy="6" r="1.5" fill="#333"/><circle cx="4" cy="10" r="1.5" fill="#333"/><rect x="14" y="8" width="6" height="12" fill="#808080" stroke="#000"/><rect x="15" y="5" width="4" height="3" fill="#000"/></svg>'),
      rectangle: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="12" fill="none" stroke="#333" stroke-width="2"/><circle cx="4" cy="6" r="2" fill="#333"/></svg>'),
      circle: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#333" stroke-width="2"/><circle cx="4" cy="12" r="2" fill="#333"/></svg>')
    };
    const cursorUrl = cursors[tool];
    if (cursorUrl) {
      return `url('${cursorUrl}') 2 22, crosshair`;
    }
    return 'crosshair';
  }

  // Timer functions
  function startTimer(duration) {
    stopTimer();
    turnEndTime = Date.now() + (duration * 1000);
    updateTimerDisplay();
    DrawingTimerManager.setInterval('drawing-turn-timer', updateTimerDisplay, 100);
  }

  function stopTimer() {
    DrawingTimerManager.clear('drawing-turn-timer');
  }

  function updateTimerDisplay() {
    if (!elements.timerDisplay || !turnEndTime) return;

    const remaining = Math.max(0, Math.ceil((turnEndTime - Date.now()) / 1000));
    elements.timerDisplay.textContent = remaining;

    // Change color based on time remaining
    if (remaining <= 10) {
      elements.timerDisplay.classList.add('warning');
    } else {
      elements.timerDisplay.classList.remove('warning');
    }
  }

  // Word selection overlay
  function showWordSelection(words) {
    console.log('showWordSelection called with:', words);
    console.log('wordSelectionOverlay:', elements.wordSelectionOverlay);
    console.log('wordOptions:', elements.wordOptions);

    if (!elements.wordSelectionOverlay || !elements.wordOptions) {
      console.error('Word selection elements not found!');
      return;
    }

    elements.wordOptions.innerHTML = words.map((w, i) => `
      <button class="xp-word-option" data-index="${i}">
        <span class="word-text">${w.word}</span>
      </button>
    `).join('');

    // Add click handlers - stop propagation to prevent canvas mousedown
    elements.wordOptions.querySelectorAll('.xp-word-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(btn.dataset.index);
        socket.emit('drawingSelectWord', { wordIndex: index });
        hideWordSelection();
      });
      // Also prevent mousedown from propagating
      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });
    });

    // Prevent any clicks on the overlay from reaching the canvas
    elements.wordSelectionOverlay.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      // Reset drawing state just in case
      isDrawing = false;
    });

    elements.wordSelectionOverlay.classList.remove('hidden');

    // Start word selection timer countdown (15 seconds)
    let wordTimeLeft = 15;
    if (elements.wordSelectionTimer) {
      elements.wordSelectionTimer.textContent = wordTimeLeft;
    }
    DrawingTimerManager.setInterval('drawing-word-selection', () => {
      wordTimeLeft--;
      if (elements.wordSelectionTimer) {
        elements.wordSelectionTimer.textContent = wordTimeLeft;
      }
      if (wordTimeLeft <= 0) {
        DrawingTimerManager.clear('drawing-word-selection');
      }
    }, 1000);
  }

  function hideWordSelection() {
    DrawingTimerManager.clear('drawing-word-selection');
    if (elements.wordSelectionOverlay) {
      elements.wordSelectionOverlay.classList.add('hidden');
    }
    // Reset drawing state to prevent accidental drawing after word selection
    isDrawing = false;
    wasDrawingBeforeLeave = false;
  }

  // Turn end overlay
  function showTurnEndOverlay(data) {
    if (!elements.turnEndOverlay) return;

    if (elements.revealedWord) {
      elements.revealedWord.textContent = data.word;
    }

    elements.turnEndOverlay.classList.remove('hidden');

    // Auto hide after delay
    setTimeout(() => {
      elements.turnEndOverlay.classList.add('hidden');
    }, 4000);
  }

  // Results screen
  function showResults(rankings) {
    showDrawingScreen('results');

    if (elements.resultsRankings) {
      elements.resultsRankings.innerHTML = rankings.map((p, i) => `
        <div class="drawing-result-row ${i === 0 ? 'winner' : ''}">
          <span class="drawing-result-rank">${i + 1}</span>
          <img src="${p.profilePicture}" alt="${p.name}" class="drawing-result-avatar" onerror="this.src='profiles/default.svg'">
          <span class="drawing-result-name">${escapeHtml(p.name)}</span>
          <span class="drawing-result-score">${p.score} pts</span>
        </div>
      `).join('');
    }
  }

  // Chat functions
  function addChatMessage(data) {
    if (!elements.chatMessages) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'xp-chat-msg';

    if (data.closeGuess) {
      // "Casi" message - bold black, only shown locally
      msgDiv.classList.add('close-guess');
      msgDiv.innerHTML = `<strong style="color: #000; font-size: 14px;">${escapeHtml(data.message)}</strong>`;
    } else if (data.system) {
      msgDiv.classList.add('system');
      msgDiv.textContent = data.message;
    } else if (data.correct) {
      msgDiv.classList.add('correct');
      msgDiv.innerHTML = `<strong>${escapeHtml(data.player)}</strong> adivino!`;
    } else {
      msgDiv.innerHTML = `<strong>${escapeHtml(data.player)}:</strong> ${escapeHtml(data.message)}`;
    }

    elements.chatMessages.appendChild(msgDiv);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  }

  function clearChat() {
    if (elements.chatMessages) {
      elements.chatMessages.innerHTML = '';
    }
  }

  function sendChatMessage() {
    if (!elements.chatInput || !socket) return;

    const message = elements.chatInput.value.trim();
    if (!message) return;

    // During drawing phase, this is treated as a guess
    if (gameState === 'drawing' && !isDrawer && !isSpectator) {
      socket.emit('drawingGuess', { guess: message });
    } else {
      socket.emit('drawingChatMessage', { message: message });
    }

    elements.chatInput.value = '';
  }

  // Canvas drawing functions
  function handleMouseDown(e) {
    if (!isDrawer) return;

    // Only respond to left mouse button (button 0)
    if (e.button !== 0) return;

    // Don't start drawing if word selection overlay is visible
    if (elements.wordSelectionOverlay && !elements.wordSelectionOverlay.classList.contains('hidden')) {
      return;
    }

    // Save state for undo before any action
    saveUndoState();

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'fill') {
      const color = hexToRgb(currentColor);
      floodFill(Math.floor(x), Math.floor(y), color, true);
      return;
    }

    isDrawing = true;
    lastX = x;
    lastY = y;

    if (currentTool === 'rectangle' || currentTool === 'circle') {
      shapeStartX = x;
      shapeStartY = y;
      // Copy current canvas to temp
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
      tempCtx.drawImage(canvas, 0, 0);
    } else if (currentTool === 'spray') {
      // Start spray painting
      doSpray(x, y);
      DrawingTimerManager.setInterval('drawing-spray', () => {
        if (isDrawing) {
          doSpray(lastX, lastY);
        }
      }, 20); // Faster spray
    } else {
      // Start a stroke (brush or eraser)
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = currentSize;
      ctx.strokeStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
    }
  }

  function handleMouseMove(e) {
    if (!isDrawer || !isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (currentTool === 'brush' || currentTool === 'eraser') {
      ctx.lineTo(x, y);
      ctx.stroke();

      // Send stroke data (throttled)
      sendStrokeThrottled({
        tool: currentTool,
        color: currentTool === 'eraser' ? '#FFFFFF' : currentColor,
        size: currentSize,
        x1: lastX,
        y1: lastY,
        x2: x,
        y2: y
      });

      lastX = x;
      lastY = y;
    } else if (currentTool === 'rectangle') {
      // Preview rectangle
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
      previewRectangle(shapeStartX, shapeStartY, x, y);
    } else if (currentTool === 'circle') {
      // Preview circle
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
      previewCircle(shapeStartX, shapeStartY, x, y);
    } else if (currentTool === 'spray') {
      lastX = x;
      lastY = y;
    }
  }

  function handleMouseUp(e) {
    if (!isDrawer || !isDrawing) return;

    // Stop spray interval
    DrawingTimerManager.clear('drawing-spray');

    if (currentTool === 'rectangle' || currentTool === 'circle') {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Finalize shape
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(tempCanvas, 0, 0);
      drawShape(shapeStartX, shapeStartY, x, y, currentTool, currentColor, currentSize, true);
    }

    isDrawing = false;
    wasDrawingBeforeLeave = false;
  }

  function handleMouseLeave(e) {
    if (!isDrawer) return;

    // Remember if we were drawing when we left
    wasDrawingBeforeLeave = isDrawing;

    // Pause drawing but don't finalize shapes
    if (isDrawing && currentTool === 'spray') {
      DrawingTimerManager.clear('drawing-spray');
    }

    isDrawing = false;
  }

  function handleMouseEnter(e) {
    if (!isDrawer) return;

    // If mouse button is still held (buttons === 1 means left button) and we were drawing
    if (e.buttons === 1 && wasDrawingBeforeLeave) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      isDrawing = true;
      lastX = x;
      lastY = y;

      // Resume spray if that was the tool
      if (currentTool === 'spray') {
        DrawingTimerManager.setInterval('drawing-spray', () => {
          if (isDrawing) {
            doSpray(lastX, lastY);
          }
        }, 20);
      } else if (currentTool === 'brush' || currentTool === 'eraser') {
        // Start a new path segment at current position
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = currentSize;
        ctx.strokeStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
      }
    }
  }

  function handleGlobalMouseUp(e) {
    // Reset drawing state when mouse is released anywhere
    if (isDrawing) {
      handleMouseUp(e);
    }
    wasDrawingBeforeLeave = false;
  }

  // Touch handlers
  function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  }

  function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
  }

  function handleTouchEnd(e) {
    const mouseEvent = new MouseEvent('mouseup', {});
    canvas.dispatchEvent(mouseEvent);
  }

  // Spray paint tool - XP Paint style with random dots
  function doSpray(x, y) {
    const density = Math.ceil(currentSize * 4); // More dots
    const radius = currentSize * 2.5; // Slightly larger radius
    const offsets = [];

    ctx.fillStyle = currentColor;

    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * radius;
      const offsetX = Math.cos(angle) * r;
      const offsetY = Math.sin(angle) * r;

      ctx.fillRect(x + offsetX, y + offsetY, 1, 1);
      // Store offsets as normalized relative to canvas
      offsets.push({ dx: offsetX / canvas.width, dy: offsetY / canvas.height });
    }

    // Send spray data with normalized coordinates
    if (socket && canvas.width > 0 && canvas.height > 0) {
      socket.emit('drawingSpray', {
        nx: x / canvas.width,
        ny: y / canvas.height,
        color: currentColor,
        size: currentSize,
        offsets: offsets
      });
    }
  }

  function drawSprayDots(data) {
    if (!ctx || !canvas) return;

    // Scale normalized coordinates to local canvas size
    const x = data.nx * canvas.width;
    const y = data.ny * canvas.height;

    ctx.fillStyle = data.color;

    if (data.offsets) {
      // New format with normalized offsets
      data.offsets.forEach(offset => {
        const dotX = x + (offset.dx * canvas.width);
        const dotY = y + (offset.dy * canvas.height);
        ctx.fillRect(dotX, dotY, 1, 1);
      });
    } else if (data.dots) {
      // Legacy format fallback
      data.dots.forEach(dot => {
        ctx.fillRect(dot.x, dot.y, 1, 1);
      });
    }
  }

  // Stroke sending (throttled)
  let strokeBuffer = [];

  function sendStrokeThrottled(stroke) {
    strokeBuffer.push(stroke);
    if (!DrawingTimerManager._timers.has('drawing-stroke-throttle')) {
      DrawingTimerManager.setTimeout('drawing-stroke-throttle', () => {
        if (strokeBuffer.length > 0 && socket) {
          socket.emit('drawingStroke', strokeBuffer);
          strokeBuffer = [];
        }
      }, 16); // ~60fps
    }
  }

  // Draw received strokes
  function drawStroke(data) {
    if (!ctx) return;

    const strokes = Array.isArray(data) ? data : [data];
    strokes.forEach(stroke => {
      ctx.beginPath();
      ctx.moveTo(stroke.x1, stroke.y1);
      ctx.lineTo(stroke.x2, stroke.y2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = stroke.size;
      ctx.strokeStyle = stroke.color;
      ctx.stroke();
    });
  }

  // Rectangle preview (while dragging)
  function previewRectangle(x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.rect(x1, y1, x2 - x1, y2 - y1);
    ctx.stroke();
  }

  // Circle preview (while dragging)
  function previewCircle(x1, y1, x2, y2) {
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const radiusX = Math.abs(x2 - x1) / 2;
    const radiusY = Math.abs(y2 - y1) / 2;

    ctx.beginPath();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Draw shapes
  function drawShape(x1, y1, x2, y2, tool, color, size, send = false) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'rectangle') {
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
    } else if (tool === 'circle') {
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const radiusX = Math.abs(x2 - x1) / 2;
      const radiusY = Math.abs(y2 - y1) / 2;
      ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    }

    ctx.stroke();

    if (send && socket) {
      socket.emit('drawingShape', {
        tool: tool,
        color: color,
        size: size,
        x1, y1, x2, y2
      });
    }
  }

  // Flood fill (bucket tool) with anti-alias edge blending
  function floodFill(startX, startY, fillColor, send = false) {
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Higher tolerance to catch anti-aliased edges
    const tolerance = 48;
    // Edge tolerance for blending anti-aliased pixels
    const edgeTolerance = 96;

    const startPos = (startY * width + startX) * 4;
    const startR = pixels[startPos];
    const startG = pixels[startPos + 1];
    const startB = pixels[startPos + 2];

    // Don't fill if already the same color (exact match)
    if (startR === fillColor.r && startG === fillColor.g && startB === fillColor.b) {
      return;
    }

    // Helper function to check if colors match within tolerance
    function colorsMatch(pos) {
      return Math.abs(pixels[pos] - startR) <= tolerance &&
             Math.abs(pixels[pos + 1] - startG) <= tolerance &&
             Math.abs(pixels[pos + 2] - startB) <= tolerance;
    }

    // Helper to check if pixel is an edge (anti-aliased) pixel
    function isEdgePixel(pos) {
      const diffR = Math.abs(pixels[pos] - startR);
      const diffG = Math.abs(pixels[pos + 1] - startG);
      const diffB = Math.abs(pixels[pos + 2] - startB);
      return diffR > tolerance && diffR <= edgeTolerance &&
             diffG > tolerance && diffG <= edgeTolerance &&
             diffB > tolerance && diffB <= edgeTolerance;
    }

    const stack = [[startX, startY]];
    const visited = new Set();
    const edgePixels = []; // Store edge pixels for blending

    // First pass: fill main area and identify edges
    while (stack.length > 0) {
      const [x, y] = stack.pop();

      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      const key = y * width + x;
      if (visited.has(key)) continue;
      visited.add(key);

      const pos = key * 4;

      if (colorsMatch(pos)) {
        // Main fill area
        pixels[pos] = fillColor.r;
        pixels[pos + 1] = fillColor.g;
        pixels[pos + 2] = fillColor.b;
        pixels[pos + 3] = 255;

        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      } else if (isEdgePixel(pos)) {
        // Edge pixel - store for blending
        edgePixels.push({ x, y, pos });
      }
    }

    // Second pass: blend edge pixels to eliminate jagged lines
    for (const edge of edgePixels) {
      const { pos } = edge;
      // Blend the edge pixel with the fill color based on its original alpha/color
      const originalR = pixels[pos];
      const originalG = pixels[pos + 1];
      const originalB = pixels[pos + 2];

      // Calculate blend factor based on how close to start color
      const diffFromStart = (
        Math.abs(originalR - startR) +
        Math.abs(originalG - startG) +
        Math.abs(originalB - startB)
      ) / 3;

      const blendFactor = 1 - (diffFromStart / edgeTolerance);

      if (blendFactor > 0.3) {
        pixels[pos] = Math.round(originalR * (1 - blendFactor) + fillColor.r * blendFactor);
        pixels[pos + 1] = Math.round(originalG * (1 - blendFactor) + fillColor.g * blendFactor);
        pixels[pos + 2] = Math.round(originalB * (1 - blendFactor) + fillColor.b * blendFactor);
      }
    }

    ctx.putImageData(imageData, 0, 0);

    if (send && socket) {
      socket.emit('drawingFill', {
        x: startX,
        y: startY,
        color: fillColor
      });
    }
  }

  // Clear canvas
  function clearCanvas() {
    if (!isDrawer || !socket) return;
    clearCanvasLocal();
    socket.emit('drawingClear');
  }

  // Save current canvas state for undo
  function saveUndoState() {
    if (!canvas || !ctx) return;
    try {
      const imageData = canvas.toDataURL();
      undoHistory.push(imageData);
      if (undoHistory.length > MAX_UNDO_STATES) {
        undoHistory.shift(); // Remove oldest state
      }
    } catch (e) {
      console.error('Failed to save undo state:', e);
    }
  }

  // Undo last action
  function undo() {
    if (!isDrawer || undoHistory.length === 0) return;

    const previousState = undoHistory.pop();
    if (previousState) {
      const img = new Image();
      img.onload = function() {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        // Notify server about undo
        if (socket) {
          socket.emit('drawingUndo', { imageData: previousState });
        }
      };
      img.src = previousState;
    }
  }

  // Handle undo from other clients
  function handleUndoReceive(data) {
    if (!ctx || !canvas) return;
    const img = new Image();
    img.onload = function() {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = data.imageData;
  }

  function clearCanvasLocal() {
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Replay canvas history for late joiners
  function replayCanvasHistory(history) {
    clearCanvasLocal();
    history.forEach(action => {
      if (action.type === 'stroke') {
        drawStroke(action.data);
      } else if (action.type === 'spray') {
        drawSprayDots(action.data.x, action.data.y, action.data.color, action.data.size, action.data.dots);
      } else if (action.type === 'fill') {
        floodFill(action.data.x, action.data.y, action.data.color, false);
      } else if (action.type === 'shape') {
        drawShape(action.data.x1, action.data.y1, action.data.x2, action.data.y2, action.data.tool, action.data.color, action.data.size, false);
      }
    });
  }

  // Tool selection
  function selectTool(tool) {
    currentTool = tool;
    // Use cached tool buttons instead of querying DOM each time
    if (elements.toolButtons) {
      elements.toolButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
      });
    }
    // Update canvas cursor if we're the drawer
    if (isDrawer && canvas) {
      canvas.style.cursor = getToolCursor(tool);
    }
  }

  function selectColor(color) {
    currentColor = color;
    // Update foreground color preview
    if (elements.fgColor) {
      elements.fgColor.style.backgroundColor = color;
    }
    // Remove active class from all colors, add to selected (use cached)
    if (elements.paletteColors) {
      elements.paletteColors.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.color === color);
      });
    }
  }

  function selectSize(size) {
    currentSize = size;
    // Use cached size buttons
    if (elements.sizeButtons) {
      elements.sizeButtons.forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.size) === size);
      });
    }
  }

  // Utility functions
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  // escapeHtml imported from core modules

  function resetLocalState(preserveLeftState = false) {
    players = [];
    spectators = [];
    isHost = false;
    isSpectator = false;
    isDrawer = false;
    // Don't reset gameState if we're preserving the 'left' state
    if (!preserveLeftState) {
      gameState = 'waiting';
    }
    stopTimer();
    DrawingTimerManager.clearByPrefix('drawing-');
    clearCanvasLocal();
    clearChat();
  }

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
