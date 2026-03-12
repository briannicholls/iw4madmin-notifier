import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateNotifyPolicy, remainingGlobalCooldownMs } from '../src/notify-policy.js';

test('evaluateNotifyPolicy suppresses when notifier missing', () => {
  const decision = evaluateNotifyPolicy({
    hasNotifier: false,
    inFlight: false,
    cooldownRemainingMs: 0
  });
  assert.equal(decision.action, 'suppress');
  assert.equal(decision.reason, 'missing_notifier');
});

test('evaluateNotifyPolicy suppresses when cooldown active', () => {
  const decision = evaluateNotifyPolicy({
    hasNotifier: true,
    inFlight: false,
    cooldownRemainingMs: 20_000
  });
  assert.equal(decision.action, 'suppress');
  assert.equal(decision.reason, 'cooldown');
  assert.equal(decision.remainingMs, 20_000);
});

test('remainingGlobalCooldownMs returns zero when cooldown elapsed', () => {
  const now = Date.now();
  const remainingMs = remainingGlobalCooldownMs(now - (61 * 60 * 1000), now);
  assert.equal(remainingMs, 0);
});
