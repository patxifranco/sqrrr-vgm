/**
 * VGM Timer Module - Round timer and audio fade functionality
 *
 * Handles:
 * - Round countdown timer display
 * - Progress bar updates
 * - Audio fade-out at round end
 * - Super Sonic indicator (first 3 seconds)
 */

import { timerManager } from '../../core/index.js';

// Timer state
let roundStartTime = 0;
let roundDuration = 0;
let fadeOutStarted = false;
let originalVolume = 1;

// DOM element references (set via init)
let timerFill = null;
let timerText = null;
let audioPlayer = null;
let volumeSlider = null;
let voteExtendBtn = null;

// Callbacks
let onProgressUpdate = null;

/**
 * Initialize timer module with DOM references
 */
function init(elements) {
  timerFill = elements.timerFill;
  timerText = elements.timerText;
  audioPlayer = elements.audioPlayer;
  volumeSlider = elements.volumeSlider;
  voteExtendBtn = elements.voteExtendBtn;
  onProgressUpdate = elements.onProgressUpdate || (() => {});
}

/**
 * Start the round timer
 * @param {number} duration - Round duration in milliseconds
 */
function start(duration) {
  roundStartTime = Date.now();
  roundDuration = duration;
  fadeOutStarted = false;

  timerManager.setInterval('vgm-round-timer', () => {
    const elapsed = Date.now() - roundStartTime;
    const remaining = Math.max(0, roundDuration - elapsed);
    const progressPercent = (elapsed / roundDuration) * 100;
    const timerPercent = (remaining / roundDuration) * 100;

    if (timerFill) timerFill.style.width = timerPercent + '%';
    if (timerText) timerText.textContent = Math.ceil(remaining / 1000) + 's';

    onProgressUpdate(Math.min(100, progressPercent));

    // Super Sonic indicator for first 3 seconds
    if (elapsed <= 3000) {
      if (timerFill) timerFill.classList.add('super-sonic');
    } else {
      if (timerFill) timerFill.classList.remove('super-sonic');
    }

    // Fade out 3 seconds before round ends
    const fadeStartTime = roundDuration - 3000;
    if (!fadeOutStarted && elapsed >= fadeStartTime) {
      fadeOutStarted = true;
      startFadeOut();
      if (voteExtendBtn) {
        voteExtendBtn.disabled = true;
        voteExtendBtn.style.opacity = '0.5';
      }
    }

    if (remaining <= 0) {
      timerManager.clear('vgm-round-timer');
      onProgressUpdate(100);
    }
  }, 100);
}

/**
 * Start audio fade-out over 3 seconds
 */
function startFadeOut() {
  if (!audioPlayer) return;

  const fadeDuration = 3000;
  const fadeSteps = fadeDuration / 100;
  const startVolume = audioPlayer.volume;
  const volumeStep = startVolume / fadeSteps;

  timerManager.setInterval('vgm-audio-fade', () => {
    if (audioPlayer.volume > volumeStep) {
      audioPlayer.volume = Math.max(0, audioPlayer.volume - volumeStep);
    } else {
      audioPlayer.volume = 0;
      timerManager.clear('vgm-audio-fade');
    }
  }, 100);
}

/**
 * Restore audio volume (cancel fade)
 */
function restoreVolume() {
  timerManager.clear('vgm-audio-fade');
  if (audioPlayer) {
    audioPlayer.volume = volumeSlider ? volumeSlider.value / 100 : originalVolume;
  }
}

/**
 * Stop all timers
 */
function stop() {
  timerManager.clear('vgm-round-timer');
  timerManager.clear('vgm-audio-fade');
}

/**
 * Reset timer state for new round
 */
function reset() {
  fadeOutStarted = false;
  roundStartTime = 0;
  roundDuration = 0;
}

/**
 * Check if fade has started
 */
function isFading() {
  return fadeOutStarted;
}

/**
 * Get current round start time
 */
function getRoundStartTime() {
  return roundStartTime;
}

/**
 * Set original volume reference
 */
function setOriginalVolume(vol) {
  originalVolume = vol;
}

/**
 * Update round duration (for extensions)
 */
function setDuration(duration) {
  roundDuration = duration;
}

export const vgmTimer = {
  init,
  start,
  stop,
  reset,
  restoreVolume,
  isFading,
  getRoundStartTime,
  setOriginalVolume,
  setDuration
};
