import { extractClientFromEvent, extractServerFromEvent } from './event-extractors.js';
import {
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
    mapHint: extractMapInfoFromServer(server),
    modeHint: extractModeInfoFromServer(server),
    isBootstrap: true
  };
}
