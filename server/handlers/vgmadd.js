const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const tl = require('./tierlist');
const { log, warn } = require('../utils');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const AUDIO_DIR = path.join(__dirname, '..', '..', 'public', 'audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });
const CLIP = 41;
const FADE = 3;
const PAGE_RE = /^\/game-soundtracks\/album\/[A-Za-z0-9._%-]+\/[^\s"'<>]+$/;
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const COVER_RE = /^https:\/\/[a-z0-9.-]+\.(ytimg\.com|vgmtreasurechest\.com|khinsider\.com)\/[^\s"'<>]+$/i;

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const slug = s => norm(s).replace(/ /g, '-').slice(0, 60) || 'x';
const clean = s => String(s || '').replace(/[<>]/g, '').replace(/^[\s\-\u2013|:]+|[\s\-\u2013|:]+$/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
const NOISE = /\b(the\s+)?(original|official|complete|full|video\s*game|game)?\s*(sound\s*tracks?|ost|score|bgm|gamerip|music|soundtracks?)\b.*$/i;
const JUNK = /^(official|original|hd|hq|4k|ost|soundtrack|extended|lyrics?|audio|music|theme|main theme|title|intro|opening|ending|credits|remaster(ed)?|arrange(d|ment)?|orchestral|piano|8.?bit|instrumental|remix|cover|loop(ed)?|slowed|reverb|ver(sion)?|edit|mix|high quality|full|complete|part\s*\d+|\d+\s*(h|hours?|min|minutes?)|\d{4})\b/i;
const parseAliases = (text, game) => {
  const seen = new Set([norm(game)]);
  return String(text || '').split(/[,;|\n]+/).map(clean).filter(a => a && !seen.has(norm(a)) && seen.add(norm(a))).slice(0, 10);
};
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function deriveGame(title) {
  const t = String(title || '').replace(/\[.*?\]/g, ' ');
  const parts = t.replace(/\(.*?\)/g, ' ').split(/\s+[-\u2013|]\s+|:\s+/).map(p => p.trim()).filter(Boolean);
  const paren = (t.match(/\(([^)]+)\)/g) || []).map(p => p.slice(1, -1).trim()).filter(p => p && !JUNK.test(p));
  let g = parts.find(p => NOISE.test(p)) || (parts.length < 2 && paren[0]) || parts[0] || '';
  g = g.replace(NOISE, '').replace(/\s+(vol\.?|volume)\s*\S*$/i, '').replace(/\s+(version|edition)$/i, '').replace(/\s+\d{4}$/, '').replace(/\s+/g, ' ').trim();
  return clean(g || title);
}
const songParts = name => String(name || '').replace(/^\s*\d+[\s.)-]+/, '').replace(/\[.*?\]/g, ' ').replace(/\((official|hd|hq|ost|soundtrack|extended|lyrics?|audio|music)[^)]*\)/gi, ' ').replace(/\s+/g, ' ').trim().split(/\s+[-\u2013|]\s+|:\s+/).map(p => p.trim()).filter(Boolean);
function deriveSongs(names, game) {
  const all = names.map(songParts);
  const freq = new Map();
  for (const parts of all) for (const p of new Set(parts.map(norm))) freq.set(p, (freq.get(p) || 0) + 1);
  const g = norm(game);
  const common = p => all.length >= 3 && freq.get(norm(p)) >= Math.max(2, all.length * 0.4);
  const gameLike = p => { const n = norm(p); return !!g && (n.includes(g) || g.includes(n)); };
  return all.map((parts, i) => {
    let rest = parts.filter(p => !common(p) && !gameLike(p));
    if (!rest.length) rest = parts.filter(p => !common(p));
    if (!rest.length) rest = parts;
    const song = (rest[0] || names[i]).replace(new RegExp(escapeRe(game), 'i'), '').trim();
    const bare = song.replace(/\(\s*([^)]*)\)/g, (m, inner) => !inner.trim() || JUNK.test(inner.trim()) ? '' : m).trim();
    return clean((bare || song).replace(/^\((.*)\)$/, '$1')) || clean(rest[0] || names[i]);
  });
}

function ffmpegClip(url, start, out) {
  return new Promise((resolve, reject) => {
    const args = ['-y', '-loglevel', 'error', '-ss', String(start), '-t', String(CLIP), '-i', url, '-vn',
      '-af', `afade=t=out:st=${CLIP - FADE}:d=${FADE}`, '-ar', '44100', '-ac', '2', '-c:a', 'aac', '-b:a', '80k', '-movflags', '+faststart', out];
    const p = spawn(FFMPEG, args);
    let err = '';
    p.stderr.on('data', d => { err += d; });
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('ffmpeg timeout')); }, 180000);
    p.on('error', e => { clearTimeout(timer); reject(e); });
    p.on('close', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(err.trim().split('\n').pop() || `ffmpeg exit ${code}`)); });
  });
}

const sessions = new Map();
const FIELD_RE = /^(game|song|alias:[a-z]\d{1,16})$/;

let chain = Promise.resolve();
const queued = job => { const run = chain.then(job, job); chain = run.catch(() => {}); return run; };

function setupHandlers(io, socket, { getLoggedInUsername, getUser, songs, addedSongs, addSong, removeSong, saveSongs, generateAudioToken, lastRevealedId, VGM_ROOM }) {
  const fail = (message, e) => { if (e) warn('VGMADD', message, e.message); socket.emit('vaError', { message }); };
  const isAdmin = username => !!(getUser(username) || {}).isAdmin;
  const isAdded = (src, game, song) => songs.some(s => (s.src && s.src === src) || (norm(s.game) === norm(game) && norm(s.song) === norm(song)));
  const canEdit = (entry, username) => entry.addedBy === username || isAdmin(username) || entry.id === lastRevealedId();
  const stateOf = id => {
    const s = sessions.get(id);
    return { id, drafts: s.drafts, locks: Object.fromEntries(Object.entries(s.locks).map(([f, l]) => [f, { user: l.user, color: l.color }])) };
  };
  const pushState = id => {
    const s = sessions.get(id);
    if (!s) return;
    const st = stateOf(id);
    for (const sid of s.members) io.to(sid).emit('vaEditState', st);
  };
  const leaveSession = id => {
    const s = sessions.get(id);
    if (!s || !s.members.has(socket.id)) return;
    s.members.delete(socket.id);
    for (const [f, l] of Object.entries(s.locks)) if (l.sid === socket.id) delete s.locks[f];
    if (!s.members.size) sessions.delete(id); else pushState(id);
  };
  const sessionFor = id => {
    const s = sessions.get(Number(id));
    return s && s.members.has(socket.id) ? s : null;
  };

  socket.on('vaEditOpen', ({ id } = {}) => {
    const username = getLoggedInUsername();
    const entry = username && addedSongs.find(s => s.id === Number(id));
    if (!entry || !canEdit(entry, username)) return;
    let s = sessions.get(entry.id);
    if (!s) {
      s = { drafts: { game: entry.game, song: entry.song }, locks: {}, members: new Set(), n: 0 };
      for (const a of entry.aliases || []) s.drafts[`alias:a${s.n++}`] = a;
      sessions.set(entry.id, s);
    }
    s.members.add(socket.id);
    const st = stateOf(entry.id);
    for (const sid of s.members) io.to(sid).emit('vaEditState', { ...st, me: sid === socket.id ? username : undefined });
  });

  socket.on('vaEditFocus', ({ id, field } = {}) => {
    const s = sessionFor(id);
    if (!s || !FIELD_RE.test(String(field))) return;
    const l = s.locks[field];
    if (l && l.sid !== socket.id) return socket.emit('vaEditState', { ...stateOf(Number(id)), me: getLoggedInUsername() });
    for (const [f, k] of Object.entries(s.locks)) if (k.sid === socket.id) delete s.locks[f];
    const username = getLoggedInUsername();
    s.locks[field] = { sid: socket.id, user: username, color: tl.COLORS[username] || '#333' };
    pushState(Number(id));
  });

  socket.on('vaEditInput', ({ id, field, value } = {}) => {
    const s = sessionFor(id);
    if (!s || !FIELD_RE.test(String(field))) return;
    const l = s.locks[field];
    if (l && l.sid !== socket.id) return;
    if (value === null) {
      if (!field.startsWith('alias:')) return;
      delete s.drafts[field];
      delete s.locks[field];
    } else {
      if (field.startsWith('alias:') && !(field in s.drafts) && Object.keys(s.drafts).length > 12) return;
      s.drafts[field] = String(value).slice(0, 80);
    }
    pushState(Number(id));
  });

  socket.on('vaEditBlur', ({ id, field } = {}) => {
    const s = sessionFor(id);
    if (!s) return;
    const l = s.locks[field];
    if (l && l.sid === socket.id) { delete s.locks[field]; pushState(Number(id)); }
  });

  socket.on('vaEditClose', ({ id } = {}) => leaveSession(Number(id)));
  socket.on('disconnect', () => { for (const id of [...sessions.keys()]) leaveSession(id); });
  const sendMine = () => {
    const username = getLoggedInUsername();
    const admin = isAdmin(username);
    const list = addedSongs.filter(s => admin || s.addedBy === username);
    socket.emit('vaMineList', { admin, songs: list.map(s => ({ id: s.id, song: s.song, game: s.game, aliases: s.aliases || [], cover: s.cover || '', start: s.start || 0, plays: s.plays || 0, attempts: s.attempts || 0, hits: s.hits || 0, timeSum: s.timeSum || 0, addedBy: s.addedBy, color: tl.COLORS[s.addedBy] || null })) });
  };

  socket.on('vaMine', () => { if (getLoggedInUsername()) sendMine(); });

  socket.on('vaRename', ({ id, game, song, aliases } = {}) => {
    const username = getLoggedInUsername();
    if (!username) return;
    const entry = addedSongs.find(s => s.id === Number(id));
    if (!entry || !canEdit(entry, username)) return;
    const gameName = clean(game), songName = clean(song);
    if (!gameName || !songName) return fail('Pon el juego y el nombre de la canción');
    if (songs.some(s => s !== entry && norm(s.game) === norm(gameName) && norm(s.song) === norm(songName))) return fail('Esa canción ya está en el VGM');
    entry.game = gameName;
    entry.song = songName;
    entry.aliases = parseAliases(aliases, gameName);
    saveSongs();
    log('VGMADD', `${username} renamed #${entry.id} to "${songName}" (${gameName})`);
    io.to(VGM_ROOM).emit('sqrrrMessage', { message: `${username} ha corregido: ${gameName} - ${songName}`, isBold: true });
    const s = sessions.get(entry.id);
    if (s) {
      for (const sid of s.members) io.to(sid).emit('vaEditSaved', { id: entry.id, by: username });
      sessions.delete(entry.id);
    }
    sendMine();
  });

  socket.on('vaPlayMine', ({ id } = {}) => {
    const username = getLoggedInUsername();
    if (!username) return;
    const entry = addedSongs.find(s => s.id === Number(id));
    if (!entry || !(entry.addedBy === username || isAdmin(username))) return;
    socket.emit('vaMineUrl', { id: entry.id, url: `/audio-stream/${generateAudioToken(entry.file)}` });
  });

  socket.on('vaRemove', ({ id } = {}) => {
    const username = getLoggedInUsername();
    if (!username) return;
    const entry = addedSongs.find(s => s.id === Number(id));
    if (!entry || !(entry.addedBy === username || isAdmin(username))) return;
    removeSong(entry);
    fs.unlink(path.join(AUDIO_DIR, entry.file), () => {});
    log('VGMADD', `${username} removed "${entry.song}" (${entry.game}) added by ${entry.addedBy}`);
    sendMine();
  });

  socket.on('vaSearch', async ({ q } = {}) => {
    const query = String(q || '').trim().slice(0, 100);
    if (!getLoggedInUsername() || !query) return;
    const [kh, yt] = await Promise.all([
      tl.searchAlbums(query).catch(e => { warn('VGMADD', 'khinsider search failed', e.message); return { results: [] }; }),
      tl.ytSearchAll(query + ' ost').catch(e => { warn('VGMADD', 'youtube search failed', e.message); return []; })
    ]);
    socket.emit('vaResults', { q: query, kh: kh.results, yt });
  });

  socket.on('vaOpen', async ({ source, id, kind } = {}) => {
    if (!getLoggedInUsername()) return;
    try {
      if (source === 'kh') {
        const a = await tl.loadAlbum(String(id));
        const game = deriveGame(a.title);
        const songs = deriveSongs(a.songs.map(s => s.name), game);
        socket.emit('vaTracks', { source, id, title: a.title, game, cover: a.covers[0] || null, tracks: a.songs.map((s, i) => ({ name: s.name, song: songs[i], duration: s.duration, page: s.page, disc: s.disc, num: s.num, added: isAdded(s.page, game, songs[i]) })) });
      } else if (source === 'yt') {
        const l = await tl.ytList(kind === 'video' ? `https://www.youtube.com/watch?v=${String(id)}` : `https://www.youtube.com/playlist?list=${String(id)}`);
        const game = deriveGame(l.title);
        const songs = deriveSongs(l.entries.map(e => e.title), game);
        socket.emit('vaTracks', { source, id, title: l.title, game, cover: (l.entries[0] || {}).thumb || null, tracks: l.entries.map((e, i) => ({ name: e.title, song: songs[i], duration: e.duration, ytId: e.id, disc: 1, num: i + 1, thumb: e.thumb, added: isAdded(e.id, game, songs[i]) })) });
      }
    } catch (e) { fail('No se pudo abrir eso', e); }
  });

  socket.on('vaStream', async ({ source, page, ytId } = {}) => {
    if (!getLoggedInUsername()) return;
    try {
      const url = await tl.resolveMp3(source === 'yt' ? { source: 'yt', ytId: String(ytId) } : { source: 'kh', page: String(page) });
      socket.emit('vaStreamUrl', { page, ytId, url });
    } catch (e) { fail('No se pudo cargar la canción', e); }
  });

  socket.on('vaSubmit', async ({ source, page, ytId, start, game, song, aliases, cover } = {}) => {
    const username = getLoggedInUsername();
    if (!username) return;
    const gameName = clean(game), songName = clean(song), at = Math.max(0, Math.min(36000, Number(start) || 0));
    if (!gameName || !songName) return fail('Pon el juego y el nombre de la canción');
    if (source === 'kh' ? !PAGE_RE.test(String(page || '')) : !(source === 'yt' && YT_ID.test(String(ytId || '')))) return fail('Canción no válida');
    const src = source === 'kh' ? String(page) : String(ytId);
    if (isAdded(src, gameName, songName)) return fail('Esa canción ya está en el VGM');
    const file = `${slug(gameName)}-${slug(songName)}.m4a`;
    if (fs.existsSync(path.join(AUDIO_DIR, file))) return fail('Ya hay un archivo con ese nombre');
    socket.emit('vaProgress', { message: 'En cola...' });
    try {
      await queued(async () => {
        socket.emit('vaProgress', { message: 'Descargando...' });
        const url = await tl.resolveMp3(source === 'yt' ? { source: 'yt', ytId } : { source: 'kh', page });
        socket.emit('vaProgress', { message: 'Recortando y convirtiendo...' });
        await ffmpegClip(url, at, path.join(AUDIO_DIR, file));
        const size = fs.statSync(path.join(AUDIO_DIR, file)).size;
        if (size < 20000) { fs.unlinkSync(path.join(AUDIO_DIR, file)); throw new Error('clip too small'); }
        const entry = { id: songs.reduce((m, s) => Math.max(m, s.id || 0), 0) + 1, file, game: gameName, song: songName, aliases: parseAliases(aliases, gameName), addedBy: username, src, start: Math.round(at), cover: COVER_RE.test(String(cover || '')) ? String(cover) : '' };
        addSong(entry);
        log('VGMADD', `${username} added "${songName}" (${gameName}) ${Math.round(size / 1024)} KB from ${source}`);
        socket.emit('vaDone', { song: entry, total: songs.length });
        io.to(VGM_ROOM).emit('sqrrrMessage', { message: `${username} ha añadido una canción al VGM`, isBold: true });
      });
    } catch (e) { fail('No se pudo añadir: ' + e.message, e); }
  });
}

module.exports = { setupHandlers, ffmpegClip, deriveGame, deriveSongs, CLIP };

if (require.main === module) {
  const [url, start] = process.argv.slice(2);
  const out = path.join(require('os').tmpdir(), 'vgmadd-test.m4a');
  ffmpegClip(url, Number(start) || 0, out).then(() => { console.log('ok', out, fs.statSync(out).size, 'bytes'); process.exit(0); }).catch(e => { console.error('fail', e.message); process.exit(1); });
}
