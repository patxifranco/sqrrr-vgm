/**
 * 3D Card Interaction Module
 *
 * Creates Pokemon-style holographic 3D card effects:
 * - Mouse-controlled tilt (rotateX/Y)
 * - Shine/glare effect following pointer
 * - Rainbow holo gradient movement
 * - Smooth spring-like transitions
 */

// Store active card listeners for cleanup
const activeCards = new WeakMap();

/**
 * Initialize 3D effect on a card element
 * @param {HTMLElement} cardElement - Element with .card-3d class
 * @param {Object} options - Optional configuration
 * @param {boolean} options.animate - Play entrance animation
 */
export function initCard3D(cardElement, options = {}) {
  if (!cardElement || activeCards.has(cardElement)) return;

  const { animate = false } = options;

  // Configuration
  const config = {
    maxRotation: 25, // Max degrees of rotation
    perspective: 1500,
    // Entrance animation config
    entranceDuration: 1500,
    entranceStartRotateY: -120,
    entranceStartRotateX: 30,
    entranceStartScale: 0.3
  };

  // State
  let rect = cardElement.getBoundingClientRect();
  let isHovering = false;
  let mouseRotateX = 0;
  let mouseRotateY = 0;
  let isDestroyed = false; // Guard flag to stop animations

  // Entrance animation state
  let entranceProgress = animate ? 0 : 1;
  let entranceStartTime = animate ? performance.now() : 0;
  let animationFrameId = null;
  let resetAnimationId = null;

  // Update rect on resize
  const updateRect = () => {
    rect = cardElement.getBoundingClientRect();
  };

  // Easing function (ease-out cubic)
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  // Apply combined transform (entrance animation + mouse control)
  const applyTransform = () => {
    // Calculate entrance animation contribution
    const entranceRotateY = config.entranceStartRotateY * (1 - easeOutCubic(entranceProgress));
    const entranceRotateX = config.entranceStartRotateX * (1 - easeOutCubic(entranceProgress));
    const scale = config.entranceStartScale + (1 - config.entranceStartScale) * easeOutCubic(entranceProgress);
    const opacity = easeOutCubic(entranceProgress);

    // Combine entrance + mouse rotations
    const totalRotateX = entranceRotateX + mouseRotateX;
    const totalRotateY = entranceRotateY + mouseRotateY;

    // Apply combined transform
    cardElement.style.opacity = opacity;
    cardElement.style.transform = `rotateY(${totalRotateY}deg) rotateX(${totalRotateX}deg) scale(${scale})`;
  };

  // Animation loop for entrance
  const animationLoop = (currentTime) => {
    if (isDestroyed) return; // Stop if destroyed
    if (entranceProgress < 1) {
      const elapsed = currentTime - entranceStartTime;
      entranceProgress = Math.min(1, elapsed / config.entranceDuration);
      applyTransform();
      animationFrameId = requestAnimationFrame(animationLoop);
    }
  };

  // Start the reset animation (smooth return to center)
  const startResetAnimation = () => {
    if (resetAnimationId || isDestroyed) return; // Already running or destroyed

    const resetAnimation = () => {
      // Stop if destroyed or hovering again
      if (isDestroyed || isHovering) {
        resetAnimationId = null;
        return;
      }

      const decay = 0.9; // How fast it returns (lower = faster)
      mouseRotateX *= decay;
      mouseRotateY *= decay;

      // Also interpolate holo position back to center
      const currentBgX = parseFloat(cardElement.style.getPropertyValue('--background-x')) || 50;
      const currentBgY = parseFloat(cardElement.style.getPropertyValue('--background-y')) || 50;
      const newBgX = currentBgX + (50 - currentBgX) * (1 - decay);
      const newBgY = currentBgY + (50 - currentBgY) * (1 - decay);

      cardElement.style.setProperty('--pointer-x', `${newBgX}%`);
      cardElement.style.setProperty('--pointer-y', `${newBgY}%`);
      cardElement.style.setProperty('--background-x', `${newBgX}%`);
      cardElement.style.setProperty('--background-y', `${newBgY}%`);

      applyTransform();

      // Stop when close enough to zero
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

    // Cancel any ongoing reset animation
    if (resetAnimationId) {
      cancelAnimationFrame(resetAnimationId);
      resetAnimationId = null;
    }

    // Calculate position relative to card (0 to 1)
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    // Clamp to bounds
    const clampedX = Math.max(0, Math.min(1, x));
    const clampedY = Math.max(0, Math.min(1, y));

    // Convert to rotation (-maxRotation to +maxRotation)
    mouseRotateY = (clampedX - 0.5) * config.maxRotation * 2;
    mouseRotateX = (0.5 - clampedY) * config.maxRotation * 2;

    // Calculate background position for holo effect
    const bgX = clampedX * 100;
    const bgY = clampedY * 100;

    // Apply holo effect CSS variables
    cardElement.style.setProperty('--pointer-x', `${bgX}%`);
    cardElement.style.setProperty('--pointer-y', `${bgY}%`);
    cardElement.style.setProperty('--background-x', `${bgX}%`);
    cardElement.style.setProperty('--background-y', `${bgY}%`);

    // Apply combined transform
    applyTransform();
  };

  // Handle mouse enter
  const handleMouseEnter = () => {
    isHovering = true;
    updateRect();
  };

  // Handle mouse leave - smoothly reset to center
  const handleMouseLeave = () => {
    isHovering = false;
    startResetAnimation();
  };

  // Handle touch for mobile
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

  // Add event listeners
  cardElement.addEventListener('mouseenter', handleMouseEnter);
  cardElement.addEventListener('mousemove', handleMouseMove);
  cardElement.addEventListener('mouseleave', handleMouseLeave);
  cardElement.addEventListener('touchstart', handleTouchStart, { passive: true });
  cardElement.addEventListener('touchmove', handleTouchMove, { passive: true });
  cardElement.addEventListener('touchend', handleTouchEnd);
  window.addEventListener('resize', updateRect);

  // Store cleanup function
  activeCards.set(cardElement, () => {
    isDestroyed = true; // Prevent any pending animations from continuing
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

  // Set initial state and start entrance animation if needed
  if (animate) {
    cardElement.style.opacity = '0';
    animationFrameId = requestAnimationFrame(animationLoop);
  }
  applyTransform();

  // Check if mouse is already inside the card on init
  updateRect();
  const checkMouseInside = (e) => {
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    // Check if mouse is inside the card
    if (mouseX >= rect.left && mouseX <= rect.right &&
        mouseY >= rect.top && mouseY <= rect.bottom) {
      handleMouseEnter();
      handleMouseMove(e);
    }
  };
  // Use a one-time document mousemove to check current position
  document.addEventListener('mousemove', checkMouseInside, { once: true });
}

/**
 * Remove 3D effect from a card element
 * @param {HTMLElement} cardElement
 */
export function destroyCard3D(cardElement) {
  if (!cardElement) return;

  const cleanup = activeCards.get(cardElement);
  if (cleanup) {
    cleanup();
    activeCards.delete(cardElement);
  }

  // Reset CSS variables
  cardElement.style.removeProperty('--rotate-x');
  cardElement.style.removeProperty('--rotate-y');
  cardElement.style.removeProperty('--pointer-x');
  cardElement.style.removeProperty('--pointer-y');
  cardElement.style.removeProperty('--background-x');
  cardElement.style.removeProperty('--background-y');
}

/**
 * Initialize all cards with .card-3d class in a container
 * @param {HTMLElement} container
 */
export function initAllCards3D(container) {
  const cards = container.querySelectorAll('.card-3d');
  cards.forEach(card => initCard3D(card));
}

/**
 * Destroy all cards with .card-3d class in a container
 * @param {HTMLElement} container
 */
export function destroyAllCards3D(container) {
  const cards = container.querySelectorAll('.card-3d');
  cards.forEach(card => destroyCard3D(card));
}

export default { initCard3D, destroyCard3D, initAllCards3D, destroyAllCards3D };
