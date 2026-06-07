export type UnknownRecord = Record<string, unknown>;

export interface AlertRule {
  threshold: number;
  message: string;
}

export interface PluginConfig {
  alerts: AlertRule[];
  discordBotToken: string;
  discordChannelId: string;
  discordRoleId: string;
  iw4mApiBaseUrl: string;
}

export interface NamedInfo {
  readable: string;
  slug: string;
}

export interface StatusSnapshot {
  serverName: string;
  playerCount: number;
  gameInfo: NamedInfo | null;
  mapInfo: NamedInfo | null;
  modeInfo: NamedInfo | null;
  gameText?: string;
  mapText?: string;
  modeText?: string;
  imageUrl?: string;
}

export interface RuntimePopulationState {
  initialized: boolean;
  lastCount: number | null;
  lowPopulationSinceMs: number;
  firedByThreshold: Record<string, boolean>;
}

export interface RuntimeState {
  serverByKey: Record<string, unknown>;
  activeNetworkIdsByServer: Record<string, Record<string, boolean>>;
  populationStateByServer: Record<string, RuntimePopulationState>;
  gameInfoByServer: Record<string, NamedInfo>;
  mapInfoByServer: Record<string, NamedInfo>;
  modeInfoByServer: Record<string, NamedInfo>;
  serverProbeLoggedByServer: Record<string, boolean>;
  statusSnapshotByServer: Record<string, StatusSnapshot>;
  statusDashboardMessageId: string;
  statusDashboardSync: { inFlight: boolean; pending: unknown } | null;
  statusDashboardRetryAtMs: number;
  notifyMessageIdByServer: Record<string, string>;
  notifyThresholdByServer: Record<string, number>;
  notifyLastAtMsByKey: Record<string, number>;
  statusDashboardFingerprint: string;
  notifyDeleteInFlightByServer: Record<string, boolean>;
  globalNotifyDispatchInFlight: boolean;
  gameApiSyncInFlight: boolean;
  gameApiLastSyncAtMs: number;
  missingNotifierWarned: boolean;
  startupPurgeCompleted: boolean;
  startupBootstrapStarted: boolean;
}

export interface NotifyPayload {
  content: string;
  allowed_mentions: {
    parse: string[];
    roles?: string[];
  };
  embeds?: unknown[];
}
