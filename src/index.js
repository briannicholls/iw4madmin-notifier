import {
  defaultConfig,
  sanitizeConfig,
  MAX_PLAYERS,
  GLOBAL_NOTIFY_COOLDOWN_MS,
  NOTIFY_CLEAR_BELOW_COUNT,
  NOTIFY_MENTION_PREFIX,
  thresholdListText,
  formatPopulationMessage,
  buildMessageContext,
  resolveMapImageUrl
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

  if (eventObj.client) return eventObj.client;
  if (eventObj.Client) return eventObj.Client;
  if (eventObj.origin) return eventObj.origin;
  if (eventObj.authorizedClient) return eventObj.authorizedClient;
  if (eventObj.AuthorizedClient) return eventObj.AuthorizedClient;

  const clientState = eventObj.clientState || eventObj.ClientState;
  if (clientState) {
    if (clientState.client) return clientState.client;
    if (clientState.Client) return clientState.Client;
    return clientState;
  }

  return null;
}

function extractServerFromClient(client) {
  if (!client) return null;
  if (client.currentServer) return client.currentServer;
  if (client.CurrentServer) return client.CurrentServer;
  if (client.server) return client.server;
  if (client.Server) return client.Server;
  return null;
}

function extractServerFromEvent(eventObj) {
  if (!eventObj) return null;

  if (eventObj.server) return eventObj.server;
  if (eventObj.Server) return eventObj.Server;
  if (eventObj.currentServer) return eventObj.currentServer;
  if (eventObj.CurrentServer) return eventObj.CurrentServer;

  const client = extractClientFromEvent(eventObj);
  return extractServerFromClient(client);
}

function extractMapNameFromObject(mapValue) {
  if (!mapValue) return '';
  if (typeof mapValue === 'string') return cleanName(mapValue);

  return cleanName(
    mapValue.name
    || mapValue.Name
    || mapValue.mapName
    || mapValue.MapName
    || (typeof mapValue.toString === 'function' ? mapValue.toString() : '')
  );
}

function extractMapNameFromServer(server) {
  if (!server) return '';

  const currentMap = server.currentMap || server.CurrentMap || server.map || server.Map;
  const currentMapName = extractMapNameFromObject(currentMap);
  if (currentMapName) return currentMapName;

  return cleanName(
    server.mapName
    || server.MapName
    || server.currentMapName
    || server.CurrentMapName
    || ''
  );
}

function extractMapNameFromEvent(eventObj) {
  if (!eventObj) return '';

  const direct = cleanName(eventObj.mapName || eventObj.MapName || eventObj.newMap || eventObj.NewMap || '');
  if (direct) return direct;

  const mapObj = eventObj.currentMap || eventObj.CurrentMap || eventObj.newCurrentMap || eventObj.NewCurrentMap;
  const mapFromObject = extractMapNameFromObject(mapObj);
  if (mapFromObject) return mapFromObject;

  const server = extractServerFromEvent(eventObj);
  return extractMapNameFromServer(server);
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
    mapNameByServer: {},
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

    this.logger.logInformation('{Name}: Discord config token_set={TokenSet} channel_set={ChannelSet} map_images={MapImages}',
      this.name,
      this.config.discordBotToken ? 'yes' : 'no',
      this.config.discordChannelId ? 'yes' : 'no',
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
      const methodName = methodNames[i];
      if (typeof manager[methodName] !== 'function') continue;

      try {
        const rows = toArray(manager[methodName]());
        for (let j = 0; j < rows.length; j++) {
          if (rows[j]) gathered.push(rows[j]);
        }
      } catch (_) { }
    }

    for (let i = 0; i < propertyNames.length; i++) {
      const propertyName = propertyNames[i];
      const rows = toArray(manager[propertyName]);
      for (let j = 0; j < rows.length; j++) {
        if (rows[j]) gathered.push(rows[j]);
      }
    }

    const unique = {};
    const out = [];
    for (let i = 0; i < gathered.length; i++) {
      const server = gathered[i];
      const key = getServerKey(server);
      if (unique[key]) continue;
      unique[key] = true;
      out.push(server);
    }

    return out;
  },

  bootstrapKnownServers: function () {
    const servers = this.collectServersFromManager();
    this.logger.logInformation('{Name}: bootstrapKnownServers discovered {Count} server(s) from manager',
      this.name,
      servers.length);

    for (let i = 0; i < servers.length; i++) {
      this.observeServerPopulation(servers[i], null, false, 'bootstrap_manager', extractMapNameFromServer(servers[i]), true);
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
      const mapName = this.runtime.mapNameByServer[serverKey] || extractMapNameFromServer(server) || 'unknown';
      this.ensureStatusMessage(serverKey, serverName, count, mapName);
    }
  },

  onClientStateInitialized: function (eventObj) {
    const server = extractServerFromEvent(eventObj);
    const client = extractClientFromEvent(eventObj);
    const mapName = extractMapNameFromEvent(eventObj);
    this.observeServerPopulation(server, client, false, 'client_state_initialized', mapName, false);
  },

  onClientStateDisposed: function (eventObj) {
    const server = extractServerFromEvent(eventObj);
    const client = extractClientFromEvent(eventObj);
    const mapName = extractMapNameFromEvent(eventObj);
    this.observeServerPopulation(server, client, true, 'client_state_disposed', mapName, false);
  },

  onServerMonitoringStarted: function (eventObj) {
    const server = extractServerFromEvent(eventObj);
    const mapName = extractMapNameFromEvent(eventObj);
    this.observeServerPopulation(server, null, false, 'monitoring_started', mapName, true);
  },

  onMatchStarted: function (eventObj) {
    const server = extractServerFromEvent(eventObj);
    const mapName = extractMapNameFromEvent(eventObj);
    this.observeServerPopulation(server, null, false, 'match_started', mapName, false);
  },

  onMatchEnded: function (eventObj) {
    const server = extractServerFromEvent(eventObj);
    const mapName = extractMapNameFromEvent(eventObj);
    this.observeServerPopulation(server, null, false, 'match_ended', mapName, false);
  },

  observeServerPopulation: function (server, client, isDisconnect, source, mapHint, isBootstrap) {
    if (!server) {
      this.logger.logWarning('{Name}: Population observation skipped because server was null (source={Source})',
        this.name,
        String(source || 'unknown'));
      return;
    }

    const serverKey = getServerKey(server);
    const serverName = cleanName(server.serverName || server.ServerName || server.hostname || server.Hostname || serverKey);
    this.runtime.serverByKey[serverKey] = server;

    const mapFromServer = extractMapNameFromServer(server);
    const mapName = cleanName(mapHint || mapFromServer || this.runtime.mapNameByServer[serverKey] || 'unknown') || 'unknown';
    this.runtime.mapNameByServer[serverKey] = mapName;

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
    let count = directCount;
    let countSource = 'server';
    if (count == null) {
      count = Object.keys(activeNetworkIds).length;
      countSource = 'tracked_ids';
    }

    const playerCount = parseIntSafe(count, -1);
    if (playerCount < 0) {
      this.logger.logWarning('{Name}: Population observation produced invalid count (source={Source}, server={Server})',
        this.name,
        String(source || 'unknown'),
        serverKey);
      return;
    }

    this.ensureStatusMessage(serverKey, serverName, playerCount, mapName);

    this.evaluatePopulation(serverKey, serverName, playerCount, mapName, {
      source: String(source || 'unknown'),
      countSource: countSource,
      directCount: directCount,
      activeCount: Object.keys(activeNetworkIds).length,
      networkId: networkId,
      isDisconnect: isDisconnect === true,
      isBootstrap: isBootstrap === true
    });
  },

  statusColor: function (playerCount) {
    const count = parseIntSafe(playerCount, 0);
    const alerts = this.config.alerts || [];

    let highestThreshold = 0;
    for (let i = 0; i < alerts.length; i++) {
      const threshold = parseIntSafe(alerts[i].threshold, 0);
      if (count >= threshold && threshold > highestThreshold) highestThreshold = threshold;
    }

    if (highestThreshold >= 11) return 15158332;
    if (highestThreshold >= 6) return 15844367;
    if (highestThreshold >= 1) return 3066993;
    return 3447003;
  },

  buildStatusPayload: function (serverKey, serverName, playerCount, mapName) {
    const normalizedMapName = cleanName(mapName || 'unknown') || 'unknown';
    const imageUrl = resolveMapImageUrl(this.config.mapImageUrls, normalizedMapName);

    const embed = {
      title: serverName,
      description:
        'Players: **' + playerCount + '/' + MAX_PLAYERS + '**\n'
        + 'Map: **' + normalizedMapName + '**\n'
        + 'Server Key: `' + serverKey + '`',
      color: this.statusColor(playerCount)
    };

    if (imageUrl) {
      embed.image = { url: imageUrl };
    }

    return {
      content: '',
      embeds: [embed],
      allowed_mentions: { parse: [] }
    };
  },

  ensureStatusSyncState: function (serverKey) {
    let sync = this.runtime.statusSyncByServer[serverKey];
    if (!sync) {
      sync = {
        inFlight: false,
        pending: null
      };
      this.runtime.statusSyncByServer[serverKey] = sync;
    }

    return sync;
  },

  dispatchStatusUpsert: function (serverKey, update) {
    const sync = this.ensureStatusSyncState(serverKey);
    sync.inFlight = true;

    const existingMessageId = this.runtime.statusMessageIdByServer[serverKey] || '';

    this.dispatcher.upsertMessage(
      this,
      existingMessageId,
      update.payload,
      { type: 'status', serverKey: serverKey },
      (ok, messageId, errorText, details) => {
        sync.inFlight = false;

        if (!ok) {
          const retryAfterMs = Math.max(1000, parseIntSafe(details && details.retryAfterMs, 5000));
          this.runtime.statusRetryAtByServer[serverKey] = Date.now() + retryAfterMs;

          this.logger.logWarning('{Name}: Failed to upsert status message for {Server} - {Error} (retry_ms={RetryMs})',
            this.name,
            serverKey,
            String(errorText || 'unknown upsert error'),
            retryAfterMs);

          if (this.pluginHelper && typeof this.pluginHelper.requestNotifyAfterDelay === 'function') {
            this.pluginHelper.requestNotifyAfterDelay(retryAfterMs, () => {
              this.ensureStatusMessage(serverKey, update.serverName, update.playerCount, update.mapName);
            });
          }
        } else {
          this.runtime.statusRetryAtByServer[serverKey] = 0;

          if (messageId) {
            this.runtime.statusMessageIdByServer[serverKey] = String(messageId);
          }

          this.runtime.statusFingerprintByServer[serverKey] = update.fingerprint;
        }

        const pending = sync.pending;
        sync.pending = null;
        if (pending) {
          this.ensureStatusMessage(
            serverKey,
            pending.serverName,
            pending.playerCount,
            pending.mapName
          );
        }
      }
    );
  },

  ensureStatusMessage: function (serverKey, serverName, playerCount, mapName) {
    if (!this.dispatcher || this.dispatcher.count === 0) return;

    const existingMessageId = this.runtime.statusMessageIdByServer[serverKey] || '';
    if (!existingMessageId && playerCount <= 0) {
      return;
    }

    const payload = this.buildStatusPayload(serverKey, serverName, playerCount, mapName);
    const fingerprint = JSON.stringify(payload);
    const existingFingerprint = this.runtime.statusFingerprintByServer[serverKey] || '';

    if (existingMessageId && existingFingerprint === fingerprint) {
      return;
    }

    const update = {
      serverName: serverName,
      playerCount: playerCount,
      mapName: mapName,
      payload: payload,
      fingerprint: fingerprint
    };

    const sync = this.ensureStatusSyncState(serverKey);
    if (sync.inFlight) {
      sync.pending = update;
      return;
    }

    const nowMs = Date.now();
    const retryAtMs = parseIntSafe(this.runtime.statusRetryAtByServer[serverKey], 0);
    if (retryAtMs > nowMs) {
      sync.pending = update;
      return;
    }

    this.dispatchStatusUpsert(serverKey, update);
  },

  maybeDeleteNotifyForLowPopulation: function (serverKey, previousCount, playerCount, source) {
    if (playerCount >= NOTIFY_CLEAR_BELOW_COUNT) return;
    if (parseIntSafe(previousCount, playerCount) < NOTIFY_CLEAR_BELOW_COUNT) return;

    const messageId = this.runtime.notifyMessageIdByServer[serverKey] || '';
    if (!messageId) return;

    if (this.runtime.notifyDeleteInFlightByServer[serverKey]) return;
    this.runtime.notifyDeleteInFlightByServer[serverKey] = true;

    if (!this.dispatcher || this.dispatcher.count === 0) {
      this.runtime.notifyDeleteInFlightByServer[serverKey] = false;
      return;
    }

    this.logger.logInformation('{Name}: Population dropped below {Minimum} on {Server} (count={Count}, source={Source}); deleting active notify message',
      this.name,
      NOTIFY_CLEAR_BELOW_COUNT,
      serverKey,
      playerCount,
      String(source || 'unknown'));

    this.dispatcher.deleteMessage(this, messageId, { type: 'notify', serverKey: serverKey }, (ok, errorText) => {
      this.runtime.notifyDeleteInFlightByServer[serverKey] = false;

      if (!ok) {
        this.logger.logWarning('{Name}: Failed to delete active notify message for {Server} - {Error}',
          this.name,
          serverKey,
          String(errorText || 'unknown delete error'));
        return;
      }

      delete this.runtime.notifyMessageIdByServer[serverKey];
    });
  },

  evaluatePopulation: function (serverKey, serverName, playerCount, mapName, observationMeta) {
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

      this.applyStartupRules(serverKey, serverName, playerCount, mapName, state);
      state.initialized = true;
      state.lastCount = playerCount;
      this.runtime.populationStateByServer[serverKey] = state;
      return;
    }

    const previousCount = parseIntSafe(state.lastCount, playerCount);

    this.maybeDeleteNotifyForLowPopulation(serverKey, previousCount, playerCount, meta.source || 'unknown');

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

        this.handleThresholdCrossing(alert, serverKey, serverName, playerCount, mapName, false, meta.source || 'threshold_cross');
        state.firedByThreshold[thresholdKey] = true;
      }
    }

    state.lastCount = playerCount;
    this.runtime.populationStateByServer[serverKey] = state;
  },

  applyStartupRules: function (serverKey, serverName, playerCount, mapName, state) {
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

    const threshold = parseIntSafe(highestMet.threshold, 0);
    this.logger.logInformation('{Name}: Startup snapshot met threshold {Threshold} for {Server} (count={Count}); sending highest-threshold startup alert',
      this.name,
      threshold,
      serverKey,
      playerCount);

    this.handleThresholdCrossing(highestMet, serverKey, serverName, playerCount, mapName, true, 'startup_snapshot');
  },

  canSendGlobalNotify: function () {
    const nowMs = Date.now();
    const lastAtMs = parseIntSafe(this.runtime.globalNotifyLastAtMs, 0);
    if (lastAtMs <= 0) {
      return {
        allowed: true,
        remainingMs: 0
      };
    }

    const elapsedMs = nowMs - lastAtMs;
    const remainingMs = GLOBAL_NOTIFY_COOLDOWN_MS - elapsedMs;
    if (remainingMs <= 0) {
      return {
        allowed: true,
        remainingMs: 0
      };
    }

    return {
      allowed: false,
      remainingMs: remainingMs
    };
  },

  setGlobalNotifyNow: function () {
    this.runtime.globalNotifyLastAtMs = Date.now();
  },

  buildNotifyPayload: function (alert, serverKey, serverName, playerCount, mapName, isStartup) {
    const threshold = parseIntSafe(alert.threshold, 0);
    const context = buildMessageContext(serverName, serverKey, playerCount, threshold);
    const renderedBody = formatPopulationMessage(alert.message, context);

    let content = NOTIFY_MENTION_PREFIX + ' ' + renderedBody;
    content += '\nServer: **' + serverName + '** (`' + serverKey + '`)';
    content += '\nPopulation: **' + playerCount + '/' + MAX_PLAYERS + '**';
    content += '\nMap: **' + (mapName || 'unknown') + '**';
    if (isStartup) {
      content += '\n(Startup snapshot)';
    }

    const payload = {
      content: content,
      allowed_mentions: {
        parse: ['everyone']
      }
    };

    const imageUrl = resolveMapImageUrl(this.config.mapImageUrls, mapName || '');
    if (imageUrl) {
      payload.embeds = [
        {
          title: serverName,
          description: 'Threshold reached: **' + threshold + '**',
          image: { url: imageUrl },
          color: 15158332
        }
      ];
    }

    return payload;
  },

  handleThresholdCrossing: function (alert, serverKey, serverName, playerCount, mapName, isStartup, source) {
    if (!this.dispatcher || this.dispatcher.count === 0) {
      if (!this.runtime.missingNotifierWarned) {
        this.logger.logWarning('{Name}: Alert suppressed because no notifier destination is configured.', this.name);
        this.runtime.missingNotifierWarned = true;
      }
      return;
    }

    if (this.runtime.globalNotifyDispatchInFlight) {
      this.logger.logInformation('{Name}: Notify suppressed because another notify dispatch is currently in-flight server={Server} threshold={Threshold} source={Source}',
        this.name,
        serverKey,
        parseIntSafe(alert.threshold, 0),
        String(source || 'unknown'));
      return;
    }

    const cooldown = this.canSendGlobalNotify();
    if (!cooldown.allowed) {
      const remainingMinutes = Math.ceil(cooldown.remainingMs / 60000);
      this.logger.logInformation('{Name}: Notify suppressed by global cooldown server={Server} threshold={Threshold} remaining_minutes={Remaining} source={Source}',
        this.name,
        serverKey,
        parseIntSafe(alert.threshold, 0),
        remainingMinutes,
        String(source || 'unknown'));
      return;
    }

    this.runtime.globalNotifyDispatchInFlight = true;
    this.setGlobalNotifyNow();

    this.sendNotifyMessage(alert, serverKey, serverName, playerCount, mapName, isStartup, source, () => {
      this.runtime.globalNotifyDispatchInFlight = false;
    });
  },

  sendNotifyMessage: function (alert, serverKey, serverName, playerCount, mapName, isStartup, source, done) {
    const payload = this.buildNotifyPayload(alert, serverKey, serverName, playerCount, mapName, isStartup);
    const existingMessageId = this.runtime.notifyMessageIdByServer[serverKey] || '';

    this.logger.logInformation('{Name}: Dispatching notify message server={Server} threshold={Threshold} startup={Startup} source={Source} existing_message_id={ExistingId}',
      this.name,
      serverKey,
      parseIntSafe(alert.threshold, 0),
      isStartup === true ? 'yes' : 'no',
      String(source || 'unknown'),
      existingMessageId || '(none)');

    this.dispatcher.upsertMessage(
      this,
      existingMessageId,
      payload,
      { type: 'notify', serverKey: serverKey },
      (ok, messageId, errorText) => {
        if (!ok) {
          this.logger.logWarning('{Name}: Failed to dispatch notify message for {Server} - {Error}',
            this.name,
            serverKey,
            String(errorText || 'unknown notify error'));
          if (typeof done === 'function') done(false);
          return;
        }

        if (messageId) {
          this.runtime.notifyMessageIdByServer[serverKey] = String(messageId);
        }

        this.logger.logInformation('{Name}: Notify message sent server={Server} threshold={Threshold} cooldown_minutes={CooldownMinutes}',
          this.name,
          serverKey,
          parseIntSafe(alert.threshold, 0),
          GLOBAL_NOTIFY_COOLDOWN_MS / 60000);

        if (typeof done === 'function') done(true);
      }
    );
  },

  remainingCooldownMinutes: function () {
    const cooldown = this.canSendGlobalNotify();
    if (cooldown.allowed) return 0;
    return Math.ceil(cooldown.remainingMs / 60000);
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

    const cooldownMinutes = this.remainingCooldownMinutes();
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
