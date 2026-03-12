import { defaultConfig, sanitizeConfig } from '../domain/config.js';
import { createNotificationDispatcher } from '../infrastructure/notifiers/notification-dispatcher.js';
import { createRuntimeState } from './state/runtime-state.js';
import { normalizeObservationFromEvent } from './ingress/observation-ingress.js';
import {
  bootstrapKnownServers,
  runStartupPurgeThenBootstrap,
  scheduleDelayedBootstrap,
  startBootstrapFlow
} from './services/startup-flow.js';
import { observeServerPopulation, refreshStatusMessages } from './services/observation-service.js';
import { resolveHostServices } from '../infrastructure/host/iw4m-host.js';
import { initializeConfigLifecycle, logStartupConfig } from './services/config-lifecycle.js';
import { tellStatus } from './services/command-status.js';

const PLUGIN_VERSION = typeof __PLUGIN_VERSION__ === 'string' ? __PLUGIN_VERSION__ : '0.0.0-dev';

function observeFromEvent(plugin: any, eventObj: unknown, source: string, isDisconnect: boolean, isBootstrap: boolean): void {
  const observation = normalizeObservationFromEvent(eventObj, {
    isDisconnect: isDisconnect,
    source: source,
    isBootstrap: isBootstrap
  });
  plugin.observeServerPopulation(
    observation.server,
    observation.client,
    observation.isDisconnect,
    observation.source,
    observation.mapHint,
    observation.modeHint,
    observation.isBootstrap
  );
}

const plugin: any = {
  author: 'b_five',
  version: PLUGIN_VERSION,
  name: 'Population Notifier',
  logger: null,
  manager: null,
  configWrapper: null,
  pluginHelper: null,
  config: sanitizeConfig(defaultConfig),
  dispatcher: null,

  runtime: createRuntimeState(),

  onLoad: function (serviceResolver: any, configWrapper: any, pluginHelper: any) {
    this.configWrapper = configWrapper;
    this.pluginHelper = pluginHelper;
    const resolved = resolveHostServices(serviceResolver);
    this.logger = resolved.logger;
    this.manager = resolved.manager;

    initializeConfigLifecycle(this);

    this.refreshNotifiers();

    logStartupConfig(this);

    if (!this.dispatcher || this.dispatcher.count === 0) {
      this.logger.logWarning('{Name}: No notifier destinations configured. Add discordBotToken and discordChannelId to enable alerts.', this.name);
      this.runtime.missingNotifierWarned = true;
    }

    this.runStartupPurgeThenBootstrap();
  },

  refreshNotifiers: function () {
    this.dispatcher = createNotificationDispatcher(this.config);
    this.runtime.missingNotifierWarned = false;
  },

  notifierNamesText: function () {
    if (!this.dispatcher || this.dispatcher.count === 0) return '(none)';
    return this.dispatcher.names.join(',');
  },

  scheduleDelayedBootstrap: function () {
    scheduleDelayedBootstrap(this);
  },

  startBootstrapFlow: function () {
    startBootstrapFlow(this);
  },

  runStartupPurgeThenBootstrap: function () {
    runStartupPurgeThenBootstrap(this);
  },

  bootstrapKnownServers: function () {
    bootstrapKnownServers(this);
  },

  refreshStatusMessages: function () {
    refreshStatusMessages(this);
  },

  onClientStateInitialized: function (eventObj: unknown) {
    observeFromEvent(this, eventObj, 'client_state_initialized', false, false);
  },

  onClientStateDisposed: function (eventObj: unknown) {
    observeFromEvent(this, eventObj, 'client_state_disposed', true, false);
  },

  onServerMonitoringStarted: function (eventObj: unknown) {
    observeFromEvent(this, eventObj, 'monitoring_started', false, true);
  },

  onMatchStarted: function (eventObj: unknown) {
    observeFromEvent(this, eventObj, 'match_started', false, false);
  },

  onMatchEnded: function (eventObj: unknown) {
    observeFromEvent(this, eventObj, 'match_ended', false, false);
  },

  observeServerPopulation: function (server: any, client: any, isDisconnect: boolean, source: string, mapHint: any, modeHint: any, isBootstrap: boolean) {
    observeServerPopulation(this, server, client, isDisconnect, source, mapHint, modeHint, isBootstrap);
  },

  tellStatus: function (commandEvent: any) {
    tellStatus(this, commandEvent);
  }
};

const init = (registerNotify: any, serviceResolver: any, configWrapper: any, pluginHelper: any) => {
  registerNotify('IManagementEventSubscriptions.ClientStateInitialized',
    (eventObj: unknown, _token: unknown) => plugin.onClientStateInitialized(eventObj));

  registerNotify('IGameEventSubscriptions.MatchEnded',
    (eventObj: unknown, _token: unknown) => plugin.onMatchEnded(eventObj));

  try {
    registerNotify('IManagementEventSubscriptions.ClientStateDisposed',
      (eventObj: unknown, _token: unknown) => plugin.onClientStateDisposed(eventObj));
  } catch (_error) {
    if (plugin.logger) {
      plugin.logger.logWarning('{Name}: ClientStateDisposed subscription unavailable; relying on other events.', plugin.name);
    }
  }

  try {
    registerNotify('IGameServerEventSubscriptions.MonitoringStarted',
      (eventObj: unknown, _token: unknown) => plugin.onServerMonitoringStarted(eventObj));
  } catch (_error) {
    if (plugin.logger) {
      plugin.logger.logWarning('{Name}: MonitoringStarted subscription unavailable.', plugin.name);
    }
  }

  try {
    registerNotify('IGameEventSubscriptions.MatchStarted',
      (eventObj: unknown, _token: unknown) => plugin.onMatchStarted(eventObj));
  } catch (_error) {
    if (plugin.logger) {
      plugin.logger.logWarning('{Name}: MatchStarted subscription unavailable.', plugin.name);
    }
  }

  plugin.onLoad(serviceResolver, configWrapper, pluginHelper);
  return plugin;
};

const commands = [
  {
    name: 'popnotify',
    description: 'shows current population notifier status',
    alias: 'pn',
    permission: 'User',
    targetRequired: false,
    arguments: [],
    execute: (gameEvent: unknown) => {
      plugin.tellStatus(gameEvent);
    }
  }
];

export { init, plugin, commands };
