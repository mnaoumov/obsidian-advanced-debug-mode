import type { Constructor } from 'type-fest';

import { Platform } from 'obsidian';

import type { LongStackTracesComponent } from './components/long-stack-traces-component.ts';
import type { Plugin } from './plugin.ts';

export interface PlatformDependencies {
  LongStackTracesComponentConstructor: Constructor<LongStackTracesComponent, [Plugin]>;
}

export async function getPlatformDependencies(): Promise<PlatformDependencies> {
  const module = Platform.isMobile
    // eslint-disable-next-line no-restricted-syntax -- Deliberate, platform-specific code.
    ? await import('./mobile/dependencies.ts')
    // eslint-disable-next-line no-restricted-syntax -- Deliberate, platform-specific code.
    : await import('./desktop/dependencies.ts');
  return module.platformDependencies;
}
