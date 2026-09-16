// SQRRR Tierlist - collab tier list (client)
import { socketManager } from './js/core/index.js';

const socket = socketManager.socket;
const $ = id => document.getElementById(id);
const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'];
const TIER_COLORS = { S: '#ff7f7f', A: '#ffbf7f', B: '#ffdf7f', C: '#ffff7f', D: '#bfff7f', F: '#7fff7f' };
const ME = Symbol('me'); // key for your own cursor in the cursors map

const tl = { me: null, players: [], colors: {}, host: null, album: null, songs: [], tiers: {}, trashed: [], votes: {}, currentId: null, playback: null, offset: 0 };
const audio = $('tl-audio');
const cursors = {}; // username | ME -> { key, el, x, y, tx, ty, tilt, tiltTarget, lastX, lastT, ghost }
let lastPos = null;      // last own cursor position (normalized)
let cursorDirty = false;
let seekDragging = false;
let drag = null;         // local card drag (see startDrag)
let suppressClick = false;

const isHost = () => !!tl.me && tl.host === tl.me.username;
const fmt = s => `${String(Math.floor((s || 0) / 60)).padStart(2, '0')}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
const cursorUrl = u => `tierlist/cursors/${encodeURIComponent(u)}.png`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rankedIds = () => new Set(Object.values(tl.tiers).flat());
const isPlaced = id => rankedIds().has(id);
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
    `<span class="tl-chip${p.username === tl.host ? ' host' : ''}" style="--c:${p.color}"><img src="${esc(p.profilePicture)}" alt="">${esc(p.username)}</span>`
  ).join('');
  $('tl-stage').classList.toggle('is-host', isHost());
  const input = $('tl-search-input');
  input.disabled = !isHost();
  input.placeholder = isHost() ? 'Buscar en khinsider (ej: minecraft)…' : `Esperando a que ${tl.host || 'el host'} elija un album…`;
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
  $('tl-search').hidden = hasAlbum;
  $('tl-board').hidden = !hasAlbum;
  $('tl-album-title').textContent = hasAlbum ? tl.album.title : '';
  if (!hasAlbum) return;
  for (const t of TIERS) $(`tl-drop-${t}`).innerHTML = (tl.tiers[t] || []).map(id => cardHtml(tl.songs[id])).join('');
  const ranked = rankedIds();
  $('tl-tray').innerHTML = tl.songs.filter(s => !ranked.has(s.id) && !tl.trashed.includes(s.id)).map(cardHtml).join('');
  renderCurrent();
  renderVotes();
}

function renderCurrent() {
  document.querySelectorAll('.tl-card').forEach(c => c.classList.toggle('current', +c.dataset.id === tl.currentId));
  const s = tl.songs[tl.currentId];
  $('tl-now').textContent = s ? `${s.num}. ${s.name}` : (tl.album ? (isHost() ? 'Elige una cancion' : 'Esperando al host…') : '');
  $('tl-play').disabled = !isHost() || !s;
  $('tl-next').disabled = !isHost() || !tl.album;
  $('tl-seek').disabled = !isHost() || !s;
  $('tl-verdict-btn').disabled = !isHost() || !s || isPlaced(s.id);
  $('tl-play').textContent = tl.playback && tl.playback.playing ? '❚❚' : '▶';
}

const token = u => `<span class="tl-token" style="--c:${colorOf(u)}" title="${esc(u)}">${esc(u[0].toUpperCase())}</span>`;
const votesFor = (id, tier) => Object.entries(tl.votes[id] || {}).filter(([, t]) => t === tier).map(([u]) => u);

function renderVotes() {
  for (const t of TIERS) $(`tl-votes-${t}`).innerHTML = tl.currentId === null ? '' : votesFor(tl.currentId, t).map(token).join('');
}

function renderResults({ results }) {
  $('tl-search-results').innerHTML = results.length ? results.map(r =>
    `<div class="tl-result" data-slug="${esc(r.slug)}"><img src="${esc(r.thumb || '')}" alt=""><div><div>${esc(r.title)}</div><small>${esc(r.platform)} · ${esc(r.type)} · ${esc(r.year)}</small></div></div>`
  ).join('') : '<div class="tl-empty">Nada por aqui</div>';
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

// ==================== PLAYBACK SYNC ====================
function expectedTime() {
  const pb = tl.playback;
  if (!pb) return 0;
  return pb.position + (pb.playing ? (Date.now() + tl.offset - pb.at) / 1000 : 0);
}

function applyPlayback({ currentId, mp3, playback, serverNow }) {
  tl.offset = serverNow - Date.now();
  tl.currentId = currentId;
  tl.playback = playback;
  if (mp3 && audio.src !== mp3) audio.src = mp3;
  const t = expectedTime();
  if (Math.abs(audio.currentTime - t) > 0.4) audio.currentTime = t;
  if (playback.playing) audio.play().catch(() => {}); else audio.pause();
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
  $('tl-dur').textContent = fmt(audio.duration);
  if (!seekDragging) $('tl-seek').value = audio.duration ? Math.round(audio.currentTime / audio.duration * 1000) : 0;
});
audio.addEventListener('ended', () => { if (isHost()) socket.emit('tlPlayback', { playing: false, position: audio.duration || 0 }); });

// ==================== CURSORS ====================
// The native cursor is hidden on the stage (see CSS); everyone, including you, is a Wii hand overlay.
// Hands tilt with horizontal speed and settle back; cards being dragged swing like a pendulum from the grab point.
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
  if (c.lastX !== null && now > c.lastT) c.tiltTarget = clamp((x - c.lastX) / (now - c.lastT) * 12, -28, 28); // px/ms -> degrees
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
// ponytail: pendulum with a moving pivot; g, DAMP and AMAX are the feel knobs.
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
  const mode = inTray && id === tl.currentId && !isPlaced(id) ? 'vote' : (!inTray && isHost() ? 'move' : null);
  if (!mode) return;
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
  $('tl-trash').classList.toggle('hot', !!trash && drag.mode === 'move');
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
      const index = [...row.querySelectorAll('.tl-drop .tl-card')].filter(c => +c.dataset.id !== d.id && c.getBoundingClientRect().left + c.offsetWidth / 2 < e.clientX).length;
      socket.emit('tlVerdict', { songId: d.id, tier, index });
    }
  } else if (trash && d.mode === 'move') {
    socket.emit('tlTrash', { songId: d.id });
  }
});

// ==================== ANIMATION LOOP ====================
function tick(now) {
  if (isActive()) {
    for (const c of Object.getOwnPropertySymbols(cursors).concat(Object.keys(cursors)).map(k => cursors[k])) {
      if (c.key !== ME) { c.x += (c.tx - c.x) * 0.4; c.y += (c.ty - c.y) * 0.4; }
      c.tilt += (c.tiltTarget - c.tilt) * 0.25;
      c.tiltTarget *= 0.8;
      c.el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.tilt}deg)`;
      if (c.ghost) {
        c.ghost.rot += (c.ghost.rotTarget - c.ghost.rot) * 0.5;
        c.ghost.el.style.transform = `translate(${c.x - c.ghost.gx}px, ${c.y - c.ghost.gy}px) rotate(${c.ghost.rot}deg)`;
      }
    }
    if (drag) stepDrag(now);
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ==================== SOCKET ====================
socket.on('tlState', s => {
  Object.assign(tl, { players: s.players, host: s.host, album: s.album, songs: s.songs, tiers: s.tiers, trashed: s.trashed || [], votes: s.votes });
  tl.offset = s.serverNow - Date.now();
  renderPlayers();
  renderBoard();
  if (s.currentId !== null && s.songs[s.currentId] && s.songs[s.currentId].mp3) {
    applyPlayback({ currentId: s.currentId, mp3: s.songs[s.currentId].mp3, playback: s.playback, serverNow: s.serverNow });
  } else {
    tl.currentId = null; tl.playback = s.playback; audio.pause(); audio.removeAttribute('src');
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
    const card = document.querySelector(`.tl-drop .tl-card[data-id="${placed}"]`);
    if (card) card.classList.add('pop');
  }
});
socket.on('tlError', ({ message }) => { $('tl-now').textContent = message; });
socket.on('tlCursor', ({ username, x, y, gone, drag: d }) => {
  if (!tl.me || username === tl.me.username) return;
  if (gone) return removeCursor(username);
  const c = getCursor(username);
  pointCursor(c, x * innerWidth, y * innerHeight, performance.now());
  setRemoteGhost(c, d && tl.songs[d.id] ? d : null);
});

// ==================== CONTROLS ====================
$('tierlist-btn').addEventListener('click', () => {
  tl.me = window.currentUser;
  if (!tl.me) return;
  socket.emit('tlJoin');
  show('tierlist-screen');
});
$('tl-back-btn').addEventListener('click', () => {
  socket.emit('tlLeave');
  audio.pause();
  audio.removeAttribute('src');
  clearCursors();
  $('tl-verdict').hidden = true;
  show('hub-screen');
});
$('tl-search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.value.trim()) {
    $('tl-search-results').innerHTML = '<div class="tl-empty">Buscando…</div>';
    socket.emit('tlSearch', { q: e.target.value.trim() });
  }
});
$('tl-search-results').addEventListener('click', e => {
  const r = e.target.closest('.tl-result');
  if (r && isHost()) socket.emit('tlLoadAlbum', { slug: r.dataset.slug });
});
$('tl-board').addEventListener('click', e => {
  if (suppressClick) { suppressClick = false; return; }
  const c = e.target.closest('.tl-card');
  if (c && isHost() && +c.dataset.id !== tl.currentId) socket.emit('tlSelect', { songId: +c.dataset.id });
});
// song-name bubble (plus vote breakdown) above the hovered card
$('tl-board').addEventListener('mouseover', e => {
  const c = e.target.closest('.tl-card');
  if (!c || drag) return;
  const id = +c.dataset.id;
  const parts = TIERS.map(t => [t, votesFor(id, t).length]).filter(([, n]) => n).map(([t, n]) => `${t} ${n}`);
  const r = c.getBoundingClientRect();
  const b = $('tl-bubble');
  b.textContent = c.dataset.name + (parts.length ? `  ·  ${parts.join(' · ')}` : '');
  b.style.left = `${r.left + r.width / 2}px`;
  b.style.top = `${r.top - 10}px`;
  b.hidden = false;
});
$('tl-board').addEventListener('mouseout', e => { if (e.target.closest('.tl-card')) $('tl-bubble').hidden = true; });
$('tl-play').addEventListener('click', () => socket.emit('tlPlayback', { playing: audio.paused, position: audio.currentTime }));
$('tl-next').addEventListener('click', () => {
  const skip = rankedIds();
  tl.trashed.forEach(id => skip.add(id));
  const after = tl.currentId === null ? -1 : tl.currentId;
  const next = tl.songs.find(s => s.id > after && !skip.has(s.id)) || tl.songs.find(s => !skip.has(s.id) && s.id !== tl.currentId);
  if (next) socket.emit('tlSelect', { songId: next.id });
});
$('tl-verdict-btn').addEventListener('click', () => {
  if (!isHost() || tl.currentId === null) return;
  renderVerdict();
  $('tl-verdict').hidden = false;
});
$('tl-verdict-rows').addEventListener('click', e => {
  const r = e.target.closest('.tl-verdict-row');
  if (!r) return;
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
$('tl-volume').addEventListener('input', e => {
  audio.volume = e.target.value / 100;
  try { localStorage.setItem('tlVolume', e.target.value); } catch {}
});
try { const v = localStorage.getItem('tlVolume'); if (v !== null) { $('tl-volume').value = v; audio.volume = v / 100; } } catch {}
