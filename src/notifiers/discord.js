import { snippet } from '../utils.js';

function responseToText(response) {
  if (response == null) return '';
  if (typeof response === 'string') return response;

  try {
    if (typeof response.body === 'string') return response.body;
    if (typeof response.content === 'string') return response.content;
    if (typeof response.data === 'string') return response.data;
  } catch (_) { }

  try {
    return JSON.stringify(response);
  } catch (_) {
    try {
      return String(response);
    } catch (_error) {
      return '';
    }
  }
}

function parseStatusCode(response) {
  const raw = response
    ? (response.statusCode || response.status || response.StatusCode || response.httpStatus)
    : null;
  const parsed = parseInt(String(raw == null ? '' : raw), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDiscordCode(parsed) {
  const raw = parsed && parsed.code != null ? parsed.code : null;
  const parsedCode = parseInt(String(raw == null ? '' : raw), 10);
  return Number.isFinite(parsedCode) ? parsedCode : 0;
}

function parseRetryAfterMs(parsed) {
  const raw = parsed
    ? (parsed.retry_after != null ? parsed.retry_after : parsed.retryAfter)
    : null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1000) return Math.round(value);
  return Math.round(value * 1000);
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
  if (parsed && typeof parsed.message === 'string') {
    return /rate\s*limited/i.test(parsed.message);
  }
  return false;
}

function isRetryableStatusCode(statusCode) {
  if (!Number.isFinite(statusCode)) return false;
  return statusCode === 429 || statusCode >= 500;
}

function tryParseJson(text) {
  const body = String(text == null ? '' : text).trim();
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch (_) {
    return null;
  }
}

function extractMessageId(parsed, text) {
  if (parsed && parsed.id) return String(parsed.id);

  const match = /"id"\s*:\s*"(\d+)"/.exec(String(text || ''));
  if (match && match[1]) return String(match[1]);

  return '';
}

function isLikelySuccess(response, statusCode, parsed, text, method) {
  if (response && response.success === false) return false;

  if (Number.isFinite(statusCode)) {
    return statusCode >= 200 && statusCode < 300;
  }

  if (parsed && (parsed.error || parsed.errors || parsed.code)) {
    return false;
  }

  if (method === 'DELETE') {
    return String(text || '').trim() === '';
  }

  const id = extractMessageId(parsed, text);
  if (id) return true;

  if (!text || String(text).trim() === '') return true;
  return false;
}

function computeRetryDelayMs(details, attemptNumber, defaultDelayMs, maxDelayMs) {
  const retryAfterMs = Number(details && details.retryAfterMs);
  if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
    return Math.max(1000, Math.min(maxDelayMs, Math.round(retryAfterMs)));
  }

  const statusCode = Number(details && details.statusCode);
  const isRateLimited = !!(details && details.isRateLimited);
  if (isRateLimited || isRetryableStatusCode(statusCode)) {
    const attempt = Math.max(1, Number.isFinite(Number(attemptNumber)) ? Number(attemptNumber) : 1);
    const baseDelay = Math.round(defaultDelayMs * attempt);
    return Math.max(1000, Math.min(maxDelayMs, baseDelay));
  }

  return 0;
}

function buildErrorText(statusCode, parsed, text) {
  if (parsed && typeof parsed.message === 'string' && parsed.message) {
    return parsed.message;
  }
  if (parsed && typeof parsed.error === 'string' && parsed.error) {
    return parsed.error;
  }
  if (parsed && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
    return typeof parsed.errors[0] === 'string' ? parsed.errors[0] : snippet(JSON.stringify(parsed.errors[0]), 220);
  }

  const textSnippet = snippet(text, 220);
  if (textSnippet) {
    if (Number.isFinite(statusCode)) {
      return 'status=' + statusCode + ' body=' + textSnippet;
    }
    return textSnippet;
  }

  if (Number.isFinite(statusCode)) return 'status=' + statusCode;
  return 'unknown discord response';
}

function createHeaders(botToken) {
  const stringDict = System.Collections.Generic.Dictionary(System.String, System.String);
  const headers = new stringDict();

  const token = String(botToken || '');
  const authValue = token.indexOf('Bot ') === 0 ? token : ('Bot ' + token);
  headers.add('Authorization', authValue);

  return headers;
}

function requestJson(plugin, url, method, bodyObject, headers, done) {
  try {
    const pluginScript = importNamespace('IW4MAdmin.Application.Plugin.Script');
    const body = bodyObject ? JSON.stringify(bodyObject) : '';

    const request = new pluginScript.ScriptPluginWebRequest(
      url,
      body,
      method,
      'application/json',
      headers
    );

    plugin.pluginHelper.requestUrl(request, function (response) {
      const text = responseToText(response);
      const parsed = tryParseJson(text);
      const statusCode = parseStatusCode(response);
      const messageId = extractMessageId(parsed, text);
      const ok = isLikelySuccess(response, statusCode, parsed, text, method);
      const errorText = ok ? '' : buildErrorText(statusCode, parsed, text);
      const retryAfterMs = parseRetryAfterMs(parsed);
      const isRateLimited = isRateLimitedResponse(statusCode, parsed);
      const isMissingMessage = isMissingMessageResponse(statusCode, parsed);

      done({
        ok: ok,
        statusCode: statusCode,
        parsed: parsed,
        text: text,
        messageId: messageId,
        errorText: errorText,
        retryAfterMs: retryAfterMs,
        isRateLimited: isRateLimited,
        isMissingMessage: isMissingMessage
      });
    });
  } catch (error) {
    done({
      ok: false,
      statusCode: null,
      parsed: null,
      text: '',
      messageId: '',
      errorText: error && error.message ? error.message : 'discord request setup failed',
      retryAfterMs: 0,
      isRateLimited: false,
      isMissingMessage: false
    });
  }
}

export function createDiscordNotifier(config) {
  const botToken = String(config && config.discordBotToken ? config.discordBotToken : '').trim();
  const channelId = String(config && config.discordChannelId ? config.discordChannelId : '').trim();

  if (!botToken || !channelId) return null;

  const headers = createHeaders(botToken);
  const createUrl = 'https://discord.com/api/v10/channels/' + channelId + '/messages';
  const meUrl = 'https://discord.com/api/v10/users/@me';
  const channelMessagesUrl = 'https://discord.com/api/v10/channels/' + channelId + '/messages';
  const STARTUP_PURGE_FETCH_MAX_ATTEMPTS = 4;
  const STARTUP_PURGE_DELETE_MAX_ATTEMPTS = 4;
  const STARTUP_PURGE_RETRY_DEFAULT_MS = 5000;
  const STARTUP_PURGE_RETRY_MAX_MS = 60000;

  function createMessage(plugin, payload, meta, done) {
    requestJson(plugin, createUrl, 'POST', payload, headers, function (result) {
      if (!result.ok) {
        done(false, '', result.errorText, {
          statusCode: result.statusCode,
          retryAfterMs: result.retryAfterMs,
          isRateLimited: result.isRateLimited,
          isMissingMessage: result.isMissingMessage
        });
        return;
      }

      done(true, result.messageId, '', {
        statusCode: result.statusCode,
        retryAfterMs: 0,
        isRateLimited: false,
        isMissingMessage: false
      });
    });
  }

  function updateMessage(plugin, messageId, payload, meta, done) {
    const url = createUrl + '/' + messageId;
    requestJson(plugin, url, 'PATCH', payload, headers, function (result) {
      if (!result.ok) {
        done(false, '', result.errorText, {
          statusCode: result.statusCode,
          retryAfterMs: result.retryAfterMs,
          isRateLimited: result.isRateLimited,
          isMissingMessage: result.isMissingMessage
        });
        return;
      }

      done(true, result.messageId || String(messageId), '', {
        statusCode: result.statusCode,
        retryAfterMs: 0,
        isRateLimited: false,
        isMissingMessage: false
      });
    });
  }

  function getCurrentBotUserId(plugin, done) {
    requestJson(plugin, meUrl, 'GET', null, headers, function (result) {
      if (!result.ok) {
        done(false, '', result.errorText || 'failed to query bot identity', {
          statusCode: result.statusCode,
          retryAfterMs: result.retryAfterMs,
          isRateLimited: result.isRateLimited,
          isMissingMessage: false,
          discordCode: parseDiscordErrorCode(result.parsed)
        });
        return;
      }

      const parsed = result.parsed || {};
      const botUserId = String(parsed.id || '').trim();
      if (!botUserId) {
        done(false, '', 'discord bot identity response missing id', {
          statusCode: result.statusCode,
          retryAfterMs: 0,
          isRateLimited: false,
          isMissingMessage: false,
          discordCode: 0
        });
        return;
      }

      done(true, botUserId, '', {
        statusCode: result.statusCode,
        retryAfterMs: 0,
        isRateLimited: false,
        isMissingMessage: false,
        discordCode: 0
      });
    });
  }

  function listChannelMessages(plugin, beforeMessageId, done) {
    let url = channelMessagesUrl + '?limit=100';
    if (beforeMessageId) {
      url += '&before=' + encodeURIComponent(String(beforeMessageId));
    }

    requestJson(plugin, url, 'GET', null, headers, function (result) {
      if (!result.ok) {
        done(false, [], result.errorText || 'discord list messages failed', {
          statusCode: result.statusCode,
          retryAfterMs: result.retryAfterMs,
          isRateLimited: result.isRateLimited,
          isMissingMessage: false,
          discordCode: parseDiscordErrorCode(result.parsed)
        });
        return;
      }

      const messages = Array.isArray(result.parsed) ? result.parsed : [];
      done(true, messages, '', {
        statusCode: result.statusCode,
        retryAfterMs: 0,
        isRateLimited: false,
        isMissingMessage: false,
        discordCode: 0
      });
    });
  }

  function deleteMessageWithRetry(plugin, messageId, attemptNumber, done) {
    const attempt = Math.max(1, Number(attemptNumber || 1));
    const url = createUrl + '/' + String(messageId);

    requestJson(plugin, url, 'DELETE', null, headers, function (result) {
      if (result.ok || result.isMissingMessage) {
        done(true, '', {
          statusCode: result.statusCode,
          retryAfterMs: 0,
          isRateLimited: false,
          isMissingMessage: !!result.isMissingMessage,
          discordCode: parseDiscordErrorCode(result.parsed)
        });
        return;
      }

      const details = {
        statusCode: result.statusCode,
        retryAfterMs: result.retryAfterMs,
        isRateLimited: result.isRateLimited,
        isMissingMessage: result.isMissingMessage,
        discordCode: parseDiscordErrorCode(result.parsed)
      };
      const retryDelayMs = computeRetryDelayMs(details, attempt, STARTUP_PURGE_RETRY_DEFAULT_MS, STARTUP_PURGE_RETRY_MAX_MS);
      const shouldRetry = retryDelayMs > 0 && attempt < STARTUP_PURGE_DELETE_MAX_ATTEMPTS;
      if (shouldRetry && plugin.pluginHelper && typeof plugin.pluginHelper.requestNotifyAfterDelay === 'function') {
        plugin.logger.logWarning('{Name}: Discord startup purge delete retry scheduled message_id={MessageId} attempt={Attempt} retry_ms={RetryMs}',
          plugin.name,
          String(messageId),
          attempt + 1,
          retryDelayMs);
        plugin.pluginHelper.requestNotifyAfterDelay(retryDelayMs, function () {
          deleteMessageWithRetry(plugin, messageId, attempt + 1, done);
        });
        return;
      }

      plugin.logger.logWarning('{Name}: Discord startup purge delete failed message_id={MessageId} error={Error}',
        plugin.name,
        String(messageId),
        result.errorText || 'unknown discord delete error');
      done(false, result.errorText || 'discord delete failed', details);
    });
  }

  function purgeChannelMessagesByAuthor(plugin, authorId, done) {
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

      const messageId = String(messageIds[index] || '');
      if (!messageId) {
        deleteMatchingMessages(messageIds, index + 1, onDone);
        return;
      }

      deleteMessageWithRetry(plugin, messageId, 1, function (ok, errorText, details) {
        if (details && details.isRateLimited) stats.rateLimited = true;
        if (ok) {
          stats.deleted += 1;
          deleteMatchingMessages(messageIds, index + 1, onDone);
          return;
        }

        plugin.logger.logWarning('{Name}: Startup purge could not delete message_id={MessageId} error={Error}',
          plugin.name,
          messageId,
          String(errorText || 'unknown startup purge delete error'));
        deleteMatchingMessages(messageIds, index + 1, onDone);
      });
    }

    function fetchPage(beforeMessageId, attemptNumber) {
      const fetchAttempt = Math.max(1, Number(attemptNumber || 1));
      listChannelMessages(plugin, beforeMessageId, function (ok, messages, errorText, details) {
        if (!ok) {
          if (details && details.isRateLimited) stats.rateLimited = true;
          const retryDelayMs = computeRetryDelayMs(details, fetchAttempt, STARTUP_PURGE_RETRY_DEFAULT_MS, STARTUP_PURGE_RETRY_MAX_MS);
          const shouldRetry = retryDelayMs > 0 && fetchAttempt < STARTUP_PURGE_FETCH_MAX_ATTEMPTS;
          if (shouldRetry && plugin.pluginHelper && typeof plugin.pluginHelper.requestNotifyAfterDelay === 'function') {
            plugin.logger.logWarning('{Name}: Discord startup purge list retry scheduled attempt={Attempt} retry_ms={RetryMs}',
              plugin.name,
              fetchAttempt + 1,
              retryDelayMs);
            plugin.pluginHelper.requestNotifyAfterDelay(retryDelayMs, function () {
              fetchPage(beforeMessageId, fetchAttempt + 1);
            });
            return;
          }

          done(false, errorText || 'discord list messages failed', stats);
          return;
        }

        stats.pages += 1;
        stats.scanned += messages.length;

        if (messages.length === 0) {
          done(true, '', stats);
          return;
        }

        const matchingIds = [];
        for (let i = 0; i < messages.length; i++) {
          const current = messages[i] || {};
          const messageId = String(current.id || '').trim();
          if (!messageId) continue;
          const currentAuthorId = String(current.author && current.author.id ? current.author.id : '').trim();
          if (currentAuthorId === String(authorId)) {
            matchingIds.push(messageId);
          }
        }
        stats.matched += matchingIds.length;

        const oldest = messages[messages.length - 1] || {};
        const nextBefore = String(oldest.id || '').trim();

        deleteMatchingMessages(matchingIds, 0, function () {
          if (!nextBefore) {
            done(true, '', stats);
            return;
          }

          fetchPage(nextBefore, 1);
        });
      });
    }

    fetchPage('', 1);
  }

  return {
    name: 'discord',

    upsertMessage: function (plugin, existingMessageId, payload, meta, done) {
      const type = meta && meta.type ? String(meta.type) : 'message';
      const serverKey = meta && meta.serverKey ? String(meta.serverKey) : '(unknown)';

      if (existingMessageId) {
        updateMessage(plugin, existingMessageId, payload, meta, function (ok, messageId, errorText, details) {
          if (ok) {
            plugin.logger.logInformation('{Name}: Discord {Type} message updated server={Server} message_id={MessageId} status={Status}',
              plugin.name,
              type,
              serverKey,
              messageId,
              details && details.statusCode != null ? String(details.statusCode) : '(unknown)');
            done(true, messageId, '', details || null);
            return;
          }

          const isMissingMessage = !!(details && details.isMissingMessage);
          if (!isMissingMessage) {
            plugin.logger.logWarning('{Name}: Discord {Type} update failed server={Server} message_id={MessageId} error={Error}',
              plugin.name,
              type,
              serverKey,
              String(existingMessageId),
              errorText || 'unknown error');
            done(false, '', errorText || 'discord update failed', details || null);
            return;
          }

          plugin.logger.logWarning('{Name}: Discord {Type} update target missing server={Server} message_id={MessageId}; creating replacement',
            plugin.name,
            type,
            serverKey,
            String(existingMessageId));

          createMessage(plugin, payload, meta, function (createOk, createMessageId, createErrorText, createDetails) {
            if (!createOk) {
              done(false, '', createErrorText || 'discord create failed after update fallback', createDetails || null);
              return;
            }

            plugin.logger.logInformation('{Name}: Discord {Type} message created server={Server} message_id={MessageId} status={Status}',
              plugin.name,
              type,
              serverKey,
              createMessageId || '(unknown)',
              createDetails && createDetails.statusCode != null ? String(createDetails.statusCode) : '(unknown)');
            done(true, createMessageId, '', createDetails || null);
          });
        });
        return;
      }

      createMessage(plugin, payload, meta, function (ok, messageId, errorText, details) {
        if (!ok) {
          done(false, '', errorText || 'discord create failed', details || null);
          return;
        }

        plugin.logger.logInformation('{Name}: Discord {Type} message created server={Server} message_id={MessageId} status={Status}',
          plugin.name,
          type,
          serverKey,
          messageId || '(unknown)',
          details && details.statusCode != null ? String(details.statusCode) : '(unknown)');

        done(true, messageId, '', details || null);
      });
    },

    deleteMessage: function (plugin, messageId, meta, done) {
      if (!messageId) {
        done(true, '');
        return;
      }

      const type = meta && meta.type ? String(meta.type) : 'message';
      const serverKey = meta && meta.serverKey ? String(meta.serverKey) : '(unknown)';
      const url = createUrl + '/' + String(messageId);

      requestJson(plugin, url, 'DELETE', null, headers, function (result) {
        if (!result.ok) {
          if (result.isMissingMessage) {
            plugin.logger.logInformation('{Name}: Discord {Type} message already missing server={Server} message_id={MessageId}; treating delete as success',
              plugin.name,
              type,
              serverKey,
              String(messageId));
            done(true, '', {
              statusCode: result.statusCode,
              retryAfterMs: 0,
              isRateLimited: false,
              isMissingMessage: true
            });
            return;
          }

          done(false, result.errorText || 'discord delete failed', {
            statusCode: result.statusCode,
            retryAfterMs: result.retryAfterMs,
            isRateLimited: result.isRateLimited,
            isMissingMessage: result.isMissingMessage
          });
          return;
        }

        plugin.logger.logInformation('{Name}: Discord {Type} message deleted server={Server} message_id={MessageId} status={Status}',
          plugin.name,
          type,
          serverKey,
          String(messageId),
          result.statusCode == null ? '(unknown)' : String(result.statusCode));

        done(true, '', {
          statusCode: result.statusCode,
          retryAfterMs: 0,
          isRateLimited: false,
          isMissingMessage: false
        });
      });
    },

    purgeStartupMessages: function (plugin, done) {
      getCurrentBotUserId(plugin, function (ok, botUserId, errorText, details) {
        if (!ok) {
          done(false, errorText || 'failed to resolve bot identity', {
            scanned: 0,
            matched: 0,
            deleted: 0,
            pages: 0,
            rateLimited: !!(details && details.isRateLimited)
          });
          return;
        }

        purgeChannelMessagesByAuthor(plugin, botUserId, function (purgeOk, purgeErrorText, stats) {
          if (!purgeOk) {
            done(false, purgeErrorText || 'startup purge failed', stats || {
              scanned: 0,
              matched: 0,
              deleted: 0,
              pages: 0,
              rateLimited: false
            });
            return;
          }

          done(true, '', stats || {
            scanned: 0,
            matched: 0,
            deleted: 0,
            pages: 0,
            rateLimited: false
          });
        });
      });
    }
  };
}
