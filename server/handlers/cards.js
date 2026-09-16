const PACK_COST = 2000;
const FREE_CARD_COOLDOWN = 24 * 60 * 60 * 1000;
const TOTAL_CARDS = 49;

let _io = null;

const userLocks = new Map();

function init(io) {
  _io = io;
  console.log('Cards handler initialized');
}

function getRandomCard(userCards = {}) {
  const ownedCards = new Set(Object.keys(userCards).map(Number));

  const missingCards = [];
  for (let i = 1; i <= TOTAL_CARDS; i++) {
    if (!ownedCards.has(i)) {
      missingCards.push(i);
    }
  }

  if (missingCards.length === 0 || Math.random() < 0.45) {
    return Math.floor(Math.random() * TOTAL_CARDS) + 1;
  }

  return missingCards[Math.floor(Math.random() * missingCards.length)];
}

function getFreeCardCooldown(lastFreeCard) {
  if (lastFreeCard == null) return 0;

  const now = Date.now();
  const timeSince = now - lastFreeCard;
  const remaining = FREE_CARD_COOLDOWN - timeSince;

  return Math.max(0, remaining);
}

function countUniqueCards(cards) {
  return Object.keys(cards || {}).length;
}

function setupHandlers(io, socket, context) {
  const { getUser, saveUser, getLoggedInUsername } = context;

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

  socket.on('cardsBuyPack', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('cardsError', { message: 'Not logged in' });
      return;
    }

    if (userLocks.get(username)) {
      socket.emit('cardsError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('cardsError', { message: 'User not found' });
      return;
    }

    if ((user.coins ?? 0) < PACK_COST) {
      socket.emit('cardsInsufficientFunds', {
        coins: user.coins ?? 0,
        required: PACK_COST
      });
      return;
    }

    userLocks.set(username, true);

    try {
      user.coins = (user.coins ?? 1000) - PACK_COST;

      if (!user.cards) user.cards = {};
      const cardId = getRandomCard(user.cards);
      user.cards[cardId] = (user.cards[cardId] || 0) + 1;

      saveUser(username);

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

  socket.on('cardsClaimFree', () => {
    const username = getLoggedInUsername();
    if (!username) {
      socket.emit('cardsError', { message: 'Not logged in' });
      return;
    }

    if (userLocks.get(username)) {
      socket.emit('cardsError', { message: 'Procesando operacion anterior...' });
      return;
    }

    const user = getUser(username);
    if (!user) {
      socket.emit('cardsError', { message: 'User not found' });
      return;
    }

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

    userLocks.set(username, true);

    try {
      if (!user.cards) user.cards = {};
      const cardId = getRandomCard(user.cards);
      user.cards[cardId] = (user.cards[cardId] || 0) + 1;

      const now = Date.now();
      user.lastFreeCard = now;
      console.log(`[CARDS] ${username} lastFreeCard set to ${now}`);

      saveUser(username);

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

  return {
    handleDisconnect: () => {
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
