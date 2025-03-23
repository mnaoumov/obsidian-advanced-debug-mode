import { getStackTrace } from 'obsidian-dev-utils/Error';

import type { AdvancedDebugModePlugin } from './AdvancedDebugModePlugin.ts';
import type { Factories } from './MonkeyAround.ts';

// Import { around } from 'monkey-around';
import { around } from './MonkeyAround.ts';

export type Callback = (...args: unknown[]) => void;

type SetIntervalOrTimeoutFn = Window['setTimeout'];

export abstract class LongStackTracesHandler {
  private plugin!: AdvancedDebugModePlugin;

  public registerLongStackTraces(plugin: AdvancedDebugModePlugin): void {
    this.plugin = plugin;
    this.patchSetTimeout();
    this.patchSetInterval();
  }

  protected patch<Obj extends object>(obj: Obj, factories: Factories<Obj>): void {
    this.plugin.register(around(obj, factories));
  }

  protected wrapWithStackTraces(callback: Callback, args: unknown[], name: string, framesToSkip = 0): () => void {
    /**
     * Skip stack frames
     * - at wrapWithStackTraces
     * - at setIntervalOrTimeout
     * - at patched...
     * - at wrapper (from monkey-around)
     */
    const PARENT_STACK_SKIP_FRAMES = 4;
    const parentStack = getStackTrace(PARENT_STACK_SKIP_FRAMES);

    function wrappedCallback(): void {
      const OriginalError = window.Error;

      function ErrorWrapper(this: unknown, message?: string, options?: ErrorOptions): Error {
        if (!(this instanceof ErrorWrapper)) {
          return new (ErrorWrapper as ErrorConstructor)(message, options);
        }
        const error = new OriginalError(message, options);
        OriginalError.captureStackTrace(error, ErrorWrapper);
        let lines = error.stack?.split('\n') ?? [];

        /**
         * Skip stack frames
         * - at wrappedFn
         */
        lines = lines.slice(0, -1 - framesToSkip);

        lines.push(`    at --- ${name} --- (0)`);
        lines.push(parentStack);
        error.stack = lines.join('\n');
        return error;
      }

      window.Error = Object.assign(ErrorWrapper, OriginalError) as ErrorConstructor;

      try {
        callback(...args);
      } finally {
        window.Error = OriginalError;
      }
    }

    return wrappedCallback;
  }

  private patchSetInterval(): void {
    this.patch(window as Window, {
      setInterval: (next: SetIntervalOrTimeoutFn): SetIntervalOrTimeoutFn => {
        const patchedSetInterval = (handler: TimerHandler, timeout: number | undefined, ...args: unknown[]): number => {
          return this.setIntervalOrTimeout(next, 'setInterval', handler, timeout, args);
        };
        return patchedSetInterval;
      }
    });
  }

  private patchSetTimeout(): void {
    this.patch(window as Window, {
      setTimeout: (next: SetIntervalOrTimeoutFn): SetIntervalOrTimeoutFn => {
        const patchedSetTimeout = (handler: TimerHandler, timeout: number | undefined, ...args: unknown[]): number => {
          return this.setIntervalOrTimeout(next, 'setTimeout', handler, timeout, args);
        };
        return patchedSetTimeout;
      }
    });
  }

  private setIntervalOrTimeout(next: SetIntervalOrTimeoutFn, name: string, handler: TimerHandler, timeout: number | undefined, args: unknown[]): number {
    if (typeof handler === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      handler = new Function(handler);
    }

    return next(this.wrapWithStackTraces(handler as Callback, args, name), timeout);
  }
}
