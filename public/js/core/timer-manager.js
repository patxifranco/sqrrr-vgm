/**
 * Timer Manager - Centralized timer/interval management with automatic cleanup
 *
 * Prevents memory leaks by:
 * - Tracking all timers by name
 * - Clearing old timers before setting new ones with the same name
 * - Providing bulk cleanup by prefix (e.g., 'vgm-', 'typing-', 'drawing-')
 *
 * Usage:
 *   import { timerManager } from './core/timer-manager.js';
 *
 *   // Set a named interval
 *   timerManager.setInterval('round-timer', () => updateTimer(), 1000);
 *
 *   // Clear a specific timer
 *   timerManager.clear('round-timer');
 *
 *   // Clear all timers for a game
 *   timerManager.clearByPrefix('vgm-');
 */

class TimerManager {
  constructor() {
    /** @type {Map<string, {id: number, type: 'interval'|'timeout'}>} */
    this._timers = new Map();
  }

  /**
   * Set a named interval. Clears any existing timer with the same name.
   * @param {string} name - Unique name for this timer
   * @param {Function} callback - Function to call on each interval
   * @param {number} delay - Interval delay in milliseconds
   * @returns {number} The interval ID
   */
  setInterval(name, callback, delay) {
    this.clear(name);
    const id = window.setInterval(callback, delay);
    this._timers.set(name, { id, type: 'interval' });
    return id;
  }

  /**
   * Set a named timeout. Clears any existing timer with the same name.
   * Automatically removes itself from tracking when it fires.
   * @param {string} name - Unique name for this timer
   * @param {Function} callback - Function to call when timeout fires
   * @param {number} delay - Timeout delay in milliseconds
   * @returns {number} The timeout ID
   */
  setTimeout(name, callback, delay) {
    this.clear(name);
    const id = window.setTimeout(() => {
      this._timers.delete(name);
      callback();
    }, delay);
    this._timers.set(name, { id, type: 'timeout' });
    return id;
  }

  /**
   * Clear a specific timer by name
   * @param {string} name - Name of the timer to clear
   */
  clear(name) {
    const timer = this._timers.get(name);
    if (timer) {
      if (timer.type === 'interval') {
        window.clearInterval(timer.id);
      } else {
        window.clearTimeout(timer.id);
      }
      this._timers.delete(name);
    }
  }

  /**
   * Clear all timers matching a prefix
   * Useful for cleaning up all timers for a specific game when leaving
   * @param {string} prefix - Prefix to match (e.g., 'vgm-', 'typing-')
   */
  clearByPrefix(prefix) {
    for (const name of this._timers.keys()) {
      if (name.startsWith(prefix)) {
        this.clear(name);
      }
    }
  }

  /**
   * Clear all tracked timers
   */
  clearAll() {
    for (const name of this._timers.keys()) {
      this.clear(name);
    }
  }

  /**
   * Check if a timer exists and is active
   * @param {string} name - Name of the timer
   * @returns {boolean}
   */
  has(name) {
    return this._timers.has(name);
  }

  /**
   * Get the count of active timers (useful for debugging)
   * @returns {number}
   */
  get activeCount() {
    return this._timers.size;
  }

  /**
   * Get all active timer names (useful for debugging)
   * @returns {string[]}
   */
  get activeTimers() {
    return Array.from(this._timers.keys());
  }
}

// Singleton instance
export const timerManager = new TimerManager();

// Also export the class for testing
export { TimerManager };
