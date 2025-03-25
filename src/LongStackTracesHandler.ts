import type { ConditionalKeys } from 'type-fest';

import { getStackTrace } from 'obsidian-dev-utils/Error';
import {
  assignWithNonEnumerableProperties,
  normalizeOptionalProperties
} from 'obsidian-dev-utils/Object';

import type { AdvancedDebugModePlugin } from './AdvancedDebugModePlugin.ts';

import { registerPatch } from './MonkeyAround.ts';
import { MultiWeakMap } from './MultiWeakMap.ts';

export type GenericFunction = ((this: unknown, ...args: unknown[]) => unknown) & { originalFn?: GenericFunction };

interface AfterPatchOptions {
  fn: GenericFunction;
  originalFnArgs: unknown[];
  originalFnThisArg: unknown;
  wrappedFn: GenericFunction;
}

type GenericConstructor = new (...args: unknown[]) => unknown;

interface PatchOptions<Obj extends object> {
  afterPatch?(options: AfterPatchOptions): void;
  handlerArgIndex: number | number[];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  methodName: ConditionalKeys<Obj, Function>;
  obj: Obj;
  shouldConvertStringToFunction?: boolean;
  stackFrameGroupTitle: string;
}

interface PatchWithLongStackTracesImplOptions {
  afterPatch?(options: AfterPatchOptions): void;
  handlerArgIndex: number | number[];
  next: GenericFunction;
  originalFnArgs: unknown[];
  originalFnThisArg: unknown;
  shouldConvertStringToFunction?: boolean;
  stackFrameGroupTitle: string;
}

type RemoveEventListenerFn = EventTarget['removeEventListener'];

type WindowWithErrorConstructors = Record<string, GenericConstructor> & typeof window;

interface WrapWithStackTracesImplOptions {
  fn: GenericFunction;
  stackFrameGroup: StackFrameGroup;
  wrappedFnArgs: unknown[];
  wrappedFnThisArg: unknown;
}

interface WrapWithStackTracesOptions {
  afterPatch?(options: AfterPatchOptions): void;
  fn: GenericFunction;
  originalFnArgs: unknown[];
  originalFnThisArg: unknown;
  stackFrameGroupTitle: string;
}

const eventHandlersMap = new MultiWeakMap<[EventTarget, string, GenericFunction], GenericFunction>();

interface StackFrameGroup {
  stackFrames: string[];
  title: string;
}

export abstract class LongStackTracesHandler {
  private OriginalError!: ErrorConstructor;
  private plugin!: AdvancedDebugModePlugin;
  private stackFramesGroups: StackFrameGroup[] = [];
  public registerLongStackTraces(plugin: AdvancedDebugModePlugin): void {
    this.plugin = plugin;
    this.OriginalError = window.Error;
    this.patchErrorClasses();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const methodNames: ConditionalKeys<typeof globalThis & Window, Function>[] = [
      'setTimeout',
      'setInterval',
      'queueMicrotask',
      'requestAnimationFrame'
    ];

    const methodNamesWithPossibleStringHandlers = [
      'setTimeout',
      'setInterval'
    ];

    for (const methodName of methodNames) {
      this.patchWithLongStackTraces({
        handlerArgIndex: 0,
        methodName,
        obj: window,
        shouldConvertStringToFunction: methodNamesWithPossibleStringHandlers.includes(methodName),
        stackFrameGroupTitle: methodName
      });
    }

    this.patchWithLongStackTraces({
      afterPatch: this.afterPatchAddEventListener.bind(this),
      handlerArgIndex: 1,
      methodName: 'addEventListener',
      obj: EventTarget.prototype,
      stackFrameGroupTitle: 'addEventListener'
    });

    const that = this;
    registerPatch(this.plugin, EventTarget.prototype, {
      removeEventListener: (next: RemoveEventListenerFn): RemoveEventListenerFn => {
        return function patchedRemoveEventListener(
          this: EventTarget,
          type: string,
          callback: EventListenerOrEventListenerObject | null,
          options?: boolean | EventListenerOptions
        ): void {
          that.removeEventListener(next, this, type, callback, options);
        };
      }
    });

    this.patchWithLongStackTraces({
      handlerArgIndex: [0, 1],
      methodName: 'then',
      obj: Promise.prototype,
      stackFrameGroupTitle: 'Promise.then'
    });

    this.patchWithLongStackTraces({
      handlerArgIndex: 0,
      methodName: 'catch',
      obj: Promise.prototype,
      stackFrameGroupTitle: 'Promise.catch'
    });

    this.patchWithLongStackTraces({
      handlerArgIndex: 0,
      methodName: 'finally',
      obj: Promise.prototype,
      stackFrameGroupTitle: 'Promise.finally'
    });
  }

  protected adjustStackLines(lines: string[]): void {
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (line?.includes(`plugin:${this.plugin.manifest.id}`) || line?.includes('node:internal')) {
        lines.splice(i, 1);
      }
    }

    for (const stackFrameGroup of this.stackFramesGroups) {
      lines.push(this.generateStackTraceLine(stackFrameGroup.title));
      lines.push(...stackFrameGroup.stackFrames);
    }
  }

  protected patchWithLongStackTraces<Obj extends object>(options: PatchOptions<Obj>): void {
    const genericObj = options.obj as Record<string, GenericFunction>;

    const that = this;
    registerPatch(this.plugin, genericObj, {
      [options.methodName]: (next: GenericFunction): GenericFunction => {
        return function patchedFn(this: unknown, ...originalFnArgs: unknown[]): unknown {
          return that.patchWithLongStackTracesImpl({
            afterPatch: (afterPatchOptions) => options.afterPatch?.(afterPatchOptions),
            handlerArgIndex: options.handlerArgIndex,
            next,
            originalFnArgs,
            originalFnThisArg: this,
            stackFrameGroupTitle: options.stackFrameGroupTitle
          });
        };
      }
    });
  }

  protected register(callback: () => void): void {
    this.plugin.register(callback);
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

  private generateStackTraceLine(title: string): string {
    return `    at --- ${title} --- (0)`;
  }

  private getChildErrorClassNames(): string[] {
    const errorClassNames: string[] = [];
    const windowWithErrorConstructors = window as WindowWithErrorConstructors;
    for (const key of Object.getOwnPropertyNames(windowWithErrorConstructors)) {
      try {
        const value = windowWithErrorConstructors[key];
        if (typeof value === 'function' && Object.prototype.isPrototypeOf.call(this.OriginalError.prototype, value.prototype)) {
          errorClassNames.push(key);
        }
      } catch {
        continue;
      }
    }

    return errorClassNames;
  }

  private patchBaseErrorClass(): void {
    const that = this;
    function PatchedError(this: unknown, message?: string, errorOptions?: ErrorOptions): Error {
      if (!(this instanceof window.Error)) {
        return new window.Error(message, errorOptions);
      }

      const error = Reflect.construct(that.OriginalError, [message, errorOptions], (new.target ?? window.Error) as unknown as GenericConstructor);
      const lines = error.stack?.split('\n') ?? [];
      that.adjustStackLines(lines);
      error.stack = lines.join('\n');
      return error;
    }

    PatchedError.prototype = this.OriginalError.prototype;
    Object.setPrototypeOf(PatchedError, this.OriginalError);

    registerPatch(this.plugin, window as WindowWithErrorConstructors, {
      Error: () => assignWithNonEnumerableProperties(PatchedError, this.OriginalError) as GenericConstructor
    });
  }

  private patchErrorClasses(): void {
    this.patchBaseErrorClass();

    const originalPrototypeToPatchedClassMap = new Map<unknown, unknown>();
    originalPrototypeToPatchedClassMap.set(this.OriginalError.prototype, window.Error);

    const windowWithErrorConstructors = window as WindowWithErrorConstructors;
    const childErrorClassNames = this.getChildErrorClassNames();

    for (const childErrorClassName of childErrorClassNames.slice()) {
      const OriginalChildError = windowWithErrorConstructors[childErrorClassName];
      if (!OriginalChildError) {
        continue;
      }

      const baseClassPrototype = Object.getPrototypeOf(OriginalChildError.prototype as object);
      const PatchedBaseError = originalPrototypeToPatchedClassMap.get(baseClassPrototype) as GenericConstructor | undefined;
      if (!PatchedBaseError) {
        continue;
      }

      // eslint-disable-next-line func-style
      const PatchedChildError = function PatchedChildError(this: unknown, ...args: unknown[]): unknown {
        const PatchedChildErrorWrapper = windowWithErrorConstructors[childErrorClassName];
        if (!PatchedChildErrorWrapper) {
          return;
        }

        if (!(this instanceof PatchedChildErrorWrapper)) {
          return new (PatchedChildErrorWrapper as unknown as GenericConstructor)(...args);
        }

        const error = Reflect.construct(PatchedBaseError, args, (new.target ?? PatchedChildErrorWrapper) as unknown as GenericConstructor) as Error;
        error.name = childErrorClassName;
        return error;
      };

      PatchedChildError.prototype = Object.create(PatchedBaseError.prototype as object);
      PatchedChildError.prototype.constructor = PatchedChildError;
      Object.setPrototypeOf(PatchedChildError, OriginalChildError);

      originalPrototypeToPatchedClassMap.set(OriginalChildError.prototype, PatchedChildError);

      registerPatch(this.plugin, window as WindowWithErrorConstructors, {
        [childErrorClassName]: () => assignWithNonEnumerableProperties(PatchedChildError, OriginalChildError)
      });
    }
  }

  private patchWithLongStackTracesImpl(options: PatchWithLongStackTracesImplOptions): unknown {
    const handlerArgIndices = Array.isArray(options.handlerArgIndex) ? options.handlerArgIndex : [options.handlerArgIndex];
    const argsWithWrappedHandler = options.originalFnArgs.slice();

    for (const handlerArgIndex of handlerArgIndices) {
      const handler = options.originalFnArgs[handlerArgIndex];

      let fn: GenericFunction;

      if (typeof handler === 'string' && options.shouldConvertStringToFunction) {
        // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
        fn = new Function(handler) as GenericFunction;
      } else if (typeof handler === 'function') {
        fn = handler as GenericFunction;
      } else if (isEventListenerObject(handler)) {
        fn = handler.handleEvent.bind(handler) as GenericFunction;
      } else {
        continue;
      }

      const wrappedHandler = this.wrapWithStackTraces(normalizeOptionalProperties<WrapWithStackTracesOptions>({
        afterPatch: options.afterPatch,
        fn,
        originalFnArgs: options.originalFnArgs,
        originalFnThisArg: options.originalFnThisArg,
        stackFrameGroupTitle: options.stackFrameGroupTitle
      }));

      argsWithWrappedHandler[handlerArgIndex] = wrappedHandler;
    }

    return options.next.call(options.originalFnThisArg, ...argsWithWrappedHandler);
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

  private wrapWithStackTraces(options: WrapWithStackTracesOptions): GenericFunction {
    const parentStackTrace = getStackTrace();
    const stackFrameGroup = {
      stackFrames: parentStackTrace.split('\n'),
      title: options.stackFrameGroupTitle
    };

    const that = this;
    function wrappedFn(this: unknown, ...wrappedFnArgs: unknown[]): unknown {
      return that.wrapWithStackTracesImpl({
        fn: options.fn,
        stackFrameGroup,
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

  private wrapWithStackTracesImpl(options: WrapWithStackTracesImplOptions): unknown {
    this.stackFramesGroups.push(options.stackFrameGroup);

    try {
      return options.fn.call(options.wrappedFnThisArg, ...options.wrappedFnArgs);
    } finally {
      this.stackFramesGroups.pop();
    }
  }
}

function isEventListenerObject(value: unknown): value is EventListenerObject {
  return !!(value as Partial<EventListenerObject> | undefined)?.handleEvent;
}
