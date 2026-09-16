import { logger } from './logger.js';
import { timerManager } from './timer-manager.js';

class AudioManager {
  constructor() {
    this._sounds = new Map();

    this._mainPlayer = null;

    this._volume = 1.0;

    this._autoplayAllowed = false;

    this._pendingPlay = [];
  }

  setMainPlayer(element) {
    this._mainPlayer = element;

    if (element) {
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

  preload(name, src) {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = src;
    this._sounds.set(name, audio);
    logger.debug('Audio', `Preloaded: ${name}`);
  }

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

  async playMain(src, options = {}) {
    if (!this._mainPlayer) {
      logger.error('Audio', 'Main player not set');
      return false;
    }

    try {
      this._mainPlayer.src = src;
      this._mainPlayer.volume = options.volume ?? this._volume;

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

  pause() {
    if (this._mainPlayer) {
      this._mainPlayer.pause();
    }
  }

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

  stop() {
    if (this._mainPlayer) {
      this._mainPlayer.pause();
      this._mainPlayer.src = '';
      this._mainPlayer.currentTime = 0;
    }
  }

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
          this._mainPlayer.volume = this._volume;
          timerManager.clear('audio-fade');
          resolve();
        } else {
          this._mainPlayer.volume -= volumeStep;
        }
      }, 50);
    });
  }

  setVolume(volume) {
    this._volume = Math.max(0, Math.min(1, volume));
    if (this._mainPlayer) {
      this._mainPlayer.volume = this._volume;
    }
  }

  get volume() {
    return this._volume;
  }

  get isPlaying() {
    return this._mainPlayer && !this._mainPlayer.paused;
  }

  get currentTime() {
    return this._mainPlayer?.currentTime ?? 0;
  }

  get duration() {
    return this._mainPlayer?.duration ?? 0;
  }

  seek(time) {
    if (this._mainPlayer) {
      this._mainPlayer.currentTime = time;
    }
  }

  get canAutoplay() {
    return this._autoplayAllowed;
  }
}

export const audioManager = new AudioManager();

export { AudioManager };
