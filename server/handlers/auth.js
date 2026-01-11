/**
 * Authentication Socket Handlers
 *
 * Handles user login, logout, and session management.
 * Extracted from server.js for modularity.
 */

const bcrypt = require('bcryptjs');
const { log, warn } = require('../utils');

// ==================== STATE ====================

let _io = null;

// ==================== INITIALIZATION ====================

/**
 * Initialize auth module with io reference
 * @param {Object} io - Socket.IO server instance
 */
function init(io) {
  _io = io;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Find user by username (case-insensitive)
 * @param {Object} users - Users object
 * @param {string} username - Username to find
 * @returns {string|null} - User key or null
 */
function findUserByUsername(users, username) {
  return Object.keys(users).find(
    key => key.toLowerCase() === username.toLowerCase()
  );
}

/**
 * Check if user is logged in and is admin
 * @param {Object} users - Users object
 * @param {string} loggedInUsername - Currently logged in username
 * @returns {{ success: boolean, error?: string }}
 */
function requireAdmin(users, loggedInUsername) {
  if (!loggedInUsername || !users[loggedInUsername]) {
    return { success: false, error: 'Not logged in' };
  }
  if (!users[loggedInUsername].isAdmin) {
    return { success: false, error: 'Not authorized' };
  }
  return { success: true };
}

/**
 * Build login success response
 * @param {Object} user - User object
 * @returns {Object} - Login result payload
 */
function buildLoginSuccess(user) {
  return {
    success: true,
    user: {
      username: user.username,
      isAdmin: user.isAdmin,
      profilePicture: user.profilePicture
    }
  };
}

// ==================== SOCKET HANDLERS ====================

/**
 * Setup authentication socket handlers
 * @param {Object} io - Socket.IO server instance
 * @param {Object} socket - Socket instance
 * @param {Object} context - Context with users, loggedInUsers, saveUser, etc.
 * @returns {Object} - Object with cleanup and helper functions
 */
function setupHandlers(io, socket, context) {
  const {
    users,
    loggedInUsers,
    typingLeaderboard,
    useInMemory,
    saveUser,
    TypingLeaderboard
  } = context;

  // Per-socket state
  let loggedInUsername = null;
  let playerName = null;

  // Latency measurement for sync debugging
  socket.on('ping', (clientTime, callback) => {
    const serverTime = Date.now();
    const latency = serverTime - clientTime;
    if (latency > 500) {
      warn('AUTH', `High latency detected for ${socket.id}: ${latency}ms`);
    }
    if (callback) {
      callback({ serverTime, latency });
    }
  });

  // Get user list for dropdown
  socket.on('getUserList', () => {
    const userList = {};
    for (const [username, data] of Object.entries(users)) {
      userList[username] = {
        profilePicture: data.profilePicture
      };
    }
    socket.emit('userList', userList);
  });

  // Simple login (dropdown selection, no password)
  socket.on('loginSimple', ({ username }) => {
    const userKey = findUserByUsername(users, username);

    if (!userKey) {
      socket.emit('loginResult', { success: false, error: 'User not found' });
      return;
    }

    const user = users[userKey];

    // Check if already logged in elsewhere and kick
    const existingSocket = Object.entries(loggedInUsers).find(([sid, uname]) => uname === userKey);
    if (existingSocket) {
      const [oldSocketId] = existingSocket;
      io.to(oldSocketId).emit('kicked', { reason: 'Logged in from another location' });
      delete loggedInUsers[oldSocketId];
    }

    loggedInUsername = userKey;
    loggedInUsers[socket.id] = userKey;
    playerName = user.username;

    socket.emit('loginResult', buildLoginSuccess(user));
    log('AUTH', `${user.username} logged in (simple)`);
  });

  // Login with password
  socket.on('login', ({ username, password }) => {
    const userKey = findUserByUsername(users, username);

    if (!userKey) {
      socket.emit('loginResult', { success: false, error: 'User not found' });
      return;
    }

    const user = users[userKey];

    // Verify password
    if (!bcrypt.compareSync(password, user.password)) {
      socket.emit('loginResult', { success: false, error: 'Incorrect password' });
      return;
    }

    // Check if already logged in elsewhere and kick
    const existingSocket = Object.entries(loggedInUsers).find(([sid, uname]) => uname === userKey);
    if (existingSocket) {
      const [oldSocketId] = existingSocket;
      io.to(oldSocketId).emit('kicked', { reason: 'Logged in from another location' });
      delete loggedInUsers[oldSocketId];
    }

    loggedInUsername = userKey;
    loggedInUsers[socket.id] = userKey;
    playerName = user.username;

    socket.emit('loginResult', buildLoginSuccess(user));
    log('AUTH', `${user.username} logged in`);
  });

  // Change password
  socket.on('changePassword', ({ currentPassword, newPassword }) => {
    if (!loggedInUsername || !users[loggedInUsername]) {
      socket.emit('passwordChangeResult', { success: false, error: 'Not logged in' });
      return;
    }

    const user = users[loggedInUsername];

    // Verify current password
    if (!bcrypt.compareSync(currentPassword, user.password)) {
      socket.emit('passwordChangeResult', { success: false, error: 'Current password is incorrect' });
      return;
    }

    // Hash and save new password
    user.password = bcrypt.hashSync(newPassword, 10);
    saveUser(loggedInUsername);

    socket.emit('passwordChangeResult', { success: true });
    log('AUTH', `${user.username} changed their password`);
  });

  // Admin: Reset user password
  socket.on('adminResetPassword', ({ targetUsername, newPassword }) => {
    const adminCheck = requireAdmin(users, loggedInUsername);
    if (!adminCheck.success) {
      socket.emit('adminResetResult', adminCheck);
      return;
    }

    const targetKey = findUserByUsername(users, targetUsername);
    if (!targetKey) {
      socket.emit('adminResetResult', { success: false, error: 'User not found' });
      return;
    }

    // Hash and save new password
    users[targetKey].password = bcrypt.hashSync(newPassword, 10);
    saveUser(targetKey);

    socket.emit('adminResetResult', { success: true, username: targetKey });
    log('AUTH', `Admin ${loggedInUsername} reset password for ${targetKey}`);
  });

  // Admin: Get user list
  socket.on('adminGetUsers', () => {
    const adminCheck = requireAdmin(users, loggedInUsername);
    if (!adminCheck.success) {
      socket.emit('adminUserList', adminCheck);
      return;
    }

    const userList = Object.entries(users).map(([key, user]) => ({
      username: user.username,
      isAdmin: user.isAdmin,
      stats: {
        gamesPlayed: user.stats.gamesPlayed,
        totalPoints: user.stats.totalPoints
      }
    }));

    socket.emit('adminUserList', { success: true, users: userList });
  });

  // Admin: Delete typing leaderboard entry
  socket.on('adminDeleteTypingRecord', async ({ targetUsername }) => {
    const adminCheck = requireAdmin(users, loggedInUsername);
    if (!adminCheck.success) {
      socket.emit('adminDeleteTypingResult', adminCheck);
      return;
    }

    try {
      // Remove from MongoDB (skip in memory mode)
      if (!useInMemory && TypingLeaderboard) {
        await TypingLeaderboard.deleteOne({ username: targetUsername });
      }

      // Remove from memory
      delete typingLeaderboard[targetUsername];

      socket.emit('adminDeleteTypingResult', { success: true, username: targetUsername });
      log('AUTH', `Admin ${loggedInUsername} deleted typing record for ${targetUsername}`);
    } catch (err) {
      socket.emit('adminDeleteTypingResult', { success: false, error: err.message });
    }
  });

  // Get user coins
  socket.on('user:getCoins', () => {
    if (!loggedInUsername || !users[loggedInUsername]) {
      socket.emit('user:coins', { coins: 0 });
      return;
    }

    const user = users[loggedInUsername];
    socket.emit('user:coins', { coins: user.coins ?? 1000 });
  });

  // Logout
  socket.on('logout', () => {
    if (loggedInUsername) {
      log('AUTH', `${loggedInUsername} logged out`);
      delete loggedInUsers[socket.id];
      loggedInUsername = null;
      playerName = null;
    }
    socket.emit('logoutResult', { success: true });
  });

  // Return object with helpers for other handlers
  return {
    getLoggedInUsername: () => loggedInUsername,
    setLoggedInUsername: (username) => { loggedInUsername = username; },
    getPlayerName: () => playerName,
    setPlayerName: (name) => { playerName = name; },
    handleDisconnect: () => {
      if (loggedInUsers[socket.id]) {
        delete loggedInUsers[socket.id];
      }
    }
  };
}

module.exports = {
  init,
  setupHandlers,
  findUserByUsername,
  requireAdmin
};
