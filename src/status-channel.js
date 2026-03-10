import { MAX_PLAYERS, resolveMapImageUrl } from './config.js';
import { parseIntSafe } from './utils.js';
import { pickCleanString } from './server-metadata.js';
import { resolveT6ThumbnailUrl } from './t6-thumbnails.js';

function statusColor(plugin, playerCount) {
  const count = parseIntSafe(playerCount, 0);
  const alerts = plugin.config && plugin.config.alerts ? plugin.config.alerts : [];

  let highestThreshold = 0;
  for (let i = 0; i < alerts.length; i++) {
    const threshold = parseIntSafe(alerts[i].threshold, 0);
    if (count >= threshold && threshold > highestThreshold) highestThreshold = threshold;
  }

  if (highestThreshold >= 11) return 15158332;
  if (highestThreshold >= 6) return 15844367;
  if (highestThreshold >= 1) return 3066993;
  return 3447003;
}

export function buildStatusPayload(plugin, serverName, playerCount, mapInfo, modeInfo) {
  const mapReadable = pickCleanString([mapInfo && mapInfo.readable]);
  const mapSlug = pickCleanString([mapInfo && mapInfo.slug]);
  const modeReadable = pickCleanString([modeInfo && modeInfo.readable]);

  const mapText = mapReadable || 'unknown';
  const modeText = modeReadable || 'unknown';
  const imageLookupName = mapSlug || mapReadable;
  const imageUrl = resolveMapImageUrl(plugin.config && plugin.config.mapImageUrls, imageLookupName)
    || resolveT6ThumbnailUrl(plugin.config && plugin.config.thumbnailBaseUrl, mapSlug, mapReadable);

  const embed = {
    title: serverName,
    description:
      'Players: **' + playerCount + '/' + MAX_PLAYERS + '**\n'
      + 'Map: ' + mapText + '\n'
      + 'Mode: ' + modeText,
    color: statusColor(plugin, playerCount)
  };

  if (imageUrl) {
    embed.image = { url: imageUrl };
  }

  return {
    content: '',
    embeds: [embed],
    allowed_mentions: { parse: [] }
  };
}

export function ensureStatusSyncState(plugin, serverKey) {
  let sync = plugin.runtime.statusSyncByServer[serverKey];
  if (!sync) {
    sync = {
      inFlight: false,
      pending: null
    };
    plugin.runtime.statusSyncByServer[serverKey] = sync;
  }

  return sync;
}

export function dispatchStatusUpsert(plugin, serverKey, update) {
  const sync = ensureStatusSyncState(plugin, serverKey);
  sync.inFlight = true;

  const existingMessageId = plugin.runtime.statusMessageIdByServer[serverKey] || '';

  plugin.dispatcher.upsertMessage(
    plugin,
    existingMessageId,
    update.payload,
    { type: 'status', serverKey: serverKey },
    (ok, messageId, errorText, details) => {
      sync.inFlight = false;

      if (!ok) {
        const retryAfterMs = Math.max(1000, parseIntSafe(details && details.retryAfterMs, 5000));
        plugin.runtime.statusRetryAtByServer[serverKey] = Date.now() + retryAfterMs;

        plugin.logger.logWarning('{Name}: Failed to upsert status message for {Server} - {Error} (retry_ms={RetryMs})',
          plugin.name,
          serverKey,
          String(errorText || 'unknown upsert error'),
          retryAfterMs);

        if (plugin.pluginHelper && typeof plugin.pluginHelper.requestNotifyAfterDelay === 'function') {
          plugin.pluginHelper.requestNotifyAfterDelay(retryAfterMs, () => {
            ensureStatusMessage(plugin, serverKey, update.serverName, update.playerCount, update.mapInfo, update.modeInfo);
          });
        }
      } else {
        plugin.runtime.statusRetryAtByServer[serverKey] = 0;

        if (messageId) {
          plugin.runtime.statusMessageIdByServer[serverKey] = String(messageId);
        }

        plugin.runtime.statusFingerprintByServer[serverKey] = update.fingerprint;
      }

      const pending = sync.pending;
      sync.pending = null;
      if (pending) {
        ensureStatusMessage(
          plugin,
          serverKey,
          pending.serverName,
          pending.playerCount,
          pending.mapInfo,
          pending.modeInfo
        );
      }
    }
  );
}

export function ensureStatusMessage(plugin, serverKey, serverName, playerCount, mapInfo, modeInfo) {
  if (!plugin.dispatcher || plugin.dispatcher.count === 0) return;

  const existingMessageId = plugin.runtime.statusMessageIdByServer[serverKey] || '';
  if (!existingMessageId && playerCount <= 0) {
    return;
  }

  const payload = buildStatusPayload(plugin, serverName, playerCount, mapInfo, modeInfo);
  const fingerprint = JSON.stringify(payload);
  const existingFingerprint = plugin.runtime.statusFingerprintByServer[serverKey] || '';

  if (existingMessageId && existingFingerprint === fingerprint) {
    return;
  }

  const update = {
    serverName: serverName,
    playerCount: playerCount,
    mapInfo: mapInfo,
    modeInfo: modeInfo,
    payload: payload,
    fingerprint: fingerprint
  };

  const sync = ensureStatusSyncState(plugin, serverKey);
  if (sync.inFlight) {
    sync.pending = update;
    return;
  }

  const nowMs = Date.now();
  const retryAtMs = parseIntSafe(plugin.runtime.statusRetryAtByServer[serverKey], 0);
  if (retryAtMs > nowMs) {
    sync.pending = update;
    return;
  }

  dispatchStatusUpsert(plugin, serverKey, update);
}
