import { cleanName, parseIntSafe, renderTemplate } from './utils.js';

export const MAX_PLAYERS = 18;
export const GLOBAL_NOTIFY_COOLDOWN_MS = 60 * 60 * 1000;
export const NOTIFY_CLEAR_BELOW_COUNT = 3;
export const NOTIFY_MENTION_PREFIX = '@here';

const DEFAULT_ALERTS = [
  {
    threshold: 1,
    message: '{serverName} is getting active.'
  },
  {
    threshold: 6,
    message: '{serverName} is filling up.'
  },
  {
    threshold: 11,
    message: '{serverName} is getting crowded.'
  }
];

const LEGACY_DEFAULT_ALERT_MESSAGES = [
  '[Join] {serverName} has activity ({playerCount}/{maxPlayers}).',
  '[Warmup] {serverName} reached {playerCount}/{maxPlayers} players.',
  '[Hot] {serverName} reached {playerCount}/{maxPlayers} players. {slotsRemaining} slots left.'
];

export const defaultConfig = {
  alerts: DEFAULT_ALERTS.map(copyAlert),
  discordBotToken: '',
  discordChannelId: '',
  thumbnailBaseUrl: '',
  mapImageUrls: {}
};

function copyAlert(alert) {
  return {
    threshold: alert.threshold,
    message: alert.message
  };
}

function defaultMessageForThreshold(threshold) {
  if (threshold <= 1) {
    return '{serverName} is getting active.';
  }
  if (threshold <= 6) {
    return '{serverName} is filling up.';
  }
  return '{serverName} is getting crowded.';
}

function normalizeAlertMessage(threshold, message) {
  const raw = String(message == null ? '' : message).trim();
  if (!raw) return defaultMessageForThreshold(threshold);

  if (LEGACY_DEFAULT_ALERT_MESSAGES.indexOf(raw) !== -1) {
    return defaultMessageForThreshold(threshold);
  }

  return raw;
}

function sanitizeAlerts(inputAlerts) {
  const rawAlerts = Array.isArray(inputAlerts) ? inputAlerts : [];
  const dedupe = {};

  for (let i = 0; i < rawAlerts.length; i++) {
    const current = rawAlerts[i] || {};
    const thresholdRaw = parseIntSafe(current.threshold, -1);
    if (thresholdRaw < 1) continue;

    const threshold = thresholdRaw > MAX_PLAYERS ? MAX_PLAYERS : thresholdRaw;
    const message = normalizeAlertMessage(threshold, current.message);
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

export function normalizeMapKey(value) {
  return cleanName(value).toLowerCase();
}

function sanitizeMapImageUrls(rawValue) {
  if (!rawValue || typeof rawValue !== 'object') return {};

  const source = rawValue;
  const out = {};
  const keys = Object.keys(source);

  for (let i = 0; i < keys.length; i++) {
    const rawKey = keys[i];
    const normalizedKey = normalizeMapKey(rawKey);
    if (!normalizedKey) continue;

    const url = String(source[rawKey] == null ? '' : source[rawKey]).trim();
    if (!url) continue;

    out[normalizedKey] = url;
  }

  return out;
}

export function sanitizeConfig(rawConfig) {
  const source = rawConfig || {};
  return {
    alerts: sanitizeAlerts(source.alerts),
    discordBotToken: String(source.discordBotToken == null ? '' : source.discordBotToken).trim(),
    discordChannelId: String(source.discordChannelId == null ? '' : source.discordChannelId).trim(),
    thumbnailBaseUrl: String(source.thumbnailBaseUrl == null ? '' : source.thumbnailBaseUrl).trim(),
    mapImageUrls: sanitizeMapImageUrls(source.mapImageUrls)
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

export function resolveMapImageUrl(mapImageUrls, mapName) {
  const key = normalizeMapKey(mapName);
  if (!key) return '';

  const source = mapImageUrls || {};
  const value = source[key];
  if (!value) return '';
  return String(value);
}
