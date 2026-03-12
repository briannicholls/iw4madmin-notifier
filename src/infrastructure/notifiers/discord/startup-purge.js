import { parseDiscordErrorCode } from './http-client.js';
import { computeRetryDelayMs } from './retry-policy.js';

export function createStartupPurgeService(messageOps, options) {
  const STARTUP_PURGE_FETCH_MAX_ATTEMPTS = options.STARTUP_PURGE_FETCH_MAX_ATTEMPTS;
  const STARTUP_PURGE_DELETE_MAX_ATTEMPTS = options.STARTUP_PURGE_DELETE_MAX_ATTEMPTS;
  const STARTUP_PURGE_RETRY_DEFAULT_MS = options.STARTUP_PURGE_RETRY_DEFAULT_MS;
  const STARTUP_PURGE_RETRY_MAX_MS = options.STARTUP_PURGE_RETRY_MAX_MS;

  function deleteMessageWithRetry(plugin, messageId, attemptNumber, done) {
    const attempt = Math.max(1, Number(attemptNumber || 1));
    messageOps.deleteMessage(plugin, messageId, {}, function (ok, errorText, details) {
      if (ok || (details && details.isMissingMessage)) {
        done(true, '', {
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
        errorText || 'unknown discord delete error');
      done(false, errorText || 'discord delete failed', details || {});
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
      messageOps.listChannelMessages(plugin, beforeMessageId, function (ok, messages, errorText, details) {
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

  function purgeStartupMessages(plugin, done) {
    messageOps.getCurrentBotUserId(plugin, function (ok, botUserId, errorText, details) {
      if (!ok) {
        done(false, errorText || 'failed to resolve bot identity', {
          scanned: 0,
          matched: 0,
          deleted: 0,
          pages: 0,
          rateLimited: !!(details && details.isRateLimited),
          discordCode: parseDiscordErrorCode(details && details.parsed)
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

  return {
    purgeStartupMessages
  };
}
