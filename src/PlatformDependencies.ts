import { Platform } from 'obsidian';

import type { AdvancedDebugModePlugin } from './AdvancedDebugModePlugin.ts';
import type { DevTools } from './DevTools.ts';
import type { LongStackTracesHandler } from './LongStackTracesHandler.ts';

export interface PlatformDependencies {
  devTools: DevTools;
  LongStackTracesHandlerClass: new (plugin: AdvancedDebugModePlugin) => LongStackTracesHandler;
}

export async function getPlatformDependencies(): Promise<PlatformDependencies> {
  const module = Platform.isMobile
    ? await import('./Mobile/Dependencies.ts')
    : await import('./Desktop/Dependencies.ts');
  return module.platformDependencies;
}
