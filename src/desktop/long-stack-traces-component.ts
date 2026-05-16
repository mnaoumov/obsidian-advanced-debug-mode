// eslint-disable-next-line import/no-nodejs-modules, import-x/no-nodejs-modules -- Deliberate, executes only on desktop.
import process from 'node:process';
import { AllWindowsEventHandler } from 'obsidian-dev-utils/obsidian/components/all-windows-event-handler';

import type {
  StackFrame,
  WindowEx
} from '../components/long-stack-traces-component.ts';

import { LongStackTracesComponentBase } from '../components/long-stack-traces-component.ts';
import { AsyncLongStackTracesComponent } from './async-long-stack-traces-component.ts';

class LongStackTracesComponentDesktop extends LongStackTracesComponentBase {
  private asyncLongStackTracesHandler?: AsyncLongStackTracesComponent;

  public override adjustStackLines(lines: string[], parentStackFrame: StackFrame | undefined, asyncId: number): void {
    super.adjustStackLines(lines, parentStackFrame, asyncId);
    this.asyncLongStackTracesHandler?.adjustStackLines(lines, asyncId);
  }

  public override onload(): void {
    super.onload();
    if (!this.isEnabled()) {
      return;
    }

    new AllWindowsEventHandler(this.app, this).registerAllWindowsHandler((win) => {
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

    this.asyncLongStackTracesHandler = new AsyncLongStackTracesComponent({
      longStackTracesComponent: this,
      pluginSettingsComponent: this.pluginSettingsComponent
    });
    this.addChild(this.asyncLongStackTracesHandler);
  }

  protected override getAsyncId(): number {
    super.getAsyncId();
    return this.asyncLongStackTracesHandler?.getAsyncId() ?? 0;
  }
}

export const LongStackTracesComponentConstructor = LongStackTracesComponentDesktop;
