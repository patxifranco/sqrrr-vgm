/**
 * Leaderboard Socket Handlers
 *
 * Handles leaderboard data with caching for performance.
 * Extracted from server.js for modularity.
 */

const { log } = require('../utils');

// ==================== STATE ====================

let _io = null;

// Leaderboard cache
const CACHE_TTL_MS = 30000; // 30 seconds
let leaderboardCache = null;
let cacheTimestamp = 0;

// ==================== INITIALIZATION ====================

/**
 * Initialize leaderboards module with io reference
 * @param {Object} io - Socket.IO server instance
 */
function init(io) {
  _io = io;
}

/**
 * Invalidate the leaderboard cache
 * Call this when user stats, records, or coins change
 */
function invalidateCache() {
  leaderboardCache = null;
  cacheTimestamp = 0;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Build a single leaderboard from source data
 * @param {Object} source - Source data (users, records, etc.)
 * @param {Function} transform - Transform function (key, data) => entry
 * @param {Function} filter - Filter function (entry) => boolean
 * @param {string} sortKey - Key to sort by (descending)
 * @returns {Array} - Sorted leaderboard entries
 */
function buildLeaderboard(source, transform, filter = () => true, sortKey = 'value') {
  return Object.entries(source)
    .map(([key, data]) => transform(key, data))
    .filter(filter)
    .sort((a, b) => b[sortKey] - a[sortKey]);
}

/**
 * Build all leaderboards (with caching)
 * @param {Object} users - Users data
 * @param {Object} records - VGM records data
 * @param {Object} typingLeaderboard - Typing scores data
 * @returns {Object} - All leaderboard data
 */
function buildAllLeaderboards(users, records, typingLeaderboard) {
  const now = Date.now();

  // Return cached version if fresh
  if (leaderboardCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return leaderboardCache;
  }

  // VGM Guesses leaderboard
  const vgmGuesses = buildLeaderboard(
    users,
    (username, data) => ({
      username,
      profilePicture: data.profilePicture,
      value: data.stats?.gamesGuessed || 0
    }),
    entry => entry.value > 0
  );

  // VGM Records leaderboard (count records per player)
  const recordCounts = {};
  for (const record of Object.values(records)) {
    if (record.player) {
      recordCounts[record.player] = (recordCounts[record.player] || 0) + 1;
    }
  }

  const vgmRecords = buildLeaderboard(
    recordCounts,
    (username, count) => ({
      username,
      profilePicture: users[username]?.profilePicture || 'profiles/default.svg',
      value: count
    }),
    entry => entry.value > 0
  );

  // Typing WPM leaderboard
  const typingWpm = buildLeaderboard(
    typingLeaderboard,
    (username, data) => ({
      username,
      profilePicture: data.profilePicture || users[username]?.profilePicture || 'profiles/default.svg',
      value: data.bestScore || Math.round((data.bestWpm || 0) * (data.bestAccuracy || 0) / 100),
      score: data.bestScore || Math.round((data.bestWpm || 0) * (data.bestAccuracy || 0) / 100),
      wpm: data.bestWpm || 0,
      accuracy: data.bestAccuracy || 0
    }),
    entry => entry.wpm > 0
  );

  // Gamba Coins leaderboard
  const gambaCoins = buildLeaderboard(
    users,
    (username, data) => ({
      username,
      profilePicture: data.profilePicture,
      value: data.coins ?? 0,
      coins: data.coins ?? 0
    }),
    entry => entry.value > 0
  );

  // Gamba Debt leaderboard (includes paid loans count)
  const gambaDebt = buildLeaderboard(
    users,
    (username, data) => ({
      username,
      profilePicture: data.profilePicture,
      value: data.debt ?? 0,
      debt: data.debt ?? 0,
      paidLoansCount: data.paidLoansCount ?? 0
    }),
    entry => entry.value > 0 || entry.paidLoansCount > 0
  );

  // SQRRRDLE leaderboard (words guessed + total tries as tiebreaker)
  const sqrrrdle = Object.entries(users)
    .map(([username, data]) => ({
      username,
      profilePicture: data.profilePicture,
      value: data.sqrrrdle?.wordsGuessed ?? 0,
      wordsGuessed: data.sqrrrdle?.wordsGuessed ?? 0,
      totalTries: data.sqrrrdle?.totalTries ?? 0
    }))
    .filter(entry => entry.wordsGuessed > 0)
    .sort((a, b) => {
      if (b.wordsGuessed !== a.wordsGuessed) {
        return b.wordsGuessed - a.wordsGuessed;
      }
      return a.totalTries - b.totalTries;
    });

  // Cache the results
  leaderboardCache = {
    vgmGuesses,
    vgmRecords,
    typingWpm,
    gambaCoins,
    gambaDebt,
    sqrrrdle
  };
  cacheTimestamp = now;

  return leaderboardCache;
}

// ==================== SOCKET HANDLERS ====================

/**
 * Setup leaderboard socket handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket instance
 * @param {Object} context - Context with users, records, typingLeaderboard
 */
function setupHandlers(io, socket, context) {
  const { users, records, typingLeaderboard } = context;

  socket.on('getLeaderboards', () => {
    const leaderboards = buildAllLeaderboards(users, records, typingLeaderboard);
    socket.emit('leaderboardData', leaderboards);
  });
}

module.exports = {
  init,
  setupHandlers,
  invalidateCache,
  buildAllLeaderboards
};
