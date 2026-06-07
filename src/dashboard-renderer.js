import {
  DEFAULT_STATUS_OFFLINE_EMOJI,
  DEFAULT_STATUS_ONLINE_EMOJI,
  DEFAULT_THUMBNAIL_BASE_URL,
  MAX_PLAYERS
} from './config.js';
import { parseIntSafe } from './utils.js';
import { pickCleanString } from './server-metadata.js';

export const MAX_DASHBOARD_EMBEDS = 10;
const MAX_EMBED_DESCRIPTION_LENGTH = 3900;
const MAX_SERVER_BLOCK_LENGTH = 260;
const GAME_LOGO_FILE_BY_CODE = {
  IW3: 'COD 4 Logo.png',
  IW4: 'MW2 Logo.png',
  IW5: 'MW3 Logo.png',
  IW6: 'Ghost Logo.png',
  T4: 'WaW Logo.png',
  T5: 'Black Ops 1 Logo.png',
  T6: 'Black Ops 2 Logo.png',
  H1: 'HMW Logo.png',
  HMW: 'HMW Logo.png'
};
const GAME_LOGO_PLACEHOLDER_TEXT_BY_CODE = {
  T7: 'T7',
  SHG1: 'SHG1',
  H2M: 'H2M'
};
const GAME_LOGO_FOLDER = 'game-logos';
const DEFAULT_GAME_LOGO_PLACEHOLDER_URL = 'https://placehold.co/128x128/png?text=Game';

function gameLogoUrlFromFile(fileName) {
  const base = String(DEFAULT_THUMBNAIL_BASE_URL || '').replace(/\/+$/, '');
  if (!base || !fileName) return '';
  return base + '/' + GAME_LOGO_FOLDER + '/' + encodeURIComponent(fileName);
}

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

function truncateText(value, maxLength) {
  const text = String(value == null ? '' : value);
  const limit = parseIntSafe(maxLength, 0);
  if (limit <= 0 || text.length <= limit) return text;
  if (limit <= 3) return text.substring(0, limit);
  return text.substring(0, limit - 3) + '...';
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

function gameTitleFromSnapshot(snapshot) {
  const gameInfo = snapshot && snapshot.gameInfo ? snapshot.gameInfo : null;
  return pickCleanString([
    gameInfo && gameInfo.readable,
    snapshot && snapshot.gameText,
    gameInfo && gameInfo.slug
  ]) || 'Unknown Game';
}

function gameSlugFromSnapshot(snapshot) {
  const gameInfo = snapshot && snapshot.gameInfo ? snapshot.gameInfo : null;
  return pickCleanString([gameInfo && gameInfo.slug]).toUpperCase();
}

function gameLogoUrlFromGroup(group) {
  const slug = pickCleanString([group && group.slug]).toUpperCase();
  const s3Url = gameLogoUrlFromFile(GAME_LOGO_FILE_BY_CODE[slug]);
  if (s3Url) return s3Url;

  const placeholderText = GAME_LOGO_PLACEHOLDER_TEXT_BY_CODE[slug];
  if (placeholderText) return 'https://placehold.co/128x128/png?text=' + encodeURIComponent(placeholderText);

  return DEFAULT_GAME_LOGO_PLACEHOLDER_URL;
}

function modeTextFromSnapshot(snapshot) {
  const modeInfo = snapshot && snapshot.modeInfo ? snapshot.modeInfo : null;
  return pickCleanString([
    modeInfo && modeInfo.readable,
    snapshot && snapshot.modeText,
    modeInfo && modeInfo.slug
  ]) || 'unknown';
}

function formatMapForDashboard(snapshot) {
  const mapInfo = snapshot && snapshot.mapInfo ? snapshot.mapInfo : null;
  return pickCleanString([
    mapInfo && mapInfo.readable,
    snapshot && snapshot.mapText,
    mapInfo && mapInfo.slug
  ]) || 'unknown';
}

function statusEmojiForCount(playerCount, renderOptions) {
  const options = renderOptions || {};
  const onlineEmoji = pickCleanString([options.onlineEmoji, DEFAULT_STATUS_ONLINE_EMOJI]);
  const offlineEmoji = pickCleanString([options.offlineEmoji, DEFAULT_STATUS_OFFLINE_EMOJI]);
  return playerCount > 0 ? onlineEmoji : offlineEmoji;
}

function buildServerLine(snapshot, renderOptions) {
  const serverName = String(snapshot && snapshot.serverName ? snapshot.serverName : '(unknown server)');
  const playerCount = getSnapshotCount(snapshot);
  const mapText = formatMapForDashboard(snapshot);
  const modeText = modeTextFromSnapshot(snapshot);

  return truncateText(
    statusEmojiForCount(playerCount, renderOptions)
    + ' **' + serverName + '**  '
    + '`' + playerCount + '/' + MAX_PLAYERS + '`\n'
    + '*' + mapText + '*\n'
    + modeText,
    MAX_SERVER_BLOCK_LENGTH
  );
}

function createGameGroups(statusSnapshotByServer) {
  const groupsByTitle = {};
  const serverKeys = sortedServerKeysByPopulation(statusSnapshotByServer);

  for (let i = 0; i < serverKeys.length; i++) {
    const serverKey = serverKeys[i];
    const snapshot = statusSnapshotByServer[serverKey];
    if (!snapshot) continue;

    const title = gameTitleFromSnapshot(snapshot);
    if (!groupsByTitle[title]) {
      groupsByTitle[title] = {
        title: title,
        slug: gameSlugFromSnapshot(snapshot),
        servers: [],
        totalPlayers: 0,
        maxPlayerCount: 0
      };
    } else if (!groupsByTitle[title].slug) {
      groupsByTitle[title].slug = gameSlugFromSnapshot(snapshot);
    }

    const playerCount = getSnapshotCount(snapshot);
    groupsByTitle[title].servers.push(snapshot);
    groupsByTitle[title].totalPlayers += playerCount;
    if (playerCount > groupsByTitle[title].maxPlayerCount) {
      groupsByTitle[title].maxPlayerCount = playerCount;
    }
  }

  const groups = Object.values(groupsByTitle);
  groups.sort(function (left, right) {
    if (left.totalPlayers !== right.totalPlayers) return right.totalPlayers - left.totalPlayers;
    if (left.maxPlayerCount !== right.maxPlayerCount) return right.maxPlayerCount - left.maxPlayerCount;
    return left.title.localeCompare(right.title);
  });

  return groups;
}

function buildGameDescription(group, extraOverflowLine, renderOptions) {
  const lines = [
    '**' + group.servers.length + ' servers**\n'
    + '`' + group.totalPlayers + '/' + (group.servers.length * MAX_PLAYERS) + ' players`'
  ];
  let omitted = 0;

  for (let i = 0; i < group.servers.length; i++) {
    const line = buildServerLine(group.servers[i], renderOptions);
    const nextDescription = lines.concat([line]).join('\n\n');
    if (nextDescription.length > MAX_EMBED_DESCRIPTION_LENGTH) {
      omitted = group.servers.length - i;
      break;
    }
    lines.push(line);
  }

  if (omitted > 0) {
    const overflowLine = '_' + omitted + ' more server' + (omitted === 1 ? '' : 's') + ' not shown._';
    const nextDescription = lines.concat([overflowLine]).join('\n\n');
    if (nextDescription.length <= MAX_EMBED_DESCRIPTION_LENGTH) {
      lines.push(overflowLine);
    }
  }

  if (extraOverflowLine) {
    const nextDescription = lines.concat([extraOverflowLine]).join('\n\n');
    if (nextDescription.length <= MAX_EMBED_DESCRIPTION_LENGTH) {
      lines.push(extraOverflowLine);
    }
  }

  return lines.join('\n\n');
}

function buildGameEmbed(alerts, group, extraOverflowLine, renderOptions) {
  return {
    title: group.title,
    description: buildGameDescription(group, extraOverflowLine, renderOptions),
    color: statusColorFromPlayerCount(alerts, group.maxPlayerCount),
    thumbnail: { url: gameLogoUrlFromGroup(group) }
  };
}

export function buildDashboardPayload(alerts, statusSnapshotByServer, renderOptions) {
  const allGameGroups = createGameGroups(statusSnapshotByServer);
  const omittedGameCount = Math.max(0, allGameGroups.length - MAX_DASHBOARD_EMBEDS);
  const gameGroups = allGameGroups.slice(0, MAX_DASHBOARD_EMBEDS);
  const embeds = [];

  for (let i = 0; i < gameGroups.length; i++) {
    const overflowLine = i === gameGroups.length - 1 && omittedGameCount > 0
      ? '_' + omittedGameCount + ' more game group' + (omittedGameCount === 1 ? '' : 's') + ' not shown._'
      : '';
    embeds.push(buildGameEmbed(alerts, gameGroups[i], overflowLine, renderOptions));
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
