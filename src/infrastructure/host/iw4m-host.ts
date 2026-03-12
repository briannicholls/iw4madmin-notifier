export interface ResolvedHostServices {
  logger: any;
  manager: any;
}

export function resolveHostServices(serviceResolver: any): ResolvedHostServices {
  const logger = serviceResolver.resolveService('ILogger', ['ScriptPluginV2']);
  let manager = null;
  try {
    manager = serviceResolver.resolveService('IManager');
  } catch (_) {
    manager = null;
  }

  return { logger, manager };
}
