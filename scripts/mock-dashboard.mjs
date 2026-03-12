import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_ALERTS_FOR_RENDERING, mapFilenameToSlug, MOCK_MAX_PLAYERS } from './mock-dashboard.shared.mjs';
import { buildDashboardPayload } from '../src/dashboard-renderer.js';

const MAX_EMBEDS = 10;
const BASE_THUMBNAIL_URL = 'https://iw4m.s3.us-east-2.amazonaws.com';

const MAPS = [
  { readable: 'Aftermath', file: 'loadscreen_mp_la.jpg' },
  { readable: 'Raid', file: 'loadscreen_mp_raid.jpg' },
  { readable: 'Hijacked', file: 'loadscreen_mp_hijacked.jpg' },
  { readable: 'Slums', file: 'loadscreen_mp_slums.jpg' },
  { readable: 'Express', file: 'loadscreen_mp_express.jpg' },
  { readable: 'Standoff', file: 'loadscreen_mp_village.jpg' },
  { readable: 'Carrier', file: 'loadscreen_mp_carrier.jpg' }
];

const MODES = ['Team Deathmatch', 'Domination', 'Hardpoint', 'Search & Destroy', 'Kill Confirmed'];

function stripQuotes(value) {
  const text = String(value == null ? '' : value).trim();
  if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1);
  if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1);
  return text;
}

function loadDotEnvFromWorkspaceRoot() {
  const envPath = resolve(import.meta.dirname, '..', '.env');
  if (!existsSync(envPath)) return;

  const raw = readFileSync(envPath, 'utf8');
  const lines = String(raw || '').split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = String(lines[i] || '').trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const eqIndex = normalized.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = normalized.slice(0, eqIndex).trim();
    if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) continue;

    const value = stripQuotes(normalized.slice(eqIndex + 1));
    process.env[key] = value;
  }
}

function parseArgs(argv) {
  const args = {
    servers: 14,
    send: false
  };

  for (let i = 0; i < argv.length; i++) {
    const token = String(argv[i] || '');
    if (token === '--send') {
      args.send = true;
      continue;
    }
    if (token === '--servers') {
      const next = parseInt(String(argv[i + 1] || ''), 10);
      if (Number.isFinite(next) && next > 0) {
        args.servers = next;
        i++;
      }
    }
  }

  return args;
}

function pseudoRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return function next() {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function buildMockSnapshots(serverCount) {
  const rand = pseudoRandom(360);
  const snapshots = [];

  for (let i = 0; i < serverCount; i++) {
    const map = MAPS[Math.floor(rand() * MAPS.length)];
    const mode = MODES[Math.floor(rand() * MODES.length)];
    const playerCount = Math.floor(rand() * (MOCK_MAX_PLAYERS + 1));
    const serverNumber = String(i + 1).padStart(2, '0');

    snapshots.push({
      serverKey: 'server_' + serverNumber,
      serverName: 'BlackOpsPublic #' + serverNumber,
      playerCount: playerCount,
      mapInfo: {
        readable: map.readable,
        slug: mapFilenameToSlug(map.file)
      },
      modeInfo: {
        readable: mode,
        slug: ''
      },
      imageUrl: BASE_THUMBNAIL_URL + '/' + map.file
    });
  }

  snapshots.sort(function (left, right) {
    if (left.playerCount !== right.playerCount) return right.playerCount - left.playerCount;
    return left.serverKey.localeCompare(right.serverKey);
  });

  return snapshots.slice(0, MAX_EMBEDS);
}

function buildPayload(serverCount) {
  const snapshots = buildMockSnapshots(serverCount);
  const snapshotsByServer = {};
  for (let i = 0; i < snapshots.length; i++) {
    snapshotsByServer[snapshots[i].serverKey] = snapshots[i];
  }
  return buildDashboardPayload(DEFAULT_ALERTS_FOR_RENDERING, snapshotsByServer);
}

async function postToDiscord(payload) {
  const token = String(process.env.DISCORD_BOT_TOKEN || '').trim();
  const channelId = String(process.env.DISCORD_CHANNEL_ID || '').trim();

  if (!token || !channelId) {
    throw new Error('Missing DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID.');
  }

  const url = 'https://discord.com/api/v10/channels/' + channelId + '/messages';
  const authValue = token.indexOf('Bot ') === 0 ? token : ('Bot ' + token);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authValue,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error('Discord API failed (' + response.status + '): ' + responseText);
  }

  let parsed = {};
  try {
    parsed = JSON.parse(responseText);
  } catch (_) { }

  return {
    id: parsed && parsed.id ? String(parsed.id) : '(unknown)',
    status: response.status
  };
}

async function main() {
  loadDotEnvFromWorkspaceRoot();
  const args = parseArgs(process.argv.slice(2));
  const payload = buildPayload(args.servers);

  if (!args.send) {
    console.log('Generated mock dashboard payload (dry run).');
    console.log('Pass --send to post it to Discord.');
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  const result = await postToDiscord(payload);
  console.log('Mock dashboard message posted.');
  console.log('message_id=' + result.id + ' status=' + result.status);
}

main().catch((error) => {
  const message = error && error.message ? error.message : String(error);
  console.error('mock-dashboard failed:', message);
  process.exit(1);
});
