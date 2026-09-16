const { log, warn } = require('../utils');

const MINIGOLF_ROOM = 'MINIGOLF';
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 1;
const TOTAL_HOLES = 9;
const BROADCAST_RATE = 60;
const COINS_PER_HOLE = 200;
const COINS_HOLE_IN_ONE = 1000;

let _io = null;
let _saveUser = null;
let _getUser = null;

const minigolfLobby = {
  players: {},
  gameState: 'waiting',
  currentHole: 1,
  broadcastInterval: null
};

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

function getActivePlayers() {
  return Object.values(minigolfLobby.players).filter(p => !p.spectating);
}

function allPlayersReady() {
  const active = getActivePlayers();
  if (active.length < MIN_PLAYERS) return false;
  return active.every(p => p.ready);
}

function allPlayersLoaded() {
  const active = getActivePlayers();
  return active.every(p => p.loaded);
}

function allPlayersFinishedHole() {
  const active = getActivePlayers();
  return active.every(p => p.finished);
}

function generateBallColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getTeePosition(holeNumber) {
  return { x: 0, y: 0.1, z: 0 };
}

function getHolePosition(holeNumber) {
  return { x: 0, y: 0, z: 10 };
}

function startBroadcastLoop() {
  if (minigolfLobby.broadcastInterval) return;

  const broadcastInterval = 1000 / BROADCAST_RATE;

  minigolfLobby.broadcastInterval = setInterval(() => {
    if (minigolfLobby.gameState !== 'playing') return;

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

function stopBroadcastLoop() {
  if (minigolfLobby.broadcastInterval) {
    clearInterval(minigolfLobby.broadcastInterval);
    minigolfLobby.broadcastInterval = null;
  }
}

function handleBallInHole(playerId) {
  const io = _io;
  const player = minigolfLobby.players[playerId];
  if (!player || player.finished) return;

  player.finished = true;
  player.holesPlayed++;

  let coinsEarned = COINS_PER_HOLE;
  if (player.strokes === 1) {
    coinsEarned = COINS_HOLE_IN_ONE;
  }
  player.coinsEarned += coinsEarned;

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

  if (allPlayersFinishedHole()) {
    endHole();
  }
}

function startHole() {
  const io = _io;

  minigolfLobby.gameState = 'playing';

  const teePos = getTeePosition(minigolfLobby.currentHole);

  Object.values(minigolfLobby.players).forEach(player => {
    if (!player.spectating) {
      player.strokes = 0;
      player.finished = false;
      player.ballPosition = { ...teePos };
      player.isMoving = false;
    }
  });

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

function endHole() {
  const io = _io;

  stopBroadcastLoop();

  minigolfLobby.gameState = 'hole_transition';

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

  if (minigolfLobby.currentHole >= TOTAL_HOLES) {
    setTimeout(() => endGame(), 5000);
  } else {
    setTimeout(() => {
      minigolfLobby.currentHole++;
      startHole();
    }, 5000);
  }
}

function endGame() {
  const io = _io;

  stopBroadcastLoop();

  minigolfLobby.gameState = 'finished';

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
      const avgA = a.totalStrokes / a.holesPlayed;
      const avgB = b.totalStrokes / b.holesPlayed;
      return avgA - avgB;
    });

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

  setTimeout(() => resetLobby(), 10000);
}

function resetLobby() {
  const io = _io;

  stopBroadcastLoop();

  minigolfLobby.gameState = 'waiting';
  minigolfLobby.currentHole = 1;

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

  const totalPlayers = Object.keys(minigolfLobby.players).length;
  const activePlayers = getActivePlayers();

  if (totalPlayers === 0 || (minigolfLobby.gameState !== 'waiting' && totalPlayers < MIN_PLAYERS)) {
    log('MINIGOLF', 'Not enough players - resetting lobby');
    stopBroadcastLoop();
    minigolfLobby.gameState = 'waiting';
    minigolfLobby.currentHole = 1;
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
    io.to(MINIGOLF_ROOM).emit('minigolfLobbyReset', {
      players: getPlayerList()
    });
    return;
  }

  if (minigolfLobby.gameState === 'playing') {
    if (activePlayers.length === 0) {
      resetLobby();
    } else if (allPlayersFinishedHole()) {
      endHole();
    }
  }

  if (minigolfLobby.gameState === 'loading' && allPlayersLoaded()) {
    startHole();
  }
}

function init(io) {
  _io = io;
  log('MINIGOLF', 'Handler initialized (relay mode, no physics)');
}

function setupHandlers(io, socket, context = {}) {
  const { getUser, saveUser, getLoggedInUsername } = context;

  if (saveUser && !_saveUser) _saveUser = saveUser;
  if (getUser && !_getUser) _getUser = getUser;

  let isInLobby = false;

  socket.on('minigolfJoin', (data) => {
    const username = data?.username || getLoggedInUsername?.() || 'Guest';
    const profilePicture = data?.profilePicture || 'profiles/default.svg';

    if (minigolfLobby.players[socket.id]) return;

    if (Object.keys(minigolfLobby.players).length >= MAX_PLAYERS) {
      socket.emit('minigolfError', { message: 'Lobby lleno (max 8 jugadores)' });
      return;
    }

    socket.join(MINIGOLF_ROOM);
    isInLobby = true;

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

    if (allPlayersReady()) {
      minigolfLobby.gameState = 'loading';

      _io.to(MINIGOLF_ROOM).emit('minigolfStartLoading', {
        hole: minigolfLobby.currentHole,
        players: getPlayerList()
      });

      log('MINIGOLF', 'All ready - starting map load');
    }
  });

  socket.on('minigolfLoaded', (data) => {
    const player = minigolfLobby.players[socket.id];
    if (!player) return;

    player.loaded = true;

    log('MINIGOLF', `${player.username} loaded`);

    if (minigolfLobby.gameState === 'loading' && allPlayersLoaded()) {
      startHole();
    }
  });

  socket.on('minigolfShot', (data) => {
    const player = minigolfLobby.players[socket.id];
    if (!player) return;
    if (player.spectating || player.finished) return;
    if (player.isMoving) return;
    if (minigolfLobby.gameState !== 'playing') return;

    const { direction, power } = data;
    if (!direction || typeof power !== 'number') return;

    const clampedPower = Math.max(0, Math.min(1, power));

    player.strokes++;
    player.totalStrokes++;
    player.isMoving = true;

    _io.to(MINIGOLF_ROOM).emit('minigolfShotTaken', {
      playerId: socket.id,
      username: player.username,
      direction: direction,
      power: clampedPower,
      strokes: player.strokes
    });

    log('MINIGOLF', `${player.username} shot (stroke ${player.strokes}, power ${(clampedPower * 100).toFixed(0)}%)`);
  });

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

  socket.on('minigolfBallInHole', () => {
    handleBallInHole(socket.id);
  });

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

  socket.on('minigolfDebugReset', () => {
    log('MINIGOLF', 'DEBUG: Reset triggered');
    resetLobby();
  });

  socket.on('minigolfLeave', () => {
    if (!isInLobby) return;

    socket.leave(MINIGOLF_ROOM);
    handleDisconnect(socket.id);
    isInLobby = false;
  });

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
