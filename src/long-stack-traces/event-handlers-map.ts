import type { GenericFunctionWithOriginalFn } from '../types.ts';

import { MultiWeakMap } from '../multi-weak-map.ts';

export const eventHandlersMap = new MultiWeakMap<[EventTarget, string, GenericFunctionWithOriginalFn], GenericFunctionWithOriginalFn>();
