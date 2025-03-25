import { process } from 'obsidian-dev-utils/ScriptUtils/NodeModules';

import type { AdvancedDebugModePlugin } from '../AdvancedDebugModePlugin.ts';

import { LongStackTracesHandler } from '../LongStackTracesHandler.ts';

class LongStackTracesHandlerImpl extends LongStackTracesHandler {
  public override registerLongStackTraces(plugin: AdvancedDebugModePlugin): void {
    super.registerLongStackTraces(plugin);

    this.patchWithLongStackTraces({
      handlerArgIndex: 0,
      methodName: 'setImmediate',
      obj: window,
      stackFrameGroup: {
        previousStackFramesToSkip: 1,
        title: 'setImmediate'
      }
    });

    this.patchWithLongStackTraces({
      handlerArgIndex: 0,
      methodName: 'nextTick',
      obj: process,
      stackFrameGroup: {
        previousStackFramesToSkip: 1,
        title: 'process.nextTick'
      }
    });
  }
}

export const longStackTracesHandler = new LongStackTracesHandlerImpl();
