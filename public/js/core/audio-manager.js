/**
 * Audio Manager - Centralized audio playback with error handling
 *
 * Replaces:
 * - audioPlayer.play().catch(() => {})
 * - notifySound.play().catch(() => {})
 * etc.
 *
 * With proper error handling, logging, and autoplay policy handling.
 *
 * Usage:
 *   import { audioManager } from './core/audio-manager.js';
 *
 *   // Initialize with the main audio player element
 *   audioManager.setMainPlayer(document.getElementById('audio-player'));
 *
 *   // Preload sound effects
 *   audioManager.preload('correct', '/correct.mp3');
 *   audioManager.preload('notify', '/windows_xp_notify.mp3');
 *
 *   // Play sounds
 *   audioManager.play('correct');
 *   await audioManager.playMain('/audio/track.mp3', { startTime: 5 });
 *
 *   // Fade out
 *   await audioManager.fadeOut(3000);
 */

import { logger } from './logger.js';
import { timerManager } from './timer-manager.js';

class AudioManager {
  constructor() {
    /** @type {Map<string, HTMLAudioElement>} Preloaded sound effects */
    this._sounds = new Map();

    /** @type {HTMLAudioElement|null} Main music player */
    this._mainPlayer = null;

    /** @type {number} Master volume (0-1) */
    this._volume = 1.0;

    /** @type {boolean} Whether autoplay is allowed */
    this._autoplayAllowed = false;

    /** @type {Function[]} Callbacks waiting for autoplay unlock */
    this._pendingPlay = [];
  }

  /**
   * Set the main audio player element (for streaming music)
   * @param {HTMLAudioElement} element
   */
  setMainPlayer(element) {
    this._mainPlayer = element;

    if (element) {
      // Track autoplay state
      element.addEventListener('play', () => {
        this._autoplayAllowed = true;
      });

      element.addEventListener('error', (e) => {
        if (element.src && element.src !== window.location.href) {
          logger.warn('Audio', 'Main player error', {
            src: element.src,
            error: element.error?.message
          });
        }
      });
    }
  }

  /**
   * Preload a sound effect for later playback
   * @param {string} name - Name to reference this sound
   * @param {string} src - Audio file URL
   */
  preload(name, src) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;
    this._sounds.set(name, audio);
    logger.debug('Audio', `Preloaded: ${name}`);
  }

  /**
   * Play a preloaded sound effect
   * @param {string} name - Name of the preloaded sound
   * @param {Object} [options]
   * @param {number} [options.volume] - Volume override (0-1)
   * @returns {Promise<boolean>} Whether playback started successfully
   */
  async play(name, options = {}) {
    const sound = this._sounds.get(name);
    if (!sound) {
      logger.warn('Audio', `Sound not found: ${name}`);
      return false;
    }

    try {
      sound.currentTime = 0;
      sound.volume = options.volume ?? this._volume;
      await sound.play();
      return true;
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        logger.debug('Audio', `Autoplay blocked for ${name} - waiting for interaction`);
      } else {
        logger.warn('Audio', `Failed to play ${name}`, error.message);
      }
      return false;
    }
  }

  /**
   * Play audio on the main player (for streaming tracks)
   * @param {string} src - Audio URL
   * @param {Object} [options]
   * @param {number} [options.startTime] - Start position in seconds
   * @param {number} [options.volume] - Volume (0-1)
   * @returns {Promise<boolean>} Whether playback started
   */
  async playMain(src, options = {}) {
    if (!this._mainPlayer) {
      logger.error('Audio', 'Main player not set');
      return false;
    }

    try {
      this._mainPlayer.src = src;
      this._mainPlayer.volume = options.volume ?? this._volume;

      // Wait for enough data to seek
      if (options.startTime) {
        await new Promise((resolve) => {
          const handler = () => {
            this._mainPlayer.currentTime = options.startTime;
            this._mainPlayer.removeEventListener('loadedmetadata', handler);
            resolve();
          };
          this._mainPlayer.addEventListener('loadedmetadata', handler);
        });
      }

      await this._mainPlayer.play();
      this._autoplayAllowed = true;
      return true;
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        logger.info('Audio', 'Autoplay blocked - user interaction required');
        return false;
      }
      logger.error('Audio', 'Playback failed', error.message);
      return false;
    }
  }

  /**
   * Pause the main player
   */
  pause() {
    if (this._mainPlayer) {
      this._mainPlayer.pause();
    }
  }

  /**
   * Resume the main player
   * @returns {Promise<boolean>}
   */
  async resume() {
    if (!this._mainPlayer) return false;

    try {
      await this._mainPlayer.play();
      return true;
    } catch (error) {
      logger.warn('Audio', 'Resume failed', error.message);
      return false;
    }
  }

  /**
   * Stop the main player and clear source
   */
  stop() {
    if (this._mainPlayer) {
      this._mainPlayer.pause();
      this._mainPlayer.src = '';
      this._mainPlayer.currentTime = 0;
    }
  }

  /**
   * Fade out the main player over a duration
   * @param {number} [duration=3000] - Fade duration in milliseconds
   * @returns {Promise<void>} Resolves when fade is complete
   */
  fadeOut(duration = 3000) {
    return new Promise((resolve) => {
      if (!this._mainPlayer || this._mainPlayer.paused) {
        resolve();
        return;
      }

      const startVolume = this._mainPlayer.volume;
      const steps = duration / 50;
      const volumeStep = startVolume / steps;
      let currentStep = 0;

      timerManager.setInterval('audio-fade', () => {
        currentStep++;

        if (currentStep >= steps || this._mainPlayer.volume <= volumeStep) {
          this._mainPlayer.volume = 0;
          this._mainPlayer.pause();
          this._mainPlayer.volume = this._volume; // Reset for next play
          timerManager.clear('audio-fade');
          resolve();
        } else {
          this._mainPlayer.volume -= volumeStep;
        }
      }, 50);
    });
  }

  /**
   * Set master volume
   * @param {number} volume - Volume level (0-1)
   */
  setVolume(volume) {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this._mainPlayer) {
      this._mainPlayer.volume = this._volume;
    }
  }

  /**
   * Get current volume
   * @returns {number}
   */
  get volume() {
    return this._volume;
  }

  /**
   * Check if main player is playing
   * @returns {boolean}
   */
  get isPlaying() {
    return this._mainPlayer && !this._mainPlayer.paused;
  }

  /**
   * Get current playback time in seconds
   * @returns {number}
   */
  get currentTime() {
    return this._mainPlayer?.currentTime ?? 0;
  }

  /**
   * Get duration in seconds
   * @returns {number}
   */
  get duration() {
    return this._mainPlayer?.duration ?? 0;
  }

  /**
   * Set current playback time
   * @param {number} time - Time in seconds
   */
  seek(time) {
    if (this._mainPlayer) {
      this._mainPlayer.currentTime = time;
    }
  }

  /**
   * Check if autoplay is allowed
   * @returns {boolean}
   */
  get canAutoplay() {
    return this._autoplayAllowed;
  }
}

// Singleton instance
export const audioManager = new AudioManager();

// Also export the class for testing
export { AudioManager };
