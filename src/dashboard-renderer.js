import { MAX_PLAYERS } from './config.js';
import { parseIntSafe } from './utils.js';
import { pickCleanString } from './server-metadata.js';
import { resolveT6ThumbnailUrl } from './t6-thumbnails.js';

export const MAX_DASHBOARD_EMBEDS = 10;

export function statusColorFromPlayerCount(alerts, playerCount) {
  const count = parseIntSafe(playerCount, 0);
  const list = Array.isArray(alerts) ? alerts : [];
  let highestThreshold = 0;

  for (let i = 0; i < list.length; i++) {
    const threshold = parseIntSafe(list[i] && list[i].threshold, 0);
    if (count >= threshold && threshold > highestThreshold) highestThreshold = threshold;
  }

  if (highestThreshold >= 11) return 15158332;
  if (highestThreshold >= 6) return 15844367;
  if (highestThreshold >= 1) return 3066993;
  return 3447003;
}

function getSnapshotCount(snapshot) {
  return parseIntSafe(snapshot && snapshot.playerCount, 0);
}

export function sortedServerKeysByPopulation(statusSnapshotByServer) {
  const keys = Object.keys(statusSnapshotByServer || {});
  keys.sort(function (leftKey, rightKey) {
    const leftCount = getSnapshotCount(statusSnapshotByServer[leftKey]);
    const rightCount = getSnapshotCount(statusSnapshotByServer[rightKey]);
    if (leftCount !== rightCount) return rightCount - leftCount;
    return String(leftKey).localeCompare(String(rightKey));
  });
  return keys;
}

function buildServerEmbed(alerts, snapshot) {
  const serverName = String(snapshot && snapshot.serverName ? snapshot.serverName : '(unknown server)');
  const playerCount = getSnapshotCount(snapshot);
  const mapInfo = snapshot && snapshot.mapInfo ? snapshot.mapInfo : null;
  const modeInfo = snapshot && snapshot.modeInfo ? snapshot.modeInfo : null;
  const mapReadable = pickCleanString([mapInfo && mapInfo.readable, snapshot && snapshot.mapText]);
  const mapSlug = pickCleanString([mapInfo && mapInfo.slug]);
  const modeReadable = pickCleanString([modeInfo && modeInfo.readable, snapshot && snapshot.modeText]);
  const mapText = mapReadable || 'unknown';
  const modeText = modeReadable || 'unknown';
  const imageUrl = pickCleanString([snapshot && snapshot.imageUrl]) || resolveT6ThumbnailUrl(mapSlug, mapReadable);

  const embed = {
    title: serverName,
    description:
      '**Players:** ' + playerCount + '/' + MAX_PLAYERS + '\n'
      + '**Map:** ' + mapText + '\n'
      + '**Mode:** ' + modeText,
    color: statusColorFromPlayerCount(alerts, playerCount)
  };

  if (imageUrl) {
    embed.thumbnail = { url: imageUrl };
  }

  return embed;
}

export function buildDashboardPayload(alerts, statusSnapshotByServer) {
  const serverKeys = sortedServerKeysByPopulation(statusSnapshotByServer).slice(0, MAX_DASHBOARD_EMBEDS);
  const embeds = [];

  for (let i = 0; i < serverKeys.length; i++) {
    const serverKey = serverKeys[i];
    const snapshot = statusSnapshotByServer[serverKey];
    if (!snapshot) continue;
    embeds.push(buildServerEmbed(alerts, snapshot));
  }

  if (embeds.length === 0) {
    embeds.push({
      title: 'Server Population',
      description: 'No server data available yet.',
      color: 3447003
    });
  }

  return {
    content: '',
    embeds: embeds,
    allowed_mentions: { parse: [] }
  };
}
