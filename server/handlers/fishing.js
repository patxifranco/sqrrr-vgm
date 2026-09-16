const GAME_COST = 100;

const FISH = [
  { id: 'omega', image: 'gamba/omegalul.png', coins: 50, minDepth: 0, maxDepth: 2 },
  { id: 'bluh', image: 'gamba/cmonbluh.png', coins: 75, minDepth: 0, maxDepth: 3 },
  { id: 'goblin', image: 'gamba/goblinus.png', coins: 150, minDepth: 1, maxDepth: 4 },
  { id: 'jose', image: 'gamba/iose.png', coins: 250, minDepth: 2, maxDepth: 5 },
  { id: 'navarra', image: 'gamba/navarra.png', coins: 400, minDepth: 3, maxDepth: 6 },
  { id: 'ima', image: 'gamba/ima.png', coins: 600, minDepth: 4, maxDepth: 6 },
  { id: 'thanos', image: 'gamba/thanos.gif', coins: 1000, minDepth: 5, maxDepth: 6 }
];

const OBSTACLES = [
  { id: 'rock', emoji: '\u{1FAA8}', size: 35, moves: false, name: 'una roca' },
  { id: 'bottle', emoji: '\u{1F37E}', size: 30, moves: true, name: 'una botella' },
  { id: 'coral', emoji: '\u{1FAB8}', size: 38, moves: false, name: 'un coral' },
  { id: 'anchor', emoji: '\u{2693}', size: 42, moves: true, name: 'un ancla' },
  { id: 'shell', emoji: '\u{1F41A}', size: 28, moves: false, name: 'una concha' },
  { id: 'can', emoji: '\u{1F96B}', size: 30, moves: true, name: 'una lata' },
  { id: 'seaweed', emoji: '\u{1FAD8}', size: 35, moves: false, name: 'algas' }
];

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 500;
const WATER_START_Y = 60;
const LAYER_COUNT = 6;
const LAYER_HEIGHT = (CANVAS_HEIGHT - WATER_START_Y) / LAYER_COUNT;

let _io = null;

const userLocks = new Map();

const activeGames = new Map();

function init(io) {
  _io = io;
  console.log('Fishing handler initialized');
}

function generateGameState() {
  const entities = [];

  for (let layer = 0; layer < LAYER_COUNT; layer++) {
    const layerY = WATER_START_Y + (layer * LAYER_HEIGHT) + (LAYER_HEIGHT / 2);

    let entityCount;
    if (layer === 0) {
      entityCount = 1;
    } else if (layer >= 4) {
      entityCount = 2 + Math.floor(Math.random() * 3);
    } else {
      entityCount = 2 + Math.floor(Math.random() * 3);
    }

    for (let i = 0; i < entityCount; i++) {
      let obstacleChance;
      if (layer === 0) {
        obstacleChance = 0;
      } else if (layer >= 4) {
        obstacleChance = 0.20;
      } else {
        obstacleChance = 0.45;
      }
      const isObstacle = Math.random() < obstacleChance;

      if (isObstacle) {
        const obstacle = OBSTACLES[Math.floor(Math.random() * OBSTACLES.length)];
        const direction = Math.random() < 0.5 ? 1 : -1;
        entities.push({
          type: 'obstacle',
          id: obstacle.id,
          emoji: obstacle.emoji,
          name: obstacle.name,
          x: Math.random() * (CANVAS_WIDTH - 60) + 30,
          y: layerY + (Math.random() * 30 - 15),
          size: obstacle.size,
          speed: obstacle.moves ? (20 + Math.random() * 30) : 0,
          direction: obstacle.moves ? direction : 0
        });
      } else {
        const availableFish = FISH.filter(f => layer >= f.minDepth && layer <= f.maxDepth);
        if (availableFish.length > 0) {
          const fish = availableFish[Math.floor(Math.random() * availableFish.length)];
          const direction = Math.random() < 0.5 ? 1 : -1;
          entities.push({
            type: 'fish',
            id: fish.id,
            image: fish.image,
            coins: fish.coins,
            x: Math.random() * (CANVAS_WIDTH - 80) + 40,
            y: layerY + (Math.random() * 20 - 10),
            size: 40,
            speed: 30 + Math.random() * 40,
            direction: direction
          });
        }
      }
    }
  }

  return {
    entities,
    timestamp: Date.now(),
    canvasWidth: CANVAS_WIDTH,
    canvasHeight: CANVAS_HEIGHT,
    waterStartY: WATER_START_Y
  };
}

function validateCatch(gameState, catchData) {
  if (!gameState || !catchData) return { valid: false };

  const { entityIndex, hookX, hookY, timestamp } = catchData;
  const entity = gameState.entities[entityIndex];

  if (!entity) return { valid: false };

  const gameTime = (timestamp - gameState.timestamp) / 1000;
  if (gameTime < 0 || gameTime > 30) {
    return { valid: false, reason: 'Invalid timing' };
  }

  return {
    valid: true,
    entity: entity
  };
}

function setupHandlers(io, socket, context) {
  const { getUser, saveUser, getLoggedInUsername } = context;

  socket.on('fishingGetBalance', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('fishingBalance', { coins: 0 });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('fishingBalance', { coins: 0 });
      return;
    }

    socket.emit('fishingBalance', {
      coins: user.coins ?? 1000
    });
  });

  socket.on('fishingStart', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('fishingError', { message: 'Not logged in' });
      return;
    }

    if (userLocks.get(username)) {
      socket.emit('fishingError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('fishingError', { message: 'User not found' });
      return;
    }

    if ((user.coins ?? 0) < GAME_COST) {
      socket.emit('fishingInsufficientFunds', {
        coins: user.coins ?? 0,
        required: GAME_COST
      });
      return;
    }

    userLocks.set(username, true);

    try {
      user.coins = (user.coins ?? 1000) - GAME_COST;
      saveUser(username);

      const gameState = generateGameState();
      activeGames.set(username, gameState);

      console.log(`[FISHING] ${username} started game, paid ${GAME_COST} coins. Balance: ${user.coins}`);

      socket.emit('fishingStarted', {
        coins: user.coins,
        gameState: gameState
      });
    } finally {
      userLocks.delete(username);
    }
  });

  socket.on('fishingCatch', (data) => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('fishingError', { message: 'Not logged in' });
      return;
    }

    if (userLocks.get(username)) {
      socket.emit('fishingError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('fishingError', { message: 'User not found' });
      return;
    }

    const gameState = activeGames.get(username);
    if (!gameState) {
      socket.emit('fishingError', { message: 'No active game' });
      return;
    }

    userLocks.set(username, true);

    try {
      const validation = validateCatch(gameState, data);

      if (!validation.valid) {
        console.log(`[FISHING] ${username} invalid catch: ${validation.reason}`);
        socket.emit('fishingResult', {
          success: false,
          coins: user.coins,
          message: 'Invalid catch'
        });
        activeGames.delete(username);
        return;
      }

      const entity = validation.entity;

      if (entity.type === 'fish') {
        const payout = entity.coins;
        user.coins = (user.coins ?? 0) + payout;
        saveUser(username);

        console.log(`[FISHING] ${username} caught ${entity.id}! Payout: ${payout}. Balance: ${user.coins}`);

        socket.emit('fishingResult', {
          success: true,
          caught: entity,
          payout: payout,
          coins: user.coins,
          message: `Caught ${entity.id} for ${payout} coins!`
        });
      } else {
        console.log(`[FISHING] ${username} hit ${entity.id}. No reward. Balance: ${user.coins}`);
        const obstacleName = entity.name || 'un obstaculo';

        socket.emit('fishingResult', {
          success: false,
          caught: entity,
          payout: 0,
          coins: user.coins,
          message: `Eso es ${obstacleName} tonto`
        });
      }

      activeGames.delete(username);
    } finally {
      userLocks.delete(username);
    }
  });

  socket.on('fishingMiss', () => {
    const username = getLoggedInUsername();
    if (!username) return;

    const user = getUser(username);
    if (!user) return;

    console.log(`[FISHING] ${username} missed everything. Balance: ${user.coins ?? 0}`);

    socket.emit('fishingResult', {
      success: false,
      payout: 0,
      coins: user.coins ?? 0,
      message: 'Na de na'
    });

    activeGames.delete(username);
  });

  return {
    handleDisconnect: () => {
      const username = getLoggedInUsername();
      if (username) {
        activeGames.delete(username);
      }
    }
  };
}

module.exports = {
  init,
  setupHandlers,
  GAME_COST,
  FISH,
  OBSTACLES
};
