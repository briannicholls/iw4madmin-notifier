import { extractServerFromEvent } from '../event-extractors.js';
import { mergeNamedInfo, pickCleanString } from './text.js';

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
