const listeners = {
  windowFocus: null,
  visibilityChange: null
};

function init(elements, documentListeners) {
  const guessInput = elements.guessInput;

  listeners.windowFocus = () => {
    if (guessInput && !guessInput.disabled && !document.activeElement?.closest('.va-mini')) {
      guessInput.focus();
    }
  };
  window.addEventListener('focus', listeners.windowFocus);
  if (documentListeners) documentListeners.windowFocus = listeners.windowFocus;

  listeners.visibilityChange = () => {
    if (!document.hidden && guessInput && !guessInput.disabled && !document.activeElement?.closest('.va-mini')) {
      setTimeout(() => guessInput.focus(), 100);
    }
  };
  document.addEventListener('visibilitychange', listeners.visibilityChange);
  if (documentListeners) documentListeners.visibilityChange = listeners.visibilityChange;
}

function cleanup() {
  if (listeners.windowFocus) {
    window.removeEventListener('focus', listeners.windowFocus);
    listeners.windowFocus = null;
  }
  if (listeners.visibilityChange) {
    document.removeEventListener('visibilitychange', listeners.visibilityChange);
    listeners.visibilityChange = null;
  }
}

export const windowControls = {
  init,
  cleanup
};
