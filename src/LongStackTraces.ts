import { around } from 'monkey-around';
import { Plugin } from 'obsidian';
import { getStackTrace } from 'obsidian-dev-utils/Error';

type SetIntervalOrTimeoutFn = Window['setTimeout'];
type SetIntervalOrTimeoutHandler = (...args: unknown[]) => void;

export function registerLongStackTraces(plugin: Plugin): void {
  plugin.register(around(window as Window, {
    setInterval: (next: SetIntervalOrTimeoutFn): SetIntervalOrTimeoutFn => {
      return function patchedSetInterval(handler, timeout, ...args: unknown[]): number {
        return setIntervalOrTimeout(next, 'setInterval', handler, timeout, ...args);
      };
    },
    setTimeout: (next: SetIntervalOrTimeoutFn): SetIntervalOrTimeoutFn => {
      return function patchedSetTimeout(handler, timeout, ...args: unknown[]): number {
        return setIntervalOrTimeout(next, 'setTimeout', handler, timeout, ...args);
      };
    }
  }));
}

function setIntervalOrTimeout(next: SetIntervalOrTimeoutFn, name: string, handler: TimerHandler, timeout: number | undefined, ...args: unknown[]): number {
  if (typeof handler === 'string') {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    handler = new Function(handler);
  }

  const handlerWithArgs = (): void => {
    (handler as SetIntervalOrTimeoutHandler)(...args);
  };
  return next(wrapFunction(handlerWithArgs, name), timeout);
}

function wrapFunction(fn: () => void, name: string): () => void {
  /**
   * Skip stack frames
   * - at wrapFunction
   * - at setIntervalOrTimeout
   * - at patchedSetTimeout
   * - at wrapper
   */
  const PARENT_STACK_SKIP_FRAMES = 4;
  const parentStack = getStackTrace(PARENT_STACK_SKIP_FRAMES);

  function wrappedFn(): void {
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
       * - at handlerWithArgs
       * - at wrappedFn
       */
      const SKIP_LAST_FRAMES = 2;
      lines = lines.slice(0, -SKIP_LAST_FRAMES);

      lines.push(`    at --- ${name} --- (0)`);
      lines.push(parentStack);
      error.stack = lines.join('\n');
      return error;
    }

    window.Error = Object.assign(ErrorWrapper, OriginalError) as ErrorConstructor;

    try {
      fn();
    } finally {
      window.Error = OriginalError;
    }
  }

  return wrappedFn;
}
