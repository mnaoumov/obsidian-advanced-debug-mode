import { process } from 'obsidian-dev-utils/ScriptUtils/NodeModules';

import type { AdvancedDebugModePlugin } from '../AdvancedDebugModePlugin.ts';

import { LongStackTracesHandler } from '../LongStackTracesHandler.ts';

class LongStackTracesHandlerImpl extends LongStackTracesHandler {
  public override registerLongStackTraces(plugin: AdvancedDebugModePlugin): void {
    super.registerLongStackTraces(plugin);

    this.patchWithLongStackTraces({
      framesToSkip: 1,
      handlerArgIndex: 0,
      methodName: 'setImmediate',
      obj: window,
      stackFrameTitle: 'setImmediate'
    });

    this.patchWithLongStackTraces({
      framesToSkip: 1,
      handlerArgIndex: 0,
      methodName: 'nextTick',
      obj: process,
      stackFrameTitle: 'process.nextTick'
    });
  }
}

export const longStackTracesHandler = new LongStackTracesHandlerImpl();
