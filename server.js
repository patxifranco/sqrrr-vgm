require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Modular game handlers
const drawingHandler = require('./server/handlers/drawing');
const typingHandler = require('./server/handlers/typing');
const vgmHandler = require('./server/handlers/vgm');
const slotsHandler = require('./server/handlers/slots');
const stackingHandler = require('./server/handlers/stacking');
const fishingHandler = require('./server/handlers/fishing');
const minigolfHandler = require('./server/handlers/minigolf');
const cardsHandler = require('./server/handlers/cards');
const wordleHandler = require('./server/handlers/wordle');
const authHandler = require('./server/handlers/auth');
const profileHandler = require('./server/handlers/profile');
const leaderboardsHandler = require('./server/handlers/leaderboards');

// MongoDB connection (optional - uses in-memory storage if not configured)
const MONGODB_URI = process.env.MONGODB_URI;
let useInMemory = !MONGODB_URI;

if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => {
      console.error('MongoDB connection error:', err.message);
      console.log('Falling back to in-memory storage');
      useInMemory = true;
    });
} else {
  console.log('No MONGODB_URI configured - using in-memory storage (data will not persist)');
}

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  profilePicture: { type: String, default: 'profiles/default.svg' },
  coins: { type: Number, default: 1000 },
  debt: { type: Number, default: 0 },
  cards: { type: Map, of: Number, default: {} },
  lastFreeCard: { type: Number, default: null },
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesGuessed: { type: Number, default: 0 },
    superSonics: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    gameHistory: { type: Map, of: Number, default: {} }
  },
  sqrrrdle: {
    wordsGuessed: { type: Number, default: 0 },
    totalTries: { type: Number, default: 0 },
    totalCoins: { type: Number, default: 0 },
    lastCompletedDate: { type: String, default: null },
    currentDayGuesses: { type: [String], default: [] },
    currentDayStatus: { type: String, default: 'playing' },
    currentDayKey: { type: String, default: null }
  }
});

const User = mongoose.model('User', userSchema);

// Record Schema
const recordSchema = new mongoose.Schema({
  songKey: { type: String, required: true, unique: true },
  player: { type: String, required: true },
  time: { type: Number, required: true },
  date: { type: Number, required: true }
});

const Record = mongoose.model('Record', recordSchema);

// Typing Leaderboard Schema
const typingLeaderboardSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  profilePicture: { type: String, default: 'profiles/default.svg' },
  bestWpm: { type: Number, default: 0 },
  bestAccuracy: { type: Number, default: 0 },
  bestScore: { type: Number, default: 0 }, // Combined WPM * (accuracy/100)
  gamesPlayed: { type: Number, default: 0 },
  lastUpdated: { type: Number, default: Date.now }
});

const TypingLeaderboard = mongoose.model('TypingLeaderboard', typingLeaderboardSchema);

// In-memory cache for users and records (loaded from MongoDB at startup)
let users = {};
let records = {};
let typingLeaderboard = {}; // username -> { bestWpm, bestAccuracy, bestScore }

// Track who's typing in each room (for typing indicator)
const typingUsers = {}; // roomCode -> Set of socket.ids

// Load users from MongoDB into memory
async function loadUsers() {
  try {
    const dbUsers = await User.find({});
    users = {};
    const usersNeedingCoins = [];

    for (const user of dbUsers) {
      // Initialize coins to 1000 if undefined, null, or 0
      const needsCoins = user.coins === undefined || user.coins === null || user.coins === 0;
      const coins = needsCoins ? 1000 : user.coins;

      users[user.username] = {
        username: user.username,
        password: user.password,
        isAdmin: user.isAdmin,
        profilePicture: user.profilePicture,
        coins: coins,
        debt: user.debt ?? 0,
        cards: Object.fromEntries(user.cards || new Map()),
        lastFreeCard: user.lastFreeCard ?? null,
        stats: {
          gamesPlayed: user.stats.gamesPlayed,
          gamesGuessed: user.stats.gamesGuessed,
          superSonics: user.stats.superSonics,
          hintsUsed: user.stats.hintsUsed,
          totalPoints: user.stats.totalPoints,
          gameHistory: Object.fromEntries(user.stats.gameHistory || new Map())
        },
        sqrrrdle: {
          wordsGuessed: user.sqrrrdle?.wordsGuessed ?? 0,
          totalTries: user.sqrrrdle?.totalTries ?? 0,
          totalCoins: user.sqrrrdle?.totalCoins ?? 0,
          lastCompletedDate: user.sqrrrdle?.lastCompletedDate ?? null,
          currentDayGuesses: user.sqrrrdle?.currentDayGuesses ?? [],
          currentDayStatus: user.sqrrrdle?.currentDayStatus ?? 'playing',
          currentDayKey: user.sqrrrdle?.currentDayKey ?? null
        }
      };

      if (needsCoins) {
        usersNeedingCoins.push(user.username);
      }
    }

    // Save users who needed coin initialization
    for (const username of usersNeedingCoins) {
      await saveUser(username);
    }

    if (usersNeedingCoins.length > 0) {
      console.log(`Initialized coins for ${usersNeedingCoins.length} users`);
    }

    console.log(`Loaded ${Object.keys(users).length} users from MongoDB`);
  } catch (err) {
    console.error('Error loading users from MongoDB:', err.message);
  }
}

// Save a single user to MongoDB (no-op in memory mode)
async function saveUser(username) {
  // In memory mode, data is already in the users object, nothing to persist
  if (useInMemory) return;

  try {
    const userData = users[username];
    if (!userData) return;

    await User.findOneAndUpdate(
      { username: username },
      {
        username: userData.username,
        password: userData.password,
        isAdmin: userData.isAdmin,
        profilePicture: userData.profilePicture,
        coins: userData.coins ?? 1000,
        debt: userData.debt ?? 0,
        cards: userData.cards ?? {},
        lastFreeCard: userData.lastFreeCard ?? null,
        stats: {
          gamesPlayed: userData.stats.gamesPlayed,
          gamesGuessed: userData.stats.gamesGuessed,
          superSonics: userData.stats.superSonics,
          hintsUsed: userData.stats.hintsUsed,
          totalPoints: userData.stats.totalPoints,
          gameHistory: userData.stats.gameHistory
        },
        sqrrrdle: {
          wordsGuessed: userData.sqrrrdle?.wordsGuessed ?? 0,
          totalTries: userData.sqrrrdle?.totalTries ?? 0,
          totalCoins: userData.sqrrrdle?.totalCoins ?? 0,
          lastCompletedDate: userData.sqrrrdle?.lastCompletedDate ?? null,
          currentDayGuesses: userData.sqrrrdle?.currentDayGuesses ?? [],
          currentDayStatus: userData.sqrrrdle?.currentDayStatus ?? 'playing',
          currentDayKey: userData.sqrrrdle?.currentDayKey ?? null
        }
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('Error saving user to MongoDB:', err.message);
  }
}

// Load records from MongoDB into memory
async function loadRecords() {
  try {
    const dbRecords = await Record.find({});
    records = {};
    for (const record of dbRecords) {
      records[record.songKey] = {
        player: record.player,
        time: record.time,
        date: record.date
      };
    }
    console.log(`Loaded ${Object.keys(records).length} records from MongoDB`);
  } catch (err) {
    console.error('Error loading records from MongoDB:', err.message);
  }
}

// Save a single record to MongoDB (no-op in memory mode)
async function saveRecord(songKey) {
  if (useInMemory) return;

  try {
    const recordData = records[songKey];
    if (!recordData) return;

    await Record.findOneAndUpdate(
      { songKey: songKey },
      {
        songKey: songKey,
        player: recordData.player,
        time: recordData.time,
        date: recordData.date
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error('Error saving record to MongoDB:', err.message);
  }
}

// Load typing leaderboard from MongoDB into memory
async function loadTypingLeaderboard() {
  try {
    const entries = await TypingLeaderboard.find({});
    typingLeaderboard = {};
    for (const entry of entries) {
      typingLeaderboard[entry.username] = {
        profilePicture: entry.profilePicture,
        bestWpm: entry.bestWpm,
        bestAccuracy: entry.bestAccuracy,
        bestScore: entry.bestScore,
        gamesPlayed: entry.gamesPlayed
      };
    }
    console.log(`Loaded ${Object.keys(typingLeaderboard).length} typing leaderboard entries from MongoDB`);
  } catch (err) {
    console.error('Error loading typing leaderboard from MongoDB:', err.message);
  }
}

// Save/update typing leaderboard entry
async function updateTypingLeaderboard(username, wpm, accuracy, profilePicture) {
  try {
    const score = Math.round(wpm * (accuracy / 100));
    const existing = typingLeaderboard[username];

    // Only update if this is a better score
    if (!existing || score > existing.bestScore) {
      typingLeaderboard[username] = {
        profilePicture: profilePicture || 'profiles/default.svg',
        bestWpm: wpm,
        bestAccuracy: accuracy,
        bestScore: score,
        gamesPlayed: (existing?.gamesPlayed || 0) + 1
      };

      // Skip MongoDB operations in memory mode
      if (!useInMemory) {
        await TypingLeaderboard.findOneAndUpdate(
          { username: username },
          {
            username: username,
            profilePicture: profilePicture || 'profiles/default.svg',
            bestWpm: wpm,
            bestAccuracy: accuracy,
            bestScore: score,
            gamesPlayed: typingLeaderboard[username].gamesPlayed,
            lastUpdated: Date.now()
          },
          { upsert: true, new: true }
        );
      }
    } else {
      // Just increment games played
      typingLeaderboard[username].gamesPlayed++;
      if (!useInMemory) {
        await TypingLeaderboard.findOneAndUpdate(
          { username: username },
          { $inc: { gamesPlayed: 1 }, lastUpdated: Date.now() }
        );
      }
    }
  } catch (err) {
    console.error('Error updating typing leaderboard:', err.message);
  }
}

// Migrate existing users.json to MongoDB (run once)
async function migrateUsersToMongoDB() {
  try {
    const usersFile = path.join(__dirname, 'users.json');
    if (!fs.existsSync(usersFile)) return;

    const fileUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
    const dbUserCount = await User.countDocuments();

    if (dbUserCount === 0 && Object.keys(fileUsers).length > 0) {
      console.log('Migrating users from users.json to MongoDB...');
      for (const [username, userData] of Object.entries(fileUsers)) {
        await User.findOneAndUpdate(
          { username: username },
          {
            username: userData.username,
            password: userData.password,
            isAdmin: userData.isAdmin || false,
            profilePicture: userData.profilePicture || 'profiles/default.svg',
            stats: {
              gamesPlayed: userData.stats?.gamesPlayed || 0,
              gamesGuessed: userData.stats?.gamesGuessed || 0,
              superSonics: userData.stats?.superSonics || 0,
              hintsUsed: userData.stats?.hintsUsed || 0,
              totalPoints: userData.stats?.totalPoints || 0,
              gameHistory: userData.stats?.gameHistory || {}
            }
          },
          { upsert: true }
        );
      }
      console.log(`Migrated ${Object.keys(fileUsers).length} users to MongoDB`);
    }
  } catch (err) {
    console.error('Error migrating users:', err.message);
  }
}

// Migrate existing records.json to MongoDB (run once)
async function migrateRecordsToMongoDB() {
  try {
    const recordsFile = path.join(__dirname, 'records.json');
    if (!fs.existsSync(recordsFile)) return;

    const fileRecords = JSON.parse(fs.readFileSync(recordsFile, 'utf8'));
    const dbRecordCount = await Record.countDocuments();

    if (dbRecordCount === 0 && Object.keys(fileRecords).length > 0) {
      console.log('Migrating records from records.json to MongoDB...');
      for (const [songKey, recordData] of Object.entries(fileRecords)) {
        await Record.findOneAndUpdate(
          { songKey: songKey },
          {
            songKey: songKey,
            player: recordData.player,
            time: recordData.time,
            date: recordData.date
          },
          { upsert: true }
        );
      }
      console.log(`Migrated ${Object.keys(fileRecords).length} records to MongoDB`);
    }
  } catch (err) {
    console.error('Error migrating records:', err.message);
  }
}

// Audio token system - prevents cheating by hiding song filenames
const audioTokens = new Map(); // token -> { songFile, expires }

function generateAudioToken(songFile) {
  const token = crypto.randomBytes(32).toString('hex');
  // Token expires in 5 minutes
  audioTokens.set(token, {
    songFile,
    expires: Date.now() + 5 * 60 * 1000
  });
  return token;
}

// Clean up expired tokens periodically (store ID for graceful shutdown)
const tokenCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, data] of audioTokens) {
    if (data.expires < now) {
      audioTokens.delete(token);
    }
  }
}, 60 * 1000); // Clean every minute

// Serve audio by token (must be before static middleware)
app.get('/audio-stream/:token', (req, res) => {
  const tokenData = audioTokens.get(req.params.token);
  if (!tokenData || tokenData.expires < Date.now()) {
    return res.status(404).send('Not found');
  }

  const audioPath = path.join(__dirname, 'public', 'audio', tokenData.songFile);
  if (!fs.existsSync(audioPath)) {
    return res.status(404).send('Not found');
  }

  // Stream the audio file
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Accept-Ranges', 'bytes');

  const stat = fs.statSync(audioPath);
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    const chunkSize = end - start + 1;

    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Content-Length', chunkSize);
    res.status(206);

    fs.createReadStream(audioPath, { start, end }).pipe(res);
  } else {
    res.setHeader('Content-Length', stat.size);
    fs.createReadStream(audioPath).pipe(res);
  }
});

// Block direct access to audio files (prevent cheating)
app.use('/audio', (req, res, next) => {
  // Only block mp3 files, allow other assets if any
  if (req.path.endsWith('.mp3')) {
    return res.status(403).send('Access denied');
  }
  next();
});

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Load songs database
let songs = [];
try {
  songs = JSON.parse(fs.readFileSync(path.join(__dirname, 'songs.json'), 'utf8'));
  console.log(`Loaded ${songs.length} songs from database`);
} catch (err) {
  console.error('Error loading songs.json:', err.message);
}

// Game state
const lobbies = {};
const loggedInUsers = {}; // Map socket.id to username

// Drawing game state and handlers now in server/handlers/drawing.js
// Typing game state and handlers now in server/handlers/typing.js

// Chat history persistence
const chatHistoryFile = path.join(__dirname, 'chatHistory.json');
let chatHistory = [];

function loadChatHistory() {
  try {
    if (fs.existsSync(chatHistoryFile)) {
      chatHistory = JSON.parse(fs.readFileSync(chatHistoryFile, 'utf8'));
      console.log(`Loaded ${chatHistory.length} chat messages from history`);
    }
  } catch (err) {
    console.error('Error loading chat history:', err.message);
    chatHistory = [];
  }
}
loadChatHistory();

function saveChatHistory() {
  try {
    fs.writeFileSync(chatHistoryFile, JSON.stringify(chatHistory, null, 2));
  } catch (err) {
    console.error('Error saving chat history:', err.message);
  }
}

function addToChatHistory(roomCode, message) {
  chatHistory.push({
    roomCode,
    timestamp: Date.now(),
    ...message
  });
  // Keep last 10000 messages
  if (chatHistory.length > 10000) {
    chatHistory = chatHistory.slice(-10000);
  }
  saveChatHistory();
}

function clearChatHistoryForRoom(roomCode) {
  const before = chatHistory.length;
  chatHistory = chatHistory.filter(msg => msg.roomCode !== roomCode);
  const cleared = before - chatHistory.length;
  if (cleared > 0) {
    saveChatHistory();
    console.log(`Cleared ${cleared} chat messages for room ${roomCode}`);
  }
}

// Generate a random 4-letter room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Get a random song with cooldown (avoids last 100 songs)
function getRandomSong(recentSongs = []) {
  if (songs.length === 0) return null;

  // Filter out recently played songs
  const availableSongs = songs.filter(song => !recentSongs.includes(song.file));

  // If all songs are on cooldown, just pick any
  if (availableSongs.length === 0) {
    return songs[Math.floor(Math.random() * songs.length)];
  }

  return availableSongs[Math.floor(Math.random() * availableSongs.length)];
}

// Update user stats after a round
function updateUserStats(username, gameName, guessedGame, gotSuperSonic, usedHint, points) {
  if (!users[username]) return;

  const stats = users[username].stats;
  stats.gamesPlayed++;
  stats.totalPoints += points;

  if (guessedGame) {
    stats.gamesGuessed++;
    if (!stats.gameHistory[gameName]) {
      stats.gameHistory[gameName] = 0;
    }
    stats.gameHistory[gameName]++;
  }

  if (gotSuperSonic) {
    stats.superSonics++;
  }

  if (usedHint) {
    stats.hintsUsed++;
  }

  saveUser(username);
}

// Get user's most guessed game
function getMostGuessedGame(username) {
  if (!users[username]) return null;

  const history = users[username].stats.gameHistory;
  let maxGame = null;
  let maxCount = 0;

  for (const [game, count] of Object.entries(history)) {
    if (count > maxCount) {
      maxCount = count;
      maxGame = game;
    }
  }

  return maxGame ? { game: maxGame, count: maxCount } : null;
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Player connected:', socket.id);

  let currentRoom = null;

  // Setup auth handler first - returns helper functions for other handlers
  const authHelpers = authHandler.setupHandlers(io, socket, {
    users,
    loggedInUsers,
    typingLeaderboard,
    useInMemory,
    saveUser,
    TypingLeaderboard
  });

  // Setup profile and leaderboard handlers
  profileHandler.setupHandlers(io, socket, {
    users,
    records,
    getLoggedInUsername: authHelpers.getLoggedInUsername,
    getMostGuessedGame
  });

  leaderboardsHandler.setupHandlers(io, socket, {
    users,
    records,
    typingLeaderboard
  });

  // Setup modular game handlers
  const drawingCleanup = drawingHandler.setupHandlers(io, socket, {
    getUser: (username) => users[username],
    saveUser: saveUser,
    getLoggedInUsername: authHelpers.getLoggedInUsername
  });
  const typingCleanup = typingHandler.setupHandlers(io, socket, {
    getUser: (username) => users[username],
    getLoggedInUsername: authHelpers.getLoggedInUsername,
    updateTypingLeaderboard: updateTypingLeaderboard,
    saveUser: saveUser
  });
  const vgmCleanup = vgmHandler.setupHandlers(io, socket, {
    lobbies,
    users,
    records,
    chatHistory,
    typingUsers,
    getUser: (username) => users[username],
    getLoggedInUsername: authHelpers.getLoggedInUsername,
    setCurrentRoom: (room) => { currentRoom = room; },
    getCurrentRoom: () => currentRoom,
    getPlayerName: authHelpers.getPlayerName,
    setPlayerName: authHelpers.setPlayerName,
    updateUserStats,
    saveUser,
    saveRecord,
    addToChatHistory,
    clearChatHistoryForRoom,
    getRandomSong,
    generateAudioToken
  });
  slotsHandler.setupHandlers(io, socket, {
    getUser: (username) => users[username],
    saveUser: saveUser,
    getLoggedInUsername: authHelpers.getLoggedInUsername
  });
  stackingHandler.setupHandlers(io, socket, {
    getUser: (username) => users[username],
    saveUser: saveUser,
    getLoggedInUsername: authHelpers.getLoggedInUsername
  });
  fishingHandler.setupHandlers(io, socket, {
    getUser: (username) => users[username],
    saveUser: saveUser,
    getLoggedInUsername: authHelpers.getLoggedInUsername
  });
  const minigolfCleanup = minigolfHandler.setupHandlers(io, socket, {
    getUser: (username) => users[username],
    saveUser: saveUser,
    getLoggedInUsername: authHelpers.getLoggedInUsername
  });
  cardsHandler.setupHandlers(io, socket, {
    getUser: (username) => users[username],
    saveUser: saveUser,
    getLoggedInUsername: authHelpers.getLoggedInUsername
  });
  wordleHandler.setupHandlers(io, socket, {
    getUser: (username) => users[username],
    saveUser: saveUser,
    getLoggedInUsername: authHelpers.getLoggedInUsername
  });

  // Create a new lobby
  socket.on('createLobby', () => {
    const loggedInUsername = authHelpers.getLoggedInUsername();
    if (!loggedInUsername) {
      socket.emit('error', 'Please log in first');
      return;
    }

    const user = users[loggedInUsername];
    authHelpers.setPlayerName(user.username);
    let roomCode = generateRoomCode();

    // Make sure code is unique
    while (lobbies[roomCode]) {
      roomCode = generateRoomCode();
    }

    lobbies[roomCode] = vgmHandler.createLobby(roomCode);
    lobbies[roomCode].players[socket.id] = vgmHandler.createVGMPlayer(loggedInUsername, user);

    socket.join(roomCode);
    currentRoom = roomCode;

    socket.emit('lobbyCreated', { roomCode, playerName: user.username });
    io.to(roomCode).emit('playerList', vgmHandler.getPlayerList(lobbies, roomCode));
    console.log(`Lobby ${roomCode} created by ${user.username}`);
  });

  // Join an existing lobby
  socket.on('joinLobby', ({ roomCode }) => {
    const loggedInUsername = authHelpers.getLoggedInUsername();
    if (!loggedInUsername) {
      socket.emit('error', 'Please log in first');
      return;
    }

    const user = users[loggedInUsername];
    authHelpers.setPlayerName(user.username);
    const room = roomCode.toUpperCase();

    if (!lobbies[room]) {
      socket.emit('error', 'Lobby not found!');
      return;
    }

    lobbies[room].players[socket.id] = vgmHandler.createVGMPlayer(loggedInUsername, user);

    socket.join(room);
    currentRoom = room;

    socket.emit('lobbyJoined', { roomCode: room, playerName: user.username });
    io.to(room).emit('playerList', vgmHandler.getPlayerList(lobbies, room));
    io.to(room).emit('chatMessage', { system: true, message: `${user.username} se ha unido al lobby!` });

    // Send chat history to the new player (last 100 messages only)
    const roomHistory = chatHistory.filter(msg => msg.roomCode === room).slice(-100);
    socket.emit('chatHistory', roomHistory);

    console.log(`${user.username} joined lobby ${room}`);
  });

  // VGM game handlers (joinVGM, startRound, typing indicators) now in server/handlers/vgm.js
  // Leaderboards now in server/handlers/leaderboards.js

  // Leave room (go back to menu) - handled by VGM module
  socket.on('leaveRoom', () => {
    vgmCleanup.handleLeaveRoom();
  });

  // Typing game handlers now in server/handlers/typing.js
  // Drawing game handlers now in server/handlers/drawing.js

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);

    // Clean up auth state
    authHelpers.handleDisconnect();

    // Clean up VGM game (using modular handler)
    vgmCleanup.handleDisconnect();

    // Clean up typing game (using modular handler)
    typingCleanup.handleDisconnect();

    // Clean up drawing game (using modular handler)
    if (drawingCleanup.isDrawingPlayer() || drawingCleanup.isDrawingSpectator()) {
      drawingCleanup.handleDisconnect();
    }

    // Clean up minigolf game
    minigolfCleanup.handleDisconnect();
  });
});

// VGM round management functions now in server/handlers/vgm.js

// Add new users if they don't exist
async function ensureUsersExist() {
  const newUsers = [
    { username: 'cilveti', password: 'helloworld' },
    { username: 'Wykenz', password: 'animu' },
    { username: 'kelmi', password: 'kobson' },
    { username: 'guille', password: 'maya' },
    { username: 'oli', password: 'kobson' }
  ];

  for (const userData of newUsers) {
    const exists = await User.findOne({ username: userData.username });
    if (!exists) {
      const hashedPassword = bcrypt.hashSync(userData.password, 10);
      await User.create({
        username: userData.username,
        password: hashedPassword,
        isAdmin: false,
        profilePicture: `profiles/${userData.username}.png`,
        stats: {
          gamesPlayed: 0,
          gamesGuessed: 0,
          superSonics: 0,
          hintsUsed: 0,
          totalPoints: 0,
          gameHistory: {}
        }
      });
      console.log(`Created user: ${userData.username}`);
    }
  }
}

// Load users from JSON files for in-memory mode
function createInMemoryUsers() {
  const usersFile = path.join(__dirname, 'users.json');
  const recordsFile = path.join(__dirname, 'records.json');

  // Try to load users from users.json
  if (fs.existsSync(usersFile)) {
    try {
      const fileUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      for (const [username, userData] of Object.entries(fileUsers)) {
        users[username] = {
          username: userData.username,
          password: userData.password,
          isAdmin: userData.isAdmin || false,
          profilePicture: userData.profilePicture || 'profiles/default.svg',
          coins: userData.coins ?? 1000,
          debt: userData.debt ?? 0,
          cards: userData.cards ?? {},
          lastFreeCard: userData.lastFreeCard ?? null,
          stats: {
            gamesPlayed: userData.stats?.gamesPlayed || 0,
            gamesGuessed: userData.stats?.gamesGuessed || 0,
            superSonics: userData.stats?.superSonics || 0,
            hintsUsed: userData.stats?.hintsUsed || 0,
            totalPoints: userData.stats?.totalPoints || 0,
            gameHistory: userData.stats?.gameHistory || {}
          },
          sqrrrdle: {
            wordsGuessed: userData.sqrrrdle?.wordsGuessed ?? 0,
            totalTries: userData.sqrrrdle?.totalTries ?? 0,
            totalCoins: userData.sqrrrdle?.totalCoins ?? 0,
            lastCompletedDate: userData.sqrrrdle?.lastCompletedDate ?? null,
            currentDayGuesses: userData.sqrrrdle?.currentDayGuesses ?? [],
            currentDayStatus: userData.sqrrrdle?.currentDayStatus ?? 'playing',
            currentDayKey: userData.sqrrrdle?.currentDayKey ?? null
          }
        };
      }
      console.log(`Loaded ${Object.keys(users).length} users from users.json`);
    } catch (err) {
      console.error('Error loading users.json:', err.message);
    }
  }

  // Try to load records from records.json
  if (fs.existsSync(recordsFile)) {
    try {
      const fileRecords = JSON.parse(fs.readFileSync(recordsFile, 'utf8'));
      for (const [songKey, recordData] of Object.entries(fileRecords)) {
        records[songKey] = {
          player: recordData.player,
          time: recordData.time,
          date: recordData.date
        };
      }
      console.log(`Loaded ${Object.keys(records).length} records from records.json`);
    } catch (err) {
      console.error('Error loading records.json:', err.message);
    }
  }

  // If no users loaded, create defaults
  if (Object.keys(users).length === 0) {
    console.log('No users.json found, creating test users');
    const defaultUsers = [
      { username: 'TestUser', password: 'test123', isAdmin: true },
      { username: 'Player1', password: 'player1' },
      { username: 'Player2', password: 'player2' }
    ];

    for (const userData of defaultUsers) {
      const hashedPassword = bcrypt.hashSync(userData.password, 10);
      users[userData.username] = {
        username: userData.username,
        password: hashedPassword,
        isAdmin: userData.isAdmin || false,
        profilePicture: 'profiles/default.svg',
        coins: 1000,
        debt: 0,
        cards: {},
        lastFreeCard: null,
        stats: {
          gamesPlayed: 0,
          gamesGuessed: 0,
          superSonics: 0,
          hintsUsed: 0,
          totalPoints: 0,
          gameHistory: {}
        },
        sqrrrdle: {
          wordsGuessed: 0,
          totalTries: 0,
          totalCoins: 0,
          lastCompletedDate: null,
          currentDayGuesses: [],
          currentDayStatus: 'playing',
          currentDayKey: null
        }
      };
    }
  }
}

// Initialize MongoDB data and start server
async function initializeAndStart() {
  if (!useInMemory) {
    try {
      // Wait for MongoDB connection
      await mongoose.connection.asPromise();

      // Migrate existing JSON data to MongoDB (runs only if MongoDB is empty)
      await migrateUsersToMongoDB();
      await migrateRecordsToMongoDB();

      // Ensure required users exist
      await ensureUsersExist();

      // Load data from MongoDB into memory
      await loadUsers();
      await loadRecords();
      await loadTypingLeaderboard();
    } catch (err) {
      console.error('MongoDB initialization failed:', err.message);
      console.log('Falling back to in-memory storage');
      useInMemory = true;
    }
  }

  // If using in-memory mode, create test users
  if (useInMemory) {
    createInMemoryUsers();
  }

  // Initialize modular game handlers
  drawingHandler.init(io, __dirname);
  typingHandler.init(io, __dirname);
  vgmHandler.init(io);
  slotsHandler.init(io);
  stackingHandler.init(io);
  fishingHandler.init(io);
  minigolfHandler.init(io);
  cardsHandler.init(io);
  authHandler.init(io);
  profileHandler.init(io);
  leaderboardsHandler.init(io);

  // Start server
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    if (useInMemory) {
      console.log('Running in IN-MEMORY mode - data will not persist between restarts');
      console.log('Test users: TestUser (admin), Player1, Player2 - all with simple passwords');
    }
    console.log('Share the room code with friends to play together!');
  });
}

initializeAndStart().catch(err => {
  console.error('Failed to initialize:', err);
  process.exit(1);
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Clear the token cleanup interval
  clearInterval(tokenCleanupInterval);
  console.log('Cleared token cleanup interval');

  // Close all socket connections
  io.close(() => {
    console.log('Socket.IO connections closed');
  });

  // Close HTTP server
  server.close(() => {
    console.log('HTTP server closed');

    // Close MongoDB connection if connected
    if (!useInMemory && mongoose.connection.readyState === 1) {
      mongoose.connection.close(false, () => {
        console.log('MongoDB connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
