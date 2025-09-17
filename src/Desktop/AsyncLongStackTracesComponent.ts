import { Component } from 'obsidian';
import {
  createHook,
  executionAsyncId
} from 'obsidian-dev-utils/ScriptUtils/NodeModules';

import type {
  LongStackTracesComponent,
  StackFrame
} from '../Components/LongStackTracesComponent.ts';
import type { Plugin } from '../Plugin.ts';

interface AsyncStackFrame {
  currentError: Error;
  parentStackFrame: StackFrame | undefined;
}

export class AsyncLongStackTracesComponent extends Component {
  private readonly asyncIdParentMap = new Map<number, number>();

  private readonly asyncIdStackFrameMap = new Map<number, AsyncStackFrame>();

  public constructor(private readonly plugin: Plugin, private readonly longStackTracesComponent: LongStackTracesComponent) {
    super();
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
    return this.plugin.settings.shouldIncludeAsyncLongStackTraces;
  }
}
