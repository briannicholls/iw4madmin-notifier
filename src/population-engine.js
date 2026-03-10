import { MAX_PLAYERS, thresholdListText } from './config.js';
import { parseIntSafe } from './utils.js';
import { handleThresholdCrossing, maybeDeleteNotifyForLowPopulation } from './threshold-notify.js';

function applyStartupRules(plugin, serverKey, serverName, playerCount, state) {
  const alerts = plugin.config.alerts || [];
  let highestMet = null;

  for (let i = 0; i < alerts.length; i++) {
    const alert = alerts[i];
    const threshold = parseIntSafe(alert.threshold, 0);
    const thresholdKey = String(threshold);

    if (playerCount >= threshold) {
      highestMet = alert;
      state.firedByThreshold[thresholdKey] = true;
    } else {
      state.firedByThreshold[thresholdKey] = false;
    }
  }

  if (!highestMet) {
    plugin.logger.logInformation('{Name}: Startup snapshot below all thresholds for {Server} (count={Count})',
      plugin.name,
      serverKey,
      playerCount);
    return;
  }

  if (playerCount >= MAX_PLAYERS) {
    plugin.logger.logInformation('{Name}: Startup snapshot at full capacity for {Server} (count={Count}); startup alert skipped',
      plugin.name,
      serverKey,
      playerCount);
    return;
  }

  const threshold = parseIntSafe(highestMet.threshold, 0);
  plugin.logger.logInformation('{Name}: Startup snapshot met threshold {Threshold} for {Server} (count={Count}); sending highest-threshold startup alert',
    plugin.name,
    threshold,
    serverKey,
    playerCount);

  handleThresholdCrossing(plugin, highestMet, serverKey, serverName, playerCount, true, 'startup_snapshot');
}

export function evaluatePopulation(plugin, serverKey, serverName, playerCount, observationMeta) {
  const alerts = plugin.config.alerts || [];
  if (alerts.length === 0) return;

  const meta = observationMeta || {};
  let state = plugin.runtime.populationStateByServer[serverKey];

  if (!state) {
    state = {
      initialized: false,
      lastCount: null,
      firedByThreshold: {}
    };
  }

  maybeDeleteNotifyForLowPopulation(plugin, serverKey, playerCount, meta.source || 'unknown');

  if (!state.initialized) {
    plugin.logger.logInformation('{Name}: Initial population snapshot source={Source} server={Server} count={Count} via={CountSource} thresholds={Thresholds}',
      plugin.name,
      meta.source || 'unknown',
      serverKey,
      playerCount,
      meta.countSource || 'unknown',
      thresholdListText(alerts));

    applyStartupRules(plugin, serverKey, serverName, playerCount, state);
    state.initialized = true;
    state.lastCount = playerCount;
    plugin.runtime.populationStateByServer[serverKey] = state;
    return;
  }

  const previousCount = parseIntSafe(state.lastCount, playerCount);
  if (previousCount !== playerCount) {
    plugin.logger.logInformation('{Name}: Population changed source={Source} server={Server} previous={Previous} current={Current} via={CountSource} tracked_ids={TrackedIds}',
      plugin.name,
      meta.source || 'unknown',
      serverKey,
      previousCount,
      playerCount,
      meta.countSource || 'unknown',
      parseIntSafe(meta.activeCount, 0));
  }

  for (let i = 0; i < alerts.length; i++) {
    const alert = alerts[i];
    const threshold = parseIntSafe(alert.threshold, 0);
    const thresholdKey = String(threshold);

    if (playerCount < threshold) {
      if (state.firedByThreshold[thresholdKey]) {
        plugin.logger.logInformation('{Name}: Threshold reset server={Server} threshold={Threshold} count={Count}',
          plugin.name,
          serverKey,
          threshold,
          playerCount);
      }
      state.firedByThreshold[thresholdKey] = false;
    }

    const crossedUp = previousCount < threshold && playerCount >= threshold;
    if (crossedUp && !state.firedByThreshold[thresholdKey]) {
      plugin.logger.logInformation('{Name}: Threshold crossed upward server={Server} threshold={Threshold} previous={Previous} current={Current}',
        plugin.name,
        serverKey,
        threshold,
        previousCount,
        playerCount);

      handleThresholdCrossing(plugin, alert, serverKey, serverName, playerCount, false, meta.source || 'threshold_cross');
      state.firedByThreshold[thresholdKey] = true;
    }
  }

  state.lastCount = playerCount;
  plugin.runtime.populationStateByServer[serverKey] = state;
}
