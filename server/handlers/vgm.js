const { createVGMPlayer } = require('../utils');

let _io = null;
const VGM_ROOM = 'VGM';

const savedPlayerScores = new Map();
const SCORE_EXPIRY_MS = 12 * 60 * 60 * 1000;

function init(io) {
  _io = io;

  setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [username, data] of savedPlayerScores) {
      if (now - data.savedAt >= SCORE_EXPIRY_MS) {
        savedPlayerScores.delete(username);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[VGM] Cleaned up ${cleaned} expired saved scores`);
    }
  }, 60 * 60 * 1000);
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

function calculateSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;
  return Math.round((1 - distance / maxLen) * 100);
}

function checkGuess(guess, correctAnswer) {
  const letters = text => normalizeText(text).replace(/ /g, '');
  return letters(guess) === letters(correctAnswer);
}

function getCloseGuessPercentage(guess, correctAnswer) {
  const normalizedGuess = normalizeText(guess);
  const normalizedCorrect = normalizeText(correctAnswer);

  if (normalizedGuess.length < 3) return 0;

  let bestPercentage = 0;

  const correctWords = normalizedCorrect.split(' ');
  const guessWords = normalizedGuess.split(' ');

  for (const guessWord of guessWords) {
    if (guessWord.length < 3) continue;
    for (const correctWord of correctWords) {
      if (correctWord.length < 3) continue;
      if (guessWord === correctWord) {
        bestPercentage = Math.max(bestPercentage, calculateSimilarity(normalizedGuess, normalizedCorrect));
      }
      if (correctWord.startsWith(guessWord) && guessWord.length >= 4) {
        bestPercentage = Math.max(bestPercentage, calculateSimilarity(normalizedGuess, normalizedCorrect));
      }
    }
  }

  if (normalizedCorrect.startsWith(normalizedGuess) && normalizedGuess.length >= normalizedCorrect.length * 0.4) {
    bestPercentage = Math.max(bestPercentage, calculateSimilarity(normalizedGuess, normalizedCorrect));
  }

  if (guessWords.length > 0 && correctWords.length > guessWords.length) {
    const firstWordsMatch = guessWords.every((word, i) => word === correctWords[i]);
    if (firstWordsMatch && normalizedGuess.length >= 3) {
      bestPercentage = Math.max(bestPercentage, calculateSimilarity(normalizedGuess, normalizedCorrect));
    }
  }

  const distance = levenshteinDistance(normalizedGuess, normalizedCorrect);
  const threshold = Math.max(2, Math.floor(normalizedCorrect.length * 0.3));
  if (distance > 0 && distance <= threshold) {
    bestPercentage = Math.max(bestPercentage, calculateSimilarity(normalizedGuess, normalizedCorrect));
  }

  return bestPercentage;
}

function generateHint(gameName) {
  const name = gameName.trim();
  const words = name.split(' ');

  let hint = '';
  for (let w = 0; w < words.length; w++) {
    const word = words[w];
    if (w > 0) hint += '   ';

    for (let i = 0; i < word.length; i++) {
      if (i > 0) hint += ' ';
      if (i === 0) {
        hint += word[i].toUpperCase();
      } else {
        hint += '_';
      }
    }
  }

  return hint;
}

function createLobby(roomCode) {
  return {
    roomCode,
    players: {},
    currentSong: null,
    roundStartTime: null,
    roundDuration: 20000,
    audioDuration: null,
    roundActive: false,
    roundNumber: 0,
    roundTimeout: null,
    autoPlayActive: false,
    extendVotes: new Set(),
    isExtended: false,
    recentSongs: [],
    countdownMessageId: null
  };
}

const { COLORS, DEFAULT_COLOR } = require('./tierlist');
function getPlayerList(lobbies, roomCode) {
  const lobby = lobbies[roomCode];
  if (!lobby) return [];

  return Object.entries(lobby.players).map(([id, player]) => ({
    id,
    name: player.name,
    username: player.username,
    profilePicture: player.profilePicture,
    score: player.score,
    hintPoints: player.hintPoints,
    guessedGame: player.guessedGame,
    streak: player.streak,
    color: COLORS[player.username] || DEFAULT_COLOR
  }));
}

function endRound(roomCode, context) {
  const { lobbies, users, updateUserStats } = context;
  const lobby = lobbies[roomCode];
  if (!lobby) return;

  lobby.roundActive = false;
  const gameName = lobby.currentSong.game;
  const songName = lobby.currentSong.song;

  Object.values(lobby.players).forEach(player => {
    let pointsEarned = 0;
    if (player.guessedGame) pointsEarned++;
    if (player.gotSuperSonic) pointsEarned++;

    if (player.guessedGame) {
      player.streak++;

      if (player.streak > 0 && player.streak % 5 === 0) {
        player.score += 5;
        pointsEarned += 5;

        _io.to(roomCode).emit('sqrrrMessage', {
          message: `${player.name} racha de ${player.streak}! +5 puntos!`,
          isBold: false
        });
      }
    } else {
      player.streak = 0;
    }

    if (player.username && users[player.username]) {
      updateUserStats(
        player.username,
        gameName,
        player.guessedGame,
        player.gotSuperSonic,
        player.usedHintThisRound,
        pointsEarned
      );
    }

    if (player.guessedGame) {
      player.hintPoints += 2;
    } else {
      player.hintPoints += 1;
    }
    if (player.hintPoints > 4) {
      player.hintPoints = 4;
    }
  });

  _io.to(roomCode).emit('roundEnd', {
    correctGame: gameName,
    correctSong: songName,
    players: getPlayerList(lobbies, roomCode),
    serverTime: Date.now()
  });

  if (Object.keys(lobby.players).length === 0) {
    lobby.autoPlayActive = false;
    return;
  }

  if (lobby.autoPlayActive) {
    startAutoPlayCountdown(roomCode, context);
  }
}

function startFirstRoundCountdown(roomCode, context) {
  const { lobbies } = context;
  const lobby = lobbies[roomCode];
  if (!lobby || !lobby.autoPlayActive) return;

  if (Object.keys(lobby.players).length === 0) {
    lobby.autoPlayActive = false;
    return;
  }

  const countdownId = `countdown-${Date.now()}`;
  lobby.countdownMessageId = countdownId;

  _io.to(roomCode).emit('sqrrrCountdown', {
    id: countdownId,
    message: '**Siguiente canción en: 5...**'
  });

  const countdown = [4, 3, 2, 1];
  countdown.forEach((num, index) => {
    setTimeout(() => {
      if (!lobby || !lobby.autoPlayActive || Object.keys(lobby.players).length === 0) return;
      _io.to(roomCode).emit('sqrrrCountdown', {
        id: countdownId,
        message: `**Siguiente canción en: ${num}...**`
      });

      if (num === 1) {
        setTimeout(() => {
          if (!lobby || !lobby.autoPlayActive || Object.keys(lobby.players).length === 0) return;
          startNextRound(roomCode, context);
        }, 1000);
      }
    }, (index + 1) * 1000);
  });
}

function startAutoPlayCountdown(roomCode, context) {
  const { lobbies, addToChatHistory, records } = context;
  const lobby = lobbies[roomCode];
  if (!lobby || !lobby.autoPlayActive) return;

  const songKey = `${lobby.currentSong.game} - ${lobby.currentSong.song}`;
  const record = records ? records[songKey] : null;

  let revealMessage = `La canción era: <b>${lobby.currentSong.game} - ${lobby.currentSong.song}</b>`;
  if (record) {
    revealMessage += `\nEl récord es de <b>${record.player}</b> con <b>${record.time.toFixed(2)}</b> segundos`;
  }
  if (lobby.currentSong.addedBy) {
    revealMessage += `<br>Canción añadida por <b style="color:${COLORS[lobby.currentSong.addedBy] || '#000'}">${lobby.currentSong.addedBy}</b>`;
  }

  _io.to(roomCode).emit('sqrrrMessage', {
    message: revealMessage,
    isBold: true
  });

  addToChatHistory(roomCode, {
    sender: 'SQRRR',
    message: `La canción era: ${lobby.currentSong.game} - ${lobby.currentSong.song}`,
    type: 'system'
  });

  setTimeout(() => {
    if (!lobby || !lobby.autoPlayActive || Object.keys(lobby.players).length === 0) return;

    const countdownId = `countdown-${Date.now()}`;
    lobby.countdownMessageId = countdownId;

    _io.to(roomCode).emit('sqrrrCountdown', {
      id: countdownId,
      message: '**Siguiente canción en: 5...**'
    });

    const countdown = [4, 3, 2, 1];
    countdown.forEach((num, index) => {
      setTimeout(() => {
        if (!lobby || !lobby.autoPlayActive || Object.keys(lobby.players).length === 0) return;
        _io.to(roomCode).emit('sqrrrCountdown', {
          id: countdownId,
          message: `**Siguiente canción en: ${num}...**`
        });

        if (num === 1) {
          setTimeout(() => {
            if (!lobby || !lobby.autoPlayActive || Object.keys(lobby.players).length === 0) return;
            startNextRound(roomCode, context);
          }, 1000);
        }
      }, (index + 1) * 1000);
    });
  }, 5000);
}

function startNextRound(roomCode, context) {
  const { lobbies, getRandomSong, generateAudioToken } = context;
  const lobby = lobbies[roomCode];
  if (!lobby || Object.keys(lobby.players).length === 0) return;

  const song = getRandomSong(lobby.recentSongs);
  if (!song) {
    lobby.autoPlayActive = false;
    _io.to(roomCode).emit('sqrrrMessage', { message: 'No hay canciones en el VGM. Añade alguna con "Añadir canción".', isBold: true });
    return;
  }

  lobby.recentSongs.push(song.file);
  if (lobby.recentSongs.length > 200) {
    lobby.recentSongs.shift();
  }

  if (lobby.roundTimeout) {
    clearTimeout(lobby.roundTimeout);
    lobby.roundTimeout = null;
  }

  Object.values(lobby.players).forEach(player => {
    player.guessedGame = false;
    player.gotSuperSonic = false;
    player.usedHintThisRound = false;
    player.closeGuesses = [];
  });

  lobby.roundDuration = 20000;
  lobby.audioDuration = null;
  lobby.extendVotes = new Set();
  lobby.isExtended = false;
  lobby.currentSong = song;
  lobby.currentAudioToken = generateAudioToken(song.file);
  lobby.roundStartTime = Date.now();
  lobby.roundActive = true;
  lobby.roundNumber++;

  _io.to(roomCode).emit('roundStart', {
    roundNumber: lobby.roundNumber,
    audioToken: lobby.currentAudioToken,
    duration: lobby.roundDuration,
    serverTime: Date.now(),
    roundStartTime: lobby.roundStartTime
  });

  lobby.roundTimeout = setTimeout(() => {
    if (lobby.roundActive) {
      endRound(roomCode, context);
    }
  }, lobby.roundDuration);
}

function setupHandlers(io, socket, context) {
  const {
    lobbies,
    users,
    records,
    chatHistory,
    typingUsers,
    getUser,
    getLoggedInUsername,
    setCurrentRoom,
    getCurrentRoom,
    getPlayerName,
    setPlayerName,
    updateUserStats,
    saveUser,
    saveRecord,
    addToChatHistory,
    clearChatHistoryForRoom,
    getRandomSong,
    generateAudioToken
  } = context;

  socket.on('vgmCursor', (pos) => {
    const room = getCurrentRoom();
    const username = getLoggedInUsername();
    if (!room || !username || !pos) return;
    socket.to(room).volatile.emit('vgmCursor', { username, x: +pos.x || 0, y: +pos.y || 0 });
  });

  socket.on('joinVGM', () => {
    const loggedInUsername = getLoggedInUsername();
    if (!loggedInUsername) {
      socket.emit('error', 'Please log in first');
      return;
    }

    const user = users[loggedInUsername];
    const playerName = user.username;
    setPlayerName(playerName);

    if (!lobbies[VGM_ROOM]) {
      lobbies[VGM_ROOM] = createLobby(VGM_ROOM);
    }

    const lobby = lobbies[VGM_ROOM];

    let restoredScore = 0;
    let restoredStreak = 0;
    let restoredHintPoints = 4;

    const savedData = savedPlayerScores.get(loggedInUsername);
    if (savedData && (Date.now() - savedData.savedAt) < SCORE_EXPIRY_MS) {
      restoredScore = savedData.score;
      restoredStreak = savedData.streak;
      restoredHintPoints = savedData.hintPoints;
      savedPlayerScores.delete(loggedInUsername);
    } else if (savedData) {
      savedPlayerScores.delete(loggedInUsername);
    }

    lobby.players[socket.id] = {
      name: playerName,
      username: loggedInUsername,
      profilePicture: user.profilePicture,
      score: restoredScore,
      hintPoints: restoredHintPoints,
      usedHintThisRound: false,
      guessedGame: false,
      gotSuperSonic: false,
      streak: restoredStreak,
      fontSettings: { size: 13, color: '#000000', nameColor: '#0000ff', effect: 'none' },
      closeGuesses: []
    };

    socket.join(VGM_ROOM);
    setCurrentRoom(VGM_ROOM);

    socket.emit('vgmJoined', {
      roomCode: VGM_ROOM,
      playerName,
      roundActive: lobby.roundActive,
      autoPlayActive: lobby.autoPlayActive,
      roundNumber: lobby.roundNumber,
      currentAudioToken: lobby.currentAudioToken || null,
      roundStartTime: lobby.roundStartTime,
      roundDuration: lobby.roundDuration,
      serverTime: Date.now()
    });

    io.to(VGM_ROOM).emit('playerList', getPlayerList(lobbies, VGM_ROOM));
    io.to(VGM_ROOM).emit('chatMessage', { system: true, message: `${playerName} se ha unido!` });

    const roomHistory = chatHistory.filter(msg => msg.roomCode === VGM_ROOM);
    socket.emit('chatHistory', roomHistory);
  });

  socket.on('startRound', () => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;

    const lobby = lobbies[currentRoom];

    if (lobby.autoPlayActive || lobby.roundActive) {
      return;
    }

    lobby.autoPlayActive = true;
    startFirstRoundCountdown(currentRoom, { ...context, lobbies });
  });

  socket.on('updateFontSettings', (settings) => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const player = lobbies[currentRoom].players[socket.id];
    if (!player) return;

    player.fontSettings = {
      size: settings.size || 13,
      color: settings.color || '#000000',
      nameColor: settings.nameColor || '#0000ff',
      effect: settings.effect || 'none'
    };
  });

  socket.on('guess', (guess) => {
    if (typeof guess !== 'string') return;
    guess = guess.slice(0, 100);

    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;

    const lobby = lobbies[currentRoom];

    if (!lobby.roundActive || !lobby.currentSong) {
      const player = lobby.players[socket.id];
      if (!player) return;

      if (guess.trim().toLowerCase() === '/fail') {
        const allCloseGuesses = [];
        Object.values(lobby.players).forEach(p => {
          if (p.closeGuesses && p.closeGuesses.length > 0) {
            p.closeGuesses.forEach(g => {
              allCloseGuesses.push(`${p.name}: ${g}`);
            });
          }
        });

        if (allCloseGuesses.length > 0) {
          const guessesText = allCloseGuesses.join('\n');
          io.to(currentRoom).emit('gameChatMessage', {
            sender: 'SQRRR',
            message: `Fails XD\n${guessesText}`,
            profilePicture: null,
            fontSettings: { size: 13, color: '#666666', nameColor: '#0000ff', effect: 'none' }
          });
        } else {
          io.to(currentRoom).emit('gameChatMessage', {
            sender: 'SQRRR',
            message: 'No hubo fails esta ronda.',
            profilePicture: null,
            fontSettings: { size: 13, color: '#666666', nameColor: '#0000ff', effect: 'none' }
          });
        }
        return;
      }

      addToChatHistory(currentRoom, {
        sender: player.name,
        message: guess,
        type: 'chat'
      });

      io.to(currentRoom).emit('gameChatMessage', {
        sender: player.name,
        message: guess,
        profilePicture: player.profilePicture,
        fontSettings: player.fontSettings
      });
      return;
    }

    const player = lobby.players[socket.id];
    if (!player) return;

    const song = lobby.currentSong;
    const timeSinceStart = Date.now() - lobby.roundStartTime;
    const isUltraSonico = timeSinceStart <= 2000;
    const isSuperSonico = timeSinceStart <= 4000 && !isUltraSonico;

    if (!player.guessedGame) {
      if (checkGuess(guess, song.game)) {
        player.guessedGame = true;
        player.guessTime = timeSinceStart / 1000;
        player.score += 1;

        let sonicType = null;
        if (isUltraSonico) {
          player.score += 2;
          player.gotSuperSonic = true;
          sonicType = 'ultra';
        } else if (isSuperSonico) {
          player.score += 1;
          player.gotSuperSonic = true;
          sonicType = 'super';
        }

        const songKey = `${song.game} - ${song.song}`;
        const currentRecord = records[songKey];
        const isNewRecord = !currentRecord || player.guessTime < currentRecord.time;

        if (isNewRecord) {
          const previousRecord = currentRecord ? { ...currentRecord } : null;

          records[songKey] = {
            player: player.name,
            time: player.guessTime,
            date: Date.now()
          };
          saveRecord(songKey);

          let recordMessage;
          if (previousRecord) {
            recordMessage = `El nuevo récord es de ${player.name} con ${player.guessTime.toFixed(2)} segundos, mejorando el anterior récord de ${previousRecord.player} con ${previousRecord.time.toFixed(2)} segundos!`;
          } else {
            recordMessage = `El nuevo récord es de ${player.name} con ${player.guessTime.toFixed(2)} segundos!`;
          }

          io.to(currentRoom).emit('sqrrrMessage', {
            message: recordMessage,
            isRecord: true
          });

          io.to(currentRoom).emit('newRecord', {
            player: player.name,
            time: player.guessTime,
            previousPlayer: previousRecord ? previousRecord.player : null,
            previousTime: previousRecord ? previousRecord.time : null
          });
        }

        socket.emit('gameChatMessage', {
          sender: player.name,
          message: guess,
          profilePicture: player.profilePicture,
          fontSettings: player.fontSettings
        });

        io.to(currentRoom).emit('correctGuess', {
          playerName: player.name,
          type: 'game',
          sonicType: sonicType,
          timeElapsed: timeSinceStart / 1000
        });

        socket.emit('guessResult', { correct: true, type: 'game', sonicType: sonicType, timeElapsed: timeSinceStart / 1000 });
        io.to(currentRoom).emit('playerList', getPlayerList(lobbies, currentRoom));

        socket.emit('roundComplete');

        const loggedInUser = getLoggedInUsername();
        if (loggedInUser && users[loggedInUser]) {
          let coinsEarned = 10;
          if (isUltraSonico) coinsEarned = 30;
          else if (isSuperSonico) coinsEarned = 20;

          users[loggedInUser].coins = (users[loggedInUser].coins ?? 1000) + coinsEarned;
          saveUser(loggedInUser);
          socket.emit('coinsEarned', { amount: coinsEarned, total: users[loggedInUser].coins });
        }
      } else {
        if (normalizeText(guess).includes('mairo')) {
          io.to(currentRoom).emit('gameChatMessage', {
            sender: player.name,
            message: guess,
            profilePicture: player.profilePicture,
            fontSettings: player.fontSettings
          });
          io.to(currentRoom).emit('gameChatMessage', {
            sender: 'SQRRR',
            message: `${player.name} es subnormal y no sabe escribir xDDDDD`,
            profilePicture: null,
            fontSettings: { size: 13, color: '#666666', nameColor: '#0000ff', effect: 'none' }
          });
        } else {
          const closePercentage = getCloseGuessPercentage(guess, song.game);
          if (closePercentage > 0) {
            if (!player.closeGuesses) player.closeGuesses = [];
            player.closeGuesses.push(guess);

            socket.emit('gameChatMessage', {
              sender: player.name,
              message: guess,
              profilePicture: player.profilePicture,
              fontSettings: player.fontSettings
            });
            socket.emit('closeGuess', { guess: guess, type: 'game', percentage: closePercentage });
          } else {
            addToChatHistory(currentRoom, {
              sender: player.name,
              message: guess,
              type: 'guess'
            });
            io.to(currentRoom).emit('gameChatMessage', {
              sender: player.name,
              message: guess,
              profilePicture: player.profilePicture,
              fontSettings: player.fontSettings
            });
            socket.emit('guessResult', { correct: false, type: 'game' });
          }
        }
      }
    } else {
      addToChatHistory(currentRoom, {
        sender: player.name,
        message: guess,
        type: 'chat'
      });
      io.to(currentRoom).emit('gameChatMessage', {
        sender: player.name,
        message: guess,
        profilePicture: player.profilePicture,
        fontSettings: player.fontSettings
      });
    }
  });

  socket.on('requestHint', () => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;

    const lobby = lobbies[currentRoom];
    if (!lobby.roundActive || !lobby.currentSong) return;

    const player = lobby.players[socket.id];
    if (!player) return;

    if (player.usedHintThisRound) {
      socket.emit('hintResult', { success: false, reason: 'Already used hint this round' });
      return;
    }

    if (player.guessedGame) {
      socket.emit('hintResult', { success: false, reason: 'Already guessed the game' });
      return;
    }

    if (player.hintPoints < 4) {
      socket.emit('hintResult', { success: false, reason: `Need 4 hint points (you have ${player.hintPoints})` });
      return;
    }

    player.hintPoints -= 4;
    player.usedHintThisRound = true;

    const hint = generateHint(lobby.currentSong.game);
    socket.emit('hintResult', {
      success: true,
      hint: hint,
      hintPoints: player.hintPoints
    });

    io.to(currentRoom).emit('playerUsedHint', { playerName: player.name });
    io.to(currentRoom).emit('playerList', getPlayerList(lobbies, currentRoom));
  });

  socket.on('reportAudioDuration', ({ duration }) => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const lobby = lobbies[currentRoom];
    if (lobby.audioDuration === null && duration > 0) {
      lobby.audioDuration = duration;
      io.to(currentRoom).emit('audioDurationUpdate', { duration: duration });
    }
  });

  socket.on('voteExtend', () => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const lobby = lobbies[currentRoom];
    const player = lobby.players[socket.id];

    if (!player || !lobby.roundActive || lobby.isExtended) return;

    const elapsed = Date.now() - lobby.roundStartTime;
    if (elapsed >= 22000) return;

    lobby.extendVotes.add(socket.id);

    const totalPlayers = Object.keys(lobby.players).length;
    const votesNeeded = Math.ceil(totalPlayers / 2);
    const currentVotes = lobby.extendVotes.size;

    io.to(currentRoom).emit('gameChatMessage', {
      sender: 'SQRRR',
      message: `${player.name} ha votado para extender la canción. Votos: ${currentVotes}/${votesNeeded}`,
      profilePicture: null,
      fontSettings: { size: 13, color: '#666666', nameColor: '#0000ff', effect: 'none' }
    });

    io.to(currentRoom).emit('extendVotesUpdate', {
      votes: currentVotes,
      needed: votesNeeded,
      totalPlayers: totalPlayers
    });

    if (currentVotes >= votesNeeded && lobby.audioDuration) {
      lobby.isExtended = true;
      lobby.roundDuration = lobby.audioDuration;

      if (lobby.roundTimeout) {
        clearTimeout(lobby.roundTimeout);
      }

      const remaining = Math.max(0, lobby.audioDuration - elapsed);
      lobby.roundTimeout = setTimeout(() => {
        if (lobby.roundActive) {
          endRound(currentRoom, { ...context, lobbies });
        }
      }, remaining);

      io.to(currentRoom).emit('gameChatMessage', {
        sender: 'SQRRR',
        message: 'Canción extendida hasta el final',
        profilePicture: null,
        fontSettings: { size: 13, color: '#666666', nameColor: '#0000ff', effect: 'none' }
      });

      io.to(currentRoom).emit('roundExtended', { newDuration: lobby.audioDuration });
    }
  });

  socket.on('chatMessage', (message) => {
    if (typeof message !== 'string') return;
    message = message.slice(0, 100);

    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const player = lobbies[currentRoom].players[socket.id];
    if (!player) return;

    addToChatHistory(currentRoom, {
      sender: player.name,
      message: message,
      type: 'chat'
    });

    io.to(currentRoom).emit('gameChatMessage', {
      sender: player.name,
      message: message,
      profilePicture: player.profilePicture,
      fontSettings: player.fontSettings
    });
  });

  socket.on('sendNudge', () => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const player = lobbies[currentRoom].players[socket.id];
    if (!player) return;

    io.to(currentRoom).emit('nudgeReceived', {
      senderName: player.name
    });
  });

  socket.on('startTyping', () => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const player = lobbies[currentRoom].players[socket.id];
    if (!player) return;

    if (!typingUsers[currentRoom]) {
      typingUsers[currentRoom] = new Map();
    }
    typingUsers[currentRoom].set(socket.id, player.name);

    socket.broadcast.to(currentRoom).emit('typingUpdate', {
      typing: Array.from(typingUsers[currentRoom].values())
    });
  });

  socket.on('stopTyping', () => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom) return;
    if (typingUsers[currentRoom]) {
      typingUsers[currentRoom].delete(socket.id);
      io.to(currentRoom).emit('typingUpdate', {
        typing: Array.from(typingUsers[currentRoom].values())
      });
    }
  });

  return {
    handleDisconnect: () => {
      const currentRoom = getCurrentRoom();
      if (currentRoom && lobbies[currentRoom]) {
        const lobby = lobbies[currentRoom];
        const player = lobby.players[socket.id];

        if (typingUsers[currentRoom]) {
          typingUsers[currentRoom].delete(socket.id);
          io.to(currentRoom).emit('typingUpdate', {
            typing: Array.from(typingUsers[currentRoom].values())
          });
        }

        if (player) {
          if (player.username && (player.score > 0 || player.streak > 0)) {
            savedPlayerScores.set(player.username, {
              score: player.score,
              streak: player.streak,
              hintPoints: player.hintPoints,
              savedAt: Date.now()
            });
          }

          io.to(currentRoom).emit('chatMessage', {
            system: true,
            message: `${player.name} left the lobby.`
          });
          delete lobby.players[socket.id];
          io.to(currentRoom).emit('playerList', getPlayerList(lobbies, currentRoom));
        }

        if (currentRoom === VGM_ROOM && Object.keys(lobby.players).length === 0) {
          if (lobby.roundTimeout) {
            clearTimeout(lobby.roundTimeout);
            lobby.roundTimeout = null;
          }
          lobby.roundActive = false;
          lobby.autoPlayActive = false;
          lobby.currentSong = null;
          lobby.roundNumber = 0;
          lobby.roundStartTime = null;
          clearChatHistoryForRoom(currentRoom);
        }

        if (currentRoom !== VGM_ROOM && Object.keys(lobby.players).length === 0) {
          clearChatHistoryForRoom(currentRoom);
          delete lobbies[currentRoom];
        }
      }
    },
    handleLeaveRoom: () => {
      const currentRoom = getCurrentRoom();
      if (currentRoom && lobbies[currentRoom]) {
        const lobby = lobbies[currentRoom];
        const player = lobby.players[socket.id];

        if (typingUsers[currentRoom]) {
          typingUsers[currentRoom].delete(socket.id);
          io.to(currentRoom).emit('typingUpdate', {
            typing: Array.from(typingUsers[currentRoom].values())
          });
        }

        if (player) {
          if (player.username && (player.score > 0 || player.streak > 0)) {
            savedPlayerScores.set(player.username, {
              score: player.score,
              streak: player.streak,
              hintPoints: player.hintPoints,
              savedAt: Date.now()
            });
          }

          io.to(currentRoom).emit('chatMessage', {
            system: true,
            message: `${player.name} ha salido.`
          });
          delete lobby.players[socket.id];
          socket.leave(currentRoom);
          io.to(currentRoom).emit('playerList', getPlayerList(lobbies, currentRoom));
        }

        if (currentRoom === VGM_ROOM && Object.keys(lobby.players).length === 0) {
          if (lobby.roundTimeout) {
            clearTimeout(lobby.roundTimeout);
            lobby.roundTimeout = null;
          }
          lobby.roundActive = false;
          lobby.autoPlayActive = false;
          lobby.currentSong = null;
          lobby.roundNumber = 0;
          lobby.roundStartTime = null;
          clearChatHistoryForRoom(currentRoom);
        }

        if (currentRoom !== VGM_ROOM && Object.keys(lobby.players).length === 0) {
          clearChatHistoryForRoom(currentRoom);
          delete lobbies[currentRoom];
        }

        setCurrentRoom(null);
      }
    }
  };
}

module.exports = {
  init,
  setupHandlers,
  createLobby,
  createVGMPlayer,
  getPlayerList,
  VGM_ROOM,
  checkGuess,
  getCloseGuessPercentage,
  normalizeText,
  generateHint
};
