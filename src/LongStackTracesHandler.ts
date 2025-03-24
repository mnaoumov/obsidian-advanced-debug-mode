import type { ConditionalKeys } from 'type-fest';

import { getStackTrace } from 'obsidian-dev-utils/Error';

import type { AdvancedDebugModePlugin } from './AdvancedDebugModePlugin.ts';

import { registerPatch } from './MonkeyAround.ts';
import { MultiWeakMap } from './MultiWeakMap.ts';

export type GenericFunction = ((this: unknown, ...args: unknown[]) => unknown) & { originalFn?: GenericFunction };

type AfterPatchFn = (options: AfterPatchOptions) => void;

interface AfterPatchOptions {
  fn: GenericFunction;
  originalFnArgs: unknown[];
  originalFnThisArg: unknown;
  wrappedFn: GenericFunction;
}

interface ErrorWithParentStackOptions {
  errorOptions: ErrorOptions | undefined;
  framesToSkip: number;
  message: string | undefined;
  next: ErrorConstructor;
  parentStack: string;
  patchedErrorWithParentStackThisArg: unknown;
  stackFrameTitle: string;
}

interface ErrorWrapper {
  Error: ErrorConstructor;
}

interface PatchOptions<Obj extends object> {
  afterPatch?: AfterPatchFn | undefined;
  framesToSkip: number;
  handlerArgIndex: number;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  methodName: ConditionalKeys<Obj, Function>;
  obj: Obj;
  stackFrameTitle: string;
}
interface PatchWithLongStackTracesImplOptions {
  afterPatch?: AfterPatchFn | undefined;
  framesToSkip: number;
  handlerArgIndex: number;
  next: GenericFunction;
  originalFnArgs: unknown[];
  originalFnThisArg: unknown;
  stackFrameTitle: string;
}

type RemoveEventListenerFn = EventTarget['removeEventListener'];

interface WrapWithStackTracesImplOptions {
  fn: GenericFunction;
  framesToSkip: number;
  parentStack: string;
  stackFrameTitle: string;
  wrappedFnArgs: unknown[];
  wrappedFnThisArg: unknown;
}

interface WrapWithStackTracesOptions {
  afterPatch?: AfterPatchFn | undefined;
  fn: GenericFunction;
  framesToSkip: number;
  originalFnArgs: unknown[];
  originalFnThisArg: unknown;
  stackFrameTitle: string;
}

const eventHandlersMap = new MultiWeakMap<[EventTarget, string, GenericFunction], GenericFunction>();

export abstract class LongStackTracesHandler {
  private plugin!: AdvancedDebugModePlugin;

  public registerLongStackTraces(plugin: AdvancedDebugModePlugin): void {
    this.plugin = plugin;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const methodNames: ConditionalKeys<typeof globalThis & Window, Function>[] = [
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
      afterPatch: this.afterPatchAddEventListener.bind(this),
      framesToSkip: 0,
      handlerArgIndex: 1,
      methodName: 'addEventListener',
      obj: EventTarget.prototype,
      stackFrameTitle: 'addEventListener'
    });

    const removeEventListener = this.removeEventListener.bind(this);
    registerPatch(this.plugin, EventTarget.prototype, {
      removeEventListener: (next: RemoveEventListenerFn): RemoveEventListenerFn => {
        return function patchedRemoveEventListener(
          this: EventTarget,
          type: string,
          callback: EventListenerOrEventListenerObject | null,
          options?: boolean | EventListenerOptions
        ): void {
          removeEventListener(next, this, type, callback, options);
        };
      }
    });
  }

  protected patchWithLongStackTraces<Obj extends object>(options: PatchOptions<Obj>): void {
    const genericObj = options.obj as Record<string, GenericFunction>;

    const patchWithLongStackTracesImpl = this.patchWithLongStackTracesImpl.bind(this);

    registerPatch(this.plugin, genericObj, {
      [options.methodName]: (next: GenericFunction): GenericFunction => {
        return function patchedFn(this: unknown, ...originalFnArgs: unknown[]): unknown {
          return patchWithLongStackTracesImpl({
            afterPatch: options.afterPatch,
            framesToSkip: options.framesToSkip,
            handlerArgIndex: options.handlerArgIndex,
            next,
            originalFnArgs,
            originalFnThisArg: this,
            stackFrameTitle: options.stackFrameTitle
          });
        };
      }
    });
  }

  protected patchWithLongStackTracesImpl(options: PatchWithLongStackTracesImplOptions): unknown {
    const handler = options.originalFnArgs[options.handlerArgIndex];
    let fn: GenericFunction;

    if (typeof handler === 'string') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      fn = new Function(handler) as GenericFunction;
    } else if (typeof handler === 'function') {
      fn = handler as GenericFunction;
    } else if (isEventListenerObject(handler)) {
      fn = handler.handleEvent.bind(handler) as GenericFunction;
    } else {
      console.warn('Handler is not a function. Cannot instrument long stack traces.', handler);
      return options.next.call(options.originalFnThisArg, ...options.originalFnArgs);
    }

    const wrappedHandler = this.wrapWithStackTraces({
      afterPatch: options.afterPatch,
      fn,
      framesToSkip: options.framesToSkip,
      originalFnArgs: options.originalFnArgs,
      originalFnThisArg: options.originalFnThisArg,
      stackFrameTitle: options.stackFrameTitle
    });

    const argsWithWrappedHandler = options.originalFnArgs.slice();
    argsWithWrappedHandler[options.handlerArgIndex] = wrappedHandler;
    return options.next.call(options.originalFnThisArg, ...argsWithWrappedHandler);
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

    function wrappedFn(this: unknown, ...wrappedFnArgs: unknown[]): unknown {
      return wrapWithStackTracesImpl({
        fn: options.fn,
        framesToSkip: options.framesToSkip,
        parentStack,
        stackFrameTitle: options.stackFrameTitle,
        wrappedFnArgs,
        wrappedFnThisArg: this
      });
    }

    options.afterPatch?.({
      fn: options.fn,
      originalFnArgs: options.originalFnArgs,
      originalFnThisArg: options.originalFnThisArg,
      wrappedFn
    });

    return Object.assign(wrappedFn, { originalFn: options.fn }) as GenericFunction;
  }

  private afterPatchAddEventListener(options: AfterPatchOptions): void {
    const eventTarget = options.originalFnThisArg as EventTarget;
    const type = options.originalFnArgs[0] as string;
    const keys: [EventTarget, string, GenericFunction] = [eventTarget, type, options.fn];
    const previousWrappedHandler = eventHandlersMap.get(keys);

    if (previousWrappedHandler) {
      eventTarget.removeEventListener(type, previousWrappedHandler);
    }
    eventHandlersMap.set(keys, options.wrappedFn);
  }

  private errorWithParentStack(options: ErrorWithParentStackOptions): Error {
    if (!(options.patchedErrorWithParentStackThisArg instanceof Error)) {
      return Error(options.message, options.errorOptions);
    }

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

  private removeEventListener(
    next: RemoveEventListenerFn,
    eventTarget: EventTarget,
    type: string,
    callback: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void {
    const handler = isEventListenerObject(callback) ? callback.handleEvent.bind(callback) : callback;

    if (!handler) {
      next.call(eventTarget, type, callback, options);
      return;
    }

    const wrappedHandler = eventHandlersMap.get([eventTarget, type, handler as GenericFunction]);

    if (wrappedHandler) {
      next.call(eventTarget, type, wrappedHandler, options);
    } else {
      next.call(eventTarget, type, callback, options);
    }
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
            patchedErrorWithParentStackThisArg: this,
            stackFrameTitle: options.stackFrameTitle
          };
          return errorWithParentStack(errorWithParentStackOptions);
        }

        return Object.assign(patchedErrorWithParentStack, next) as ErrorConstructor;
      }
    });

    try {
      return options.fn.call(options.wrappedFnThisArg, ...options.wrappedFnArgs);
    } finally {
      errorPatchUninstaller();
    }
  }
}

function isEventListenerObject(value: unknown): value is EventListenerObject {
  return (value as Partial<EventListenerObject>).handleEvent !== undefined;
}
