import { GLOBAL_NOTIFY_COOLDOWN_MS } from '../../config.js';
import { parseIntSafe } from '../../utils.js';
import { buildNotifyPayload } from '../../presentation/discord/notify-payload-renderer.js';

const NOTIFY_SEND_MAX_ATTEMPTS = 3;
const NOTIFY_DELETE_MAX_ATTEMPTS = 3;
const DEFAULT_NOTIFY_RETRY_MS = 5000;
const MAX_NOTIFY_RETRY_MS = 60000;

export function computeNotifyRetryDelayMs(details, attemptNumber) {
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

export function scheduleAfterDelay(plugin, delayMs, callback) {
  if (plugin.pluginHelper && typeof plugin.pluginHelper.requestNotifyAfterDelay === 'function') {
    plugin.pluginHelper.requestNotifyAfterDelay(delayMs, callback);
    return true;
  }
  return false;
}

export function sendNotifyMessageWithRetry(plugin, alert, serverKey, serverName, playerCount, isStartup, source, done, attempt, options) {
  const payload = buildNotifyPayload(plugin, alert, serverKey, serverName, playerCount);
  const forceCreate = !!(options && options.forceCreate);
  const existingMessageId = forceCreate ? '' : (plugin.runtime.notifyMessageIdByServer[serverKey] || '');
  const attemptNumber = parseIntSafe(attempt, 1);

  plugin.logger.logInformation('{Name}: Dispatching notify message server={Server} threshold={Threshold} startup={Startup} source={Source} existing_message_id={ExistingId} force_create={ForceCreate} attempt={Attempt}',
    plugin.name,
    serverKey,
    parseIntSafe(alert.threshold, 0),
    isStartup === true ? 'yes' : 'no',
    String(source || 'unknown'),
    existingMessageId || '(none)',
    forceCreate ? 'yes' : 'no',
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
            sendNotifyMessageWithRetry(plugin, alert, serverKey, serverName, playerCount, isStartup, source, done, attemptNumber + 1, options);
          });
          return;
        }

        if (typeof done === 'function') done(false, '');
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

      if (typeof done === 'function') done(true, messageId ? String(messageId) : existingMessageId);
    }
  );
}

export function dispatchNotifyDeleteWithRetry(plugin, serverKey, messageId, source, attemptNumber) {
  plugin.dispatcher.deleteMessage(plugin, messageId, { type: 'notify', serverKey: serverKey }, (ok, errorText, details) => {
    if (ok) {
      plugin.runtime.notifyDeleteInFlightByServer[serverKey] = false;
      const deletedMessageId = String(messageId || '');
      const activeMessageId = String(plugin.runtime.notifyMessageIdByServer[serverKey] || '');
      if (!activeMessageId || activeMessageId === deletedMessageId) {
        delete plugin.runtime.notifyMessageIdByServer[serverKey];
        delete plugin.runtime.notifyThresholdByServer[serverKey];
      }
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
