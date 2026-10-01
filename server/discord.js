const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { log, warn } = require('./utils');
const fs = require('fs');
const path = require('path');

const REPLIES = path.join(__dirname, '..', 'discord-replies.json');
const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const pick = v => Array.isArray(v) ? v[Math.floor(Math.random() * v.length)] : v;

function replyFor(text) {
  let table;
  try { table = JSON.parse(fs.readFileSync(REPLIES, 'utf8')); } catch (e) { warn('DISCORD', 'replies file', e.message); return null; }
  const t = norm(text);
  for (const [keys, value] of Object.entries(table)) {
    if (keys !== '*' && keys.split('|').some(k => k.trim() && t.includes(norm(k.trim())))) return pick(value);
  }
  return table['*'] ? pick(table['*']) : null;
}

const QUIET_MS = 30 * 60 * 1000;
let client = null;
let channelId = null;
let lastPost = 0;

function init({ token, channel }) {
  if (!token || !channel) return;
  channelId = channel;
  client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
  client.once('clientReady', () => {
    log('DISCORD', `online as ${client.user.tag}`);
    client.user.setActivity('SQRRR VGM', { type: ActivityType.Playing });
  });
  client.on('messageCreate', message => {
    if (message.author.bot || !message.mentions.has(client.user)) return;
    const text = message.content.replace(/<@!?\d+>/g, ' ').trim();
    const answer = replyFor(text);
    if (!answer) return;
    message.reply(answer).catch(e => warn('DISCORD', 'reply failed', e.message));
    log('DISCORD', `${message.author.username}: ${text} -> ${answer}`);
  });
  client.on('error', e => warn('DISCORD', e.message));
  client.login(token).catch(e => warn('DISCORD', 'login failed', e.message));
}

async function announce(text) {
  if (!client || !client.isReady()) return;
  if (Date.now() - lastPost < QUIET_MS) return;
  lastPost = Date.now();
  try {
    const ch = await client.channels.fetch(channelId);
    await ch.send(text);
    log('DISCORD', `posted: ${text}`);
  } catch (e) {
    warn('DISCORD', 'send failed', e.message);
  }
}

module.exports = { init, announce, replyFor };
