const bcrypt = require('bcryptjs');
const { log, warn } = require('../utils');
const { invalidateCache: invalidateLeaderboardCache } = require('./leaderboards');

let _io = null;

function init(io) {
  _io = io;
}

function findUserByUsername(users, username) {
  return Object.keys(users).find(
    key => key.toLowerCase() === username.toLowerCase()
  );
}

function requireAdmin(users, loggedInUsername) {
  if (!loggedInUsername || !users[loggedInUsername]) {
    return { success: false, error: 'Not logged in' };
  }
  if (!users[loggedInUsername].isAdmin) {
    return { success: false, error: 'Not authorized' };
  }
  return { success: true };
}

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

function checkExploitPenalty(socket, user, username, saveUser) {
  if (username.toUpperCase() === 'KELMI' && !user.exploitPenaltyApplied) {
    const currentCoins = user.coins ?? 0;
    const penaltyAmount = currentCoins - 1000;

    if (penaltyAmount > 0) {
      user.coins = 1000;
      user.exploitPenaltyApplied = true;
      saveUser(username);

      invalidateLeaderboardCache();

      log('AUTH', `[PENALTY] ${username} penalized for stacking exploit: ${penaltyAmount} deducted, ${user.coins} remaining`);

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
    }
  }
}

function setupHandlers(io, socket, context) {
  const {
    users,
    loggedInUsers,
    typingLeaderboard,
    useInMemory,
    saveUser,
    TypingLeaderboard
  } = context;

  let loggedInUsername = null;
  let playerName = null;

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

  socket.on('getUserList', () => {
    const userList = {};
    for (const [username, data] of Object.entries(users)) {
      userList[username] = {
        profilePicture: data.profilePicture
      };
    }
    socket.emit('userList', userList);
  });

  socket.on('loginSimple', ({ username }) => {
    const userKey = findUserByUsername(users, username);

    if (!userKey) {
      socket.emit('loginResult', { success: false, error: 'User not found' });
      return;
    }

    const user = users[userKey];

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

    checkExploitPenalty(socket, user, userKey, saveUser);
  });

  socket.on('login', ({ username, password }) => {
    const userKey = findUserByUsername(users, username);

    if (!userKey) {
      socket.emit('loginResult', { success: false, error: 'User not found' });
      return;
    }

    const user = users[userKey];

    if (!bcrypt.compareSync(password, user.password)) {
      socket.emit('loginResult', { success: false, error: 'Incorrect password' });
      return;
    }

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

    checkExploitPenalty(socket, user, userKey, saveUser);
  });

  socket.on('changePassword', ({ currentPassword, newPassword }) => {
    if (!loggedInUsername || !users[loggedInUsername]) {
      socket.emit('passwordChangeResult', { success: false, error: 'Not logged in' });
      return;
    }

    const user = users[loggedInUsername];

    if (!bcrypt.compareSync(currentPassword, user.password)) {
      socket.emit('passwordChangeResult', { success: false, error: 'Current password is incorrect' });
      return;
    }

    user.password = bcrypt.hashSync(newPassword, 10);
    saveUser(loggedInUsername);

    socket.emit('passwordChangeResult', { success: true });
    log('AUTH', `${user.username} changed their password`);
  });

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

    users[targetKey].password = bcrypt.hashSync(newPassword, 10);
    saveUser(targetKey);

    socket.emit('adminResetResult', { success: true, username: targetKey });
    log('AUTH', `Admin ${loggedInUsername} reset password for ${targetKey}`);
  });

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

  socket.on('adminDeleteTypingRecord', async ({ targetUsername }) => {
    const adminCheck = requireAdmin(users, loggedInUsername);
    if (!adminCheck.success) {
      socket.emit('adminDeleteTypingResult', adminCheck);
      return;
    }

    try {
      if (!useInMemory && TypingLeaderboard) {
        await TypingLeaderboard.deleteOne({ username: targetUsername });
      }

      delete typingLeaderboard[targetUsername];

      socket.emit('adminDeleteTypingResult', { success: true, username: targetUsername });
      log('AUTH', `Admin ${loggedInUsername} deleted typing record for ${targetUsername}`);
    } catch (err) {
      socket.emit('adminDeleteTypingResult', { success: false, error: err.message });
    }
  });

  socket.on('user:getCoins', () => {
    if (!loggedInUsername || !users[loggedInUsername]) {
      socket.emit('user:coins', { coins: 0 });
      return;
    }

    const user = users[loggedInUsername];
    socket.emit('user:coins', { coins: user.coins ?? 1000 });
  });

  socket.on('logout', () => {
    if (loggedInUsername) {
      log('AUTH', `${loggedInUsername} logged out`);
      delete loggedInUsers[socket.id];
      loggedInUsername = null;
      playerName = null;
    }
    socket.emit('logoutResult', { success: true });
  });

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
