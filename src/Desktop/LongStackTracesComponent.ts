import { process } from 'obsidian-dev-utils/ScriptUtils/NodeModules';

import type { Plugin } from '../Plugin.ts';

import { LongStackTracesComponent } from '../Components/LongStackTracesComponent.ts';
import { AsyncLongStackTracesComponent } from './AsyncLongStackTracesComponent.ts';

class LongStackTracesComponentImpl extends LongStackTracesComponent {
  private asyncLongStackTracesHandler!: AsyncLongStackTracesComponent;

  public constructor(plugin: Plugin) {
    super(plugin);
    this.asyncLongStackTracesHandler = new AsyncLongStackTracesComponent(plugin, this);
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

export const LongStackTracesComponentConstructor = LongStackTracesComponentImpl;
