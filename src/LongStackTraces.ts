import { around } from 'monkey-around';
import { Plugin } from 'obsidian';
import { getStackTrace } from 'obsidian-dev-utils/Error';

type SetTimeoutFn = Window['setTimeout'];
type SetTimeoutHandler = (...args: unknown[]) => void;

export function registerLongStackTraces(plugin: Plugin): void {
  plugin.register(around(window as Window, {
    setTimeout: (next: SetTimeoutFn): SetTimeoutFn => {
      return (handler, timeout, ...args: unknown[]): number => {
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

  /**
   * Skip stack frames
   * - at setTimeout2 // patched setTimeout
   * - at eval // intermediate
   * - at wrapper // from monkey-around
   */
  const PARENT_STACK_SKIP_FRAMES = 3;
  const parentStack = getStackTrace(PARENT_STACK_SKIP_FRAMES);

  const wrappedHandler = (): void => {
    const OriginalError = window.Error;

    function ErrorWrapper(this: unknown, message?: string, options?: ErrorOptions): Error {
      if (!(this instanceof ErrorWrapper)) {
        return new (ErrorWrapper as ErrorConstructor)(message, options);
      }
      const error = new OriginalError(message, options);
      OriginalError.captureStackTrace(error, ErrorWrapper);
      const lines = error.stack?.split('\n') ?? [];

      /**
       * Skip stack frame
       * - at wrappedHandler
       */
      lines.pop();

      lines.push('    at --- setTimeout --- (0)');
      lines.push(parentStack);
      error.stack = lines.join('\n');
      return error;
    }

    window.Error = Object.assign(ErrorWrapper, OriginalError) as ErrorConstructor;

    try {
      (handler as SetTimeoutHandler)(...args);
    } finally {
      window.Error = OriginalError;
    }
  };

  return next(wrappedHandler, timeout);
}
