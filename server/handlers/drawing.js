const fs = require('fs');
const path = require('path');
const { shuffleArray, log, warn } = require('../utils');

const DRAWING_ROOM = 'DRAWING';

let drawingWords = [];
let _io = null;
let _saveUser = null;
let _getUser = null;

const drawingLobby = {
  roomCode: DRAWING_ROOM,
  players: {},
  spectators: {},
  turnOrder: [],
  currentTurnIndex: 0,
  currentDrawer: null,
  currentWord: null,
  currentWordBlanks: '',
  revealedPositions: [],
  gameState: 'waiting',
  turnStartTime: null,
  wordOptions: [],
  canvasHistory: [],
  host: null,
  turnTimer: null,
  wordSelectionTimer: null,
  hintTimers: [],
  usedWords: []
};

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

function getDrawingSpectatorList() {
  return Object.values(drawingLobby.spectators).map(s => ({
    id: s.id,
    name: s.name,
    profilePicture: s.profilePicture
  }));
}

function generateWordBlanks(word, revealedPositions) {
  let blanks = '';
  for (let i = 0; i < word.length; i++) {
    if (word[i] === ' ') {
      blanks += '    ';
    } else if (revealedPositions.includes(i)) {
      blanks += word[i] + ' ';
    } else {
      blanks += '_ ';
    }
  }
  return blanks.trim();
}

function normalizeGuess(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

function calculateDrawingPoints(elapsedSeconds) {
  if (elapsedSeconds >= 50) {
    return 100;
  }
  return Math.round(1000 - (900 * (elapsedSeconds / 50)));
}

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
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function isCloseGuess(guess, word) {
  const normalizedGuess = normalizeGuess(guess);
  const normalizedWord = normalizeGuess(word);

  if (normalizedGuess.length < 2 || normalizedWord.length < 2) return false;

  const lengthDiff = Math.abs(normalizedGuess.length - normalizedWord.length);
  if (lengthDiff > 2) return false;

  const distance = levenshteinDistance(normalizedGuess, normalizedWord);

  const maxDistance = normalizedWord.length <= 5 ? 1 : 2;

  return distance > 0 && distance <= maxDistance;
}

function getRandomWords(count) {
  const availableWords = drawingWords.filter(w => !drawingLobby.usedWords.includes(w.word));

  if (availableWords.length < count) {
    drawingLobby.usedWords = [];
    const shuffled = shuffleArray(drawingWords);
    return shuffled.slice(0, count);
  }
  const shuffled = shuffleArray(availableWords);
  return shuffled.slice(0, count);
}

function startDrawingTurn() {
  const io = _io;
  const drawerId = drawingLobby.turnOrder[drawingLobby.currentTurnIndex];
  if (!drawerId || !drawingLobby.players[drawerId]) {
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

  Object.values(drawingLobby.players).forEach(p => {
    p.guessedThisTurn = false;
    p.guessTime = null;
  });

  io.to(DRAWING_ROOM).emit('drawingPlayerList', {
    players: getDrawingPlayerList(),
    spectators: getDrawingSpectatorList()
  });

  io.to(drawerId).emit('drawingWordOptions', {
    words: drawingLobby.wordOptions,
    turnIndex: drawingLobby.currentTurnIndex,
    totalTurns: drawingLobby.turnOrder.length
  });

  const drawerName = drawingLobby.players[drawerId]?.name;
  io.to(DRAWING_ROOM).emit('drawingWordSelection', {
    drawer: drawerName,
    drawerId: drawerId,
    turnIndex: drawingLobby.currentTurnIndex,
    totalTurns: drawingLobby.turnOrder.length
  });

  log('DRAWING', `Turn ${drawingLobby.currentTurnIndex + 1}/${drawingLobby.turnOrder.length}: ${drawerName} is choosing a word`);

  drawingLobby.wordSelectionTimer = setTimeout(() => {
    if (drawingLobby.gameState === 'word_selection' && drawingLobby.wordOptions.length > 0) {
      const randomIndex = Math.floor(Math.random() * drawingLobby.wordOptions.length);
      const autoWord = drawingLobby.wordOptions[randomIndex];
      drawingLobby.currentWord = autoWord.word;
      drawingLobby.usedWords.push(autoWord.word);
      drawingLobby.revealedPositions = [];
      drawingLobby.currentWordBlanks = generateWordBlanks(autoWord.word, []);
      drawingLobby.gameState = 'drawing';
      drawingLobby.turnStartTime = Date.now();

      Object.values(drawingLobby.players).forEach(p => {
        p.guessedThisTurn = false;
        p.guessTime = null;
      });

      io.to(drawerId).emit('drawingYourWord', {
        word: autoWord.word,
        category: autoWord.category
      });

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

function scheduleHints() {
  const io = _io;
  drawingLobby.hintTimers.forEach(t => clearTimeout(t));
  drawingLobby.hintTimers = [];

  const word = drawingLobby.currentWord;
  if (!word) return;

  const letterPositions = [];
  for (let i = 0; i < word.length; i++) {
    if (word[i] !== ' ') {
      letterPositions.push(i);
    }
  }

  drawingLobby.hintTimers.push(setTimeout(() => {
    if (drawingLobby.gameState !== 'drawing') return;
    revealHint(0);
  }, 30000));

  drawingLobby.hintTimers.push(setTimeout(() => {
    if (drawingLobby.gameState !== 'drawing') return;
    const unrevealed = letterPositions.filter(p => !drawingLobby.revealedPositions.includes(p));
    if (unrevealed.length > 0) {
      const randomPos = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      revealHint(randomPos);
    }
  }, 40000));

  drawingLobby.hintTimers.push(setTimeout(() => {
    if (drawingLobby.gameState !== 'drawing') return;
    const unrevealed = letterPositions.filter(p => !drawingLobby.revealedPositions.includes(p));
    if (unrevealed.length > 0) {
      const randomPos = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      revealHint(randomPos);
    }
  }, 50000));
}

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

function endDrawingTurn(allGuessed) {
  const io = _io;
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

  if (_saveUser && _getUser) {
    const TURN_DURATION = 60;
    let drawerCoins = 0;

    Object.entries(drawingLobby.players).forEach(([socketId, player]) => {
      if (socketId === drawingLobby.currentDrawer) return;

      if (player.guessedThisTurn && player.guessTime !== null) {
        const user = _getUser(player.name);
        if (user) {
          const timePercent = (player.guessTime / TURN_DURATION) * 100;
          let coinsEarned = 1;

          if (timePercent < 25) coinsEarned = 3;
          else if (timePercent < 50) coinsEarned = 2;

          user.coins = (user.coins ?? 1000) + coinsEarned;
          _saveUser(player.name);
          io.to(socketId).emit('coinsEarned', { amount: coinsEarned, total: user.coins });

          drawerCoins++;
        }
      }
    });

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

  setTimeout(() => {
    resetDrawingLobby();
  }, 10000);
}

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

  Object.values(drawingLobby.players).forEach(p => {
    p.score = 0;
    p.guessedThisTurn = false;
    p.guessTime = null;
  });

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

  const playerIds = Object.keys(drawingLobby.players);
  if (playerIds.length > 0 && (!drawingLobby.host || !drawingLobby.players[drawingLobby.host])) {
    drawingLobby.host = playerIds[0];
  }

  io.to(DRAWING_ROOM).emit('drawingLobbyReset', {
    players: getDrawingPlayerList(),
    spectators: getDrawingSpectatorList()
  });

  Object.keys(drawingLobby.players).forEach(pid => {
    io.to(pid).emit('drawingHostStatus', {
      isHost: drawingLobby.host === pid
    });
  });

  log('DRAWING', 'Lobby reset');
}

function handleDrawingDisconnect(socketId) {
  const io = _io;
  const wasPlayer = !!drawingLobby.players[socketId];
  const wasSpectator = !!drawingLobby.spectators[socketId];
  const wasDrawer = drawingLobby.currentDrawer === socketId;
  const wasHost = drawingLobby.host === socketId;
  const playerName = drawingLobby.players[socketId]?.name || drawingLobby.spectators[socketId]?.name;

  delete drawingLobby.players[socketId];
  delete drawingLobby.spectators[socketId];

  drawingLobby.turnOrder = drawingLobby.turnOrder.filter(id => id !== socketId);

  if (wasHost) {
    const playerIds = Object.keys(drawingLobby.players);
    drawingLobby.host = playerIds.length > 0 ? playerIds[0] : null;
  }

  if (wasDrawer && (drawingLobby.gameState === 'drawing' || drawingLobby.gameState === 'word_selection')) {
    endDrawingTurn(false);
  }

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

  if (Object.keys(drawingLobby.players).length === 0 && Object.keys(drawingLobby.spectators).length === 0) {
    resetDrawingLobby();
    log('DRAWING', 'Lobby reset (empty)');
  }
}

function init(io, baseDir) {
  _io = io;
  loadDrawingWords(baseDir);
}

function setupHandlers(io, socket, context = {}) {
  const { getUser, saveUser, getLoggedInUsername } = context;

  if (saveUser && !_saveUser) _saveUser = saveUser;
  if (getUser && !_getUser) _getUser = getUser;

  let isDrawingPlayer = false;
  let isDrawingSpectator = false;

  socket.on('drawingJoin', (data) => {
    const username = data?.username || 'Guest';
    const profilePicture = data?.profilePicture || 'profiles/default.svg';

    if (drawingLobby.players[socket.id] || drawingLobby.spectators[socket.id]) {
      return;
    }

    socket.join(DRAWING_ROOM);

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

    if (drawingLobby.currentDrawer === socket.id) {
      socket.emit('drawingError', { message: 'No puedes ser espectador mientras dibujas' });
      return;
    }

    drawingLobby.spectators[socket.id] = {
      id: socket.id,
      name: player.name,
      profilePicture: player.profilePicture
    };
    delete drawingLobby.players[socket.id];
    isDrawingSpectator = true;
    isDrawingPlayer = false;

    drawingLobby.turnOrder = drawingLobby.turnOrder.filter(id => id !== socket.id);

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

    if (drawingLobby.gameState === 'drawing') {
      socket.emit('drawingError', { message: 'Espera a que termine el turno' });
      return;
    }

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

    if (drawingLobby.gameState !== 'waiting') {
      drawingLobby.turnOrder.push(socket.id);
    }

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
    if (drawingLobby.host !== socket.id) {
      socket.emit('drawingError', { message: 'Solo el anfitrión puede iniciar' });
      return;
    }

    const playerCount = Object.keys(drawingLobby.players).length;
    if (playerCount < 3) {
      socket.emit('drawingError', { message: 'Se necesitan al menos 3 jugadores' });
      return;
    }

    if (drawingLobby.gameState !== 'waiting') {
      return;
    }

    const playerIds = shuffleArray(Object.keys(drawingLobby.players));
    drawingLobby.turnOrder = [...playerIds, ...playerIds, ...playerIds];
    drawingLobby.currentTurnIndex = 0;
    drawingLobby.canvasHistory = [];

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
    if (drawingLobby.currentDrawer !== socket.id) return;
    if (drawingLobby.gameState !== 'word_selection') return;

    const wordIndex = data?.wordIndex;
    if (wordIndex === undefined || wordIndex < 0 || wordIndex >= 3) return;

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

    Object.values(drawingLobby.players).forEach(p => {
      p.guessedThisTurn = false;
      p.guessTime = null;
    });

    socket.emit('drawingYourWord', {
      word: selectedWord.word,
      category: selectedWord.category
    });

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

    drawingLobby.turnTimer = setTimeout(() => {
      endDrawingTurn(false);
    }, 60000);
  });

  socket.on('drawingGuess', (data) => {
    const guess = data?.guess?.trim();
    if (!guess) return;

    if (!drawingLobby.players[socket.id]) return;
    if (drawingLobby.currentDrawer === socket.id) return;
    if (drawingLobby.gameState !== 'drawing') return;

    const player = drawingLobby.players[socket.id];

    if (player.guessedThisTurn) return;

    const isCorrect = normalizeGuess(guess) === normalizeGuess(drawingLobby.currentWord);

    if (isCorrect) {
      const elapsed = (Date.now() - drawingLobby.turnStartTime) / 1000;
      const points = calculateDrawingPoints(elapsed);

      player.guessedThisTurn = true;
      player.guessTime = elapsed;
      player.score += points;

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

      const guessers = Object.values(drawingLobby.players).filter(
        p => p.id !== drawingLobby.currentDrawer
      );
      const allGuessed = guessers.every(p => p.guessedThisTurn);

      if (allGuessed) {
        endDrawingTurn(true);
      }
    } else {
      if (isCloseGuess(guess, drawingLobby.currentWord)) {
        socket.emit('drawingCloseGuess', { message: 'Casi' });
      } else {
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

    let senderName = null;
    if (drawingLobby.players[socket.id]) {
      senderName = drawingLobby.players[socket.id].name;
    } else if (drawingLobby.spectators[socket.id]) {
      senderName = drawingLobby.spectators[socket.id].name;
    }

    if (!senderName) return;

    if (drawingLobby.gameState === 'drawing' && drawingLobby.players[socket.id] &&
        drawingLobby.currentDrawer !== socket.id) {
      socket.emit('drawingGuess', { guess: message });
      return;
    }

    io.to(DRAWING_ROOM).emit('drawingChatMessage', {
      player: senderName,
      message: message
    });
  });

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
