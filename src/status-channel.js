import { MAX_PLAYERS } from './config.js';
import { parseIntSafe } from './utils.js';
import { pickCleanString } from './server-metadata.js';
import { resolveT6ThumbnailUrl } from './t6-thumbnails.js';

const MAX_DASHBOARD_EMBEDS = 10;

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

function getSnapshotCount(snapshot) {
  return parseIntSafe(snapshot && snapshot.playerCount, 0);
}

function sortedServerKeysByPopulation(statusSnapshotByServer) {
  const keys = Object.keys(statusSnapshotByServer || {});
  keys.sort(function (leftKey, rightKey) {
    const leftCount = getSnapshotCount(statusSnapshotByServer[leftKey]);
    const rightCount = getSnapshotCount(statusSnapshotByServer[rightKey]);
    if (leftCount !== rightCount) return rightCount - leftCount;
    return String(leftKey).localeCompare(String(rightKey));
  });
  return keys;
}

function buildServerEmbed(plugin, snapshot) {
  const serverName = String(snapshot && snapshot.serverName ? snapshot.serverName : '(unknown server)');
  const playerCount = getSnapshotCount(snapshot);
  const mapInfo = snapshot && snapshot.mapInfo ? snapshot.mapInfo : null;
  const modeInfo = snapshot && snapshot.modeInfo ? snapshot.modeInfo : null;
  const mapReadable = pickCleanString([mapInfo && mapInfo.readable]);
  const mapSlug = pickCleanString([mapInfo && mapInfo.slug]);
  const modeReadable = pickCleanString([modeInfo && modeInfo.readable]);
  const mapText = mapReadable || 'unknown';
  const modeText = modeReadable || 'unknown';
  const imageUrl = resolveT6ThumbnailUrl(mapSlug, mapReadable);

  const embed = {
    title: serverName + ' (' + playerCount + '/' + MAX_PLAYERS + ')',
    description:
      'Map: ' + mapText + '\n'
      + 'Mode: ' + modeText,
    color: statusColor(plugin, playerCount)
  };

  if (imageUrl) {
    embed.thumbnail = { url: imageUrl };
  }

  return embed;
}

export function buildStatusPayload(plugin, statusSnapshotByServer) {
  const serverKeys = sortedServerKeysByPopulation(statusSnapshotByServer).slice(0, MAX_DASHBOARD_EMBEDS);
  const embeds = [];

  for (let i = 0; i < serverKeys.length; i++) {
    const serverKey = serverKeys[i];
    const snapshot = statusSnapshotByServer[serverKey];
    if (!snapshot) continue;
    embeds.push(buildServerEmbed(plugin, snapshot));
  }

  if (embeds.length === 0) {
    embeds.push({
      title: 'Server Population',
      description: 'No server data available yet.',
      color: 3447003
    });
  }

  return {
    content: '',
    embeds: embeds,
    allowed_mentions: { parse: [] }
  };
}

export function ensureStatusSyncState(plugin) {
  let sync = plugin.runtime.statusDashboardSync;
  if (!sync) {
    sync = {
      inFlight: false,
      pending: null
    };
    plugin.runtime.statusDashboardSync = sync;
  }

  return sync;
}

export function dispatchStatusUpsert(plugin, update) {
  const sync = ensureStatusSyncState(plugin);
  sync.inFlight = true;

  const existingMessageId = plugin.runtime.statusDashboardMessageId || '';

  plugin.dispatcher.upsertMessage(
    plugin,
    existingMessageId,
    update.payload,
    { type: 'status', serverKey: 'dashboard' },
    (ok, messageId, errorText, details) => {
      sync.inFlight = false;

      if (!ok) {
        const retryAfterMs = Math.max(1000, parseIntSafe(details && details.retryAfterMs, 5000));
        plugin.runtime.statusDashboardRetryAtMs = Date.now() + retryAfterMs;

        plugin.logger.logWarning('{Name}: Failed to upsert status dashboard message - {Error} (retry_ms={RetryMs})',
          plugin.name,
          String(errorText || 'unknown upsert error'),
          retryAfterMs);

        if (plugin.pluginHelper && typeof plugin.pluginHelper.requestNotifyAfterDelay === 'function') {
          plugin.pluginHelper.requestNotifyAfterDelay(retryAfterMs, () => {
            ensureStatusMessage(plugin);
          });
        }
      } else {
        plugin.runtime.statusDashboardRetryAtMs = 0;

        if (messageId) {
          plugin.runtime.statusDashboardMessageId = String(messageId);
        }

        plugin.runtime.statusDashboardFingerprint = update.fingerprint;
      }

      const pending = sync.pending;
      sync.pending = null;
      if (pending) {
        ensureStatusMessage(plugin);
      }
    }
  );
}

export function ensureStatusMessage(plugin) {
  if (!plugin.dispatcher || plugin.dispatcher.count === 0) return;

  const statusSnapshotByServer = plugin.runtime.statusSnapshotByServer || {};
  const existingMessageId = plugin.runtime.statusDashboardMessageId || '';
  const snapshotCount = Object.keys(statusSnapshotByServer).length;
  if (!existingMessageId && snapshotCount === 0) {
    return;
  }

  const payload = buildStatusPayload(plugin, statusSnapshotByServer);
  const fingerprint = JSON.stringify(payload);
  const existingFingerprint = plugin.runtime.statusDashboardFingerprint || '';

  if (existingMessageId && existingFingerprint === fingerprint) {
    return;
  }

  const update = {
    payload: payload,
    fingerprint: fingerprint
  };

  const sync = ensureStatusSyncState(plugin);
  if (sync.inFlight) {
    sync.pending = update;
    return;
  }

  const nowMs = Date.now();
  const retryAtMs = parseIntSafe(plugin.runtime.statusDashboardRetryAtMs, 0);
  if (retryAtMs > nowMs) {
    sync.pending = update;
    return;
  }

  dispatchStatusUpsert(plugin, update);
}
