import { socketManager } from './js/core/index.js';
import { makeDraggable } from './js/ui/drag.js';

const socket = socketManager.socket;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt2 = s => { s = Math.max(0, Math.floor(s || 0)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const proxied = url => new URL(`/tierlist/audio?u=${encodeURIComponent(url)}`, location.href).href;

const SRC_ICON = {
  kh: '<svg class="tl-ico" viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  yt: '<svg class="tl-ico" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="4"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg>'
};
$('va-src').querySelector('.kh .va-src-ico').innerHTML = SRC_ICON.kh;
$('va-src').querySelector('.yt .va-src-ico').innerHTML = SRC_ICON.yt;
const audio = $('va-audio');
let src = 'kh', results = null, album = null, track = null, trackIndex = -1, busy = false;
let actx = null, analyser = null, freq = null, visAngle = 0;
const vis = $('va-vis'), vctx = vis.getContext('2d');

const status = t => { $('va-status').textContent = t; };
const SEG = 24;
$('va-loading-bar').innerHTML = Array(SEG).fill('<div class="msn-file-progress-segment"></div>').join('');
const segs = [...$('va-loading-bar').children];
let loadTimer = null, loadPos = 0;
function loading(text) {
  const bar = $('va-loading-bar');
  if (!text) { bar.hidden = true; clearInterval(loadTimer); loadTimer = null; return; }
  status(text);
  bar.hidden = false;
  if (!loadTimer) loadTimer = setInterval(() => { loadPos = (loadPos + 1) % SEG; segs.forEach((s, i) => s.classList.toggle('filled', (i - loadPos + SEG) % SEG < 4)); }, 80);
}
let seeking = false, libView = 'results', mineId = null;
function stopMine() {
  if (mineId === null) return;
  mineId = null;
  audio.pause(); audio.removeAttribute('src');
  $('va-lcd').textContent = 'Elige una pista';
  for (const r of $('va-mine').querySelectorAll('tr.on')) r.classList.remove('on');
}
function show(view) {
  $('va-dlg').hidden = true;
  if (view !== 'mine') stopMine();
  for (const v of ['results', 'album', 'mine']) $(`va-${v}`).hidden = v !== view;
  if (view !== 'mine') libView = view;
  document.querySelector('.wmp-lib').dataset.view = view;
  $('va-lib-btn').classList.toggle('on', view !== 'mine');
  $('va-mine-btn').classList.toggle('on', view === 'mine');
  $('va-libtitle').textContent = view === 'mine' ? 'Canciones añadidas' : 'Biblioteca multimedia';
}

function ensureVis() {
  if (actx || !window.AudioContext) return;
  try {
    actx = new AudioContext();
    const node = actx.createMediaElementSource(audio);
    analyser = actx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    node.connect(analyser);
    analyser.connect(actx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
  } catch (e) { actx = null; analyser = null; }
}
function drawVis() {
  const w = vis.width, h = vis.height;
  let level = 0;
  if (analyser && !audio.paused) { analyser.getByteFrequencyData(freq); for (let i = 0; i < 16; i++) level += freq[i]; level = level / (16 * 255); }
  vctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  vctx.fillRect(0, 0, w, h);
  vctx.globalCompositeOperation = 'lighter';
  visAngle += 0.01 + level * 0.04;
  for (let i = 0; i < 3; i++) {
    const a = visAngle * (i % 2 ? -1 : 1) + i * 2.1;
    const cx = w / 2 + Math.cos(a) * (40 + i * 25), cy = h / 2 + Math.sin(a * 1.3) * (20 + i * 10);
    const r = 40 + level * 120 + i * 18;
    const g = vctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255, 190, 90, ${0.35 + level * 0.5})`);
    g.addColorStop(0.5, `rgba(230, 110, 20, ${0.18 + level * 0.3})`);
    g.addColorStop(1, 'rgba(120, 40, 0, 0)');
    vctx.fillStyle = g;
    vctx.beginPath(); vctx.arc(cx, cy, r, 0, 6.2832); vctx.fill();
  }
  vctx.globalCompositeOperation = 'source-over';
  requestAnimationFrame(drawVis);
}
requestAnimationFrame(drawVis);

function renderResults() {
  if (!results) return;
  const list = src === 'kh' ? results.kh.map(r => ({ id: r.slug, title: r.title, thumb: r.thumb, meta: [r.type, r.year].filter(Boolean).join(' · ') })) : results.yt.map(r => ({ id: r.id, kind: r.kind, title: r.title, thumb: r.thumb, meta: `${r.kind === 'video' ? r.duration : r.count + ' vídeos'} · ${r.channel}` }));
  for (const s of ['kh', 'yt']) $('va-src').querySelector(`.${s} b`).textContent = (s === 'kh' ? results.kh : results.yt).length || '';
  $('va-results').innerHTML = list.length ? list.map(r => `<button class="va-card" data-id="${esc(r.id)}" data-kind="${esc(r.kind || '')}"><span class="va-cover" style="background-image:url('${esc(r.thumb || '')}')"></span><span class="va-card-title">${esc(r.title)}</span><small>${esc(r.meta)}</small></button>`).join('') : '<p class="va-empty">No se encontró nada.</p>';
  show('results');
}

function renderAlbum() {
  $('va-album-title').textContent = album.title;
  $('va-album-cover').style.backgroundImage = `url('${album.cover || ''}')`;
  $('va-tracks').innerHTML = album.tracks.map((t, i) => `<tr data-i="${i}"><td>${t.disc > 1 ? t.disc + '-' : ''}${t.num}</td><td>${esc(t.name)}</td><td>${esc(t.duration || '')}</td></tr>`).join('');
  show('album');
}

function renderMeta() {
  $('va-game').textContent = track ? album.game : '';
  $('va-song').textContent = track ? track.song : '';
  $('va-submit').disabled = !track || busy || !audio.src;
}

function pickTrack(i) {
  if (!album || !album.tracks[i]) return;
  ensureVis();
  trackIndex = i;
  track = album.tracks[i];
  $('va-dlg').hidden = true;
  [...$('va-tracks').rows].forEach(r => r.classList.toggle('on', +r.dataset.i === i));
  audio.pause(); audio.removeAttribute('src');
  $('va-lcd').textContent = 'Cargando...';
  $('va-submit-msg').textContent = '';
  loading(`Cargando "${track.song}"...`);
  renderMeta();
  socket.emit('vaStream', album.source === 'yt' ? { source: 'yt', ytId: track.ytId } : { source: 'kh', page: track.page });
}

socket.on('vaResults', data => { results = data; loading(null); status(`${data.kh.length + data.yt.length} resultados para "${data.q}"`); renderResults(); });
socket.on('vaTracks', data => { album = data; loading(null); status(`${data.tracks.length} pistas`); renderAlbum(); if (data.tracks.length === 1) pickTrack(0); });
socket.on('vaStreamUrl', ({ page, ytId, url }) => {
  if (!track || (track.page !== page && track.ytId !== ytId)) return;
  audio.src = proxied(url);
  audio.play().catch(() => {});
  $('va-lcd').textContent = track.song;
  renderMeta();
});
audio.addEventListener('canplay', () => { loading(null); if (track) status(track.song); });
socket.on('vaProgress', ({ message }) => { status(message); $('va-submit-msg').textContent = message; });
socket.on('vaDone', ({ song, total }) => {
  busy = false;
  renderMeta();
  $('va-submit-msg').textContent = `Añadida. El VGM tiene ahora ${total} canciones.`;
  status(`"${song.song}" añadida`);
});
socket.on('vaMineList', ({ admin, songs }) => {
  loading(null);
  if (mineId !== null && !songs.some(s => s.id === mineId)) stopMine();
  $('va-mine').innerHTML = songs.length
    ? `<table class="va-tracks va-mine"><thead><tr><th>Canción</th><th>Juego</th><th>Inicio</th><th>Añadida por</th><th></th></tr></thead><tbody>${songs.map(s => `<tr data-id="${s.id}"><td>${esc(s.song)}</td><td>${esc(s.game)}</td><td>${fmt2(s.start)}</td><td><b style="color:${esc(s.color || '#000')}">${esc(s.addedBy)}</b></td><td><button class="va-x" title="Quitar del VGM">&#x2715;</button></td></tr>`).join('')}</tbody></table>`
    : `<p class="va-empty">${admin ? 'No hay canciones añadidas.' : 'No has añadido ninguna canción.'}</p>`;
  status(`${songs.length} ${songs.length === 1 ? 'canción' : 'canciones'}`);
  show('mine');
  if (mineId !== null) $('va-mine').querySelector(`tr[data-id="${mineId}"]`).classList.add('on');
});
socket.on('vaMineUrl', ({ id, url }) => {
  if (id !== mineId) return;
  audio.src = url;
  audio.play().catch(() => {});
});
socket.on('vaError', ({ message }) => { busy = false; loading(null); renderMeta(); $('va-submit-msg').textContent = message; status(message); });

function search() {
  const q = $('va-q').value.trim();
  if (!q) return;
  status('Buscando...');
  $('va-results').innerHTML = '';
  show('results');
  loading(`Buscando "${q}"...`);
  socket.emit('vaSearch', { q });
}
$('va-go').addEventListener('click', search);
$('va-q').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
$('va-src').addEventListener('click', () => { src = src === 'kh' ? 'yt' : 'kh'; $('va-src').dataset.src = src; renderResults(); });
$('va-results').addEventListener('click', e => {
  const c = e.target.closest('.va-card');
  if (!c) return;
  status('Abriendo...');
  loading(`Abriendo "${c.querySelector('.va-card-title').textContent}"...`);
  socket.emit('vaOpen', { source: src, id: c.dataset.id, kind: c.dataset.kind });
});
$('va-album-back').addEventListener('click', () => { audio.pause(); show('results'); });
$('va-mine-btn').addEventListener('click', () => { loading('Cargando...'); socket.emit('vaMine'); });
$('va-lib-btn').addEventListener('click', () => { show(libView); status('Listo'); });
$('va-mine').addEventListener('click', e => {
  const b = e.target.closest('.va-x');
  const row = e.target.closest('tr[data-id]');
  if (!b) {
    if (!row) return;
    const id = +row.dataset.id;
    if (id === mineId) return stopMine();
    stopMine();
    ensureVis();
    mineId = id;
    row.classList.add('on');
    $('va-lcd').textContent = `${row.cells[0].textContent} - ${row.cells[1].textContent}`;
    socket.emit('vaPlayMine', { id });
    return;
  }
  if (b.classList.contains('arm')) { socket.emit('vaRemove', { id: +b.closest('tr').dataset.id }); return; }
  b.classList.add('arm');
  b.textContent = '¿Seguro?';
  setTimeout(() => { b.classList.remove('arm'); b.innerHTML = '&#x2715;'; }, 3000);
});
$('va-tracks').addEventListener('click', e => { const r = e.target.closest('tr'); if (r) pickTrack(+r.dataset.i); });

$('va-play').addEventListener('click', () => { if (!audio.src) return; audio.paused ? audio.play().catch(() => {}) : audio.pause(); });
$('va-stop').addEventListener('click', () => { if (!audio.src) return; audio.pause(); audio.currentTime = 0; });
$('va-prev').addEventListener('click', () => pickTrack(trackIndex - 1));
$('va-next').addEventListener('click', () => pickTrack(trackIndex + 1));
$('va-mute').addEventListener('click', () => { audio.muted = !audio.muted; $('va-mute').classList.toggle('muted', audio.muted); });
$('va-seek').addEventListener('pointerdown', () => { seeking = true; });
window.addEventListener('pointerup', () => { seeking = false; });
$('va-seek').addEventListener('input', e => { if (audio.duration) $('va-time').textContent = `${fmt2(e.target.value / 1000 * audio.duration)} / ${fmt2(audio.duration)}`; });
$('va-seek').addEventListener('change', e => { seeking = false; if (audio.duration) audio.currentTime = e.target.value / 1000 * audio.duration; });
$('va-vol').addEventListener('input', e => { audio.volume = e.target.value / 100; });
audio.volume = 0.8;
audio.addEventListener('timeupdate', () => {
  const t = `${fmt2(audio.currentTime)} / ${fmt2(audio.duration)}`;
  $('va-time').textContent = t;
  if (audio.duration && !seeking) {
    $('va-seek').value = Math.round(audio.currentTime / audio.duration * 1000);
    $('va-dlg-seek').value = $('va-seek').value;
    $('va-dlg-time').textContent = t;
  }
  renderMeta();
});
audio.addEventListener('play', () => { $('va-play').classList.add('playing'); $('va-dlg-play').classList.add('playing'); });
audio.addEventListener('pause', () => { $('va-play').classList.remove('playing'); $('va-dlg-play').classList.remove('playing'); });

const dlg = $('va-dlg');
function closeDlg() { dlg.hidden = true; audio.pause(); }
$('va-submit').addEventListener('click', () => {
  if (!track || busy || !audio.src) return;
  audio.pause();
  $('va-dlg-game').value = album.game;
  $('va-dlg-song').value = track.song;
  $('va-dlg-seek').value = audio.duration ? Math.round(audio.currentTime / audio.duration * 1000) : 0;
  $('va-dlg-time').textContent = `${fmt2(audio.currentTime)} / ${fmt2(audio.duration)}`;
  dlg.hidden = false;
  $('va-dlg-game').focus();
});
$('va-dlg-play').addEventListener('click', () => { audio.paused ? audio.play().catch(() => {}) : audio.pause(); });
$('va-dlg-seek').addEventListener('pointerdown', () => { seeking = true; });
$('va-dlg-seek').addEventListener('input', e => { if (audio.duration) $('va-dlg-time').textContent = `${fmt2(e.target.value / 1000 * audio.duration)} / ${fmt2(audio.duration)}`; });
$('va-dlg-seek').addEventListener('change', e => {
  seeking = false;
  if (!audio.duration) return;
  audio.currentTime = e.target.value / 1000 * audio.duration;
  audio.play().catch(() => {});
});
$('va-dlg-x').addEventListener('click', closeDlg);
$('va-dlg-cancel').addEventListener('click', closeDlg);
$('va-dlg-ok').addEventListener('click', () => {
  const game = $('va-dlg-game').value.trim(), song = $('va-dlg-song').value.trim();
  if (!track || busy || !audio.src || !game || !song) return;
  busy = true;
  renderMeta();
  closeDlg();
  $('va-submit-msg').textContent = 'Enviando...';
  socket.emit('vaSubmit', { source: album.source, page: track.page, ytId: track.ytId, start: audio.currentTime, game, song });
});
dlg.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeDlg();
  else if (e.key === 'Enter' && e.target.type === 'text') $('va-dlg-ok').click();
});

const win = document.querySelector('#vgm-add-screen .wmp-win');
let mini = false, undrag = null;
function openMini() {
  if (mini) return;
  mini = true;
  win.classList.add('va-mini');
  win.style.left = `${Math.max(0, Math.round((innerWidth - 460) / 2))}px`;
  win.style.top = '90px';
  document.body.appendChild(win);
  undrag = makeDraggable(win, '.title-bar');
  $('va-q').focus();
}
function closeMini() {
  if (!mini) return;
  mini = false;
  undrag(); undrag = null;
  dlg.hidden = true;
  stopMine();
  loading(null);
  audio.pause(); audio.removeAttribute('src');
  win.classList.remove('va-mini');
  win.style.left = win.style.top = win.style.transform = '';
  $('vgm-add-screen').appendChild(win);
}
function leave() {
  if (mini) return closeMini();
  dlg.hidden = true;
  stopMine();
  loading(null);
  audio.pause(); audio.removeAttribute('src');
  document.dispatchEvent(new CustomEvent('showScreen', { detail: 'vgmChoice' }));
}
$('va-close').addEventListener('click', leave);
$('va-back').addEventListener('click', leave);
document.addEventListener('vaMini', e => (e.detail ? openMini() : closeMini()));
