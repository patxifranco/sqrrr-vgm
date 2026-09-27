const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { log, warn } = require('./utils');

const QUIET_MS = 30 * 60 * 1000;
let client = null;
let channelId = null;
let lastPost = 0;

function init({ token, channel }) {
  if (!token || !channel) return;
  channelId = channel;
  client = new Client({ intents: [GatewayIntentBits.Guilds] });
  client.once('clientReady', () => {
    log('DISCORD', `online as ${client.user.tag}`);
    client.user.setActivity('SQRRR VGM', { type: ActivityType.Playing });
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

module.exports = { init, announce };
