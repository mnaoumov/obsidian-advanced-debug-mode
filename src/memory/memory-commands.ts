import { GlobalCommandHandler } from '@mnaoumov/obsidian-lib/command-handlers/global-command-handler';

import type { MemoryMonitorComponent } from './memory-monitor-component.ts';

import { getExposedGc } from './memory-monitor.ts';

export class ForceGarbageCollectionCommandHandler extends GlobalCommandHandler {
  public constructor(private readonly memoryMonitorComponent: MemoryMonitorComponent) {
    super({
      icon: 'trash-2',
      id: 'force-garbage-collection',
      name: 'Force garbage collection'
    });
  }

  // Only offered when Obsidian was started with `--js-flags=--expose-gc`, which is what puts `gc` on the global.
  protected override canExecute(): boolean {
    return this.memoryMonitorComponent.getDesktopComponent() !== null && getExposedGc() !== null;
  }

  protected override execute(): void {
    this.memoryMonitorComponent.getDesktopComponent()?.collectGarbage();
  }
}

export class ShowMemoryHistoryCommandHandler extends GlobalCommandHandler {
  public constructor(private readonly memoryMonitorComponent: MemoryMonitorComponent) {
    super({
      icon: 'activity',
      id: 'show-memory-history',
      name: 'Show memory history'
    });
  }

  protected override canExecute(): boolean {
    return this.memoryMonitorComponent.getDesktopComponent() !== null;
  }

  protected override execute(): void {
    this.memoryMonitorComponent.openHistory();
  }
}

export class TakeHeapSnapshotCommandHandler extends GlobalCommandHandler {
  public constructor(private readonly memoryMonitorComponent: MemoryMonitorComponent) {
    super({
      icon: 'camera',
      id: 'take-heap-snapshot',
      name: 'Take heap snapshot now'
    });
  }

  protected override canExecute(): boolean {
    return this.memoryMonitorComponent.getDesktopComponent() !== null;
  }

  protected override async execute(): Promise<void> {
    await this.memoryMonitorComponent.getDesktopComponent()?.takeHeapSnapshot('manual');
  }
}
