import { NOTIFY_MENTION_PREFIX, buildMessageContext, formatPopulationMessage } from '../../config.js';
import { parseIntSafe } from '../../utils.js';

function buildNotifyMentionData(plugin) {
  const roleId = String(plugin && plugin.config && plugin.config.discordRoleId ? plugin.config.discordRoleId : '').trim();
  if (roleId) {
    return {
      prefix: '<@&' + roleId + '>',
      allowedMentions: {
        parse: [],
        roles: [roleId]
      }
    };
  }

  return {
    prefix: NOTIFY_MENTION_PREFIX,
    allowedMentions: {
      parse: ['everyone']
    }
  };
}

export function buildNotifyPayload(plugin, alert, serverKey, serverName, playerCount) {
  const threshold = parseIntSafe(alert.threshold, 0);
  const context = buildMessageContext(serverName, serverKey, playerCount, threshold);
  let sentence = formatPopulationMessage(alert.message, context);
  sentence = String(sentence || '').replace(/\s+/g, ' ').trim();
  if (!sentence) {
    sentence = serverName + ' is filling up.';
  }
  if (!/[.!?]$/.test(sentence)) {
    sentence += '.';
  }

  const mentionData = buildNotifyMentionData(plugin);
  const content = mentionData.prefix + ' ' + sentence;

  return {
    content: content,
    allowed_mentions: mentionData.allowedMentions
  };
}
