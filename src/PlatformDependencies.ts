import type { Constructor } from 'type-fest';

import { Platform } from 'obsidian';

import type { AdvancedDebugModePlugin } from './AdvancedDebugModePlugin.ts';
import type { LongStackTracesComponent } from './Components/LongStackTracesComponent.ts';

export interface PlatformDependencies {
  LongStackTracesComponentConstructor: Constructor<LongStackTracesComponent, [AdvancedDebugModePlugin]>;
}

export async function getPlatformDependencies(): Promise<PlatformDependencies> {
  const module = Platform.isMobile
    ? await import('./Mobile/Dependencies.ts')
    : await import('./Desktop/Dependencies.ts');
  return module.platformDependencies;
}
