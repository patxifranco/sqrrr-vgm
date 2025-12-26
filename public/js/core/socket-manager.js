/**
 * Socket Manager - Socket.IO wrapper with scoped listener management
 *
 * Fixes sync issues and memory leaks by:
 * - Tracking listeners by scope (e.g., 'vgm', 'typing', 'drawing')
 * - Preventing duplicate listeners for the same event/scope
 * - Providing bulk cleanup when leaving a game
 * - Adding server timestamp verification for sync
 *
 * Usage:
 *   import { socketManager } from './core/socket-manager.js';
 *
 *   // Connect (typically done once at app start)
 *   socketManager.connect();
 *
 *   // Register scoped listener (replaces any existing listener for this scope/event)
 *   socketManager.on('roundStart', handleRoundStart, 'vgm');
 *
 *   // Clean up when leaving a game
 *   socketManager.cleanupScope('vgm');
 */

class SocketManager {
  constructor() {
    /** @type {Object|null} Socket.IO socket instance */
    this._socket = null;

    /**
     * Map of scope -> Map of event -> handler
     * @type {Map<string, Map<string, Function>>}
     */
    this._scopedListeners = new Map();

    /** @type {number} Estimated latency in ms */
    this._latency = 0;

    /** @type {number} Last server time received */
    this._lastServerTime = 0;
  }

  /**
   * Initialize the socket connection
   * @returns {Object} The socket instance
   */
  connect() {
    if (!this._socket) {
      // Assumes Socket.IO is loaded globally via script tag
      if (typeof io === 'undefined') {
        console.error('[SocketManager] Socket.IO not loaded');
        return null;
      }
      this._socket = io();
      this._setupCoreListeners();
    }
    return this._socket;
  }

  /**
   * Set up core listeners that should always be active
   */
  _setupCoreListeners() {
    if (!this._socket) return;

    this._socket.on('connect', () => {
      console.info('[SocketManager] Connected');
    });

    this._socket.on('disconnect', () => {
      console.info('[SocketManager] Disconnected');
    });

    this._socket.on('connect_error', (error) => {
      console.error('[SocketManager] Connection error:', error.message);
    });

    // Handle server time sync
    this._socket.on('serverTime', (data) => {
      const clientTime = Date.now();
      this._lastServerTime = data.time;
      this._latency = clientTime - data.time;
    });
  }

  /**
   * Get the raw socket instance
   * @returns {Object|null}
   */
  get socket() {
    return this._socket;
  }

  /**
   * Get the estimated latency
   * @returns {number}
   */
  get latency() {
    return this._latency;
  }

  /**
   * Register an event listener with scope tracking
   * Removes any existing handler for this scope/event combo first
   * @param {string} event - Socket event name
   * @param {Function} handler - Event handler function
   * @param {string} [scope='global'] - Scope for cleanup (e.g., 'vgm', 'typing')
   */
  on(event, handler, scope = 'global') {
    if (!this._socket) {
      console.warn('[SocketManager] Socket not connected, connecting now...');
      this.connect();
    }

    // Ensure scope map exists
    if (!this._scopedListeners.has(scope)) {
      this._scopedListeners.set(scope, new Map());
    }

    // Remove existing handler for this scope/event
    this.off(event, scope);

    // Store and register the new handler
    this._scopedListeners.get(scope).set(event, handler);
    this._socket.on(event, handler);
  }

  /**
   * Remove a specific event listener by scope
   * @param {string} event - Socket event name
   * @param {string} [scope='global'] - Scope to remove from
   */
  off(event, scope = 'global') {
    const scopeListeners = this._scopedListeners.get(scope);
    if (scopeListeners && scopeListeners.has(event)) {
      const handler = scopeListeners.get(event);
      if (this._socket) {
        this._socket.off(event, handler);
      }
      scopeListeners.delete(event);
    }
  }

  /**
   * Remove all listeners for a specific scope
   * Call this when leaving a game/screen
   * @param {string} scope - Scope to clean up
   */
  cleanupScope(scope) {
    const scopeListeners = this._scopedListeners.get(scope);
    if (scopeListeners) {
      for (const [event, handler] of scopeListeners) {
        if (this._socket) {
          this._socket.off(event, handler);
        }
      }
      this._scopedListeners.delete(scope);
      console.info(`[SocketManager] Cleaned up scope: ${scope}`);
    }
  }

  /**
   * Remove all scoped listeners (except 'global')
   */
  cleanupAllScopes() {
    for (const scope of this._scopedListeners.keys()) {
      if (scope !== 'global') {
        this.cleanupScope(scope);
      }
    }
  }

  /**
   * Emit an event to the server
   * @param {string} event - Event name
   * @param {*} data - Data to send
   */
  emit(event, data) {
    if (this._socket) {
      this._socket.emit(event, data);
    } else {
      console.error('[SocketManager] Cannot emit, socket not connected');
    }
  }

  /**
   * Calculate adjusted duration accounting for latency
   * @param {number} serverDuration - Duration from server in ms
   * @param {number} serverTime - Server timestamp when event was sent
   * @returns {number} Adjusted duration
   */
  adjustDuration(serverDuration, serverTime) {
    const elapsed = Date.now() - serverTime;
    return Math.max(0, serverDuration - elapsed);
  }

  /**
   * Check if a scope has any registered listeners
   * @param {string} scope
   * @returns {boolean}
   */
  hasScope(scope) {
    return this._scopedListeners.has(scope) &&
           this._scopedListeners.get(scope).size > 0;
  }

  /**
   * Get count of listeners for a scope (useful for debugging)
   * @param {string} scope
   * @returns {number}
   */
  getListenerCount(scope) {
    const scopeListeners = this._scopedListeners.get(scope);
    return scopeListeners ? scopeListeners.size : 0;
  }

  /**
   * Get all active scopes (useful for debugging)
   * @returns {string[]}
   */
  get activeScopes() {
    return Array.from(this._scopedListeners.keys());
  }
}

// Singleton instance
export const socketManager = new SocketManager();

// Also export the class for testing
export { SocketManager };
