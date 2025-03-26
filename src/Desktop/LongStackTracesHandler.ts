import { process } from 'obsidian-dev-utils/ScriptUtils/NodeModules';

import type { AdvancedDebugModePlugin } from '../AdvancedDebugModePlugin.ts';

import { LongStackTracesHandler } from '../LongStackTracesHandler.ts';
import { AsyncLongStackTracesHandler } from './AsyncLongStackTracesHandler.ts';

class LongStackTracesHandlerImpl extends LongStackTracesHandler {
  private asyncLongStackTracesHandler!: AsyncLongStackTracesHandler;

  public constructor(plugin: AdvancedDebugModePlugin) {
    super(plugin);
    this.asyncLongStackTracesHandler = new AsyncLongStackTracesHandler(plugin);
    this.addChild(this.asyncLongStackTracesHandler);
  }

  public override onload(): void {
    super.onload();

    if (!this.isEnabled()) {
      return;
    }

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
  }

  protected override adjustStackLines(lines: string[]): void {
    super.adjustStackLines(lines);
    this.asyncLongStackTracesHandler.adjustStackLines(lines);
  }
}

export const LongStackTracesHandlerClass = LongStackTracesHandlerImpl;
