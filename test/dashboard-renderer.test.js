import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDashboardPayload, MAX_DASHBOARD_EMBEDS } from '../src/dashboard-renderer.js';

function makeSnapshot(index, playerCount) {
  return {
    serverName: 'Server ' + index,
    playerCount: playerCount,
    mapInfo: { readable: 'Raid', slug: 'mp_raid' },
    modeInfo: { readable: 'TDM', slug: 'tdm' }
  };
}

test('buildDashboardPayload limits embeds and sorts by players desc', () => {
  const byServer = {};
  for (let i = 0; i < 14; i++) {
    byServer['s' + i] = makeSnapshot(i, i);
  }

  const payload = buildDashboardPayload([{ threshold: 1 }, { threshold: 6 }, { threshold: 11 }], byServer);
  assert.equal(payload.embeds.length, MAX_DASHBOARD_EMBEDS);
  assert.equal(payload.embeds[0].title, 'Server 13');
  assert.match(payload.embeds[0].description, /\*\*Players:\*\* 13\/18/);
});

test('buildDashboardPayload returns empty-state card for no servers', () => {
  const payload = buildDashboardPayload([{ threshold: 1 }], {});
  assert.equal(payload.embeds.length, 1);
  assert.equal(payload.embeds[0].title, 'Server Population');
  assert.equal(payload.embeds[0].description, 'No server data available yet.');
});
