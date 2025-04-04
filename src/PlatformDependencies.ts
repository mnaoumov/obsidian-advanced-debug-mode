import type { Constructor } from 'type-fest';

import { Platform } from 'obsidian';

import type { LongStackTracesComponent } from './Components/LongStackTracesComponent.ts';
import type { Plugin } from './Plugin.ts';

export interface PlatformDependencies {
  LongStackTracesComponentConstructor: Constructor<LongStackTracesComponent, [Plugin]>;
}

export async function getPlatformDependencies(): Promise<PlatformDependencies> {
  const module = Platform.isMobile
    ? await import('./Mobile/Dependencies.ts')
    : await import('./Desktop/Dependencies.ts');
  return module.platformDependencies;
}
