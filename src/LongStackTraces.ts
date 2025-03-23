import { around } from 'monkey-around';
import { Plugin } from 'obsidian';
import { getStackTrace } from 'obsidian-dev-utils/Error';

type SetTimeoutFn = Window['setTimeout'];
type SetTimeoutHandler = (...args: unknown[]) => void;

export function registerLongStackTraces(plugin: Plugin): void {
  plugin.register(around(window as Window, {
    setTimeout: (next: SetTimeoutFn): SetTimeoutFn => {
      return function patchedSetTimeout(handler, timeout, ...args: unknown[]): number {
        return setTimeout(next, handler, timeout, ...args);
      };
    }
  }));
}

function setTimeout(next: SetTimeoutFn, handler: TimerHandler, timeout: number | undefined, ...args: unknown[]): number {
  if (typeof handler === 'string') {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    handler = new Function(handler);
  }

  const handlerWithArgs = (): void => {
    (handler as SetTimeoutHandler)(...args);
  };
  return next(wrapFunction(handlerWithArgs), timeout);
}

function wrapFunction(fn: () => void): () => void {
  /**
   * Skip stack frames
   * - at wrapFunction
   * - at setTimeout2 (overridden setTimeout)
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

      lines.push('    at --- setTimeout --- (0)');
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
