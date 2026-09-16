import { timerManager } from '../../core/index.js';

let roundStartTime = 0;
let roundDuration = 0;
let fadeOutStarted = false;
let originalVolume = 1;

let timerFill = null;
let timerText = null;
let audioPlayer = null;
let volumeSlider = null;
let voteExtendBtn = null;

let onProgressUpdate = null;

function init(elements) {
  timerFill = elements.timerFill;
  timerText = elements.timerText;
  audioPlayer = elements.audioPlayer;
  volumeSlider = elements.volumeSlider;
  voteExtendBtn = elements.voteExtendBtn;
  onProgressUpdate = elements.onProgressUpdate || (() => {});
}

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

    if (elapsed <= 3000) {
      if (timerFill) timerFill.classList.add('super-sonic');
    } else {
      if (timerFill) timerFill.classList.remove('super-sonic');
    }

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

function restoreVolume() {
  timerManager.clear('vgm-audio-fade');
  if (audioPlayer) {
    audioPlayer.volume = volumeSlider ? volumeSlider.value / 100 : originalVolume;
  }
}

function stop() {
  timerManager.clear('vgm-round-timer');
  timerManager.clear('vgm-audio-fade');
}

function reset() {
  fadeOutStarted = false;
  roundStartTime = 0;
  roundDuration = 0;
}

function isFading() {
  return fadeOutStarted;
}

function getRoundStartTime() {
  return roundStartTime;
}

function setOriginalVolume(vol) {
  originalVolume = vol;
}

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
