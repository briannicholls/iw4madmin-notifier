"use strict";
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

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    commands: () => commands,
    init: () => init,
    plugin: () => plugin
  });

  // src/utils.js
  function cleanName(value) {
    return String(value == null ? "" : value).replace(/\^./g, "").replace(/[\x00-\x1F\x7F]/g, "").trim();
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
  var LOW_POPULATION_GRACE_MS = 90 * 1e3;
  var NOTIFY_MENTION_PREFIX = "@here";
  var DEFAULT_THUMBNAIL_BASE_URL = "https://iw4m.s3.us-east-2.amazonaws.com";
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
    discordRoleId: "",
    iw4mApiBaseUrl: ""
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
  function sanitizeConfig(rawConfig) {
    const source = rawConfig || {};
    return {
      alerts: sanitizeAlerts(source.alerts),
      discordBotToken: String(source.discordBotToken == null ? "" : source.discordBotToken).trim(),
      discordChannelId: String(source.discordChannelId == null ? "" : source.discordChannelId).trim(),
      discordRoleId: String(source.discordRoleId == null ? "" : source.discordRoleId).trim(),
      iw4mApiBaseUrl: String(source.iw4mApiBaseUrl == null ? "" : source.iw4mApiBaseUrl).trim()
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

  // src/infrastructure/notifiers/discord/http-client.js
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
  function parseDiscordErrorCode(parsed) {
    return parseDiscordCode(parsed);
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

  // src/infrastructure/notifiers/discord/message-ops.js
  function createMessageOps(createUrl, meUrl, channelMessagesUrl, headers) {
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
    function getCurrentBotUserId(plugin2, done) {
      requestJson(plugin2, meUrl, "GET", null, headers, function(result) {
        if (!result.ok) {
          done(false, "", result.errorText || "failed to query bot identity", {
            statusCode: result.statusCode,
            retryAfterMs: result.retryAfterMs,
            isRateLimited: result.isRateLimited,
            isMissingMessage: false,
            discordCode: parseDiscordErrorCode(result.parsed)
          });
          return;
        }
        const parsed = result.parsed || {};
        const botUserId = String(parsed.id || "").trim();
        if (!botUserId) {
          done(false, "", "discord bot identity response missing id", {
            statusCode: result.statusCode,
            retryAfterMs: 0,
            isRateLimited: false,
            isMissingMessage: false,
            discordCode: 0
          });
          return;
        }
        done(true, botUserId, "", {
          statusCode: result.statusCode,
          retryAfterMs: 0,
          isRateLimited: false,
          isMissingMessage: false,
          discordCode: 0
        });
      });
    }
    function listChannelMessages(plugin2, beforeMessageId, done) {
      let url = channelMessagesUrl + "?limit=100";
      if (beforeMessageId) {
        url += "&before=" + encodeURIComponent(String(beforeMessageId));
      }
      requestJson(plugin2, url, "GET", null, headers, function(result) {
        if (!result.ok) {
          done(false, [], result.errorText || "discord list messages failed", {
            statusCode: result.statusCode,
            retryAfterMs: result.retryAfterMs,
            isRateLimited: result.isRateLimited,
            isMissingMessage: false,
            discordCode: parseDiscordErrorCode(result.parsed)
          });
          return;
        }
        const messages = Array.isArray(result.parsed) ? result.parsed : [];
        done(true, messages, "", {
          statusCode: result.statusCode,
          retryAfterMs: 0,
          isRateLimited: false,
          isMissingMessage: false,
          discordCode: 0
        });
      });
    }
    function deleteMessage(plugin2, messageId, meta, done) {
      const url = createUrl + "/" + String(messageId);
      requestJson(plugin2, url, "DELETE", null, headers, function(result) {
        if (!result.ok) {
          done(false, result.errorText || "discord delete failed", {
            statusCode: result.statusCode,
            retryAfterMs: result.retryAfterMs,
            isRateLimited: result.isRateLimited,
            isMissingMessage: result.isMissingMessage
          });
          return;
        }
        done(true, "", {
          statusCode: result.statusCode,
          retryAfterMs: 0,
          isRateLimited: false,
          isMissingMessage: false
        });
      });
    }
    return {
      createMessage,
      updateMessage,
      getCurrentBotUserId,
      listChannelMessages,
      deleteMessage
    };
  }

  // src/infrastructure/notifiers/discord/retry-policy.js
  function isRetryableStatusCode(statusCode) {
    if (!Number.isFinite(statusCode)) return false;
    return statusCode === 429 || statusCode >= 500;
  }
  function computeRetryDelayMs(details, attemptNumber, defaultDelayMs, maxDelayMs) {
    const retryAfterMs = Number(details && details.retryAfterMs);
    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
      return Math.max(1e3, Math.min(maxDelayMs, Math.round(retryAfterMs)));
    }
    const statusCode = Number(details && details.statusCode);
    const isRateLimited = !!(details && details.isRateLimited);
    if (isRateLimited || isRetryableStatusCode(statusCode)) {
      const attempt = Math.max(1, Number.isFinite(Number(attemptNumber)) ? Number(attemptNumber) : 1);
      const baseDelay = Math.round(defaultDelayMs * attempt);
      return Math.max(1e3, Math.min(maxDelayMs, baseDelay));
    }
    return 0;
  }

  // src/infrastructure/notifiers/discord/startup-purge.js
  function createStartupPurgeService(messageOps, options) {
    const STARTUP_PURGE_FETCH_MAX_ATTEMPTS = options.STARTUP_PURGE_FETCH_MAX_ATTEMPTS;
    const STARTUP_PURGE_DELETE_MAX_ATTEMPTS = options.STARTUP_PURGE_DELETE_MAX_ATTEMPTS;
    const STARTUP_PURGE_RETRY_DEFAULT_MS = options.STARTUP_PURGE_RETRY_DEFAULT_MS;
    const STARTUP_PURGE_RETRY_MAX_MS = options.STARTUP_PURGE_RETRY_MAX_MS;
    function deleteMessageWithRetry(plugin2, messageId, attemptNumber, done) {
      const attempt = Math.max(1, Number(attemptNumber || 1));
      messageOps.deleteMessage(plugin2, messageId, {}, function(ok, errorText, details) {
        if (ok || details && details.isMissingMessage) {
          done(true, "", {
            statusCode: details && details.statusCode,
            retryAfterMs: 0,
            isRateLimited: false,
            isMissingMessage: !!(details && details.isMissingMessage),
            discordCode: 0
          });
          return;
        }
        const retryDelayMs = computeRetryDelayMs(details, attempt, STARTUP_PURGE_RETRY_DEFAULT_MS, STARTUP_PURGE_RETRY_MAX_MS);
        const shouldRetry = retryDelayMs > 0 && attempt < STARTUP_PURGE_DELETE_MAX_ATTEMPTS;
        if (shouldRetry && plugin2.pluginHelper && typeof plugin2.pluginHelper.requestNotifyAfterDelay === "function") {
          plugin2.logger.logWarning(
            "{Name}: Discord startup purge delete retry scheduled message_id={MessageId} attempt={Attempt} retry_ms={RetryMs}",
            plugin2.name,
            String(messageId),
            attempt + 1,
            retryDelayMs
          );
          plugin2.pluginHelper.requestNotifyAfterDelay(retryDelayMs, function() {
            deleteMessageWithRetry(plugin2, messageId, attempt + 1, done);
          });
          return;
        }
        plugin2.logger.logWarning(
          "{Name}: Discord startup purge delete failed message_id={MessageId} error={Error}",
          plugin2.name,
          String(messageId),
          errorText || "unknown discord delete error"
        );
        done(false, errorText || "discord delete failed", details || {});
      });
    }
    function purgeChannelMessagesByAuthor(plugin2, authorId, done) {
      const stats = {
        scanned: 0,
        matched: 0,
        deleted: 0,
        pages: 0,
        rateLimited: false
      };
      function deleteMatchingMessages(messageIds, index, onDone) {
        if (index >= messageIds.length) {
          onDone();
          return;
        }
        const messageId = String(messageIds[index] || "");
        if (!messageId) {
          deleteMatchingMessages(messageIds, index + 1, onDone);
          return;
        }
        deleteMessageWithRetry(plugin2, messageId, 1, function(ok, errorText, details) {
          if (details && details.isRateLimited) stats.rateLimited = true;
          if (ok) {
            stats.deleted += 1;
            deleteMatchingMessages(messageIds, index + 1, onDone);
            return;
          }
          plugin2.logger.logWarning(
            "{Name}: Startup purge could not delete message_id={MessageId} error={Error}",
            plugin2.name,
            messageId,
            String(errorText || "unknown startup purge delete error")
          );
          deleteMatchingMessages(messageIds, index + 1, onDone);
        });
      }
      function fetchPage(beforeMessageId, attemptNumber) {
        const fetchAttempt = Math.max(1, Number(attemptNumber || 1));
        messageOps.listChannelMessages(plugin2, beforeMessageId, function(ok, messages, errorText, details) {
          if (!ok) {
            if (details && details.isRateLimited) stats.rateLimited = true;
            const retryDelayMs = computeRetryDelayMs(details, fetchAttempt, STARTUP_PURGE_RETRY_DEFAULT_MS, STARTUP_PURGE_RETRY_MAX_MS);
            const shouldRetry = retryDelayMs > 0 && fetchAttempt < STARTUP_PURGE_FETCH_MAX_ATTEMPTS;
            if (shouldRetry && plugin2.pluginHelper && typeof plugin2.pluginHelper.requestNotifyAfterDelay === "function") {
              plugin2.logger.logWarning(
                "{Name}: Discord startup purge list retry scheduled attempt={Attempt} retry_ms={RetryMs}",
                plugin2.name,
                fetchAttempt + 1,
                retryDelayMs
              );
              plugin2.pluginHelper.requestNotifyAfterDelay(retryDelayMs, function() {
                fetchPage(beforeMessageId, fetchAttempt + 1);
              });
              return;
            }
            done(false, errorText || "discord list messages failed", stats);
            return;
          }
          stats.pages += 1;
          stats.scanned += messages.length;
          if (messages.length === 0) {
            done(true, "", stats);
            return;
          }
          const matchingIds = [];
          for (let i = 0; i < messages.length; i++) {
            const current = messages[i] || {};
            const messageId = String(current.id || "").trim();
            if (!messageId) continue;
            const currentAuthorId = String(current.author && current.author.id ? current.author.id : "").trim();
            if (currentAuthorId === String(authorId)) {
              matchingIds.push(messageId);
            }
          }
          stats.matched += matchingIds.length;
          const oldest = messages[messages.length - 1] || {};
          const nextBefore = String(oldest.id || "").trim();
          deleteMatchingMessages(matchingIds, 0, function() {
            if (!nextBefore) {
              done(true, "", stats);
              return;
            }
            fetchPage(nextBefore, 1);
          });
        });
      }
      fetchPage("", 1);
    }
    function purgeStartupMessages(plugin2, done) {
      messageOps.getCurrentBotUserId(plugin2, function(ok, botUserId, errorText, details) {
        if (!ok) {
          done(false, errorText || "failed to resolve bot identity", {
            scanned: 0,
            matched: 0,
            deleted: 0,
            pages: 0,
            rateLimited: !!(details && details.isRateLimited),
            discordCode: parseDiscordErrorCode(details && details.parsed)
          });
          return;
        }
        purgeChannelMessagesByAuthor(plugin2, botUserId, function(purgeOk, purgeErrorText, stats) {
          if (!purgeOk) {
            done(false, purgeErrorText || "startup purge failed", stats || {
              scanned: 0,
              matched: 0,
              deleted: 0,
              pages: 0,
              rateLimited: false
            });
            return;
          }
          done(true, "", stats || {
            scanned: 0,
            matched: 0,
            deleted: 0,
            pages: 0,
            rateLimited: false
          });
        });
      });
    }
    return {
      purgeStartupMessages
    };
  }

  // src/infrastructure/notifiers/discord/index.js
  function createDiscordNotifier(config) {
    const botToken = String(config && config.discordBotToken ? config.discordBotToken : "").trim();
    const channelId = String(config && config.discordChannelId ? config.discordChannelId : "").trim();
    if (!botToken || !channelId) return null;
    const headers = createHeaders(botToken);
    const createUrl = "https://discord.com/api/v10/channels/" + channelId + "/messages";
    const meUrl = "https://discord.com/api/v10/users/@me";
    const channelMessagesUrl = "https://discord.com/api/v10/channels/" + channelId + "/messages";
    const messageOps = createMessageOps(createUrl, meUrl, channelMessagesUrl, headers);
    const startupPurge = createStartupPurgeService(messageOps, {
      STARTUP_PURGE_FETCH_MAX_ATTEMPTS: 4,
      STARTUP_PURGE_DELETE_MAX_ATTEMPTS: 4,
      STARTUP_PURGE_RETRY_DEFAULT_MS: 5e3,
      STARTUP_PURGE_RETRY_MAX_MS: 6e4
    });
    return {
      name: "discord",
      upsertMessage: function(plugin2, existingMessageId, payload, meta, done) {
        const type = meta && meta.type ? String(meta.type) : "message";
        const serverKey = meta && meta.serverKey ? String(meta.serverKey) : "(unknown)";
        if (existingMessageId) {
          messageOps.updateMessage(plugin2, existingMessageId, payload, meta, function(ok, messageId, errorText, details) {
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
            messageOps.createMessage(plugin2, payload, meta, function(createOk, createMessageId, createErrorText, createDetails) {
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
        messageOps.createMessage(plugin2, payload, meta, function(ok, messageId, errorText, details) {
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
        messageOps.deleteMessage(plugin2, messageId, meta, function(ok, errorText, details) {
          if (!ok) {
            if (details && details.isMissingMessage) {
              plugin2.logger.logInformation(
                "{Name}: Discord {Type} message already missing server={Server} message_id={MessageId}; treating delete as success",
                plugin2.name,
                type,
                serverKey,
                String(messageId)
              );
              done(true, "", {
                statusCode: details.statusCode,
                retryAfterMs: 0,
                isRateLimited: false,
                isMissingMessage: true
              });
              return;
            }
            done(false, errorText || "discord delete failed", details || {});
            return;
          }
          plugin2.logger.logInformation(
            "{Name}: Discord {Type} message deleted server={Server} message_id={MessageId} status={Status}",
            plugin2.name,
            type,
            serverKey,
            String(messageId),
            details && details.statusCode == null ? "(unknown)" : String(details.statusCode)
          );
          done(true, "", details || {
            statusCode: null,
            retryAfterMs: 0,
            isRateLimited: false,
            isMissingMessage: false
          });
        });
      },
      purgeStartupMessages: function(plugin2, done) {
        startupPurge.purgeStartupMessages(plugin2, done);
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
      },
      purgeStartupMessages: function(plugin2, done) {
        if (notifiers.length === 0) {
          done(true, "", { scanned: 0, matched: 0, deleted: 0, pages: 0, rateLimited: false });
          return;
        }
        const primary = notifiers[0];
        if (typeof primary.purgeStartupMessages !== "function") {
          done(true, "", { scanned: 0, matched: 0, deleted: 0, pages: 0, rateLimited: false });
          return;
        }
        primary.purgeStartupMessages(plugin2, done);
      }
    };
  }

  // src/plugin-state.js
  function createRuntimeState() {
    return {
      serverByKey: {},
      activeNetworkIdsByServer: {},
      populationStateByServer: {},
      gameInfoByServer: {},
      mapInfoByServer: {},
      modeInfoByServer: {},
      serverProbeLoggedByServer: {},
      statusSnapshotByServer: {},
      statusDashboardMessageId: "",
      statusDashboardSync: null,
      statusDashboardRetryAtMs: 0,
      notifyMessageIdByServer: {},
      notifyThresholdByServer: {},
      notifyLastAtMsByKey: {},
      statusDashboardFingerprint: "",
      notifyDeleteInFlightByServer: {},
      globalNotifyDispatchInFlight: false,
      gameApiSyncInFlight: false,
      gameApiLastSyncAtMs: 0,
      missingNotifierWarned: false,
      startupPurgeCompleted: false,
      startupBootstrapStarted: false
    };
  }
  function ensureServerPopulationState(plugin2, serverKey) {
    let state = plugin2.runtime.populationStateByServer[serverKey];
    if (!state) {
      state = {
        initialized: false,
        lastCount: null,
        lowPopulationSinceMs: 0,
        firedByThreshold: {}
      };
      plugin2.runtime.populationStateByServer[serverKey] = state;
    }
    return state;
  }
  function saveServerPopulationState(plugin2, serverKey, state) {
    plugin2.runtime.populationStateByServer[serverKey] = state;
  }
  function setKnownServer(plugin2, serverKey, server) {
    plugin2.runtime.serverByKey[serverKey] = server;
  }
  function setServerMetadata(plugin2, serverKey, mapInfo, modeInfo, gameInfo) {
    plugin2.runtime.mapInfoByServer[serverKey] = mapInfo;
    plugin2.runtime.modeInfoByServer[serverKey] = modeInfo;
    plugin2.runtime.gameInfoByServer[serverKey] = gameInfo;
  }
  function setStatusSnapshot(plugin2, serverKey, snapshot) {
    plugin2.runtime.statusSnapshotByServer[serverKey] = snapshot;
  }
  function clearStatusSnapshots(plugin2) {
    plugin2.runtime.statusSnapshotByServer = {};
  }
  function ensureActiveNetworkIds(plugin2, serverKey) {
    if (!plugin2.runtime.activeNetworkIdsByServer[serverKey]) {
      plugin2.runtime.activeNetworkIdsByServer[serverKey] = {};
    }
    return plugin2.runtime.activeNetworkIdsByServer[serverKey];
  }
  function wasServerProbeLogged(plugin2, serverKey) {
    return !!plugin2.runtime.serverProbeLoggedByServer[serverKey];
  }
  function markServerProbeLogged(plugin2, serverKey) {
    plugin2.runtime.serverProbeLoggedByServer[serverKey] = true;
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

  // src/server-metadata/text.js
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

  // src/server-metadata/map-info.js
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

  // src/server-metadata/mode-info.js
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

  // src/server-metadata/game-info.js
  var GAME_DISPLAY_NAMES = {
    IW3: "Call of Duty 4: Modern Warfare",
    IW4: "Call of Duty: Modern Warfare 2",
    IW5: "Call of Duty: Modern Warfare 3",
    IW6: "Call of Duty: Ghosts",
    T4: "Call of Duty: World at War",
    T5: "Call of Duty: Black Ops",
    T6: "Call of Duty: Black Ops 2",
    T7: "Call of Duty: Black Ops 3",
    SHG1: "Call of Duty: Advanced Warfare",
    H1: "Call of Duty 4: Remastered",
    H2M: "H2M-Mod"
  };
  function normalizeGameCode(value) {
    return cleanName(value).toUpperCase();
  }
  function gameCodeToDisplayName(value) {
    const code = normalizeGameCode(value);
    return GAME_DISPLAY_NAMES[code] || "";
  }
  function gameInfoFromValue(value) {
    const text = pickCleanString([value]);
    if (!text) return { readable: "", slug: "" };
    const code = normalizeGameCode(text);
    const displayName = gameCodeToDisplayName(code);
    if (displayName) {
      return {
        readable: displayName,
        slug: code
      };
    }
    return {
      readable: text,
      slug: code === text ? code : ""
    };
  }
  function extractGameInfoFromObject(gameValue) {
    if (!gameValue) {
      return { readable: "", slug: "" };
    }
    if (typeof gameValue === "string" || typeof gameValue === "number") {
      return gameInfoFromValue(gameValue);
    }
    const readableInfo = gameInfoFromValue(pickCleanString([
      gameValue.displayName,
      gameValue.DisplayName,
      gameValue.name,
      gameValue.Name,
      gameValue.title,
      gameValue.Title,
      gameValue.gameName,
      gameValue.GameName
    ]));
    const slugInfo = gameInfoFromValue(pickCleanString([
      gameValue.code,
      gameValue.Code,
      gameValue.slug,
      gameValue.Slug,
      gameValue.id,
      gameValue.Id,
      gameValue.game,
      gameValue.Game
    ]));
    return mergeNamedInfo(readableInfo, slugInfo);
  }
  function extractGameInfoFromServer(server) {
    if (!server) {
      return { readable: "", slug: "" };
    }
    const direct = mergeNamedInfo(
      extractGameInfoFromObject(server.game || server.Game),
      mergeNamedInfo(
        extractGameInfoFromObject(server.gameInfo || server.GameInfo),
        extractGameInfoFromObject(server.application || server.Application)
      )
    );
    const fields = mergeNamedInfo(
      gameInfoFromValue(pickCleanString([
        server.gameDisplayName,
        server.GameDisplayName,
        server.gameTitle,
        server.GameTitle,
        server.gameName,
        server.GameName
      ])),
      gameInfoFromValue(pickCleanString([
        server.gameCode,
        server.GameCode,
        server.parserVersion,
        server.ParserVersion,
        server.rConParserVersion,
        server.RConParserVersion,
        server.eventParserVersion,
        server.EventParserVersion
      ]))
    );
    return mergeNamedInfo(direct, fields);
  }
  function extractGameInfoFromEvent(eventObj) {
    if (!eventObj) {
      return { readable: "", slug: "" };
    }
    const direct = mergeNamedInfo(
      extractGameInfoFromObject(eventObj.game || eventObj.Game),
      extractGameInfoFromObject(eventObj.gameInfo || eventObj.GameInfo)
    );
    const fields = mergeNamedInfo(
      gameInfoFromValue(pickCleanString([
        eventObj.gameDisplayName,
        eventObj.GameDisplayName,
        eventObj.gameTitle,
        eventObj.GameTitle,
        eventObj.gameName,
        eventObj.GameName
      ])),
      gameInfoFromValue(pickCleanString([
        eventObj.gameCode,
        eventObj.GameCode,
        eventObj.parserVersion,
        eventObj.ParserVersion,
        eventObj.rConParserVersion,
        eventObj.RConParserVersion,
        eventObj.eventParserVersion,
        eventObj.EventParserVersion
      ]))
    );
    const fromServer = extractGameInfoFromServer(extractServerFromEvent(eventObj));
    return mergeNamedInfo(mergeNamedInfo(direct, fields), fromServer);
  }

  // src/observation-ingress.js
  function normalizeObservationFromEvent(eventObj, options) {
    const opts = options || {};
    const server = extractServerFromEvent(eventObj);
    return {
      server,
      client: extractClientFromEvent(eventObj),
      isDisconnect: opts.isDisconnect === true,
      source: String(opts.source || "unknown"),
      gameHint: extractGameInfoFromEvent(eventObj),
      mapHint: extractMapInfoFromEvent(eventObj),
      modeHint: extractModeInfoFromEvent(eventObj),
      isBootstrap: opts.isBootstrap === true
    };
  }
  function normalizeBootstrapObservation(server) {
    return {
      server,
      client: null,
      isDisconnect: false,
      source: "bootstrap_manager",
      gameHint: extractGameInfoFromServer(server),
      mapHint: extractMapInfoFromServer(server),
      modeHint: extractModeInfoFromServer(server),
      isBootstrap: true
    };
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

  // src/app/services/game-metadata-sync.js
  var GAME_API_SYNC_INTERVAL_MS = 60 * 1e3;
  function responseToText2(response) {
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
  function parseStatusCode2(response) {
    const raw = response ? response.statusCode || response.status || response.StatusCode || response.httpStatus : null;
    const parsed = parseInt(String(raw == null ? "" : raw), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function tryParseJson2(text) {
    const body = String(text == null ? "" : text).trim();
    if (!body) return null;
    try {
      return JSON.parse(body);
    } catch (_) {
      return null;
    }
  }
  function normalizeCacheKey(value) {
    return pickCleanString([value]).toLowerCase();
  }
  function buildServerApiUrl(baseUrl) {
    const base = String(baseUrl == null ? "" : baseUrl).trim().replace(/\/+$/, "");
    if (!base) return "";
    if (/\/api\/server$/i.test(base)) return base;
    return base + "/api/server";
  }
  function createEmptyHeaders() {
    try {
      const stringDict = System.Collections.Generic.Dictionary(System.String, System.String);
      return new stringDict();
    } catch (_) {
      return null;
    }
  }
  function requestServerRows(plugin2, url, done) {
    try {
      const pluginScript = importNamespace("IW4MAdmin.Application.Plugin.Script");
      const request = new pluginScript.ScriptPluginWebRequest(
        url,
        "",
        "GET",
        "application/json",
        createEmptyHeaders()
      );
      plugin2.pluginHelper.requestUrl(request, function(response) {
        const text = responseToText2(response);
        const parsed = tryParseJson2(text);
        const statusCode = parseStatusCode2(response);
        const ok = Number.isFinite(statusCode) ? statusCode >= 200 && statusCode < 300 : !!parsed;
        done({
          ok,
          statusCode,
          parsed,
          errorText: ok ? "" : (statusCode ? "status=" + statusCode + " " : "") + snippet(text, 220)
        });
      });
    } catch (error) {
      done({
        ok: false,
        statusCode: null,
        parsed: null,
        errorText: error && error.message ? error.message : "IW4MAdmin API request setup failed"
      });
    }
  }
  function rowsFromParsedResponse(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (!parsed || typeof parsed !== "object") return [];
    if (Array.isArray(parsed.servers)) return parsed.servers;
    if (Array.isArray(parsed.Servers)) return parsed.Servers;
    if (Array.isArray(parsed.data)) return parsed.data;
    if (Array.isArray(parsed.Data)) return parsed.Data;
    return [];
  }
  function candidateKeysFromApiRow(row) {
    return [
      row && row.serverId,
      row && row.ServerId,
      row && row.id,
      row && row.Id,
      row && row.listenAddress,
      row && row.ListenAddress,
      row && row.endpoint,
      row && row.Endpoint,
      row && row.hostname,
      row && row.Hostname
    ];
  }
  function namedInfoChanged(existing, next) {
    const left = existing || {};
    const right = next || {};
    return String(left.readable || "") !== String(right.readable || "") || String(left.slug || "") !== String(right.slug || "");
  }
  function storeGameInfo(plugin2, key, gameInfo) {
    const rawKey = pickCleanString([key]);
    if (!rawKey) return false;
    const normalizedKey = normalizeCacheKey(rawKey);
    let changed = false;
    const keys = normalizedKey && normalizedKey !== rawKey ? [rawKey, normalizedKey] : [rawKey];
    for (let i = 0; i < keys.length; i++) {
      const cacheKey = keys[i];
      const existing = plugin2.runtime.gameInfoByServer[cacheKey];
      const next = mergeNamedInfo(gameInfo, existing);
      if (namedInfoChanged(existing, next)) changed = true;
      plugin2.runtime.gameInfoByServer[cacheKey] = next;
    }
    return changed;
  }
  function applyServerRows(plugin2, rows) {
    let changed = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};
      const gameInfo = extractGameInfoFromServer(row);
      if (!pickCleanString([gameInfo.readable, gameInfo.slug])) continue;
      const keys = candidateKeysFromApiRow(row);
      for (let j = 0; j < keys.length; j++) {
        changed = storeGameInfo(plugin2, keys[j], gameInfo) || changed;
      }
    }
    return changed;
  }
  function maybeRefreshGameMetadataFromApi(plugin2) {
    const baseUrl = plugin2 && plugin2.config ? plugin2.config.iw4mApiBaseUrl : "";
    const apiUrl = buildServerApiUrl(baseUrl);
    if (!apiUrl) return;
    if (!plugin2.pluginHelper || typeof plugin2.pluginHelper.requestUrl !== "function") return;
    if (plugin2.runtime.gameApiSyncInFlight) return;
    const nowMs = Date.now();
    const lastSyncAtMs = parseIntSafe(plugin2.runtime.gameApiLastSyncAtMs, 0);
    if (lastSyncAtMs > 0 && nowMs - lastSyncAtMs < GAME_API_SYNC_INTERVAL_MS) return;
    plugin2.runtime.gameApiSyncInFlight = true;
    plugin2.runtime.gameApiLastSyncAtMs = nowMs;
    requestServerRows(plugin2, apiUrl, function(result) {
      plugin2.runtime.gameApiSyncInFlight = false;
      if (!result.ok) {
        plugin2.logger.logWarning(
          "{Name}: IW4MAdmin API server metadata sync failed - {Error}",
          plugin2.name,
          String(result.errorText || "unknown error")
        );
        return;
      }
      const rows = rowsFromParsedResponse(result.parsed);
      const changed = applyServerRows(plugin2, rows);
      plugin2.logger.logInformation(
        "{Name}: IW4MAdmin API server metadata sync loaded {Count} server(s)",
        plugin2.name,
        rows.length
      );
      if (changed && typeof plugin2.refreshStatusMessages === "function") {
        plugin2.refreshStatusMessages();
      }
    });
  }
  function cachedGameInfoForServer(plugin2, server, serverKey) {
    const candidates = [
      serverKey,
      getServerKey(server),
      server && server.serverId,
      server && server.ServerId,
      server && server.id,
      server && server.Id,
      server && server.listenAddress,
      server && server.ListenAddress,
      server && server.endpoint,
      server && server.Endpoint,
      server && server.hostname,
      server && server.Hostname
    ];
    for (let i = 0; i < candidates.length; i++) {
      const rawKey = pickCleanString([candidates[i]]);
      if (!rawKey) continue;
      const direct = plugin2.runtime.gameInfoByServer[rawKey];
      if (direct) return direct;
      const normalized = normalizeCacheKey(rawKey);
      if (normalized && plugin2.runtime.gameInfoByServer[normalized]) {
        return plugin2.runtime.gameInfoByServer[normalized];
      }
    }
    return { readable: "", slug: "" };
  }

  // src/app/services/startup-flow.ts
  function scheduleDelayedBootstrap(plugin2) {
    if (!plugin2.pluginHelper || typeof plugin2.pluginHelper.requestNotifyAfterDelay !== "function") return;
    plugin2.pluginHelper.requestNotifyAfterDelay(7e3, () => {
      bootstrapKnownServers(plugin2);
    });
  }
  function startBootstrapFlow(plugin2) {
    if (plugin2.runtime.startupBootstrapStarted) return;
    plugin2.runtime.startupBootstrapStarted = true;
    bootstrapKnownServers(plugin2);
    scheduleDelayedBootstrap(plugin2);
  }
  function runStartupPurgeThenBootstrap(plugin2) {
    if (plugin2.runtime.startupPurgeCompleted) {
      startBootstrapFlow(plugin2);
      return;
    }
    plugin2.runtime.startupPurgeCompleted = true;
    if (!plugin2.dispatcher || typeof plugin2.dispatcher.purgeStartupMessages !== "function" || plugin2.dispatcher.count === 0) {
      startBootstrapFlow(plugin2);
      return;
    }
    plugin2.logger.logInformation("{Name}: Startup purge scanning prior bot-authored Discord messages", plugin2.name);
    plugin2.dispatcher.purgeStartupMessages(plugin2, (ok, errorText, stats) => {
      const summary = stats || { scanned: 0, matched: 0, deleted: 0, pages: 0, rateLimited: false };
      if (ok) {
        plugin2.logger.logInformation(
          "{Name}: Startup purge complete scanned={Scanned} matched={Matched} deleted={Deleted} pages={Pages} rate_limited={RateLimited}",
          plugin2.name,
          parseIntSafe(summary.scanned, 0),
          parseIntSafe(summary.matched, 0),
          parseIntSafe(summary.deleted, 0),
          parseIntSafe(summary.pages, 0),
          summary.rateLimited ? "yes" : "no"
        );
      } else {
        plugin2.logger.logWarning(
          "{Name}: Startup purge failed - {Error} (scanned={Scanned} matched={Matched} deleted={Deleted})",
          plugin2.name,
          String(errorText || "unknown startup purge error"),
          parseIntSafe(summary.scanned, 0),
          parseIntSafe(summary.matched, 0),
          parseIntSafe(summary.deleted, 0)
        );
      }
      startBootstrapFlow(plugin2);
    });
  }
  function bootstrapKnownServers(plugin2) {
    maybeRefreshGameMetadataFromApi(plugin2);
    const servers = collectServersFromManager(plugin2.manager);
    plugin2.logger.logInformation(
      "{Name}: bootstrapKnownServers discovered {Count} server(s) from manager",
      plugin2.name,
      servers.length
    );
    for (let i = 0; i < servers.length; i++) {
      const observation = normalizeBootstrapObservation(servers[i]);
      plugin2.observeServerPopulation(
        observation.server,
        observation.client,
        observation.isDisconnect,
        observation.source,
        observation.gameHint,
        observation.mapHint,
        observation.modeHint,
        observation.isBootstrap
      );
    }
  }

  // src/dashboard-renderer.js
  var MAX_DASHBOARD_EMBEDS = 10;
  var MAX_EMBED_DESCRIPTION_LENGTH = 3900;
  var MAX_SERVER_BLOCK_LENGTH = 260;
  var GAME_LOGO_FILE_BY_CODE = {
    IW3: "COD 4 Logo.png",
    IW4: "MW2 Logo.png",
    IW5: "MW3 Logo.png",
    IW6: "Ghost Logo.png",
    T4: "WaW Logo.png",
    T5: "Black Ops 1 Logo.png",
    T6: "Black Ops 2 Logo.png",
    H1: "HMW Logo.png",
    HMW: "HMW Logo.png"
  };
  var GAME_LOGO_PLACEHOLDER_TEXT_BY_CODE = {
    T7: "T7",
    SHG1: "SHG1",
    H2M: "H2M"
  };
  var GAME_LOGO_FOLDER = "game-logos";
  var DEFAULT_GAME_LOGO_PLACEHOLDER_URL = "https://placehold.co/128x128/png?text=Game";
  function gameLogoUrlFromFile(fileName) {
    const base = String(DEFAULT_THUMBNAIL_BASE_URL || "").replace(/\/+$/, "");
    if (!base || !fileName) return "";
    return base + "/" + GAME_LOGO_FOLDER + "/" + encodeURIComponent(fileName);
  }
  function statusColorFromPlayerCount(alerts, playerCount) {
    const count = parseIntSafe(playerCount, 0);
    const list = Array.isArray(alerts) ? alerts : [];
    let highestThreshold = 0;
    for (let i = 0; i < list.length; i++) {
      const threshold = parseIntSafe(list[i] && list[i].threshold, 0);
      if (count >= threshold && threshold > highestThreshold) highestThreshold = threshold;
    }
    if (highestThreshold >= 11) return 15158332;
    if (highestThreshold >= 6) return 15844367;
    if (highestThreshold >= 1) return 3066993;
    return 3447003;
  }
  function getSnapshotCount(snapshot) {
    return parseIntSafe(snapshot && snapshot.playerCount, 0);
  }
  function truncateText(value, maxLength) {
    const text = String(value == null ? "" : value);
    const limit = parseIntSafe(maxLength, 0);
    if (limit <= 0 || text.length <= limit) return text;
    if (limit <= 3) return text.substring(0, limit);
    return text.substring(0, limit - 3) + "...";
  }
  function sortedServerKeysByPopulation(statusSnapshotByServer) {
    const keys = Object.keys(statusSnapshotByServer || {});
    keys.sort(function(leftKey, rightKey) {
      const leftCount = getSnapshotCount(statusSnapshotByServer[leftKey]);
      const rightCount = getSnapshotCount(statusSnapshotByServer[rightKey]);
      if (leftCount !== rightCount) return rightCount - leftCount;
      return String(leftKey).localeCompare(String(rightKey));
    });
    return keys;
  }
  function gameTitleFromSnapshot(snapshot) {
    const gameInfo = snapshot && snapshot.gameInfo ? snapshot.gameInfo : null;
    return pickCleanString([
      gameInfo && gameInfo.readable,
      snapshot && snapshot.gameText,
      gameInfo && gameInfo.slug
    ]) || "Unknown Game";
  }
  function gameSlugFromSnapshot(snapshot) {
    const gameInfo = snapshot && snapshot.gameInfo ? snapshot.gameInfo : null;
    return pickCleanString([gameInfo && gameInfo.slug]).toUpperCase();
  }
  function gameLogoUrlFromGroup(group) {
    const slug = pickCleanString([group && group.slug]).toUpperCase();
    const s3Url = gameLogoUrlFromFile(GAME_LOGO_FILE_BY_CODE[slug]);
    if (s3Url) return s3Url;
    const placeholderText = GAME_LOGO_PLACEHOLDER_TEXT_BY_CODE[slug];
    if (placeholderText) return "https://placehold.co/128x128/png?text=" + encodeURIComponent(placeholderText);
    return DEFAULT_GAME_LOGO_PLACEHOLDER_URL;
  }
  function serverStatusEmoji(playerCount) {
    return playerCount > 0 ? ":online:" : ":offline:";
  }
  function formatMapForDashboard(mapInfo, fallbackText) {
    return pickCleanString([
      mapInfo && mapInfo.readable,
      fallbackText,
      mapInfo && mapInfo.slug
    ]) || "unknown";
  }
  function buildServerLine(snapshot) {
    const serverName = String(snapshot && snapshot.serverName ? snapshot.serverName : "(unknown server)");
    const playerCount = getSnapshotCount(snapshot);
    const mapInfo = snapshot && snapshot.mapInfo ? snapshot.mapInfo : null;
    const modeInfo = snapshot && snapshot.modeInfo ? snapshot.modeInfo : null;
    const mapText = formatMapForDashboard(mapInfo, snapshot && snapshot.mapText);
    const modeText = formatNamedInfoForStatus(modeInfo, snapshot && snapshot.modeText ? snapshot.modeText : "unknown");
    return truncateText(
      serverStatusEmoji(playerCount) + " **" + serverName + "**  `" + playerCount + "/" + MAX_PLAYERS + "`\n*" + mapText + "*\n" + modeText,
      MAX_SERVER_BLOCK_LENGTH
    );
  }
  function createGameGroups(statusSnapshotByServer) {
    const groupsByTitle = {};
    const serverKeys = sortedServerKeysByPopulation(statusSnapshotByServer);
    for (let i = 0; i < serverKeys.length; i++) {
      const serverKey = serverKeys[i];
      const snapshot = statusSnapshotByServer[serverKey];
      if (!snapshot) continue;
      const title = gameTitleFromSnapshot(snapshot);
      if (!groupsByTitle[title]) {
        groupsByTitle[title] = {
          title,
          slug: gameSlugFromSnapshot(snapshot),
          servers: [],
          totalPlayers: 0,
          maxPlayerCount: 0
        };
      } else if (!groupsByTitle[title].slug) {
        groupsByTitle[title].slug = gameSlugFromSnapshot(snapshot);
      }
      const playerCount = getSnapshotCount(snapshot);
      groupsByTitle[title].servers.push(snapshot);
      groupsByTitle[title].totalPlayers += playerCount;
      if (playerCount > groupsByTitle[title].maxPlayerCount) {
        groupsByTitle[title].maxPlayerCount = playerCount;
      }
    }
    const groups = Object.values(groupsByTitle);
    groups.sort(function(left, right) {
      if (left.totalPlayers !== right.totalPlayers) return right.totalPlayers - left.totalPlayers;
      if (left.maxPlayerCount !== right.maxPlayerCount) return right.maxPlayerCount - left.maxPlayerCount;
      return left.title.localeCompare(right.title);
    });
    return groups;
  }
  function buildGameDescription(group, extraOverflowLine) {
    const lines = [
      "**" + group.servers.length + " servers**\n`" + group.totalPlayers + "/" + group.servers.length * MAX_PLAYERS + " players`"
    ];
    let omitted = 0;
    for (let i = 0; i < group.servers.length; i++) {
      const line = buildServerLine(group.servers[i]);
      const nextDescription = lines.concat([line]).join("\n\n");
      if (nextDescription.length > MAX_EMBED_DESCRIPTION_LENGTH) {
        omitted = group.servers.length - i;
        break;
      }
      lines.push(line);
    }
    if (omitted > 0) {
      const overflowLine = "_" + omitted + " more server" + (omitted === 1 ? "" : "s") + " not shown._";
      const nextDescription = lines.concat([overflowLine]).join("\n\n");
      if (nextDescription.length <= MAX_EMBED_DESCRIPTION_LENGTH) {
        lines.push(overflowLine);
      }
    }
    if (extraOverflowLine) {
      const nextDescription = lines.concat([extraOverflowLine]).join("\n\n");
      if (nextDescription.length <= MAX_EMBED_DESCRIPTION_LENGTH) {
        lines.push(extraOverflowLine);
      }
    }
    return lines.join("\n\n");
  }
  function buildGameEmbed(alerts, group, extraOverflowLine) {
    return {
      title: group.title,
      description: buildGameDescription(group, extraOverflowLine),
      color: statusColorFromPlayerCount(alerts, group.maxPlayerCount),
      thumbnail: { url: gameLogoUrlFromGroup(group) }
    };
  }
  function buildDashboardPayload(alerts, statusSnapshotByServer) {
    const allGameGroups = createGameGroups(statusSnapshotByServer);
    const omittedGameCount = Math.max(0, allGameGroups.length - MAX_DASHBOARD_EMBEDS);
    const gameGroups = allGameGroups.slice(0, MAX_DASHBOARD_EMBEDS);
    const embeds = [];
    for (let i = 0; i < gameGroups.length; i++) {
      const overflowLine = i === gameGroups.length - 1 && omittedGameCount > 0 ? "_" + omittedGameCount + " more game group" + (omittedGameCount === 1 ? "" : "s") + " not shown._" : "";
      embeds.push(buildGameEmbed(alerts, gameGroups[i], overflowLine));
    }
    if (embeds.length === 0) {
      embeds.push({
        title: "Server Population",
        description: "No server data available yet.",
        color: 3447003
      });
    }
    return {
      content: "",
      embeds,
      allowed_mentions: { parse: [] }
    };
  }

  // src/status-channel.js
  function buildStatusPayload(plugin2, statusSnapshotByServer) {
    const alerts = plugin2.config && Array.isArray(plugin2.config.alerts) ? plugin2.config.alerts : [];
    return buildDashboardPayload(alerts, statusSnapshotByServer);
  }
  function ensureStatusSyncState(plugin2) {
    let sync = plugin2.runtime.statusDashboardSync;
    if (!sync) {
      sync = {
        inFlight: false,
        pending: null
      };
      plugin2.runtime.statusDashboardSync = sync;
    }
    return sync;
  }
  function dispatchStatusUpsert(plugin2, update) {
    const sync = ensureStatusSyncState(plugin2);
    sync.inFlight = true;
    const existingMessageId = plugin2.runtime.statusDashboardMessageId || "";
    plugin2.dispatcher.upsertMessage(
      plugin2,
      existingMessageId,
      update.payload,
      { type: "status", serverKey: "dashboard" },
      (ok, messageId, errorText, details) => {
        sync.inFlight = false;
        if (!ok) {
          const retryAfterMs = Math.max(1e3, parseIntSafe(details && details.retryAfterMs, 5e3));
          plugin2.runtime.statusDashboardRetryAtMs = Date.now() + retryAfterMs;
          plugin2.logger.logWarning(
            "{Name}: Failed to upsert status dashboard message - {Error} (retry_ms={RetryMs})",
            plugin2.name,
            String(errorText || "unknown upsert error"),
            retryAfterMs
          );
          if (plugin2.pluginHelper && typeof plugin2.pluginHelper.requestNotifyAfterDelay === "function") {
            plugin2.pluginHelper.requestNotifyAfterDelay(retryAfterMs, () => {
              ensureStatusMessage(plugin2);
            });
          }
        } else {
          plugin2.runtime.statusDashboardRetryAtMs = 0;
          if (messageId) {
            plugin2.runtime.statusDashboardMessageId = String(messageId);
          }
          plugin2.runtime.statusDashboardFingerprint = update.fingerprint;
        }
        const pending = sync.pending;
        sync.pending = null;
        if (pending) {
          ensureStatusMessage(plugin2);
        }
      }
    );
  }
  function ensureStatusMessage(plugin2) {
    if (!plugin2.dispatcher || plugin2.dispatcher.count === 0) return;
    const statusSnapshotByServer = plugin2.runtime.statusSnapshotByServer || {};
    const existingMessageId = plugin2.runtime.statusDashboardMessageId || "";
    const snapshotCount = Object.keys(statusSnapshotByServer).length;
    if (!existingMessageId && snapshotCount === 0) {
      return;
    }
    const payload = buildStatusPayload(plugin2, statusSnapshotByServer);
    const fingerprint = JSON.stringify(payload);
    const existingFingerprint = plugin2.runtime.statusDashboardFingerprint || "";
    if (existingMessageId && existingFingerprint === fingerprint) {
      return;
    }
    const update = {
      payload,
      fingerprint
    };
    const sync = ensureStatusSyncState(plugin2);
    if (sync.inFlight) {
      sync.pending = update;
      return;
    }
    const nowMs = Date.now();
    const retryAtMs = parseIntSafe(plugin2.runtime.statusDashboardRetryAtMs, 0);
    if (retryAtMs > nowMs) {
      sync.pending = update;
      return;
    }
    dispatchStatusUpsert(plugin2, update);
  }

  // src/notify-policy.js
  function evaluateNotifyPolicy(input) {
    const args = input || {};
    if (!args.hasNotifier) {
      return { action: "suppress", reason: "missing_notifier", remainingMs: 0 };
    }
    if (args.inFlight) {
      return { action: "suppress", reason: "in_flight", remainingMs: 0 };
    }
    const remainingMs = parseIntSafe(args.cooldownRemainingMs, 0);
    if (remainingMs > 0) {
      return { action: "suppress", reason: "cooldown", remainingMs };
    }
    return { action: "send", reason: "allowed", remainingMs: 0 };
  }
  function remainingGlobalCooldownMs(lastAtMs, nowMs) {
    const last = parseIntSafe(lastAtMs, 0);
    if (last <= 0) return 0;
    const elapsedMs = parseIntSafe(nowMs, Date.now()) - last;
    const remainingMs = GLOBAL_NOTIFY_COOLDOWN_MS - elapsedMs;
    return remainingMs > 0 ? remainingMs : 0;
  }

  // src/presentation/discord/notify-payload-renderer.js
  function buildNotifyMentionData(plugin2) {
    const roleId = String(plugin2 && plugin2.config && plugin2.config.discordRoleId ? plugin2.config.discordRoleId : "").trim();
    if (roleId) {
      return {
        prefix: "<@&" + roleId + ">",
        allowedMentions: {
          parse: [],
          roles: [roleId]
        }
      };
    }
    return {
      prefix: NOTIFY_MENTION_PREFIX,
      allowedMentions: {
        parse: ["everyone"]
      }
    };
  }
  function buildNotifyPayload(plugin2, alert, serverKey, serverName, playerCount) {
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
    const mentionData = buildNotifyMentionData(plugin2);
    const content = mentionData.prefix + " " + sentence;
    return {
      content,
      allowed_mentions: mentionData.allowedMentions
    };
  }

  // src/app/services/notify-dispatch.js
  var NOTIFY_SEND_MAX_ATTEMPTS = 3;
  var NOTIFY_DELETE_MAX_ATTEMPTS = 3;
  var DEFAULT_NOTIFY_RETRY_MS = 5e3;
  var MAX_NOTIFY_RETRY_MS = 6e4;
  function computeNotifyRetryDelayMs(details, attemptNumber) {
    const retryAfterMs = parseIntSafe(details && details.retryAfterMs, 0);
    if (retryAfterMs > 0) {
      return Math.max(1e3, Math.min(MAX_NOTIFY_RETRY_MS, retryAfterMs));
    }
    const statusCode = parseIntSafe(details && details.statusCode, 0);
    const isRateLimited = !!(details && details.isRateLimited);
    if (isRateLimited || statusCode >= 500) {
      const attempt = Math.max(1, parseIntSafe(attemptNumber, 1));
      const backoffMs = DEFAULT_NOTIFY_RETRY_MS * attempt;
      return Math.max(1e3, Math.min(MAX_NOTIFY_RETRY_MS, backoffMs));
    }
    return 0;
  }
  function scheduleAfterDelay(plugin2, delayMs, callback) {
    if (plugin2.pluginHelper && typeof plugin2.pluginHelper.requestNotifyAfterDelay === "function") {
      plugin2.pluginHelper.requestNotifyAfterDelay(delayMs, callback);
      return true;
    }
    return false;
  }
  function sendNotifyMessageWithRetry(plugin2, alert, serverKey, serverName, playerCount, isStartup, source, done, attempt, options) {
    const payload = buildNotifyPayload(plugin2, alert, serverKey, serverName, playerCount);
    const forceCreate = !!(options && options.forceCreate);
    const existingMessageId = forceCreate ? "" : plugin2.runtime.notifyMessageIdByServer[serverKey] || "";
    const attemptNumber = parseIntSafe(attempt, 1);
    plugin2.logger.logInformation(
      "{Name}: Dispatching notify message server={Server} threshold={Threshold} startup={Startup} source={Source} existing_message_id={ExistingId} force_create={ForceCreate} attempt={Attempt}",
      plugin2.name,
      serverKey,
      parseIntSafe(alert.threshold, 0),
      isStartup === true ? "yes" : "no",
      String(source || "unknown"),
      existingMessageId || "(none)",
      forceCreate ? "yes" : "no",
      attemptNumber
    );
    plugin2.dispatcher.upsertMessage(
      plugin2,
      existingMessageId,
      payload,
      { type: "notify", serverKey },
      (ok, messageId, errorText, details) => {
        if (!ok) {
          const retryDelayMs = computeNotifyRetryDelayMs(details, attemptNumber);
          const shouldRetry = retryDelayMs > 0 && attemptNumber < NOTIFY_SEND_MAX_ATTEMPTS;
          plugin2.logger.logWarning(
            "{Name}: Failed to dispatch notify message for {Server} - {Error}",
            plugin2.name,
            serverKey,
            String(errorText || "unknown notify error")
          );
          if (shouldRetry) {
            plugin2.logger.logInformation(
              "{Name}: Scheduling notify retry server={Server} attempt={Attempt} retry_ms={RetryMs}",
              plugin2.name,
              serverKey,
              attemptNumber + 1,
              retryDelayMs
            );
            scheduleAfterDelay(plugin2, retryDelayMs, function() {
              sendNotifyMessageWithRetry(plugin2, alert, serverKey, serverName, playerCount, isStartup, source, done, attemptNumber + 1, options);
            });
            return;
          }
          if (typeof done === "function") done(false, "");
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
        if (typeof done === "function") done(true, messageId ? String(messageId) : existingMessageId);
      }
    );
  }
  function dispatchNotifyDeleteWithRetry(plugin2, serverKey, messageId, source, attemptNumber) {
    plugin2.dispatcher.deleteMessage(plugin2, messageId, { type: "notify", serverKey }, (ok, errorText, details) => {
      if (ok) {
        plugin2.runtime.notifyDeleteInFlightByServer[serverKey] = false;
        const deletedMessageId = String(messageId || "");
        const activeMessageId = String(plugin2.runtime.notifyMessageIdByServer[serverKey] || "");
        if (!activeMessageId || activeMessageId === deletedMessageId) {
          delete plugin2.runtime.notifyMessageIdByServer[serverKey];
          delete plugin2.runtime.notifyThresholdByServer[serverKey];
        }
        return;
      }
      const retryDelayMs = computeNotifyRetryDelayMs(details, attemptNumber);
      const shouldRetry = retryDelayMs > 0 && attemptNumber < NOTIFY_DELETE_MAX_ATTEMPTS;
      plugin2.logger.logWarning(
        "{Name}: Failed to delete active notify message for {Server} - {Error}",
        plugin2.name,
        serverKey,
        String(errorText || "unknown delete error")
      );
      if (shouldRetry && scheduleAfterDelay(plugin2, retryDelayMs, function() {
        dispatchNotifyDeleteWithRetry(plugin2, serverKey, messageId, source, attemptNumber + 1);
      })) {
        plugin2.logger.logInformation(
          "{Name}: Scheduling notify-delete retry server={Server} attempt={Attempt} retry_ms={RetryMs} source={Source}",
          plugin2.name,
          serverKey,
          attemptNumber + 1,
          retryDelayMs,
          String(source || "unknown")
        );
        return;
      }
      plugin2.runtime.notifyDeleteInFlightByServer[serverKey] = false;
    });
  }

  // src/threshold-notify.js
  function notifyCooldownKey(serverKey, threshold) {
    return String(serverKey) + ":" + String(parseIntSafe(threshold, 0));
  }
  function canSendNotifyForThreshold(plugin2, serverKey, threshold) {
    const key = notifyCooldownKey(serverKey, threshold);
    const lastAtMs = parseIntSafe(plugin2.runtime.notifyLastAtMsByKey[key], 0);
    const remainingMs = remainingGlobalCooldownMs(lastAtMs, Date.now());
    if (remainingMs <= 0) {
      return {
        allowed: true,
        key,
        remainingMs: 0
      };
    }
    return {
      allowed: false,
      key,
      remainingMs
    };
  }
  function setNotifyNowForThreshold(plugin2, serverKey, threshold) {
    const key = notifyCooldownKey(serverKey, threshold);
    plugin2.runtime.notifyLastAtMsByKey[key] = Date.now();
  }
  function maybeDeleteNotifyForLowPopulation(plugin2, serverKey, playerCount, source) {
    if (playerCount >= NOTIFY_CLEAR_BELOW_COUNT) return;
    const messageId = plugin2.runtime.notifyMessageIdByServer[serverKey] || "";
    if (!messageId) {
      delete plugin2.runtime.notifyThresholdByServer[serverKey];
      return;
    }
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
    dispatchNotifyDeleteWithRetry(plugin2, serverKey, messageId, source, 1);
  }
  function handleThresholdCrossing(plugin2, alert, serverKey, serverName, playerCount, isStartup, source) {
    const thresholdValue = parseIntSafe(alert && alert.threshold, 0);
    const previousThresholdValue = parseIntSafe(plugin2.runtime.notifyThresholdByServer[serverKey], 0);
    const previousMessageId = plugin2.runtime.notifyMessageIdByServer[serverKey] || "";
    const shouldReplacePreviousMessage = thresholdValue > previousThresholdValue && !!previousMessageId;
    const hasNotifier = !!(plugin2.dispatcher && plugin2.dispatcher.count > 0);
    const cooldown = canSendNotifyForThreshold(plugin2, serverKey, thresholdValue);
    const policy = evaluateNotifyPolicy({
      hasNotifier,
      inFlight: plugin2.runtime.globalNotifyDispatchInFlight === true,
      cooldownRemainingMs: cooldown.remainingMs
    });
    if (policy.action !== "send") {
      if (policy.reason === "missing_notifier") {
        if (!plugin2.runtime.missingNotifierWarned) {
          plugin2.logger.logWarning("{Name}: Alert suppressed because no notifier destination is configured.", plugin2.name);
          plugin2.runtime.missingNotifierWarned = true;
        }
        return;
      }
      if (policy.reason === "in_flight") {
        plugin2.logger.logInformation(
          "{Name}: Notify suppressed because another notify dispatch is currently in-flight server={Server} threshold={Threshold} source={Source}",
          plugin2.name,
          serverKey,
          thresholdValue,
          String(source || "unknown")
        );
        return;
      }
      if (policy.reason === "cooldown") {
        const remainingMinutes = Math.ceil(policy.remainingMs / 6e4);
        plugin2.logger.logInformation(
          "{Name}: Notify suppressed by threshold cooldown server={Server} threshold={Threshold} remaining_minutes={Remaining} source={Source}",
          plugin2.name,
          serverKey,
          thresholdValue,
          remainingMinutes,
          String(source || "unknown")
        );
      }
      return;
    }
    plugin2.runtime.globalNotifyDispatchInFlight = true;
    sendNotifyMessageWithRetry(plugin2, alert, serverKey, serverName, playerCount, isStartup, source, (ok, sentMessageId) => {
      if (ok) {
        setNotifyNowForThreshold(plugin2, serverKey, thresholdValue);
        plugin2.runtime.notifyThresholdByServer[serverKey] = thresholdValue;
        if (shouldReplacePreviousMessage && sentMessageId && previousMessageId && sentMessageId !== previousMessageId) {
          if (!plugin2.runtime.notifyDeleteInFlightByServer[serverKey]) {
            plugin2.runtime.notifyDeleteInFlightByServer[serverKey] = true;
            dispatchNotifyDeleteWithRetry(plugin2, serverKey, previousMessageId, source, 1);
          }
        }
      }
      plugin2.runtime.globalNotifyDispatchInFlight = false;
    }, 1, { forceCreate: shouldReplacePreviousMessage });
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
  function observationNowMs(meta) {
    return parseIntSafe(meta && meta.nowMs, Date.now());
  }
  function shouldHoldForLowPopulationGrace(plugin2, serverKey, playerCount, previousCount, state, meta) {
    if (playerCount >= NOTIFY_CLEAR_BELOW_COUNT) {
      if (parseIntSafe(state.lowPopulationSinceMs, 0) > 0) {
        plugin2.logger.logInformation(
          "{Name}: Low-population grace cleared server={Server} count={Count}",
          plugin2.name,
          serverKey,
          playerCount
        );
        state.lowPopulationSinceMs = 0;
      }
      return false;
    }
    if (previousCount < NOTIFY_CLEAR_BELOW_COUNT) return false;
    const nowMs = observationNowMs(meta);
    let lowPopulationSinceMs = parseIntSafe(state.lowPopulationSinceMs, 0);
    if (lowPopulationSinceMs <= 0) {
      lowPopulationSinceMs = nowMs;
      state.lowPopulationSinceMs = lowPopulationSinceMs;
      plugin2.logger.logInformation(
        "{Name}: Low-population grace started server={Server} previous={Previous} current={Current} grace_ms={GraceMs}",
        plugin2.name,
        serverKey,
        previousCount,
        playerCount,
        LOW_POPULATION_GRACE_MS
      );
    }
    const elapsedMs = nowMs - lowPopulationSinceMs;
    if (elapsedMs < LOW_POPULATION_GRACE_MS) {
      plugin2.logger.logInformation(
        "{Name}: Low-population observation held during grace server={Server} previous={Previous} current={Current} elapsed_ms={ElapsedMs}",
        plugin2.name,
        serverKey,
        previousCount,
        playerCount,
        elapsedMs
      );
      return true;
    }
    plugin2.logger.logInformation(
      "{Name}: Low-population grace expired server={Server} previous={Previous} current={Current} elapsed_ms={ElapsedMs}",
      plugin2.name,
      serverKey,
      previousCount,
      playerCount,
      elapsedMs
    );
    state.lowPopulationSinceMs = 0;
    return false;
  }
  function evaluatePopulation(plugin2, serverKey, serverName, playerCount, observationMeta) {
    const alerts = plugin2.config.alerts || [];
    if (alerts.length === 0) return;
    const meta = observationMeta || {};
    const state = ensureServerPopulationState(plugin2, serverKey);
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
      saveServerPopulationState(plugin2, serverKey, state);
      return;
    }
    const previousCount = parseIntSafe(state.lastCount, playerCount);
    if (shouldHoldForLowPopulationGrace(plugin2, serverKey, playerCount, previousCount, state, meta)) {
      saveServerPopulationState(plugin2, serverKey, state);
      return;
    }
    maybeDeleteNotifyForLowPopulation(plugin2, serverKey, playerCount, meta.source || "unknown");
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
    saveServerPopulationState(plugin2, serverKey, state);
  }

  // src/app/services/observation-service.ts
  function refreshStatusMessages(plugin2) {
    maybeRefreshGameMetadataFromApi(plugin2);
    const keys = Object.keys(plugin2.runtime.populationStateByServer || {});
    clearStatusSnapshots(plugin2);
    for (let i = 0; i < keys.length; i++) {
      const serverKey = keys[i];
      const server = plugin2.runtime.serverByKey[serverKey];
      if (!server) continue;
      const state = plugin2.runtime.populationStateByServer[serverKey] || {};
      const count = parseIntSafe(state.lastCount, 0);
      const serverName = cleanName(server.serverName || server.ServerName || server.hostname || server.Hostname || serverKey);
      const gameInfo = mergeNamedInfo(
        cachedGameInfoForServer(plugin2, server, serverKey),
        mergeNamedInfo(extractGameInfoFromServer(server), plugin2.runtime.gameInfoByServer[serverKey])
      );
      const mapInfo = mergeNamedInfo(plugin2.runtime.mapInfoByServer[serverKey], extractMapInfoFromServer(server));
      const modeInfo = mergeNamedInfo(plugin2.runtime.modeInfoByServer[serverKey], extractModeInfoFromServer(server));
      setStatusSnapshot(plugin2, serverKey, {
        serverName,
        playerCount: count,
        gameInfo,
        mapInfo,
        modeInfo
      });
    }
    ensureStatusMessage(plugin2);
  }
  function observeServerPopulation(plugin2, server, client, isDisconnect, source, gameHint, mapHint, modeHint, isBootstrap) {
    if (!server) {
      plugin2.logger.logWarning(
        "{Name}: Population observation skipped because server was null (source={Source})",
        plugin2.name,
        String(source || "unknown")
      );
      return;
    }
    const serverKey = getServerKey(server);
    const serverName = cleanName(server.serverName || server.ServerName || server.hostname || server.Hostname || serverKey);
    setKnownServer(plugin2, serverKey, server);
    maybeRefreshGameMetadataFromApi(plugin2);
    const gameInfo = mergeNamedInfo(
      cachedGameInfoForServer(plugin2, server, serverKey),
      mergeNamedInfo(
        gameHint,
        mergeNamedInfo(extractGameInfoFromServer(server), plugin2.runtime.gameInfoByServer[serverKey])
      )
    );
    const mapInfo = mergeNamedInfo(
      mapHint,
      mergeNamedInfo(extractMapInfoFromServer(server), plugin2.runtime.mapInfoByServer[serverKey])
    );
    const modeInfo = mergeNamedInfo(
      modeHint,
      mergeNamedInfo(extractModeInfoFromServer(server), plugin2.runtime.modeInfoByServer[serverKey])
    );
    setServerMetadata(plugin2, serverKey, mapInfo, modeInfo, gameInfo);
    if (!wasServerProbeLogged(plugin2, serverKey)) {
      markServerProbeLogged(plugin2, serverKey);
      plugin2.logger.logInformation(
        "{Name}: PROBE server={Server} server_keys={Keys}",
        plugin2.name,
        serverKey,
        listKeys(server, 120)
      );
      plugin2.logger.logInformation(
        "{Name}: PROBE server={Server} map_keys={MapKeys} mode_type={ModeType}",
        plugin2.name,
        serverKey,
        listKeys(server.currentMap || server.CurrentMap || server.map || server.Map, 80),
        textFromUnknown(server.gameType || server.GameType || server.gametype || server.Gametype || "(none)")
      );
      plugin2.logger.logInformation(
        "{Name}: PROBE server={Server} game={Game} game_keys={GameKeys}",
        plugin2.name,
        serverKey,
        textFromUnknown(server.game || server.Game || server.gameName || server.GameName || "(none)"),
        listKeys(server.game || server.Game || server.gameInfo || server.GameInfo, 80)
      );
    }
    const activeNetworkIds = ensureActiveNetworkIds(plugin2, serverKey);
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
      plugin2.logger.logWarning(
        "{Name}: Population observation produced invalid count (source={Source}, server={Server})",
        plugin2.name,
        String(source || "unknown"),
        serverKey
      );
      return;
    }
    setStatusSnapshot(plugin2, serverKey, {
      serverName,
      playerCount,
      gameInfo,
      mapInfo,
      modeInfo
    });
    ensureStatusMessage(plugin2);
    evaluatePopulation(plugin2, serverKey, serverName, playerCount, {
      source: String(source || "unknown"),
      countSource,
      directCount,
      activeCount: trackedCount,
      networkId,
      isDisconnect: isDisconnect === true,
      isBootstrap: isBootstrap === true
    });
  }

  // src/infrastructure/host/iw4m-host.ts
  function resolveHostServices(serviceResolver) {
    const logger = serviceResolver.resolveService("ILogger", ["ScriptPluginV2"]);
    let manager = null;
    try {
      manager = serviceResolver.resolveService("IManager");
    } catch (_) {
      manager = null;
    }
    return { logger, manager };
  }

  // src/app/services/config-lifecycle.ts
  function configsMatch(left, right) {
    try {
      return JSON.stringify(left) === JSON.stringify(right);
    } catch (_) {
      return false;
    }
  }
  function initializeConfigLifecycle(plugin2) {
    plugin2.configWrapper.setName(plugin2.name);
    const stored = plugin2.configWrapper.getValue("config", (newConfig) => {
      if (!newConfig) return;
      plugin2.config = sanitizeConfig(newConfig);
      plugin2.refreshNotifiers();
      plugin2.runtime.statusDashboardFingerprint = "";
      plugin2.logger.logInformation(
        "{Name}: Config reloaded. alerts={Alerts} notifiers={Notifiers}",
        plugin2.name,
        thresholdListText(plugin2.config.alerts),
        plugin2.notifierNamesText()
      );
      plugin2.refreshStatusMessages();
    });
    if (stored != null) {
      const sanitized = sanitizeConfig(stored);
      plugin2.config = sanitized;
      if (!configsMatch(stored, sanitized)) {
        plugin2.configWrapper.setValue("config", sanitized);
      }
    } else {
      plugin2.configWrapper.setValue("config", plugin2.config);
    }
  }
  function logStartupConfig(plugin2) {
    plugin2.logger.logInformation(
      "{Name} {Version} by {Author} loaded. alerts={Alerts} max_players={MaxPlayers} notifiers={Notifiers}",
      plugin2.name,
      plugin2.version,
      plugin2.author,
      thresholdListText(plugin2.config.alerts),
      MAX_PLAYERS,
      plugin2.notifierNamesText()
    );
    plugin2.logger.logInformation(
      "{Name}: Discord config token_set={TokenSet} channel_set={ChannelSet}",
      plugin2.name,
      plugin2.config.discordBotToken ? "yes" : "no",
      plugin2.config.discordChannelId ? "yes" : "no"
    );
  }

  // src/app/services/command-status.ts
  function tellStatus(plugin2, commandEvent) {
    if (!commandEvent || !commandEvent.origin || typeof commandEvent.origin.tell !== "function") return;
    const keys = Object.keys(plugin2.runtime.populationStateByServer || {});
    const serverSummaries = [];
    for (let i = 0; i < keys.length; i++) {
      const serverKey = keys[i];
      const state = plugin2.runtime.populationStateByServer[serverKey] || {};
      const count = state.lastCount == null ? "?" : String(state.lastCount);
      const hasNotify = plugin2.runtime.notifyMessageIdByServer[serverKey] ? "notify:on" : "notify:off";
      serverSummaries.push(serverKey + "=" + count + "(" + hasNotify + ")");
    }
    const cooldownKeyCount = Object.keys(plugin2.runtime.notifyLastAtMsByKey || {}).length;
    const cooldownText = "per-threshold(" + cooldownKeyCount + ")";
    commandEvent.origin.tell(
      "Population Notifier v" + plugin2.version + " | alerts=" + thresholdListText(plugin2.config.alerts) + " | notifiers=" + plugin2.notifierNamesText() + " | discord=" + (plugin2.config.discordBotToken && plugin2.config.discordChannelId ? "configured" : "missing") + " | cooldown=" + cooldownText + " | status_msg=" + (plugin2.runtime.statusDashboardMessageId ? "1" : "0") + " | notify_msgs=" + Object.keys(plugin2.runtime.notifyMessageIdByServer || {}).length + " | servers=" + (serverSummaries.length > 0 ? serverSummaries.join(", ") : "(none)")
    );
  }

  // src/app/plugin.ts
  var PLUGIN_VERSION = true ? "1.0.0" : "0.0.0-dev";
  function observeFromEvent(plugin2, eventObj, source, isDisconnect, isBootstrap) {
    const observation = normalizeObservationFromEvent(eventObj, {
      isDisconnect,
      source,
      isBootstrap
    });
    plugin2.observeServerPopulation(
      observation.server,
      observation.client,
      observation.isDisconnect,
      observation.source,
      observation.gameHint,
      observation.mapHint,
      observation.modeHint,
      observation.isBootstrap
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
    runtime: createRuntimeState(),
    onLoad: function(serviceResolver, configWrapper, pluginHelper) {
      this.configWrapper = configWrapper;
      this.pluginHelper = pluginHelper;
      const resolved = resolveHostServices(serviceResolver);
      this.logger = resolved.logger;
      this.manager = resolved.manager;
      initializeConfigLifecycle(this);
      this.refreshNotifiers();
      logStartupConfig(this);
      if (!this.dispatcher || this.dispatcher.count === 0) {
        this.logger.logWarning("{Name}: No notifier destinations configured. Add discordBotToken and discordChannelId to enable alerts.", this.name);
        this.runtime.missingNotifierWarned = true;
      }
      this.runStartupPurgeThenBootstrap();
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
      scheduleDelayedBootstrap(this);
    },
    startBootstrapFlow: function() {
      startBootstrapFlow(this);
    },
    runStartupPurgeThenBootstrap: function() {
      runStartupPurgeThenBootstrap(this);
    },
    bootstrapKnownServers: function() {
      bootstrapKnownServers(this);
    },
    refreshStatusMessages: function() {
      refreshStatusMessages(this);
    },
    onClientStateInitialized: function(eventObj) {
      observeFromEvent(this, eventObj, "client_state_initialized", false, false);
    },
    onClientStateDisposed: function(eventObj) {
      observeFromEvent(this, eventObj, "client_state_disposed", true, false);
    },
    onServerMonitoringStarted: function(eventObj) {
      observeFromEvent(this, eventObj, "monitoring_started", false, true);
    },
    onMatchStarted: function(eventObj) {
      observeFromEvent(this, eventObj, "match_started", false, false);
    },
    onMatchEnded: function(eventObj) {
      observeFromEvent(this, eventObj, "match_ended", false, false);
    },
    observeServerPopulation: function(server, client, isDisconnect, source, gameHint, mapHint, modeHint, isBootstrap) {
      observeServerPopulation(this, server, client, isDisconnect, source, gameHint, mapHint, modeHint, isBootstrap);
    },
    tellStatus: function(commandEvent) {
      tellStatus(this, commandEvent);
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
