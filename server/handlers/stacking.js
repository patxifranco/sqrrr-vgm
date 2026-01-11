/**
 * Block Stacking Game Socket Handlers
 *
 * Arcade stacker gambling game with $qr currency.
 * - Cost: 100 coins per game
 * - Payouts: Bronze 250, Silver 500, Gold 1000
 */

// ==================== CONSTANTS ====================
const GAME_COST = 100;
const PRIZES = {
  bronze: 250,
  silver: 500,
  gold: 1000
};

let _io = null;

// Per-user transaction locks to prevent race conditions
const userLocks = new Map();

// ==================== INITIALIZATION ====================
function init(io) {
  _io = io;
  console.log('Stacking handler initialized');
}

// ==================== SOCKET HANDLERS ====================
function setupHandlers(io, socket, context) {
  const { getUser, saveUser, getLoggedInUsername } = context;

  // Get user's balance
  socket.on('stackingGetBalance', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('stackingBalance', { coins: 0 });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('stackingBalance', { coins: 0 });
      return;
    }

    socket.emit('stackingBalance', {
      coins: user.coins ?? 1000
    });
  });

  // Start a new game (deduct cost)
  socket.on('stackingStart', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('stackingError', { message: 'Not logged in' });
      return;
    }

    // Prevent race condition
    if (userLocks.get(username)) {
      socket.emit('stackingError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('stackingError', { message: 'User not found' });
      return;
    }

    // Check if user has enough coins
    if ((user.coins ?? 0) < GAME_COST) {
      socket.emit('stackingInsufficientFunds', {
        coins: user.coins ?? 0,
        required: GAME_COST
      });
      return;
    }

    // Lock user during transaction
    userLocks.set(username, true);

    try {
      // Deduct cost
      user.coins = (user.coins ?? 1000) - GAME_COST;
      saveUser(username);

      console.log(`[STACKING] ${username} started game, paid ${GAME_COST} coins. Balance: ${user.coins}`);

      socket.emit('stackingStarted', {
        coins: user.coins
      });
    } finally {
      userLocks.delete(username);
    }
  });

  // Player won (award payout)
  socket.on('stackingWin', (data) => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('stackingError', { message: 'Not logged in' });
      return;
    }

    // Prevent race condition
    if (userLocks.get(username)) {
      socket.emit('stackingError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('stackingError', { message: 'User not found' });
      return;
    }

    const prizeLevel = data?.prizeLevel;
    const payout = PRIZES[prizeLevel] || 0;

    if (payout <= 0) {
      socket.emit('stackingError', { message: 'Invalid prize level' });
      return;
    }

    // Lock user during transaction
    userLocks.set(username, true);

    try {
      // Award payout
      user.coins = (user.coins ?? 0) + payout;
      saveUser(username);

      console.log(`[STACKING] ${username} won ${prizeLevel}! Payout: ${payout}. Balance: ${user.coins}`);

      socket.emit('stackingWon', {
        prizeLevel,
        payout,
        coins: user.coins
      });
    } finally {
      userLocks.delete(username);
    }
  });

  // Player lost (no payout, just acknowledge)
  socket.on('stackingLose', () => {
    const username = getLoggedInUsername();
    if (!username) return;

    const user = getUser(username);
    if (!user) return;

    console.log(`[STACKING] ${username} lost game. Balance: ${user.coins ?? 0}`);

    socket.emit('stackingLost', {
      coins: user.coins ?? 0
    });
  });

  // Cleanup function
  return {
    handleDisconnect: () => {
      // No cleanup needed for stacking
    }
  };
}

module.exports = {
  init,
  setupHandlers,
  GAME_COST,
  PRIZES
};
