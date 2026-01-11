/**
 * State Manager - Centralized reactive state management
 *
 * Replaces scattered global variables with a centralized state object
 * that supports change notifications.
 *
 * Usage:
 *   import { createState } from './core/state.js';
 *
 *   // Create a game-specific state
 *   const gameState = createState({
 *     roundActive: false,
 *     currentSong: null,
 *     players: [],
 *     score: 0
 *   });
 *
 *   // Get values
 *   gameState.get('roundActive'); // false
 *
 *   // Set values (triggers listeners)
 *   gameState.set('roundActive', true);
 *
 *   // Set multiple values
 *   gameState.setMany({ roundActive: true, score: 10 });
 *
 *   // Listen for changes
 *   gameState.on('roundActive', (newValue, oldValue) => {
 *     console.log('Round state changed:', oldValue, '->', newValue);
 *   });
 *
 *   // Listen for any change
 *   gameState.onAny((key, newValue, oldValue) => {
 *     console.log(key, 'changed');
 *   });
 *
 *   // Reset to initial state
 *   gameState.reset();
 */

class StateManager {
  /**
   * @param {Object} initialState - Initial state values
   */
  constructor(initialState = {}) {
    this._initialState = { ...initialState };
    this._state = { ...initialState };
    this._listeners = new Map(); // key -> Set of callbacks
    this._anyListeners = new Set(); // callbacks for any change
  }

  /**
   * Get a state value
   * @param {string} key
   * @returns {*}
   */
  get(key) {
    return this._state[key];
  }

  /**
   * Get all state as object (shallow copy)
   * @returns {Object}
   */
  getAll() {
    return { ...this._state };
  }

  /**
   * Set a state value and notify listeners
   * @param {string} key
   * @param {*} value
   */
  set(key, value) {
    const oldValue = this._state[key];

    // Skip if value hasn't changed (shallow comparison)
    if (oldValue === value) return;

    this._state[key] = value;
    this._notify(key, value, oldValue);
  }

  /**
   * Set multiple values at once
   * @param {Object} updates - Key-value pairs to update
   */
  setMany(updates) {
    for (const [key, value] of Object.entries(updates)) {
      this.set(key, value);
    }
  }

  /**
   * Update a value using a function
   * @param {string} key
   * @param {Function} updater - (currentValue) => newValue
   */
  update(key, updater) {
    const newValue = updater(this._state[key]);
    this.set(key, newValue);
  }

  /**
   * Check if a key exists in state
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return key in this._state;
  }

  /**
   * Subscribe to changes on a specific key
   * @param {string} key
   * @param {Function} callback - (newValue, oldValue) => void
   * @returns {Function} Unsubscribe function
   */
  on(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      const listeners = this._listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Subscribe to changes on any key
   * @param {Function} callback - (key, newValue, oldValue) => void
   * @returns {Function} Unsubscribe function
   */
  onAny(callback) {
    this._anyListeners.add(callback);
    return () => this._anyListeners.delete(callback);
  }

  /**
   * Unsubscribe all listeners for a specific key
   * @param {string} key
   */
  off(key) {
    this._listeners.delete(key);
  }

  /**
   * Unsubscribe all listeners
   */
  offAll() {
    this._listeners.clear();
    this._anyListeners.clear();
  }

  /**
   * Reset state to initial values
   */
  reset() {
    const oldState = { ...this._state };
    this._state = { ...this._initialState };

    // Notify for each changed key
    for (const key of Object.keys(this._state)) {
      if (oldState[key] !== this._state[key]) {
        this._notify(key, this._state[key], oldState[key]);
      }
    }
  }

  /**
   * Notify listeners of a change
   * @private
   */
  _notify(key, newValue, oldValue) {
    // Notify key-specific listeners
    const keyListeners = this._listeners.get(key);
    if (keyListeners) {
      for (const callback of keyListeners) {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          console.error(`State listener error for "${key}":`, error);
        }
      }
    }

    // Notify "any" listeners
    for (const callback of this._anyListeners) {
      try {
        callback(key, newValue, oldValue);
      } catch (error) {
        console.error('State listener error:', error);
      }
    }
  }
}

/**
 * Create a new state manager instance
 * @param {Object} initialState
 * @returns {StateManager}
 */
export function createState(initialState = {}) {
  return new StateManager(initialState);
}

// Export the class for advanced use cases
export { StateManager };

// Pre-configured game states for convenience
export const vgmState = createState({
  roundActive: false,
  currentSong: null,
  roundNumber: 0,
  roundStartTime: null,
  roundDuration: 20000,
  autoPlayActive: false,
  players: [],
  score: 0,
  guessedGame: false,
  guessedSong: false,
  hintPoints: 0
});

export const typingState = createState({
  gameActive: false,
  isMultiplayer: false,
  isSpectator: false,
  isCoop: false,
  words: [],
  fullText: '',
  charIndex: 0,
  correctChars: 0,
  totalTyped: 0,
  errors: 0,
  startTime: null,
  timeRemaining: 60,
  players: [],
  spectators: []
});

export const drawingState = createState({
  gameState: 'waiting',
  isHost: false,
  isSpectator: false,
  isDrawer: false,
  currentTool: 'brush',
  currentColor: '#000000',
  currentSize: 6,
  drawerWord: null,
  players: [],
  spectators: []
});
