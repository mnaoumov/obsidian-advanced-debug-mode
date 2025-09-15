import { process } from 'obsidian-dev-utils/ScriptUtils/NodeModules';

import type {
  StackFrame,
  WindowEx
} from '../Components/LongStackTracesComponent.ts';
import type { Plugin } from '../Plugin.ts';

import { LongStackTracesComponent } from '../Components/LongStackTracesComponent.ts';
import { AsyncLongStackTracesComponent } from './AsyncLongStackTracesComponent.ts';

class LongStackTracesComponentImpl extends LongStackTracesComponent {
  private asyncLongStackTracesHandler!: AsyncLongStackTracesComponent;

  public constructor(plugin: Plugin) {
    super(plugin);
  }

  public override adjustStackLines(lines: string[], parentStackFrame: StackFrame | undefined, asyncId: number): void {
    super.adjustStackLines(lines, parentStackFrame, asyncId);
    this.asyncLongStackTracesHandler.adjustStackLines(lines, asyncId);
  }

  public override onload(): void {
    super.onload();
    if (!this.isEnabled()) {
      return;
    }

    this.plugin.registerDomWindowHandler((win) => {
      this.patchWithLongStackTraces({
        handlerArgIndex: 0,
        methodName: 'setImmediate',
        obj: win as WindowEx,
        stackFrameTitle: 'setImmediate'
      });
    });

    this.patchWithLongStackTraces({
      handlerArgIndex: 0,
      methodName: 'nextTick',
      obj: process,
      stackFrameTitle: 'process.nextTick'
    });

    this.asyncLongStackTracesHandler = new AsyncLongStackTracesComponent(this.plugin, this);
    this.addChild(this.asyncLongStackTracesHandler);
  }

  protected override getAsyncId(): number {
    return this.asyncLongStackTracesHandler.getAsyncId();
  }
}

export const LongStackTracesComponentConstructor = LongStackTracesComponentImpl;
