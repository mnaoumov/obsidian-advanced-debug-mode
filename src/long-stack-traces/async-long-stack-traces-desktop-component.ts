/* eslint-disable n/no-unsupported-features/node-builtins -- createHook/executionAsyncId are stable in Obsidian's desktop Electron runtime where this component runs; the rule flags them as experimental only for the configured Node version range. */
// eslint-disable-next-line import/no-nodejs-modules, import-x/no-nodejs-modules -- Deliberate, executes only on desktop.
import {
  createHook,
  executionAsyncId
} from 'node:async_hooks';
/* eslint-enable n/no-unsupported-features/node-builtins -- Re-enable after the deliberate desktop-only async_hooks import. */
import { ComponentEx } from 'obsidian-dev-utils/obsidian/components/component-ex';
import { ensureNonNullable } from 'obsidian-dev-utils/type-guards';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';
import type {
  LongStackTracesDesktopComponent,
  StackFrame
} from './long-stack-traces-desktop-component.ts';

export interface AsyncLongStackTracesComponentAsyncHookInitParams {
  readonly asyncId: number;
  readonly triggerAsyncId: number;
  readonly type: string;
}

interface AsyncLongStackTracesComponentConstructorParams {
  readonly longStackTracesComponent: LongStackTracesDesktopComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

interface AsyncStackFrame {
  currentError: Error;
  parentStackFrame: StackFrame | undefined;
}

export class AsyncLongStackTracesComponent extends ComponentEx {
  private readonly asyncIdParentMap = new Map<number, number>();
  private readonly asyncIdStackFrameMap = new Map<number, AsyncStackFrame>();

  private readonly longStackTracesComponent: LongStackTracesDesktopComponent;

  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: AsyncLongStackTracesComponentConstructorParams) {
    super();
    this.longStackTracesComponent = params.longStackTracesComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public adjustStackLines(lines: string[], asyncId: number): void {
    if (!this.isEnabled()) {
      return;
    }

    if (asyncId === 0) {
      return;
    }

    const asyncStackFrame = this.asyncIdStackFrameMap.get(asyncId);
    if (!asyncStackFrame) {
      return;
    }

    const currentErrorLines = ensureNonNullable(asyncStackFrame.currentError.stack).split('\n').slice(1);
    this.longStackTracesComponent.addStackFrame({ newLines: currentErrorLines, previousLines: lines, title: 'async' });

    if (asyncStackFrame.parentStackFrame) {
      this.longStackTracesComponent.adjustStackLines({ asyncId: 0, lines, parentStackFrame: asyncStackFrame.parentStackFrame });
      return;
    }

    const parentAsyncId = this.asyncIdParentMap.get(asyncId) ?? 0;
    this.longStackTracesComponent.adjustStackLines({ asyncId: parentAsyncId, lines, parentStackFrame: undefined });
  }

  public getAsyncId(): number {
    return this.isEnabled() ? executionAsyncId() : 0;
  }

  public override onload(): void {
    if (!this.isEnabled()) {
      return;
    }

    const asyncHook = createHook({
      destroy: this.asyncHookDestroy.bind(this),
      init: (asyncId, type, triggerAsyncId) => {
        this.asyncHookInit({ asyncId, triggerAsyncId, type });
      }
    });

    asyncHook.enable();

    this.register(() => asyncHook.disable());
  }

  private asyncHookDestroy(asyncId: number): void {
    this.asyncIdStackFrameMap.delete(asyncId);
    this.asyncIdParentMap.delete(asyncId);
  }

  private asyncHookInit(params: AsyncLongStackTracesComponentAsyncHookInitParams): void {
    const { asyncId, triggerAsyncId, type } = params;
    if (type !== 'PROMISE') {
      return;
    }

    this.asyncIdParentMap.set(asyncId, triggerAsyncId);

    this.asyncIdStackFrameMap.set(asyncId, {
      currentError: new this.longStackTracesComponent.OriginalError(),
      parentStackFrame: this.longStackTracesComponent.parentStackFrame
    });
  }

  private isEnabled(): boolean {
    return this.pluginSettingsComponent.settings.shouldIncludeAsyncLongStackTraces;
  }
}
