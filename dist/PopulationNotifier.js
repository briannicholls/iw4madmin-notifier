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
    function countFromUnknown(value) {
      if (value == null) return -1;
      const directNumber = parseIntSafe(value, -1);
      if (directNumber >= 0) return directNumber;
      if (Array.isArray(value)) return value.length;
      const nestedCount = parseIntSafe(value.Count || value.count || value.Length || value.length, -1);
      if (nestedCount >= 0) return nestedCount;
      const asArray = toArray(value);
      if (asArray.length > 0) return asArray.length;
      return -1;
    }
    const candidates = [
      "clientCount",
      "ClientCount",
      "numClients",
      "NumClients",
      "currentPlayers",
      "CurrentPlayers",
      "connectedClients",
      "ConnectedClients",
      "clients",
      "Clients"
    ];
    for (let i = 0; i < candidates.length; i++) {
      const key = candidates[i];
      const parsed = countFromUnknown(server[key]);
      if (parsed >= 0) return parsed;
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
  function snippet(value, maxLength) {
    const limit = parseIntSafe(maxLength, 220);
    const text = String(value == null ? "" : value);
    if (text.length <= limit) return text;
    return text.substring(0, limit);
  }

  // src/config.js
  var MAX_PLAYERS = 18;
  var GLOBAL_NOTIFY_COOLDOWN_MS = 60 * 60 * 1e3;
  var NOTIFY_CLEAR_BELOW_COUNT = 3;
  var NOTIFY_MENTION_PREFIX = "@here";
  var DEFAULT_ALERTS = [
    {
      threshold: 1,
      message: "[Join] {serverName} has activity ({playerCount}/{maxPlayers})."
    },
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
    discordChannelId: "",
    mapImageUrls: {}
  };
  function copyAlert(alert) {
    return {
      threshold: alert.threshold,
      message: alert.message
    };
  }
  function defaultMessageForThreshold(threshold) {
    if (threshold <= 1) {
      return "[Join] {serverName} has activity ({playerCount}/{maxPlayers}).";
    }
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
  function normalizeMapKey(value) {
    return cleanName(value).toLowerCase();
  }
  function sanitizeMapImageUrls(rawValue) {
    if (!rawValue || typeof rawValue !== "object") return {};
    const source = rawValue;
    const out = {};
    const keys = Object.keys(source);
    for (let i = 0; i < keys.length; i++) {
      const rawKey = keys[i];
      const normalizedKey = normalizeMapKey(rawKey);
      if (!normalizedKey) continue;
      const url = String(source[rawKey] == null ? "" : source[rawKey]).trim();
      if (!url) continue;
      out[normalizedKey] = url;
    }
    return out;
  }
  function sanitizeConfig(rawConfig) {
    const source = rawConfig || {};
    return {
      alerts: sanitizeAlerts(source.alerts),
      discordBotToken: String(source.discordBotToken == null ? "" : source.discordBotToken).trim(),
      discordChannelId: String(source.discordChannelId == null ? "" : source.discordChannelId).trim(),
      mapImageUrls: sanitizeMapImageUrls(source.mapImageUrls)
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
  function resolveMapImageUrl(mapImageUrls, mapName) {
    const key = normalizeMapKey(mapName);
    if (!key) return "";
    const source = mapImageUrls || {};
    const value = source[key];
    if (!value) return "";
    return String(value);
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
  function parseStatusCode(response) {
    const raw = response ? response.statusCode || response.status || response.StatusCode || response.httpStatus : null;
    const parsed = parseInt(String(raw == null ? "" : raw), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function parseDiscordCode(parsed) {
    const raw = parsed && parsed.code != null ? parsed.code : null;
    const parsedCode = parseInt(String(raw == null ? "" : raw), 10);
    return Number.isFinite(parsedCode) ? parsedCode : 0;
  }
  function parseRetryAfterMs(parsed) {
    const raw = parsed ? parsed.retry_after != null ? parsed.retry_after : parsed.retryAfter : null;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (value >= 1e3) return Math.round(value);
    return Math.round(value * 1e3);
  }
  function isMissingMessageResponse(statusCode, parsed) {
    if (statusCode === 404) return true;
    return parseDiscordCode(parsed) === 10008;
  }
  function isRateLimitedResponse(statusCode, parsed) {
    if (statusCode === 429) return true;
    if (parsed && typeof parsed.message === "string") {
      return /rate\s*limited/i.test(parsed.message);
    }
    return false;
  }
  function tryParseJson(text) {
    const body = String(text == null ? "" : text).trim();
    if (!body) return null;
    try {
      return JSON.parse(body);
    } catch (_) {
      return null;
    }
  }
  function extractMessageId(parsed, text) {
    if (parsed && parsed.id) return String(parsed.id);
    const match = /"id"\s*:\s*"(\d+)"/.exec(String(text || ""));
    if (match && match[1]) return String(match[1]);
    return "";
  }
  function isLikelySuccess(response, statusCode, parsed, text, method) {
    if (response && response.success === false) return false;
    if (Number.isFinite(statusCode)) {
      return statusCode >= 200 && statusCode < 300;
    }
    if (parsed && (parsed.error || parsed.errors || parsed.code)) {
      return false;
    }
    if (method === "DELETE") {
      return String(text || "").trim() === "";
    }
    const id = extractMessageId(parsed, text);
    if (id) return true;
    if (!text || String(text).trim() === "") return true;
    return false;
  }
  function buildErrorText(statusCode, parsed, text) {
    if (parsed && typeof parsed.message === "string" && parsed.message) {
      return parsed.message;
    }
    if (parsed && typeof parsed.error === "string" && parsed.error) {
      return parsed.error;
    }
    if (parsed && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      return typeof parsed.errors[0] === "string" ? parsed.errors[0] : snippet(JSON.stringify(parsed.errors[0]), 220);
    }
    const textSnippet = snippet(text, 220);
    if (textSnippet) {
      if (Number.isFinite(statusCode)) {
        return "status=" + statusCode + " body=" + textSnippet;
      }
      return textSnippet;
    }
    if (Number.isFinite(statusCode)) return "status=" + statusCode;
    return "unknown discord response";
  }
  function createHeaders(botToken) {
    const stringDict = System.Collections.Generic.Dictionary(System.String, System.String);
    const headers = new stringDict();
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
        const parsed = tryParseJson(text);
        const statusCode = parseStatusCode(response);
        const messageId = extractMessageId(parsed, text);
        const ok = isLikelySuccess(response, statusCode, parsed, text, method);
        const errorText = ok ? "" : buildErrorText(statusCode, parsed, text);
        const retryAfterMs = parseRetryAfterMs(parsed);
        const isRateLimited = isRateLimitedResponse(statusCode, parsed);
        const isMissingMessage = isMissingMessageResponse(statusCode, parsed);
        done({
          ok,
          statusCode,
          parsed,
          text,
          messageId,
          errorText,
          retryAfterMs,
          isRateLimited,
          isMissingMessage
        });
      });
    } catch (error) {
      done({
        ok: false,
        statusCode: null,
        parsed: null,
        text: "",
        messageId: "",
        errorText: error && error.message ? error.message : "discord request setup failed",
        retryAfterMs: 0,
        isRateLimited: false,
        isMissingMessage: false
      });
    }
  }
  function createDiscordNotifier(config) {
    const botToken = String(config && config.discordBotToken ? config.discordBotToken : "").trim();
    const channelId = String(config && config.discordChannelId ? config.discordChannelId : "").trim();
    if (!botToken || !channelId) return null;
    const headers = createHeaders(botToken);
    const createUrl = "https://discord.com/api/v10/channels/" + channelId + "/messages";
    function createMessage(plugin2, payload, meta, done) {
      requestJson(plugin2, createUrl, "POST", payload, headers, function(result) {
        if (!result.ok) {
          done(false, "", result.errorText, {
            statusCode: result.statusCode,
            retryAfterMs: result.retryAfterMs,
            isRateLimited: result.isRateLimited,
            isMissingMessage: result.isMissingMessage
          });
          return;
        }
        done(true, result.messageId, "", {
          statusCode: result.statusCode,
          retryAfterMs: 0,
          isRateLimited: false,
          isMissingMessage: false
        });
      });
    }
    function updateMessage(plugin2, messageId, payload, meta, done) {
      const url = createUrl + "/" + messageId;
      requestJson(plugin2, url, "PATCH", payload, headers, function(result) {
        if (!result.ok) {
          done(false, "", result.errorText, {
            statusCode: result.statusCode,
            retryAfterMs: result.retryAfterMs,
            isRateLimited: result.isRateLimited,
            isMissingMessage: result.isMissingMessage
          });
          return;
        }
        done(true, result.messageId || String(messageId), "", {
          statusCode: result.statusCode,
          retryAfterMs: 0,
          isRateLimited: false,
          isMissingMessage: false
        });
      });
    }
    return {
      name: "discord",
      upsertMessage: function(plugin2, existingMessageId, payload, meta, done) {
        const type = meta && meta.type ? String(meta.type) : "message";
        const serverKey = meta && meta.serverKey ? String(meta.serverKey) : "(unknown)";
        if (existingMessageId) {
          updateMessage(plugin2, existingMessageId, payload, meta, function(ok, messageId, errorText, details) {
            if (ok) {
              plugin2.logger.logInformation(
                "{Name}: Discord {Type} message updated server={Server} message_id={MessageId} status={Status}",
                plugin2.name,
                type,
                serverKey,
                messageId,
                details && details.statusCode != null ? String(details.statusCode) : "(unknown)"
              );
              done(true, messageId, "", details || null);
              return;
            }
            const isMissingMessage = !!(details && details.isMissingMessage);
            if (!isMissingMessage) {
              plugin2.logger.logWarning(
                "{Name}: Discord {Type} update failed server={Server} message_id={MessageId} error={Error}",
                plugin2.name,
                type,
                serverKey,
                String(existingMessageId),
                errorText || "unknown error"
              );
              done(false, "", errorText || "discord update failed", details || null);
              return;
            }
            plugin2.logger.logWarning(
              "{Name}: Discord {Type} update target missing server={Server} message_id={MessageId}; creating replacement",
              plugin2.name,
              type,
              serverKey,
              String(existingMessageId)
            );
            createMessage(plugin2, payload, meta, function(createOk, createMessageId, createErrorText, createDetails) {
              if (!createOk) {
                done(false, "", createErrorText || "discord create failed after update fallback", createDetails || null);
                return;
              }
              plugin2.logger.logInformation(
                "{Name}: Discord {Type} message created server={Server} message_id={MessageId} status={Status}",
                plugin2.name,
                type,
                serverKey,
                createMessageId || "(unknown)",
                createDetails && createDetails.statusCode != null ? String(createDetails.statusCode) : "(unknown)"
              );
              done(true, createMessageId, "", createDetails || null);
            });
          });
          return;
        }
        createMessage(plugin2, payload, meta, function(ok, messageId, errorText, details) {
          if (!ok) {
            done(false, "", errorText || "discord create failed", details || null);
            return;
          }
          plugin2.logger.logInformation(
            "{Name}: Discord {Type} message created server={Server} message_id={MessageId} status={Status}",
            plugin2.name,
            type,
            serverKey,
            messageId || "(unknown)",
            details && details.statusCode != null ? String(details.statusCode) : "(unknown)"
          );
          done(true, messageId, "", details || null);
        });
      },
      deleteMessage: function(plugin2, messageId, meta, done) {
        if (!messageId) {
          done(true, "");
          return;
        }
        const type = meta && meta.type ? String(meta.type) : "message";
        const serverKey = meta && meta.serverKey ? String(meta.serverKey) : "(unknown)";
        const url = createUrl + "/" + String(messageId);
        requestJson(plugin2, url, "DELETE", null, headers, function(result) {
          if (!result.ok) {
            if (result.isMissingMessage) {
              plugin2.logger.logInformation(
                "{Name}: Discord {Type} message already missing server={Server} message_id={MessageId}; treating delete as success",
                plugin2.name,
                type,
                serverKey,
                String(messageId)
              );
              done(true, "", {
                statusCode: result.statusCode,
                retryAfterMs: 0,
                isRateLimited: false,
                isMissingMessage: true
              });
              return;
            }
            done(false, result.errorText || "discord delete failed", {
              statusCode: result.statusCode,
              retryAfterMs: result.retryAfterMs,
              isRateLimited: result.isRateLimited,
              isMissingMessage: result.isMissingMessage
            });
            return;
          }
          plugin2.logger.logInformation(
            "{Name}: Discord {Type} message deleted server={Server} message_id={MessageId} status={Status}",
            plugin2.name,
            type,
            serverKey,
            String(messageId),
            result.statusCode == null ? "(unknown)" : String(result.statusCode)
          );
          done(true, "", {
            statusCode: result.statusCode,
            retryAfterMs: 0,
            isRateLimited: false,
            isMissingMessage: false
          });
        });
      }
    };
  }

  // src/notifiers/index.js
  function createNotificationDispatcher(config) {
    const discord = createDiscordNotifier(config);
    const notifiers = [];
    if (discord) notifiers.push(discord);
    return {
      count: notifiers.length,
      names: notifiers.map(function(notifier) {
        return notifier.name;
      }),
      upsertMessage: function(plugin2, existingMessageId, payload, meta, done) {
        if (notifiers.length === 0) {
          done(false, "", "no notifier configured");
          return;
        }
        const primary = notifiers[0];
        primary.upsertMessage(plugin2, existingMessageId, payload, meta || {}, done);
      },
      deleteMessage: function(plugin2, messageId, meta, done) {
        if (notifiers.length === 0) {
          done(false, "no notifier configured");
          return;
        }
        const primary = notifiers[0];
        primary.deleteMessage(plugin2, messageId, meta || {}, done);
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
    if (!mapValue) return "";
    if (typeof mapValue === "string") return cleanName(mapValue);
    return cleanName(
      mapValue.name || mapValue.Name || mapValue.mapName || mapValue.MapName || (typeof mapValue.toString === "function" ? mapValue.toString() : "")
    );
  }
  function extractMapNameFromServer(server) {
    if (!server) return "";
    const currentMap = server.currentMap || server.CurrentMap || server.map || server.Map;
    const currentMapName = extractMapNameFromObject(currentMap);
    if (currentMapName) return currentMapName;
    return cleanName(
      server.mapName || server.MapName || server.currentMapName || server.CurrentMapName || ""
    );
  }
  function extractMapNameFromEvent(eventObj) {
    if (!eventObj) return "";
    const direct = cleanName(eventObj.mapName || eventObj.MapName || eventObj.newMap || eventObj.NewMap || "");
    if (direct) return direct;
    const mapObj = eventObj.currentMap || eventObj.CurrentMap || eventObj.newCurrentMap || eventObj.NewCurrentMap;
    const mapFromObject = extractMapNameFromObject(mapObj);
    if (mapFromObject) return mapFromObject;
    const server = extractServerFromEvent(eventObj);
    return extractMapNameFromServer(server);
  }
  function extractNetworkIdFromClient(client) {
    if (!client) return "";
    return normalizeNetworkId(
      client.networkId || client.NetworkId || client.networkID || client.NetworkID || client.xuid || client.Xuid || client.guid || client.Guid || null
    );
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
        this.runtime.statusFingerprintByServer = {};
        this.logger.logInformation(
          "{Name}: Config reloaded. alerts={Alerts} notifiers={Notifiers}",
          this.name,
          thresholdListText(this.config.alerts),
          this.notifierNamesText()
        );
        this.refreshStatusMessages();
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
      this.logger.logInformation(
        "{Name}: Discord config token_set={TokenSet} channel_set={ChannelSet} map_images={MapImages}",
        this.name,
        this.config.discordBotToken ? "yes" : "no",
        this.config.discordChannelId ? "yes" : "no",
        Object.keys(this.config.mapImageUrls || {}).length
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
        const methodName = methodNames[i];
        if (typeof manager[methodName] !== "function") continue;
        try {
          const rows = toArray(manager[methodName]());
          for (let j = 0; j < rows.length; j++) {
            if (rows[j]) gathered.push(rows[j]);
          }
        } catch (_) {
        }
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
    bootstrapKnownServers: function() {
      const servers = this.collectServersFromManager();
      this.logger.logInformation(
        "{Name}: bootstrapKnownServers discovered {Count} server(s) from manager",
        this.name,
        servers.length
      );
      for (let i = 0; i < servers.length; i++) {
        this.observeServerPopulation(servers[i], null, false, "bootstrap_manager", extractMapNameFromServer(servers[i]), true);
      }
    },
    refreshStatusMessages: function() {
      const keys = Object.keys(this.runtime.populationStateByServer || {});
      for (let i = 0; i < keys.length; i++) {
        const serverKey = keys[i];
        const server = this.runtime.serverByKey[serverKey];
        if (!server) continue;
        const state = this.runtime.populationStateByServer[serverKey] || {};
        const count = parseIntSafe(state.lastCount, 0);
        const serverName = cleanName(server.serverName || server.ServerName || server.hostname || server.Hostname || serverKey);
        const mapName = this.runtime.mapNameByServer[serverKey] || extractMapNameFromServer(server) || "unknown";
        this.ensureStatusMessage(serverKey, serverName, count, mapName);
      }
    },
    onClientStateInitialized: function(eventObj) {
      const server = extractServerFromEvent(eventObj);
      const client = extractClientFromEvent(eventObj);
      const mapName = extractMapNameFromEvent(eventObj);
      this.observeServerPopulation(server, client, false, "client_state_initialized", mapName, false);
    },
    onClientStateDisposed: function(eventObj) {
      const server = extractServerFromEvent(eventObj);
      const client = extractClientFromEvent(eventObj);
      const mapName = extractMapNameFromEvent(eventObj);
      this.observeServerPopulation(server, client, true, "client_state_disposed", mapName, false);
    },
    onServerMonitoringStarted: function(eventObj) {
      const server = extractServerFromEvent(eventObj);
      const mapName = extractMapNameFromEvent(eventObj);
      this.observeServerPopulation(server, null, false, "monitoring_started", mapName, true);
    },
    onMatchStarted: function(eventObj) {
      const server = extractServerFromEvent(eventObj);
      const mapName = extractMapNameFromEvent(eventObj);
      this.observeServerPopulation(server, null, false, "match_started", mapName, false);
    },
    onMatchEnded: function(eventObj) {
      const server = extractServerFromEvent(eventObj);
      const mapName = extractMapNameFromEvent(eventObj);
      this.observeServerPopulation(server, null, false, "match_ended", mapName, false);
    },
    observeServerPopulation: function(server, client, isDisconnect, source, mapHint, isBootstrap) {
      if (!server) {
        this.logger.logWarning(
          "{Name}: Population observation skipped because server was null (source={Source})",
          this.name,
          String(source || "unknown")
        );
        return;
      }
      const serverKey = getServerKey(server);
      const serverName = cleanName(server.serverName || server.ServerName || server.hostname || server.Hostname || serverKey);
      this.runtime.serverByKey[serverKey] = server;
      const mapFromServer = extractMapNameFromServer(server);
      const mapName = cleanName(mapHint || mapFromServer || this.runtime.mapNameByServer[serverKey] || "unknown") || "unknown";
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
      let countSource = "server";
      if (count == null) {
        count = Object.keys(activeNetworkIds).length;
        countSource = "tracked_ids";
      }
      const playerCount = parseIntSafe(count, -1);
      if (playerCount < 0) {
        this.logger.logWarning(
          "{Name}: Population observation produced invalid count (source={Source}, server={Server})",
          this.name,
          String(source || "unknown"),
          serverKey
        );
        return;
      }
      this.ensureStatusMessage(serverKey, serverName, playerCount, mapName);
      this.evaluatePopulation(serverKey, serverName, playerCount, mapName, {
        source: String(source || "unknown"),
        countSource,
        directCount,
        activeCount: Object.keys(activeNetworkIds).length,
        networkId,
        isDisconnect: isDisconnect === true,
        isBootstrap: isBootstrap === true
      });
    },
    statusColor: function(playerCount) {
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
    buildStatusPayload: function(serverKey, serverName, playerCount, mapName) {
      const normalizedMapName = cleanName(mapName || "unknown") || "unknown";
      const imageUrl = resolveMapImageUrl(this.config.mapImageUrls, normalizedMapName);
      const embed = {
        title: serverName,
        description: "Players: **" + playerCount + "/" + MAX_PLAYERS + "**\nMap: **" + normalizedMapName + "**\nServer Key: `" + serverKey + "`",
        color: this.statusColor(playerCount)
      };
      if (imageUrl) {
        embed.image = { url: imageUrl };
      }
      return {
        content: "",
        embeds: [embed],
        allowed_mentions: { parse: [] }
      };
    },
    ensureStatusSyncState: function(serverKey) {
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
    dispatchStatusUpsert: function(serverKey, update) {
      const sync = this.ensureStatusSyncState(serverKey);
      sync.inFlight = true;
      const existingMessageId = this.runtime.statusMessageIdByServer[serverKey] || "";
      this.dispatcher.upsertMessage(
        this,
        existingMessageId,
        update.payload,
        { type: "status", serverKey },
        (ok, messageId, errorText, details) => {
          sync.inFlight = false;
          if (!ok) {
            const retryAfterMs = Math.max(1e3, parseIntSafe(details && details.retryAfterMs, 5e3));
            this.runtime.statusRetryAtByServer[serverKey] = Date.now() + retryAfterMs;
            this.logger.logWarning(
              "{Name}: Failed to upsert status message for {Server} - {Error} (retry_ms={RetryMs})",
              this.name,
              serverKey,
              String(errorText || "unknown upsert error"),
              retryAfterMs
            );
            if (this.pluginHelper && typeof this.pluginHelper.requestNotifyAfterDelay === "function") {
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
    ensureStatusMessage: function(serverKey, serverName, playerCount, mapName) {
      if (!this.dispatcher || this.dispatcher.count === 0) return;
      const existingMessageId = this.runtime.statusMessageIdByServer[serverKey] || "";
      if (!existingMessageId && playerCount <= 0) {
        return;
      }
      const payload = this.buildStatusPayload(serverKey, serverName, playerCount, mapName);
      const fingerprint = JSON.stringify(payload);
      const existingFingerprint = this.runtime.statusFingerprintByServer[serverKey] || "";
      if (existingMessageId && existingFingerprint === fingerprint) {
        return;
      }
      const update = {
        serverName,
        playerCount,
        mapName,
        payload,
        fingerprint
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
    maybeDeleteNotifyForLowPopulation: function(serverKey, previousCount, playerCount, source) {
      if (playerCount >= NOTIFY_CLEAR_BELOW_COUNT) return;
      if (parseIntSafe(previousCount, playerCount) < NOTIFY_CLEAR_BELOW_COUNT) return;
      const messageId = this.runtime.notifyMessageIdByServer[serverKey] || "";
      if (!messageId) return;
      if (this.runtime.notifyDeleteInFlightByServer[serverKey]) return;
      this.runtime.notifyDeleteInFlightByServer[serverKey] = true;
      if (!this.dispatcher || this.dispatcher.count === 0) {
        this.runtime.notifyDeleteInFlightByServer[serverKey] = false;
        return;
      }
      this.logger.logInformation(
        "{Name}: Population dropped below {Minimum} on {Server} (count={Count}, source={Source}); deleting active notify message",
        this.name,
        NOTIFY_CLEAR_BELOW_COUNT,
        serverKey,
        playerCount,
        String(source || "unknown")
      );
      this.dispatcher.deleteMessage(this, messageId, { type: "notify", serverKey }, (ok, errorText) => {
        this.runtime.notifyDeleteInFlightByServer[serverKey] = false;
        if (!ok) {
          this.logger.logWarning(
            "{Name}: Failed to delete active notify message for {Server} - {Error}",
            this.name,
            serverKey,
            String(errorText || "unknown delete error")
          );
          return;
        }
        delete this.runtime.notifyMessageIdByServer[serverKey];
      });
    },
    evaluatePopulation: function(serverKey, serverName, playerCount, mapName, observationMeta) {
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
        this.logger.logInformation(
          "{Name}: Initial population snapshot source={Source} server={Server} count={Count} via={CountSource} thresholds={Thresholds}",
          this.name,
          meta.source || "unknown",
          serverKey,
          playerCount,
          meta.countSource || "unknown",
          thresholdListText(alerts)
        );
        this.applyStartupRules(serverKey, serverName, playerCount, mapName, state);
        state.initialized = true;
        state.lastCount = playerCount;
        this.runtime.populationStateByServer[serverKey] = state;
        return;
      }
      const previousCount = parseIntSafe(state.lastCount, playerCount);
      this.maybeDeleteNotifyForLowPopulation(serverKey, previousCount, playerCount, meta.source || "unknown");
      if (previousCount !== playerCount) {
        this.logger.logInformation(
          "{Name}: Population changed source={Source} server={Server} previous={Previous} current={Current} via={CountSource} tracked_ids={TrackedIds}",
          this.name,
          meta.source || "unknown",
          serverKey,
          previousCount,
          playerCount,
          meta.countSource || "unknown",
          parseIntSafe(meta.activeCount, 0)
        );
      }
      for (let i = 0; i < alerts.length; i++) {
        const alert = alerts[i];
        const threshold = parseIntSafe(alert.threshold, 0);
        const thresholdKey = String(threshold);
        if (playerCount < threshold) {
          if (state.firedByThreshold[thresholdKey]) {
            this.logger.logInformation(
              "{Name}: Threshold reset server={Server} threshold={Threshold} count={Count}",
              this.name,
              serverKey,
              threshold,
              playerCount
            );
          }
          state.firedByThreshold[thresholdKey] = false;
        }
        const crossedUp = previousCount < threshold && playerCount >= threshold;
        if (crossedUp && !state.firedByThreshold[thresholdKey]) {
          this.logger.logInformation(
            "{Name}: Threshold crossed upward server={Server} threshold={Threshold} previous={Previous} current={Current}",
            this.name,
            serverKey,
            threshold,
            previousCount,
            playerCount
          );
          this.handleThresholdCrossing(alert, serverKey, serverName, playerCount, mapName, false, meta.source || "threshold_cross");
          state.firedByThreshold[thresholdKey] = true;
        }
      }
      state.lastCount = playerCount;
      this.runtime.populationStateByServer[serverKey] = state;
    },
    applyStartupRules: function(serverKey, serverName, playerCount, mapName, state) {
      const alerts = this.config.alerts || [];
      let highestMet = null;
      for (let i = 0; i < alerts.length; i++) {
        const alert = alerts[i];
        const threshold2 = parseIntSafe(alert.threshold, 0);
        const thresholdKey = String(threshold2);
        if (playerCount >= threshold2) {
          highestMet = alert;
          state.firedByThreshold[thresholdKey] = true;
        } else {
          state.firedByThreshold[thresholdKey] = false;
        }
      }
      if (!highestMet) {
        this.logger.logInformation(
          "{Name}: Startup snapshot below all thresholds for {Server} (count={Count})",
          this.name,
          serverKey,
          playerCount
        );
        return;
      }
      if (playerCount >= MAX_PLAYERS) {
        this.logger.logInformation(
          "{Name}: Startup snapshot at full capacity for {Server} (count={Count}); startup alert skipped",
          this.name,
          serverKey,
          playerCount
        );
        return;
      }
      const threshold = parseIntSafe(highestMet.threshold, 0);
      this.logger.logInformation(
        "{Name}: Startup snapshot met threshold {Threshold} for {Server} (count={Count}); sending highest-threshold startup alert",
        this.name,
        threshold,
        serverKey,
        playerCount
      );
      this.handleThresholdCrossing(highestMet, serverKey, serverName, playerCount, mapName, true, "startup_snapshot");
    },
    canSendGlobalNotify: function() {
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
        remainingMs
      };
    },
    setGlobalNotifyNow: function() {
      this.runtime.globalNotifyLastAtMs = Date.now();
    },
    buildNotifyPayload: function(alert, serverKey, serverName, playerCount, mapName, isStartup) {
      const threshold = parseIntSafe(alert.threshold, 0);
      const context = buildMessageContext(serverName, serverKey, playerCount, threshold);
      const renderedBody = formatPopulationMessage(alert.message, context);
      let content = NOTIFY_MENTION_PREFIX + " " + renderedBody;
      content += "\nServer: **" + serverName + "** (`" + serverKey + "`)";
      content += "\nPopulation: **" + playerCount + "/" + MAX_PLAYERS + "**";
      content += "\nMap: **" + (mapName || "unknown") + "**";
      if (isStartup) {
        content += "\n(Startup snapshot)";
      }
      const payload = {
        content,
        allowed_mentions: {
          parse: ["everyone"]
        }
      };
      const imageUrl = resolveMapImageUrl(this.config.mapImageUrls, mapName || "");
      if (imageUrl) {
        payload.embeds = [
          {
            title: serverName,
            description: "Threshold reached: **" + threshold + "**",
            image: { url: imageUrl },
            color: 15158332
          }
        ];
      }
      return payload;
    },
    handleThresholdCrossing: function(alert, serverKey, serverName, playerCount, mapName, isStartup, source) {
      if (!this.dispatcher || this.dispatcher.count === 0) {
        if (!this.runtime.missingNotifierWarned) {
          this.logger.logWarning("{Name}: Alert suppressed because no notifier destination is configured.", this.name);
          this.runtime.missingNotifierWarned = true;
        }
        return;
      }
      if (this.runtime.globalNotifyDispatchInFlight) {
        this.logger.logInformation(
          "{Name}: Notify suppressed because another notify dispatch is currently in-flight server={Server} threshold={Threshold} source={Source}",
          this.name,
          serverKey,
          parseIntSafe(alert.threshold, 0),
          String(source || "unknown")
        );
        return;
      }
      const cooldown = this.canSendGlobalNotify();
      if (!cooldown.allowed) {
        const remainingMinutes = Math.ceil(cooldown.remainingMs / 6e4);
        this.logger.logInformation(
          "{Name}: Notify suppressed by global cooldown server={Server} threshold={Threshold} remaining_minutes={Remaining} source={Source}",
          this.name,
          serverKey,
          parseIntSafe(alert.threshold, 0),
          remainingMinutes,
          String(source || "unknown")
        );
        return;
      }
      this.runtime.globalNotifyDispatchInFlight = true;
      this.setGlobalNotifyNow();
      this.sendNotifyMessage(alert, serverKey, serverName, playerCount, mapName, isStartup, source, () => {
        this.runtime.globalNotifyDispatchInFlight = false;
      });
    },
    sendNotifyMessage: function(alert, serverKey, serverName, playerCount, mapName, isStartup, source, done) {
      const payload = this.buildNotifyPayload(alert, serverKey, serverName, playerCount, mapName, isStartup);
      const existingMessageId = this.runtime.notifyMessageIdByServer[serverKey] || "";
      this.logger.logInformation(
        "{Name}: Dispatching notify message server={Server} threshold={Threshold} startup={Startup} source={Source} existing_message_id={ExistingId}",
        this.name,
        serverKey,
        parseIntSafe(alert.threshold, 0),
        isStartup === true ? "yes" : "no",
        String(source || "unknown"),
        existingMessageId || "(none)"
      );
      this.dispatcher.upsertMessage(
        this,
        existingMessageId,
        payload,
        { type: "notify", serverKey },
        (ok, messageId, errorText) => {
          if (!ok) {
            this.logger.logWarning(
              "{Name}: Failed to dispatch notify message for {Server} - {Error}",
              this.name,
              serverKey,
              String(errorText || "unknown notify error")
            );
            if (typeof done === "function") done(false);
            return;
          }
          if (messageId) {
            this.runtime.notifyMessageIdByServer[serverKey] = String(messageId);
          }
          this.logger.logInformation(
            "{Name}: Notify message sent server={Server} threshold={Threshold} cooldown_minutes={CooldownMinutes}",
            this.name,
            serverKey,
            parseIntSafe(alert.threshold, 0),
            GLOBAL_NOTIFY_COOLDOWN_MS / 6e4
          );
          if (typeof done === "function") done(true);
        }
      );
    },
    remainingCooldownMinutes: function() {
      const cooldown = this.canSendGlobalNotify();
      if (cooldown.allowed) return 0;
      return Math.ceil(cooldown.remainingMs / 6e4);
    },
    tellStatus: function(commandEvent) {
      if (!commandEvent || !commandEvent.origin || typeof commandEvent.origin.tell !== "function") return;
      const keys = Object.keys(this.runtime.populationStateByServer || {});
      const serverSummaries = [];
      for (let i = 0; i < keys.length; i++) {
        const serverKey = keys[i];
        const state = this.runtime.populationStateByServer[serverKey] || {};
        const count = state.lastCount == null ? "?" : String(state.lastCount);
        const hasNotify = this.runtime.notifyMessageIdByServer[serverKey] ? "notify:on" : "notify:off";
        serverSummaries.push(serverKey + "=" + count + "(" + hasNotify + ")");
      }
      const cooldownMinutes = this.remainingCooldownMinutes();
      const cooldownText = cooldownMinutes > 0 ? cooldownMinutes + "m" : "ready";
      commandEvent.origin.tell(
        "Population Notifier v" + this.version + " | alerts=" + thresholdListText(this.config.alerts) + " | notifiers=" + this.notifierNamesText() + " | discord=" + (this.config.discordBotToken && this.config.discordChannelId ? "configured" : "missing") + " | cooldown=" + cooldownText + " | status_msgs=" + Object.keys(this.runtime.statusMessageIdByServer || {}).length + " | notify_msgs=" + Object.keys(this.runtime.notifyMessageIdByServer || {}).length + " | servers=" + (serverSummaries.length > 0 ? serverSummaries.join(", ") : "(none)")
      );
    }
  };
  var init = (registerNotify, serviceResolver, configWrapper, pluginHelper) => {
    registerNotify(
      "IManagementEventSubscriptions.ClientStateInitialized",
      (eventObj, _token) => plugin.onClientStateInitialized(eventObj)
    );
    registerNotify(
      "IGameEventSubscriptions.MatchEnded",
      (eventObj, _token) => plugin.onMatchEnded(eventObj)
    );
    try {
      registerNotify(
        "IManagementEventSubscriptions.ClientStateDisposed",
        (eventObj, _token) => plugin.onClientStateDisposed(eventObj)
      );
    } catch (_error) {
      if (plugin.logger) {
        plugin.logger.logWarning("{Name}: ClientStateDisposed subscription unavailable; relying on other events.", plugin.name);
      }
    }
    try {
      registerNotify(
        "IGameServerEventSubscriptions.MonitoringStarted",
        (eventObj, _token) => plugin.onServerMonitoringStarted(eventObj)
      );
    } catch (_error) {
      if (plugin.logger) {
        plugin.logger.logWarning("{Name}: MonitoringStarted subscription unavailable.", plugin.name);
      }
    }
    try {
      registerNotify(
        "IGameEventSubscriptions.MatchStarted",
        (eventObj, _token) => plugin.onMatchStarted(eventObj)
      );
    } catch (_error) {
      if (plugin.logger) {
        plugin.logger.logWarning("{Name}: MatchStarted subscription unavailable.", plugin.name);
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
