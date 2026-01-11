/**
 * Profile Socket Handlers
 *
 * Handles user profile viewing and stats.
 * Extracted from server.js for modularity.
 */

// ==================== STATE ====================

let _io = null;

// ==================== INITIALIZATION ====================

/**
 * Initialize profile module with io reference
 * @param {Object} io - Socket.IO server instance
 */
function init(io) {
  _io = io;
}

// ==================== SOCKET HANDLERS ====================

/**
 * Setup profile socket handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket instance
 * @param {Object} context - Context with users, records, getLoggedInUsername, etc.
 */
function setupHandlers(io, socket, context) {
  const { users, records, getLoggedInUsername, getMostGuessedGame } = context;

  // Get own profile data
  socket.on('getProfile', () => {
    const loggedInUsername = getLoggedInUsername();

    if (!loggedInUsername || !users[loggedInUsername]) {
      socket.emit('profileData', { success: false, error: 'Not logged in' });
      return;
    }

    const user = users[loggedInUsername];

    // Get list of all usernames for admin section
    const allUsers = Object.keys(users);

    socket.emit('profileData', {
      user: {
        username: user.username,
        profilePicture: user.profilePicture,
        isAdmin: user.isAdmin,
        stats: {
          gamesPlayed: user.stats.gamesPlayed,
          gamesGuessed: user.stats.gamesGuessed,
          superSonics: user.stats.superSonics,
          hintsUsed: user.stats.hintsUsed,
          totalPoints: user.stats.totalPoints,
          gameHistory: user.stats.gameHistory
        }
      },
      users: user.isAdmin ? allUsers : null
    });
  });

  // Get another player's profile
  socket.on('getPlayerProfile', ({ username }) => {
    if (!username || !users[username]) {
      socket.emit('playerProfileData', { user: null });
      return;
    }

    const user = users[username];

    // Count records held by this player
    let recordsHeld = 0;
    for (const record of Object.values(records)) {
      if (record.player === username) {
        recordsHeld++;
      }
    }

    socket.emit('playerProfileData', {
      user: {
        username: user.username,
        profilePicture: user.profilePicture,
        stats: {
          gamesPlayed: user.stats.gamesPlayed,
          gamesGuessed: user.stats.gamesGuessed,
          superSonics: user.stats.superSonics,
          hintsUsed: user.stats.hintsUsed,
          totalPoints: user.stats.totalPoints,
          gameHistory: user.stats.gameHistory
        }
      },
      recordsHeld
    });
  });
}

module.exports = {
  init,
  setupHandlers
};
