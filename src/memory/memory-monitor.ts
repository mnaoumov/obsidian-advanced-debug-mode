// Pure helpers of the memory troubleshooting feature. Nothing here touches Node.js or the DOM, so all of it runs in the
// unit tests as it runs in the app.

const BYTES_IN_KILOBYTE = 1024;
export const BYTES_IN_MEGABYTE = BYTES_IN_KILOBYTE * BYTES_IN_KILOBYTE;
const BYTES_IN_GIGABYTE = BYTES_IN_MEGABYTE * BYTES_IN_KILOBYTE;
const PERCENT = 100;

// A heap snapshot is written by the process whose heap it describes, and V8 holds the serialized graph in memory while
// it streams it out. The file itself is usually a little larger than the used heap, so the guard asks for twice that,
// plus a margin that keeps the disk usable afterwards.
const SNAPSHOT_SIZE_FACTOR = 2;
const SNAPSHOT_FREE_SPACE_MARGIN_IN_MEGABYTES = 512;
const SNAPSHOT_FREE_SPACE_MARGIN_IN_BYTES = SNAPSHOT_FREE_SPACE_MARGIN_IN_MEGABYTES * BYTES_IN_MEGABYTE;

export enum MemoryLevel {
  Critical = 'Critical',
  Normal = 'Normal',
  Warning = 'Warning'
}

export interface MemorySample {
  // What was running when the sample was taken: the last command and how long ago it started.
  readonly activity: string;
  readonly externalBytes: number;
  readonly heapLimitBytes: number;
  readonly residentSetSizeBytes: number;
  readonly timestamp: number;
  readonly totalHeapBytes: number;
  readonly usedHeapBytes: number;
}

interface MemoryThresholds {
  readonly criticalThresholdInPercent: number;
  readonly warningThresholdInPercent: number;
}

// A fixed-size ring of the latest samples, kept in memory for the history view and the growth rate. The trail file is
// what survives a crash; this only spares a read of it.
export class MemoryHistory {
  private readonly samples: MemorySample[] = [];

  public constructor(private readonly capacity: number) {}

  public add(sample: MemorySample): void {
    this.samples.push(sample);
    if (this.samples.length > this.capacity) {
      this.samples.shift();
    }
  }

  public getSamples(): readonly MemorySample[] {
    return [...this.samples];
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= BYTES_IN_GIGABYTE) {
    const GIGABYTE_DIGITS = 2;
    return `${(bytes / BYTES_IN_GIGABYTE).toFixed(GIGABYTE_DIGITS)} GB`;
  }

  return bytes >= BYTES_IN_MEGABYTE ? `${(bytes / BYTES_IN_MEGABYTE).toFixed(0)} MB` : `${(bytes / BYTES_IN_KILOBYTE).toFixed(0)} KB`;
}

export function formatStatusBarText(sample: MemorySample): string {
  return `Heap ${formatBytes(sample.usedHeapBytes)} / ${formatBytes(sample.heapLimitBytes)} (${getHeapUsageInPercent(sample).toFixed(0)}%)`;
}

// One JSON object per line, so a trail cut short by a crash still parses up to its last whole line.
export function formatTrailLine(sample: MemorySample, $event?: string): string {
  return `${
    JSON.stringify({
      /* eslint-disable perfectionist/sort-objects -- The time and the event lead, so the file reads as a log. */
      time: new Date(sample.timestamp).toISOString(),
      event: $event,
      activity: sample.activity,
      externalBytes: sample.externalBytes,
      heapLimitBytes: sample.heapLimitBytes,
      residentSetSizeBytes: sample.residentSetSizeBytes,
      totalHeapBytes: sample.totalHeapBytes,
      usedHeapBytes: sample.usedHeapBytes,
      usedPercent: Number(getHeapUsageInPercent(sample).toFixed(1))
      /* eslint-enable perfectionist/sort-objects -- The time and the event lead, so the file reads as a log. */
    })
  }\n`;
}

// `gc` is on the global only when V8 runs with `--expose-gc`, which Obsidian takes as `--js-flags=--expose-gc`.
export function getExposedGc(): (() => void) | null {
  const gc: unknown = Reflect.get(window, 'gc');
  return typeof gc === 'function' ? gc as () => void : null;
}

// The heap growth over the samples given, in bytes per minute, or `null` when they do not span any time.
export function getHeapGrowthPerMinute(samples: readonly MemorySample[]): null | number {
  const first = samples[0];
  const last = samples.at(-1);
  if (!first || !last || last.timestamp <= first.timestamp) {
    return null;
  }

  const MILLISECONDS_IN_MINUTE = 60_000;
  return (last.usedHeapBytes - first.usedHeapBytes) / ((last.timestamp - first.timestamp) / MILLISECONDS_IN_MINUTE);
}

export function getHeapSnapshotFileName(timestamp: number, reason: string): string {
  const stamp = new Date(timestamp).toISOString().replaceAll(':', '-').replace(/\.\d+Z$/, 'Z');
  return `heap-${stamp}-${reason}.heapsnapshot`;
}

export function getHeapUsageInPercent(sample: MemorySample): number {
  return sample.heapLimitBytes <= 0 ? 0 : sample.usedHeapBytes / sample.heapLimitBytes * PERCENT;
}

export function getMemoryLevel(sample: MemorySample, thresholds: MemoryThresholds): MemoryLevel {
  const usage = getHeapUsageInPercent(sample);
  if (usage >= thresholds.criticalThresholdInPercent) {
    return MemoryLevel.Critical;
  }

  if (usage >= thresholds.warningThresholdInPercent) {
    return MemoryLevel.Warning;
  }

  return MemoryLevel.Normal;
}

export function hasEnoughDiskSpaceForSnapshot(freeBytes: number, usedHeapBytes: number): boolean {
  return freeBytes >= usedHeapBytes * SNAPSHOT_SIZE_FACTOR + SNAPSHOT_FREE_SPACE_MARGIN_IN_BYTES;
}

export function isValidPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function isValidThreshold(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= PERCENT;
}
