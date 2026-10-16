import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';
import { ensureNonNullable } from '@mnaoumov/typescript-lib/type-guards';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';
import type {
  LongStackTracesDesktopComponent,
  StackFrame
} from './desktop-long-stack-traces-component.ts';

/**
 * The part of `node:v8` this component uses. The module is loaded by the desktop-guarded caller and handed in,
 * so this file never imports a Node.js built-in itself.
 */
export type PromiseHooks = Pick<typeof import('node:v8').promiseHooks, 'createHook'>;

interface AsyncLongStackTracesComponentConstructorParams {
  readonly longStackTracesComponent: LongStackTracesDesktopComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly promiseHooks: PromiseHooks;
}

interface AsyncStackFrame {
  readonly currentError: Error;
  readonly parentPromise: Promise<unknown> | undefined;
  readonly parentStackFrame: StackFrame | undefined;
}

/**
 * A property of the console's command-line API. V8 installs that API on the global object for the duration of each
 * console evaluation, including the side-effect-free ones DevTools sends for autocomplete and eager previews.
 */
const COMMAND_LINE_API_PROPERTY_NAME = '$_';

export class AsyncLongStackTracesComponent extends ComponentEx {
  private readonly executingPromises: Promise<unknown>[] = [];

  private readonly longStackTracesComponent: LongStackTracesDesktopComponent;

  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly promiseHooks: PromiseHooks;
  private readonly promiseStackFrameMap = new WeakMap<Promise<unknown>, AsyncStackFrame>();

  public constructor(params: AsyncLongStackTracesComponentConstructorParams) {
    super();
    this.longStackTracesComponent = params.longStackTracesComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.promiseHooks = params.promiseHooks;
  }

  public adjustStackLines(lines: string[], executingPromise: Promise<unknown> | undefined): void {
    if (!this.isEnabled() || !executingPromise) {
      return;
    }

    const asyncStackFrame = this.promiseStackFrameMap.get(executingPromise);
    if (!asyncStackFrame) {
      return;
    }

    const currentErrorLines = ensureNonNullable(asyncStackFrame.currentError.stack).split('\n').slice(1);
    this.longStackTracesComponent.addStackFrame({ newLines: currentErrorLines, previousLines: lines, title: 'async' });

    if (asyncStackFrame.parentStackFrame) {
      this.longStackTracesComponent.adjustStackLines({ executingPromise: undefined, lines, parentStackFrame: asyncStackFrame.parentStackFrame });
      return;
    }

    this.longStackTracesComponent.adjustStackLines({ executingPromise: asyncStackFrame.parentPromise, lines, parentStackFrame: undefined });
  }

  public getExecutingPromise(): Promise<unknown> | undefined {
    return this.isEnabled() ? this.executingPromises.at(-1) : undefined;
  }

  public override onload(): void {
    if (!this.isEnabled()) {
      return;
    }

    // `v8.promiseHooks` rather than `async_hooks`: V8 aborts a side-effect-free evaluation the moment a promise hook
    // writes anything, and the only promise hooks that run are the installed ones. Node's `async_hooks` installs its own,
    // which always write, so DevTools' autocomplete came back empty. Ours skip console evaluations instead.
    const stopPromiseHooks = this.promiseHooks.createHook({
      after: this.promiseHookAfter.bind(this),
      before: this.promiseHookBefore.bind(this),
      init: this.promiseHookInit.bind(this)
    }) as () => void;

    this.register(stopPromiseHooks);
  }

  private isEnabled(): boolean {
    return this.pluginSettingsComponent.settings.shouldIncludeAsyncLongStackTraces;
  }

  private promiseHookAfter(promise: Promise<unknown>): void {
    if (this.executingPromises.at(-1) === promise) {
      this.executingPromises.length -= 1;
    }
  }

  private promiseHookBefore(promise: Promise<unknown>): void {
    if (isConsoleEvaluating()) {
      return;
    }

    this.executingPromises.push(promise);
  }

  private promiseHookInit(promise: Promise<unknown>, parent: Promise<unknown> | undefined): void {
    if (isConsoleEvaluating()) {
      return;
    }

    this.promiseStackFrameMap.set(promise, {
      currentError: new this.longStackTracesComponent.OriginalError(),
      parentPromise: parent ?? this.executingPromises.at(-1),
      parentStackFrame: this.longStackTracesComponent.parentStackFrame
    });
  }
}

/**
 * Whether a console evaluation is running. A promise hook must not write while one is, because DevTools sends its
 * autocomplete and preview requests with `throwOnSideEffect`, and V8 aborts the whole evaluation on the first write.
 * Typed-in console commands are skipped too, which only loses the async frames of the promises their first synchronous
 * part creates.
 *
 * @returns Whether the console's command-line API is installed on the global object.
 */
function isConsoleEvaluating(): boolean {
  return Object.hasOwn(window, COMMAND_LINE_API_PROPERTY_NAME);
}
