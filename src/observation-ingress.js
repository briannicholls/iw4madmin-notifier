import { extractClientFromEvent, extractServerFromEvent } from './event-extractors.js';
import {
  extractGameInfoFromEvent,
  extractGameInfoFromServer,
  extractMapInfoFromEvent,
  extractMapInfoFromServer,
  extractModeInfoFromEvent,
  extractModeInfoFromServer
} from './server-metadata.js';

export function normalizeObservationFromEvent(eventObj, options) {
  const opts = options || {};
  const server = extractServerFromEvent(eventObj);
  return {
    server: server,
    client: extractClientFromEvent(eventObj),
    isDisconnect: opts.isDisconnect === true,
    source: String(opts.source || 'unknown'),
    gameHint: extractGameInfoFromEvent(eventObj),
    mapHint: extractMapInfoFromEvent(eventObj),
    modeHint: extractModeInfoFromEvent(eventObj),
    isBootstrap: opts.isBootstrap === true
  };
}

export function normalizeBootstrapObservation(server) {
  return {
    server: server,
    client: null,
    isDisconnect: false,
    source: 'bootstrap_manager',
    gameHint: extractGameInfoFromServer(server),
    mapHint: extractMapInfoFromServer(server),
    modeHint: extractModeInfoFromServer(server),
    isBootstrap: true
  };
}
