import { buildDashboardPayload } from './dashboard-renderer.js';
import { parseIntSafe } from './utils.js';

export function buildStatusPayload(plugin, statusSnapshotByServer) {
  const alerts = plugin.config && Array.isArray(plugin.config.alerts) ? plugin.config.alerts : [];
  return buildDashboardPayload(alerts, statusSnapshotByServer);
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
