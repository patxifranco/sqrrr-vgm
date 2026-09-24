import { socketManager } from './js/core/index.js';

const socket = socketManager.socket;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmt2 = s => { s = Math.max(0, Math.floor(s || 0)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const parseTime = t => { const m = /^(\d+):(\d{1,2})$/.exec(String(t).trim()); if (m) return +m[1] * 60 + +m[2]; const n = Number(t); return isNaN(n) ? 0 : n; };
const proxied = url => new URL(`/tierlist/audio?u=${encodeURIComponent(url)}`, location.href).href;
const CLIP = 41;

const audio = $('va-audio');
let src = 'kh', results = null, album = null, track = null, trackIndex = -1, start = 0, busy = false;
let actx = null, analyser = null, freq = null, visAngle = 0;
const vis = $('va-vis'), vctx = vis.getContext('2d');
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

const status = t => { $('va-status').textContent = t; };
const gameFromTitle = t => String(t || '').split(/ - | \(|: | soundtrack| ost | original | music from/i)[0].replace(/\s+(gamerip|soundtrack|ost)$/i, '').trim();

function show(view) {
  for (const v of ['results', 'album']) $(`va-${v}`).hidden = v !== view;
}

function renderResults() {
  if (!results) return;
  const list = src === 'kh' ? results.kh.map(r => ({ id: r.slug, title: r.title, thumb: r.thumb, meta: [r.type, r.year].filter(Boolean).join(' · ') })) : results.yt.map(r => ({ id: r.id, title: r.title, thumb: r.thumb, meta: `${r.count} vídeos · ${r.channel}` }));
  for (const s of ['kh', 'yt']) $('va-src').querySelector(`.${s} b`).textContent = (s === 'kh' ? results.kh : results.yt).length || '';
  $('va-results').innerHTML = list.length ? list.map(r => `<button class="va-card" data-id="${esc(r.id)}"><span class="va-cover" style="background-image:url('${esc(r.thumb || '')}')"></span><span class="va-card-title">${esc(r.title)}</span><small>${esc(r.meta)}</small></button>`).join('') : '<p class="va-empty">No se encontró nada.</p>';
  show('results');
}

function renderAlbum() {
  $('va-album-title').textContent = album.title;
  $('va-album-cover').style.backgroundImage = `url('${album.cover || ''}')`;
  $('va-tracks').innerHTML = album.tracks.map((t, i) => `<tr data-i="${i}"><td>${t.disc > 1 ? t.disc + '-' : ''}${t.num}</td><td>${esc(t.name)}</td><td>${esc(t.duration || '')}</td></tr>`).join('');
  show('album');
}

function pickTrack(i) {
  if (!album || !album.tracks[i]) return;
  ensureVis();
  trackIndex = i;
  track = album.tracks[i];
  [...$('va-tracks').rows].forEach(r => r.classList.toggle('on', +r.dataset.i === i));
  audio.pause(); audio.removeAttribute('src');
  $('va-lcd').textContent = 'Cargando...';
  $('va-game').value = $('va-game').value || gameFromTitle(album.title);
  $('va-song').value = track.name;
  setStart(0);
  socket.emit('vaStream', album.source === 'yt' ? { source: 'yt', ytId: track.ytId } : { source: 'kh', page: track.page });
}

function setStart(s) {
  start = Math.max(0, s);
  $('va-start').value = fmt(start);
  $('va-marker').style.left = audio.duration ? `${(start / audio.duration) * 100}%` : '0%';
}

socket.on('vaResults', data => { results = data; status(`${data.kh.length + data.yt.length} resultados para "${data.q}"`); renderResults(); });
socket.on('vaTracks', data => { album = data; status(`${data.tracks.length} pistas`); renderAlbum(); });
socket.on('vaStreamUrl', ({ page, ytId, url }) => {
  if (!track || (track.page !== page && track.ytId !== ytId)) return;
  audio.src = proxied(url);
  audio.play().catch(() => {});
  $('va-lcd').textContent = track.name;
});
socket.on('vaProgress', ({ message }) => { status(message); $('va-submit-msg').textContent = message; });
socket.on('vaDone', ({ song, total }) => {
  busy = false; $('va-submit').disabled = false;
  $('va-submit-msg').textContent = `Añadida. El VGM tiene ahora ${total} canciones.`;
  status(`"${song.song}" añadida`);
});
socket.on('vaError', ({ message }) => { busy = false; $('va-submit').disabled = false; $('va-submit-msg').textContent = message; status(message); });

function search() {
  const q = $('va-q').value.trim();
  if (!q) return;
  status('Buscando...');
  $('va-results').innerHTML = '<p class="va-empty">Buscando...</p>';
  show('results');
  socket.emit('vaSearch', { q });
}
$('va-go').addEventListener('click', search);
$('va-q').addEventListener('keydown', e => { if (e.key === 'Enter') search(); });
$('va-src').addEventListener('click', () => { src = src === 'kh' ? 'yt' : 'kh'; $('va-src').dataset.src = src; renderResults(); });
$('va-results').addEventListener('click', e => {
  const c = e.target.closest('.va-card');
  if (!c) return;
  status('Abriendo...');
  socket.emit('vaOpen', { source: src, id: c.dataset.id });
});
$('va-album-back').addEventListener('click', () => { audio.pause(); show('results'); });
$('va-tracks').addEventListener('click', e => { const r = e.target.closest('tr'); if (r) pickTrack(+r.dataset.i); });

$('va-play').addEventListener('click', () => { if (!audio.src) return; audio.paused ? audio.play().catch(() => {}) : audio.pause(); });
$('va-stop').addEventListener('click', () => { if (!audio.src) return; audio.pause(); audio.currentTime = start; });
$('va-here').addEventListener('click', () => { if (audio.src) setStart(audio.currentTime); });
$('va-preview').addEventListener('click', () => { if (!audio.src) return; audio.currentTime = start; audio.play().catch(() => {}); });
$('va-start').addEventListener('change', e => { setStart(parseTime(e.target.value)); if (audio.src) audio.currentTime = start; });
$('va-seek').addEventListener('input', e => { if (audio.duration) audio.currentTime = e.target.value / 1000 * audio.duration; });
$('va-vol').addEventListener('input', e => { audio.volume = e.target.value / 100; });
audio.volume = 0.8;
$('va-prev').addEventListener('click', () => pickTrack(trackIndex - 1));
$('va-next').addEventListener('click', () => pickTrack(trackIndex + 1));
$('va-mute').addEventListener('click', () => { audio.muted = !audio.muted; $('va-mute').classList.toggle('muted', audio.muted); });
audio.addEventListener('timeupdate', () => {
  $('va-time').textContent = `${fmt2(audio.currentTime)} / ${fmt2(audio.duration)}`;
  if (audio.duration) $('va-seek').value = Math.round(audio.currentTime / audio.duration * 1000);
  $('va-clip').style.left = audio.duration ? `${(start / audio.duration) * 100}%` : '0';
  $('va-clip').style.width = audio.duration ? `${Math.min(100, (CLIP / audio.duration) * 100)}%` : '0';
});
audio.addEventListener('play', () => $('va-play').classList.add('playing'));
audio.addEventListener('pause', () => $('va-play').classList.remove('playing'));
audio.addEventListener('durationchange', () => setStart(start));

$('va-submit').addEventListener('click', () => {
  if (!track || busy) return;
  const game = $('va-game').value.trim(), song = $('va-song').value.trim();
  if (!game || !song) { $('va-submit-msg').textContent = 'Pon el juego y el nombre de la canción.'; return; }
  busy = true; $('va-submit').disabled = true;
  $('va-submit-msg').textContent = 'Enviando...';
  socket.emit('vaSubmit', { source: album.source, page: track.page, ytId: track.ytId, start, game, song });
});

function leave() {
  audio.pause(); audio.removeAttribute('src');
  document.dispatchEvent(new CustomEvent('showScreen', { detail: 'vgmChoice' }));
}
$('va-close').addEventListener('click', leave);
$('va-back').addEventListener('click', leave);
$('va-home').addEventListener('click', () => { audio.pause(); audio.removeAttribute('src'); document.dispatchEvent(new CustomEvent('showScreen', { detail: 'hub' })); });
