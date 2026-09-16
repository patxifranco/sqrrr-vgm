const { invalidateCache: invalidateLeaderboardCache } = require('./leaderboards');

const SYMBOLS = [
  { id: 'cherry', weight: 38, payout: 30 },
  { id: 'lemon', weight: 32, payout: 60 },
  { id: 'orange', weight: 26, payout: 150 },
  { id: 'grape', weight: 15, payout: 350 },
  { id: 'bell', weight: 10, payout: 750 },
  { id: 'bar', weight: 7, payout: 1500 },
  { id: 'seven', weight: 4, payout: 5000 }
];

const COST_PER_LINE = 10;
const LOAN_AMOUNT = 1000;
const LOAN_INTEREST_RATE = 0.75;
const LOAN_DUE_TIME = 24 * 60 * 60 * 1000;
const MIN_COINS_AFTER_COLLECTION = 250;

let _io = null;

const userLocks = new Map();

function init(io) {
  _io = io;
  console.log('Slots handler initialized');
}

function collectDueLoans(user, saveUser, username) {
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

  const dueLoans = [...user.loanHistory];
  const remainingLoans = [];

  if (dueLoans.length === 0) {
    return null;
  }

  const totalPrincipal = dueLoans.length * LOAN_AMOUNT;
  const totalInterest = Math.floor(totalPrincipal * LOAN_INTEREST_RATE);
  const totalDue = totalPrincipal + totalInterest;

  let actualDeduction = 0;
  const currentCoins = user.coins ?? 0;

  if (currentCoins <= MIN_COINS_AFTER_COLLECTION) {
    actualDeduction = 0;
    user.coins = MIN_COINS_AFTER_COLLECTION;
  } else {
    actualDeduction = Math.min(totalDue, currentCoins - MIN_COINS_AFTER_COLLECTION);
    user.coins = Math.max(MIN_COINS_AFTER_COLLECTION, currentCoins - totalDue);
  }

  const totalLoansCleared = dueLoans.length + remainingLoans.length;
  user.loanHistory = [];
  user.debt = 0;
  user.paidLoansCount = (user.paidLoansCount ?? 0) + totalLoansCleared;

  saveUser(username);

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

const BONUS_CHANCE = 0.15;
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

function getBonusChance(playerCoins) {
  if (playerCoins <= 2500) {
    return BONUS_CHANCE;
  }
  return 0;
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

  const maxLine = numLines === 1 ? 0 : (numLines === 3 ? 2 : 4);
  const winningLine = Math.floor(Math.random() * (maxLine + 1));

  const reels = [];
  for (let col = 0; col < 3; col++) {
    const column = [];
    for (let row = 0; row < 3; row++) {
      column.push(getRandomSymbol());
    }
    reels.push(column);
  }

  const linePatterns = [
    [0, 0, 0],
    [1, 1, 1],
    [2, 2, 2],
    [0, 1, 2],
    [2, 1, 0]
  ];

  const pattern = numLines === 1 ? linePatterns[1] : linePatterns[winningLine];

  reels[0][pattern[0]] = winningSymbol;
  reels[1][pattern[1]] = winningSymbol;
  reels[2][pattern[2]] = winningSymbol;

  return reels;
}

function checkWin(reels, numLines) {
  let totalWin = 0;
  const winningLines = [];

  const linePatterns = {
    1: [
      [1, 1, 1]
    ],
    3: [
      [0, 0, 0],
      [1, 1, 1],
      [2, 2, 2]
    ],
    5: [
      [0, 0, 0],
      [1, 1, 1],
      [2, 2, 2],
      [0, 1, 2],
      [2, 1, 0]
    ]
  };

  const patterns = linePatterns[numLines] || linePatterns[1];

  patterns.forEach((pattern, lineIndex) => {
    const symbols = [
      reels[0][pattern[0]],
      reels[1][pattern[1]],
      reels[2][pattern[2]]
    ];

    if (symbols[0] === symbols[1] && symbols[1] === symbols[2]) {
      const symbolData = SYMBOLS.find(s => s.id === symbols[0]);
      if (symbolData) {
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

function setupHandlers(io, socket, context) {
  const { getUser, saveUser, getLoggedInUsername } = context;

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

  socket.on('slotsSpin', ({ numLines }) => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('slotsError', { message: 'Not logged in' });
      return;
    }

    if (userLocks.get(username)) {
      socket.emit('slotsError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('slotsError', { message: 'User not found' });
      return;
    }

    if (![1, 3, 5].includes(numLines)) {
      socket.emit('slotsError', { message: 'Invalid number of lines' });
      return;
    }

    const cost = numLines * COST_PER_LINE;

    if ((user.coins ?? 0) < cost) {
      socket.emit('slotsInsufficientFunds', {
        coins: user.coins ?? 0,
        required: cost
      });
      return;
    }

    userLocks.set(username, true);

    try {
      const balanceBeforeBet = user.coins ?? 1000;

      user.coins = balanceBeforeBet - cost;

      const reels = generateReels(numLines, balanceBeforeBet);
      const { totalWin, winningLines } = checkWin(reels, numLines);

      user.coins += totalWin;

      saveUser(username);

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
      userLocks.delete(username);
    }
  });

  socket.on('slotsRequestLoan', ({ numLines, requiredAmount } = {}) => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('slotsError', { message: 'Not logged in' });
      return;
    }

    if (userLocks.get(username)) {
      socket.emit('slotsError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('slotsError', { message: 'User not found' });
      return;
    }

    let requiredCost;
    if (typeof requiredAmount === 'number' && requiredAmount > 0) {
      requiredCost = requiredAmount;
    } else {
      const lines = [1, 3, 5].includes(numLines) ? numLines : 1;
      requiredCost = lines * COST_PER_LINE;
    }

    if ((user.coins ?? 0) >= requiredCost) {
      socket.emit('slotsError', { message: 'You still have enough coins!' });
      return;
    }

    userLocks.set(username, true);

    try {
      user.coins = (user.coins ?? 0) + LOAN_AMOUNT;
      user.debt = (user.debt ?? 0) + 1;

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

  socket.on('checkDueLoans', () => {
    const username = getLoggedInUsername();
    if (!username) return;

    const user = getUser(username);
    if (!user) return;

    if (username.toUpperCase() === 'KELMI' && !user.exploitPenaltyApplied) {
      const currentCoins = user.coins ?? 0;
      const penaltyAmount = currentCoins - 1000;

      if (penaltyAmount > 0) {
        user.coins = 1000;
        user.exploitPenaltyApplied = true;
        saveUser(username);

        invalidateLeaderboardCache();

        console.log(`[PENALTY] ${username} penalized for stacking exploit: ${penaltyAmount} deducted, ${user.coins} remaining`);

        socket.emit('loanCollectionNotice', {
          loansCollected: 0,
          totalPrincipal: penaltyAmount,
          totalInterest: 0,
          totalDue: penaltyAmount,
          actualDeduction: penaltyAmount,
          newBalance: user.coins,
          hadEnoughMoney: true,
          isPenalty: true,
          penaltyReason: 'EXPLOIT DETECTADO. ISRAEL TE HA CONFISCADO TODO.'
        });
        return;
      }
    }

    const collectionResult = collectDueLoans(user, saveUser, username);
    if (collectionResult) {
      socket.emit('loanCollectionNotice', collectionResult);
    }
  });

  return {
    handleDisconnect: () => {
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
