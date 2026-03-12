import { MAX_PLAYERS, sanitizeConfig, thresholdListText } from '../../domain/config.js';

function configsMatch(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch (_) {
    return false;
  }
}

export function initializeConfigLifecycle(plugin: any): void {
  plugin.configWrapper.setName(plugin.name);

  const stored = plugin.configWrapper.getValue('config', (newConfig: unknown) => {
    if (!newConfig) return;

    plugin.config = sanitizeConfig(newConfig);
    plugin.refreshNotifiers();
    plugin.runtime.statusDashboardFingerprint = '';

    plugin.logger.logInformation('{Name}: Config reloaded. alerts={Alerts} notifiers={Notifiers}',
      plugin.name,
      thresholdListText(plugin.config.alerts),
      plugin.notifierNamesText());

    plugin.refreshStatusMessages();
  });

  if (stored != null) {
    const sanitized = sanitizeConfig(stored);
    plugin.config = sanitized;
    if (!configsMatch(stored, sanitized)) {
      plugin.configWrapper.setValue('config', sanitized);
    }
  } else {
    plugin.configWrapper.setValue('config', plugin.config);
  }
}

export function logStartupConfig(plugin: any): void {
  plugin.logger.logInformation('{Name} {Version} by {Author} loaded. alerts={Alerts} max_players={MaxPlayers} notifiers={Notifiers}',
    plugin.name,
    plugin.version,
    plugin.author,
    thresholdListText(plugin.config.alerts),
    MAX_PLAYERS,
    plugin.notifierNamesText());

  plugin.logger.logInformation('{Name}: Discord config token_set={TokenSet} channel_set={ChannelSet}',
    plugin.name,
    plugin.config.discordBotToken ? 'yes' : 'no',
    plugin.config.discordChannelId ? 'yes' : 'no');
}
