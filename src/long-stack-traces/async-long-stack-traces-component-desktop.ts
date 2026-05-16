// eslint-disable-next-line import/no-nodejs-modules, import-x/no-nodejs-modules -- Deliberate, executes only on desktop.
import {
  createHook,
  executionAsyncId
} from 'node:async_hooks';
import { Component } from 'obsidian';

import type { PluginSettingsComponent } from '../plugin-settings-component.ts';
import type {
  LongStackTracesComponentDesktop,
  StackFrame
} from './long-stack-traces-component-desktop.ts';

interface AsyncLongStackTracesComponentConstructorParams {
  readonly longStackTracesComponent: LongStackTracesComponentDesktop;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

interface AsyncStackFrame {
  currentError: Error;
  parentStackFrame: StackFrame | undefined;
}

export class AsyncLongStackTracesComponent extends Component {
  private readonly asyncIdParentMap = new Map<number, number>();
  private readonly asyncIdStackFrameMap = new Map<number, AsyncStackFrame>();

  private readonly longStackTracesComponent: LongStackTracesComponentDesktop;

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

    const currentErrorLines = asyncStackFrame.currentError.stack?.split('\n').slice(1) ?? [];
    this.longStackTracesComponent.addStackFrame(lines, currentErrorLines, 'async');

    if (asyncStackFrame.parentStackFrame) {
      this.longStackTracesComponent.adjustStackLines(lines, asyncStackFrame.parentStackFrame, 0);
      return;
    }

    const parentAsyncId = this.asyncIdParentMap.get(asyncId) ?? 0;
    this.longStackTracesComponent.adjustStackLines(lines, undefined, parentAsyncId);
  }

  public getAsyncId(): number {
    return this.isEnabled() ? executionAsyncId() : 0;
  }

  public override onload(): void {
    super.onload();
    if (!this.isEnabled()) {
      return;
    }

    const asyncHook = createHook({
      destroy: this.asyncHookDestroy.bind(this),
      init: this.asyncHookInit.bind(this)
    });

    asyncHook.enable();

    this.register(() => asyncHook.disable());
  }

  private asyncHookDestroy(asyncId: number): void {
    this.asyncIdStackFrameMap.delete(asyncId);
    this.asyncIdParentMap.delete(asyncId);
  }

  private asyncHookInit(asyncId: number, type: string, triggerAsyncId: number): void {
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
