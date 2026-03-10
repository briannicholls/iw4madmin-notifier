import { cleanName, parseIntSafe } from './utils.js';
import { extractServerFromEvent } from './event-extractors.js';

export function textFromUnknown(value) {
  if (value == null) return '';

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return cleanName(String(value));
  }

  try {
    if (typeof value.toString === 'function') {
      const rendered = cleanName(value.toString());
      if (rendered && rendered !== '[object Object]') return rendered;
    }
  } catch (_) { }

  return '';
}

export function pickCleanString(values) {
  const list = Array.isArray(values) ? values : [];
  for (let i = 0; i < list.length; i++) {
    const cleaned = textFromUnknown(list[i]);
    if (cleaned) return cleaned;
  }
  return '';
}

export function listKeys(value, maxCount) {
  if (!value) return '(none)';

  const keys = [];
  try {
    const own = Object.keys(value);
    for (let i = 0; i < own.length; i++) keys.push(String(own[i]));
  } catch (_) { }

  try {
    for (const key in value) {
      keys.push(String(key));
    }
  } catch (_) { }

  const unique = Array.from(new Set(keys)).sort();
  if (unique.length === 0) return '(none)';

  const limit = Math.max(10, parseIntSafe(maxCount, 80));
  return unique.slice(0, limit).join(',') + (unique.length > limit ? ',...(truncated)' : '');
}

export function mergeNamedInfo(primary, secondary) {
  const left = primary || {};
  const right = secondary || {};

  return {
    readable: pickCleanString([left.readable, right.readable]),
    slug: pickCleanString([left.slug, right.slug])
  };
}

export function extractMapInfoFromObject(mapValue) {
  if (!mapValue) {
    return { readable: '', slug: '' };
  }

  if (typeof mapValue === 'string') {
    return {
      readable: '',
      slug: cleanName(mapValue)
    };
  }

  return {
    readable: pickCleanString([
      mapValue.alias,
      mapValue.Alias,
      mapValue.displayName,
      mapValue.DisplayName,
      mapValue.localizedName,
      mapValue.LocalizedName
    ]),
    slug: pickCleanString([
      mapValue.name,
      mapValue.Name,
      mapValue.mapName,
      mapValue.MapName,
      mapValue.slug,
      mapValue.Slug,
      mapValue.code,
      mapValue.Code,
      mapValue.id,
      mapValue.Id,
      mapValue
    ])
  };
}

export function extractMapInfoFromServer(server) {
  if (!server) {
    return { readable: '', slug: '' };
  }

  const fromCurrentMap = extractMapInfoFromObject(server.currentMap || server.CurrentMap);
  const fromMap = extractMapInfoFromObject(server.map || server.Map);
  const merged = mergeNamedInfo(fromCurrentMap, fromMap);

  return {
    readable: pickCleanString([
      merged.readable,
      server.mapAlias,
      server.MapAlias,
      server.currentMapAlias,
      server.CurrentMapAlias
    ]),
    slug: pickCleanString([
      merged.slug,
      server.mapName,
      server.MapName,
      server.currentMapName,
      server.CurrentMapName
    ])
  };
}

export function extractMapInfoFromEvent(eventObj) {
  if (!eventObj) {
    return { readable: '', slug: '' };
  }

  const direct = {
    readable: pickCleanString([
      eventObj.mapAlias,
      eventObj.MapAlias,
      eventObj.currentMapAlias,
      eventObj.CurrentMapAlias
    ]),
    slug: pickCleanString([
      eventObj.mapName,
      eventObj.MapName,
      eventObj.newMap,
      eventObj.NewMap,
      eventObj.currentMapName,
      eventObj.CurrentMapName
    ])
  };

  const fromObject = extractMapInfoFromObject(
    eventObj.currentMap
    || eventObj.CurrentMap
    || eventObj.newCurrentMap
    || eventObj.NewCurrentMap
  );

  const fromServer = extractMapInfoFromServer(extractServerFromEvent(eventObj));
  return mergeNamedInfo(direct, mergeNamedInfo(fromObject, fromServer));
}

export function extractModeInfoFromServer(server) {
  if (!server) {
    return { readable: '', slug: '' };
  }

  return {
    readable: pickCleanString([
      server.gametypeName,
      server.GametypeName,
      server.gameTypeName,
      server.GameTypeName,
      server.gameModeName,
      server.GameModeName,
      server.modeName,
      server.ModeName
    ]),
    slug: pickCleanString([
      server.gameType,
      server.GameType,
      server.gametype,
      server.Gametype,
      server.gameMode,
      server.GameMode,
      server.mode,
      server.Mode,
      server.gameTypeCode,
      server.GameTypeCode,
      server.gametypeCode,
      server.GametypeCode
    ])
  };
}

export function extractModeInfoFromEvent(eventObj) {
  if (!eventObj) {
    return { readable: '', slug: '' };
  }

  const direct = {
    readable: pickCleanString([
      eventObj.gametypeName,
      eventObj.GametypeName,
      eventObj.gameTypeName,
      eventObj.GameTypeName,
      eventObj.gameModeName,
      eventObj.GameModeName
    ]),
    slug: pickCleanString([
      eventObj.gameType,
      eventObj.GameType,
      eventObj.gametype,
      eventObj.Gametype,
      eventObj.gameMode,
      eventObj.GameMode
    ])
  };

  const fromServer = extractModeInfoFromServer(extractServerFromEvent(eventObj));
  return mergeNamedInfo(direct, fromServer);
}

export function formatNamedInfoForStatus(info, unknownValue) {
  const readable = pickCleanString([info && info.readable]);
  const slug = pickCleanString([info && info.slug]);

  if (readable && slug && readable.toLowerCase() !== slug.toLowerCase()) {
    return readable + ' (`' + slug + '`)';
  }
  if (readable) return readable;
  if (slug) return '`' + slug + '`';
  return unknownValue || 'unknown';
}
