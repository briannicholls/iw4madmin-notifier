export function createRuntimeState() {
  return {
    serverByKey: {},
    activeNetworkIdsByServer: {},
    populationStateByServer: {},
    gameInfoByServer: {},
    mapInfoByServer: {},
    modeInfoByServer: {},
    serverProbeLoggedByServer: {},
    statusSnapshotByServer: {},
    statusDashboardMessageId: '',
    statusDashboardSync: null,
    statusDashboardRetryAtMs: 0,
    notifyMessageIdByServer: {},
    notifyThresholdByServer: {},
    notifyLastAtMsByKey: {},
    statusDashboardFingerprint: '',
    notifyDeleteInFlightByServer: {},
    globalNotifyDispatchInFlight: false,
    gameApiSyncInFlight: false,
    gameApiLastSyncAtMs: 0,
    missingNotifierWarned: false,
    startupPurgeCompleted: false,
    startupBootstrapStarted: false
  };
}

export function ensureServerPopulationState(plugin, serverKey) {
  let state = plugin.runtime.populationStateByServer[serverKey];
  if (!state) {
    state = {
      initialized: false,
      lastCount: null,
      lowPopulationSinceMs: 0,
      firedByThreshold: {}
    };
    plugin.runtime.populationStateByServer[serverKey] = state;
  }
  return state;
}

export function saveServerPopulationState(plugin, serverKey, state) {
  plugin.runtime.populationStateByServer[serverKey] = state;
}

export function setKnownServer(plugin, serverKey, server) {
  plugin.runtime.serverByKey[serverKey] = server;
}

export function setServerMetadata(plugin, serverKey, mapInfo, modeInfo, gameInfo) {
  plugin.runtime.mapInfoByServer[serverKey] = mapInfo;
  plugin.runtime.modeInfoByServer[serverKey] = modeInfo;
  plugin.runtime.gameInfoByServer[serverKey] = gameInfo;
}

export function setGameMetadata(plugin, serverKey, gameInfo) {
  plugin.runtime.gameInfoByServer[serverKey] = gameInfo;
}

export function setStatusSnapshot(plugin, serverKey, snapshot) {
  plugin.runtime.statusSnapshotByServer[serverKey] = snapshot;
}

export function clearStatusSnapshots(plugin) {
  plugin.runtime.statusSnapshotByServer = {};
}

export function ensureActiveNetworkIds(plugin, serverKey) {
  if (!plugin.runtime.activeNetworkIdsByServer[serverKey]) {
    plugin.runtime.activeNetworkIdsByServer[serverKey] = {};
  }
  return plugin.runtime.activeNetworkIdsByServer[serverKey];
}

export function wasServerProbeLogged(plugin, serverKey) {
  return !!plugin.runtime.serverProbeLoggedByServer[serverKey];
}

export function markServerProbeLogged(plugin, serverKey) {
  plugin.runtime.serverProbeLoggedByServer[serverKey] = true;
}
