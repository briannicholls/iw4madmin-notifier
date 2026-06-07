import { cleanName, getPlayerCountFromServer, getServerKey, parseIntSafe } from '../../domain/utils.js';
import { extractNetworkIdFromClient } from '../ingress/event-extractors.js';
import {
  extractGameInfoFromServer,
  extractMapInfoFromServer,
  extractModeInfoFromServer,
  listKeys,
  mergeNamedInfo,
  textFromUnknown
} from '../../domain/server-metadata.js';
import { ensureStatusMessage } from './status-channel.js';
import { evaluatePopulation } from '../../domain/population-engine.js';
import {
  clearStatusSnapshots,
  ensureActiveNetworkIds,
  markServerProbeLogged,
  setKnownServer,
  setServerMetadata,
  setStatusSnapshot,
  wasServerProbeLogged
} from '../state/runtime-state.js';
import { cachedGameInfoForServer, maybeRefreshGameMetadataFromApi } from './game-metadata-sync.js';

export function refreshStatusMessages(plugin: any): void {
  maybeRefreshGameMetadataFromApi(plugin);
  const keys = Object.keys(plugin.runtime.populationStateByServer || {});
  clearStatusSnapshots(plugin);

  for (let i = 0; i < keys.length; i++) {
    const serverKey = keys[i];
    const server = plugin.runtime.serverByKey[serverKey];
    if (!server) continue;

    const state = plugin.runtime.populationStateByServer[serverKey] || {};
    const count = parseIntSafe(state.lastCount, 0);
    const serverName = cleanName(server.serverName || server.ServerName || server.hostname || server.Hostname || serverKey);
    const gameInfo = mergeNamedInfo(
      cachedGameInfoForServer(plugin, server, serverKey),
      mergeNamedInfo(extractGameInfoFromServer(server), plugin.runtime.gameInfoByServer[serverKey])
    );
    const mapInfo = mergeNamedInfo(plugin.runtime.mapInfoByServer[serverKey], extractMapInfoFromServer(server));
    const modeInfo = mergeNamedInfo(plugin.runtime.modeInfoByServer[serverKey], extractModeInfoFromServer(server));
    setStatusSnapshot(plugin, serverKey, {
      serverName: serverName,
      playerCount: count,
      gameInfo: gameInfo,
      mapInfo: mapInfo,
      modeInfo: modeInfo
    });
  }

  ensureStatusMessage(plugin);
}

export function observeServerPopulation(
  plugin: any,
  server: any,
  client: any,
  isDisconnect: boolean,
  source: string,
  gameHint: any,
  mapHint: any,
  modeHint: any,
  isBootstrap: boolean
): void {
  if (!server) {
    plugin.logger.logWarning('{Name}: Population observation skipped because server was null (source={Source})',
      plugin.name,
      String(source || 'unknown'));
    return;
  }

  const serverKey = getServerKey(server);
  const serverName = cleanName(server.serverName || server.ServerName || server.hostname || server.Hostname || serverKey);
  setKnownServer(plugin, serverKey, server);
  maybeRefreshGameMetadataFromApi(plugin);

  const gameInfo = mergeNamedInfo(
    cachedGameInfoForServer(plugin, server, serverKey),
    mergeNamedInfo(
      gameHint,
      mergeNamedInfo(extractGameInfoFromServer(server), plugin.runtime.gameInfoByServer[serverKey])
    )
  );
  const mapInfo = mergeNamedInfo(
    mapHint,
    mergeNamedInfo(extractMapInfoFromServer(server), plugin.runtime.mapInfoByServer[serverKey])
  );
  const modeInfo = mergeNamedInfo(
    modeHint,
    mergeNamedInfo(extractModeInfoFromServer(server), plugin.runtime.modeInfoByServer[serverKey])
  );
  setServerMetadata(plugin, serverKey, mapInfo, modeInfo, gameInfo);

  if (!wasServerProbeLogged(plugin, serverKey)) {
    markServerProbeLogged(plugin, serverKey);
    plugin.logger.logInformation('{Name}: PROBE server={Server} server_keys={Keys}',
      plugin.name,
      serverKey,
      listKeys(server, 120));
    plugin.logger.logInformation('{Name}: PROBE server={Server} map_keys={MapKeys} mode_type={ModeType}',
      plugin.name,
      serverKey,
      listKeys(server.currentMap || server.CurrentMap || server.map || server.Map, 80),
      textFromUnknown(server.gameType || server.GameType || server.gametype || server.Gametype || '(none)'));
    plugin.logger.logInformation('{Name}: PROBE server={Server} game={Game} game_keys={GameKeys}',
      plugin.name,
      serverKey,
      textFromUnknown(server.game || server.Game || server.gameName || server.GameName || '(none)'),
      listKeys(server.game || server.Game || server.gameInfo || server.GameInfo, 80));
  }

  const activeNetworkIds = ensureActiveNetworkIds(plugin, serverKey);
  const networkId = extractNetworkIdFromClient(client);
  if (networkId) {
    if (isDisconnect) {
      delete activeNetworkIds[networkId];
    } else {
      activeNetworkIds[networkId] = true;
    }
  }

  const directCount = getPlayerCountFromServer(server);
  const trackedCount = Object.keys(activeNetworkIds).length;
  let playerCount = parseIntSafe(directCount, -1);
  let countSource = 'server';

  // Reconcile host count with live client tracking deltas.
  if (playerCount < 0) {
    playerCount = trackedCount;
    countSource = 'tracked_ids';
  } else if (networkId) {
    if (isDisconnect && trackedCount < playerCount) {
      playerCount = trackedCount;
      countSource = 'tracked_ids_disconnect';
    } else if (!isDisconnect && trackedCount > playerCount) {
      playerCount = trackedCount;
      countSource = 'tracked_ids_connect';
    }
  }

  if (playerCount < 0) {
    plugin.logger.logWarning('{Name}: Population observation produced invalid count (source={Source}, server={Server})',
      plugin.name,
      String(source || 'unknown'),
      serverKey);
    return;
  }

  setStatusSnapshot(plugin, serverKey, {
    serverName: serverName,
    playerCount: playerCount,
    gameInfo: gameInfo,
    mapInfo: mapInfo,
    modeInfo: modeInfo
  });

  ensureStatusMessage(plugin);

  evaluatePopulation(plugin, serverKey, serverName, playerCount, {
    source: String(source || 'unknown'),
    countSource: countSource,
    directCount: directCount,
    activeCount: trackedCount,
    networkId: networkId,
    isDisconnect: isDisconnect === true,
    isBootstrap: isBootstrap === true
  });
}
