let cursorX = window.innerWidth / 2;
let cursorY = 100;

document.addEventListener('mousemove', (e) => {
  cursorX = e.clientX;
  cursorY = e.clientY;
});

export function showCoinAnimation(amount, options = {}) {
  if (amount <= 0) return;

  const x = options.x ?? cursorX;
  const y = options.y ?? cursorY;

  const anim = document.createElement('div');
  anim.className = 'coin-float-animation';
  anim.textContent = `+${amount} $qr`;

  anim.style.left = (x + 10) + 'px';
  anim.style.top = (y - 20) + 'px';

  document.body.appendChild(anim);

  setTimeout(() => {
    if (anim.parentNode) {
      anim.remove();
    }
  }, 1500);
}

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
