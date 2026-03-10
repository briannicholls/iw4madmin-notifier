import { defaultConfig, MAX_PLAYERS, sanitizeConfig, thresholdListText } from './config.js';
import { cleanName, getPlayerCountFromServer, getServerKey, parseIntSafe } from './utils.js';
import {
  extractClientFromEvent,
  extractNetworkIdFromClient,
  extractServerFromEvent
} from './event-extractors.js';
import {
  extractMapInfoFromEvent,
  extractMapInfoFromServer,
  extractModeInfoFromEvent,
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

  runtime: {
    serverByKey: {},
    activeNetworkIdsByServer: {},
    populationStateByServer: {},
    mapInfoByServer: {},
    modeInfoByServer: {},
    serverProbeLoggedByServer: {},
    statusMessageIdByServer: {},
    statusSyncByServer: {},
    statusRetryAtByServer: {},
    notifyMessageIdByServer: {},
    statusFingerprintByServer: {},
    notifyDeleteInFlightByServer: {},
    globalNotifyLastAtMs: 0,
    globalNotifyDispatchInFlight: false,
    missingNotifierWarned: false
  },

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
      this.runtime.statusFingerprintByServer = {};

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

    this.logger.logInformation('{Name}: Discord config token_set={TokenSet} channel_set={ChannelSet} thumbnail_base_url_set={ThumbnailSet} map_images={MapImages}',
      this.name,
      this.config.discordBotToken ? 'yes' : 'no',
      this.config.discordChannelId ? 'yes' : 'no',
      this.config.thumbnailBaseUrl ? 'yes' : 'no',
      Object.keys(this.config.mapImageUrls || {}).length);

    if (!this.dispatcher || this.dispatcher.count === 0) {
      this.logger.logWarning('{Name}: No notifier destinations configured. Add discordBotToken and discordChannelId to enable alerts.', this.name);
      this.runtime.missingNotifierWarned = true;
    }

    this.bootstrapKnownServers();
    this.scheduleDelayedBootstrap();
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

  bootstrapKnownServers: function () {
    const servers = collectServersFromManager(this.manager);
    this.logger.logInformation('{Name}: bootstrapKnownServers discovered {Count} server(s) from manager',
      this.name,
      servers.length);

    for (let i = 0; i < servers.length; i++) {
      const server = servers[i];
      this.observeServerPopulation(
        server,
        null,
        false,
        'bootstrap_manager',
        extractMapInfoFromServer(server),
        extractModeInfoFromServer(server),
        true
      );
    }
  },

  refreshStatusMessages: function () {
    const keys = Object.keys(this.runtime.populationStateByServer || {});
    for (let i = 0; i < keys.length; i++) {
      const serverKey = keys[i];
      const server = this.runtime.serverByKey[serverKey];
      if (!server) continue;

      const state = this.runtime.populationStateByServer[serverKey] || {};
      const count = parseIntSafe(state.lastCount, 0);
      const serverName = cleanName(server.serverName || server.ServerName || server.hostname || server.Hostname || serverKey);
      const mapInfo = mergeNamedInfo(this.runtime.mapInfoByServer[serverKey], extractMapInfoFromServer(server));
      const modeInfo = mergeNamedInfo(this.runtime.modeInfoByServer[serverKey], extractModeInfoFromServer(server));
      ensureStatusMessage(this, serverKey, serverName, count, mapInfo, modeInfo);
    }
  },

  onClientStateInitialized: function (eventObj) {
    const server = extractServerFromEvent(eventObj);
    const client = extractClientFromEvent(eventObj);
    this.observeServerPopulation(
      server,
      client,
      false,
      'client_state_initialized',
      extractMapInfoFromEvent(eventObj),
      extractModeInfoFromEvent(eventObj),
      false
    );
  },

  onClientStateDisposed: function (eventObj) {
    const server = extractServerFromEvent(eventObj);
    const client = extractClientFromEvent(eventObj);
    this.observeServerPopulation(
      server,
      client,
      true,
      'client_state_disposed',
      extractMapInfoFromEvent(eventObj),
      extractModeInfoFromEvent(eventObj),
      false
    );
  },

  onServerMonitoringStarted: function (eventObj) {
    const server = extractServerFromEvent(eventObj);
    this.observeServerPopulation(
      server,
      null,
      false,
      'monitoring_started',
      extractMapInfoFromEvent(eventObj),
      extractModeInfoFromEvent(eventObj),
      true
    );
  },

  onMatchStarted: function (eventObj) {
    const server = extractServerFromEvent(eventObj);
    this.observeServerPopulation(
      server,
      null,
      false,
      'match_started',
      extractMapInfoFromEvent(eventObj),
      extractModeInfoFromEvent(eventObj),
      false
    );
  },

  onMatchEnded: function (eventObj) {
    const server = extractServerFromEvent(eventObj);
    this.observeServerPopulation(
      server,
      null,
      false,
      'match_ended',
      extractMapInfoFromEvent(eventObj),
      extractModeInfoFromEvent(eventObj),
      false
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
    this.runtime.serverByKey[serverKey] = server;

    const mapInfo = mergeNamedInfo(
      mapHint,
      mergeNamedInfo(extractMapInfoFromServer(server), this.runtime.mapInfoByServer[serverKey])
    );
    const modeInfo = mergeNamedInfo(
      modeHint,
      mergeNamedInfo(extractModeInfoFromServer(server), this.runtime.modeInfoByServer[serverKey])
    );
    this.runtime.mapInfoByServer[serverKey] = mapInfo;
    this.runtime.modeInfoByServer[serverKey] = modeInfo;

    if (!this.runtime.serverProbeLoggedByServer[serverKey]) {
      this.runtime.serverProbeLoggedByServer[serverKey] = true;
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

    if (!this.runtime.activeNetworkIdsByServer[serverKey]) {
      this.runtime.activeNetworkIdsByServer[serverKey] = {};
    }

    const activeNetworkIds = this.runtime.activeNetworkIdsByServer[serverKey];
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

    ensureStatusMessage(this, serverKey, serverName, playerCount, mapInfo, modeInfo);

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
      + ' | status_msgs=' + Object.keys(this.runtime.statusMessageIdByServer || {}).length
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
