import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

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
  isValidPositiveNumber,
  isValidThreshold,
  MemoryHistory,
  MemoryLevel
} from './memory-monitor.ts';

const GIGABYTE = 1024 * BYTES_IN_MEGABYTE;
const LIMIT = 4 * GIGABYTE;
const TIMESTAMP = Date.UTC(2026, 10, 6, 22, 15, 30, 123);
const MINUTE = 60_000;

function createSample(overrides: Partial<MemorySample> = {}): MemorySample {
  return {
    activity: '',
    externalBytes: 0,
    heapLimitBytes: LIMIT,
    residentSetSizeBytes: 0,
    timestamp: TIMESTAMP,
    totalHeapBytes: 0,
    usedHeapBytes: GIGABYTE,
    ...overrides
  };
}

describe('formatBytes', () => {
  it('should pick the unit by size', () => {
    const HALF = 0.5;
    expect(formatBytes(2 * GIGABYTE + HALF * GIGABYTE)).toBe('2.50 GB');
    expect(formatBytes(300 * BYTES_IN_MEGABYTE)).toBe('300 MB');
    expect(formatBytes(2048)).toBe('2 KB');
  });
});

describe('getHeapUsageInPercent', () => {
  it('should be the used share of the limit, and 0 without a limit', () => {
    expect(getHeapUsageInPercent(createSample())).toBe(25);
    expect(getHeapUsageInPercent(createSample({ heapLimitBytes: 0 }))).toBe(0);
  });
});

describe('getMemoryLevel', () => {
  const thresholds = { criticalThresholdInPercent: 90, warningThresholdInPercent: 70 };

  it('should rise with the share of the limit', () => {
    expect(getMemoryLevel(createSample(), thresholds)).toBe(MemoryLevel.Normal);
    expect(getMemoryLevel(createSample({ usedHeapBytes: 0.7 * LIMIT }), thresholds)).toBe(MemoryLevel.Warning);
    expect(getMemoryLevel(createSample({ usedHeapBytes: 0.95 * LIMIT }), thresholds)).toBe(MemoryLevel.Critical);
  });
});

describe('formatStatusBarText', () => {
  it('should show the used heap, the limit and the share', () => {
    expect(formatStatusBarText(createSample())).toBe('Heap 1.00 GB / 4.00 GB (25%)');
  });
});

describe('formatTrailLine', () => {
  it('should write one JSON object per line, time first', () => {
    const line = formatTrailLine(createSample({ activity: 'command app:reload 3s ago' }), 'start');

    expect(line.endsWith('\n')).toBe(true);
    expect(line.startsWith('{"time":"2026-11-06T22:15:30.123Z","event":"start"')).toBe(true);
    expect(JSON.parse(line)).toEqual({
      activity: 'command app:reload 3s ago',
      event: 'start',
      externalBytes: 0,
      heapLimitBytes: LIMIT,
      residentSetSizeBytes: 0,
      time: '2026-11-06T22:15:30.123Z',
      totalHeapBytes: 0,
      usedHeapBytes: GIGABYTE,
      usedPercent: 25
    });
  });

  it('should leave the event out when there is none', () => {
    expect(JSON.parse(formatTrailLine(createSample()))).not.toHaveProperty('event');
  });
});

describe('getHeapGrowthPerMinute', () => {
  it('should be the change per minute between the first and the last sample', () => {
    expect(getHeapGrowthPerMinute([
      createSample(),
      createSample({ timestamp: TIMESTAMP + 2 * MINUTE, usedHeapBytes: GIGABYTE + 200 * BYTES_IN_MEGABYTE })
    ])).toBe(100 * BYTES_IN_MEGABYTE);
  });

  it('should be null when the samples span no time', () => {
    expect(getHeapGrowthPerMinute([])).toBeNull();
    expect(getHeapGrowthPerMinute([createSample()])).toBeNull();
  });
});

describe('getHeapSnapshotFileName', () => {
  it('should be a file name with no colons', () => {
    expect(getHeapSnapshotFileName(TIMESTAMP, 'manual')).toBe('heap-2026-11-06T22-15-30Z-manual.heapsnapshot');
  });
});

describe('hasEnoughDiskSpaceForSnapshot', () => {
  it('should ask for twice the used heap plus a margin', () => {
    expect(hasEnoughDiskSpaceForSnapshot(2 * GIGABYTE + 512 * BYTES_IN_MEGABYTE, GIGABYTE)).toBe(true);
    expect(hasEnoughDiskSpaceForSnapshot(2 * GIGABYTE + 511 * BYTES_IN_MEGABYTE, GIGABYTE)).toBe(false);
  });
});

describe('isValidPositiveNumber', () => {
  it('should accept only a finite number above 0', () => {
    expect(isValidPositiveNumber(0.5)).toBe(true);
    expect(isValidPositiveNumber(0)).toBe(false);
    expect(isValidPositiveNumber(Infinity)).toBe(false);
    expect(isValidPositiveNumber('5')).toBe(false);
  });
});

describe('isValidThreshold', () => {
  it('should accept a percentage above 0 and at most 100', () => {
    expect(isValidThreshold(100)).toBe(true);
    expect(isValidThreshold(101)).toBe(false);
    expect(isValidThreshold(0)).toBe(false);
    expect(isValidThreshold(NaN)).toBe(false);
  });
});

describe('MemoryHistory', () => {
  it('should keep only the latest samples', () => {
    const history = new MemoryHistory(2);
    history.add(createSample({ timestamp: 1 }));
    history.add(createSample({ timestamp: 2 }));
    history.add(createSample({ timestamp: 3 }));

    expect(history.getSamples().map((sample) => sample.timestamp)).toEqual([2, 3]);
  });
});

describe('getExposedGc', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'gc');
  });

  it('should return the global gc only when it is a function', () => {
    expect(getExposedGc()).toBeNull();
    const gc = vi.fn();
    Reflect.set(window, 'gc', gc);
    expect(getExposedGc()).toBe(gc);
  });
});
