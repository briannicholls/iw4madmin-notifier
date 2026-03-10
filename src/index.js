import {
  defaultConfig,
  sanitizeConfig,
  MAX_PLAYERS,
  thresholdListText,
  formatPopulationMessage,
  buildMessageContext
} from './config.js';
import {
  cleanName,
  getPlayerCountFromServer,
  getServerKey,
  normalizeNetworkId,
  parseIntSafe,
  toArray
} from './utils.js';
import { createNotificationDispatcher } from './notifiers/index.js';

const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ === 'string' ? __PLUGIN_VERSION__ : '0.0.0-dev';

function configsMatch(left, right) {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch (_) {
    return false;
  }
}

function extractClientFromEvent(eventObj) {
  if (!eventObj) return null;
  return eventObj.client || eventObj.origin || eventObj.authorizedClient || eventObj.Client || null;
}

function extractServerFromEvent(eventObj) {
  if (!eventObj) return null;
  if (eventObj.server) return eventObj.server;
  if (eventObj.currentServer) return eventObj.currentServer;

  const client = extractClientFromEvent(eventObj);
  if (client && client.currentServer) return client.currentServer;
  if (client && client.CurrentServer) return client.CurrentServer;
  return null;
}

function extractNetworkIdFromClient(client) {
  if (!client) return '';

  return normalizeNetworkId(
    client.networkId
    || client.NetworkId
    || client.networkID
    || client.NetworkID
    || client.xuid
    || client.Xuid
    || client.guid
    || client.Guid
    || null
  );
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
      this.runtime.populationStateByServer = {};
      this.bootstrapKnownServers();
      this.logger.logInformation('{Name}: Config reloaded. alerts={Alerts} notifiers={Notifiers}',
        this.name,
        thresholdListText(this.config.alerts),
        this.notifierNamesText());
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

  collectServersFromManager: function () {
    const manager = this.manager;
    if (!manager) return [];

    const methodNames = [
      'getServers',
      'GetServers',
      'getActiveServers',
      'GetActiveServers'
    ];
    const propertyNames = [
      'servers',
      'Servers',
      'activeServers',
      'ActiveServers',
      'gameServers',
      'GameServers'
    ];

    const gathered = [];

    for (let i = 0; i < methodNames.length; i++) {
      const method = methodNames[i];
      if (typeof manager[method] !== 'function') continue;

      try {
        const response = manager[method]();
        const rows = toArray(response);
        for (let j = 0; j < rows.length; j++) {
          if (rows[j]) gathered.push(rows[j]);
        }
      } catch (_) { }
    }

    for (let i = 0; i < propertyNames.length; i++) {
      const property = propertyNames[i];
      const response = manager[property];
      const rows = toArray(response);
      for (let j = 0; j < rows.length; j++) {
        if (rows[j]) gathered.push(rows[j]);
      }
    }

    const unique = {};
    const out = [];
    for (let i = 0; i < gathered.length; i++) {
      const server = gathered[i];
      const key = getServerKey(server);
      if (!unique[key]) {
        unique[key] = true;
        out.push(server);
      }
    }

    return out;
  },

  bootstrapKnownServers: function () {
    const servers = this.collectServersFromManager();
    this.logger.logInformation('{Name}: bootstrapKnownServers discovered {Count} server(s) from manager',
      this.name,
      servers.length);

    for (let i = 0; i < servers.length; i++) {
      this.observeServerPopulation(servers[i], null, false, true, 'bootstrap_manager');
    }
  },

  onClientEnterMatch: function (enterEvent) {
    const server = extractServerFromEvent(enterEvent);
    const client = extractClientFromEvent(enterEvent);
    this.observeServerPopulation(server, client, false, false, 'client_initialized');
  },

  onClientDisconnected: function (disconnectEvent) {
    const server = extractServerFromEvent(disconnectEvent);
    const client = extractClientFromEvent(disconnectEvent);
    this.observeServerPopulation(server, client, true, false, 'client_disposed');
  },

  onServerMonitoringStarted: function (monitorEvent) {
    const server = extractServerFromEvent(monitorEvent);
    this.observeServerPopulation(server, null, false, true, 'monitoring_started');
  },

  onMatchEnded: function (matchEndEvent) {
    const server = extractServerFromEvent(matchEndEvent);
    this.observeServerPopulation(server, null, false, false, 'match_ended');
  },

  observeServerPopulation: function (server, client, isDisconnect, isBootstrap, source) {
    if (!server) {
      this.logger.logWarning('{Name}: Population observation skipped because server was null (source={Source})',
        this.name,
        String(source || 'unknown'));
      return;
    }

    const serverKey = getServerKey(server);
    const serverName = cleanName(server.serverName || server.ServerName || server.hostname || server.Hostname || serverKey);
    this.runtime.serverByKey[serverKey] = server;

    if (!this.runtime.activeNetworkIdsByServer[serverKey]) {
      this.runtime.activeNetworkIdsByServer[serverKey] = {};
    }

    const activeIds = this.runtime.activeNetworkIdsByServer[serverKey];
    const networkId = extractNetworkIdFromClient(client);
    if (networkId) {
      if (isDisconnect) {
        delete activeIds[networkId];
      } else {
        activeIds[networkId] = true;
      }
    }

    const directCount = getPlayerCountFromServer(server);
    let count = directCount;
    let countSource = 'server';
    if (count == null) {
      count = Object.keys(activeIds).length;
      countSource = 'tracked_ids';
    }

    const parsedCount = parseIntSafe(count, -1);
    if (parsedCount < 0) {
      this.logger.logWarning('{Name}: Population observation produced invalid count (source={Source}, server={Server})',
        this.name,
        String(source || 'unknown'),
        serverKey);
      return;
    }

    this.evaluatePopulation(serverKey, serverName, parsedCount, {
      source: String(source || 'unknown'),
      countSource: countSource,
      directCount: directCount,
      activeCount: Object.keys(activeIds).length,
      networkId: networkId,
      isDisconnect: isDisconnect === true,
      isBootstrap: isBootstrap === true
    });
  },

  evaluatePopulation: function (serverKey, serverName, playerCount, observationMeta) {
    const alerts = this.config.alerts || [];
    if (alerts.length === 0) return;

    const meta = observationMeta || {};

    let state = this.runtime.populationStateByServer[serverKey];
    if (!state) {
      state = {
        initialized: false,
        lastCount: null,
        firedByThreshold: {}
      };
    }

    if (!state.initialized) {
      this.logger.logInformation('{Name}: Initial population snapshot source={Source} server={Server} count={Count} via={CountSource} thresholds={Thresholds}',
        this.name,
        meta.source || 'unknown',
        serverKey,
        playerCount,
        meta.countSource || 'unknown',
        thresholdListText(alerts));
      this.applyStartupRules(serverKey, serverName, playerCount, state);
      state.initialized = true;
      state.lastCount = playerCount;
      this.runtime.populationStateByServer[serverKey] = state;
      return;
    }

    const previousCount = parseIntSafe(state.lastCount, playerCount);
    if (previousCount !== playerCount) {
      this.logger.logInformation('{Name}: Population changed source={Source} server={Server} previous={Previous} current={Current} via={CountSource} tracked_ids={TrackedIds}',
        this.name,
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
          this.logger.logInformation('{Name}: Threshold reset server={Server} threshold={Threshold} count={Count}',
            this.name,
            serverKey,
            threshold,
            playerCount);
        }
        state.firedByThreshold[thresholdKey] = false;
      }

      const crossedUp = previousCount < threshold && playerCount >= threshold;
      if (crossedUp && !state.firedByThreshold[thresholdKey]) {
        this.logger.logInformation('{Name}: Threshold crossed upward server={Server} threshold={Threshold} previous={Previous} current={Current}',
          this.name,
          serverKey,
          threshold,
          previousCount,
          playerCount);
        this.sendPopulationAlert(alert, serverKey, serverName, playerCount, false);
        state.firedByThreshold[thresholdKey] = true;
      }
    }

    state.lastCount = playerCount;
    this.runtime.populationStateByServer[serverKey] = state;
  },

  applyStartupRules: function (serverKey, serverName, playerCount, state) {
    const alerts = this.config.alerts || [];
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
      this.logger.logInformation('{Name}: Startup snapshot below all thresholds for {Server} (count={Count})',
        this.name,
        serverKey,
        playerCount);
      return;
    }
    if (playerCount >= MAX_PLAYERS) {
      this.logger.logInformation('{Name}: Startup snapshot at full capacity for {Server} (count={Count}); startup alert skipped',
        this.name,
        serverKey,
        playerCount);
      return;
    }

    this.logger.logInformation('{Name}: Startup snapshot met threshold {Threshold} for {Server} (count={Count}); sending highest-threshold startup alert',
      this.name,
      parseIntSafe(highestMet.threshold, 0),
      serverKey,
      playerCount);

    this.sendPopulationAlert(highestMet, serverKey, serverName, playerCount, true);
  },

  sendPopulationAlert: function (alert, serverKey, serverName, playerCount, isStartup) {
    if (!this.dispatcher || this.dispatcher.count === 0) {
      if (!this.runtime.missingNotifierWarned) {
        this.logger.logWarning('{Name}: Alert suppressed because no notifier destination is configured.', this.name);
        this.runtime.missingNotifierWarned = true;
      }
      return;
    }

    const threshold = parseIntSafe(alert.threshold, 0);
    const context = buildMessageContext(serverName, serverKey, playerCount, threshold);
    const message = formatPopulationMessage(alert.message, context);

    this.logger.logInformation('{Name}: Dispatching alert message to {NotifierCount} notifier(s) server={Server} threshold={Threshold} message={Message}',
      this.name,
      this.dispatcher.count,
      serverKey,
      threshold,
      message);

    this.dispatcher.send(this, message, {
      threshold: threshold,
      serverKey: serverKey,
      serverName: serverName,
      playerCount: playerCount,
      startup: isStartup === true
    });

    this.logger.logInformation('{Name}: Sent population alert for {Server} threshold={Threshold} count={Count} startup={Startup}',
      this.name,
      serverKey,
      threshold,
      playerCount,
      isStartup === true ? 'yes' : 'no');
  },

  tellStatus: function (commandEvent) {
    if (!commandEvent || !commandEvent.origin || typeof commandEvent.origin.tell !== 'function') return;

    const keys = Object.keys(this.runtime.populationStateByServer || {});
    const serverSummaries = [];
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const state = this.runtime.populationStateByServer[key] || {};
      const count = state.lastCount == null ? '?' : String(state.lastCount);
      serverSummaries.push(key + '=' + count);
    }

    commandEvent.origin.tell(
      'Population Notifier v' + this.version
      + ' | alerts=' + thresholdListText(this.config.alerts)
      + ' | notifiers=' + this.notifierNamesText()
      + ' | discord=' + (this.config.discordBotToken && this.config.discordChannelId ? 'configured' : 'missing')
      + ' | servers=' + (serverSummaries.length > 0 ? serverSummaries.join(', ') : '(none)')
    );
  }
};

const init = (registerNotify, serviceResolver, configWrapper, pluginHelper) => {
  registerNotify('IManagementEventSubscriptions.ClientStateInitialized',
    (clientStateEvent, _token) => plugin.onClientEnterMatch(clientStateEvent));

  registerNotify('IGameEventSubscriptions.MatchEnded',
    (matchEndEvent, _token) => plugin.onMatchEnded(matchEndEvent));

  try {
    registerNotify('IGameServerEventSubscriptions.MonitoringStarted',
      (monitorEvent, _token) => plugin.onServerMonitoringStarted(monitorEvent));
  } catch (_error) {
    if (plugin.logger) {
      plugin.logger.logWarning('{Name}: MonitoringStarted subscription unavailable.', plugin.name);
    }
  }

  try {
    registerNotify('IManagementEventSubscriptions.ClientStateDisposed',
      (disconnectEvent, _token) => plugin.onClientDisconnected(disconnectEvent));
  } catch (_error) {
    if (plugin.logger) {
      plugin.logger.logWarning('{Name}: ClientStateDisposed subscription unavailable; relying on initialization/match events.', plugin.name);
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
