/**
 * Shared utility functions
 *
 * These functions were previously duplicated across game.js, typing.js, and drawing.js.
 * Now centralized here for consistency and maintainability.
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text safe for innerHTML
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Shuffle an array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} New shuffled array (does not mutate original)
 */
export function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Format milliseconds as seconds with decimals
 * @param {number} ms - Milliseconds
 * @param {number} [decimals=2] - Number of decimal places
 * @returns {string} Formatted time (e.g., "5.23s")
 */
export function formatTime(ms, decimals = 2) {
  return (ms / 1000).toFixed(decimals) + 's';
}

/**
 * Format milliseconds as MM:SS or M:SS
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted time (e.g., "1:30")
 */
export function formatMinutesSeconds(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Debounce a function - delays execution until after wait period of no calls
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(fn, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Throttle a function - limits execution to once per time period
 * @param {Function} fn - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(fn, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Generate a random room code
 * @param {number} [length=4] - Code length
 * @returns {string} Uppercase alphanumeric code
 */
export function generateRoomCode(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Clamp a number between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Get rank class based on position (for leaderboards)
 * @param {number} index - 0-based position
 * @returns {string} CSS class name
 */
export function getRankClass(index) {
  if (index === 0) return 'gold';
  if (index === 1) return 'silver';
  if (index === 2) return 'bronze';
  return '';
}

/**
 * Format a number with ordinal suffix (1st, 2nd, 3rd, etc.)
 * @param {number} n - Number
 * @returns {string} Number with ordinal
 */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Wait for a specified duration (Promise-based setTimeout)
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an element is visible in the viewport
 * @param {HTMLElement} element - Element to check
 * @returns {boolean}
 */
export function isElementVisible(element) {
  if (!element) return false;
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

/**
 * Scroll element into view with smooth animation
 * @param {HTMLElement} element - Element to scroll to
 * @param {Object} [options] - Scroll options
 */
export function scrollIntoView(element, options = { behavior: 'smooth', block: 'nearest' }) {
  if (element && typeof element.scrollIntoView === 'function') {
    element.scrollIntoView(options);
  }
}

/**
 * Parse a query string into an object
 * @param {string} [queryString=window.location.search] - Query string to parse
 * @returns {Object} Key-value pairs
 */
export function parseQueryString(queryString = window.location.search) {
  return Object.fromEntries(new URLSearchParams(queryString));
}

/**
 * Deep clone an object (simple implementation using JSON)
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if value is a non-null object
 * @param {*} value
 * @returns {boolean}
 */
export function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
