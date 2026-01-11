/**
 * Server Utilities
 *
 * Shared utility functions for all game handlers.
 */

/**
 * Generate a random room code
 * @param {number} length - Code length (default 4)
 * @returns {string}
 */
function generateRoomCode(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Shuffle an array (Fisher-Yates)
 * @param {Array} array
 * @returns {Array} New shuffled array
 */
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Normalize a string for comparison (lowercase, remove accents)
 * @param {string} str
 * @returns {string}
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Check if a guess matches the target (with aliases support)
 * @param {string} guess
 * @param {string} target
 * @param {string[]} aliases - Optional array of aliases
 * @returns {boolean}
 */
function checkGuess(guess, target, aliases = []) {
  const normalizedGuess = normalizeString(guess);
  const normalizedTarget = normalizeString(target);

  if (normalizedGuess === normalizedTarget) return true;

  for (const alias of aliases) {
    if (normalizedGuess === normalizeString(alias)) return true;
  }

  return false;
}

/**
 * Get current timestamp
 * @returns {number}
 */
function now() {
  return Date.now();
}

/**
 * Create a player object
 * @param {Object} options
 * @returns {Object}
 */
function createPlayer({ id, name, profilePicture, username = null }) {
  return {
    id,
    name,
    profilePicture: profilePicture || 'profiles/default.svg',
    username,
    score: 0,
    joinedAt: now()
  };
}

/**
 * Create a VGM player object with game-specific fields
 * @param {string} username - User's key in users object
 * @param {Object} user - User data object
 * @returns {Object} - VGM player object
 */
function createVGMPlayer(username, user) {
  return {
    name: user.username,
    username: username,
    profilePicture: user.profilePicture || 'profiles/default.svg',
    score: 0,
    hintPoints: 4,
    usedHintThisRound: false,
    guessedGame: false,
    gotSuperSonic: false,
    streak: 0
  };
}

/**
 * Log with timestamp
 * @param {string} category
 * @param {string} message
 * @param {*} data
 */
function log(category, message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  if (data) {
    console.log(`[${timestamp}] [${category}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] [${category}] ${message}`);
  }
}

/**
 * Log warning with timestamp
 * @param {string} category
 * @param {string} message
 * @param {*} data
 */
function warn(category, message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  if (data) {
    console.warn(`[${timestamp}] [${category}] ${message}`, data);
  } else {
    console.warn(`[${timestamp}] [${category}] ${message}`);
  }
}

module.exports = {
  generateRoomCode,
  shuffleArray,
  normalizeString,
  checkGuess,
  now,
  createPlayer,
  createVGMPlayer,
  log,
  warn
};
