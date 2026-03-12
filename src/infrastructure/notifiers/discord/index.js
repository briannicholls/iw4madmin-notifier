import { createHeaders } from './http-client.js';
import { createMessageOps } from './message-ops.js';
import { createStartupPurgeService } from './startup-purge.js';

export function createDiscordNotifier(config) {
  const botToken = String(config && config.discordBotToken ? config.discordBotToken : '').trim();
  const channelId = String(config && config.discordChannelId ? config.discordChannelId : '').trim();

  if (!botToken || !channelId) return null;

  const headers = createHeaders(botToken);
  const createUrl = 'https://discord.com/api/v10/channels/' + channelId + '/messages';
  const meUrl = 'https://discord.com/api/v10/users/@me';
  const channelMessagesUrl = 'https://discord.com/api/v10/channels/' + channelId + '/messages';

  const messageOps = createMessageOps(createUrl, meUrl, channelMessagesUrl, headers);
  const startupPurge = createStartupPurgeService(messageOps, {
    STARTUP_PURGE_FETCH_MAX_ATTEMPTS: 4,
    STARTUP_PURGE_DELETE_MAX_ATTEMPTS: 4,
    STARTUP_PURGE_RETRY_DEFAULT_MS: 5000,
    STARTUP_PURGE_RETRY_MAX_MS: 60000
  });

  return {
    name: 'discord',

    upsertMessage: function (plugin, existingMessageId, payload, meta, done) {
      const type = meta && meta.type ? String(meta.type) : 'message';
      const serverKey = meta && meta.serverKey ? String(meta.serverKey) : '(unknown)';

      if (existingMessageId) {
        messageOps.updateMessage(plugin, existingMessageId, payload, meta, function (ok, messageId, errorText, details) {
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

          messageOps.createMessage(plugin, payload, meta, function (createOk, createMessageId, createErrorText, createDetails) {
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

      messageOps.createMessage(plugin, payload, meta, function (ok, messageId, errorText, details) {
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

      messageOps.deleteMessage(plugin, messageId, meta, function (ok, errorText, details) {
        if (!ok) {
          if (details && details.isMissingMessage) {
            plugin.logger.logInformation('{Name}: Discord {Type} message already missing server={Server} message_id={MessageId}; treating delete as success',
              plugin.name,
              type,
              serverKey,
              String(messageId));
            done(true, '', {
              statusCode: details.statusCode,
              retryAfterMs: 0,
              isRateLimited: false,
              isMissingMessage: true
            });
            return;
          }

          done(false, errorText || 'discord delete failed', details || {});
          return;
        }

        plugin.logger.logInformation('{Name}: Discord {Type} message deleted server={Server} message_id={MessageId} status={Status}',
          plugin.name,
          type,
          serverKey,
          String(messageId),
          details && details.statusCode == null ? '(unknown)' : String(details.statusCode));

        done(true, '', details || {
          statusCode: null,
          retryAfterMs: 0,
          isRateLimited: false,
          isMissingMessage: false
        });
      });
    },

    purgeStartupMessages: function (plugin, done) {
      startupPurge.purgeStartupMessages(plugin, done);
    }
  };
}
