import { escapeHtml } from '../../core/index.js';

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

function replaceEmoticons(text) {
  let result = text;
  for (const [code, file] of Object.entries(emoticonMap)) {
    const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    result = result.replace(regex, `<img src="emoticons/${file}" class="chat-emoticon" alt="${code}">`);
  }
  return result;
}

function letterSpans(text, cls, delayFor) {
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

  let result = '';
  let letterIndex = 0;
  let i = 0;

  while (i < processedText.length) {
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
      result += `<span class="${cls}" style="animation-delay: ${delayFor(letterIndex)}">${escapeHtml(processedText[i])}</span>`;
      letterIndex++;
      i++;
    }
  }

  return result;
}

const createWaveText = text => letterSpans(text, 'wave-letter', i => `${(i * 0.05) % 0.6}s`);
const WD = Array.from('♠♣♥♦☺☻♪♫☼►◄▲▼○●□■☆★✈✉✂✓✗☎☂');
const wingdings = text => Array.from(text).map(ch => { const i = ch.toLowerCase().charCodeAt(0) - 97; return i >= 0 && i < 26 ? WD[i] : ch; }).join('');
const EFFECT_CLASS = { rainbow: 'rainbow-text', blink: 'fx-blink', fire: 'fx-fire', ice: 'fx-ice', gold: 'fx-gold', flip: 'fx-flip', mirror: 'fx-mirror', spoiler: 'fx-spoiler' };

const PROGRESS_SEGMENT_COUNT = 20;
const MAX_MESSAGES = 100;

class VGMChat {
  constructor() {
    this.container = null;

    this.emit = null;

    this.playSound = null;

    this.currentUser = null;

    this.fontSettings = {
      size: 13,
      color: '#000000',
      nameColor: '#0000ff',
      effect: 'none'
    };

    this._progressSegments = null;

    this._fileNameElement = null;

    this._correctGame = null;

    this._correctSong = null;
  }

  init({ container, emit, playSound }) {
    this.container = container;
    this.emit = emit;
    this.playSound = playSound;
  }

  setCurrentUser(user) {
    this.currentUser = user;
  }

  setFontSettings(settings) {
    Object.assign(this.fontSettings, settings);
  }

  setCorrectAnswer(game, song) {
    this._correctGame = game;
    this._correctSong = song;
  }

  addMessage(message, className = '') {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = message;
    this.container.appendChild(p);
    this._trimMessages();
    this.container.scrollTop = this.container.scrollHeight;
  }

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
    } else if (options.action) {
      div.innerHTML = `<span class="msg-action">* ${escapeHtml(sender)} ${processMessage(message)}</span>`;
    } else {
      const fs = options.senderFontSettings || { size: 13, color: '#000000', nameColor: '#0000ff', effect: 'none' };
      const curse = options.curse;
      const font = curse === 'comic' ? 'comic' : (fs.font || 'normal');
      const onFire = (options.streak || 0) >= 3;
      const classes = ['msg-text', font !== 'normal' ? `font-${font}` : '', curse === 'mini' ? 'curse-mini' : '', curse === 'reves' ? 'fx-flip' : '', onFire ? 'on-fire' : ''];
      const effect = fs.effect || 'none';
      let inner;
      if (options.ink) inner = `<img class="ink-msg" src="${options.ink}" alt="">`;
      else if (effect === 'wave') { inner = createWaveText(message); classes.push('wave-text'); }
      else if (effect === 'quake') { inner = letterSpans(message, 'fx-letter', () => `-${(Math.random() * 0.15).toFixed(2)}s`); classes.push('fx-quake'); }
      else if (effect === 'type') { inner = letterSpans(message, 'fx-letter', i => `${(i * 0.04).toFixed(2)}s`); classes.push('fx-type'); }
      else if (effect === 'marquee') { inner = `<span>${processMessage(message)}</span>`; classes.push('fx-marquee'); }
      else if (effect === 'wingdings') inner = `<span class="fx-wd" data-t="${escapeHtml(message)}">${escapeHtml(wingdings(message))}</span>`;
      else { inner = processMessage(message); if (EFFECT_CLASS[effect]) classes.push(EFFECT_CLASS[effect]); }
      const style = `font-size: ${fs.size}px; color: ${fs.color};`;
      const nameStyle = `color: ${fs.nameColor};`;
      const verb = options.whisper ? `susurra a ${escapeHtml(options.whisper)}:` : 'dice:';
      if (options.whisper) div.classList.add('msg-whisper');
      div.innerHTML = `${options.bet ? '<span class="bet-chip"></span>' : ''}<span class="msg-sender${onFire ? ' fire-name' : ''}" style="${nameStyle}">${escapeHtml(sender)} ${verb}</span><br><span class="${classes.filter(Boolean).join(' ')}" style="${style}">${inner}</span>`;
      if (options.burn) setTimeout(() => { div.style.transition = 'opacity 1s'; div.style.opacity = '0'; setTimeout(() => div.remove(), 1000); }, 5000);
    }

    this.container.appendChild(div);
    this._trimMessages();
    this.container.scrollTop = this.container.scrollHeight;
  }

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

  updateProgress(percent) {
    if (!this._progressSegments) return;
    const filledCount = Math.min(PROGRESS_SEGMENT_COUNT, Math.round((percent / 100) * PROGRESS_SEGMENT_COUNT));
    this._progressSegments.forEach((segment, index) => {
      segment.classList.toggle('filled', index < filledCount);
    });
  }

  revealFileName() {
    if (this._fileNameElement && this._correctGame && this._correctSong) {
      const formatPart = (str) => str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const fileName = `${formatPart(this._correctGame)} - ${formatPart(this._correctSong)}.mp3`;
      this._fileNameElement.textContent = fileName;
    }
  }

  addCorrectGuess(playerName, timeInSeconds, isGame, sonicType = null) {
    const message = `${playerName} ha adivinado ${isGame ? 'el juego' : 'la canción'} en ${timeInSeconds.toFixed(2)} segundos`;

    const div = document.createElement('div');
    div.className = 'chat-msg';

    if (sonicType === 'ultra' || sonicType === 'super') {
      div.innerHTML = `<span class="rainbow-horizontal${sonicType === 'ultra' ? ' ultra-msg' : ''}">${escapeHtml(message)}</span>`;
    } else {
      div.innerHTML = `<span class="correct-guess-msg">${escapeHtml(message)}</span>`;
    }

    this.container.appendChild(div);
    this._trimMessages();
    this.container.scrollTop = this.container.scrollHeight;
  }

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

  clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this._progressSegments = null;
    this._fileNameElement = null;
    this._correctGame = null;
    this._correctSong = null;
  }

  _trimMessages() {
    if (!this.container) return;

    while (this.container.children.length > MAX_MESSAGES) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}

export const vgmChat = new VGMChat();

export { replaceEmoticons, createWaveText, emoticonMap };
