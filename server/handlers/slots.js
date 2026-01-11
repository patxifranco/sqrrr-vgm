/**
 * Slot Machine Game Socket Handlers
 *
 * Handles slot machine game logic with $qr currency.
 */

const { invalidateCache: invalidateLeaderboardCache } = require('./leaderboards');

// ==================== CONSTANTS ====================
// Jackpot-style payouts - rare wins pay BIG
const SYMBOLS = [
  { id: 'cherry', weight: 38, payout: 30 },     // Very common - small consolation
  { id: 'lemon', weight: 32, payout: 60 },      // Common - break-even territory
  { id: 'orange', weight: 26, payout: 150 },    // Nice win
  { id: 'grape', weight: 15, payout: 350 },     // Big win
  { id: 'bell', weight: 10, payout: 750 },      // Rare jackpot
  { id: 'bar', weight: 7, payout: 1500 },       // Very rare jackpot
  { id: 'seven', weight: 4, payout: 5000 }      // Legendary jackpot
];

const COST_PER_LINE = 10;
const LOAN_AMOUNT = 1000;
const LOAN_INTEREST_RATE = 0.75; // 75% interest
const LOAN_DUE_TIME = 24 * 60 * 60 * 1000; // 24 hours
const MIN_COINS_AFTER_COLLECTION = 250; // Don't leave player at 0

let _io = null;

// Per-user transaction locks to prevent race conditions
const userLocks = new Map();

// ==================== INITIALIZATION ====================
function init(io) {
  _io = io;
  console.log('Slots handler initialized');
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Check and collect due loans (24h+ old)
 * Returns collection info for popup, or null if nothing to collect
 */
function collectDueLoans(user, saveUser, username) {
  // Migration: if user has debt but no loanHistory, create entries with timestamp 0
  // This makes all old debts immediately due
  if ((!user.loanHistory || user.loanHistory.length === 0) && (user.debt ?? 0) > 0) {
    user.loanHistory = [];
    for (let i = 0; i < user.debt; i++) {
      user.loanHistory.push({ amount: LOAN_AMOUNT, takenAt: 0 });
    }
    console.log(`[LOANS] Migrated ${user.debt} old loans for ${username}`);
  }

  if (!user.loanHistory || user.loanHistory.length === 0) {
    return null;
  }

  // All loans are collected immediately (no 24h wait)
  const dueLoans = [...user.loanHistory];
  const remainingLoans = [];

  if (dueLoans.length === 0) {
    return null;
  }

  // Calculate total with interest
  const totalPrincipal = dueLoans.length * LOAN_AMOUNT;
  const totalInterest = Math.floor(totalPrincipal * LOAN_INTEREST_RATE);
  const totalDue = totalPrincipal + totalInterest;

  // Determine actual deduction based on player's coins
  // Always leave player with at least 250 coins, but clear ALL debt
  let actualDeduction = 0;
  const currentCoins = user.coins ?? 0;

  if (currentCoins <= MIN_COINS_AFTER_COLLECTION) {
    // Already at or below minimum - no deduction, but still clear debt
    actualDeduction = 0;
    user.coins = MIN_COINS_AFTER_COLLECTION;
  } else {
    // Deduct as much as possible while leaving 250 minimum
    actualDeduction = Math.min(totalDue, currentCoins - MIN_COINS_AFTER_COLLECTION);
    user.coins = Math.max(MIN_COINS_AFTER_COLLECTION, currentCoins - totalDue);
  }

  // Clear ALL debt when collection happens (even loans not yet due)
  const totalLoansCleared = dueLoans.length + remainingLoans.length;
  user.loanHistory = [];
  user.debt = 0;
  user.paidLoansCount = (user.paidLoansCount ?? 0) + totalLoansCleared;

  // Save changes
  saveUser(username);

  // Invalidate leaderboard cache so paid loans show up
  invalidateLeaderboardCache();

  console.log(`[LOANS] ${username} collected ${dueLoans.length} loans: ${totalDue} due, ${actualDeduction} deducted, ${user.coins} remaining`);

  return {
    loansCollected: dueLoans.length,
    totalPrincipal,
    totalInterest,
    totalDue,
    actualDeduction,
    newBalance: user.coins,
    hadEnoughMoney: currentCoins >= 1000
  };
}

const BONUS_CHANCE = 0.15; // 15% chance of guaranteed win for players with <=2500 coins
const BONUS_SYMBOL_WEIGHTS = [
  { id: 'cherry', weight: 35 },
  { id: 'lemon', weight: 30 },
  { id: 'orange', weight: 25 },
  { id: 'grape', weight: 16 },
  { id: 'bell', weight: 12 },
  { id: 'bar', weight: 8 },
  { id: 'seven', weight: 5 }
];

function getRandomSymbol() {
  const totalWeight = SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;

  for (const symbol of SYMBOLS) {
    random -= symbol.weight;
    if (random <= 0) return symbol.id;
  }
  return SYMBOLS[0].id;
}

function getRandomWinningSymbol() {
  const totalWeight = BONUS_SYMBOL_WEIGHTS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;

  for (const symbol of BONUS_SYMBOL_WEIGHTS) {
    random -= symbol.weight;
    if (random <= 0) return symbol.id;
  }
  return 'cherry';
}

/**
 * Get bonus chance based on player's coin balance
 * Players with <=2500 coins get 9% bonus chance
 * Players with >2500 coins get 0% bonus - rely on natural symbol matches only
 */
function getBonusChance(playerCoins) {
  if (playerCoins <= 2500) {
    return BONUS_CHANCE; // 9% for players with <=2500 coins
  }
  return 0; // 0% bonus for rich players - natural odds only
}

function generateReels(numLines, playerCoins = 0) {
  const bonusChance = getBonusChance(playerCoins);
  const shouldBonus = Math.random() < bonusChance;
  if (shouldBonus) {
    return generateBonusReels(numLines);
  }

  const reels = [];
  for (let col = 0; col < 3; col++) {
    const column = [];
    for (let row = 0; row < 3; row++) {
      column.push(getRandomSymbol());
    }
    reels.push(column);
  }
  return reels;
}

function generateBonusReels(numLines) {
  const winningSymbol = getRandomWinningSymbol();

  // Pick which line to win on (0 = top, 1 = middle, 2 = bottom, 3 = diag1, 4 = diag2)
  const maxLine = numLines === 1 ? 0 : (numLines === 3 ? 2 : 4);
  const winningLine = Math.floor(Math.random() * (maxLine + 1));

  // Initialize reels with random symbols
  const reels = [];
  for (let col = 0; col < 3; col++) {
    const column = [];
    for (let row = 0; row < 3; row++) {
      column.push(getRandomSymbol());
    }
    reels.push(column);
  }

  const linePatterns = [
    [0, 0, 0],  // Top row
    [1, 1, 1],  // Middle row
    [2, 2, 2],  // Bottom row
    [0, 1, 2],  // Diagonal top-left to bottom-right
    [2, 1, 0]   // Diagonal bottom-left to top-right
  ];

  // For 1 line mode, only middle row is active
  const pattern = numLines === 1 ? linePatterns[1] : linePatterns[winningLine];

  // Set winning symbols on the pattern
  reels[0][pattern[0]] = winningSymbol;
  reels[1][pattern[1]] = winningSymbol;
  reels[2][pattern[2]] = winningSymbol;

  return reels;
}

function checkWin(reels, numLines) {
  let totalWin = 0;
  const winningLines = [];

  // Define payline patterns (row indices for each column)
  // Pattern format: [row for col 0, row for col 1, row for col 2]
  const linePatterns = {
    1: [
      [1, 1, 1]  // Middle row only
    ],
    3: [
      [0, 0, 0],  // Top row
      [1, 1, 1],  // Middle row
      [2, 2, 2]   // Bottom row
    ],
    5: [
      [0, 0, 0],  // Top row
      [1, 1, 1],  // Middle row
      [2, 2, 2],  // Bottom row
      [0, 1, 2],  // Diagonal top-left to bottom-right
      [2, 1, 0]   // Diagonal bottom-left to top-right
    ]
  };

  const patterns = linePatterns[numLines] || linePatterns[1];

  patterns.forEach((pattern, lineIndex) => {
    // Get symbols at each position for this payline
    const symbols = [
      reels[0][pattern[0]],
      reels[1][pattern[1]],
      reels[2][pattern[2]]
    ];

    // Check if all three symbols match
    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
      const symbolData = SYMBOLS.find(s => s.id === symbols[0]);
      if (symbolData) {
        // Flat payout value (not multiplied)
        const linePayout = symbolData.payout;
        totalWin += linePayout;
        winningLines.push({
          lineIndex,
          pattern,
          symbol: symbols[0],
          payout: linePayout
        });
      }
    }
  });

  return { totalWin, winningLines };
}

// ==================== SOCKET HANDLERS ====================
function setupHandlers(io, socket, context) {
  const { getUser, saveUser, getLoggedInUsername } = context;

  // Get current coins balance
  socket.on('slotsGetBalance', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('slotsBalance', { coins: 0, debt: 0 });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('slotsBalance', { coins: 0, debt: 0 });
      return;
    }

    socket.emit('slotsBalance', {
      coins: user.coins ?? 1000,
      debt: user.debt ?? 0
    });
  });

  // Spin the slot machine
  socket.on('slotsSpin', ({ numLines }) => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('slotsError', { message: 'Not logged in' });
      return;
    }

    // Prevent race condition - check if user is already in a transaction
    if (userLocks.get(username)) {
      socket.emit('slotsError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('slotsError', { message: 'User not found' });
      return;
    }

    // Validate numLines
    if (![1, 3, 5].includes(numLines)) {
      socket.emit('slotsError', { message: 'Invalid number of lines' });
      return;
    }

    const cost = numLines * COST_PER_LINE;

    // Check if user has enough coins
    if ((user.coins ?? 0) < cost) {
      socket.emit('slotsInsufficientFunds', {
        coins: user.coins ?? 0,
        required: cost
      });
      return;
    }

    // Lock user during transaction
    userLocks.set(username, true);

    try {
      // Get balance BEFORE bet for odds calculation (rich players get worse odds)
      const balanceBeforeBet = user.coins ?? 1000;

      // Deduct cost
      user.coins = balanceBeforeBet - cost;

      const reels = generateReels(numLines, balanceBeforeBet);
      const { totalWin, winningLines } = checkWin(reels, numLines);

      // Add winnings
      user.coins += totalWin;

      // Save to database
      saveUser(username);

      // Send result
      socket.emit('slotsResult', {
        reels,
        winningLines,
        totalWin,
        coins: user.coins,
        cost
      });

      if (totalWin > 0) {
        console.log(`[SLOTS] ${username} won ${totalWin} $qr (bet ${cost} on ${numLines} lines)`);
      }
    } finally {
      // Always release lock
      userLocks.delete(username);
    }
  });

  // Request loan from Benjamin Netanyahu
  socket.on('slotsRequestLoan', ({ numLines, requiredAmount } = {}) => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('slotsError', { message: 'Not logged in' });
      return;
    }

    // Prevent race condition
    if (userLocks.get(username)) {
      socket.emit('slotsError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('slotsError', { message: 'User not found' });
      return;
    }

    // Calculate required cost: use explicit amount if provided (for stacking), else slots lines
    let requiredCost;
    if (typeof requiredAmount === 'number' && requiredAmount > 0) {
      requiredCost = requiredAmount;
    } else {
      const lines = [1, 3, 5].includes(numLines) ? numLines : 1;
      requiredCost = lines * COST_PER_LINE;
    }

    // Allow loan if user can't afford their current bet
    if ((user.coins ?? 0) >= requiredCost) {
      socket.emit('slotsError', { message: 'You still have enough coins!' });
      return;
    }

    // Lock user during transaction
    userLocks.set(username, true);

    try {
      // Give loan and increment debt (add to existing coins)
      user.coins = (user.coins ?? 0) + LOAN_AMOUNT;
      user.debt = (user.debt ?? 0) + 1;

      // Track loan with timestamp for collection later
      if (!user.loanHistory) user.loanHistory = [];
      user.loanHistory.push({
        amount: LOAN_AMOUNT,
        takenAt: Date.now()
      });

      saveUser(username);

      socket.emit('slotsLoanReceived', {
        coins: user.coins,
        debt: user.debt,
        amount: LOAN_AMOUNT
      });

      console.log(`[SLOTS] ${username} took loan #${user.debt} from Benjamin Netanyahu`);
    } finally {
      userLocks.delete(username);
    }
  });

  // Check for due loans when opening gamba games
  socket.on('checkDueLoans', () => {
    const username = getLoggedInUsername();
    if (!username) return;

    const user = getUser(username);
    if (!user) return;

    const collectionResult = collectDueLoans(user, saveUser, username);
    if (collectionResult) {
      socket.emit('loanCollectionNotice', collectionResult);
    }
  });

  // Cleanup function
  return {
    handleDisconnect: () => {
      // No cleanup needed for slot machine
    }
  };
}

module.exports = {
  init,
  setupHandlers,
  SYMBOLS,
  COST_PER_LINE,
  LOAN_AMOUNT,
  LOAN_INTEREST_RATE,
  collectDueLoans
};
