// Smoke test for the tierlist socket flow. Run against a local in-memory server:
//   PORT=3999 node server.js   (in another terminal)
//   node tools/tierlist-smoke.js [http://localhost:3999]
// Drives three logged-in clients through join, search, album load, playback, cursors, votes, verdict, move, trash.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const URL = process.argv[2] || 'http://localhost:3999';
const once = (s, ev) => new Promise(r => s.once(ev, r));
const silence = (s, ev, ms = 400) => new Promise((res, rej) => { const h = () => rej(new Error(ev + ' should not fire')); s.once(ev, h); setTimeout(() => { s.off(ev, h); res(); }, ms); });
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log(" - the server ships the browser client bundle; it runs fine in Node 22+ with the websocket transport");
  const bundle = path.join(os.tmpdir(), 'sqrrr-socket.io.js');
  fs.writeFileSync(bundle, await (await fetch(URL + '/socket.io/socket.io.js')).text());
  const io = require(bundle);
  const connect = () => io(URL, { transports: ['websocket'], forceNew: true });
  const login = async (s, username) => { s.emit('loginSimple', { username }); const r = await once(s, 'loginResult'); assert(r.success, 'login failed ' + username + ' ' + r.error); };

  const a = connect(), b = connect();
  await Promise.all([once(a, 'connect'), once(b, 'connect')]);
  await login(a, 'REASON'); await login(b, 'Mugi');

  a.emit('tlJoin'); const sa = await once(a, 'tlState');
  assert.equal(sa.host, 'REASON'); assert.equal(sa.players[0].color, '#a01830'); assert.equal(sa.album, null);
  b.emit('tlJoin'); const [sb] = await Promise.all([once(b, 'tlState'), once(a, 'tlPlayers')]);
  assert.equal(sb.host, 'REASON'); assert.equal(sb.players.length, 2);

  console.log(" - general mode: tiermaker search seen by everyone, template loads without audio, typing mirrored");
  b.emit('tlMode', { mode: 'general' }); await silence(b, 'tlState');
  a.emit('tlMode', { mode: 'general' }); const [, sg] = await Promise.all([once(a, 'tlState'), once(b, 'tlState')]);
  assert.equal(sg.mode, 'general'); assert.equal(sg.album, null);
  a.emit('tlSearch', { q: 'minecraft' });
  const [, sb1, rt] = await Promise.all([once(a, 'tlSearching'), once(b, 'tlSearching'), once(b, 'tlSearchResults'), once(a, 'tlSearchResults')]);
  assert.equal(sb1.q, 'minecraft'); assert(rt.results.length > 0 && rt.results.every(r => r.source === 'tm' && r.id && r.count > 0 && r.thumb.startsWith('https://tiermaker.com/')), 'tiermaker results: ' + JSON.stringify(rt.results[0]));
  a.emit('tlLoad', { source: 'tm', id: rt.results[0].id });
  const [, st] = await Promise.all([once(a, 'tlState'), once(b, 'tlState')]);
  assert(st.songs.length > 1 && st.songs.every(s => s.source === 'tm' && s.cover.startsWith('https://tiermaker.com/images/')), 'template load: ' + JSON.stringify(st.songs[0]));
  assert.equal(st.album.title, rt.results[0].title);
  a.emit('tlSelect', { songId: 0 }); const [, pg] = await Promise.all([once(a, 'tlPlayback'), once(b, 'tlPlayback')]);
  assert.equal(pg.currentId, 0); assert.equal(pg.mp3, null); assert(!pg.playback.playing);
  a.emit('tlTyping', { q: 'mine' }); const ty = await once(b, 'tlTyping'); assert.equal(ty.q, 'mine');
  b.emit('tlTyping', { q: 'nope' }); await silence(a, 'tlTyping');
  a.emit('tlMode', { mode: 'music' }); const [, sm] = await Promise.all([once(a, 'tlState'), once(b, 'tlState')]);
  assert.equal(sm.mode, 'music'); assert.equal(sm.album, null);

  b.emit('tlSearch', { q: 'minecraft' }); await silence(b, 'tlSearchResults');           // non-host ignored
  a.emit('tlSearch', { q: 'minecraft' }); const [res] = await Promise.all([once(a, 'tlSearchResults'), once(b, 'tlSearchResults')]);
  assert(res.results.some(r => r.source === 'kh' && r.slug === 'minecraft'), 'search or slug fallback failed (gated=' + res.gated + ')');
  if (res.youtube) {
    const yt = res.results.filter(r => r.source === 'yt');
    assert(yt.length > 0, 'no youtube results');
    assert(yt.every(r => r.id.length !== 11 && r.title && r.count > 1), 'youtube results must be playlists with 2+ videos: ' + JSON.stringify(yt.slice(0, 2)));
  }
  else console.log('  (yt-dlp not installed locally: skipping YouTube checks)');

  a.emit('tlLoad', { source: 'kh', id: 'minecraft' });
  const [, s2] = await Promise.all([once(a, 'tlState'), once(b, 'tlState')]);
  assert.equal(s2.songs.length, 54); assert(s2.songs[0].cover); assert.deepEqual(s2.trashed, []);

  a.emit('tlSelect', { songId: 1 });
  const [ld, , p2] = await Promise.all([once(b, 'tlLoading'), once(a, 'tlPlayback'), once(b, 'tlPlayback')]);
  assert.deepEqual(ld, { on: true });                                          // everyone sees CARGANDO while the url resolves
  assert.equal(p2.currentId, 1); assert(/vgmtreasurechest\.com\/.+\.mp3$/.test(p2.mp3)); assert(p2.playback.playing);

  const px = await fetch(URL + '/tierlist/audio?u=' + encodeURIComponent(p2.mp3), { headers: { range: 'bytes=0-99' } });
  assert.equal(px.status, 206); assert.equal(px.headers.get('content-type'), 'audio/mpeg'); assert.equal((await px.arrayBuffer()).byteLength, 100);
  assert.equal((await fetch(URL + '/tierlist/audio?u=https://evil.example/x.mp3')).status, 400);

  a.emit('tlPlayback', { playing: false, position: 42.5 }); const p3 = await once(b, 'tlPlayback');
  assert(!p3.playback.playing); assert.equal(p3.playback.position, 42.5);
  b.emit('tlPlayback', { playing: true, position: 0 }); await silence(a, 'tlPlayback');   // non-host ignored

  a.emit('tlCursor', { x: 0.5, y: 0.25, drag: { id: 1, gx: 10, gy: 20, rot: -12.5 } }); const c = await once(b, 'tlCursor');
  assert.equal(c.username, 'REASON'); assert.equal(c.x, 0.5); assert.deepEqual(c.drag, { id: 1, gx: 10, gy: 20, rot: -12.5 });

  console.log(" - cursor chat: trimmed, capped, empty ignored");
  b.emit('tlChat', { text: '   hola   ' }); const [ch] = await Promise.all([once(a, 'tlChat'), once(b, 'tlChat')]);
  assert.deepEqual(ch, { username: 'Mugi', text: 'hola' });
  b.emit('tlChat', { text: '   ' }); await silence(a, 'tlChat');

  console.log(" - votes: both vote, b changes their mind, votes for a non-current song are ignored");
  b.emit('tlVote', { songId: 1, tier: 'S' }); const [v1] = await Promise.all([once(a, 'tlVotes'), once(b, 'tlVotes')]);
  assert.deepEqual(v1, { songId: 1, votes: { Mugi: 'S' } });
  a.emit('tlVote', { songId: 1, tier: 'A' }); const [v2] = await Promise.all([once(a, 'tlVotes'), once(b, 'tlVotes')]);
  assert.deepEqual(v2.votes, { Mugi: 'S', REASON: 'A' });
  b.emit('tlVote', { songId: 1, tier: 'B' }); const [v3] = await Promise.all([once(a, 'tlVotes'), once(b, 'tlVotes')]);
  assert.deepEqual(v3.votes, { Mugi: 'B', REASON: 'A' });
  b.emit('tlVote', { songId: 2, tier: 'S' }); await silence(b, 'tlVotes');

  console.log(" - veredicto panel: non-host can't open it for others, host can");
  b.emit('tlVerdictOpen'); await silence(a, 'tlVerdictOpen');
  a.emit('tlVerdictOpen'); const [vo] = await Promise.all([once(a, 'tlVerdictOpen'), once(b, 'tlVerdictOpen')]);
  assert.deepEqual(vo, { songId: 1 });

  console.log(" - verdict: non-host ignored, host places it; then votes on a placed song are ignored");
  b.emit('tlVerdict', { songId: 1, tier: 'S' }); await silence(b, 'tlTiers');
  a.emit('tlVerdict', { songId: 1, tier: 'A' }); const [t1] = await Promise.all([once(a, 'tlTiers'), once(b, 'tlTiers')]);
  assert.deepEqual(t1.tiers.A, [1]); assert.equal(t1.placed, 1);
  b.emit('tlVote', { songId: 1, tier: 'S' }); await silence(b, 'tlVotes');

  console.log(" - host moves it to S at index 0 in front of another placed song");
  a.emit('tlVerdict', { songId: 5, tier: 'S' }); await Promise.all([once(a, 'tlTiers'), once(b, 'tlTiers')]);
  a.emit('tlVerdict', { songId: 1, tier: 'S', index: 0 }); const [t2] = await Promise.all([once(a, 'tlTiers'), once(b, 'tlTiers')]);
  assert.deepEqual(t2.tiers.S, [1, 5]); assert.deepEqual(t2.tiers.A, []);

  console.log(" - trash");
  a.emit('tlTrash', { songId: 5 }); const [t3] = await Promise.all([once(a, 'tlTiers'), once(b, 'tlTiers')]);
  assert.deepEqual(t3.tiers.S, [1]); assert.deepEqual(t3.trashed, [5]); assert.equal(t3.placed, null);

  console.log(" - YouTube: load one video by url, play it through the proxy");
  if (res.youtube) {
    a.emit('tlLoad', { source: 'yturl', id: 'https://www.youtube.com/watch?v=aBkTkxKDduc' });
    const [, sy] = await Promise.all([once(a, 'tlState'), once(b, 'tlState')]);
    assert.equal(sy.songs.length, 1); assert.equal(sy.songs[0].source, 'yt'); assert.deepEqual(sy.tiers.S, []);
    a.emit('tlSelect', { songId: 0 });
    const [, py] = await Promise.all([once(a, 'tlPlayback'), once(b, 'tlPlayback')]);
    assert(/googlevideo\.com\/videoplayback\?/.test(py.mp3), 'yt stream url: ' + py.mp3);
    const pr = await fetch(URL + '/tierlist/audio?u=' + encodeURIComponent(py.mp3), { headers: { range: 'bytes=0-99' } });
    assert.equal(pr.status, 206); assert(/audio\//.test(pr.headers.get('content-type')), pr.headers.get('content-type'));
    await pr.arrayBuffer();
    console.log(" - a playlist tile loads the whole playlist (replace mode)");
    const pl = res.results.find(r => r.source === 'yt');
    a.emit('tlLoad', { source: 'yt', id: pl.id });
    const [, sp] = await Promise.all([once(a, 'tlState'), once(b, 'tlState')]);
    assert(sp.songs.length > 1 && sp.songs.every(s => s.source === 'yt'), 'playlist load failed'); assert.equal(sp.album.title, pl.title);
    console.log(" - back to the khinsider album and rebuild the state the later checks expect (votes on 1, 1 placed in S, 5 trashed)");
    a.emit('tlLoad', { source: 'kh', id: 'minecraft' }); await Promise.all([once(a, 'tlState'), once(b, 'tlState')]);
    a.emit('tlSelect', { songId: 1 }); await Promise.all([once(a, 'tlPlayback'), once(b, 'tlPlayback')]);
    b.emit('tlVote', { songId: 1, tier: 'B' }); await Promise.all([once(a, 'tlVotes'), once(b, 'tlVotes')]);
    a.emit('tlVote', { songId: 1, tier: 'A' }); await Promise.all([once(a, 'tlVotes'), once(b, 'tlVotes')]);
    a.emit('tlVerdict', { songId: 1, tier: 'S' }); await Promise.all([once(a, 'tlTiers'), once(b, 'tlTiers')]);
    a.emit('tlTrash', { songId: 5 }); await Promise.all([once(a, 'tlTiers'), once(b, 'tlTiers')]);
  }

  console.log(" - trashing the playing song stops playback; restore brings it back to the list");
  a.emit('tlSelect', { songId: 2 }); await Promise.all([once(a, 'tlPlayback'), once(b, 'tlPlayback')]);
  a.emit('tlTrash', { songId: 2 });
  const [t4, p4] = await Promise.all([once(b, 'tlTiers'), once(b, 'tlPlayback')]);
  assert.deepEqual(t4.trashed, [5, 2]); assert.equal(p4.currentId, null); assert.equal(p4.mp3, null); assert(!p4.playback.playing);
  b.emit('tlRestore', { songId: 2 }); await silence(b, 'tlTiers');
  a.emit('tlRestore', { songId: 2 }); const [t5] = await Promise.all([once(a, 'tlTiers'), once(b, 'tlTiers')]);
  assert.deepEqual(t5.trashed, [5]);
  a.emit('tlSelect', { songId: 1 }); await Promise.all([once(a, 'tlPlayback'), once(b, 'tlPlayback')]);

  console.log(" - late joiner gets the full picture");
  const cc = connect(); await once(cc, 'connect'); await login(cc, 'Jesus');
  cc.emit('tlJoin'); const [s3] = await Promise.all([once(cc, 'tlState'), once(b, 'tlPlayers')]);
  assert.equal(s3.currentId, 1); assert.deepEqual(s3.tiers.S, [1]); assert.deepEqual(s3.trashed, [5]); assert.deepEqual(s3.votes[1], { Mugi: 'B', REASON: 'A' });

  console.log(" - closing the tab: the beacon endpoint removes the player right away");
  const [plc] = await Promise.all([once(b, 'tlPlayers'), fetch(URL + '/tierlist/leave', { method: 'POST', body: cc.id, headers: { 'content-type': 'text/plain' } })]);
  assert(!plc.players.some(p => p.username === 'Jesus')); assert.equal(plc.players.length, 2);

  console.log(" - Cancelar: non-host ignored, host clears everything for everyone");
  b.emit('tlReset'); await silence(b, 'tlState');
  a.emit('tlReset'); const [, sr] = await Promise.all([once(a, 'tlState'), once(b, 'tlState')]);
  assert.equal(sr.album, null); assert.equal(sr.songs.length, 0); assert.equal(sr.currentId, null); assert.equal(sr.host, 'REASON');

  console.log(" - host leaves -> next player hosts; everyone leaves -> lobby resets");
  a.emit('tlLeave'); const pl = await once(b, 'tlPlayers');
  assert.equal(pl.host, 'Mugi');
  b.emit('tlLeave'); await wait(150);
  a.emit('tlJoin'); const s4 = await once(a, 'tlState');
  assert.equal(s4.album, null); assert.equal(s4.host, 'REASON');

  console.log('ALL OK');
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
