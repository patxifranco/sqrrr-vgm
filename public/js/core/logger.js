const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

class Logger {
  constructor(minLevel = LOG_LEVELS.NONE) {
    this._minLevel = minLevel;
    this._enabledCategories = null;
    this._history = [];
    this._maxHistory = 100;
  }

  setLevel(level) {
    this._minLevel = LOG_LEVELS[level] ?? LOG_LEVELS.DEBUG;
  }

  setCategories(categories) {
    this._enabledCategories = categories;
  }

  _log(level, category, message, data) {
    if (level < this._minLevel) return;

    if (this._enabledCategories && !this._enabledCategories.includes(category)) {
      return;
    }

    const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    const prefix = `[${timestamp}] [${category}]`;

    this._history.push({ level, category, message, data, time: Date.now() });
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

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

  debug(category, message, data) {
    this._log(LOG_LEVELS.DEBUG, category, message, data);
  }

  info(category, message, data) {
    this._log(LOG_LEVELS.INFO, category, message, data);
  }

  warn(category, message, data) {
    this._log(LOG_LEVELS.WARN, category, message, data);
  }

  error(category, message, data) {
    this._log(LOG_LEVELS.ERROR, category, message, data);
  }

  getHistory(count) {
    if (count) {
      return this._history.slice(-count);
    }
    return [...this._history];
  }

  clearHistory() {
    this._history = [];
  }

  scope(category) {
    return {
      debug: (message, data) => this.debug(category, message, data),
      info: (message, data) => this.info(category, message, data),
      warn: (message, data) => this.warn(category, message, data),
      error: (message, data) => this.error(category, message, data)
    };
  }
}

export const logger = new Logger();

export { LOG_LEVELS, Logger };
