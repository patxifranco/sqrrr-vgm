import { socketManager, audioManager } from './js/core/index.js';

const socket = socketManager.socket;
const $ = id => document.getElementById(id);
const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'];
const TIER_COLORS = { S: '#ff7f7f', A: '#ffbf7f', B: '#ffdf7f', C: '#ffff7f', D: '#bfff7f', F: '#7fff7f' };
const ME = Symbol('me');

const STAGE_W = 1920, STAGE_H = 1080;
let stageScale = 1, stageLeft = 0, stageTop = 0;
function fitStage() {
  stageScale = Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H);
  $('tl-stage').style.transform = `translate(-50%, -50%) scale(${stageScale})`;
  const r = $('tl-stage').getBoundingClientRect();
  stageLeft = r.left; stageTop = r.top;
  fitTray();
}
const toStage = (cx, cy) => ({ x: (cx - stageLeft) / stageScale, y: (cy - stageTop) / stageScale });
window.addEventListener('resize', () => { if (isActive()) fitStage(); });

const tl = { me: null, mode: null, players: [], colors: {}, host: null, album: null, songs: [], tiers: {}, trashed: [], votes: {}, currentId: null, playback: null, offset: 0, saved: [], view: null };
const SRC_ICON = {
  kh: '<svg class="tl-ico" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  yt: '<svg class="tl-ico" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg>',
  tm: '<svg class="tl-ico" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4"/><rect x="3" y="10" width="18" height="4"/><rect x="3" y="16" width="18" height="4"/></svg>'
};
const PLACEHOLDER = { music: 'Buscar en khinsider y YouTube, o pega una URL', general: 'Buscar plantillas en TierMaker' };
const audio = $('tl-audio');
const cursors = {};
let lastPos = null;
let cursorDirty = false;
let seekDragging = false;
let drag = null;
let suppressClick = false;
let hintTimer = null;
let actx = null, analyser = null, freq = null;

const isHost = () => !!tl.me && tl.host === tl.me.username;
const fmt = s => `${String(Math.floor((s || 0) / 60)).padStart(2, '0')}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`;
const cursorUrl = u => `tierlist/cursors/${encodeURIComponent(u)}.png`;
const proxied = mp3 => new URL(`/tierlist/audio?u=${encodeURIComponent(mp3)}`, location.href).href;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const songs = () => tl.view ? tl.view.songs : tl.songs;
const tiers = () => tl.view ? tl.view.tiers : tl.tiers;
const rankedIds = () => new Set(Object.values(tiers()).flat());
const isPlaced = id => rankedIds().has(id);
const tierOf = id => TIERS.find(t => (tiers()[t] || []).includes(id)) || null;
const isActive = () => $('tierlist-screen').classList.contains('active');
const colorOf = u => tl.colors[u] || '#9aa0a6';
const isGeneral = () => (tl.view ? tl.view.mode : tl.mode) === 'general';
const fmtDate = iso => { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; };

function show(id) {
  document.querySelectorAll('.screen-container').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function renderPlayers() {
  for (const p of tl.players) tl.colors[p.username] = p.color;
  $('tl-players').innerHTML = tl.players.map(p =>
    `<span class="tl-avatar${p.username === tl.host ? ' host' : ''}" data-user="${esc(p.username)}" style="--c:${p.color}" title="${esc(p.username)}${p.username === tl.host ? ' (host)' : isHost() ? ' · pasar el mando' : ''}"><img src="${esc(p.profilePicture)}" alt="${esc(p.username)}"><i class="tl-voted">✓</i></span>`
  ).join('');
  $('tl-stage').classList.toggle('is-host', isHost());
  renderVoted();
  const input = $('tl-search-input');
  input.disabled = !isHost();
  input.placeholder = isHost() ? (PLACEHOLDER[tl.mode] || '') : `Esperando a que ${tl.host || 'el host'} elija algo`;
  document.querySelectorAll('.tl-pick-box').forEach(b => { b.disabled = !isHost(); });
  for (const u of Object.keys(cursors)) {
    if (!tl.players.some(p => p.username === u)) removeCursor(u);
  }
  renderCurrent();
}

function cardHtml(s) {
  return `<div class="tl-card${s.artPending ? ' pending' : ''}" data-id="${s.id}" data-name="${esc(s.name)}" style="background-image:url('${esc(s.cover || '')}')"><span class="tl-card-num">${s.disc > 1 ? s.disc + '-' : ''}${s.num}</span></div>`;
}

function renderSaved() {
  $('tl-saved').innerHTML = tl.saved.length ? `<div class="tl-saved-title">Tierlists anteriores</div><div class="tl-saved-list">` + tl.saved.map(s =>
    `<button class="tl-saved-item" data-id="${esc(s.id)}" title="${esc(s.title)}"><span class="tl-saved-src">${SRC_ICON[s.mode === 'general' ? 'tm' : 'kh']}</span><span class="tl-saved-name">${esc(s.title)}</span><small>${esc(s.host)} · ${fmtDate(s.createdAt)} · ${s.count}</small></button>`
  ).join('') + `</div>` : '';
}

function renderBoard() {
  const viewing = !!tl.view;
  const hasList = viewing || !!tl.album;
  const stage = $('tl-stage');
  stage.classList.toggle('viewing', viewing);
  stage.classList.toggle('mode-general', viewing ? tl.view.mode === 'general' : tl.mode === 'general');
  stage.classList.toggle('mode-none', !viewing && !tl.mode);
  stage.classList.toggle('has-list', !viewing && !!tl.album);
  $('tl-pick').hidden = viewing || !!tl.mode;
  const searchWasHidden = $('tl-search').hidden;
  $('tl-search').hidden = viewing || !tl.mode || !!tl.album;
  if (searchWasHidden && !$('tl-search').hidden && isHost()) $('tl-search-input').focus();
  $('tl-board').hidden = !hasList;
  $('tl-view-back').hidden = !viewing;
  $('tl-view-edit').hidden = !viewing || !tl.me || tl.view.host !== tl.me.username;
  $('tl-album-title').textContent = viewing ? `${tl.view.title} · ${tl.view.host} · ${fmtDate(tl.view.createdAt)}` : (tl.album ? tl.album.title : '');
  if (!hasList) { $('tl-search-results').innerHTML = ''; renderSaved(); return; }
  const list = songs(), tt = tiers();
  for (const t of TIERS) $(`tl-drop-${t}`).innerHTML = (tt[t] || []).map(id => cardHtml(list[id])).join('');
  $('tl-tray').innerHTML = viewing ? '' : list.map(cardHtml).join('');
  fitTray();
  renderCurrent();
  renderVotes();
}

function fitTray() {
  const tray = $('tl-tray'), n = tray.children.length;
  if (!n || !tray.clientWidth) return;
  const W = tray.clientWidth - 16, H = tray.clientHeight - 16, gap = 6;
  let outer = 36;
  for (let c = 100; c >= 36; c -= 2) {
    const cols = Math.floor((W + gap) / (c + gap));
    if (cols && Math.ceil(n / cols) * (c + gap) - gap <= H) { outer = c; break; }
  }
  tray.style.setProperty('--cs', `${outer}px`);
}

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
    const audible = current && tl.songs[id] && tl.songs[id].source !== 'tm';
    if (audible && !wave) { wave = document.createElement('span'); wave.className = 'tl-wave'; wave.innerHTML = '<i></i><i></i><i></i><i></i>'; c.appendChild(wave); }
    else if (!audible && wave) wave.remove();
  });
}

function renderCurrent() {
  if (tl.view) return;
  document.querySelectorAll('.tl-drop .tl-card:not(.tl-vote)').forEach(c => c.classList.toggle('current', +c.dataset.id === tl.currentId));
  renderTrayStates();
  const s = tl.songs[tl.currentId];
  $('tl-now').textContent = s ? `${s.num}. ${s.name}` : (tl.album ? (isHost() ? 'Elige una canción' : 'Esperando al host') : '');
  $('tl-info').textContent = s ? `Pista ${tl.songs.indexOf(s) + 1} de ${tl.songs.length} · ${audio.duration ? fmt(audio.duration) : s.duration}` : (tl.album ? `${tl.songs.length} pistas` : '');
  $('tl-play').disabled = !isHost() || !s;
  $('tl-next').disabled = !isHost() || !tl.album;
  $('tl-seek').disabled = !isHost() || !s;
  $('tl-verdict-btn').disabled = !s || isPlaced(s.id);
  $('tl-finish-btn').disabled = !rankedIds().size;
  $('tl-play').classList.toggle('playing', !!(tl.playback && tl.playback.playing));
}

const token = u => `<span class="tl-token" style="--c:${colorOf(u)}" title="${esc(u)}">${esc(u[0].toUpperCase())}</span>`;
const votesFor = (id, tier) => Object.entries((tl.view ? tl.view.votes : tl.votes)[id] || {}).filter(([, t]) => t === tier).map(([u]) => u);
const voteCardHtml = (u, s) => `<div class="tl-card tl-vote" data-id="${s.id}" data-user="${esc(u)}" style="--c:${colorOf(u)};background-image:url('${esc(s.cover || '')}')"><span class="tl-vote-badge">${esc(u[0].toUpperCase())}</span></div>`;

function renderVoted() {
  const votes = tl.currentId !== null && !isPlaced(tl.currentId) && !tl.view ? (tl.votes[tl.currentId] || {}) : {};
  document.querySelectorAll('.tl-avatar').forEach(a => a.classList.toggle('voted', !!votes[a.dataset.user]));
}

function renderVotes() {
  renderVoted();
  document.querySelectorAll('.tl-drop .tl-vote').forEach(el => el.remove());
  if (tl.view || tl.currentId === null || isPlaced(tl.currentId)) return;
  const song = tl.songs[tl.currentId];
  for (const t of TIERS) $(`tl-drop-${t}`).insertAdjacentHTML('beforeend', votesFor(tl.currentId, t).map(u => voteCardHtml(u, song)).join(''));
  if (!$('tl-verdict').hidden) renderVerdict();
}

const SRC_NAME = { kh: 'khinsider', yt: 'YouTube', tm: 'TierMaker' };
function renderResults({ results, gated, error }) {
  const empty = error ? error : gated
    ? 'khinsider pide login para buscar. Pega la URL del álbum (downloads.khinsider.com/game-soundtracks/album/...) o escribe su nombre exacto, ej: minecraft'
    : 'Nada por aquí';
  $('tl-search-results').innerHTML = results.length ? results.map(r => {
    const id = r.source === 'kh' ? r.slug : r.id;
    const meta = r.source === 'yt' ? [`${r.count} vídeos`, r.channel] : r.source === 'tm' ? [`${r.count} imágenes`] : [r.type, r.year];
    return `<div class="tl-result" data-source="${r.source}" data-id="${esc(id)}" title="${esc(r.title)}${r.platform ? ' · ' + esc(r.platform) : ''}"><div class="tl-result-cover" style="background-image:url('${esc(r.thumb || '')}')"></div><span class="tl-result-src ${r.source}" title="${SRC_NAME[r.source]}">${SRC_ICON[r.source]}</span><div class="tl-result-title">${esc(r.title)}</div><div class="tl-result-meta">${meta.filter(Boolean).map(esc).join(' · ')}</div></div>`;
  }).join('') : `<div class="tl-empty">${empty}</div>`;
}

let loadingTimer = null;
function setLoading(on) {
  $('tl-loading').hidden = !on;
  $('tl-cursors').classList.toggle('loading', on);
  clearTimeout(loadingTimer);
  if (on) loadingTimer = setTimeout(() => setLoading(false), 25000);
}

function renderVerdict() {
  const id = tl.currentId;
  const counts = Object.fromEntries(TIERS.map(t => [t, votesFor(id, t).length]));
  const ranks = TIERS.flatMap((t, i) => Array(counts[t]).fill(i));
  const mean = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
  const mark = i => mean === null ? '' : Number.isInteger(mean) ? (i === mean ? ' avg' : '') : (i === Math.floor(mean) || i === Math.ceil(mean) ? ' split' : '');
  $('tl-verdict-title').innerHTML = isGeneral() ? `<img src="${esc(tl.songs[id].cover || '')}" alt="">` : esc(`${tl.songs[id].num}. ${tl.songs[id].name}`);
  $('tl-verdict-rows').innerHTML = TIERS.map((t, i) =>
    `<button class="tl-verdict-row${mark(i)}" data-tier="${t}" style="--tc:${TIER_COLORS[t]}"><span class="tl-label">${t}</span><span class="tl-verdict-cards">${votesFor(id, t).map(u => voteCardHtml(u, tl.songs[id])).join('')}</span>${mark(i) ? '<i class="tl-verdict-tag">media</i>' : ''}<em>${counts[t] || ''}</em><kbd>${i + 1}</kbd></button>`
  ).join('');
}

function decideVerdict(tier) {
  const panel = $('tl-verdict');
  if (panel.hidden) return 0;
  sfx('select', { volume: 0.2 });
  panel.classList.add('decided');
  panel.querySelectorAll('.tl-verdict-row').forEach(r => r.classList.toggle('chosen', r.dataset.tier === tier));
  setTimeout(() => { panel.hidden = true; panel.classList.remove('decided'); }, 1200);
  return 1200;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const fxc = $('tl-fxc'), fctx = fxc.getContext('2d');
const bits = [], falls = [], smoke = [];
function puff(x, y) {
  for (let i = 0; i < 10; i++) {
    const dir = i % 2 ? 1 : -1;
    smoke.push({ kind: 'puff', x: x + rnd(-16, 16), y: y + rnd(-6, 2), vx: dir * rnd(60, 280), vy: -rnd(20, 140), r: rnd(7, 13), grow: rnd(45, 80), t: 0, life: rnd(0.45, 0.75), shade: Math.round(rnd(170, 215)) });
  }
  for (let i = 0; i < 14; i++) {
    const ang = -Math.PI / 2 + rnd(-1.35, 1.35), sp = rnd(160, 560);
    smoke.push({ kind: 'grit', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: rnd(2, 4.5), t: 0, life: rnd(0.5, 0.85), shade: Math.round(rnd(110, 160)) });
  }
}
function stepSmoke(dt) {
  const k = Math.pow(0.04, dt);
  for (let i = smoke.length - 1; i >= 0; i--) {
    const p = smoke[i];
    p.t += dt;
    if (p.t > p.life) { smoke.splice(i, 1); continue; }
    if (p.kind === 'puff') { p.vx *= k; p.vy *= k; p.r += p.grow * dt; }
    else p.vy += 2300 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
}
function confetti(x, y) {
  const colors = ['#ff5a5a', '#ffd54a', '#4ade80', '#35b4ff', '#c084fc', '#ff8ccf', '#fb923c', '#f4f4f4'].concat(tl.players.map(p => p.color));
  for (let i = 0; i < 90; i++) {
    const ang = -Math.PI / 2 + rnd(-1.15, 1.15), sp = rnd(600, 1500);
    bits.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, w: rnd(6, 11), h: rnd(10, 18), c: colors[i % colors.length], rot: rnd(0, 6.28), vr: rnd(-7, 7), ph: rnd(0, 6.28), t: 0, life: rnd(1.7, 2.6) });
  }
}
function stepBits(dt) {
  const k = Math.pow(0.03, dt);
  for (let i = bits.length - 1; i >= 0; i--) {
    const p = bits[i];
    p.t += dt;
    if (p.t > p.life) { bits.splice(i, 1); continue; }
    p.vx *= k;
    p.vy = p.vy * k + 1000 * dt;
    p.x += p.vx * dt + Math.sin(p.t * 7 + p.ph) * 110 * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
  }
}
function startFall(el, x, y, gx, gy, vx, rot) {
  el.style.transformOrigin = `${gx}px ${gy}px`;
  falls.push({ el, x, y, vx, vy: 0, rot, vr: clamp(vx / 5, -260, 260) || 80 });
}
function stepFalls(dt) {
  for (let i = falls.length - 1; i >= 0; i--) {
    const f = falls[i];
    f.vy += 3200 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += f.vr * dt;
    f.el.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${f.rot}deg)`;
    if (f.y > STAGE_H + 220) { f.el.remove(); falls.splice(i, 1); }
  }
}
function drawFx(now) {
  fctx.clearRect(0, 0, STAGE_W, STAGE_H);
  fctx.lineCap = 'round'; fctx.lineJoin = 'round';
  for (const c of Object.getOwnPropertySymbols(cursors).concat(Object.keys(cursors)).map(k => cursors[k])) {
    if (!c.trail) continue;
    fctx.strokeStyle = colorOf(c.key === ME ? tl.me.username : c.key);
    for (let i = 1; i < c.trail.length; i++) {
      const age = (now - c.trail[i].t) / 340;
      fctx.globalAlpha = (1 - age) * 0.7;
      fctx.lineWidth = 2 + (1 - age) * 13;
      fctx.beginPath(); fctx.moveTo(c.trail[i - 1].x, c.trail[i - 1].y); fctx.lineTo(c.trail[i].x, c.trail[i].y); fctx.stroke();
    }
  }
  for (const p of smoke) {
    const a = 1 - p.t / p.life;
    fctx.beginPath(); fctx.arc(p.x, p.y, p.r, 0, 6.2832);
    fctx.globalAlpha = a * (p.kind === 'puff' ? 0.85 : 1);
    fctx.fillStyle = `rgb(${p.shade}, ${p.shade}, ${p.shade})`; fctx.fill();
    if (p.kind === 'puff') { fctx.globalAlpha = a * 0.6; fctx.lineWidth = 2; fctx.strokeStyle = `rgb(${p.shade - 80}, ${p.shade - 80}, ${p.shade - 80})`; fctx.stroke(); }
  }
  for (const p of bits) {
    fctx.save();
    fctx.translate(p.x, p.y); fctx.rotate(p.rot); fctx.scale(1, Math.cos(p.t * 9 + p.ph));
    fctx.globalAlpha = Math.min(1, (p.life - p.t) / 0.5);
    fctx.fillStyle = p.c;
    fctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    fctx.restore();
  }
  fctx.globalAlpha = 1;
}
function land(dest, tier, id) {
  const r = dest.getBoundingClientRect();
  const p = toStage(r.left + r.width / 2, r.bottom - 4);
  puff(p.x, p.y);
  if (tier === 'S') confetti(p.x, p.y - r.height / stageScale / 2);
  const badge = document.querySelector(`#tl-tray .tl-card[data-id="${id}"] .tl-tier-badge`);
  if (badge) { badge.classList.remove('stamp'); void badge.offsetWidth; badge.classList.add('stamp'); }
}
function landLater(id, wait) {
  setTimeout(() => {
    const dest = document.querySelector(`.tl-drop .tl-card:not(.tl-vote)[data-id="${id}"]`);
    if (dest) land(dest, tierOf(id), id);
  }, wait);
}

function openVerdict() {
  if (tl.view || tl.currentId === null || isPlaced(tl.currentId)) return;
  renderVerdict();
  $('tl-verdict').classList.remove('decided');
  $('tl-verdict').classList.toggle('readonly', !isHost());
  thud('pickup');
  $('tl-verdict-hint').innerHTML = `<b style="color:${colorOf(tl.host)}">${esc(tl.host || 'El host')}</b> elige el resultado final${isHost() ? ' · teclas 1-6' : ''}`;
  $('tl-verdict').hidden = false;
}

function pingCard(id, color) {
  document.querySelectorAll(`.tl-card:not(.tl-vote)[data-id="${id}"]`).forEach(card => {
    const ring = document.createElement('span');
    ring.className = 'tl-ping';
    ring.style.setProperty('--c', color);
    card.style.setProperty('--c', color);
    card.appendChild(ring);
    card.classList.add('pinged');
    setTimeout(() => { ring.remove(); card.classList.remove('pinged'); card.style.removeProperty('--c'); }, 1600);
  });
}

function expectedTime() {
  const pb = tl.playback;
  if (!pb) return 0;
  return pb.position + (pb.playing ? (Date.now() + tl.offset - pb.at) / 1000 : 0);
}

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

const SFX_NAMES = ['mensaje', 'pickup', 'drop', 'ping', 'select'];
const sfxBufs = {};
const sfxLoad = name => sfxBufs[name] || (sfxBufs[name] = fetch(`tierlist/audio/${name}.wav`).then(r => r.arrayBuffer()).then(b => actx.decodeAudioData(b)).catch(() => { delete sfxBufs[name]; }));
function sfx(name, { rate = 1, volume = 0.7 } = {}) {
  if (!actx) return;
  sfxLoad(name).then(buf => {
    if (!buf) return;
    const src = actx.createBufferSource(), gain = actx.createGain();
    src.buffer = buf; src.playbackRate.value = rate; gain.gain.value = volume;
    src.connect(gain).connect(actx.destination);
    src.start();
  });
}
const wobble = () => 0.7 + Math.random() * 0.6;
const thud = name => sfx(name, { rate: wobble(), volume: 0.25 });
const pingSoundAt = {};

audio.addEventListener('timeupdate', () => { $('tl-players').style.setProperty('--p', `${(audio.duration ? audio.currentTime / audio.duration * 100 : 0).toFixed(1)}%`); });
function stopAudio() {
  $('tl-players').style.setProperty('--p', '0%');
  audio.pause(); audio.removeAttribute('src');
  $('tl-clock').textContent = '00:00'; $('tl-seek').parentElement.style.setProperty('--f', '0'); $('tl-seek').value = 0;
}

function applyPlayback({ currentId, mp3, playback, serverNow }) {
  tl.offset = serverNow - Date.now();
  if (currentId !== tl.currentId) $('tl-verdict').hidden = true;
  tl.currentId = currentId;
  tl.playback = playback;
  if (currentId === null || !mp3) {
    stopAudio();
    renderCurrent(); renderVotes();
    return;
  }
  if (audio.src !== proxied(mp3)) audio.src = proxied(mp3);
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

const TILT_GAIN = 22, TILT_MAX = 40, TILT_DECAY = 0.988, TILT_EASE = 0.1;

function getCursor(key) {
  if (cursors[key]) return cursors[key];
  const username = key === ME ? tl.me.username : key;
  const c = { key, el: null, x: 0, y: 0, tilt: 0, tiltTarget: 0, lastX: null, lastT: 0, ghost: null, bubble: null, samples: [] };
  const img = document.createElement('img');
  img.className = key === ME ? 'tl-cursor me' : 'tl-cursor';
  img.alt = '';
  img.src = cursorUrl(username);
  img.onerror = () => { img.onerror = null; img.src = 'tierlist/cursors/default.png'; };
  $('tl-cursors').appendChild(img);
  c.el = img;
  c.spin = document.createElement('span');
  c.spin.className = 'tl-spin';
  c.spin.style.setProperty('--c', colorOf(username));
  $('tl-cursors').appendChild(c.spin);
  cursors[key] = c;
  return c;
}

const NET_DELAY = 70;
function pointCursor(c, x, y, now) {
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

function removeCursor(key) {
  const c = cursors[key];
  if (!c) return;
  c.el.remove();
  c.spin.remove();
  if (c.ghost) c.ghost.el.remove();
  if (c.bubble) c.bubble.el.remove();
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

window.addEventListener('pointermove', e => {
  if (!isActive()) return;
  const p = toStage(e.clientX, e.clientY);
  lastPos = { x: p.x / STAGE_W, y: p.y / STAGE_H };
  cursorDirty = true;
  if (tl.me) { const c = getCursor(ME); c.el.hidden = false; pointCursor(c, p.x, p.y, performance.now()); }
});
document.documentElement.addEventListener('pointerleave', () => { if (cursors[ME]) cursors[ME].el.hidden = true; });

setInterval(() => {
  if (!isActive() || !lastPos || !(cursorDirty || drag)) return;
  cursorDirty = false;
  socket.emit('tlCursor', { ...lastPos, drag: drag ? { id: drag.id, gx: drag.gx, gy: drag.gy, rot: drag.rot } : null });
}, 16);

const G = 3000, DAMP = 5, AMAX = 3000;

function startDrag(e, card, mode) {
  const id = +card.dataset.id;
  const r = card.getBoundingClientRect();
  const p = toStage(e.clientX, e.clientY);
  const gx = (e.clientX - r.left) / stageScale, gy = (e.clientY - r.top) / stageScale;
  const w = r.width / stageScale, h = r.height / stageScale;
  const ox = gx - w / 2, oy = -Math.abs(gy - h / 2);
  const phi0 = Math.atan2(-ox, -oy);
  drag = { id, mode, card, gx, gy, L: Math.max(10, Math.hypot(ox, oy)), phi: phi0, phi0, omega: 0, rot: 0,
    px: p.x, py: p.y, prevPx: p.x, vx: 0, startX: p.x, startY: p.y, moved: false, lastT: performance.now(), el: ghostEl(tl.songs[id]) };
  drag.el.style.transformOrigin = `${gx}px ${gy}px`;
  card.classList.add('dragging');
  thud('pickup');
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
  if (e.button === 1) e.preventDefault();
  if (e.button !== 0 || drag || tl.view) return;
  const card = e.target.closest('.tl-card');
  if (!card) return;
  const id = +card.dataset.id;
  const inTray = !!card.closest('#tl-tray');
  const isVote = card.classList.contains('tl-vote');
  let mode = null;
  if (isVote) mode = card.dataset.user === tl.me.username ? 'vote' : null;
  else if (inTray) mode = id === tl.currentId && !isPlaced(id) ? 'vote' : null;
  else mode = isHost() ? 'move' : null;
  if (!mode) return;
  e.preventDefault();
  startDrag(e, card, mode);
});

window.addEventListener('pointermove', e => {
  if (!drag) return;
  const p = toStage(e.clientX, e.clientY);
  drag.px = p.x; drag.py = p.y;
  if (!drag.moved && Math.hypot(p.x - drag.startX, p.y - drag.startY) > 4) drag.moved = true;
  const { row, trash } = dropTarget(e.clientX, e.clientY);
  document.querySelectorAll('.tl-row.hot').forEach(r => r !== row && r.classList.remove('hot'));
  if (row) row.classList.add('hot');
  $('tl-trash').classList.toggle('hot', !!trash && isHost());
});

window.addEventListener('pointerup', e => {
  if (!drag) return;
  const d = drag;
  drag = null;
  d.card.classList.remove('dragging');
  document.querySelectorAll('.tl-row.hot').forEach(r => r.classList.remove('hot'));
  $('tl-trash').classList.remove('hot');
  if (!d.moved) { d.el.remove(); if (lastPos) socket.emit('tlCursor', { ...lastPos, drag: null }); return; }
  suppressClick = true;
  const { row, trash } = dropTarget(e.clientX, e.clientY);
  if (row || (trash && isHost())) d.el.remove();
  else {
    startFall(d.el, d.px - d.gx, d.py - d.gy, d.gx, d.gy, d.vx, d.rot);
    socket.emit('tlFall', { id: d.id, x: d.px - d.gx, y: d.py - d.gy, gx: d.gx, gy: d.gy, vx: d.vx, rot: d.rot });
  }
  if (lastPos) socket.emit('tlCursor', { ...lastPos, drag: null });
  if (row) {
    const tier = row.dataset.tier;
    thud('drop');
    if (d.mode === 'vote') socket.emit('tlVote', { songId: d.id, tier });
    else {
      const index = [...row.querySelectorAll('.tl-drop .tl-card:not(.tl-vote)')].filter(c => { const r = c.getBoundingClientRect(); return +c.dataset.id !== d.id && r.left + r.width / 2 < e.clientX; }).length;
      socket.emit('tlVerdict', { songId: d.id, tier, index });
    }
  } else if (trash && isHost()) {
    socket.emit('tlTrash', { songId: d.id });
  }
});

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
  } else if (playing) {
    const t = now / 1000;
    levels = [0, 1, 2, 3].map(i => 0.3 + 0.3 * (1 + Math.sin(t * 5 + i * 1.7)) / 2);
  } else levels = [0.12, 0.12, 0.12, 0.12];
  levels.forEach((l, i) => wave.style.setProperty(`--l${i}`, l.toFixed(2)));
}

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
      c.spin.style.transform = `translate(${c.x}px, ${c.y}px)`;
      if (c.bubble && !c.bubble.el.hidden) {
        if (now > c.bubble.until) c.bubble.el.hidden = true;
        else c.bubble.el.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${c.tilt}deg) translate(18px, 34px)`;
      }
      if (c.ghost) {
        c.ghost.rot += (c.ghost.rotTarget - c.ghost.rot) * 0.5;
        c.ghost.el.style.transform = `translate(${c.x - c.ghost.gx}px, ${c.y - c.ghost.gy}px) rotate(${c.ghost.rot}deg)`;
      }
      if (c.ghost || (c.key === ME && drag)) {
        const last = c.trail && c.trail[c.trail.length - 1];
        if (!last || Math.hypot(c.x - last.x, c.y - last.y) > 1.5) (c.trail = c.trail || []).push({ x: c.x, y: c.y, t: now });
      }
      if (c.trail) { c.trail = c.trail.filter(p => now - p.t < 340); if (!c.trail.length) c.trail = null; }
    }
    if (drag) stepDrag(now);
    const dt = Math.min(0.05, (now - lastTick) / 1000);
    stepBits(dt); stepFalls(dt); stepSmoke(dt); drawFx(now);
    stepWave(now);
  }
  lastTick = now;
  requestAnimationFrame(tick);
}
let lastTick = performance.now();
requestAnimationFrame(tick);

const chatInput = document.createElement('input');
chatInput.type = 'text'; chatInput.maxLength = 60; chatInput.autocomplete = 'off'; chatInput.className = 'tl-chat-input';
$('tl-stage').appendChild(chatInput);
let typing = false;

function bubbleFor(c) {
  if (!c.bubble) {
    const el = document.createElement('div');
    el.className = 'tl-chat-bubble';
    el.hidden = true;
    $('tl-cursors').appendChild(el);
    c.bubble = { el, until: 0 };
  }
  return c.bubble;
}
function startChat() {
  if (!tl.me || typing) return;
  typing = true;
  $('tl-dim').hidden = false;
  chatInput.value = '';
  const b = bubbleFor(getCursor(ME));
  b.el.textContent = '';
  b.el.classList.add('typing');
  b.el.hidden = false;
  b.until = Infinity;
  chatInput.focus();
}
function endChat(send) {
  if (!typing) return;
  typing = false;
  $('tl-dim').hidden = true;
  const text = chatInput.value.trim();
  chatInput.value = '';
  chatInput.blur();
  const b = bubbleFor(getCursor(ME));
  b.el.classList.remove('typing');
  b.el.hidden = true;
  if (send && text) socket.emit('tlChat', { text });
}
chatInput.addEventListener('input', () => { bubbleFor(getCursor(ME)).el.textContent = chatInput.value; });
chatInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); endChat(true); }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); endChat(false); }
});
chatInput.addEventListener('blur', () => { if (typing) endChat(false); });
window.addEventListener('keydown', e => {
  if (!isActive() || typing || drag || e.ctrlKey || e.altKey || e.metaKey) return;
  const t = document.activeElement;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
  if (e.key === 'Escape' && !$('tl-preview').hidden) { $('tl-preview').hidden = true; return; }
  if (e.key === 'Escape' && !$('tl-leave').hidden) { $('tl-leave').hidden = true; return; }
  if (e.key === 'Enter') { e.preventDefault(); startChat(); return; }
  if (tl.view || tl.currentId === null || isPlaced(tl.currentId)) return;
  const tier = TIERS[Number(e.key) - 1];
  if (tier) {
    thud('drop');
    if (isHost() && !$('tl-verdict').hidden) socket.emit('tlVerdict', { songId: tl.currentId, tier });
    else socket.emit('tlVote', { songId: tl.currentId, tier });
  } else if (e.key === 'v' || e.key === 'V') $('tl-verdict-btn').click();
});
socket.on('tlChat', ({ username, text }) => {
  if (!tl.me) return;
  const c = username === tl.me.username ? getCursor(ME) : (tl.players.some(p => p.username === username) ? getCursor(username) : null);
  if (!c) return;
  sfx('mensaje');
  const b = bubbleFor(c);
  b.el.classList.remove('typing');
  b.el.textContent = text;
  b.el.hidden = false;
  b.until = performance.now() + 3000;
});

socket.on('tlLoading', ({ on }) => setLoading(!!on));
socket.on('tlState', s => {
  setLoading(false);
  Object.assign(tl, { mode: s.mode || null, players: s.players, host: s.host, album: s.album, songs: s.songs, tiers: s.tiers, trashed: s.trashed || [], votes: s.votes, saved: s.saved || tl.saved });
  tl.offset = s.serverNow - Date.now();
  if (tl.mode) tl.view = null;
  $('tl-verdict').hidden = true;
  $('tl-preview').hidden = true;
  $('tl-leave').hidden = true;
  renderPlayers();
  renderBoard();
  if (s.currentId !== null && s.songs[s.currentId] && s.songs[s.currentId].mp3) {
    applyPlayback({ currentId: s.currentId, mp3: s.songs[s.currentId].mp3, playback: s.playback, serverNow: s.serverNow });
  } else {
    tl.currentId = s.currentId; tl.playback = s.playback; stopAudio();
    renderCurrent();
    renderVotes();
  }
});
socket.on('tlPlayers', ({ players, host }) => {
  if (tl.players.length && players.length > tl.players.length) audioManager.play('notify', { volume: 0.6 });
  tl.players = players; tl.host = host; renderPlayers();
});
socket.on('tlSearchResults', renderResults);
socket.on('tlSearching', () => { if (!isHost()) $('tl-search-results').innerHTML = '<div class="tl-empty">Buscando</div>'; });
socket.on('tlTyping', ({ q }) => { if (!isHost()) $('tl-search-input').value = q; });
socket.on('tlPlayback', d => { setLoading(false); if (d.currentId !== null && d.currentId !== tl.currentId) sfx('select', { volume: 0.2 }); applyPlayback(d); });
socket.on('tlVotes', ({ songId, votes }) => { tl.votes[songId] = votes; if (songId === tl.currentId) renderVotes(); });
socket.on('tlTiers', ({ tiers, trashed, placed }) => {
  tl.tiers = tiers; tl.trashed = trashed || [];
  renderBoard();
  if (placed !== null && placed !== undefined) {
    const card = document.querySelector(`.tl-drop .tl-card:not(.tl-vote)[data-id="${placed}"]`);
    if (card) card.classList.add('pop');
    landLater(placed, placed === tl.currentId ? decideVerdict(TIERS.find(t => tiers[t].includes(placed))) : 0);
  }
});
socket.on('tlFall', ({ username, id, x, y, gx, gy, vx, rot }) => {
  if (!tl.me || username === tl.me.username || !tl.songs[id]) return;
  startFall(ghostEl(tl.songs[id]), x, y, gx, gy, vx, rot);
});
socket.on('tlCovers', ({ slug, covers }) => {
  if (!tl.album || tl.album.slug !== slug) return;
  for (const [id, url] of Object.entries(covers)) {
    if (!tl.songs[id]) continue;
    tl.songs[id].artPending = false;
    if (url) tl.songs[id].cover = url;
    document.querySelectorAll(`.tl-card[data-id="${id}"]`).forEach(c => { c.classList.remove('pending'); if (url) c.style.backgroundImage = `url('${url}')`; });
  }
});
socket.on('tlVerdictOpen', openVerdict);
function pingSound(username) {
  const now = Date.now();
  if (now - (pingSoundAt[username] || 0) < 1500) return;
  pingSoundAt[username] = now;
  sfx('ping');
}
socket.on('tlPing', ({ username, songId }) => { pingCard(songId, colorOf(username)); pingSound(username); });
socket.on('tlPingTier', ({ username, tier }) => {
  pingSound(username);
  const row = document.querySelector(`.tl-verdict-row[data-tier="${tier}"]`);
  if (!row || $('tl-verdict').hidden) return;
  const ring = document.createElement('span');
  ring.className = 'tl-ping';
  ring.style.setProperty('--c', colorOf(username));
  row.style.setProperty('--c', colorOf(username));
  row.appendChild(ring);
  row.classList.add('pinged');
  setTimeout(() => { ring.remove(); row.classList.remove('pinged'); row.style.removeProperty('--c'); }, 1200);
});
socket.on('tlSaved', ({ list }) => { if (!list) return; tl.view = list; $('tl-verdict').hidden = true; stopAudio(); renderBoard(); });
socket.on('tlError', ({ message }) => { setLoading(false); $('tl-now').textContent = message; });
socket.on('tlCursor', ({ username, x, y, gone, drag: d }) => {
  if (!tl.me || username === tl.me.username) return;
  if (gone) return removeCursor(username);
  const c = getCursor(username);
  pointCursor(c, x * STAGE_W, y * STAGE_H, performance.now());
  setRemoteGhost(c, d && tl.songs[d.id] ? d : null);
});

function leaveScreen() {
  endChat(false);
  setLoading(false);
  socket.emit('tlLeave');
  stopAudio();
  clearCursors();
  tl.view = null;
  $('tl-verdict').hidden = true;
  $('tl-leave').hidden = true;
  show('hub-screen');
}
$('tierlist-btn').addEventListener('click', () => {
  tl.me = window.currentUser;
  if (!tl.me) return;
  ensureAudioGraph();
  if (actx) SFX_NAMES.forEach(sfxLoad);
  socket.emit('tlJoin');
  show('tierlist-screen');
  fitStage();
});
$('tl-back-btn').addEventListener('click', () => { if (isHost() && tl.mode && !tl.view) $('tl-leave').hidden = false; else leaveScreen(); });
$('tl-leave').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.hidden = true; });
$('tl-leave-all').addEventListener('click', () => { $('tl-leave').hidden = true; socket.emit('tlReset'); });
$('tl-leave-me').addEventListener('click', leaveScreen);
window.addEventListener('pagehide', () => {
  if (!isActive()) return;
  try { socket.emit('tlLeave'); navigator.sendBeacon('/tierlist/leave', socket.id); } catch {}
});
$('tl-finish-btn').addEventListener('click', () => { if (isHost()) socket.emit('tlFinish'); });
$('tl-view-back').addEventListener('click', () => { tl.view = null; renderBoard(); });
$('tl-view-edit').addEventListener('click', () => { if (tl.view) socket.emit('tlSavedEdit', { id: tl.view.id }); });
$('tl-players').addEventListener('click', e => {
  const a = e.target.closest('.tl-avatar');
  if (a && isHost() && a.dataset.user !== tl.me.username) socket.emit('tlHost', { username: a.dataset.user });
});
$('tl-saved').addEventListener('click', e => { const it = e.target.closest('.tl-saved-item'); if (it) socket.emit('tlSavedGet', { id: it.dataset.id }); });
function load(source, id) { socket.emit('tlLoad', { source, id }); }
function search() {
  const q = $('tl-search-input').value.trim();
  if (!q || !isHost()) return;
  const kh = q.match(/khinsider\.com\/game-soundtracks\/album\/([A-Za-z0-9._-]+)/);
  if (kh) return load('kh', kh[1]);
  if (/^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//.test(q)) return load('yturl', q);
  const tm = q.match(/tiermaker\.com\/create\/([A-Za-z0-9._-]+)/);
  if (tm) return load('tm', tm[1]);
  $('tl-search-results').innerHTML = '<div class="tl-empty">Buscando</div>';
  socket.emit('tlSearch', { q });
}
$('tl-search-input').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
let typingTimer = null;
$('tl-search-input').addEventListener('input', e => {
  if (!isHost() || typingTimer) return;
  typingTimer = setTimeout(() => { typingTimer = null; socket.emit('tlTyping', { q: e.target.value }); }, 80);
});
document.querySelectorAll('.tl-pick-box').forEach(b => b.addEventListener('click', () => { if (isHost()) socket.emit('tlMode', { mode: b.dataset.mode }); }));
$('tl-search-back').addEventListener('click', () => { if (isHost()) socket.emit('tlMode', { mode: null }); });
$('tl-search-go').addEventListener('click', search);
$('tl-search-results').addEventListener('click', e => {
  const r = e.target.closest('.tl-result');
  if (r && isHost()) load(r.dataset.source, r.dataset.id);
});
function showPreview(id) {
  const s = songs()[id];
  if (!s || !s.cover) return;
  const img = $('tl-preview').querySelector('img');
  img.style.width = '';
  img.onload = () => {
    const k = Math.min(900 / img.naturalWidth, 800 / img.naturalHeight);
    img.style.width = Math.round(img.naturalWidth * k) + 'px';
  };
  img.src = s.cover;
  $('tl-preview').hidden = false;
}
$('tl-preview').addEventListener('click', () => { $('tl-preview').hidden = true; });
$('tl-board').addEventListener('click', e => {
  if (suppressClick) { suppressClick = false; return; }
  const c = e.target.closest('.tl-card:not(.tl-vote)');
  if (!c) return;
  if (isGeneral()) showPreview(+c.dataset.id);
  if (tl.view || (isGeneral() && !isHost())) return;
  if (!isHost()) return socket.emit('tlPing', { songId: +c.dataset.id });
  if (c.classList.contains('trashed')) return socket.emit('tlRestore', { songId: +c.dataset.id });
  if (+c.dataset.id !== tl.currentId) socket.emit('tlSelect', { songId: +c.dataset.id });
});
$('tl-board').addEventListener('auxclick', e => {
  const c = e.target.closest('.tl-card:not(.tl-vote)');
  if (e.button === 1 && c && !tl.view) { e.preventDefault(); socket.emit('tlPing', { songId: +c.dataset.id }); }
});
$('tl-trash').addEventListener('click', () => { if (isHost() && tl.currentId !== null) socket.emit('tlTrash', { songId: tl.currentId }); });
$('tl-board').addEventListener('mouseover', e => {
  const c = e.target.closest('.tl-card');
  if (!c || drag || isGeneral()) return;
  const id = +c.dataset.id;
  if (c.classList.contains('tl-vote')) return hint(c, `Voto de ${c.dataset.user}`);
  const parts = TIERS.map(t => [t, votesFor(id, t).length]).filter(([, n]) => n).map(([t, n]) => `${t} ${n}`);
  const tier = tierOf(id);
  hint(c, c.dataset.name + (tier ? `  ·  ${tier}` : '') + (parts.length ? `  ·  votos: ${parts.join(', ')}` : ''));
});
$('tl-board').addEventListener('mouseout', e => { if (e.target.closest('.tl-card')) $('tl-bubble').hidden = true; });
function hint(card, text, ms = 0) {
  const r = card.getBoundingClientRect();
  const p = toStage(r.left + r.width / 2, r.top - 10);
  const b = $('tl-bubble');
  b.textContent = text;
  b.style.left = `${p.x}px`;
  b.style.top = `${p.y}px`;
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
  if (!r) return;
  if (!isHost()) return socket.emit('tlPingTier', { tier: r.dataset.tier });
  thud('drop');
  socket.emit('tlVerdict', { songId: tl.currentId, tier: r.dataset.tier });
});
$('tl-verdict-rows').addEventListener('auxclick', e => {
  const r = e.target.closest('.tl-verdict-row');
  if (e.button === 1 && r) { e.preventDefault(); socket.emit('tlPingTier', { tier: r.dataset.tier }); }
});
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
