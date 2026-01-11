/**
 * Windows XP/Vista Style Popup
 *
 * Replaces browser alert() with a styled modal popup.
 */

/**
 * Show a Windows-style popup message
 * @param {string} message - The message to display
 * @param {Object} options - Optional settings
 * @param {string} options.title - Window title (default: "SQRRR")
 * @param {string} options.buttonText - Button text (default: "Aceptar")
 * @param {Function} options.onClose - Callback when closed
 */
export function showPopup(message, options = {}) {
  const {
    title = 'SQRRR',
    buttonText = 'Aceptar',
    onClose = null
  } = options;

  // Remove existing popup if any
  const existing = document.querySelector('.sqrrr-popup-overlay');
  if (existing) existing.remove();

  // Create popup
  const overlay = document.createElement('div');
  overlay.className = 'sqrrr-popup-overlay';
  overlay.innerHTML = `
    <div class="window sqrrr-popup-window">
      <div class="title-bar">
        <div class="title-bar-text">${title}</div>
        <div class="title-bar-controls">
          <button aria-label="Close" class="sqrrr-popup-close"></button>
        </div>
      </div>
      <div class="window-body sqrrr-popup-body">
        <div class="sqrrr-popup-content">
          <span class="sqrrr-popup-icon">&#x26A0;</span>
          <p class="sqrrr-popup-message">${message}</p>
        </div>
        <div class="sqrrr-popup-buttons">
          <button class="sqrrr-popup-btn">${buttonText}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Force reflow then add active class for animation
  overlay.offsetHeight;
  overlay.classList.add('active');

  // ESC key handler - defined before closePopup so it can be cleaned up
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closePopup();
    }
  };

  const closePopup = () => {
    // Always remove ESC listener when popup closes
    document.removeEventListener('keydown', escHandler);
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      if (onClose) onClose();
    }, 150);
  };

  // Close button in title bar
  overlay.querySelector('.sqrrr-popup-close').addEventListener('click', closePopup);

  // Accept button
  overlay.querySelector('.sqrrr-popup-btn').addEventListener('click', closePopup);

  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePopup();
  });

  // Add ESC listener
  document.addEventListener('keydown', escHandler);

  // Focus the button
  overlay.querySelector('.sqrrr-popup-btn').focus();
}

export default showPopup;
