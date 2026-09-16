let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartLeft = 0;
let dragStartTop = 0;

let isResizing = false;
let resizeEdge = null;
let startX = 0;
let startY = 0;
let startWidth = 0;
let startHeight = 0;
let startLeft = 0;
let startTop = 0;

let gameWindow = null;
let guessInput = null;

const listeners = {
  dragMove: null,
  dragEnd: null,
  resizeMove: null,
  resizeEnd: null,
  windowFocus: null,
  visibilityChange: null
};

function getCursorStyle(edge) {
  if (!edge) return 'default';
  const cursors = {
    'n': 'ns-resize', 's': 'ns-resize',
    'e': 'ew-resize', 'w': 'ew-resize',
    'ne': 'nesw-resize', 'sw': 'nesw-resize',
    'nw': 'nwse-resize', 'se': 'nwse-resize'
  };
  return cursors[edge] || 'default';
}

function init(elements, documentListeners) {
  gameWindow = elements.gameWindow;
  guessInput = elements.guessInput;
  const titlebar = elements.titlebar;
  const resizeHandles = elements.resizeHandles || [];

  if (!gameWindow) return;

  if (titlebar) {
    titlebar.style.cursor = 'move';

    titlebar.addEventListener('mousedown', (e) => {
      if (e.target.closest('.title-bar-controls')) return;
      if (e.target.closest('.title-bar-theme')) return;
      if (e.target.closest('select')) return;

      e.preventDefault();
      isDragging = true;

      const rect = gameWindow.getBoundingClientRect();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartLeft = rect.left;
      dragStartTop = rect.top;

      gameWindow.style.setProperty('position', 'fixed', 'important');
      gameWindow.style.setProperty('left', rect.left + 'px', 'important');
      gameWindow.style.setProperty('top', rect.top + 'px', 'important');

      document.body.style.userSelect = 'none';
    });
  }

  listeners.dragMove = (e) => {
    if (!isDragging) return;

    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    let newLeft = dragStartLeft + dx;
    let newTop = dragStartTop + dy;

    const rect = gameWindow.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    newLeft = Math.max(0, Math.min(window.innerWidth - width, newLeft));
    newTop = Math.max(0, Math.min(window.innerHeight - height, newTop));

    gameWindow.style.setProperty('left', newLeft + 'px', 'important');
    gameWindow.style.setProperty('top', newTop + 'px', 'important');
  };
  document.addEventListener('mousemove', listeners.dragMove);
  if (documentListeners) documentListeners.dragMove = listeners.dragMove;

  listeners.dragEnd = () => {
    if (isDragging) {
      isDragging = false;
      document.body.style.userSelect = '';
    }
  };
  document.addEventListener('mouseup', listeners.dragEnd);
  if (documentListeners) documentListeners.dragEnd = listeners.dragEnd;

  resizeHandles.forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
      if (!gameWindow) return;
      e.preventDefault();
      e.stopPropagation();

      isResizing = true;
      resizeEdge = handle.dataset.edge;

      const rect = gameWindow.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startWidth = rect.width;
      startHeight = rect.height;
      startLeft = rect.left;
      startTop = rect.top;

      document.body.style.cursor = getCursorStyle(resizeEdge);
      document.body.style.userSelect = 'none';
    });
  });

  listeners.resizeMove = (e) => {
    if (!isResizing || !resizeEdge || !gameWindow) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    if (resizeEdge.indexOf('e') !== -1) {
      newWidth = Math.max(500, startWidth + dx);
    }
    if (resizeEdge.indexOf('w') !== -1) {
      const proposedWidth = startWidth - dx;
      if (proposedWidth >= 500) {
        newWidth = proposedWidth;
        newLeft = startLeft + dx;
      }
    }
    if (resizeEdge.indexOf('s') !== -1) {
      newHeight = Math.max(400, startHeight + dy);
    }
    if (resizeEdge.indexOf('n') !== -1) {
      const proposedHeight = startHeight - dy;
      if (proposedHeight >= 400) {
        newHeight = proposedHeight;
        newTop = startTop + dy;
      }
    }

    gameWindow.style.setProperty('position', 'fixed', 'important');
    gameWindow.style.setProperty('width', newWidth + 'px', 'important');
    gameWindow.style.setProperty('height', newHeight + 'px', 'important');
    gameWindow.style.setProperty('left', newLeft + 'px', 'important');
    gameWindow.style.setProperty('top', newTop + 'px', 'important');
  };
  document.addEventListener('mousemove', listeners.resizeMove);
  if (documentListeners) documentListeners.resizeMove = listeners.resizeMove;

  listeners.resizeEnd = () => {
    if (isResizing) {
      isResizing = false;
      resizeEdge = null;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';
    }
  };
  document.addEventListener('mouseup', listeners.resizeEnd);
  if (documentListeners) documentListeners.resizeEnd = listeners.resizeEnd;

  listeners.windowFocus = () => {
    if (guessInput && !guessInput.disabled) {
      guessInput.focus();
    }
  };
  window.addEventListener('focus', listeners.windowFocus);
  if (documentListeners) documentListeners.windowFocus = listeners.windowFocus;

  listeners.visibilityChange = () => {
    if (!document.hidden && guessInput && !guessInput.disabled) {
      setTimeout(() => guessInput.focus(), 100);
    }
  };
  document.addEventListener('visibilitychange', listeners.visibilityChange);
  if (documentListeners) documentListeners.visibilityChange = listeners.visibilityChange;
}

function cleanup() {
  if (listeners.dragMove) {
    document.removeEventListener('mousemove', listeners.dragMove);
    listeners.dragMove = null;
  }
  if (listeners.dragEnd) {
    document.removeEventListener('mouseup', listeners.dragEnd);
    listeners.dragEnd = null;
  }
  if (listeners.resizeMove) {
    document.removeEventListener('mousemove', listeners.resizeMove);
    listeners.resizeMove = null;
  }
  if (listeners.resizeEnd) {
    document.removeEventListener('mouseup', listeners.resizeEnd);
    listeners.resizeEnd = null;
  }
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
