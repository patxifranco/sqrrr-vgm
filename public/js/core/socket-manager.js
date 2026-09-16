class SocketManager {
  constructor() {
    this._socket = null;

    this._scopedListeners = new Map();

    this._latency = 0;

    this._lastServerTime = 0;
  }

  connect() {
    if (!this._socket) {
      if (typeof io === 'undefined') {
        console.error('[SocketManager] Socket.IO not loaded');
        return null;
      }
      this._socket = io();
      this._setupCoreListeners();
    }
    return this._socket;
  }

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

    this._socket.on('serverTime', (data) => {
      const clientTime = Date.now();
      this._lastServerTime = data.time;
      this._latency = clientTime - data.time;
    });
  }

  get socket() {
    return this._socket;
  }

  get latency() {
    return this._latency;
  }

  on(event, handler, scope = 'global') {
    if (!this._socket) {
      console.warn('[SocketManager] Socket not connected, connecting now...');
      this.connect();
    }

    if (!this._scopedListeners.has(scope)) {
      this._scopedListeners.set(scope, new Map());
    }

    this.off(event, scope);

    this._scopedListeners.get(scope).set(event, handler);
    this._socket.on(event, handler);
  }

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

  cleanupAllScopes() {
    for (const scope of this._scopedListeners.keys()) {
      if (scope !== 'global') {
        this.cleanupScope(scope);
      }
    }
  }

  emit(event, data) {
    if (this._socket) {
      this._socket.emit(event, data);
    } else {
      console.error('[SocketManager] Cannot emit, socket not connected');
    }
  }

  adjustDuration(serverDuration, serverTime) {
    const elapsed = Date.now() - serverTime;
    return Math.max(0, serverDuration - elapsed);
  }

  hasScope(scope) {
    return this._scopedListeners.has(scope) &&
           this._scopedListeners.get(scope).size > 0;
  }

  getListenerCount(scope) {
    const scopeListeners = this._scopedListeners.get(scope);
    return scopeListeners ? scopeListeners.size : 0;
  }

  get activeScopes() {
    return Array.from(this._scopedListeners.keys());
  }
}

export const socketManager = new SocketManager();

export { SocketManager };
