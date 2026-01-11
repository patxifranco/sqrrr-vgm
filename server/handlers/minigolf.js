/**
 * Minigolf Game Socket Handlers
 *
 * Golf It/Golf With Friends clone for SQRRR platform.
 * - Single global lobby (no room codes)
 * - 2-8 players, all play simultaneously
 * - Client-side physics (Godot), server just relays
 * - 9 holes per game
 */

const { log, warn } = require('../utils');

// ==================== CONSTANTS ====================

const MINIGOLF_ROOM = 'MINIGOLF';
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 1; // For testing, change to 2 for production
const TOTAL_HOLES = 9;
const BROADCAST_RATE = 60; // Hz - high rate for smooth multiplayer
const COINS_PER_HOLE = 200;
const COINS_HOLE_IN_ONE = 1000;

// ==================== STATE ====================

let _io = null;
let _saveUser = null;
let _getUser = null;

const minigolfLobby = {
  players: {},           // socketId -> player data
  gameState: 'waiting',  // waiting | loading | playing | hole_transition | finished
  currentHole: 1,
  broadcastInterval: null
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get player list formatted for client
 */
function getPlayerList() {
  return Object.values(minigolfLobby.players).map(p => ({
    id: p.id,
    username: p.username,
    profilePicture: p.profilePicture,
    ballColor: p.ballColor,
    ready: p.ready,
    loaded: p.loaded,
    spectating: p.spectating,
    strokes: p.strokes,
    totalStrokes: p.totalStrokes,
    finished: p.finished,
    holesPlayed: p.holesPlayed
  }));
}

/**
 * Get active (non-spectating) players
 */
function getActivePlayers() {
  return Object.values(minigolfLobby.players).filter(p => !p.spectating);
}

/**
 * Check if all active players are ready
 */
function allPlayersReady() {
  const active = getActivePlayers();
  if (active.length < MIN_PLAYERS) return false;
  return active.every(p => p.ready);
}

/**
 * Check if all active players have loaded
 */
function allPlayersLoaded() {
  const active = getActivePlayers();
  return active.every(p => p.loaded);
}

/**
 * Check if all active players finished the hole
 */
function allPlayersFinishedHole() {
  const active = getActivePlayers();
  return active.every(p => p.finished);
}

/**
 * Generate a random ball color
 */
function generateBallColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Get tee position for current hole
 */
function getTeePosition(holeNumber) {
  // Placeholder - client loads from course
  return { x: 0, y: 0.1, z: 0 };
}

/**
 * Get hole position for current hole
 */
function getHolePosition(holeNumber) {
  // Placeholder - client loads from course
  return { x: 0, y: 0, z: 10 };
}

/**
 * Start broadcasting game state to clients
 */
function startBroadcastLoop() {
  if (minigolfLobby.broadcastInterval) return;

  const broadcastInterval = 1000 / BROADCAST_RATE;

  minigolfLobby.broadcastInterval = setInterval(() => {
    if (minigolfLobby.gameState !== 'playing') return;

    // Build state update
    const ballStates = {};
    const players = Object.values(minigolfLobby.players);
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (!player.spectating) {
        ballStates[player.id] = {
          position: player.ballPosition,
          isMoving: player.isMoving,
          strokes: player.strokes,
          finished: player.finished
        };
      }
    }

    _io.to(MINIGOLF_ROOM).emit('minigolfState', {
      balls: ballStates,
      timestamp: Date.now()
    });
  }, broadcastInterval);
}

/**
 * Stop broadcasting game state
 */
function stopBroadcastLoop() {
  if (minigolfLobby.broadcastInterval) {
    clearInterval(minigolfLobby.broadcastInterval);
    minigolfLobby.broadcastInterval = null;
  }
}

/**
 * Handle ball going in hole
 */
function handleBallInHole(playerId) {
  const io = _io;
  const player = minigolfLobby.players[playerId];
  if (!player || player.finished) return;

  player.finished = true;
  player.holesPlayed++;

  // Calculate coins earned
  let coinsEarned = COINS_PER_HOLE;
  if (player.strokes === 1) {
    coinsEarned = COINS_HOLE_IN_ONE;
  }
  player.coinsEarned += coinsEarned;

  // Award coins
  if (_saveUser && _getUser) {
    const user = _getUser(player.username);
    if (user) {
      user.coins = (user.coins ?? 1000) + coinsEarned;
      _saveUser(player.username);
    }
  }

  io.to(MINIGOLF_ROOM).emit('minigolfBallInHole', {
    playerId: playerId,
    username: player.username,
    strokes: player.strokes,
    coinsEarned: coinsEarned,
    holeInOne: player.strokes === 1
  });

  log('MINIGOLF', `${player.username} finished hole ${minigolfLobby.currentHole} in ${player.strokes} strokes (+${coinsEarned} coins)`);

  // Check if all players finished
  if (allPlayersFinishedHole()) {
    endHole();
  }
}

/**
 * Start a new hole
 */
function startHole() {
  const io = _io;

  minigolfLobby.gameState = 'playing';

  // Reset player states for new hole
  const teePos = getTeePosition(minigolfLobby.currentHole);

  Object.values(minigolfLobby.players).forEach(player => {
    if (!player.spectating) {
      player.strokes = 0;
      player.finished = false;
      player.ballPosition = { ...teePos };
      player.isMoving = false;
    }
  });

  // Activate late joiners for this hole
  Object.values(minigolfLobby.players).forEach(player => {
    if (player.spectating && player.loaded) {
      player.spectating = false;
      player.strokes = 0;
      player.finished = false;
      player.ballPosition = { ...teePos };
      player.isMoving = false;

      io.to(player.id).emit('minigolfJoinedGame', {
        hole: minigolfLobby.currentHole,
        teePosition: teePos
      });
    }
  });

  io.to(MINIGOLF_ROOM).emit('minigolfHoleStart', {
    hole: minigolfLobby.currentHole,
    totalHoles: TOTAL_HOLES,
    teePosition: teePos,
    holePosition: getHolePosition(minigolfLobby.currentHole),
    players: getPlayerList()
  });

  startBroadcastLoop();

  log('MINIGOLF', `Hole ${minigolfLobby.currentHole} started`);
}

/**
 * End the current hole
 */
function endHole() {
  const io = _io;

  stopBroadcastLoop();

  minigolfLobby.gameState = 'hole_transition';

  // Calculate hole results
  const holeResults = getActivePlayers()
    .map(p => ({
      username: p.username,
      profilePicture: p.profilePicture,
      strokes: p.strokes,
      totalStrokes: p.totalStrokes
    }))
    .sort((a, b) => a.strokes - b.strokes);

  io.to(MINIGOLF_ROOM).emit('minigolfHoleComplete', {
    hole: minigolfLobby.currentHole,
    results: holeResults
  });

  log('MINIGOLF', `Hole ${minigolfLobby.currentHole} complete`);

  // Check if game is over
  if (minigolfLobby.currentHole >= TOTAL_HOLES) {
    setTimeout(() => endGame(), 5000);
  } else {
    setTimeout(() => {
      minigolfLobby.currentHole++;
      startHole();
    }, 5000);
  }
}

/**
 * End the game and show final results
 */
function endGame() {
  const io = _io;

  stopBroadcastLoop();

  minigolfLobby.gameState = 'finished';

  // Calculate final rankings (fewer strokes = better)
  const finalRankings = Object.values(minigolfLobby.players)
    .filter(p => p.holesPlayed > 0)
    .map(p => ({
      username: p.username,
      profilePicture: p.profilePicture,
      totalStrokes: p.totalStrokes,
      holesPlayed: p.holesPlayed,
      coinsEarned: p.coinsEarned
    }))
    .sort((a, b) => {
      // Sort by average strokes per hole
      const avgA = a.totalStrokes / a.holesPlayed;
      const avgB = b.totalStrokes / b.holesPlayed;
      return avgA - avgB;
    });

  // Award bonus coins for top 3
  const bonuses = [500, 300, 100];
  finalRankings.slice(0, 3).forEach((player, index) => {
    if (_saveUser && _getUser) {
      const user = _getUser(player.username);
      if (user) {
        user.coins = (user.coins ?? 1000) + bonuses[index];
        _saveUser(player.username);
        player.bonusCoins = bonuses[index];
      }
    }
  });

  io.to(MINIGOLF_ROOM).emit('minigolfGameEnd', {
    rankings: finalRankings
  });

  log('MINIGOLF', `Game ended. Winner: ${finalRankings[0]?.username || 'N/A'}`);

  // Reset lobby after delay
  setTimeout(() => resetLobby(), 10000);
}

/**
 * Reset the lobby for a new game
 */
function resetLobby() {
  const io = _io;

  stopBroadcastLoop();

  minigolfLobby.gameState = 'waiting';
  minigolfLobby.currentHole = 1;

  // Reset player states
  Object.values(minigolfLobby.players).forEach(player => {
    player.ready = false;
    player.loaded = false;
    player.spectating = false;
    player.strokes = 0;
    player.totalStrokes = 0;
    player.finished = false;
    player.holesPlayed = 0;
    player.coinsEarned = 0;
    player.ballPosition = { x: 0, y: 0, z: 0 };
    player.isMoving = false;
  });

  io.to(MINIGOLF_ROOM).emit('minigolfLobbyReset', {
    players: getPlayerList()
  });

  log('MINIGOLF', 'Lobby reset');
}

/**
 * Handle player disconnect
 */
function handleDisconnect(socketId) {
  const io = _io;
  const player = minigolfLobby.players[socketId];

  if (!player) return;

  const username = player.username;
  delete minigolfLobby.players[socketId];

  io.to(MINIGOLF_ROOM).emit('minigolfPlayerLeft', {
    playerId: socketId,
    username: username,
    players: getPlayerList()
  });

  log('MINIGOLF', `${username} left`);

  // Check remaining players
  const totalPlayers = Object.keys(minigolfLobby.players).length;
  const activePlayers = getActivePlayers();

  // If lobby is empty OR not enough players to continue, reset everything
  if (totalPlayers === 0 || (minigolfLobby.gameState !== 'waiting' && totalPlayers < MIN_PLAYERS)) {
    log('MINIGOLF', 'Not enough players - resetting lobby');
    stopBroadcastLoop();
    minigolfLobby.gameState = 'waiting';
    minigolfLobby.currentHole = 1;
    // Reset remaining players' ready state
    Object.values(minigolfLobby.players).forEach(p => {
      p.ready = false;
      p.loaded = false;
      p.spectating = false;
      p.strokes = 0;
      p.totalStrokes = 0;
      p.finished = false;
      p.holesPlayed = 0;
      p.coinsEarned = 0;
    });
    // Notify remaining players
    io.to(MINIGOLF_ROOM).emit('minigolfLobbyReset', {
      players: getPlayerList()
    });
    return;
  }

  // Check if we need to end hole/game
  if (minigolfLobby.gameState === 'playing') {
    if (activePlayers.length === 0) {
      resetLobby();
    } else if (allPlayersFinishedHole()) {
      endHole();
    }
  }

  // If in loading state and now all loaded, start
  if (minigolfLobby.gameState === 'loading' && allPlayersLoaded()) {
    startHole();
  }
}

// ==================== INITIALIZATION ====================

/**
 * Initialize minigolf module
 */
function init(io) {
  _io = io;
  log('MINIGOLF', 'Handler initialized (relay mode, no physics)');
}

// ==================== SOCKET HANDLERS ====================

/**
 * Setup socket handlers for a connection
 */
function setupHandlers(io, socket, context = {}) {
  const { getUser, saveUser, getLoggedInUsername } = context;

  // Store references
  if (saveUser && !_saveUser) _saveUser = saveUser;
  if (getUser && !_getUser) _getUser = getUser;

  let isInLobby = false;

  // Join the minigolf lobby
  socket.on('minigolfJoin', (data) => {
    const username = data?.username || getLoggedInUsername?.() || 'Guest';
    const profilePicture = data?.profilePicture || 'profiles/default.svg';

    // Already in lobby?
    if (minigolfLobby.players[socket.id]) return;

    // Check max players
    if (Object.keys(minigolfLobby.players).length >= MAX_PLAYERS) {
      socket.emit('minigolfError', { message: 'Lobby lleno (max 8 jugadores)' });
      return;
    }

    socket.join(MINIGOLF_ROOM);
    isInLobby = true;

    // Determine if joining as spectator (game in progress)
    const isSpectator = minigolfLobby.gameState !== 'waiting';

    minigolfLobby.players[socket.id] = {
      id: socket.id,
      username: username,
      profilePicture: profilePicture,
      ballColor: generateBallColor(),
      ready: false,
      loaded: false,
      spectating: isSpectator,
      strokes: 0,
      totalStrokes: 0,
      finished: false,
      holesPlayed: 0,
      coinsEarned: 0,
      ballPosition: { x: 0, y: 0, z: 0 },
      isMoving: false
    };

    socket.emit('minigolfJoined', {
      playerId: socket.id,
      players: getPlayerList(),
      gameState: minigolfLobby.gameState,
      currentHole: minigolfLobby.currentHole,
      isSpectator: isSpectator
    });

    socket.to(MINIGOLF_ROOM).emit('minigolfPlayerJoined', {
      player: minigolfLobby.players[socket.id],
      players: getPlayerList()
    });

    log('MINIGOLF', `${username} joined ${isSpectator ? 'as spectator' : ''}`);
  });

  // Player clicks "JUGAR" (ready)
  socket.on('minigolfReady', () => {
    const player = minigolfLobby.players[socket.id];
    if (!player) return;
    if (minigolfLobby.gameState !== 'waiting') return;

    player.ready = !player.ready;

    _io.to(MINIGOLF_ROOM).emit('minigolfLobbyState', {
      players: getPlayerList(),
      gameState: minigolfLobby.gameState
    });

    log('MINIGOLF', `${player.username} ${player.ready ? 'ready' : 'not ready'}`);

    // Check if all ready to start
    if (allPlayersReady()) {
      minigolfLobby.gameState = 'loading';

      _io.to(MINIGOLF_ROOM).emit('minigolfStartLoading', {
        hole: minigolfLobby.currentHole,
        players: getPlayerList()
      });

      log('MINIGOLF', 'All ready - starting map load');
    }
  });

  // Player finished loading the map
  socket.on('minigolfLoaded', (data) => {
    const player = minigolfLobby.players[socket.id];
    if (!player) return;

    player.loaded = true;

    log('MINIGOLF', `${player.username} loaded`);

    // If in loading state and all loaded, start game
    if (minigolfLobby.gameState === 'loading' && allPlayersLoaded()) {
      startHole();
    }
  });

  // Player takes a shot (relay to other clients)
  socket.on('minigolfShot', (data) => {
    const player = minigolfLobby.players[socket.id];
    if (!player) return;
    if (player.spectating || player.finished) return;
    if (player.isMoving) return; // Can't shoot while ball moving
    if (minigolfLobby.gameState !== 'playing') return;

    const { direction, power } = data;
    if (!direction || typeof power !== 'number') return;

    // Validate power (0-1)
    const clampedPower = Math.max(0, Math.min(1, power));

    player.strokes++;
    player.totalStrokes++;
    player.isMoving = true;

    // Broadcast shot to all players (including shooter for confirmation)
    _io.to(MINIGOLF_ROOM).emit('minigolfShotTaken', {
      playerId: socket.id,
      username: player.username,
      direction: direction,
      power: clampedPower,
      strokes: player.strokes
    });

    log('MINIGOLF', `${player.username} shot (stroke ${player.strokes}, power ${(clampedPower * 100).toFixed(0)}%)`);
  });

  // Player updates their ball position (from client physics)
  socket.on('minigolfBallUpdate', (data) => {
    const player = minigolfLobby.players[socket.id];
    if (!player) return;
    if (player.spectating || player.finished) return;

    if (data.position) {
      player.ballPosition = data.position;
    }
    if (typeof data.isMoving === 'boolean') {
      player.isMoving = data.isMoving;
    }
  });

  // Player's ball went in hole
  socket.on('minigolfBallInHole', () => {
    handleBallInHole(socket.id);
  });

  // Player resets ball position
  socket.on('minigolfResetBall', (data) => {
    const player = minigolfLobby.players[socket.id];
    if (!player) return;
    if (player.spectating || player.finished) return;
    if (minigolfLobby.gameState !== 'playing') return;

    const { position } = data;
    if (!position || typeof position.x !== 'number') return;

    player.ballPosition = { ...position };
    player.isMoving = false;

    log('MINIGOLF', `${player.username} reset ball`);
  });

  // DEBUG: P key - reset everything
  socket.on('minigolfDebugReset', () => {
    log('MINIGOLF', 'DEBUG: Reset triggered');
    resetLobby();
  });

  // Player leaves
  socket.on('minigolfLeave', () => {
    if (!isInLobby) return;

    socket.leave(MINIGOLF_ROOM);
    handleDisconnect(socket.id);
    isInLobby = false;
  });

  // Return cleanup handler
  return {
    handleDisconnect: () => {
      if (isInLobby) {
        handleDisconnect(socket.id);
        isInLobby = false;
      }
    }
  };
}

module.exports = {
  init,
  setupHandlers,
  minigolfLobby,
  MINIGOLF_ROOM
};
