import { thresholdListText } from '../../domain/config.js';

export function tellStatus(plugin: any, commandEvent: any): void {
  if (!commandEvent || !commandEvent.origin || typeof commandEvent.origin.tell !== 'function') return;

  const keys = Object.keys(plugin.runtime.populationStateByServer || {});
  const serverSummaries = [];

  for (let i = 0; i < keys.length; i++) {
    const serverKey = keys[i];
    const state = plugin.runtime.populationStateByServer[serverKey] || {};
    const count = state.lastCount == null ? '?' : String(state.lastCount);
    const hasNotify = plugin.runtime.notifyMessageIdByServer[serverKey] ? 'notify:on' : 'notify:off';
    serverSummaries.push(serverKey + '=' + count + '(' + hasNotify + ')');
  }

  const cooldownKeyCount = Object.keys(plugin.runtime.notifyLastAtMsByKey || {}).length;
  const cooldownText = 'per-threshold(' + cooldownKeyCount + ')';

  commandEvent.origin.tell(
    'Population Notifier v' + plugin.version
    + ' | alerts=' + thresholdListText(plugin.config.alerts)
    + ' | notifiers=' + plugin.notifierNamesText()
    + ' | discord=' + (plugin.config.discordBotToken && plugin.config.discordChannelId ? 'configured' : 'missing')
    + ' | cooldown=' + cooldownText
    + ' | status_msg=' + (plugin.runtime.statusDashboardMessageId ? '1' : '0')
    + ' | notify_msgs=' + Object.keys(plugin.runtime.notifyMessageIdByServer || {}).length
    + ' | servers=' + (serverSummaries.length > 0 ? serverSummaries.join(', ') : '(none)')
  );
}
