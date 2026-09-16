// SQRRR Tierlist - collab tier list (client)
import { socketManager } from './js/core/index.js';

const socket = socketManager.socket;
const $ = id => document.getElementById(id);
const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'];
const TIER_COLORS = { S: '#ff7f7f', A: '#ffbf7f', B: '#ffdf7f', C: '#ffff7f', D: '#bfff7f', F: '#7fff7f' };
const ME = Symbol('me'); // key for your own cursor in the cursors map

const tl = { me: null, players: [], colors: {}, host: null, album: null, songs: [], tiers: {}, trashed: [], votes: {}, currentId: null, playback: null, offset: 0, searchOpen: false };
const SRC_ICON = {
  kh: '<svg class="tl-ico" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  yt: '<svg class="tl-ico" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg>'
};
const audio = $('tl-audio');
const cursors = {}; // username | ME -> { key, el, x, y, tx, ty, tilt, tiltTarget, lastX, lastT, ghost }
let lastPos = null;      // last own cursor position (normalized)
let cursorDirty = false;
let seekDragging = false;
let drag = null;         // local card drag (see startDrag)
let suppressClick = false;
let hintTimer = null;
let actx = null, analyser = null, freq = null; // Web Audio graph for the soundwave

const isHost = () => !!tl.me && tl.host === tl.me.username;
const fmt = s => `${String(Math.floor((s || 0) / 60)).padStart(2, '0')}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
const cursorUrl = u => `tierlist/cursors/${encodeURIComponent(u)}.png`;
const proxied = mp3 => new URL(`/tierlist/audio?u=${encodeURIComponent(mp3)}`, location.href).href;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rankedIds = () => new Set(Object.values(tl.tiers).flat());
const isPlaced = id => rankedIds().has(id);
const tierOf = id => TIERS.find(t => (tl.tiers[t] || []).includes(id)) || null;
const isActive = () => $('tierlist-screen').classList.contains('active');
const colorOf = u => tl.colors[u] || '#9aa0a6';

function show(id) {
  document.querySelectorAll('.screen-container').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ==================== RENDER ====================
function renderPlayers() {
  for (const p of tl.players) tl.colors[p.username] = p.color;
  $('tl-players').innerHTML = tl.players.map(p =>
    `<span class="tl-avatar${p.username === tl.host ? ' host' : ''}" style="--c:${p.color}" title="${esc(p.username)}${p.username === tl.host ? ' (host)' : ''}"><img src="${esc(p.profilePicture)}" alt="${esc(p.username)}"></span>`
  ).join('');
  $('tl-stage').classList.toggle('is-host', isHost());
  const input = $('tl-search-input');
  input.disabled = !isHost();
  input.placeholder = isHost() ? 'Buscar en khinsider y YouTube, o pega una URL' : `Esperando a que ${tl.host || 'el host'} elija un álbum`;
  for (const u of Object.keys(cursors)) {
    if (!tl.players.some(p => p.username === u)) removeCursor(u);
  }
  renderCurrent();
}

function cardHtml(s) {
  return `<div class="tl-card" data-id="${s.id}" data-name="${esc(s.name)}" style="background-image:url('${esc(s.cover || '')}')"><span class="tl-card-num">${s.disc > 1 ? s.disc + '-' : ''}${s.num}</span></div>`;
}

function renderBoard() {
  const hasAlbum = !!tl.album;
  if (!hasAlbum) tl.searchOpen = false;
  $('tl-search').hidden = hasAlbum && !tl.searchOpen;
  $('tl-search').classList.toggle('overlay', hasAlbum);
  $('tl-board').hidden = !hasAlbum;
  $('tl-album-title').textContent = hasAlbum ? tl.album.title : '';
  if (!hasAlbum) { $('tl-search-results').innerHTML = ''; return; }
  for (const t of TIERS) $(`tl-drop-${t}`).innerHTML = (tl.tiers[t] || []).map(id => cardHtml(tl.songs[id])).join('');
  $('tl-tray').innerHTML = tl.songs.map(cardHtml).join(''); // the full track list: upcoming greyed, playing with wave, placed with tier badge
  renderCurrent();
  renderVotes();
}

// track list states: upcoming / current (soundwave) / placed (tier badge) / trashed
function renderTrayStates() {
  const ranked = rankedIds();
  document.querySelectorAll('#tl-tray .tl-card').forEach(c => {
    const id = +c.dataset.id;
    const placed = ranked.has(id), trashed = tl.trashed.includes(id), current = id === tl.currentId;
    c.classList.toggle('current', current);
    c.classList.toggle('placed', placed);
    c.classList.toggle('trashed', trashed);
    c.classList.toggle('upcoming', !current && !placed && !trashed);
    const tier = placed ? tierOf(id) : null;
    let badge = c.querySelector('.tl-tier-badge');
    if (tier) {
      if (!badge) { badge = document.createElement('span'); badge.className = 'tl-tier-badge'; c.appendChild(badge); }
      badge.textContent = tier;
      badge.style.setProperty('--tc', TIER_COLORS[tier]);
    } else if (badge) badge.remove();
    let wave = c.querySelector('.tl-wave');
    if (current && !wave) { wave = document.createElement('span'); wave.className = 'tl-wave'; wave.innerHTML = '<i></i><i></i><i></i><i></i>'; c.appendChild(wave); }
    else if (!current && wave) wave.remove();
  });
}

function renderCurrent() {
  document.querySelectorAll('.tl-drop .tl-card:not(.tl-vote)').forEach(c => c.classList.toggle('current', +c.dataset.id === tl.currentId));
  renderTrayStates();
  const s = tl.songs[tl.currentId];
  $('tl-now').textContent = s ? `${s.num}. ${s.name}` : (tl.album ? (isHost() ? 'Elige una canción' : 'Esperando al host') : '');
  $('tl-info').textContent = s ? `Pista ${tl.songs.indexOf(s) + 1} de ${tl.songs.length} · ${audio.duration ? fmt(audio.duration) : s.duration}` : (tl.album ? `${tl.songs.length} pistas` : '');
  $('tl-play').disabled = !isHost() || !s;
  $('tl-add-btn').disabled = !tl.album;
  $('tl-next').disabled = !isHost() || !tl.album;
  $('tl-seek').disabled = !isHost() || !s;
  $('tl-verdict-btn').disabled = !s || isPlaced(s.id);
  $('tl-play').classList.toggle('playing', !!(tl.playback && tl.playback.playing));
}

const token = u => `<span class="tl-token" style="--c:${colorOf(u)}" title="${esc(u)}">${esc(u[0].toUpperCase())}</span>`;
const votesFor = (id, tier) => Object.entries(tl.votes[id] || {}).filter(([, t]) => t === tier).map(([u]) => u);
const voteCardHtml = (u, s) => `<div class="tl-card tl-vote" data-id="${s.id}" data-user="${esc(u)}" style="--c:${colorOf(u)};background-image:url('${esc(s.cover || '')}')"><span class="tl-vote-badge">${esc(u[0].toUpperCase())}</span></div>`;

function renderVotes() {
  document.querySelectorAll('.tl-drop .tl-vote').forEach(el => el.remove());
  if (tl.currentId === null || isPlaced(tl.currentId)) return;
  const song = tl.songs[tl.currentId];
  for (const t of TIERS) $(`tl-drop-${t}`).insertAdjacentHTML('beforeend', votesFor(tl.currentId, t).map(u => voteCardHtml(u, song)).join(''));
  if (!$('tl-verdict').hidden) renderVerdict();
}

function renderResults({ results, gated }) {
  const empty = gated
    ? 'khinsider pide login para buscar. Pega la URL del álbum (downloads.khinsider.com/game-soundtracks/album/...) o escribe su nombre exacto, ej: minecraft'
    : 'Nada por aquí';
  $('tl-search-results').innerHTML = results.length ? results.map(r => {
    const id = r.source === 'yt' ? r.id : r.slug;
    const meta = r.source === 'yt' ? [r.channel, r.duration] : [r.type, r.year];
    return `<div class="tl-result" data-source="${r.source}" data-id="${esc(id)}" title="${esc(r.title)}${r.platform ? ' · ' + esc(r.platform) : ''}"><div class="tl-result-cover" style="background-image:url('${esc(r.thumb || '')}')"></div><span class="tl-result-src ${r.source}" title="${r.source === 'yt' ? 'YouTube' : 'khinsider'}">${SRC_ICON[r.source]}</span><div class="tl-result-title">${esc(r.title)}</div><div class="tl-result-meta">${meta.filter(Boolean).map(esc).join(' · ')}</div></div>`;
  }).join('') : `<div class="tl-empty">${empty}</div>`;
}

function openSearch() {
  tl.searchOpen = true;
  $('tl-search').hidden = false;
  $('tl-search-input').value = '';
  $('tl-search-results').innerHTML = '';
  $('tl-search-input').focus();
}
function closeSearch() {
  tl.searchOpen = false;
  if (tl.album) $('tl-search').hidden = true;
}

function renderVerdict() {
  const id = tl.currentId;
  const counts = Object.fromEntries(TIERS.map(t => [t, votesFor(id, t).length]));
  const max = Math.max(...Object.values(counts));
  $('tl-verdict-title').textContent = `${tl.songs[id].num}. ${tl.songs[id].name}`;
  $('tl-verdict-rows').innerHTML = TIERS.map(t =>
    `<button class="tl-verdict-row${counts[t] && counts[t] === max ? ' top' : ''}" data-tier="${t}" style="--tc:${TIER_COLORS[t]}"><b>${t}</b><span class="tl-verdict-tokens">${votesFor(id, t).map(token).join('')}</span><em>${counts[t]}</em></button>`
  ).join('');
}

function openVerdict() {
  if (tl.currentId === null || isPlaced(tl.currentId)) return;
  renderVerdict();
  $('tl-verdict').classList.toggle('readonly', !isHost());
  $('tl-verdict-hint').innerHTML = `<b style="color:${colorOf(tl.host)}">${esc(tl.host || 'El host')}</b> elige el resultado final`;
  $('tl-verdict').hidden = false;
}

// ==================== PLAYBACK SYNC ====================
function expectedTime() {
  const pb = tl.playback;
  if (!pb) return 0;
  return pb.position + (pb.playing ? (Date.now() + tl.offset - pb.at) / 1000 : 0);
}

// Audio goes through the site's proxy so the analyser can read it (the mp3 host sends no CORS headers)
function ensureAudioGraph() {
  if (actx || !window.AudioContext) return;
  try {
    actx = new AudioContext();
    const node = actx.createMediaElementSource(audio);
    analyser = actx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    node.connect(analyser);
    analyser.connect(actx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
  } catch (e) { actx = null; analyser = null; }
}

function applyPlayback({ currentId, mp3, playback, serverNow }) {
  tl.offset = serverNow - Date.now();
  if (currentId !== tl.currentId) $('tl-verdict').hidden = true;
  tl.currentId = currentId;
  tl.playback = playback;
  if (currentId === null) {
    audio.pause(); audio.removeAttribute('src');
    $('tl-clock').textContent = '00:00'; $('tl-seek').parentElement.style.setProperty('--f', '0'); $('tl-seek').value = 0;
    renderCurrent(); renderVotes();
    return;
  }
  if (mp3 && audio.src !== proxied(mp3)) audio.src = proxied(mp3);
  const t = expectedTime();
  if (Math.abs(audio.currentTime - t) > 0.4) audio.currentTime = t;
  if (playback.playing) {
    if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
    audio.play().catch(() => {});
  } else audio.pause();
  renderCurrent();
  renderVotes();
}

setInterval(() => {
  if (tl.playback && tl.playback.playing && !audio.paused && Math.abs(audio.currentTime - expectedTime()) > 0.75) {
    audio.currentTime = expectedTime();
  }
}, 3000);

audio.addEventListener('timeupdate', () => {
  $('tl-clock').textContent = fmt(audio.currentTime);
  const f = audio.duration ? audio.currentTime / audio.duration : 0;
  $('tl-seek').parentElement.style.setProperty('--f', f.toFixed(4));
  if (!seekDragging) $('tl-seek').value = Math.round(f * 1000);
});
audio.addEventListener('durationchange', renderCurrent);
audio.addEventListener('ended', () => {
  if (!isHost()) return;
  socket.emit('tlPlayback', { playing: false, position: audio.duration || 0 });
  socket.emit('tlVerdictOpen');
});

// ==================== CURSORS ====================
// The native cursor is hidden on the stage (see CSS); everyone, including you, is a Wii hand overlay.
// Hands tilt with horizontal speed and settle back; cards being dragged swing like a pendulum from the grab point.
const TILT_GAIN = 22, TILT_MAX = 40, TILT_DECAY = 0.988, TILT_EASE = 0.1; // ponytail: cursor feel knobs

function getCursor(key) {
  if (cursors[key]) return cursors[key];
  const username = key === ME ? tl.me.username : key;
  const c = { key, el: null, x: 0, y: 0, tx: 0, ty: 0, tilt: 0, tiltTarget: 0, lastX: null, lastT: 0, ghost: null };
  const img = document.createElement('img');
  img.className = key === ME ? 'tl-cursor me' : 'tl-cursor';
  img.alt = '';
  img.src = cursorUrl(username);
  img.onerror = () => { // no PNG for this player: colored badge with initial
    const el = document.createElement('span');
    el.className = img.className + ' tl-cursor-fallback';
    el.style.setProperty('--c', colorOf(username));
    el.textContent = username[0].toUpperCase();
    el.style.transform = img.style.transform;
    img.replaceWith(el);
    c.el = el;
  };
  $('tl-cursors').appendChild(img);
  c.el = img;
  cursors[key] = c;
  return c;
}

function pointCursor(c, x, y, now) {
  if (c.lastX !== null && now > c.lastT) c.tiltTarget = clamp((x - c.lastX) / (now - c.lastT) * TILT_GAIN, -TILT_MAX, TILT_MAX); // px/ms -> degrees
  c.lastX = x; c.lastT = now;
  c.tx = x; c.ty = y;
  if (c.key === ME) { c.x = x; c.y = y; }
}

function removeCursor(key) {
  const c = cursors[key];
  if (!c) return;
  c.el.remove();
  if (c.ghost) c.ghost.el.remove();
  delete cursors[key];
}
function clearCursors() { for (const k of [...Object.keys(cursors), ME]) removeCursor(k); }

function ghostEl(song) {
  const el = document.createElement('div');
  el.className = 'tl-card tl-ghost';
  el.style.backgroundImage = `url('${song.cover || ''}')`;
  el.innerHTML = `<span class="tl-card-num">${song.disc > 1 ? song.disc + '-' : ''}${song.num}</span>`;
  $('tl-cursors').appendChild(el);
  return el;
}

function setRemoteGhost(c, d) {
  if (!d) { if (c.ghost) { c.ghost.el.remove(); c.ghost = null; } return; }
  if (!c.ghost || c.ghost.id !== d.id) {
    if (c.ghost) c.ghost.el.remove();
    c.ghost = { id: d.id, el: ghostEl(tl.songs[d.id]), gx: d.gx, gy: d.gy, rot: d.rot, rotTarget: d.rot };
    c.ghost.el.style.transformOrigin = `${d.gx}px ${d.gy}px`;
  }
  c.ghost.gx = d.gx; c.ghost.gy = d.gy; c.ghost.rotTarget = d.rot;
}

// pointermove, not mousemove: preventDefault on pointerdown (drag start) suppresses the compatibility mouse events
window.addEventListener('pointermove', e => {
  if (!isActive()) return;
  lastPos = { x: e.clientX / innerWidth, y: e.clientY / innerHeight };
  cursorDirty = true;
  if (tl.me) { const c = getCursor(ME); c.el.hidden = false; pointCursor(c, e.clientX, e.clientY, performance.now()); }
});
document.documentElement.addEventListener('pointerleave', () => { if (cursors[ME]) cursors[ME].el.hidden = true; });

setInterval(() => {
  if (!isActive() || !lastPos || !(cursorDirty || drag)) return;
  cursorDirty = false;
  socket.emit('tlCursor', { ...lastPos, drag: drag ? { id: drag.id, gx: drag.gx, gy: drag.gy, rot: drag.rot } : null });
}, 40);

// ==================== CARD DRAG (vote / host move) ====================
// ponytail: pendulum with a moving pivot; G, DAMP and AMAX are the feel knobs.
const G = 3000, DAMP = 5, AMAX = 3000;

function startDrag(e, card, mode) {
  const id = +card.dataset.id;
  const r = card.getBoundingClientRect();
  const gx = e.clientX - r.left, gy = e.clientY - r.top;                  // grab point inside the card
  const ox = gx - r.width / 2, oy = -Math.abs(gy - r.height / 2);         // ponytail: physics pretends you grabbed the top half so the card never flips 180°
  const phi0 = Math.atan2(-ox, -oy);                                      // card center hangs at angle phi from straight-down; 0 = hanging
  drag = { id, mode, card, gx, gy, L: Math.max(10, Math.hypot(ox, oy)), phi: phi0, phi0, omega: 0, rot: 0,
    px: e.clientX, py: e.clientY, prevPx: e.clientX, vx: 0, startX: e.clientX, startY: e.clientY, moved: false, lastT: performance.now(), el: ghostEl(tl.songs[id]) };
  drag.el.style.transformOrigin = `${gx}px ${gy}px`;
  card.classList.add('dragging');
}

function stepDrag(now) {
  const d = drag;
  const dt = clamp((now - d.lastT) / 1000, 0.004, 0.05);
  d.lastT = now;
  const vx = (d.px - d.prevPx) / dt;
  d.prevPx = d.px;
  const ax = clamp((vx - d.vx) / dt, -AMAX, AMAX);
  d.vx = vx;
  const acc = -(G / d.L) * Math.sin(d.phi) - (ax / d.L) * Math.cos(d.phi) - DAMP * d.omega;
  d.omega += acc * dt;
  d.phi += d.omega * dt;
  d.rot = (d.phi0 - d.phi) * 180 / Math.PI;
  d.el.style.transform = `translate(${d.px - d.gx}px, ${d.py - d.gy}px) rotate(${d.rot}deg)`;
}

function dropTarget(x, y) {
  const el = document.elementFromPoint(x, y);
  return { row: el && el.closest('.tl-row'), trash: el && el.closest('#tl-trash') };
}

$('tl-board').addEventListener('pointerdown', e => {
  if (e.button !== 0 || drag) return;
  const card = e.target.closest('.tl-card');
  if (!card) return;
  const id = +card.dataset.id;
  const inTray = !!card.closest('#tl-tray');
  const isVote = card.classList.contains('tl-vote');
  let mode = null;
  if (isVote) mode = card.dataset.user === tl.me.username ? 'vote' : null;
  else if (inTray) mode = id === tl.currentId && !isPlaced(id) ? 'vote' : null;
  else mode = isHost() ? 'move' : null;
  if (!mode) {
    if (inTray && tl.currentId !== null && !isPlaced(id)) hint(card, 'Solo se vota la que suena', 1200);
    return;
  }
  e.preventDefault();
  startDrag(e, card, mode);
});

window.addEventListener('pointermove', e => {
  if (!drag) return;
  drag.px = e.clientX; drag.py = e.clientY;
  if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 4) drag.moved = true;
  const { row, trash } = dropTarget(e.clientX, e.clientY);
  document.querySelectorAll('.tl-row.hot').forEach(r => r !== row && r.classList.remove('hot'));
  if (row) row.classList.add('hot');
  $('tl-trash').classList.toggle('hot', !!trash && isHost());
});

window.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.el.remove();
  d.card.classList.remove('dragging');
  document.querySelectorAll('.tl-row.hot').forEach(r => r.classList.remove('hot'));
  $('tl-trash').classList.remove('hot');
  if (lastPos) socket.emit('tlCursor', { ...lastPos, drag: null });
  if (!d.moved) return;
  suppressClick = true;
  const { row, trash } = dropTarget(e.clientX, e.clientY);
  if (row) {
    const tier = row.dataset.tier;
    if (d.mode === 'vote') socket.emit('tlVote', { songId: d.id, tier });
    else {
      const index = [...row.querySelectorAll('.tl-drop .tl-card:not(.tl-vote)')].filter(c => +c.dataset.id !== d.id && c.getBoundingClientRect().left + c.offsetWidth / 2 < e.clientX).length;
      socket.emit('tlVerdict', { songId: d.id, tier, index });
    }
  } else if (trash && isHost()) {
    socket.emit('tlTrash', { songId: d.id });
  }
});

// ==================== ANIMATION LOOP ====================
function stepWave(now) {
  const wave = document.querySelector('#tl-tray .tl-card.current .tl-wave');
  if (!wave) return;
  const playing = tl.playback && tl.playback.playing && !audio.paused;
  let levels;
  if (playing && analyser) {
    analyser.getByteFrequencyData(freq);
    const n = freq.length;
    levels = [0, 1, 2, 3].map(i => {
      const a = Math.floor(i * n / 4), b = Math.floor((i + 1) * n / 4);
      let s = 0;
      for (let k = a; k < b; k++) s += freq[k];
      return clamp(0.12 + (s / ((b - a) * 255)) * (1 + i * 0.5), 0.12, 1);
    });
  } else if (playing) { // no analyser: gentle fake pulse
    const t = now / 1000;
    levels = [0, 1, 2, 3].map(i => 0.3 + 0.3 * (1 + Math.sin(t * 5 + i * 1.7)) / 2);
  } else levels = [0.12, 0.12, 0.12, 0.12];
  levels.forEach((l, i) => wave.style.setProperty(`--l${i}`, l.toFixed(2)));
}

function tick(now) {
  if (isActive()) {
    for (const c of Object.getOwnPropertySymbols(cursors).concat(Object.keys(cursors)).map(k => cursors[k])) {
      if (c.key !== ME) { c.x += (c.tx - c.x) * 0.4; c.y += (c.ty - c.y) * 0.4; }
      c.tilt += (c.tiltTarget - c.tilt) * TILT_EASE;
      c.tiltTarget *= TILT_DECAY;
      c.el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.tilt}deg)`;
      if (c.ghost) {
        c.ghost.rot += (c.ghost.rotTarget - c.ghost.rot) * 0.5;
        c.ghost.el.style.transform = `translate(${c.x - c.ghost.gx}px, ${c.y - c.ghost.gy}px) rotate(${c.ghost.rot}deg)`;
      }
    }
    if (drag) stepDrag(now);
    stepWave(now);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ==================== SOCKET ====================
socket.on('tlState', s => {
  Object.assign(tl, { players: s.players, host: s.host, album: s.album, songs: s.songs, tiers: s.tiers, trashed: s.trashed || [], votes: s.votes });
  tl.offset = s.serverNow - Date.now();
  $('tl-verdict').hidden = true;
  renderPlayers();
  renderBoard();
  if (s.currentId !== null && s.songs[s.currentId] && s.songs[s.currentId].mp3) {
    applyPlayback({ currentId: s.currentId, mp3: s.songs[s.currentId].mp3, playback: s.playback, serverNow: s.serverNow });
  } else {
    tl.currentId = null; tl.playback = s.playback; audio.pause(); audio.removeAttribute('src');
    $('tl-clock').textContent = '00:00';
    $('tl-seek').parentElement.style.setProperty('--f', '0');
    $('tl-seek').value = 0;
    renderCurrent();
    renderVotes();
  }
});
socket.on('tlPlayers', ({ players, host }) => { tl.players = players; tl.host = host; renderPlayers(); });
socket.on('tlSearchResults', renderResults);
socket.on('tlPlayback', applyPlayback);
socket.on('tlVotes', ({ songId, votes }) => { tl.votes[songId] = votes; if (songId === tl.currentId) renderVotes(); });
socket.on('tlTiers', ({ tiers, trashed, placed }) => {
  tl.tiers = tiers; tl.trashed = trashed || [];
  renderBoard();
  if (placed !== null && placed !== undefined) {
    const card = document.querySelector(`.tl-drop .tl-card:not(.tl-vote)[data-id="${placed}"]`);
    if (card) card.classList.add('pop');
    if (placed === tl.currentId) $('tl-verdict').hidden = true;
  }
});
socket.on('tlVerdictOpen', openVerdict);
socket.on('tlError', ({ message }) => { $('tl-now').textContent = message; });
socket.on('tlCursor', ({ username, x, y, gone, drag: d }) => {
  if (!tl.me || username === tl.me.username) return;
  if (gone) return removeCursor(username);
  const c = getCursor(username);
  pointCursor(c, x * innerWidth, y * innerHeight, performance.now());
  setRemoteGhost(c, d && tl.songs[d.id] ? d : null);
});

// ==================== CONTROLS ====================
function leaveScreen() {
  socket.emit('tlLeave');
  audio.pause();
  audio.removeAttribute('src');
  clearCursors();
  $('tl-verdict').hidden = true;
  show('hub-screen');
}
$('tierlist-btn').addEventListener('click', () => {
  tl.me = window.currentUser;
  if (!tl.me) return;
  ensureAudioGraph(); // inside the click so the AudioContext is allowed to start
  socket.emit('tlJoin');
  show('tierlist-screen');
});
$('tl-back-btn').addEventListener('click', leaveScreen);
// leave the lobby the moment the tab closes or navigates away
window.addEventListener('pagehide', () => {
  if (!isActive()) return;
  try { socket.emit('tlLeave'); navigator.sendBeacon('/tierlist/leave', socket.id); } catch {}
});
$('tl-cancel-btn').addEventListener('click', () => {
  if (isHost() && confirm('¿Resetear to\' toito? Se borra la tierlist para todos y se vuelve a buscar.')) socket.emit('tlReset');
});
function load(source, id) {
  socket.emit('tlLoad', { source, id, append: !!tl.album });
  closeSearch();
}
function search() {
  const q = $('tl-search-input').value.trim();
  if (!q || !isHost()) return;
  const kh = q.match(/khinsider\.com\/game-soundtracks\/album\/([A-Za-z0-9._-]+)/); // pasted album URL: load it directly
  if (kh) return load('kh', kh[1]);
  if (/^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//.test(q)) return load('yturl', q); // pasted video or playlist
  $('tl-search-results').innerHTML = '<div class="tl-empty">Buscando</div>';
  socket.emit('tlSearch', { q });
}
$('tl-add-btn').addEventListener('click', () => { if (isHost()) openSearch(); });
$('tl-search-close').addEventListener('click', closeSearch);
window.addEventListener('keydown', e => { if (e.key === 'Escape' && isActive() && tl.searchOpen) closeSearch(); });
$('tl-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
$('tl-search-go').addEventListener('click', search);
$('tl-search-results').addEventListener('click', e => {
  const r = e.target.closest('.tl-result');
  if (r && isHost()) load(r.dataset.source, r.dataset.id);
});
$('tl-board').addEventListener('click', e => {
  if (suppressClick) { suppressClick = false; return; }
  const c = e.target.closest('.tl-card:not(.tl-vote)');
  if (!c || !isHost()) return;
  if (c.classList.contains('trashed')) return socket.emit('tlRestore', { songId: +c.dataset.id });
  if (+c.dataset.id !== tl.currentId) socket.emit('tlSelect', { songId: +c.dataset.id });
});
$('tl-trash').addEventListener('click', () => { if (isHost() && tl.currentId !== null) socket.emit('tlTrash', { songId: tl.currentId }); });
// bubble above the hovered card: song name, vote breakdown, or whose vote it is
$('tl-board').addEventListener('mouseover', e => {
  const c = e.target.closest('.tl-card');
  if (!c || drag) return;
  const id = +c.dataset.id;
  if (c.classList.contains('tl-vote')) return hint(c, `Voto de ${c.dataset.user}`);
  const parts = TIERS.map(t => [t, votesFor(id, t).length]).filter(([, n]) => n).map(([t, n]) => `${t} ${n}`);
  const tier = tierOf(id);
  hint(c, c.dataset.name + (tier ? `  ·  ${tier}` : '') + (parts.length ? `  ·  votos: ${parts.join(', ')}` : ''));
});
$('tl-board').addEventListener('mouseout', e => { if (e.target.closest('.tl-card')) $('tl-bubble').hidden = true; });
function hint(card, text, ms = 0) {
  const r = card.getBoundingClientRect();
  const b = $('tl-bubble');
  b.textContent = text;
  b.style.left = `${r.left + r.width / 2}px`;
  b.style.top = `${r.top - 10}px`;
  b.hidden = false;
  clearTimeout(hintTimer);
  if (ms) hintTimer = setTimeout(() => { b.hidden = true; }, ms);
}
$('tl-play').addEventListener('click', () => socket.emit('tlPlayback', { playing: audio.paused, position: audio.currentTime }));
$('tl-next').addEventListener('click', () => {
  const skip = rankedIds();
  tl.trashed.forEach(id => skip.add(id));
  const after = tl.currentId === null ? -1 : tl.currentId;
  const next = tl.songs.find(s => s.id > after && !skip.has(s.id)) || tl.songs.find(s => !skip.has(s.id) && s.id !== tl.currentId);
  if (next) socket.emit('tlSelect', { songId: next.id });
});
$('tl-verdict-btn').addEventListener('click', () => { if (isHost()) socket.emit('tlVerdictOpen'); else openVerdict(); });
$('tl-verdict-rows').addEventListener('click', e => {
  const r = e.target.closest('.tl-verdict-row');
  if (!r || !isHost()) return;
  socket.emit('tlVerdict', { songId: tl.currentId, tier: r.dataset.tier });
  $('tl-verdict').hidden = true;
});
$('tl-verdict').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
$('tl-seek').addEventListener('pointerdown', () => { seekDragging = true; });
$('tl-seek').addEventListener('input', e => { if (seekDragging) $('tl-clock').textContent = fmt(e.target.value / 1000 * (audio.duration || 0)); });
$('tl-seek').addEventListener('change', e => {
  seekDragging = false;
  socket.emit('tlPlayback', { playing: !audio.paused, position: e.target.value / 1000 * (audio.duration || 0) });
});
function setVolume(v) {
  audio.volume = v / 100;
  $('tl-volume').value = v;
  $('tl-volume').parentElement.style.setProperty('--f', (v / 100).toFixed(3));
}
$('tl-volume').addEventListener('input', e => {
  setVolume(+e.target.value);
  try { localStorage.setItem('tlVolume', e.target.value); } catch {}
});
try { const v = localStorage.getItem('tlVolume'); setVolume(v !== null ? +v : 80); } catch { setVolume(80); }
