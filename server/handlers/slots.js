/**
 * Slot Machine Game Socket Handlers
 *
 * Handles slot machine game logic with $qr currency.
 */

// ==================== CONSTANTS ====================
// Flat payout values (not multipliers)
const SYMBOLS = [
  { id: 'cherry', weight: 30, payout: 50 },     // Common - 50 $qr
  { id: 'lemon', weight: 25, payout: 100 },     // 100 $qr
  { id: 'orange', weight: 20, payout: 150 },    // 150 $qr
  { id: 'grape', weight: 12, payout: 200 },     // 200 $qr
  { id: 'bell', weight: 8, payout: 250 },       // 250 $qr
  { id: 'bar', weight: 4, payout: 300 },        // Rare - 300 $qr
  { id: 'seven', weight: 1, payout: 350 }       // Legendary - 350 $qr
];

const COST_PER_LINE = 10;
const LOAN_AMOUNT = 1000;

let _io = null;

// ==================== INITIALIZATION ====================
function init(io) {
  _io = io;
  console.log('Slots handler initialized');
}

// ==================== HELPER FUNCTIONS ====================

// Rigging configuration - makes players win more often
const WIN_BOOST_CHANCE = 0.35;  // 35% chance to force a win
const SYMBOL_WEIGHTS_FOR_FORCED_WIN = [
  { id: 'cherry', weight: 35 },   // Most common forced win
  { id: 'lemon', weight: 28 },
  { id: 'orange', weight: 20 },
  { id: 'grape', weight: 10 },
  { id: 'bell', weight: 4 },
  { id: 'bar', weight: 2 },
  { id: 'seven', weight: 1 }      // Rare jackpot
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
  // Pick a symbol for forced wins (weighted towards common symbols)
  const totalWeight = SYMBOL_WEIGHTS_FOR_FORCED_WIN.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.random() * totalWeight;

  for (const symbol of SYMBOL_WEIGHTS_FOR_FORCED_WIN) {
    random -= symbol.weight;
    if (random <= 0) return symbol.id;
  }
  return 'cherry';
}

function generateReels(numLines) {
  // Check if we should force a win (rigged mode)
  const shouldForceWin = Math.random() < WIN_BOOST_CHANCE;

  if (shouldForceWin) {
    return generateRiggedReels(numLines);
  }

  // Normal random generation
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

function generateRiggedReels(numLines) {
  // Generate reels with at least one winning line
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

  // Force the winning combination on the selected line
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

    // Deduct cost
    user.coins = (user.coins ?? 1000) - cost;

    // Generate result (rigged to favor players ~35% of the time)
    const reels = generateReels(numLines);
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
  });

  // Request loan from Benjamin Netanyahu
  socket.on('slotsRequestLoan', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('slotsError', { message: 'Not logged in' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('slotsError', { message: 'User not found' });
      return;
    }

    // Allow loan if user can't afford minimum bet (10 for 1 line)
    if ((user.coins ?? 0) >= COST_PER_LINE) {
      socket.emit('slotsError', { message: 'You still have enough coins!' });
      return;
    }

    // Give loan and increment debt (add to existing coins)
    user.coins = (user.coins ?? 0) + LOAN_AMOUNT;
    user.debt = (user.debt ?? 0) + 1;

    saveUser(username);

    socket.emit('slotsLoanReceived', {
      coins: user.coins,
      debt: user.debt,
      amount: LOAN_AMOUNT
    });

    console.log(`[SLOTS] ${username} took loan #${user.debt} from Benjamin Netanyahu`);
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
  LOAN_AMOUNT
};
