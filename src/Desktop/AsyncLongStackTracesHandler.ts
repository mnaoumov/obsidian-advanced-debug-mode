// eslint-disable-next-line import-x/no-nodejs-modules
import {
  createHook,
  executionAsyncId
} from 'node:async_hooks';
import { Component } from 'obsidian';

import type { AdvancedDebugModePlugin } from '../AdvancedDebugModePlugin.ts';

import { generateStackTraceLine } from '../LongStackTracesHandler.ts';

export class AsyncLongStackTracesHandler extends Component {
  private asyncIdStackLinesMap = new Map<number, string[]>();

  public constructor(private plugin: AdvancedDebugModePlugin) {
    super();
  }

  public adjustStackLines(lines: string[]): void {
    if (!this.isEnabled()) {
      return;
    }

    const asyncId = executionAsyncId();

    if (asyncId === 0) {
      return;
    }

    const stackLines = this.asyncIdStackLinesMap.get(asyncId) ?? [];
    if (stackLines.length === 0) {
      return;
    }

    lines.push(generateStackTraceLine('async'));
    lines.push(...stackLines);
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
    this.asyncIdStackLinesMap.delete(asyncId);
  }

  private asyncHookInit(asyncId: number, type: string): void {
    if (type !== 'PROMISE') {
      return;
    }

    const stackLines = (new Error().stack ?? '').split('\n').slice(1);

    const INTERNAL_STACK_FRAMES_COUNT = 5;
    const firstFrameIndex = this.plugin.settings.shouldShowInternalStackFrames ? INTERNAL_STACK_FRAMES_COUNT : 0;

    if (stackLines[firstFrameIndex]?.includes('at Promise.')) {
      this.asyncIdStackLinesMap.delete(asyncId);
    } else {
      this.asyncIdStackLinesMap.set(asyncId, stackLines);
    }
  }

  private isEnabled(): boolean {
    return this.plugin.settings.shouldShowAsyncLongStackTraces;
  }
}
