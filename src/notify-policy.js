import { GLOBAL_NOTIFY_COOLDOWN_MS } from './config.js';
import { parseIntSafe } from './utils.js';

export function evaluateNotifyPolicy(input) {
  const args = input || {};
  if (!args.hasNotifier) {
    return { action: 'suppress', reason: 'missing_notifier', remainingMs: 0 };
  }
  if (args.inFlight) {
    return { action: 'suppress', reason: 'in_flight', remainingMs: 0 };
  }
  const remainingMs = parseIntSafe(args.cooldownRemainingMs, 0);
  if (remainingMs > 0) {
    return { action: 'suppress', reason: 'cooldown', remainingMs: remainingMs };
  }
  return { action: 'send', reason: 'allowed', remainingMs: 0 };
}

export function remainingGlobalCooldownMs(lastAtMs, nowMs) {
  const last = parseIntSafe(lastAtMs, 0);
  if (last <= 0) return 0;
  const elapsedMs = parseIntSafe(nowMs, Date.now()) - last;
  const remainingMs = GLOBAL_NOTIFY_COOLDOWN_MS - elapsedMs;
  return remainingMs > 0 ? remainingMs : 0;
}
