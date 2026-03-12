import { parseDiscordErrorCode, requestJson } from './http-client.js';

export function createMessageOps(createUrl, meUrl, channelMessagesUrl, headers) {
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

  function deleteMessage(plugin, messageId, meta, done) {
    const url = createUrl + '/' + String(messageId);
    requestJson(plugin, url, 'DELETE', null, headers, function (result) {
      if (!result.ok) {
        done(false, result.errorText || 'discord delete failed', {
          statusCode: result.statusCode,
          retryAfterMs: result.retryAfterMs,
          isRateLimited: result.isRateLimited,
          isMissingMessage: result.isMissingMessage
        });
        return;
      }

      done(true, '', {
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
