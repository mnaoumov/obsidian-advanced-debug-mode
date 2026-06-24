import { createFunction } from 'obsidian-dev-utils/function';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';
import { ValueWrapper } from 'obsidian-dev-utils/value-wrapper';

import type {
  LongStackTracesDesktopComponent,
  StackFrame
} from '../long-stack-traces/long-stack-traces-desktop-component.ts';
import type {
  GenericFunctionWithOriginalFn,
  GenericFunctionWithOriginalFnObject
} from '../types.ts';

import { isEventListenerObject } from '../long-stack-traces/event-listener.ts';

export type AfterPatchFn = (this: void, params: AfterPatchParams) => void;

export interface AfterPatchParams {
  readonly fn: GenericFunctionWithOriginalFn;
  readonly originalArgs: unknown[];
  readonly originalThis: unknown;
  readonly wrappedFn: GenericFunctionWithOriginalFn;
}

interface AddLongStackTracesPatchComponentConstructorParams {
  readonly afterPatch: AfterPatchFn | undefined;
  readonly handlerArgIndex: number | number[];
  readonly longStackTracesDesktopComponent: LongStackTracesDesktopComponent;
  readonly methodName: string;
  readonly obj: GenericFunctionWithOriginalFnObject;
  readonly shouldConvertStringToFunction: boolean | undefined;
  readonly stackFrameTitle: string;
}

interface AddLongStackTracesPatchComponentPatchWithLongStackTracesParams {
  readonly originalArgs: unknown[];
  readonly originalMethodBound: GenericFunctionWithOriginalFn;
  readonly originalThis: unknown;
}

interface AddLongStackTracesPatchComponentWrapWithStackTracesImplParams {
  readonly stackFrame: StackFrame;
  wrappedFn(): unknown;
}

interface AddLongStackTracesPatchComponentWrapWithStackTracesParams extends AddLongStackTracesPatchComponentPatchWithLongStackTracesParams {
  readonly fn: GenericFunctionWithOriginalFn;
}

export class AddLongStackTracesPatchComponent extends MonkeyAroundComponent {
  private readonly afterPatch: AfterPatchFn | undefined;
  private readonly handlerArgIndex: number | number[];
  private readonly longStackTracesDesktopComponent: LongStackTracesDesktopComponent;
  private readonly methodName: string;
  private readonly obj: GenericFunctionWithOriginalFnObject;
  private readonly shouldConvertStringToFunction: boolean | undefined;
  private readonly stackFrameTitle: string;

  public constructor(params: AddLongStackTracesPatchComponentConstructorParams) {
    super();
    this.obj = params.obj;
    this.methodName = params.methodName;
    this.afterPatch = params.afterPatch;
    this.handlerArgIndex = params.handlerArgIndex;
    this.shouldConvertStringToFunction = params.shouldConvertStringToFunction;
    this.stackFrameTitle = params.stackFrameTitle;
    this.longStackTracesDesktopComponent = params.longStackTracesDesktopComponent;
  }

  public override onload(): void {
    this.registerMethodPatch({
      methodName: this.methodName,
      obj: this.obj,
      patchHandler: ({
        originalArgs,
        originalMethodBound,
        originalThis
      }) => {
        return this.patchWithLongStackTraces({
          originalArgs,
          originalMethodBound,
          originalThis
        });
      }
    });
  }

  private patchWithLongStackTraces(params: AddLongStackTracesPatchComponentPatchWithLongStackTracesParams): unknown {
    const handlerArgIndices = Array.isArray(this.handlerArgIndex) ? this.handlerArgIndex : [this.handlerArgIndex];
    const argsWithWrappedHandler = params.originalArgs.slice();

    for (const handlerArgIndex of handlerArgIndices) {
      const handler = params.originalArgs[handlerArgIndex];

      let fn: GenericFunctionWithOriginalFn;

      if (typeof handler === 'string' && this.shouldConvertStringToFunction) {
        fn = createFunction<GenericFunctionWithOriginalFn>({
          functionBody: handler
        });
      } else if (typeof handler === 'function') {
        fn = handler as GenericFunctionWithOriginalFn;
      } else if (isEventListenerObject(handler)) {
        fn = handler.handleEvent.bind(handler) as GenericFunctionWithOriginalFn;
      } else {
        continue;
      }

      const wrappedHandler = this.wrapWithStackTraces({
        ...params,
        fn
      });

      argsWithWrappedHandler[handlerArgIndex] = wrappedHandler;
    }

    return params.originalMethodBound(...argsWithWrappedHandler);
  }

  private wrapWithStackTraces(params: AddLongStackTracesPatchComponentWrapWithStackTracesParams): GenericFunctionWithOriginalFn {
    const stackFrame = {
      parentStackError: new Error(),
      title: this.stackFrameTitle
    };

    const thisWrapper = ValueWrapper.of(this);

    this.afterPatch?.({
      fn: params.fn,
      originalArgs: params.originalArgs,
      originalThis: params.originalThis,
      wrappedFn: wrappedFn2
    });

    return Object.assign(wrappedFn2, { originalFn: params.fn });

    function wrappedFn2(this: unknown, ...wrappedFnArgs: unknown[]): unknown {
      return thisWrapper.value.wrapWithStackTracesImpl({
        stackFrame,
        wrappedFn: () => params.fn.call(this, ...wrappedFnArgs)
      });
    }
  }

  private wrapWithStackTracesImpl(params: AddLongStackTracesPatchComponentWrapWithStackTracesImplParams): unknown {
    const previousParentStackFrame = this.longStackTracesDesktopComponent.parentStackFrame;
    this.longStackTracesDesktopComponent.parentStackFrame = params.stackFrame;

    try {
      return params.wrappedFn();
    } finally {
      this.longStackTracesDesktopComponent.parentStackFrame = previousParentStackFrame;
    }
  }
}
