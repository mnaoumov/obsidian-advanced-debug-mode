// eslint-disable-next-line import-x/no-nodejs-modules
import {
  createHook,
  executionAsyncId
} from 'node:async_hooks';
import { process } from 'obsidian-dev-utils/ScriptUtils/NodeModules';

import type { AdvancedDebugModePlugin } from '../AdvancedDebugModePlugin.ts';

import { LongStackTracesHandler } from '../LongStackTracesHandler.ts';

class LongStackTracesHandlerImpl extends LongStackTracesHandler {
  private asyncIdStackLinesMap = new Map<number, string[]>();
  public override registerLongStackTraces(plugin: AdvancedDebugModePlugin): void {
    super.registerLongStackTraces(plugin);

    this.patchWithLongStackTraces({
      handlerArgIndex: 0,
      methodName: 'setImmediate',
      obj: window,
      stackFrameGroupTitle: 'setImmediate'
    });

    this.patchWithLongStackTraces({
      handlerArgIndex: 0,
      methodName: 'nextTick',
      obj: process,
      stackFrameGroupTitle: 'process.nextTick'
    });

    const asyncHook = createHook({
      destroy: this.asyncHookDestroy.bind(this),
      init: this.asyncHookInit.bind(this)
    });
    asyncHook.enable();

    this.register(() => {
      asyncHook.disable();
    });
  }

  protected override adjustStackLines(lines: string[]): void {
    super.adjustStackLines(lines);

    const asyncId = executionAsyncId();

    if (asyncId === 0) {
      return;
    }

    const stackLines = this.asyncIdStackLinesMap.get(asyncId) ?? [];
    if (stackLines.length === 0) {
      return;
    }

    lines.push(this.generateStackTraceLine('async'));
    lines.push(...stackLines);
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
}

export const longStackTracesHandler = new LongStackTracesHandlerImpl();
