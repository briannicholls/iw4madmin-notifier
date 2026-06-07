import { cleanName } from '../utils.js';
import { extractServerFromEvent } from '../event-extractors.js';
import { mergeNamedInfo, pickCleanString } from './text.js';

export const GAME_DISPLAY_NAMES = {
  IW3: 'Call of Duty 4: Modern Warfare',
  IW4: 'Call of Duty: Modern Warfare 2',
  IW5: 'Call of Duty: Modern Warfare 3',
  IW6: 'Call of Duty: Ghosts',
  T4: 'Call of Duty: World at War',
  T5: 'Call of Duty: Black Ops',
  T6: 'Call of Duty: Black Ops 2',
  T7: 'Call of Duty: Black Ops 3',
  SHG1: 'Call of Duty: Advanced Warfare',
  H1: 'Call of Duty 4: Remastered',
  H2M: 'H2M-Mod'
};

export function normalizeGameCode(value) {
  return cleanName(value).toUpperCase();
}

export function gameCodeToDisplayName(value) {
  const code = normalizeGameCode(value);
  return GAME_DISPLAY_NAMES[code] || '';
}

function gameInfoFromValue(value) {
  const text = pickCleanString([value]);
  if (!text) return { readable: '', slug: '' };

  const code = normalizeGameCode(text);
  const displayName = gameCodeToDisplayName(code);
  if (displayName) {
    return {
      readable: displayName,
      slug: code
    };
  }

  return {
    readable: text,
    slug: code === text ? code : ''
  };
}

export function extractGameInfoFromObject(gameValue) {
  if (!gameValue) {
    return { readable: '', slug: '' };
  }

  if (typeof gameValue === 'string' || typeof gameValue === 'number') {
    return gameInfoFromValue(gameValue);
  }

  const readableInfo = gameInfoFromValue(pickCleanString([
    gameValue.displayName,
    gameValue.DisplayName,
    gameValue.name,
    gameValue.Name,
    gameValue.title,
    gameValue.Title,
    gameValue.gameName,
    gameValue.GameName
  ]));
  const slugInfo = gameInfoFromValue(pickCleanString([
    gameValue.code,
    gameValue.Code,
    gameValue.slug,
    gameValue.Slug,
    gameValue.id,
    gameValue.Id,
    gameValue.game,
    gameValue.Game
  ]));

  return mergeNamedInfo(readableInfo, slugInfo);
}

export function extractGameInfoFromServer(server) {
  if (!server) {
    return { readable: '', slug: '' };
  }

  const direct = mergeNamedInfo(
    extractGameInfoFromObject(server.game || server.Game),
    mergeNamedInfo(
      extractGameInfoFromObject(server.gameInfo || server.GameInfo),
      extractGameInfoFromObject(server.application || server.Application)
    )
  );
  const fields = mergeNamedInfo(
    gameInfoFromValue(pickCleanString([
      server.gameDisplayName,
      server.GameDisplayName,
      server.gameTitle,
      server.GameTitle,
      server.gameName,
      server.GameName
    ])),
    gameInfoFromValue(pickCleanString([
      server.gameCode,
      server.GameCode,
      server.parserVersion,
      server.ParserVersion,
      server.rConParserVersion,
      server.RConParserVersion,
      server.eventParserVersion,
      server.EventParserVersion
    ]))
  );

  return mergeNamedInfo(direct, fields);
}

export function extractGameInfoFromEvent(eventObj) {
  if (!eventObj) {
    return { readable: '', slug: '' };
  }

  const direct = mergeNamedInfo(
    extractGameInfoFromObject(eventObj.game || eventObj.Game),
    extractGameInfoFromObject(eventObj.gameInfo || eventObj.GameInfo)
  );
  const fields = mergeNamedInfo(
    gameInfoFromValue(pickCleanString([
      eventObj.gameDisplayName,
      eventObj.GameDisplayName,
      eventObj.gameTitle,
      eventObj.GameTitle,
      eventObj.gameName,
      eventObj.GameName
    ])),
    gameInfoFromValue(pickCleanString([
      eventObj.gameCode,
      eventObj.GameCode,
      eventObj.parserVersion,
      eventObj.ParserVersion,
      eventObj.rConParserVersion,
      eventObj.RConParserVersion,
      eventObj.eventParserVersion,
      eventObj.EventParserVersion
    ]))
  );

  const fromServer = extractGameInfoFromServer(extractServerFromEvent(eventObj));
  return mergeNamedInfo(mergeNamedInfo(direct, fields), fromServer);
}
