(() => {
  const param = new URLSearchParams(location.search).get('halloween');
  if (param === 'on' || param === 'off') localStorage.setItem('halloween', param);
  const pref = localStorage.getItem('halloween');
  const now = new Date();
  const inSeason = now.getMonth() === 9 || (now.getMonth() === 10 && now.getDate() <= 2);
  if (pref === 'off' || (pref !== 'on' && !inSeason)) return;
  document.documentElement.classList.add('halloween');

  const sky = document.createElement('div');
  sky.id = 'hw-sky';
  sky.innerHTML = '<div class="hw-bliss"></div><div class="hw-tint"></div><div class="hw-stars"></div><div class="hw-moon"></div><div class="hw-bat b1"></div><div class="hw-bat b2"></div><div class="hw-bat b3"></div><div class="hw-witch"></div><div class="hw-ghost g1"></div><div class="hw-ghost g2"></div><div class="hw-tree"></div><div class="hw-house"></div><div class="hw-fog"></div>';
  document.body.prepend(sky);

  const deco = document.createElement('div');
  deco.id = 'hw-deco';
  document.body.appendChild(deco);
  let decoQueued = false;
  function decorate() {
    decoQueued = false;
    deco.replaceChildren();
    const screen = document.querySelector('.screen-container.active');
    const win = screen && screen.querySelector('.window');
    if (!win) return;
    const r = win.getBoundingClientRect();
    if (!r.width) return;
    const add = (cls, x, y) => {
      const d = document.createElement('div');
      d.className = 'hw-deco ' + cls;
      d.style.left = x + 'px';
      d.style.top = y + 'px';
      deco.appendChild(d);
    };
    const pane = screen.querySelector('.chat-box, .wmp-lib');
    if (pane) {
      const p = pane.getBoundingClientRect();
      add('hw-web dark small', p.left + 1, p.top + 1);
      add('hw-web dark flip', p.right - 97, p.top + 1);
    } else {
      add('hw-web small', r.left + 4, r.top + 25);
      add('hw-web flip', r.right - 100, r.top + 25);
    }
    add('hw-spider', r.left + r.width * 0.68, r.top + 1);
    add('hw-pumpkin', r.right - 40, r.bottom - 50);
    if (r.width > 900) add('hw-pumpkin small', r.left - 30, r.bottom - 40);
  }
  const queueDecorate = () => { if (!decoQueued) { decoQueued = true; requestAnimationFrame(decorate); } };
  queueDecorate();
  window.addEventListener('resize', queueDecorate);
  new MutationObserver(queueDecorate).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });

  const light = document.createElement('div');
  light.id = 'hw-light';
  document.body.appendChild(light);
  function placeLight() {
    const win = document.querySelector('#login-screen .window');
    if (!win) return;
    const r = win.getBoundingClientRect();
    light.style.setProperty('--hx', r.left + r.width / 2 + 'px');
    light.style.setProperty('--hy', r.top + r.height * 0.45 + 'px');
  }
  placeLight();
  window.addEventListener('resize', placeLight);

  const canvas = document.createElement('canvas');
  canvas.id = 'hw-bats';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const sizeCanvas = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);
  const bats = [];
  let raf = 0, prevT = 0;
  const last = { x: 0, y: 0, t: 0 };
  const game = document.getElementById('game-screen');

  function drawBat(x, y, s, f, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s / 20, s / 20);
    ctx.globalAlpha = a;
    const t = -3 - f * 5;
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.lineTo(0, -2);
    ctx.quadraticCurveTo(9, -8 - f * 3, 20, t);
    ctx.quadraticCurveTo(15, 1 - f * 2, 13, 3 - f * 2);
    ctx.quadraticCurveTo(10, 1, 7, 5);
    ctx.quadraticCurveTo(4, 3, 2, 6);
    ctx.lineTo(0, 5);
    ctx.lineTo(-2, 6);
    ctx.quadraticCurveTo(-4, 3, -7, 5);
    ctx.quadraticCurveTo(-10, 1, -13, 3 - f * 2);
    ctx.quadraticCurveTo(-15, 1 - f * 2, -20, t);
    ctx.quadraticCurveTo(-9, -8 - f * 3, 0, -2);
    ctx.closePath();
    ctx.moveTo(-1.5, -3);
    ctx.lineTo(-3, -8);
    ctx.lineTo(-0.5, -4.5);
    ctx.moveTo(1.5, -3);
    ctx.lineTo(3, -8);
    ctx.lineTo(0.5, -4.5);
    ctx.fillStyle = '#0d0618';
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(255, 160, 60, 0.5)';
    ctx.stroke();
    ctx.restore();
  }

  function tick(now) {
    const dt = Math.min(50, now - prevT || 16);
    prevT = now;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = bats.length - 1; i >= 0; i--) {
      const b = bats[i];
      b.life += dt;
      if (b.life >= b.max) { bats.splice(i, 1); continue; }
      const k = dt / 16;
      b.vx += Math.sin(b.life / 90 + b.ph) * 0.12 * k;
      b.vy -= 0.035 * k;
      b.x += b.vx * k;
      b.y += b.vy * k;
      const p = b.life / b.max;
      const alpha = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4;
      drawBat(b.x, b.y, b.s * (1 + p * 0.5), Math.sin(b.life / 55 + b.ph), alpha);
    }
    raf = bats.length ? requestAnimationFrame(tick) : 0;
  }

  function spawn(e) {
    if (!game || !game.classList.contains('active')) return;
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    const t = performance.now();
    if (Math.hypot(dx, dy) < 14 || t - last.t < 45) return;
    last.x = e.clientX; last.y = e.clientY; last.t = t;
    if (bats.length > 45) return;
    const ang = Math.atan2(dy, dx) + Math.PI + (Math.random() - 0.5) * 1.6;
    const sp = 1.2 + Math.random() * 2.2;
    bats.push({ x: e.clientX, y: e.clientY, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.2, s: 9 + Math.random() * 11, life: 0, max: 1100 + Math.random() * 900, ph: Math.random() * 6.28 });
    if (!raf) { prevT = t; raf = requestAnimationFrame(tick); }
  }

  document.addEventListener('mousemove', e => {
    light.style.setProperty('--hx', e.clientX + 'px');
    light.style.setProperty('--hy', e.clientY + 'px');
    spawn(e);
  });
})();
