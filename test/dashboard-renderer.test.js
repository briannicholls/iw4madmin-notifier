import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDashboardPayload, MAX_DASHBOARD_EMBEDS } from '../src/dashboard-renderer.js';

const S3_LOGO_BASE_URL = 'https://iw4m.s3.us-east-2.amazonaws.com/game-logos';

function makeSnapshot(index, playerCount, gameInfo) {
  return {
    serverName: 'Server ' + index,
    playerCount: playerCount,
    gameInfo: gameInfo || { readable: 'Call of Duty: Black Ops 2', slug: 'T6' },
    mapInfo: { readable: 'Raid', slug: 'mp_raid' },
    modeInfo: { readable: 'TDM', slug: 'tdm' }
  };
}

function makeRenderOptions(overrides) {
  return Object.assign({
    onlineEmoji: ':online_ping:',
    offlineEmoji: ':offline_ping:'
  }, overrides || {});
}

test('buildDashboardPayload groups servers by game with compact server lines', () => {
  const byServer = {};
  byServer.t6a = makeSnapshot('T6 A', 7, { readable: 'Call of Duty: Black Ops 2', slug: 'T6' });
  byServer.t6b = makeSnapshot('T6 B', 3, { readable: 'Call of Duty: Black Ops 2', slug: 'T6' });
  byServer.t5a = makeSnapshot('T5 A', 5, { readable: 'Call of Duty: Black Ops', slug: 'T5' });

  const payload = buildDashboardPayload([{ threshold: 1 }, { threshold: 6 }, { threshold: 11 }], byServer, makeRenderOptions());
  assert.equal(payload.embeds.length, 2);
  assert.equal(payload.embeds[0].title, 'Call of Duty: Black Ops 2');
  assert.match(payload.embeds[0].description, /\*\*2 servers\*\*\n`10\/36 players`/);
  assert.match(payload.embeds[0].description, /:online_ping: \*\*Server T6 A\*\*  `7\/18`\n\*Raid\*\nTDM/);
  assert.doesNotMatch(payload.embeds[0].description, /mp_raid/);
  assert.doesNotMatch(payload.embeds[0].description, /\| Map:|\| Mode:/);
  assert.match(payload.embeds[0].description, /:online_ping: \*\*Server T6 B\*\*  `3\/18`/);
  assert.deepEqual(payload.embeds[0].thumbnail, { url: S3_LOGO_BASE_URL + '/Black%20Ops%202%20Logo.png' });
  assert.equal(payload.embeds[1].title, 'Call of Duty: Black Ops');
});

test('buildDashboardPayload falls back to map slug and marks empty servers offline', () => {
  const byServer = {
    s1: {
      serverName: 'Server Empty',
      playerCount: 0,
      gameInfo: { readable: 'Call of Duty: Black Ops', slug: 'T5' },
      mapInfo: { readable: '', slug: 'zombie_theater' },
      modeInfo: { readable: 'Zombies', slug: '' }
    }
  };

  const payload = buildDashboardPayload([{ threshold: 1 }], byServer, makeRenderOptions());
  assert.match(payload.embeds[0].description, /:offline_ping: \*\*Server Empty\*\*  `0\/18`\n\*zombie_theater\*\nZombies/);
  assert.deepEqual(payload.embeds[0].thumbnail, { url: S3_LOGO_BASE_URL + '/Black%20Ops%201%20Logo.png' });
});

test('buildDashboardPayload resolves HMW logo from S3', () => {
  const byServer = {
    hmw: makeSnapshot('HMW', 1, { readable: 'HMW', slug: 'HMW' })
  };

  const payload = buildDashboardPayload([{ threshold: 1 }], byServer, makeRenderOptions());
  assert.deepEqual(payload.embeds[0].thumbnail, { url: S3_LOGO_BASE_URL + '/HMW%20Logo.png' });
});

test('buildDashboardPayload limits game embeds by busiest groups', () => {
  const byServer = {};
  for (let i = 0; i < 14; i++) {
    byServer['s' + i] = makeSnapshot(i, i, { readable: 'Game ' + i, slug: 'G' + i });
  }

  const payload = buildDashboardPayload([{ threshold: 1 }], byServer, makeRenderOptions());
  assert.equal(payload.embeds.length, MAX_DASHBOARD_EMBEDS);
  assert.equal(payload.embeds[0].title, 'Game 13');
  assert.equal(payload.embeds[payload.embeds.length - 1].title, 'Game 4');
  assert.match(payload.embeds[payload.embeds.length - 1].description, /4 more game groups not shown/);
});

test('buildDashboardPayload truncates oversized game groups with overflow note', () => {
  const byServer = {};
  for (let i = 0; i < 80; i++) {
    const snapshot = makeSnapshot(i, i % 18);
    snapshot.serverName = 'Very Long Server Name ' + String(i).padStart(2, '0') + ' '.repeat(80);
    byServer['s' + i] = snapshot;
  }

  const payload = buildDashboardPayload([{ threshold: 1 }], byServer, makeRenderOptions());
  assert.equal(payload.embeds.length, 1);
  assert.ok(payload.embeds[0].description.length <= 3900);
  assert.match(payload.embeds[0].description, /more servers not shown/);
});

test('buildDashboardPayload returns empty-state card for no servers', () => {
  const payload = buildDashboardPayload([{ threshold: 1 }], {}, makeRenderOptions());
  assert.equal(payload.embeds.length, 1);
  assert.equal(payload.embeds[0].title, 'Server Population');
  assert.equal(payload.embeds[0].description, 'No server data available yet.');
});

test('buildDashboardPayload allows Discord custom emoji tokens for status', () => {
  const byServer = {
    s1: makeSnapshot('One', 1),
    s2: makeSnapshot('Zero', 0)
  };

  const payload = buildDashboardPayload(
    [{ threshold: 1 }],
    byServer,
    makeRenderOptions({
      onlineEmoji: '<:online_ping:123456789012345678>',
      offlineEmoji: '<:offline_ping:987654321098765432>'
    })
  );

  assert.match(payload.embeds[0].description, /<:online_ping:123456789012345678>/);
  assert.match(payload.embeds[0].description, /<:offline_ping:987654321098765432>/);
});

test('buildDashboardPayload renders mode readable name without slug suffix', () => {
  const byServer = {
    s1: {
      serverName: 'Mode Test',
      playerCount: 1,
      gameInfo: { readable: 'Call of Duty: Black Ops', slug: 'T5' },
      mapInfo: { readable: 'Safehouse', slug: 'mp_safehouse' },
      modeInfo: { readable: 'Free For All', slug: 'dm' }
    }
  };

  const payload = buildDashboardPayload([{ threshold: 1 }], byServer, makeRenderOptions());
  assert.match(payload.embeds[0].description, /Free For All/);
  assert.doesNotMatch(payload.embeds[0].description, /`dm`|\(dm\)/);
});
