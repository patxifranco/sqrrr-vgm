const activeCards = new WeakMap();

export function initCard3D(cardElement, options = {}) {
  if (!cardElement || activeCards.has(cardElement)) return;

  const { animate = false } = options;

  const config = {
    maxRotation: 25,
    perspective: 1500,
    entranceDuration: 1500,
    entranceStartRotateY: -120,
    entranceStartRotateX: 30,
    entranceStartScale: 0.3
  };

  let rect = cardElement.getBoundingClientRect();
  let isHovering = false;
  let mouseRotateX = 0;
  let mouseRotateY = 0;
  let isDestroyed = false;

  let entranceProgress = animate ? 0 : 1;
  let entranceStartTime = animate ? performance.now() : 0;
  let animationFrameId = null;
  let resetAnimationId = null;

  const updateRect = () => {
    rect = cardElement.getBoundingClientRect();
  };

  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const applyTransform = () => {
    const entranceRotateY = config.entranceStartRotateY * (1 - easeOutCubic(entranceProgress));
    const entranceRotateX = config.entranceStartRotateX * (1 - easeOutCubic(entranceProgress));
    const scale = config.entranceStartScale + (1 - config.entranceStartScale) * easeOutCubic(entranceProgress);
    const opacity = easeOutCubic(entranceProgress);

    const totalRotateX = entranceRotateX + mouseRotateX;
    const totalRotateY = entranceRotateY + mouseRotateY;

    cardElement.style.opacity = opacity;
    cardElement.style.transform = `rotateY(${totalRotateY}deg) rotateX(${totalRotateX}deg) scale(${scale})`;
  };

  const animationLoop = (currentTime) => {
    if (isDestroyed) return;
    if (entranceProgress < 1) {
      const elapsed = currentTime - entranceStartTime;
      entranceProgress = Math.min(1, elapsed / config.entranceDuration);
      applyTransform();
      animationFrameId = requestAnimationFrame(animationLoop);
    }
  };

  const startResetAnimation = () => {
    if (resetAnimationId || isDestroyed) return;

    const resetAnimation = () => {
      if (isDestroyed || isHovering) {
        resetAnimationId = null;
        return;
      }

      const decay = 0.9;
      mouseRotateX *= decay;
      mouseRotateY *= decay;

      const currentBgX = parseFloat(cardElement.style.getPropertyValue('--background-x')) || 50;
      const currentBgY = parseFloat(cardElement.style.getPropertyValue('--background-y')) || 50;
      const newBgX = currentBgX + (50 - currentBgX) * (1 - decay);
      const newBgY = currentBgY + (50 - currentBgY) * (1 - decay);

      cardElement.style.setProperty('--pointer-x', `${newBgX}%`);
      cardElement.style.setProperty('--pointer-y', `${newBgY}%`);
      cardElement.style.setProperty('--background-x', `${newBgX}%`);
      cardElement.style.setProperty('--background-y', `${newBgY}%`);

      applyTransform();

      if (Math.abs(mouseRotateX) > 0.1 || Math.abs(mouseRotateY) > 0.1) {
        resetAnimationId = requestAnimationFrame(resetAnimation);
      } else {
        mouseRotateX = 0;
        mouseRotateY = 0;
        cardElement.style.setProperty('--pointer-x', '50%');
        cardElement.style.setProperty('--pointer-y', '50%');
        cardElement.style.setProperty('--background-x', '50%');
        cardElement.style.setProperty('--background-y', '50%');
        applyTransform();
        resetAnimationId = null;
      }
    };

    resetAnimationId = requestAnimationFrame(resetAnimation);
  };

  const handleMouseMove = (e) => {
    if (!isHovering) return;

    if (resetAnimationId) {
      cancelAnimationFrame(resetAnimationId);
      resetAnimationId = null;
    }

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));

    mouseRotateY = (clampedX - 0.5) * config.maxRotation * 2;
    mouseRotateX = (0.5 - clampedY) * config.maxRotation * 2;

    const bgX = clampedX * 100;
    const bgY = clampedY * 100;

    cardElement.style.setProperty('--pointer-x', `${bgX}%`);
    cardElement.style.setProperty('--pointer-y', `${bgY}%`);
    cardElement.style.setProperty('--background-x', `${bgX}%`);
    cardElement.style.setProperty('--background-y', `${bgY}%`);

    applyTransform();
  };

  const handleMouseEnter = () => {
    isHovering = true;
    updateRect();
  };

  const handleMouseLeave = () => {
    isHovering = false;
    startResetAnimation();
  };

  const handleTouchMove = (e) => {
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    handleMouseMove({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  };

  const handleTouchStart = (e) => {
    isHovering = true;
    updateRect();
    if (e.touches.length === 1) {
      handleTouchMove(e);
    }
  };

  const handleTouchEnd = () => {
    handleMouseLeave();
  };

  cardElement.addEventListener('mouseenter', handleMouseEnter);
  cardElement.addEventListener('mousemove', handleMouseMove);
  cardElement.addEventListener('mouseleave', handleMouseLeave);
  cardElement.addEventListener('touchstart', handleTouchStart, { passive: true });
  cardElement.addEventListener('touchmove', handleTouchMove, { passive: true });
  cardElement.addEventListener('touchend', handleTouchEnd);
  window.addEventListener('resize', updateRect);

  activeCards.set(cardElement, () => {
    isDestroyed = true;
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    if (resetAnimationId) cancelAnimationFrame(resetAnimationId);
    cardElement.removeEventListener('mouseenter', handleMouseEnter);
    cardElement.removeEventListener('mousemove', handleMouseMove);
    cardElement.removeEventListener('mouseleave', handleMouseLeave);
    cardElement.removeEventListener('touchstart', handleTouchStart);
    cardElement.removeEventListener('touchmove', handleTouchMove);
    cardElement.removeEventListener('touchend', handleTouchEnd);
    window.removeEventListener('resize', updateRect);
  });

  if (animate) {
    cardElement.style.opacity = '0';
    animationFrameId = requestAnimationFrame(animationLoop);
  }
  applyTransform();

  updateRect();
  const checkMouseInside = (e) => {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    if (mouseX >= rect.left && mouseX <= rect.right &&
        mouseY >= rect.top && mouseY <= rect.bottom) {
      handleMouseEnter();
      handleMouseMove(e);
    }
  };
  document.addEventListener('mousemove', checkMouseInside, { once: true });
}

export function destroyCard3D(cardElement) {
  if (!cardElement) return;

  const cleanup = activeCards.get(cardElement);
  if (cleanup) {
    cleanup();
    activeCards.delete(cardElement);
  }

  cardElement.style.removeProperty('--rotate-x');
  cardElement.style.removeProperty('--rotate-y');
  cardElement.style.removeProperty('--pointer-x');
  cardElement.style.removeProperty('--pointer-y');
  cardElement.style.removeProperty('--background-x');
  cardElement.style.removeProperty('--background-y');
}

export function initAllCards3D(container) {
  const cards = container.querySelectorAll('.card-3d');
  cards.forEach(card => initCard3D(card));
}

export function destroyAllCards3D(container) {
  const cards = container.querySelectorAll('.card-3d');
  cards.forEach(card => destroyCard3D(card));
}

export default { initCard3D, destroyCard3D, initAllCards3D, destroyAllCards3D };
