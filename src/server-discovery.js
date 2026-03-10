import { getServerKey, toArray } from './utils.js';

export function collectServersFromManager(manager) {
  if (!manager) return [];

  const methodNames = [
    'getServers',
    'GetServers',
    'getActiveServers',
    'GetActiveServers'
  ];

  const propertyNames = [
    'servers',
    'Servers',
    'activeServers',
    'ActiveServers',
    'gameServers',
    'GameServers'
  ];

  const gathered = [];

  for (let i = 0; i < methodNames.length; i++) {
    const methodName = methodNames[i];
    if (typeof manager[methodName] !== 'function') continue;

    try {
      const rows = toArray(manager[methodName]());
      for (let j = 0; j < rows.length; j++) {
        if (rows[j]) gathered.push(rows[j]);
      }
    } catch (_) { }
  }

  for (let i = 0; i < propertyNames.length; i++) {
    const propertyName = propertyNames[i];
    const rows = toArray(manager[propertyName]);
    for (let j = 0; j < rows.length; j++) {
      if (rows[j]) gathered.push(rows[j]);
    }
  }

  const unique = {};
  const out = [];
  for (let i = 0; i < gathered.length; i++) {
    const server = gathered[i];
    const key = getServerKey(server);
    if (unique[key]) continue;
    unique[key] = true;
    out.push(server);
  }

  return out;
}
