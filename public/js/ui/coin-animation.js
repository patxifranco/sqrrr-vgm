/**
 * Coin Animation Module
 *
 * Shows floating +$qr animations when coins are earned.
 */

// Track cursor position for animations
let cursorX = window.innerWidth / 2;
let cursorY = 100;

// Update cursor position
document.addEventListener('mousemove', (e) => {
  cursorX = e.clientX;
  cursorY = e.clientY;
});

/**
 * Show a floating coin animation
 * @param {number} amount - Amount of coins earned
 * @param {Object} options - Optional position override
 */
export function showCoinAnimation(amount, options = {}) {
  if (amount <= 0) return;

  const x = options.x ?? cursorX;
  const y = options.y ?? cursorY;

  const anim = document.createElement('div');
  anim.className = 'coin-float-animation';
  anim.textContent = `+${amount} $qr`;

  // Position near cursor (offset slightly up and right)
  anim.style.left = (x + 10) + 'px';
  anim.style.top = (y - 20) + 'px';

  document.body.appendChild(anim);

  // Remove after animation completes
  setTimeout(() => {
    if (anim.parentNode) {
      anim.remove();
    }
  }, 1500);
}

/**
 * Show multiple coin animations in sequence
 * @param {number} amount - Total amount
 * @param {number} count - Number of animations
 */
export function showCoinAnimationBurst(amount, count = 3) {
  const perAnimation = Math.ceil(amount / count);

  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      const remaining = amount - (i * perAnimation);
      const showAmount = Math.min(perAnimation, remaining);
      if (showAmount > 0) {
        showCoinAnimation(showAmount, {
          x: cursorX + (Math.random() - 0.5) * 40,
          y: cursorY + (Math.random() - 0.5) * 40
        });
      }
    }, i * 200);
  }
}

export default { showCoinAnimation, showCoinAnimationBurst };
