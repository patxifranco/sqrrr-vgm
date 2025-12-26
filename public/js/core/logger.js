/**
 * Logger - Centralized logging with levels and categories
 *
 * Replaces console.log scattered throughout the codebase with structured logging.
 * Allows filtering by level and category for debugging.
 *
 * Usage:
 *   import { logger } from './core/logger.js';
 *
 *   logger.debug('Audio', 'Loading track', { file: 'pokemon-route1.mp3' });
 *   logger.info('Game', 'Round started');
 *   logger.warn('Sync', 'High latency detected', { latency: 500 });
 *   logger.error('Socket', 'Connection failed', error);
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

class Logger {
  /**
   * @param {number} minLevel - Minimum log level to output (NONE to disable all console output)
   */
  constructor(minLevel = LOG_LEVELS.NONE) {
    this._minLevel = minLevel;
    this._enabledCategories = null; // null = all enabled
    this._history = []; // Keep last N logs for debugging
    this._maxHistory = 100;
  }

  /**
   * Set minimum log level
   * @param {'DEBUG'|'INFO'|'WARN'|'ERROR'|'NONE'} level
   */
  setLevel(level) {
    this._minLevel = LOG_LEVELS[level] ?? LOG_LEVELS.DEBUG;
  }

  /**
   * Enable only specific categories (pass null to enable all)
   * @param {string[]|null} categories
   */
  setCategories(categories) {
    this._enabledCategories = categories;
  }

  /**
   * Internal log method
   */
  _log(level, category, message, data) {
    // Check level
    if (level < this._minLevel) return;

    // Check category filter
    if (this._enabledCategories && !this._enabledCategories.includes(category)) {
      return;
    }

    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const prefix = `[${timestamp}] [${category}]`;

    // Store in history
    this._history.push({ level, category, message, data, time: Date.now() });
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    // Output to console
    switch (level) {
      case LOG_LEVELS.DEBUG:
        console.debug(prefix, message, data ?? '');
        break;
      case LOG_LEVELS.INFO:
        console.info(prefix, message, data ?? '');
        break;
      case LOG_LEVELS.WARN:
        console.warn(prefix, message, data ?? '');
        break;
      case LOG_LEVELS.ERROR:
        console.error(prefix, message, data ?? '');
        break;
    }
  }

  /**
   * Log debug message (verbose, development only)
   * @param {string} category - Category/module name (e.g., 'Audio', 'Socket')
   * @param {string} message - Log message
   * @param {*} [data] - Optional data to log
   */
  debug(category, message, data) {
    this._log(LOG_LEVELS.DEBUG, category, message, data);
  }

  /**
   * Log info message (normal operation)
   * @param {string} category
   * @param {string} message
   * @param {*} [data]
   */
  info(category, message, data) {
    this._log(LOG_LEVELS.INFO, category, message, data);
  }

  /**
   * Log warning message (potential issues)
   * @param {string} category
   * @param {string} message
   * @param {*} [data]
   */
  warn(category, message, data) {
    this._log(LOG_LEVELS.WARN, category, message, data);
  }

  /**
   * Log error message (failures)
   * @param {string} category
   * @param {string} message
   * @param {*} [data]
   */
  error(category, message, data) {
    this._log(LOG_LEVELS.ERROR, category, message, data);
  }

  /**
   * Get recent log history (for debugging UI or error reports)
   * @param {number} [count] - Number of entries to return
   * @returns {Array}
   */
  getHistory(count) {
    if (count) {
      return this._history.slice(-count);
    }
    return [...this._history];
  }

  /**
   * Clear log history
   */
  clearHistory() {
    this._history = [];
  }

  /**
   * Create a scoped logger for a specific category
   * @param {string} category
   * @returns {Object} Logger with bound category
   */
  scope(category) {
    return {
      debug: (message, data) => this.debug(category, message, data),
      info: (message, data) => this.info(category, message, data),
      warn: (message, data) => this.warn(category, message, data),
      error: (message, data) => this.error(category, message, data)
    };
  }
}

// Singleton instance
export const logger = new Logger();

// Export LOG_LEVELS for configuration
export { LOG_LEVELS, Logger };
