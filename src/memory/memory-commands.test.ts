import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { DesktopMemoryMonitorComponent } from './desktop-memory-monitor-component.ts';
import type { MemoryMonitorComponent } from './memory-monitor-component.ts';

import {
  ForceGarbageCollectionCommandHandler,
  ShowMemoryHistoryCommandHandler,
  TakeHeapSnapshotCommandHandler
} from './memory-commands.ts';

interface MockDesktop {
  readonly collectGarbage: ReturnType<typeof vi.fn>;
  readonly takeHeapSnapshot: ReturnType<typeof vi.fn>;
}

interface MockMemoryMonitor {
  readonly openHistory: ReturnType<typeof vi.fn>;
}

function createDesktop(): MockDesktop {
  return { collectGarbage: vi.fn(), takeHeapSnapshot: vi.fn().mockResolvedValue('file') };
}

function createMemoryMonitor(desktop: MockDesktop | null): MemoryMonitorComponent & MockMemoryMonitor {
  return castTo<MemoryMonitorComponent & MockMemoryMonitor>({
    getDesktopComponent: (): DesktopMemoryMonitorComponent | null => castTo<DesktopMemoryMonitorComponent | null>(desktop),
    openHistory: vi.fn()
  });
}

describe('memory commands', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'gc');
  });

  it('should take a heap snapshot only on desktop', async () => {
    const desktop = createDesktop();
    const command = new TakeHeapSnapshotCommandHandler(createMemoryMonitor(desktop)).buildCommand();

    expect(command.id).toBe('take-heap-snapshot');
    expect(command.name).toBe('Take heap snapshot now');
    expect(command.checkCallback?.(true)).toBe(true);
    command.checkCallback?.(false);
    await vi.waitFor(() => {
      expect(desktop.takeHeapSnapshot).toHaveBeenCalledWith('manual');
    });

    expect(new TakeHeapSnapshotCommandHandler(createMemoryMonitor(null)).buildCommand().checkCallback?.(true)).toBe(false);
  });

  it('should show the memory history only on desktop', () => {
    const memoryMonitor = createMemoryMonitor(createDesktop());
    const command = new ShowMemoryHistoryCommandHandler(memoryMonitor).buildCommand();

    expect(command.id).toBe('show-memory-history');
    expect(command.checkCallback?.(true)).toBe(true);
    command.checkCallback?.(false);
    expect(memoryMonitor.openHistory).toHaveBeenCalledOnce();

    expect(new ShowMemoryHistoryCommandHandler(createMemoryMonitor(null)).buildCommand().checkCallback?.(true)).toBe(false);
  });

  it('should force garbage collection only when gc is exposed', () => {
    const desktop = createDesktop();
    const command = new ForceGarbageCollectionCommandHandler(createMemoryMonitor(desktop)).buildCommand();

    expect(command.id).toBe('force-garbage-collection');
    expect(command.checkCallback?.(true)).toBe(false);

    Reflect.set(window, 'gc', vi.fn());
    expect(command.checkCallback?.(true)).toBe(true);
    command.checkCallback?.(false);
    expect(desktop.collectGarbage).toHaveBeenCalledOnce();
  });
});
