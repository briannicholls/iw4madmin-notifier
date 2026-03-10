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
      message: "{serverName} is getting active."
    },
    {
      threshold: 6,
      message: "{serverName} is filling up."
    },
    {
      threshold: 11,
      message: "{serverName} is getting crowded."
    }
  ];
  var LEGACY_DEFAULT_ALERT_MESSAGES = [
    "[Join] {serverName} has activity ({playerCount}/{maxPlayers}).",
    "[Warmup] {serverName} reached {playerCount}/{maxPlayers} players.",
    "[Hot] {serverName} reached {playerCount}/{maxPlayers} players. {slotsRemaining} slots left."
  ];
  var defaultConfig = {
    alerts: DEFAULT_ALERTS.map(copyAlert),
    discordBotToken: "",
    discordChannelId: "",
    thumbnailBaseUrl: "",
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
      return "{serverName} is getting active.";
    }
    if (threshold <= 6) {
      return "{serverName} is filling up.";
    }
    return "{serverName} is getting crowded.";
  }
  function normalizeAlertMessage(threshold, message) {
    const raw = String(message == null ? "" : message).trim();
    if (!raw) return defaultMessageForThreshold(threshold);
    if (LEGACY_DEFAULT_ALERT_MESSAGES.indexOf(raw) !== -1) {
      return defaultMessageForThreshold(threshold);
    }
    return raw;
  }
  function sanitizeAlerts(inputAlerts) {
    const rawAlerts = Array.isArray(inputAlerts) ? inputAlerts : [];
    const dedupe = {};
    for (let i = 0; i < rawAlerts.length; i++) {
      const current = rawAlerts[i] || {};
      const thresholdRaw = parseIntSafe(current.threshold, -1);
      if (thresholdRaw < 1) continue;
      const threshold = thresholdRaw > MAX_PLAYERS ? MAX_PLAYERS : thresholdRaw;
      const message = normalizeAlertMessage(threshold, current.message);
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
      thumbnailBaseUrl: String(source.thumbnailBaseUrl == null ? "" : source.thumbnailBaseUrl).trim(),
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

  // src/event-extractors.js
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
  function extractNetworkIdFromClient(client) {
    if (!client) return "";
    return normalizeNetworkId(
      client.networkId || client.NetworkId || client.networkID || client.NetworkID || client.xuid || client.Xuid || client.guid || client.Guid || null
    );
  }

  // src/server-metadata.js
  function textFromUnknown(value) {
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return cleanName(String(value));
    }
    try {
      if (typeof value.toString === "function") {
        const rendered = cleanName(value.toString());
        if (rendered && rendered !== "[object Object]") return rendered;
      }
    } catch (_) {
    }
    return "";
  }
  function pickCleanString(values) {
    const list = Array.isArray(values) ? values : [];
    for (let i = 0; i < list.length; i++) {
      const cleaned = textFromUnknown(list[i]);
      if (cleaned) return cleaned;
    }
    return "";
  }
  function listKeys(value, maxCount) {
    if (!value) return "(none)";
    const keys = [];
    try {
      const own = Object.keys(value);
      for (let i = 0; i < own.length; i++) keys.push(String(own[i]));
    } catch (_) {
    }
    try {
      for (const key in value) {
        keys.push(String(key));
      }
    } catch (_) {
    }
    const unique = Array.from(new Set(keys)).sort();
    if (unique.length === 0) return "(none)";
    const limit = Math.max(10, parseIntSafe(maxCount, 80));
    return unique.slice(0, limit).join(",") + (unique.length > limit ? ",...(truncated)" : "");
  }
  function mergeNamedInfo(primary, secondary) {
    const left = primary || {};
    const right = secondary || {};
    return {
      readable: pickCleanString([left.readable, right.readable]),
      slug: pickCleanString([left.slug, right.slug])
    };
  }
  function extractMapInfoFromObject(mapValue) {
    if (!mapValue) {
      return { readable: "", slug: "" };
    }
    if (typeof mapValue === "string") {
      return {
        readable: "",
        slug: cleanName(mapValue)
      };
    }
    return {
      readable: pickCleanString([
        mapValue.alias,
        mapValue.Alias,
        mapValue.displayName,
        mapValue.DisplayName,
        mapValue.localizedName,
        mapValue.LocalizedName
      ]),
      slug: pickCleanString([
        mapValue.name,
        mapValue.Name,
        mapValue.mapName,
        mapValue.MapName,
        mapValue.slug,
        mapValue.Slug,
        mapValue.code,
        mapValue.Code,
        mapValue.id,
        mapValue.Id,
        mapValue
      ])
    };
  }
  function extractMapInfoFromServer(server) {
    if (!server) {
      return { readable: "", slug: "" };
    }
    const fromCurrentMap = extractMapInfoFromObject(server.currentMap || server.CurrentMap);
    const fromMap = extractMapInfoFromObject(server.map || server.Map);
    const merged = mergeNamedInfo(fromCurrentMap, fromMap);
    return {
      readable: pickCleanString([
        merged.readable,
        server.mapAlias,
        server.MapAlias,
        server.currentMapAlias,
        server.CurrentMapAlias
      ]),
      slug: pickCleanString([
        merged.slug,
        server.mapName,
        server.MapName,
        server.currentMapName,
        server.CurrentMapName
      ])
    };
  }
  function extractMapInfoFromEvent(eventObj) {
    if (!eventObj) {
      return { readable: "", slug: "" };
    }
    const direct = {
      readable: pickCleanString([
        eventObj.mapAlias,
        eventObj.MapAlias,
        eventObj.currentMapAlias,
        eventObj.CurrentMapAlias
      ]),
      slug: pickCleanString([
        eventObj.mapName,
        eventObj.MapName,
        eventObj.newMap,
        eventObj.NewMap,
        eventObj.currentMapName,
        eventObj.CurrentMapName
      ])
    };
    const fromObject = extractMapInfoFromObject(
      eventObj.currentMap || eventObj.CurrentMap || eventObj.newCurrentMap || eventObj.NewCurrentMap
    );
    const fromServer = extractMapInfoFromServer(extractServerFromEvent(eventObj));
    return mergeNamedInfo(direct, mergeNamedInfo(fromObject, fromServer));
  }
  function extractModeInfoFromServer(server) {
    if (!server) {
      return { readable: "", slug: "" };
    }
    return {
      readable: pickCleanString([
        server.gametypeName,
        server.GametypeName,
        server.gameTypeName,
        server.GameTypeName,
        server.gameModeName,
        server.GameModeName,
        server.modeName,
        server.ModeName
      ]),
      slug: pickCleanString([
        server.gameType,
        server.GameType,
        server.gametype,
        server.Gametype,
        server.gameMode,
        server.GameMode,
        server.mode,
        server.Mode,
        server.gameTypeCode,
        server.GameTypeCode,
        server.gametypeCode,
        server.GametypeCode
      ])
    };
  }
  function extractModeInfoFromEvent(eventObj) {
    if (!eventObj) {
      return { readable: "", slug: "" };
    }
    const direct = {
      readable: pickCleanString([
        eventObj.gametypeName,
        eventObj.GametypeName,
        eventObj.gameTypeName,
        eventObj.GameTypeName,
        eventObj.gameModeName,
        eventObj.GameModeName
      ]),
      slug: pickCleanString([
        eventObj.gameType,
        eventObj.GameType,
        eventObj.gametype,
        eventObj.Gametype,
        eventObj.gameMode,
        eventObj.GameMode
      ])
    };
    const fromServer = extractModeInfoFromServer(extractServerFromEvent(eventObj));
    return mergeNamedInfo(direct, fromServer);
  }
  function formatNamedInfoForStatus(info, unknownValue) {
    const readable = pickCleanString([info && info.readable]);
    const slug = pickCleanString([info && info.slug]);
    if (readable && slug && readable.toLowerCase() !== slug.toLowerCase()) {
      return readable + " (`" + slug + "`)";
    }
    if (readable) return readable;
    if (slug) return "`" + slug + "`";
    return unknownValue || "unknown";
  }

  // src/server-discovery.js
  function collectServersFromManager(manager) {
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

  // src/generated/t6-thumbnail-manifest.js
  var T6_THUMBNAIL_FILES = {
    "buried_zclassic_processing": "loadscreen_buried_zclassic_processing.jpg",
    "buried_zcleansed_street": "loadscreen_buried_zcleansed_street.jpg",
    "buried_zgrief_street": "loadscreen_buried_zgrief_street.jpg",
    "dierise": "loadscreen_dierise.jpg",
    "mp_bridge": "loadscreen_mp_bridge.jpg",
    "mp_carrier": "loadscreen_mp_carrier.jpg",
    "mp_castaway": "loadscreen_mp_castaway.jpg",
    "mp_concert": "loadscreen_mp_concert.jpg",
    "mp_dig": "loadscreen_mp_dig.jpg",
    "mp_dockside": "loadscreen_mp_dockside.jpg",
    "mp_downhill": "loadscreen_mp_downhill.jpg",
    "mp_drone": "loadscreen_mp_drone.jpg",
    "mp_express": "loadscreen_mp_express.jpg",
    "mp_frostbite": "loadscreen_mp_frostbite.jpg",
    "mp_hijacked": "loadscreen_mp_hijacked.jpg",
    "mp_hydro": "loadscreen_mp_hydro.jpg",
    "mp_la": "loadscreen_mp_la.jpg",
    "mp_magma": "loadscreen_mp_magma.jpg",
    "mp_meltdown": "loadscreen_mp_meltdown.jpg",
    "mp_mirage": "loadscreen_mp_mirage.jpg",
    "mp_nightclub": "loadscreen_mp_nightclub.jpg",
    "mp_nuketown_2020": "loadscreen_mp_nuketown_2020.jpg",
    "mp_overflow": "loadscreen_mp_overflow.jpg",
    "mp_paintball": "loadscreen_mp_paintball.jpg",
    "mp_podville": "loadscreen_mp_podville.jpg",
    "mp_raid": "loadscreen_mp_raid.jpg",
    "mp_skate": "loadscreen_mp_skate.jpg",
    "mp_slums": "loadscreen_mp_slums.jpg",
    "mp_socotra": "loadscreen_mp_socotra.jpg",
    "mp_studio": "loadscreen_mp_studio.jpg",
    "mp_takeoff": "loadscreen_mp_takeoff.jpg",
    "mp_turbine": "loadscreen_mp_turbine.jpg",
    "mp_uplink": "loadscreen_mp_uplink.jpg",
    "mp_vertigo": "loadscreen_mp_vertigo.jpg",
    "mp_village": "loadscreen_mp_village.jpg",
    "transit_classic": "loadscreen_transit_classic.jpg",
    "transit_dr_returned_diner": "loadscreen_transit_dr_returned_diner.jpg",
    "transit_grief_busdepot": "loadscreen_transit_grief_busdepot.jpg",
    "transit_grief_farm": "loadscreen_transit_grief_farm.jpg",
    "transit_grief_town": "loadscreen_transit_grief_town.jpg",
    "transit_standard_busdepot": "loadscreen_transit_standard_busdepot.jpg",
    "transit_standard_farm": "loadscreen_transit_standard_farm.jpg",
    "transit_standard_town": "loadscreen_transit_standard_town.jpg",
    "zm_factory": "loadscreen_zm_factory.jpg",
    "zm_hellcatraz": "loadscreen_zm_hellcatraz.jpg",
    "zm_meat": "loadscreen_zm_meat.jpg",
    "zm_moon": "loadscreen_zm_moon.jpg",
    "zm_nuketown": "loadscreen_zm_nuketown.jpg",
    "zm_prototype": "loadscreen_zm_prototype.jpg",
    "zombie_le_tombeau": "loadscreen_zombie_le_tombeau.jpg"
  };

  // src/t6-thumbnails.js
  function normalizeBaseUrl(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    return raw.replace(/\/+$/, "");
  }
  function resolveT6ThumbnailUrl(baseUrl, mapSlug) {
    const base = normalizeBaseUrl(baseUrl);
    if (!base) return "";
    const slug = normalizeMapKey(mapSlug);
    if (!slug) return "";
    const fileName = T6_THUMBNAIL_FILES[slug];
    if (!fileName) return "";
    return base + "/" + fileName;
  }

  // src/status-channel.js
  function statusColor(plugin2, playerCount) {
    const count = parseIntSafe(playerCount, 0);
    const alerts = plugin2.config && plugin2.config.alerts ? plugin2.config.alerts : [];
    let highestThreshold = 0;
    for (let i = 0; i < alerts.length; i++) {
      const threshold = parseIntSafe(alerts[i].threshold, 0);
      if (count >= threshold && threshold > highestThreshold) highestThreshold = threshold;
    }
    if (highestThreshold >= 11) return 15158332;
    if (highestThreshold >= 6) return 15844367;
    if (highestThreshold >= 1) return 3066993;
    return 3447003;
  }
  function buildStatusPayload(plugin2, serverName, playerCount, mapInfo, modeInfo) {
    const mapReadable = pickCleanString([mapInfo && mapInfo.readable]);
    const mapSlug = pickCleanString([mapInfo && mapInfo.slug]);
    const mapText = mapReadable || "unknown";
    const modeText = formatNamedInfoForStatus(modeInfo, "unknown");
    const imageLookupName = mapSlug || mapReadable;
    const imageUrl = resolveMapImageUrl(plugin2.config && plugin2.config.mapImageUrls, imageLookupName) || resolveT6ThumbnailUrl(plugin2.config && plugin2.config.thumbnailBaseUrl, mapSlug);
    const embed = {
      title: serverName,
      description: "Players: **" + playerCount + "/" + MAX_PLAYERS + "**\nMap: " + mapText + "\nMode: " + modeText,
      color: statusColor(plugin2, playerCount)
    };
    if (imageUrl) {
      embed.image = { url: imageUrl };
    }
    return {
      content: "",
      embeds: [embed],
      allowed_mentions: { parse: [] }
    };
  }
  function ensureStatusSyncState(plugin2, serverKey) {
    let sync = plugin2.runtime.statusSyncByServer[serverKey];
    if (!sync) {
      sync = {
        inFlight: false,
        pending: null
      };
      plugin2.runtime.statusSyncByServer[serverKey] = sync;
    }
    return sync;
  }
  function dispatchStatusUpsert(plugin2, serverKey, update) {
    const sync = ensureStatusSyncState(plugin2, serverKey);
    sync.inFlight = true;
    const existingMessageId = plugin2.runtime.statusMessageIdByServer[serverKey] || "";
    plugin2.dispatcher.upsertMessage(
      plugin2,
      existingMessageId,
      update.payload,
      { type: "status", serverKey },
      (ok, messageId, errorText, details) => {
        sync.inFlight = false;
        if (!ok) {
          const retryAfterMs = Math.max(1e3, parseIntSafe(details && details.retryAfterMs, 5e3));
          plugin2.runtime.statusRetryAtByServer[serverKey] = Date.now() + retryAfterMs;
          plugin2.logger.logWarning(
            "{Name}: Failed to upsert status message for {Server} - {Error} (retry_ms={RetryMs})",
            plugin2.name,
            serverKey,
            String(errorText || "unknown upsert error"),
            retryAfterMs
          );
          if (plugin2.pluginHelper && typeof plugin2.pluginHelper.requestNotifyAfterDelay === "function") {
            plugin2.pluginHelper.requestNotifyAfterDelay(retryAfterMs, () => {
              ensureStatusMessage(plugin2, serverKey, update.serverName, update.playerCount, update.mapInfo, update.modeInfo);
            });
          }
        } else {
          plugin2.runtime.statusRetryAtByServer[serverKey] = 0;
          if (messageId) {
            plugin2.runtime.statusMessageIdByServer[serverKey] = String(messageId);
          }
          plugin2.runtime.statusFingerprintByServer[serverKey] = update.fingerprint;
        }
        const pending = sync.pending;
        sync.pending = null;
        if (pending) {
          ensureStatusMessage(
            plugin2,
            serverKey,
            pending.serverName,
            pending.playerCount,
            pending.mapInfo,
            pending.modeInfo
          );
        }
      }
    );
  }
  function ensureStatusMessage(plugin2, serverKey, serverName, playerCount, mapInfo, modeInfo) {
    if (!plugin2.dispatcher || plugin2.dispatcher.count === 0) return;
    const existingMessageId = plugin2.runtime.statusMessageIdByServer[serverKey] || "";
    if (!existingMessageId && playerCount <= 0) {
      return;
    }
    const payload = buildStatusPayload(plugin2, serverName, playerCount, mapInfo, modeInfo);
    const fingerprint = JSON.stringify(payload);
    const existingFingerprint = plugin2.runtime.statusFingerprintByServer[serverKey] || "";
    if (existingMessageId && existingFingerprint === fingerprint) {
      return;
    }
    const update = {
      serverName,
      playerCount,
      mapInfo,
      modeInfo,
      payload,
      fingerprint
    };
    const sync = ensureStatusSyncState(plugin2, serverKey);
    if (sync.inFlight) {
      sync.pending = update;
      return;
    }
    const nowMs = Date.now();
    const retryAtMs = parseIntSafe(plugin2.runtime.statusRetryAtByServer[serverKey], 0);
    if (retryAtMs > nowMs) {
      sync.pending = update;
      return;
    }
    dispatchStatusUpsert(plugin2, serverKey, update);
  }

  // src/threshold-notify.js
  function canSendGlobalNotify(plugin2) {
    const nowMs = Date.now();
    const lastAtMs = parseIntSafe(plugin2.runtime.globalNotifyLastAtMs, 0);
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
  }
  function setGlobalNotifyNow(plugin2) {
    plugin2.runtime.globalNotifyLastAtMs = Date.now();
  }
  function remainingCooldownMinutes(plugin2) {
    const cooldown = canSendGlobalNotify(plugin2);
    if (cooldown.allowed) return 0;
    return Math.ceil(cooldown.remainingMs / 6e4);
  }
  function maybeDeleteNotifyForLowPopulation(plugin2, serverKey, playerCount, source) {
    if (playerCount >= NOTIFY_CLEAR_BELOW_COUNT) return;
    const messageId = plugin2.runtime.notifyMessageIdByServer[serverKey] || "";
    if (!messageId) return;
    if (plugin2.runtime.notifyDeleteInFlightByServer[serverKey]) return;
    plugin2.runtime.notifyDeleteInFlightByServer[serverKey] = true;
    if (!plugin2.dispatcher || plugin2.dispatcher.count === 0) {
      plugin2.runtime.notifyDeleteInFlightByServer[serverKey] = false;
      return;
    }
    plugin2.logger.logInformation(
      "{Name}: Population below {Minimum} on {Server} (count={Count}, source={Source}); deleting active notify message",
      plugin2.name,
      NOTIFY_CLEAR_BELOW_COUNT,
      serverKey,
      playerCount,
      String(source || "unknown")
    );
    plugin2.dispatcher.deleteMessage(plugin2, messageId, { type: "notify", serverKey }, (ok, errorText) => {
      plugin2.runtime.notifyDeleteInFlightByServer[serverKey] = false;
      if (!ok) {
        plugin2.logger.logWarning(
          "{Name}: Failed to delete active notify message for {Server} - {Error}",
          plugin2.name,
          serverKey,
          String(errorText || "unknown delete error")
        );
        return;
      }
      delete plugin2.runtime.notifyMessageIdByServer[serverKey];
    });
  }
  function buildNotifyPayload(alert, serverKey, serverName, playerCount) {
    const threshold = parseIntSafe(alert.threshold, 0);
    const context = buildMessageContext(serverName, serverKey, playerCount, threshold);
    let sentence = formatPopulationMessage(alert.message, context);
    sentence = String(sentence || "").replace(/\s+/g, " ").trim();
    if (!sentence) {
      sentence = serverName + " is filling up.";
    }
    if (!/[.!?]$/.test(sentence)) {
      sentence += ".";
    }
    const content = NOTIFY_MENTION_PREFIX + " " + sentence;
    return {
      content,
      allowed_mentions: {
        parse: ["everyone"]
      }
    };
  }
  function sendNotifyMessage(plugin2, alert, serverKey, serverName, playerCount, isStartup, source, done) {
    const payload = buildNotifyPayload(alert, serverKey, serverName, playerCount);
    const existingMessageId = plugin2.runtime.notifyMessageIdByServer[serverKey] || "";
    plugin2.logger.logInformation(
      "{Name}: Dispatching notify message server={Server} threshold={Threshold} startup={Startup} source={Source} existing_message_id={ExistingId}",
      plugin2.name,
      serverKey,
      parseIntSafe(alert.threshold, 0),
      isStartup === true ? "yes" : "no",
      String(source || "unknown"),
      existingMessageId || "(none)"
    );
    plugin2.dispatcher.upsertMessage(
      plugin2,
      existingMessageId,
      payload,
      { type: "notify", serverKey },
      (ok, messageId, errorText) => {
        if (!ok) {
          plugin2.logger.logWarning(
            "{Name}: Failed to dispatch notify message for {Server} - {Error}",
            plugin2.name,
            serverKey,
            String(errorText || "unknown notify error")
          );
          if (typeof done === "function") done(false);
          return;
        }
        if (messageId) {
          plugin2.runtime.notifyMessageIdByServer[serverKey] = String(messageId);
        }
        plugin2.logger.logInformation(
          "{Name}: Notify message sent server={Server} threshold={Threshold} cooldown_minutes={CooldownMinutes}",
          plugin2.name,
          serverKey,
          parseIntSafe(alert.threshold, 0),
          GLOBAL_NOTIFY_COOLDOWN_MS / 6e4
        );
        if (typeof done === "function") done(true);
      }
    );
  }
  function handleThresholdCrossing(plugin2, alert, serverKey, serverName, playerCount, isStartup, source) {
    if (!plugin2.dispatcher || plugin2.dispatcher.count === 0) {
      if (!plugin2.runtime.missingNotifierWarned) {
        plugin2.logger.logWarning("{Name}: Alert suppressed because no notifier destination is configured.", plugin2.name);
        plugin2.runtime.missingNotifierWarned = true;
      }
      return;
    }
    if (plugin2.runtime.globalNotifyDispatchInFlight) {
      plugin2.logger.logInformation(
        "{Name}: Notify suppressed because another notify dispatch is currently in-flight server={Server} threshold={Threshold} source={Source}",
        plugin2.name,
        serverKey,
        parseIntSafe(alert.threshold, 0),
        String(source || "unknown")
      );
      return;
    }
    const cooldown = canSendGlobalNotify(plugin2);
    if (!cooldown.allowed) {
      const remainingMinutes = Math.ceil(cooldown.remainingMs / 6e4);
      plugin2.logger.logInformation(
        "{Name}: Notify suppressed by global cooldown server={Server} threshold={Threshold} remaining_minutes={Remaining} source={Source}",
        plugin2.name,
        serverKey,
        parseIntSafe(alert.threshold, 0),
        remainingMinutes,
        String(source || "unknown")
      );
      return;
    }
    plugin2.runtime.globalNotifyDispatchInFlight = true;
    setGlobalNotifyNow(plugin2);
    sendNotifyMessage(plugin2, alert, serverKey, serverName, playerCount, isStartup, source, () => {
      plugin2.runtime.globalNotifyDispatchInFlight = false;
    });
  }

  // src/population-engine.js
  function applyStartupRules(plugin2, serverKey, serverName, playerCount, state) {
    const alerts = plugin2.config.alerts || [];
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
      plugin2.logger.logInformation(
        "{Name}: Startup snapshot below all thresholds for {Server} (count={Count})",
        plugin2.name,
        serverKey,
        playerCount
      );
      return;
    }
    if (playerCount >= MAX_PLAYERS) {
      plugin2.logger.logInformation(
        "{Name}: Startup snapshot at full capacity for {Server} (count={Count}); startup alert skipped",
        plugin2.name,
        serverKey,
        playerCount
      );
      return;
    }
    const threshold = parseIntSafe(highestMet.threshold, 0);
    plugin2.logger.logInformation(
      "{Name}: Startup snapshot met threshold {Threshold} for {Server} (count={Count}); sending highest-threshold startup alert",
      plugin2.name,
      threshold,
      serverKey,
      playerCount
    );
    handleThresholdCrossing(plugin2, highestMet, serverKey, serverName, playerCount, true, "startup_snapshot");
  }
  function evaluatePopulation(plugin2, serverKey, serverName, playerCount, observationMeta) {
    const alerts = plugin2.config.alerts || [];
    if (alerts.length === 0) return;
    const meta = observationMeta || {};
    let state = plugin2.runtime.populationStateByServer[serverKey];
    if (!state) {
      state = {
        initialized: false,
        lastCount: null,
        firedByThreshold: {}
      };
    }
    maybeDeleteNotifyForLowPopulation(plugin2, serverKey, playerCount, meta.source || "unknown");
    if (!state.initialized) {
      plugin2.logger.logInformation(
        "{Name}: Initial population snapshot source={Source} server={Server} count={Count} via={CountSource} thresholds={Thresholds}",
        plugin2.name,
        meta.source || "unknown",
        serverKey,
        playerCount,
        meta.countSource || "unknown",
        thresholdListText(alerts)
      );
      applyStartupRules(plugin2, serverKey, serverName, playerCount, state);
      state.initialized = true;
      state.lastCount = playerCount;
      plugin2.runtime.populationStateByServer[serverKey] = state;
      return;
    }
    const previousCount = parseIntSafe(state.lastCount, playerCount);
    if (previousCount !== playerCount) {
      plugin2.logger.logInformation(
        "{Name}: Population changed source={Source} server={Server} previous={Previous} current={Current} via={CountSource} tracked_ids={TrackedIds}",
        plugin2.name,
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
          plugin2.logger.logInformation(
            "{Name}: Threshold reset server={Server} threshold={Threshold} count={Count}",
            plugin2.name,
            serverKey,
            threshold,
            playerCount
          );
        }
        state.firedByThreshold[thresholdKey] = false;
      }
      const crossedUp = previousCount < threshold && playerCount >= threshold;
      if (crossedUp && !state.firedByThreshold[thresholdKey]) {
        plugin2.logger.logInformation(
          "{Name}: Threshold crossed upward server={Server} threshold={Threshold} previous={Previous} current={Current}",
          plugin2.name,
          serverKey,
          threshold,
          previousCount,
          playerCount
        );
        handleThresholdCrossing(plugin2, alert, serverKey, serverName, playerCount, false, meta.source || "threshold_cross");
        state.firedByThreshold[thresholdKey] = true;
      }
    }
    state.lastCount = playerCount;
    plugin2.runtime.populationStateByServer[serverKey] = state;
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
        "{Name}: Discord config token_set={TokenSet} channel_set={ChannelSet} thumbnail_base_url_set={ThumbnailSet} map_images={MapImages}",
        this.name,
        this.config.discordBotToken ? "yes" : "no",
        this.config.discordChannelId ? "yes" : "no",
        this.config.thumbnailBaseUrl ? "yes" : "no",
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
    bootstrapKnownServers: function() {
      const servers = collectServersFromManager(this.manager);
      this.logger.logInformation(
        "{Name}: bootstrapKnownServers discovered {Count} server(s) from manager",
        this.name,
        servers.length
      );
      for (let i = 0; i < servers.length; i++) {
        const server = servers[i];
        this.observeServerPopulation(
          server,
          null,
          false,
          "bootstrap_manager",
          extractMapInfoFromServer(server),
          extractModeInfoFromServer(server),
          true
        );
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
        const mapInfo = mergeNamedInfo(this.runtime.mapInfoByServer[serverKey], extractMapInfoFromServer(server));
        const modeInfo = mergeNamedInfo(this.runtime.modeInfoByServer[serverKey], extractModeInfoFromServer(server));
        ensureStatusMessage(this, serverKey, serverName, count, mapInfo, modeInfo);
      }
    },
    onClientStateInitialized: function(eventObj) {
      const server = extractServerFromEvent(eventObj);
      const client = extractClientFromEvent(eventObj);
      this.observeServerPopulation(
        server,
        client,
        false,
        "client_state_initialized",
        extractMapInfoFromEvent(eventObj),
        extractModeInfoFromEvent(eventObj),
        false
      );
    },
    onClientStateDisposed: function(eventObj) {
      const server = extractServerFromEvent(eventObj);
      const client = extractClientFromEvent(eventObj);
      this.observeServerPopulation(
        server,
        client,
        true,
        "client_state_disposed",
        extractMapInfoFromEvent(eventObj),
        extractModeInfoFromEvent(eventObj),
        false
      );
    },
    onServerMonitoringStarted: function(eventObj) {
      const server = extractServerFromEvent(eventObj);
      this.observeServerPopulation(
        server,
        null,
        false,
        "monitoring_started",
        extractMapInfoFromEvent(eventObj),
        extractModeInfoFromEvent(eventObj),
        true
      );
    },
    onMatchStarted: function(eventObj) {
      const server = extractServerFromEvent(eventObj);
      this.observeServerPopulation(
        server,
        null,
        false,
        "match_started",
        extractMapInfoFromEvent(eventObj),
        extractModeInfoFromEvent(eventObj),
        false
      );
    },
    onMatchEnded: function(eventObj) {
      const server = extractServerFromEvent(eventObj);
      this.observeServerPopulation(
        server,
        null,
        false,
        "match_ended",
        extractMapInfoFromEvent(eventObj),
        extractModeInfoFromEvent(eventObj),
        false
      );
    },
    observeServerPopulation: function(server, client, isDisconnect, source, mapHint, modeHint, isBootstrap) {
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
        this.logger.logInformation(
          "{Name}: PROBE server={Server} server_keys={Keys}",
          this.name,
          serverKey,
          listKeys(server, 120)
        );
        this.logger.logInformation(
          "{Name}: PROBE server={Server} map_keys={MapKeys} mode_type={ModeType}",
          this.name,
          serverKey,
          listKeys(server.currentMap || server.CurrentMap || server.map || server.Map, 80),
          textFromUnknown(server.gameType || server.GameType || server.gametype || server.Gametype || "(none)")
        );
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
      let countSource = "server";
      if (playerCount < 0) {
        playerCount = trackedCount;
        countSource = "tracked_ids";
      } else if (networkId) {
        if (isDisconnect && trackedCount < playerCount) {
          playerCount = trackedCount;
          countSource = "tracked_ids_disconnect";
        } else if (!isDisconnect && trackedCount > playerCount) {
          playerCount = trackedCount;
          countSource = "tracked_ids_connect";
        }
      }
      if (playerCount < 0) {
        this.logger.logWarning(
          "{Name}: Population observation produced invalid count (source={Source}, server={Server})",
          this.name,
          String(source || "unknown"),
          serverKey
        );
        return;
      }
      ensureStatusMessage(this, serverKey, serverName, playerCount, mapInfo, modeInfo);
      evaluatePopulation(this, serverKey, serverName, playerCount, {
        source: String(source || "unknown"),
        countSource,
        directCount,
        activeCount: trackedCount,
        networkId,
        isDisconnect: isDisconnect === true,
        isBootstrap: isBootstrap === true
      });
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
      const cooldownMinutes = remainingCooldownMinutes(this);
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
