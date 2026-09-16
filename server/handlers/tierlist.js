/**
 * SQRRR Tierlist - collab tier list over khinsider soundtracks.
 * ponytail: one global lobby; key by room code if two groups ever need to play at once.
 */
const { log, warn } = require('../utils');

const KH = 'https://downloads.khinsider.com';
const FETCH_OPTS = { headers: { 'User-Agent': 'Mozilla/5.0 (sqrrr.com tierlist)' } };
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

const lobby = {
  players: {},   // socketId -> { username, color, profilePicture }
  host: null,    // socketId
  album: null,   // { slug, title, covers }
  songs: [],     // { id, name, disc, num, duration, page, cover, mp3 }
  currentId: null,
  playback: { playing: false, position: 0, at: 0 },
  tiers: emptyTiers(), // tier -> [songId]
  votes: {}            // songId -> { username: tier }
};

function reset() {
  Object.assign(lobby, {
    host: null, album: null, songs: [], currentId: null,
    playback: { playing: false, position: 0, at: 0 }, tiers: emptyTiers(), votes: {}
  });
}

// ==================== KHINSIDER SCRAPER ====================
const cache = { search: new Map(), album: new Map() };

async function getHtml(url) {
  const res = await fetch(url, FETCH_OPTS);
  if (!res.ok) throw new Error(`khinsider ${res.status} for ${url}`);
  return res.text();
}

const stripTags = s => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const unescapeHtml = s => s.replace(/&amp;/g, '&').replace(/&#0?39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function searchAlbums(q) {
  const key = q.toLowerCase();
  if (cache.search.has(key)) return cache.search.get(key);
  const html = await getHtml(`${KH}/search?search=${encodeURIComponent(q)}`);
  const results = [];
  for (const row of html.split('<tr>').slice(1)) {
    const m = row.match(/class="albumIcon"><a href="\/game-soundtracks\/album\/([^"]+)">(?:<img src="([^"]+)">)?[\s\S]*?<td>\s*<a href="[^"]+">([^<]+)<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)<\/td>/);
    if (!m) continue;
    results.push({ slug: m[1], thumb: m[2] || null, title: unescapeHtml(m[3]), platform: stripTags(m[4]), type: m[5].trim(), year: m[6].trim() });
    if (results.length >= 40) break;
  }
  cache.search.set(key, results);
  return results;
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

async function resolveMp3(song) {
  if (song.mp3) return song.mp3;
  const html = await getHtml(KH + song.page);
  const m = html.match(/https:\/\/[a-z0-9.-]+\.vgmtreasurechest\.com\/[^"']+\.mp3/i);
  if (!m) throw new Error(`mp3 link not found for ${song.page}`);
  song.mp3 = m[0];
  return song.mp3;
}

// ==================== STATE ====================
const playerList = () => Object.values(lobby.players);
const hostName = () => (lobby.players[lobby.host] || {}).username || null;
const playbackMsg = () => ({
  currentId: lobby.currentId,
  mp3: lobby.currentId === null ? null : lobby.songs[lobby.currentId].mp3,
  playback: lobby.playback,
  serverNow: Date.now()
});
const publicState = () => ({
  players: playerList(), host: hostName(), album: lobby.album, songs: lobby.songs,
  currentId: lobby.currentId, playback: lobby.playback, tiers: lobby.tiers, votes: lobby.votes, serverNow: Date.now()
});

// ==================== SOCKET HANDLERS ====================
function setupHandlers(io, socket, { getUser, getLoggedInUsername }) {
  const isHost = () => socket.id === lobby.host;
  const broadcastPlayers = () => io.to(ROOM).emit('tlPlayers', { players: playerList(), host: hostName() });
  const fail = (message, e) => { warn('TIERLIST', message, e && e.message); socket.emit('tlError', { message }); };

  socket.on('tlJoin', () => {
    const username = getLoggedInUsername();
    if (!username) return socket.emit('tlError', { message: 'Debes iniciar sesion primero' });
    const user = getUser(username) || {};
    lobby.players[socket.id] = { username, color: COLORS[username] || DEFAULT_COLOR, profilePicture: user.profilePicture || 'profiles/default.svg' };
    if (!lobby.host) lobby.host = socket.id;
    socket.join(ROOM);
    socket.emit('tlState', publicState());
    broadcastPlayers();
    log('TIERLIST', `${username} joined (${playerList().length} players)`);
  });

  function leave() {
    const p = lobby.players[socket.id];
    if (!p) return;
    delete lobby.players[socket.id];
    socket.leave(ROOM);
    socket.to(ROOM).emit('tlCursor', { username: p.username, gone: true });
    if (lobby.host === socket.id) lobby.host = Object.keys(lobby.players)[0] || null;
    if (!lobby.host) reset(); else broadcastPlayers();
    log('TIERLIST', `${p.username} left`);
  }
  socket.on('tlLeave', leave);

  socket.on('tlSearch', async ({ q } = {}) => {
    if (!isHost() || !q || !q.trim()) return;
    try { socket.emit('tlSearchResults', { q, results: await searchAlbums(q.trim()) }); }
    catch (e) { fail('khinsider no responde', e); }
  });

  socket.on('tlLoadAlbum', async ({ slug } = {}) => {
    if (!isHost() || !slug) return;
    try {
      const album = await loadAlbum(slug);
      if (!album.songs.length) return fail('Ese album no tiene canciones');
      lobby.album = { slug, title: album.title, covers: album.covers };
      lobby.songs = album.songs;
      lobby.currentId = null;
      lobby.playback = { playing: false, position: 0, at: Date.now() };
      lobby.tiers = emptyTiers();
      lobby.votes = {};
      io.to(ROOM).emit('tlState', publicState());
      log('TIERLIST', `album loaded: ${album.title} (${album.songs.length} songs)`);
    } catch (e) { fail('No se pudo cargar el album', e); }
  });

  socket.on('tlSelect', async ({ songId } = {}) => {
    if (!isHost()) return;
    const song = lobby.songs[songId];
    if (!song) return;
    try {
      await resolveMp3(song);
      lobby.currentId = song.id;
      lobby.playback = { playing: true, position: 0, at: Date.now() };
      io.to(ROOM).emit('tlPlayback', playbackMsg());
    } catch (e) { fail('No se pudo cargar la cancion', e); }
  });

  socket.on('tlPlayback', ({ playing, position } = {}) => {
    if (!isHost() || lobby.currentId === null) return;
    lobby.playback = { playing: !!playing, position: Math.max(0, Number(position) || 0), at: Date.now() };
    io.to(ROOM).emit('tlPlayback', playbackMsg());
  });

  socket.on('tlCursor', (pos) => {
    const p = lobby.players[socket.id];
    if (!p || !pos) return;
    socket.to(ROOM).volatile.emit('tlCursor', { username: p.username, x: +pos.x || 0, y: +pos.y || 0 });
  });

  return { handleDisconnect: leave };
}

module.exports = { setupHandlers, searchAlbums, loadAlbum, resolveMp3 };

// Self-check: node server/handlers/tierlist.js
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
