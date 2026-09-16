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
  // the server ships the browser client bundle; it runs fine in Node 22+ with the websocket transport
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

  b.emit('tlSearch', { q: 'minecraft' }); await silence(b, 'tlSearchResults');           // non-host ignored
  a.emit('tlSearch', { q: 'minecraft' }); const res = await once(a, 'tlSearchResults');
  assert(res.results.some(r => r.slug === 'minecraft'));

  a.emit('tlLoadAlbum', { slug: 'minecraft' });
  const [, s2] = await Promise.all([once(a, 'tlState'), once(b, 'tlState')]);
  assert.equal(s2.songs.length, 54); assert(s2.songs[0].cover); assert.deepEqual(s2.trashed, []);

  a.emit('tlSelect', { songId: 1 });
  const [, p2] = await Promise.all([once(a, 'tlPlayback'), once(b, 'tlPlayback')]);
  assert.equal(p2.currentId, 1); assert(/vgmtreasurechest\.com\/.+\.mp3$/.test(p2.mp3)); assert(p2.playback.playing);

  a.emit('tlPlayback', { playing: false, position: 42.5 }); const p3 = await once(b, 'tlPlayback');
  assert(!p3.playback.playing); assert.equal(p3.playback.position, 42.5);
  b.emit('tlPlayback', { playing: true, position: 0 }); await silence(a, 'tlPlayback');   // non-host ignored

  a.emit('tlCursor', { x: 0.5, y: 0.25, drag: { id: 1, gx: 10, gy: 20, rot: -12.5 } }); const c = await once(b, 'tlCursor');
  assert.equal(c.username, 'REASON'); assert.equal(c.x, 0.5); assert.deepEqual(c.drag, { id: 1, gx: 10, gy: 20, rot: -12.5 });

  // votes: both vote, b changes their mind, votes for a non-current song are ignored
  b.emit('tlVote', { songId: 1, tier: 'S' }); const [v1] = await Promise.all([once(a, 'tlVotes'), once(b, 'tlVotes')]);
  assert.deepEqual(v1, { songId: 1, votes: { Mugi: 'S' } });
  a.emit('tlVote', { songId: 1, tier: 'A' }); const [v2] = await Promise.all([once(a, 'tlVotes'), once(b, 'tlVotes')]);
  assert.deepEqual(v2.votes, { Mugi: 'S', REASON: 'A' });
  b.emit('tlVote', { songId: 1, tier: 'B' }); const [v3] = await Promise.all([once(a, 'tlVotes'), once(b, 'tlVotes')]);
  assert.deepEqual(v3.votes, { Mugi: 'B', REASON: 'A' });
  b.emit('tlVote', { songId: 2, tier: 'S' }); await silence(b, 'tlVotes');

  // verdict: non-host ignored, host places it; then votes on a placed song are ignored
  b.emit('tlVerdict', { songId: 1, tier: 'S' }); await silence(b, 'tlTiers');
  a.emit('tlVerdict', { songId: 1, tier: 'A' }); const [t1] = await Promise.all([once(a, 'tlTiers'), once(b, 'tlTiers')]);
  assert.deepEqual(t1.tiers.A, [1]); assert.equal(t1.placed, 1);
  b.emit('tlVote', { songId: 1, tier: 'S' }); await silence(b, 'tlVotes');

  // host moves it to S at index 0 in front of another placed song
  a.emit('tlVerdict', { songId: 5, tier: 'S' }); await Promise.all([once(a, 'tlTiers'), once(b, 'tlTiers')]);
  a.emit('tlVerdict', { songId: 1, tier: 'S', index: 0 }); const [t2] = await Promise.all([once(a, 'tlTiers'), once(b, 'tlTiers')]);
  assert.deepEqual(t2.tiers.S, [1, 5]); assert.deepEqual(t2.tiers.A, []);

  // trash
  a.emit('tlTrash', { songId: 5 }); const [t3] = await Promise.all([once(a, 'tlTiers'), once(b, 'tlTiers')]);
  assert.deepEqual(t3.tiers.S, [1]); assert.deepEqual(t3.trashed, [5]); assert.equal(t3.placed, null);

  // late joiner gets the full picture
  const cc = connect(); await once(cc, 'connect'); await login(cc, 'Jesus');
  cc.emit('tlJoin'); const [s3] = await Promise.all([once(cc, 'tlState'), once(b, 'tlPlayers')]);
  assert.equal(s3.currentId, 1); assert.deepEqual(s3.tiers.S, [1]); assert.deepEqual(s3.trashed, [5]); assert.deepEqual(s3.votes[1], { Mugi: 'B', REASON: 'A' });

  // host leaves -> next player hosts; everyone leaves -> lobby resets
  a.emit('tlLeave'); const pl = await once(b, 'tlPlayers');
  assert.equal(pl.host, 'Mugi');
  b.emit('tlLeave'); cc.emit('tlLeave'); await wait(150);
  a.emit('tlJoin'); const s4 = await once(a, 'tlState');
  assert.equal(s4.album, null); assert.equal(s4.host, 'REASON');

  console.log('ALL OK');
  process.exit(0);
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
