import type { PlatformDependencies } from '../PlatformDependencies.ts';

import { devTools } from './DevTools.ts';
import { longStackTracesHandler } from './LongStackTracesHandler.ts';

export const platformDependencies: PlatformDependencies = {
  devTools,
  longStackTracesHandler
};
