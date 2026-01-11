/**
 * Typing Game Socket Handlers (VS + Coop modes)
 *
 * Handles Tikitiki typing game multiplayer logic.
 * Extracted from server.js for modularity.
 */

const fs = require('fs');
const path = require('path');
const { generateRoomCode, shuffleArray, log, warn } = require('../utils');

// ==================== STATE ====================

let _io = null;
let _saveUser = null;
let _getUser = null;

// Typing game lobbies
const typingLobbies = {};
const typingCoopLobbies = {};

// Word lists
let typingWordsSinTildes = [];
let typingWordsConTildes = [];

// ==================== INITIALIZATION ====================

/**
 * Initialize typing module with io reference and load words
 * @param {Object} io - Socket.IO server instance
 * @param {string} baseDir - Base directory for public folder
 */
function init(io, baseDir) {
  _io = io;
  loadTypingWords(baseDir);
}

/**
 * Load typing words from JSON files
 */
function loadTypingWords(baseDir) {
  try {
    typingWordsSinTildes = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'public', 'words-es-sin-tildes.json'), 'utf8')
    ).words;
    log('TYPING', `Loaded ${typingWordsSinTildes.length} words (sin tildes)`);
  } catch (err) {
    warn('TYPING', 'Error loading words (sin tildes):', err.message);
    typingWordsSinTildes = [];
  }

  try {
    typingWordsConTildes = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'public', 'words-es-con-tildes.json'), 'utf8')
    ).words;
    log('TYPING', `Loaded ${typingWordsConTildes.length} words (con tildes)`);
  } catch (err) {
    warn('TYPING', 'Error loading words (con tildes):', err.message);
    typingWordsConTildes = [];
  }
}

// ==================== HELPER FUNCTIONS ====================

function getTypingPlayerList(roomCode) {
  const lobby = typingLobbies[roomCode];
  if (!lobby) return [];

  return Object.entries(lobby.players).map(([id, player]) => ({
    id,
    name: player.name,
    username: player.username,
    profilePicture: player.profilePicture,
    ready: player.ready,
    progress: player.progress
  }));
}

function getTypingSpectatorList(roomCode) {
  const lobby = typingLobbies[roomCode];
  if (!lobby || !lobby.spectators) return [];

  return Object.entries(lobby.spectators).map(([id, spectator]) => ({
    id,
    name: spectator.name,
    username: spectator.username,
    profilePicture: spectator.profilePicture
  }));
}

function getTypingCoopPlayerList(roomCode) {
  const lobby = typingCoopLobbies[roomCode];
  if (!lobby) return [];

  return Object.entries(lobby.players).map(([id, player]) => ({
    id,
    name: player.name,
    username: player.username,
    profilePicture: player.profilePicture,
    wordsTyped: player.wordsTyped,
    charsTyped: player.charsTyped,
    errors: player.errors,
    wpm: player.wpm,
    accuracy: player.accuracy
  }));
}

function getTypingCoopSpectatorList(roomCode) {
  const lobby = typingCoopLobbies[roomCode];
  if (!lobby || !lobby.spectators) return [];

  return Object.entries(lobby.spectators).map(([id, spectator]) => ({
    id,
    name: spectator.name,
    username: spectator.username,
    profilePicture: spectator.profilePicture
  }));
}

// ==================== VS MODE GAME FLOW ====================

function startTypingCountdown(roomCode) {
  const io = _io;
  const lobby = typingLobbies[roomCode];
  if (!lobby) return;

  lobby.gameState = 'countdown';

  // Generate words (use correct word set based on tildesMode)
  const wordSet = lobby.tildesMode ? typingWordsConTildes : typingWordsSinTildes;
  lobby.words = shuffleArray(wordSet).slice(0, 120);

  // Reset player states
  Object.values(lobby.players).forEach(player => {
    player.progress = { charIndex: 0, wpm: 0, accuracy: 100, progress: 0 };
    player.result = null;
  });

  // Countdown 3-2-1
  let count = 3;
  const players = getTypingPlayerList(roomCode);
  const spectators = getTypingSpectatorList(roomCode);
  const countdownInterval = setInterval(() => {
    io.to('typing-' + roomCode).emit('typingCountdown', {
      seconds: count,
      players: players,
      spectators: spectators
    });
    count--;

    if (count < 0) {
      clearInterval(countdownInterval);
      startTypingGame(roomCode);
    }
  }, 1000);
}

function startTypingGame(roomCode) {
  const io = _io;
  const lobby = typingLobbies[roomCode];
  if (!lobby) return;

  lobby.gameState = 'playing';
  lobby.startTime = Date.now();

  const playersList = getTypingPlayerList(roomCode);
  const spectatorsList = getTypingSpectatorList(roomCode);

  io.to('typing-' + roomCode).emit('typingStart', {
    words: lobby.words,
    duration: lobby.duration,
    players: playersList,
    spectators: spectatorsList,
    serverTime: Date.now(),
    startTime: lobby.startTime
  });

  // Set timeout to end round after 60 seconds
  setTimeout(() => {
    if (lobby.gameState === 'playing') {
      endTypingRound(roomCode);
    }
  }, lobby.duration + 1000);

  log('TYPING', `VS game started in room ${roomCode} with ${playersList.length} players`);
}

function endTypingRound(roomCode, updateLeaderboard = null) {
  const io = _io;
  const lobby = typingLobbies[roomCode];
  if (!lobby || lobby.gameState === 'finished') return;

  lobby.gameState = 'finished';

  const players = Object.entries(lobby.players);

  // Sort by WPM (higher is better)
  const results = players.map(([id, player]) => ({
    id,
    name: player.name,
    profilePicture: player.profilePicture,
    wpm: player.result?.wpm || player.progress?.wpm || 0,
    accuracy: player.result?.accuracy || player.progress?.accuracy || 100,
    chars: player.result?.chars || 0,
    errors: player.result?.errors || 0
  })).sort((a, b) => b.wpm - a.wpm);

  const winner = results[0];

  // Send results to each player
  players.forEach(([socketId, player]) => {
    const myResult = results.find(r => r.id === socketId) || {
      wpm: 0,
      accuracy: 100,
      chars: 0,
      errors: 0
    };

    io.to(socketId).emit('typingRoundEnd', {
      isMultiplayer: true,
      winner: winner,
      results: results,
      myResult: myResult,
      serverTime: Date.now()
    });
  });

  // Send results to spectators
  const spectators = Object.keys(lobby.spectators || {});
  spectators.forEach(spectatorId => {
    io.to(spectatorId).emit('typingRoundEnd', {
      isMultiplayer: true,
      isSpectator: true,
      winner: winner,
      results: results,
      myResult: null,
      serverTime: Date.now()
    });
  });

  // Update leaderboard if callback provided
  if (updateLeaderboard) {
    for (const [, player] of Object.entries(lobby.players)) {
      if (player.result && player.username) {
        updateLeaderboard(
          player.username,
          player.result.wpm || 0,
          player.result.accuracy || 100,
          player.profilePicture
        );
      }
    }
  }

  // Award $qr coins based on WPM
  if (_saveUser && _getUser) {
    for (const [socketId, player] of Object.entries(lobby.players)) {
      if (player.username && player.result) {
        const user = _getUser(player.username);
        if (user) {
          const wpm = player.result.wpm || 0;
          let coinsEarned = 0;

          if (wpm >= 100) coinsEarned = 20;
          else if (wpm >= 80) coinsEarned = 15;
          else if (wpm >= 60) coinsEarned = 10;
          else if (wpm >= 40) coinsEarned = 5;

          if (coinsEarned > 0) {
            user.coins = (user.coins ?? 1000) + coinsEarned;
            _saveUser(player.username);
            io.to(socketId).emit('coinsEarned', { amount: coinsEarned, total: user.coins });
          }
        }
      }
    }
  }

  // Reset lobby for next match
  setTimeout(() => {
    if (typingLobbies[roomCode]) {
      typingLobbies[roomCode].gameState = 'waiting';
      Object.values(typingLobbies[roomCode].players).forEach(p => {
        p.ready = false;
        p.result = null;
        p.progress = { charIndex: 0, wpm: 0, accuracy: 100, progress: 0 };
      });

      const spectatorList = getTypingSpectatorList(roomCode);
      spectatorList.forEach(spec => {
        io.to(spec.id).emit('typingCanJoinNext', {
          players: getTypingPlayerList(roomCode),
          spectators: spectatorList
        });
      });
    }
  }, 2000);

  log('TYPING', `VS game ended in room ${roomCode}. Winner: ${winner?.name || 'N/A'}`);
}

// ==================== COOP MODE GAME FLOW ====================

function startTypingCoopCountdown(roomCode) {
  const io = _io;
  const lobby = typingCoopLobbies[roomCode];
  if (!lobby) return;

  lobby.gameState = 'countdown';

  // Generate words
  const wordSet = lobby.tildesMode ? typingWordsConTildes : typingWordsSinTildes;
  lobby.words = shuffleArray(wordSet).slice(0, 200);
  lobby.fullText = lobby.words.join(' ');
  lobby.charIndex = 0;
  lobby.currentWordCount = 0;
  lobby.totalWordsTyped = 0;
  lobby.currentTurnIndex = 0;

  // Reset player states
  Object.values(lobby.players).forEach(player => {
    player.wordsTyped = 0;
    player.charsTyped = 0;
    player.errors = 0;
    player.wpm = 0;
    player.accuracy = 100;
  });

  let count = 3;
  const players = getTypingCoopPlayerList(roomCode);
  const countdownInterval = setInterval(() => {
    io.to('typing-coop-' + roomCode).emit('typingCoopCountdown', {
      seconds: count,
      players: players,
      currentTyper: lobby.turnOrder[0]
    });
    count--;

    if (count < 0) {
      clearInterval(countdownInterval);
      startTypingCoopGame(roomCode);
    }
  }, 1000);
}

function startTypingCoopGame(roomCode) {
  const io = _io;
  const lobby = typingCoopLobbies[roomCode];
  if (!lobby) return;

  lobby.gameState = 'playing';
  lobby.startTime = Date.now();

  const playersList = getTypingCoopPlayerList(roomCode);

  io.to('typing-coop-' + roomCode).emit('typingCoopStart', {
    words: lobby.words,
    fullText: lobby.fullText,
    duration: lobby.duration,
    players: playersList,
    currentTyper: lobby.turnOrder[0],
    wordsPerTurn: lobby.wordsPerTurn
  });

  setTimeout(() => {
    if (lobby.gameState === 'playing') {
      endTypingCoopRound(roomCode);
    }
  }, lobby.duration + 1000);

  log('TYPING', `Coop game started in room ${roomCode} with ${playersList.length} players`);
}

function endTypingCoopRound(roomCode) {
  const io = _io;
  const lobby = typingCoopLobbies[roomCode];
  if (!lobby || lobby.gameState === 'finished') return;

  lobby.gameState = 'finished';

  const players = Object.entries(lobby.players);
  const totalTime = (Date.now() - lobby.startTime) / 1000;

  const teamStats = {
    totalWords: lobby.totalWordsTyped,
    totalChars: players.reduce((sum, [, p]) => sum + p.charsTyped, 0),
    totalErrors: players.reduce((sum, [, p]) => sum + p.errors, 0),
    totalTime: Math.round(totalTime)
  };

  const results = players.map(([id, player]) => ({
    id,
    name: player.name,
    profilePicture: player.profilePicture,
    wordsTyped: player.wordsTyped,
    charsTyped: player.charsTyped,
    errors: player.errors,
    wpm: player.wpm,
    accuracy: player.accuracy
  })).sort((a, b) => b.wordsTyped - a.wordsTyped);

  io.to('typing-coop-' + roomCode).emit('typingCoopRoundEnd', {
    teamStats: teamStats,
    results: results
  });

  // Award $qr coins based on WPM (coop mode)
  if (_saveUser && _getUser) {
    for (const [socketId, player] of Object.entries(lobby.players)) {
      if (player.username) {
        const user = _getUser(player.username);
        if (user) {
          const wpm = player.wpm || 0;
          let coinsEarned = 0;

          if (wpm >= 100) coinsEarned = 20;
          else if (wpm >= 80) coinsEarned = 15;
          else if (wpm >= 60) coinsEarned = 10;
          else if (wpm >= 40) coinsEarned = 5;

          if (coinsEarned > 0) {
            user.coins = (user.coins ?? 1000) + coinsEarned;
            _saveUser(player.username);
            io.to(socketId).emit('coinsEarned', { amount: coinsEarned, total: user.coins });
          }
        }
      }
    }
  }

  setTimeout(() => {
    if (typingCoopLobbies[roomCode]) {
      typingCoopLobbies[roomCode].gameState = 'waiting';
      Object.values(typingCoopLobbies[roomCode].players).forEach(p => {
        p.wordsTyped = 0;
        p.charsTyped = 0;
        p.errors = 0;
        p.wpm = 0;
        p.accuracy = 100;
      });
    }
  }, 2000);

  log('TYPING', `Coop game ended in room ${roomCode}. Total words: ${teamStats.totalWords}`);
}

// ==================== SOCKET HANDLERS ====================

/**
 * Setup socket handlers for a connection
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket.IO socket instance
 * @param {Object} context - Shared context { getUser, getLoggedInUsername, updateTypingLeaderboard }
 */
function setupHandlers(io, socket, context) {
  const { getUser, getLoggedInUsername, updateTypingLeaderboard, saveUser } = context;

  // Store references at module level for use in endTypingRound
  if (!_saveUser) _saveUser = saveUser;
  if (!_getUser) _getUser = getUser;

  // Per-socket state
  let typingRoomCode = null;
  let isTypingSpectator = false;
  let typingCoopRoomCode = null;
  let isTypingCoop = false;
  let isTypingCoopSpectator = false;

  // ==================== VS MODE HANDLERS ====================

  socket.on('typingJoinVs', (data) => {
    const loggedInUsername = getLoggedInUsername();
    if (!loggedInUsername) {
      socket.emit('typingError', { message: 'Debes iniciar sesion primero' });
      return;
    }

    const user = getUser(loggedInUsername);
    const tildesMode = data?.tildesMode || false;

    // Find an existing lobby with same tildes mode
    let foundLobby = null;
    for (const [code, lobby] of Object.entries(typingLobbies)) {
      if (lobby.tildesMode === tildesMode && lobby.gameState === 'waiting') {
        foundLobby = code;
        break;
      }
    }

    // Create new lobby if none found
    if (!foundLobby) {
      let code;
      do {
        code = generateRoomCode();
      } while (typingLobbies[code]);

      typingLobbies[code] = {
        roomCode: code,
        players: {},
        spectators: {},
        words: [],
        gameState: 'waiting',
        startTime: null,
        duration: 60000,
        host: socket.id,
        tildesMode: tildesMode
      };
      foundLobby = code;
      log('TYPING', `VS lobby ${code} created by ${user.username} (tildes: ${tildesMode})`);
    }

    const lobby = typingLobbies[foundLobby];
    typingRoomCode = foundLobby;
    socket.join('typing-' + foundLobby);

    // Join as spectator if game in progress
    if (lobby.gameState === 'playing' || lobby.gameState === 'countdown') {
      isTypingSpectator = true;
      lobby.spectators[socket.id] = {
        name: user.username,
        username: loggedInUsername,
        profilePicture: user.profilePicture
      };

      socket.emit('typingJoinedAsSpectator', {
        roomCode: foundLobby,
        players: getTypingPlayerList(foundLobby),
        spectators: getTypingSpectatorList(foundLobby),
        gameInProgress: true,
        words: lobby.words
      });

      io.to('typing-' + foundLobby).emit('typingSpectatorList', {
        spectators: getTypingSpectatorList(foundLobby)
      });

      log('TYPING', `${user.username} joined lobby ${foundLobby} as spectator`);
      return;
    }

    // Join as player
    isTypingSpectator = false;
    lobby.players[socket.id] = {
      name: user.username,
      username: loggedInUsername,
      profilePicture: user.profilePicture,
      progress: { charIndex: 0, wpm: 0, accuracy: 100, progress: 0 },
      result: null
    };

    const isHost = lobby.host === socket.id;
    const playerList = getTypingPlayerList(foundLobby);
    const spectatorList = getTypingSpectatorList(foundLobby);

    socket.emit('typingVsJoined', {
      roomCode: foundLobby,
      players: playerList,
      spectators: spectatorList,
      isHost: isHost,
      tildesMode: lobby.tildesMode
    });

    Object.keys(lobby.players).forEach(pid => {
      if (pid !== socket.id) {
        io.to(pid).emit('typingPlayerList', {
          players: playerList,
          spectators: spectatorList,
          isHost: lobby.host === pid
        });
      }
    });

    log('TYPING', `${user.username} joined VS lobby ${foundLobby} (${Object.keys(lobby.players).length} players)`);
  });

  socket.on('typingSpectatorJoinNext', () => {
    if (!typingRoomCode || !typingLobbies[typingRoomCode]) return;
    if (!isTypingSpectator) return;

    const lobby = typingLobbies[typingRoomCode];
    const spectator = lobby.spectators[socket.id];
    if (!spectator) return;

    if (lobby.gameState === 'playing' || lobby.gameState === 'countdown') {
      socket.emit('typingError', { message: 'Espera a que termine la partida' });
      return;
    }

    delete lobby.spectators[socket.id];
    isTypingSpectator = false;

    lobby.players[socket.id] = {
      name: spectator.name,
      username: spectator.username,
      profilePicture: spectator.profilePicture,
      progress: { charIndex: 0, wpm: 0, accuracy: 100, progress: 0 },
      result: null
    };

    const playerList = getTypingPlayerList(typingRoomCode);
    const spectatorList = getTypingSpectatorList(typingRoomCode);

    Object.keys(lobby.players).forEach(pid => {
      io.to(pid).emit('typingPlayerList', {
        players: playerList,
        spectators: spectatorList,
        isHost: lobby.host === pid
      });
    });

    Object.keys(lobby.spectators).forEach(sid => {
      io.to(sid).emit('typingSpectatorList', {
        players: playerList,
        spectators: spectatorList
      });
    });

    socket.emit('typingJoinedFromSpectator', {
      players: playerList,
      spectators: spectatorList,
      isHost: lobby.host === socket.id
    });

    log('TYPING', `${spectator.name} moved from spectator to player in lobby ${typingRoomCode}`);
  });

  socket.on('leaveTypingRoom', () => {
    if (typingRoomCode && typingLobbies[typingRoomCode]) {
      const lobby = typingLobbies[typingRoomCode];
      const wasHost = lobby.host === socket.id;

      delete lobby.players[socket.id];
      delete lobby.spectators[socket.id];
      socket.leave('typing-' + typingRoomCode);

      const playerCount = Object.keys(lobby.players).length;
      const spectatorCount = Object.keys(lobby.spectators).length;

      if (playerCount === 0 && spectatorCount === 0) {
        delete typingLobbies[typingRoomCode];
        log('TYPING', `Room ${typingRoomCode} deleted (empty)`);
      } else {
        if (wasHost && playerCount > 0) {
          lobby.host = Object.keys(lobby.players)[0];
        }

        const playerList = getTypingPlayerList(typingRoomCode);
        const spectatorList = getTypingSpectatorList(typingRoomCode);

        Object.keys(lobby.players).forEach(pid => {
          io.to(pid).emit('typingPlayerList', {
            players: playerList,
            spectators: spectatorList,
            isHost: lobby.host === pid
          });
        });

        Object.keys(lobby.spectators).forEach(sid => {
          io.to(sid).emit('typingSpectatorList', {
            players: playerList,
            spectators: spectatorList
          });
        });
      }
    }
    typingRoomCode = null;
    isTypingSpectator = false;
  });

  socket.on('typingStartGame', () => {
    if (!typingRoomCode || !typingLobbies[typingRoomCode]) return;

    const lobby = typingLobbies[typingRoomCode];
    if (lobby.host !== socket.id) return;
    if (Object.keys(lobby.players).length < 2) return;

    startTypingCountdown(typingRoomCode);
  });

  socket.on('typingBecomeSpectator', () => {
    if (!typingRoomCode || !typingLobbies[typingRoomCode]) return;

    const lobby = typingLobbies[typingRoomCode];
    const player = lobby.players[socket.id];
    if (!player) return;

    if (lobby.gameState !== 'waiting') {
      socket.emit('typingError', { message: 'El juego ya ha empezado' });
      return;
    }

    lobby.spectators[socket.id] = {
      name: player.name,
      username: player.username,
      profilePicture: player.profilePicture
    };
    delete lobby.players[socket.id];
    isTypingSpectator = true;

    if (lobby.host === socket.id && Object.keys(lobby.players).length > 0) {
      lobby.host = Object.keys(lobby.players)[0];
    }

    const playerList = getTypingPlayerList(typingRoomCode);
    const spectatorList = getTypingSpectatorList(typingRoomCode);

    socket.emit('typingNowSpectator', {
      players: playerList,
      spectators: spectatorList
    });

    Object.keys(lobby.players).forEach(pid => {
      io.to(pid).emit('typingPlayerList', {
        players: playerList,
        spectators: spectatorList,
        isHost: lobby.host === pid
      });
    });

    Object.keys(lobby.spectators).forEach(sid => {
      if (sid !== socket.id) {
        io.to(sid).emit('typingSpectatorList', {
          players: playerList,
          spectators: spectatorList
        });
      }
    });

    log('TYPING', `${player.name} became spectator in lobby ${typingRoomCode}`);
  });

  socket.on('typingProgress', (data) => {
    if (!typingRoomCode || !typingLobbies[typingRoomCode]) return;

    const lobby = typingLobbies[typingRoomCode];
    if (lobby.players[socket.id]) {
      lobby.players[socket.id].progress = data;
    }

    socket.to('typing-' + typingRoomCode).emit('typingOpponentProgress', {
      playerId: socket.id,
      wpm: data.wpm,
      accuracy: data.accuracy,
      charIndex: data.charIndex,
      progress: data.progress
    });
  });

  socket.on('typingComplete', (data) => {
    if (!typingRoomCode || !typingLobbies[typingRoomCode]) return;

    const lobby = typingLobbies[typingRoomCode];
    if (lobby.players[socket.id]) {
      lobby.players[socket.id].result = data;
    }

    const players = Object.values(lobby.players);
    const allFinished = players.every(p => p.result !== null);

    if (allFinished) {
      endTypingRound(typingRoomCode, updateTypingLeaderboard);
    }
  });

  socket.on('typingSoloResult', (data) => {
    const loggedInUsername = getLoggedInUsername();
    if (!loggedInUsername) return;
    const user = getUser(loggedInUsername);
    if (!user) return;

    updateTypingLeaderboard(
      loggedInUsername,
      data.wpm || 0,
      data.accuracy || 100,
      user.profilePicture
    );
  });

  // ==================== COOP MODE HANDLERS ====================

  socket.on('typingJoinCoop', (data) => {
    const loggedInUsername = getLoggedInUsername();
    if (!loggedInUsername) {
      socket.emit('typingError', { message: 'Debes iniciar sesion primero' });
      return;
    }

    const user = getUser(loggedInUsername);
    const tildesMode = data?.tildesMode || false;

    let foundLobby = null;
    let joinAsSpectator = false;

    // Find waiting lobby
    for (const [code, lobby] of Object.entries(typingCoopLobbies)) {
      if (lobby.gameState === 'waiting' && lobby.tildesMode === tildesMode) {
        foundLobby = code;
        break;
      }
    }

    // Check for in-progress lobby to spectate
    if (!foundLobby) {
      for (const [code, lobby] of Object.entries(typingCoopLobbies)) {
        if ((lobby.gameState === 'playing' || lobby.gameState === 'countdown') && lobby.tildesMode === tildesMode) {
          foundLobby = code;
          joinAsSpectator = true;
          break;
        }
      }
    }

    // Create new lobby
    if (!foundLobby) {
      let code;
      do {
        code = 'COOP-' + generateRoomCode();
      } while (typingCoopLobbies[code]);

      typingCoopLobbies[code] = {
        roomCode: code,
        players: {},
        spectators: {},
        turnOrder: [],
        currentTurnIndex: 0,
        wordsPerTurn: 20,
        currentWordCount: 0,
        totalWordsTyped: 0,
        words: [],
        fullText: '',
        charIndex: 0,
        gameState: 'waiting',
        startTime: null,
        duration: 120000,
        host: socket.id,
        tildesMode: tildesMode
      };
      foundLobby = code;
      log('TYPING', `Coop lobby ${code} created by ${user.username} (tildes: ${tildesMode})`);
    }

    const lobby = typingCoopLobbies[foundLobby];
    typingCoopRoomCode = foundLobby;
    isTypingCoop = true;
    socket.join('typing-coop-' + foundLobby);

    if (joinAsSpectator) {
      isTypingCoopSpectator = true;
      lobby.spectators[socket.id] = {
        id: socket.id,
        name: user.username,
        username: loggedInUsername,
        profilePicture: user.profilePicture
      };

      socket.emit('typingCoopJoinedAsSpectator', {
        roomCode: foundLobby,
        players: getTypingCoopPlayerList(foundLobby),
        spectators: getTypingCoopSpectatorList(foundLobby),
        gameInProgress: true,
        words: lobby.words,
        fullText: lobby.fullText,
        charIndex: lobby.charIndex,
        currentTyper: lobby.turnOrder[lobby.currentTurnIndex]
      });

      io.to('typing-coop-' + foundLobby).emit('typingCoopSpectatorList', {
        spectators: getTypingCoopSpectatorList(foundLobby)
      });

      log('TYPING', `${user.username} joined Coop lobby ${foundLobby} as spectator`);
      return;
    }

    isTypingCoopSpectator = false;
    lobby.players[socket.id] = {
      id: socket.id,
      name: user.username,
      username: loggedInUsername,
      profilePicture: user.profilePicture,
      wordsTyped: 0,
      charsTyped: 0,
      errors: 0,
      wpm: 0,
      accuracy: 100
    };

    lobby.turnOrder = Object.keys(lobby.players);

    const isHost = lobby.host === socket.id;
    const playerList = getTypingCoopPlayerList(foundLobby);
    const spectatorList = getTypingCoopSpectatorList(foundLobby);

    socket.emit('typingCoopJoined', {
      roomCode: foundLobby,
      players: playerList,
      spectators: spectatorList,
      isHost: isHost,
      tildesMode: lobby.tildesMode
    });

    Object.keys(lobby.players).forEach(pid => {
      if (pid !== socket.id) {
        io.to(pid).emit('typingCoopPlayerList', {
          players: playerList,
          spectators: spectatorList,
          isHost: lobby.host === pid
        });
      }
    });

    log('TYPING', `${user.username} joined Coop lobby ${foundLobby} (${Object.keys(lobby.players).length} players)`);
  });

  socket.on('leaveTypingCoopRoom', () => {
    if (typingCoopRoomCode && typingCoopLobbies[typingCoopRoomCode]) {
      const lobby = typingCoopLobbies[typingCoopRoomCode];
      const wasHost = lobby.host === socket.id;
      const wasCurrentTurn = lobby.turnOrder[lobby.currentTurnIndex] === socket.id;

      delete lobby.players[socket.id];
      delete lobby.spectators[socket.id];
      socket.leave('typing-coop-' + typingCoopRoomCode);

      lobby.turnOrder = Object.keys(lobby.players);

      const playerCount = Object.keys(lobby.players).length;

      if (playerCount === 0) {
        delete typingCoopLobbies[typingCoopRoomCode];
        log('TYPING', `Coop room ${typingCoopRoomCode} deleted (empty)`);
      } else {
        if (wasHost) {
          lobby.host = Object.keys(lobby.players)[0];
        }

        if (wasCurrentTurn && lobby.gameState === 'playing') {
          lobby.currentTurnIndex = lobby.currentTurnIndex % lobby.turnOrder.length;
          io.to('typing-coop-' + typingCoopRoomCode).emit('typingCoopTurnChange', {
            currentTyper: lobby.turnOrder[lobby.currentTurnIndex],
            players: getTypingCoopPlayerList(typingCoopRoomCode)
          });
        }

        const playerList = getTypingCoopPlayerList(typingCoopRoomCode);
        Object.keys(lobby.players).forEach(pid => {
          io.to(pid).emit('typingCoopPlayerList', {
            players: playerList,
            isHost: lobby.host === pid
          });
        });
      }
    }
    typingCoopRoomCode = null;
    isTypingCoop = false;
    isTypingCoopSpectator = false;
  });

  socket.on('typingCoopStartGame', () => {
    if (!typingCoopRoomCode || !typingCoopLobbies[typingCoopRoomCode]) return;

    const lobby = typingCoopLobbies[typingCoopRoomCode];
    if (lobby.host !== socket.id) return;
    if (Object.keys(lobby.players).length < 2) return;

    startTypingCoopCountdown(typingCoopRoomCode);
  });

  socket.on('typingCoopChar', (data) => {
    if (!typingCoopRoomCode || !typingCoopLobbies[typingCoopRoomCode]) return;

    const lobby = typingCoopLobbies[typingCoopRoomCode];
    if (lobby.gameState !== 'playing') return;

    const currentTyperId = lobby.turnOrder[lobby.currentTurnIndex];
    if (socket.id !== currentTyperId) return;

    const player = lobby.players[socket.id];
    if (!player) return;

    const isCorrect = data.correct;
    if (isCorrect) {
      lobby.charIndex++;
      player.charsTyped++;

      if (data.char === ' ' || lobby.charIndex >= lobby.fullText.length) {
        player.wordsTyped++;
        lobby.currentWordCount++;
        lobby.totalWordsTyped++;

        if (lobby.currentWordCount >= lobby.wordsPerTurn) {
          lobby.currentWordCount = 0;
          lobby.currentTurnIndex = (lobby.currentTurnIndex + 1) % lobby.turnOrder.length;

          io.to('typing-coop-' + typingCoopRoomCode).emit('typingCoopTurnChange', {
            currentTyper: lobby.turnOrder[lobby.currentTurnIndex],
            charIndex: lobby.charIndex,
            totalWords: lobby.totalWordsTyped,
            players: getTypingCoopPlayerList(typingCoopRoomCode)
          });
        }
      }
    } else {
      player.errors++;
    }

    const elapsedMinutes = (Date.now() - lobby.startTime) / 60000;
    if (elapsedMinutes > 0) {
      player.wpm = Math.round(player.charsTyped / 5 / elapsedMinutes);
    }
    player.accuracy = player.charsTyped > 0
      ? Math.round((player.charsTyped / (player.charsTyped + player.errors)) * 100)
      : 100;

    io.to('typing-coop-' + typingCoopRoomCode).emit('typingCoopProgress', {
      charIndex: lobby.charIndex,
      totalWords: lobby.totalWordsTyped,
      currentTyper: currentTyperId,
      correct: isCorrect,
      players: getTypingCoopPlayerList(typingCoopRoomCode)
    });

    if (lobby.charIndex >= lobby.fullText.length) {
      endTypingCoopRound(typingCoopRoomCode);
    }
  });

  socket.on('typingCoopBecomeSpectator', () => {
    if (!typingCoopRoomCode || !typingCoopLobbies[typingCoopRoomCode]) return;

    const lobby = typingCoopLobbies[typingCoopRoomCode];
    const player = lobby.players[socket.id];
    if (!player) return;

    if (lobby.gameState !== 'waiting') {
      socket.emit('typingError', { message: 'El juego ya ha empezado' });
      return;
    }

    lobby.spectators[socket.id] = {
      id: socket.id,
      name: player.name,
      username: player.username,
      profilePicture: player.profilePicture
    };
    delete lobby.players[socket.id];
    isTypingCoopSpectator = true;

    lobby.turnOrder = Object.keys(lobby.players);

    if (lobby.host === socket.id && Object.keys(lobby.players).length > 0) {
      lobby.host = Object.keys(lobby.players)[0];
    }

    const playerList = getTypingCoopPlayerList(typingCoopRoomCode);
    const spectatorList = getTypingCoopSpectatorList(typingCoopRoomCode);

    socket.emit('typingCoopNowSpectator', {
      players: playerList,
      spectators: spectatorList
    });

    Object.keys(lobby.players).forEach(pid => {
      io.to(pid).emit('typingCoopPlayerList', {
        players: playerList,
        spectators: spectatorList,
        isHost: lobby.host === pid
      });
    });

    Object.keys(lobby.spectators).forEach(sid => {
      if (sid !== socket.id) {
        io.to(sid).emit('typingCoopSpectatorList', {
          spectators: spectatorList
        });
      }
    });
  });

  socket.on('typingCoopSpectatorJoinNext', () => {
    if (!typingCoopRoomCode || !typingCoopLobbies[typingCoopRoomCode]) return;
    if (!isTypingCoopSpectator) return;

    const lobby = typingCoopLobbies[typingCoopRoomCode];
    const spectator = lobby.spectators[socket.id];
    if (!spectator) return;

    if (lobby.gameState === 'playing' || lobby.gameState === 'countdown') {
      socket.emit('typingError', { message: 'Espera a que termine la partida' });
      return;
    }

    delete lobby.spectators[socket.id];
    isTypingCoopSpectator = false;

    lobby.players[socket.id] = {
      id: socket.id,
      name: spectator.name,
      username: spectator.username,
      profilePicture: spectator.profilePicture,
      wordsTyped: 0,
      charsTyped: 0,
      errors: 0,
      wpm: 0,
      accuracy: 100
    };

    lobby.turnOrder = Object.keys(lobby.players);

    const playerList = getTypingCoopPlayerList(typingCoopRoomCode);
    const spectatorList = getTypingCoopSpectatorList(typingCoopRoomCode);

    socket.emit('typingCoopJoinedFromSpectator', {
      players: playerList,
      spectators: spectatorList,
      isHost: lobby.host === socket.id
    });

    Object.keys(lobby.players).forEach(pid => {
      if (pid !== socket.id) {
        io.to(pid).emit('typingCoopPlayerList', {
          players: playerList,
          spectators: spectatorList,
          isHost: lobby.host === pid
        });
      }
    });
  });

  // Return cleanup info for disconnect handling
  return {
    getTypingRoomCode: () => typingRoomCode,
    isTypingSpectator: () => isTypingSpectator,
    getTypingCoopRoomCode: () => typingCoopRoomCode,
    isTypingCoop: () => isTypingCoop,
    isTypingCoopSpectator: () => isTypingCoopSpectator,
    handleDisconnect: () => {
      // Clean up VS room
      if (typingRoomCode && typingLobbies[typingRoomCode]) {
        const lobby = typingLobbies[typingRoomCode];
        const wasHost = lobby.host === socket.id;

        delete lobby.players[socket.id];
        delete lobby.spectators[socket.id];

        const playerCount = Object.keys(lobby.players).length;
        const spectatorCount = Object.keys(lobby.spectators || {}).length;

        if (playerCount === 0 && spectatorCount === 0) {
          delete typingLobbies[typingRoomCode];
          log('TYPING', `Room ${typingRoomCode} deleted (disconnect)`);
        } else {
          if (wasHost && playerCount > 0) {
            lobby.host = Object.keys(lobby.players)[0];
          }

          const playerList = getTypingPlayerList(typingRoomCode);
          const spectatorList = getTypingSpectatorList(typingRoomCode);

          Object.keys(lobby.players).forEach(pid => {
            io.to(pid).emit('typingPlayerList', {
              players: playerList,
              spectators: spectatorList,
              isHost: lobby.host === pid
            });
          });

          Object.keys(lobby.spectators || {}).forEach(sid => {
            io.to(sid).emit('typingSpectatorList', {
              players: playerList,
              spectators: spectatorList
            });
          });

          if (lobby.gameState === 'playing' && playerCount < 2) {
            endTypingRound(typingRoomCode, updateTypingLeaderboard);
          }
        }
      }

      // Clean up Coop room
      if (typingCoopRoomCode && typingCoopLobbies[typingCoopRoomCode]) {
        const cLobby = typingCoopLobbies[typingCoopRoomCode];
        const wasHost = cLobby.host === socket.id;
        const wasCurrentTurn = cLobby.turnOrder[cLobby.currentTurnIndex] === socket.id;

        delete cLobby.players[socket.id];
        delete cLobby.spectators[socket.id];
        cLobby.turnOrder = Object.keys(cLobby.players);

        const playerCount = Object.keys(cLobby.players).length;

        if (playerCount === 0) {
          delete typingCoopLobbies[typingCoopRoomCode];
          log('TYPING', `Coop room ${typingCoopRoomCode} deleted (disconnect)`);
        } else {
          if (wasHost) {
            cLobby.host = Object.keys(cLobby.players)[0];
          }

          if (wasCurrentTurn && cLobby.gameState === 'playing') {
            cLobby.currentTurnIndex = cLobby.currentTurnIndex % cLobby.turnOrder.length;
            io.to('typing-coop-' + typingCoopRoomCode).emit('typingCoopTurnChange', {
              currentTyper: cLobby.turnOrder[cLobby.currentTurnIndex],
              players: getTypingCoopPlayerList(typingCoopRoomCode)
            });
          }

          const playerList = getTypingCoopPlayerList(typingCoopRoomCode);
          const spectatorList = getTypingCoopSpectatorList(typingCoopRoomCode);

          Object.keys(cLobby.players).forEach(pid => {
            io.to(pid).emit('typingCoopPlayerList', {
              players: playerList,
              spectators: spectatorList,
              isHost: cLobby.host === pid
            });
          });

          if (cLobby.gameState === 'playing' && playerCount < 2) {
            endTypingCoopRound(typingCoopRoomCode);
          }
        }
      }
    }
  };
}

module.exports = {
  init,
  setupHandlers,
  typingLobbies,
  typingCoopLobbies,
  endTypingRound,
  endTypingCoopRound
};
