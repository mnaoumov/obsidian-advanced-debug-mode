import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type {
  App,
  Command
} from 'obsidian';

import { MonkeyAroundComponent } from '@mnaoumov/obsidian-lib/components/monkey-around-component';
import { setTimeoutAsync } from '@mnaoumov/typescript-lib/async';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';
import type { MemorySample } from './memory-monitor.ts';

import {
  BYTES_IN_MEGABYTE,
  formatBytes,
  formatStatusBarText,
  formatTrailLine,
  getExposedGc,
  getHeapGrowthPerMinute,
  getHeapSnapshotFileName,
  getHeapUsageInPercent,
  getMemoryLevel,
  hasEnoughDiskSpaceForSnapshot,
  MemoryHistory,
  MemoryLevel
} from './memory-monitor.ts';

// What outlives a reload of the component on a settings change: the critical snapshot is written once per app session.
export interface MemoryMonitorSessionState {
  // eslint-disable-next-line typescript-dev-toolkit/readonly-interface-members -- Set once the critical snapshot is written, and shared with the facade.
  hasWrittenCriticalSnapshot: boolean;
}

interface DesktopMemoryMonitorComponentConstructorParams {
  readonly addStatusBarItem: () => HTMLElement;
  readonly app: App;
  readonly defaultDiagnosticsFolder: string;
  readonly fs: NodeFs;
  readonly getResidentSetSizeInBytes: () => number;
  readonly now?: () => number;
  readonly onStatusBarClick: () => void;
  readonly path: NodePath;
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
  readonly sessionState: MemoryMonitorSessionState;
  readonly v8: NodeV8;
}
// The Node.js built-ins this component uses, narrowed to what it calls. The facade `require()`s them behind
// `Platform.isDesktop` and hands them down, so no module reaches them through a static import.
type NodeFs = Pick<typeof import('node:fs'), 'appendFileSync' | 'mkdirSync' | 'renameSync' | 'statfsSync' | 'statSync'>;

type NodePath = Pick<typeof import('node:path'), 'join'>;

type NodeV8 = Pick<typeof import('node:v8'), 'getHeapSpaceStatistics' | 'getHeapStatistics' | 'writeHeapSnapshot'>;

interface RunningCommand {
  readonly id: string;
  readonly startedAt: number;
}

const MEMORY_TRAIL_FILE_NAME = 'memory-trail.jsonl';
const HISTORY_CAPACITY = 360;
const MILLISECONDS_IN_SECOND = 1000;
// Lets a notice paint before a snapshot blocks the renderer for seconds or minutes.
const PAINT_DELAY_IN_MILLISECONDS = 100;
const STATUS_BAR_CLASS = 'advanced-debug-mode-memory-status';

export class DesktopMemoryMonitorComponent extends MonkeyAroundComponent {
  private readonly addStatusBarItem: () => HTMLElement;
  private readonly app: App;
  private readonly defaultDiagnosticsFolder: string;
  private readonly fs: NodeFs;
  private readonly getResidentSetSizeInBytes: () => number;
  private readonly history = new MemoryHistory(HISTORY_CAPACITY);
  private isTrailFailureLogged = false;
  private lastCommand: null | RunningCommand = null;
  private lastLevel = MemoryLevel.Normal;
  private readonly now: () => number;
  private readonly onStatusBarClick: () => void;
  private readonly path: NodePath;
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly pluginSettingsComponent: PluginSettingsComponent;
  private readonly sessionState: MemoryMonitorSessionState;
  private statusBarItem: HTMLElement | null = null;
  private readonly v8: NodeV8;

  public constructor(params: DesktopMemoryMonitorComponentConstructorParams) {
    super();
    this.addStatusBarItem = params.addStatusBarItem;
    this.app = params.app;
    this.defaultDiagnosticsFolder = params.defaultDiagnosticsFolder;
    this.fs = params.fs;
    this.getResidentSetSizeInBytes = params.getResidentSetSizeInBytes;
    this.now = params.now ?? Date.now;
    this.onStatusBarClick = params.onStatusBarClick;
    this.path = params.path;
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
    this.sessionState = params.sessionState;
    this.v8 = params.v8;
  }

  public collectGarbage(): void {
    const gc = getExposedGc();
    if (!gc) {
      this.pluginNoticeComponent.showNotice('Garbage collection is not exposed. Start Obsidian with --js-flags=--expose-gc.');
      return;
    }

    const before = this.v8.getHeapStatistics().used_heap_size;
    gc();
    const after = this.v8.getHeapStatistics().used_heap_size;
    this.pluginNoticeComponent.showNotice(`Garbage collected: heap ${formatBytes(before)} -> ${formatBytes(after)}.`);
  }

  public getHistory(): readonly MemorySample[] {
    return this.history.getSamples();
  }

  public getTrailFilePath(): string {
    return this.path.join(this.getDiagnosticsFolder(), MEMORY_TRAIL_FILE_NAME);
  }

  public override onload(): void {
    const settings = this.pluginSettingsComponent.settings;
    if (!settings.shouldMonitorMemory) {
      return;
    }

    this.registerMethodPatch({
      $object: this.app.commands,
      methodName: 'executeCommand',
      patchHandler: ({ fallback, originalArguments: [command] }) => {
        this.recordCommand(command);
        return fallback();
      }
    });

    const statusBarItem = this.addStatusBarItem();
    statusBarItem.addClass(STATUS_BAR_CLASS);
    statusBarItem.setAttribute('aria-label', 'Memory history');
    this.registerDomEvent(statusBarItem, 'click', this.onStatusBarClick);
    this.register(() => {
      statusBarItem.remove();
      this.statusBarItem = null;
    });
    this.statusBarItem = statusBarItem;

    this.sample('start');
    this.registerInterval(window.setInterval(() => {
      this.sample();
    }, settings.memorySampleIntervalInSeconds * MILLISECONDS_IN_SECOND));
  }

  public async takeHeapSnapshot(reason: string): Promise<null | string> {
    const folder = this.getDiagnosticsFolder();
    const usedHeapBytes = this.v8.getHeapStatistics().used_heap_size;
    let freeBytes: number;
    try {
      this.fs.mkdirSync(folder, { recursive: true });
      const fsStats = this.fs.statfsSync(folder);
      freeBytes = fsStats.bavail * fsStats.bsize;
    } catch (error) {
      console.error('Could not prepare the heap snapshot folder', { error, folder });
      this.pluginNoticeComponent.showNotice(`Could not prepare the heap snapshot folder ${folder}. See the console.`);
      return null;
    }

    if (!hasEnoughDiskSpaceForSnapshot(freeBytes, usedHeapBytes)) {
      this.pluginNoticeComponent.showNotice(
        `Heap snapshot skipped: ${formatBytes(freeBytes)} free in ${folder}, with ${formatBytes(usedHeapBytes)} of heap to write.`
      );
      return null;
    }

    const filePath = this.path.join(folder, getHeapSnapshotFileName(this.now(), reason));
    this.pluginNoticeComponent.showNotice(`Writing a heap snapshot of ${formatBytes(usedHeapBytes)}. Obsidian stops responding until it is done.`);
    await setTimeoutAsync(PAINT_DELAY_IN_MILLISECONDS);
    const writtenPath = this.v8.writeHeapSnapshot(filePath);
    this.appendTrail(this.readSample(), `snapshot ${writtenPath}`);
    this.pluginNoticeComponent.showNotice(`Heap snapshot written to ${writtenPath}. Open it in DevTools, Memory tab, Load.`);
    return writtenPath;
  }

  private appendTrail(sample: MemorySample, $event?: string): void {
    const settings = this.pluginSettingsComponent.settings;
    if (!settings.shouldMonitorMemory || !settings.shouldWriteMemoryTrail) {
      return;
    }

    const trailFilePath = this.getTrailFilePath();
    try {
      this.fs.mkdirSync(this.getDiagnosticsFolder(), { recursive: true });
      const size = this.fs.statSync(trailFilePath, { throwIfNoEntry: false })?.size ?? 0;
      if (size > settings.memoryTrailMaxSizeInMegabytes * BYTES_IN_MEGABYTE) {
        this.fs.renameSync(trailFilePath, `${trailFilePath}.1`);
      }

      // Synchronous on purpose: a renderer that dies right after this line still leaves it on disk.
      this.fs.appendFileSync(trailFilePath, formatTrailLine(sample, $event));
    } catch (error) {
      if (!this.isTrailFailureLogged) {
        this.isTrailFailureLogged = true;
        console.error('Could not write the memory trail', { error, trailFilePath });
      }
    }
  }

  private getActivity(): string {
    if (!this.lastCommand) {
      return '';
    }

    const seconds = Math.round((this.now() - this.lastCommand.startedAt) / MILLISECONDS_IN_SECOND);
    return `command ${this.lastCommand.id} ${String(seconds)}s ago`;
  }

  private getDiagnosticsFolder(): string {
    return this.pluginSettingsComponent.settings.memoryDiagnosticsFolder.trim() || this.defaultDiagnosticsFolder;
  }

  private invokeSnapshot(): void {
    this.takeHeapSnapshot('critical').catch((error: unknown) => {
      console.error('Could not write the heap snapshot', { error });
    });
  }

  private logSuspects(sample: MemorySample, level: MemoryLevel): void {
    const spaces = this.v8.getHeapSpaceStatistics()
      .map((space) => ({ space: space.space_name, used: formatBytes(space.space_used_size), usedBytes: space.space_used_size }))
      .sort((a, b) => b.usedBytes - a.usedBytes)
      .map(({ space, used }) => ({ space, used }));
    const growthPerMinute = getHeapGrowthPerMinute(this.history.getSamples());
    console.warn(`Memory ${level}: heap ${formatStatusBarText(sample)}`, {
      activity: sample.activity,
      growthPerMinute: growthPerMinute === null ? null : `${formatBytes(growthPerMinute)}/min`,
      heapSpaces: spaces,
      residentSetSize: formatBytes(sample.residentSetSizeBytes),
      trail: this.getTrailFilePath()
    });
  }

  private onCritical(sample: MemorySample): void {
    this.logSuspects(sample, MemoryLevel.Critical);
    const settings = this.pluginSettingsComponent.settings;
    const shouldWriteSnapshot = settings.shouldWriteHeapSnapshotOnCritical && !this.sessionState.hasWrittenCriticalSnapshot;
    this.pluginNoticeComponent.showNotice(
      `Heap at ${getHeapUsageInPercent(sample).toFixed(0)}% of its limit (${formatBytes(sample.usedHeapBytes)}): Obsidian may crash.${shouldWriteSnapshot ? ' Writing a heap snapshot.' : ''} Details in the console.`
    );
    if (!shouldWriteSnapshot) {
      return;
    }

    this.sessionState.hasWrittenCriticalSnapshot = true;
    this.invokeSnapshot();
  }

  private onWarning(sample: MemorySample): void {
    this.logSuspects(sample, MemoryLevel.Warning);
    this.pluginNoticeComponent.showNotice(
      `Heap at ${getHeapUsageInPercent(sample).toFixed(0)}% of its limit (${formatBytes(sample.usedHeapBytes)}). Details in the console.`
    );
  }

  private readSample(): MemorySample {
    const heapStatistics = this.v8.getHeapStatistics();
    return {
      activity: this.getActivity(),
      externalBytes: heapStatistics.external_memory,
      heapLimitBytes: heapStatistics.heap_size_limit,
      residentSetSizeBytes: this.getResidentSetSizeInBytes(),
      timestamp: this.now(),
      totalHeapBytes: heapStatistics.total_heap_size,
      usedHeapBytes: heapStatistics.used_heap_size
    };
  }

  private recordCommand(command: Command): void {
    this.lastCommand = { id: command.id, startedAt: this.now() };
  }

  private sample($event?: string): MemorySample {
    const sample = this.readSample();
    this.history.add(sample);

    const settings = this.pluginSettingsComponent.settings;
    const level = getMemoryLevel(sample, {
      criticalThresholdInPercent: settings.memoryCriticalThresholdInPercent,
      warningThresholdInPercent: settings.memoryWarningThresholdInPercent
    });
    this.updateStatusBar(sample, level);
    this.appendTrail(sample, $event);

    const previousLevel = this.lastLevel;
    this.lastLevel = level;
    if (level === MemoryLevel.Critical && previousLevel !== MemoryLevel.Critical) {
      this.onCritical(sample);
    } else if (level === MemoryLevel.Warning && previousLevel === MemoryLevel.Normal) {
      this.onWarning(sample);
    }

    return sample;
  }

  private updateStatusBar(sample: MemorySample, level: MemoryLevel): void {
    if (!this.statusBarItem) {
      return;
    }

    this.statusBarItem.setText(formatStatusBarText(sample));
    this.statusBarItem.toggleClass(`${STATUS_BAR_CLASS}-warning`, level === MemoryLevel.Warning);
    this.statusBarItem.toggleClass(`${STATUS_BAR_CLASS}-critical`, level === MemoryLevel.Critical);
  }
}
