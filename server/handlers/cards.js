/**
 * Card Pack System Socket Handlers
 *
 * Handles card collection with $qr currency.
 * - Buy packs for 2000 coins (1 random card)
 * - Free card every 24 hours
 * - Track collection with duplicate counts
 */

// ==================== CONSTANTS ====================
const PACK_COST = 2000;
const FREE_CARD_COOLDOWN = 24 * 60 * 60 * 1000; // 24 hours
const TOTAL_CARDS = 49;

let _io = null;

// Per-user transaction locks to prevent race conditions
const userLocks = new Map();

// ==================== INITIALIZATION ====================
function init(io) {
  _io = io;
  console.log('Cards handler initialized');
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Get a random card ID (1-TOTAL_CARDS)
 * Slight favor for cards the user doesn't have yet (55% new, 45% random)
 */
function getRandomCard(userCards = {}) {
  // Get cards the user already has
  const ownedCards = new Set(Object.keys(userCards).map(Number));

  // Get cards the user doesn't have
  const missingCards = [];
  for (let i = 1; i <= TOTAL_CARDS; i++) {
    if (!ownedCards.has(i)) {
      missingCards.push(i);
    }
  }

  // If user has all cards or 45% chance, give random card (allows duplicates)
  if (missingCards.length === 0 || Math.random() < 0.45) {
    return Math.floor(Math.random() * TOTAL_CARDS) + 1;
  }

  // 55% chance: give a card they don't have
  return missingCards[Math.floor(Math.random() * missingCards.length)];
}

/**
 * Calculate time remaining until free card is available
 */
function getFreeCardCooldown(lastFreeCard) {
  // Use explicit null check to avoid treating timestamp 0 as falsy
  if (lastFreeCard == null) return 0;

  const now = Date.now();
  const timeSince = now - lastFreeCard;
  const remaining = FREE_CARD_COOLDOWN - timeSince;

  return Math.max(0, remaining);
}

/**
 * Count unique cards in collection
 */
function countUniqueCards(cards) {
  return Object.keys(cards || {}).length;
}

/**
 * Count total cards (including duplicates)
 */
function countTotalCards(cards) {
  return Object.values(cards || {}).reduce((sum, count) => sum + count, 0);
}

// ==================== SOCKET HANDLERS ====================
function setupHandlers(io, socket, context) {
  const { getUser, saveUser, getLoggedInUsername } = context;

  // Get user's card collection
  socket.on('cardsGetCollection', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('cardsCollection', {
        cards: {},
        coins: 0,
        freeCardCooldown: 0,
        uniqueCount: 0,
        totalCards: TOTAL_CARDS
      });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('cardsCollection', {
        cards: {},
        coins: 0,
        freeCardCooldown: 0,
        uniqueCount: 0,
        totalCards: TOTAL_CARDS
      });
      return;
    }

    const cooldown = getFreeCardCooldown(user.lastFreeCard);
    console.log(`[CARDS] ${username} getCollection: lastFreeCard=${user.lastFreeCard}, cooldown=${cooldown}ms`);

    socket.emit('cardsCollection', {
      cards: user.cards || {},
      coins: user.coins ?? 1000,
      freeCardCooldown: cooldown,
      uniqueCount: countUniqueCards(user.cards),
      totalCards: TOTAL_CARDS
    });
  });

  // Buy a card pack
  socket.on('cardsBuyPack', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('cardsError', { message: 'Not logged in' });
      return;
    }

    // Prevent race condition
    if (userLocks.get(username)) {
      socket.emit('cardsError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('cardsError', { message: 'User not found' });
      return;
    }

    // Check if user has enough coins
    if ((user.coins ?? 0) < PACK_COST) {
      socket.emit('cardsInsufficientFunds', {
        coins: user.coins ?? 0,
        required: PACK_COST
      });
      return;
    }

    // Lock user during transaction
    userLocks.set(username, true);

    try {
      // Deduct cost
      user.coins = (user.coins ?? 1000) - PACK_COST;

      // Give random card (favors new cards)
      if (!user.cards) user.cards = {};
      const cardId = getRandomCard(user.cards);
      user.cards[cardId] = (user.cards[cardId] || 0) + 1;

      // Save to database
      saveUser(username);

      // Send result
      socket.emit('cardsPackOpened', {
        cardId,
        isNew: user.cards[cardId] === 1,
        count: user.cards[cardId],
        coins: user.coins,
        uniqueCount: countUniqueCards(user.cards),
        totalCards: TOTAL_CARDS
      });

      console.log(`[CARDS] ${username} bought pack, got card #${cardId} (${user.cards[cardId]}x)`);
    } finally {
      userLocks.delete(username);
    }
  });

  // Claim free card
  socket.on('cardsClaimFree', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('cardsError', { message: 'Not logged in' });
      return;
    }

    // Prevent race condition - critical for free card claims
    if (userLocks.get(username)) {
      socket.emit('cardsError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('cardsError', { message: 'User not found' });
      return;
    }

    // Check cooldown
    const cooldown = getFreeCardCooldown(user.lastFreeCard);
    console.log(`[CARDS] ${username} requesting free card. lastFreeCard: ${user.lastFreeCard}, cooldown: ${cooldown}ms`);

    if (cooldown > 0) {
      console.log(`[CARDS] ${username} free card on cooldown for ${Math.round(cooldown / 1000 / 60)} more minutes`);
      socket.emit('cardsFreeNotReady', {
        cooldown,
        freeCardCooldown: cooldown
      });
      return;
    }

    // Lock user during transaction
    userLocks.set(username, true);

    try {
      // Give random card (favors new cards)
      if (!user.cards) user.cards = {};
      const cardId = getRandomCard(user.cards);
      user.cards[cardId] = (user.cards[cardId] || 0) + 1;

      // Update last free card timestamp
      const now = Date.now();
      user.lastFreeCard = now;
      console.log(`[CARDS] ${username} lastFreeCard set to ${now}`);

      // Save to database
      saveUser(username);

      // Send result
      socket.emit('cardsFreeOpened', {
        cardId,
        isNew: user.cards[cardId] === 1,
        count: user.cards[cardId],
        freeCardCooldown: FREE_CARD_COOLDOWN,
        uniqueCount: countUniqueCards(user.cards),
        totalCards: TOTAL_CARDS
      });

      console.log(`[CARDS] ${username} claimed free card, got card #${cardId}`);
    } finally {
      userLocks.delete(username);
    }
  });

  // Cleanup function
  return {
    handleDisconnect: () => {
      // No cleanup needed for card system
    }
  };
}

module.exports = {
  init,
  setupHandlers,
  PACK_COST,
  FREE_CARD_COOLDOWN,
  TOTAL_CARDS
};
