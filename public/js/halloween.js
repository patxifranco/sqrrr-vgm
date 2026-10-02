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
    const win = document.querySelector('.screen-container.active .window');
    if (!win) return;
    const r = win.getBoundingClientRect();
    light.style.setProperty('--hx', r.left + r.width / 2 + 'px');
    light.style.setProperty('--hy', r.top + r.height * 0.45 + 'px');
  }
  placeLight();
  window.addEventListener('resize', placeLight);
  let moved = false;
  new MutationObserver(() => { if (!moved) requestAnimationFrame(placeLight); }).observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });

  document.addEventListener('vgmCorrect', () => {
    deco.classList.add('flare');
    setTimeout(() => deco.classList.remove('flare'), 1200);
  });

  const flash = document.createElement('div');
  flash.id = 'hw-flash';
  document.body.appendChild(flash);
  let audioCtx = null;
  document.addEventListener('click', () => { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (err) { audioCtx = null; } } }, { once: true });
  function thunder() {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const len = 2.8, sr = audioCtx.sampleRate, buf = audioCtx.createBuffer(1, sr * len, sr), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.2);
    const src = audioCtx.createBufferSource(); src.buffer = buf;
    const lp = audioCtx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
    const g = audioCtx.createGain(); g.gain.value = 0.5;
    src.connect(lp); lp.connect(g); g.connect(audioCtx.destination);
    src.start(audioCtx.currentTime + 0.25);
  }
  function lightning() {
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
    sky.classList.add('lit');
    setTimeout(() => sky.classList.remove('lit'), 320);
    setTimeout(() => flash.classList.remove('on'), 800);
    thunder();
    setTimeout(lightning, 90000 + Math.random() * 150000);
  }
  setTimeout(lightning, 40000 + Math.random() * 60000);

  document.addEventListener('mousemove', e => {
    moved = true;
    light.style.setProperty('--hx', e.clientX + 'px');
    light.style.setProperty('--hy', e.clientY + 'px');
  });
})();
