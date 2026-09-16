export function showPopup(message, options = {}) {
  const {
    title = 'SQRRR',
    buttonText = 'Aceptar',
    onClose = null
  } = options;

  const existing = document.querySelector('.sqrrr-popup-overlay');
  if (existing) existing.remove();

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

  overlay.offsetHeight;
  overlay.classList.add('active');

  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closePopup();
    }
  };

  const closePopup = () => {
    document.removeEventListener('keydown', escHandler);
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.remove();
      if (onClose) onClose();
    }, 150);
  };

  overlay.querySelector('.sqrrr-popup-close').addEventListener('click', closePopup);

  overlay.querySelector('.sqrrr-popup-btn').addEventListener('click', closePopup);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePopup();
  });

  document.addEventListener('keydown', escHandler);

  overlay.querySelector('.sqrrr-popup-btn').focus();
}

export default showPopup;
