import type { PlatformDependencies } from '../PlatformDependencies.ts';

import { devTools } from './DevTools.ts';
import { LongStackTracesHandlerClass } from './LongStackTracesHandler.ts';

export const platformDependencies: PlatformDependencies = {
  devTools,
  LongStackTracesHandlerClass
};
