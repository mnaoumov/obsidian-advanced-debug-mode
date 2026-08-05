import { createFunction } from 'obsidian-dev-utils/function';
import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';
import { ValueWrapper } from 'obsidian-dev-utils/value-wrapper';

import type {
  LongStackTracesDesktopComponent,
  StackFrame
} from '../long-stack-traces/long-stack-traces-desktop-component.ts';
import type {
  GenericFunctionWithOriginalFunction,
  GenericFunctionWithOriginalFunctionObject
} from '../types.ts';

import { isEventListenerObject } from '../long-stack-traces/event-listener.ts';

export type AfterPatchFunction = (this: void, params: AfterPatchParams) => void;

export interface AfterPatchParams {
  // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
  readonly fn: GenericFunctionWithOriginalFunction;
  readonly originalArguments: unknown[];
  readonly originalThis: unknown;
  readonly wrappedFunction: GenericFunctionWithOriginalFunction;
}

interface AddLongStackTracesPatchComponentConstructorParams {
  readonly $object: GenericFunctionWithOriginalFunctionObject;
  readonly afterPatch: AfterPatchFunction | undefined;
  readonly handlerArgumentIndex: number | number[];
  readonly longStackTracesDesktopComponent: LongStackTracesDesktopComponent;
  readonly methodName: string;
  readonly shouldConvertStringToFunction: boolean | undefined;
  readonly stackFrameTitle: string;
}

interface AddLongStackTracesPatchComponentPatchWithLongStackTracesParams {
  readonly originalArguments: unknown[];
  readonly originalMethodBound: GenericFunctionWithOriginalFunction;
  readonly originalThis: unknown;
}

interface AddLongStackTracesPatchComponentWrapWithStackTracesImplParams {
  readonly stackFrame: StackFrame;
  wrappedFunction(): unknown;
}

interface AddLongStackTracesPatchComponentWrapWithStackTracesParams extends AddLongStackTracesPatchComponentPatchWithLongStackTracesParams {
  // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
  readonly fn: GenericFunctionWithOriginalFunction;
}

export class AddLongStackTracesPatchComponent extends MonkeyAroundComponent {
  private readonly $object: GenericFunctionWithOriginalFunctionObject;
  private readonly afterPatch: AfterPatchFunction | undefined;
  private readonly handlerArgumentIndex: number | number[];
  private readonly longStackTracesDesktopComponent: LongStackTracesDesktopComponent;
  private readonly methodName: string;
  private readonly shouldConvertStringToFunction: boolean | undefined;
  private readonly stackFrameTitle: string;

  public constructor(params: AddLongStackTracesPatchComponentConstructorParams) {
    super();
    this.$object = params.$object;
    this.methodName = params.methodName;
    this.afterPatch = params.afterPatch;
    this.handlerArgumentIndex = params.handlerArgumentIndex;
    this.shouldConvertStringToFunction = params.shouldConvertStringToFunction;
    this.stackFrameTitle = params.stackFrameTitle;
    this.longStackTracesDesktopComponent = params.longStackTracesDesktopComponent;
  }

  public override onload(): void {
    this.registerMethodPatch({
      $object: this.$object,
      methodName: this.methodName,
      patchHandler: ({
        originalArguments,
        originalMethodBound,
        originalThis
      }) => {
        return this.patchWithLongStackTraces({
          originalArguments,
          originalMethodBound,
          originalThis
        });
      }
    });
  }

  private patchWithLongStackTraces(params: AddLongStackTracesPatchComponentPatchWithLongStackTracesParams): unknown {
    const handlerArgumentIndices = Array.isArray(this.handlerArgumentIndex) ? this.handlerArgumentIndex : [this.handlerArgumentIndex];
    const argumentsWithWrappedHandler = [...params.originalArguments];

    for (const handlerArgumentIndex of handlerArgumentIndices) {
      const handler = params.originalArguments[handlerArgumentIndex];

      let $function: GenericFunctionWithOriginalFunction;

      if (typeof handler === 'string' && this.shouldConvertStringToFunction) {
        $function = createFunction<GenericFunctionWithOriginalFunction>({
          functionBody: handler
        });
      } else if (typeof handler === 'function') {
        $function = handler as GenericFunctionWithOriginalFunction;
      } else if (isEventListenerObject(handler)) {
        $function = handler.handleEvent.bind(handler) as GenericFunctionWithOriginalFunction;
      } else {
        continue;
      }

      const wrappedHandler = this.wrapWithStackTraces({
        ...params,
        // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
        fn: $function
      });

      argumentsWithWrappedHandler[handlerArgumentIndex] = wrappedHandler;
    }

    return params.originalMethodBound(...argumentsWithWrappedHandler);
  }

  private wrapWithStackTraces(params: AddLongStackTracesPatchComponentWrapWithStackTracesParams): GenericFunctionWithOriginalFunction {
    const stackFrame = {
      parentStackError: new Error(),
      title: this.stackFrameTitle
    };

    const thisWrapper = ValueWrapper.of(this);

    this.afterPatch?.({
      // eslint-disable-next-line unicorn/name-replacements -- `fn` is an `obsidian-integration-testing` parameter name.
      fn: params.fn,
      originalArguments: params.originalArguments,
      originalThis: params.originalThis,
      wrappedFunction: wrappedFunction2
    });

    return Object.assign(wrappedFunction2, { originalFunction: params.fn });

    function wrappedFunction2(this: unknown, ...wrappedFunctionArguments: unknown[]): unknown {
      return thisWrapper.value.wrapWithStackTracesImpl({
        stackFrame,
        wrappedFunction: () => params.fn.call(this, ...wrappedFunctionArguments)
      });
    }
  }

  private wrapWithStackTracesImpl(params: AddLongStackTracesPatchComponentWrapWithStackTracesImplParams): unknown {
    const previousParentStackFrame = this.longStackTracesDesktopComponent.parentStackFrame;
    this.longStackTracesDesktopComponent.parentStackFrame = params.stackFrame;

    try {
      return params.wrappedFunction();
    } finally {
      this.longStackTracesDesktopComponent.parentStackFrame = previousParentStackFrame;
    }
  }
}
