import { parseIntSafe } from '../../domain/utils.js';
import { collectServersFromManager } from '../discovery/server-discovery.js';
import { normalizeBootstrapObservation } from '../ingress/observation-ingress.js';

export function scheduleDelayedBootstrap(plugin: any): void {
  if (!plugin.pluginHelper || typeof plugin.pluginHelper.requestNotifyAfterDelay !== 'function') return;

  plugin.pluginHelper.requestNotifyAfterDelay(7000, () => {
    bootstrapKnownServers(plugin);
  });
}

export function startBootstrapFlow(plugin: any): void {
  if (plugin.runtime.startupBootstrapStarted) return;
  plugin.runtime.startupBootstrapStarted = true;
  bootstrapKnownServers(plugin);
  scheduleDelayedBootstrap(plugin);
}

export function runStartupPurgeThenBootstrap(plugin: any): void {
  if (plugin.runtime.startupPurgeCompleted) {
    startBootstrapFlow(plugin);
    return;
  }
  plugin.runtime.startupPurgeCompleted = true;

  if (!plugin.dispatcher || typeof plugin.dispatcher.purgeStartupMessages !== 'function' || plugin.dispatcher.count === 0) {
    startBootstrapFlow(plugin);
    return;
  }

  // Keep purge before bootstrap to avoid stale startup channel noise.
  plugin.logger.logInformation('{Name}: Startup purge scanning prior bot-authored Discord messages', plugin.name);
  plugin.dispatcher.purgeStartupMessages(plugin, (ok: boolean, errorText: string, stats: any) => {
    const summary = stats || { scanned: 0, matched: 0, deleted: 0, pages: 0, rateLimited: false };
    if (ok) {
      plugin.logger.logInformation('{Name}: Startup purge complete scanned={Scanned} matched={Matched} deleted={Deleted} pages={Pages} rate_limited={RateLimited}',
        plugin.name,
        parseIntSafe(summary.scanned, 0),
        parseIntSafe(summary.matched, 0),
        parseIntSafe(summary.deleted, 0),
        parseIntSafe(summary.pages, 0),
        summary.rateLimited ? 'yes' : 'no');
    } else {
      plugin.logger.logWarning('{Name}: Startup purge failed - {Error} (scanned={Scanned} matched={Matched} deleted={Deleted})',
        plugin.name,
        String(errorText || 'unknown startup purge error'),
        parseIntSafe(summary.scanned, 0),
        parseIntSafe(summary.matched, 0),
        parseIntSafe(summary.deleted, 0));
    }

    startBootstrapFlow(plugin);
  });
}

export function bootstrapKnownServers(plugin: any): void {
  const servers = collectServersFromManager(plugin.manager);
  plugin.logger.logInformation('{Name}: bootstrapKnownServers discovered {Count} server(s) from manager',
    plugin.name,
    servers.length);

  for (let i = 0; i < servers.length; i++) {
    const observation = normalizeBootstrapObservation(servers[i]);
    plugin.observeServerPopulation(
      observation.server,
      observation.client,
      observation.isDisconnect,
      observation.source,
      observation.mapHint,
      observation.modeHint,
      observation.isBootstrap
    );
  }
}
