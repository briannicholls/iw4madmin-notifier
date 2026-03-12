import test from 'node:test';
import assert from 'node:assert/strict';

import { handleThresholdCrossing, maybeDeleteNotifyForLowPopulation } from '../src/threshold-notify.js';

function createPluginFixture() {
  const delayed = [];
  const logs = [];
  return {
    delayed,
    plugin: {
      name: 'Population Notifier',
      config: {},
      runtime: {
        notifyMessageIdByServer: {},
        notifyThresholdByServer: {},
        notifyLastAtMsByKey: {},
        notifyDeleteInFlightByServer: {},
        globalNotifyDispatchInFlight: false,
        missingNotifierWarned: false
      },
      logger: {
        logInformation: (...args) => logs.push(['info', ...args]),
        logWarning: (...args) => logs.push(['warn', ...args])
      },
      pluginHelper: {
        requestNotifyAfterDelay: (_ms, fn) => delayed.push(fn)
      },
      dispatcher: {
        count: 1,
        upsertMessage: () => { },
        deleteMessage: () => { }
      }
    }
  };
}

test('handleThresholdCrossing sets cooldown only after successful retry', async () => {
  const fixture = createPluginFixture();
  let attempts = 0;
  fixture.plugin.dispatcher.upsertMessage = (_plugin, _existingId, _payload, _meta, done) => {
    attempts += 1;
    if (attempts === 1) {
      done(false, '', 'rate limited', { retryAfterMs: 1, isRateLimited: true, statusCode: 429 });
      return;
    }
    done(true, 'message-123', '', { statusCode: 200, retryAfterMs: 0 });
  };

  handleThresholdCrossing(fixture.plugin, { threshold: 6, message: '{serverName} active' }, 's1', 'Server 1', 7, false, 'test');
  assert.equal(fixture.plugin.runtime.notifyLastAtMsByKey['s1:6'] || 0, 0);
  assert.equal(fixture.plugin.runtime.globalNotifyDispatchInFlight, true);
  assert.equal(fixture.delayed.length, 1);

  const retry = fixture.delayed.shift();
  retry();

  assert.equal(attempts, 2);
  assert.equal(fixture.plugin.runtime.globalNotifyDispatchInFlight, false);
  assert.ok(fixture.plugin.runtime.notifyLastAtMsByKey['s1:6'] > 0);
  assert.equal(fixture.plugin.runtime.notifyThresholdByServer.s1, 6);
  assert.equal(fixture.plugin.runtime.notifyMessageIdByServer.s1, 'message-123');
});

test('handleThresholdCrossing enforces cooldown per threshold key', () => {
  const fixture = createPluginFixture();
  let attempts = 0;
  fixture.plugin.dispatcher.upsertMessage = (_plugin, _existingId, _payload, _meta, done) => {
    attempts += 1;
    done(true, 'message-' + attempts, '', { statusCode: 200, retryAfterMs: 0 });
  };

  handleThresholdCrossing(fixture.plugin, { threshold: 6, message: '{serverName} active' }, 's1', 'Server 1', 7, false, 'test');
  handleThresholdCrossing(fixture.plugin, { threshold: 6, message: '{serverName} active' }, 's1', 'Server 1', 7, false, 'test');
  handleThresholdCrossing(fixture.plugin, { threshold: 8, message: '{serverName} very active' }, 's1', 'Server 1', 9, false, 'test');

  assert.equal(attempts, 2);
  assert.ok(fixture.plugin.runtime.notifyLastAtMsByKey['s1:6'] > 0);
  assert.ok(fixture.plugin.runtime.notifyLastAtMsByKey['s1:8'] > 0);
});

test('handleThresholdCrossing replaces lower-threshold message after higher-threshold send', () => {
  const fixture = createPluginFixture();
  const upsertCalls = [];
  const deletedMessageIds = [];

  fixture.plugin.dispatcher.upsertMessage = (_plugin, existingId, _payload, _meta, done) => {
    upsertCalls.push(existingId);
    const nextId = upsertCalls.length === 1 ? 'message-low' : 'message-high';
    done(true, nextId, '', { statusCode: 200, retryAfterMs: 0 });
  };
  fixture.plugin.dispatcher.deleteMessage = (_plugin, messageId, _meta, done) => {
    deletedMessageIds.push(messageId);
    done(true, '', { statusCode: 204 });
  };

  handleThresholdCrossing(fixture.plugin, { threshold: 6, message: '{serverName} active' }, 's1', 'Server 1', 7, false, 'test');
  handleThresholdCrossing(fixture.plugin, { threshold: 8, message: '{serverName} very active' }, 's1', 'Server 1', 9, false, 'test');

  assert.deepEqual(upsertCalls, ['', '']);
  assert.deepEqual(deletedMessageIds, ['message-low']);
  assert.equal(fixture.plugin.runtime.notifyMessageIdByServer.s1, 'message-high');
  assert.equal(fixture.plugin.runtime.notifyThresholdByServer.s1, 8);
});

test('maybeDeleteNotifyForLowPopulation retries then clears tracked notify', () => {
  const fixture = createPluginFixture();
  fixture.plugin.runtime.notifyMessageIdByServer.s1 = 'message-1';
  fixture.plugin.runtime.notifyThresholdByServer.s1 = 6;
  let attempts = 0;
  fixture.plugin.dispatcher.deleteMessage = (_plugin, _messageId, _meta, done) => {
    attempts += 1;
    if (attempts === 1) {
      done(false, 'rate limited', { retryAfterMs: 1, isRateLimited: true, statusCode: 429 });
      return;
    }
    done(true, '', { statusCode: 204 });
  };

  maybeDeleteNotifyForLowPopulation(fixture.plugin, 's1', 2, 'test');
  assert.equal(fixture.plugin.runtime.notifyDeleteInFlightByServer.s1, true);
  assert.equal(fixture.delayed.length, 1);

  const retry = fixture.delayed.shift();
  retry();

  assert.equal(attempts, 2);
  assert.equal(fixture.plugin.runtime.notifyDeleteInFlightByServer.s1, false);
  assert.equal(fixture.plugin.runtime.notifyMessageIdByServer.s1, undefined);
  assert.equal(fixture.plugin.runtime.notifyThresholdByServer.s1, undefined);
});

test('maybeDeleteNotifyForLowPopulation clears tracked threshold even without active message', () => {
  const fixture = createPluginFixture();
  fixture.plugin.runtime.notifyThresholdByServer.s1 = 10;

  maybeDeleteNotifyForLowPopulation(fixture.plugin, 's1', 2, 'test');

  assert.equal(fixture.plugin.runtime.notifyThresholdByServer.s1, undefined);
});

test('handleThresholdCrossing uses configured discordRoleId mention', () => {
  const fixture = createPluginFixture();
  fixture.plugin.config.discordRoleId = '987654321098765432';
  let capturedPayload = null;

  fixture.plugin.dispatcher.upsertMessage = (_plugin, _existingId, payload, _meta, done) => {
    capturedPayload = payload;
    done(true, 'message-role', '', { statusCode: 200 });
  };

  handleThresholdCrossing(
    fixture.plugin,
    { threshold: 6, message: '{serverName} reached {playerCount}/{maxPlayers}' },
    's1',
    'Server 1',
    7,
    false,
    'test'
  );

  assert.ok(capturedPayload);
  assert.match(capturedPayload.content, /^<@&987654321098765432>\s/);
  assert.deepEqual(capturedPayload.allowed_mentions, {
    parse: [],
    roles: ['987654321098765432']
  });
});

test('handleThresholdCrossing falls back to @here mention when discordRoleId is unset', () => {
  const fixture = createPluginFixture();
  fixture.plugin.config.discordRoleId = '';
  let capturedPayload = null;

  fixture.plugin.dispatcher.upsertMessage = (_plugin, _existingId, payload, _meta, done) => {
    capturedPayload = payload;
    done(true, 'message-here', '', { statusCode: 200 });
  };

  handleThresholdCrossing(
    fixture.plugin,
    { threshold: 1, message: '{serverName} is active' },
    's1',
    'Server 1',
    2,
    false,
    'test'
  );

  assert.ok(capturedPayload);
  assert.match(capturedPayload.content, /^@here\s/);
  assert.deepEqual(capturedPayload.allowed_mentions, {
    parse: ['everyone']
  });
});
