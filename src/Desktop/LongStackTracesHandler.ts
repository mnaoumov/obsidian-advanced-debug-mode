import type { AdvancedDebugModePlugin } from '../AdvancedDebugModePlugin.ts';
import type { Callback } from '../LongStackTracesHandler.ts';

import { LongStackTracesHandler } from '../LongStackTracesHandler.ts';

interface GlobalEx {
  setImmediate: SetImmediateFn;
}

type SetImmediateFn = typeof global.setImmediate<unknown[]>;

class LongStackTracesHandlerImpl extends LongStackTracesHandler {
  public override registerLongStackTraces(plugin: AdvancedDebugModePlugin): void {
    super.registerLongStackTraces(plugin);
    this.patchSetImmediate();
  }

  private patchSetImmediate(): void {
    this.patch(global as GlobalEx, {
      setImmediate: (next: SetImmediateFn): SetImmediateFn => {
        const patchedSetImmediate = (callback: Callback, ...args: unknown[]): NodeJS.Immediate => {
          return this.setImmediate(next, callback, args);
        };
        return Object.assign(patchedSetImmediate, next) as SetImmediateFn;
      }
    });
  }

  private setImmediate(next: SetImmediateFn, callback: Callback, ...args: unknown[]): NodeJS.Immediate {
    /**
     * Skip stack frames
     * - Immediate.wrappedCallback [as _onImmediate]
     */
    const FRAMES_TO_SKIP = 1;
    return next(this.wrapWithStackTraces(callback, args, 'setImmediate', FRAMES_TO_SKIP));
  }
}
export const longStackTracesHandler = new LongStackTracesHandlerImpl();
