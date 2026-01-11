/**
 * Drawing Game Socket Handlers
 *
 * Handles SQRRRILLO drawing game multiplayer logic.
 * Extracted from server.js for modularity.
 */

const fs = require('fs');
const path = require('path');
const { shuffleArray, log, warn } = require('../utils');

// ==================== CONSTANTS ====================

const DRAWING_ROOM = 'DRAWING';

// ==================== STATE ====================

let drawingWords = [];
let _io = null;
let _saveUser = null;
let _getUser = null;

const drawingLobby = {
  roomCode: DRAWING_ROOM,
  players: {},           // socketId -> { id, name, profilePicture, score, guessedThisTurn, guessTime }
  spectators: {},        // socketId -> { id, name, profilePicture }
  turnOrder: [],         // Array of socketIds
  currentTurnIndex: 0,
  currentDrawer: null,   // socketId of current drawer
  currentWord: null,     // The word being drawn
  currentWordBlanks: '', // Word with blanks like "_ _ _ _ _"
  revealedPositions: [], // Array of revealed letter positions
  gameState: 'waiting',  // waiting | word_selection | drawing | turn_end | results
  turnStartTime: null,
  wordOptions: [],       // 3 word options for drawer
  canvasHistory: [],     // For late joiners to replay
  host: null,            // socketId of host (first player to join)
  turnTimer: null,       // Timeout for turn end
  wordSelectionTimer: null, // Timeout for word selection
  hintTimers: [],        // Timeouts for letter hints
  usedWords: []          // Words already used this game (to prevent repeats)
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Load drawing words from JSON file
 * @param {string} baseDir - Base directory for public folder
 */
function loadDrawingWords(baseDir) {
  try {
    const data = fs.readFileSync(path.join(baseDir, 'public', 'drawing-words.json'), 'utf8');
    const parsed = JSON.parse(data);
    drawingWords = parsed.words || [];
    log('DRAWING', `Loaded ${drawingWords.length} drawing words`);
  } catch (err) {
    warn('DRAWING', 'Error loading drawing words:', err.message);
    drawingWords = [];
  }
}

/**
 * Get player list formatted for client
 */
function getDrawingPlayerList() {
  return Object.values(drawingLobby.players)
    .map(p => ({
      id: p.id,
      name: p.name,
      profilePicture: p.profilePicture,
      score: p.score,
      guessedThisTurn: p.guessedThisTurn,
      isDrawer: p.id === drawingLobby.currentDrawer,
      isHost: p.id === drawingLobby.host
    }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Get spectator list formatted for client
 */
function getDrawingSpectatorList() {
  return Object.values(drawingLobby.spectators).map(s => ({
    id: s.id,
    name: s.name,
    profilePicture: s.profilePicture
  }));
}

/**
 * Generate word blanks with revealed letters
 * @param {string} word - The word
 * @param {number[]} revealedPositions - Positions of revealed letters
 */
function generateWordBlanks(word, revealedPositions) {
  let blanks = '';
  for (let i = 0; i < word.length; i++) {
    if (word[i] === ' ') {
      // Add extra spaces between words so players can tell word boundaries
      blanks += '    ';
    } else if (revealedPositions.includes(i)) {
      blanks += word[i] + ' ';
    } else {
      blanks += '_ ';
    }
  }
  return blanks.trim();
}

/**
 * Normalize text for guess comparison
 */
function normalizeGuess(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Calculate points based on guess time
 * @param {number} elapsedSeconds - Time since turn started
 */
function calculateDrawingPoints(elapsedSeconds) {
  // 1000 points at 0s, linear decrease to 100 at 50s, flat 100 for last 10s
  if (elapsedSeconds >= 50) {
    return 100;
  }
  return Math.round(1000 - (900 * (elapsedSeconds / 50)));
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Check if guess is close to the word
 * Uses Levenshtein distance - allows 1-2 character mistakes based on word length
 */
function isCloseGuess(guess, word) {
  const normalizedGuess = normalizeGuess(guess);
  const normalizedWord = normalizeGuess(word);

  if (normalizedGuess.length < 2 || normalizedWord.length < 2) return false;

  // Don't consider it close if lengths are too different
  const lengthDiff = Math.abs(normalizedGuess.length - normalizedWord.length);
  if (lengthDiff > 2) return false;

  const distance = levenshteinDistance(normalizedGuess, normalizedWord);

  // Allow 1-2 character mistakes depending on word length
  // Short words (<=5): allow 1 mistake
  // Longer words (>5): allow 2 mistakes
  const maxDistance = normalizedWord.length <= 5 ? 1 : 2;

  return distance > 0 && distance <= maxDistance;
}

/**
 * Get random words for drawer to choose from
 */
function getRandomWords(count) {
  // Filter out words that have already been used this game
  const availableWords = drawingWords.filter(w => !drawingLobby.usedWords.includes(w.word));

  if (availableWords.length < count) {
    // If not enough unused words, reset and use all words
    drawingLobby.usedWords = [];
    const shuffled = shuffleArray(drawingWords);
    return shuffled.slice(0, count);
  }
  const shuffled = shuffleArray(availableWords);
  return shuffled.slice(0, count);
}

// ==================== GAME FLOW FUNCTIONS ====================

/**
 * Start a drawing turn
 */
function startDrawingTurn() {
  const io = _io;
  const drawerId = drawingLobby.turnOrder[drawingLobby.currentTurnIndex];
  if (!drawerId || !drawingLobby.players[drawerId]) {
    // Skip to next valid player or end game
    if (drawingLobby.currentTurnIndex < drawingLobby.turnOrder.length - 1) {
      drawingLobby.currentTurnIndex++;
      startDrawingTurn();
    } else {
      endDrawingGame();
    }
    return;
  }

  drawingLobby.currentDrawer = drawerId;
  drawingLobby.gameState = 'word_selection';
  drawingLobby.wordOptions = getRandomWords(3);
  drawingLobby.canvasHistory = [];
  drawingLobby.currentWord = null;
  drawingLobby.revealedPositions = [];

  // Reset guessed state from previous turn immediately
  Object.values(drawingLobby.players).forEach(p => {
    p.guessedThisTurn = false;
    p.guessTime = null;
  });

  // Send updated player list with reset guessed states
  io.to(DRAWING_ROOM).emit('drawingPlayerList', {
    players: getDrawingPlayerList(),
    spectators: getDrawingSpectatorList()
  });

  // Send word options only to drawer
  io.to(drawerId).emit('drawingWordOptions', {
    words: drawingLobby.wordOptions,
    turnIndex: drawingLobby.currentTurnIndex,
    totalTurns: drawingLobby.turnOrder.length
  });

  // Tell others that drawer is choosing
  const drawerName = drawingLobby.players[drawerId]?.name;
  io.to(DRAWING_ROOM).emit('drawingWordSelection', {
    drawer: drawerName,
    drawerId: drawerId,
    turnIndex: drawingLobby.currentTurnIndex,
    totalTurns: drawingLobby.turnOrder.length
  });

  log('DRAWING', `Turn ${drawingLobby.currentTurnIndex + 1}/${drawingLobby.turnOrder.length}: ${drawerName} is choosing a word`);

  // 15 second timeout for word selection
  drawingLobby.wordSelectionTimer = setTimeout(() => {
    // Auto-select random word if drawer doesn't choose
    if (drawingLobby.gameState === 'word_selection' && drawingLobby.wordOptions.length > 0) {
      const randomIndex = Math.floor(Math.random() * drawingLobby.wordOptions.length);
      const autoWord = drawingLobby.wordOptions[randomIndex];
      drawingLobby.currentWord = autoWord.word;
      drawingLobby.usedWords.push(autoWord.word);
      drawingLobby.revealedPositions = [];
      drawingLobby.currentWordBlanks = generateWordBlanks(autoWord.word, []);
      drawingLobby.gameState = 'drawing';
      drawingLobby.turnStartTime = Date.now();

      // Reset guessed state
      Object.values(drawingLobby.players).forEach(p => {
        p.guessedThisTurn = false;
        p.guessTime = null;
      });

      io.to(drawerId).emit('drawingYourWord', {
        word: autoWord.word,
        category: autoWord.category
      });

      // Send blanks to everyone EXCEPT the drawer
      const drawerSocket = io.sockets.sockets.get(drawerId);
      if (drawerSocket) {
        drawerSocket.to(DRAWING_ROOM).emit('drawingWordSelected', {
          wordLength: autoWord.word.length,
          blanks: drawingLobby.currentWordBlanks,
          category: autoWord.category
        });
      } else {
        io.to(DRAWING_ROOM).emit('drawingWordSelected', {
          wordLength: autoWord.word.length,
          blanks: drawingLobby.currentWordBlanks,
          category: autoWord.category
        });
      }

      io.to(DRAWING_ROOM).emit('drawingTurnStart', {
        drawer: drawerName,
        drawerId: drawerId,
        duration: 60,
        turnIndex: drawingLobby.currentTurnIndex,
        totalTurns: drawingLobby.turnOrder.length,
        serverTime: Date.now()
      });

      scheduleHints();

      drawingLobby.turnTimer = setTimeout(() => {
        endDrawingTurn(false);
      }, 60000);
    }
  }, 15000);
}

/**
 * Schedule hint reveals during a turn
 */
function scheduleHints() {
  const io = _io;
  // Clear any existing hint timers
  drawingLobby.hintTimers.forEach(t => clearTimeout(t));
  drawingLobby.hintTimers = [];

  const word = drawingLobby.currentWord;
  if (!word) return;

  // Get letter positions (excluding spaces)
  const letterPositions = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== ' ') {
      letterPositions.push(i);
    }
  }

  // First hint at 30s: reveal first letter
  drawingLobby.hintTimers.push(setTimeout(() => {
    if (drawingLobby.gameState !== 'drawing') return;
    revealHint(0);
  }, 30000));

  // Second hint at 40s
  drawingLobby.hintTimers.push(setTimeout(() => {
    if (drawingLobby.gameState !== 'drawing') return;
    const unrevealed = letterPositions.filter(p => !drawingLobby.revealedPositions.includes(p));
    if (unrevealed.length > 0) {
      const randomPos = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      revealHint(randomPos);
    }
  }, 40000));

  // Third hint at 50s
  drawingLobby.hintTimers.push(setTimeout(() => {
    if (drawingLobby.gameState !== 'drawing') return;
    const unrevealed = letterPositions.filter(p => !drawingLobby.revealedPositions.includes(p));
    if (unrevealed.length > 0) {
      const randomPos = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      revealHint(randomPos);
    }
  }, 50000));
}

/**
 * Reveal a letter hint
 */
function revealHint(position) {
  const io = _io;
  if (!drawingLobby.currentWord) return;

  drawingLobby.revealedPositions.push(position);
  drawingLobby.currentWordBlanks = generateWordBlanks(drawingLobby.currentWord, drawingLobby.revealedPositions);

  io.to(DRAWING_ROOM).emit('drawingHintReveal', {
    position: position,
    letter: drawingLobby.currentWord[position],
    blanks: drawingLobby.currentWordBlanks
  });
}

/**
 * End the current drawing turn
 */
function endDrawingTurn(allGuessed) {
  const io = _io;
  // Clear timers
  if (drawingLobby.turnTimer) {
    clearTimeout(drawingLobby.turnTimer);
    drawingLobby.turnTimer = null;
  }
  if (drawingLobby.wordSelectionTimer) {
    clearTimeout(drawingLobby.wordSelectionTimer);
    drawingLobby.wordSelectionTimer = null;
  }
  drawingLobby.hintTimers.forEach(t => clearTimeout(t));
  drawingLobby.hintTimers = [];

  drawingLobby.gameState = 'turn_end';

  const word = drawingLobby.currentWord || '???';
  const drawerName = drawingLobby.players[drawingLobby.currentDrawer]?.name || 'Unknown';

  // Calculate turn scores
  const turnScores = Object.values(drawingLobby.players).map(p => ({
    name: p.name,
    guessed: p.guessedThisTurn,
    guessTime: p.guessTime ? Math.round(p.guessTime) : null,
    totalScore: p.score
  }));

  io.to(DRAWING_ROOM).emit('drawingTurnEnd', {
    word: word,
    drawer: drawerName,
    allGuessed: allGuessed,
    turnScores: turnScores,
    players: getDrawingPlayerList(),
    turnIndex: drawingLobby.currentTurnIndex,
    totalTurns: drawingLobby.turnOrder.length,
    serverTime: Date.now()
  });

  log('DRAWING', `Turn ended. Word was: ${word}`);

  // Award $qr coins
  if (_saveUser && _getUser) {
    const TURN_DURATION = 60; // 60 seconds
    let drawerCoins = 0;

    // Award coins to guessers based on time
    Object.entries(drawingLobby.players).forEach(([socketId, player]) => {
      if (socketId === drawingLobby.currentDrawer) return; // Skip drawer for now

      if (player.guessedThisTurn && player.guessTime !== null) {
        const user = _getUser(player.name);
        if (user) {
          const timePercent = (player.guessTime / TURN_DURATION) * 100;
          let coinsEarned = 1; // Default: >= 50%

          if (timePercent < 25) coinsEarned = 3;       // Very quick guess
          else if (timePercent < 50) coinsEarned = 2;  // Medium guess

          user.coins = (user.coins ?? 1000) + coinsEarned;
          _saveUser(player.name);
          io.to(socketId).emit('coinsEarned', { amount: coinsEarned, total: user.coins });

          drawerCoins++; // +1 for drawer per correct guess
        }
      }
    });

    // Award coins to drawer (+1 per correct guess)
    if (drawerCoins > 0 && drawingLobby.currentDrawer) {
      const drawer = drawingLobby.players[drawingLobby.currentDrawer];
      if (drawer) {
        const drawerUser = _getUser(drawer.name);
        if (drawerUser) {
          drawerUser.coins = (drawerUser.coins ?? 1000) + drawerCoins;
          _saveUser(drawer.name);
          io.to(drawingLobby.currentDrawer).emit('coinsEarned', { amount: drawerCoins, total: drawerUser.coins });
        }
      }
    }
  }

  // Check if game is over
  if (drawingLobby.currentTurnIndex >= drawingLobby.turnOrder.length - 1) {
    setTimeout(() => {
      endDrawingGame();
    }, 3000);
  } else {
    setTimeout(() => {
      drawingLobby.currentTurnIndex++;
      startDrawingTurn();
    }, 5000);
  }
}

/**
 * End the drawing game
 */
function endDrawingGame() {
  const io = _io;
  drawingLobby.gameState = 'results';

  const finalRankings = Object.values(drawingLobby.players)
    .map(p => ({
      name: p.name,
      profilePicture: p.profilePicture,
      score: p.score
    }))
    .sort((a, b) => b.score - a.score);

  io.to(DRAWING_ROOM).emit('drawingGameEnd', {
    rankings: finalRankings,
    serverTime: Date.now()
  });

  log('DRAWING', `Game ended. Rankings: ${finalRankings.map(r => `${r.name}: ${r.score}`).join(', ')}`);

  // Reset lobby after delay
  setTimeout(() => {
    resetDrawingLobby();
  }, 10000);
}

/**
 * Reset the drawing lobby
 */
function resetDrawingLobby() {
  const io = _io;
  drawingLobby.turnOrder = [];
  drawingLobby.currentTurnIndex = 0;
  drawingLobby.currentDrawer = null;
  drawingLobby.currentWord = null;
  drawingLobby.currentWordBlanks = '';
  drawingLobby.revealedPositions = [];
  drawingLobby.gameState = 'waiting';
  drawingLobby.turnStartTime = null;
  drawingLobby.wordOptions = [];
  drawingLobby.canvasHistory = [];
  drawingLobby.usedWords = [];

  // Reset player scores but keep them in lobby
  Object.values(drawingLobby.players).forEach(p => {
    p.score = 0;
    p.guessedThisTurn = false;
    p.guessTime = null;
  });

  // Move spectators back to players
  Object.entries(drawingLobby.spectators).forEach(([id, spec]) => {
    drawingLobby.players[id] = {
      id: id,
      name: spec.name,
      profilePicture: spec.profilePicture,
      score: 0,
      guessedThisTurn: false,
      guessTime: null
    };
  });
  drawingLobby.spectators = {};

  // Update host
  const playerIds = Object.keys(drawingLobby.players);
  if (playerIds.length > 0 && (!drawingLobby.host || !drawingLobby.players[drawingLobby.host])) {
    drawingLobby.host = playerIds[0];
  }

  io.to(DRAWING_ROOM).emit('drawingLobbyReset', {
    players: getDrawingPlayerList(),
    spectators: getDrawingSpectatorList()
  });

  // Notify each player of their host status
  Object.keys(drawingLobby.players).forEach(pid => {
    io.to(pid).emit('drawingHostStatus', {
      isHost: drawingLobby.host === pid
    });
  });

  log('DRAWING', 'Lobby reset');
}

/**
 * Handle player disconnect
 */
function handleDrawingDisconnect(socketId) {
  const io = _io;
  const wasPlayer = !!drawingLobby.players[socketId];
  const wasSpectator = !!drawingLobby.spectators[socketId];
  const wasDrawer = drawingLobby.currentDrawer === socketId;
  const wasHost = drawingLobby.host === socketId;
  const playerName = drawingLobby.players[socketId]?.name || drawingLobby.spectators[socketId]?.name;

  // Remove from players/spectators
  delete drawingLobby.players[socketId];
  delete drawingLobby.spectators[socketId];

  // Remove from turn order
  drawingLobby.turnOrder = drawingLobby.turnOrder.filter(id => id !== socketId);

  // Update host
  if (wasHost) {
    const playerIds = Object.keys(drawingLobby.players);
    drawingLobby.host = playerIds.length > 0 ? playerIds[0] : null;
  }

  // If drawer left during their turn, end the turn
  if (wasDrawer && (drawingLobby.gameState === 'drawing' || drawingLobby.gameState === 'word_selection')) {
    endDrawingTurn(false);
  }

  // Notify others
  if (wasPlayer || wasSpectator) {
    io.to(DRAWING_ROOM).emit('drawingPlayerList', {
      players: getDrawingPlayerList(),
      spectators: getDrawingSpectatorList()
    });

    if (playerName) {
      io.to(DRAWING_ROOM).emit('drawingChatMessage', {
        system: true,
        message: `${playerName} abandonó la sala`
      });
    }
  }

  // Reset if no players left
  if (Object.keys(drawingLobby.players).length === 0 && Object.keys(drawingLobby.spectators).length === 0) {
    resetDrawingLobby();
    log('DRAWING', 'Lobby reset (empty)');
  }
}

// ==================== SOCKET HANDLERS ====================

/**
 * Initialize drawing module with io reference and load words
 * @param {Object} io - Socket.IO server instance
 * @param {string} baseDir - Base directory for public folder
 */
function init(io, baseDir) {
  _io = io;
  loadDrawingWords(baseDir);
}

/**
 * Setup socket handlers for a connection
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} context - Shared context { getUser, saveUser, getLoggedInUsername }
 */
function setupHandlers(io, socket, context = {}) {
  const { getUser, saveUser, getLoggedInUsername } = context;

  // Store references at module level for use in endDrawingTurn
  if (saveUser && !_saveUser) _saveUser = saveUser;
  if (getUser && !_getUser) _getUser = getUser;

  // Per-socket state
  let isDrawingPlayer = false;
  let isDrawingSpectator = false;

  socket.on('drawingJoin', (data) => {
    const username = data?.username || 'Guest';
    const profilePicture = data?.profilePicture || 'profiles/default.svg';

    // Already in the room?
    if (drawingLobby.players[socket.id] || drawingLobby.spectators[socket.id]) {
      return;
    }

    socket.join(DRAWING_ROOM);

    // If game is in progress, join as spectator
    if (drawingLobby.gameState !== 'waiting') {
      drawingLobby.spectators[socket.id] = {
        id: socket.id,
        name: username,
        profilePicture: profilePicture
      };
      isDrawingSpectator = true;
      isDrawingPlayer = false;

      socket.emit('drawingJoined', {
        players: getDrawingPlayerList(),
        spectators: getDrawingSpectatorList(),
        isHost: false,
        isSpectator: true,
        gameState: drawingLobby.gameState,
        canvasHistory: drawingLobby.canvasHistory,
        currentDrawer: drawingLobby.currentDrawer ? drawingLobby.players[drawingLobby.currentDrawer]?.name : null,
        wordBlanks: drawingLobby.currentWordBlanks,
        turnIndex: drawingLobby.currentTurnIndex,
        totalTurns: drawingLobby.turnOrder.length
      });

      io.to(DRAWING_ROOM).emit('drawingPlayerList', {
        players: getDrawingPlayerList(),
        spectators: getDrawingSpectatorList()
      });

      log('DRAWING', `${username} joined as spectator`);
      return;
    }

    // Join as player
    drawingLobby.players[socket.id] = {
      id: socket.id,
      name: username,
      profilePicture: profilePicture,
      score: 0,
      guessedThisTurn: false,
      guessTime: null
    };
    isDrawingPlayer = true;
    isDrawingSpectator = false;

    // First player becomes host
    if (!drawingLobby.host || !drawingLobby.players[drawingLobby.host]) {
      drawingLobby.host = socket.id;
    }

    socket.emit('drawingJoined', {
      players: getDrawingPlayerList(),
      spectators: getDrawingSpectatorList(),
      isHost: drawingLobby.host === socket.id,
      isSpectator: false,
      gameState: drawingLobby.gameState
    });

    socket.to(DRAWING_ROOM).emit('drawingPlayerList', {
      players: getDrawingPlayerList(),
      spectators: getDrawingSpectatorList()
    });

    io.to(DRAWING_ROOM).emit('drawingChatMessage', {
      system: true,
      message: `${username} se unió a la sala`
    });

    log('DRAWING', `${username} joined as player`);
  });

  socket.on('drawingLeave', () => {
    socket.leave(DRAWING_ROOM);
    handleDrawingDisconnect(socket.id);
    isDrawingPlayer = false;
    isDrawingSpectator = false;
  });

  socket.on('drawingBecomeSpectator', () => {
    if (!drawingLobby.players[socket.id]) return;

    const player = drawingLobby.players[socket.id];

    // Can't become spectator if you're the current drawer
    if (drawingLobby.currentDrawer === socket.id) {
      socket.emit('drawingError', { message: 'No puedes ser espectador mientras dibujas' });
      return;
    }

    // Move to spectators
    drawingLobby.spectators[socket.id] = {
      id: socket.id,
      name: player.name,
      profilePicture: player.profilePicture
    };
    delete drawingLobby.players[socket.id];
    isDrawingSpectator = true;
    isDrawingPlayer = false;

    // Remove from turn order
    drawingLobby.turnOrder = drawingLobby.turnOrder.filter(id => id !== socket.id);

    // Update host if needed
    if (drawingLobby.host === socket.id) {
      const playerIds = Object.keys(drawingLobby.players);
      drawingLobby.host = playerIds.length > 0 ? playerIds[0] : null;
    }

    socket.emit('drawingBecameSpectator', {
      players: getDrawingPlayerList(),
      spectators: getDrawingSpectatorList()
    });

    io.to(DRAWING_ROOM).emit('drawingPlayerList', {
      players: getDrawingPlayerList(),
      spectators: getDrawingSpectatorList()
    });

    io.to(DRAWING_ROOM).emit('drawingChatMessage', {
      system: true,
      message: `${player.name} ahora es espectador`
    });
  });

  socket.on('drawingSpectatorJoinNext', () => {
    if (!drawingLobby.spectators[socket.id]) return;

    const spectator = drawingLobby.spectators[socket.id];

    // Can only join during waiting or word selection
    if (drawingLobby.gameState === 'drawing') {
      socket.emit('drawingError', { message: 'Espera a que termine el turno' });
      return;
    }

    // Move to players
    drawingLobby.players[socket.id] = {
      id: socket.id,
      name: spectator.name,
      profilePicture: spectator.profilePicture,
      score: 0,
      guessedThisTurn: false,
      guessTime: null
    };
    delete drawingLobby.spectators[socket.id];
    isDrawingPlayer = true;
    isDrawingSpectator = false;

    // Add to turn order if game is in progress
    if (drawingLobby.gameState !== 'waiting') {
      drawingLobby.turnOrder.push(socket.id);
    }

    // Update host if needed
    if (!drawingLobby.host) {
      drawingLobby.host = socket.id;
    }

    socket.emit('drawingJoinedFromSpectator', {
      players: getDrawingPlayerList(),
      spectators: getDrawingSpectatorList(),
      isHost: drawingLobby.host === socket.id
    });

    io.to(DRAWING_ROOM).emit('drawingPlayerList', {
      players: getDrawingPlayerList(),
      spectators: getDrawingSpectatorList()
    });

    io.to(DRAWING_ROOM).emit('drawingChatMessage', {
      system: true,
      message: `${spectator.name} se unió como jugador`
    });
  });

  socket.on('drawingStartGame', () => {
    // Only host can start
    if (drawingLobby.host !== socket.id) {
      socket.emit('drawingError', { message: 'Solo el anfitrión puede iniciar' });
      return;
    }

    // Need at least 3 players
    const playerCount = Object.keys(drawingLobby.players).length;
    if (playerCount < 3) {
      socket.emit('drawingError', { message: 'Se necesitan al menos 3 jugadores' });
      return;
    }

    // Can only start from waiting state
    if (drawingLobby.gameState !== 'waiting') {
      return;
    }

    // Initialize game - 3 rounds (each player draws 3 times)
    const playerIds = shuffleArray(Object.keys(drawingLobby.players));
    drawingLobby.turnOrder = [...playerIds, ...playerIds, ...playerIds];
    drawingLobby.currentTurnIndex = 0;
    drawingLobby.canvasHistory = [];

    // Reset all scores
    Object.values(drawingLobby.players).forEach(p => {
      p.score = 0;
      p.guessedThisTurn = false;
      p.guessTime = null;
    });

    io.to(DRAWING_ROOM).emit('drawingGameStart', {
      players: getDrawingPlayerList(),
      turnOrder: drawingLobby.turnOrder.map(id => drawingLobby.players[id]?.name),
      totalTurns: drawingLobby.turnOrder.length
    });

    log('DRAWING', `Game started with ${playerCount} players`);

    startDrawingTurn();
  });

  socket.on('drawingSelectWord', (data) => {
    // Only current drawer can select
    if (drawingLobby.currentDrawer !== socket.id) return;
    if (drawingLobby.gameState !== 'word_selection') return;

    const wordIndex = data?.wordIndex;
    if (wordIndex === undefined || wordIndex < 0 || wordIndex >= 3) return;

    // Clear word selection timer
    if (drawingLobby.wordSelectionTimer) {
      clearTimeout(drawingLobby.wordSelectionTimer);
      drawingLobby.wordSelectionTimer = null;
    }

    const selectedWord = drawingLobby.wordOptions[wordIndex];
    drawingLobby.currentWord = selectedWord.word;
    drawingLobby.usedWords.push(selectedWord.word);
    drawingLobby.revealedPositions = [];
    drawingLobby.currentWordBlanks = generateWordBlanks(selectedWord.word, []);
    drawingLobby.gameState = 'drawing';
    drawingLobby.turnStartTime = Date.now();
    drawingLobby.canvasHistory = [];

    // Reset guessed state for all players
    Object.values(drawingLobby.players).forEach(p => {
      p.guessedThisTurn = false;
      p.guessTime = null;
    });

    // Tell drawer the word
    socket.emit('drawingYourWord', {
      word: selectedWord.word,
      category: selectedWord.category
    });

    // Tell others the blanks
    socket.to(DRAWING_ROOM).emit('drawingWordSelected', {
      wordLength: selectedWord.word.length,
      blanks: drawingLobby.currentWordBlanks,
      category: selectedWord.category
    });

    io.to(DRAWING_ROOM).emit('drawingTurnStart', {
      drawer: drawingLobby.players[socket.id]?.name,
      drawerId: socket.id,
      duration: 60,
      turnIndex: drawingLobby.currentTurnIndex,
      totalTurns: drawingLobby.turnOrder.length,
      serverTime: Date.now()
    });

    log('DRAWING', `Drawer selected word: ${selectedWord.word}`);

    scheduleHints();

    // Set turn timer (60 seconds)
    drawingLobby.turnTimer = setTimeout(() => {
      endDrawingTurn(false);
    }, 60000);
  });

  socket.on('drawingGuess', (data) => {
    const guess = data?.guess?.trim();
    if (!guess) return;

    // Must be a player (not spectator) and not the drawer
    if (!drawingLobby.players[socket.id]) return;
    if (drawingLobby.currentDrawer === socket.id) return;
    if (drawingLobby.gameState !== 'drawing') return;

    const player = drawingLobby.players[socket.id];

    // Already guessed?
    if (player.guessedThisTurn) return;

    // Check if correct
    const isCorrect = normalizeGuess(guess) === normalizeGuess(drawingLobby.currentWord);

    if (isCorrect) {
      const elapsed = (Date.now() - drawingLobby.turnStartTime) / 1000;
      const points = calculateDrawingPoints(elapsed);

      player.guessedThisTurn = true;
      player.guessTime = elapsed;
      player.score += points;

      // Award drawer points too
      if (drawingLobby.players[drawingLobby.currentDrawer]) {
        drawingLobby.players[drawingLobby.currentDrawer].score += points;
      }

      io.to(DRAWING_ROOM).emit('drawingCorrectGuess', {
        player: player.name,
        points: points,
        elapsed: Math.round(elapsed),
        players: getDrawingPlayerList()
      });

      io.to(DRAWING_ROOM).emit('drawingChatMessage', {
        system: true,
        message: `${player.name} adivinó la palabra, +${points} puntos`
      });

      log('DRAWING', `${player.name} guessed correctly: ${guess} (+${points} points)`);

      // Check if all players have guessed
      const guessers = Object.values(drawingLobby.players).filter(
        p => p.id !== drawingLobby.currentDrawer
      );
      const allGuessed = guessers.every(p => p.guessedThisTurn);

      if (allGuessed) {
        endDrawingTurn(true);
      }
    } else {
      // Check for close guess first
      if (isCloseGuess(guess, drawingLobby.currentWord)) {
        // Close guess - only tell the guesser, hide from others
        socket.emit('drawingCloseGuess', { message: 'Casi' });
      } else {
        // Wrong guess - show in chat to everyone
        io.to(DRAWING_ROOM).emit('drawingChatMessage', {
          player: player.name,
          message: guess
        });
      }
    }
  });

  socket.on('drawingStroke', (data) => {
    if (drawingLobby.currentDrawer !== socket.id) return;
    if (drawingLobby.gameState !== 'drawing') return;

    drawingLobby.canvasHistory.push({ type: 'stroke', data: data });
    socket.to(DRAWING_ROOM).emit('drawingStrokeReceive', data);
  });

  socket.on('drawingFill', (data) => {
    if (drawingLobby.currentDrawer !== socket.id) return;
    if (drawingLobby.gameState !== 'drawing') return;

    drawingLobby.canvasHistory.push({ type: 'fill', data: data });
    socket.to(DRAWING_ROOM).emit('drawingFillReceive', data);
  });

  socket.on('drawingSpray', (data) => {
    if (drawingLobby.currentDrawer !== socket.id) return;
    if (drawingLobby.gameState !== 'drawing') return;

    drawingLobby.canvasHistory.push({ type: 'spray', data: data });
    socket.to(DRAWING_ROOM).emit('drawingSprayReceive', data);
  });

  socket.on('drawingShape', (data) => {
    if (drawingLobby.currentDrawer !== socket.id) return;
    if (drawingLobby.gameState !== 'drawing') return;

    drawingLobby.canvasHistory.push({ type: 'shape', data: data });
    socket.to(DRAWING_ROOM).emit('drawingShapeReceive', data);
  });

  socket.on('drawingClear', () => {
    if (drawingLobby.currentDrawer !== socket.id) return;
    if (drawingLobby.gameState !== 'drawing') return;

    drawingLobby.canvasHistory = [];
    socket.to(DRAWING_ROOM).emit('drawingClearReceive');
  });

  socket.on('drawingUndo', (data) => {
    if (drawingLobby.currentDrawer !== socket.id) return;
    if (drawingLobby.gameState !== 'drawing') return;

    socket.to(DRAWING_ROOM).emit('drawingUndoReceive', data);
  });

  socket.on('drawingChatMessage', (data) => {
    const message = data?.message?.trim();
    if (!message) return;

    // Get player or spectator name
    let senderName = null;
    if (drawingLobby.players[socket.id]) {
      senderName = drawingLobby.players[socket.id].name;
    } else if (drawingLobby.spectators[socket.id]) {
      senderName = drawingLobby.spectators[socket.id].name;
    }

    if (!senderName) return;

    // If it's during drawing phase, treat as guess for players
    if (drawingLobby.gameState === 'drawing' && drawingLobby.players[socket.id] &&
        drawingLobby.currentDrawer !== socket.id) {
      // Trigger guess handler by emitting to self
      socket.emit('drawingGuess', { guess: message });
      return;
    }

    // Otherwise just send as chat
    io.to(DRAWING_ROOM).emit('drawingChatMessage', {
      player: senderName,
      message: message
    });
  });

  // Return cleanup info for disconnect handling
  return {
    isDrawingPlayer: () => isDrawingPlayer,
    isDrawingSpectator: () => isDrawingSpectator,
    handleDisconnect: () => handleDrawingDisconnect(socket.id)
  };
}

module.exports = {
  init,
  setupHandlers,
  handleDrawingDisconnect,
  drawingLobby,
  DRAWING_ROOM
};
