const STAGE_W = 1920, STAGE_H = 1080;
const TILT_GAIN = 22, TILT_MAX = 40, TILT_DECAY = 0.988, TILT_EASE = 0.1, NET_DELAY = 70;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ME = Symbol('me');

export function createHands({ stage, layer, socket, event, isActive, getMe }) {
  const cursors = {};
  let lastPos = null, dirty = false;
  let scale = 1, left = 0, top = 0;

  function fit() {
    scale = Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
    const r = stage.getBoundingClientRect();
    left = r.left; top = r.top;
  }
  const toStage = (cx, cy) => ({ x: (cx - left) / scale, y: (cy - top) / scale });

  function get(key) {
    if (cursors[key]) return cursors[key];
    const username = key === ME ? getMe() : key;
    const img = document.createElement('img');
    img.className = key === ME ? 'tl-cursor me' : 'tl-cursor';
    img.alt = '';
    img.src = `tierlist/cursors/${encodeURIComponent(username)}.png`;
    img.onerror = () => { img.onerror = null; img.src = 'tierlist/cursors/default.png'; };
    layer.appendChild(img);
    return (cursors[key] = { key, el: img, x: 0, y: 0, tilt: 0, tiltTarget: 0, lastX: null, lastT: 0, samples: [] });
  }
  function point(c, x, y, now) {
    if (c.key !== ME) {
      c.samples.push({ x, y, t: now });
      if (c.samples.length > 60) c.samples.shift();
      return;
    }
    if (c.lastX !== null && now > c.lastT) c.tiltTarget = clamp((x - c.lastX) / (now - c.lastT) * TILT_GAIN, -TILT_MAX, TILT_MAX);
    c.lastX = x; c.lastT = now;
    c.x = x; c.y = y;
  }
  function sampleAt(c, now) {
    const s = c.samples, t = now - NET_DELAY;
    if (!s.length) return null;
    let a = null, b = null;
    for (let k = s.length - 1; k >= 0; k--) { if (s[k].t <= t) { a = s[k]; b = s[k + 1] || null; break; } }
    if (!a) return s[0];
    if (!b) return a;
    const f = (t - a.t) / Math.max(1, b.t - a.t);
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  }
  function remove(key) {
    const c = cursors[key];
    if (!c) return;
    c.el.remove();
    delete cursors[key];
  }
  function clear() { for (const k of [...Object.keys(cursors), ME]) remove(k); }
  function keep(usernames) { for (const k of Object.keys(cursors)) if (!usernames.includes(k)) remove(k); }

  window.addEventListener('pointermove', e => {
    if (!isActive()) return;
    const p = toStage(e.clientX, e.clientY);
    lastPos = { x: p.x / STAGE_W, y: p.y / STAGE_H };
    dirty = true;
    if (getMe()) { const c = get(ME); c.el.hidden = false; point(c, p.x, p.y, performance.now()); }
  });
  document.documentElement.addEventListener('pointerleave', () => { if (cursors[ME]) cursors[ME].el.hidden = true; });
  setInterval(() => {
    if (!isActive() || !lastPos || !dirty) return;
    dirty = false;
    socket.emit(event, lastPos);
  }, 16);
  socket.on(event, ({ username, x, y, gone }) => {
    if (!isActive() || username === getMe()) return;
    if (gone) return remove(username);
    point(get(username), x * STAGE_W, y * STAGE_H, performance.now());
  });
  window.addEventListener('resize', () => { if (isActive()) fit(); });

  function tick(now) {
    if (isActive()) {
      for (const c of Object.getOwnPropertySymbols(cursors).concat(Object.keys(cursors)).map(k => cursors[k])) {
        if (c.key !== ME) {
          const p = sampleAt(c, now);
          if (p) {
            const dt = Math.max(1, now - (c.lastT || now - 16));
            if (Math.abs(p.x - c.x) > 0.01) c.tiltTarget = clamp((p.x - c.x) / dt * TILT_GAIN, -TILT_MAX, TILT_MAX);
            c.x = p.x; c.y = p.y; c.lastT = now;
          }
        }
        c.tilt += (c.tiltTarget - c.tilt) * TILT_EASE;
        c.tiltTarget *= TILT_DECAY;
        c.el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.tilt}deg)`;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return { fit, clear, keep };
}
