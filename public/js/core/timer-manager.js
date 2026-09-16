class TimerManager {
  constructor() {
    this._timers = new Map();
  }

  setInterval(name, callback, delay) {
    this.clear(name);
    const id = window.setInterval(callback, delay);
    this._timers.set(name, { id, type: 'interval' });
    return id;
  }

  setTimeout(name, callback, delay) {
    this.clear(name);
    const id = window.setTimeout(() => {
      this._timers.delete(name);
      callback();
    }, delay);
    this._timers.set(name, { id, type: 'timeout' });
    return id;
  }

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

  clearByPrefix(prefix) {
    for (const name of this._timers.keys()) {
      if (name.startsWith(prefix)) {
        this.clear(name);
      }
    }
  }

  clearAll() {
    for (const name of this._timers.keys()) {
      this.clear(name);
    }
  }

  has(name) {
    return this._timers.has(name);
  }

  get activeCount() {
    return this._timers.size;
  }

  get activeTimers() {
    return Array.from(this._timers.keys());
  }
}

export const timerManager = new TimerManager();

export { TimerManager };
