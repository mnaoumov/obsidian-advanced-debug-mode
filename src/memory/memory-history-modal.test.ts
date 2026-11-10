import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { App } from 'obsidian';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { DesktopMemoryMonitorComponent } from './desktop-memory-monitor-component.ts';
import type { MemorySample } from './memory-monitor.ts';

import { MemoryHistoryModal } from './memory-history-modal.ts';
import { BYTES_IN_MEGABYTE } from './memory-monitor.ts';

const GIGABYTE = 1024 * BYTES_IN_MEGABYTE;
const MINUTE = 60_000;

function createSample(timestamp: number, usedHeapBytes: number): MemorySample {
  return {
    activity: 'command app:reload 3s ago',
    externalBytes: 0,
    heapLimitBytes: 4 * GIGABYTE,
    residentSetSizeBytes: 2 * GIGABYTE,
    timestamp,
    totalHeapBytes: usedHeapBytes,
    usedHeapBytes
  };
}

function openModal(samples: MemorySample[]): MemoryHistoryModal {
  const modal = new MemoryHistoryModal({
    app: new App(),
    desktopComponent: castTo<DesktopMemoryMonitorComponent>({
      getHistory: () => samples,
      getTrailFilePath: () => '/tmp/memory-trail.jsonl'
    })
  });
  modal.onOpen();
  return modal;
}

describe('MemoryHistoryModal', () => {
  it('should say there are no samples yet', () => {
    const modal = openModal([]);

    expect(modal.contentEl.textContent).toContain('/tmp/memory-trail.jsonl');
    expect(modal.contentEl.textContent).toContain('No samples yet.');
    expect(modal.contentEl.querySelector('table')).toBeNull();
  });

  it('should list the samples newest first, with the growth rate', () => {
    const modal = openModal([createSample(0, GIGABYTE), createSample(MINUTE, 2 * GIGABYTE)]);

    expect(modal.contentEl.textContent).toContain('Heap growth over the history: 1.00 GB/min up.');
    const rows = [...modal.contentEl.querySelectorAll(':scope tbody tr')].map((row) => [...row.querySelectorAll('td')].slice(1).map((cell) => cell.textContent));
    expect(rows).toEqual([
      ['2.00 GB', '50%', '2.00 GB', '2.00 GB', 'command app:reload 3s ago'],
      ['1.00 GB', '25%', '1.00 GB', '2.00 GB', 'command app:reload 3s ago']
    ]);
  });

  it('should say when the heap went down', () => {
    const modal = openModal([createSample(0, 2 * GIGABYTE), createSample(MINUTE, GIGABYTE)]);

    expect(modal.contentEl.textContent).toContain('1.00 GB/min down.');
  });

  it('should leave the growth rate out for a single sample', () => {
    const modal = openModal([createSample(0, GIGABYTE)]);

    expect(modal.contentEl.textContent).not.toContain('Heap growth');
  });
});
