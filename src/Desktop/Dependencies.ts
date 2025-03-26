import type { PlatformDependencies } from '../PlatformDependencies.ts';

import { devTools } from './DevTools.ts';
import { LongStackTracesComponentConstructor } from './LongStackTracesComponent.ts';

export const platformDependencies: PlatformDependencies = {
  devTools,
  LongStackTracesComponentConstructor
};
