import { createDiscordNotifier } from './discord.js';

export function createNotificationDispatcher(config) {
  const discord = createDiscordNotifier(config);
  const notifiers = [];
  if (discord) notifiers.push(discord);

  return {
    count: notifiers.length,
    names: notifiers.map(function (notifier) {
      return notifier.name;
    }),

    upsertMessage: function (plugin, existingMessageId, payload, meta, done) {
      if (notifiers.length === 0) {
        done(false, '', 'no notifier configured');
        return;
      }

      const primary = notifiers[0];
      primary.upsertMessage(plugin, existingMessageId, payload, meta || {}, done);
    },

    deleteMessage: function (plugin, messageId, meta, done) {
      if (notifiers.length === 0) {
        done(false, 'no notifier configured');
        return;
      }

      const primary = notifiers[0];
      primary.deleteMessage(plugin, messageId, meta || {}, done);
    },

    purgeStartupMessages: function (plugin, done) {
      if (notifiers.length === 0) {
        done(true, '', { scanned: 0, matched: 0, deleted: 0, pages: 0, rateLimited: false });
        return;
      }

      const primary = notifiers[0];
      if (typeof primary.purgeStartupMessages !== 'function') {
        done(true, '', { scanned: 0, matched: 0, deleted: 0, pages: 0, rateLimited: false });
        return;
      }

      primary.purgeStartupMessages(plugin, done);
    }
  };
}
