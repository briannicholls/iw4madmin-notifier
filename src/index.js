import { defaultConfig, MAX_PLAYERS, sanitizeConfig, thresholdListText } from './config.js';
import { cleanName, getPlayerCountFromServer, getServerKey, parseIntSafe } from './utils.js';
import { extractNetworkIdFromClient } from './event-extractors.js';
import {
  extractMapInfoFromServer,
  extractModeInfoFromServer,
  listKeys,
  mergeNamedInfo,
  textFromUnknown
} from './server-metadata.js';
import { collectServersFromManager } from './server-discovery.js';
import { createNotificationDispatcher } from './notifiers/index.js';
import { ensureStatusMessage } from './status-channel.js';
import { evaluatePopulation } from './population-engine.js';
import { remainingCooldownMinutes } from './threshold-notify.js';
import {
  clearStatusSnapshots,
  createRuntimeState,
  ensureActiveNetworkIds,
  markServerProbeLogged,
  setKnownServer,
  setServerMetadata,
  setStatusSnapshot,
  wasServerProbeLogged
} from './plugin-state.js';
import { normalizeBootstrapObservation, normalizeObservationFromEvent } from './observation-ingress.js';

const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ === 'string' ? __PLUGIN_VERSION__ : '0.0.0-dev';

function configsMatch(left, right) {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch (_) {
    return false;
  }
}

const plugin = {
  author: 'b_five',
  version: PLUGIN_VERSION,
  name: 'Population Notifier',
  logger: null,
  manager: null,
  configWrapper: null,
  pluginHelper: null,
  config: sanitizeConfig(defaultConfig),
  dispatcher: null,

  runtime: createRuntimeState(),

  onLoad: function (serviceResolver, configWrapper, pluginHelper) {
    this.configWrapper = configWrapper;
    this.pluginHelper = pluginHelper;
    this.logger = serviceResolver.resolveService('ILogger', ['ScriptPluginV2']);

    try {
      this.manager = serviceResolver.resolveService('IManager');
    } catch (_) {
      this.manager = null;
    }

    this.configWrapper.setName(this.name);

    const stored = this.configWrapper.getValue('config', (newConfig) => {
      if (!newConfig) return;

      this.config = sanitizeConfig(newConfig);
      this.refreshNotifiers();
      this.runtime.statusDashboardFingerprint = '';

      this.logger.logInformation('{Name}: Config reloaded. alerts={Alerts} notifiers={Notifiers}',
        this.name,
        thresholdListText(this.config.alerts),
        this.notifierNamesText());

      this.refreshStatusMessages();
    });

    if (stored != null) {
      const sanitized = sanitizeConfig(stored);
      this.config = sanitized;
      if (!configsMatch(stored, sanitized)) {
        this.configWrapper.setValue('config', sanitized);
      }
    } else {
      this.configWrapper.setValue('config', this.config);
    }

    this.refreshNotifiers();

    this.logger.logInformation('{Name} {Version} by {Author} loaded. alerts={Alerts} max_players={MaxPlayers} notifiers={Notifiers}',
      this.name,
      this.version,
      this.author,
      thresholdListText(this.config.alerts),
      MAX_PLAYERS,
      this.notifierNamesText());

    this.logger.logInformation('{Name}: Discord config token_set={TokenSet} channel_set={ChannelSet}',
      this.name,
      this.config.discordBotToken ? 'yes' : 'no',
      this.config.discordChannelId ? 'yes' : 'no');

    if (!this.dispatcher || this.dispatcher.count === 0) {
      this.logger.logWarning('{Name}: No notifier destinations configured. Add discordBotToken and discordChannelId to enable alerts.', this.name);
      this.runtime.missingNotifierWarned = true;
    }

    this.runStartupPurgeThenBootstrap();
  },

  refreshNotifiers: function () {
    this.dispatcher = createNotificationDispatcher(this.config);
    this.runtime.missingNotifierWarned = false;
  },

  notifierNamesText: function () {
    if (!this.dispatcher || this.dispatcher.count === 0) return '(none)';
    return this.dispatcher.names.join(',');
  },

  scheduleDelayedBootstrap: function () {
    if (!this.pluginHelper || typeof this.pluginHelper.requestNotifyAfterDelay !== 'function') return;

    this.pluginHelper.requestNotifyAfterDelay(7000, () => {
      this.bootstrapKnownServers();
    });
  },

  startBootstrapFlow: function () {
    if (this.runtime.startupBootstrapStarted) return;
    this.runtime.startupBootstrapStarted = true;
    this.bootstrapKnownServers();
    this.scheduleDelayedBootstrap();
  },

  runStartupPurgeThenBootstrap: function () {
    if (this.runtime.startupPurgeCompleted) {
      this.startBootstrapFlow();
      return;
    }
    this.runtime.startupPurgeCompleted = true;

    if (!this.dispatcher || typeof this.dispatcher.purgeStartupMessages !== 'function' || this.dispatcher.count === 0) {
      this.startBootstrapFlow();
      return;
    }

    this.logger.logInformation('{Name}: Startup purge scanning prior bot-authored Discord messages', this.name);
    this.dispatcher.purgeStartupMessages(this, (ok, errorText, stats) => {
      const summary = stats || { scanned: 0, matched: 0, deleted: 0, pages: 0, rateLimited: false };
      if (ok) {
        this.logger.logInformation('{Name}: Startup purge complete scanned={Scanned} matched={Matched} deleted={Deleted} pages={Pages} rate_limited={RateLimited}',
          this.name,
          parseIntSafe(summary.scanned, 0),
          parseIntSafe(summary.matched, 0),
          parseIntSafe(summary.deleted, 0),
          parseIntSafe(summary.pages, 0),
          summary.rateLimited ? 'yes' : 'no');
      } else {
        this.logger.logWarning('{Name}: Startup purge failed - {Error} (scanned={Scanned} matched={Matched} deleted={Deleted})',
          this.name,
          String(errorText || 'unknown startup purge error'),
          parseIntSafe(summary.scanned, 0),
          parseIntSafe(summary.matched, 0),
          parseIntSafe(summary.deleted, 0));
      }

      this.startBootstrapFlow();
    });
  },

  bootstrapKnownServers: function () {
    const servers = collectServersFromManager(this.manager);
    this.logger.logInformation('{Name}: bootstrapKnownServers discovered {Count} server(s) from manager',
      this.name,
      servers.length);

    for (let i = 0; i < servers.length; i++) {
      const observation = normalizeBootstrapObservation(servers[i]);
      this.observeServerPopulation(
        observation.server,
        observation.client,
        observation.isDisconnect,
        observation.source,
        observation.mapHint,
        observation.modeHint,
        observation.isBootstrap
      );
    }
  },

  refreshStatusMessages: function () {
    const keys = Object.keys(this.runtime.populationStateByServer || {});
    clearStatusSnapshots(this);

    for (let i = 0; i < keys.length; i++) {
      const serverKey = keys[i];
      const server = this.runtime.serverByKey[serverKey];
      if (!server) continue;

      const state = this.runtime.populationStateByServer[serverKey] || {};
      const count = parseIntSafe(state.lastCount, 0);
      const serverName = cleanName(server.serverName || server.ServerName || server.hostname || server.Hostname || serverKey);
      const mapInfo = mergeNamedInfo(this.runtime.mapInfoByServer[serverKey], extractMapInfoFromServer(server));
      const modeInfo = mergeNamedInfo(this.runtime.modeInfoByServer[serverKey], extractModeInfoFromServer(server));
      setStatusSnapshot(this, serverKey, {
        serverName: serverName,
        playerCount: count,
        mapInfo: mapInfo,
        modeInfo: modeInfo
      });
    }

    ensureStatusMessage(this);
  },

  onClientStateInitialized: function (eventObj) {
    const observation = normalizeObservationFromEvent(eventObj, {
      isDisconnect: false,
      source: 'client_state_initialized',
      isBootstrap: false
    });
    this.observeServerPopulation(
      observation.server,
      observation.client,
      observation.isDisconnect,
      observation.source,
      observation.mapHint,
      observation.modeHint,
      observation.isBootstrap
    );
  },

  onClientStateDisposed: function (eventObj) {
    const observation = normalizeObservationFromEvent(eventObj, {
      isDisconnect: true,
      source: 'client_state_disposed',
      isBootstrap: false
    });
    this.observeServerPopulation(
      observation.server,
      observation.client,
      observation.isDisconnect,
      observation.source,
      observation.mapHint,
      observation.modeHint,
      observation.isBootstrap
    );
  },

  onServerMonitoringStarted: function (eventObj) {
    const observation = normalizeObservationFromEvent(eventObj, {
      isDisconnect: false,
      source: 'monitoring_started',
      isBootstrap: true
    });
    this.observeServerPopulation(
      observation.server,
      observation.client,
      observation.isDisconnect,
      observation.source,
      observation.mapHint,
      observation.modeHint,
      observation.isBootstrap
    );
  },

  onMatchStarted: function (eventObj) {
    const observation = normalizeObservationFromEvent(eventObj, {
      isDisconnect: false,
      source: 'match_started',
      isBootstrap: false
    });
    this.observeServerPopulation(
      observation.server,
      observation.client,
      observation.isDisconnect,
      observation.source,
      observation.mapHint,
      observation.modeHint,
      observation.isBootstrap
    );
  },

  onMatchEnded: function (eventObj) {
    const observation = normalizeObservationFromEvent(eventObj, {
      isDisconnect: false,
      source: 'match_ended',
      isBootstrap: false
    });
    this.observeServerPopulation(
      observation.server,
      observation.client,
      observation.isDisconnect,
      observation.source,
      observation.mapHint,
      observation.modeHint,
      observation.isBootstrap
    );
  },

  observeServerPopulation: function (server, client, isDisconnect, source, mapHint, modeHint, isBootstrap) {
    if (!server) {
      this.logger.logWarning('{Name}: Population observation skipped because server was null (source={Source})',
        this.name,
        String(source || 'unknown'));
      return;
    }

    const serverKey = getServerKey(server);
    const serverName = cleanName(server.serverName || server.ServerName || server.hostname || server.Hostname || serverKey);
    setKnownServer(this, serverKey, server);

    const mapInfo = mergeNamedInfo(
      mapHint,
      mergeNamedInfo(extractMapInfoFromServer(server), this.runtime.mapInfoByServer[serverKey])
    );
    const modeInfo = mergeNamedInfo(
      modeHint,
      mergeNamedInfo(extractModeInfoFromServer(server), this.runtime.modeInfoByServer[serverKey])
    );
    setServerMetadata(this, serverKey, mapInfo, modeInfo);

    if (!wasServerProbeLogged(this, serverKey)) {
      markServerProbeLogged(this, serverKey);
      this.logger.logInformation('{Name}: PROBE server={Server} server_keys={Keys}',
        this.name,
        serverKey,
        listKeys(server, 120));
      this.logger.logInformation('{Name}: PROBE server={Server} map_keys={MapKeys} mode_type={ModeType}',
        this.name,
        serverKey,
        listKeys(server.currentMap || server.CurrentMap || server.map || server.Map, 80),
        textFromUnknown(server.gameType || server.GameType || server.gametype || server.Gametype || '(none)'));
    }

    const activeNetworkIds = ensureActiveNetworkIds(this, serverKey);
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
      this.logger.logWarning('{Name}: Population observation produced invalid count (source={Source}, server={Server})',
        this.name,
        String(source || 'unknown'),
        serverKey);
      return;
    }

    setStatusSnapshot(this, serverKey, {
      serverName: serverName,
      playerCount: playerCount,
      mapInfo: mapInfo,
      modeInfo: modeInfo
    });

    ensureStatusMessage(this);

    evaluatePopulation(this, serverKey, serverName, playerCount, {
      source: String(source || 'unknown'),
      countSource: countSource,
      directCount: directCount,
      activeCount: trackedCount,
      networkId: networkId,
      isDisconnect: isDisconnect === true,
      isBootstrap: isBootstrap === true
    });
  },

  tellStatus: function (commandEvent) {
    if (!commandEvent || !commandEvent.origin || typeof commandEvent.origin.tell !== 'function') return;

    const keys = Object.keys(this.runtime.populationStateByServer || {});
    const serverSummaries = [];

    for (let i = 0; i < keys.length; i++) {
      const serverKey = keys[i];
      const state = this.runtime.populationStateByServer[serverKey] || {};
      const count = state.lastCount == null ? '?' : String(state.lastCount);
      const hasNotify = this.runtime.notifyMessageIdByServer[serverKey] ? 'notify:on' : 'notify:off';
      serverSummaries.push(serverKey + '=' + count + '(' + hasNotify + ')');
    }

    const cooldownMinutes = remainingCooldownMinutes(this);
    const cooldownText = cooldownMinutes > 0 ? (cooldownMinutes + 'm') : 'ready';

    commandEvent.origin.tell(
      'Population Notifier v' + this.version
      + ' | alerts=' + thresholdListText(this.config.alerts)
      + ' | notifiers=' + this.notifierNamesText()
      + ' | discord=' + (this.config.discordBotToken && this.config.discordChannelId ? 'configured' : 'missing')
      + ' | cooldown=' + cooldownText
      + ' | status_msg=' + (this.runtime.statusDashboardMessageId ? '1' : '0')
      + ' | notify_msgs=' + Object.keys(this.runtime.notifyMessageIdByServer || {}).length
      + ' | servers=' + (serverSummaries.length > 0 ? serverSummaries.join(', ') : '(none)')
    );
  }
};

const init = (registerNotify, serviceResolver, configWrapper, pluginHelper) => {
  registerNotify('IManagementEventSubscriptions.ClientStateInitialized',
    (eventObj, _token) => plugin.onClientStateInitialized(eventObj));

  registerNotify('IGameEventSubscriptions.MatchEnded',
    (eventObj, _token) => plugin.onMatchEnded(eventObj));

  try {
    registerNotify('IManagementEventSubscriptions.ClientStateDisposed',
      (eventObj, _token) => plugin.onClientStateDisposed(eventObj));
  } catch (_error) {
    if (plugin.logger) {
      plugin.logger.logWarning('{Name}: ClientStateDisposed subscription unavailable; relying on other events.', plugin.name);
    }
  }

  try {
    registerNotify('IGameServerEventSubscriptions.MonitoringStarted',
      (eventObj, _token) => plugin.onServerMonitoringStarted(eventObj));
  } catch (_error) {
    if (plugin.logger) {
      plugin.logger.logWarning('{Name}: MonitoringStarted subscription unavailable.', plugin.name);
    }
  }

  try {
    registerNotify('IGameEventSubscriptions.MatchStarted',
      (eventObj, _token) => plugin.onMatchStarted(eventObj));
  } catch (_error) {
    if (plugin.logger) {
      plugin.logger.logWarning('{Name}: MatchStarted subscription unavailable.', plugin.name);
    }
  }

  plugin.onLoad(serviceResolver, configWrapper, pluginHelper);
  return plugin;
};

const commands = [
  {
    name: 'popnotify',
    description: 'shows current population notifier status',
    alias: 'pn',
    permission: 'User',
    targetRequired: false,
    arguments: [],
    execute: (gameEvent) => {
      plugin.tellStatus(gameEvent);
    }
  }
];

export { init, plugin, commands };
