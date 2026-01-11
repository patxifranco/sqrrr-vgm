/**
 * VGM Socket Handlers Module - All VGM-scoped socket event handlers
 *
 * Handles:
 * - Lobby/room events (lobbyCreated, lobbyJoined, vgmJoined)
 * - Player list updates
 * - Round lifecycle (roundStart, roundEnd, roundComplete)
 * - Guessing (guessResult, correctGuess, closeGuess)
 * - Hints (hintResult, playerUsedHint)
 * - Chat (gameChatMessage, sqrrrMessage, chatHistory)
 * - Game features (nudge, extend, easter eggs)
 */

import { socketManager, audioManager, escapeHtml } from '../../core/index.js';

// Module state
let deps = null;
let countdownMessages = {};

/**
 * Initialize socket handlers with dependencies
 * @param {Object} dependencies - All required dependencies
 */
function init(dependencies) {
  deps = dependencies;
  countdownMessages = {};
  setupHandlers();
}

/**
 * Setup all VGM-scoped socket event handlers
 */
function setupHandlers() {
  const {
    socket,
    state,
    ui,
    timer,
    chat,
    log,
    showCoinAnimation,
    playNotifySound
  } = deps;

  // Lobby created
  socketManager.on('lobbyCreated', ({ roomCode, playerName }) => {
    state.setRoom(roomCode);
    ui.setRoomCode(roomCode);
    ui.showScreen('lobby');
  }, 'vgm');

  // Lobby joined
  socketManager.on('lobbyJoined', ({ roomCode, playerName }) => {
    state.setRoom(roomCode);
    ui.setRoomCode(roomCode);
    ui.showScreen('lobby');
  }, 'vgm');

  // VGM joined - go straight to game screen (single global lobby)
  socketManager.on('vgmJoined', ({
    roomCode,
    playerName,
    roundActive: isRoundActive,
    autoPlayActive: isAutoPlayActive,
    roundNumber: currentRoundNum,
    currentAudioToken,
    roundStartTime: serverRoundStartTime,
    roundDuration: serverRoundDuration
  }) => {
    state.setRoom(roomCode);
    ui.setRoomCode('VGM');
    state.resetLastPlayerCount();

    ui.updateGameUserInfo();
    ui.resetRoundState();
    ui.showScreen('game');

    // If round is active, sync with it
    if (isRoundActive && currentAudioToken) {
      state.setRoundActive(true);
      ui.setRoundNumber(currentRoundNum);

      const elapsed = Date.now() - serverRoundStartTime;
      const remaining = serverRoundDuration - elapsed;

      if (remaining > 0) {
        const initialProgress = (elapsed / serverRoundDuration) * 100;

        chat.addFileTransfer(initialProgress);
        ui.playAudio(`/audio-stream/${currentAudioToken}`, elapsed / 1000);
        timer.start(serverRoundDuration, serverRoundStartTime);

        chat.addMsnMessage('SQRRR', 'Te has unido a una ronda en progreso', false);
      }
    } else if (isAutoPlayActive) {
      chat.addMsnMessage('SQRRR', 'Bienvenido a SQRRR VGM. Esperando siguiente ronda...', false);
    } else {
      chat.addMsnMessage('SQRRR', 'Bienvenido a SQRRR VGM', false);
      window.showStartButtonAfterHistory = true;
    }
  }, 'vgm');

  // Player list update
  socketManager.on('playerList', (players) => {
    const lastCount = state.getLastPlayerCount();
    if (players.length > lastCount && lastCount > 0) {
      playNotifySound();
    }
    state.setLastPlayerCount(players.length);

    ui.updatePlayerList(players);

    const me = players.find(p => p.id === socket.id);
    if (me && me.hintPoints !== undefined) {
      state.setHintPoints(me.hintPoints);
      ui.updateHintDisplay();
    }
  }, 'vgm');

  // Chat message (lobby)
  socketManager.on('chatMessage', ({ system, message }) => {
    ui.addLobbyChatMessage(message, system);
  }, 'vgm');

  // Round start
  socketManager.on('roundStart', ({ roundNumber: num, audioToken, duration }) => {
    log.info(`Round ${num} starting`);
    ui.resetRoundState();
    state.setRoundActive(true);
    ui.setRoundNumber(num);
    ui.showScreen('game');
    ui.setStartButtonEnabled(false);
    ui.updateGameUserInfo();

    chat.addFileTransfer();
    ui.playAudio(`/audio-stream/${audioToken}`, 0, (durationMs) => {
      socket.emit('reportAudioDuration', { duration: durationMs });
    });

    audioManager.resume();
    timer.start(duration);
    ui.focusGuessInput();
  }, 'vgm');

  // Guess result
  socketManager.on('guessResult', ({ correct, type, sonicType, timeElapsed }) => {
    if (correct) {
      const time = timeElapsed || timer.getElapsedSeconds();

      if (type === 'game') {
        state.setGuessedGame(true);
        ui.showGameGuessed();
        ui.disableHint();

        chat.addCorrectGuess(state.getCurrentUsername(), time, true, sonicType);

        if (sonicType) {
          chat.addSonicBonus(state.getCurrentUsername(), sonicType);
        } else {
          audioManager.playOneShot('correct.mp3', { volume: 0.8 });
        }
      }
    } else {
      ui.shakeInput();
    }
  }, 'vgm');

  // Round complete - everyone guessed
  socketManager.on('roundComplete', () => {
    // Input stays enabled for chat
  }, 'vgm');

  // Someone guessed correctly
  socketManager.on('correctGuess', ({ playerName, type, sonicType, timeElapsed }) => {
    if (state.getCurrentUsername() && playerName !== state.getCurrentUsername()) {
      const time = timeElapsed || timer.getElapsedSeconds();
      chat.addCorrectGuess(playerName, time, type === 'game', sonicType);

      if (sonicType) {
        chat.addSonicBonus(playerName, sonicType);
      }
    }
  }, 'vgm');

  // Hint result
  socketManager.on('hintResult', ({ success, hint, hintPoints: newPoints, reason }) => {
    if (success) {
      state.setHintPoints(newPoints);
      state.setUsedHintThisRound(true);
      ui.updateHintDisplay();
      chat.addMsnMessage('SQRRR', `Pista: ${hint}`, false);
    } else {
      chat.addMsnMessage('SQRRR', reason, false);
    }
  }, 'vgm');

  // Someone used a hint
  socketManager.on('playerUsedHint', ({ playerName }) => {
    if (state.getCurrentUsername() && playerName !== state.getCurrentUsername()) {
      chat.addMsnMessage('', `${playerName} used a hint`, true);
    }
  }, 'vgm');

  // Round end
  socketManager.on('roundEnd', ({ correctGame, correctSong, players }) => {
    log.info('Round ended', { correctGame, correctSong });
    timer.stop();
    state.setRoundActive(false);
    audioManager.pause();

    chat.updateProgress(100);
    chat.setCorrectAnswer(correctGame, correctSong);

    ui.updatePlayerList(players);
    ui.disableHint();
    ui.setStartButtonEnabled(true);
  }, 'vgm');

  // SQRRR messages (auto-play countdown)
  socketManager.on('sqrrrMessage', ({ message, isBold, isRecord }) => {
    if (isRecord) {
      chat.addRecordMessage(message);
    } else {
      chat.addMsnMessage('SQRRR', message, false, { isBold });
    }

    if (message.includes('La canción era')) {
      chat.revealFileName();
    }
  }, 'vgm');

  // Coins earned
  socketManager.on('coinsEarned', ({ amount, total }) => {
    showCoinAnimation(amount);
    log.info(`Earned ${amount} $qr, total: ${total}`);
  }, 'vgm');

  // Edit-based countdown
  socketManager.on('sqrrrCountdown', ({ id, message }) => {
    let countdownDiv = countdownMessages[id];

    if (!countdownDiv) {
      countdownDiv = chat.createCountdownElement(message);
      countdownMessages[id] = countdownDiv;
    } else {
      countdownDiv.querySelector('.countdown-text').innerHTML = message;
    }

    chat.scrollToBottom();
  }, 'vgm');

  // Chat messages from all players
  socketManager.on('gameChatMessage', ({ sender, message, profilePicture, fontSettings }) => {
    chat.addMsnMessage(sender, message, false, { senderFontSettings: fontSettings });
  }, 'vgm');

  // Nudge received
  socketManager.on('nudgeReceived', () => {
    audioManager.play('nudge', { volume: 0.1 });
    ui.shakeScreen();
  }, 'vgm');

  // Close guess
  socketManager.on('closeGuess', ({ guess, type, percentage }) => {
    chat.addCloseGuessMessage(guess, percentage);
    audioManager.playOneShot('close.mp3', { volume: 0.8 });
  }, 'vgm');

  // Easter eggs
  socketManager.on('easterEgg', ({ type, message }) => {
    chat.addSystemMessage(message);
  }, 'vgm');

  // New record
  socketManager.on('newRecord', ({ player, time, previousPlayer, previousTime }) => {
    audioManager.playOneShot('supersonic.mp3', { volume: 0.8 });
  }, 'vgm');

  // Audio duration update
  socketManager.on('audioDurationUpdate', ({ duration }) => {
    state.setFullAudioDuration(duration);
  }, 'vgm');

  // Extend votes update
  socketManager.on('extendVotesUpdate', ({ votes, needed, totalPlayers }) => {
    ui.updateExtendVotes(votes, needed);
  }, 'vgm');

  // Round extended
  socketManager.on('roundExtended', ({ newDuration }) => {
    state.setExtended(true);
    timer.setDuration(newDuration);
    timer.restoreVolume();
    ui.disableExtendVote();
    chat.addMsnMessage('SQRRR', 'La ronda se ha extendido hasta el final de la canción', false);
  }, 'vgm');

  // Chat history
  socketManager.on('chatHistory', (history) => {
    history.forEach(msg => {
      if (msg.type === 'guess') {
        chat.addMsnMessage(msg.sender, msg.message, false);
      } else if (msg.type === 'system') {
        chat.addMsnMessage(msg.sender, msg.message, false, { isBold: true });
      }
    });

    if (window.showStartButtonAfterHistory) {
      window.showStartButtonAfterHistory = false;
      chat.addStartButton();
    }
  }, 'vgm');

  // Typing updates
  socketManager.on('typingUpdate', ({ typing }) => {
    const currentUsername = state.getCurrentUsername();
    const othersTyping = typing.filter(name => name !== currentUsername);
    ui.updateTypingIndicator(othersTyping);
  }, 'vgm');
}

/**
 * Cleanup - clear countdown messages cache
 */
function cleanup() {
  countdownMessages = {};
}

export const vgmSocketHandlers = {
  init,
  cleanup
};
