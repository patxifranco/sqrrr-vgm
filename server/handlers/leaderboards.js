const { log } = require('../utils');

let _io = null;

const CACHE_TTL_MS = 30000;
let leaderboardCache = null;
let cacheTimestamp = 0;

function init(io) {
  _io = io;
}

function invalidateCache() {
  leaderboardCache = null;
  cacheTimestamp = 0;
}

function buildLeaderboard(source, transform, filter = () => true, sortKey = 'value') {
  return Object.entries(source)
    .map(([key, data]) => transform(key, data))
    .filter(filter)
    .sort((a, b) => b[sortKey] - a[sortKey]);
}

function buildAllLeaderboards(users, records, typingLeaderboard) {
  const now = Date.now();

  if (leaderboardCache && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return leaderboardCache;
  }

  const vgmGuesses = buildLeaderboard(
    users,
    (username, data) => ({
      username,
      profilePicture: data.profilePicture,
      value: data.stats?.gamesGuessed || 0
    }),
    entry => entry.value > 0
  );

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
