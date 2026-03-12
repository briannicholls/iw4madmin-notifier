import {
  NOTIFY_CLEAR_BELOW_COUNT
} from './config.js';
import { parseIntSafe } from './utils.js';
import { evaluateNotifyPolicy, remainingGlobalCooldownMs } from './notify-policy.js';
import { dispatchNotifyDeleteWithRetry, sendNotifyMessageWithRetry } from './app/services/notify-dispatch.js';

function notifyCooldownKey(serverKey, threshold) {
  return String(serverKey) + ':' + String(parseIntSafe(threshold, 0));
}

export function canSendNotifyForThreshold(plugin, serverKey, threshold) {
  const key = notifyCooldownKey(serverKey, threshold);
  const lastAtMs = parseIntSafe(plugin.runtime.notifyLastAtMsByKey[key], 0);
  const remainingMs = remainingGlobalCooldownMs(lastAtMs, Date.now());
  if (remainingMs <= 0) {
    return {
      allowed: true,
      key: key,
      remainingMs: 0
    };
  }

  return {
    allowed: false,
    key: key,
    remainingMs: remainingMs
  };
}

export function setNotifyNowForThreshold(plugin, serverKey, threshold) {
  const key = notifyCooldownKey(serverKey, threshold);
  plugin.runtime.notifyLastAtMsByKey[key] = Date.now();
}

export function remainingCooldownMinutesForThreshold(plugin, serverKey, threshold) {
  const cooldown = canSendNotifyForThreshold(plugin, serverKey, threshold);
  if (cooldown.allowed) return 0;
  return Math.ceil(cooldown.remainingMs / 60000);
}

export function maybeDeleteNotifyForLowPopulation(plugin, serverKey, playerCount, source) {
  if (playerCount >= NOTIFY_CLEAR_BELOW_COUNT) return;

  const messageId = plugin.runtime.notifyMessageIdByServer[serverKey] || '';
  if (!messageId) {
    delete plugin.runtime.notifyThresholdByServer[serverKey];
    return;
  }

  if (plugin.runtime.notifyDeleteInFlightByServer[serverKey]) return;
  plugin.runtime.notifyDeleteInFlightByServer[serverKey] = true;

  if (!plugin.dispatcher || plugin.dispatcher.count === 0) {
    plugin.runtime.notifyDeleteInFlightByServer[serverKey] = false;
    return;
  }

  plugin.logger.logInformation('{Name}: Population below {Minimum} on {Server} (count={Count}, source={Source}); deleting active notify message',
    plugin.name,
    NOTIFY_CLEAR_BELOW_COUNT,
    serverKey,
    playerCount,
    String(source || 'unknown'));

  dispatchNotifyDeleteWithRetry(plugin, serverKey, messageId, source, 1);
}

export function handleThresholdCrossing(plugin, alert, serverKey, serverName, playerCount, isStartup, source) {
  const thresholdValue = parseIntSafe(alert && alert.threshold, 0);
  const previousThresholdValue = parseIntSafe(plugin.runtime.notifyThresholdByServer[serverKey], 0);
  const previousMessageId = plugin.runtime.notifyMessageIdByServer[serverKey] || '';
  const shouldReplacePreviousMessage = thresholdValue > previousThresholdValue && !!previousMessageId;
  const hasNotifier = !!(plugin.dispatcher && plugin.dispatcher.count > 0);
  const cooldown = canSendNotifyForThreshold(plugin, serverKey, thresholdValue);
  const policy = evaluateNotifyPolicy({
    hasNotifier: hasNotifier,
    inFlight: plugin.runtime.globalNotifyDispatchInFlight === true,
    cooldownRemainingMs: cooldown.remainingMs
  });

  if (policy.action !== 'send') {
    if (policy.reason === 'missing_notifier') {
      if (!plugin.runtime.missingNotifierWarned) {
        plugin.logger.logWarning('{Name}: Alert suppressed because no notifier destination is configured.', plugin.name);
        plugin.runtime.missingNotifierWarned = true;
      }
      return;
    }

    if (policy.reason === 'in_flight') {
      plugin.logger.logInformation('{Name}: Notify suppressed because another notify dispatch is currently in-flight server={Server} threshold={Threshold} source={Source}',
        plugin.name,
        serverKey,
        thresholdValue,
        String(source || 'unknown'));
      return;
    }

    if (policy.reason === 'cooldown') {
      const remainingMinutes = Math.ceil(policy.remainingMs / 60000);
      plugin.logger.logInformation('{Name}: Notify suppressed by threshold cooldown server={Server} threshold={Threshold} remaining_minutes={Remaining} source={Source}',
        plugin.name,
        serverKey,
        thresholdValue,
        remainingMinutes,
        String(source || 'unknown'));
    }
    return;
  }

  plugin.runtime.globalNotifyDispatchInFlight = true;

  sendNotifyMessageWithRetry(plugin, alert, serverKey, serverName, playerCount, isStartup, source, (ok, sentMessageId) => {
    if (ok) {
      setNotifyNowForThreshold(plugin, serverKey, thresholdValue);
      plugin.runtime.notifyThresholdByServer[serverKey] = thresholdValue;

      if (shouldReplacePreviousMessage && sentMessageId && previousMessageId && sentMessageId !== previousMessageId) {
        if (!plugin.runtime.notifyDeleteInFlightByServer[serverKey]) {
          plugin.runtime.notifyDeleteInFlightByServer[serverKey] = true;
          dispatchNotifyDeleteWithRetry(plugin, serverKey, previousMessageId, source, 1);
        }
      }
    }
    plugin.runtime.globalNotifyDispatchInFlight = false;
  }, 1, { forceCreate: shouldReplacePreviousMessage });
}
