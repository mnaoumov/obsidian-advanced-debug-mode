import { Platform } from 'obsidian';

import type { LongStackTracesHandler } from './LongStackTracesHandler.ts';

export interface PlatformDependencies {
  longStackTracesHandler: LongStackTracesHandler;
}

export async function getPlatformDependencies(): Promise<PlatformDependencies> {
  const module = Platform.isMobile
    ? await import('./Mobile/Dependencies.ts')
    : await import('./Desktop/Dependencies.ts');
  return module.platformDependencies;
}
