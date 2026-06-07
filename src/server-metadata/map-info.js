import { cleanName } from '../utils.js';
import { extractServerFromEvent } from '../event-extractors.js';
import { mapReadableFromSlug } from './map-name-overrides.js';
import { mergeNamedInfo, pickCleanString } from './text.js';

function withReadableFallbackFromSlug(info) {
  const current = info || { readable: '', slug: '' };
  const slug = pickCleanString([current.slug]);
  const readable = pickCleanString([current.readable, mapReadableFromSlug(slug)]);

  return {
    readable: readable,
    slug: slug
  };
}

export function extractMapInfoFromObject(mapValue) {
  if (!mapValue) {
    return { readable: '', slug: '' };
  }

  if (typeof mapValue === 'string') {
    return withReadableFallbackFromSlug({
      readable: '',
      slug: cleanName(mapValue)
    });
  }

  return withReadableFallbackFromSlug({
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
  });
}

export function extractMapInfoFromServer(server) {
  if (!server) {
    return { readable: '', slug: '' };
  }

  const fromCurrentMap = extractMapInfoFromObject(server.currentMap || server.CurrentMap);
  const fromMap = extractMapInfoFromObject(server.map || server.Map);
  const merged = mergeNamedInfo(fromCurrentMap, fromMap);

  return withReadableFallbackFromSlug({
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
  });
}

export function extractMapInfoFromEvent(eventObj) {
  if (!eventObj) {
    return { readable: '', slug: '' };
  }

  const direct = withReadableFallbackFromSlug({
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
  });

  const fromObject = extractMapInfoFromObject(
    eventObj.currentMap
    || eventObj.CurrentMap
    || eventObj.newCurrentMap
    || eventObj.NewCurrentMap
  );

  const fromServer = extractMapInfoFromServer(extractServerFromEvent(eventObj));
  return withReadableFallbackFromSlug(
    mergeNamedInfo(direct, mergeNamedInfo(fromObject, fromServer))
  );
}
