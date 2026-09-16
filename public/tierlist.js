// SQRRR Tierlist - collab tier list (client)
import { socketManager } from './js/core/index.js';

const socket = socketManager.socket;
const $ = id => document.getElementById(id);
const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'];

const tl = { me: null, players: [], host: null, album: null, songs: [], tiers: {}, votes: {}, currentId: null, playback: null, offset: 0 };
const audio = $('tl-audio');
const cursors = {}; // username -> element
let cursorPending = null;
let seekDragging = false;

const isHost = () => !!tl.me && tl.host === tl.me.username;
const fmt = s => `${String(Math.floor((s || 0) / 60)).padStart(2, '0')}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
const cursorUrl = u => `tierlist/cursors/${encodeURIComponent(u)}.png`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rankedIds = () => new Set(Object.values(tl.tiers).flat());

function show(id) {
  document.querySelectorAll('.screen-container').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ==================== RENDER ====================
function renderPlayers() {
  $('tl-players').innerHTML = tl.players.map(p =>
    `<span class="tl-chip${p.username === tl.host ? ' host' : ''}" style="--c:${p.color}"><img src="${esc(p.profilePicture)}" alt="">${esc(p.username)}</span>`
  ).join('');
  $('tl-stage').classList.toggle('is-host', isHost());
  const input = $('tl-search-input');
  input.disabled = !isHost();
  input.placeholder = isHost() ? 'Buscar en khinsider (ej: minecraft)…' : `Esperando a que ${tl.host || 'el host'} elija un album…`;
  for (const u of Object.keys(cursors)) {
    if (!tl.players.some(p => p.username === u)) { cursors[u].remove(); delete cursors[u]; }
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
  $('tl-tray').innerHTML = tl.songs.filter(s => !ranked.has(s.id)).map(cardHtml).join('');
  renderCurrent();
}

function renderCurrent() {
  document.querySelectorAll('.tl-card').forEach(c => c.classList.toggle('current', +c.dataset.id === tl.currentId));
  const s = tl.songs[tl.currentId];
  $('tl-now').textContent = s ? `${s.num}. ${s.name}` : (tl.album ? (isHost() ? 'Elige una cancion' : 'Esperando al host…') : '');
  $('tl-play').disabled = !isHost() || !s;
  $('tl-next').disabled = !isHost() || !tl.album;
  $('tl-seek').disabled = !isHost() || !s;
  $('tl-play').textContent = tl.playback && tl.playback.playing ? '❚❚' : '▶';
}

function renderResults({ results }) {
  $('tl-search-results').innerHTML = results.length ? results.map(r =>
    `<div class="tl-result" data-slug="${esc(r.slug)}"><img src="${esc(r.thumb || '')}" alt=""><div><div>${esc(r.title)}</div><small>${esc(r.platform)} · ${esc(r.type)} · ${esc(r.year)}</small></div></div>`
  ).join('') : '<div class="tl-empty">Nada por aqui</div>';
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
$('tl-stage').addEventListener('mousemove', e => { cursorPending = { x: e.clientX / innerWidth, y: e.clientY / innerHeight }; });
setInterval(() => {
  if (cursorPending && $('tierlist-screen').classList.contains('active')) { socket.emit('tlCursor', cursorPending); cursorPending = null; }
}, 40);

function remoteCursor(username) {
  if (cursors[username]) return cursors[username];
  const p = tl.players.find(x => x.username === username);
  const img = document.createElement('img');
  img.className = 'tl-cursor';
  img.alt = '';
  img.src = cursorUrl(username);
  img.onerror = () => { // no PNG for this player: colored badge with initial
    const el = document.createElement('span');
    el.className = 'tl-cursor tl-cursor-fallback';
    el.style.setProperty('--c', p ? p.color : '#9aa0a6');
    el.textContent = username[0].toUpperCase();
    el.style.transform = img.style.transform;
    img.replaceWith(el);
    cursors[username] = el;
  };
  $('tl-cursors').appendChild(img);
  cursors[username] = img;
  return img;
}

// ==================== SOCKET ====================
socket.on('tlState', s => {
  Object.assign(tl, { players: s.players, host: s.host, album: s.album, songs: s.songs, tiers: s.tiers, votes: s.votes });
  tl.offset = s.serverNow - Date.now();
  renderPlayers();
  renderBoard();
  if (s.currentId !== null && s.songs[s.currentId] && s.songs[s.currentId].mp3) {
    applyPlayback({ currentId: s.currentId, mp3: s.songs[s.currentId].mp3, playback: s.playback, serverNow: s.serverNow });
  } else {
    tl.currentId = null; tl.playback = s.playback; audio.pause(); audio.removeAttribute('src');
    renderCurrent();
  }
});
socket.on('tlPlayers', ({ players, host }) => { tl.players = players; tl.host = host; renderPlayers(); });
socket.on('tlSearchResults', renderResults);
socket.on('tlPlayback', applyPlayback);
socket.on('tlError', ({ message }) => { $('tl-now').textContent = message; });
socket.on('tlCursor', ({ username, x, y, gone }) => {
  if (!tl.me || username === tl.me.username) return;
  if (gone) { if (cursors[username]) { cursors[username].remove(); delete cursors[username]; } return; }
  remoteCursor(username).style.transform = `translate(${x * innerWidth}px, ${y * innerHeight}px)`;
});

// ==================== CONTROLS ====================
$('tierlist-btn').addEventListener('click', () => {
  tl.me = window.currentUser;
  if (!tl.me) return;
  $('tl-stage').style.cursor = `url('${cursorUrl(tl.me.username)}') 23 2, auto`;
  socket.emit('tlJoin');
  show('tierlist-screen');
});
$('tl-back-btn').addEventListener('click', () => {
  socket.emit('tlLeave');
  audio.pause();
  audio.removeAttribute('src');
  Object.values(cursors).forEach(c => c.remove());
  for (const u of Object.keys(cursors)) delete cursors[u];
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
  const c = e.target.closest('.tl-card');
  if (c && isHost()) socket.emit('tlSelect', { songId: +c.dataset.id });
});
// song-name bubble above the hovered card
$('tl-board').addEventListener('mouseover', e => {
  const c = e.target.closest('.tl-card');
  if (!c) return;
  const r = c.getBoundingClientRect();
  const b = $('tl-bubble');
  b.textContent = c.dataset.name;
  b.style.left = `${r.left + r.width / 2}px`;
  b.style.top = `${r.top - 10}px`;
  b.hidden = false;
});
$('tl-board').addEventListener('mouseout', e => { if (e.target.closest('.tl-card')) $('tl-bubble').hidden = true; });
$('tl-play').addEventListener('click', () => socket.emit('tlPlayback', { playing: audio.paused, position: audio.currentTime }));
$('tl-next').addEventListener('click', () => {
  const ranked = rankedIds();
  const after = tl.currentId === null ? -1 : tl.currentId;
  const next = tl.songs.find(s => s.id > after && !ranked.has(s.id)) || tl.songs.find(s => !ranked.has(s.id) && s.id !== tl.currentId);
  if (next) socket.emit('tlSelect', { songId: next.id });
});
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
