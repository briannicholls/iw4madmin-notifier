import { createDiscordNotifier } from './discord.js';

export function createNotificationDispatcher(config) {
  const notifiers = [];

  const discord = createDiscordNotifier(config);
  if (discord) {
    notifiers.push(discord);
  }

  return {
    count: notifiers.length,
    names: notifiers.map(function (notifier) { return notifier.name; }),
    send: function (plugin, messageText, meta) {
      plugin.logger.logInformation('{Name}: Notification dispatch start notifiers={Count} threshold={Threshold} server={Server}',
        plugin.name,
        notifiers.length,
        meta && meta.threshold != null ? String(meta.threshold) : '(unknown)',
        meta && meta.serverKey ? String(meta.serverKey) : '(unknown)');

      for (let i = 0; i < notifiers.length; i++) {
        const notifier = notifiers[i];
        try {
          notifier.send(plugin, messageText, meta || {});
        } catch (error) {
          plugin.logger.logWarning('{Name}: Notifier {Notifier} failed - {Error}',
            plugin.name,
            notifier.name,
            error && error.message ? error.message : 'unknown notifier error');
        }
      }
    }
  };
}
