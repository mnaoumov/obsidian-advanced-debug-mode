import type { ConditionalKeys } from 'type-fest';

import { Component } from 'obsidian';
import { filterInPlace } from 'obsidian-dev-utils/Array';
import { invokeAsyncSafely } from 'obsidian-dev-utils/Async';
import {
  assignWithNonEnumerableProperties,
  normalizeOptionalProperties
} from 'obsidian-dev-utils/Object';
import { registerPatch } from 'obsidian-dev-utils/obsidian/MonkeyAround';

import type { Plugin } from '../Plugin.ts';

import { MultiWeakMap } from '../MultiWeakMap.ts';

export type GenericFunction = ((this: unknown, ...args: unknown[]) => unknown) & { originalFn?: GenericFunction };

type AfterPatchFn = (this: void, options: AfterPatchOptions) => void;

interface AfterPatchOptions {
  fn: GenericFunction;
  originalFnArgs: unknown[];
  originalFnThisArg: unknown;
  wrappedFn: GenericFunction;
}

type GenericConstructor = new (...args: unknown[]) => unknown;

interface PatchOptions<Obj extends object> {
  afterPatch?: AfterPatchFn;
  handlerArgIndex: number | number[];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  methodName: ConditionalKeys<Obj, Function>;
  obj: Obj;
  shouldConvertStringToFunction?: boolean;
  stackFrameTitle: string;
}

interface PatchWithLongStackTracesImplOptions {
  afterPatch?: AfterPatchFn;
  handlerArgIndex: number | number[];
  next: GenericFunction;
  originalFnArgs: unknown[];
  originalFnThisArg: unknown;
  shouldConvertStringToFunction?: boolean;
  stackFrameTitle: string;
}

type RemoveEventListenerFn = EventTarget['removeEventListener'];

type WindowWithErrorConstructors = Record<string, GenericConstructor> & typeof window;

interface WrapWithStackTracesImplOptions {
  fn: GenericFunction;
  stackFrame: StackFrame;
  wrappedFnArgs: unknown[];
  wrappedFnThisArg: unknown;
}

interface WrapWithStackTracesOptions {
  afterPatch?: AfterPatchFn;
  fn: GenericFunction;
  originalFnArgs: unknown[];
  originalFnThisArg: unknown;
  stackFrameTitle: string;
}

const eventHandlersMap = new MultiWeakMap<[EventTarget, string, GenericFunction], GenericFunction>();

export interface StackFrame {
  parentStackError: Error;
  title: string;
}

export abstract class LongStackTracesComponent extends Component {
  public OriginalError!: ErrorConstructor;
  public parentStackFrame: StackFrame | undefined;
  private internalStackFrameLocations: string[] = [];

  public constructor(private plugin: Plugin) {
    super();
  }

  public addStackFrame(previousLines: string[], newLines: string[], title: string): void {
    const previousLinesSet = new Set(previousLines);
    newLines = newLines.slice();
    this.filterInternalStackFrames(newLines);

    const STACK_FRAME_TITLE_PREFIX = 'at ---';
    filterInPlace(newLines, (line) => line.includes(STACK_FRAME_TITLE_PREFIX) || !previousLinesSet.has(line));
    filterInPlace(newLines, (line, index) => !line.includes(STACK_FRAME_TITLE_PREFIX) || newLines[index + 1]?.includes(STACK_FRAME_TITLE_PREFIX) === false);

    if (newLines.length > 0) {
      previousLines.push(generateStackTraceLine(title));
      previousLines.push(...newLines);
    }
  }

  public adjustStackLines(lines: string[], parentStackFrame: StackFrame | undefined, _asyncId: number): void {
    this.filterInternalStackFrames(lines);

    if (parentStackFrame) {
      this.addStackFrame(lines, parentStackFrame.parentStackError.stack?.split('\n').slice(1) ?? [], parentStackFrame.title);
    }

    this.applyStackTraceLimit(lines);
  }

  public applyStackTraceLimit(lines: string[]): void {
    if (lines.length > this.plugin.settings.stackTraceLimit) {
      lines.splice(this.plugin.settings.stackTraceLimit);
      lines.push(generateStackTraceLine('STACK TRACE LIMIT REACHED'));
    }
  }

  public override onload(): void {
    super.onload();
    if (!this.isEnabled()) {
      return;
    }

    this.internalStackFrameLocations = [
      `plugin:${this.plugin.manifest.id}`,
      'node:internal',
      'at Promise.',
      'at new Promise'
    ];

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
        stackFrameTitle: methodName
      });
    }

    this.patchWithLongStackTraces({
      afterPatch: this.afterPatchAddEventListener.bind(this),
      handlerArgIndex: 1,
      methodName: 'addEventListener',
      obj: EventTarget.prototype,
      stackFrameTitle: 'addEventListener'
    });

    const that = this;
    registerPatch(this, EventTarget.prototype, {
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
      stackFrameTitle: 'Promise.then'
    });

    this.patchWithLongStackTraces({
      handlerArgIndex: 0,
      methodName: 'catch',
      obj: Promise.prototype,
      stackFrameTitle: 'Promise.catch'
    });

    this.patchWithLongStackTraces({
      handlerArgIndex: 0,
      methodName: 'finally',
      obj: Promise.prototype,
      stackFrameTitle: 'Promise.finally'
    });
  }

  protected getAsyncId(): number {
    return 0;
  }

  protected isEnabled(): boolean {
    return this.plugin.settings.shouldIncludeLongStackTraces;
  }

  protected patchWithLongStackTraces<Obj extends object>(options: PatchOptions<Obj>): void {
    const genericObj = options.obj as Record<string, GenericFunction>;

    const that = this;
    registerPatch(this, genericObj, {
      [options.methodName]: (next: GenericFunction): GenericFunction => {
        return function patchedFn(this: unknown, ...originalFnArgs: unknown[]): unknown {
          return that.patchWithLongStackTracesImpl(normalizeOptionalProperties<PatchWithLongStackTracesImplOptions>({
            afterPatch: options.afterPatch,
            handlerArgIndex: options.handlerArgIndex,
            next,
            originalFnArgs,
            originalFnThisArg: this,
            stackFrameTitle: options.stackFrameTitle
          }));
        };
      }
    });
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

  private filterInternalStackFrames(lines: string[]): void {
    if (!this.plugin.settings.shouldIncludeInternalStackFrames) {
      filterInPlace(lines, (line) => !!line && this.internalStackFrameLocations.every((location) => !line.includes(location)));
    }
  }

  private getAdditionalStackFramesCount(): number {
    const MAX_ADDITIONAL_INTERNAL_STACK_FRAMES_COUNT = 10;
    return this.plugin.settings.shouldIncludeInternalStackFrames ? 0 : MAX_ADDITIONAL_INTERNAL_STACK_FRAMES_COUNT;
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

  private getStackTraceLimit(): number {
    return this.plugin.settings.stackTraceLimit;
  }

  private patchBaseErrorClass(): void {
    const that = this;
    function PatchedError(this: unknown, message?: string, errorOptions?: ErrorOptions): Error {
      if (!(this instanceof window.Error)) {
        return new window.Error(message, errorOptions);
      }

      const error = Reflect.construct(that.OriginalError, [message, errorOptions], (new.target as unknown ?? window.Error) as unknown as GenericConstructor);
      error.name = 'Error';

      const parentStackFrame = that.parentStackFrame;
      const asyncId = that.getAsyncId();

      let cachedStack: string | undefined = undefined;

      const originalStackPropertyDescriptor = Object.getOwnPropertyDescriptor(error, 'stack');
      Object.defineProperty(error, 'stack', {
        configurable: true,
        enumerable: false,
        get() {
          if (cachedStack !== undefined) {
            return cachedStack;
          }

          const originalStack = (originalStackPropertyDescriptor?.get?.call(error) ?? '') as string;
          const lines = originalStack.split('\n');
          that.adjustStackLines(lines, parentStackFrame, asyncId);
          cachedStack = lines.join('\n');
          return cachedStack;
        },
        set(value: string) {
          originalStackPropertyDescriptor?.set?.call(error, value);
          cachedStack = value;
        }
      });

      return error;
    }

    PatchedError.prototype = this.OriginalError.prototype;
    Object.setPrototypeOf(PatchedError, this.OriginalError);
    assignWithNonEnumerableProperties(PatchedError, this.OriginalError);

    Object.defineProperty(PatchedError, 'stackTraceLimit', {
      configurable: true,
      enumerable: true,
      get: that.getStackTraceLimit.bind(that),
      set: that.setStackTraceLimit.bind(that)
    });

    window.Error = PatchedError as ErrorConstructor;
    window.Error.stackTraceLimit = this.plugin.settings.stackTraceLimit || Infinity;

    this.register(() => {
      window.Error = this.OriginalError;
      window.Error.stackTraceLimit = this.plugin.settings.stackTraceLimit;
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

        const error = Reflect.construct(PatchedBaseError, args, (new.target as unknown ?? PatchedChildErrorWrapper) as unknown as GenericConstructor) as Error;
        error.name = childErrorClassName;
        return error;
      };

      PatchedChildError.prototype = Object.create(PatchedBaseError.prototype as object);
      PatchedChildError.prototype.constructor = PatchedChildError;
      Object.setPrototypeOf(PatchedChildError, OriginalChildError);

      originalPrototypeToPatchedClassMap.set(OriginalChildError.prototype, PatchedChildError);

      windowWithErrorConstructors[childErrorClassName] = assignWithNonEnumerableProperties(PatchedChildError, OriginalChildError);

      this.register(() => {
        windowWithErrorConstructors[childErrorClassName] = OriginalChildError;
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
        stackFrameTitle: options.stackFrameTitle
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

  private setStackTraceLimit(value: number): void {
    this.OriginalError.stackTraceLimit = value + this.getAdditionalStackFramesCount();
    if (this.plugin.settings.stackTraceLimit !== value) {
      invokeAsyncSafely(() =>
        this.plugin.settingsManager.editAndSave((x) => {
          x.stackTraceLimit = value;
        })
      );
    }
  }

  private wrapWithStackTraces(options: WrapWithStackTracesOptions): GenericFunction {
    const stackFrame = {
      parentStackError: new Error(),
      title: options.stackFrameTitle
    };

    const that = this;
    function wrappedFn(this: unknown, ...wrappedFnArgs: unknown[]): unknown {
      return that.wrapWithStackTracesImpl({
        fn: options.fn,
        stackFrame,
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
    const previousParentStackFrame = this.parentStackFrame;
    this.parentStackFrame = options.stackFrame;

    try {
      return options.fn.call(options.wrappedFnThisArg, ...options.wrappedFnArgs);
    } finally {
      this.parentStackFrame = previousParentStackFrame;
    }
  }
}

function generateStackTraceLine(title: string): string {
  return `    at --- ${title} --- (0)`;
}

function isEventListenerObject(value: unknown): value is EventListenerObject {
  return !!(value as Partial<EventListenerObject> | undefined)?.handleEvent;
}
