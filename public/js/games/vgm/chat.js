/**
 * VGM Chat Module - MSN-style chat functionality
 *
 * Handles:
 * - Message rendering with emoticons and custom fonts
 * - File transfer progress display
 * - Correct guess celebrations
 * - System messages
 */

import { escapeHtml } from '../../core/index.js';

// ==================== EMOTICONS ====================
// Map emoticon codes to image files - matches HTML popup codes exactly
const emoticonMap = {
  ':)': 'regular_smile.png',
  ':D': 'teeth_smile.png',
  ':O': 'omg_smile.png',
  ':P': 'tongue_smile.png',
  ';)': 'wink_smile.gif',
  ':(': 'sad_smile.png',
  ':S': 'confused_smile.png',
  ':|': 'what_face.png',
  ":'(": 'cry_smile.gif',
  ':$': 'red_smile.png',
  '8)': 'shades_smile.png',
  ':@': 'angry_smile.png',
  '(A)': 'angel_smile.png',
  '(6)': 'devil_smile.png',
  ':*': 'kiss.png',
  // Custom numbered emoticons
  '(47)': '47_47.png',
  '(48)': '48_48.png',
  '(49)': '49_49.png',
  '(50)': '50_50.png',
  '(51)': '51_51.png',
  '(52)': '52_52.png',
  '(71)': '71_71.png',
  '(72)': '72_72.png',
  '(74)': '74_74.gif',
  '(77)': '77_77.png'
};

/**
 * Replace emoticon codes with images in text
 */
function replaceEmoticons(text) {
  let result = text;
  for (const [code, file] of Object.entries(emoticonMap)) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    result = result.replace(regex, `<img src="emoticons/${file}" class="chat-emoticon" alt="${code}">`);
  }
  return result;
}

/**
 * Create wave text with staggered animation for each letter
 * Emoticons are preserved as static images (not animated)
 */
function createWaveText(text) {
  // First, find all emoticon positions and replace with placeholders
  const emoticons = [];
  let processedText = text;

  for (const [code, file] of Object.entries(emoticonMap)) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    let match;
    while ((match = regex.exec(processedText)) !== null) {
      const placeholder = `\x00EMO${emoticons.length}\x00`;
      emoticons.push({ code, file, index: match.index });
      processedText = processedText.slice(0, match.index) + placeholder + processedText.slice(match.index + code.length);
      regex.lastIndex = match.index + placeholder.length;
    }
  }

  // Now apply wave to text, preserving placeholders
  let result = '';
  let letterIndex = 0;
  let i = 0;

  while (i < processedText.length) {
    // Check for emoticon placeholder
    if (processedText.slice(i).startsWith('\x00EMO')) {
      const endIndex = processedText.indexOf('\x00', i + 4);
      const emoIndex = parseInt(processedText.slice(i + 4, endIndex));
      const emo = emoticons[emoIndex];
      result += `<img src="emoticons/${emo.file}" class="chat-emoticon" alt="${emo.code}">`;
      i = endIndex + 1;
    } else if (processedText[i] === ' ') {
      result += ' ';
      i++;
    } else {
      const delay = (letterIndex * 0.05) % 0.6;
      result += `<span class="wave-letter" style="animation-delay: ${delay}s">${escapeHtml(processedText[i])}</span>`;
      letterIndex++;
      i++;
    }
  }

  return result;
}

// ==================== CHAT MANAGER CLASS ====================
const PROGRESS_SEGMENT_COUNT = 20;
const MAX_MESSAGES = 100;

class VGMChat {
  constructor() {
    /** @type {HTMLElement|null} */
    this.container = null;

    /** @type {Function|null} Socket emit function */
    this.emit = null;

    /** @type {Function|null} Audio play function */
    this.playSound = null;

    /** @type {Object|null} Current user info */
    this.currentUser = null;

    /** @type {Object} User font settings */
    this.fontSettings = {
      size: 13,
      color: '#000000',
      nameColor: '#0000ff',
      effect: 'none'
    };

    /** @type {NodeList|null} Current file transfer segments */
    this._progressSegments = null;

    /** @type {HTMLElement|null} Current file name element */
    this._fileNameElement = null;

    /** @type {string|null} Current correct game */
    this._correctGame = null;

    /** @type {string|null} Current correct song */
    this._correctSong = null;
  }

  /**
   * Initialize the chat module
   * @param {Object} options
   * @param {HTMLElement} options.container - Chat messages container
   * @param {Function} options.emit - Socket emit function
   * @param {Function} [options.playSound] - Audio play function
   */
  init({ container, emit, playSound }) {
    this.container = container;
    this.emit = emit;
    this.playSound = playSound;
  }

  /**
   * Set current user for message styling
   */
  setCurrentUser(user) {
    this.currentUser = user;
  }

  /**
   * Update font settings
   */
  setFontSettings(settings) {
    Object.assign(this.fontSettings, settings);
  }

  /**
   * Set correct answer for file name reveal
   */
  setCorrectAnswer(game, song) {
    this._correctGame = game;
    this._correctSong = song;
  }

  /**
   * Add a simple message (legacy format)
   */
  addMessage(message, className = '') {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = message;
    this.container.appendChild(p);
    this._trimMessages();
    this.container.scrollTop = this.container.scrollHeight;
  }

  /**
   * Add MSN-style chat message
   */
  addMsnMessage(sender, message, isSystem = false, options = {}) {
    const div = document.createElement('div');
    div.className = 'chat-msg';

    const processMessage = (msg) => replaceEmoticons(escapeHtml(msg));

    if (isSystem) {
      div.innerHTML = `<span class="msg-system">${processMessage(message)}</span>`;
    } else if (options.isBold) {
      div.innerHTML = `<span class="msg-sender sqrrr-msg">${escapeHtml(sender)} dice:</span><br><span class="msg-text">${message}</span>`;
    } else if (options.isRainbow) {
      div.innerHTML = `<span class="msg-sender">${escapeHtml(sender)} dice:</span><br><span class="msg-text rainbow-text">${processMessage(message)}</span>`;
    } else {
      // Use sender's font settings if provided, otherwise use defaults
      const fs = options.senderFontSettings || { size: 13, color: '#000000', nameColor: '#0000ff', effect: 'none' };
      const style = `font-size: ${fs.size}px; color: ${fs.color};`;
      const nameStyle = `color: ${fs.nameColor};`;

      if (fs.effect === 'wave') {
        const waveContent = createWaveText(message);
        div.innerHTML = `<span class="msg-sender" style="${nameStyle}">${escapeHtml(sender)} dice:</span><br><span class="msg-text wave-text" style="${style}">${waveContent}</span>`;
      } else {
        div.innerHTML = `<span class="msg-sender" style="${nameStyle}">${escapeHtml(sender)} dice:</span><br><span class="msg-text" style="${style}">${processMessage(message)}</span>`;
      }
    }

    this.container.appendChild(div);
    this._trimMessages();
    this.container.scrollTop = this.container.scrollHeight;
  }

  /**
   * Add "Empezar VGM" button
   */
  addStartButton() {
    const div = document.createElement('div');
    div.className = 'chat-msg start-vgm-container';
    div.innerHTML = `<button class="start-vgm-btn" id="start-vgm-chat-btn">Empezar VGM</button>`;
    this.container.appendChild(div);
    this._trimMessages();
    this.container.scrollTop = this.container.scrollHeight;

    const btn = div.querySelector('.start-vgm-btn');
    btn.addEventListener('click', () => {
      btn.disabled = true;
      btn.textContent = 'Iniciando...';
      if (this.emit) this.emit('startRound');
    });
  }

  /**
   * Add file transfer progress display
   */
  addFileTransfer(initialProgress = 0) {
    const randomSize = Math.floor(Math.random() * 500) + 100;

    const segmentsHtml = Array(PROGRESS_SEGMENT_COUNT).fill(0).map(() =>
      '<div class="msn-file-progress-segment"></div>'
    ).join('');

    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `
      <span class="msg-sender sqrrr-msg">SQRRR dice:</span><br>
      <span class="msg-text">- envía:</span>
      <div class="msn-file-transfer">
        <img src="file.png" class="msn-file-icon-img" alt="file">
        <div class="msn-file-info">
          <div class="msn-file-name">???.mp3 (${randomSize} KB)</div>
          <div class="msn-file-progress">
            ${segmentsHtml}
          </div>
        </div>
      </div>
    `;
    this.container.appendChild(div);

    this._progressSegments = div.querySelectorAll('.msn-file-progress-segment');
    this._fileNameElement = div.querySelector('.msn-file-name');

    this.updateProgress(initialProgress);
    this._trimMessages();
    this.container.scrollTop = this.container.scrollHeight;
  }

  /**
   * Update file transfer progress
   */
  updateProgress(percent) {
    if (!this._progressSegments) return;
    const filledCount = Math.min(PROGRESS_SEGMENT_COUNT, Math.round((percent / 100) * PROGRESS_SEGMENT_COUNT));
    this._progressSegments.forEach((segment, index) => {
      segment.classList.toggle('filled', index < filledCount);
    });
  }

  /**
   * Reveal file name after answer
   */
  revealFileName() {
    if (this._fileNameElement && this._correctGame && this._correctSong) {
      const formatPart = (str) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fileName = `${formatPart(this._correctGame)} - ${formatPart(this._correctSong)}.mp3`;
      this._fileNameElement.textContent = fileName;
    }
  }

  /**
   * Add correct guess message with celebration
   */
  addCorrectGuess(playerName, timeInSeconds, isGame, sonicType = null) {
    const message = `${playerName} ha adivinado ${isGame ? 'el juego' : 'la canción'} en ${timeInSeconds.toFixed(2)} segundos`;

    const div = document.createElement('div');
    div.className = 'chat-msg';

    if (sonicType === 'ultra' || sonicType === 'super') {
      div.innerHTML = `<span class="rainbow-horizontal">${escapeHtml(message)}</span>`;
    } else {
      div.innerHTML = `<span class="correct-guess-msg">${escapeHtml(message)}</span>`;
    }

    this.container.appendChild(div);
    this._trimMessages();
    this.container.scrollTop = this.container.scrollHeight;
  }

  /**
   * Add sonic bonus message
   */
  addSonicBonus(playerName, sonicType) {
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const bonusText = sonicType === 'ultra' ? 'ULTRA SONICO +3 puntos' : 'SUPER SONICO +2 puntos';
    div.innerHTML = `<span class="rainbow-horizontal sonic-bonus">${bonusText}</span>`;
    this.container.appendChild(div);
    this._trimMessages();
    this.container.scrollTop = this.container.scrollHeight;

    if (this.playSound) this.playSound('supersonic', { volume: 0.8 });
  }

  /**
   * Clear all messages
   */
  clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this._progressSegments = null;
    this._fileNameElement = null;
    this._correctGame = null;
    this._correctSong = null;
  }

  /**
   * Trim messages to keep only the last MAX_MESSAGES
   * Removes oldest messages when limit is exceeded
   */
  _trimMessages() {
    if (!this.container) return;

    while (this.container.children.length > MAX_MESSAGES) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}

// Singleton instance
export const vgmChat = new VGMChat();

// Also export utilities for direct use
export { replaceEmoticons, createWaveText, emoticonMap };
