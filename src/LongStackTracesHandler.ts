import type { ConditionalKeys } from 'type-fest';

import { getStackTrace } from 'obsidian-dev-utils/Error';

import type { AdvancedDebugModePlugin } from './AdvancedDebugModePlugin.ts';

import { registerPatch } from './MonkeyAround.ts';

export type GenericFunction = ((this: unknown, ...args: unknown[]) => unknown) & { originalFn?: GenericFunction};

interface ErrorWithParentStackOptions {
  errorOptions: ErrorOptions | undefined;
  framesToSkip: number;
  message: string | undefined;
  next: ErrorConstructor;
  parentStack: string;
  stackFrameTitle: string;
}

interface ErrorWrapper {
  Error: ErrorConstructor;
}

interface Patch2Options {
  args: unknown[];
  framesToSkip: number;
  handlerArgIndex: number;
  next: GenericFunction;
  stackFrameTitle: string;
  thisArg: unknown;
}

interface PatchOptions<Obj extends object> {
  framesToSkip: number;
  handlerArgIndex: number;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  methodName: ConditionalKeys<Obj, Function>;
  obj: Obj;
  stackFrameTitle: string;
}

interface WrapWithStackTracesImplOptions {
  args: unknown[];
  fn: GenericFunction;
  framesToSkip: number;
  parentStack: string;
  stackFrameTitle: string;
  thisArg: unknown;
}

interface WrapWithStackTracesOptions {
  fn: GenericFunction;
  framesToSkip: number;
  stackFrameTitle: string;
}

export abstract class LongStackTracesHandler {
  private plugin!: AdvancedDebugModePlugin;

  public registerLongStackTraces(plugin: AdvancedDebugModePlugin): void {
    this.plugin = plugin;

    const methodNames: ConditionalKeys<Window & typeof globalThis, Function>[] = [
      'setTimeout',
      'setInterval',
      'queueMicrotask',
      'requestAnimationFrame'
    ];

    for (const methodName of methodNames) {
      this.patchWithLongStackTraces({
        framesToSkip: 0,
        handlerArgIndex: 0,
        methodName,
        obj: window,
        stackFrameTitle: methodName
      });
    }

    this.patchWithLongStackTraces({
      framesToSkip: 0,
      handlerArgIndex: 1,
      methodName: 'addEventListener',
      obj: EventTarget.prototype,
      stackFrameTitle: 'addEventListener'
    });
  }

  protected patchWithLongStackTraces<Obj extends object>(options: PatchOptions<Obj>): void {
    const genericObj = options.obj as Record<string, GenericFunction>;

    const patchWithLongStackTracesImpl = this.patchWithLongStackTracesImpl.bind(this);

    registerPatch(this.plugin, genericObj, {
      [options.methodName]: (next: GenericFunction): GenericFunction => {
        return function patchedFn(this: unknown, ...args: unknown[]): unknown {
          return patchWithLongStackTracesImpl({
            args,
            framesToSkip: options.framesToSkip,
            handlerArgIndex: options.handlerArgIndex,
            next,
            stackFrameTitle: options.stackFrameTitle,
            thisArg: this
          });
        };
      }
    });
  }

  protected patchWithLongStackTracesImpl(options: Patch2Options): unknown {
    const handler = options.args[options.handlerArgIndex];
    let fn: GenericFunction;

    if (typeof handler === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      fn = new Function(handler) as GenericFunction;
    } else if (typeof handler === 'function') {
      fn = handler as GenericFunction;
    } else {
      console.warn('Handler is not a function. Cannot instrument long stack traces.', handler);
      return options.next.call(options.thisArg, ...options.args);
    }

    const wrappedHandler = this.wrapWithStackTraces({
      fn,
      framesToSkip: options.framesToSkip,
      stackFrameTitle: options.stackFrameTitle
    });
    options.args[options.handlerArgIndex] = wrappedHandler;

    return options.next.call(options.thisArg, ...options.args);
  }

  protected wrapWithStackTraces(options: WrapWithStackTracesOptions): GenericFunction {
    /**
     * Skip stack frames
     * - at LongStackTracesHandlerImpl2.wrapWithStackTraces
     * - at LongStackTracesHandlerImpl2.patchWithLongStackTracesImpl
     * - at patchedFn
     * - at wrapper (from monkey-around)
     */
    const PARENT_STACK_SKIP_FRAMES = 4;
    const parentStack = getStackTrace(PARENT_STACK_SKIP_FRAMES);

    const wrapWithStackTracesImpl = this.wrapWithStackTracesImpl.bind(this);

    function wrappedFn(this: unknown, ...args: unknown[]): unknown {
      return wrapWithStackTracesImpl({
        args,
        fn: options.fn,
        framesToSkip: options.framesToSkip,
        parentStack,
        stackFrameTitle: options.stackFrameTitle,
        thisArg: this
      });
    }

    return Object.assign(wrappedFn, { originalFn: options.fn }) as GenericFunction;
  }

  private errorWithParentStack(options: ErrorWithParentStackOptions): Error {
    const error = new options.next(options.message, options.errorOptions);
    Error.captureStackTrace(error);
    const lines = error.stack?.split('\n') ?? [];

    /**
     * Skip prefix stack frames
     * - at LongStackTracesHandlerImpl2.errorWithParentStack
     * - at LongStackTracesHandlerImpl2.patchedErrorWithParentStack
     * - new wrapper (from monkey-around)
     */
    const PREFIX_FRAMES_TO_SKIP = 3;

    /**
     * Skip stack frames
     * - at LongStackTracesHandlerImpl2.wrapWithStackTracesImpl
     * - at wrappedFn
     */
    const SUFFIX_FRAMES_TO_SKIP = 2;
    const totalSuffixFramesToSkip = SUFFIX_FRAMES_TO_SKIP + options.framesToSkip;

    lines.splice(1, PREFIX_FRAMES_TO_SKIP);
    lines.splice(-totalSuffixFramesToSkip, totalSuffixFramesToSkip);

    lines.push(`    at --- ${options.stackFrameTitle} --- (0)`);
    lines.push(options.parentStack);
    error.stack = lines.join('\n');
    return error;
  }

  private wrapWithStackTracesImpl(options: WrapWithStackTracesImplOptions): unknown {
    const errorWithParentStack = this.errorWithParentStack.bind(this);
    const errorPatchUninstaller = registerPatch(this.plugin, window as ErrorWrapper, {
      Error: (next: ErrorConstructor): ErrorConstructor => {
        function patchedErrorWithParentStack(this: unknown, message?: string, errorOptions?: ErrorOptions): Error {
          const errorWithParentStackOptions: ErrorWithParentStackOptions = {
            errorOptions,
            framesToSkip: options.framesToSkip,
            message,
            next,
            parentStack: options.parentStack,
            stackFrameTitle: options.stackFrameTitle
          };
          if (!(this instanceof Error)) {
            return new Error(message, errorOptions);
          }
          return errorWithParentStack(errorWithParentStackOptions);
        }

        return Object.assign(patchedErrorWithParentStack, next) as ErrorConstructor;
      }
    });

    try {
      return options.fn.call(options.thisArg, ...options.args);
    } finally {
      errorPatchUninstaller();
    }
  }
}
