import { normalizeNetworkId } from './utils.js';

export function extractClientFromEvent(eventObj) {
  if (!eventObj) return null;

  if (eventObj.client) return eventObj.client;
  if (eventObj.Client) return eventObj.Client;
  if (eventObj.origin) return eventObj.origin;
  if (eventObj.authorizedClient) return eventObj.authorizedClient;
  if (eventObj.AuthorizedClient) return eventObj.AuthorizedClient;

  const clientState = eventObj.clientState || eventObj.ClientState;
  if (clientState) {
    if (clientState.client) return clientState.client;
    if (clientState.Client) return clientState.Client;
    return clientState;
  }

  return null;
}

export function extractServerFromClient(client) {
  if (!client) return null;
  if (client.currentServer) return client.currentServer;
  if (client.CurrentServer) return client.CurrentServer;
  if (client.server) return client.server;
  if (client.Server) return client.Server;
  return null;
}

export function extractServerFromEvent(eventObj) {
  if (!eventObj) return null;

  if (eventObj.server) return eventObj.server;
  if (eventObj.Server) return eventObj.Server;
  if (eventObj.currentServer) return eventObj.currentServer;
  if (eventObj.CurrentServer) return eventObj.CurrentServer;

  const client = extractClientFromEvent(eventObj);
  return extractServerFromClient(client);
}

export function extractNetworkIdFromClient(client) {
  if (!client) return '';

  return normalizeNetworkId(
    client.networkId
    || client.NetworkId
    || client.networkID
    || client.NetworkID
    || client.xuid
    || client.Xuid
    || client.guid
    || client.Guid
    || null
  );
}
