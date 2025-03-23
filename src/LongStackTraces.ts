import { around } from 'monkey-around';
import { Plugin } from 'obsidian';
import { getStackTrace } from 'obsidian-dev-utils/Error';

type Callback = (...args: unknown[]) => void;
interface GlobalEx {
  setImmediate: SetImmediateFn;
}
type SetImmediateFn = typeof global.setImmediate<unknown[]>;

type SetIntervalOrTimeoutFn = Window['setTimeout'];

export function registerLongStackTraces(plugin: Plugin): void {
  plugin.register(around(window as Window, {
    setInterval: (next: SetIntervalOrTimeoutFn): SetIntervalOrTimeoutFn => {
      return function patchedSetInterval(handler, timeout, ...args: unknown[]): number {
        return setIntervalOrTimeout(next, 'setInterval', handler, timeout, args);
      };
    },
    setTimeout: (next: SetIntervalOrTimeoutFn): SetIntervalOrTimeoutFn => {
      return function patchedSetTimeout(handler, timeout, ...args: unknown[]): number {
        return setIntervalOrTimeout(next, 'setTimeout', handler, timeout, args);
      };
    }
  }));

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (global) {
    plugin.register(around(global as GlobalEx, {
      setImmediate: (next: SetImmediateFn): SetImmediateFn => {
        function patchedSetImmediate(callback: Callback, ...args: unknown[]): NodeJS.Immediate {
          return setImmediate(next, callback, args);
        }
        return Object.assign(patchedSetImmediate, next) as SetImmediateFn;
      }
    }));
  }
}

function setImmediate(next: SetImmediateFn, callback: Callback, args: unknown[]): NodeJS.Immediate {
  /**
   * Skip stack frames
   * - Immediate.wrappedCallback [as _onImmediate]
   */
  const FRAMES_TO_SKIP = 1;
  return next(wrapWithStackTraces(callback, args, 'setImmediate', FRAMES_TO_SKIP));
}

function setIntervalOrTimeout(next: SetIntervalOrTimeoutFn, name: string, handler: TimerHandler, timeout: number | undefined, args: unknown[]): number {
  if (typeof handler === 'string') {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    handler = new Function(handler);
  }

  return next(wrapWithStackTraces(handler as Callback, args, name), timeout);
}

function wrapWithStackTraces(callback: Callback, args: unknown[], name: string, framesToSkip = 0): () => void {
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
