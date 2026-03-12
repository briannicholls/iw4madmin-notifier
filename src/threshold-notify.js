import {
  GLOBAL_NOTIFY_COOLDOWN_MS,
  NOTIFY_CLEAR_BELOW_COUNT,
  NOTIFY_MENTION_PREFIX,
  buildMessageContext,
  formatPopulationMessage
} from './config.js';
import { parseIntSafe } from './utils.js';
import { evaluateNotifyPolicy, remainingGlobalCooldownMs } from './notify-policy.js';

const NOTIFY_SEND_MAX_ATTEMPTS = 3;
const NOTIFY_DELETE_MAX_ATTEMPTS = 3;
const DEFAULT_NOTIFY_RETRY_MS = 5000;
const MAX_NOTIFY_RETRY_MS = 60000;

export function canSendGlobalNotify(plugin) {
  const remainingMs = remainingGlobalCooldownMs(plugin.runtime.globalNotifyLastAtMs, Date.now());
  if (remainingMs <= 0) {
    return {
      allowed: true,
      remainingMs: 0
    };
  }

  return {
    allowed: false,
    remainingMs: remainingMs
  };
}

export function setGlobalNotifyNow(plugin) {
  plugin.runtime.globalNotifyLastAtMs = Date.now();
}

export function remainingCooldownMinutes(plugin) {
  const cooldown = canSendGlobalNotify(plugin);
  if (cooldown.allowed) return 0;
  return Math.ceil(cooldown.remainingMs / 60000);
}

export function maybeDeleteNotifyForLowPopulation(plugin, serverKey, playerCount, source) {
  if (playerCount >= NOTIFY_CLEAR_BELOW_COUNT) return;

  const messageId = plugin.runtime.notifyMessageIdByServer[serverKey] || '';
  if (!messageId) return;

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

function buildNotifyPayload(alert, serverKey, serverName, playerCount) {
  const threshold = parseIntSafe(alert.threshold, 0);
  const context = buildMessageContext(serverName, serverKey, playerCount, threshold);
  let sentence = formatPopulationMessage(alert.message, context);
  sentence = String(sentence || '').replace(/\s+/g, ' ').trim();
  if (!sentence) {
    sentence = serverName + ' is filling up.';
  }
  if (!/[.!?]$/.test(sentence)) {
    sentence += '.';
  }

  const content = NOTIFY_MENTION_PREFIX + ' ' + sentence;

  return {
    content: content,
    allowed_mentions: {
      parse: ['everyone']
    }
  };
}

function sendNotifyMessage(plugin, alert, serverKey, serverName, playerCount, isStartup, source, done, attempt) {
  const payload = buildNotifyPayload(alert, serverKey, serverName, playerCount);
  const existingMessageId = plugin.runtime.notifyMessageIdByServer[serverKey] || '';
  const attemptNumber = parseIntSafe(attempt, 1);

  plugin.logger.logInformation('{Name}: Dispatching notify message server={Server} threshold={Threshold} startup={Startup} source={Source} existing_message_id={ExistingId} attempt={Attempt}',
    plugin.name,
    serverKey,
    parseIntSafe(alert.threshold, 0),
    isStartup === true ? 'yes' : 'no',
    String(source || 'unknown'),
    existingMessageId || '(none)',
    attemptNumber);

  plugin.dispatcher.upsertMessage(
    plugin,
    existingMessageId,
    payload,
    { type: 'notify', serverKey: serverKey },
    (ok, messageId, errorText, details) => {
      if (!ok) {
        const retryDelayMs = computeNotifyRetryDelayMs(details, attemptNumber);
        const shouldRetry = retryDelayMs > 0 && attemptNumber < NOTIFY_SEND_MAX_ATTEMPTS;
        plugin.logger.logWarning('{Name}: Failed to dispatch notify message for {Server} - {Error}',
          plugin.name,
          serverKey,
          String(errorText || 'unknown notify error'));

        if (shouldRetry) {
          plugin.logger.logInformation('{Name}: Scheduling notify retry server={Server} attempt={Attempt} retry_ms={RetryMs}',
            plugin.name,
            serverKey,
            attemptNumber + 1,
            retryDelayMs);
          scheduleAfterDelay(plugin, retryDelayMs, function () {
            sendNotifyMessage(plugin, alert, serverKey, serverName, playerCount, isStartup, source, done, attemptNumber + 1);
          });
          return;
        }

        if (typeof done === 'function') done(false);
        return;
      }

      if (messageId) {
        plugin.runtime.notifyMessageIdByServer[serverKey] = String(messageId);
      }

      plugin.logger.logInformation('{Name}: Notify message sent server={Server} threshold={Threshold} cooldown_minutes={CooldownMinutes}',
        plugin.name,
        serverKey,
        parseIntSafe(alert.threshold, 0),
        GLOBAL_NOTIFY_COOLDOWN_MS / 60000);

      if (typeof done === 'function') done(true);
    }
  );
}

export function handleThresholdCrossing(plugin, alert, serverKey, serverName, playerCount, isStartup, source) {
  const hasNotifier = !!(plugin.dispatcher && plugin.dispatcher.count > 0);
  const cooldown = canSendGlobalNotify(plugin);
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
        parseIntSafe(alert.threshold, 0),
        String(source || 'unknown'));
      return;
    }

    if (policy.reason === 'cooldown') {
      const remainingMinutes = Math.ceil(policy.remainingMs / 60000);
      plugin.logger.logInformation('{Name}: Notify suppressed by global cooldown server={Server} threshold={Threshold} remaining_minutes={Remaining} source={Source}',
        plugin.name,
        serverKey,
        parseIntSafe(alert.threshold, 0),
        remainingMinutes,
        String(source || 'unknown'));
    }
    return;
  }

  plugin.runtime.globalNotifyDispatchInFlight = true;

  sendNotifyMessage(plugin, alert, serverKey, serverName, playerCount, isStartup, source, (ok) => {
    if (ok) {
      setGlobalNotifyNow(plugin);
    }
    plugin.runtime.globalNotifyDispatchInFlight = false;
  }, 1);
}

function computeNotifyRetryDelayMs(details, attemptNumber) {
  const retryAfterMs = parseIntSafe(details && details.retryAfterMs, 0);
  if (retryAfterMs > 0) {
    return Math.max(1000, Math.min(MAX_NOTIFY_RETRY_MS, retryAfterMs));
  }

  const statusCode = parseIntSafe(details && details.statusCode, 0);
  const isRateLimited = !!(details && details.isRateLimited);
  if (isRateLimited || statusCode >= 500) {
    const attempt = Math.max(1, parseIntSafe(attemptNumber, 1));
    const backoffMs = DEFAULT_NOTIFY_RETRY_MS * attempt;
    return Math.max(1000, Math.min(MAX_NOTIFY_RETRY_MS, backoffMs));
  }

  return 0;
}

function scheduleAfterDelay(plugin, delayMs, callback) {
  if (plugin.pluginHelper && typeof plugin.pluginHelper.requestNotifyAfterDelay === 'function') {
    plugin.pluginHelper.requestNotifyAfterDelay(delayMs, callback);
    return true;
  }
  return false;
}

function dispatchNotifyDeleteWithRetry(plugin, serverKey, messageId, source, attemptNumber) {
  plugin.dispatcher.deleteMessage(plugin, messageId, { type: 'notify', serverKey: serverKey }, (ok, errorText, details) => {
    if (ok) {
      plugin.runtime.notifyDeleteInFlightByServer[serverKey] = false;
      delete plugin.runtime.notifyMessageIdByServer[serverKey];
      return;
    }

    const retryDelayMs = computeNotifyRetryDelayMs(details, attemptNumber);
    const shouldRetry = retryDelayMs > 0 && attemptNumber < NOTIFY_DELETE_MAX_ATTEMPTS;
    plugin.logger.logWarning('{Name}: Failed to delete active notify message for {Server} - {Error}',
      plugin.name,
      serverKey,
      String(errorText || 'unknown delete error'));

    if (shouldRetry && scheduleAfterDelay(plugin, retryDelayMs, function () {
      dispatchNotifyDeleteWithRetry(plugin, serverKey, messageId, source, attemptNumber + 1);
    })) {
      plugin.logger.logInformation('{Name}: Scheduling notify-delete retry server={Server} attempt={Attempt} retry_ms={RetryMs} source={Source}',
        plugin.name,
        serverKey,
        attemptNumber + 1,
        retryDelayMs,
        String(source || 'unknown'));
      return;
    }

    plugin.runtime.notifyDeleteInFlightByServer[serverKey] = false;
  });
}
