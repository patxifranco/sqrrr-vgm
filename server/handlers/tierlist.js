const { Readable } = require('stream');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { log, warn } = require('../utils');

const KH = 'https://downloads.khinsider.com';
const FETCH_OPTS = { headers: { 'User-Agent': 'Mozilla/5.0 (sqrrr.com tierlist)' } };
const KH_USER = process.env.KHINSIDER_USER, KH_PASS = process.env.KHINSIDER_PASS;
let khLoginPromise = null;
function khLogin() {
  if (!KH_USER || !KH_PASS) return Promise.resolve(false);
  if (khLoginPromise) return khLoginPromise;
  khLoginPromise = (async () => {
    const jar = {};
    const absorb = res => { for (const c of res.headers.getSetCookie()) { const kv = c.split(';')[0]; const i = kv.indexOf('='); jar[kv.slice(0, i).trim()] = kv.slice(i + 1); } };
    const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
    let r = await fetch(`${KH}/forums/index.php?login/`, { headers: { 'User-Agent': FETCH_OPTS.headers['User-Agent'] } });
    absorb(r);
    const token = ((await r.text()).match(/name="_xfToken"\s+value="([^"]+)"/) || [])[1] || '';
    const body = new URLSearchParams({ login: KH_USER, password: KH_PASS, remember: '1', _xfRedirect: `${KH}/`, _xfToken: token });
    r = await fetch(`${KH}/forums/index.php?login/login`, { method: 'POST', redirect: 'manual', body, headers: { 'User-Agent': FETCH_OPTS.headers['User-Agent'], cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded' } });
    absorb(r);
    const ok = !!jar.xf_user;
    if (ok) FETCH_OPTS.headers.cookie = cookie();
    (ok ? log : warn)('TIERLIST', ok ? `khinsider: logged in as ${KH_USER}` : `khinsider: login failed (HTTP ${r.status})`);
    return ok;
  })().catch(e => { warn('TIERLIST', 'khinsider login error', e.message); return false; })
    .finally(() => { khLoginPromise = null; });
  return khLoginPromise;
}
khLogin();
const TIERS = ['S', 'A', 'B', 'C', 'D', 'F'];
const COLORS = {
  REASON: '#a01830',
  'KINÜS': '#ff8ccf',
  Mugi: '#ff8c1a',
  JosebaS: '#5fd6c8',
  Minmin: '#ffb8dc',
  imanol13keif: '#2b4bc8',
  Jesus: '#8a5a2b',
  guille: '#a3e635'
};
const DEFAULT_COLOR = '#9aa0a6';
const ROOM = 'tierlist';

const emptyTiers = () => Object.fromEntries(TIERS.map(t => [t, []]));

const MODES = ['music', 'general'];
const lobby = {
  mode: null,
  players: {},
  host: null,
  album: null,
  songs: [],
  currentId: null,
  playback: { playing: false, position: 0, at: 0 },
  tiers: emptyTiers(),
  trashed: [],
  votes: {}
};

function reset() {
  Object.assign(lobby, {
    host: null, mode: null, album: null, songs: [], currentId: null,
    playback: { playing: false, position: 0, at: 0 }, tiers: emptyTiers(), trashed: [], votes: {}
  });
}
const isPlaced = id => TIERS.some(t => lobby.tiers[t].includes(id));
function unplace(id) {
  for (const t of TIERS) lobby.tiers[t] = lobby.tiers[t].filter(x => x !== id);
  lobby.trashed = lobby.trashed.filter(x => x !== id);
}

const cache = { search: new Map(), album: new Map(), tm: new Map() };

async function getHtml(url) {
  const res = await fetch(url, { ...FETCH_OPTS, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`khinsider ${res.status} for ${url}`);
  return res.text();
}

const stripTags = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const unescapeHtml = s => s.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

const SLUG_RE = /^[A-Za-z0-9._-]+$/;

async function searchAlbums(q) {
  const key = q.toLowerCase();
  if (cache.search.has(key)) return cache.search.get(key);
  const isGated = h => !h.includes('albumIcon') && /Please Log In/i.test(h);
  let html = await getHtml(`${KH}/search?search=${encodeURIComponent(q)}`);
  if (isGated(html) && await khLogin()) html = await getHtml(`${KH}/search?search=${encodeURIComponent(q)}`);
  const gated = isGated(html);
  const results = [];
  for (const row of gated ? [] : html.split('<tr>').slice(1)) {
    const m = row.match(/class="albumIcon"><a href="\/game-soundtracks\/album\/([^"]+)">(?:<img src="([^"]+)">)?[\s\S]*?<td>\s*<a href="[^"]+">([^<]+)<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/);
    if (!m) continue;
    results.push({ slug: m[1], thumb: m[2] || null, title: unescapeHtml(m[3]), platform: stripTags(m[4]), type: m[5].trim(), year: m[6].trim() });
    if (results.length >= 40) break;
  }
  if (!results.length) {
    const slug = key.trim().replace(/\s+/g, '-');
    if (SLUG_RE.test(slug)) {
      try {
        const a = await loadAlbum(slug);
        if (a.songs.length) results.push({ slug, thumb: a.covers[0] || null, title: a.title, platform: '', type: `${a.songs.length} pistas`, year: '' });
      } catch (e) {  }
    }
  }
  const out = { results, gated };
  if (!gated) cache.search.set(key, out);
  return out;
}

async function loadAlbum(slug) {
  if (cache.album.has(slug)) return cache.album.get(slug);
  const html = await getHtml(`${KH}/game-soundtracks/album/${slug}`);
  const title = unescapeHtml((html.match(/<h2>([^<]+)<\/h2>/) || [])[1] || slug);
  const covers = [...html.matchAll(/class="albumImage">\s*<a[^>]*>\s*<img src="([^"]+)"/g)].map(m => m[1]);
  const songs = [];
  const table = html.split('id="songlist"')[1] || '';
  for (const row of table.split('<tr>').slice(1)) {
    const link = row.match(/<td class="clickable-row"><a href="([^"]+)">([^<]*)<\/a>/);
    if (!link) continue;
    const disc = parseInt((row.match(/<td align="center">(\d+)<\/td>/) || [])[1]) || 1;
    const num = parseInt((row.match(/<td align="right"[^>]*>(\d+)\.<\/td>/) || [])[1]) || songs.length + 1;
    const duration = (row.match(/align="right"><a[^>]*>(\d+:\d\d)<\/a>/) || [])[1] || '';
    songs.push({ id: songs.length, name: unescapeHtml(link[2]), disc, num, duration, page: link[1], cover: covers[disc - 1] || covers[0] || null, mp3: null });
  }
  const album = { slug, title, covers, songs };
  cache.album.set(slug, album);
  return album;
}

const mp3Cache = new Map();
async function resolveMp3(song) {
  if (song.source === 'yt') return ytStreamUrl(song.ytId);
  if (mp3Cache.has(song.page)) return mp3Cache.get(song.page);
  const html = await getHtml(KH + song.page);
  const m = html.match(/https:\/\/[a-z0-9.-]+\.vgmtreasurechest\.com\/[^"']+\.mp3/i);
  if (!m) throw new Error(`mp3 link not found for ${song.page}`);
  mp3Cache.set(song.page, m[0]);
  return m[0];
}

const YTDLP = process.env.YTDLP_PATH || path.join(__dirname, '..', '..', 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');
const ytAvailable = () => fs.existsSync(YTDLP);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_URL = /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\/\S+$/;
const ytThumb = id => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
const fmtDur = s => s ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '';
const ytEntry = e => ({ source: 'yt', id: e.id, title: e.title || e.id, duration: fmtDur(e.duration), thumb: ytThumb(e.id), channel: e.channel || e.uploader || '' });

function ytdlp(args, timeout = 45000) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, [...args, '--no-warnings', '--no-cache-dir', '--quiet'], { timeout, maxBuffer: 32e6 }, (err, stdout, stderr) => {
      if (err) return reject(new Error((stderr || err.message).trim().split('\n').pop()));
      resolve(stdout);
    });
  });
}

const YT_PL_ID = /^[A-Za-z0-9_-]{10,80}$/;
const plCounts = new Map();
async function ytPlaylistCount(id) {
  if (plCounts.has(id)) return plCounts.get(id);
  let n = 0;
  try {
    const j = JSON.parse(await ytdlp([`https://www.youtube.com/playlist?list=${id}`, '--flat-playlist', '--playlist-items', '1', '-J'], 30000));
    n = Number(j.playlist_count) || (j.entries || []).length;
  } catch (e) {  }
  plCounts.set(id, n);
  return n;
}
function mapLimit(items, limit, fn) {
  let i = 0;
  const out = new Array(items.length);
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } });
  return Promise.all(workers).then(() => out);
}
async function ytSearchPage(q) {
  const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAw%253D%253D&hl=en`, {
    headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9', cookie: 'SOCS=CAI; CONSENT=YES+cb' },
    signal: AbortSignal.timeout(15000)
  });
  const m = (await r.text()).match(/ytInitialData\s*=\s*(\{.*?\});\s*<\/script>/s);
  if (!m) throw new Error('no ytInitialData');
  const out = [];
  const walk = o => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) return o.forEach(walk);
    if (o.playlistRenderer) {
      const p = o.playlistRenderer;
      out.push({ id: p.playlistId, title: p.title.simpleText || (p.title.runs || []).map(x => x.text).join(''), count: Number(p.videoCount) || 0,
        channel: (((p.shortBylineText || {}).runs || [])[0] || {}).text || '', thumb: ((((p.thumbnails || [])[0] || {}).thumbnails || []).slice(-1)[0] || {}).url || null });
    } else if (o.lockupViewModel && o.lockupViewModel.contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST') {
      const l = o.lockupViewModel, s = JSON.stringify(l);
      out.push({ id: l.contentId, title: ((((l.metadata || {}).lockupMetadataViewModel || {}).title || {}).content) || l.contentId,
        count: Number(((s.match(/"text":"(\d[\d,]*) (?:videos?|episodes?)"/) || [])[1] || '').replace(/,/g, '')) || 0,
        channel: (s.match(/"metadataParts":\[\{"text":\{"content":"([^"]+)"/) || [])[1] || '',
        thumb: (s.match(/"url":"(https:\/\/i\.ytimg\.com\/[^"]+)"/) || [])[1] || null });
    }
    for (const v of Object.values(o)) walk(v);
  };
  walk(JSON.parse(m[1]));
  return out;
}

async function ytSearch(q) {
  if (!ytAvailable()) return [];
  const key = 'yt:' + q.toLowerCase();
  if (cache.search.has(key)) return cache.search.get(key);
  const query = q + ' music';
  let cands;
  try {
    cands = (await ytSearchPage(query)).filter(e => YT_PL_ID.test(e.id) && !YT_ID.test(e.id)).map(e => ({ source: 'yt', ...e }));
  } catch (e) {
    warn('TIERLIST', 'youtube page search failed, using yt-dlp', e.message);
    const j = JSON.parse(await ytdlp([`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAw%253D%253D`, '--flat-playlist', '-J', '--playlist-end', '14']));
    cands = (j.entries || []).filter(e => e && e.id && YT_PL_ID.test(e.id) && !YT_ID.test(e.id)).map(e => ({
      source: 'yt', id: e.id, title: e.title || e.id, channel: e.channel || e.uploader || '', thumb: ((e.thumbnails || []).slice(-1)[0] || {}).url || null
    }));
    const counts = await mapLimit(cands, 6, c => ytPlaylistCount(c.id));
    cands = cands.map((c, i) => ({ ...c, count: counts[i] }));
  }
  const out = cands.filter(c => c.count > 1).slice(0, 12);
  cache.search.set(key, out);
  return out;
}

async function ytList(url) {
  const j = JSON.parse(await ytdlp([url, '--flat-playlist', '-J', '--playlist-end', '50']));
  const entries = j._type === 'playlist' ? (j.entries || []) : [j];
  return { title: j.title || 'YouTube', entries: entries.filter(e => e && e.id && YT_ID.test(e.id)).map(ytEntry) };
}

const ytStreams = new Map();
async function ytStreamUrl(id) {
  const c = ytStreams.get(id);
  if (c && c.expires > Date.now()) return c.url;
  const url = (await ytdlp(['-f', 'bestaudio[ext=m4a]/bestaudio', '-g', `https://www.youtube.com/watch?v=${id}`])).trim().split('\n')[0];
  if (!/^https:\/\//.test(url)) throw new Error('no stream url');
  const exp = Number((url.match(/[?&]expire=(\d+)/) || [])[1]) * 1000;
  ytStreams.set(id, { url, expires: (exp || Date.now() + 3600e3) - 600e3 });
  return url;
}

const TM = 'https://tiermaker.com';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
async function tmFetch(url, format = 'html') {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, accept: '*/*' }, signal: AbortSignal.timeout(15000) });
    const t = await r.text();
    if (r.ok && !/Just a moment/i.test(t)) return t;
  } catch (e) {  }
  const r = await fetch(`https://r.jina.ai/${url}`, { headers: { 'X-Return-Format': format }, signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`tiermaker relay ${r.status}`);
  return r.text();
}

async function tmSearch(q) {
  const key = q.toLowerCase();
  if (cache.tm.has(key)) return cache.tm.get(key);
  const html = await tmFetch(`${TM}/search/?q=${encodeURIComponent(q)}`, 'html');
  const out = [];
  const re = /href=['"]\/create\/([^'"]+)['"][^>]*>\s*<div class=['"]image-count-container['"]>(\d+)<\/div>\s*<div class=['"]category-carousel-item['"] style=['"]background-image:\s*url\(["']?([^)"']+)["']?\)['"]>\s*<div class=['"]cat-header['"]>([^<]*)<\/div>/g;
  for (const m of html.matchAll(re)) {
    out.push({ source: 'tm', id: m[1], count: +m[2], thumb: m[3].startsWith('http') ? m[3] : TM + m[3], title: unescapeHtml(m[4].trim()).replace(/\\+(['"])/g, '$1') || m[1] });
    if (out.length >= 40) break;
  }
  cache.tm.set(key, out);
  return out;
}

async function tmTemplate(slug) {
  const txt = await tmFetch(`${TM}/api/?type=templates-v2&id=${encodeURIComponent(slug)}&lastEdited=&variation=`, 'text');
  const arr = JSON.parse(txt.trim().replace(/^<html>.*<body>|<\/body>.*$/gs, ''));
  if (!Array.isArray(arr) || arr.length < 2) throw new Error('template has no images');
  const base = String(arr[0]);
  const imgUrl = f => base.startsWith('/') ? `${TM}/images${base}/${f}` : `${TM}/images/chart/chart/${base}/${f}`;
  const nameOf = f => f.replace(/\.[a-z0-9]+$/i, '').replace(/(jpe?g|png|webp|gif)$/i, '').replace(/[-_]+/g, ' ').trim();
  let title = null;
  for (const list of cache.tm.values()) { const hit = list.find(r => r.id === slug); if (hit) { title = hit.title; break; } }
  if (!title) title = slug.replace(/-\d+(-\d+)?$/, '').replace(/-/g, ' ');
  return { title, images: arr.slice(1).map((f, i) => ({ name: nameOf(String(f)) || `#${i + 1}`, cover: imgUrl(String(f)) })) };
}

const TierList = mongoose.models.TierList || mongoose.model('TierList', new mongoose.Schema({
  title: String, mode: String, host: String, players: [String], createdAt: { type: Date, default: Date.now },
  songs: [{ name: String, cover: String, source: String, num: Number, page: String, ytId: String }],
  tiers: mongoose.Schema.Types.Mixed, votes: mongoose.Schema.Types.Mixed
}));
const dbReady = () => mongoose.connection.readyState === 1;
const savedMem = [];
let savedIndex = [];
const indexOf = d => ({ id: String(d._id || d.id), title: d.title, mode: d.mode, host: d.host, createdAt: d.createdAt, count: TIERS.reduce((n, t) => n + ((d.tiers || {})[t] || []).length, 0) });
async function loadSavedIndex() {
  try { if (dbReady()) savedIndex = (await TierList.find({}, 'title mode host createdAt tiers').sort({ createdAt: -1 }).limit(30).lean()).map(indexOf); }
  catch (e) { warn('TIERLIST', 'could not load saved tierlists', e.message); }
}
if (dbReady()) loadSavedIndex(); else mongoose.connection.once('connected', loadSavedIndex);
async function saveTierList(doc, id) {
  let saved = null;
  if (dbReady()) {
    if (id) saved = await TierList.findByIdAndUpdate(id, doc, { new: true }).lean();
    if (!saved) saved = (await TierList.create({ ...doc, createdAt: new Date() })).toObject();
  } else {
    const i = id ? savedMem.findIndex(s => s.id === id) : -1;
    if (i >= 0) saved = savedMem[i] = { ...savedMem[i], ...doc };
    else { saved = { ...doc, id: String(Date.now()), createdAt: new Date() }; savedMem.unshift(saved); }
  }
  const sid = String(saved._id || saved.id);
  savedIndex = [indexOf(saved), ...savedIndex.filter(s => s.id !== sid)].slice(0, 30);
  return saved;
}

const ART_FILE = __dirname + '/../../track-art.json';
const artStore = new Map();
try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(ART_FILE, 'utf8')))) artStore.set(k, v); } catch (e) { }
let artSaveTimer = null;
function saveArtStore() {
  clearTimeout(artSaveTimer);
  artSaveTimer = setTimeout(() => fs.writeFile(ART_FILE, JSON.stringify(Object.fromEntries(artStore)), () => {}), 1500);
}
const normName = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
async function trackArt(name, game) {
  let url = null;
  try {
    const r = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(name + ' ' + game)}&limit=4`, { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    if (j.error) ok = false;
    const n = normName(name);
    const hit = (j.data || []).find(d => d.explicit_content_cover !== 1 && (normName(d.title).includes(n) || n.includes(normName(d.title))));
    url = hit && hit.album ? hit.album.cover_medium : null;
  } catch (e) { }
  return url;
}
async function ytFirstVideo(q) {
  let id = null;
  try {
    const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D&hl=en`, {
      headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9', cookie: 'SOCS=CAI; CONSENT=YES+cb' },
      signal: AbortSignal.timeout(10000)
    });
    const m = (await r.text()).match(/"videoRenderer":\{"videoId":"([\w-]{11})"/);
    id = m ? m[1] : null;
  } catch (e) { }
  return id;
}
async function fetchTrackArt(io, slug) {
  const game = lobby.album.title.split(/ - | \(|: | soundtrack| ost/i)[0].trim();
  let batch = {};
  const live = () => lobby.album && lobby.album.slug === slug;
  const flush = () => { if (live() && Object.keys(batch).length) io.to(ROOM).emit('tlCovers', { slug, covers: batch }); batch = {}; };
  const timer = setInterval(flush, 800);
  await mapLimit(lobby.songs, 6, async s => {
    if (!live()) return;
    const key = normName(s.name + ' ' + game);
    let url = artStore.get(key);
    if (url === undefined) {
      const vid = await ytFirstVideo(`${s.name} ${game}`);
      url = vid ? `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` : await trackArt(s.name, game);
      artStore.set(key, url);
      saveArtStore();
      await new Promise(r => setTimeout(r, 60));
    }
    if (!live()) return;
    s.artPending = false;
    if (url) s.cover = url;
    batch[s.id] = url;
  });
  clearInterval(timer);
  flush();
}
async function getTierList(id) {
  if (dbReady()) { const d = await TierList.findById(id).lean(); return d && { ...d, id: String(d._id), _id: undefined }; }
  return savedMem.find(s => s.id === id) || null;
}

const playerList = () => Object.values(lobby.players);
const hostName = () => (lobby.players[lobby.host] || {}).username || null;
const playbackMsg = () => ({
  currentId: lobby.currentId,
  mp3: lobby.currentId === null ? null : lobby.songs[lobby.currentId].mp3,
  playback: lobby.playback,
  serverNow: Date.now()
});
const publicState = () => ({
  mode: lobby.mode, players: playerList(), host: hostName(), album: lobby.album, songs: lobby.songs,
  currentId: lobby.currentId, playback: lobby.playback, tiers: lobby.tiers, trashed: lobby.trashed, votes: lobby.votes, saved: savedIndex, serverNow: Date.now()
});
const tiersMsg = placed => ({ tiers: lobby.tiers, trashed: lobby.trashed, placed });

function leaveSocket(io, socket) {
  const p = lobby.players[socket.id];
  if (!p) return;
  delete lobby.players[socket.id];
  socket.leave(ROOM);
  socket.to(ROOM).emit('tlCursor', { username: p.username, gone: true });
  if (lobby.host === socket.id) lobby.host = Object.keys(lobby.players)[0] || null;
  if (!lobby.host) reset(); else io.to(ROOM).emit('tlPlayers', { players: playerList(), host: hostName() });
  log('TIERLIST', `${p.username} left`);
}
function leaveById(io, id) {
  const s = io.sockets.sockets.get(id);
  if (s) leaveSocket(io, s);
}

async function audioProxy(req, res) {
  const u = String(req.query.u || '');
  if (!/^https:\/\/[a-z0-9.-]+\.vgmtreasurechest\.com\/[^?#]+\.mp3$/i.test(u) && !/^https:\/\/[a-z0-9.-]+\.googlevideo\.com\/videoplayback\?/i.test(u)) return res.status(400).end();
  try {
    const headers = { 'User-Agent': FETCH_OPTS.headers['User-Agent'] };
    if (req.headers.range) headers.range = req.headers.range;
    const r = await fetch(u, { headers });
    res.status(r.status);
    for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) { const v = r.headers.get(h); if (v) res.setHeader(h, v); }
    res.setHeader('cache-control', 'public, max-age=86400');
    if (!r.body) return res.end();
    const body = Readable.fromWeb(r.body);
    req.on('close', () => body.destroy());
    body.on('error', () => res.end());
    body.pipe(res);
  } catch (e) {
    warn('TIERLIST', 'audio proxy failed', e.message);
    if (!res.headersSent) res.status(502).end();
  }
}

function setupHandlers(io, socket, { getUser, getLoggedInUsername }) {
  const isHost = () => socket.id === lobby.host;
  const broadcastPlayers = () => io.to(ROOM).emit('tlPlayers', { players: playerList(), host: hostName() });
  const fail = (message, e) => { warn('TIERLIST', message, e && e.message); socket.emit('tlError', { message }); };

  socket.on('tlJoin', async () => {
    const username = getLoggedInUsername();
    if (!username) return socket.emit('tlError', { message: 'Debes iniciar sesión primero' });
    const user = getUser(username) || {};
    for (const [sid, p] of Object.entries(lobby.players)) {
      if (p.username === username && sid !== socket.id) { const old = io.sockets.sockets.get(sid); if (old) leaveSocket(io, old); else delete lobby.players[sid]; }
    }
    lobby.players[socket.id] = { username, color: COLORS[username] || DEFAULT_COLOR, profilePicture: user.profilePicture || 'profiles/default.svg' };
    if (!lobby.host) lobby.host = socket.id;
    socket.join(ROOM);
    const cur = lobby.songs[lobby.currentId];
    if (cur && cur.source === 'yt') { try { cur.mp3 = await ytStreamUrl(cur.ytId); } catch (e) {  } }
    socket.emit('tlState', publicState());
    broadcastPlayers();
    log('TIERLIST', `${username} joined (${playerList().length} players)`);
  });

  const leave = () => leaveSocket(io, socket);
  socket.on('tlLeave', leave);

  socket.on('tlReset', () => {
    if (!isHost()) return;
    Object.assign(lobby, { album: null, songs: [], currentId: null, playback: { playing: false, position: 0, at: 0 }, tiers: emptyTiers(), trashed: [], votes: {} });
    io.to(ROOM).emit('tlState', publicState());
    log('TIERLIST', 'reset by host');
  });

  socket.on('tlMode', ({ mode } = {}) => {
    if (!isHost() || (mode !== null && !MODES.includes(mode)) || mode === lobby.mode) return;
    Object.assign(lobby, { mode, album: null, songs: [], currentId: null, playback: { playing: false, position: 0, at: Date.now() }, tiers: emptyTiers(), trashed: [], votes: {} });
    io.to(ROOM).emit('tlState', publicState());
    log('TIERLIST', `mode -> ${mode}`);
  });

  socket.on('tlTyping', ({ q } = {}) => {
    if (!isHost()) return;
    socket.to(ROOM).emit('tlTyping', { q: String(q || '').slice(0, 200) });
  });

  socket.on('tlSearch', async ({ q } = {}) => {
    if (!isHost() || !lobby.mode || !q || !q.trim()) return;
    io.to(ROOM).emit('tlSearching', { q });
    if (lobby.mode === 'general') {
      try { io.to(ROOM).emit('tlSearchResults', { q, results: await tmSearch(q.trim()), gated: false }); }
      catch (e) { warn('TIERLIST', 'tiermaker search failed', e.message); io.to(ROOM).emit('tlSearchResults', { q, results: [], gated: false, error: 'TierMaker no responde' }); }
      return;
    }
    const [kh, yt] = await Promise.all([
      searchAlbums(q.trim()).catch(e => { warn('TIERLIST', 'khinsider search failed', e.message); return { results: [], gated: false }; }),
      ytSearch(q.trim()).catch(e => { warn('TIERLIST', 'youtube search failed', e.message); return []; })
    ]);
    io.to(ROOM).emit('tlSearchResults', { q, results: [...kh.results.map(r => ({ source: 'kh', ...r })), ...yt], gated: kh.gated, youtube: ytAvailable() });
  });

  socket.on('tlLoad', async ({ source, id } = {}) => {
    if (!isHost() || !lobby.mode || typeof id !== 'string') return;
    io.to(ROOM).emit('tlLoading', { on: true });
    try {
      let title, songs;
      if (source === 'kh') {
        if (!SLUG_RE.test(id)) return;
        const a = await loadAlbum(id);
        title = a.title;
        songs = a.songs.map(s => ({ ...s, source: 'kh', artPending: true }));
      } else if (source === 'tm') {
        if (!SLUG_RE.test(id)) return;
        const t = await tmTemplate(id);
        title = t.title;
        songs = t.images.map((im, i) => ({ id: i, name: im.name, disc: 1, num: i + 1, duration: '', cover: im.cover, source: 'tm' }));
      } else if (source === 'yt' || source === 'yturl') {
        if (source === 'yt' ? !YT_PL_ID.test(id) : !YT_URL.test(id)) return;
        if (!ytAvailable()) return fail('YouTube no está disponible en el servidor');
        const l = await ytList(source === 'yt' ? `https://www.youtube.com/playlist?list=${id}` : id);
        title = l.title;
        songs = l.entries.map((e, i) => ({ id: i, name: e.title, disc: 1, num: i + 1, duration: e.duration, ytId: e.id, cover: e.thumb, mp3: null, source: 'yt' }));
      } else return;
      if (!songs.length) { io.to(ROOM).emit('tlLoading', { on: false }); return fail('No hay canciones ahí'); }
      lobby.album = { slug: id, title, covers: [] };
      lobby.savedId = null;
      lobby.songs = songs;
      lobby.currentId = null;
      lobby.playback = { playing: false, position: 0, at: Date.now() };
      lobby.tiers = emptyTiers();
      lobby.trashed = [];
      lobby.votes = {};
      log('TIERLIST', `loaded ${songs.length} songs from ${source}: ${title}`);
      io.to(ROOM).emit('tlState', publicState());
      if (source === 'kh') fetchTrackArt(io, id).catch(() => {});
    } catch (e) { io.to(ROOM).emit('tlLoading', { on: false }); fail('No se pudo cargar eso', e); }
  });

  socket.on('tlSelect', async ({ songId } = {}) => {
    if (!isHost()) return;
    const song = lobby.songs[songId];
    if (!song) return;
    if (song.source !== 'tm') io.to(ROOM).emit('tlLoading', { on: true });
    try {
      song.mp3 = song.source === 'tm' ? null : await resolveMp3(song);
      lobby.currentId = song.id;
      lobby.playback = { playing: song.source !== 'tm', position: 0, at: Date.now() };
      io.to(ROOM).emit('tlPlayback', playbackMsg());
    } catch (e) { io.to(ROOM).emit('tlLoading', { on: false }); fail('No se pudo cargar la canción', e); }
  });

  socket.on('tlPlayback', ({ playing, position } = {}) => {
    if (!isHost() || lobby.currentId === null) return;
    lobby.playback = { playing: !!playing, position: Math.max(0, Number(position) || 0), at: Date.now() };
    io.to(ROOM).emit('tlPlayback', playbackMsg());
  });

  socket.on('tlCursor', (pos) => {
    const p = lobby.players[socket.id];
    if (!p || !pos) return;
    const d = pos.drag;
    const drag = d && lobby.songs[d.id] ? { id: +d.id, gx: +d.gx || 0, gy: +d.gy || 0, rot: +d.rot || 0 } : null;
    socket.to(ROOM).volatile.emit('tlCursor', { username: p.username, x: +pos.x || 0, y: +pos.y || 0, drag });
  });

  let lastPing = 0;
  socket.on('tlPing', ({ songId } = {}) => {
    const p = lobby.players[socket.id];
    if (!p || !lobby.songs[songId] || Date.now() - lastPing < 250) return;
    lastPing = Date.now();
    io.to(ROOM).emit('tlPing', { username: p.username, songId });
  });

  socket.on('tlFinish', async () => {
    if (!isHost() || !lobby.album) return;
    const placed = TIERS.reduce((n, t) => n + lobby.tiers[t].length, 0);
    if (!placed) return fail('Coloca al menos una en algún tier');
    try {
      await saveTierList({
        title: lobby.album.title, mode: lobby.mode, host: hostName(), players: playerList().map(p => p.username),
        songs: lobby.songs.map(s => ({ name: s.name, cover: s.cover, source: s.source, num: s.num, page: s.page || undefined, ytId: s.ytId || undefined })),
        tiers: lobby.tiers, votes: lobby.votes
      }, lobby.savedId);
      log('TIERLIST', `saved: ${lobby.album.title} (${placed} placed)`);
      Object.assign(lobby, { mode: null, album: null, songs: [], currentId: null, playback: { playing: false, position: 0, at: Date.now() }, tiers: emptyTiers(), trashed: [], votes: {}, savedId: null });
      io.to(ROOM).emit('tlState', publicState());
    } catch (e) { fail('No se pudo guardar', e); }
  });

  socket.on('tlSavedEdit', async ({ id } = {}) => {
    if (typeof id !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(id)) return;
    const p = lobby.players[socket.id];
    try {
      const list = await getTierList(id);
      if (!list || !p) return;
      if (list.host !== p.username) return fail('Solo quien la creó puede editarla');
      lobby.host = socket.id;
      Object.assign(lobby, {
        mode: list.mode, album: { slug: 'saved:' + list.id, title: list.title, covers: [] }, savedId: list.id,
        songs: list.songs.map((s, i) => ({ id: i, name: s.name, cover: s.cover, source: s.source, num: s.num, disc: 1, duration: '', page: s.page || null, ytId: s.ytId || null, mp3: null })),
        currentId: null, playback: { playing: false, position: 0, at: Date.now() },
        tiers: Object.fromEntries(TIERS.map(t => [t, ((list.tiers || {})[t] || []).filter(i => i < list.songs.length)])), trashed: [], votes: list.votes || {}
      });
      io.to(ROOM).emit('tlState', publicState());
      broadcastPlayers();
      log('TIERLIST', `${p.username} edits saved list: ${list.title}`);
    } catch (e) { fail('No se pudo abrir', e); }
  });

  socket.on('tlFall', ({ id, x, y, gx, gy, vx, rot } = {}) => {
    const p = lobby.players[socket.id];
    if (!p || !lobby.songs[id]) return;
    socket.to(ROOM).volatile.emit('tlFall', { username: p.username, id: +id, x: +x || 0, y: +y || 0, gx: +gx || 0, gy: +gy || 0, vx: +vx || 0, rot: +rot || 0 });
  });

  socket.on('tlHost', ({ username } = {}) => {
    if (!isHost()) return;
    const sid = Object.keys(lobby.players).find(k => lobby.players[k].username === username);
    if (!sid || sid === socket.id) return;
    lobby.host = sid;
    broadcastPlayers();
    log('TIERLIST', `host handed to ${username}`);
  });

  socket.on('tlSavedGet', async ({ id } = {}) => {
    if (typeof id !== 'string' || !/^[A-Za-z0-9]{1,40}$/.test(id)) return;
    try {
      const list = await getTierList(id);
      if (list) socket.emit('tlSaved', { list: { id: list.id, title: list.title, mode: list.mode, host: list.host, createdAt: list.createdAt, songs: list.songs.map((s, i) => ({ ...s, id: i, disc: 1 })), tiers: list.tiers, votes: list.votes || {} } });
    } catch (e) { fail('No se pudo abrir', e); }
  });

  let lastChat = 0;
  socket.on('tlChat', ({ text } = {}) => {
    const p = lobby.players[socket.id];
    const t = String(text || '').trim().slice(0, 60);
    if (!p || !t || Date.now() - lastChat < 300) return;
    lastChat = Date.now();
    io.to(ROOM).emit('tlChat', { username: p.username, text: t });
  });

  socket.on('tlVote', ({ songId, tier } = {}) => {
    const p = lobby.players[socket.id];
    if (!p || songId !== lobby.currentId || !TIERS.includes(tier) || isPlaced(songId)) return;
    (lobby.votes[songId] = lobby.votes[songId] || {})[p.username] = tier;
    io.to(ROOM).emit('tlVotes', { songId, votes: lobby.votes[songId] });
  });

  socket.on('tlVerdict', ({ songId, tier, index } = {}) => {
    if (!isHost() || !lobby.songs[songId] || !TIERS.includes(tier)) return;
    unplace(songId);
    const list = lobby.tiers[tier];
    const at = Number.isInteger(index) ? Math.max(0, Math.min(index, list.length)) : list.length;
    list.splice(at, 0, songId);
    io.to(ROOM).emit('tlTiers', tiersMsg(songId));
    log('TIERLIST', `${lobby.songs[songId].name} -> ${tier}`);
  });

  socket.on('tlVerdictOpen', () => {
    if (!isHost() || lobby.currentId === null || isPlaced(lobby.currentId)) return;
    io.to(ROOM).emit('tlVerdictOpen', { songId: lobby.currentId });
  });

  socket.on('tlTrash', ({ songId } = {}) => {
    if (!isHost() || !lobby.songs[songId]) return;
    unplace(songId);
    lobby.trashed.push(songId);
    io.to(ROOM).emit('tlTiers', tiersMsg(null));
    if (songId === lobby.currentId) {
      lobby.currentId = null;
      lobby.playback = { playing: false, position: 0, at: Date.now() };
      io.to(ROOM).emit('tlPlayback', playbackMsg());
    }
  });

  socket.on('tlRestore', ({ songId } = {}) => {
    if (!isHost() || !lobby.trashed.includes(songId)) return;
    lobby.trashed = lobby.trashed.filter(x => x !== songId);
    io.to(ROOM).emit('tlTiers', tiersMsg(null));
  });

  return { handleDisconnect: leave };
}

module.exports = { setupHandlers, leaveById, audioProxy, searchAlbums, loadAlbum, resolveMp3, ytSearch, ytList, ytStreamUrl, tmSearch, tmTemplate };

if (require.main === module) {
  (async () => {
    const results = await searchAlbums('minecraft');
    console.assert(results.length > 0 && results[0].slug && results[0].title, 'search parse failed', results[0]);
    const album = await loadAlbum('minecraft');
    console.assert(album.songs.length > 50 && album.covers.length > 0, 'album parse failed', album.songs.length, album.covers.length);
    const mp3 = await resolveMp3(album.songs[1]);
    console.assert(/vgmtreasurechest\.com\/.+\.mp3$/.test(mp3), 'mp3 resolve failed', mp3);
    console.log('OK', results.length, 'albums;', album.songs.length, 'songs;', album.songs[1].name, '->', mp3);
  })().catch(e => { console.error('FAIL', e); process.exit(1); });
}
