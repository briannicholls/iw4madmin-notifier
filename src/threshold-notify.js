import {
  GLOBAL_NOTIFY_COOLDOWN_MS,
  NOTIFY_CLEAR_BELOW_COUNT,
  NOTIFY_MENTION_PREFIX,
  buildMessageContext,
  formatPopulationMessage
} from './config.js';
import { parseIntSafe } from './utils.js';

export function canSendGlobalNotify(plugin) {
  const nowMs = Date.now();
  const lastAtMs = parseIntSafe(plugin.runtime.globalNotifyLastAtMs, 0);
  if (lastAtMs <= 0) {
    return {
      allowed: true,
      remainingMs: 0
    };
  }

  const elapsedMs = nowMs - lastAtMs;
  const remainingMs = GLOBAL_NOTIFY_COOLDOWN_MS - elapsedMs;
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

  plugin.dispatcher.deleteMessage(plugin, messageId, { type: 'notify', serverKey: serverKey }, (ok, errorText) => {
    plugin.runtime.notifyDeleteInFlightByServer[serverKey] = false;

    if (!ok) {
      plugin.logger.logWarning('{Name}: Failed to delete active notify message for {Server} - {Error}',
        plugin.name,
        serverKey,
        String(errorText || 'unknown delete error'));
      return;
    }

    delete plugin.runtime.notifyMessageIdByServer[serverKey];
  });
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

function sendNotifyMessage(plugin, alert, serverKey, serverName, playerCount, isStartup, source, done) {
  const payload = buildNotifyPayload(alert, serverKey, serverName, playerCount);
  const existingMessageId = plugin.runtime.notifyMessageIdByServer[serverKey] || '';

  plugin.logger.logInformation('{Name}: Dispatching notify message server={Server} threshold={Threshold} startup={Startup} source={Source} existing_message_id={ExistingId}',
    plugin.name,
    serverKey,
    parseIntSafe(alert.threshold, 0),
    isStartup === true ? 'yes' : 'no',
    String(source || 'unknown'),
    existingMessageId || '(none)');

  plugin.dispatcher.upsertMessage(
    plugin,
    existingMessageId,
    payload,
    { type: 'notify', serverKey: serverKey },
    (ok, messageId, errorText) => {
      if (!ok) {
        plugin.logger.logWarning('{Name}: Failed to dispatch notify message for {Server} - {Error}',
          plugin.name,
          serverKey,
          String(errorText || 'unknown notify error'));
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
  if (!plugin.dispatcher || plugin.dispatcher.count === 0) {
    if (!plugin.runtime.missingNotifierWarned) {
      plugin.logger.logWarning('{Name}: Alert suppressed because no notifier destination is configured.', plugin.name);
      plugin.runtime.missingNotifierWarned = true;
    }
    return;
  }

  if (plugin.runtime.globalNotifyDispatchInFlight) {
    plugin.logger.logInformation('{Name}: Notify suppressed because another notify dispatch is currently in-flight server={Server} threshold={Threshold} source={Source}',
      plugin.name,
      serverKey,
      parseIntSafe(alert.threshold, 0),
      String(source || 'unknown'));
    return;
  }

  const cooldown = canSendGlobalNotify(plugin);
  if (!cooldown.allowed) {
    const remainingMinutes = Math.ceil(cooldown.remainingMs / 60000);
    plugin.logger.logInformation('{Name}: Notify suppressed by global cooldown server={Server} threshold={Threshold} remaining_minutes={Remaining} source={Source}',
      plugin.name,
      serverKey,
      parseIntSafe(alert.threshold, 0),
      remainingMinutes,
      String(source || 'unknown'));
    return;
  }

  plugin.runtime.globalNotifyDispatchInFlight = true;
  setGlobalNotifyNow(plugin);

  sendNotifyMessage(plugin, alert, serverKey, serverName, playerCount, isStartup, source, () => {
    plugin.runtime.globalNotifyDispatchInFlight = false;
  });
}
