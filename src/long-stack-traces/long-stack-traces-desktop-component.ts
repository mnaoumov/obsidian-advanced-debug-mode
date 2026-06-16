import type { ConditionalKeys } from 'type-fest';

// eslint-disable-next-line import/no-nodejs-modules, import-x/no-nodejs-modules -- Deliberate, executes only on desktop.
import process from 'node:process';
import { App } from 'obsidian';
import { filterInPlace } from 'obsidian-dev-utils/array';
import { invokeAsyncSafely } from 'obsidian-dev-utils/async';
import {
  assignWithNonEnumerableProperties,
  castTo
} from 'obsidian-dev-utils/object-utils';
import { AllWindowsEventComponent } from 'obsidian-dev-utils/obsidian/components/all-windows-event-component';
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';
import {
  assertNonNullable,
  ensureNonNullable
} from 'obsidian-dev-utils/type-guards';
import { ValueWrapper } from 'obsidian-dev-utils/value-wrapper';

import type {
  AfterPatchFn,
  AfterPatchParams
} from '../patches/add-long-stack-traces-patch-component.ts';
import type { PluginSettingsComponent } from '../plugin-settings-component.ts';
import type { GenericFunction } from '../types.ts';

import { AddLongStackTracesPatchComponent } from '../patches/add-long-stack-traces-patch-component.ts';
import { RemoveEventListenerPatchComponent } from '../patches/remove-event-listener-patch-component.ts';
import { AsyncLongStackTracesComponent } from './async-long-stack-traces-desktop-component.ts';
import { eventHandlersMap } from './event-handlers-map.ts';

export interface StackFrame {
  parentStackError: Error;
  title: string;
}

export type WindowEx = typeof window & Window;

type GenericConstructor = new (...args: unknown[]) => unknown;

interface LongStackTracesDesktopComponentConstructorParams {
  readonly app: App;
  readonly pluginId: string;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

interface PatchParams<Obj extends object> {
  readonly afterPatch?: AfterPatchFn;
  readonly handlerArgIndex: number | number[];
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- Need Function generics.
  readonly methodName: ConditionalKeys<Obj, Function>;
  readonly obj: Obj;
  readonly shouldConvertStringToFunction?: boolean;
  readonly stackFrameTitle: string;
}

type WindowWithErrorConstructors = Record<string, GenericConstructor> & typeof window;

export class LongStackTracesDesktopComponent extends ComponentEx {
  public parentStackFrame: StackFrame | undefined;

  public get OriginalError(): ErrorConstructor {
    if (!this._OriginalError) {
      throw new Error('OriginalError is not set');
    }
    return this._OriginalError;
  }

  protected readonly app: App;
  protected readonly pluginSettingsComponent: PluginSettingsComponent;

  private _OriginalError?: ErrorConstructor;

  private asyncLongStackTracesComponent?: AsyncLongStackTracesComponent;

  private internalStackFrameLocations: string[] = [];

  private readonly pluginId: string;
  public constructor(params: LongStackTracesDesktopComponentConstructorParams) {
    super();
    this.app = params.app;
    this.pluginId = params.pluginId;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
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

  public adjustStackLines(lines: string[], parentStackFrame: StackFrame | undefined, asyncId: number): void {
    this.filterInternalStackFrames(lines);

    if (parentStackFrame) {
      this.addStackFrame(lines, ensureNonNullable(parentStackFrame.parentStackError.stack).split('\n').slice(1), parentStackFrame.title);
    }

    this.applyStackTraceLimit(lines);
    this.asyncLongStackTracesComponent?.adjustStackLines(lines, asyncId);
  }

  public applyStackTraceLimit(lines: string[]): void {
    if (lines.length > this.pluginSettingsComponent.settings.stackTraceLimit) {
      lines.splice(this.pluginSettingsComponent.settings.stackTraceLimit);
      lines.push(generateStackTraceLine('STACK TRACE LIMIT REACHED'));
    }
  }

  public override onload(): void {
    if (!this.isEnabled()) {
      return;
    }

    this.internalStackFrameLocations = [
      `plugin:${this.pluginId}`,
      'node:internal',
      'at Promise.',
      'at new Promise'
    ];

    this._OriginalError = window.Error;
    this.patchErrorClasses();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- Need Function generics.
    const methodNames: ConditionalKeys<WindowEx, Function>[] = [
      'setTimeout',
      'setInterval',
      'queueMicrotask',
      'requestAnimationFrame'
    ];

    const methodNamesWithPossibleStringHandlers = [
      'setTimeout',
      'setInterval'
    ];

    this.addChild(new AllWindowsEventComponent(this.app)).registerAllWindowsHandler((win) => {
      for (const methodName of methodNames) {
        this.patchWithLongStackTraces({
          handlerArgIndex: 0,
          methodName,
          obj: win as WindowEx,
          shouldConvertStringToFunction: methodNamesWithPossibleStringHandlers.includes(methodName),
          stackFrameTitle: methodName
        });
      }
    });

    this.patchWithLongStackTraces({
      afterPatch: this.afterPatchAddEventListener.bind(this),
      handlerArgIndex: 1,
      methodName: 'addEventListener',
      obj: EventTarget.prototype,
      stackFrameTitle: 'addEventListener'
    });

    this.addChild(new RemoveEventListenerPatchComponent());

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

    this.addChild(new AllWindowsEventComponent(this.app)).registerAllWindowsHandler((win) => {
      this.patchWithLongStackTraces({
        handlerArgIndex: 0,
        methodName: 'setImmediate',
        obj: win as WindowEx,
        stackFrameTitle: 'setImmediate'
      });
    });

    this.patchWithLongStackTraces({
      handlerArgIndex: 0,
      methodName: 'nextTick',
      obj: process,
      stackFrameTitle: 'process.nextTick'
    });

    this.asyncLongStackTracesComponent = new AsyncLongStackTracesComponent({
      longStackTracesComponent: this,
      pluginSettingsComponent: this.pluginSettingsComponent
    });
    this.addChild(this.asyncLongStackTracesComponent);
  }

  protected getAsyncId(): number {
    return this.asyncLongStackTracesComponent?.getAsyncId() ?? 0;
  }

  protected isEnabled(): boolean {
    return this.pluginSettingsComponent.settings.shouldIncludeLongStackTraces;
  }

  // eslint-disable-next-line obsidian-dev-utils/params-options-name-match -- Reusable params.
  protected patchWithLongStackTraces<Obj extends object>(params: PatchParams<Obj>): void {
    const genericObj = params.obj as Record<string, GenericFunction>;

    this.addChild(
      new AddLongStackTracesPatchComponent({
        afterPatch: params.afterPatch,
        handlerArgIndex: params.handlerArgIndex,
        longStackTracesDesktopComponent: this,
        methodName: params.methodName,
        obj: genericObj,
        shouldConvertStringToFunction: params.shouldConvertStringToFunction,
        stackFrameTitle: params.stackFrameTitle
      })
    );
  }

  private afterPatchAddEventListener(params: AfterPatchParams): void {
    const eventTarget = params.originalThis as EventTarget;
    const type = params.originalArgs[0] as string;
    const keys: [EventTarget, string, GenericFunction] = [eventTarget, type, params.fn];
    const previousWrappedHandler = eventHandlersMap.get(keys);

    if (previousWrappedHandler) {
      eventTarget.removeEventListener(type, previousWrappedHandler);
    }
    eventHandlersMap.set(keys, params.wrappedFn);
  }

  private filterInternalStackFrames(lines: string[]): void {
    if (!this.pluginSettingsComponent.settings.shouldIncludeInternalStackFrames) {
      filterInPlace(lines, (line) => !!line && this.internalStackFrameLocations.every((location) => !line.includes(location)));
    }
  }

  private getAdditionalStackFramesCount(): number {
    const MAX_ADDITIONAL_INTERNAL_STACK_FRAMES_COUNT = 10;
    return this.pluginSettingsComponent.settings.shouldIncludeInternalStackFrames ? 0 : MAX_ADDITIONAL_INTERNAL_STACK_FRAMES_COUNT;
  }

  private getChildErrorClassNames(): string[] {
    const errorClassNames: string[] = [];
    const windowWithErrorConstructors = window as WindowWithErrorConstructors;
    for (const key of Object.getOwnPropertyNames(windowWithErrorConstructors)) {
      const value = windowWithErrorConstructors[key];
      if (typeof value === 'function' && Object.prototype.isPrototypeOf.call(this.OriginalError.prototype, value.prototype)) {
        errorClassNames.push(key);
      }
    }

    return errorClassNames;
  }

  private getStackTraceLimit(): number {
    return this.pluginSettingsComponent.settings.stackTraceLimit;
  }

  private patchBaseErrorClass(): void {
    const thisWrapper = ValueWrapper.of(this);
    function PatchedError(this: unknown, message?: string, errorOptions?: ErrorOptions): Error {
      if (!(this instanceof window.Error)) {
        return new window.Error(message, errorOptions);
      }

      const error = Reflect.construct(thisWrapper.value.OriginalError, [message, errorOptions], castTo<GenericConstructor>(ensureNonNullable(new.target as unknown)));
      error.name = 'Error';

      const parentStackFrame = thisWrapper.value.parentStackFrame;
      const asyncId = thisWrapper.value.getAsyncId();

      let cachedStack: string | undefined = undefined;

      const originalStackPropertyDescriptor = ensureNonNullable(Object.getOwnPropertyDescriptor(error, 'stack'));
      Object.defineProperty(error, 'stack', {
        configurable: true,
        enumerable: false,
        get() {
          if (cachedStack !== undefined) {
            return cachedStack;
          }

          // eslint-disable-next-line @typescript-eslint/unbound-method -- Property descriptor getter is not a class method; extracting it is safe.
          const originalStack = ensureNonNullable(originalStackPropertyDescriptor.get).call(error) as string;
          const lines = originalStack.split('\n');
          thisWrapper.value.adjustStackLines(lines, parentStackFrame, asyncId);
          cachedStack = lines.join('\n');
          return cachedStack;
        },
        set(value: string) {
          originalStackPropertyDescriptor.set?.call(error, value);
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
      get: thisWrapper.value.getStackTraceLimit.bind(thisWrapper.value),
      set: thisWrapper.value.setStackTraceLimit.bind(thisWrapper.value)
    });

    window.Error = PatchedError as ErrorConstructor;
    window.Error.stackTraceLimit = this.pluginSettingsComponent.settings.stackTraceLimit || Infinity;

    this.register(() => {
      window.Error = this.OriginalError;
      window.Error.stackTraceLimit = this.pluginSettingsComponent.settings.stackTraceLimit;
    });
  }

  private patchErrorClasses(): void {
    this.patchBaseErrorClass();

    const originalPrototypeToPatchedClassMap = new Map();
    originalPrototypeToPatchedClassMap.set(this.OriginalError.prototype, window.Error);

    const windowWithErrorConstructors = window as WindowWithErrorConstructors;
    const childErrorClassNames = this.getChildErrorClassNames();

    for (const childErrorClassName of childErrorClassNames.slice()) {
      const OriginalChildError = ensureNonNullable(windowWithErrorConstructors[childErrorClassName]);

      const baseClassPrototype = Object.getPrototypeOf(OriginalChildError.prototype as object);
      const PatchedBaseError = originalPrototypeToPatchedClassMap.get(baseClassPrototype) as GenericConstructor | undefined;
      if (!PatchedBaseError) {
        continue;
      }

      function PatchedChildError(this: unknown, ...args: unknown[]): unknown {
        const PatchedChildErrorWrapper = ensureNonNullable(windowWithErrorConstructors[childErrorClassName]);

        if (!(this instanceof PatchedChildErrorWrapper)) {
          return new (castTo<GenericConstructor>(PatchedChildErrorWrapper))(...args);
        }

        assertNonNullable(PatchedBaseError);

        const error = Reflect.construct(PatchedBaseError, args, castTo<GenericConstructor>(ensureNonNullable(new.target as unknown))) as Error;
        error.name = childErrorClassName;
        return error;
      }

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

  private setStackTraceLimit(value: number): void {
    this.OriginalError.stackTraceLimit = value + this.getAdditionalStackFramesCount();
    if (this.pluginSettingsComponent.settings.stackTraceLimit !== value) {
      invokeAsyncSafely(() =>
        this.pluginSettingsComponent.editAndSave((x) => {
          x.stackTraceLimit = value;
        })
      );
    }
  }
}

function generateStackTraceLine(title: string): string {
  return `    at --- ${title} --- (0)`;
}
