class StateManager {
  constructor(initialState = {}) {
    this._initialState = { ...initialState };
    this._state = { ...initialState };
    this._listeners = new Map();
    this._anyListeners = new Set();
  }

  get(key) {
    return this._state[key];
  }

  getAll() {
    return { ...this._state };
  }

  set(key, value) {
    const oldValue = this._state[key];

    if (oldValue === value) return;

    this._state[key] = value;
    this._notify(key, value, oldValue);
  }

  setMany(updates) {
    for (const [key, value] of Object.entries(updates)) {
      this.set(key, value);
    }
  }

  update(key, updater) {
    const newValue = updater(this._state[key]);
    this.set(key, newValue);
  }

  has(key) {
    return key in this._state;
  }

  on(key, callback) {
    if (!this._listeners.has(key)) {
      this._listeners.set(key, new Set());
    }
    this._listeners.get(key).add(callback);

    return () => {
      const listeners = this._listeners.get(key);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  onAny(callback) {
    this._anyListeners.add(callback);
    return () => this._anyListeners.delete(callback);
  }

  off(key) {
    this._listeners.delete(key);
  }

  offAll() {
    this._listeners.clear();
    this._anyListeners.clear();
  }

  reset() {
    const oldState = { ...this._state };
    this._state = { ...this._initialState };

    for (const key of Object.keys(this._state)) {
      if (oldState[key] !== this._state[key]) {
        this._notify(key, this._state[key], oldState[key]);
      }
    }
  }

  _notify(key, newValue, oldValue) {
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

    for (const callback of this._anyListeners) {
      try {
        callback(key, newValue, oldValue);
      } catch (error) {
        console.error('State listener error:', error);
      }
    }
  }
}

export function createState(initialState = {}) {
  return new StateManager(initialState);
}

export { StateManager };

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
