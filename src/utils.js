export function cleanName(value) {
  return String(value == null ? '' : value)
    // IW4 style formatting directives are caret-prefixed (e.g. ^1, ^F, ^H...).
    // Remove directive marker + directive char so display text is plain.
    .replace(/\^./g, '')
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim();
}

export function normalizeNetworkId(value) {
  if (value == null) return '';
  const normalized = String(value).trim();
  if (!normalized || normalized === '0') return '';
  return normalized;
}

export function parseIntSafe(value, fallback) {
  const parsed = parseInt(String(value == null ? '' : value), 10);
  return Number.isFinite(parsed) ? parsed : (fallback == null ? 0 : fallback);
}

export function getServerKey(server) {
  if (!server) return 'unknown';
  try {
    const byToString = String(server.toString ? server.toString() : '');
    if (byToString && byToString !== '[object Object]') return byToString;
  } catch (_) { }

  const fallback = server.listenAddress || server.id || server.serverId || 'unknown';
  return String(fallback);
}

export function toArray(source) {
  if (!source) return [];
  if (Array.isArray(source)) return source;

  const out = [];

  try {
    const count = parseIntSafe(source.Count || source.count || source.Length || source.length, 0);
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        if (source[i] !== undefined && source[i] !== null) out.push(source[i]);
      }
      if (out.length > 0) return out;
    }
  } catch (_) { }

  try {
    for (const item of source) {
      out.push(item);
    }
  } catch (_) { }

  return out;
}

export function getPlayerCountFromServer(server) {
  if (!server) return null;

  function countFromUnknown(value) {
    if (value == null) return -1;

    const directNumber = parseIntSafe(value, -1);
    if (directNumber >= 0) return directNumber;

    if (Array.isArray(value)) return value.length;

    const nestedCount = parseIntSafe(value.Count || value.count || value.Length || value.length, -1);
    if (nestedCount >= 0) return nestedCount;

    const asArray = toArray(value);
    if (asArray.length > 0) return asArray.length;

    return -1;
  }

  const candidates = [
    'clientCount',
    'ClientCount',
    'numClients',
    'NumClients',
    'currentPlayers',
    'CurrentPlayers',
    'connectedClients',
    'ConnectedClients',
    'clients',
    'Clients'
  ];

  for (let i = 0; i < candidates.length; i++) {
    const key = candidates[i];
    const parsed = countFromUnknown(server[key]);
    if (parsed >= 0) return parsed;
  }

  return null;
}

export function renderTemplate(template, values) {
  const source = String(template == null ? '' : template);
  return source.replace(/\{([A-Za-z0-9_]+)\}/g, function (_whole, key) {
    if (values && values[key] != null) {
      return String(values[key]);
    }
    return '';
  });
}

export function snippet(value, maxLength) {
  const limit = parseIntSafe(maxLength, 220);
  const text = String(value == null ? '' : value);
  if (text.length <= limit) return text;
  return text.substring(0, limit);
}
