import { getServerKey, parseIntSafe, snippet } from '../../utils.js';
import { extractGameInfoFromServer, mergeNamedInfo, pickCleanString } from '../../server-metadata.js';

export const GAME_API_SYNC_INTERVAL_MS = 60 * 1000;

function responseToText(response) {
  if (response == null) return '';
  if (typeof response === 'string') return response;

  try {
    if (typeof response.body === 'string') return response.body;
    if (typeof response.content === 'string') return response.content;
    if (typeof response.data === 'string') return response.data;
  } catch (_) { }

  try {
    return JSON.stringify(response);
  } catch (_) {
    try {
      return String(response);
    } catch (_error) {
      return '';
    }
  }
}

function parseStatusCode(response) {
  const raw = response
    ? (response.statusCode || response.status || response.StatusCode || response.httpStatus)
    : null;
  const parsed = parseInt(String(raw == null ? '' : raw), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function tryParseJson(text) {
  const body = String(text == null ? '' : text).trim();
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch (_) {
    return null;
  }
}

function normalizeCacheKey(value) {
  return pickCleanString([value]).toLowerCase();
}

function buildServerApiUrl(baseUrl) {
  const base = String(baseUrl == null ? '' : baseUrl).trim().replace(/\/+$/, '');
  if (!base) return '';
  if (/\/api\/server$/i.test(base)) return base;
  return base + '/api/server';
}

function createEmptyHeaders() {
  try {
    const stringDict = System.Collections.Generic.Dictionary(System.String, System.String);
    return new stringDict();
  } catch (_) {
    return null;
  }
}

function requestServerRows(plugin, url, done) {
  try {
    const pluginScript = importNamespace('IW4MAdmin.Application.Plugin.Script');
    const request = new pluginScript.ScriptPluginWebRequest(
      url,
      '',
      'GET',
      'application/json',
      createEmptyHeaders()
    );

    plugin.pluginHelper.requestUrl(request, function (response) {
      const text = responseToText(response);
      const parsed = tryParseJson(text);
      const statusCode = parseStatusCode(response);
      const ok = Number.isFinite(statusCode) ? statusCode >= 200 && statusCode < 300 : !!parsed;

      done({
        ok: ok,
        statusCode: statusCode,
        parsed: parsed,
        errorText: ok ? '' : (statusCode ? 'status=' + statusCode + ' ' : '') + snippet(text, 220)
      });
    });
  } catch (error) {
    done({
      ok: false,
      statusCode: null,
      parsed: null,
      errorText: error && error.message ? error.message : 'IW4MAdmin API request setup failed'
    });
  }
}

function rowsFromParsedResponse(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== 'object') return [];
  if (Array.isArray(parsed.servers)) return parsed.servers;
  if (Array.isArray(parsed.Servers)) return parsed.Servers;
  if (Array.isArray(parsed.data)) return parsed.data;
  if (Array.isArray(parsed.Data)) return parsed.Data;
  return [];
}

function candidateKeysFromApiRow(row) {
  return [
    row && row.serverId,
    row && row.ServerId,
    row && row.id,
    row && row.Id,
    row && row.listenAddress,
    row && row.ListenAddress,
    row && row.endpoint,
    row && row.Endpoint,
    row && row.hostname,
    row && row.Hostname
  ];
}

function namedInfoChanged(existing, next) {
  const left = existing || {};
  const right = next || {};
  return String(left.readable || '') !== String(right.readable || '')
    || String(left.slug || '') !== String(right.slug || '');
}

function storeGameInfo(plugin, key, gameInfo) {
  const rawKey = pickCleanString([key]);
  if (!rawKey) return false;

  const normalizedKey = normalizeCacheKey(rawKey);
  let changed = false;
  const keys = normalizedKey && normalizedKey !== rawKey ? [rawKey, normalizedKey] : [rawKey];

  for (let i = 0; i < keys.length; i++) {
    const cacheKey = keys[i];
    const existing = plugin.runtime.gameInfoByServer[cacheKey];
    const next = mergeNamedInfo(gameInfo, existing);
    if (namedInfoChanged(existing, next)) changed = true;
    plugin.runtime.gameInfoByServer[cacheKey] = next;
  }

  return changed;
}

function applyServerRows(plugin, rows) {
  let changed = false;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const gameInfo = extractGameInfoFromServer(row);
    if (!pickCleanString([gameInfo.readable, gameInfo.slug])) continue;

    const keys = candidateKeysFromApiRow(row);
    for (let j = 0; j < keys.length; j++) {
      changed = storeGameInfo(plugin, keys[j], gameInfo) || changed;
    }
  }
  return changed;
}

export function maybeRefreshGameMetadataFromApi(plugin) {
  const baseUrl = plugin && plugin.config ? plugin.config.iw4mApiBaseUrl : '';
  const apiUrl = buildServerApiUrl(baseUrl);
  if (!apiUrl) return;
  if (!plugin.pluginHelper || typeof plugin.pluginHelper.requestUrl !== 'function') return;
  if (plugin.runtime.gameApiSyncInFlight) return;

  const nowMs = Date.now();
  const lastSyncAtMs = parseIntSafe(plugin.runtime.gameApiLastSyncAtMs, 0);
  if (lastSyncAtMs > 0 && nowMs - lastSyncAtMs < GAME_API_SYNC_INTERVAL_MS) return;

  plugin.runtime.gameApiSyncInFlight = true;
  plugin.runtime.gameApiLastSyncAtMs = nowMs;

  requestServerRows(plugin, apiUrl, function (result) {
    plugin.runtime.gameApiSyncInFlight = false;

    if (!result.ok) {
      plugin.logger.logWarning('{Name}: IW4MAdmin API server metadata sync failed - {Error}',
        plugin.name,
        String(result.errorText || 'unknown error'));
      return;
    }

    const rows = rowsFromParsedResponse(result.parsed);
    const changed = applyServerRows(plugin, rows);
    plugin.logger.logInformation('{Name}: IW4MAdmin API server metadata sync loaded {Count} server(s)',
      plugin.name,
      rows.length);

    if (changed && typeof plugin.refreshStatusMessages === 'function') {
      plugin.refreshStatusMessages();
    }
  });
}

export function cachedGameInfoForServer(plugin, server, serverKey) {
  const candidates = [
    serverKey,
    getServerKey(server),
    server && server.serverId,
    server && server.ServerId,
    server && server.id,
    server && server.Id,
    server && server.listenAddress,
    server && server.ListenAddress,
    server && server.endpoint,
    server && server.Endpoint,
    server && server.hostname,
    server && server.Hostname
  ];

  for (let i = 0; i < candidates.length; i++) {
    const rawKey = pickCleanString([candidates[i]]);
    if (!rawKey) continue;

    const direct = plugin.runtime.gameInfoByServer[rawKey];
    if (direct) return direct;

    const normalized = normalizeCacheKey(rawKey);
    if (normalized && plugin.runtime.gameInfoByServer[normalized]) {
      return plugin.runtime.gameInfoByServer[normalized];
    }
  }

  return { readable: '', slug: '' };
}
