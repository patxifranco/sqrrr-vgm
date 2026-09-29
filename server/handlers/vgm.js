const { createVGMPlayer } = require('../utils');

let _io = null;
const VGM_ROOM = 'VGM';

const savedPlayerScores = new Map();
const EFFECTS = new Set(['none', 'wave', 'rainbow', 'quake', 'type', 'blink', 'marquee', 'fire', 'ice', 'gold', 'flip', 'mirror', 'wingdings', 'spoiler']);
const FONTS = new Set(['normal', 'comic', 'papyrus', 'impact']);
const MODES = new Set(['normal', 'uwu', 'leet', 'caps', 'reverse', 'bilbao']);
const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'];
const TIER_COLORS = { S: '#ff7f7f', A: '#ffbf7f', B: '#ffdf7f', C: '#ffff7f', D: '#bfff7f', F: '#7fff7f' };
const SYS_FONT = { size: 13, color: '#666666', nameColor: '#0000ff', effect: 'none' };
const pick = a => a[Math.floor(Math.random() * a.length)];

function mangle(text, mode) {
  switch (mode) {
    case 'uwu': return text.replace(/[rl]/g, 'w').replace(/[RL]/g, 'W').replace(/n([aeiou])/gi, 'ny$1') + ' ' + pick(['uwu', 'owo', '>w<', 'uwu~']);
    case 'leet': return text.replace(/[aeiost]/gi, c => ({ a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' })[c.toLowerCase()]);
    case 'caps': return text.toUpperCase() + '!'.repeat(2 + Math.floor(Math.random() * 4)) + '1';
    case 'reverse': return Array.from(text).reverse().join('');
    case 'bilbao': return text + ', ' + pick(['ostia', 'pues', 'aiba', 'ondo', 'txo', 'ostia pues']);
    default: return text;
  }
}

function chatPayload(player, message, extra = {}) {
  const fs = player.fontSettings || {};
  return { sender: player.name, message: mangle(message, fs.mode), profilePicture: player.profilePicture, fontSettings: fs, streak: player.streak || 0, bet: (player.bet || 0) > 0, quote: player.quote || null, ...extra };
}
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

function closeHint(guess, answer) {
  const fold = ch => ch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const target = [...answer].map((ch, i) => ({ i, k: fold(ch) })).filter(c => /^[a-z0-9]$/.test(c.k));
  const g = [...normalizeText(guess).replace(/ /g, '')];
  const n = target.length, m = g.length;
  const dp = Array.from({ length: n + 1 }, (_, i) => { const row = new Array(m + 1).fill(0); row[0] = i; return row; });
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (target[i - 1].k === g[j - 1] ? 0 : 1));
    }
  }
  const hit = new Set();
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (target[i - 1].k === g[j - 1] && dp[i][j] === dp[i - 1][j - 1]) { hit.add(target[i - 1].i); i--; j--; }
    else if (dp[i][j] === dp[i - 1][j - 1] + 1) { i--; j--; }
    else if (dp[i][j] === dp[i - 1][j] + 1) i--;
    else j--;
  }
  return [...answer].map((ch, idx) => /^[a-z0-9]$/.test(fold(ch)) && !hit.has(idx) ? '*' : ch).join('');
}

function matchesSong(guess, song) {
  return [song.game, ...(song.aliases || [])].some(name => checkGuess(guess, name));
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
  return gameName.trim().split(/\s+/).map(w => w[0].toUpperCase() + '*'.repeat(w.length - 1)).join(' ');
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

const { COLORS, DEFAULT_COLOR, ytFirstVideo } = require('./tierlist');
const discord = require('../discord');
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
  const { lobbies, users, updateUserStats, saveSongs } = context;
  const lobby = lobbies[roomCode];
  if (!lobby) return;
  const played = lobby.currentSong;
  if (played) {
    played.plays = (played.plays || 0) + 1;
    played.attempts = (played.attempts || 0) + Object.keys(lobby.players).length;
    for (const p of Object.values(lobby.players)) {
      if (p.guessedGame) {
        played.hits = (played.hits || 0) + 1;
        played.timeSum = (played.timeSum || 0) + (p.guessTime || 0);
      }
    }
    if (saveSongs) saveSongs();
  }

  lobby.roundActive = false;
  const gameName = lobby.currentSong.game;
  const songName = lobby.currentSong.song;

  Object.entries(lobby.players).forEach(([socketId, player]) => {
    if (player.bet) {
      _io.to(roomCode).emit('sqrrrMessage', { message: `${player.name} ha perdido ${player.bet} $qr en el gamba`, isBold: true });
      player.bet = 0;
      _io.to(socketId).emit('betInfo', { coins: (users[player.username] || {}).coins ?? 0, bet: 0 });
    }
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

function runCountdown(roomCode, context, from) {
  const { lobbies } = context;
  const lobby = lobbies[roomCode];
  if (!lobby || !lobby.autoPlayActive || lobby.paused) return;
  if (Object.keys(lobby.players).length === 0) {
    lobby.autoPlayActive = false;
    return;
  }
  const token = lobby.countdownToken = (lobby.countdownToken || 0) + 1;
  const id = `countdown-${Date.now()}`;
  lobby.countdownMessageId = id;
  const tick = n => {
    if (lobbies[roomCode] !== lobby || lobby.countdownToken !== token || !lobby.autoPlayActive || lobby.paused || Object.keys(lobby.players).length === 0) return;
    if (n === 0) return startNextRound(roomCode, context);
    _io.to(roomCode).emit('sqrrrCountdown', { id, seconds: n, total: from });
    setTimeout(() => tick(n - 1), 1000);
  };
  tick(from);
}

function startFirstRoundCountdown(roomCode, context) {
  const { lobbies } = context;
  const lobby = lobbies[roomCode];
  if (!lobby || !lobby.autoPlayActive) return;

  if (Object.keys(lobby.players).length === 0) {
    lobby.autoPlayActive = false;
    return;
  }

  lobby.paused = false;
  runCountdown(roomCode, context, 5);
}

function startAutoPlayCountdown(roomCode, context) {
  const { lobbies, addToChatHistory, records } = context;
  const lobby = lobbies[roomCode];
  if (!lobby || !lobby.autoPlayActive) return;

  const songKey = `${lobby.currentSong.game} - ${lobby.currentSong.song}`;
  const record = records ? records[songKey] : null;

  const cur = lobby.currentSong;
  lobby.lastSong = cur;
  lobby.songVotes = { up: new Set(), down: new Set() };
  const attr = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  let text = `La canción era: <b>${cur.game} - ${cur.song}</b><button class="reveal-edit" data-id="${cur.id}" data-game="${attr(cur.game)}" data-name="${attr(cur.song)}" data-aliases="${attr((cur.aliases || []).join(', '))}" title="Corregir">&#x270E;</button>`;
  if (record) {
    text += `<br>El récord es de <b>${record.player}</b> con <b>${record.time.toFixed(2)}</b> segundos`;
  }
  if (cur.addedBy) {
    text += `<br>Canción añadida por <b style="color:${COLORS[cur.addedBy] || '#000'}">${cur.addedBy}</b>`;
  }
  const tally = t => Object.values(cur.tiers || {}).filter(v => v === t).length;
  const tiersHtml = `<span class="reveal-tiers" data-song="${cur.id}">${TIERS.map(t => `<button class="tier-vote" data-tier="${t}" style="--tc:${TIER_COLORS[t]}">${t}<b>${tally(t) || ''}</b></button>`).join('')}</span>`;
  const revealMessage = `<span class="reveal">${cur.cover ? `<img class="reveal-cover" src="${cur.cover}" alt="">` : ''}<span>${text}</span></span><span class="reveal-votes" data-song="${cur.id}"><button class="vote-up">&#x1F44D; <b>0</b></button><button class="vote-down">&#x1F44E; <b>0</b></button><button class="vgm-pause" title="Pausa">&#x23F8;</button></span>${tiersHtml}`;

  _io.to(roomCode).emit('sqrrrMessage', {
    message: revealMessage,
    isBold: true
  });

  addToChatHistory(roomCode, {
    sender: 'SQRRR',
    message: `La canción era: ${lobby.currentSong.game} - ${lobby.currentSong.song}`,
    type: 'system'
  });

  const token = lobby.countdownToken = (lobby.countdownToken || 0) + 1;
  setTimeout(() => {
    if (lobbies[roomCode] === lobby && lobby.countdownToken === token) runCountdown(roomCode, context, 5);
  }, 5000);
}

function startNextRound(roomCode, context) {
  const { lobbies, getRandomSong, generateAudioToken, saveSongs } = context;
  const lobby = lobbies[roomCode];
  if (!lobby || Object.keys(lobby.players).length === 0) return;

  const song = getRandomSong(lobby.recentSongs);
  if (song && !song.cover) {
    ytFirstVideo(`${song.game} ${song.song} ost`).then(id => {
      if (!id) return;
      song.cover = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
      if (saveSongs) saveSongs();
    }).catch(() => {});
  }
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
    io.emit('vgmPresence', presence());
    io.to(VGM_ROOM).emit('chatMessage', { system: true, message: `${playerName} se ha unido!` });

    const roomHistory = chatHistory.filter(msg => msg.roomCode === VGM_ROOM);
    socket.emit('chatHistory', roomHistory);
  });

  socket.on('vgmPause', () => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const lobby = lobbies[currentRoom];
    const player = lobby.players[socket.id];
    if (!player || lobby.roundActive || !lobby.autoPlayActive) return;
    lobby.paused = !lobby.paused;
    lobby.countdownToken = (lobby.countdownToken || 0) + 1;
    io.to(currentRoom).emit('vgmPaused', { paused: lobby.paused, by: player.name });
    if (!lobby.paused) runCountdown(currentRoom, { ...context, lobbies }, 3);
  });

  socket.on('startRound', () => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;

    const lobby = lobbies[currentRoom];

    if (lobby.autoPlayActive || lobby.roundActive) {
      return;
    }

    lobby.autoPlayActive = true;
    discord.announce('VGM!!!!!!! 🚨 https://www.sqrrr.com');
    startFirstRoundCountdown(currentRoom, { ...context, lobbies });
  });

  socket.on('updateFontSettings', (settings) => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const player = lobbies[currentRoom].players[socket.id];
    if (!player) return;

    player.fontSettings = {
      size: Math.min(64, Math.max(8, parseInt(settings.size) || 13)),
      color: settings.color || '#000000',
      nameColor: settings.nameColor || '#0000ff',
      effect: EFFECTS.has(settings.effect) ? settings.effect : 'none',
      font: FONTS.has(settings.font) ? settings.font : 'normal',
      mode: MODES.has(settings.mode) ? settings.mode : 'normal'
    };
  });

  const tell = message => socket.emit('gameChatMessage', { sender: 'SQRRR', message, profilePicture: null, fontSettings: SYS_FONT });
  const presence = () => ({ players: lobbies[VGM_ROOM] ? getPlayerList(lobbies, VGM_ROOM).map(p => ({ name: p.name, color: p.color })) : [] });
  socket.emit('vgmPresence', presence());

  socket.on('betInfo', () => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const player = lobbies[currentRoom].players[socket.id];
    const user = users[getLoggedInUsername()];
    if (!player || !user) return;
    socket.emit('betInfo', { coins: user.coins ?? 0, bet: player.bet || 0 });
  });

  socket.on('placeBet', (amount) => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const player = lobbies[currentRoom].players[socket.id];
    const user = users[getLoggedInUsername()];
    if (!player || !user) return;
    const n = Math.floor(Number(amount));
    if (player.bet) return tell(`Ya has metido ${player.bet} $qr al gamba`);
    if (!(n >= 10) || n > (user.coins ?? 0)) return tell('No tienes tantos $qr');
    user.coins -= n;
    saveUser(user.username);
    player.bet = n;
    io.to(currentRoom).emit('sqrrrMessage', { message: `${player.name} ha metido ${n} $qr al gamba`, isBold: true });
    socket.emit('betInfo', { coins: user.coins, bet: n });
  });

  socket.on('guess', (guess, quote) => {
    if (typeof guess !== 'string') return;
    guess = guess.slice(0, 100);

    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;

    const lobby = lobbies[currentRoom];
    const speaker = lobby.players[socket.id];
    if (speaker) speaker.quote = quote && typeof quote.sender === 'string' && typeof quote.text === 'string' ? { sender: quote.sender.slice(0, 30), text: quote.text.slice(0, 80) } : null;

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

      io.to(currentRoom).emit('gameChatMessage', chatPayload(player, guess));
      return;
    }

    const player = lobby.players[socket.id];
    if (!player) return;

    const song = lobby.currentSong;
    const timeSinceStart = Date.now() - lobby.roundStartTime;
    const isUltraSonico = timeSinceStart <= 2000;
    const isSuperSonico = timeSinceStart <= 4000 && !isUltraSonico;

    if (!player.guessedGame) {
      if (matchesSong(guess, song)) {
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

        socket.emit('gameChatMessage', chatPayload(player, guess));

        io.to(currentRoom).emit('correctGuess', {
          playerName: player.name,
          type: 'game',
          sonicType: sonicType,
          timeElapsed: timeSinceStart / 1000
        });

        if (player.bet) {
          const win = player.bet * 2;
          player.bet = 0;
          const better = users[getLoggedInUsername()];
          if (better) {
            better.coins = (better.coins ?? 0) + win;
            saveUser(better.username);
            socket.emit('coinsEarned', { amount: win, total: better.coins });
          }
          io.to(currentRoom).emit('sqrrrMessage', { message: `${player.name} ha ganado ${win} $qr en el gamba`, isBold: true });
          socket.emit('betInfo', { coins: better ? better.coins : 0, bet: 0 });
        }

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
        if (player.bet) {
          io.to(currentRoom).emit('sqrrrMessage', { message: `${player.name} ha perdido ${player.bet} $qr en el gamba`, isBold: true });
          player.bet = 0;
          socket.emit('betInfo', { coins: (users[getLoggedInUsername()] || {}).coins ?? 0, bet: 0 });
        }
        if (normalizeText(guess).includes('mairo')) {
          io.to(currentRoom).emit('gameChatMessage', chatPayload(player, guess));
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

            socket.emit('gameChatMessage', chatPayload(player, guess));
            socket.emit('closeGuess', { guess: guess, type: 'game', percentage: closePercentage, hint: closeHint(guess, song.game) });
          } else {
            addToChatHistory(currentRoom, {
              sender: player.name,
              message: guess,
              type: 'guess'
            });
            io.to(currentRoom).emit('gameChatMessage', chatPayload(player, guess));
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
      io.to(currentRoom).emit('gameChatMessage', chatPayload(player, guess));
    }
  });

  socket.on('requestHint', () => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;

    const lobby = lobbies[currentRoom];
    if (!lobby.roundActive || !lobby.currentSong) return;

    const player = lobby.players[socket.id];
    if (!player) return;

    if (player.bet) {
      socket.emit('hintResult', { success: false, reason: 'Con gamba no hay pista' });
      return;
    }

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

    io.to(currentRoom).emit('gameChatMessage', chatPayload(player, message));
  });

  socket.on('tierVote', ({ id, tier } = {}) => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const lobby = lobbies[currentRoom];
    const player = lobby.players[socket.id];
    const song = lobby.lastSong;
    if (!player || !song || song.id !== Number(id) || !TIERS.includes(tier)) return;
    song.tiers = song.tiers || {};
    song.tiers[player.name] = tier;
    if (context.saveSongs) context.saveSongs();
    const counts = {};
    for (const t of Object.values(song.tiers)) counts[t] = (counts[t] || 0) + 1;
    io.to(currentRoom).emit('tierVote', { id: song.id, tier, by: player.name, counts });
  });

  socket.on('songVote', ({ id, type } = {}) => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const lobby = lobbies[currentRoom];
    const player = lobby.players[socket.id];
    const song = lobby.lastSong;
    if (!player || !song || !lobby.songVotes || song.id !== Number(id) || !['up', 'down'].includes(type)) return;
    const v = lobby.songVotes;
    if (v[type].has(player.name)) return;
    v[type === 'up' ? 'down' : 'up'].delete(player.name);
    v[type].add(player.name);
    io.to(currentRoom).emit('songVote', { id: song.id, type, by: player.name, up: v.up.size, down: v.down.size });
  });

  socket.on('sendInk', (data) => {
    const currentRoom = getCurrentRoom();
    if (!currentRoom || !lobbies[currentRoom]) return;
    const player = lobbies[currentRoom].players[socket.id];
    if (!player || typeof data !== 'string' || data.length > 60000 || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data)) return;
    if (player.inkAt && Date.now() - player.inkAt < 3000) return;
    player.inkAt = Date.now();
    player.quote = null;
    io.to(currentRoom).emit('gameChatMessage', chatPayload(player, '', { ink: data }));
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
          if (currentRoom === VGM_ROOM) io.emit('vgmPresence', presence());
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
          if (currentRoom === VGM_ROOM) io.emit('vgmPresence', presence());
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
  closeHint,
  getCloseGuessPercentage,
  normalizeText,
  generateHint
};
