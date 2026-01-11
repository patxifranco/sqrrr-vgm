/**
 * Core Module Exports
 *
 * Import all core modules from one place:
 *   import { timerManager, socketManager, logger, dom, audioManager } from './core/index.js';
 */

export { timerManager, TimerManager } from './timer-manager.js';
export { socketManager, SocketManager } from './socket-manager.js';
export { logger, Logger, LOG_LEVELS } from './logger.js';
export { dom, DOMManager } from './dom.js';
export { audioManager, AudioManager } from './audio-manager.js';
export { createState, StateManager, vgmState, typingState, drawingState } from './state.js';

// Utility functions
export {
  escapeHtml,
  shuffleArray,
  formatTime,
  formatMinutesSeconds,
  debounce,
  throttle,
  generateRoomCode,
  clamp,
  getRankClass,
  ordinal,
  wait,
  isElementVisible,
  scrollIntoView,
  parseQueryString,
  deepClone,
  isObject
} from './utils.js';
