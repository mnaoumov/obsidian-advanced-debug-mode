import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type {
  App,
  Command
} from 'obsidian';
import type { Mock } from 'vitest';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import { join } from 'node:path';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { PluginSettings } from '../settings/plugin-settings.ts';
import type { MemoryMonitorSessionState } from './desktop-memory-monitor-component.ts';

import { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';
import { DesktopMemoryMonitorComponent } from './desktop-memory-monitor-component.ts';
import { BYTES_IN_MEGABYTE } from './memory-monitor.ts';

const GIGABYTE = 1024 * BYTES_IN_MEGABYTE;
const LIMIT = 4 * GIGABYTE;
const DEFAULT_FOLDER = join('tmp', 'diagnostics');
const START_TIME = 1_000_000;
const INTERVAL_IN_SECONDS = 10;
const MILLISECONDS_IN_SECOND = 1000;
const MEMORY_TRAIL_FILE_NAME = 'memory-trail.jsonl';
// Longer than the pause before a snapshot, shorter than the sample interval.
const PAINT_DELAY_IN_MILLISECONDS = 200;

interface Harness {
  readonly appendedLines: string[];
  readonly commands: MockCommands;
  readonly component: DesktopMemoryMonitorComponent;
  readonly executeCommand: Mock<(command: Command) => boolean>;
  readonly fs: MockFs;
  readonly heap: MutableHeap;
  readonly now: MutableClock;
  readonly onStatusBarClick: Mock<() => void>;
  readonly sessionState: MemoryMonitorSessionState;
  readonly showNotice: Mock;
  readonly statusBarItem: HTMLElement;
  readonly v8: MockV8;
}

interface HarnessOptions {
  readonly freeBytes?: number;
  readonly settings?: Partial<PluginSettings>;
  readonly trailSize?: number;
}

interface MockCommands {
  readonly executeCommand: Mock<(command: Command) => boolean>;
}

interface MockFs {
  readonly appendFileSync: Mock;
  readonly mkdirSync: Mock;
  readonly renameSync: Mock;
  readonly statfsSync: Mock;
  readonly statSync: Mock;
}

interface MockV8 {
  readonly getHeapSpaceStatistics: Mock;
  readonly getHeapStatistics: Mock;
  readonly writeHeapSnapshot: Mock;
}

interface MutableClock {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The tests move the clock.
  value: number;
}

interface MutableHeap {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- The tests grow and shrink the heap.
  usedBytes: number;
}

function createHarness(options: HarnessOptions = {}): Harness {
  type DesktopMemoryMonitorComponentParams = ConstructorParameters<typeof DesktopMemoryMonitorComponent>[0];
  const pluginSettingsComponent = new PluginSettingsComponent({
    dataHandler: { loadData: vi.fn().mockResolvedValue(null), saveData: vi.fn().mockResolvedValue(undefined) },
    pluginEventSource: strictProxy<PluginEventSource>({})
  });
  vi.spyOn(pluginSettingsComponent, 'settings', 'get').mockReturnValue({
    ...pluginSettingsComponent.defaultSettings,
    memorySampleIntervalInSeconds: INTERVAL_IN_SECONDS,
    shouldMonitorMemory: true,
    ...options.settings
  });

  const heap: MutableHeap = { usedBytes: GIGABYTE };
  const now: MutableClock = { value: START_TIME };
  const appendedLines: string[] = [];
  const fs: MockFs = {
    appendFileSync: vi.fn((_path: string, data: string) => {
      appendedLines.push(data);
    }),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
    statfsSync: vi.fn(() => ({ bavail: options.freeBytes ?? 100 * GIGABYTE, bsize: 1 })),
    statSync: vi.fn(() => options.trailSize === undefined ? undefined : { size: options.trailSize })
  };
  /* eslint-disable camelcase -- V8's own field names. */
  const v8: MockV8 = {
    getHeapSpaceStatistics: vi.fn(() => [
      { space_name: 'new_space', space_used_size: BYTES_IN_MEGABYTE },
      { space_name: 'old_space', space_used_size: heap.usedBytes }
    ]),
    getHeapStatistics: vi.fn(() => ({
      external_memory: 0,
      heap_size_limit: LIMIT,
      total_heap_size: heap.usedBytes,
      used_heap_size: heap.usedBytes
    })),
    writeHeapSnapshot: vi.fn((filePath: string) => filePath)
  };
  /* eslint-enable camelcase -- V8's own field names. */
  const commands: MockCommands = { executeCommand: vi.fn<(command: Command) => boolean>(() => true) };
  const statusBarItem = createDiv();
  document.body.append(statusBarItem);
  const onStatusBarClick = vi.fn<() => void>();
  const showNotice = vi.fn();
  const sessionState: MemoryMonitorSessionState = { hasWrittenCriticalSnapshot: false };

  const component = new DesktopMemoryMonitorComponent({
    addStatusBarItem: (): HTMLElement => statusBarItem,
    app: castTo<App>({ commands }),
    defaultDiagnosticsFolder: DEFAULT_FOLDER,
    fs: castTo<DesktopMemoryMonitorComponentParams['fs']>(fs),
    getResidentSetSizeInBytes: (): number => 2 * GIGABYTE,
    now: (): number => now.value,
    onStatusBarClick,
    path: { join },
    pluginNoticeComponent: strictProxy<PluginNoticeComponent>({ showNotice }),
    pluginSettingsComponent,
    sessionState,
    v8: castTo<DesktopMemoryMonitorComponentParams['v8']>(v8)
  });

  return { appendedLines, commands, component, executeCommand: commands.executeCommand, fs, heap, now, onStatusBarClick, sessionState, showNotice, statusBarItem, v8 };
}

// The samples run on the component's interval, so a test takes one by moving the fake clock a whole interval on.
function sampleNow(): void {
  vi.advanceTimersByTime(INTERVAL_IN_SECONDS * MILLISECONDS_IN_SECOND);
}

describe('DesktopMemoryMonitorComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.empty();
  });

  it('should do nothing on load while the monitor is off', () => {
    const { appendedLines, component, statusBarItem } = createHarness({ settings: { shouldMonitorMemory: false } });

    component.load();

    expect(statusBarItem.textContent).toBe('');
    expect(appendedLines).toEqual([]);
    component.unload();
  });

  it('should show the heap in the status bar, write the trail, and sample on the interval', () => {
    const { appendedLines, component, fs, heap, onStatusBarClick, statusBarItem } = createHarness();

    component.load();

    expect(statusBarItem.textContent).toBe('Heap 1.00 GB / 4.00 GB (25%)');
    expect(statusBarItem.hasClass('advanced-debug-mode-memory-status')).toBe(true);
    expect(fs.appendFileSync).toHaveBeenCalledWith(join(DEFAULT_FOLDER, MEMORY_TRAIL_FILE_NAME), expect.any(String));
    expect(JSON.parse(appendedLines[0] ?? '')).toMatchObject({ event: 'start', usedHeapBytes: GIGABYTE });

    heap.usedBytes = 2 * GIGABYTE;
    vi.advanceTimersByTime(INTERVAL_IN_SECONDS * MILLISECONDS_IN_SECOND);
    expect(statusBarItem.textContent).toBe('Heap 2.00 GB / 4.00 GB (50%)');
    expect(appendedLines).toHaveLength(2);
    expect(component.getHistory()).toHaveLength(2);

    statusBarItem.click();
    expect(onStatusBarClick).toHaveBeenCalledOnce();

    component.unload();
    expect(statusBarItem.isConnected).toBe(false);
  });

  it('should name the last command in the samples', () => {
    const { commands, component, executeCommand, now } = createHarness();
    component.load();

    commands.executeCommand(castTo<Command>({ id: 'app:reload' }));
    expect(executeCommand).toHaveBeenCalledOnce();

    const SECONDS = 3;
    now.value += SECONDS * MILLISECONDS_IN_SECOND;
    sampleNow();
    expect(component.getHistory().at(-1)?.activity).toBe('command app:reload 3s ago');
    component.unload();
  });

  it('should warn once on crossing the warning threshold', () => {
    const { component, heap, showNotice } = createHarness();
    component.load();

    heap.usedBytes = 3 * GIGABYTE;
    sampleNow();
    sampleNow();

    expect(showNotice).toHaveBeenCalledOnce();
    expect(showNotice).toHaveBeenCalledWith('Heap at 75% of its limit (3.00 GB). Details in the console.');
    expect(console.warn).toHaveBeenCalledOnce();
    expect(console.warn).toHaveBeenCalledWith(
      'Memory Warning: heap Heap 3.00 GB / 4.00 GB (75%)',
      expect.objectContaining({
        growthPerMinute: null,
        heapSpaces: [{ space: 'old_space', used: '3.00 GB' }, { space: 'new_space', used: '1 MB' }]
      })
    );
    component.unload();
  });

  it('should report the growth rate when the history spans time', () => {
    const { component, heap, now } = createHarness();
    component.load();

    now.value += 60_000;
    heap.usedBytes = 3 * GIGABYTE;
    sampleNow();

    expect(console.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ growthPerMinute: '2.00 GB/min' }));
    component.unload();
  });

  it('should write one heap snapshot per session at the critical threshold when that is on', async () => {
    const { component, heap, sessionState, showNotice, statusBarItem, v8 } = createHarness({ settings: { shouldWriteHeapSnapshotOnCritical: true } });
    component.load();

    heap.usedBytes = 3.8 * GIGABYTE;
    sampleNow();
    await vi.advanceTimersByTimeAsync(PAINT_DELAY_IN_MILLISECONDS);

    expect(statusBarItem.hasClass('advanced-debug-mode-memory-status-critical')).toBe(true);
    expect(sessionState.hasWrittenCriticalSnapshot).toBe(true);
    expect(v8.writeHeapSnapshot).toHaveBeenCalledOnce();
    expect(v8.writeHeapSnapshot).toHaveBeenCalledWith(expect.stringMatching(/heap-.*-critical\.heapsnapshot$/));
    expect(showNotice).toHaveBeenCalledWith(expect.stringContaining('Obsidian may crash. Writing a heap snapshot.'));

    heap.usedBytes = GIGABYTE;
    sampleNow();
    heap.usedBytes = 3.8 * GIGABYTE;
    sampleNow();
    await vi.advanceTimersByTimeAsync(PAINT_DELAY_IN_MILLISECONDS);
    expect(v8.writeHeapSnapshot).toHaveBeenCalledOnce();
    component.unload();
  });

  it('should only warn at the critical threshold when the snapshot is off', () => {
    const { component, heap, showNotice, v8 } = createHarness();
    component.load();

    heap.usedBytes = 3.8 * GIGABYTE;
    sampleNow();

    expect(showNotice).toHaveBeenCalledWith('Heap at 95% of its limit (3.80 GB): Obsidian may crash. Details in the console.');
    expect(v8.writeHeapSnapshot).not.toHaveBeenCalled();
    component.unload();
  });

  it('should log a failed critical snapshot', async () => {
    const { component, heap, v8 } = createHarness({ settings: { shouldWriteHeapSnapshotOnCritical: true } });
    v8.writeHeapSnapshot.mockImplementation(() => {
      throw new Error('disk full');
    });
    component.load();

    heap.usedBytes = 3.8 * GIGABYTE;
    sampleNow();
    await vi.advanceTimersByTimeAsync(PAINT_DELAY_IN_MILLISECONDS);

    expect(console.error).toHaveBeenCalledWith('Could not write the heap snapshot', expect.anything());
    component.unload();
  });

  it('should rotate a trail that grew past its limit', () => {
    const { component, fs } = createHarness({ trailSize: 11 * BYTES_IN_MEGABYTE });
    component.load();

    const trailPath = join(DEFAULT_FOLDER, MEMORY_TRAIL_FILE_NAME);
    expect(fs.renameSync).toHaveBeenCalledWith(trailPath, `${trailPath}.1`);
    component.unload();
  });

  it('should not write the trail when that is off', () => {
    const { appendedLines, component } = createHarness({ settings: { shouldWriteMemoryTrail: false } });
    component.load();

    expect(appendedLines).toEqual([]);
    component.unload();
  });

  it('should log a trail failure only once', () => {
    const { component, fs } = createHarness();
    fs.appendFileSync.mockImplementation(() => {
      throw new Error('read-only');
    });
    component.load();
    sampleNow();

    expect(console.error).toHaveBeenCalledOnce();
    component.unload();
  });

  it('should use the configured diagnostics folder', () => {
    const { component } = createHarness({ settings: { memoryDiagnosticsFolder: '  /custom  ' } });

    expect(component.getTrailFilePath()).toBe(join('/custom', MEMORY_TRAIL_FILE_NAME));
  });

  describe('takeHeapSnapshot', () => {
    it('should write the snapshot to the diagnostics folder and say where', async () => {
      const { appendedLines, component, showNotice } = createHarness();
      component.load();

      const promise = component.takeHeapSnapshot('manual');
      await vi.advanceTimersByTimeAsync(PAINT_DELAY_IN_MILLISECONDS);
      const filePath = await promise;

      expect(filePath).toMatch(/heap-.*-manual\.heapsnapshot$/);
      expect(showNotice).toHaveBeenLastCalledWith(`Heap snapshot written to ${String(filePath)}. Open it in DevTools, Memory tab, Load.`);
      expect(JSON.parse(appendedLines.at(-1) ?? '')).toMatchObject({ event: `snapshot ${String(filePath)}` });
      component.unload();
    });

    it('should skip the snapshot without room on the disk', async () => {
      const { component, showNotice, v8 } = createHarness({ freeBytes: GIGABYTE });

      expect(await component.takeHeapSnapshot('manual')).toBeNull();
      expect(v8.writeHeapSnapshot).not.toHaveBeenCalled();
      expect(showNotice).toHaveBeenCalledWith(expect.stringContaining('Heap snapshot skipped: 1.00 GB free'));
    });

    it('should report a folder it cannot prepare', async () => {
      const { component, fs, showNotice } = createHarness();
      fs.mkdirSync.mockImplementation(() => {
        throw new Error('denied');
      });

      expect(await component.takeHeapSnapshot('manual')).toBeNull();
      expect(showNotice).toHaveBeenCalledWith(`Could not prepare the heap snapshot folder ${DEFAULT_FOLDER}. See the console.`);
    });
  });

  describe('collectGarbage', () => {
    afterEach(() => {
      Reflect.deleteProperty(window, 'gc');
    });

    it('should say how to expose gc when it is not exposed', () => {
      const { component, showNotice } = createHarness();

      component.collectGarbage();

      expect(showNotice).toHaveBeenCalledWith('Garbage collection is not exposed. Start Obsidian with --js-flags=--expose-gc.');
    });

    it('should collect and report the heap before and after', () => {
      const { component, heap, showNotice } = createHarness();
      Reflect.set(window, 'gc', () => {
        heap.usedBytes = 512 * BYTES_IN_MEGABYTE;
      });

      component.collectGarbage();

      expect(showNotice).toHaveBeenCalledWith('Garbage collected: heap 1.00 GB -> 512 MB.');
    });
  });
});
