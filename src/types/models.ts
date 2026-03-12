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
}

export interface NamedInfo {
  readable: string;
  slug: string;
}

export interface StatusSnapshot {
  serverName: string;
  playerCount: number;
  mapInfo: NamedInfo | null;
  modeInfo: NamedInfo | null;
  mapText?: string;
  modeText?: string;
  imageUrl?: string;
}

export interface RuntimePopulationState {
  initialized: boolean;
  lastCount: number | null;
  firedByThreshold: Record<string, boolean>;
}

export interface RuntimeState {
  serverByKey: Record<string, unknown>;
  activeNetworkIdsByServer: Record<string, Record<string, boolean>>;
  populationStateByServer: Record<string, RuntimePopulationState>;
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
