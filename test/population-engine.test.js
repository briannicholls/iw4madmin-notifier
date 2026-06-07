import test from 'node:test';
import assert from 'node:assert/strict';

import { LOW_POPULATION_GRACE_MS } from '../src/config.js';
import { evaluatePopulation } from '../src/population-engine.js';
import { createRuntimeState } from '../src/plugin-state.js';

function createPluginFixture() {
  const upserts = [];
  const deletes = [];
  const logs = [];
  return {
    upserts,
    deletes,
    plugin: {
      name: 'Population Notifier',
      config: {
        alerts: [
          { threshold: 1, message: '{serverName} active' },
          { threshold: 6, message: '{serverName} busy' }
        ]
      },
      runtime: createRuntimeState(),
      logger: {
        logInformation: (...args) => logs.push(['info', ...args]),
        logWarning: (...args) => logs.push(['warn', ...args])
      },
      pluginHelper: {
        requestNotifyAfterDelay: () => { }
      },
      dispatcher: {
        count: 1,
        upsertMessage: (_plugin, _existingId, _payload, _meta, done) => {
          const messageId = 'notify-' + String(upserts.length + 1);
          upserts.push(messageId);
          done(true, messageId, '', { statusCode: 200 });
        },
        deleteMessage: (_plugin, messageId, _meta, done) => {
          deletes.push(messageId);
          done(true, '', { statusCode: 204 });
        }
      }
    }
  };
}

test('evaluatePopulation keeps threshold state during transient low-population grace', () => {
  const fixture = createPluginFixture();
  const plugin = fixture.plugin;

  evaluatePopulation(plugin, 's1', 'Server 1', 7, { source: 'test', nowMs: 1000 });
  evaluatePopulation(plugin, 's1', 'Server 1', 0, { source: 'match_load', nowMs: 2000 });

  const heldState = plugin.runtime.populationStateByServer.s1;
  assert.equal(heldState.lastCount, 7);
  assert.equal(heldState.firedByThreshold['6'], true);
  assert.equal(heldState.lowPopulationSinceMs, 2000);
  assert.deepEqual(fixture.deletes, []);

  evaluatePopulation(plugin, 's1', 'Server 1', 7, { source: 'match_loaded', nowMs: 3000 });

  const recoveredState = plugin.runtime.populationStateByServer.s1;
  assert.equal(recoveredState.lastCount, 7);
  assert.equal(recoveredState.lowPopulationSinceMs, 0);
  assert.deepEqual(fixture.upserts, ['notify-1']);
  assert.deepEqual(fixture.deletes, []);
  assert.equal(plugin.runtime.notifyMessageIdByServer.s1, 'notify-1');
});

test('evaluatePopulation expires low-population grace before reset and notify cleanup', () => {
  const fixture = createPluginFixture();
  const plugin = fixture.plugin;

  evaluatePopulation(plugin, 's1', 'Server 1', 7, { source: 'test', nowMs: 1000 });
  evaluatePopulation(plugin, 's1', 'Server 1', 0, { source: 'match_load', nowMs: 2000 });
  evaluatePopulation(plugin, 's1', 'Server 1', 0, { source: 'match_load', nowMs: 2000 + LOW_POPULATION_GRACE_MS });

  const state = plugin.runtime.populationStateByServer.s1;
  assert.equal(state.lastCount, 0);
  assert.equal(state.lowPopulationSinceMs, 0);
  assert.equal(state.firedByThreshold['1'], false);
  assert.equal(state.firedByThreshold['6'], false);
  assert.deepEqual(fixture.deletes, ['notify-1']);
  assert.equal(plugin.runtime.notifyMessageIdByServer.s1, undefined);
  assert.equal(plugin.runtime.notifyThresholdByServer.s1, undefined);
});
