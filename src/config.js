import { parseIntSafe, renderTemplate } from './utils.js';

export const MAX_PLAYERS = 18;

const DEFAULT_ALERTS = [
  {
    threshold: 1,
    message: '[Join] {serverName} has activity ({playerCount}/{maxPlayers}).'
  },
  {
    threshold: 6,
    message: '[Warmup] {serverName} reached {playerCount}/{maxPlayers} players.'
  },
  {
    threshold: 11,
    message: '[Hot] {serverName} reached {playerCount}/{maxPlayers} players. {slotsRemaining} slots left.'
  }
];

export const defaultConfig = {
  alerts: DEFAULT_ALERTS.map(copyAlert),
  discordBotToken: '',
  discordChannelId: ''
};

function copyAlert(alert) {
  return {
    threshold: alert.threshold,
    message: alert.message
  };
}

function defaultMessageForThreshold(threshold) {
  if (threshold <= 1) {
    return '[Join] {serverName} has activity ({playerCount}/{maxPlayers}).';
  }
  if (threshold <= 6) {
    return '[Warmup] {serverName} reached {playerCount}/{maxPlayers} players.';
  }
  return '[Hot] {serverName} reached {playerCount}/{maxPlayers} players. {slotsRemaining} slots left.';
}

function sanitizeAlerts(inputAlerts) {
  const rawAlerts = Array.isArray(inputAlerts) ? inputAlerts : [];
  const dedupe = {};

  for (let i = 0; i < rawAlerts.length; i++) {
    const current = rawAlerts[i] || {};
    const thresholdRaw = parseIntSafe(current.threshold, -1);
    if (thresholdRaw < 1) continue;

    const threshold = thresholdRaw > MAX_PLAYERS ? MAX_PLAYERS : thresholdRaw;
    const message = String(current.message == null ? '' : current.message).trim() || defaultMessageForThreshold(threshold);
    dedupe[String(threshold)] = {
      threshold: threshold,
      message: message
    };
  }

  const sanitized = Object.values(dedupe).sort(function (left, right) {
    return left.threshold - right.threshold;
  });

  if (sanitized.length === 0) {
    return DEFAULT_ALERTS.map(copyAlert);
  }

  return sanitized;
}

export function sanitizeConfig(rawConfig) {
  const source = rawConfig || {};
  return {
    alerts: sanitizeAlerts(source.alerts),
    discordBotToken: String(source.discordBotToken == null ? '' : source.discordBotToken).trim(),
    discordChannelId: String(source.discordChannelId == null ? '' : source.discordChannelId).trim()
  };
}

export function thresholdListText(alerts) {
  const list = Array.isArray(alerts) ? alerts : [];
  if (list.length === 0) return '(none)';

  const thresholds = [];
  for (let i = 0; i < list.length; i++) {
    thresholds.push(String(list[i].threshold));
  }

  return thresholds.join(',');
}

export function formatPopulationMessage(template, context) {
  return renderTemplate(template, context);
}

export function buildMessageContext(serverName, serverKey, playerCount, threshold) {
  const safeCount = parseIntSafe(playerCount, 0);
  const remaining = Math.max(0, MAX_PLAYERS - safeCount);
  const fillPercent = Math.round((safeCount / MAX_PLAYERS) * 100);

  return {
    serverName: serverName,
    serverKey: serverKey,
    playerCount: safeCount,
    maxPlayers: MAX_PLAYERS,
    slotsRemaining: remaining,
    threshold: threshold,
    fillPercent: fillPercent
  };
}
