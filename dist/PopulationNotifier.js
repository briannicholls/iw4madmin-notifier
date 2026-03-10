var _b = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.js
  var index_exports = {};
  __export(index_exports, {
    commands: () => commands,
    init: () => init,
    plugin: () => plugin
  });

  // src/utils.js
  function cleanName(value) {
    return String(value == null ? "" : value).replace(/[\x00-\x1F\x7F]/g, "").trim();
  }
  function normalizeNetworkId(value) {
    if (value == null) return "";
    const normalized = String(value).trim();
    if (!normalized || normalized === "0") return "";
    return normalized;
  }
  function parseIntSafe(value, fallback) {
    const parsed = parseInt(String(value == null ? "" : value), 10);
    return Number.isFinite(parsed) ? parsed : fallback == null ? 0 : fallback;
  }
  function getServerKey(server) {
    if (!server) return "unknown";
    try {
      const byToString = String(server.toString ? server.toString() : "");
      if (byToString && byToString !== "[object Object]") return byToString;
    } catch (_) {
    }
    const fallback = server.listenAddress || server.id || server.serverId || "unknown";
    return String(fallback);
  }
  function toArray(source) {
    if (!source) return [];
    if (Array.isArray(source)) return source;
    const out = [];
    try {
      const count = parseIntSafe(source.Count || source.count || source.Length || source.length, 0);
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          if (source[i] !== void 0 && source[i] !== null) out.push(source[i]);
        }
        if (out.length > 0) return out;
      }
    } catch (_) {
    }
    try {
      for (const item of source) {
        out.push(item);
      }
    } catch (_) {
    }
    return out;
  }
  function getPlayerCountFromServer(server) {
    if (!server) return null;
    const candidates = [
      "clientCount",
      "ClientCount",
      "numClients",
      "NumClients",
      "currentPlayers",
      "CurrentPlayers",
      "connectedClients",
      "ConnectedClients"
    ];
    for (let i = 0; i < candidates.length; i++) {
      const key = candidates[i];
      const value = server[key];
      const parsed = parseIntSafe(value, -1);
      if (parsed >= 0) return parsed;
    }
    const clients = server.clients || server.Clients;
    if (clients) {
      if (Array.isArray(clients)) return clients.length;
      const parsedCount = parseIntSafe(clients.Count || clients.count || clients.Length || clients.length, -1);
      if (parsedCount >= 0) return parsedCount;
      const asArray = toArray(clients);
      if (asArray.length > 0) return asArray.length;
    }
    return null;
  }
  function renderTemplate(template, values) {
    const source = String(template == null ? "" : template);
    return source.replace(/\{([A-Za-z0-9_]+)\}/g, function(_whole, key) {
      if (values && values[key] != null) {
        return String(values[key]);
      }
      return "";
    });
  }

  // src/config.js
  var MAX_PLAYERS = 18;
  var DEFAULT_ALERTS = [
    {
      threshold: 6,
      message: "[Warmup] {serverName} reached {playerCount}/{maxPlayers} players."
    },
    {
      threshold: 11,
      message: "[Hot] {serverName} reached {playerCount}/{maxPlayers} players. {slotsRemaining} slots left."
    }
  ];
  var defaultConfig = {
    alerts: DEFAULT_ALERTS.map(copyAlert),
    discordBotToken: "",
    discordChannelId: ""
  };
  function copyAlert(alert) {
    return {
      threshold: alert.threshold,
      message: alert.message
    };
  }
  function defaultMessageForThreshold(threshold) {
    if (threshold <= 6) {
      return "[Warmup] {serverName} reached {playerCount}/{maxPlayers} players.";
    }
    return "[Hot] {serverName} reached {playerCount}/{maxPlayers} players. {slotsRemaining} slots left.";
  }
  function sanitizeAlerts(inputAlerts) {
    const rawAlerts = Array.isArray(inputAlerts) ? inputAlerts : [];
    const dedupe = {};
    for (let i = 0; i < rawAlerts.length; i++) {
      const current = rawAlerts[i] || {};
      const thresholdRaw = parseIntSafe(current.threshold, -1);
      if (thresholdRaw < 1) continue;
      const threshold = thresholdRaw > MAX_PLAYERS ? MAX_PLAYERS : thresholdRaw;
      const message = String(current.message == null ? "" : current.message).trim() || defaultMessageForThreshold(threshold);
      dedupe[String(threshold)] = {
        threshold,
        message
      };
    }
    const sanitized = Object.values(dedupe).sort(function(left, right) {
      return left.threshold - right.threshold;
    });
    if (sanitized.length === 0) {
      return DEFAULT_ALERTS.map(copyAlert);
    }
    return sanitized;
  }
  function sanitizeConfig(rawConfig) {
    const source = rawConfig || {};
    return {
      alerts: sanitizeAlerts(source.alerts),
      discordBotToken: String(source.discordBotToken == null ? "" : source.discordBotToken).trim(),
      discordChannelId: String(source.discordChannelId == null ? "" : source.discordChannelId).trim()
    };
  }
  function thresholdListText(alerts) {
    const list = Array.isArray(alerts) ? alerts : [];
    if (list.length === 0) return "(none)";
    const thresholds = [];
    for (let i = 0; i < list.length; i++) {
      thresholds.push(String(list[i].threshold));
    }
    return thresholds.join(",");
  }
  function formatPopulationMessage(template, context) {
    return renderTemplate(template, context);
  }
  function buildMessageContext(serverName, serverKey, playerCount, threshold) {
    const safeCount = parseIntSafe(playerCount, 0);
    const remaining = Math.max(0, MAX_PLAYERS - safeCount);
    const fillPercent = Math.round(safeCount / MAX_PLAYERS * 100);
    return {
      serverName,
      serverKey,
      playerCount: safeCount,
      maxPlayers: MAX_PLAYERS,
      slotsRemaining: remaining,
      threshold,
      fillPercent
    };
  }

  // src/notifiers/discord.js
  function responseToText(response) {
    if (response == null) return "";
    if (typeof response === "string") return response;
    try {
      if (typeof response.body === "string") return response.body;
      if (typeof response.content === "string") return response.content;
      if (typeof response.data === "string") return response.data;
    } catch (_) {
    }
    try {
      return JSON.stringify(response);
    } catch (_) {
      try {
        return String(response);
      } catch (_error) {
        return "";
      }
    }
  }
  function createHeaders(botToken) {
    const stringDict = System.Collections.Generic.Dictionary(System.String, System.String);
    const headers = new stringDict();
    headers.add("Content-Type", "application/json");
    const token = String(botToken || "");
    const authValue = token.indexOf("Bot ") === 0 ? token : "Bot " + token;
    headers.add("Authorization", authValue);
    return headers;
  }
  function requestJson(plugin2, url, method, bodyObject, headers, done) {
    try {
      const pluginScript = importNamespace("IW4MAdmin.Application.Plugin.Script");
      const body = bodyObject ? JSON.stringify(bodyObject) : "";
      const request = new pluginScript.ScriptPluginWebRequest(
        url,
        body,
        method,
        "application/json",
        headers
      );
      plugin2.pluginHelper.requestUrl(request, function(response) {
        const text = responseToText(response);
        if (!text || String(text).trim() === "") {
          done(true, "");
          return;
        }
        let parsed = null;
        try {
          parsed = JSON.parse(text);
        } catch (_jsonErr) {
        }
        if (parsed && parsed.id) {
          done(true, "");
          return;
        }
        if (String(text).indexOf('"id"') !== -1) {
          done(true, "");
          return;
        }
        done(false, text);
      });
    } catch (error) {
      done(false, error && error.message ? error.message : "discord request setup failed");
    }
  }
  function createDiscordNotifier(config) {
    const botToken = String(config && config.discordBotToken ? config.discordBotToken : "").trim();
    const channelId = String(config && config.discordChannelId ? config.discordChannelId : "").trim();
    if (!botToken || !channelId) return null;
    const url = "https://discord.com/api/v10/channels/" + channelId + "/messages";
    return {
      name: "discord",
      send: function(plugin2, messageText) {
        const headers = createHeaders(botToken);
        requestJson(plugin2, url, "POST", { content: String(messageText || "") }, headers, function(ok, errorText) {
          if (!ok) {
            plugin2.logger.logWarning(
              "{Name}: Discord notification failed - {Error}",
              plugin2.name,
              String(errorText || "unknown discord error")
            );
          }
        });
      }
    };
  }

  // src/notifiers/index.js
  function createNotificationDispatcher(config) {
    const notifiers = [];
    const discord = createDiscordNotifier(config);
    if (discord) {
      notifiers.push(discord);
    }
    return {
      count: notifiers.length,
      names: notifiers.map(function(notifier) {
        return notifier.name;
      }),
      send: function(plugin2, messageText, meta) {
        for (let i = 0; i < notifiers.length; i++) {
          const notifier = notifiers[i];
          try {
            notifier.send(plugin2, messageText, meta || {});
          } catch (error) {
            plugin2.logger.logWarning(
              "{Name}: Notifier {Notifier} failed - {Error}",
              plugin2.name,
              notifier.name,
              error && error.message ? error.message : "unknown notifier error"
            );
          }
        }
      }
    };
  }

  // src/index.js
  var PLUGIN_VERSION = true ? "1.0.0" : "0.0.0-dev";
  function configsMatch(left, right) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch (_) {
      return false;
    }
  }
  var plugin = {
    author: "b_five",
    version: PLUGIN_VERSION,
    name: "Population Notifier",
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
    onLoad: function(serviceResolver, configWrapper, pluginHelper) {
      this.configWrapper = configWrapper;
      this.pluginHelper = pluginHelper;
      this.logger = serviceResolver.resolveService("ILogger", ["ScriptPluginV2"]);
      try {
        this.manager = serviceResolver.resolveService("IManager");
      } catch (_) {
        this.manager = null;
      }
      this.configWrapper.setName(this.name);
      const stored = this.configWrapper.getValue("config", (newConfig) => {
        if (!newConfig) return;
        this.config = sanitizeConfig(newConfig);
        this.refreshNotifiers();
        this.runtime.populationStateByServer = {};
        this.bootstrapKnownServers();
        this.logger.logInformation(
          "{Name}: Config reloaded. alerts={Alerts} notifiers={Notifiers}",
          this.name,
          thresholdListText(this.config.alerts),
          this.notifierNamesText()
        );
      });
      if (stored != null) {
        const sanitized = sanitizeConfig(stored);
        this.config = sanitized;
        if (!configsMatch(stored, sanitized)) {
          this.configWrapper.setValue("config", sanitized);
        }
      } else {
        this.configWrapper.setValue("config", this.config);
      }
      this.refreshNotifiers();
      this.logger.logInformation(
        "{Name} {Version} by {Author} loaded. alerts={Alerts} max_players={MaxPlayers} notifiers={Notifiers}",
        this.name,
        this.version,
        this.author,
        thresholdListText(this.config.alerts),
        MAX_PLAYERS,
        this.notifierNamesText()
      );
      if (!this.dispatcher || this.dispatcher.count === 0) {
        this.logger.logWarning("{Name}: No notifier destinations configured. Add discordBotToken and discordChannelId to enable alerts.", this.name);
        this.runtime.missingNotifierWarned = true;
      }
      this.bootstrapKnownServers();
      this.scheduleDelayedBootstrap();
    },
    refreshNotifiers: function() {
      this.dispatcher = createNotificationDispatcher(this.config);
      this.runtime.missingNotifierWarned = false;
    },
    notifierNamesText: function() {
      if (!this.dispatcher || this.dispatcher.count === 0) return "(none)";
      return this.dispatcher.names.join(",");
    },
    scheduleDelayedBootstrap: function() {
      if (!this.pluginHelper || typeof this.pluginHelper.requestNotifyAfterDelay !== "function") return;
      this.pluginHelper.requestNotifyAfterDelay(7e3, () => {
        this.bootstrapKnownServers();
      });
    },
    collectServersFromManager: function() {
      const manager = this.manager;
      if (!manager) return [];
      const methodNames = [
        "getServers",
        "GetServers",
        "getActiveServers",
        "GetActiveServers"
      ];
      const propertyNames = [
        "servers",
        "Servers",
        "activeServers",
        "ActiveServers",
        "gameServers",
        "GameServers"
      ];
      const gathered = [];
      for (let i = 0; i < methodNames.length; i++) {
        const method = methodNames[i];
        if (typeof manager[method] !== "function") continue;
        try {
          const response = manager[method]();
          const rows = toArray(response);
          for (let j = 0; j < rows.length; j++) {
            if (rows[j]) gathered.push(rows[j]);
          }
        } catch (_) {
        }
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
    bootstrapKnownServers: function() {
      const servers = this.collectServersFromManager();
      for (let i = 0; i < servers.length; i++) {
        this.observeServerPopulation(servers[i], null, false, true);
      }
    },
    onClientEnterMatch: function(enterEvent) {
      const server = enterEvent && enterEvent.server ? enterEvent.server : null;
      const client = enterEvent && enterEvent.client ? enterEvent.client : enterEvent && enterEvent.origin ? enterEvent.origin : null;
      this.observeServerPopulation(server, client, false, false);
    },
    onClientDisconnected: function(disconnectEvent) {
      const server = disconnectEvent && disconnectEvent.server ? disconnectEvent.server : null;
      const client = disconnectEvent && disconnectEvent.client ? disconnectEvent.client : disconnectEvent && disconnectEvent.origin ? disconnectEvent.origin : null;
      this.observeServerPopulation(server, client, true, false);
    },
    onMatchEnded: function(matchEndEvent) {
      const server = matchEndEvent && matchEndEvent.server ? matchEndEvent.server : null;
      this.observeServerPopulation(server, null, false, false);
    },
    observeServerPopulation: function(server, client, isDisconnect, isBootstrap) {
      if (!server) return;
      const serverKey = getServerKey(server);
      const serverName = cleanName(server.serverName || server.hostname || serverKey);
      this.runtime.serverByKey[serverKey] = server;
      if (!this.runtime.activeNetworkIdsByServer[serverKey]) {
        this.runtime.activeNetworkIdsByServer[serverKey] = {};
      }
      const activeIds = this.runtime.activeNetworkIdsByServer[serverKey];
      const networkId = normalizeNetworkId(client && client.networkId ? client.networkId : null);
      if (networkId) {
        if (isDisconnect) {
          delete activeIds[networkId];
        } else {
          activeIds[networkId] = true;
        }
      }
      let count = getPlayerCountFromServer(server);
      if (count == null) {
        count = Object.keys(activeIds).length;
      }
      const parsedCount = parseIntSafe(count, -1);
      if (parsedCount < 0) return;
      this.evaluatePopulation(serverKey, serverName, parsedCount, isBootstrap);
    },
    evaluatePopulation: function(serverKey, serverName, playerCount, _isBootstrap) {
      const alerts = this.config.alerts || [];
      if (alerts.length === 0) return;
      let state = this.runtime.populationStateByServer[serverKey];
      if (!state) {
        state = {
          initialized: false,
          lastCount: null,
          firedByThreshold: {}
        };
      }
      if (!state.initialized) {
        this.applyStartupRules(serverKey, serverName, playerCount, state);
        state.initialized = true;
        state.lastCount = playerCount;
        this.runtime.populationStateByServer[serverKey] = state;
        return;
      }
      const previousCount = parseIntSafe(state.lastCount, playerCount);
      for (let i = 0; i < alerts.length; i++) {
        const alert = alerts[i];
        const threshold = parseIntSafe(alert.threshold, 0);
        const thresholdKey = String(threshold);
        if (playerCount < threshold) {
          state.firedByThreshold[thresholdKey] = false;
        }
        const crossedUp = previousCount < threshold && playerCount >= threshold;
        if (crossedUp && !state.firedByThreshold[thresholdKey]) {
          this.sendPopulationAlert(alert, serverKey, serverName, playerCount, false);
          state.firedByThreshold[thresholdKey] = true;
        }
      }
      state.lastCount = playerCount;
      this.runtime.populationStateByServer[serverKey] = state;
    },
    applyStartupRules: function(serverKey, serverName, playerCount, state) {
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
      if (!highestMet) return;
      if (playerCount >= MAX_PLAYERS) return;
      this.sendPopulationAlert(highestMet, serverKey, serverName, playerCount, true);
    },
    sendPopulationAlert: function(alert, serverKey, serverName, playerCount, isStartup) {
      if (!this.dispatcher || this.dispatcher.count === 0) {
        if (!this.runtime.missingNotifierWarned) {
          this.logger.logWarning("{Name}: Alert suppressed because no notifier destination is configured.", this.name);
          this.runtime.missingNotifierWarned = true;
        }
        return;
      }
      const threshold = parseIntSafe(alert.threshold, 0);
      const context = buildMessageContext(serverName, serverKey, playerCount, threshold);
      const message = formatPopulationMessage(alert.message, context);
      this.dispatcher.send(this, message, {
        threshold,
        serverKey,
        serverName,
        playerCount,
        startup: isStartup === true
      });
      this.logger.logInformation(
        "{Name}: Sent population alert for {Server} threshold={Threshold} count={Count} startup={Startup}",
        this.name,
        serverKey,
        threshold,
        playerCount,
        isStartup === true ? "yes" : "no"
      );
    },
    tellStatus: function(commandEvent) {
      if (!commandEvent || !commandEvent.origin || typeof commandEvent.origin.tell !== "function") return;
      const keys = Object.keys(this.runtime.populationStateByServer || {});
      const serverSummaries = [];
      for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        const state = this.runtime.populationStateByServer[key] || {};
        const count = state.lastCount == null ? "?" : String(state.lastCount);
        serverSummaries.push(key + "=" + count);
      }
      commandEvent.origin.tell(
        "Population Notifier v" + this.version + " | alerts=" + thresholdListText(this.config.alerts) + " | notifiers=" + this.notifierNamesText() + " | servers=" + (serverSummaries.length > 0 ? serverSummaries.join(", ") : "(none)")
      );
    }
  };
  var init = (registerNotify, serviceResolver, configWrapper, pluginHelper) => {
    registerNotify(
      "IGameEventSubscriptions.ClientEnterMatch",
      (enterEvent, _token) => plugin.onClientEnterMatch(enterEvent)
    );
    registerNotify(
      "IGameEventSubscriptions.MatchEnded",
      (matchEndEvent, _token) => plugin.onMatchEnded(matchEndEvent)
    );
    try {
      registerNotify(
        "IGameEventSubscriptions.ClientDisconnected",
        (disconnectEvent, _token) => plugin.onClientDisconnected(disconnectEvent)
      );
    } catch (_error) {
      if (plugin.logger) {
        plugin.logger.logWarning("{Name}: ClientDisconnected subscription unavailable; relying on enter/match events.", plugin.name);
      }
    }
    plugin.onLoad(serviceResolver, configWrapper, pluginHelper);
    return plugin;
  };
  var commands = [
    {
      name: "popnotify",
      description: "shows current population notifier status",
      alias: "pn",
      permission: "User",
      targetRequired: false,
      arguments: [],
      execute: (gameEvent) => {
        plugin.tellStatus(gameEvent);
      }
    }
  ];
  return __toCommonJS(index_exports);
})();
var init=_b.init;var plugin=_b.plugin;var commands=_b.commands;
