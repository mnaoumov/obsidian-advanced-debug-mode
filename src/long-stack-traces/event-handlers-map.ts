import type { GenericFunction } from '../types.ts';

import { MultiWeakMap } from '../multi-weak-map.ts';

export const eventHandlersMap = new MultiWeakMap<[EventTarget, string, GenericFunction], GenericFunction>();
