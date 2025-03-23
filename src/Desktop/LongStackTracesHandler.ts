import { process } from 'obsidian-dev-utils/ScriptUtils/NodeModules';

import type { AdvancedDebugModePlugin } from '../AdvancedDebugModePlugin.ts';
import type { Callback } from '../LongStackTracesHandler.ts';

import { LongStackTracesHandler } from '../LongStackTracesHandler.ts';

interface GlobalEx {
  setImmediate: SetImmediateFn;
}

type NextTickFn = typeof process.nextTick;
type SetImmediateFn = typeof global.setImmediate<unknown[]>;

class LongStackTracesHandlerImpl extends LongStackTracesHandler {
  public override registerLongStackTraces(plugin: AdvancedDebugModePlugin): void {
    super.registerLongStackTraces(plugin);
    this.patchSetImmediate();
    this.patchProcessNextTick();
  }

  private nextTick(next: NextTickFn, callback: Callback, ...args: unknown[]): void {
    /**
     * Skip stack frames
     * - wrappedCallback
     */
    const FRAMES_TO_SKIP = 1;
    next(this.wrapWithStackTraces(callback, args, 'nextTick', FRAMES_TO_SKIP));
  }

  private patchProcessNextTick(): void {
    this.patch(process, {
      nextTick: (next: NextTickFn): NextTickFn => {
        const patchedNextTick = (callback: Callback, ...args: unknown[]): void => {
          this.nextTick(next, callback, args);
        };
        return patchedNextTick;
      }
    });
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
